from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------------- DB ----------------
mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.getenv('DB_NAME', 'ceo_office')]

JWT_ALGORITHM = 'HS256'
JWT_SECRET = os.getenv('JWT_SECRET', 'change-me-in-production')

# ---------------- App ----------------
app = FastAPI(title="NEXGENT EXECUTIVES Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://nexgen-executives.vercel.app",
        "https://www.nexgen-executives.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nexgen-executives")



# ---------------- Roles & Sectors ----------------
# Platform management is restricted to admin. Marketing & tenders has full read visibility and task distribution.
DEV_SECTORS = ["development", "arak_development", "academy", "digital", "corporate"]
GLOBAL_VIEW_ROLES = {"admin", "ceo", "tracker", "marketing_tenders"}
TASK_ASSIGN_ROLES = {"admin", "ceo", "tracker", "marketing_tenders"}


def role_sector_filter(role: str) -> Optional[dict]:
    """Return MongoDB filter for projects/tasks visibility. None means see-all."""
    if role in GLOBAL_VIEW_ROLES:
        return None
    if role == "vp_development":
        return {"sector": {"$in": DEV_SECTORS}}
    if role == "national_executive":
        return {"sector": {"$in": ["arak_development", "corporate"]}}
    if role == "finance":
        return {"sector": {"$in": ["investment", "corporate"]}}
    if role == "procurement":
        return {"sector": {"$in": ["arak_development", "corporate"]}}
    if role == "tech_supervisor":
        return {"sector": {"$in": ["digital", "corporate"]}}
    return {"_id": "__never__"}


def can_manage_users(role: str) -> bool:
    return role == "admin"


def can_assign_tasks(role: str) -> bool:
    return role in TASK_ASSIGN_ROLES

# ---------------- Password & JWT helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# ---------------- Auth Dependency ----------------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.get("active", True):
            raise HTTPException(status_code=403, detail="User inactive")
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_roles(*roles):
    async def _dep(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Permission denied")
        return user
    return _dep

# ---------------- Models ----------------
class LoginInput(BaseModel):
    email: EmailStr
    password: str

class PasswordChangeInput(BaseModel):
    current_password: str
    new_password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Literal["admin", "ceo", "vp_development", "national_executive", "tracker", "finance", "marketing_tenders", "procurement", "tech_supervisor"]
    title: Optional[str] = ""
    active: bool = True

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    title: Optional[str] = None
    active: Optional[bool] = None
    password: Optional[str] = None

class ProjectInput(BaseModel):
    name: str
    description: Optional[str] = ""
    sector: Literal["development", "investment", "arak_development", "academy", "digital", "corporate"]
    owner_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    progress: int = 0
    status: Literal["planning", "active", "on_hold", "completed", "cancelled"] = "active"
    budget: Optional[float] = 0
    priority: Literal["low", "medium", "high", "critical"] = "medium"

class TaskInput(BaseModel):
    title: str
    description: Optional[str] = ""
    project_id: Optional[str] = None
    sector: Literal["development", "investment", "arak_development", "academy", "digital", "corporate"]
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None
    priority: Literal["low", "medium", "high", "critical"] = "medium"
    status: Literal["pending", "in_progress", "awaiting_approval", "delayed", "completed", "cancelled"] = "pending"
    progress: int = 0

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None

class ProgressUpdateInput(BaseModel):
    project_id: str
    update_type: Literal["progress", "milestone", "issue", "report", "note"]
    content: str
    progress: Optional[int] = None

# ---------------- Helpers ----------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

def calc_rag(project: dict) -> str:
    if project.get("status") == "completed":
        return "green"
    if project.get("status") == "cancelled":
        return "gray"
    progress = project.get("progress", 0)
    end_date_str = project.get("end_date")
    if not end_date_str:
        if progress >= 70: return "green"
        if progress >= 40: return "amber"
        return "red"
    try:
        end_date = datetime.fromisoformat(end_date_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        days_left = (end_date - now).days
        if days_left < 0 and progress < 100:
            return "red"
        if days_left < 7 and progress < 80:
            return "amber"
        if progress >= 70:
            return "green"
        if progress >= 40:
            return "amber"
        return "red"
    except Exception:
        return "amber"

def set_cookies(response: Response, access: str, refresh: str):
    secure_cookies = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    same_site = os.getenv("COOKIE_SAMESITE", "lax")
    response.set_cookie("access_token", access, httponly=True, secure=secure_cookies,
                        samesite=same_site, max_age=12*3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=secure_cookies,
                        samesite=same_site, max_age=7*86400, path="/")

# ---------------- Auth Endpoints ----------------
@api_router.post("/auth/login")
async def login(payload: LoginInput, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail=" Invalid email or password")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="User account is inactive")
    access = create_access_token(user["id"], email, user["role"])
    refresh = create_refresh_token(user["id"])
    set_cookies(response, access, refresh)
    user_out = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    return {"user": user_out, "access_token": access}

@api_router.post("/auth/logout")
async def logout(response: Response, user=Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"user": user}

@api_router.post("/auth/change-password")
async def change_password(payload: PasswordChangeInput, response: Response, user=Depends(get_current_user)):
    stored = await db.users.find_one({"id": user["id"]})
    if not stored or not verify_password(payload.current_password, stored.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="كلمة المرور الحالية غير صحيحة")
    value = payload.new_password or ""
    if (len(value) < 10 or not any(c.isupper() for c in value)
            or not any(c.islower() for c in value) or not any(c.isdigit() for c in value)
            or value.isalnum()):
        raise HTTPException(
            status_code=422,
            detail="استخدم كلمة مرور من 10 خانات على الأقل تشمل حروفاً كبيرة وصغيرة ورقماً ورمزاً خاصاً",
        )
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "password_hash": hash_password(value),
            "must_change_password": False,
            "updated_at": now_iso(),
        }},
    )
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    access = create_access_token(updated["id"], updated["email"], updated["role"])
    refresh = create_refresh_token(updated["id"])
    set_cookies(response, access, refresh)
    return {"user": updated, "access_token": access}

