import crypto from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET || "nexgen-vercel-hosted-demo-secret-2026";
const DEMO_PASSWORD_HASH = process.env.DEMO_PASSWORD_HASH || "bf4649bb2107527f441591060b29509e9d59dd29c7284552cc62a42d7e3bd5c4";
const STATE_MARKER = "ARAAK_IAM_STATE_V1:";
const FRONTEND_URL = String(process.env.FRONTEND_URL || "https://musu-deep-nexgen-executives-ar.vercel.app").replace(/\/+$/, "");
const INVITE_TTL_HOURS = Math.max(1, Number(process.env.INVITE_TTL_HOURS || 24));
const CLASSIFICATION_RANK = {
  internal: 1,
  restricted: 2,
  confidential: 3,
  executive_secret: 4,
  financial_sensitive: 4,
  legal_privileged: 4,
};

const STATIC_USERS = [
  { id: "usr_admin", email: "admin@company.demo", name: "مدير المنصة", role: "admin", title: "مدير المنصة التنفيذية", department: "إدارة المنصة", active: true, demo: true, clearance: "executive_secret" },
  { id: "usr_ceo", email: "ceo@company.demo", name: "الرئيس التنفيذي", role: "ceo", title: "الرئيس التنفيذي", department: "مكتب الرئيس التنفيذي", active: true, demo: true, clearance: "executive_secret" },
  { id: "usr_dev", email: "development@company.demo", name: "نائب الرئيس التنفيذي للتنمية", role: "vp_development", title: "نائب الرئيس التنفيذي للتنمية", department: "قطاع التنمية", active: true, demo: true, clearance: "confidential" },
  { id: "usr_inv", email: "investment@company.demo", name: "نائب الرئيس التنفيذي للاستثمار", role: "vp_investment", title: "نائب الرئيس التنفيذي للاستثمار", department: "قطاع الاستثمار", active: true, demo: true, clearance: "financial_sensitive" },
  { id: "usr_mgr", email: "manager@company.demo", name: "مدير وحدة الأعمال", role: "dev_manager", title: "مدير العمليات والتنفيذ", department: "العمليات والتنفيذ", active: true, demo: true, clearance: "restricted" },
  { id: "usr_track", email: "followup@company.demo", name: "المتابعة التنفيذية", role: "tracker", title: "مسؤول المتابعة التنفيذية", department: "مكتب الرئيس التنفيذي", active: true, demo: true, clearance: "confidential" },
  { id: "usr_secretariat", email: "secretariat@company.demo", name: "خالد العوبثاني", role: "tracker", title: "مسؤول السكرتارية التنفيذية", department: "السكرتارية التنفيذية", active: true, demo: true, clearance: "confidential" },
  { id: "usr_hr", email: "hr@company.demo", name: "محمد السقاف", role: "dev_manager", title: "مسؤول الموارد البشرية", department: "الموارد البشرية", active: true, demo: true, clearance: "restricted" },
  { id: "usr_finance", email: "finance@company.demo", name: "محمد السيمت أبو إياد", role: "dev_manager", title: "المدير المالي", department: "الإدارة المالية", active: true, demo: true, clearance: "financial_sensitive" },
  { id: "usr_quality", email: "quality@company.demo", name: "عاصم الملاحمة", role: "dev_manager", title: "مدير التفتيش والرقابة والجودة", department: "التفتيش والرقابة والجودة", active: true, demo: true, clearance: "restricted" },
  { id: "usr_steel_factory", email: "steel.factory@company.demo", name: "سامر الملاحمة", role: "dev_manager", title: "مدير مصنع الحديد", department: "مصنع الحديد", active: true, demo: true, clearance: "restricted" },
  { id: "usr_commercial", email: "commercial@company.demo", name: "م. محمد شكاك", role: "dev_manager", title: "مسؤول المشتريات والمستودعات والشؤون التجارية", department: "المشتريات والمستودعات", active: true, demo: true, clearance: "restricted" },
  { id: "usr_factory", email: "factory@company.demo", name: "م. عبد الرحمن الحسام", role: "dev_manager", title: "مدير أراك الوطنية والمصنع", department: "المصنع وأراك الوطنية", active: true, demo: true, clearance: "restricted" },
  { id: "usr_technical_office", email: "technical.office@company.demo", name: "م. إسلام محمد", role: "dev_manager", title: "مسؤول المكتب الفني", department: "المكتب الفني", active: true, demo: true, clearance: "restricted" },
  { id: "usr_wholesale", email: "wholesale@company.demo", name: "مدير مبيعات الجملة", role: "dev_manager", title: "مدير مبيعات الجملة", department: "مبيعات الجملة", active: true, demo: true, clearance: "restricted" },
  { id: "usr_stores", email: "stores@company.demo", name: "م. طه الأهدل", role: "dev_manager", title: "مدير أراك ستورز والتجارة الإلكترونية", department: "أراك ستورز", active: true, demo: true, clearance: "restricted" },
];

