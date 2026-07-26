"""Odoo-backed office data for meetings, calendar, documents, and alerts.

The gateway keeps native platform write workflows intact while enriching reads
from Odoo. Odoo records are merged with locally-created NEXGEN records so users
can continue creating meetings, calendar items, and documents from the platform.
"""
from __future__ import annotations

import html
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Request
from starlette.routing import Mount

CALENDAR_FIELDS = [
    "id", "name", "description", "start", "stop", "allday", "active",
    "location", "videoconference_location", "partner_ids", "user_id",
    "privacy", "recurrency", "show_as", "create_date", "write_date",
]

ATTACHMENT_FIELDS = [
    "id", "name", "description", "type", "url", "mimetype", "public",
    "res_model", "res_id", "res_name", "create_uid", "create_date",
    "write_date", "file_size",
]

DOCUMENT_PREFIX = "ARAAK |"


def _many2one_id(value: Any) -> int | None:
    if isinstance(value, (list, tuple)) and value:
        try:
            return int(value[0])
        except (TypeError, ValueError):
            return None
    return value if isinstance(value, int) else None


def _many2one_name(value: Any) -> str:
    if isinstance(value, (list, tuple)) and len(value) > 1:
        return str(value[1] or "")
    return str(value or "") if isinstance(value, str) else ""


def _plain_text(value: Any) -> str:
    text = str(value or "")
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def _marker(value: Any, key: str) -> str:
    text = _plain_text(value)
    match = re.search(
        rf"(?:^|\s){re.escape(key)}\s*[:：]\s*(.+?)(?=\s+[A-Z][A-Z0-9_]*\s*[:：]|$)",
        text,
        flags=re.IGNORECASE,
    )
    return match.group(1).strip(" .،;") if match else ""


