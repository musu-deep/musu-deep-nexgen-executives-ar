"""Vercel-safe aliases for persistent ARAAK CEO workflows."""
from __future__ import annotations

from typing import Any

from fastapi import Request
from starlette.routing import Mount

from .workflow_gateway import meeting_request_records, message_records


def register_workflow_alias_routes(app: Any, core: Any, odoo_server: Any) -> None:
    existing = {getattr(route, "path", None) for route in app.router.routes}
    if "/api/araak-ceo/meeting-requests" in existing:
        return

    initial_count = len(app.router.routes)

    async def meeting_requests_endpoint(request: Request):
        user = await core.get_current_user(request)
        return await meeting_request_records(core, odoo_server, user)

    async def messages_endpoint(request: Request):
        user = await core.get_current_user(request)
        return await message_records(core, odoo_server, user)

    app.add_api_route(
        "/api/araak-ceo/meeting-requests",
        meeting_requests_endpoint,
        methods=["GET"],
        tags=["ARAAK CEO"],
    )
    app.add_api_route(
        "/api/araak-ceo/messages",
        messages_endpoint,
        methods=["GET"],
        tags=["ARAAK CEO"],
    )

    added = app.router.routes[initial_count:]
    del app.router.routes[initial_count:]
    mount_index = next(
        (index for index, route in enumerate(app.router.routes) if isinstance(route, Mount)),
        len(app.router.routes),
    )
    for offset, route in enumerate(added):
        app.router.routes.insert(mount_index + offset, route)
