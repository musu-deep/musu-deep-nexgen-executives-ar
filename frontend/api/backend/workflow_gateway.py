"""Persistent ARAAK CEO workflows backed by Odoo.

Meeting requests and executive communications remain ARAAK CEO workflows, while
Odoo provides durable storage through small JSON attachments and receives only
approved calendar events and generated follow-up tasks.
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, Request
from starlette.routing import Mount

from . import hr_gateway

STORE_PREFIX = "ARAAK CEO"
REQUEST_KIND = "meeting-request"
MESSAGE_KIND = "message"
FOLLOWUP_PROJECT_NAME = "ARAAK CEO | المتابعات التنفيذية"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(core: Any) -> str:
    return str(core.new_id())


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _writeback_enabled() -> bool:
    return _env_bool("ARAAK_CEO_ODOO_WRITEBACK", True)


def _record_name(kind: str, record_id: str) -> str:
    return f"{STORE_PREFIX} | {kind} | {record_id}.json"


def _record_prefix(kind: str) -> str:
    return f"{STORE_PREFIX} | {kind} |"


def _extract_id(result: Any) -> int:
    if isinstance(result, int):
        return result
    if isinstance(result, list) and result:
        first = result[0]
        if isinstance(first, int):
            return first
        if isinstance(first, dict) and first.get("id"):
            return int(first["id"])
    if isinstance(result, dict):
        if result.get("id"):
            return int(result["id"])
        ids = result.get("ids")
        if isinstance(ids, list) and ids:
            return int(ids[0])
    raise RuntimeError("تعذر استخراج معرّف سجل Odoo")


def _many2one_id(value: Any) -> int | None:
    if isinstance(value, (list, tuple)) and value:
        try:
            return int(value[0])
        except (TypeError, ValueError):
            return None
    if isinstance(value, int):
        return value
    return None


def _decode_attachment(value: Any) -> dict[str, Any] | None:
    if not value:
        return None
    try:
        raw = value.encode("ascii") if isinstance(value, str) else bytes(value)
        decoded = base64.b64decode(raw).decode("utf-8")
        payload = json.loads(decoded)
        return payload if isinstance(payload, dict) else None
    except Exception:
        return None


def _encode_payload(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str).encode("utf-8")
    return base64.b64encode(raw).decode("ascii")


async def _json2_write(odoo_server: Any, model: str, method: str, body: dict[str, Any]) -> Any:
    if not _writeback_enabled():
        raise RuntimeError("الكتابة إلى Odoo معطلة عبر ARAAK_CEO_ODOO_WRITEBACK")
    connector = odoo_server.get_odoo_connector()
    connector._require_configured()
    return await asyncio.to_thread(connector._json2_call, model, method, body)


async def _search_read(
    odoo_server: Any,
    model: str,
    domain: list[Any],
    fields: list[str],
    limit: int = 1000,
    order: str = "write_date desc, id desc",
) -> list[dict[str, Any]]:
    connector = odoo_server.get_odoo_connector()
    return await connector._compatible_search_read(model, domain, fields, limit, order)


async def _attachment_records(odoo_server: Any, kind: str) -> list[dict[str, Any]]:
    rows = await _search_read(
        odoo_server,
        "ir.attachment",
        [["name", "ilike", _record_prefix(kind)]],
        ["id", "name", "datas", "description", "create_date", "write_date"],
        2000,
    )
    records: list[dict[str, Any]] = []
    for row in rows:
        payload = _decode_attachment(row.get("datas"))
        if not payload:
            continue
        payload.setdefault("source", "araak_ceo_odoo")
        payload.setdefault("storage_id", row.get("id"))
        payload.setdefault("created_at", row.get("create_date"))
        payload["updated_at"] = payload.get("updated_at") or row.get("write_date")
        records.append(payload)
    return records


async def _find_attachment(odoo_server: Any, kind: str, record_id: str) -> dict[str, Any] | None:
    rows = await _search_read(
        odoo_server,
        "ir.attachment",
        [["name", "=", _record_name(kind, record_id)]],
        ["id", "name", "datas", "description", "create_date", "write_date"],
        1,
    )
    return rows[0] if rows else None


async def _upsert_attachment(odoo_server: Any, kind: str, record: dict[str, Any]) -> int:
    record_id = str(record["id"])
    existing = await _find_attachment(odoo_server, kind, record_id)
    values = {
        "name": _record_name(kind, record_id),
        "description": (
            f"ARAAK_CEO_RECORD: {kind}\n"
            f"ARAAK_CEO_ID: {record_id}\n"
            "Managed by ARAAK CEO. Do not edit manually."
        ),
        "datas": _encode_payload(record),
        "mimetype": "application/json",
        "type": "binary",
        "public": False,
    }
    if existing:
        attachment_id = int(existing["id"])
        await _json2_write(odoo_server, "ir.attachment", "write", {"ids": [attachment_id], "vals": values})
        return attachment_id
    result = await _json2_write(odoo_server, "ir.attachment", "create", {"vals_list": [values]})
    return _extract_id(result)


async def _mirror_local(core: Any, collection_name: str, record: dict[str, Any]) -> None:
    await core.db[collection_name].update_one(
        {"id": record["id"]},
        {"$set": {key: value for key, value in record.items() if key != "_id"}},
        upsert=True,
    )


async def _local_records(core: Any, collection_name: str) -> list[dict[str, Any]]:
    return await core.db[collection_name].find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)


def _merge_records(primary: list[dict[str, Any]], secondary: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for item in [*secondary, *primary]:
        item_id = str(item.get("id") or "")
        if item_id:
            merged[item_id] = item
    return sorted(
        merged.values(),
        key=lambda item: str(item.get("updated_at") or item.get("created_at") or ""),
        reverse=True,
    )


async def meeting_request_records(core: Any, odoo_server: Any, user: dict[str, Any]) -> list[dict[str, Any]]:
    try:
        persistent = await _attachment_records(odoo_server, REQUEST_KIND)
    except Exception:
        persistent = []
    local = await _local_records(core, "meeting_requests")
    records = _merge_records(persistent, local)
    if user.get("role") in {"admin", "ceo", "tracker"}:
        return records
    user_id = str(user.get("id") or "")
    email = str(user.get("email") or "").strip().lower()
    return [
        item for item in records
        if str(item.get("requester_id") or "") == user_id
        or str(item.get("requester_email") or "").strip().lower() == email
    ]


async def _get_meeting_request(core: Any, odoo_server: Any, request_id: str) -> dict[str, Any] | None:
    records = await meeting_request_records(core, odoo_server, {"role": "admin", "id": "", "email": ""})
    return next((item for item in records if str(item.get("id")) == request_id), None)


async def _save_meeting_request(core: Any, odoo_server: Any, record: dict[str, Any]) -> tuple[str, str | None]:
    warning = None
    source = "araak_ceo_local"
    try:
        attachment_id = await _upsert_attachment(odoo_server, REQUEST_KIND, record)
        record["storage_id"] = attachment_id
        record["source"] = "araak_ceo_odoo"
        source = "araak_ceo_odoo"
    except Exception as exc:
        warning = str(exc)[:300]
    await _mirror_local(core, "meeting_requests", record)
    return source, warning


async def _partner_id_for_email(odoo_server: Any, email: str) -> int | None:
    if not email:
        return None
    rows = await _search_read(odoo_server, "res.partner", [["email", "=", email]], ["id", "name", "email"], 1, "id desc")
    return int(rows[0]["id"]) if rows else None


async def _sync_request_to_calendar(odoo_server: Any, record: dict[str, Any]) -> int:
    request_id = str(record["id"])
    marker = f"ARAAK_CEO_REQUEST_ID: {request_id}"
    rows = await _search_read(
        odoo_server,
        "calendar.event",
        [["description", "ilike", marker]],
        ["id", "name", "start", "stop"],
        1,
    )
    start_text = record.get("approved_date") or record.get("proposed_date")
    if not start_text:
        raise RuntimeError("لا يوجد موعد معتمد للاجتماع")
    start = datetime.fromisoformat(str(start_text).replace("Z", "+00:00"))
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    stop = start + timedelta(minutes=max(15, int(record.get("duration_minutes") or 30)))
    description = (
        f"<p>{record.get('description') or ''}</p>"
        f"<p><b>مقدم الطلب:</b> {record.get('requester_name') or ''}</p>"
        f"<p>{marker}</p>"
        "<p>ARAAK_CEO_SOURCE: meeting_request</p>"
    )
    values: dict[str, Any] = {
        "name": f"ARAAK CEO | {record.get('subject') or 'اجتماع تنفيذي'}",
        "description": description,
        "start": start.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "stop": stop.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        "allday": False,
        "active": True,
    }
    partner_id = await _partner_id_for_email(odoo_server, str(record.get("requester_email") or ""))
    if partner_id:
        values["partner_ids"] = [[6, 0, [partner_id]]]
    if rows:
        event_id = int(rows[0]["id"])
        await _json2_write(odoo_server, "calendar.event", "write", {"ids": [event_id], "vals": values})
        return event_id
    result = await _json2_write(odoo_server, "calendar.event", "create", {"vals_list": [values]})
    return _extract_id(result)


async def _workforce(core: Any, odoo_server: Any) -> list[dict[str, Any]]:
    _, employees, _ = await hr_gateway._workforce(core, odoo_server, include_compensation=False)
    return employees


async def _employee_by_id(core: Any, odoo_server: Any, employee_id: str) -> dict[str, Any] | None:
    employees = await _workforce(core, odoo_server)
    return next((item for item in employees if str(item.get("id")) == str(employee_id)), None)


async def message_records(core: Any, odoo_server: Any, user: dict[str, Any]) -> list[dict[str, Any]]:
    try:
        persistent = await _attachment_records(odoo_server, MESSAGE_KIND)
    except Exception:
        persistent = []
    local = await _local_records(core, "messages")
    records = _merge_records(persistent, local)
    user_id = str(user.get("id") or "")
    email = str(user.get("email") or "").strip().lower()
    return [
        item for item in records
        if str(item.get("sender_id") or "") == user_id
        or str(item.get("recipient_user_id") or "") == user_id
        or str(item.get("sender_email") or "").strip().lower() == email
        or str(item.get("recipient_email") or "").strip().lower() == email
    ]


async def _get_message(core: Any, odoo_server: Any, message_id: str) -> dict[str, Any] | None:
    try:
        persistent = await _attachment_records(odoo_server, MESSAGE_KIND)
    except Exception:
        persistent = []
    local = await _local_records(core, "messages")
    records = _merge_records(persistent, local)
    return next((item for item in records if str(item.get("id")) == message_id), None)


async def _save_message(core: Any, odoo_server: Any, record: dict[str, Any]) -> tuple[str, str | None]:
    warning = None
    source = "araak_ceo_local"
    try:
        attachment_id = await _upsert_attachment(odoo_server, MESSAGE_KIND, record)
        record["storage_id"] = attachment_id
        record["source"] = "araak_ceo_odoo"
        source = "araak_ceo_odoo"
    except Exception as exc:
        warning = str(exc)[:300]
    await _mirror_local(core, "messages", record)
    return source, warning


def _message_actions(body: str) -> list[str]:
    parts = [segment.strip(" .،؛:-") for segment in re.split(r"[\n.!؟]+", body or "") if segment.strip()]
    keywords = ("يرجى", "يجب", "اعتماد", "متابعة", "إعداد", "مراجعة", "تنفيذ", "إرسال", "تحديث")
    selected = [part for part in parts if any(keyword in part for keyword in keywords)]
    if not selected:
        selected = parts[:3]
    if not selected:
        selected = ["مراجعة المراسلة", "تحديد المسؤول", "تثبيت موعد المتابعة"]
    return selected[:5]


async def _ensure_followup_project(odoo_server: Any) -> int:
    rows = await _search_read(
        odoo_server,
        "project.project",
        [["name", "=", FOLLOWUP_PROJECT_NAME]],
        ["id", "name"],
        1,
    )
    if rows:
        return int(rows[0]["id"])
    result = await _json2_write(
        odoo_server,
        "project.project",
        "create",
        {"vals_list": [{
            "name": FOLLOWUP_PROJECT_NAME,
            "description": (
                "<p>مشروع مركزي لمتابعات الاتصالات والقرارات الصادرة من ARAAK CEO.</p>"
                "<p>ARAAK_CEO_SECTOR: corporate</p>"
            ),
            "privacy_visibility": "employees",
            "active": True,
        }]},
    )
    return _extract_id(result)


async def _employee_user_id(odoo_server: Any, employee_id: str) -> int | None:
    match = re.search(r"(\d+)$", str(employee_id or ""))
    if not match:
        return None
    rows = await _search_read(odoo_server, "hr.employee", [["id", "=", int(match.group(1))]], ["id", "user_id"], 1)
    return _many2one_id(rows[0].get("user_id")) if rows else None


async def _create_followup_task(odoo_server: Any, message: dict[str, Any]) -> int:
    project_id = await _ensure_followup_project(odoo_server)
    user_id = await _employee_user_id(odoo_server, str(message.get("recipient_id") or ""))
    priority_map = {"normal": "0", "high": "1", "critical": "2"}
    due = (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat()
    values: dict[str, Any] = {
        "name": f"متابعة: {message.get('subject') or 'مراسلة تنفيذية'}",
        "description": (
            f"<p>{message.get('body') or ''}</p>"
            f"<p><b>من:</b> {message.get('sender_name') or ''}</p>"
            f"<p><b>إلى:</b> {message.get('recipient_name') or ''}</p>"
            f"<p>ARAAK_CEO_MESSAGE_ID: {message.get('id')}</p>"
        ),
        "project_id": project_id,
        "date_deadline": due,
        "priority": priority_map.get(str(message.get("priority") or "normal"), "0"),
        "active": True,
    }
    if user_id:
        values["user_ids"] = [[6, 0, [user_id]]]
    result = await _json2_write(odoo_server, "project.task", "create", {"vals_list": [values]})
    return _extract_id(result)


def _require_executive(user: dict[str, Any]) -> None:
    if user.get("role") not in {"admin", "ceo", "tracker"}:
        raise HTTPException(status_code=403, detail="غير مصرح باتخاذ القرار")


def _require_message_access(message: dict[str, Any], user: dict[str, Any]) -> None:
    user_id = str(user.get("id") or "")
    email = str(user.get("email") or "").strip().lower()
    allowed = (
        str(message.get("sender_id") or "") == user_id
        or str(message.get("recipient_user_id") or "") == user_id
        or str(message.get("sender_email") or "").strip().lower() == email
        or str(message.get("recipient_email") or "").strip().lower() == email
        or user.get("role") in {"admin", "ceo"}
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="غير مصرح بالوصول إلى المراسلة")


def register_workflow_routes(app: Any, core: Any, odoo_server: Any) -> None:
    """Register persistent ARAAK CEO workflow routes before the mounted core app."""
    existing = {getattr(route, "path", None) for route in app.router.routes}
    if "/api/araak-ceo/workflow-status" in existing:
        return

    initial_count = len(app.router.routes)

    async def workflow_status(request: Request):
        await core.get_current_user(request)
        return {
            "service": "ARAAK CEO",
            "persistent_store": "odoo-ir-attachment",
            "odoo_writeback": _writeback_enabled(),
            "meeting_request_calendar_sync": True,
            "communication_followup_sync": True,
        }

    async def list_meeting_requests(request: Request):
        user = await core.get_current_user(request)
        return await meeting_request_records(core, odoo_server, user)

    async def create_meeting_request(request: Request):
        user = await core.get_current_user(request)
        payload = await request.json()
        subject = str(payload.get("subject") or "").strip()
        proposed_date = str(payload.get("proposed_date") or "").strip()
        if not subject or not proposed_date:
            raise HTTPException(status_code=400, detail="موضوع الاجتماع والموعد المقترح مطلوبان")
        record = {
            "id": _new_id(core),
            "subject": subject,
            "description": str(payload.get("description") or "").strip(),
            "proposed_date": proposed_date,
            "duration_minutes": max(15, int(payload.get("duration_minutes") or 30)),
            "urgency": str(payload.get("urgency") or "medium"),
            "requester_id": user.get("id"),
            "requester_name": user.get("name"),
            "requester_email": user.get("email"),
            "status": "pending",
            "source": "araak_ceo",
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        _, warning = await _save_meeting_request(core, odoo_server, record)
        record["warning"] = warning
        return record

    async def decide_meeting_request(request_id: str, request: Request):
        user = await core.get_current_user(request)
        _require_executive(user)
        payload = await request.json()
        decision = str(payload.get("decision") or "").strip().lower()
        if decision not in {"approved", "rejected", "rescheduled"}:
            raise HTTPException(status_code=400, detail="قرار الاجتماع غير صالح")
        record = await _get_meeting_request(core, odoo_server, request_id)
        if not record:
            raise HTTPException(status_code=404, detail="طلب الاجتماع غير موجود")
        record.update(
            status=decision,
            decision_note=str(payload.get("note") or "").strip(),
            decided_by=user.get("id"),
            decided_by_name=user.get("name"),
            decided_at=_now_iso(),
            updated_at=_now_iso(),
        )
        if decision == "rescheduled":
            new_date = str(payload.get("new_date") or "").strip()
            if not new_date:
                raise HTTPException(status_code=400, detail="الموعد الجديد مطلوب")
            record["approved_date"] = new_date
        elif decision == "approved":
            record["approved_date"] = record.get("proposed_date")

        sync_warning = None
        if decision in {"approved", "rescheduled"}:
            try:
                event_id = await _sync_request_to_calendar(odoo_server, record)
                record["odoo_calendar_event_id"] = event_id
                record["calendar_sync_status"] = "synced"
                record["calendar_synced_at"] = _now_iso()
            except Exception as exc:
                record["calendar_sync_status"] = "failed"
                sync_warning = str(exc)[:300]
                record["calendar_sync_warning"] = sync_warning

        _, storage_warning = await _save_meeting_request(core, odoo_server, record)
        record["warning"] = sync_warning or storage_warning
        return record

    async def list_messages(request: Request):
        user = await core.get_current_user(request)
        return await message_records(core, odoo_server, user)

    async def send_message(request: Request):
        user = await core.get_current_user(request)
        payload = await request.json()
        recipient_id = str(payload.get("recipient_id") or "").strip()
        body = str(payload.get("body") or "").strip()
        if not recipient_id or not body:
            raise HTTPException(status_code=400, detail="المستلم ونص المراسلة مطلوبان")
        recipient = await _employee_by_id(core, odoo_server, recipient_id)
        if not recipient:
            raise HTTPException(status_code=404, detail="المستلم غير موجود في دليل موظفي Odoo")
        recipient_email = str(recipient.get("email") or recipient.get("work_email") or "").strip().lower()
        recipient_user = await core.db.users.find_one({"email": recipient_email}, {"_id": 0})
        record = {
            "id": _new_id(core),
            "sender_id": user.get("id"),
            "sender_name": user.get("name"),
            "sender_email": user.get("email"),
            "recipient_id": recipient_id,
            "recipient_user_id": (recipient_user or {}).get("id"),
            "recipient_name": recipient.get("name"),
            "recipient_email": recipient_email,
            "subject": str(payload.get("subject") or "").strip(),
            "body": body,
            "priority": str(payload.get("priority") or "normal"),
            "category": str(payload.get("category") or "internal_coordination"),
            "read": False,
            "source": "araak_ceo",
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        _, warning = await _save_message(core, odoo_server, record)
        if recipient_user:
            await core.db.notifications.insert_one({
                "id": _new_id(core),
                "user_id": recipient_user.get("id"),
                "type": "message",
                "title": f"مراسلة جديدة من {user.get('name')}",
                "body": record["subject"] or body[:80],
                "link": "/messages",
                "read": False,
                "created_at": _now_iso(),
            })
        record["warning"] = warning
        return record

    async def read_message(message_id: str, request: Request):
        user = await core.get_current_user(request)
        message = await _get_message(core, odoo_server, message_id)
        if not message:
            raise HTTPException(status_code=404, detail="المراسلة غير موجودة")
        _require_message_access(message, user)
        message.update(read=True, read_at=_now_iso(), updated_at=_now_iso())
        await _save_message(core, odoo_server, message)
        return {"ok": True}

    async def message_summary(message_id: str, request: Request):
        user = await core.get_current_user(request)
        message = await _get_message(core, odoo_server, message_id)
        if not message:
            raise HTTPException(status_code=404, detail="المراسلة غير موجودة")
        _require_message_access(message, user)
        body = str(message.get("body") or "")
        summary = body[:280] + ("..." if len(body) > 280 else "")
        result = {
            "ai_summary": summary or "لا يوجد محتوى متاح.",
            "ai_tags": ["اتصالات", "ARAAK CEO", str(message.get("category") or "عام")],
        }
        message.update(result, updated_at=_now_iso())
        await _save_message(core, odoo_server, message)
        return result

    async def message_actions(message_id: str, request: Request):
        user = await core.get_current_user(request)
        message = await _get_message(core, odoo_server, message_id)
        if not message:
            raise HTTPException(status_code=404, detail="المراسلة غير موجودة")
        _require_message_access(message, user)
        result = {"action_items": _message_actions(str(message.get("body") or "")), "requires_response": True}
        message.update(result, updated_at=_now_iso())
        await _save_message(core, odoo_server, message)
        return result

    async def message_route(message_id: str, request: Request):
        user = await core.get_current_user(request)
        message = await _get_message(core, odoo_server, message_id)
        if not message:
            raise HTTPException(status_code=404, detail="المراسلة غير موجودة")
        _require_message_access(message, user)
        priority = str(message.get("priority") or "normal")
        category = str(message.get("category") or "internal_coordination")
        if priority == "critical" or category == "risk_alert":
            route = "مكتب الرئيس التنفيذي / قناة التصعيد العاجل"
            escalation = "high"
        elif category == "executive_decision":
            route = "مركز القرارات التنفيذية"
            escalation = "normal"
        else:
            route = f"التنسيق الداخلي / {message.get('recipient_name') or 'المستلم'}"
            escalation = "normal"
        result = {"ai_route": route, "escalation_level": escalation}
        message.update(result, updated_at=_now_iso())
        await _save_message(core, odoo_server, message)
        return result

    async def message_followup(message_id: str, request: Request):
        user = await core.get_current_user(request)
        message = await _get_message(core, odoo_server, message_id)
        if not message:
            raise HTTPException(status_code=404, detail="المراسلة غير موجودة")
        _require_message_access(message, user)
        try:
            task_id = await _create_followup_task(odoo_server, message)
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"تعذر إنشاء مهمة المتابعة في Odoo: {exc}") from exc
        message.update(
            follow_up_task_id=f"odoo-task-{task_id}",
            odoo_follow_up_task_id=task_id,
            requires_response=True,
            updated_at=_now_iso(),
        )
        await _save_message(core, odoo_server, message)
        return {
            "ok": True,
            "task": {
                "id": f"odoo-task-{task_id}",
                "odoo_id": task_id,
                "source": "odoo",
                "title": f"متابعة: {message.get('subject') or 'مراسلة تنفيذية'}",
            },
            "message": "تم إنشاء مهمة المتابعة في Odoo وربطها بالمراسلة",
        }

    app.add_api_route("/api/araak-ceo/workflow-status", workflow_status, methods=["GET"], tags=["ARAAK CEO"])
    app.add_api_route("/api/meeting-requests", list_meeting_requests, methods=["GET"], tags=["ARAAK CEO"])
    app.add_api_route("/api/meeting-requests", create_meeting_request, methods=["POST"], tags=["ARAAK CEO"])
    app.add_api_route("/api/meeting-requests/{request_id}/decision", decide_meeting_request, methods=["POST"], tags=["ARAAK CEO"])
    app.add_api_route("/api/messages", list_messages, methods=["GET"], tags=["ARAAK CEO"])
    app.add_api_route("/api/messages", send_message, methods=["POST"], tags=["ARAAK CEO"])
    app.add_api_route("/api/messages/{message_id}/read", read_message, methods=["PATCH"], tags=["ARAAK CEO"])
    app.add_api_route("/api/messages/{message_id}/ai-summary", message_summary, methods=["POST"], tags=["ARAAK CEO"])
    app.add_api_route("/api/messages/{message_id}/extract-actions", message_actions, methods=["POST"], tags=["ARAAK CEO"])
    app.add_api_route("/api/messages/{message_id}/route", message_route, methods=["POST"], tags=["ARAAK CEO"])
    app.add_api_route("/api/messages/{message_id}/create-followup", message_followup, methods=["POST"], tags=["ARAAK CEO"])

    added = app.router.routes[initial_count:]
    del app.router.routes[initial_count:]
    mount_index = next(
        (index for index, route in enumerate(app.router.routes) if isinstance(route, Mount)),
        len(app.router.routes),
    )
    for offset, route in enumerate(added):
        app.router.routes.insert(mount_index + offset, route)
