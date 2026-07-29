"""Central Odoo-backed records gateway for the marketing and tenders platform."""
from __future__ import annotations

import asyncio
import base64
import html
import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import requests

MARKER = "ARAAK_MARKETING_V1:"
DEFAULT_SOURCES = ["اعتماد", "فرصة", "منافس", "مناقصات", "إحالة مباشرة", "مصدر داخلي"]
MAX_FILES = 5
MAX_FILE_SIZE = 3 * 1024 * 1024


@dataclass(frozen=True)
class OdooConfig:
    enabled: bool
    url: str
    database: str
    api_key: str
    language: str
    timeout: float
    read_only: bool


def config() -> OdooConfig:
    return OdooConfig(
        enabled=os.getenv("ODOO_ENABLED", "true").lower() != "false",
        url=os.getenv("ODOO_URL", "https://araakceo.odoo.com").rstrip("/"),
        database=os.getenv("ODOO_DATABASE", "araakceo").strip(),
        api_key=os.getenv("ODOO_API_KEY", "").strip(),
        language=os.getenv("ODOO_LANGUAGE", "en_US").strip(),
        timeout=max(3.0, float(os.getenv("ODOO_TIMEOUT_MS", "20000")) / 1000.0),
        read_only=os.getenv("ODOO_READ_ONLY", "false").lower() == "true",
    )


def _odoo_call(model: str, method: str, parameters: dict[str, Any] | None = None) -> Any:
    cfg = config()
    if not cfg.enabled:
        raise RuntimeError("التكامل المؤسسي غير مفعل.")
    if not cfg.api_key:
        raise RuntimeError("مفتاح التكامل المؤسسي غير مضاف إلى بيئة ARAAK CEO.")

    response = requests.post(
        f"{cfg.url}/json/2/{model}/{method}",
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": f"bearer {cfg.api_key}",
            "X-Odoo-Database": cfg.database,
            "User-Agent": "ARAAK-CEO-Marketing-Gateway/1.0",
        },
        json={"context": {"lang": cfg.language}, **(parameters or {})},
        timeout=cfg.timeout,
    )
    try:
        payload = response.json()
    except ValueError:
        payload = None
    if not response.ok:
        message = (
            payload.get("message")
            if isinstance(payload, dict) and payload.get("message")
            else payload.get("name")
            if isinstance(payload, dict) and payload.get("name")
            else payload.get("error")
            if isinstance(payload, dict) and payload.get("error")
            else f"HTTP {response.status_code}"
        )
        raise RuntimeError(f"تعذر تنفيذ العملية في السجل المركزي: {message}")
    return payload


async def odoo_call(model: str, method: str, parameters: dict[str, Any] | None = None) -> Any:
    return await asyncio.to_thread(_odoo_call, model, method, parameters)


