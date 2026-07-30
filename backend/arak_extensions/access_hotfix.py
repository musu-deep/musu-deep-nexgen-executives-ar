"""Runtime safety net for migrated and newly invited Access Fabric users."""
from __future__ import annotations

from fastapi import Depends

try:
    from .. import server as core
except (ImportError, ValueError):
    import server as core  # type: ignore

from . import access_fabric as fabric


def _remove_route(path: str, method: str) -> None:
    core.api_router.routes[:] = [
        route
        for route in core.api_router.routes
        if not (
            getattr(route, "path", None) == path
            and method.upper() in set(getattr(route, "methods", set()) or set())
        )
    ]


async def ensure_user_assignment(user: dict) -> None:
    """Give legacy/new users a safe default assignment when none exists yet."""
    if not user or not user.get("id"):
        return

    existing = await core.db.role_assignments.find_one(
        {"user_id": user["id"], "active": True},
        {"_id": 0, "id": 1},
    )
    if existing:
        return

    role_code = fabric.LEGACY_ROLE_MAP.get(user.get("role"), "viewer")
    role = await core.db.access_roles.find_one(
        {"code": role_code, "active": True},
        {"_id": 0},
    )
    if not role:
        return

    root = await core.db.organization_units.find_one(
        {"code": "ARAAK"},
        {"_id": 0},
    )
    scope_id = root.get("id") if root else None
    now = core.now_iso()

    await core.db.role_assignments.update_one(
        {
            "user_id": user["id"],
            "role_id": role["id"],
            "scope_type": "global",
            "migration_source": "legacy_role",
        },
        {
            "$set": {
                "group_id": None,
                "scope_id": scope_id,
                "starts_at": None,
                "expires_at": None,
                "active": True,
                "updated_at": now,
            },
            "$setOnInsert": {
                "id": core.new_id(),
                "created_at": now,
            },
        },
        upsert=True,
    )

    await core.db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {
                "clearance": user.get("clearance") or role.get("clearance", "internal"),
                "access_fabric_version": 1,
                "updated_at": now,
            }
        },
    )


_remove_route("/access/me", "GET")


@core.api_router.get("/access/me")
async def resilient_my_access(user=Depends(core.get_current_user)):
    await ensure_user_assignment(user)
    refreshed = await core.db.users.find_one({"id": user["id"]}, {"_id": 0}) or user
    effective = await fabric.effective_permissions(refreshed)
    modules = sorted(
        {
            code.split(".")[1]
            for code in effective["permissions"]
            if code.startswith("module.")
            and code.endswith(".view")
            and len(code.split(".")) == 3
        }
    )
    if "dashboard" not in modules:
        modules.insert(0, "dashboard")

    return {
        "user_id": refreshed["id"],
        "permissions": effective["permissions"],
        "modules": modules,
        "roles": [item["role"] for item in effective["matches"]],
        "clearance": refreshed.get("clearance", "internal"),
    }


@core.app.on_event("startup")
async def reconcile_access_assignments() -> None:
    users = await core.db.users.find({}, {"_id": 0}).to_list(2000)
    for user in users:
        await ensure_user_assignment(user)
