from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(f"Could not locate {label}")
    return text.replace(old, new, 1)


def main() -> None:
    server_path = ROOT / "backend" / "server.py"
    text = server_path.read_text(encoding="utf-8")

    text = replace_once(
        text,
        "from motor.motor_asyncio import AsyncIOMotorClient\n",
        "from motor.motor_asyncio import AsyncIOMotorClient\n"
        "try:\n"
        "    from mongomock_motor import AsyncMongoMockClient\n"
        "except ImportError:\n"
        "    AsyncMongoMockClient = None\n",
        "Mongo client import",
    )

    text = replace_once(
        text,
        "mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')\n"
        "client = AsyncIOMotorClient(mongo_url)\n"
        "db = client[os.getenv('DB_NAME', 'ceo_office')]\n",
        "mongo_url = os.getenv('MONGO_URL', 'memory://local').strip()\n"
        "use_embedded_db = os.getenv('USE_EMBEDDED_DB', 'true').strip().lower() in {'1', 'true', 'yes', 'on'}\n\n"
        "if use_embedded_db or mongo_url.startswith(('memory://', 'embedded://')):\n"
        "    if AsyncMongoMockClient is None:\n"
        "        raise RuntimeError('mongomock-motor is required for embedded database mode')\n"
        "    client = AsyncMongoMockClient()\n"
        "    DB_MODE = 'embedded-memory'\n"
        "else:\n"
        "    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=3000)\n"
        "    DB_MODE = 'mongodb'\n\n"
        "db = client[os.getenv('DB_NAME', 'ceo_office')]\n",
        "database initialization",
    )

    text = text.replace(
        'logger.info("Seed complete")',
        'logger.info("Seed complete — database mode: %s", DB_MODE)',
    )
    text = text.replace(
        '@app.on_event("shutdown")\nasync def shutdown():\n    client.close()\n',
        '@app.on_event("shutdown")\nasync def shutdown():\n'
        '    close = getattr(client, "close", None)\n'
        '    if callable(close):\n'
        '        close()\n',
    )
    text = text.replace(
        'return {"message": "Arak Executive Platform API"}',
        'return {"message": "NEXGEN Executive Office API", "database_mode": DB_MODE, "status": "ready"}',
    )
    server_path.write_text(text, encoding="utf-8")

    requirements_path = ROOT / "backend" / "requirements.txt"
    requirements = requirements_path.read_text(encoding="utf-8").rstrip() + "\n"
    if "mongomock-motor" not in requirements:
        requirements += "mongomock-motor>=0.0.36\n"
    requirements_path.write_text(requirements, encoding="utf-8")

    env_path = ROOT / "backend" / ".env.example"
    env_text = env_path.read_text(encoding="utf-8")
    env_text = env_text.replace("MONGO_URL=mongodb://localhost:27017", "MONGO_URL=memory://local")
    if "USE_EMBEDDED_DB=" not in env_text:
        env_text = "USE_EMBEDDED_DB=true\n" + env_text
    env_path.write_text(env_text, encoding="utf-8")

    dev_path = ROOT / "scripts" / "dev.py"
    dev_text = dev_path.read_text(encoding="utf-8")
    dev_text = dev_text.replace(
        'required_modules = ("fastapi", "uvicorn", "motor", "dotenv", "bcrypt", "jwt")',
        'required_modules = ("fastapi", "uvicorn", "motor", "mongomock_motor", "dotenv", "bcrypt", "jwt")',
    )
    dev_text = dev_text.replace(
        "    mongo_process = ensure_local_mongodb()\n    backend_port, reuse_backend = choose_backend_port()\n",
        "    embedded = read_env_value('USE_EMBEDDED_DB', 'true').lower() in {'1', 'true', 'yes', 'on'}\n"
        "    if embedded:\n"
        "        mongo_process = None\n"
        "        print('[NEXGEN] قاعدة البيانات المدمجة جاهزة — لا حاجة إلى MongoDB.')\n"
        "    else:\n"
        "        mongo_process = ensure_local_mongodb()\n"
        "    backend_port, reuse_backend = choose_backend_port()\n",
    )
    dev_path.write_text(dev_text, encoding="utf-8")

    readme_path = ROOT / "README.md"
    readme = readme_path.read_text(encoding="utf-8")
    readme = readme.replace(
        "- تحفظ البيانات التشغيلية في MongoDB محلية افتراضيًا.",
        "- يعمل النظام افتراضيًا بقاعدة بيانات مدمجة داخل الباكند دون الحاجة إلى تثبيت MongoDB.",
    )
    heading = "## التشغيل المحلي والخصوصية\n"
    note = (
        "## التشغيل المحلي والخصوصية\n\n"
        "> **الوضع الافتراضي:** قاعدة بيانات مدمجة تعمل داخل الباكند مباشرة؛ لا تحتاج إلى MongoDB أو Atlas. "
        "يمكن التحول إلى MongoDB لاحقًا بضبط `USE_EMBEDDED_DB=false` و`MONGO_URL`.\n"
    )
    if heading in readme and "**الوضع الافتراضي:**" not in readme:
        readme = readme.replace(heading, note, 1)
    readme_path.write_text(readme, encoding="utf-8")

    print("Embedded local runtime enabled")


if __name__ == "__main__":
    main()