def _clean_markers(value: Any) -> str:
    text = _plain_text(value)
    text = re.sub(
        r"(?:^|\s)(?:NEXGEN_[A-Z0-9_]+)\s*[:：]\s*.+?(?=\s+NEXGEN_[A-Z0-9_]+\s*[:：]|$)",
        " ",
        text,
        flags=re.IGNORECASE,
    )
    return re.sub(r"\s+", " ", text).strip()


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    text = str(value).strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        try:
            parsed = datetime.strptime(text, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _iso(value: Any) -> str | None:
    parsed = _parse_datetime(value)
    return parsed.isoformat() if parsed else (str(value) if value else None)


def _meeting_type(name: str, description: Any) -> str:
    marked = _marker(description, "NEXGEN_MEETING_TYPE").lower()
    if marked in {"individual", "periodic", "emergency", "board"}:
        return marked
    text = f"{name} {_plain_text(description)}".lower()
    if any(token in text for token in ("مجلس", "board")):
        return "board"
    if any(token in text for token in ("طارئ", "عاجل", "emergency")):
        return "emergency"
    if any(token in text for token in ("أسبوعي", "دوري", "شهري", "periodic")):
        return "periodic"
    return "individual"


def _meeting_status(stop: Any, description: Any, active: bool) -> str:
    marked = _marker(description, "NEXGEN_STATUS").lower()
    if marked in {"scheduled", "completed", "cancelled", "rescheduled"}:
        return marked
    if not active:
        return "cancelled"
    end = _parse_datetime(stop)
    return "completed" if end and end < datetime.now(timezone.utc) else "scheduled"


def _duration_minutes(start: Any, stop: Any) -> int:
    start_dt = _parse_datetime(start)
    stop_dt = _parse_datetime(stop)
    if start_dt and stop_dt:
        return max(1, round((stop_dt - start_dt).total_seconds() / 60))
    return 60


def _map_meeting(record: dict[str, Any]) -> dict[str, Any]:
    record_id = int(record.get("id") or 0)
    name = str(record.get("name") or f"Odoo Meeting {record_id}")
    description = record.get("description")
    meeting_link = (
        str(record.get("videoconference_location") or "").strip()
        or _marker(description, "NEXGEN_MEETING_LINK")
    )
    partner_ids = record.get("partner_ids") if isinstance(record.get("partner_ids"), list) else []
    return {
        "id": f"odoo-meeting-{record_id}",
        "odoo_id": record_id,
        "source": "odoo",
        "title": name,
        "description": _clean_markers(description),
        "meeting_type": _meeting_type(name, description),
        "date": _iso(record.get("start")),
        "end": _iso(record.get("stop")),
        "duration_minutes": _duration_minutes(record.get("start"), record.get("stop")),
        "location": record.get("location") or "",
        "meeting_link": meeting_link,
        "attendee_ids": [f"odoo-partner-{value}" for value in partner_ids],
        "attendee_count": len(partner_ids),
        "organizer_id": _many2one_id(record.get("user_id")),
        "organizer_name": _many2one_name(record.get("user_id")),
        "is_remote": bool(meeting_link),
        "status": _meeting_status(record.get("stop"), description, bool(record.get("active", True))),
        "all_day": bool(record.get("allday", False)),
        "created_at": record.get("create_date"),
        "updated_at": record.get("write_date"),
    }


def _document_category(name: str, description: Any, mimetype: str) -> str:
    marked = _marker(description, "NEXGEN_CATEGORY").lower()
    valid = {"meeting_notes", "correspondence", "report", "memo", "presentation", "other"}
    if marked in valid:
        return marked
    text = f"{name} {_plain_text(description)} {mimetype}".lower()
    if any(token in text for token in ("محضر", "minutes", "meeting")):
        return "meeting_notes"
    if any(token in text for token in ("مراسلة", "خطاب", "letter", "correspondence")):
        return "correspondence"
    if any(token in text for token in ("عرض", "presentation", "powerpoint")):
        return "presentation"
    if any(token in text for token in ("مذكرة", "memo")):
        return "memo"
    if any(token in text for token in ("تقرير", "report")):
        return "report"
    return "other"


def _file_type(name: str, mimetype: str) -> str:
    lowered = str(name or "").lower()
    if "." in lowered:
        return lowered.rsplit(".", 1)[-1].upper()
    mapping = {
        "application/pdf": "PDF",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
        "text/plain": "TXT",
    }
    return mapping.get(str(mimetype or "").lower(), "FILE")


def _map_document(record: dict[str, Any], base_url: str) -> dict[str, Any]:
    record_id = int(record.get("id") or 0)
    raw_name = str(record.get("name") or f"Attachment {record_id}")
    title = raw_name[len(DOCUMENT_PREFIX):] if raw_name.startswith(DOCUMENT_PREFIX) else raw_name
    title = re.sub(r"\.[A-Za-z0-9]{1,6}$", "", title)
    description = record.get("description")
    risk_level = _marker(description, "NEXGEN_RISK_LEVEL").lower() or "low"
    summary = _marker(description, "NEXGEN_SUMMARY") or _clean_markers(description)
    attachment_type = str(record.get("type") or "binary")
    url = (
        str(record.get("url") or "").strip()
        if attachment_type == "url"
        else f"{base_url}/web/content/{record_id}?download=true"
    )
    return {
        "id": f"odoo-document-{record_id}",
        "odoo_id": record_id,
        "source": "odoo",
        "title": title,
        "description": _clean_markers(description),
        "category": _document_category(title, description, str(record.get("mimetype") or "")),
        "url": url,
        "file_type": _file_type(raw_name, str(record.get("mimetype") or "")),
        "is_public": bool(record.get("public", False)),
        "uploaded_by": _many2one_id(record.get("create_uid")),
        "uploaded_by_name": _many2one_name(record.get("create_uid")) or "Odoo",
        "created_at": record.get("create_date"),
        "updated_at": record.get("write_date"),
        "intelligence_status": "processed",
        "intelligence": {
            "summary": summary,
            "risk_level": risk_level if risk_level in {"low", "medium", "high"} else "low",
            "parties": ["مجموعة اراك للتنمية"],
            "dates": [],
            "obligations": ["مراجعة المستند وربطه بالمسؤول والمشروع ذي الصلة."],
            "risks": [] if risk_level == "low" else [{"level": risk_level, "risk": "يتطلب متابعة تنفيذية."}],
            "important_clauses": ["المسؤولية", "الموعد", "الإجراء التالي"],
            "generated_by": "Odoo Institutional Memory Gateway",
        },
    }


async def _odoo_meetings(odoo_server: Any) -> list[dict[str, Any]]:
    connector = odoo_server.get_odoo_connector()
    records = await connector._compatible_search_read(
        "calendar.event", [], CALENDAR_FIELDS, 1000, "start desc, id desc"
    )
    return [_map_meeting(record) for record in records]


async def _odoo_documents(odoo_server: Any) -> list[dict[str, Any]]:
    connector = odoo_server.get_odoo_connector()
    records = await connector._compatible_search_read(
        "ir.attachment",
        [["name", "ilike", DOCUMENT_PREFIX]],
        ATTACHMENT_FIELDS,
        1000,
        "write_date desc, id desc",
    )
    return [_map_document(record, connector.config.url) for record in records]


async def _local_meetings(core: Any, user: dict[str, Any]) -> list[dict[str, Any]]:
    query = (
        {}
        if user.get("role") in {"admin", "ceo", "tracker"}
        else {"$or": [{"attendee_ids": user["id"]}, {"organizer_id": user["id"]}]}
    )
    items = await core.db.meetings.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    return [{**item, "source": item.get("source") or "platform"} for item in items]


async def meeting_records(core: Any, odoo_server: Any, user: dict[str, Any]) -> tuple[list[dict[str, Any]], str | None]:
    local = await _local_meetings(core, user)
    try:
        odoo = await _odoo_meetings(odoo_server)
        return sorted(
            [*odoo, *local],
            key=lambda item: str(item.get("date") or ""),
            reverse=True,
        ), None
    except Exception as exc:
        return local, str(exc)[:280]


async def calendar_records(core: Any, odoo_server: Any, user: dict[str, Any]) -> tuple[list[dict[str, Any]], str | None]:
    events: list[dict[str, Any]] = []
    async for item in core.db.calendar_events.find({"user_id": user["id"]}, {"_id": 0}):
        events.append({**item, "source": item.get("source") or "platform"})

    meetings, warning = await meeting_records(core, odoo_server, user)
    for meeting in meetings:
        if not meeting.get("date"):
            continue
        events.append({
            "id": f"calendar-{meeting['id']}",
            "source": meeting.get("source") or "platform",
            "title": f"اجتماع: {meeting.get('title', '')}",
            "start": meeting.get("date"),
            "end": meeting.get("end"),
            "event_type": "meeting",
            "color": "#D4AF37",
            "ref_id": meeting.get("id"),
            "description": meeting.get("description") or "",
            "all_day": bool(meeting.get("all_day", False)),
            "active": meeting.get("status") != "cancelled",
        })

    try:
        tasks = await odoo_server.operational_tasks(user)
    except Exception as exc:
        tasks = []
        warning = warning or str(exc)[:280]

    priority_colors = {
        "critical": "#fb7185",
        "high": "#fbbf24",
        "medium": "#60a5fa",
        "low": "#94a3b8",
    }
    for task in tasks:
        due = task.get("due_date")
        if not due:
            continue
        events.append({
            "id": f"calendar-{task.get('id')}",
            "source": task.get("source") or "platform",
            "title": f"مهمة: {task.get('title', '')}",
            "start": due,
            "event_type": "task",
            "color": priority_colors.get(str(task.get("priority") or "medium"), "#94a3b8"),
            "ref_id": task.get("id"),
            "description": task.get("description") or "",
            "active": task.get("status") not in {"completed", "cancelled"},
        })

    deduped: dict[str, dict[str, Any]] = {}
    for event in events:
        deduped[str(event.get("id"))] = event
    return list(deduped.values()), warning


async def document_records(core: Any, odoo_server: Any, user: dict[str, Any]) -> tuple[list[dict[str, Any]], str | None]:
    query: dict[str, Any] = {}
    if user.get("role") not in {"admin", "ceo", "tracker"}:
        query["$or"] = [{"is_public": True}, {"uploaded_by": user["id"]}]
    local = await core.db.documents.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    local = [{**item, "source": item.get("source") or "platform"} for item in local]
    try:
        odoo = await _odoo_documents(odoo_server)
        return sorted(
            [*odoo, *local],
            key=lambda item: str(item.get("updated_at") or item.get("created_at") or ""),
            reverse=True,
        ), None
    except Exception as exc:
        return local, str(exc)[:280]


async def notification_records(core: Any, odoo_server: Any, user: dict[str, Any]) -> tuple[list[dict[str, Any]], str | None]:
    local = await core.db.notifications.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(300)

    now = datetime.now(timezone.utc)
    generated: list[dict[str, Any]] = []
    meetings, warning = await meeting_records(core, odoo_server, user)
    for meeting in meetings:
        start = _parse_datetime(meeting.get("date"))
        if not start or not (now <= start <= now + timedelta(days=7)):
            continue
        generated.append({
            "id": f"odoo-alert-meeting-{meeting.get('id')}",
            "source": meeting.get("source"),
            "user_id": user["id"],
            "type": "meeting",
            "title": f"اجتماع قادم: {meeting.get('title')}",
            "body": f"موعد الاجتماع {start.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC",
            "link": "/meetings",
            "read": False,
            "created_at": now.isoformat(),
        })

    try:
        tasks = await odoo_server.operational_tasks(user)
    except Exception as exc:
        tasks = []
        warning = warning or str(exc)[:280]
    for task in tasks:
        due = _parse_datetime(task.get("due_date"))
        status = str(task.get("status") or "")
        if status == "delayed" or (due and due < now and status not in {"completed", "cancelled"}):
            generated.append({
                "id": f"odoo-alert-task-{task.get('id')}",
                "source": task.get("source"),
                "user_id": user["id"],
                "type": "task",
                "title": f"مهمة متأخرة: {task.get('title')}",
                "body": "تجاوزت المهمة تاريخ الاستحقاق وتحتاج متابعة المسؤول.",
                "link": "/tasks",
                "read": False,
                "created_at": now.isoformat(),
            })
        elif status == "awaiting_approval":
            generated.append({
                "id": f"odoo-alert-approval-{task.get('id')}",
                "source": task.get("source"),
                "user_id": user["id"],
                "type": "approval",
                "title": f"بانتظار قرار: {task.get('title')}",
                "body": "المهمة في مرحلة مراجعة أو اعتماد وتحتاج قرارًا تنفيذيًا.",
                "link": "/tasks",
                "read": False,
                "created_at": now.isoformat(),
            })

    combined = [*generated[:40], *local]
    return combined, warning


def register_office_routes(app: Any, core: Any, odoo_server: Any) -> None:
    """Register Odoo office read routes before the mounted core application."""
    existing = {getattr(route, "path", None) for route in app.router.routes}
    if "/api/calendar" in existing:
        return

    initial_count = len(app.router.routes)

    async def meetings_endpoint(request: Request):
        user = await core.get_current_user(request)
        items, _ = await meeting_records(core, odoo_server, user)
        return items

    async def calendar_endpoint(request: Request):
        user = await core.get_current_user(request)
        items, _ = await calendar_records(core, odoo_server, user)
        return items

    async def documents_endpoint(request: Request):
        user = await core.get_current_user(request)
        items, _ = await document_records(core, odoo_server, user)
        return items

    async def notifications_endpoint(request: Request):
        user = await core.get_current_user(request)
        items, _ = await notification_records(core, odoo_server, user)
        return items

    app.add_api_route("/api/meetings", meetings_endpoint, methods=["GET"], tags=["Odoo Office"])
    app.add_api_route("/api/calendar", calendar_endpoint, methods=["GET"], tags=["Odoo Office"])
    app.add_api_route("/api/documents", documents_endpoint, methods=["GET"], tags=["Odoo Office"])
    app.add_api_route("/api/notifications", notifications_endpoint, methods=["GET"], tags=["Odoo Office"])

    added = app.router.routes[initial_count:]
    del app.router.routes[initial_count:]
    mount_index = next(
        (index for index, route in enumerate(app.router.routes) if isinstance(route, Mount)),
        len(app.router.routes),
    )
    for offset, route in enumerate(added):
        app.router.routes.insert(mount_index + offset, route)
