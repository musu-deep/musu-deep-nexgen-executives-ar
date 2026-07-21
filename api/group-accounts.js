import crypto from "node:crypto";

const GROUPS = [
  {
    id: "leadership",
    name: "القيادة التنفيذية",
    envKey: "GROUP_CODE_LEADERSHIP",
    accounts: [
      { email: "ceo@company.demo", name: "الرئيس التنفيذي", title: "الرئيس التنفيذي", role: "ceo" },
      { email: "development@company.demo", name: "نائب الرئيس التنفيذي للتنمية", title: "قطاع التنمية", role: "vp_development" },
      { email: "investment@company.demo", name: "نائب الرئيس التنفيذي للاستثمار", title: "قطاع الاستثمار", role: "vp_investment" },
    ],
  },
  {
    id: "ceo-office",
    name: "مكتب الرئيس التنفيذي",
    envKey: "GROUP_CODE_CEO_OFFICE",
    accounts: [
      { email: "followup@company.demo", name: "المتابعة التنفيذية", title: "مكتب الرئيس التنفيذي", role: "tracker" },
      { email: "secretariat@company.demo", name: "خالد العوبثاني", title: "السكرتارية التنفيذية", role: "secretariat" },
    ],
  },
  {
    id: "support",
    name: "الإدارات المساندة",
    envKey: "GROUP_CODE_SUPPORT",
    accounts: [
      { email: "hr@company.demo", name: "محمد السقاف", title: "الموارد البشرية", role: "human-resources" },
      { email: "finance@company.demo", name: "محمد السيمت أبو إياد", title: "المدير المالي", role: "finance" },
      { email: "quality@company.demo", name: "عاصم الملاحمة", title: "التفتيش والرقابة والجودة", role: "quality-control" },
      { email: "manager@company.demo", name: "مدير وحدة الأعمال", title: "العمليات والتنفيذ", role: "dev_manager" },
    ],
  },
  {
    id: "operations",
    name: "المصانع والعمليات",
    envKey: "GROUP_CODE_OPERATIONS",
    accounts: [
      { email: "steel.factory@company.demo", name: "سامر الملاحمة", title: "مصنع الحديد", role: "steel-factory" },
      { email: "commercial@company.demo", name: "م. محمد شكاك", title: "المشتريات والمستودعات", role: "commercial" },
      { email: "factory@company.demo", name: "م. عبد الرحمن الحسام", title: "المصنع وأراك الوطنية", role: "factory" },
      { email: "technical.office@company.demo", name: "م. إسلام محمد", title: "المكتب الفني", role: "technical-office" },
    ],
  },
  {
    id: "sales",
    name: "المبيعات والمتاجر",
    envKey: "GROUP_CODE_SALES",
    accounts: [
      { email: "wholesale@company.demo", name: "مدير مبيعات الجملة", title: "مبيعات الجملة", role: "wholesale" },
      { email: "stores@company.demo", name: "م. طه الأهدل", title: "أراك ستورز", role: "stores" },
    ],
  },
  {
    id: "platform",
    name: "إدارة المنصة",
    envKey: "GROUP_CODE_PLATFORM",
    accounts: [
      { email: "admin@company.demo", name: "مدير المنصة", title: "إدارة المنصة", role: "admin" },
    ],
  },
];

function bodyOf(request) {
  if (request.body == null) return {};
  if (typeof request.body === "object") return request.body;
  try { return JSON.parse(request.body); } catch { return {}; }
}

function digest(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest();
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method !== "POST") {
    return response.status(405).json({ detail: "Method not allowed" });
  }

  const { code } = bodyOf(request);
  const normalized = String(code || "").replace(/\D/g, "").slice(0, 8);
  if (normalized.length < 4) {
    return response.status(400).json({ detail: "أدخل معرف المجموعة المكوّن من أربعة أرقام على الأقل" });
  }

  const configuredGroups = GROUPS.filter((entry) => String(process.env[entry.envKey] || "").trim());
  if (configuredGroups.length === 0) {
    return response.status(503).json({ detail: "لم تُضبط معرفات المجموعات في إعدادات Vercel" });
  }

  const submittedDigest = digest(normalized);
  const group = configuredGroups.find((entry) => {
    const configuredCode = String(process.env[entry.envKey] || "").replace(/\D/g, "").slice(0, 8);
    return configuredCode.length >= 4 && crypto.timingSafeEqual(digest(configuredCode), submittedDigest);
  });

  if (!group) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return response.status(404).json({ detail: "معرف المجموعة غير صحيح" });
  }

  return response.status(200).json({
    group: { id: group.id, name: group.name },
    accounts: group.accounts,
  });
}
