from __future__ import annotations

import asyncio
import base64
import html
import json
import re
from datetime import datetime, timezone
from typing import Any

from .odoo_connector import OdooConnectorError, get_odoo_connector

MARKER = "ARAAK_MARKETING_V1:"
CENTRAL_MODEL = "project.project"
SOURCES = ["اعتماد", "فرصة", "منافس", "مناقصات", "إحالة مباشرة", "مصدر داخلي"]
MAX_FILES = 5
MAX_FILE_SIZE = 3 * 1024 * 1024
WRITE_ROLES = {"admin", "ceo", "vp_development", "vp_investment", "dev_manager", "tracker"}


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


def ensure_write_access(user: dict[str, Any]) -> None:
    if str(user.get("role") or "") not in WRITE_ROLES:
        raise PermissionError("لا يملك هذا الحساب صلاحية إنشاء سجلات أو مرفقات.")


async def model_call(
    model: str,
    method: str,
    json2_body: dict[str, Any],
    xmlrpc_args: list[Any],
    xmlrpc_kwargs: dict[str, Any] | None = None,
) -> Any:
    connector = get_odoo_connector()

    def run() -> Any:
        errors: list[str] = []
        for protocol in connector._protocol_candidates():
            try:
                if protocol == "json2":
                    return connector._json2_call(model, method, json2_body)
                return connector._xmlrpc_call(model, method, xmlrpc_args, xmlrpc_kwargs or {})
            except Exception as error:
                errors.append(f"{protocol}: {error}")
        raise OdooConnectorError("؛ ".join(errors) or "تعذر تنفيذ العملية في السجل المركزي")

    return await asyncio.to_thread(run)


async def search_read(
    model: str,
    domain: list[Any],
    fields: list[str],
    limit: int,
    order: str,
) -> list[dict[str, Any]]:
    connector = get_odoo_connector()
    result = await asyncio.to_thread(
        connector._call_model_sync,
        model,
        "search_read",
        [domain],
        {"fields": fields, "limit": limit, "order": order},
    )
    return result if isinstance(result, list) else []


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
        "client": metadata.get("client"),
        "entity": metadata.get("entity"),
        "city": metadata.get("city"),
        "value": metadata.get("value"),
        "deadline": metadata.get("deadline"),
        "publication_date": metadata.get("publication_date"),
        "description": metadata.get("description") or strip_html(row.get("description")),
        "requirements": metadata.get("requirements"),
        "source": metadata.get("source") or "مصدر داخلي",
        "source_url": metadata.get("source_url"),
        "status": metadata.get("status") or ("cancelled" if row.get("active") is False else "active"),
        "current_stage": metadata.get("current_stage") or "الاستقبال",
        "stage_label": metadata.get("current_stage") or "الاستقبال",
        "probability": float(metadata.get("probability") or 0),
        "owner": m2o_name(row.get("user_id")) or None,
        "team": m2o_name(row.get("company_id")) or None,
        "created_at": row.get("create_date"),
        "updated_at": row.get("write_date"),
        "attachments": attachments.get(row_id, []),
    }


async def list_records(kind: str | None = None) -> list[dict[str, Any]]:
    projects = await search_read(
        CENTRAL_MODEL,
        [["description", "ilike", MARKER]],
        ["id", "name", "description", "active", "create_date", "write_date", "user_id", "company_id"],
        250,
        "create_date desc, id desc",
    )
    ids = [int(row["id"]) for row in projects if row.get("id")]
    grouped: dict[int, list[dict[str, Any]]] = {}
    if ids:
        rows = await search_read(
            "ir.attachment",
            [["res_model", "=", CENTRAL_MODEL], ["res_id", "in", ids]],
            ["id", "name", "mimetype", "file_size", "create_date", "res_id"],
            1000,
            "create_date desc, id desc",
        )
        for row in rows:
            grouped.setdefault(int(row.get("res_id") or 0), []).append(attachment_view(row))
    records = [record_view(row, grouped) for row in projects]
    return [row for row in records if not kind or row["kind"] == kind]


