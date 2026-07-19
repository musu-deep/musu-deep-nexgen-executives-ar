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
# Roles: admin, ceo, vp_development, vp_investment, dev_manager, tracker
# Sectors: development, investment, arak_development, academy, digital, corporate
DEV_SECTORS = ["development", "arak_development", "academy", "digital", "corporate"]

def role_sector_filter(role: str) -> Optional[dict]:
    """Return MongoDB filter for projects/tasks visibility. None means see-all."""
    if role in ("admin", "ceo", "tracker"):
        return None
    if role == "vp_development":
        return {"sector": {"$in": DEV_SECTORS}}
    if role == "vp_investment":
        return {"sector": "investment"}
    if role == "dev_manager":
        return {"sector": "arak_development"}
    return {"_id": "__never__"}  # unknown -> nothing

def can_manage_users(role: str) -> bool:
    return role == "admin"

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

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Literal["admin", "ceo", "vp_development", "vp_investment", "dev_manager", "tracker"]
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

# ---------------- Users (Admin) ----------------
@api_router.get("/users")
async def list_users(user=Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users

@api_router.post("/users")
async def create_user(payload: UserCreate, admin=Depends(require_roles("admin"))):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email is already in use")
    doc = {
        "id": new_id(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": payload.role,
        "title": payload.title or "",
        "active": payload.active,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("password_hash", "_id")}

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
    doc = payload.model_dump()
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
        "email": "admin@company.demo",
        "password": "ExecAgent2026!",
        "name": "Admin",
        "role": "admin",
        "title": "System Administrator"
    },
    {
        "email": "ceo@company.demo",
        "password": "ExecAgent2026!",
        "name": "Chief Executive Officer",
        "role": "ceo",
        "title": "Executive Leadership"
    },
    {
        "email": "development@company.demo",
        "password": "ExecAgent2026!",
        "name": "VP DEVELOPMENT",
        "role": "vp_development",
        "title": "Development Portfolio"
    },
    {
        "email": "investment@company.demo",
        "password": "ExecAgent2026!",
        "name": "VP Investment",
        "role": "vp_investment",
        "title": "Investment Portfolio"
    },
    {
        "email": "manager@company.demo",
        "password": "ExecAgent2026!",
        "name": "Monitoring Manager",
        "role": "dev_manager",
        "title": "Business Unit Management"
    },
    {
        "email": "followup@company.demo",
        "password": "ExecAgent2026!",
        "name": "Follow-up Officer",
        "role": "tracker",
        "title": "Executive Follow-up Office"
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

    # Reset demo users on every startup to keep project login credentials consistent
    await db.users.delete_many({})

    user_id_by_role = {}

    for u in SEED_USERS:
        user_doc = {
            "id": new_id(),
            "email": u["email"],
            "password_hash": hash_password(u["password"]),
            "name": u["name"],
            "role": u["role"],
            "title": u["title"],
            "active": True,
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
