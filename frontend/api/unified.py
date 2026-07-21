from __future__ import annotations

from urllib.parse import parse_qs

from api.index import DEMO_PASSWORD, USERS, app as backend_app, core


@backend_app.on_event("startup")
async def stabilize_hosted_users() -> None:
    """Ensure every cold serverless instance uses the same user IDs."""
    password_hash = core.hash_password(DEMO_PASSWORD)
    for index, profile in enumerate(USERS, start=1):
        stable_profile = {
            **profile,
            "id": f"vercel_usr_{index:02d}",
            "password_hash": password_hash,
            "active": True,
        }
        existing = await core.db.users.find_one({"email": profile["email"]})
        if existing:
            await core.db.users.update_one(
                {"email": profile["email"]},
                {"$set": stable_profile},
            )
        else:
            await core.db.users.insert_one(
                {
                    **stable_profile,
                    "created_at": core.now_iso(),
                }
            )


class UnifiedApiGateway:
    def __init__(self, target):
        self.target = target

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http":
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
