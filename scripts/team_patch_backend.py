from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "scripts" / "official_team_data.json").read_text(encoding="utf-8"))
USERS = DATA["users"]


def sub1(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Expected one replacement for {label}, got {count}")
    return updated


def seed_users() -> str:
    rows = []
    for u in USERS:
        payload = {
            "id": u["id"],
            "email": u["email"],
            "password_hash": u["bcrypt_hash"],
            "name": u["name"],
            "role": u["role"],
            "title": u["title"],
            "department": u["department"],
            "clearance": u["clearance"],
            "capabilities": u.get("capabilities", []),
        }
        rendered = json.dumps(payload, ensure_ascii=False, indent=4)
        rows.append("    " + rendered.replace("\n", "\n    "))
    return "SEED_USERS = [\n" + ",\n".join(rows) + "\n]"


def patch_server() -> None:
    path = ROOT / "backend" / "server.py"
    text = path.read_text(encoding="utf-8")

    roles = '''# ---------------- Roles & Sectors ----------------
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

# ---------------- Password & JWT helpers ----------------'''
    text = sub1(text, r'# ---------------- Roles & Sectors ----------------.*?# ---------------- Password & JWT helpers ----------------', roles, "role policy")
    text = re.sub(
        r'role: Literal\[[^\]]+\]',
        'role: Literal["admin", "ceo", "vp_development", "national_executive", "tracker", "finance", "marketing_tenders", "procurement", "tech_supervisor"]',
        text,
        count=1,
    )
    text = sub1(text, r'SEED_USERS = \[.*?\n\]\n\nSEED_PROJECTS = \[', seed_users() + "\n\nSEED_PROJECTS = [", "seed users")

    old_profile = '''            "title": u["title"],
            "active": True,
            "updated_at": now_iso(),'''
    new_profile = '''            "title": u["title"],
            "department": u.get("department", ""),
            "clearance": u.get("clearance", "restricted"),
            "capabilities": u.get("capabilities", []),
            "active": True,
            "updated_at": now_iso(),'''
    if old_profile not in text:
        raise SystemExit("Backend seed profile not found")
    text = text.replace(old_profile, new_profile, 1)

    old_id = '''                "id": new_id(),
                "password_hash": hash_password(test_password) if test_password else u["password_hash"],'''
    new_id = '''                "id": u["id"],
                "password_hash": hash_password(test_password) if test_password else u["password_hash"],'''
    if old_id not in text:
        raise SystemExit("Backend seed id block not found")
    text = text.replace(old_id, new_id, 1)

    old_create = '''@api_router.post("/tasks")
async def create_task(payload: TaskInput, user=Depends(get_current_user)):
    doc = payload.model_dump()'''
    new_create = '''@api_router.post("/tasks")
async def create_task(payload: TaskInput, user=Depends(get_current_user)):
    if payload.assignee_id and payload.assignee_id != user["id"] and not can_assign_tasks(user["role"]):
        raise HTTPException(status_code=403, detail="لا تملك صلاحية توزيع المهام على أعضاء الفريق")
    doc = payload.model_dump()
    if not doc.get("assignee_id"):
        doc["assignee_id"] = user["id"]'''
    if old_create not in text:
        raise SystemExit("Backend task create block not found")
    text = text.replace(old_create, new_create, 1)

    old_update = '''async def update_task(task_id: str, payload: TaskUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}'''
    new_update = '''async def update_task(task_id: str, payload: TaskUpdate, user=Depends(get_current_user)):
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if updates.get("assignee_id") and not can_assign_tasks(user["role"]):
        current = await db.tasks.find_one({"id": task_id}, {"_id": 0, "assignee_id": 1})
        if not current or updates["assignee_id"] != current.get("assignee_id"):
            raise HTTPException(status_code=403, detail="لا تملك صلاحية إعادة إسناد المهمة")'''
    if old_update not in text:
        raise SystemExit("Backend task update block not found")
    text = text.replace(old_update, new_update, 1)
    path.write_text(text, encoding="utf-8")


def patch_extensions() -> None:
    path = ROOT / "backend" / "arak_extensions.py"
    text = path.read_text(encoding="utf-8")
    text = text.replace('("admin", "ceo", "tracker")', '("admin", "ceo", "tracker", "marketing_tenders")')
    text = text.replace('["admin", "ceo", "tracker"]', '["admin", "ceo", "tracker", "marketing_tenders"]')
    path.write_text(text, encoding="utf-8")


def apply() -> None:
    patch_server()
    patch_extensions()
