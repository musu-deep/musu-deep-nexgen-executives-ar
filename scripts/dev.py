"""تشغيل النسخة العربية محليًا: الواجهة والباكند في أمر واحد."""
from __future__ import annotations

import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
ENV_FILE = BACKEND_DIR / ".env"
ENV_EXAMPLE = BACKEND_DIR / ".env.example"


def copy_env_if_missing() -> None:
    if not ENV_FILE.exists() and ENV_EXAMPLE.exists():
        shutil.copyfile(ENV_EXAMPLE, ENV_FILE)
        print("[NEXGEN] تم إنشاء backend/.env من ملف المثال.")


def read_env_value(key: str, default: str = "") -> str:
    if not ENV_FILE.exists():
        return default
    for raw_line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        if name.strip() == key:
            return value.strip().strip('"').strip("'")
    return default


def port_is_open(host: str, port: int, timeout: float = 0.7) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def ensure_local_mongodb() -> subprocess.Popen | None:
    mongo_url = read_env_value("MONGO_URL", "mongodb://localhost:27017")
    parsed = urlparse(mongo_url)
    host = parsed.hostname or "localhost"
    port = parsed.port or 27017

    if host not in {"localhost", "127.0.0.1", "::1"}:
        return None
    if port_is_open(host, port):
        print(f"[NEXGEN] MongoDB متاحة على {host}:{port}.")
        return None

    mongod = shutil.which("mongod")
    if mongod:
        data_dir = ROOT / ".local" / "mongodb"
        data_dir.mkdir(parents=True, exist_ok=True)
        print(f"[NEXGEN] تشغيل MongoDB المحلية تلقائيًا على المنفذ {port}...")
        process = subprocess.Popen(
            [mongod, "--dbpath", str(data_dir), "--bind_ip", "127.0.0.1", "--port", str(port)],
            cwd=ROOT,
        )
        for _ in range(20):
            if process.poll() is not None:
                break
            if port_is_open("127.0.0.1", port):
                return process
            time.sleep(0.5)
        process.terminate()

    print("\n[NEXGEN] تعذر الاتصال بـ MongoDB المحلية.")
    print("شغّل خدمة MongoDB أولًا، ثم أعد تنفيذ: npm run dev")
    print("PowerShell كمسؤول:  Start-Service MongoDB")
    print("أو ضع رابط MongoDB Atlas في backend/.env داخل MONGO_URL.\n")
    raise SystemExit(2)


def terminate(process: subprocess.Popen | None) -> None:
    if process is None or process.poll() is not None:
        return
    try:
        if os.name == "nt":
            process.terminate()
        else:
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    except Exception:
        process.kill()


def main() -> int:
    copy_env_if_missing()

    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        print("[NEXGEN] لم يتم العثور على npm. ثبّت Node.js ثم أعد المحاولة.")
        return 2

    mongo_process = ensure_local_mongodb()
    popen_options: dict = {"cwd": ROOT}
    if os.name != "nt":
        popen_options["start_new_session"] = True

    backend = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "backend.arabic_server:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8001",
            "--reload",
        ],
        **popen_options,
    )
    frontend = subprocess.Popen(
        [npm, "--prefix", "frontend", "run", "dev"],
        **popen_options,
    )

    print("\n[NEXGEN] الواجهة: http://localhost:5173")
    print("[NEXGEN] الباكند: http://localhost:8001/api/")
    print("[NEXGEN] اضغط Ctrl+C لإيقاف النظام.\n")

    try:
        while True:
            if backend.poll() is not None:
                print(f"[NEXGEN] توقف الباكند برمز {backend.returncode}.")
                return backend.returncode or 1
            if frontend.poll() is not None:
                print(f"[NEXGEN] توقفت الواجهة برمز {frontend.returncode}.")
                return frontend.returncode or 1
            time.sleep(0.5)
    except KeyboardInterrupt:
        return 0
    finally:
        terminate(frontend)
        terminate(backend)
        terminate(mongo_process)


if __name__ == "__main__":
    raise SystemExit(main())
