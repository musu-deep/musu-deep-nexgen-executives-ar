"""تشغيل مكتب الرئيس التنفيذي الرقمي دون MongoDB أو خدمات خارجية."""
from __future__ import annotations

import importlib
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = ROOT / "frontend"
REQUIREMENTS = ROOT / "backend" / "requirements.txt"
APP_TITLE = "NEXGEN EXECUTIVES — النسخة العربية"


def port_open(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=0.4):
            return True
    except OSError:
        return False


def app_ready(port: int) -> bool:
    try:
        with urlopen(f"http://127.0.0.1:{port}/openapi.json", timeout=1) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return payload.get("info", {}).get("title") == APP_TITLE
    except (URLError, OSError, TimeoutError, UnicodeDecodeError, json.JSONDecodeError):
        return False


def ensure_backend_dependencies() -> None:
    modules = ("fastapi", "uvicorn", "motor", "mongomock_motor", "dotenv", "bcrypt", "jwt")
    missing = []
    for module in modules:
        try:
            importlib.import_module(module)
        except ImportError:
            missing.append(module)
    if not missing:
        return
    print(f"[NEXGEN] تثبيت مكونات الباكند الناقصة: {', '.join(missing)}")
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", str(REQUIREMENTS)],
        cwd=ROOT,
    )
    if result.returncode:
        raise SystemExit("[NEXGEN] فشل تثبيت مكونات الباكند.")


def ensure_frontend_dependencies(npm: str) -> None:
    candidates = (
        FRONTEND_DIR / "node_modules" / ".bin" / "vite",
        FRONTEND_DIR / "node_modules" / ".bin" / "vite.cmd",
    )
    if any(path.exists() for path in candidates):
        return
    print("[NEXGEN] تثبيت مكونات الواجهة...")
    result = subprocess.run(
        [npm, "--prefix", "frontend", "install", "--legacy-peer-deps"],
        cwd=ROOT,
    )
    if result.returncode:
        raise SystemExit("[NEXGEN] فشل تثبيت مكونات الواجهة.")


def choose_port() -> tuple[int, bool]:
    preferred = int(os.getenv("BACKEND_PORT", "8001"))
    if app_ready(preferred):
        return preferred, True
    if not port_open(preferred):
        return preferred, False
    for port in range(preferred + 1, preferred + 60):
        if not port_open(port):
            print(f"[NEXGEN] المنفذ {preferred} مستخدم؛ تم اختيار {port} للباكند.")
            return port, False
    raise SystemExit("[NEXGEN] لا يوجد منفذ متاح للباكند.")


def wait_for_app(process: subprocess.Popen | None, port: int) -> None:
    deadline = time.time() + 45
    while time.time() < deadline:
        if process is not None and process.poll() is not None:
            raise SystemExit(f"[NEXGEN] توقف الباكند أثناء البدء برمز {process.returncode}.")
        if app_ready(port):
            return
        time.sleep(0.5)
    raise SystemExit("[NEXGEN] لم يبدأ الباكند المدمج خلال المهلة المحددة.")


def stop(process: subprocess.Popen | None) -> None:
    if process is None or process.poll() is not None:
        return
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        else:
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    except Exception:
        process.kill()


def main() -> int:
    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        print("[NEXGEN] لم يتم العثور على npm. ثبّت Node.js أولًا.")
        return 2

    ensure_backend_dependencies()
    ensure_frontend_dependencies(npm)
    port, reuse = choose_port()

    options: dict = {"cwd": ROOT}
    if os.name != "nt":
        options["start_new_session"] = True

    backend = None
    frontend = None
    try:
        if not reuse:
            backend = subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "backend.embedded_server:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    str(port),
                ],
                **options,
            )
        wait_for_app(backend, port)

        frontend_env = os.environ.copy()
        frontend_env["VITE_BACKEND_URL"] = f"http://127.0.0.1:{port}"
        frontend = subprocess.Popen(
            [npm, "--prefix", "frontend", "run", "dev"],
            env=frontend_env,
            **options,
        )

        print("\n==================================================")
        print("  NEXGEN EXECUTIVES — تم التشغيل بنجاح")
        print("==================================================")
        print("[NEXGEN] قاعدة البيانات: مدمجة داخل النظام")
        print("[NEXGEN] الواجهة: http://localhost:5173")
        print(f"[NEXGEN] الباكند: http://127.0.0.1:{port}/api/")
        print("[NEXGEN] لا تحتاج إلى MongoDB أو Atlas.")
        print("[NEXGEN] اضغط Ctrl+C للإيقاف.\n")

        while True:
            if backend is not None and backend.poll() is not None:
                return backend.returncode or 1
            if frontend.poll() is not None:
                return frontend.returncode or 1
            time.sleep(0.5)
    except KeyboardInterrupt:
        return 0
    finally:
        stop(frontend)
        stop(backend)


if __name__ == "__main__":
    raise SystemExit(main())
