from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from urllib.parse import parse_qs

from fastapi import Depends, HTTPException

import api.index as index_module

DEMO_PASSWORD = index_module.DEMO_PASSWORD
USERS = index_module.USERS
core = index_module.core
outer_app = index_module.app
mounted_app = index_module.backend_app
core_app = core.app


HOSTED_USER_PROFILES = {
    profile["email"].strip().lower(): {
        **profile,
        "email": profile["email"].strip().lower(),
        "id": f"vercel_usr_{index:02d}",
        "active": True,
    }
    for index, profile in enumerate(USERS, start=1)
}

_directory_ready = False
_directory_lock = asyncio.Lock()
_password_hash: str | None = None


async def ensure_hosted_directory() -> None:
    """Seed deterministic users in every Vercel cold instance."""
    global _directory_ready, _password_hash
    if _directory_ready:
        return

    async with _directory_lock:
        if _directory_ready:
            return

        if _password_hash is None:
            _password_hash = core.hash_password(DEMO_PASSWORD)

        for email, stable_profile in HOSTED_USER_PROFILES.items():
            database_profile = {
                **stable_profile,
                "email": email,
                "password_hash": _password_hash,
            }
            existing = await core.db.users.find_one({"email": email})
            if existing:
                await core.db.users.update_one(
                    {"email": email},
                    {"$set": database_profile},
                )
            else:
                await core.db.users.insert_one(
                    {
                        **database_profile,
                        "created_at": core.now_iso(),
                    }
                )

        _directory_ready = True


async def hosted_get_current_user(request):
    """Validate a signed session without relying on one serverless instance."""
    token = request.cookies.get("access_token")
    if not token:
        authorization = request.headers.get("Authorization", "")
        if authorization.startswith("Bearer "):
            token = authorization[7:].strip()

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = core.pyjwt.decode(
            token,
            core.JWT_SECRET,
            algorithms=[core.JWT_ALGORITHM],
        )
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")

        email = str(payload.get("email") or "").strip().lower()
        hosted_profile = HOSTED_USER_PROFILES.get(email)
        if hosted_profile:
            return dict(hosted_profile)

        user = None
        if email:
            user = await core.db.users.find_one(
                {"email": email},
                {"_id": 0, "password_hash": 0},
            )
        if not user and payload.get("sub"):
            user = await core.db.users.find_one(
                {"id": payload.get("sub")},
                {"_id": 0, "password_hash": 0},
            )
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.get("active", True):
            raise HTTPException(status_code=403, detail="User inactive")
        return user
    except core.pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except core.pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# The hosted stack has three FastAPI layers. Every protected route uses the
# same stateless verifier.
outer_app.dependency_overrides[core.get_current_user] = hosted_get_current_user
mounted_app.dependency_overrides[core.get_current_user] = hosted_get_current_user
core_app.dependency_overrides[core.get_current_user] = hosted_get_current_user


async def visible_projects_and_tasks(user: dict):
    visibility = core.role_sector_filter(user.get("role", "")) or {}
    projects = await core.db.projects.find(visibility, {"_id": 0}).to_list(500)
    tasks = await core.db.tasks.find(visibility, {"_id": 0}).to_list(2000)
    for project in projects:
        project["rag"] = core.calc_rag(project)
    return projects, tasks


def parse_datetime(value):
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


async def safe_items(collection_name: str, query: dict | None = None, limit: int = 100):
    try:
        collection = getattr(core.db, collection_name)
        return await collection.find(query or {}, {"_id": 0}).to_list(limit)
    except Exception:
        return []


# These two aggregation endpoints are registered after the index module has
# mounted its catch-all application. Move them to the beginning of the route
# table so the catch-all mount cannot swallow them.
route_marker = len(outer_app.router.routes)


