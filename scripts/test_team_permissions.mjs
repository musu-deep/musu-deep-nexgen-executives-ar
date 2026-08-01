import crypto from "node:crypto";
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
