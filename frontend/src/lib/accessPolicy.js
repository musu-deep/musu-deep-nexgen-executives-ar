export const FULL_ACCESS_ROLES = new Set(["admin", "ceo"]);

const COMMON_MODULES = new Set([
  "dashboard", "projects", "tasks", "meetings", "meeting_requests",
  "messages", "notifications",
]);

const AREA_MODULES = {
  human_resources: ["human_resources", "team"],
  secretariat: ["executive_secretariat", "documents", "calendar"],
  legal: ["legal_affairs", "documents"],
  quality: ["quality_control"],
  development: [], investment: [], operations: [], digital: [], general: [],
};

const FULL_ONLY_MODULES = new Set([
  "daily_report", "camera_monitoring", "presidential_advisor", "voice",
  "ai_lounge", "odoo_integration", "reports", "settings",
]);

const PATH_MODULES = [
  [/^\/dashboard\/?$/, "dashboard"], [/^\/projects(?:\/.*)?$/, "projects"],
  [/^\/tasks(?:\/.*)?$/, "tasks"], [/^\/meetings(?:\/.*)?$/, "meetings"],
  [/^\/meeting-requests(?:\/.*)?$/, "meeting_requests"], [/^\/calendar(?:\/.*)?$/, "calendar"],
  [/^\/messages(?:\/.*)?$/, "messages"], [/^\/notifications(?:\/.*)?$/, "notifications"],
  [/^\/settings(?:\/.*)?$/, "settings"], [/^\/(?:human-resources|hr)(?:\/.*)?$/, "human_resources"],
  [/^\/team(?:\/.*)?$/, "team"], [/^\/executive-secretariat(?:\/.*)?$/, "executive_secretariat"],
  [/^\/legal-affairs(?:\/.*)?$/, "legal_affairs"], [/^\/quality-control(?:\/.*)?$/, "quality_control"],
  [/^\/documents(?:\/.*)?$/, "documents"], [/^\/daily-report(?:\/.*)?$/, "daily_report"],
  [/^\/camera-monitoring(?:\/.*)?$/, "camera_monitoring"], [/^\/presidential-advisor(?:\/.*)?$/, "presidential_advisor"],
  [/^\/voice(?:\/.*)?$/, "voice"], [/^\/ai-lounge(?:\/.*)?$/, "ai_lounge"],
  [/^\/odoo-integration(?:\/.*)?$/, "odoo_integration"], [/^\/reports(?:\/.*)?$/, "reports"],
  [/^\/admin(?:\/.*)?$/, "admin"],
];

function profileText(user) {
  return [user?.email, user?.title, user?.department, user?.name].filter(Boolean).join(" ").toLowerCase();
}

export function isFullAccessUser(user) {
  return FULL_ACCESS_ROLES.has(user?.role);
}

export function functionalAreaForUser(user) {
  if (isFullAccessUser(user)) return "full";
  const text = profileText(user);
  if (text.includes("الموارد البشرية") || text.includes("human resources") || String(user?.email || "").toLowerCase() === "hr@company.demo") return "human_resources";
  if (user?.role === "tracker" || text.includes("سكرتارية") || text.includes("متابعة") || text.includes("مكتب الرئيس")) return "secretariat";
  if (text.includes("قانون") || text.includes("legal")) return "legal";
  if (text.includes("جودة") || text.includes("رقابة") || text.includes("تفتيش") || text.includes("quality")) return "quality";
  if (user?.role === "vp_development" || text.includes("تنمية") || text.includes("تطوير")) return "development";
  if (user?.role === "vp_investment" || text.includes("استثمار")) return "investment";
  if (["تشغيل", "عمليات", "مصنع", "مستودعات", "مشتريات", "مبيعات", "تجارة"].some((token) => text.includes(token))) return "operations";
  if (text.includes("تقنية") || text.includes("رقمي") || text.includes("digital")) return "digital";
  return "general";
}

export function allowedModulesForUser(user) {
  if (isFullAccessUser(user)) return null;
  const allowed = new Set(COMMON_MODULES);
  (AREA_MODULES[functionalAreaForUser(user)] || []).forEach((module) => allowed.add(module));
  return allowed;
}

export function canAccessModule(user, module) {
  if (!user) return false;
  if (module === "admin") return user?.role === "admin";
  if (isFullAccessUser(user)) return true;
  if (FULL_ONLY_MODULES.has(module)) return false;
  return allowedModulesForUser(user)?.has(module) || false;
}

export function moduleForPath(pathname) {
  return PATH_MODULES.find(([pattern]) => pattern.test(pathname || "/"))?.[1] || "dashboard";
}

export function canAccessPath(user, pathname) {
  return canAccessModule(user, moduleForPath(pathname));
}

export const FUNCTIONAL_AREA_LABELS = {
  full: "الإدارة الكاملة", human_resources: "الموارد البشرية",
  secretariat: "السكرتارية والمتابعة التنفيذية", legal: "الشؤون القانونية",
  quality: "التفتيش والرقابة والجودة", development: "التنمية والتطوير",
  investment: "الاستثمار", operations: "العمليات والتنفيذ",
  digital: "التحول الرقمي", general: "المهام الوظيفية المسندة",
};