def _encode_metadata(metadata: dict[str, Any]) -> str:
    raw = json.dumps(metadata, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _decode_metadata(description: Any) -> dict[str, Any] | None:
    match = re.search(r"ARAAK_MARKETING_V1:([A-Za-z0-9_-]+)", str(description or ""))
    if not match:
        return None
    token = match.group(1)
    token += "=" * (-len(token) % 4)
    try:
        decoded = base64.urlsafe_b64decode(token.encode("ascii")).decode("utf-8")
        value = json.loads(decoded)
        return value if isinstance(value, dict) else None
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
        return None


def _strip_html(value: Any) -> str:
    text = re.sub(r"<!--.*?-->", " ", str(value or ""), flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def _description(metadata: dict[str, Any], description: Any, requirements: Any) -> str:
    marker = f"<!--{MARKER}{_encode_metadata(metadata)}-->"
    sections: list[str] = []
    if description:
        sections.append(f"<p><strong>الوصف:</strong> {html.escape(str(description))}</p>")
    if requirements:
        sections.append(f"<p><strong>المتطلبات:</strong> {html.escape(str(requirements))}</p>")
    if metadata.get("reference"):
        sections.append(f"<p><strong>المرجع:</strong> {html.escape(str(metadata['reference']))}</p>")
    if metadata.get("source"):
        sections.append(f"<p><strong>المصدر:</strong> {html.escape(str(metadata['source']))}</p>")
    return marker + "\n".join(sections)


def _created_id(result: Any) -> int | None:
    if isinstance(result, int):
        return result
    if isinstance(result, list) and result:
        if isinstance(result[0], int):
            return result[0]
        if isinstance(result[0], dict) and isinstance(result[0].get("id"), int):
            return result[0]["id"]
    if isinstance(result, dict) and isinstance(result.get("id"), int):
        return result["id"]
    return None


def _m2o_label(value: Any) -> str:
    return str(value[1] or "") if isinstance(value, list) and len(value) > 1 else ""


def _attachment(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": int(record["id"]),
        "name": str(record.get("name") or "ملف"),
        "mime_type": str(record.get("mimetype") or "application/octet-stream"),
        "file_size": int(record.get("file_size") or 0),
        "created_at": record.get("create_date"),
    }


def _record(record: dict[str, Any], attachments: dict[int, list[dict[str, Any]]]) -> dict[str, Any]:
    metadata = _decode_metadata(record.get("description")) or {}
    record_id = int(record["id"])
    kind = "tender" if metadata.get("kind") == "tender" else "opportunity"
    return {
        "id": record_id,
        "kind": kind,
        "title": str(record.get("name") or ""),
        "reference": metadata.get("reference"),
        "client": record.get("partner_name") or metadata.get("client"),
        "entity": metadata.get("entity"),
        "city": record.get("city") or metadata.get("city"),
        "value": float(record.get("expected_revenue") or metadata.get("value") or 0) or None,
        "deadline": record.get("date_deadline") or metadata.get("deadline"),
        "publication_date": metadata.get("publication_date"),
        "description": metadata.get("description") or _strip_html(record.get("description")),
        "requirements": metadata.get("requirements"),
        "source": metadata.get("source") or "مصدر داخلي",
        "source_url": metadata.get("source_url"),
        "status": metadata.get("status") or ("cancelled" if record.get("active") is False else "active"),
        "current_stage": metadata.get("current_stage") or _m2o_label(record.get("stage_id")) or "الاستقبال",
        "stage_label": _m2o_label(record.get("stage_id")) or metadata.get("current_stage") or "الاستقبال",
        "probability": float(record.get("probability") or 0),
        "owner": _m2o_label(record.get("user_id")) or None,
        "team": _m2o_label(record.get("team_id")) or None,
        "created_at": record.get("create_date"),
        "updated_at": record.get("write_date"),
        "attachments": attachments.get(record_id, []),
    }


async def list_records(kind: str | None = None) -> list[dict[str, Any]]:
    rows = await odoo_call(
        "crm.lead",
        "search_read",
        {
            "domain": [["description", "ilike", MARKER]],
            "fields": [
                "id", "name", "partner_name", "city", "expected_revenue", "date_deadline",
                "description", "stage_id", "probability", "active", "create_date", "write_date",
                "user_id", "team_id",
            ],
            "order": "create_date desc",
            "limit": 250,
        },
    )
    leads = rows if isinstance(rows, list) else []
    lead_ids = [int(row["id"]) for row in leads if row.get("id")]
    attachments: dict[int, list[dict[str, Any]]] = {}
    if lead_ids:
        attachment_rows = await odoo_call(
            "ir.attachment",
            "search_read",
            {
                "domain": [["res_model", "=", "crm.lead"], ["res_id", "in", lead_ids]],
                "fields": ["id", "name", "mimetype", "file_size", "create_date", "res_id"],
                "order": "create_date desc",
                "limit": 1000,
            },
        )
        for item in attachment_rows if isinstance(attachment_rows, list) else []:
            attachments.setdefault(int(item.get("res_id") or 0), []).append(_attachment(item))

    normalized = [_record(row, attachments) for row in leads]
    return [row for row in normalized if not kind or row["kind"] == kind]


async def create_record(payload: dict[str, Any], user: dict[str, Any]) -> dict[str, Any]:
    cfg = config()
    if cfg.read_only:
        raise RuntimeError("التكامل المؤسسي مضبوط حاليًا على القراءة فقط.")

    kind = "tender" if payload.get("kind") == "tender" else "opportunity"
    record = payload.get("record") if isinstance(payload.get("record"), dict) else {}
    title = str(record.get("title") or "").strip()
    if not title:
        raise ValueError("عنوان الفرصة أو المنافسة مطلوب.")

    metadata = {
        "kind": kind,
        "reference": str(record.get("reference") or "").strip() or None,
        "client": str(record.get("client") or "").strip() or None,
        "entity": str(record.get("entity") or "").strip() or None,
        "city": str(record.get("city") or "").strip() or None,
        "value": float(record["value"]) if record.get("value") else None,
        "deadline": record.get("deadline") or None,
        "publication_date": record.get("publication_date") or None,
        "description": str(record.get("description") or "").strip() or None,
        "requirements": str(record.get("requirements") or "").strip() or None,
        "source": str(record.get("source") or "مصدر داخلي").strip(),
        "source_url": str(record.get("source_url") or "").strip() or None,
        "status": "in_progress" if kind == "tender" else "new",
        "current_stage": "الاستقبال" if kind == "tender" else "الدراسة الأولية",
        "created_by_email": user.get("email"),
        "created_by_role": user.get("role"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    values = {
        "name": title,
        "type": "opportunity",
        "description": _description(metadata, record.get("description"), record.get("requirements")),
    }
    optional_values = {
        "partner_name": str(record.get("client") or record.get("entity") or "").strip(),
        "city": str(record.get("city") or "").strip(),
        "expected_revenue": float(record["value"]) if record.get("value") else None,
        "date_deadline": record.get("deadline") or None,
    }
    values.update({key: value for key, value in optional_values.items() if value not in (None, "")})

    created = await odoo_call("crm.lead", "create", {"vals_list": [values]})
    lead_id = _created_id(created)
    if not lead_id:
        raise RuntimeError("تم إرسال السجل، لكن لم يُرجع النظام رقمًا مرجعيًا صالحًا.")

    attachment_ids: list[int] = []
    files = payload.get("files") if isinstance(payload.get("files"), list) else []
    for file in files[:MAX_FILES]:
        if not isinstance(file, dict) or not file.get("name") or not file.get("data_base64"):
            continue
        size = int(file.get("size") or 0)
        if size > MAX_FILE_SIZE:
            raise ValueError(f"الملف {file['name']} يتجاوز الحد المسموح عبر البوابة.")
        attachment_values = {
            "name": str(file["name"]),
            "type": "binary",
            "datas": re.sub(r"^data:[^;]+;base64,", "", str(file["data_base64"])),
            "mimetype": str(file.get("mime_type") or "application/octet-stream"),
            "res_model": "crm.lead",
            "res_id": lead_id,
            "public": False,
        }
        result = await odoo_call("ir.attachment", "create", {"vals_list": [attachment_values]})
        attachment_id = _created_id(result)
        if attachment_id:
            attachment_ids.append(attachment_id)

    records = await list_records(kind)
    return {
        "record": next((item for item in records if item["id"] == lead_id), {"id": lead_id, "kind": kind, "title": title}),
        "attachment_ids": attachment_ids,
    }


async def download_attachment(attachment_id: Any) -> dict[str, Any]:
    attachment_rows = await odoo_call(
        "ir.attachment",
        "read",
        {
            "ids": [int(attachment_id)],
            "fields": ["id", "name", "mimetype", "datas", "file_size", "res_model", "res_id"],
            "load": None,
        },
    )
    attachment = attachment_rows[0] if isinstance(attachment_rows, list) and attachment_rows else None
    if not attachment or attachment.get("res_model") != "crm.lead":
        raise RuntimeError("الملف المطلوب غير متاح.")

    lead_rows = await odoo_call(
        "crm.lead",
        "read",
        {"ids": [int(attachment["res_id"])], "fields": ["id", "description"], "load": None},
    )
    lead = lead_rows[0] if isinstance(lead_rows, list) and lead_rows else None
    if not lead or not _decode_metadata(lead.get("description")):
        raise RuntimeError("الملف غير مرتبط بسجل مسموح.")

    return {
        "id": int(attachment["id"]),
        "name": str(attachment.get("name") or "file"),
        "mime_type": str(attachment.get("mimetype") or "application/octet-stream"),
        "file_size": int(attachment.get("file_size") or 0),
        "data_base64": str(attachment.get("datas") or ""),
    }


async def execute(payload: dict[str, Any], user: dict[str, Any]) -> dict[str, Any]:
    action = str(payload.get("action") or "list")
    if action == "sources":
        return {"ok": True, "sources": DEFAULT_SOURCES}
    if action == "status":
        cfg = config()
        return {"ok": True, "configured": cfg.enabled and bool(cfg.api_key), "read_only": cfg.read_only}
    if action == "list":
        requested_kind = payload.get("kind")
        kind = requested_kind if requested_kind in ("opportunity", "tender") else None
        records = await list_records(kind)
        return {"ok": True, "records": records, "total": len(records)}
    if action == "create":
        result = await create_record(payload, user)
        return {"ok": True, **result}
    if action == "download":
        return {"ok": True, "file": await download_attachment(payload.get("attachment_id"))}
    raise ValueError("العملية المطلوبة غير مدعومة.")
