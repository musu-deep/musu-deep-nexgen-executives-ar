"""تشغيل مكتب الرئيس التنفيذي الرقمي محليًا بصورة موثوقة."""
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
from urllib.parse import urlparse
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"
ENV_FILE = BACKEND_DIR / ".env"
ENV_EXAMPLE = BACKEND_DIR / ".env.example"
REQUIREMENTS = BACKEND_DIR / "requirements.txt"
APP_TITLE = "NEXGEN EXECUTIVES — النسخة العربية"


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


def port_is_open(host: str, port: int, timeout: float = 0.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def api_is_ready(port: int, timeout: float = 1.0) -> bool:
    """يتأكد أن المنفذ يشغّل هذا المشروع تحديدًا، لا تطبيقًا آخر."""
    try:
        with urlopen(f"http://127.0.0.1:{port}/openapi.json", timeout=timeout) as response:
            if not 200 <= response.status < 300:
                return False
            payload = json.loads(response.read().decode("utf-8"))
            return payload.get("info", {}).get("title") == APP_TITLE
    except (URLError, OSError, TimeoutError, UnicodeDecodeError, json.JSONDecodeError):
        return False


def ensure_python_dependencies() -> None:
    required_modules = ("fastapi", "uvicorn", "motor", "dotenv", "bcrypt", "jwt")
    missing = []
    for module in required_modules:
        try:
            importlib.import_module(module)
        except ImportError:
            missing.append(module)

    if not missing:
        return

    print(f"[NEXGEN] تثبيت اعتماديات الباكند الناقصة: {', '.join(missing)}")
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", str(REQUIREMENTS)],
        cwd=ROOT,
    )
    if result.returncode != 0:
        raise SystemExit("[NEXGEN] فشل تثبيت اعتماديات الباكند.")


def ensure_frontend_dependencies(npm: str) -> None:
    vite_candidates = [
        FRONTEND_DIR / "node_modules" / ".bin" / "vite",
        FRONTEND_DIR / "node_modules" / ".bin" / "vite.cmd",
    ]
    if any(path.exists() for path in vite_candidates):
        return

    print("[NEXGEN] تثبيت اعتماديات الواجهة...")
    result = subprocess.run(
        [npm, "--prefix", "frontend", "install", "--legacy-peer-deps"],
        cwd=ROOT,
    )
    if result.returncode != 0:
        raise SystemExit("[NEXGEN] فشل تثبيت اعتماديات الواجهة.")


def ensure_local_mongodb() -> subprocess.Popen | None:
    mongo_url = read_env_value("MONGO_URL", "mongodb://localhost:27017")
    parsed = urlparse(mongo_url)
    host = parsed.hostname or "localhost"
    port = parsed.port or 27017

    if host not in {"localhost", "127.0.0.1", "::1"}:
        print(f"[NEXGEN] استخدام قاعدة بيانات خارجية: {host}:{port}")
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
        for _ in range(30):
            if process.poll() is not None:
                break
            if port_is_open("127.0.0.1", port):
                return process
            time.sleep(0.5)
        terminate(process)

    print("\n[NEXGEN] تعذر الاتصال بـ MongoDB المحلية.")
    print("شغّل خدمة MongoDB ثم أعد تشغيل start-local.cmd أو npm run dev.")
    print("PowerShell كمسؤول:  Start-Service MongoDB")
    print("أو ضع رابط MongoDB Atlas داخل backend/.env في MONGO_URL.\n")
    raise SystemExit(2)


def choose_backend_port() -> tuple[int, bool]:
    preferred = int(os.getenv("BACKEND_PORT", "8001"))
    if api_is_ready(preferred):
        print(f"[NEXGEN] يوجد باكند صحيح وجاهز بالفعل على المنفذ {preferred}.")
        return preferred, True
    if not port_is_open("127.0.0.1", preferred):
        return preferred, False

    for port in range(preferred + 1, preferred + 50):
        if not port_is_open("127.0.0.1", port):
            print(f"[NEXGEN] المنفذ {preferred} مستخدم بواسطة تطبيق آخر؛ سيتم استخدام {port} تلقائيًا.")
            return port, False
    raise SystemExit("[NEXGEN] لم يتم العثور على منفذ متاح للباكند.")


def wait_for_backend(process: subprocess.Popen | None, port: int, timeout: int = 35) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if process is not None and process.poll() is not None:
            raise SystemExit(
                f"[NEXGEN] فشل تشغيل الباكند برمز {process.returncode}. راجع الرسالة الظاهرة أعلاه."
            )
        if api_is_ready(port):
            print(f"[NEXGEN] الباكند الصحيح جاهز على http://127.0.0.1:{port}/api/")
            return
        time.sleep(0.5)
    raise SystemExit(f"[NEXGEN] لم يستجب باكند NEXGEN على المنفذ {port} خلال المهلة المحددة.")


def terminate(process: subprocess.Popen | None) -> None:
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
    copy_env_if_missing()

    npm = shutil.which("npm.cmd") or shutil.which("npm")
    if not npm:
        print("[NEXGEN] لم يتم العثور على npm. ثبّت Node.js ثم أعد المحاولة.")
        return 2

    ensure_python_dependencies()
    ensure_frontend_dependencies(npm)
    mongo_process = ensure_local_mongodb()
    backend_port, reuse_backend = choose_backend_port()

    popen_options: dict = {"cwd": ROOT}
    if os.name != "nt":
        popen_options["start_new_session"] = True

    backend: subprocess.Popen | None = None
    frontend: subprocess.Popen | None = None

    try:
        if not reuse_backend:
            backend_command = [
                sys.executable,
                "-m",
                "uvicorn",
                "backend.arabic_server:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(backend_port),
            ]
            if os.getenv("NEXGEN_RELOAD", "false").lower() == "true":
                backend_command.append("--reload")
            backend = subprocess.Popen(backend_command, **popen_options)

        wait_for_backend(backend, backend_port)

        frontend_env = os.environ.copy()
        frontend_env["VITE_BACKEND_URL"] = f"http://127.0.0.1:{backend_port}"
        frontend = subprocess.Popen(
            [npm, "--prefix", "frontend", "run", "dev"],
            env=frontend_env,
            **popen_options,
        )

        print("\n[NEXGEN] تم تشغيل النظام بنجاح.")
        print("[NEXGEN] الواجهة: http://localhost:5173")
        print(f"[NEXGEN] الباكند: http://127.0.0.1:{backend_port}/api/")
        print("[NEXGEN] اضغط Ctrl+C لإيقاف النظام.\n")

        while True:
            if backend is not None and backend.poll() is not None:
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
