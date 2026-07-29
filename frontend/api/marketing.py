from __future__ import annotations

import asyncio
import base64
import html
import json
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from api.backend.odoo_connector import OdooConnectorError, get_odoo_connector
from api.unified import hosted_get_current_user

MARKER = "ARAAK_MARKETING_V1:"
SOURCES = ["اعتماد", "فرصة", "منافس", "مناقصات", "إحالة مباشرة", "مصدر داخلي"]
MAX_FILES = 5
MAX_FILE_SIZE = 3 * 1024 * 1024

app = FastAPI(title="ARAAK Marketing Central Records Gateway")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)


def encode_metadata(metadata: dict[str, Any]) -> str:
    raw = json.dumps(metadata, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_metadata(description: Any) -> dict[str, Any] | None:
    match = re.search(r"ARAAK_MARKETING_V1:([A-Za-z0-9_-]+)", str(description or ""))
    if not match:
        return None
    token = match.group(1) + "=" * (-len(match.group(1)) % 4)
    try:
        value = json.loads(base64.urlsafe_b64decode(token.encode("ascii")).decode("utf-8"))
        return value if isinstance(value, dict) else None
    except Exception:
        return None


def strip_html(value: Any) -> str:
    text = re.sub(r"<!--.*?-->", " ", str(value or ""), flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def m2o_name(value: Any) -> str:
    return str(value[1] or "") if isinstance(value, (list, tuple)) and len(value) > 1 else ""


def created_id(value: Any) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, list) and value:
        if isinstance(value[0], int):
            return value[0]
        if isinstance(value[0], dict) and isinstance(value[0].get("id"), int):
            return value[0]["id"]
    if isinstance(value, dict) and isinstance(value.get("id"), int):
        return value["id"]
    return None


async def call(model: str, method: str, args: list[Any] | None = None, kwargs: dict[str, Any] | None = None) -> Any:
    connector = get_odoo_connector()
    return await asyncio.to_thread(
        connector._call_model_sync,
        model,
        method,
        args or [],
        kwargs or {},
    )


def description_html(metadata: dict[str, Any]) -> str:
    marker = f"<!--{MARKER}{encode_metadata(metadata)}-->"
    sections = []
    if metadata.get("description"):
        sections.append(f"<p><strong>الوصف:</strong> {html.escape(str(metadata['description']))}</p>")
    if metadata.get("requirements"):
        sections.append(f"<p><strong>المتطلبات:</strong> {html.escape(str(metadata['requirements']))}</p>")
    if metadata.get("reference"):
        sections.append(f"<p><strong>المرجع:</strong> {html.escape(str(metadata['reference']))}</p>")
    if metadata.get("source"):
        sections.append(f"<p><strong>المصدر:</strong> {html.escape(str(metadata['source']))}</p>")
    return marker + "\n".join(sections)


def attachment_view(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "name": str(row.get("name") or "ملف"),
        "mime_type": str(row.get("mimetype") or "application/octet-stream"),
        "file_size": int(row.get("file_size") or 0),
        "created_at": row.get("create_date"),
    }


def record_view(row: dict[str, Any], attachments: dict[int, list[dict[str, Any]]]) -> dict[str, Any]:
    metadata = decode_metadata(row.get("description")) or {}
    row_id = int(row["id"])
    kind = "tender" if metadata.get("kind") == "tender" else "opportunity"
    return {
        "id": row_id,
        "kind": kind,
        "title": str(row.get("name") or ""),
        "reference": metadata.get("reference"),
        "client": row.get("partner_name") or metadata.get("client"),
        "entity": metadata.get("entity"),
        "city": row.get("city") or metadata.get("city"),
        "value": float(row.get("expected_revenue") or metadata.get("value") or 0) or None,
        "deadline": row.get("date_deadline") or metadata.get("deadline"),
        "publication_date": metadata.get("publication_date"),
        "description": metadata.get("description") or strip_html(row.get("description")),
        "requirements": metadata.get("requirements"),
        "source": metadata.get("source") or "مصدر داخلي",
        "source_url": metadata.get("source_url"),
        "status": metadata.get("status") or ("cancelled" if row.get("active") is False else "active"),
        "current_stage": metadata.get("current_stage") or m2o_name(row.get("stage_id")) or "الاستقبال",
        "stage_label": m2o_name(row.get("stage_id")) or metadata.get("current_stage") or "الاستقبال",
        "probability": float(row.get("probability") or 0),
        "owner": m2o_name(row.get("user_id")) or None,
        "team": m2o_name(row.get("team_id")) or None,
        "created_at": row.get("create_date"),
        "updated_at": row.get("write_date"),
        "attachments": attachments.get(row_id, []),
    }


async def list_records(kind: str | None = None) -> list[dict[str, Any]]:
    leads = await call(
        "crm.lead",
        "search_read",
        [[["description", "ilike", MARKER]]],
        {
            "fields": [
                "id", "name", "partner_name", "city", "expected_revenue", "date_deadline",
                "description", "stage_id", "probability", "active", "create_date", "write_date",
                "user_id", "team_id",
            ],
            "order": "create_date desc",
            "limit": 250,
        },
    )
    leads = leads if isinstance(leads, list) else []
    ids = [int(row["id"]) for row in leads if row.get("id")]
    grouped: dict[int, list[dict[str, Any]]] = {}
    if ids:
        rows = await call(
            "ir.attachment",
            "search_read",
            [[[
                "res_model", "=", "crm.lead"
            ], [
                "res_id", "in", ids
            ]]],
            {
                "fields": ["id", "name", "mimetype", "file_size", "create_date", "res_id"],
                "order": "create_date desc",
                "limit": 1000,
            },
        )
        for row in rows if isinstance(rows, list) else []:
            grouped.setdefault(int(row.get("res_id") or 0), []).append(attachment_view(row))
    records = [record_view(row, grouped) for row in leads]
    return [row for row in records if not kind or row["kind"] == kind]


async def create_record(payload: dict[str, Any], user: dict[str, Any]) -> dict[str, Any]:
    connector = get_odoo_connector()
    if connector.config.read_only:
        raise RuntimeError("التكامل المؤسسي مضبوط على القراءة فقط؛ يجب السماح بالكتابة في إعدادات ARAAK CEO.")

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
    values: dict[str, Any] = {
        "name": title,
        "type": "opportunity",
        "description": description_html(metadata),
    }
    optional = {
        "partner_name": str(record.get("client") or record.get("entity") or "").strip(),
        "city": str(record.get("city") or "").strip(),
        "expected_revenue": float(record["value"]) if record.get("value") else None,
        "date_deadline": record.get("deadline") or None,
    }
    values.update({key: value for key, value in optional.items() if value not in (None, "")})

    result = await call("crm.lead", "create", [[values]], {})
    lead_id = created_id(result)
    if not lead_id:
        raise RuntimeError("لم يُرجع السجل المركزي رقمًا صالحًا للسجل الجديد.")

    attachment_ids: list[int] = []
    files = payload.get("files") if isinstance(payload.get("files"), list) else []
    for item in files[:MAX_FILES]:
        if not isinstance(item, dict) or not item.get("name") or not item.get("data_base64"):
            continue
        if int(item.get("size") or 0) > MAX_FILE_SIZE:
            raise ValueError(f"الملف {item['name']} يتجاوز الحد المسموح.")
        attachment_values = {
            "name": str(item["name"]),
            "type": "binary",
            "datas": re.sub(r"^data:[^;]+;base64,", "", str(item["data_base64"])),
            "mimetype": str(item.get("mime_type") or "application/octet-stream"),
            "res_model": "crm.lead",
            "res_id": lead_id,
            "public": False,
        }
        attachment_result = await call("ir.attachment", "create", [[attachment_values]], {})
        attachment_id = created_id(attachment_result)
        if attachment_id:
            attachment_ids.append(attachment_id)

    records = await list_records(kind)
    return {
        "record": next((row for row in records if row["id"] == lead_id), {"id": lead_id, "kind": kind, "title": title}),
        "attachment_ids": attachment_ids,
    }


async def download_attachment(attachment_id: Any) -> dict[str, Any]:
    rows = await call(
        "ir.attachment",
        "read",
        [[int(attachment_id)]],
        {"fields": ["id", "name", "mimetype", "datas", "file_size", "res_model", "res_id"], "load": None},
    )
    item = rows[0] if isinstance(rows, list) and rows else None
    if not item or item.get("res_model") != "crm.lead":
        raise RuntimeError("الملف المطلوب غير متاح.")
    leads = await call("crm.lead", "read", [[int(item["res_id"])]], {"fields": ["id", "description"], "load": None})
    lead = leads[0] if isinstance(leads, list) and leads else None
    if not lead or not decode_metadata(lead.get("description")):
        raise RuntimeError("الملف غير مرتبط بسجل مسموح.")
    return {
        "id": int(item["id"]),
        "name": str(item.get("name") or "file"),
        "mime_type": str(item.get("mimetype") or "application/octet-stream"),
        "file_size": int(item.get("file_size") or 0),
        "data_base64": str(item.get("datas") or ""),
    }


async def execute(payload: dict[str, Any], user: dict[str, Any]) -> dict[str, Any]:
    action = str(payload.get("action") or "list")
    if action == "sources":
        return {"ok": True, "sources": SOURCES}
    if action == "status":
        connector = get_odoo_connector()
        state = await connector.status(check=True)
        return {
            "ok": True,
            "configured": bool(connector.config.configured),
            "connected": bool(state.get("connected")),
            "read_only": bool(connector.config.read_only),
            "message": state.get("message"),
        }
    if action == "list":
        kind = payload.get("kind") if payload.get("kind") in ("opportunity", "tender") else None
        records = await list_records(kind)
        return {"ok": True, "records": records, "total": len(records)}
    if action == "create":
        return {"ok": True, **(await create_record(payload, user))}
    if action == "download":
        return {"ok": True, "file": await download_attachment(payload.get("attachment_id"))}
    raise ValueError("العملية المطلوبة غير مدعومة.")


@app.post("/")
@app.post("/api/marketing")
async def marketing_gateway(request: Request, user=Depends(hosted_get_current_user)):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    try:
        return await execute(payload, user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except OdooConnectorError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="تعذر تنفيذ العملية في السجل المركزي.") from error
