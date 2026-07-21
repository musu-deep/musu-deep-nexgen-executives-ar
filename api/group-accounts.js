import crypto from "node:crypto";

const GROUPS = [
  {
    id: "leadership",
    name: "القيادة التنفيذية",
    envKey: "GROUP_CODE_LEADERSHIP_HASH",
    fallbackHash: "ce83293c66150ed42f52747cca6a91b85332c740cde625195b15f1abb4b90196",
    accounts: [
      { email: "ceo@company.demo", name: "الرئيس التنفيذي", title: "الرئيس التنفيذي", role: "ceo" },
      { email: "development@company.demo", name: "نائب الرئيس التنفيذي للتنمية", title: "قطاع التنمية", role: "vp_development" },
      { email: "investment@company.demo", name: "نائب الرئيس التنفيذي للاستثمار", title: "قطاع الاستثمار", role: "vp_investment" },
    ],
  },
  {
    id: "ceo-office",
    name: "مكتب الرئيس التنفيذي",
    envKey: "GROUP_CODE_CEO_OFFICE_HASH",
    fallbackHash: "cc80e5682a1da08477a66dd153d57d05688175dda3ced2fcd36ec45cbc5d658c",
    accounts: [
      { email: "followup@company.demo", name: "المتابعة التنفيذية", title: "مكتب الرئيس التنفيذي", role: "tracker" },
      { email: "secretariat@company.demo", name: "خالد العوبثاني", title: "السكرتارية التنفيذية", role: "secretariat" },
    ],
  },
  {
    id: "support",
    name: "الإدارات المساندة",
    envKey: "GROUP_CODE_SUPPORT_HASH",
    fallbackHash: "fea8344c6c192a73125b6b1469b96dd2944ec2e6206e0dbab867e910da7ace17",
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
    envKey: "GROUP_CODE_OPERATIONS_HASH",
    fallbackHash: "fc516b2c3e552c96f72c8c8b1ccbe02b243b833f6c647e4b51fcc72b9775d0c3",
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
    envKey: "GROUP_CODE_SALES_HASH",
    fallbackHash: "28bbad4c3a502526118cc4d877150d4ab9686b56fb629fc674a9387cb0a9a7d8",
    accounts: [
      { email: "wholesale@company.demo", name: "مدير مبيعات الجملة", title: "مبيعات الجملة", role: "wholesale" },
      { email: "stores@company.demo", name: "م. طه الأهدل", title: "أراك ستورز", role: "stores" },
    ],
  },
  {
    id: "platform",
    name: "إدارة المنصة",
    envKey: "GROUP_CODE_PLATFORM_HASH",
    fallbackHash: "87b619c933bde01d816fc6667ce22db9dd0db73ab5a5a713a4d1c9e4f329b4e7",
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
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
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

  const codeHash = digest(normalized);
  const group = GROUPS.find((entry) => {
    const configuredHash = String(process.env[entry.envKey] || entry.fallbackHash).trim();
    return configuredHash.length === codeHash.length && crypto.timingSafeEqual(Buffer.from(configuredHash), Buffer.from(codeHash));
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
