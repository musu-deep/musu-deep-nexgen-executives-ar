from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse

import api.unified as base
from api.backend import access_policy, hr_gateway, office_gateway, workflow_gateway

outer_app = base.outer_app
core = base.core
index_module = base.index_module
odoo_server = index_module.odoo_server


def _strict_executive(user: dict[str, Any]) -> None:
    if not access_policy.is_full_access(user):
        raise HTTPException(status_code=403, detail="اعتماد القرارات التنفيذية متاح للرئيس التنفيذي ومدير المنصة فقط")


# Existing workflow handlers call this function at execution time.
workflow_gateway._require_executive = _strict_executive


def _profile_tokens(user: dict[str, Any]) -> set[str]:
    text = " ".join(str(user.get(key) or "") for key in ("title", "department")).lower()
    stop = {"مدير", "مسؤول", "إدارة", "قطاع", "شركة", "مجموعة", "الرئيس", "التنفيذي", "المكتب", "والتنفيذ"}
    return {token.strip("،.-_()") for token in text.split() if len(token.strip("،.-_()")) >= 4 and token not in stop}


def _functional_match(item: dict[str, Any], user: dict[str, Any]) -> bool:
    tokens = _profile_tokens(user)
    if not tokens:
        return False
    haystack = " ".join(str(item.get(key) or "") for key in ("name", "title", "description", "entity_name", "sector_label")).lower()
    return any(token in haystack for token in tokens)


def _odoo_task_assigned(task: dict[str, Any], user_ids: set[int]) -> bool:
    values = task.get("assignee_ids")
    if not isinstance(values, list):
        values = [task.get("assignee_id")]
    assignees = {int(value) for value in values if isinstance(value, int) or str(value or "").isdigit()}
    return bool(assignees & user_ids)


def _odoo_project_owned(project: dict[str, Any], user_ids: set[int]) -> bool:
    owner = project.get("owner_id")
    return bool(owner and str(owner).isdigit() and int(owner) in user_ids)


