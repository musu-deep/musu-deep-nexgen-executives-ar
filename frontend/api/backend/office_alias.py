"""Stable aliases for Odoo office reads behind the Vercel mounted backend."""
from __future__ import annotations

from typing import Any

from fastapi import Request
from starlette.routing import Mount

from .office_gateway import meeting_records


def register_office_alias_routes(app: Any, core: Any, odoo_server: Any) -> None:
    existing = {getattr(route, "path", None) for route in app.router.routes}
    if "/api/office/meetings" in existing:
        return

    initial_count = len(app.router.routes)

    async def meetings_endpoint(request: Request):
        user = await core.get_current_user(request)
        items, warning = await meeting_records(core, odoo_server, user)
        return {
            "source": "odoo-hybrid" if any(item.get("source") == "odoo" for item in items) else "platform",
            "warning": warning,
            "meetings": items,
            "total": len(items),
        }

    app.add_api_route(
        "/api/office/meetings",
        meetings_endpoint,
        methods=["GET"],
        tags=["Odoo Office"],
    )

    added = app.router.routes[initial_count:]
    del app.router.routes[initial_count:]
    mount_index = next(
        (index for index, route in enumerate(app.router.routes) if isinstance(route, Mount)),
        len(app.router.routes),
    )
    for offset, route in enumerate(added):
        app.router.routes.insert(mount_index + offset, route)