@outer_app.get("/api/dashboard")
async def hosted_dashboard(user=Depends(hosted_get_current_user)):
    projects, tasks = await visible_projects_and_tasks(user)
    now = datetime.now(timezone.utc)
    rag = {"red": 0, "amber": 0, "green": 0, "gray": 0}
    sector_totals: dict[str, dict[str, float]] = {}
    task_status: dict[str, int] = {}
    overdue = 0

    for project in projects:
        state = project.get("rag", "gray")
        rag[state] = rag.get(state, 0) + 1
        sector = project.get("sector", "corporate")
        sector_totals.setdefault(sector, {"count": 0, "progress": 0})
        sector_totals[sector]["count"] += 1
        sector_totals[sector]["progress"] += project.get("progress", 0) or 0

    for task in tasks:
        status = task.get("status", "pending")
        task_status[status] = task_status.get(status, 0) + 1
        if status in ("completed", "cancelled") or not task.get("due_date"):
            continue
        try:
            if parse_datetime(task["due_date"]) < now:
                overdue += 1
        except (TypeError, ValueError):
            continue

    sectors = [
        {
            "sector": sector,
            "count": int(values["count"]),
            "avg_progress": round(values["progress"] / max(values["count"], 1)),
        }
        for sector, values in sector_totals.items()
    ]
    avg_progress = round(
        sum(project.get("progress", 0) or 0 for project in projects)
        / max(len(projects), 1)
    )

    return {
        "totals": {
            "projects": len(projects),
            "active_projects": sum(1 for item in projects if item.get("status") == "active"),
            "completed_projects": sum(1 for item in projects if item.get("status") == "completed"),
            "tasks": len(tasks),
            "overdue_tasks": overdue,
            "avg_progress": avg_progress,
            "total_budget": sum(item.get("budget", 0) or 0 for item in projects),
        },
        "rag": rag,
        "by_sector": sectors,
        "task_status": task_status,
        "recent_projects": sorted(
            projects,
            key=lambda item: str(item.get("updated_at", "")),
            reverse=True,
        )[:5],
        "generated_at": core.now_iso(),
    }


@outer_app.get("/api/reports/daily-executive")
async def hosted_daily_report(user=Depends(hosted_get_current_user)):
    projects, tasks = await visible_projects_and_tasks(user)
    now = datetime.now(timezone.utc)
    meetings = await safe_items("meetings", limit=200)
    pending_requests = await safe_items("meeting_requests", {"status": "pending"}, 50)
    pending_voice = await safe_items("voice_directives", {"applied": False}, 20)

    today_meetings = []
    for meeting in meetings:
        try:
            if parse_datetime(meeting.get("date")) .date() == now.date():
                today_meetings.append(meeting)
        except (TypeError, ValueError):
            continue

    overdue_tasks = []
    for task in tasks:
        if task.get("status") in ("completed", "cancelled") or not task.get("due_date"):
            continue
        try:
            if parse_datetime(task["due_date"]) < now:
                overdue_tasks.append(task)
        except (TypeError, ValueError):
            continue

    critical_projects = [item for item in projects if item.get("rag") == "red"]
    average_progress = round(
        sum(item.get("progress", 0) or 0 for item in projects)
        / max(len(projects), 1)
    )
    summary = (
        f"يتضمن موجز اليوم {len(projects)} مشروعًا و{len(tasks)} مهمة. "
        f"هناك {len(critical_projects)} مشروعًا حرجًا و{len(overdue_tasks)} مهمة متأخرة، "
        f"مع {len(pending_requests)} طلب اجتماع بانتظار القرار. "
        "الأولوية التنفيذية هي معالجة عناصر الخطر وتثبيت المسؤوليات وإغلاق المتابعات المتأخرة."
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


new_routes = outer_app.router.routes[route_marker:]
old_routes = outer_app.router.routes[:route_marker]
outer_app.router.routes[:] = new_routes + old_routes


@outer_app.on_event("startup")
async def stabilize_hosted_users_on_startup() -> None:
    await ensure_hosted_directory()


class UnifiedApiGateway:
    def __init__(self, target):
        self.target = target

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            await ensure_hosted_directory()

            query = parse_qs(scope.get("query_string", b"").decode("utf-8"))
            route = (query.get("route") or [""])[0].strip("/")
            if route:
                rewritten = dict(scope)
                path = f"/api/{route}"
                rewritten["path"] = path
                rewritten["raw_path"] = path.encode("utf-8")
                scope = rewritten

        await self.target(scope, receive, send)


app = UnifiedApiGateway(outer_app)
