"""Invitation-only identity lifecycle for the Arabic ARAAK CEO Office."""
from __future__ import annotations

import hashlib
import logging
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel, EmailStr

try:
    from .. import server as core
except (ImportError, ValueError):
    import server as core  # type: ignore

logger = logging.getLogger("araak.secure-access")
INVITE_TTL_HOURS = max(1, int(os.getenv("INVITE_TTL_HOURS", "24")))
FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "https://musu-deep-nexgen-executives-ar.vercel.app",
).rstrip("/")
ROLE_VALUES = ("admin", "ceo", "vp_development", "vp_investment", "dev_manager", "tracker")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _new_invitation() -> tuple[str, str, str]:
    token = secrets.token_urlsafe(36)
    expires_at = _iso(_utcnow() + timedelta(hours=INVITE_TTL_HOURS))
    return token, expires_at, f"{FRONTEND_URL}/activate?token={token}"


def _public_user(user: dict) -> dict:
    hidden = {"_id", "password_hash", "invite_token_hash", "password_reset_token_hash"}
    return {key: value for key, value in user.items() if key not in hidden}


def _validate_password(password: str) -> None:
    checks = [
        (len(password) >= 12, "12 خانة على الأقل"),
        (bool(re.search(r"[A-Z]", password)), "حرف إنجليزي كبير"),
        (bool(re.search(r"[a-z]", password)), "حرف إنجليزي صغير"),
        (bool(re.search(r"\d", password)), "رقم"),
        (bool(re.search(r"[^A-Za-z0-9]", password)), "رمز خاص"),
    ]
    missing = [label for ok, label in checks if not ok]
    if missing:
        raise HTTPException(422, "يجب أن تتضمن كلمة المرور: " + "، ".join(missing) + ".")


async def _audit(
    event: str,
    actor: Optional[dict] = None,
    target: Optional[dict] = None,
    details: Optional[dict] = None,
) -> None:
    await core.db.security_events.insert_one({
        "id": core.new_id(),
        "event": event,
        "actor_id": actor.get("id") if actor else None,
        "actor_email": actor.get("email") if actor else None,
        "target_user_id": target.get("id") if target else None,
        "target_email": target.get("email") if target else None,
        "details": details or {},
        "created_at": core.now_iso(),
    })


def _remove_route(path: str, method: str) -> None:
    method = method.upper()
    core.api_router.routes[:] = [
        route
        for route in core.api_router.routes
        if not (
            getattr(route, "path", None) == path
            and method in set(getattr(route, "methods", set()) or set())
        )
    ]


for _path, _method in (
    ("/users", "GET"),
    ("/users", "POST"),
    ("/users/{user_id}", "PATCH"),
    ("/users/{user_id}", "DELETE"),
    ("/auth/group-accounts", "POST"),
):
    _remove_route(_path, _method)


class InviteUserInput(BaseModel):
    email: EmailStr
    name: str
    role: Literal["admin", "ceo", "vp_development", "vp_investment", "dev_manager", "tracker"]
    title: Optional[str] = ""
    department: Optional[str] = ""


class ActivateAccountInput(BaseModel):
    token: str
    password: str


class SecureUserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[Literal["admin", "ceo", "vp_development", "vp_investment", "dev_manager", "tracker"]] = None
    title: Optional[str] = None
    department: Optional[str] = None
    active: Optional[bool] = None
    clearance: Optional[Literal[
        "internal", "restricted", "confidential", "executive_secret",
        "financial_sensitive", "legal_privileged",
    ]] = None


async def _issue_invitation(user: dict, admin: dict, reset_access: bool = False) -> dict:
    raw_token, expires_at, activation_url = _new_invitation()
    updates = {
        "password_hash": core.hash_password(secrets.token_urlsafe(48)),
        "active": False,
        "invitation_status": "pending",
        "invite_token_hash": _token_hash(raw_token),
        "invite_expires_at": expires_at,
        "invited_at": core.now_iso(),
        "invited_by": admin["id"],
        "updated_at": core.now_iso(),
    }
    if reset_access:
        updates["access_revoked_at"] = core.now_iso()
    await core.db.users.update_one({"id": user["id"]}, {"$set": updates})
    refreshed = await core.db.users.find_one({"id": user["id"]}, {"_id": 0})
    await _audit(
        "user_access_reset" if reset_access else "user_invited",
        admin,
        refreshed,
        {"expires_at": expires_at},
    )
    return {
        "user": _public_user(refreshed or user),
        "activation_url": activation_url,
        "expires_at": expires_at,
        "delivery": "manual_secure_link",
    }


@core.api_router.get("/users")
async def secure_list_users(admin=Depends(core.require_roles("admin"))):
    return await core.db.users.find(
        {},
        {"_id": 0, "password_hash": 0, "invite_token_hash": 0},
    ).sort("created_at", -1).to_list(500)


