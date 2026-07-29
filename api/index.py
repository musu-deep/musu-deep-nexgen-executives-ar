"""Integrated Vercel FastAPI entry point for NEXGEN EXECUTIVES."""
from __future__ import annotations

import os

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

# Vercel Functions can write only to /tmp. The hosted edition uses an
# in-process Mongo-compatible store and seeds executive accounts on cold start.
os.environ.setdefault("EMBEDDED_DATA_FILE", "/tmp/nexgen_executives_data.json")
os.environ.setdefault("DB_NAME", "nexgen_executives_vercel")
os.environ.setdefault(
    "JWT_SECRET",
    "nexgen-vercel-demo-secret-change-in-project-settings-2026",
)

from backend import embedded_server  # noqa: E402
from backend.marketing_odoo_gateway import execute as execute_marketing_action  # noqa: E402

backend_app = embedded_server.app

# Create the ASGI application explicitly in this recognized Vercel entrypoint.
app = FastAPI(
    title="NEXGEN EXECUTIVES — Vercel",
    description="Full-stack hosted runtime for the digital CEO office",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def initialize_vercel_runtime() -> None:
    await embedded_server.initialize_embedded_runtime()


@app.get("/api/health", include_in_schema=False)
async def vercel_health():
    return {
        "status": "ready",
        "service": "NEXGEN EXECUTIVES",
        "runtime": "vercel-python",
    }


@app.get("/api/openapi.json", include_in_schema=False)
async def vercel_openapi_schema():
    return backend_app.openapi()


@app.post("/api/marketing", include_in_schema=False)
async def marketing_gateway(
    request: Request,
    user: dict = Depends(embedded_server.core_server.get_current_user),
):
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    try:
        return await execute_marketing_action(payload, user)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail="تعذر تنفيذ العملية في السجل المركزي.") from error


# Keep the original /api routes and the Arabic AI overrides unchanged.
app.mount("/", backend_app)
