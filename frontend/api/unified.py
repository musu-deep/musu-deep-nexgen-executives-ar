from __future__ import annotations

from urllib.parse import parse_qs

from api.index import DEMO_PASSWORD, USERS, app as backend_app, core


# Vercel may execute login and subsequent API requests in different cold
# instances. Keep the signed session authoritative so authentication does not
# depend on finding the same in-memory database record in another instance.
core.HOSTED_USER_PROFILES = {
    profile["email"].lower(): {
        **profile,
        "id": f"vercel_usr_{index:02d}",
        "active": True,
    }
    for index, profile in enumerate(USERS, start=1)
}


async def hosted_get_current_user(request):
    token = request.cookies.get("access_token")
    if not token:
        authorization = request.headers.get("Authorization", "")
        if authorization.startswith("Bearer "):
            token = authorization[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")

        email = str(payload.get("email") or "").strip().lower()
        hosted_profile = HOSTED_USER_PROFILES.get(email)
        if hosted_profile:
            return dict(hosted_profile)

        user = await db.users.find_one(
            {"id": payload.get("sub")},
            {"_id": 0, "password_hash": 0},
        )
        if not user and email:
            user = await db.users.find_one(
                {"email": email},
                {"_id": 0, "password_hash": 0},
            )
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.get("active", True):
            raise HTTPException(status_code=403, detail="User inactive")
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# FastAPI dependencies keep a reference to the original function object.
# Replacing its code updates every already-registered route consistently.
core.get_current_user.__code__ = hosted_get_current_user.__code__


@backend_app.on_event("startup")
async def stabilize_hosted_users() -> None:
    """Ensure every cold serverless instance uses the same user IDs."""
    password_hash = core.hash_password(DEMO_PASSWORD)
    for email, stable_profile in core.HOSTED_USER_PROFILES.items():
        database_profile = {
            **stable_profile,
            "email": email,
            "password_hash": password_hash,
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
