"""Self-contained local entry point for NEXGEN EXECUTIVES.

This entry point preserves the complete FastAPI application while replacing the
external MongoDB client with an in-process async Mongo-compatible database.
Run locally with:
    uvicorn backend.embedded_server:app
"""
from __future__ import annotations

import os

from mongomock_motor import AsyncMongoMockClient
import motor.motor_asyncio

# Patch Motor before backend.server imports AsyncIOMotorClient.
# AsyncMongoMockClient supports the async collection API used by the project.
motor.motor_asyncio.AsyncIOMotorClient = AsyncMongoMockClient

os.environ.setdefault("MONGO_URL", "mongodb://embedded.local:27017")
os.environ.setdefault("DB_NAME", "nexgen_executives_local")

from .arabic_server import app  # noqa: E402,F401
