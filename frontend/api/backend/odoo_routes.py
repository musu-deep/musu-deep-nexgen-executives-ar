"""FastAPI routes for Odoo diagnostics and direct read access."""
from __future__ import annotations

from fastapi import Depends, HTTPException, Query

try:
    from .odoo_connector import OdooConnectorError, get_odoo_connector
    from .server import api_router, get_current_user, require_roles
except ImportError:  # pragma: no cover - local script mode
    from odoo_connector import OdooConnectorError, get_odoo_connector
    from server import api_router, get_current_user, require_roles


@api_router.get("/odoo/status")
async def odoo_status(user=Depends(get_current_user)):
    """Return safe Odoo configuration metadata without exposing the API key."""
    connector = get_odoo_connector()
    return await connector.status(check=False)


@api_router.post("/odoo/test")
async def odoo_test(user=Depends(require_roles("admin", "ceo"))):
    """Test Odoo connectivity and resolve the protocol actually in use."""
    connector = get_odoo_connector(refresh=True)
    return await connector.status(check=True)


@api_router.get("/odoo/projects")
async def odoo_projects(
    limit: int = Query(default=500, ge=1, le=2000),
    user=Depends(get_current_user),
):
    connector = get_odoo_connector()
    try:
        return await connector.projects(limit=limit)
    except OdooConnectorError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@api_router.get("/odoo/tasks")
async def odoo_tasks(
    limit: int = Query(default=1500, ge=1, le=5000),
    user=Depends(get_current_user),
):
    connector = get_odoo_connector()
    try:
        return await connector.tasks(limit=limit)
    except OdooConnectorError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
