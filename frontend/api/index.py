"""Vercel FastAPI entry point inside the configured frontend root."""
from __future__ import annotations

import os
from fastapi import FastAPI

os.environ.setdefault("EMBEDDED_DATA_FILE", "/tmp/nexgen_executives_data.json")
os.environ.setdefault("DB_NAME", "nexgen_executives_vercel")
os.environ.setdefault(
    "JWT_SECRET",
    "nexgen-vercel-demo-secret-change-in-project-settings-2026",
)

from api.backend import embedded_server

backend_app = embedded_server.app
app = FastAPI(
    title="NEXGEN EXECUTIVES — Vercel",
    description="Hosted digital CEO office",
)


@app.on_event("startup")
async def initialize_vercel_runtime() -> None:
    await embedded_server.initialize_embedded_runtime()


@app.get("/api/health", include_in_schema=False)
async def health():
    return {
        "status": "ready",
        "service": "NEXGEN EXECUTIVES",
        "runtime": "vercel-python",
    }


@app.get("/api/openapi.json", include_in_schema=False)
async def openapi_schema():
    return backend_app.openapi()


app.mount("/", backend_app)
