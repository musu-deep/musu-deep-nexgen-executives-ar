"""Vercel FastAPI entry point inside the configured frontend root."""
from __future__ import annotations

import hashlib
import hmac
import os
import re
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, Query, Request, Response
from pydantic import BaseModel

os.environ.setdefault("EMBEDDED_DATA_FILE", "/tmp/nexgen_executives_data.json")
os.environ.setdefault("DB_NAME", "nexgen_executives_vercel")
os.environ.setdefault(
    "JWT_SECRET",
    "nexgen-vercel-demo-secret-change-in-project-settings-2026",
)

# Import the embedded runtime first so Motor is patched before the core backend
# is loaded. Existing non-operational modules remain mounted as a fallback,
# while Vercel-sensitive reads are exposed explicitly at this top level.
from api.backend import embedded_server
from api.backend import odoo_server

core = embedded_server.core_server
backend_app = embedded_server.app
app = FastAPI(
    title="NEXGEN EXECUTIVES — Vercel",
    description="Hosted digital CEO office",
)

DEMO_PASSWORD = "".join(chr(value) for value in [69, 120, 101, 99, 65, 103, 101, 110, 116, 50, 48, 50, 54, 33])

USERS = [
    {"email": "admin@company.demo", "name": "مدير المنصة", "role": "admin", "title": "مدير المنصة التنفيذية", "department": "إدارة المنصة"},
    {"email": "ceo@company.demo", "name": "الرئيس التنفيذي", "role": "ceo", "title": "الرئيس التنفيذي", "department": "مكتب الرئيس التنفيذي"},
    {"email": "development@company.demo", "name": "نائب الرئيس التنفيذي للتنمية", "role": "vp_development", "title": "نائب الرئيس التنفيذي للتنمية", "department": "قطاع التنمية"},
    {"email": "investment@company.demo", "name": "نائب الرئيس التنفيذي للاستثمار", "role": "vp_investment", "title": "نائب الرئيس التنفيذي للاستثمار", "department": "قطاع الاستثمار"},
    {"email": "manager@company.demo", "name": "مدير وحدة الأعمال", "role": "dev_manager", "title": "مدير العمليات والتنفيذ", "department": "العمليات والتنفيذ"},
    {"email": "followup@company.demo", "name": "المتابعة التنفيذية", "role": "tracker", "title": "مسؤول المتابعة التنفيذية", "department": "مكتب الرئيس التنفيذي"},
    {"email": "secretariat@company.demo", "name": "خالد العوبثاني", "role": "tracker", "title": "مسؤول السكرتارية التنفيذية", "department": "السكرتارية التنفيذية"},
    {"email": "hr@company.demo", "name": "محمد السقاف", "role": "dev_manager", "title": "مسؤول الموارد البشرية", "department": "الموارد البشرية"},
    {"email": "finance@company.demo", "name": "محمد السيمت أبو إياد", "role": "dev_manager", "title": "المدير المالي", "department": "الإدارة المالية"},
    {"email": "quality@company.demo", "name": "عاصم الملاحمة", "role": "dev_manager", "title": "مدير التفتيش والرقابة والجودة", "department": "التفتيش والرقابة والجودة"},
    {"email": "steel.factory@company.demo", "name": "سامر الملاحمة", "role": "dev_manager", "title": "مدير مصنع الحديد", "department": "مصنع الحديد"},
    {"email": "commercial@company.demo", "name": "م. محمد شكاك", "role": "dev_manager", "title": "مسؤول المشتريات والمستودعات والشؤون التجارية", "department": "المشتريات والمستودعات"},
    {"email": "factory@company.demo", "name": "م. عبد الرحمن الحسام", "role": "dev_manager", "title": "مدير اراك الوطنية والمصنع", "department": "المصنع واراك الوطنية"},
    {"email": "technical.office@company.demo", "name": "م. إسلام محمد", "role": "dev_manager", "title": "مسؤول المكتب الفني", "department": "المكتب الفني"},
    {"email": "wholesale@company.demo", "name": "مدير مبيعات الجملة", "role": "dev_manager", "title": "مدير مبيعات الجملة", "department": "مبيعات الجملة"},
    {"email": "stores@company.demo", "name": "م. طه الأهدل", "role": "dev_manager", "title": "مدير اراك ستورز والتجارة الإلكترونية", "department": "اراك ستورز"},
]

GROUPS = [
    {
        "name": "الإدارات المساندة",
        "env": "GROUP_CODE_SUPPORT_HASH",
        "fallback": "fea8344c6c192a73125b6b1469b96dd2944ec2e6206e0dbab867e910da7ace17",
        "emails": ["hr@company.demo", "finance@company.demo", "quality@company.demo", "manager@company.demo"],
    },
]

