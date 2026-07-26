from __future__ import annotations

from fastapi import Depends, HTTPException, Request
from fastapi.responses import JSONResponse

import api.secure_unified as secure
from api.backend import access_policy

outer_app = secure.outer_app
core = secure.core

route_marker = len(outer_app.router.routes)


@outer_app.get("/api/users")
async def users(user=Depends(secure.base.hosted_get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="إدارة المستخدمين متاحة لمدير المنصة فقط")
    return await core.db.users.find({}, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(1000)


@outer_app.get("/api/notification-settings")
async def notification_settings(user=Depends(secure.base.hosted_get_current_user)):
    if not access_policy.is_full_access(user):
        raise HTTPException(status_code=403, detail="إعدادات النظام مخصصة للرئيس التنفيذي ومدير المنصة")
    settings = await core.db.notification_settings.find_one({}, {"_id": 0})
    return settings or {
        "in_app_enabled": True,
        "email_enabled": False,
        "whatsapp_enabled": False,
        "events": {},
    }


new_routes = outer_app.router.routes[route_marker:]
old_routes = outer_app.router.routes[:route_marker]
outer_app.router.routes[:] = new_routes + old_routes


@outer_app.middleware("http")
async def restricted_read_guard(request: Request, call_next):
    path = request.url.path
    restricted_prefixes = (
        "/api/users", "/api/notification-settings", "/api/admin",
        "/api/voice", "/api/reports", "/api/odoo",
    )
    if request.method == "GET" and path.startswith(restricted_prefixes):
        try:
            user = await secure.base.hosted_get_current_user(request)
        except HTTPException as exc:
            return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)
        if path.startswith("/api/users"):
            allowed = user.get("role") == "admin"
        else:
            allowed = access_policy.is_full_access(user)
        if not allowed:
            return JSONResponse({"detail": "غير مصرح بالوصول إلى هذه البيانات"}, status_code=403)
    return await call_next(request)


app = secure.base.UnifiedApiGateway(outer_app)
