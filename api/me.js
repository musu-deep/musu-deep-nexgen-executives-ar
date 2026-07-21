import crypto from "node:crypto";

const SECRET = process.env.JWT_SECRET || "nexgen-vercel-hosted-demo-secret-2026";

const USERS = [
  { id: "usr_admin", email: "admin@company.demo", name: "مدير المنصة", role: "admin", title: "مدير المنصة التنفيذية", department: "إدارة المنصة", active: true },
  { id: "usr_ceo", email: "ceo@company.demo", name: "الرئيس التنفيذي", role: "ceo", title: "الرئيس التنفيذي", department: "مكتب الرئيس التنفيذي", active: true },
  { id: "usr_dev", email: "development@company.demo", name: "نائب الرئيس التنفيذي للتنمية", role: "vp_development", title: "نائب الرئيس التنفيذي للتنمية", department: "قطاع التنمية", active: true },
  { id: "usr_inv", email: "investment@company.demo", name: "نائب الرئيس التنفيذي للاستثمار", role: "vp_investment", title: "نائب الرئيس التنفيذي للاستثمار", department: "قطاع الاستثمار", active: true },
  { id: "usr_mgr", email: "manager@company.demo", name: "مدير وحدة الأعمال", role: "dev_manager", title: "مدير العمليات والتنفيذ", department: "العمليات والتنفيذ", active: true },
  { id: "usr_track", email: "followup@company.demo", name: "المتابعة التنفيذية", role: "tracker", title: "مسؤول المتابعة التنفيذية", department: "مكتب الرئيس التنفيذي", active: true },

  { id: "usr_commercial", email: "commercial@company.demo", name: "م. محمد شكاك", role: "dev_manager", title: "مسؤول المشتريات والمستودعات والشؤون التجارية", department: "المشتريات والمستودعات", active: true },
  { id: "usr_factory", email: "factory@company.demo", name: "م. عبد الرحمن الحسام", role: "dev_manager", title: "مدير أراك الوطنية والمصنع", department: "المصنع وأراك الوطنية", active: true },
  { id: "usr_projects", email: "projects@company.demo", name: "أ. هاني محمد", role: "dev_manager", title: "مسؤول فريق المشاريع وتسويق المشاريع", department: "إدارة المشاريع", active: true },
  { id: "usr_wholesale", email: "wholesale@company.demo", name: "مدير مبيعات الجملة", role: "dev_manager", title: "مدير مبيعات الجملة", department: "مبيعات الجملة", active: true },
  { id: "usr_stores", email: "stores@company.demo", name: "مدير أراك ستورز", role: "dev_manager", title: "مدير أراك ستورز والتجارة الإلكترونية", department: "أراك ستورز", active: true },
];

function parseToken(token) {
  try {
    const [payload, signature] = String(token || "").split(".");
    if (!payload || !signature) return null;
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method !== "GET") {
    return response.status(405).json({ detail: "Method not allowed" });
  }

  const authorization = request.headers.authorization || request.headers.Authorization || "";
  const decoded = parseToken(authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
  if (!decoded) return response.status(401).json({ detail: "Not authenticated" });

  const user = USERS.find((item) => item.id === (decoded.profile_id || decoded.id) && item.active !== false);
  if (!user) return response.status(401).json({ detail: "Not authenticated" });

  return response.status(200).json({ user });
}
