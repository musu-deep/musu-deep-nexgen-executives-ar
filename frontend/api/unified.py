from __future__ import annotations

import asyncio
from urllib.parse import parse_qs

from api.index import DEMO_PASSWORD, USERS, app as backend_app, core


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
    """Seed deterministic users in every Vercel cold instance.

    Vercel can execute login and subsequent API requests in different
    serverless instances. The original backend validates a token by looking up
    its subject ID in the local store, so every instance must use identical
    user IDs before handling a request.
    """
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


@backend_app.on_event("startup")
async def stabilize_hosted_users_on_startup() -> None:
    await ensure_hosted_directory()


class UnifiedApiGateway:
    def __init__(self, target):
        self.target = target

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
            # Do not rely solely on lifespan/startup hooks in a serverless
            # runtime. Guarantee deterministic identities before every first
            # request handled by a cold instance.
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


app = UnifiedApiGateway(backend_app)
