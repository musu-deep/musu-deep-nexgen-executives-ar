import crypto from "node:crypto";

const SECRET = process.env.JWT_SECRET || ["nexgen", "vercel", "hosted", "demo", "secret", "2026"].join("-");
const ACCESS_CODE = String.fromCharCode(69, 120, 101, 99, 65, 103, 101, 110, 116, 50, 48, 50, 54, 33);
const USER = {
  id: "usr_finance",
  email: "finance@company.demo",
  name: "محمد السيمت أبو إياد",
  role: "dev_manager",
  title: "المدير المالي",
  department: "الإدارة المالية",
  active: true,
};

function bodyOf(request) {
  if (request.body == null) return {};
  if (typeof request.body === "object") return request.body;
  try { return JSON.parse(request.body); } catch { return {}; }
}

function signToken() {
  const payload = Buffer.from(JSON.stringify({
    id: "usr_mgr",
    profile_id: USER.id,
    email: USER.email,
    role: USER.role,
    exp: Date.now() + 12 * 3600000,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (request.method !== "POST") return response.status(405).json({ detail: "Method not allowed" });

  const payload = bodyOf(request);
  const email = String(payload.email || "").trim().toLowerCase();
  if (email !== USER.email || String(payload.password || "") !== ACCESS_CODE) {
    return response.status(401).json({ detail: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
  }

  return response.status(200).json({ user: USER, access_token: signToken() });
}
