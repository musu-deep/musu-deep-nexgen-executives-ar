"""Integrated Vercel FastAPI entry point for NEXGEN EXECUTIVES."""
from __future__ import annotations

import os

from fastapi import FastAPI

# Vercel Functions can write only to /tmp. The hosted edition uses an
# in-process Mongo-compatible store and seeds executive accounts on cold start.
os.environ.setdefault("EMBEDDED_DATA_FILE", "/tmp/nexgen_executives_data.json")
os.environ.setdefault("DB_NAME", "nexgen_executives_vercel")
os.environ.setdefault(
    "JWT_SECRET",
    "nexgen-vercel-demo-secret-change-in-project-settings-2026",
)

from backend import embedded_server  # noqa: E402

backend_app = embedded_server.app

# Create the ASGI application explicitly in this recognized Vercel entrypoint.
app = FastAPI(
    title="NEXGEN EXECUTIVES — Vercel",
    description="Full-stack hosted runtime for the digital CEO office",
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


# Keep the original /api routes and the Arabic AI overrides unchanged.
app.mount("/", backend_app)
