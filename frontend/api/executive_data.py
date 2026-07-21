from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, HTTPException, Request

from api.unified import core, ensure_hosted_directory, hosted_get_current_user

app = FastAPI(title="ARAAK Executive Data API")


def parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


async def dashboard_payload(user: dict[str, Any]) -> dict[str, Any]:
    query = core.role_sector_filter(user.get("role", "")) or {}
    projects = await core.db.projects.find(query, {"_id": 0}).to_list(500)
    tasks = await core.db.tasks.find(query, {"_id": 0}).to_list(2000)

    for project in projects:
        project["rag"] = core.calc_rag(project)

    rag = {"red": 0, "amber": 0, "green": 0, "gray": 0}
    sector_values: dict[str, dict[str, float]] = {}
    for project in projects:
        rag_key = project.get("rag", "gray")
        rag[rag_key] = rag.get(rag_key, 0) + 1
        sector = project.get("sector", "other")
        sector_values.setdefault(sector, {"count": 0, "progress": 0})
        sector_values[sector]["count"] += 1
        sector_values[sector]["progress"] += float(project.get("progress", 0) or 0)

    task_status: dict[str, int] = {}
    overdue = 0
    now = datetime.now(timezone.utc)
    for task in tasks:
        status = task.get("status", "pending")
        task_status[status] = task_status.get(status, 0) + 1
        due = parse_datetime(task.get("due_date"))
        if due and due < now and status not in ("completed", "cancelled"):
            overdue += 1

    total_progress = sum(float(item.get("progress", 0) or 0) for item in projects)
    total_budget = sum(float(item.get("budget", 0) or 0) for item in projects)
    by_sector = [
        {
            "sector": sector,
            "count": int(values["count"]),
            "avg_progress": round(values["progress"] / max(values["count"], 1)),
        }
        for sector, values in sector_values.items()
    ]

    return {
        "totals": {
            "projects": len(projects),
            "active_projects": sum(1 for item in projects if item.get("status") == "active"),
            "completed_projects": sum(1 for item in projects if item.get("status") == "completed"),
            "tasks": len(tasks),
            "overdue_tasks": overdue,
            "avg_progress": round(total_progress / max(len(projects), 1)),
            "total_budget": total_budget,
        },
        "rag": rag,
        "by_sector": by_sector,
        "task_status": task_status,
        "recent_projects": sorted(
            projects,
            key=lambda item: str(item.get("updated_at") or item.get("created_at") or ""),
            reverse=True,
        )[:5],
    }


async def daily_payload(user: dict[str, Any]) -> dict[str, Any]:
    query = core.role_sector_filter(user.get("role", "")) or {}
    projects = await core.db.projects.find(query, {"_id": 0}).to_list(500)
    tasks = await core.db.tasks.find(query, {"_id": 0}).to_list(2000)
    meetings = await core.db.meetings.find({}, {"_id": 0}).to_list(200)
    pending_requests = await core.db.meeting_requests.find(
        {"status": "pending"}, {"_id": 0}
    ).to_list(50)
    pending_voice = await core.db.voice_directives.find(
        {"applied": False}, {"_id": 0}
    ).to_list(20)

    now = datetime.now(timezone.utc)
    for project in projects:
        project["rag"] = core.calc_rag(project)

    overdue_tasks = []
    for task in tasks:
        due = parse_datetime(task.get("due_date"))
        if due and due < now and task.get("status") not in ("completed", "cancelled"):
            overdue_tasks.append(task)

    today_meetings = []
    for meeting in meetings:
        meeting_date = parse_datetime(meeting.get("date"))
        if meeting_date and meeting_date.date() == now.date():
            today_meetings.append(meeting)

    critical_projects = [item for item in projects if item.get("rag") == "red"]
    average_progress = round(
        sum(float(item.get("progress", 0) or 0) for item in projects)
        / max(len(projects), 1)
    )

    summary = (
        f"يعرض الموجز اليوم {len(projects)} مشروعًا، منها {len(critical_projects)} مشروعًا حرجًا، "
        f"و{len(overdue_tasks)} مهمة متأخرة، و{len(pending_requests)} طلب اجتماع ينتظر القرار. "
        "الأولوية التنفيذية هي معالجة الحالات الحرجة وتثبيت المسؤوليات والمواعيد وإغلاق دوائر المتابعة المفتوحة."
    )

    return {
        "generated_at": core.now_iso(),
        "user": {"name": user.get("name"), "role": user.get("role")},
        "ai_summary": summary,
        "metrics": {
            "total_projects": len(projects),
            "active_projects": sum(1 for item in projects if item.get("status") == "active"),
            "critical_projects": len(critical_projects),
            "overdue_tasks": len(overdue_tasks),
            "today_meetings": len(today_meetings),
            "pending_requests": len(pending_requests),
            "pending_voice_directives": len(pending_voice),
            "avg_progress": average_progress,
        },
        "critical_projects": critical_projects[:10],
        "overdue_tasks": overdue_tasks[:15],
        "today_meetings": today_meetings,
        "pending_requests": pending_requests[:10],
        "pending_voice_directives": pending_voice[:5],
    }


@app.get("/api/executive_data")
@app.get("/executive_data")
async def executive_data(request: Request, view: str = "dashboard"):
    await ensure_hosted_directory()
    user = await hosted_get_current_user(request)
    if view == "dashboard":
        return await dashboard_payload(user)
    if view == "daily":
        return await daily_payload(user)
    raise HTTPException(status_code=400, detail="Unsupported executive data view")
