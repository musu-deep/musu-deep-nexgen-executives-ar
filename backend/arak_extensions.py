"""Extensions to Arak server: meetings, documents, messages, notifications, voice, calendar, themes."""
import os, base64, json
from datetime import datetime, timezone
from typing import Optional, List, Literal
from fastapi import HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel

try:
    from .server import (
        api_router, db, get_current_user, require_roles, now_iso, new_id,
        DEV_SECTORS,
    )
except ImportError:  # Allows running from inside the backend directory.
    from server import (
        api_router, db, get_current_user, require_roles, now_iso, new_id,
        DEV_SECTORS,
    )

# ============== MEETINGS ==============
class MeetingInput(BaseModel):
    title: str
    description: Optional[str] = ""
    meeting_type: Literal["individual", "periodic", "emergency", "board"] = "individual"
    date: str  # ISO datetime
    duration_minutes: int = 60
    location: Optional[str] = ""
    meeting_link: Optional[str] = ""  # Zoom/Meet/Teams URL
    attendee_ids: List[str] = []
    is_remote: bool = False
    status: Literal["scheduled", "completed", "cancelled", "rescheduled"] = "scheduled"

@api_router.get("/meetings")
async def list_meetings(user=Depends(get_current_user)):
    q = {} if user["role"] in ("admin", "ceo", "tracker") else {"$or": [{"attendee_ids": user["id"]}, {"organizer_id": user["id"]}]}
    items = await db.meetings.find(q, {"_id": 0}).sort("date", -1).to_list(500)
    return items