SECTOR_LABELS = {
    "corporate": "الحوكمة والقيادة التنفيذية",
    "digital": "التقنية والتحول الرقمي",
    "development": "التنمية والاستشارات",
    "academy": "التعليم والتدريب",
    "arak_development": "التشغيل والصناعة والتجارة",
    "investment": "الاستثمار والشراكات الدولية",
}


class LoginPayload(BaseModel):
    email: str
    password: str


class GroupPayload(BaseModel):
    code: str


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in user.items() if key not in {"_id", "password_hash"}}


async def current_user_from_request(request: Request) -> dict[str, Any]:
    """Authenticate explicitly to avoid nested FastAPI dependency parsing on Vercel."""
    return await core.get_current_user(request)


async def ensure_users() -> None:
    password_hash = core.hash_password(DEMO_PASSWORD)
    for index, profile in enumerate(USERS, start=1):
        existing = await core.db.users.find_one({"email": profile["email"]})
        values = {
            **profile,
            "password_hash": password_hash,
            "active": True,
        }
        if existing:
            await core.db.users.update_one({"email": profile["email"]}, {"$set": values})
        else:
            await core.db.users.insert_one({
                "id": f"vercel_usr_{index:02d}",
                **values,
                "created_at": core.now_iso(),
            })


def _extract_marker(text: Any, marker: str) -> str:
    value = str(text or "")
    match = re.search(rf"{re.escape(marker)}\s*[:：]\s*([^\s<]+)", value, flags=re.IGNORECASE)
    return match.group(1).strip() if match else ""


