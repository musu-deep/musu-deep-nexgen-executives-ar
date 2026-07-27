from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException

import api.secure_unified_v2 as previous

secure = previous.secure
outer_app = previous.outer_app
access_policy = secure.access_policy
index_module = secure.index_module
odoo_server = secure.odoo_server

route_marker = len(outer_app.router.routes)


async def _mongo_fallback_bundle(user: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Return local embedded data when Odoo or its temporary gateway is unavailable."""
    admin_scope = {**user, "role": "admin"}
    projects = await odoo_server._mongo_projects(admin_scope)
    tasks = await odoo_server._mongo_tasks(admin_scope)
    projects, tasks = index_module._enrich_bundle(projects, tasks)

    for item in projects:
        item["source"] = item.get("source") or "platform-fallback"
        item["source_warning"] = "تعذر الاتصال بمصدر Odoo؛ تم عرض النسخة المحلية الاحتياطية."
    for item in tasks:
        item["source"] = item.get("source") or "platform-fallback"
        item["source_warning"] = "تعذر الاتصال بمصدر Odoo؛ تم عرض النسخة المحلية الاحتياطية."

    if access_policy.is_full_access(user):
        return projects, tasks

    visible_tasks = [
        task for task in tasks
        if access_policy.local_record_visible(task, user, "task")
        or secure._functional_match(task, user)
    ]
    linked_project_ids = {
        str(task.get("project_id") or "")
        for task in visible_tasks
        if task.get("project_id")
    }
    visible_projects = [
        project for project in projects
        if access_policy.local_record_visible(project, user, "project")
        or str(project.get("id") or "") in linked_project_ids
        or secure._functional_match(project, user)
    ]
    visible_project_ids = {str(project.get("id") or "") for project in visible_projects}
    visible_tasks = [
        task for task in tasks
        if task in visible_tasks or str(task.get("project_id") or "") in visible_project_ids
    ]
    return visible_projects, visible_tasks


async def resilient_projects_and_tasks(user: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    try:
        return await secure.scoped_projects_and_tasks(user)
    except Exception:
        return await _mongo_fallback_bundle(user)


@outer_app.get("/api/projects")
async def resilient_projects(user=Depends(secure.base.hosted_get_current_user)):
    projects, _ = await resilient_projects_and_tasks(user)
    return projects


@outer_app.get("/api/projects/{project_id}")
async def resilient_project(project_id: str, user=Depends(secure.base.hosted_get_current_user)):
    projects, _ = await resilient_projects_and_tasks(user)
    match = next((item for item in projects if str(item.get("id")) == project_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="المشروع غير موجود أو غير متاح ضمن نطاقك")
    return match


@outer_app.get("/api/tasks")
async def resilient_tasks(project_id: str | None = None, user=Depends(secure.base.hosted_get_current_user)):
    _, tasks = await resilient_projects_and_tasks(user)
    return [item for item in tasks if not project_id or str(item.get("project_id")) == project_id]


@outer_app.get("/api/dashboard")
async def resilient_dashboard(user=Depends(secure.base.hosted_get_current_user)):
    projects, tasks = await resilient_projects_and_tasks(user)
    payload = index_module._dashboard_payload(projects, tasks)
    payload["source"] = "odoo" if any(item.get("source") == "odoo" for item in [*projects, *tasks]) else "platform-fallback"
    payload["warning"] = None if payload["source"] == "odoo" else "مصدر Odoo غير متاح حاليًا؛ المؤشرات مبنية على النسخة المحلية الاحتياطية."
    return payload


@outer_app.get("/api/operational/status")
async def operational_status(user=Depends(secure.base.hosted_get_current_user)):
    if not access_policy.is_full_access(user):
        raise HTTPException(status_code=403, detail="حالة مصادر البيانات مخصصة للرئيس التنفيذي ومدير المنصة")
    connector = odoo_server.get_odoo_connector(refresh=True)
    checked = await connector.status(check=True)
    return {
        **checked,
        "fallback_enabled": True,
        "dashboard_available_without_odoo": True,
    }


new_routes = outer_app.router.routes[route_marker:]
old_routes = outer_app.router.routes[:route_marker]
outer_app.router.routes[:] = new_routes + old_routes

app = secure.base.UnifiedApiGateway(outer_app)
