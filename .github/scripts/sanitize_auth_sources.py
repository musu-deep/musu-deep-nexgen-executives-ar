from pathlib import Path
import re


def sub_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Expected one replacement for {label}, got {count}")
    return updated


def sanitize_catchall() -> None:
    path = Path("api/[...path].js")
    text = path.read_text(encoding="utf-8")
    if "ExecAgent2026!" not in text and "@company.demo" not in text:
        return

    text = text.replace('const DEMO_PASSWORD = "ExecAgent2026!";\n', "")
    text = sub_once(
        text,
        r"const USERS = \[.*?\n\];\n\nconst PROJECTS = \[",
        '''const USERS = [
  { id: "usr_admin", email: "admin@arak.com", name: "مدير النظام", role: "admin", title: "مدير النظام والمنصة", active: true },
  { id: "usr_ceo", email: "ceo@arak.com", name: "د. علي العتيبي", role: "ceo", title: "رئيس مجلس الإدارة والرئيس التنفيذي", active: true },
  { id: "usr_dev", email: "vp.dev@arak.com", name: "د. لؤي عبد الله أحمد", role: "vp_development", title: "نائب الرئيس التنفيذي للتنمية", active: true },
  { id: "usr_inv", email: "vp.invest@arak.com", name: "نائب الرئيس التنفيذي للاستثمار", role: "vp_investment", title: "نائب الرئيس التنفيذي للاستثمار", active: true },
  { id: "usr_mgr", email: "dev.manager@arak.com", name: "مدير وحدة الأعمال", role: "dev_manager", title: "مدير العمليات والتنفيذ", active: true },
  { id: "usr_track", email: "tracker@arak.com", name: "المتابعة التنفيذية", role: "tracker", title: "مسؤول المتابعة التنفيذية", active: true },
];

const PROJECTS = [''',
        "catch-all user directory",
    )
    text = sub_once(
        text,
        r'  if \(route === "auth/login" && method === "POST"\) \{.*?\n  \}\n  if \(route === "auth/logout"',
        '''  if (route === "auth/login" && method === "POST") {
    return send(response, 410, { detail: "استخدم مسار الهوية المؤسسية المعتمد." });
  }
  if (route === "auth/logout"''',
        "catch-all demo login",
    )
    path.write_text(text, encoding="utf-8")