async def create_project(values: dict[str, Any]) -> int:
    result = await model_call(
        CENTRAL_MODEL,
        "create",
        {"vals_list": [values]},
        [[values]],
    )
    project_id = created_id(result)
    if not project_id:
        raise RuntimeError("لم يُرجع السجل المركزي رقمًا صالحًا للسجل الجديد.")
    return project_id


async def unlink_project(project_id: int) -> None:
    await model_call(
        CENTRAL_MODEL,
        "unlink",
        {"ids": [project_id]},
        [[project_id]],
    )


async def create_attachment(values: dict[str, Any]) -> int | None:
    result = await model_call(
        "ir.attachment",
        "create",
        {"vals_list": [values]},
        [[values]],
    )
    return created_id(result)


async def read_rows(model: str, ids: list[int], fields: list[str]) -> list[dict[str, Any]]:
    result = await model_call(
        model,
        "read",
        {"ids": ids, "fields": fields, "load": None},
        [ids],
        {"fields": fields, "load": None},
    )
    return result if isinstance(result, list) else []


async def create_record(payload: dict[str, Any], user: dict[str, Any]) -> dict[str, Any]:
    ensure_write_access(user)
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
    project_id = await create_project({
        "name": title,
        "description": description_html(metadata),
    })

    attachment_ids: list[int] = []
    files = payload.get("files") if isinstance(payload.get("files"), list) else []
    for item in files[:MAX_FILES]:
        if not isinstance(item, dict) or not item.get("name") or not item.get("data_base64"):
            continue
        if int(item.get("size") or 0) > MAX_FILE_SIZE:
            raise ValueError(f"الملف {item['name']} يتجاوز الحد المسموح.")
        attachment_id = await create_attachment({
            "name": str(item["name"]),
            "type": "binary",
            "datas": re.sub(r"^data:[^;]+;base64,", "", str(item["data_base64"])),
            "mimetype": str(item.get("mime_type") or "application/octet-stream"),
            "res_model": CENTRAL_MODEL,
            "res_id": project_id,
            "public": False,
        })
        if attachment_id:
            attachment_ids.append(attachment_id)

    records = await list_records(kind)
    return {
        "record": next((row for row in records if row["id"] == project_id), {"id": project_id, "kind": kind, "title": title}),
        "attachment_ids": attachment_ids,
    }


async def download_attachment(attachment_id: Any) -> dict[str, Any]:
    rows = await read_rows(
        "ir.attachment",
        [int(attachment_id)],
        ["id", "name", "mimetype", "datas", "file_size", "res_model", "res_id"],
    )
    item = rows[0] if rows else None
    if not item or item.get("res_model") != CENTRAL_MODEL:
        raise RuntimeError("الملف المطلوب غير متاح.")
    projects = await read_rows(CENTRAL_MODEL, [int(item["res_id"])], ["id", "description"])
    project = projects[0] if projects else None
    if not project or not decode_metadata(project.get("description")):
        raise RuntimeError("الملف غير مرتبط بسجل مسموح.")
    return {
        "id": int(item["id"]),
        "name": str(item.get("name") or "file"),
        "mime_type": str(item.get("mimetype") or "application/octet-stream"),
        "file_size": int(item.get("file_size") or 0),
        "data_base64": str(item.get("datas") or ""),
    }


async def verify_write(user: dict[str, Any]) -> dict[str, Any]:
    ensure_write_access(user)
    metadata = {
        "kind": "opportunity",
        "status": "verification",
        "source": "فحص مؤسسي",
        "created_by_email": user.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    project_id = await create_project({
        "name": "ARAAK Marketing Gateway Verification",
        "description": description_html(metadata),
    })
    try:
        return {"write_verified": True, "temporary_record_id": project_id}
    finally:
        await unlink_project(project_id)


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
            "read_only": False,
            "write_role_allowed": str(user.get("role") or "") in WRITE_ROLES,
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
    if action == "verify_write":
        return {"ok": True, **(await verify_write(user))}
    raise ValueError("العملية المطلوبة غير مدعومة.")


__all__ = ["OdooConnectorError", "execute"]
