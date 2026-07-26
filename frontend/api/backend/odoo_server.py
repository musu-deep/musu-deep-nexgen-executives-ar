"""Odoo-aware API wrapper.

This layer keeps the existing Arabic application intact while allowing the
operational GET endpoints to read from Mongo, Odoo, or both. Existing write
routes continue to be handled by the core application.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import Depends, FastAPI, HTTPException, Query

try:
    from .arabic_server import app as core_app
    from .odoo_connector import OdooConnectorError, get_odoo_connector
    from .server import calc_rag, db, get_current_user, require_roles, role_sector_filter
except ImportError:  # pragma: no cover - local script mode
    from arabic_server import app as core_app
    from odoo_connector import OdooConnectorError, get_odoo_connector
    from server import calc_rag, db, get_current_user, require_roles, role_sector_filter


app = FastAPI(
    title="NEXGEN EXECUTIVES — Odoo Gateway",
    description="طبقة التكامل التشغيلي مع Odoo",
)


def _source_mode() -> str:
    value = os.getenv("OPERATIONAL_DATA_SOURCE", "mongo").strip().lower()
    return value if value in {"mongo", "odoo", "hybrid"} else "mongo"


def _allowed_for_user(item: dict[str, Any], user: dict[str, Any]) -> bool:
    rule = role_sector_filter(user.get("role"))
    if rule is None:
        return True
    expected = rule.get("sector") if isinstance(rule, dict) else None
    sector = item.get("sector")
    if isinstance(expected, dict) and "$in" in expected:
        return sector in expected["$in"]
    return bool(expected and sector == expected)


def _merge_items(primary: list[dict[str, Any]], secondary: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for item in [*secondary, *primary]:
        key = str(item.get("id") or item.get("_id") or "")
        if key:
            merged[key] = item
    return list(merged.values())


async def _mongo_projects(user: dict[str, Any]) -> list[dict[str, Any]]:
    flt = role_sector_filter(user["role"]) or {}
    projects = await db.projects.find(flt, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for project in projects:
        project["rag"] = calc_rag(project)
        project.setdefault("source", "mongo")
    return projects


async def _mongo_tasks(user: dict[str, Any], project_id: Optional[str] = None) -> list[dict[str, Any]]:
    flt = role_sector_filter(user["role"]) or {}
    if project_id:
        flt["project_id"] = project_id
    tasks = await db.tasks.find(flt, {"_id": 0}).sort("created_at", -1).to_list(3000)
    for task in tasks:
        task.setdefault("source", "mongo")
    return tasks


async def _odoo_projects(user: dict[str, Any], limit: int = 1000) -> list[dict[str, Any]]:
    connector = get_odoo_connector()
    projects = await connector.projects(limit=limit)
    for project in projects:
        project["rag"] = calc_rag(project)
    return [project for project in projects if _allowed_for_user(project, user)]


async def _odoo_tasks(
    user: dict[str, Any],
    project_id: Optional[str] = None,
    limit: int = 3000,
) -> list[dict[str, Any]]:
    connector = get_odoo_connector()
    tasks = await connector.tasks(limit=limit)
    tasks = [task for task in tasks if _allowed_for_user(task, user)]
    if project_id:
        tasks = [task for task in tasks if task.get("project_id") == project_id]
    return tasks


async def operational_projects(user: dict[str, Any]) -> list[dict[str, Any]]:
    mode = _source_mode()
    if mode == "mongo":
        return await _mongo_projects(user)
    try:
        odoo_items = await _odoo_projects(user)
    except Exception as exc:
        if mode == "odoo":
            raise HTTPException(status_code=503, detail=f"تعذر قراءة مشروعات Odoo: {exc}") from exc
        odoo_items = []
    if mode == "odoo":
        return odoo_items
    mongo_items = await _mongo_projects(user)
    return _merge_items(odoo_items, mongo_items)


async def operational_tasks(
    user: dict[str, Any],
    project_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    mode = _source_mode()
    if mode == "mongo":
        return await _mongo_tasks(user, project_id)
    try:
        odoo_items = await _odoo_tasks(user, project_id)
    except Exception as exc:
        if mode == "odoo":
            raise HTTPException(status_code=503, detail=f"تعذر قراءة مهام Odoo: {exc}") from exc
        odoo_items = []
    if mode == "odoo":
        return odoo_items
    mongo_items = await _mongo_tasks(user, project_id)
    return _merge_items(odoo_items, mongo_items)


@app.get("/api/odoo/status")
async def odoo_status(user=Depends(get_current_user)):
    return await get_odoo_connector().status(check=False)


@app.post("/api/odoo/test")
async def odoo_test(user=Depends(require_roles("admin", "ceo"))):
    return await get_odoo_connector(refresh=True).status(check=True)


@app.get("/api/odoo/projects")
async def direct_odoo_projects(
    limit: int = Query(default=500, ge=1, le=2000),
    user=Depends(get_current_user),
):
    try:
        return await _odoo_projects(user, limit=limit)
    except OdooConnectorError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/odoo/tasks")
async def direct_odoo_tasks(
    limit: int = Query(default=1500, ge=1, le=5000),
    project_id: Optional[str] = None,
    user=Depends(get_current_user),
):
    try:
        return await _odoo_tasks(user, project_id=project_id, limit=limit)
    except OdooConnectorError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/projects")
async def list_operational_projects(user=Depends(get_current_user)):
    return await operational_projects(user)


@app.get("/api/projects/{project_id}")
async def get_operational_project(project_id: str, user=Depends(get_current_user)):
    projects = await operational_projects(user)
    project = next((item for item in projects if str(item.get("id")) == project_id), None)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.get("/api/tasks")
async def list_operational_tasks(
    project_id: Optional[str] = None,
    user=Depends(get_current_user),
):
    return await operational_tasks(user, project_id)


@app.get("/api/dashboard")
async def operational_dashboard(user=Depends(get_current_user)):
    projects = await operational_projects(user)
    tasks = await operational_tasks(user)

    rag_count = {"red": 0, "amber": 0, "green": 0, "gray": 0}
    for project in projects:
        project["rag"] = project.get("rag") or calc_rag(project)
        rag_count[project["rag"]] = rag_count.get(project["rag"], 0) + 1

    by_sector: dict[str, dict[str, int]] = {}
    for project in projects:
        sector = project.get("sector", "corporate")
        by_sector.setdefault(sector, {"count": 0, "progress_sum": 0})
        by_sector[sector]["count"] += 1
        by_sector[sector]["progress_sum"] += int(project.get("progress", 0) or 0)

    task_status: dict[str, int] = {}
    overdue = 0
    now = datetime.now(timezone.utc)
    for task in tasks:
        status = task.get("status", "pending")
        task_status[status] = task_status.get(status, 0) + 1
        if status in {"completed", "cancelled"} or not task.get("due_date"):
            continue
        try:
            due = datetime.fromisoformat(str(task["due_date"]).replace("Z", "+00:00"))
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
            if due < now:
                overdue += 1
        except (TypeError, ValueError):
            pass

    total_progress = sum(int(project.get("progress", 0) or 0) for project in projects)
    return {
        "source": _source_mode(),
        "totals": {
            "projects": len(projects),
            "active_projects": sum(1 for project in projects if project.get("status") == "active"),
            "completed_projects": sum(1 for project in projects if project.get("status") == "completed"),
            "tasks": len(tasks),
            "overdue_tasks": overdue,
            "avg_progress": round(total_progress / max(len(projects), 1)),
            "total_budget": sum(float(project.get("budget", 0) or 0) for project in projects),
        },
        "rag": rag_count,
        "by_sector": [
            {
                "sector": sector,
                "count": values["count"],
                "avg_progress": round(values["progress_sum"] / max(values["count"], 1)),
            }
            for sector, values in by_sector.items()
        ],
        "task_status": task_status,
        "recent_projects": sorted(
            projects,
            key=lambda item: item.get("updated_at") or item.get("created_at") or "",
            reverse=True,
        )[:6],
    }


# All write routes and non-operational modules remain available from the core app.
app.mount("/", core_app)