const MODULES = [
  "dashboard", "daily_report", "camera_monitoring", "projects", "tasks",
  "executive_secretariat", "presidential_advisor", "legal_affairs",
  "opportunity_intelligence", "pricing_intelligence", "human_resources",
  "quality_control", "calendar", "meetings", "meeting_requests", "documents",
  "messages", "voice", "ai_lounge", "odoo_integration", "reports", "team",
  "notifications", "settings", "admin", "access_control",
];

const BASE_PERMISSIONS = [
  ["access.manage", "إدارة نسيج الصلاحيات", "security"],
  ["access.simulate", "محاكاة قرارات الوصول", "security"],
  ["audit.view", "عرض سجل التدقيق", "security"],
  ["user.invite", "دعوة المستخدمين", "identity"],
  ["user.disable", "تعطيل المستخدمين", "identity"],
  ["organization.manage", "إدارة الهيكل التنظيمي", "organization"],
  ["project.view", "عرض المشروعات", "project"],
  ["project.create", "إنشاء المشروعات", "project"],
  ["project.update", "تحديث المشروعات", "project"],
  ["project.close", "إغلاق المشروعات", "project"],
  ["task.view", "عرض المهام", "task"],
  ["task.assign", "إسناد المهام", "task"],
  ["task.approve", "اعتماد المهام", "task"],
  ["document.view", "عرض المستندات", "document"],
  ["document.upload", "رفع المستندات", "document"],
  ["document.download", "تنزيل المستندات", "document"],
  ["document.classify", "تصنيف المستندات", "document"],
  ["tender.view", "عرض المنافسات", "tender"],
  ["tender.price.view", "عرض التسعير", "tender"],
  ["tender.price.edit", "تعديل التسعير", "tender"],
  ["tender.submit", "تقديم المنافسة", "tender"],
  ["tender.approve", "اعتماد المنافسة", "tender"],
  ["report.view", "عرض التقارير", "report"],
  ["report.approve", "اعتماد التقارير", "report"],
  ["meeting.manage", "إدارة الاجتماعات", "meeting"],
];
const DEFAULT_PERMISSIONS = [
  ...BASE_PERMISSIONS.map(([code, name, category]) => ({ id: `perm_${code}`, code, name, category, active: true })),
  ...MODULES.map((module) => ({ id: `perm_module_${module}`, code: `module.${module}.view`, name: `عرض وحدة ${module}`, category: "module", active: true })),
];

