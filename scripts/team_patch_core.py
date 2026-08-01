from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "scripts" / "official_team_data.json").read_text(encoding="utf-8"))
USERS = DATA["users"]
VERSION = DATA["directory_version"]


def sub1(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Expected one replacement for {label}, got {count}")
    return updated


def q(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def password_roster() -> str:
    rows = []
    for u in USERS:
        rows.append(
            "  {\n"
            f"    id: {q(u['id'])},\n"
            f"    email: {q(u['email'])},\n"
            f"    name: {q(u['name'])},\n"
            f"    role: {q(u['role'])},\n"
            f"    title: {q(u['title'])},\n"
            f"    department: {q(u['department'])},\n"
            f"    clearance: {q(u['clearance'])},\n"
            f"    capabilities: {q(u.get('capabilities', []))},\n"
            f"    temporary_salt: {q(u['temporary_salt'])},\n"
            f"    temporary_hash: {q(u['temporary_hash'])},\n"
            "  }"
        )
    return "const USER_ROSTER = Object.freeze([\n" + ",\n".join(rows) + "\n]);"


def public_users() -> str:
    rows = []
    for u in USERS:
        rows.append(
            "  { "
            f"id: {q(u['id'])}, email: {q(u['email'])}, name: {q(u['name'])}, "
            f"role: {q(u['role'])}, title: {q(u['title'])}, department: {q(u['department'])}, "
            f"clearance: {q(u['clearance'])}, capabilities: {q(u.get('capabilities', []))}, active: true "
            "}"
        )
    return "const USERS = [\n" + ",\n".join(rows) + "\n];"


def patch_password_directory() -> None:
    path = ROOT / "lib" / "araak-password-directory.js"
    text = path.read_text(encoding="utf-8")
    text = re.sub(r'const DIRECTORY_VERSION = "[^"]+";', f'const DIRECTORY_VERSION = "{VERSION}";', text, count=1)
    text = sub1(
        text,
        r'// The executive access roster.*?const USER_ROSTER = Object\.freeze\(\[.*?\n\]\);',
        "// Official ARAAK team directory. Temporary credentials are stored only as scrypt hashes and salts.\n" + password_roster(),
        "password roster",
    )
    text = text.replace("version: 2,\n    directory_version", "version: 3,\n    directory_version", 1)
    path.write_text(text, encoding="utf-8")


def patch_authorized_access() -> None:
    path = ROOT / "lib" / "authorized-access.js"
    text = path.read_text(encoding="utf-8")
    emails = "\n".join(f"  {q(u['email'])}," for u in USERS)
    ids = "\n".join(f"  {q(u['id'])}," for u in USERS)
    text = sub1(text, r'const AUTHORIZED_EMAILS = new Set\(\[.*?\n\]\);', f"const AUTHORIZED_EMAILS = new Set([\n{emails}\n]);", "authorized emails")
    text = sub1(text, r'const AUTHORIZED_IDS = new Set\(\[.*?\n\]\);', f"const AUTHORIZED_IDS = new Set([\n{ids}\n]);", "authorized ids")
    path.write_text(text, encoding="utf-8")


def patch_business_api() -> None:
    path = ROOT / "api" / "[...path].js"
    text = path.read_text(encoding="utf-8")
    text = sub1(text, r'const USERS = \[.*?\n\];\n\nconst PROJECTS = \[', public_users() + "\n\nconst PROJECTS = [", "business users")
    text = text.replace('owner_id: "usr_inv"', 'owner_id: "usr_finance"')
    text = text.replace('owner_id: "usr_mgr"', 'owner_id: "usr_national"')
    text = text.replace('"usr_inv"', '"usr_finance"').replace('"usr_track"', '"usr_followup"')

    helpers = '''function currentUser(request) {
  const auth = request.headers.authorization || request.headers.Authorization || "";
  return parseToken(auth.startsWith("Bearer ") ? auth.slice(7) : "");
}

function isAdmin(user) {
  return user?.role === "admin";
}

function canViewAllPlatform(user) {
  return ["admin", "ceo", "marketing_tenders"].includes(user?.role)
    || (user?.capabilities || []).includes("platform:read_all");
}

function canAssignTasks(user) {
  return ["admin", "ceo", "tracker", "marketing_tenders"].includes(user?.role)
    || (user?.capabilities || []).includes("tasks:assign");
}

function rag'''
    text = sub1(text, r'function currentUser\(request\) \{.*?\n\}\n\nfunction rag', helpers, "permission helpers")

    text = text.replace(
        '  if (route === "theme" && method === "PUT") { store.theme = payload.active_theme || store.theme; return send(response, 200, { active_theme: store.theme }); }',
        '  if (route === "theme" && method === "PUT") { if (!isAdmin(user)) return send(response, 403, { detail: "إدارة مظهر المنصة متاحة لمدير النظام فقط." }); store.theme = payload.active_theme || store.theme; return send(response, 200, { active_theme: store.theme }); }',
        1,
    )
    text = text.replace(
        '  if (route === "notification-settings" && method === "PUT") { store.notificationSettings = { ...store.notificationSettings, ...payload, events: { ...store.notificationSettings.events, ...(payload.events || {}) } }; return send(response, 200, store.notificationSettings); }',
        '  if (route === "notification-settings" && method === "PUT") { if (!isAdmin(user)) return send(response, 403, { detail: "إدارة إعدادات المنصة متاحة لمدير النظام فقط." }); store.notificationSettings = { ...store.notificationSettings, ...payload, events: { ...store.notificationSettings.events, ...(payload.events || {}) } }; return send(response, 200, store.notificationSettings); }',
        1,
    )

    user_routes = '''  if (route === "users" && method === "GET") {
    if (!isAdmin(user)) return send(response, 403, { detail: "إدارة المستخدمين متاحة لمدير النظام فقط." });
    return send(response, 200, store.users.map(safeUser));
  }
  if ((route === "users" || segments[0] === "users") && ["POST", "PATCH", "DELETE"].includes(method)) {
    if (!isAdmin(user)) return send(response, 403, { detail: "إدارة المستخدمين متاحة لمدير النظام فقط." });
    return send(response, 410, { detail: "تتم إدارة الحسابات الرسمية من دليل الهوية المؤسسية المعتمد." });
  }

  if (route === "dashboard"'''
    text = sub1(text, r'  if \(route === "users" && method === "GET"\).*?\n\n  if \(route === "dashboard"', user_routes, "admin-only users")

    old_create = '''  if (route === "tasks" && method === "POST") {
    const created = { ...payload, id: id("tsk"), created_by: user.id, created_at: now(), updated_at: now(), progress: Number(payload.progress || 0) };
    store.tasks.unshift(created); return send(response, 201, created);
  }'''
    new_create = '''  if (route === "tasks" && method === "POST") {
    if (payload.assignee_id && payload.assignee_id !== user.id && !canAssignTasks(user)) {
      return send(response, 403, { detail: "لا تملك صلاحية توزيع المهام على أعضاء الفريق." });
    }
    const created = { ...payload, id: id("tsk"), assignee_id: payload.assignee_id || user.id, created_by: user.id, created_at: now(), updated_at: now(), progress: Number(payload.progress || 0) };
    store.tasks.unshift(created); return send(response, 201, created);
  }'''
    if old_create not in text:
        raise SystemExit("Task create block not found")
    text = text.replace(old_create, new_create, 1)

    old_tasks = '''  if (segments[0] === "tasks" && segments[1]) {
    const item = store.tasks.find((entry) => entry.id === segments[1]);
    if (!item) return send(response, 404, { detail: "Task not found" });
    if (segments[2] === "approve" && method === "POST") { Object.assign(item, { status: "completed", progress: 100, updated_at: now() }); return send(response, 200, item); }
    if (method === "PATCH") { Object.assign(item, payload, { updated_at: now() }); return send(response, 200, item); }
'''
    new_tasks = '''  if (segments[0] === "tasks" && segments[1]) {
    const item = store.tasks.find((entry) => entry.id === segments[1]);
    if (!item) return send(response, 404, { detail: "Task not found" });
    if (segments[2] === "approve" && method === "POST") { Object.assign(item, { status: "completed", progress: 100, updated_at: now() }); return send(response, 200, item); }
    if (method === "PATCH") { if (payload.assignee_id && payload.assignee_id !== item.assignee_id && !canAssignTasks(user)) return send(response, 403, { detail: "لا تملك صلاحية إعادة إسناد المهمة." }); Object.assign(item, payload, { updated_at: now() }); return send(response, 200, item); }
'''
    if old_tasks not in text:
        raise SystemExit("Task update block not found")
    text = text.replace(old_tasks, new_tasks, 1)

    text = text.replace(
        '  if (route === "messages" && method === "GET") return send(response, 200, store.messages.filter((message) => message.sender_id === user.id || message.recipient_id === user.id || ["admin", "ceo", "tracker"].includes(user.role)));',
        '  if (route === "messages" && method === "GET") return send(response, 200, store.messages.filter((message) => message.sender_id === user.id || message.recipient_id === user.id || canViewAllPlatform(user) || user.role === "tracker"));',
        1,
    )
    text = text.replace(
        '  if (route === "notifications" && method === "GET") return send(response, 200, store.notifications.filter((item) => item.user_id === user.id || ["admin", "ceo"].includes(user.role)));',
        '  if (route === "notifications" && method === "GET") return send(response, 200, store.notifications.filter((item) => item.user_id === user.id || canViewAllPlatform(user)));',
        1,
    )
    path.write_text(text, encoding="utf-8")


def apply() -> None:
    patch_password_directory()
    patch_authorized_access()
    patch_business_api()