@core.api_router.post("/users/invite")
async def invite_user(payload: InviteUserInput, admin=Depends(core.require_roles("admin"))):
    email = payload.email.strip().lower()
    name = payload.name.strip()
    if not name:
        raise HTTPException(422, "الاسم الكامل مطلوب.")

    existing = await core.db.users.find_one({"email": email}, {"_id": 0})
    if existing and existing.get("invitation_status") == "active" and existing.get("active"):
        raise HTTPException(409, "الحساب نشط بالفعل. استخدم إعادة إصدار الدعوة عند الحاجة.")

    profile_updates = {
        "name": name,
        "role": payload.role,
        "title": payload.title or "",
        "department": payload.department or "",
        "updated_at": core.now_iso(),
    }
    if existing:
        await core.db.users.update_one({"id": existing["id"]}, {"$set": profile_updates})
        user = await core.db.users.find_one({"id": existing["id"]}, {"_id": 0})
    else:
        user = {
            "id": core.new_id(),
            "email": email,
            "password_hash": core.hash_password(secrets.token_urlsafe(48)),
            **profile_updates,
            "active": False,
            "invitation_status": "pending",
            "clearance": "internal",
            "demo": False,
            "created_at": core.now_iso(),
        }
        await core.db.users.insert_one(dict(user))
    return await _issue_invitation(user, admin)


@core.api_router.post("/users")
async def direct_user_creation_blocked(admin=Depends(core.require_roles("admin"))):
    raise HTTPException(410, "تم إيقاف إنشاء الحساب المباشر. استخدم مسار الدعوات الآمنة.")


@core.api_router.post("/users/{user_id}/reset-invite")
async def reset_user_access(user_id: str, admin=Depends(core.require_roles("admin"))):
    if user_id == admin.get("id"):
        raise HTTPException(400, "لا يمكنك إعادة ضبط جلستك النشطة من هذا المسار.")
    user = await core.db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(404, "المستخدم غير موجود.")
    return await _issue_invitation(user, admin, True)


@core.api_router.patch("/users/{user_id}")
async def secure_update_user(
    user_id: str,
    payload: SecureUserUpdate,
    admin=Depends(core.require_roles("admin")),
):
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        return {"ok": True}
    if user_id == admin.get("id"):
        if updates.get("active") is False:
            raise HTTPException(400, "لا يمكنك تعطيل حسابك الإداري.")
        if "role" in updates and updates["role"] != "admin":
            raise HTTPException(400, "لا يمكنك إزالة صلاحية الإدارة من حسابك.")

    current = await core.db.users.find_one({"id": user_id}, {"_id": 0})
    if not current:
        raise HTTPException(404, "المستخدم غير موجود.")
    if updates.get("active") is True and current.get("invitation_status") != "active":
        raise HTTPException(409, "يجب على المستخدم تفعيل الدعوة قبل تنشيط الحساب.")

    updates["updated_at"] = core.now_iso()
    await core.db.users.update_one({"id": user_id}, {"$set": updates})
    updated = await core.db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password_hash": 0, "invite_token_hash": 0},
    )
    await _audit("user_updated", admin, updated, {"fields": sorted(updates)})
    return updated


@core.api_router.delete("/users/{user_id}")
async def secure_disable_user(user_id: str, admin=Depends(core.require_roles("admin"))):
    if user_id == admin.get("id"):
        raise HTTPException(400, "لا يمكنك تعطيل حسابك الإداري.")
    user = await core.db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(404, "المستخدم غير موجود.")
    await core.db.users.update_one(
        {"id": user_id},
        {"$set": {
            "active": False,
            "disabled_at": core.now_iso(),
            "updated_at": core.now_iso(),
        }},
    )
    await _audit("user_disabled", admin, user)
    return {"ok": True}


@core.api_router.post("/auth/group-accounts")
async def group_directory_disabled():
    raise HTTPException(410, "تم إيقاف الدخول عبر معرف المجموعة. استخدم البريد المؤسسي وكلمة المرور.")


@core.api_router.get("/auth/invitation")
async def invitation_status(token: str):
    token = token.strip()
    if not token:
        raise HTTPException(422, "رمز الدعوة مطلوب.")
    user = await core.db.users.find_one(
        {"invite_token_hash": _token_hash(token)},
        {"_id": 0, "name": 1, "email": 1, "invite_expires_at": 1, "invitation_status": 1},
    )
    if not user:
        raise HTTPException(404, "الدعوة غير صالحة أو استُخدمت من قبل.")
    expires_at = datetime.fromisoformat(user["invite_expires_at"].replace("Z", "+00:00"))
    if expires_at <= _utcnow():
        await core.db.users.update_one(
            {"email": user["email"]},
            {"$set": {"invitation_status": "expired", "active": False}},
        )
        raise HTTPException(410, "انتهت صلاحية الدعوة. اطلب من مدير النظام إصدار دعوة جديدة.")
    return {
        "name": user.get("name"),
        "email": user.get("email"),
        "expires_at": user.get("invite_expires_at"),
        "status": user.get("invitation_status"),
    }