const modulePermissions = (modules) => [...new Set(modules)].map((module) => `module.${module}.view`);
const COMMON_MODULES = ["dashboard", "projects", "tasks", "meetings", "meeting_requests", "messages", "notifications"];
const ALL_BUSINESS_MODULES = MODULES.filter((module) => !["admin", "access_control"].includes(module));
const DEFAULT_ROLES = [
  { id: "role_system_admin", code: "system_admin", name: "مدير النظام", description: "إدارة الهوية والصلاحيات دون الاطلاع التلقائي على كل المحتوى التنفيذي.", permissions: ["access.manage", "access.simulate", "audit.view", "user.invite", "user.disable", "organization.manage", ...modulePermissions(["dashboard", "admin", "access_control"])], clearance: "executive_secret", active: true, system: true },
  { id: "role_chief_executive", code: "chief_executive", name: "الرئيس التنفيذي", description: "صلاحية تنفيذية شاملة على الكيانات والمشروعات والمحتوى.", permissions: [...DEFAULT_PERMISSIONS.map((item) => item.code).filter((code) => code !== "access.manage"), ...modulePermissions(ALL_BUSINESS_MODULES)], clearance: "executive_secret", active: true, system: true },
  { id: "role_development_vp", code: "development_vp", name: "نائب الرئيس للتنمية", description: "صلاحيات قطاع التنمية والتطوير ضمن النطاق المعتمد.", permissions: ["project.view", "project.create", "project.update", "task.view", "task.assign", "task.approve", "document.view", "document.upload", "report.view", "report.approve", "meeting.manage", ...modulePermissions([...COMMON_MODULES, "daily_report", "executive_secretariat", "presidential_advisor", "human_resources", "calendar", "documents", "reports", "team", "ai_lounge", "settings"])], clearance: "confidential", active: true, system: true },
  { id: "role_investment_vp", code: "investment_vp", name: "نائب الرئيس للاستثمار", description: "صلاحيات الاستثمار والمنافسات والتسعير ضمن النطاق المعتمد.", permissions: ["project.view", "project.create", "project.update", "task.view", "task.assign", "task.approve", "document.view", "document.upload", "tender.view", "tender.price.view", "tender.price.edit", "report.view", "report.approve", ...modulePermissions([...COMMON_MODULES, "daily_report", "opportunity_intelligence", "pricing_intelligence", "calendar", "documents", "reports", "ai_lounge", "settings"])], clearance: "financial_sensitive", active: true, system: true },
  { id: "role_unit_manager", code: "unit_manager", name: "مدير وحدة", description: "إدارة التنفيذ داخل الوحدة التنظيمية أو المشروع المحدد.", permissions: ["project.view", "project.update", "task.view", "task.assign", "document.view", "document.upload", "report.view", ...modulePermissions([...COMMON_MODULES, "calendar", "documents", "team"])], clearance: "restricted", active: true, system: true },
  { id: "role_executive_followup", code: "executive_followup", name: "المتابعة التنفيذية", description: "متابعة مشتركة للمهام والاجتماعات والمستندات ضمن النطاق.", permissions: ["project.view", "task.view", "task.assign", "document.view", "report.view", "meeting.manage", ...modulePermissions([...COMMON_MODULES, "executive_secretariat", "calendar", "documents", "reports", "team"])], clearance: "confidential", active: true, system: true },
  { id: "role_viewer", code: "viewer", name: "مشاهد", description: "وصول للقراءة فقط ضمن نطاق محدد.", permissions: ["project.view", "task.view", "document.view", "report.view", ...modulePermissions(["dashboard", "projects", "tasks", "documents", "reports", "notifications"])], clearance: "internal", active: true, system: true },
  { id: "role_technical_committee", code: "technical_committee", name: "عضو لجنة فنية", description: "مراجعة فنية مؤقتة للمنافسات والمستندات المرتبطة.", permissions: ["tender.view", "document.view", "report.view", ...modulePermissions(["dashboard", "opportunity_intelligence", "documents", "reports", "notifications"])], clearance: "confidential", active: true, system: true },
  { id: "role_financial_reviewer", code: "financial_reviewer", name: "مراجع مالي", description: "مراجعة مالية مقيدة للمنافسات والتقارير.", permissions: ["tender.view", "tender.price.view", "report.view", ...modulePermissions(["dashboard", "pricing_intelligence", "reports", "notifications"])], clearance: "financial_sensitive", active: true, system: true },
];
const LEGACY_ROLE_MAP = {
  admin: "system_admin",
  ceo: "chief_executive",
  vp_development: "development_vp",
  vp_investment: "investment_vp",
  dev_manager: "unit_manager",
  tracker: "executive_followup",
};

const DEFAULT_ROOT = { id: "org_araak", name: "مجموعة اراك للتنمية", code: "ARAAK", kind: "group", parent_id: null, active: true, system: true };

const emptyState = () => ({
  version: 1,
  users: [],
  organizations: [],
  roles: [],
  assignments: [],
  groups: [],
  memberships: [],
  delegations: [],
  policies: [],
  audit: [],
});

const isoNow = () => new Date().toISOString();
const newId = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const sha256 = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");

function encodeState(state) {
  return `<!--${STATE_MARKER}${Buffer.from(JSON.stringify(state), "utf8").toString("base64url")}-->`;
}

