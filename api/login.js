import crypto from "node:crypto";

const SECRET = process.env.JWT_SECRET || "nexgen-vercel-hosted-demo-secret-2026";
const DEMO_PASSWORD = "ExecAgent2026!";

const USERS = [
  { id: "usr_admin", token_id: "usr_admin", email: "admin@company.demo", name: "مدير المنصة", role: "admin", title: "مدير المنصة التنفيذية", department: "إدارة المنصة", active: true },
  { id: "usr_ceo", token_id: "usr_ceo", email: "ceo@company.demo", name: "الرئيس التنفيذي", role: "ceo", title: "الرئيس التنفيذي", department: "مكتب الرئيس التنفيذي", active: true },
  { id: "usr_dev", token_id: "usr_dev", email: "development@company.demo", name: "نائب الرئيس التنفيذي للتنمية", role: "vp_development", title: "نائب الرئيس التنفيذي للتنمية", department: "قطاع التنمية", active: true },
  { id: "usr_inv", token_id: "usr_inv", email: "investment@company.demo", name: "نائب الرئيس التنفيذي للاستثمار", role: "vp_investment", title: "نائب الرئيس التنفيذي للاستثمار", department: "قطاع الاستثمار", active: true },
  { id: "usr_mgr", token_id: "usr_mgr", email: "manager@company.demo", name: "مدير وحدة الأعمال", role: "dev_manager", title: "مدير العمليات والتنفيذ", department: "العمليات والتنفيذ", active: true },
  { id: "usr_track", token_id: "usr_track", email: "followup@company.demo", name: "المتابعة التنفيذية", role: "tracker", title: "مسؤول المتابعة التنفيذية", department: "مكتب الرئيس التنفيذي", active: true },

  { id: "usr_commercial", token_id: "usr_mgr", email: "commercial@company.demo", name: "م. محمد شكاك", role: "dev_manager", title: "مسؤول المشتريات والمستودعات والشؤون التجارية", department: "المشتريات والمستودعات", active: true },
  { id: "usr_factory", token_id: "usr_mgr", email: "factory@company.demo", name: "م. عبد الرحمن الحسام", role: "dev_manager", title: "مدير أراك الوطنية والمصنع", department: "المصنع وأراك الوطنية", active: true },
  { id: "usr_projects", token_id: "usr_mgr", email: "projects@company.demo", name: "أ. هاني محمد", role: "dev_manager", title: "مسؤول فريق المشاريع وتسويق المشاريع", department: "إدارة المشاريع", active: true },
  { id: "usr_wholesale", token_id: "usr_mgr", email: "wholesale@company.demo", name: "مدير مبيعات الجملة", role: "dev_manager", title: "مدير مبيعات الجملة", department: "مبيعات الجملة", active: true },
  { id: "usr_stores", token_id: "usr_mgr", email: "stores@company.demo", name: "مدير أراك ستورز", role: "dev_manager", title: "مدير أراك ستورز والتجارة الإلكترونية", department: "أراك ستورز", active: true },
];

function bodyOf(request) {
  if (request.body == null) return {};
  if (typeof request.body === "object") return request.body;
  try { return JSON.parse(request.body); } catch { return {}; }
}

function publicUser(user) {
  const { token_id, ...profile } = user;
  return profile;
}

function signToken(user) {
  const payload = Buffer.from(JSON.stringify({
    id: user.token_id,
    profile_id: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 12 * 3600000,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method !== "POST") {
    return response.status(405).json({ detail: "Method not allowed" });
  }

  const payload = bodyOf(request);
  const email = String(payload.email || "").trim().toLowerCase();
  const user = USERS.find((item) => item.email === email && item.active !== false);

  if (!user || payload.password !== DEMO_PASSWORD) {
    return response.status(401).json({ detail: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
  }

  return response.status(200).json({
    user: publicUser(user),
    access_token: signToken(user),
  });
}
