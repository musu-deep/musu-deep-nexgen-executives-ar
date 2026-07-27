"""Self-contained local entry point for ARAAK CEO.

The complete FastAPI application runs with an in-process async Mongo-compatible
fallback store. Persistent executive workflows are mirrored to Odoo, while the
local snapshot keeps development and offline operation available.
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
os.environ.setdefault("DB_NAME", "araak_ceo_local")

from . import server as core_server  # noqa: E402
from . import odoo_server  # noqa: E402
from . import advanced_intelligence  # noqa: E402
from .advanced_intelligence import register_advanced_intelligence_routes  # noqa: E402
from .pricing_intake import institutional_pricing_analysis, register_pricing_intake_routes  # noqa: E402
from .hr_gateway import register_hr_routes  # noqa: E402
from .office_gateway import register_office_routes  # noqa: E402
from .office_alias import register_office_alias_routes  # noqa: E402
from .workflow_gateway import register_workflow_routes  # noqa: E402
from .workflow_alias import register_workflow_alias_routes  # noqa: E402

app = odoo_server.app
# Keep legacy analysis route compatible while applying institutional language.
advanced_intelligence.analyse_pricing_documents = institutional_pricing_analysis
register_advanced_intelligence_routes(app, core_server)
register_pricing_intake_routes(app, core_server)
register_hr_routes(app, core_server, odoo_server)
register_office_routes(app, core_server, odoo_server)
register_office_alias_routes(app, core_server, odoo_server)
register_workflow_routes(app, core_server, odoo_server)
register_workflow_alias_routes(app, core_server, odoo_server)

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = Path(
    os.getenv(
        "EMBEDDED_DATA_FILE",
        str(ROOT / ".local" / "araak_ceo_data.json"),
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