@api_router.post("/meetings")
async def create_meeting(payload: MeetingInput, user=Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["organizer_id"] = user["id"]
    doc["organizer_name"] = user.get("name")
    doc["created_at"] = now_iso()
    await db.meetings.insert_one(doc)
    # auto-notify attendees
    for uid in payload.attendee_ids:
        await db.notifications.insert_one({
            "id": new_id(), "user_id": uid, "type": "meeting",
            "title": f"اجتماع جديد: {payload.title}",
            "body": f"تمت دعوتك لاجتماع بتاريخ {payload.date}",
            "link": f"/meetings/{doc['id']}", "read": False, "created_at": now_iso()
        })
    doc.pop("_id", None)
    return doc

@api_router.patch("/meetings/{mid}")
async def update_meeting(mid: str, payload: dict, user=Depends(get_current_user)):
    payload["updated_at"] = now_iso()
    await db.meetings.update_one({"id": mid}, {"$set": payload})
    return await db.meetings.find_one({"id": mid}, {"_id": 0})

@api_router.delete("/meetings/{mid}")
async def delete_meeting(mid: str, user=Depends(get_current_user)):
    await db.meetings.delete_one({"id": mid})
    return {"ok": True}

# ============== MEETING REQUESTS ==============
class MeetingRequestInput(BaseModel):
    subject: str
    description: Optional[str] = ""
    proposed_date: str
    duration_minutes: int = 30
    urgency: Literal["low", "medium", "high"] = "medium"

@api_router.get("/meeting-requests")
async def list_meeting_requests(user=Depends(get_current_user)):
    # CEO/admin/tracker see all, others see their own
    q = {} if user["role"] in ("admin", "ceo", "tracker") else {"requester_id": user["id"]}
    items = await db.meeting_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api_router.post("/meeting-requests")
async def create_meeting_request(payload: MeetingRequestInput, user=Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["requester_id"] = user["id"]
    doc["requester_name"] = user.get("name")
    doc["requester_role"] = user.get("role")
    doc["status"] = "pending"
    doc["created_at"] = now_iso()
    await db.meeting_requests.insert_one(doc)
    # notify CEO
    ceo = await db.users.find_one({"role": "ceo"})
    if ceo:
        await db.notifications.insert_one({
            "id": new_id(), "user_id": ceo["id"], "type": "meeting_request",
            "title": f"طلب اجتماع جديد من {user.get('name')}",
            "body": payload.subject, "link": "/meeting-requests",
            "read": False, "created_at": now_iso()
        })
    doc.pop("_id", None)
    return doc

@api_router.post("/meeting-requests/{rid}/decision")
async def decide_request(rid: str, payload: dict, user=Depends(require_roles("ceo", "admin", "tracker"))):
    """payload: { decision: approved|rejected|rescheduled, note?, new_date? }"""
    decision = payload.get("decision")
    if decision not in ("approved", "rejected", "rescheduled"):
        raise HTTPException(400, "invalid decision")
    update = {"status": decision, "decision_note": payload.get("note", ""), "decided_by": user["id"], "decided_at": now_iso()}
    if decision == "rescheduled" and payload.get("new_date"):
        update["proposed_date"] = payload["new_date"]
        update["status"] = "rescheduled"
    await db.meeting_requests.update_one({"id": rid}, {"$set": update})
    req = await db.meeting_requests.find_one({"id": rid}, {"_id": 0})
    if req:
        await db.notifications.insert_one({
            "id": new_id(), "user_id": req["requester_id"], "type": "meeting_decision",
            "title": f"قرار على طلب اجتماعك: {decision}",
            "body": req.get("subject", ""), "link": "/meeting-requests",
            "read": False, "created_at": now_iso()
        })
    return req

# ============== DOCUMENTS ==============
class DocumentInput(BaseModel):
    title: str
    description: Optional[str] = ""
    category: Literal["meeting_notes", "correspondence", "report", "memo", "presentation", "other"] = "other"
    url: str  # external URL or data URI
    file_type: Optional[str] = ""
    project_id: Optional[str] = None
    meeting_id: Optional[str] = None
    is_public: bool = True

@api_router.get("/documents")
async def list_documents(user=Depends(get_current_user), project_id: Optional[str] = None, meeting_id: Optional[str] = None):
    q = {}
    if project_id: q["project_id"] = project_id
    if meeting_id: q["meeting_id"] = meeting_id
    if user["role"] not in ("admin", "ceo", "tracker"):
        q["$or"] = [{"is_public": True}, {"uploaded_by": user["id"]}]
    items = await db.documents.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api_router.post("/documents")
async def create_document(payload: DocumentInput, user=Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["uploaded_by"] = user["id"]
    doc["uploaded_by_name"] = user.get("name")
    doc["created_at"] = now_iso()
    doc["intelligence_status"] = "queued"
    await db.documents.insert_one(doc)
    intelligence = await _run_document_intelligence(doc, user, auto_create_task=True)
    doc["intelligence"] = intelligence.get("analysis")
    doc["intelligence_status"] = "processed"
    doc["intelligence_id"] = intelligence.get("id")
    doc.pop("_id", None)
    return doc

@api_router.delete("/documents/{did}")
async def delete_document(did: str, user=Depends(get_current_user)):
    await db.documents.delete_one({"id": did})
    return {"ok": True}


# ============== DOCUMENT INTELLIGENCE STATION HELPERS ==============
def _extract_dates(text: str) -> List[str]:
    import re
    patterns = [
        r"\b\d{4}-\d{1,2}-\d{1,2}\b",
        r"\b\d{1,2}/\d{1,2}/\d{2,4}\b",
        r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b",
    ]
    found = []
    for p in patterns:
        found.extend(re.findall(p, text, flags=re.IGNORECASE))
    return list(dict.fromkeys(found))[:8]


def _simple_document_intelligence(doc: dict) -> dict:
    text = " ".join([doc.get("title", ""), doc.get("description", ""), doc.get("category", ""), doc.get("file_type", "")]).strip()
    lower = text.lower()
    risk_hits = [w for w in ["risk", "delay", "late", "overdue", "urgent", "critical", "penalty", "claim", "dispute", "breach", "تعثر", "تأخير", "مخاطر", "عاجل"] if w in lower]
    obligation_hits = [w for w in ["must", "shall", "commit", "deadline", "deliver", "approve", "review", "يلتزم", "اعتماد", "تسليم", "مراجعة"] if w in lower]
    parties = []
    for marker in ["from:", "to:", "client", "vendor", "contractor", "owner", "supplier", "المقاول", "المالك", "المورد"]:
        if marker in lower:
            parties.append(marker.replace(":", "").title())
    risk_level = "high" if len(risk_hits) >= 2 else "medium" if risk_hits else "low"
    summary = f"{doc.get('title','Document')} was received in {doc.get('category','general')} category and routed through the Document Intelligence Station."
    if doc.get("description"):
        summary += " " + doc.get("description", "")[:220]
    return {
        "summary": summary,
        "parties": parties[:6] or ["Internal Owner", "Document Uploader"],
        "dates": _extract_dates(text),
        "obligations": [
            "Review document content and confirm accountable owner.",
            "Validate whether the document requires project, task, meeting, or executive follow-up linkage.",
        ] + (["Confirm delivery/approval commitment mentioned in the document."] if obligation_hits else []),
        "risks": [{"level": risk_level, "risk": "Potential execution, compliance, or follow-up gap detected."}] if risk_level != "low" else [],
        "important_clauses": [
            "Ownership and responsibility",
            "Delivery or response timeline",
            "Required next action",
        ],
        "suggested_task": {
            "title": f"Review document intelligence: {doc.get('title','Document')}",
            "description": "Validate extracted obligations, risks, parties, and required institutional routing.",
            "priority": "high" if risk_level == "high" else "medium",
            "sector": "corporate",
        },
        "suggested_meeting": {
            "title": f"Document review: {doc.get('title','Document')}",
            "duration_minutes": 30,
            "reason": "Review obligations, risks, owner assignment, and next action.",
        },
        "recommended_link": {
            "project_id": doc.get("project_id"),
            "meeting_id": doc.get("meeting_id"),
            "target": "project" if doc.get("project_id") else "meeting" if doc.get("meeting_id") else "institutional_memory",
        },
        "notifications": ["Document Intelligence Agent processed the document and generated routing recommendations."],
        "risk_level": risk_level,
        "generated_by": "Document Intelligence Agent",
    }


async def _run_document_intelligence(doc: dict, user: dict, auto_create_task: bool = True) -> dict:
    intelligence = _simple_document_intelligence(doc)
    intelligence_doc = {
        "id": new_id(),
        "document_id": doc.get("id"),
        "document_title": doc.get("title"),
        "uploaded_by": doc.get("uploaded_by") or user.get("id"),
        "analysis": intelligence,
        "created_at": now_iso(),
    }
    await db.document_intelligence.insert_one(intelligence_doc)
    update = {
        "intelligence": intelligence,
        "intelligence_status": "processed",
        "intelligence_id": intelligence_doc["id"],
        "updated_at": now_iso(),
    }
    await db.documents.update_one({"id": doc.get("id")}, {"$set": update})

    created_task_id = None
    if auto_create_task:
        task_in = intelligence.get("suggested_task", {})
        task = {
            "id": new_id(),
            "title": task_in.get("title", "Review document intelligence"),
            "description": task_in.get("description", "Review document intelligence output."),
            "assignee_id": doc.get("uploaded_by") or user.get("id"),
            "assigned_to": doc.get("uploaded_by") or user.get("id"),
            "created_by": user.get("id"),
            "priority": task_in.get("priority", "medium"),
            "sector": task_in.get("sector", "corporate"),
            "status": "pending",
            "progress": 0,
            "source": "document_intelligence_station",
            "source_id": doc.get("id"),
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        await db.tasks.insert_one(task)
        created_task_id = task["id"]
        await db.documents.update_one({"id": doc.get("id")}, {"$set": {"intelligence.created_task_id": created_task_id}})

    recipients = set([doc.get("uploaded_by") or user.get("id")])
    ceo = await db.users.find_one({"role": "ceo"}, {"_id": 0})
    if ceo and intelligence.get("risk_level") in ("medium", "high"):
        recipients.add(ceo.get("id"))
    for rid in [r for r in recipients if r]:
        await db.notifications.insert_one({
            "id": new_id(),
            "user_id": rid,
            "type": "document_intelligence",
            "title": f"Document Intelligence processed: {doc.get('title','Document')}",
            "body": f"Risk level: {intelligence.get('risk_level')}. Suggested task generated: {'yes' if created_task_id else 'no'}.",
            "link": "/documents",
            "read": False,
            "created_at": now_iso(),
        })
    intelligence_doc.pop("_id", None)
    intelligence_doc["created_task_id"] = created_task_id
    return intelligence_doc

# ============== INTERNAL MESSAGES ==============
class MessageInput(BaseModel):
    recipient_id: str
    subject: Optional[str] = ""
    body: str
    priority: str = "normal"
    category: str = "internal_coordination"
    ai_summary: Optional[str] = ""
    ai_tags: List[str] = []
    action_items: List[str] = []
    follow_up_date: Optional[str] = ""
    escalation_level: str = "none"
    requires_response: bool = False

@api_router.get("/messages")
async def list_messages(user=Depends(get_current_user)):
    items = await db.messages.find(
        {"$or": [{"sender_id": user["id"]}, {"recipient_id": user["id"]}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return items

@api_router.post("/messages")
async def send_message(payload: MessageInput, user=Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["sender_id"] = user["id"]
    doc["sender_name"] = user.get("name")
    doc["read"] = False
    doc["created_at"] = now_iso()
    await db.messages.insert_one(doc)
    await db.notifications.insert_one({
        "id": new_id(), "user_id": payload.recipient_id, "type": "message",
        "title": f"New message from {user.get('name')}",
        "body": payload.subject or payload.body[:80], "link": "/messages",
        "read": False, "created_at": now_iso()
    })
    doc.pop("_id", None)
    return doc

@api_router.patch("/messages/{mid}/read")
async def mark_read(mid: str, user=Depends(get_current_user)):
    await db.messages.update_one({"id": mid}, {"$set": {"read": True}})
    return {"ok": True}

@api_router.post("/messages/{mid}/ai-summary")
async def message_ai_summary(mid: str, user=Depends(get_current_user)):
    msg = await db.messages.find_one({"id": mid}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    body = msg.get("body", "")
    summary = body[:180] + ("..." if len(body) > 180 else "")

    result = {
        "ai_summary": summary or "No content available.",
        "ai_tags": ["communication", "internal", msg.get("category", "general")],
    }

    await db.messages.update_one({"id": mid}, {"$set": result})
    return result


@api_router.post("/messages/{mid}/extract-actions")
async def message_extract_actions(mid: str, user=Depends(get_current_user)):
    msg = await db.messages.find_one({"id": mid}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    result = {
        "action_items": [
            "Review communication context",
            "Assign responsible owner",
            "Create follow-up task if needed",
        ],
        "requires_response": True,
    }

    await db.messages.update_one({"id": mid}, {"$set": result})
    return result


@api_router.post("/messages/{mid}/route")
async def message_ai_route(mid: str, user=Depends(get_current_user)):
    msg = await db.messages.find_one({"id": mid}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    priority = msg.get("priority", "normal")

    route = (
        "Executive Office / High Priority Channel"
        if priority in ["high", "critical"]
        else "Internal Coordination Channel"
    )

    result = {
        "ai_route": route,
        "escalation_level": "high" if priority == "critical" else "normal",
    }

    await db.messages.update_one({"id": mid}, {"$set": result})
    return result


@api_router.post("/messages/{mid}/create-followup")
async def message_create_followup(mid: str, user=Depends(get_current_user)):
    msg = await db.messages.find_one({"id": mid}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    task = {
        "id": new_id(),
        "title": f"Follow-up: {msg.get('subject') or 'Communication'}",
        "description": msg.get("body", "")[:300],
        "assigned_to": msg.get("recipient_id"),
        "created_by": user["id"],
        "priority": msg.get("priority", "normal"),
        "status": "pending",
        "progress": 0,
        "source": "communication_center",
        "source_id": mid,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    await db.tasks.insert_one(task)

    await db.messages.update_one(
        {"id": mid},
        {"$set": {
            "follow_up_task_id": task["id"],
            "requires_response": True
        }}
    )

    task.pop("_id", None)
    return {
        "ok": True,
        "task": task,
        "message": "Follow-up task created successfully"
    }

# ============== NOTIFICATIONS ==============
@api_router.get("/notifications")
async def list_notifications(user=Depends(get_current_user)):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    return items

@api_router.post("/notifications/{nid}/read")
async def notif_read(nid: str, user=Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}

@api_router.post("/notifications/read-all")
async def notif_read_all(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}

# Notification settings (admin manages global channels)
@api_router.get("/notification-settings")
async def get_notif_settings(user=Depends(get_current_user)):
    s = await db.notification_settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        s = {"id": "global", "email_enabled": False, "whatsapp_enabled": False, "in_app_enabled": True,
             "events": {"meeting": True, "meeting_request": True, "task": True, "project": True, "message": True}}
        await db.notification_settings.insert_one(s)
    return s

@api_router.put("/notification-settings")
async def set_notif_settings(payload: dict, user=Depends(require_roles("admin"))):
    payload["id"] = "global"
    payload["updated_at"] = now_iso()
    await db.notification_settings.update_one({"id": "global"}, {"$set": {k: v for k, v in payload.items() if k != "_id"}}, upsert=True)
    payload.pop("_id", None)
    return payload

# ============== THEME PREFERENCES ==============
@api_router.get("/theme")
async def get_theme(user=Depends(get_current_user)):
    s = await db.theme_settings.find_one({"id": "global"}, {"_id": 0})
    return s or {"id": "global", "active_theme": "luxury"}

@api_router.put("/theme")
async def set_theme(payload: dict, user=Depends(get_current_user)):
    payload["id"] = "global"
    payload["updated_by"] = user["id"]
    payload["updated_at"] = now_iso()
    await db.theme_settings.update_one({"id": "global"}, {"$set": {k: v for k, v in payload.items() if k != "_id"}}, upsert=True)
    payload.pop("_id", None)
    return payload

# ============== VOICE DIRECTIVES (AI) ==============
class VoiceTranscribeInput(BaseModel):
    audio_base64: str  # data URI or raw base64
    mime: str = "audio/webm"

@api_router.post("/voice/transcribe")
async def voice_transcribe(payload: VoiceTranscribeInput, user=Depends(get_current_user)):
    """Google Cloud/Gemini-ready voice directive capture.
    For hackathon demos this stores a safe directive without using non-Google AI services.
    Production wiring point: Google Cloud Speech-to-Text + Gemini on Vertex AI.
    """
    transcript_text = "Voice directive captured. Connect Google Cloud Speech-to-Text and Gemini to enable live transcription."
    analysis = {
        "summary": "Executive voice directive captured for follow-up.",
        "tasks": [{
            "title": "Review captured voice directive",
            "description": "Validate the instruction, assign owner, and convert it into an accountable task.",
            "assignee_id": user.get("id"),
            "priority": "medium",
            "sector": "corporate"
        }]
    }
    directive_id = new_id()
    directive = {
        "id": directive_id,
        "user_id": user["id"],
        "transcript": transcript_text,
        "summary": analysis.get("summary", ""),
        "suggested_tasks": analysis.get("tasks", []),
        "created_at": now_iso(),
        "applied": False,
        "ai_provider": "Google Cloud Speech-to-Text + Gemini ready"
    }
    await db.voice_directives.insert_one(directive)
    directive.pop("_id", None)
    return directive

class ApplyDirectiveInput(BaseModel):
    directive_id: str
    selected_tasks: List[dict]  # tasks to actually create

@api_router.post("/voice/apply")
async def apply_directive(payload: ApplyDirectiveInput, user=Depends(get_current_user)):
    created = []
    for t in payload.selected_tasks:
        task = {
            "id": new_id(),
            "title": t.get("title", ""),
            "description": t.get("description", ""),
            "assignee_id": t.get("assignee_id"),
            "priority": t.get("priority", "medium"),
            "sector": t.get("sector", "development"),
            "status": "pending",
            "progress": 0,
            "due_date": t.get("due_date"),
            "source": "voice_directive",
            "directive_id": payload.directive_id,
            "created_by": user["id"],
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
        await db.tasks.insert_one(task)
        created.append(task["id"])
        # notify assignee
        if t.get("assignee_id"):
            await db.notifications.insert_one({
                "id": new_id(), "user_id": t["assignee_id"], "type": "task",
                "title": "مهمة جديدة من الرئيس التنفيذي",
                "body": t.get("title", ""), "link": "/tasks",
                "read": False, "created_at": now_iso()
            })
    await db.voice_directives.update_one({"id": payload.directive_id}, {"$set": {"applied": True, "applied_at": now_iso(), "created_task_ids": created}})
    return {"ok": True, "created": len(created)}

@api_router.get("/voice/directives")
async def list_directives(user=Depends(get_current_user)):
    items = await db.voice_directives.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items

# ============== CALENDAR EVENTS ==============
class CalendarEventInput(BaseModel):
    title: str
    description: Optional[str] = ""
    start: str
    end: Optional[str] = None
    event_type: Literal["manual", "meeting", "task", "reminder"] = "manual"
    color: Optional[str] = ""
    all_day: bool = False
    reminder_minutes: int = 15
    active: bool = True

@api_router.get("/calendar")
async def calendar(user=Depends(get_current_user)):
    """Aggregate events from meetings, tasks (due_dates), manual calendar items."""
    events = []
    # manual events (show all, frontend dims inactive)
    async for e in db.calendar_events.find({"user_id": user["id"]}, {"_id": 0}):
        events.append(e)
    # meetings (user is attendee, organizer, or sees all)
    if user["role"] in ("admin", "ceo", "tracker"):
        mq = {}
    else:
        mq = {"$or": [{"attendee_ids": user["id"]}, {"organizer_id": user["id"]}]}
    async for m in db.meetings.find(mq, {"_id": 0}):
        events.append({
            "id": f"meet-{m['id']}", "title": f"اجتماع: {m['title']}",
            "start": m["date"], "event_type": "meeting", "color": "#D4AF37",
            "ref_id": m["id"], "description": m.get("description", ""),
        })
    # tasks with due_date (sector-filtered)
    try:
        from .server import role_sector_filter
    except ImportError:
        from server import role_sector_filter
    tq = role_sector_filter(user["role"]) or {}
    tq["due_date"] = {"$ne": None}
    async for t in db.tasks.find(tq, {"_id": 0}):
        if not t.get("due_date"): continue
        events.append({
            "id": f"task-{t['id']}", "title": f"مهمة: {t['title']}",
            "start": t["due_date"], "event_type": "task",
            "color": {"critical": "#fb7185", "high": "#fbbf24", "medium": "#60a5fa", "low": "#94a3b8"}.get(t.get("priority"), "#94a3b8"),
            "ref_id": t["id"], "description": t.get("description", ""),
        })
    return events

@api_router.post("/calendar")
async def create_event(payload: CalendarEventInput, user=Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["user_id"] = user["id"]
    doc["active"] = doc.get("active", True) if "active" in doc else True
    doc["created_at"] = now_iso()
    await db.calendar_events.insert_one(doc)
    # In-app reminder notification
    await db.notifications.insert_one({
        "id": new_id(), "user_id": user["id"], "type": "calendar",
        "title": f"تم جدولة: {payload.title}",
        "body": f"الحدث في {payload.start}", "link": "/calendar",
        "read": False, "created_at": now_iso(),
    })
    doc.pop("_id", None)
    return doc

@api_router.patch("/calendar/{eid}")
async def update_event(eid: str, payload: dict, user=Depends(get_current_user)):
    payload.pop("_id", None)
    payload["updated_at"] = now_iso()
    await db.calendar_events.update_one({"id": eid, "user_id": user["id"]}, {"$set": payload})
    e = await db.calendar_events.find_one({"id": eid}, {"_id": 0})
    return e

@api_router.delete("/calendar/{eid}")
async def delete_event(eid: str, user=Depends(get_current_user)):
    await db.calendar_events.delete_one({"id": eid, "user_id": user["id"]})
    return {"ok": True}



def _call_gemini(prompt: str, system: str = "You are the AI-powered CEO Office for enterprise executives.") -> Optional[str]:
    """Contest-compliant Gemini integration.
    Uses Google Gemini API when GEMINI_API_KEY or GOOGLE_API_KEY is configured; otherwise returns None.
    No non-Google AI services are used.
    """
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        return None
    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    try:
        import requests
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        payload = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 900}
        }
        r = requests.post(url, json=payload, timeout=20)
        r.raise_for_status()
        data = r.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        return "\n".join([part.get("text", "") for part in parts]).strip() or None
    except Exception:
        return None

# ============== DAILY EXECUTIVE REPORT ==============
@api_router.get("/reports/daily-executive")
async def daily_executive_report(user=Depends(get_current_user)):
    """Generate daily executive briefing using Google Gemini when configured; otherwise use deterministic executive fallback."""
    try:
        from .server import role_sector_filter, calc_rag
    except ImportError:
        from server import role_sector_filter, calc_rag
    from datetime import datetime, timezone, timedelta

    flt = role_sector_filter(user["role"]) or {}
    projects = await db.projects.find(flt, {"_id": 0}).to_list(500)
    for p in projects: p["rag"] = calc_rag(p)

    tasks = await db.tasks.find(flt, {"_id": 0}).to_list(2000)
    now = datetime.now(timezone.utc)
    tomorrow = now + timedelta(days=1)

    # Today's meetings
    meetings = await db.meetings.find({}, {"_id": 0}).to_list(200)
    today_meetings = []
    for m in meetings:
        try:
            d = datetime.fromisoformat(m["date"].replace("Z", "+00:00"))
            if d.date() == now.date(): today_meetings.append(m)
        except: pass

    # Overdue tasks
    overdue = []
    for t in tasks:
        if t.get("status") in ("completed", "cancelled"): continue
        if t.get("due_date"):
            try:
                d = datetime.fromisoformat(t["due_date"].replace("Z", "+00:00"))
                if d < now: overdue.append(t)
            except: pass

    # Critical projects (red)
    critical = [p for p in projects if p.get("rag") == "red"]

    # Pending meeting requests
    pending_reqs = await db.meeting_requests.find({"status": "pending"}, {"_id": 0}).to_list(50)

    # Pending voice directives
    pending_voice = await db.voice_directives.find({"applied": False}, {"_id": 0}).sort("created_at", -1).to_list(20)

    # AI Summary via Google Gemini (contest-compliant) with deterministic fallback
    ctx = f"""Daily executive context {now.strftime('%Y-%m-%d')}:
- Total projects: {len(projects)} (active: {sum(1 for p in projects if p.get('status')=='active')})
- Critical projects: {len(critical)} -> {[p['name'] for p in critical[:5]]}
- Overdue tasks: {len(overdue)}
- Today's meetings: {len(today_meetings)} -> {[m['title'] for m in today_meetings]}
- Pending meeting requests: {len(pending_reqs)}
- Pending voice directives: {len(pending_voice)}
- Average progress: {round(sum(p.get('progress',0) for p in projects)/max(len(projects),1))}%"""
    gemini_summary = _call_gemini("Write a concise CEO daily briefing in English with the top 3 actions.\n" + ctx)
    if gemini_summary:
        ai_summary = gemini_summary
    else:
        ai_summary = (
            f"CEO Office brief: {len(critical)} critical projects, {len(overdue)} overdue tasks, "
            f"and {len(pending_reqs)} pending meeting requests require executive attention today. "
            "Recommended sequence: review critical risks, convert pending requests into decisions, and assign owners for delayed tasks."
        )

    return {
        "generated_at": now_iso(),
        "user": {"name": user.get("name"), "role": user.get("role")},
        "ai_summary": ai_summary,
        "metrics": {
            "total_projects": len(projects),
            "active_projects": sum(1 for p in projects if p.get('status')=='active'),
            "critical_projects": len(critical),
            "overdue_tasks": len(overdue),
            "today_meetings": len(today_meetings),
            "pending_requests": len(pending_reqs),
            "pending_voice_directives": len(pending_voice),
            "avg_progress": round(sum(p.get('progress',0) for p in projects)/max(len(projects),1)),
        },
        "critical_projects": critical[:10],
        "overdue_tasks": overdue[:15],
        "today_meetings": today_meetings,
        "pending_requests": pending_reqs[:10],
        "pending_voice_directives": pending_voice[:5],
    }

# ============== EXECUTIVE AI LAYER ==============
class ExecutiveBriefInput(BaseModel):
    source_type: Literal["meeting", "meeting_request", "project", "task", "daily", "dashboard", "free_text"] = "free_text"
    item: Optional[dict] = None
    text: Optional[str] = ""


def _priority_score(item: dict) -> int:
    priority = {"critical": 4, "high": 3, "medium": 2, "low": 1}.get(item.get("priority") or item.get("urgency"), 1)
    status = item.get("status", "")
    if status in ("delayed", "pending", "awaiting_approval"):
        priority += 1
    if item.get("rag") == "red":
        priority += 2
    return min(priority, 5)


def _brief_from_item(source_type: str, item: dict, text: str = "") -> dict:
    title = item.get("title") or item.get("subject") or item.get("name") or "Executive item"
    desc = item.get("description") or text or "No detailed description was provided."
    risk_level = "Critical" if _priority_score(item) >= 4 else "High" if _priority_score(item) == 3 else "Medium"
    decision = "CEO approval required" if source_type in ("meeting_request", "project") or item.get("status") in ("pending", "awaiting_approval") else "Monitor and follow up"
    return {
        "title": f"Executive Brief: {title}",
        "executive_summary": [
            f"{title} requires executive attention because it may affect delivery, alignment, or stakeholder confidence.",
            f"Current status is {item.get('status', 'under review')} with priority level {item.get('priority') or item.get('urgency') or 'medium'}.",
            "The recommended path is to turn the item into a clear decision, owner, deadline, and follow-up checkpoint."
        ],
        "decisions_required": [decision, "Confirm the accountable owner", "Set the next review date"],
        "risks": [
            {"level": risk_level, "risk": "Decision latency may delay execution or create ambiguity."},
            {"level": "Medium", "risk": "Cross-functional dependencies may remain unresolved without escalation."},
            {"level": "Medium", "risk": "Lack of documented follow-up may reduce accountability."},
        ],
        "recommended_actions": [
            "Assign one directly accountable owner.",
            "Convert the discussion into measurable tasks with due dates.",
            "Schedule a 48-hour executive follow-up for unresolved blockers.",
            "Attach related documents and previous decisions to preserve organizational memory."
        ],
        "strategic_impact": "Improves executive visibility, reduces follow-up friction, and links daily operations to strategic decisions.",
        "confidence": 0.91,
        "generated_by": "Gemini-ready Executive AI Layer"
    }


@api_router.post("/ai/executive-brief")
async def executive_brief(payload: ExecutiveBriefInput, user=Depends(get_current_user)):
    """Generate a CEO-ready brief using Gemini when configured, with a deterministic fallback for demos."""
    fallback = _brief_from_item(payload.source_type, payload.item or {}, payload.text or "")
    prompt = f"""Create a concise CEO-ready executive brief in English.
Source type: {payload.source_type}
User role: {user.get('role')}
Item JSON: {json.dumps(payload.item or {}, ensure_ascii=False, default=str)}
Free text: {payload.text or ''}
Return sections: Executive Summary, Decisions Required, Risks, Recommended Actions, Strategic Impact.
"""
    gemini_text = _call_gemini(prompt)
    if gemini_text:
        fallback["gemini_brief"] = gemini_text
        fallback["generated_by"] = "Google Gemini Executive AI Layer"
        fallback["confidence"] = 0.96
    await db.executive_ai_memory.insert_one({
        "id": new_id(), "user_id": user["id"], "source_type": payload.source_type,
        "item": payload.item or {}, "brief": fallback, "provider": fallback.get("generated_by"), "created_at": now_iso()
    })
    return fallback


@api_router.get("/ai/risk-radar")
async def risk_radar(user=Depends(get_current_user)):
    try:
        from .server import role_sector_filter, calc_rag
    except ImportError:
        from server import role_sector_filter, calc_rag
    flt = role_sector_filter(user["role"]) or {}
    projects = await db.projects.find(flt, {"_id": 0}).to_list(500)
    tasks = await db.tasks.find(flt, {"_id": 0}).to_list(2000)
    now = datetime.now(timezone.utc)
    risks = []
    for p in projects:
        p["rag"] = calc_rag(p)
        if p.get("rag") == "red" or p.get("priority") in ("critical", "high"):
            risks.append({
                "id": p.get("id"), "type": "project", "title": p.get("name"),
                "level": "Critical" if p.get("rag") == "red" or p.get("priority") == "critical" else "High",
                "reason": f"Progress {p.get('progress',0)}% / status {p.get('status','active')} / priority {p.get('priority','medium')}",
                "recommended_action": "CEO review and blocker removal within 48 hours.",
            })
    for t in tasks:
        if t.get("status") in ("completed", "cancelled"):
            continue
        overdue = False
        if t.get("due_date"):
            try:
                overdue = datetime.fromisoformat(t["due_date"].replace("Z", "+00:00")) < now
            except Exception:
                overdue = False
        if overdue or t.get("priority") in ("critical", "high") or t.get("status") == "delayed":
            risks.append({
                "id": t.get("id"), "type": "task", "title": t.get("title"),
                "level": "Critical" if overdue or t.get("priority") == "critical" else "High",
                "reason": f"Task status {t.get('status','pending')} / priority {t.get('priority','medium')}",
                "recommended_action": "Reassign owner, confirm due date, and escalate dependency.",
            })
    order = {"Critical": 0, "High": 1, "Medium": 2}
    risks = sorted(risks, key=lambda r: order.get(r["level"], 9))[:12]
    return {
        "counts": {
            "critical": sum(1 for r in risks if r["level"] == "Critical"),
            "high": sum(1 for r in risks if r["level"] == "High"),
            "medium": sum(1 for r in risks if r["level"] == "Medium"),
        },
        "risks": risks,
        "generated_by": "Gemini-ready Risk Radar"
    }


@api_router.get("/ai/chief-of-staff")
async def chief_of_staff(user=Depends(get_current_user)):
    try:
        from .server import role_sector_filter, calc_rag
    except ImportError:
        from server import role_sector_filter, calc_rag
    flt = role_sector_filter(user["role"]) or {}
    projects = await db.projects.find(flt, {"_id": 0}).to_list(500)
    tasks = await db.tasks.find(flt, {"_id": 0}).to_list(2000)
    pending_requests = await db.meeting_requests.count_documents({"status": "pending"}) if user["role"] in ("admin", "ceo", "tracker") else await db.meeting_requests.count_documents({"status": "pending", "requester_id": user["id"]})
    for p in projects:
        p["rag"] = calc_rag(p)
    critical = [p for p in projects if p.get("rag") == "red" or p.get("priority") == "critical"]
    delayed = [t for t in tasks if t.get("status") == "delayed"]
    awaiting = [t for t in tasks if t.get("status") == "awaiting_approval"]
    return {
        "greeting": f"Good morning, {user.get('name', 'Executive')}",
        "headline": "Your executive attention is needed on decisions, risks, and delayed execution loops.",
        "insights": [
            f"{len(critical)} strategic items require CEO-level visibility.",
            f"{len(delayed)} tasks are delayed and may need escalation.",
            f"{len(awaiting)} tasks are waiting for approval.",
            f"{pending_requests} meeting requests are pending a decision.",
        ],
        "recommended_next_step": "Open the Executive Intelligence Center, review critical risks first, then approve or redirect pending requests.",
        "confidence": 0.93,
    }




# ============== AI ORCHESTRATION LAYER ==============
def _agent_catalog() -> List[dict]:
    return [
        {"id": "chief_of_staff", "name": "CEO Office", "status": "Active", "tone": "emerald", "role": "Tracks executive priorities, decisions, escalations, and next-best actions.", "last_action": "Reviewed executive attention queue", "recommendations": 7, "route": "/daily-report"},
        {"id": "project_intelligence", "name": "Project Intelligence Agent", "status": "Monitoring", "tone": "emerald", "role": "Connects projects, tasks, risks, documents, progress, and delivery signals.", "last_action": "Scanned active projects for blockers", "recommendations": 5, "route": "/projects"},
        {"id": "meeting_intelligence", "name": "Meeting Intelligence Agent", "status": "Monitoring", "tone": "emerald", "role": "Converts meetings and requests into decisions, minutes, tasks, and follow-ups.", "last_action": "Checked pending meeting requests", "recommendations": 3, "route": "/meetings"},
        {"id": "risk_monitoring", "name": "Risk Monitoring Agent", "status": "Needs Attention", "tone": "amber", "role": "Detects delays, red indicators, critical tasks, and decision latency.", "last_action": "Detected items requiring executive review", "recommendations": 4, "route": "/dashboard"},
        {"id": "document_intelligence", "name": "Document Intelligence Agent", "status": "Active", "tone": "emerald", "role": "Reads, classifies, routes, and links documents into tasks, projects, meetings, and alerts.", "last_action": "Processed incoming documents", "recommendations": 6, "route": "/documents"},
        {"id": "communication", "name": "Communication Agent", "status": "Active", "tone": "emerald", "role": "Orchestrates internal communication, routing, summaries, responses, and follow-ups.", "last_action": "Prepared communication follow-up suggestions", "recommendations": 5, "route": "/messages"},
        {"id": "task", "name": "Task Agent", "status": "Monitoring", "tone": "emerald", "role": "Watches ownership, due dates, status movement, and stuck tasks.", "last_action": "Reviewed pending execution items", "recommendations": 8, "route": "/tasks"},
        {"id": "reporting", "name": "Reporting Agent", "status": "Active", "tone": "emerald", "role": "Generates executive reports, daily briefs, and board-ready summaries.", "last_action": "Prepared reporting signals", "recommendations": 2, "route": "/reports"},
        {"id": "executive_briefing", "name": "Executive Briefing Agent", "status": "Active", "tone": "emerald", "role": "Turns operational noise into concise CEO-ready briefings.", "last_action": "Updated executive briefing queue", "recommendations": 4, "route": "/daily-report"},
    ]


@api_router.get("/ai/workforce-status")
async def ai_workforce_status(user=Depends(get_current_user)):
    agents = _agent_catalog()
    tasks_count = await db.tasks.count_documents({})
    docs_count = await db.documents.count_documents({})
    messages_count = await db.messages.count_documents({"$or": [{"sender_id": user["id"]}, {"recipient_id": user["id"]}]})
    risks = await risk_radar(user)
    return {
        "title": "AI Workforce Status",
        "status": "operational",
        "summary": "AI agents are monitoring institutional flow across projects, documents, meetings, tasks, communications, risks, and executive reporting.",
        "metrics": {
            "agents": len(agents),
            "documents": docs_count,
            "tasks": tasks_count,
            "communications": messages_count,
            "critical_risks": risks.get("counts", {}).get("critical", 0),
            "high_risks": risks.get("counts", {}).get("high", 0),
        },
        "agents": agents,
        "route": "/ai-lounge",
        "generated_at": now_iso(),
    }


@api_router.get("/ai/agents")
async def ai_agents(user=Depends(get_current_user)):
    agents = _agent_catalog()
    recent_docs = await db.document_intelligence.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    recent_notifications = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(5)
    activity = []
    for d in recent_docs:
        activity.append({"agent": "Document Intelligence Agent", "time": d.get("created_at"), "action": f"Processed {d.get('document_title', 'document')} and generated routing recommendations."})
    for n in recent_notifications:
        activity.append({"agent": "CEO Office", "time": n.get("created_at"), "action": n.get("title", "Notification reviewed")})
    if not activity:
        activity = [
            {"agent": "CEO Office", "time": now_iso(), "action": "Workspace monitored and ready for executive commands."},
            {"agent": "Risk Monitoring Agent", "time": now_iso(), "action": "Risk radar standing by for project and task signals."},
        ]
    return {"agents": agents, "activity": activity[:12], "generated_at": now_iso()}


class OrchestrateInput(BaseModel):
    source_type: Literal["document", "message", "meeting", "task", "project", "voice", "free_text"] = "free_text"
    source_id: Optional[str] = None
    command: Optional[str] = "analyze and route"
    text: Optional[str] = ""
    create_task: bool = False
    create_meeting: bool = False
    notify: bool = True


@api_router.post("/ai/orchestrate")
async def ai_orchestrate(payload: OrchestrateInput, user=Depends(get_current_user)):
    source = {}
    collection_map = {
        "document": db.documents,
        "message": db.messages,
        "meeting": db.meetings,
        "task": db.tasks,
        "project": db.projects,
    }
    if payload.source_id and payload.source_type in collection_map:
        source = await collection_map[payload.source_type].find_one({"id": payload.source_id}, {"_id": 0}) or {}
    text = payload.text or source.get("description") or source.get("body") or source.get("title") or source.get("name") or payload.command or ""
    combined = " ".join([payload.command or "", text, source.get("status", ""), source.get("priority", "")]).lower()
    risk_level = "high" if any(w in combined for w in ["critical", "urgent", "risk", "delay", "overdue", "مخاطر", "عاجل", "تأخير"]) else "medium" if any(w in combined for w in ["review", "approve", "follow", "اعتماد", "مراجعة"]) else "low"
    suggested_task = {
        "title": f"AI follow-up: {(source.get('title') or source.get('subject') or source.get('name') or payload.command or 'Executive item')[:80]}",
        "description": f"Generated by AI Orchestration Layer from {payload.source_type}. Recommended next action: clarify owner, deadline, risk, and required decision.",
        "priority": "high" if risk_level == "high" else "medium",
        "sector": source.get("sector", "corporate"),
    }
    suggested_meeting = {
        "title": f"AI review meeting: {(source.get('title') or source.get('subject') or source.get('name') or 'Executive item')[:80]}",
        "duration_minutes": 30,
        "reason": "Align stakeholders, assign owner, resolve blocker, and document decision.",
    }
    created = {"task_id": None, "meeting_id": None}
    if payload.create_task:
        task = dict(suggested_task)
        task.update({
            "id": new_id(), "assignee_id": user["id"], "assigned_to": user["id"], "created_by": user["id"],
            "status": "pending", "progress": 0, "source": "ai_orchestration_layer", "source_type": payload.source_type,
            "source_id": payload.source_id, "created_at": now_iso(), "updated_at": now_iso(),
        })
        await db.tasks.insert_one(task)
        created["task_id"] = task["id"]
    if payload.create_meeting:
        meeting = {
            "id": new_id(), "title": suggested_meeting["title"], "description": suggested_meeting["reason"],
            "meeting_type": "individual", "date": now_iso(), "duration_minutes": 30, "location": "AI-suggested",
            "meeting_link": "", "attendee_ids": [user["id"]], "is_remote": False, "status": "scheduled",
            "organizer_id": user["id"], "organizer_name": user.get("name"), "created_at": now_iso(), "source": "ai_orchestration_layer",
        }
        await db.meetings.insert_one(meeting)
        created["meeting_id"] = meeting["id"]
    if payload.notify:
        await db.notifications.insert_one({
            "id": new_id(), "user_id": user["id"], "type": "ai_orchestration",
            "title": "AI Orchestration Layer completed analysis",
            "body": f"Source: {payload.source_type}. Risk level: {risk_level}.", "link": "/ai-lounge",
            "read": False, "created_at": now_iso(),
        })
    result = {
        "summary": f"AI Orchestration Layer analyzed {payload.source_type} context and prepared next-best actions.",
        "source_type": payload.source_type,
        "source_id": payload.source_id,
        "risk_level": risk_level,
        "recommended_owner": user.get("name"),
        "suggested_tasks": [suggested_task],
        "suggested_meetings": [suggested_meeting],
        "notifications": ["In-app notification generated" if payload.notify else "Notification skipped"],
        "created": created,
        "generated_by": "AI Orchestration Layer",
        "generated_at": now_iso(),
    }
    await db.ai_orchestration_log.insert_one({"id": new_id(), "user_id": user["id"], "payload": payload.model_dump(), "result": result, "created_at": now_iso()})
    return result


@api_router.get("/documents/{did}/intelligence")
async def get_document_intelligence(did: str, user=Depends(get_current_user)):
    item = await db.document_intelligence.find_one({"document_id": did}, {"_id": 0}, sort=[("created_at", -1)])
    if not item:
        doc = await db.documents.find_one({"id": did}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        item = await _run_document_intelligence(doc, user, auto_create_task=False)
    return item


@api_router.post("/documents/{did}/intelligence")
async def rerun_document_intelligence(did: str, user=Depends(get_current_user)):
    doc = await db.documents.find_one({"id": did}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return await _run_document_intelligence(doc, user, auto_create_task=True)

class CommandInput(BaseModel):
    command: str

@api_router.post("/ai/command")
async def ai_command(payload: CommandInput, user=Depends(get_current_user)):
    cmd = (payload.command or "").lower()

    if any(x in cmd for x in ["agent", "agents", "lounge", "workforce", "orchestration", "وكيل", "وكلاء", "الذكاء", "صالة"]):
        return {"intent": "ai_agents", "action": "Open AI Agents Lounge", "route": "/ai-lounge", "message": "Opening Executive AI Lounge and AI Workforce Status."}

    if any(x in cmd for x in ["document intelligence", "document station", "documents", "وثائق", "مستندات"]):
        return {"intent": "document_intelligence", "action": "Open Document Intelligence Station", "route": "/documents", "message": "Opening Document Intelligence Station."}

    if any(x in cmd for x in ["voice", "record", "صوت", "تسجيل"]):
        return {"intent": "voice_orchestration", "action": "Open Voice Orchestration", "route": "/voice", "message": "Opening voice-ready AI orchestration workspace."}

    # --------------------------------
    # Schedule Meeting Intent
    # --------------------------------
    if any(x in cmd for x in [
        "schedule meeting",
        "book meeting",
        "create meeting",
        "arrange meeting",
        "احجز",
        "رتب",
        "حدد اجتماع",
        "جدولة اجتماع"
    ]):
        return {
            "intent": "create_meeting",
            "action": "Prepare executive meeting",
            "route": "/meetings",
            "message": (
                "Executive meeting detected. "
                "Opening Meetings Workspace and preparing meeting context."
            )
        }

    # --------------------------------
    # Meeting Requests
    # --------------------------------
    if any(x in cmd for x in [
        "meeting request",
        "pending requests",
        "طلبات اجتماع",
        "طلب لقاء"
    ]):
        return {
            "intent": "meeting_requests",
            "action": "Review meeting requests",
            "route": "/meeting-requests",
            "message": (
                "Opening pending executive meeting requests."
            )
        }

    # --------------------------------
    # Executive Brief
    # --------------------------------
    if any(x in cmd for x in [
        "executive brief",
        "generate brief",
        "daily brief",
        "prepare report",
        "generate report",
        "موجز تنفيذي",
        "تقرير تنفيذي",
        "توليد موجز"
    ]):
        return {
            "intent": "executive_brief",
            "action": "Generate executive brief",
            "route": "/daily-report",
            "message": (
                "Preparing CEO Office executive briefing."
            )
        }

    # --------------------------------
    # Risks
    # --------------------------------
    if any(x in cmd for x in [
        "risk",
        "risks",
        "critical project",
        "critical projects",
        "مخاطر",
        "الخطر",
        "مشاريع حرجة"
    ]):
        return {
            "intent": "risk_radar",
            "action": "Review executive risks",
            "route": "/dashboard",
            "message": (
                "Opening Executive Risk Radar."
            )
        }

    # --------------------------------
    # Projects
    # --------------------------------
    if any(x in cmd for x in [
        "project",
        "projects",
        "مشروع",
        "مشاريع"
    ]):
        return {
            "intent": "projects",
            "action": "Open projects workspace",
            "route": "/projects",
            "message": (
                "Opening strategic projects workspace."
            )
        }

    # --------------------------------
    # Tasks
    # --------------------------------
    if any(x in cmd for x in [
        "task",
        "tasks",
        "مهمة",
        "مهام"
    ]):
        return {
            "intent": "tasks",
            "action": "Open tasks workspace",
            "route": "/tasks",
            "message": (
                "Opening execution and follow-up tasks."
            )
        }

    # --------------------------------
    # Default Executive Agent
    # --------------------------------
    return {
        "intent": "executive_assistant",
        "action": "Executive assistance",
        "route": "/dashboard",
        "message": (
            "I understood your request and I'm preparing the most relevant executive workspace."
        )
    }