async def scoped_projects_and_tasks(user: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    admin_scope = {**user, "role": "admin"}
    projects, tasks = await index_module._operational_bundle(admin_scope)
    if access_policy.is_full_access(user):
        return projects, tasks

    identity = await access_policy.resolve_odoo_identity(odoo_server, user)
    user_ids = identity["user_ids"]
    direct_tasks: list[dict[str, Any]] = []
    for task in tasks:
        if task.get("source") == "odoo":
            allowed = _odoo_task_assigned(task, user_ids)
        else:
            allowed = access_policy.local_record_visible(task, user, "task")
        if allowed or (not user_ids and _functional_match(task, user)):
            direct_tasks.append(task)

    linked_project_ids = {str(task.get("project_id") or "") for task in direct_tasks if task.get("project_id")}
    visible_projects: list[dict[str, Any]] = []
    for project in projects:
        project_id = str(project.get("id") or "")
        if project.get("source") == "odoo":
            allowed = _odoo_project_owned(project, user_ids)
        else:
            allowed = access_policy.local_record_visible(project, user, "project")
        if allowed or project_id in linked_project_ids or (not user_ids and _functional_match(project, user)):
            visible_projects.append(project)

    visible_project_ids = {str(project.get("id") or "") for project in visible_projects}
    visible_tasks = [
        task for task in tasks
        if task in direct_tasks or str(task.get("project_id") or "") in visible_project_ids
    ]
    return visible_projects, visible_tasks


async def scoped_meetings(user: dict[str, Any]) -> list[dict[str, Any]]:
    admin_scope = {**user, "role": "admin"}
    meetings, _ = await office_gateway.meeting_records(core, odoo_server, admin_scope)
    if access_policy.can_manage_meetings(user):
        return meetings

    identity = await access_policy.resolve_odoo_identity(odoo_server, user)
    user_ids = identity["user_ids"]
    partner_tokens = {f"odoo-partner-{value}" for value in identity["partner_ids"]}
    local_user_id = str(user.get("id") or "")
    visible = []
    for meeting in meetings:
        attendee_ids = {str(value) for value in meeting.get("attendee_ids", [])}
        organizer = meeting.get("organizer_id")
        if meeting.get("source") == "odoo":
            allowed = bool(partner_tokens & attendee_ids) or bool(organizer and str(organizer).isdigit() and int(organizer) in user_ids)
        else:
            allowed = local_user_id in attendee_ids or str(organizer or "") == local_user_id
        if allowed:
            visible.append(meeting)
    return visible


async def scoped_requests(user: dict[str, Any]) -> list[dict[str, Any]]:
    if access_policy.can_manage_meetings(user):
        return await workflow_gateway.meeting_request_records(core, odoo_server, {**user, "role": "admin"})
    return await workflow_gateway.meeting_request_records(core, odoo_server, {**user, "role": "dev_manager"})


async def scoped_calendar(user: dict[str, Any]) -> list[dict[str, Any]]:
    projects, tasks = await scoped_projects_and_tasks(user)
    del projects
    meetings = await scoped_meetings(user)
    events = await core.db.calendar_events.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    for meeting in meetings:
        if meeting.get("date"):
            events.append({
                "id": f"calendar-{meeting.get('id')}", "source": meeting.get("source"),
                "title": f"اجتماع: {meeting.get('title', '')}", "start": meeting.get("date"),
                "end": meeting.get("end"), "event_type": "meeting", "color": "#D4AF37",
                "ref_id": meeting.get("id"), "description": meeting.get("description") or "",
                "all_day": bool(meeting.get("all_day", False)), "active": meeting.get("status") != "cancelled",
            })
    colors = {"critical": "#fb7185", "high": "#fbbf24", "medium": "#60a5fa", "low": "#94a3b8"}
    for task in tasks:
        if task.get("due_date"):
            events.append({
                "id": f"calendar-{task.get('id')}", "source": task.get("source"),
                "title": f"مهمة: {task.get('title', '')}", "start": task.get("due_date"),
                "event_type": "task", "color": colors.get(task.get("priority"), "#94a3b8"),
                "ref_id": task.get("id"), "description": task.get("description") or "",
                "active": task.get("status") not in {"completed", "cancelled"},
            })
    return list({str(item.get("id")): item for item in events}.values())


async def scoped_notifications(user: dict[str, Any]) -> list[dict[str, Any]]:
    local = await core.db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(300)
    _, tasks = await scoped_projects_and_tasks(user)
    meetings = await scoped_meetings(user)
    now = datetime.now(timezone.utc)
    generated: list[dict[str, Any]] = []
    for meeting in meetings:
        try:
            start = datetime.fromisoformat(str(meeting.get("date")).replace("Z", "+00:00"))
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            continue
        if now <= start <= now + timedelta(days=7):
            generated.append({"id": f"scope-meeting-{meeting.get('id')}", "type": "meeting", "title": f"اجتماع قادم: {meeting.get('title')}", "body": "اجتماع مرتبط بك خلال الأيام السبعة القادمة.", "link": "/meetings", "read": False, "created_at": now.isoformat()})
    for task in tasks:
        if task.get("status") == "delayed":
            generated.append({"id": f"scope-task-{task.get('id')}", "type": "task", "title": f"مهمة متأخرة: {task.get('title')}", "body": "مهمة مسندة أو مشتركة تحتاج معالجة.", "link": "/tasks", "read": False, "created_at": now.isoformat()})
        elif task.get("status") == "awaiting_approval":
            generated.append({"id": f"scope-approval-{task.get('id')}", "type": "approval", "title": f"بانتظار إجراء: {task.get('title')}", "body": "راجع الإجراء المطلوب ضمن نطاقك الوظيفي.", "link": "/tasks", "read": False, "created_at": now.isoformat()})
    return [*generated[:40], *local]


async def hr_payload(user: dict[str, Any]) -> dict[str, Any]:
    access_policy.require_module(user, "human_resources")
    include_compensation = True
    source, employees, warning = await hr_gateway._workforce(core, odoo_server, include_compensation)
    active = [item for item in employees if item.get("active", True)]
    salaries = [float(item.get("salary") or 0) for item in active]
    managers = {str(item.get("manager") or "").strip() for item in active if item.get("manager")}
    assumed_count = sum(1 for item in active if item.get("salary_is_assumed"))
    return {
        "source": source, "warning": warning, "compensation_visible": True,
        "salary_data_classification": "restricted",
        "salary_note": "الرواتب الحالية قيم افتراضية لبناء النموذج وليست اعتماداً مالياً." if assumed_count else "",
        "totals": {
            "employees": len(employees), "active_employees": len(active),
            "inactive_employees": len(employees) - len(active),
            "departments": len({item.get("department") for item in active if item.get("department")}),
            "managers": len(managers), "monthly_payroll": round(sum(salaries), 2),
            "average_salary": round(sum(salaries) / max(len(salaries), 1), 2),
            "assumed_salary_records": assumed_count,
        },
        "departments": hr_gateway._department_summary(employees), "employees": employees,
    }


route_marker = len(outer_app.router.routes)


@outer_app.get("/api/access/me")
async def access_profile(user=Depends(base.hosted_get_current_user)):
    modules = None if access_policy.is_full_access(user) else sorted(access_policy.COMMON_MODULES | access_policy.AREA_MODULES.get(access_policy.functional_area(user), set()))
    return {"full_access": access_policy.is_full_access(user), "functional_area": access_policy.functional_area(user), "modules": modules}


@outer_app.get("/api/projects")
async def projects(user=Depends(base.hosted_get_current_user)):
    items, _ = await scoped_projects_and_tasks(user)
    return items


@outer_app.get("/api/projects/{project_id}")
async def project(project_id: str, user=Depends(base.hosted_get_current_user)):
    items, _ = await scoped_projects_and_tasks(user)
    match = next((item for item in items if str(item.get("id")) == project_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="المشروع غير موجود أو غير مشترك معك")
    return match


@outer_app.get("/api/tasks")
async def tasks(project_id: str | None = None, user=Depends(base.hosted_get_current_user)):
    _, items = await scoped_projects_and_tasks(user)
    return [item for item in items if not project_id or str(item.get("project_id")) == project_id]


@outer_app.get("/api/dashboard")
async def dashboard(user=Depends(base.hosted_get_current_user)):
    projects, tasks = await scoped_projects_and_tasks(user)
    return index_module._dashboard_payload(projects, tasks)


@outer_app.get("/api/meetings")
@outer_app.get("/api/office/meetings")
async def meetings(user=Depends(base.hosted_get_current_user)):
    return await scoped_meetings(user)


@outer_app.get("/api/calendar")
async def calendar(user=Depends(base.hosted_get_current_user)):
    return await scoped_calendar(user)


@outer_app.get("/api/meeting-requests")
@outer_app.get("/api/araak-ceo/meeting-requests")
async def meeting_requests(user=Depends(base.hosted_get_current_user)):
    return await scoped_requests(user)


@outer_app.get("/api/notifications")
async def notifications(user=Depends(base.hosted_get_current_user)):
    return await scoped_notifications(user)


@outer_app.get("/api/documents")
async def documents(user=Depends(base.hosted_get_current_user)):
    access_policy.require_module(user, "documents")
    records, _ = await office_gateway.document_records(core, odoo_server, {**user, "role": "admin"})
    if access_policy.is_full_access(user):
        return records
    identity = await access_policy.resolve_odoo_identity(odoo_server, user)
    return [item for item in records if item.get("is_public") or item.get("uploaded_by") in identity["user_ids"]]


@outer_app.get("/api/hr/overview")
async def hr_overview(user=Depends(base.hosted_get_current_user)):
    return await hr_payload(user)


@outer_app.get("/api/hr/employees")
async def hr_employees(user=Depends(base.hosted_get_current_user)):
    payload = await hr_payload(user)
    return {"source": payload["source"], "employees": payload["employees"], "total": len(payload["employees"]), "warning": payload["warning"], "compensation_visible": True}


@outer_app.get("/api/reports/daily-executive")
async def daily_report(user=Depends(base.hosted_get_current_user)):
    if not access_policy.is_full_access(user):
        raise HTTPException(status_code=403, detail="الموجز التنفيذي الكامل مخصص للرئيس التنفيذي ومدير المنصة")
    return await base.hosted_daily_report(user)


@outer_app.get("/api/odoo/status")
async def odoo_status(user=Depends(base.hosted_get_current_user)):
    if not access_policy.is_full_access(user):
        raise HTTPException(status_code=403, detail="تكامل Odoo مخصص للرئيس التنفيذي ومدير المنصة")
    return await odoo_server.get_odoo_connector().status(check=False)


@outer_app.get("/api/odoo/projects")
async def direct_projects(limit: int = Query(default=500, ge=1, le=2000), user=Depends(base.hosted_get_current_user)):
    if not access_policy.is_full_access(user):
        raise HTTPException(status_code=403, detail="غير مصرح")
    return (await index_module._operational_bundle(user))[0][:limit]


@outer_app.get("/api/odoo/tasks")
async def direct_tasks(limit: int = Query(default=1500, ge=1, le=5000), user=Depends(base.hosted_get_current_user)):
    if not access_policy.is_full_access(user):
        raise HTTPException(status_code=403, detail="غير مصرح")
    return (await index_module._operational_bundle(user))[1][:limit]


new_routes = outer_app.router.routes[route_marker:]
old_routes = outer_app.router.routes[:route_marker]
outer_app.router.routes[:] = new_routes + old_routes


@outer_app.middleware("http")
async def least_privilege_write_guard(request: Request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        path = request.url.path
        safe_prefixes = (
            "/api/auth/", "/api/meeting-requests", "/api/araak-ceo/meeting-requests",
            "/api/messages", "/api/araak-ceo/messages", "/api/theme",
        )
        sensitive_prefixes = (
            "/api/projects", "/api/tasks", "/api/meetings", "/api/calendar",
            "/api/documents", "/api/hr/", "/api/users", "/api/odoo/",
            "/api/reports/", "/api/voice", "/api/settings",
        )
        if path.startswith(sensitive_prefixes) and not path.startswith(safe_prefixes):
            try:
                user = await base.hosted_get_current_user(request)
            except HTTPException as exc:
                return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
            if not access_policy.is_full_access(user):
                return JSONResponse({"detail": "التعديل على السجلات المركزية متاح للرئيس التنفيذي ومدير المنصة فقط"}, status_code=403)
    return await call_next(request)


app = base.UnifiedApiGateway(outer_app)