# ---------------- Users (Admin) ----------------
@api_router.get("/users")
async def list_users(user=Depends(require_roles("admin"))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users

@api_router.post("/users")
async def create_user(payload: UserCreate, admin=Depends(require_roles("admin"))):
    raise HTTPException(
        status_code=410,
        detail="إنشاء حسابات إضافية متوقف؛ الدخول محصور في القائمة التنفيذية المخولة",
    )

@api_router.patch("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, admin=Depends(require_roles("admin"))):
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if "password" in updates:
        updates["password_hash"] = hash_password(updates.pop("password"))
    if not updates:
        return {"ok": True}
    await db.users.update_one({"id": user_id}, {"$set": updates})
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return u

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin=Depends(require_roles("admin"))):
    await db.users.update_one({"id": user_id}, {"$set": {"active": False}})
    return {"ok": True}

# ---------------- Projects ----------------
@api_router.get("/projects")
async def list_projects(user=Depends(get_current_user)):
    flt = role_sector_filter(user["role"]) or {}
    projects = await db.projects.find(flt, {"_id": 0}).sort("created_at", -1).to_list(500)
    for p in projects:
        p["rag"] = calc_rag(p)
    return projects

@api_router.get("/projects/{project_id}")
async def get_project(project_id: str, user=Depends(get_current_user)):
    p = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    flt = role_sector_filter(user["role"])
    if flt is not None and p.get("sector") not in (flt.get("sector", {}).get("$in", []) + [flt.get("sector")] if isinstance(flt.get("sector"), dict) else [flt.get("sector")]):
        # simpler check
        if "$in" in (flt.get("sector") or {}):
            if p.get("sector") not in flt["sector"]["$in"]:
                raise HTTPException(status_code=403, detail="Forbidden")
        elif flt.get("sector") and p.get("sector") != flt["sector"]:
            raise HTTPException(status_code=403, detail="Forbidden")
    p["rag"] = calc_rag(p)
    return p

@api_router.post("/projects")
async def create_project(payload: ProjectInput, user=Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["created_by"] = user["id"]
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    if not doc.get("owner_id"):
        doc["owner_id"] = user["id"]
    await db.projects.insert_one(doc)
    doc["rag"] = calc_rag(doc)
    doc.pop("_id", None)
    return doc

@api_router.patch("/projects/{project_id}")
async def update_project(project_id: str, payload: dict, user=Depends(get_current_user)):
    payload["updated_at"] = now_iso()
    await db.projects.update_one({"id": project_id}, {"$set": payload})
    p = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if p:
        p["rag"] = calc_rag(p)
    return p

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user=Depends(require_roles("admin", "ceo"))):
    await db.projects.delete_one({"id": project_id})
    await db.tasks.delete_many({"project_id": project_id})
    return {"ok": True}

# ---------------- Tasks ----------------
@api_router.get("/tasks")
async def list_tasks(user=Depends(get_current_user), project_id: Optional[str] = None):
    flt = role_sector_filter(user["role"]) or {}
    if project_id:
        flt["project_id"] = project_id
    tasks = await db.tasks.find(flt, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return tasks

@api_router.post("/tasks")
async def create_task(payload: TaskInput, user=Depends(get_current_user)):
    if payload.assignee_id and payload.assignee_id != user["id"] and not can_assign_tasks(user["role"]):
        raise HTTPException(status_code=403, detail="لا تملك صلاحية توزيع المهام على أعضاء الفريق")
    doc = payload.model_dump()
    if not doc.get("assignee_id"):
        doc["assignee_id"] = user["id"]
    doc["id"] = new_id()
    doc["created_by"] = user["id"]
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    await db.tasks.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.patch("/tasks/{task_id}")
async def update_task(task_id: str, payload: TaskUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if updates.get("assignee_id") and not can_assign_tasks(user["role"]):
        current = await db.tasks.find_one({"id": task_id}, {"_id": 0, "assignee_id": 1})
        if not current or updates["assignee_id"] != current.get("assignee_id"):
            raise HTTPException(status_code=403, detail="لا تملك صلاحية إعادة إسناد المهمة")
    updates["updated_at"] = now_iso()
    await db.tasks.update_one({"id": task_id}, {"$set": updates})
    t = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return t

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user=Depends(get_current_user)):
    await db.tasks.delete_one({"id": task_id})
    return {"ok": True}

@api_router.post("/tasks/{task_id}/approve")
async def approve_task(task_id: str, user=Depends(require_roles("admin", "ceo", "vp_development", "vp_investment"))):
    await db.tasks.update_one({"id": task_id}, {"$set": {"status": "completed", "approved_by": user["id"], "approved_at": now_iso(), "updated_at": now_iso()}})
    t = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    return t

# ---------------- Progress Updates ----------------
@api_router.get("/progress")
async def list_progress(user=Depends(get_current_user), project_id: Optional[str] = None):
    q = {"project_id": project_id} if project_id else {}
    items = await db.progress_updates.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api_router.post("/progress")
async def create_progress(payload: ProgressUpdateInput, user=Depends(get_current_user)):
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["user_id"] = user["id"]
    doc["user_name"] = user.get("name")
    doc["created_at"] = now_iso()
    await db.progress_updates.insert_one(doc)
    if payload.progress is not None:
        await db.projects.update_one({"id": payload.project_id}, {"$set": {"progress": payload.progress, "updated_at": now_iso()}})
    doc.pop("_id", None)
    return doc

# ---------------- Dashboard ----------------
@api_router.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    flt = role_sector_filter(user["role"]) or {}
    projects = await db.projects.find(flt, {"_id": 0}).to_list(500)
    tasks = await db.tasks.find(flt, {"_id": 0}).to_list(2000)

    for p in projects:
        p["rag"] = calc_rag(p)

    rag_count = {"red": 0, "amber": 0, "green": 0, "gray": 0}
    for p in projects:
        rag_count[p["rag"]] = rag_count.get(p["rag"], 0) + 1

    by_sector = {}
    for p in projects:
        s = p.get("sector", "other")
        by_sector.setdefault(s, {"count": 0, "progress_sum": 0})
        by_sector[s]["count"] += 1
        by_sector[s]["progress_sum"] += p.get("progress", 0)

    sector_stats = [
        {"sector": k, "count": v["count"], "avg_progress": round(v["progress_sum"]/max(v["count"], 1))}
        for k, v in by_sector.items()
    ]

    task_status = {}
    for t in tasks:
        s = t.get("status", "pending")
        task_status[s] = task_status.get(s, 0) + 1

    avg_progress = round(sum(p.get("progress", 0) for p in projects) / max(len(projects), 1))
    total_budget = sum(p.get("budget", 0) or 0 for p in projects)
    completed_projects = sum(1 for p in projects if p.get("status") == "completed")
    active_projects = sum(1 for p in projects if p.get("status") == "active")

    overdue = 0
    now = datetime.now(timezone.utc)
    for t in tasks:
        if t.get("status") in ("completed", "cancelled"):
            continue
        if t.get("due_date"):
            try:
                d = datetime.fromisoformat(t["due_date"].replace("Z", "+00:00"))
                if d < now:
                    overdue += 1
            except Exception:
                pass

    # progress timeline (last 8 weeks - synthesised from project updated_at)
    return {
        "totals": {
            "projects": len(projects),
            "active_projects": active_projects,
            "completed_projects": completed_projects,
            "tasks": len(tasks),
            "overdue_tasks": overdue,
            "avg_progress": avg_progress,
            "total_budget": total_budget,
        },
        "rag": rag_count,
        "by_sector": sector_stats,
        "task_status": task_status,
        "recent_projects": sorted(projects, key=lambda x: x.get("updated_at", ""), reverse=True)[:5],
    }

# ---------------- Seed ----------------
SEED_USERS = [
    {
        "id": "usr_admin",
        "email": "louiabdalla1@gmail.com",
        "password_hash": "$2b$12$uZGNAOTQsO7JlztHV5kx1.9IXNYDJ3JCFfPOE.b/ZI8nuNU9Ce5ua",
        "name": "مدير النظام",
        "role": "admin",
        "title": "مدير النظام والمنصة",
        "department": "إدارة المنصة",
        "clearance": "executive_secret",
        "capabilities": [
            "platform:admin",
            "platform:read_all",
            "tasks:assign",
            "tasks:distribute"
        ]
    },
    {
        "id": "usr_ceo",
        "email": "dr.ali@araak.org",
        "password_hash": "$2b$12$ZI5S2hxvJ6hA.vty5TdTf.ZSN9lElUx3XsFF6SUVAlZfOP0MpYdJy",
        "name": "د. علي العتيبي",
        "role": "ceo",
        "title": "الرئيس التنفيذي",
        "department": "مكتب الرئيس التنفيذي",
        "clearance": "executive_secret",
        "capabilities": [
            "platform:read_all",
            "tasks:assign",
            "tasks:distribute"
        ]
    },
    {
        "id": "usr_dev",
        "email": "sa.dc.1@araak.org",
        "password_hash": "$2b$12$xcib/aR3CMXrSmcajh3SjOIDn2k.LPeoUbS5cPmc.LHakAsGgS.NS",
        "name": "د. لؤي عبد الله",
        "role": "vp_development",
        "title": "نائب الرئيس التنفيذي للتنمية",
        "department": "الإدارة العليا",
        "clearance": "confidential",
        "capabilities": []
    },
    {
        "id": "usr_national",
        "email": "a.alhusam@araak.net",
        "password_hash": "$2b$12$erRsSru4CYNAvfYg0lIcOO/d6K1CPPstoogVgWVrLdmZ0W7bLvoYa",
        "name": "م. عبد الرحمن الحسام",
        "role": "national_executive",
        "title": "المدير التنفيذي لشركة اراك الوطنية",
        "department": "اراك الوطنية",
        "clearance": "confidential",
        "capabilities": []
    },
    {
        "id": "usr_followup",
        "email": "a.alotaibi@araak.org",
        "password_hash": "$2b$12$QQi/ejb.6cD6UiCe520TNu4K1ngFodwVv3hqbSi8U00kLSSOXt80e",
        "name": "م. عبد الله العتيبي",
        "role": "tracker",
        "title": "الإشراف والمتابعة",
        "department": "مكتب الرئيس التنفيذي",
        "clearance": "confidential",
        "capabilities": [
            "platform:read_all",
            "tasks:assign"
        ]
    },
    {
        "id": "usr_finance",
        "email": "fm@araak.org",
        "password_hash": "$2b$12$tfXabYiHRg1W6qjVrpnMCeZtMbt9BoZ438YnJdssc2RF7TwAZ81Zu",
        "name": "أبو إياد",
        "role": "finance",
        "title": "المدير المالي",
        "department": "الإدارة المالية",
        "clearance": "financial_sensitive",
        "capabilities": []
    },
    {
        "id": "usr_marketing",
        "email": "scm@araak.org",
        "password_hash": "$2b$12$FwlNlc0QfplckzqOCzRrJ.ZstjcD36RWLrvrvU0Dk7Wd6yquOuqHG",
        "name": "أ. محمود عوض",
        "role": "marketing_tenders",
        "title": "مسؤول منصة التسويق والمناقصات",
        "department": "التسويق والمناقصات",
        "clearance": "confidential",
        "capabilities": [
            "platform:read_all",
            "tasks:assign",
            "tasks:distribute"
        ]
    },
    {
        "id": "usr_procurement",
        "email": "contracting@araak.org",
        "password_hash": "$2b$12$k0WPYcMZJRy.8Y4WI/U5ie5zaG1AVe2lWmwI9MHw8PJn6gYI55sXu",
        "name": "محمد شكاك",
        "role": "procurement",
        "title": "المشتريات",
        "department": "المشتريات والتعاقدات",
        "clearance": "restricted",
        "capabilities": []
    },
    {
        "id": "usr_tech",
        "email": "sa.it.1@araak.org",
        "password_hash": "$2b$12$frHu2DusW4sV242VBhRt7.x0OgMJ3sxH1ZUMGjvhNsH9H3zpui5yO",
        "name": "مشرف التقنية",
        "role": "tech_supervisor",
        "title": "مشرف التقنية",
        "department": "تقنية المعلومات",
        "clearance": "restricted",
        "capabilities": []
    }
]

SEED_PROJECTS = [
    {
        "name": "Executive Leadership Academy",
        "description": "Launch of a specialized executive leadership and management academy",
        "sector": "academy",
        "progress": 65,
        "status": "active",
        "budget": 1500000,
        "priority": "high",
        "end_date": (datetime.now(timezone.utc) + timedelta(days=45)).isoformat()
    },
    {
        "name": "Enterprise Digital Transformation",
        "description": "Cloud adoption and business process automation across all divisions",
        "sector": "digital",
        "progress": 42,
        "status": "active",
        "budget": 2800000,
        "priority": "critical",
        "end_date": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
    },
    {
        "name": "Smart Business District Development",
        "description": "Development of a mixed-use commercial and residential district",
        "sector": "arak_development",
        "progress": 78,
        "status": "active",
        "budget": 45000000,
        "priority": "critical",
        "end_date": (datetime.now(timezone.utc) + timedelta(days=180)).isoformat()
    },
    {
        "name": "Regional Commercial Hub",
        "description": "Development of a modern retail and business complex",
        "sector": "arak_development",
        "progress": 25,
        "status": "active",
        "budget": 38000000,
        "priority": "high",
        "end_date": (datetime.now(timezone.utc) + timedelta(days=240)).isoformat()
    },
    {
        "name": "Regional Investment Portfolio 2026",
        "description": "Management of a diversified investment portfolio across emerging markets",
        "sector": "investment",
        "progress": 88,
        "status": "active",
        "budget": 120000000,
        "priority": "critical",
        "end_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    },
    {
        "name": "Emerging Technology Fund",
        "description": "Strategic investments in high-growth technology startups",
        "sector": "investment",
        "progress": 35,
        "status": "active",
        "budget": 80000000,
        "priority": "high",
        "end_date": (datetime.now(timezone.utc) + timedelta(days=120)).isoformat()
    },
    {
        "name": "Corporate Services Modernization",
        "description": "Upgrade of HR, finance, and enterprise support systems",
        "sector": "corporate",
        "progress": 55,
        "status": "active",
        "budget": 950000,
        "priority": "medium",
        "end_date": (datetime.now(timezone.utc) + timedelta(days=60)).isoformat()
    },
    {
        "name": "Strategic Growth Roadmap 2026–2030",
        "description": "Development of the organization's five-year growth strategy",
        "sector": "development",
        "progress": 18,
        "status": "active",
        "budget": 500000,
        "priority": "high",
        "end_date": (datetime.now(timezone.utc) + timedelta(days=150)).isoformat()
    },
]

@app.on_event("startup")
async def seed_data():
    await db.users.create_index("email", unique=True)
    await db.projects.create_index("sector")
    await db.tasks.create_index("project_id")

    authorized_emails = [u["email"] for u in SEED_USERS]
    await db.users.delete_many({"email": {"$nin": authorized_emails}})

    user_id_by_role = {}
    test_password = os.getenv("EMBEDDED_TEST_PASSWORD")

    for u in SEED_USERS:
        existing = await db.users.find_one({"email": u["email"]})
        profile = {
            "email": u["email"],
            "name": u["name"],
            "role": u["role"],
            "title": u["title"],
            "department": u.get("department", ""),
            "clearance": u.get("clearance", "restricted"),
            "capabilities": u.get("capabilities", []),
            "active": True,
            "updated_at": now_iso(),
        }
        if existing:
            await db.users.update_one({"id": existing["id"]}, {"$set": profile})
            user_id_by_role[u["role"]] = existing["id"]
        else:
            user_doc = {
                **profile,
                "id": u["id"],
                "password_hash": hash_password(test_password) if test_password else u["password_hash"],
                "must_change_password": False if test_password else True,
                "created_at": now_iso(),
            }
            await db.users.insert_one(user_doc)
            user_id_by_role[u["role"]] = user_doc["id"]

    ceo_id = user_id_by_role.get("ceo")

    if await db.projects.count_documents({}) == 0:
        owner_map = {
            "academy": user_id_by_role.get("vp_development"),
            "digital": user_id_by_role.get("vp_development"),
            "development": user_id_by_role.get("vp_development"),
            "corporate": user_id_by_role.get("vp_development"),
            "arak_development": user_id_by_role.get("dev_manager"),
            "investment": user_id_by_role.get("vp_investment"),
        }

        for p in SEED_PROJECTS:
            project_doc = {
                **p,
                "id": new_id(),
                "owner_id": owner_map.get(p["sector"], ceo_id),
                "created_by": ceo_id,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            }
            await db.projects.insert_one(project_doc)

        # Seed tasks per project
        projects = await db.projects.find({}, {"_id": 0}).to_list(500)
        statuses = ["pending", "in_progress", "awaiting_approval", "completed", "delayed"]

        for p in projects:
            for i in range(4):
                task_doc = {
                    "id": new_id(),
                    "title": f"Task #{i + 1} - {p['name'][:25]}",
                    "description": "Executive task within the project delivery workflow",
                    "project_id": p["id"],
                    "sector": p["sector"],
                    "assignee_id": p.get("owner_id"),
                    "due_date": (datetime.now(timezone.utc) + timedelta(days=10 + i * 7)).isoformat(),
                    "priority": ["low", "medium", "high", "critical"][i % 4],
                    "status": statuses[i % len(statuses)],
                    "progress": [20, 50, 80, 100, 30][i % 5],
                    "created_by": ceo_id,
                    "created_at": now_iso(),
                    "updated_at": now_iso(),
                }
                await db.tasks.insert_one(task_doc)

    logger.info("Seed complete")

@app.on_event("shutdown")
async def shutdown():
    client.close()

@api_router.get("/")
async def root():
    return {"message": "Arak Executive Platform API"}

# Import extensions before mounting the router so all routes are registered once.
try:
    from . import arak_extensions  # noqa: F401
except ImportError:  # Allows running from inside the backend directory.
    import arak_extensions  # noqa: F401

# ---------------- Mount ----------------
app.include_router(api_router)
