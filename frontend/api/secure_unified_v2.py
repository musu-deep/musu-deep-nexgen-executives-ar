from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, Request
from fastapi.responses import JSONResponse

import api.secure_unified as secure
from api.backend import access_policy

outer_app = secure.outer_app
core = secure.core
index_module = secure.index_module
odoo_server = secure.odoo_server

route_marker = len(outer_app.router.routes)


async def _local_fallback_bundle(
    user: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Keep the executive workspace available when Odoo is unreachable.

    The hosted operational source may be an expiring API key, a temporary tunnel,
    or a remote Odoo instance. None of those failures should take down the CEO
    dashboard. Local embedded records are therefore the guaranteed fallback.
    """
    admin_scope = {**user, "role": "admin"}
    try:
        projects = await odoo_server._mongo_projects(admin_scope)
        tasks = await odoo_server._mongo_tasks(admin_scope)
        projects, tasks = index_module._enrich_bundle(projects, tasks)
    except Exception:
        projects, tasks = [], []

    for item in projects:
        item["source"] = item.get("source") or "platform-fallback"
        item["source_warning"] = (
            "تعذر الاتصال بمصدر Odoo؛ تم عرض النسخة المحلية الاحتياطية."
        )
    for item in tasks:
        item["source"] = item.get("source") or "platform-fallback"
        item["source_warning"] = (
            "تعذر الاتصال بمصدر Odoo؛ تم عرض النسخة المحلية الاحتياطية."
        )

    if access_policy.is_full_access(user):
        return projects, tasks

    direct_tasks = [
        task
        for task in tasks
        if access_policy.local_record_visible(task, user, "task")
        or secure._functional_match(task, user)
    ]
    linked_project_ids = {
        str(task.get("project_id") or "")
        for task in direct_tasks
        if task.get("project_id")
    }
    visible_projects = [
        project
        for project in projects
        if access_policy.local_record_visible(project, user, "project")
        or str(project.get("id") or "") in linked_project_ids
        or secure._functional_match(project, user)
    ]
    visible_project_ids = {
        str(project.get("id") or "") for project in visible_projects
    }
    visible_tasks = [
        task
        for task in tasks
        if task in direct_tasks
        or str(task.get("project_id") or "") in visible_project_ids
    ]
    return visible_projects, visible_tasks


async def resilient_projects_and_tasks(
    user: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    try:
        return await secure.scoped_projects_and_tasks(user)
    except Exception:
        return await _local_fallback_bundle(user)


@outer_app.get("/api/projects")
async def resilient_projects(user=Depends(secure.base.hosted_get_current_user)):
    projects, _ = await resilient_projects_and_tasks(user)
    return projects


@outer_app.get("/api/projects/{project_id}")
async def resilient_project(
    project_id: str,
    user=Depends(secure.base.hosted_get_current_user),
):
    projects, _ = await resilient_projects_and_tasks(user)
    match = next(
        (item for item in projects if str(item.get("id")) == project_id),
        None,
    )
    if not match:
        raise HTTPException(
            status_code=404,
            detail="المشروع غير موجود أو غير متاح ضمن نطاقك",
        )
    return match


@outer_app.get("/api/tasks")
async def resilient_tasks(
    project_id: str | None = None,
    user=Depends(secure.base.hosted_get_current_user),
):
    _, tasks = await resilient_projects_and_tasks(user)
    return [
        item
        for item in tasks
        if not project_id or str(item.get("project_id")) == project_id
    ]


@outer_app.get("/api/dashboard")
async def resilient_dashboard(user=Depends(secure.base.hosted_get_current_user)):
    projects, tasks = await resilient_projects_and_tasks(user)
    payload = index_module._dashboard_payload(projects, tasks)
    live_odoo = any(
        item.get("source") == "odoo" for item in [*projects, *tasks]
    )
    payload["source"] = "odoo" if live_odoo else "platform-fallback"
    payload["warning"] = (
        None
        if live_odoo
        else "مصدر Odoo غير متاح حاليًا؛ المؤشرات مبنية على النسخة المحلية الاحتياطية."
    )
    return payload


@outer_app.get("/api/operational/status")
async def operational_status(user=Depends(secure.base.hosted_get_current_user)):
    if not access_policy.is_full_access(user):
        raise HTTPException(
            status_code=403,
            detail="حالة مصادر البيانات مخصصة للرئيس التنفيذي ومدير المنصة",
        )
    connector = odoo_server.get_odoo_connector(refresh=True)
    checked = await connector.status(check=True)
    return {
        **checked,
        "fallback_enabled": True,
        "dashboard_available_without_odoo": True,
    }


@outer_app.get("/api/users")
async def users(user=Depends(secure.base.hosted_get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="إدارة المستخدمين متاحة لمدير المنصة فقط",
        )
    return await core.db.users.find(
        {}, {"_id": 0, "password_hash": 0}
    ).sort("name", 1).to_list(1000)


@outer_app.get("/api/notification-settings")
async def notification_settings(user=Depends(secure.base.hosted_get_current_user)):
    if not access_policy.is_full_access(user):
        raise HTTPException(
            status_code=403,
            detail="إعدادات النظام مخصصة للرئيس التنفيذي ومدير المنصة",
        )
    settings = await core.db.notification_settings.find_one({}, {"_id": 0})
    return settings or {
        "in_app_enabled": True,
        "email_enabled": False,
        "whatsapp_enabled": False,
        "events": {},
    }


new_routes = outer_app.router.routes[route_marker:]
old_routes = outer_app.router.routes[:route_marker]
outer_app.router.routes[:] = new_routes + old_routes


@outer_app.middleware("http")
async def restricted_read_guard(request: Request, call_next):
    path = request.url.path
    restricted_prefixes = (
        "/api/users",
        "/api/notification-settings",
        "/api/admin",
        "/api/voice",
        "/api/reports",
        "/api/odoo",
    )
    if request.method == "GET" and path.startswith(restricted_prefixes):
        try:
            user = await secure.base.hosted_get_current_user(request)
        except HTTPException as exc:
            return JSONResponse(
                {"detail": exc.detail}, status_code=exc.status_code
            )
        if path.startswith("/api/users"):
            allowed = user.get("role") == "admin"
        else:
            allowed = access_policy.is_full_access(user)
        if not allowed:
            return JSONResponse(
                {"detail": "غير مصرح بالوصول إلى هذه البيانات"},
                status_code=403,
            )
    return await call_next(request)


app = secure.base.UnifiedApiGateway(outer_app)