def sanitize_embedded_backend() -> None:
    path = Path("backend/server.py")
    text = path.read_text(encoding="utf-8")
    if "ExecAgent2026!" not in text and "@company.demo" not in text:
        return

    text = sub_once(
        text,
        r"SEED_USERS = \[.*?\n\]\n\nSEED_PROJECTS = \[",
        '''SEED_USERS = [
    {
        "email": "admin@arak.com",
        "password_hash": "$2b$12$v0ad3vU4Z5pujJixD6f8E.jUxq1oiJOl97HAQS13tN58.7qXO60F2",
        "name": "مدير النظام",
        "role": "admin",
        "title": "مدير النظام والمنصة"
    },
    {
        "email": "ceo@arak.com",
        "password_hash": "$2b$12$exaMxe4vWBoW1sRAZ58x7.Iwa5mAt.6WWp/mgXCTPghlom624tBny",
        "name": "د. علي العتيبي",
        "role": "ceo",
        "title": "رئيس مجلس الإدارة والرئيس التنفيذي"
    },
    {
        "email": "vp.dev@arak.com",
        "password_hash": "$2b$12$z3vnjElm83qq6b0KPg3Qiu92QDIddfQmifzvIZJQrbs/Bcg/St1OC",
        "name": "د. لؤي عبد الله أحمد",
        "role": "vp_development",
        "title": "نائب الرئيس التنفيذي للتنمية"
    },
    {
        "email": "vp.invest@arak.com",
        "password_hash": "$2b$12$Z.rLpRG47q5heW.SjDveF.lDWjYv.9nIGQwSnLNssHWXF.vRYakgS",
        "name": "نائب الرئيس التنفيذي للاستثمار",
        "role": "vp_investment",
        "title": "نائب الرئيس التنفيذي للاستثمار"
    },
    {
        "email": "dev.manager@arak.com",
        "password_hash": "$2b$12$szXTbzymgb6fWmLaMk1eN.P3S0eoNLfLR9.LSIGZNmrOyY9aEZA6.",
        "name": "مدير وحدة الأعمال",
        "role": "dev_manager",
        "title": "مدير العمليات والتنفيذ"
    },
    {
        "email": "tracker@arak.com",
        "password_hash": "$2b$12$N0vyiUGU1JnuyFyAHQLhLelMFOMCVwUeG4gCM1aJm1Di.cS3.pf2y",
        "name": "المتابعة التنفيذية",
        "role": "tracker",
        "title": "مسؤول المتابعة التنفيذية"
    }
]

SEED_PROJECTS = [''',
        "embedded seed users",
    )

    original = '''class LoginInput(BaseModel):
    email: EmailStr
    password: str
'''
    replacement = '''class LoginInput(BaseModel):
    email: EmailStr
    password: str

class PasswordChangeInput(BaseModel):
    current_password: str
    new_password: str
'''
    if original not in text:
        raise SystemExit("LoginInput block not found")
    text = text.replace(original, replacement, 1)

    original = '''@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"user": user}
'''
    replacement = '''@api_router.get("/auth/me")
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
'''
    if original not in text:
        raise SystemExit("auth/me block not found")
    text = text.replace(original, replacement, 1)

    text = text.replace(
        'async def list_users(user=Depends(get_current_user)):',
        'async def list_users(user=Depends(require_roles("admin"))):',
        1,
    )
    text = sub_once(
        text,
        r'@api_router\.post\("/users"\)\nasync def create_user\(.*?\n(?=@api_router\.patch\("/users/\{user_id\}"\))',
        '''@api_router.post("/users")
async def create_user(payload: UserCreate, admin=Depends(require_roles("admin"))):
    raise HTTPException(
        status_code=410,
        detail="إنشاء حسابات إضافية متوقف؛ الدخول محصور في القائمة التنفيذية المخولة",
    )

''',
        "embedded user creation",
    )
    text = sub_once(
        text,
        r'    # Reset demo users on every startup to keep project login credentials consistent\n    await db\.users\.delete_many\(\{\}\)\n\n    user_id_by_role = \{\}\n\n    for u in SEED_USERS:.*?        user_id_by_role\[u\["role"\]\] = user_doc\["id"\]',
        '''    authorized_emails = [u["email"] for u in SEED_USERS]
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
            "active": True,
            "updated_at": now_iso(),
        }
        if existing:
            await db.users.update_one({"id": existing["id"]}, {"$set": profile})
            user_id_by_role[u["role"]] = existing["id"]
        else:
            user_doc = {
                **profile,
                "id": new_id(),
                "password_hash": hash_password(test_password) if test_password else u["password_hash"],
                "must_change_password": False if test_password else True,
                "created_at": now_iso(),
            }
            await db.users.insert_one(user_doc)
            user_id_by_role[u["role"]] = user_doc["id"]''',
        "embedded startup identity migration",
    )
    path.write_text(text, encoding="utf-8")


def fix_arabic_imports() -> None:
    path = Path("backend/arabic_server.py")
    text = path.read_text(encoding="utf-8")
    if "except ImportError:\n    from server import" not in text:
        return
    text = sub_once(
        text,
        r'try:\n    from \.server import \(.*?\n    \)\n\napp = FastAPI',
        '''from .server import (
    app as core_app,
    calc_rag,
    db,
    get_current_user,
    new_id,
    now_iso,
    role_sector_filter,
)
from .arak_extensions import (
    ExecutiveBriefInput,
    OrchestrateInput,
    _call_gemini,
    ai_agents as core_ai_agents,
    ai_orchestrate as core_ai_orchestrate,
    ai_workforce_status as core_workforce_status,
    daily_executive_report as core_daily_report,
    risk_radar as core_risk_radar,
)

app = FastAPI''',
        "Arabic relative imports",
    )
    path.write_text(text, encoding="utf-8")


def update_embedded_ci() -> None:
    path = Path(".github/workflows/arabic-version-ci.yml")
    text = path.read_text(encoding="utf-8")
    if "EMBEDDED_TEST_PASSWORD" not in text:
        text = text.replace(
            "EMBEDDED_DATA_FILE: /tmp/nexgen-executives-ci.json",
            "EMBEDDED_DATA_FILE: /tmp/nexgen-executives-ci.json\n          EMBEDDED_TEST_PASSWORD: EmbeddedCiOnly!2026",
        )
    text = text.replace(
        '"email":"ceo@company.demo","password":"ExecAgent2026!"',
        '"email":"ceo@arak.com","password":"EmbeddedCiOnly!2026"',
    )
    path.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    sanitize_catchall()
    sanitize_embedded_backend()
    fix_arabic_imports()
    update_embedded_ci()
