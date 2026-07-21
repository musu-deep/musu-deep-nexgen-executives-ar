from __future__ import annotations

import hashlib
import hmac
import json
import os
from http.server import BaseHTTPRequestHandler

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


def normalize_code(value: object) -> str:
    return "".join(character for character in str(value or "") if character.isdigit())[:8]


def secure_match(first: str, second: str) -> bool:
    first_hash = hashlib.sha256(first.encode("utf-8")).digest()
    second_hash = hashlib.sha256(second.encode("utf-8")).digest()
    return hmac.compare_digest(first_hash, second_hash)


class handler(BaseHTTPRequestHandler):
    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Allow", "POST, OPTIONS")
        self.end_headers()

    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"detail": "بيانات الطلب غير صالحة"})
            return

        submitted = normalize_code(payload.get("code"))
        if len(submitted) < 4:
            self.send_json(400, {"detail": "أدخل معرف المجموعة المكوّن من أربعة أرقام على الأقل"})
            return

        configured_groups = []
        for group in GROUPS:
            configured_code = normalize_code(os.getenv(group["env"], ""))
            if len(configured_code) >= 4:
                configured_groups.append((group, configured_code))

        if not configured_groups:
            self.send_json(503, {"detail": "لم تُضبط معرفات المجموعات في إعدادات Vercel"})
            return

        for group, configured_code in configured_groups:
            if secure_match(configured_code, submitted):
                self.send_json(
                    200,
                    {
                        "group": {"id": group["id"], "name": group["name"]},
                        "accounts": group["accounts"],
                    },
                )
                return

        self.send_json(404, {"detail": "معرف المجموعة غير صحيح"})
