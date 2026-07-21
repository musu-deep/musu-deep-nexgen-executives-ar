import crypto from "node:crypto";

const SECRET = process.env.JWT_SECRET || "nexgen-vercel-hosted-demo-secret-2026";
const PASSWORD_HASH = process.env.DEMO_PASSWORD_HASH || "bf4649bb2107527f441591060b29509e9d59dd29c7284552cc62a42d7e3bd5c4";

const USERS = [
  { id: "usr_admin", tokenId: "usr_admin", email: "admin@company.demo", name: "مدير المنصة", role: "admin", title: "مدير المنصة التنفيذية", department: "إدارة المنصة", active: true },
  { id: "usr_ceo", tokenId: "usr_ceo", email: "ceo@company.demo", name: "الرئيس التنفيذي", role: "ceo", title: "الرئيس التنفيذي", department: "مكتب الرئيس التنفيذي", active: true },
  { id: "usr_dev", tokenId: "usr_dev", email: "development@company.demo", name: "نائب الرئيس التنفيذي للتنمية", role: "vp_development", title: "نائب الرئيس التنفيذي للتنمية", department: "قطاع التنمية", active: true },
  { id: "usr_inv", tokenId: "usr_inv", email: "investment@company.demo", name: "نائب الرئيس التنفيذي للاستثمار", role: "vp_investment", title: "نائب الرئيس التنفيذي للاستثمار", department: "قطاع الاستثمار", active: true },
  { id: "usr_mgr", tokenId: "usr_mgr", email: "manager@company.demo", name: "مدير وحدة الأعمال", role: "dev_manager", title: "مدير العمليات والتنفيذ", department: "العمليات والتنفيذ", active: true },
  { id: "usr_track", tokenId: "usr_track", email: "followup@company.demo", name: "المتابعة التنفيذية", role: "tracker", title: "مسؤول المتابعة التنفيذية", department: "مكتب الرئيس التنفيذي", active: true },
  { id: "usr_secretariat", tokenId: "usr_track", email: "secretariat@company.demo", name: "خالد العوبثاني", role: "tracker", title: "مسؤول السكرتارية التنفيذية", department: "السكرتارية التنفيذية", active: true },
  { id: "usr_hr", tokenId: "usr_mgr", email: "hr@company.demo", name: "محمد السقاف", role: "dev_manager", title: "مسؤول الموارد البشرية", department: "الموارد البشرية", active: true },
  { id: "usr_commercial", tokenId: "usr_mgr", email: "commercial@company.demo", name: "م. محمد شكاك", role: "dev_manager", title: "مسؤول المشتريات والمستودعات والشؤون التجارية", department: "المشتريات والمستودعات", active: true },
  { id: "usr_factory", tokenId: "usr_mgr", email: "factory@company.demo", name: "م. عبد الرحمن الحسام", role: "dev_manager", title: "مدير أراك الوطنية والمصنع", department: "المصنع وأراك الوطنية", active: true },
  { id: "usr_technical_office", tokenId: "usr_mgr", email: "technical.office@company.demo", name: "م. إسلام محمد", role: "dev_manager", title: "مسؤول المكتب الفني", department: "المكتب الفني", active: true },
  { id: "usr_wholesale", tokenId: "usr_mgr", email: "wholesale@company.demo", name: "مدير مبيعات الجملة", role: "dev_manager", title: "مدير مبيعات الجملة", department: "مبيعات الجملة", active: true },
  { id: "usr_stores", tokenId: "usr_mgr", email: "stores@company.demo", name: "م. طه الأهدل", role: "dev_manager", title: "مدير أراك ستورز والتجارة الإلكترونية", department: "أراك ستورز", active: true },
];

function bodyOf(request) {
  if (request.body == null) return {};
  if (typeof request.body === "object") return request.body;
  try { return JSON.parse(request.body); } catch { return {}; }
}

function digest(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function publicUser(user) {
  const { tokenId, ...profile } = user;
  return profile;
}

function signToken(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.tokenId, profile_id: user.id, email: user.email, role: user.role, exp: Date.now() + 12 * 3600000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (request.method !== "POST") return response.status(405).json({ detail: "Method not allowed" });

  const payload = bodyOf(request);
  const email = String(payload.email || "").trim().toLowerCase();
  const user = USERS.find((entry) => entry.email === email && entry.active !== false);
  if (!user || digest(payload.password) !== PASSWORD_HASH) return response.status(401).json({ detail: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });

  return response.status(200).json({ user: publicUser(user), access_token: signToken(user) });
}
