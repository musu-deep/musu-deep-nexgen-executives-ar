"""Vercel ASGI entry point for the digital CEO office.

The Vite frontend and this FastAPI application are deployed on the same Vercel
domain. Production requests use relative /api URLs, so no VITE_BACKEND_URL is
required for the integrated deployment.
"""
from __future__ import annotations

import os

# Vercel Functions can write only to /tmp. The hosted demo uses an in-process
# Mongo-compatible store and seeds its executive accounts on cold start.
os.environ.setdefault("EMBEDDED_DATA_FILE", "/tmp/nexgen_executives_data.json")
os.environ.setdefault("DB_NAME", "nexgen_executives_vercel")
os.environ.setdefault(
    "JWT_SECRET",
    "nexgen-vercel-demo-secret-change-in-project-settings-2026",
)

from backend.embedded_server import app  # noqa: E402,F401


@app.get("/api/openapi.json", include_in_schema=False)
async def vercel_openapi_schema():
    """Expose FastAPI's schema under the Vercel function prefix."""
    return app.openapi()


@app.get("/api/health", include_in_schema=False)
async def vercel_health():
    return {
        "status": "ready",
        "service": "NEXGEN EXECUTIVES",
        "runtime": "vercel-python",
    }
