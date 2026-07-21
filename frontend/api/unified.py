from __future__ import annotations

import asyncio
from urllib.parse import parse_qs

from fastapi import HTTPException

import api.index as index_module

DEMO_PASSWORD = index_module.DEMO_PASSWORD
USERS = index_module.USERS
core = index_module.core
outer_app = index_module.app
mounted_app = index_module.backend_app
core_app = core.app


HOSTED_USER_PROFILES = {
    profile["email"].strip().lower(): {
        **profile,
        "email": profile["email"].strip().lower(),
        "id": f"vercel_usr_{index:02d}",
        "active": True,
    }
    for index, profile in enumerate(USERS, start=1)
}

_directory_ready = False
_directory_lock = asyncio.Lock()
_password_hash: str | None = None


async def ensure_hosted_directory() -> None:
    """Seed deterministic users in every Vercel cold instance."""
    global _directory_ready, _password_hash
    if _directory_ready:
        return

    async with _directory_lock:
        if _directory_ready:
            return

        if _password_hash is None:
            _password_hash = core.hash_password(DEMO_PASSWORD)

        for email, stable_profile in HOSTED_USER_PROFILES.items():
            database_profile = {
                **stable_profile,
                "email": email,
                "password_hash": _password_hash,
            }
            existing = await core.db.users.find_one({"email": email})
            if existing:
                await core.db.users.update_one(
                    {"email": email},
                    {"$set": database_profile},
                )
            else:
                await core.db.users.insert_one(
                    {
                        **database_profile,
                        "created_at": core.now_iso(),
                    }
                )

        _directory_ready = True


async def hosted_get_current_user(request):
    """Validate a signed session without relying on one serverless instance."""
    token = request.cookies.get("access_token")
    if not token:
        authorization = request.headers.get("Authorization", "")
        if authorization.startswith("Bearer "):
            token = authorization[7:].strip()

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = core.pyjwt.decode(
            token,
            core.JWT_SECRET,
            algorithms=[core.JWT_ALGORITHM],
        )
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")

        email = str(payload.get("email") or "").strip().lower()
        hosted_profile = HOSTED_USER_PROFILES.get(email)
        if hosted_profile:
            return dict(hosted_profile)

        user = None
        if email:
            user = await core.db.users.find_one(
                {"email": email},
                {"_id": 0, "password_hash": 0},
            )
        if not user and payload.get("sub"):
            user = await core.db.users.find_one(
                {"id": payload.get("sub")},
                {"_id": 0, "password_hash": 0},
            )
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.get("active", True):
            raise HTTPException(status_code=403, detail="User inactive")
        return user
    except core.pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except core.pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# The hosted stack has three FastAPI layers: the Vercel entry app, the Arabic
# shell, and the core office app mounted inside it. Every protected route must
# use the same stateless verifier.
outer_app.dependency_overrides[core.get_current_user] = hosted_get_current_user
mounted_app.dependency_overrides[core.get_current_user] = hosted_get_current_user
core_app.dependency_overrides[core.get_current_user] = hosted_get_current_user


@outer_app.on_event("startup")
async def stabilize_hosted_users_on_startup() -> None:
    await ensure_hosted_directory()


class UnifiedApiGateway:
    def __init__(self, target):
        self.target = target

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            await ensure_hosted_directory()

            query = parse_qs(scope.get("query_string", b"").decode("utf-8"))
            route = (query.get("route") or [""])[0].strip("/")
            if route:
                rewritten = dict(scope)
                path = f"/api/{route}"
                rewritten["path"] = path
                rewritten["raw_path"] = path.encode("utf-8")
                scope = rewritten

        await self.target(scope, receive, send)


app = UnifiedApiGateway(outer_app)