def _extract_entity(text: Any) -> str:
    value = str(text or "")
    patterns = (
        r"الكيان المسؤول\s*[:：]\s*(.+?)(?=\s+القطاع التشغيلي|\s+رمز قطاع|\s+رمز المحفظة|$)",
        r"Entity\s*[:：]\s*(.+?)(?=\s+Sector|\s+Portfolio|$)",
    )
    for pattern in patterns:
        match = re.search(pattern, value, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip(" .،")
    return ""


def _normalise_sector(project: dict[str, Any]) -> str:
    existing = str(project.get("sector") or "").strip().lower()
    description = str(project.get("description") or "")
    marker = _extract_marker(description, "NEXGEN_SECTOR").lower()
    if marker in SECTOR_LABELS:
        return marker
    if existing in SECTOR_LABELS and existing != "corporate":
        return existing

    text = f"{project.get('name', '')} {description}".lower()
    aliases = (
        (("استثمار", "شراكات دولية", "investment"), "investment"),
        (("رقمي", "تقنية", "ذكاء مؤسسي", "digital"), "digital"),
        (("أكاديمية", "تعليم", "تدريب", "مدارس"), "academy"),
        (("تنمية", "استشارات", "محتوى مؤسسي", "مراقي"), "development"),
        (("مصنع", "إنتاج", "مخزون", "متجر", "ستورز", "لوجستيك", "مستودعات", "مقاولات", "عقار"), "arak_development"),
    )
    for tokens, sector in aliases:
        if any(token in text for token in tokens):
            return sector
    return existing if existing in SECTOR_LABELS else "corporate"


def _enrich_task(task: dict[str, Any]) -> dict[str, Any]:
    item = dict(task)
    stage = str(item.get("odoo_stage") or "").strip().lower()
    status = str(item.get("status") or "pending")
    progress = int(item.get("progress", 0) or 0)

    if any(token in stage for token in ("مكتمل", "منجز", "مغلق", "done", "completed", "closed")):
        status, progress = "completed", 100
    elif status == "delayed":
        progress = max(progress, 35)
    elif any(token in stage for token in ("مراجعة", "اعتماد", "review", "approval")):
        status, progress = "awaiting_approval", max(progress, 80)
    elif any(token in stage for token in ("بانتظار قرار", "انتظار", "waiting", "decision")):
        status, progress = "awaiting_approval", max(progress, 65)
    elif any(token in stage for token in ("قيد التنفيذ", "in progress", "progress")):
        status, progress = "in_progress", max(progress, 50)
    elif any(token in stage for token in ("جديد", "new", "todo")):
        status, progress = "pending", progress

    item["status"] = status
    item["progress"] = max(0, min(100, progress))
    return item


def _parse_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _enrich_bundle(
    projects: list[dict[str, Any]],
    tasks: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    enriched_projects = [dict(project) for project in projects]
    enriched_tasks = [_enrich_task(task) for task in tasks]

    by_project: dict[str, list[dict[str, Any]]] = {}
    sector_by_project: dict[str, str] = {}

    for project in enriched_projects:
        project["sector"] = _normalise_sector(project)
        project["sector_label"] = SECTOR_LABELS.get(project["sector"], project["sector"])
        entity = _extract_entity(project.get("description"))
        if entity:
            project["entity_name"] = entity
        sector_by_project[str(project.get("id"))] = project["sector"]
        by_project[str(project.get("id"))] = []

    for task in enriched_tasks:
        project_id = str(task.get("project_id") or "")
        by_project.setdefault(project_id, []).append(task)
        if project_id in sector_by_project:
            task["sector"] = sector_by_project[project_id]
            task["sector_label"] = SECTOR_LABELS.get(task["sector"], task["sector"])

    now = datetime.now(timezone.utc)
    for project in enriched_projects:
        linked = by_project.get(str(project.get("id")), [])
        if linked:
            project["task_count"] = len(linked)
            project["completed_task_count"] = sum(1 for task in linked if task.get("status") == "completed")
            project["delayed_task_count"] = sum(1 for task in linked if task.get("status") == "delayed")
            project["awaiting_decision_count"] = sum(1 for task in linked if task.get("status") == "awaiting_approval")
            project["progress"] = round(
                sum(int(task.get("progress", 0) or 0) for task in linked) / len(linked)
            )
            if project["completed_task_count"] == len(linked):
                project["status"] = "completed"
                project["progress"] = 100

        end_date = _parse_datetime(project.get("end_date"))
        overdue_project = bool(
            end_date and end_date < now and project.get("status") not in {"completed", "cancelled"}
        )
        if project.get("status") == "completed":
            rag = "green"
        elif project.get("status") == "cancelled":
            rag = "gray"
        elif overdue_project or project.get("delayed_task_count", 0) > 0:
            rag = "red"
        elif project.get("awaiting_decision_count", 0) > 0:
            rag = "amber"
        elif int(project.get("progress", 0) or 0) >= 70:
            rag = "green"
        else:
            rag = "amber"
        project["rag"] = rag

    return enriched_projects, enriched_tasks


async def _operational_bundle(user: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    projects = await odoo_server.operational_projects(user)
    tasks = await odoo_server.operational_tasks(user)
    return _enrich_bundle(projects, tasks)


def _dashboard_payload(
    projects: list[dict[str, Any]],
    tasks: list[dict[str, Any]],
) -> dict[str, Any]:
    rag_count = {"red": 0, "amber": 0, "green": 0, "gray": 0}
    by_sector: dict[str, dict[str, int]] = {}
    task_status: dict[str, int] = {}

    for project in projects:
        rag = str(project.get("rag") or "amber")
        rag_count[rag] = rag_count.get(rag, 0) + 1
        sector = str(project.get("sector") or "corporate")
        by_sector.setdefault(sector, {"count": 0, "progress_sum": 0})
        by_sector[sector]["count"] += 1
        by_sector[sector]["progress_sum"] += int(project.get("progress", 0) or 0)

    for task in tasks:
        status = str(task.get("status") or "pending")
        task_status[status] = task_status.get(status, 0) + 1

    total_progress = sum(int(project.get("progress", 0) or 0) for project in projects)
    return {
        "source": os.getenv("OPERATIONAL_DATA_SOURCE", "mongo").strip().lower(),
        "totals": {
            "projects": len(projects),
            "active_projects": sum(1 for project in projects if project.get("status") == "active"),
            "completed_projects": sum(1 for project in projects if project.get("status") == "completed"),
            "tasks": len(tasks),
            "overdue_tasks": sum(1 for task in tasks if task.get("status") == "delayed"),
            "avg_progress": round(total_progress / max(len(projects), 1)),
            "total_budget": sum(float(project.get("budget", 0) or 0) for project in projects),
        },
        "rag": rag_count,
        "by_sector": [
            {
                "sector": sector,
                "sector_label": SECTOR_LABELS.get(sector, sector),
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


@app.on_event("startup")
async def initialize_vercel_runtime() -> None:
    await embedded_server.initialize_embedded_runtime()
    await ensure_users()


@app.get("/api/health", include_in_schema=False)
@app.get("/health", include_in_schema=False)
async def health():
    return {
        "status": "ready",
        "service": "NEXGEN EXECUTIVES",
        "runtime": "vercel-python",
        "operational_gateway": "odoo-portfolio-intelligence",
    }


@app.post("/api/auth/login")
@app.post("/auth/login")
@app.post("/api/auth/finance-login")
@app.post("/auth/finance-login")
async def login(payload: LoginPayload, response: Response):
    email = payload.email.strip().lower()
    user = await core.db.users.find_one({"email": email})
    if not user or not core.verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="البريد الإلكتروني أو كلمة المرور غير صحيحة")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="حساب المستخدم غير نشط")
    access = core.create_access_token(user["id"], email, user["role"])
    refresh = core.create_refresh_token(user["id"])
    core.set_cookies(response, access, refresh)
    return {"user": public_user(user), "access_token": access}


@app.get("/api/auth/me")
@app.get("/auth/me")
async def me(request: Request):
    user = await current_user_from_request(request)
    return {"user": user}


@app.post("/api/auth/group-accounts")
@app.post("/auth/group-accounts")
async def group_accounts(payload: GroupPayload):
    normalized = "".join(character for character in str(payload.code) if character.isdigit())[:8]
    if len(normalized) < 4:
        raise HTTPException(status_code=400, detail="أدخل معرف المجموعة المكوّن من أربعة أرقام على الأقل")
    code_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    selected = None
    for group in GROUPS:
        configured = str(os.getenv(group["env"], group["fallback"])).strip()
        if hmac.compare_digest(configured, code_hash):
            selected = group
            break
    if not selected:
        raise HTTPException(status_code=404, detail="معرف المجموعة غير صحيح")
    profiles = {item["email"]: item for item in USERS}
    accounts = [
        {key: value for key, value in profiles[email].items() if key in {"email", "name", "title", "role", "department"}}
        for email in selected["emails"]
        if email in profiles
    ]
    return {"group": {"id": "support", "name": selected["name"]}, "accounts": accounts}


# ---------------------------------------------------------------------------
# Explicit Vercel-safe office reads
# ---------------------------------------------------------------------------

@app.get("/api/meetings")
async def meetings(request: Request):
    user = await current_user_from_request(request)
    query = (
        {}
        if user.get("role") in {"admin", "ceo", "tracker"}
        else {"$or": [{"attendee_ids": user["id"]}, {"organizer_id": user["id"]}]}
    )
    return await core.db.meetings.find(query, {"_id": 0}).sort("date", -1).to_list(500)


@app.get("/api/meeting-requests")
async def meeting_requests(request: Request):
    user = await current_user_from_request(request)
    query = (
        {}
        if user.get("role") in {"admin", "ceo", "tracker"}
        else {"requester_id": user["id"]}
    )
    return await core.db.meeting_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


# ---------------------------------------------------------------------------
# Odoo-aware operational overrides and portfolio intelligence
# ---------------------------------------------------------------------------

@app.get("/api/projects")
async def operational_projects(request: Request):
    user = await current_user_from_request(request)
    projects, _ = await _operational_bundle(user)
    return projects


@app.get("/api/projects/{project_id}")
async def operational_project(project_id: str, request: Request):
    user = await current_user_from_request(request)
    projects, _ = await _operational_bundle(user)
    project = next((item for item in projects if str(item.get("id")) == project_id), None)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.get("/api/tasks")
async def operational_tasks(request: Request, project_id: Optional[str] = None):
    user = await current_user_from_request(request)
    _, tasks = await _operational_bundle(user)
    if project_id:
        tasks = [task for task in tasks if str(task.get("project_id")) == project_id]
    return tasks


@app.get("/api/dashboard")
async def operational_dashboard(request: Request):
    user = await current_user_from_request(request)
    projects, tasks = await _operational_bundle(user)
    return _dashboard_payload(projects, tasks)


@app.get("/api/odoo/status")
async def odoo_status(request: Request):
    await current_user_from_request(request)
    return await odoo_server.get_odoo_connector().status(check=False)


@app.post("/api/odoo/test")
async def odoo_test(request: Request):
    user = await current_user_from_request(request)
    if user.get("role") not in {"admin", "ceo"}:
        raise HTTPException(status_code=403, detail="Permission denied")
    return await odoo_server.get_odoo_connector(refresh=True).status(check=True)


@app.get("/api/odoo/projects")
async def direct_odoo_projects(request: Request, limit: int = Query(default=500, ge=1, le=2000)):
    user = await current_user_from_request(request)
    try:
        projects = await odoo_server._odoo_projects(user, limit=limit)
        tasks = await odoo_server._odoo_tasks(user, limit=5000)
        enriched, _ = _enrich_bundle(projects, tasks)
        return enriched
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/odoo/tasks")
async def direct_odoo_tasks(
    request: Request,
    limit: int = Query(default=1500, ge=1, le=5000),
    project_id: Optional[str] = None,
):
    user = await current_user_from_request(request)
    try:
        projects = await odoo_server._odoo_projects(user, limit=2000)
        tasks = await odoo_server._odoo_tasks(user, project_id=project_id, limit=limit)
        _, enriched = _enrich_bundle(projects, tasks)
        return enriched
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/openapi.json", include_in_schema=False)
async def openapi_schema():
    return app.openapi()


# Keep all write routes and modules not explicitly handled above available.
app.mount("/", backend_app)