@core.api_router.post("/auth/activate")
async def activate_account(payload: ActivateAccountInput):
    token = payload.token.strip()
    if not token:
        raise HTTPException(422, "رمز الدعوة مطلوب.")
    _validate_password(payload.password)
    user = await core.db.users.find_one({"invite_token_hash": _token_hash(token)}, {"_id": 0})
    if not user:
        raise HTTPException(404, "الدعوة غير صالحة أو استُخدمت من قبل.")
    expires_at = datetime.fromisoformat(user["invite_expires_at"].replace("Z", "+00:00"))
    if expires_at <= _utcnow():
        raise HTTPException(410, "انتهت صلاحية الدعوة.")

    now = core.now_iso()
    await core.db.users.update_one(
        {"id": user["id"], "invite_token_hash": _token_hash(token)},
        {
            "$set": {
                "password_hash": core.hash_password(payload.password),
                "active": True,
                "invitation_status": "active",
                "activated_at": now,
                "password_changed_at": now,
                "updated_at": now,
            },
            "$unset": {
                "invite_token_hash": "",
                "invite_expires_at": "",
                "access_revoked_at": "",
            },
        },
    )
    await _audit("user_activated", None, user)
    return {"ok": True, "message": "تم تفعيل الحساب ويمكنك تسجيل الدخول الآن."}


core.app.router.on_startup[:] = [
    handler
    for handler in core.app.router.on_startup
    if getattr(handler, "__name__", "") != "seed_data"
]


@core.app.on_event("startup")
async def secure_access_startup() -> None:
    await core.db.users.create_index("email", unique=True)
    await core.db.users.create_index("invite_token_hash", unique=True, sparse=True)
    await core.db.security_events.create_index("created_at")

    demo_enabled = os.getenv("ENABLE_DEMO_USERS", "false").lower() == "true"
    if demo_enabled:
        for seed in core.SEED_USERS:
            await core.db.users.update_one(
                {"email": seed["email"].lower()},
                {
                    "$set": {
                        "password_hash": core.hash_password(seed["password"]),
                        "name": seed["name"],
                        "role": seed["role"],
                        "title": seed["title"],
                        "active": True,
                        "invitation_status": "active",
                        "demo": True,
                        "updated_at": core.now_iso(),
                    },
                    "$setOnInsert": {"id": core.new_id(), "created_at": core.now_iso()},
                },
                upsert=True,
            )
        logger.warning("تم تفعيل حسابات العرض بواسطة ENABLE_DEMO_USERS=true")
        return

    demo_filter = {
        "$or": [
            {"demo": True},
            {"email": {"$regex": r"@company\.demo$", "$options": "i"}},
        ]
    }
    active_admins = await core.db.users.find(
        {"role": "admin", "active": True},
        {"_id": 0},
    ).to_list(100)
    real_admin = next(
        (
            item
            for item in active_admins
            if not item.get("demo")
            and not str(item.get("email", "")).lower().endswith("@company.demo")
        ),
        None,
    )

    if real_admin:
        await core.db.users.update_many(
            demo_filter,
            {"$set": {
                "active": False,
                "demo": True,
                "migration_required": False,
                "updated_at": core.now_iso(),
            }},
        )
    else:
        await core.db.users.update_many(
            demo_filter,
            {"$set": {
                "demo": True,
                "migration_required": True,
                "updated_at": core.now_iso(),
            }},
        )
        logger.warning("وصول انتقالي مؤقت: لم يُفعّل مدير مؤسسي بعد.")

    pending_admin = await core.db.users.find_one(
        {"role": "admin", "invitation_status": "pending", "demo": {"$ne": True}},
        {"_id": 0},
    )
    if not real_admin and not pending_admin:
        email = os.getenv("BOOTSTRAP_ADMIN_EMAIL", "admin@araak.org").strip().lower()
        bootstrap = {
            "id": core.new_id(),
            "email": email,
            "password_hash": core.hash_password(secrets.token_urlsafe(48)),
            "name": os.getenv("BOOTSTRAP_ADMIN_NAME", "مدير النظام"),
            "role": "admin",
            "title": "مدير النظام والمنصة",
            "department": "إدارة النظام",
            "clearance": "executive_secret",
            "active": False,
            "invitation_status": "pending",
            "demo": False,
            "created_at": core.now_iso(),
            "updated_at": core.now_iso(),
        }
        raw_token, expires_at, activation_url = _new_invitation()
        bootstrap.update({
            "invite_token_hash": _token_hash(raw_token),
            "invite_expires_at": expires_at,
            "invited_at": core.now_iso(),
            "invited_by": "system-bootstrap",
        })
        await core.db.users.insert_one(bootstrap)
        logger.critical("رابط تفعيل مدير النظام لمرة واحدة: %s", activation_url)

    logger.info("تم تهيئة الدخول المؤسسي المغلق وإيقاف التسجيل العام.")
