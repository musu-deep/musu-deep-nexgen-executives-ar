"""Vercel FastAPI entry point inside the configured frontend root."""
from __future__ import annotations

import hashlib
import hmac
import os
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Response
from pydantic import BaseModel

os.environ.setdefault("EMBEDDED_DATA_FILE", "/tmp/nexgen_executives_data.json")
os.environ.setdefault("DB_NAME", "nexgen_executives_vercel")
os.environ.setdefault(
    "JWT_SECRET",
    "nexgen-vercel-demo-secret-change-in-project-settings-2026",
)

from api.backend import embedded_server

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
    {"email": "factory@company.demo", "name": "م. عبد الرحمن الحسام", "role": "dev_manager", "title": "مدير أراك الوطنية والمصنع", "department": "المصنع وأراك الوطنية"},
    {"email": "technical.office@company.demo", "name": "م. إسلام محمد", "role": "dev_manager", "title": "مسؤول المكتب الفني", "department": "المكتب الفني"},
    {"email": "wholesale@company.demo", "name": "مدير مبيعات الجملة", "role": "dev_manager", "title": "مدير مبيعات الجملة", "department": "مبيعات الجملة"},
    {"email": "stores@company.demo", "name": "م. طه الأهدل", "role": "dev_manager", "title": "مدير أراك ستورز والتجارة الإلكترونية", "department": "أراك ستورز"},
]

GROUPS = [
    {
        "name": "الإدارات المساندة",
        "env": "GROUP_CODE_SUPPORT_HASH",
        "fallback": "fea8344c6c192a73125b6b1469b96dd2944ec2e6206e0dbab867e910da7ace17",
        "emails": ["hr@company.demo", "finance@company.demo", "quality@company.demo", "manager@company.demo"],
    },
]


class LoginPayload(BaseModel):
    email: str
    password: str


class GroupPayload(BaseModel):
    code: str


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in user.items() if key not in {"_id", "password_hash"}}


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


@app.on_event("startup")
async def initialize_vercel_runtime() -> None:
    await embedded_server.initialize_embedded_runtime()
    await ensure_users()


@app.get("/api/health", include_in_schema=False)
@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ready", "service": "NEXGEN EXECUTIVES", "runtime": "vercel-python"}


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
async def me(user=Depends(core.get_current_user)):
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


@app.get("/api/openapi.json", include_in_schema=False)
async def openapi_schema():
    return backend_app.openapi()


# Keep the complete existing application available for every route not overridden above.
app.mount("/", backend_app)
