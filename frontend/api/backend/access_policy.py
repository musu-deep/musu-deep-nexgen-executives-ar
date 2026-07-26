"""Least-privilege access policy for ARAAK CEO.

CEO and platform administrators retain full access. Every other account receives
only its functional workspace plus records directly assigned or shared with it.
"""
from __future__ import annotations

import time
from typing import Any

from fastapi import HTTPException

FULL_ACCESS_ROLES = {"admin", "ceo"}
COMMON_MODULES = {
    "dashboard", "projects", "tasks", "meetings", "meeting_requests",
    "calendar", "messages", "notifications", "settings",
}
AREA_MODULES = {
    "human_resources": {"human_resources", "team"},
    "secretariat": {"executive_secretariat", "documents"},
    "legal": {"legal_affairs", "documents"},
    "quality": {"quality_control"},
    "development": set(),
    "investment": set(),
    "operations": set(),
    "digital": set(),
    "general": set(),
}
FULL_ONLY_MODULES = {
    "daily_report", "camera_monitoring", "presidential_advisor", "voice",
    "ai_lounge", "odoo_integration", "reports", "admin",
}

_IDENTITY_CACHE: dict[str, tuple[float, dict[str, set[int]]]] = {}
_IDENTITY_TTL_SECONDS = 60


def _profile_text(user: dict[str, Any]) -> str:
    return " ".join(
        str(user.get(key) or "") for key in ("email", "title", "department", "name")
    ).lower()


def is_full_access(user: dict[str, Any]) -> bool:
    return str(user.get("role") or "") in FULL_ACCESS_ROLES


def functional_area(user: dict[str, Any]) -> str:
    if is_full_access(user):
        return "full"
    text = _profile_text(user)
    email = str(user.get("email") or "").strip().lower()
    role = str(user.get("role") or "")
    if email == "hr@company.demo" or "الموارد البشرية" in text or "human resources" in text:
        return "human_resources"
    if role == "tracker" or any(token in text for token in ("سكرتارية", "متابعة", "مكتب الرئيس")):
        return "secretariat"
    if any(token in text for token in ("قانون", "legal")):
        return "legal"
    if any(token in text for token in ("جودة", "رقابة", "تفتيش", "quality")):
        return "quality"
    if role == "vp_development" or any(token in text for token in ("تنمية", "تطوير")):
        return "development"
    if role == "vp_investment" or "استثمار" in text:
        return "investment"
    if role == "dev_manager" or any(token in text for token in ("تشغيل", "عمليات")):
        return "operations"
    if any(token in text for token in ("تقنية", "رقمي", "digital")):
        return "digital"
    return "general"


def can_access_module(user: dict[str, Any], module: str) -> bool:
    if is_full_access(user):
        return True
    if module in FULL_ONLY_MODULES:
        return False
    return module in COMMON_MODULES or module in AREA_MODULES.get(functional_area(user), set())


def require_module(user: dict[str, Any], module: str) -> None:
    if not can_access_module(user, module):
        raise HTTPException(status_code=403, detail="لا تملك صلاحية الوصول إلى هذه الوحدة")


def can_manage_meetings(user: dict[str, Any]) -> bool:
    return is_full_access(user) or functional_area(user) == "secretariat"


def can_view_human_resources(user: dict[str, Any]) -> bool:
    return is_full_access(user) or functional_area(user) == "human_resources"


def can_view_documents(user: dict[str, Any]) -> bool:
    return is_full_access(user) or functional_area(user) in {"secretariat", "legal"}


def _many2one_id(value: Any) -> int | None:
    if isinstance(value, (list, tuple)) and value:
        try:
            return int(value[0])
        except (TypeError, ValueError):
            return None
    if isinstance(value, int):
        return value
    return None


async def resolve_odoo_identity(odoo_server: Any, user: dict[str, Any]) -> dict[str, set[int]]:
    """Resolve Odoo user and partner IDs for the authenticated platform account."""
    email = str(user.get("email") or "").strip().lower()
    cache_key = email or str(user.get("id") or "")
    cached = _IDENTITY_CACHE.get(cache_key)
    if cached and time.monotonic() - cached[0] < _IDENTITY_TTL_SECONDS:
        return cached[1]

    identity = {"user_ids": set(), "partner_ids": set(), "employee_ids": set()}
    explicit_user_id = user.get("odoo_user_id")
    explicit_partner_id = user.get("odoo_partner_id")
    if explicit_user_id:
        identity["user_ids"].add(int(explicit_user_id))
    if explicit_partner_id:
        identity["partner_ids"].add(int(explicit_partner_id))

    if email:
        connector = odoo_server.get_odoo_connector()
        try:
            employees = await connector._compatible_search_read(
                "hr.employee", [["work_email", "=", email]],
                ["id", "user_id", "work_email"], 20, "id desc",
            )
            for employee in employees:
                employee_id = employee.get("id")
                if employee_id:
                    identity["employee_ids"].add(int(employee_id))
                user_id = _many2one_id(employee.get("user_id"))
                if user_id:
                    identity["user_ids"].add(user_id)
        except Exception:
            pass
        try:
            partners = await connector._compatible_search_read(
                "res.partner", [["email", "=", email]],
                ["id", "email"], 20, "id desc",
            )
            identity["partner_ids"].update(int(item["id"]) for item in partners if item.get("id"))
        except Exception:
            pass
        if identity["user_ids"]:
            try:
                users = await connector._compatible_search_read(
                    "res.users", [["id", "in", sorted(identity["user_ids"])]],
                    ["id", "partner_id", "login"], 20, "id desc",
                )
                for item in users:
                    partner_id = _many2one_id(item.get("partner_id"))
                    if partner_id:
                        identity["partner_ids"].add(partner_id)
            except Exception:
                pass

    _IDENTITY_CACHE[cache_key] = (time.monotonic(), identity)
    return identity


def local_record_visible(item: dict[str, Any], user: dict[str, Any], kind: str) -> bool:
    if is_full_access(user):
        return True
    user_id = str(user.get("id") or "")
    email = str(user.get("email") or "").strip().lower()
    shared_ids = {str(value) for value in item.get("shared_with_ids", []) if value is not None}
    shared_emails = {str(value).strip().lower() for value in item.get("shared_with_emails", []) if value}
    if user_id in shared_ids or (email and email in shared_emails):
        return True
    if str(item.get("created_by") or "") == user_id:
        return True
    if kind == "task":
        assignee_ids = {str(value) for value in item.get("assignee_ids", []) if value is not None}
        return str(item.get("assignee_id") or "") == user_id or user_id in assignee_ids
    return str(item.get("owner_id") or "") == user_id