function decodeState(description) {
  const match = String(description || "").match(/ARAAK_IAM_STATE_V1:([A-Za-z0-9_-]+)/);
  if (!match) return null;
  try {
    return JSON.parse(Buffer.from(match[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function odooConfig() {
  return {
    url: String(process.env.ODOO_URL || "https://araakceo.odoo.com").replace(/\/+$/, ""),
    database: String(process.env.ODOO_DATABASE || "araakceo").trim(),
    apiKey: String(process.env.ODOO_API_KEY || "").trim(),
    language: String(process.env.ODOO_LANGUAGE || "en_US").trim(),
    timeoutMs: Math.max(3000, Number(process.env.ODOO_TIMEOUT_MS || 20000)),
    readOnly: String(process.env.ODOO_READ_ONLY || "false").toLowerCase() === "true",
  };
}

async function odooCall(model, method, parameters = {}) {
  const config = odooConfig();
  if (!config.apiKey) throw new Error("خدمة التخزين المؤسسي غير مهيأة: ODOO_API_KEY غير موجود.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.url}/json/2/${encodeURIComponent(model)}/${encodeURIComponent(method)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `bearer ${config.apiKey}`,
        "X-Odoo-Database": config.database,
        "User-Agent": "ARAAK-CEO-IAM/1.0",
      },
      body: JSON.stringify({ context: { lang: config.language, active_test: false }, ...parameters }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.message || payload?.name || payload?.error || `HTTP ${response.status}`;
      throw new Error(`تعذر الوصول إلى مخزن الهوية المؤسسي: ${message}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function createdId(result) {
  if (typeof result === "number") return result;
  if (Array.isArray(result)) {
    if (typeof result[0] === "number") return result[0];
    if (result[0] && typeof result[0].id === "number") return result[0].id;
  }
  return result && typeof result.id === "number" ? result.id : null;
}

async function loadState({ create = false } = {}) {
  const config = odooConfig();
  if (!config.apiKey) {
    if (create) throw new Error("لا يمكن حفظ الهوية لأن ODOO_API_KEY غير مضاف إلى إعدادات Vercel.");
    return { recordId: null, state: emptyState(), persistent: false };
  }
  const rows = await odooCall("crm.lead", "search_read", {
    domain: [["description", "ilike", STATE_MARKER]],
    fields: ["id", "name", "description", "active", "write_date"],
    order: "write_date desc",
    limit: 1,
  });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (row) return { recordId: Number(row.id), state: { ...emptyState(), ...(decodeState(row.description) || {}) }, persistent: true };
  if (!create) return { recordId: null, state: emptyState(), persistent: true };
  if (config.readOnly) throw new Error("التكامل المؤسسي مضبوط على القراءة فقط، ولا يمكن إنشاء سجل الهوية.");
  const state = emptyState();
  const result = await odooCall("crm.lead", "create", {
    vals_list: [{
      name: "[SYSTEM] ARAAK Identity & Access State",
      type: "opportunity",
      description: encodeState(state),
      active: true,
    }],
  });
  const recordId = createdId(result);
  if (!recordId) throw new Error("تعذر إنشاء سجل الهوية المؤسسي.");
  return { recordId, state, persistent: true };
}

async function saveState(recordId, state) {
  const config = odooConfig();
  if (config.readOnly) throw new Error("التكامل المؤسسي مضبوط على القراءة فقط.");
  let idValue = recordId;
  if (!idValue) {
    const created = await loadState({ create: true });
    idValue = created.recordId;
  }
  state.version = 1;
  state.audit = Array.isArray(state.audit) ? state.audit.slice(-500) : [];
  await odooCall("crm.lead", "write", {
    ids: [Number(idValue)],
    vals: {
      name: "[SYSTEM] ARAAK Identity & Access State",
      description: encodeState(state),
      active: true,
    },
  });
  return idValue;
}

function passwordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password || ""), salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  try {
    const actual = crypto.scryptSync(String(password || ""), String(salt || ""), 64);
    const expected = Buffer.from(String(expectedHash || ""), "hex");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function validatePassword(password) {
  const value = String(password || "");
  const missing = [];
  if (value.length < 12) missing.push("12 خانة على الأقل");
  if (!/[A-Z]/.test(value)) missing.push("حرف إنجليزي كبير");
  if (!/[a-z]/.test(value)) missing.push("حرف إنجليزي صغير");
  if (!/\d/.test(value)) missing.push("رقم");
  if (!/[^A-Za-z0-9]/.test(value)) missing.push("رمز خاص");
  if (missing.length) {
    const error = new Error(`يجب أن تتضمن كلمة المرور: ${missing.join("، ")}.`);
    error.status = 422;
    throw error;
  }
}

function publicUser(user) {
  if (!user) return null;
  const {
    password_hash, password_salt, invite_token_hash, password_reset_token_hash,
    ...safe
  } = user;
  return safe;
}

function realAdminExists(state) {
  return (state.users || []).some((user) => user.role === "admin" && user.active === true && user.invitation_status === "active");
}

function mergeUsers(state) {
  const persisted = Array.isArray(state.users) ? state.users : [];
  const persistedEmails = new Set(persisted.map((user) => String(user.email || "").toLowerCase()));
  const includeDemo = String(process.env.ENABLE_DEMO_USERS || "").toLowerCase() === "true" || !realAdminExists(state);
  const demos = includeDemo ? STATIC_USERS.filter((user) => !persistedEmails.has(user.email.toLowerCase())) : [];
  return [...persisted, ...demos];
}

function parseTokenValue(token) {
  try {
    const [payloadPart, signaturePart] = String(token || "").split(".");
    if (!payloadPart || !signaturePart) return null;
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(payloadPart).digest("base64url");
    if (expected.length !== signaturePart.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signaturePart))) return null;
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    if (Number(payload.exp || 0) < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function signToken(user) {
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    profile_id: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 12 * 3600000,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function listUsers() {
  const { state } = await loadState();
  return mergeUsers(state).map(publicUser);
}

export async function findUser({ email, id } = {}) {
  const { state } = await loadState();
  const users = mergeUsers(state);
  if (email) return users.find((user) => String(user.email || "").toLowerCase() === String(email).toLowerCase()) || null;
  if (id) return users.find((user) => user.id === id) || null;
  return null;
}

export async function currentUserFromRequest(request) {
  const authorization = request.headers.authorization || request.headers.Authorization || "";
  const decoded = parseTokenValue(String(authorization).replace(/^Bearer\s+/i, ""));
  if (!decoded) return null;
  const user = await findUser({ id: decoded.profile_id || decoded.id });
  return user && user.active !== false ? publicUser(user) : null;
}

export async function authenticate(email, password) {
  const { state } = await loadState();
  const normalized = String(email || "").trim().toLowerCase();
  const persisted = (state.users || []).find((user) => String(user.email || "").toLowerCase() === normalized);
  if (persisted) {
    if (!persisted.active || persisted.invitation_status !== "active") return null;
    if (!verifyPassword(password, persisted.password_salt, persisted.password_hash)) return null;
    return publicUser(persisted);
  }
  if (realAdminExists(state) && String(process.env.ENABLE_DEMO_USERS || "").toLowerCase() !== "true") return null;
  const demo = STATIC_USERS.find((user) => user.email === normalized && user.active !== false);
  if (!demo || sha256(password) !== DEMO_PASSWORD_HASH) return null;
  return publicUser(demo);
}

function requireAdmin(actor) {
  if (!actor || actor.role !== "admin") {
    const error = new Error("هذه العملية حصرية لمدير النظام.");
    error.status = 403;
    throw error;
  }
}

function addAudit(state, event, actor, target, details = {}) {
  state.audit = Array.isArray(state.audit) ? state.audit : [];
  state.audit.push({
    id: newId("audit"),
    event,
    actor_id: actor?.id || null,
    actor_email: actor?.email || null,
    target_user_id: target?.id || null,
    target_email: target?.email || null,
    details,
    created_at: isoNow(),
  });
}

function invitePayload(target, actor, resetAccess = false) {
  const rawToken = crypto.randomBytes(36).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600000).toISOString();
  return {
    user: {
      ...target,
      active: false,
      invitation_status: "pending",
      invite_token_hash: sha256(rawToken),
      invite_expires_at: expiresAt,
      invited_at: isoNow(),
      invited_by: actor.id,
      access_revoked_at: resetAccess ? isoNow() : target.access_revoked_at,
      updated_at: isoNow(),
    },
    rawToken,
    expiresAt,
  };
}

export async function inviteUser(payload, actor) {
  requireAdmin(actor);
  const email = String(payload.email || "").trim().toLowerCase();
  const name = String(payload.name || "").trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const error = new Error("البريد الإلكتروني غير صالح.");
    error.status = 422;
    throw error;
  }
  if (!name) {
    const error = new Error("الاسم الكامل مطلوب.");
    error.status = 422;
    throw error;
  }

  const loaded = await loadState({ create: true });
  const state = loaded.state;
  const existingIndex = (state.users || []).findIndex((user) => String(user.email || "").toLowerCase() === email);
  const staticUser = STATIC_USERS.find((user) => user.email === email);
  const existing = existingIndex >= 0 ? state.users[existingIndex] : staticUser;
  if (existingIndex >= 0 && existing.active && existing.invitation_status === "active") {
    const error = new Error("الحساب نشط بالفعل. استخدم إعادة إصدار الدعوة عند الحاجة.");
    error.status = 409;
    throw error;
  }
  if (existingIndex < 0 && staticUser?.active) {
    const error = new Error("هذا حساب انتقالي نشط. استخدم إعادة إصدار الدعوة لتحويله إلى حساب مؤسسي.");
    error.status = 409;
    throw error;
  }

  const base = {
    id: existing?.id || newId("usr"),
    email,
    name,
    role: payload.role || existing?.role || "tracker",
    title: String(payload.title || existing?.title || ""),
    department: String(payload.department || existing?.department || ""),
    clearance: payload.clearance || existing?.clearance || "internal",
    demo: false,
    created_at: existing?.created_at || isoNow(),
  };
  const issued = invitePayload(base, actor);
  if (existingIndex >= 0) state.users[existingIndex] = issued.user;
  else state.users.push(issued.user);
  addAudit(state, "user_invited", actor, issued.user, { expires_at: issued.expiresAt });
  await saveState(loaded.recordId, state);
  return {
    user: publicUser(issued.user),
    activation_url: `${FRONTEND_URL}/activate?token=${issued.rawToken}`,
    expires_at: issued.expiresAt,
    delivery: "manual_secure_link",
  };
}

function userIndexById(state, userId) {
  return (state.users || []).findIndex((user) => user.id === userId);
}

function ensurePersistedOverride(state, userId) {
  let index = userIndexById(state, userId);
  if (index >= 0) return index;
  const staticUser = STATIC_USERS.find((user) => user.id === userId);
  if (!staticUser) return -1;
  state.users.push({ ...staticUser, demo: false, invitation_status: "active", created_at: isoNow(), updated_at: isoNow() });
  return state.users.length - 1;
}

export async function resetInvitation(userId, actor) {
  requireAdmin(actor);
  if (userId === actor.id) {
    const error = new Error("لا يمكنك إعادة ضبط جلستك النشطة من هذا المسار.");
    error.status = 400;
    throw error;
  }
  const loaded = await loadState({ create: true });
  const state = loaded.state;
  const index = ensurePersistedOverride(state, userId);
  if (index < 0) {
    const error = new Error("المستخدم غير موجود.");
    error.status = 404;
    throw error;
  }
  const issued = invitePayload(state.users[index], actor, true);
  state.users[index] = issued.user;
  addAudit(state, "user_access_reset", actor, issued.user, { expires_at: issued.expiresAt });
  await saveState(loaded.recordId, state);
  return {
    user: publicUser(issued.user),
    activation_url: `${FRONTEND_URL}/activate?token=${issued.rawToken}`,
    expires_at: issued.expiresAt,
    delivery: "manual_secure_link",
  };
}

export async function updateUser(userId, payload, actor) {
  requireAdmin(actor);
  const loaded = await loadState({ create: true });
  const state = loaded.state;
  const index = ensurePersistedOverride(state, userId);
  if (index < 0) {
    const error = new Error("المستخدم غير موجود.");
    error.status = 404;
    throw error;
  }
  if (userId === actor.id && (payload.active === false || (payload.role && payload.role !== "admin"))) {
    const error = new Error("لا يمكنك تعطيل حسابك الإداري أو إزالة صلاحية الإدارة منه.");
    error.status = 400;
    throw error;
  }
  const allowed = ["name", "role", "title", "department", "active", "clearance"];
  for (const key of allowed) {
    if (payload[key] !== undefined) state.users[index][key] = payload[key];
  }
  state.users[index].updated_at = isoNow();
  addAudit(state, "user_updated", actor, state.users[index], { fields: allowed.filter((key) => payload[key] !== undefined) });
  await saveState(loaded.recordId, state);
  return publicUser(state.users[index]);
}

export async function disableUser(userId, actor) {
  return updateUser(userId, { active: false }, actor);
}

export async function invitationStatus(token) {
  const { state } = await loadState();
  const tokenHash = sha256(String(token || "").trim());
  const user = (state.users || []).find((item) => item.invite_token_hash === tokenHash);
  if (!user) {
    const error = new Error("الدعوة غير صالحة أو استُخدمت من قبل.");
    error.status = 404;
    throw error;
  }
  if (new Date(user.invite_expires_at).getTime() <= Date.now()) {
    const error = new Error("انتهت صلاحية الدعوة. اطلب من مدير النظام إصدار دعوة جديدة.");
    error.status = 410;
    throw error;
  }
  return { name: user.name, email: user.email, expires_at: user.invite_expires_at, status: user.invitation_status };
}

export async function activateAccount(token, password) {
  validatePassword(password);
  const loaded = await loadState({ create: true });
  const state = loaded.state;
  const tokenHash = sha256(String(token || "").trim());
  const index = (state.users || []).findIndex((item) => item.invite_token_hash === tokenHash);
  if (index < 0) {
    const error = new Error("الدعوة غير صالحة أو استُخدمت من قبل.");
    error.status = 404;
    throw error;
  }
  const user = state.users[index];
  if (new Date(user.invite_expires_at).getTime() <= Date.now()) {
    const error = new Error("انتهت صلاحية الدعوة.");
    error.status = 410;
    throw error;
  }
  const credentials = passwordHash(password);
  state.users[index] = {
    ...user,
    password_hash: credentials.hash,
    password_salt: credentials.salt,
    active: true,
    invitation_status: "active",
    activated_at: isoNow(),
    password_changed_at: isoNow(),
    updated_at: isoNow(),
  };
  delete state.users[index].invite_token_hash;
  delete state.users[index].invite_expires_at;
  delete state.users[index].access_revoked_at;
  addAudit(state, "user_activated", null, state.users[index]);
  await saveState(loaded.recordId, state);
  return { ok: true, message: "تم تفعيل الحساب ويمكنك تسجيل الدخول الآن." };
}

function allRoles(state) {
  const custom = Array.isArray(state.roles) ? state.roles : [];
  const customCodes = new Set(custom.map((role) => role.code));
  return [...DEFAULT_ROLES.filter((role) => !customCodes.has(role.code)), ...custom];
}

function allOrganizations(state) {
  const custom = Array.isArray(state.organizations) ? state.organizations : [];
  return [DEFAULT_ROOT, ...custom.filter((item) => item.id !== DEFAULT_ROOT.id && item.code !== DEFAULT_ROOT.code)];
}

function defaultAssignmentFor(user) {
  const roleCode = LEGACY_ROLE_MAP[user.role] || "viewer";
  const role = DEFAULT_ROLES.find((item) => item.code === roleCode) || DEFAULT_ROLES.find((item) => item.code === "viewer");
  return {
    id: `legacy_${user.id}`,
    user_id: user.id,
    group_id: null,
    role_id: role.id,
    scope_type: "global",
    scope_id: DEFAULT_ROOT.id,
    starts_at: null,
    expires_at: null,
    active: true,
    migration_source: "legacy_role",
  };
}

function isActiveWindow(item) {
  if (item.active === false) return false;
  if (item.starts_at && new Date(item.starts_at).getTime() > Date.now()) return false;
  if (item.expires_at && new Date(item.expires_at).getTime() <= Date.now()) return false;
  return true;
}

function effectiveFor(user, state) {
  const roles = allRoles(state);
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const users = mergeUsers(state);
  const baseAssignments = users.map(defaultAssignmentFor);
  const memberships = (state.memberships || []).filter((item) => item.active !== false && item.user_id === user.id);
  const groupIds = new Set(memberships.map((item) => item.group_id));
  const assignments = [...baseAssignments, ...(state.assignments || [])]
    .filter((item) => isActiveWindow(item) && (item.user_id === user.id || (item.group_id && groupIds.has(item.group_id))));
  const permissions = new Set();
  const matchedRoles = [];
  for (const assignment of assignments) {
    const role = roleById.get(assignment.role_id);
    if (!role || role.active === false) continue;
    for (const permission of role.permissions || []) permissions.add(permission);
    matchedRoles.push(role);
  }
  for (const delegation of state.delegations || []) {
    if (delegation.delegate_id !== user.id || !isActiveWindow(delegation)) continue;
    for (const permission of delegation.permissions || []) {
      if (!(delegation.exclusions || []).includes(permission)) permissions.add(permission);
    }
  }
  permissions.add("module.dashboard.view");
  return { permissions: [...permissions].sort(), roles: matchedRoles };
}

export async function accessMe(user) {
  const { state } = await loadState();
  const effective = effectiveFor(user, state);
  const modules = [...new Set(effective.permissions
    .filter((code) => code.startsWith("module.") && code.endsWith(".view"))
    .map((code) => code.split(".")[1]))].sort();
  if (!modules.includes("dashboard")) modules.unshift("dashboard");
  return {
    user_id: user.id,
    permissions: effective.permissions,
    modules,
    roles: effective.roles,
    clearance: user.clearance || "internal",
  };
}

export async function accessBootstrap(actor) {
  requireAdmin(actor);
  const { state } = await loadState();
  const users = mergeUsers(state).map(publicUser);
  return {
    organizations: allOrganizations(state),
    roles: allRoles(state),
    permissions: DEFAULT_PERMISSIONS,
    assignments: [...users.map(defaultAssignmentFor), ...(state.assignments || [])],
    groups: state.groups || [],
    memberships: (state.memberships || []).filter((item) => item.active !== false),
    delegations: (state.delegations || []).filter((item) => item.active !== false),
    policies: state.policies || [],
    users,
    audit: state.audit || [],
  };
}

function arrayForKind(kind) {
  const map = {
    organizations: "organizations",
    roles: "roles",
    assignments: "assignments",
    groups: "groups",
    memberships: "memberships",
    delegations: "delegations",
    policies: "policies",
  };
  return map[kind] || null;
}

export async function createAccessRecord(kind, payload, actor) {
  requireAdmin(actor);
  const field = arrayForKind(kind);
  if (!field) {
    const error = new Error("نوع سجل الصلاحيات غير مدعوم.");
    error.status = 404;
    throw error;
  }
  const loaded = await loadState({ create: true });
  const state = loaded.state;
  state[field] = Array.isArray(state[field]) ? state[field] : [];
  const prefixes = { organizations: "org", roles: "role", assignments: "asg", groups: "grp", memberships: "mem", delegations: "dlg", policies: "pol" };
  const record = {
    id: payload.id || newId(prefixes[kind] || "rec"),
    ...payload,
    active: payload.active !== false,
    created_at: isoNow(),
    created_by: actor.id,
  };
  if (kind === "roles") {
    record.system = false;
    if (!record.code || !record.name) {
      const error = new Error("اسم الدور ورمزه مطلوبان.");
      error.status = 422;
      throw error;
    }
    if (allRoles(state).some((role) => role.code === record.code)) {
      const error = new Error("رمز الدور مستخدم بالفعل.");
      error.status = 409;
      throw error;
    }
  }
  if (kind === "organizations" && allOrganizations(state).some((item) => item.code === record.code)) {
    const error = new Error("رمز الوحدة التنظيمية مستخدم بالفعل.");
    error.status = 409;
    throw error;
  }
  if (kind === "groups" && (state.groups || []).some((item) => item.code === record.code)) {
    const error = new Error("رمز المجموعة مستخدم بالفعل.");
    error.status = 409;
    throw error;
  }
  if (kind === "memberships") {
    const existing = state.memberships.findIndex((item) => item.user_id === record.user_id && item.group_id === record.group_id);
    if (existing >= 0) state.memberships[existing] = record;
    else state.memberships.push(record);
  } else {
    state[field].push(record);
  }
  addAudit(state, `${kind}_created`, actor, null, { record_id: record.id });
  await saveState(loaded.recordId, state);
  return record;
}

export async function updateAccessRecord(kind, recordId, payload, actor) {
  requireAdmin(actor);
  const field = arrayForKind(kind);
  if (!field) {
    const error = new Error("نوع سجل الصلاحيات غير مدعوم.");
    error.status = 404;
    throw error;
  }
  const loaded = await loadState({ create: true });
  const state = loaded.state;
  const index = (state[field] || []).findIndex((item) => item.id === recordId);
  if (index < 0) {
    const error = new Error("السجل غير موجود.");
    error.status = 404;
    throw error;
  }
  state[field][index] = { ...state[field][index], ...payload, updated_at: isoNow(), updated_by: actor.id };
  addAudit(state, `${kind}_updated`, actor, null, { record_id: recordId });
  await saveState(loaded.recordId, state);
  return state[field][index];
}

export async function revokeAccessRecord(kind, recordId, actor) {
  return updateAccessRecord(kind, recordId, { active: false, revoked_at: isoNow(), revoked_by: actor.id }, actor);
}

export async function simulateAccess(payload, actor) {
  requireAdmin(actor);
  const { state } = await loadState();
  const user = mergeUsers(state).find((item) => item.id === payload.user_id);
  if (!user) {
    const error = new Error("المستخدم غير موجود.");
    error.status = 404;
    throw error;
  }
  const effective = effectiveFor(user, state);
  let allowed = effective.permissions.includes(payload.action);
  const reasons = [allowed ? "مُنحت الصلاحية بواسطة دور أو تفويض نشط." : "لا يوجد دور أو تفويض نشط يمنح هذه الصلاحية."];
  const classification = payload.resource?.classification || "internal";
  const clearance = user.clearance || "internal";
  if ((CLASSIFICATION_RANK[classification] || 1) > (CLASSIFICATION_RANK[clearance] || 1)) {
    allowed = false;
    reasons.push("تصنيف المورد أعلى من مستوى تصريح المستخدم.");
  }
  const context = payload.context || {};
  for (const policy of state.policies || []) {
    if (policy.active === false || !["*", payload.action].includes(policy.action)) continue;
    const conditions = policy.conditions || {};
    let matched = true;
    if (conditions.require_mfa && !context.mfa_verified) matched = false;
    if (conditions.max_amount !== undefined && Number(context.amount || 0) > Number(conditions.max_amount)) matched = false;
    if (conditions.classification && !conditions.classification.includes(classification)) matched = false;
    if (matched) {
      allowed = policy.effect === "allow";
      reasons.push(`انطبقت السياسة: ${policy.name} (${policy.effect}).`);
      if (policy.effect === "deny") break;
    }
  }
  return {
    allowed,
    action: payload.action,
    resource: payload.resource || {},
    reasons,
    matched_roles: [...new Set(effective.roles.map((role) => role.name))],
    effective_permissions: effective.permissions,
    evaluated_at: isoNow(),
  };
}

export function apiError(error, fallbackStatus = 500) {
  return {
    status: Number(error?.status || fallbackStatus),
    detail: error?.message || "حدث خطأ غير متوقع في خدمة الهوية.",
  };
}
