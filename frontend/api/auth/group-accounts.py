from __future__ import annotations

import hashlib
import hmac
import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

GROUPS = [
    {
        "id": "leadership",
        "name": "القيادة التنفيذية",
        "env": "GROUP_CODE_LEADERSHIP",
        "accounts": [
            {"email": "ceo@company.demo", "name": "الرئيس التنفيذي", "title": "الرئيس التنفيذي", "role": "ceo"},
            {"email": "development@company.demo", "name": "نائب الرئيس التنفيذي للتنمية", "title": "قطاع التنمية", "role": "vp_development"},
            {"email": "investment@company.demo", "name": "نائب الرئيس التنفيذي للاستثمار", "title": "قطاع الاستثمار", "role": "vp_investment"},
        ],
    },
    {
        "id": "ceo-office",
        "name": "مكتب الرئيس التنفيذي",
        "env": "GROUP_CODE_CEO_OFFICE",
        "accounts": [
            {"email": "followup@company.demo", "name": "المتابعة التنفيذية", "title": "مكتب الرئيس التنفيذي", "role": "tracker"},
            {"email": "secretariat@company.demo", "name": "خالد العوبثاني", "title": "السكرتارية التنفيذية", "role": "secretariat"},
        ],
    },
    {
        "id": "support",
        "name": "الإدارات المساندة",
        "env": "GROUP_CODE_SUPPORT",
        "accounts": [
            {"email": "hr@company.demo", "name": "محمد السقاف", "title": "الموارد البشرية", "role": "human-resources"},
            {"email": "finance@company.demo", "name": "محمد السيمت أبو إياد", "title": "المدير المالي", "role": "finance"},
            {"email": "quality@company.demo", "name": "عاصم الملاحمة", "title": "التفتيش والرقابة والجودة", "role": "quality-control"},
            {"email": "manager@company.demo", "name": "مدير وحدة الأعمال", "title": "العمليات والتنفيذ", "role": "dev_manager"},
        ],
    },
    {
        "id": "operations",
        "name": "المصانع والعمليات",
        "env": "GROUP_CODE_OPERATIONS",
        "accounts": [
            {"email": "steel.factory@company.demo", "name": "سامر الملاحمة", "title": "مصنع الحديد", "role": "steel-factory"},
            {"email": "commercial@company.demo", "name": "م. محمد شكاك", "title": "المشتريات والمستودعات", "role": "commercial"},
            {"email": "factory@company.demo", "name": "م. عبد الرحمن الحسام", "title": "المصنع وأراك الوطنية", "role": "factory"},
            {"email": "technical.office@company.demo", "name": "م. إسلام محمد", "title": "المكتب الفني", "role": "technical-office"},
        ],
    },
    {
        "id": "sales",
        "name": "المبيعات والمتاجر",
        "env": "GROUP_CODE_SALES",
        "accounts": [
            {"email": "wholesale@company.demo", "name": "مدير مبيعات الجملة", "title": "مبيعات الجملة", "role": "wholesale"},
            {"email": "stores@company.demo", "name": "م. طه الأهدل", "title": "أراك ستورز", "role": "stores"},
        ],
    },
    {
        "id": "platform",
        "name": "إدارة المنصة",
        "env": "GROUP_CODE_PLATFORM",
        "accounts": [
            {"email": "admin@company.demo", "name": "مدير المنصة", "title": "إدارة المنصة", "role": "admin"},
        ],
    },
]


class GroupPayload(BaseModel):
    code: str


def secure_match(first: str, second: str) -> bool:
    first_hash = hashlib.sha256(first.encode("utf-8")).digest()
    second_hash = hashlib.sha256(second.encode("utf-8")).digest()
    return hmac.compare_digest(first_hash, second_hash)


async def resolve_group(payload: GroupPayload):
    normalized = "".join(character for character in str(payload.code) if character.isdigit())[:8]
    if len(normalized) < 4:
        raise HTTPException(status_code=400, detail="أدخل معرف المجموعة المكوّن من أربعة أرقام على الأقل")

    configured = []
    for group in GROUPS:
        code = "".join(character for character in str(os.getenv(group["env"], "")) if character.isdigit())[:8]
        if len(code) >= 4:
            configured.append((group, code))

    if not configured:
        raise HTTPException(status_code=503, detail="لم تُضبط معرفات المجموعات في إعدادات Vercel")

    for group, code in configured:
        if secure_match(code, normalized):
            return {
                "group": {"id": group["id"], "name": group["name"]},
                "accounts": group["accounts"],
            }

    raise HTTPException(status_code=404, detail="معرف المجموعة غير صحيح")


@app.post("/")
@app.post("/api/auth/group-accounts")
async def group_accounts(payload: GroupPayload):
    return await resolve_group(payload)
