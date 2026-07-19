"""Self-contained local entry point for NEXGEN EXECUTIVES.

The complete FastAPI application runs with an in-process async Mongo-compatible
store. Data is persisted to a local JSON snapshot so projects, tasks and office
records survive restarts without requiring MongoDB.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from mongomock_motor import AsyncMongoMockClient
import motor.motor_asyncio

# Patch Motor before backend.server imports AsyncIOMotorClient.
motor.motor_asyncio.AsyncIOMotorClient = AsyncMongoMockClient

os.environ.setdefault("MONGO_URL", "mongodb://embedded.local:27017")
os.environ.setdefault("DB_NAME", "nexgen_executives_local")

from . import server as core_server  # noqa: E402
from .arabic_server import app  # noqa: E402,F401

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = Path(
    os.getenv(
        "EMBEDDED_DATA_FILE",
        str(ROOT / ".local" / "nexgen_executives_data.json"),
    )
)


async def load_snapshot() -> None:
    if not DATA_FILE.exists():
        return
    try:
        payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return

    for collection_name, documents in payload.items():
        if not isinstance(documents, list) or not documents:
            continue
        collection = core_server.db[collection_name]
        if await collection.count_documents({}) == 0:
            await collection.insert_many(documents)


async def save_snapshot() -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    snapshot: dict[str, list[dict]] = {}
    collection_names = await core_server.db.list_collection_names()
    for collection_name in collection_names:
        documents = await core_server.db[collection_name].find(
            {}, {"_id": 0}
        ).to_list(10000)
        snapshot[collection_name] = documents

    temporary = DATA_FILE.with_suffix(DATA_FILE.suffix + ".tmp")
    temporary.write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    temporary.replace(DATA_FILE)


@app.on_event("startup")
async def initialize_embedded_runtime() -> None:
    """Restore local records, then seed the office when it is first launched."""
    await load_snapshot()
    if await core_server.db.users.count_documents({}) == 0:
        await core_server.seed_data()


@app.on_event("shutdown")
async def persist_embedded_runtime() -> None:
    """Save all embedded office records before the local server exits."""
    await save_snapshot()
