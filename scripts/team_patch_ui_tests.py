from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sub1(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Expected one replacement for {label}, got {count}")
    return updated


def patch_frontend() -> None:
    path = ROOT / "frontend" / "src" / "lib" / "api.js"
    text = path.read_text(encoding="utf-8")
    labels = '''export const ROLE_LABELS = {
  admin: "مدير النظام والمنصة",
  ceo: "الرئيس التنفيذي",
  vp_development: "نائب الرئيس التنفيذي للتنمية",
  national_executive: "المدير التنفيذي لشركة اراك الوطنية",
  tracker: "الإشراف والمتابعة",
  finance: "المدير المالي",
  marketing_tenders: "مسؤول منصة التسويق والمناقصات",
  procurement: "المشتريات",
  tech_supervisor: "مشرف التقنية",
};'''
    text = sub1(text, r'export const ROLE_LABELS = \{.*?\n\};', labels, "role labels")
    path.write_text(text, encoding="utf-8")


def patch_iam_test() -> None:
    path = ROOT / "scripts" / "test_vercel_iam.mjs"
    text = path.read_text(encoding="utf-8")
    text = text.replace('email: "admin@arak.com"', 'email: "louiabdalla1@gmail.com"')
    text = text.replace('users.body.length === 6', 'users.body.length === 9')
    text = text.replace('rebuilt.body?.users?.length === 6', 'rebuilt.body?.users?.length === 9')
    text = text.replace('approved executive accounts', 'approved official team accounts')
    path.write_text(text, encoding="utf-8")


def create_permission_test() -> None:
    path = ROOT / "scripts" / "test_team_permissions.mjs"
    path.write_text('''import crypto from "node:crypto";
import businessHandler from "../api/[...path].js";

const secret = process.env.JWT_SECRET || "nexgen-vercel-hosted-demo-secret-2026";

function tokenFor(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, email: user.email, role: user.role, exp: Date.now() + 3600000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function requestFor({ method = "GET", url = "/api/dashboard", body = null, token = "" } = {}) {
  return { method, url, body, headers: token ? { authorization: `Bearer ${token}` } : {} };
}

async function invoke(request) {
  let statusCode = 200;
  let payload;
  const response = {
    setHeader() {},
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return value; },
    end() {},
  };
  await businessHandler(request, response);
  return { status: statusCode, body: payload };
}

function expect(condition, message, context) {
  if (!condition) throw new Error(`${message}: ${JSON.stringify(context)}`);
}

const mahmoud = tokenFor({ id: "usr_marketing", email: "scm@araak.org", role: "marketing_tenders" });
const admin = tokenFor({ id: "usr_admin", email: "louiabdalla1@gmail.com", role: "admin" });

const dashboard = await invoke(requestFor({ token: mahmoud }));
expect(dashboard.status === 200, "Mahmoud must view the full dashboard", dashboard);

const assigned = await invoke(requestFor({
  method: "POST",
  url: "/api/tasks",
  token: mahmoud,
  body: { title: "اختبار توزيع مهمة", sector: "corporate", assignee_id: "usr_procurement", priority: "high", status: "pending" },
}));
expect(assigned.status === 201 && assigned.body?.assignee_id === "usr_procurement", "Mahmoud must assign tasks", assigned);

const deniedUsers = await invoke(requestFor({ method: "GET", url: "/api/users", token: mahmoud }));
expect(deniedUsers.status === 403, "User management must remain admin-only", deniedUsers);

const deniedTheme = await invoke(requestFor({ method: "PUT", url: "/api/theme", token: mahmoud, body: { active_theme: "luxury" } }));
expect(deniedTheme.status === 403, "Platform settings must remain admin-only", deniedTheme);

const adminUsers = await invoke(requestFor({ method: "GET", url: "/api/users", token: admin }));
expect(adminUsers.status === 200 && adminUsers.body?.length === 9, "Admin must retain directory management", adminUsers);

console.log("Official team permissions checks passed.");
''', encoding="utf-8")


def patch_workflows() -> None:
    for name in ["validate-vercel-iam.yml", "authorized-access-check.yml"]:
        path = ROOT / ".github" / "workflows" / name
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        if "test_team_permissions.mjs" in text:
            continue
        if "node --check scripts/test_vercel_iam.mjs" in text:
            text = text.replace(
                "node --check scripts/test_vercel_iam.mjs",
                "node --check scripts/test_vercel_iam.mjs\n          node --check scripts/test_team_permissions.mjs",
                1,
            )
        step = "      - name: Verify official team permissions\n        run: node scripts/test_team_permissions.mjs\n\n"
        marker = "      - name: Build frontend"
        text = text.replace(marker, step + marker, 1) if marker in text else text + "\n" + step
        path.write_text(text, encoding="utf-8")


def patch_stale_docs() -> None:
    replacements = {
        "admin@arak.com": "louiabdalla1@gmail.com",
        "ceo@arak.com": "dr.ali@araak.org",
        "vp.dev@arak.com": "sa.dc.1@araak.org",
        "tracker@arak.com": "a.alotaibi@araak.org",
        "vp.invest@arak.com": "fm@araak.org",
        "dev.manager@arak.com": "a.alhusam@araak.net",
    }
    targets = [ROOT / "README.md"]
    docs = ROOT / "docs"
    if docs.exists():
        targets.extend(path for path in docs.rglob("*") if path.is_file())
    for path in targets:
        if not path.exists() or path.suffix.lower() not in {".md", ".txt", ".json", ".yml", ".yaml"}:
            continue
        text = path.read_text(encoding="utf-8")
        updated = text
        for old, new in replacements.items():
            updated = updated.replace(old, new)
        if updated != text:
            path.write_text(updated, encoding="utf-8")


def apply() -> None:
    patch_frontend()
    patch_iam_test()
    create_permission_test()
    patch_workflows()
    patch_stale_docs()
