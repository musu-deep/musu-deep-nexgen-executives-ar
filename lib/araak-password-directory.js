import crypto from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET || "nexgen-vercel-hosted-demo-secret-2026";
const STATE_MARKER = "ARAAK_PASSWORD_DIRECTORY_V1:";
const DIRECTORY_VERSION = "password-first-login-v1";
const DEFAULT_TEMP_PASSWORD = process.env.DEFAULT_TEMP_PASSWORD || "Arak@2026";
const LOCAL_STATE_KEY = "__ARAAK_PASSWORD_DIRECTORY__";

const USER_ROSTER = [
  { id: "usr_admin", email: "admin@arak.com", name: "مدير النظام", role: "admin", title: "مدير النظام والمنصة", department: "إدارة المنصة", clearance: "executive_secret", aliases: ["admin@company.demo"] },
  { id: "usr_ceo", email: "ceo@arak.com", name: "د. علي العتيبي", role: "ceo", title: "رئيس مجلس الإدارة والرئيس التنفيذي", department: "مكتب الرئيس التنفيذي", clearance: "executive_secret", aliases: ["ceo@company.demo"] },
  { id: "usr_dev", email: "vp.dev@arak.com", name: "د. لؤي عبد الله أحمد", role: "vp_development", title: "نائب الرئيس التنفيذي للتنمية", department: "الإدارة العليا", clearance: "confidential", aliases: ["development@company.demo", "louiabdalla1@gmail.com"] },
  { id: "usr_inv", email: "vp.invest@arak.com", name: "نائب الرئيس التنفيذي للاستثمار", role: "vp_investment", title: "نائب الرئيس التنفيذي للاستثمار", department: "قطاع الاستثمار", clearance: "financial_sensitive", aliases: ["investment@company.demo"] },
  { id: "usr_mgr", email: "dev.manager@arak.com", name: "مدير وحدة الأعمال", role: "dev_manager", title: "مدير العمليات والتنفيذ", department: "العمليات والتنفيذ", clearance: "restricted", aliases: ["manager@company.demo"] },
  { id: "usr_track", email: "tracker@arak.com", name: "المتابعة التنفيذية", role: "tracker", title: "مسؤول المتابعة التنفيذية", department: "مكتب الرئيس التنفيذي", clearance: "confidential", aliases: ["followup@company.demo"] },
  { id: "usr_secretariat", email: "secretariat@arak.com", name: "خالد العوبثاني", role: "tracker", title: "مسؤول السكرتارية التنفيذية", department: "السكرتارية التنفيذية", clearance: "confidential", aliases: ["secretariat@company.demo"] },
  { id: "usr_hr", email: "hr@arak.com", name: "محمد السقاف", role: "dev_manager", title: "مسؤول الموارد البشرية", department: "الموارد البشرية", clearance: "restricted", aliases: ["hr@company.demo"] },
  { id: "usr_finance", email: "finance@arak.com", name: "محمد السيمت أبو إياد", role: "dev_manager", title: "المدير المالي", department: "الإدارة المالية", clearance: "financial_sensitive", aliases: ["finance@company.demo"] },
  { id: "usr_quality", email: "quality@arak.com", name: "عاصم الملاحمة", role: "dev_manager", title: "مدير التفتيش والرقابة والجودة", department: "التفتيش والرقابة والجودة", clearance: "restricted", aliases: ["quality@company.demo"] },
  { id: "usr_steel_factory", email: "steel.factory@arak.com", name: "سامر الملاحمة", role: "dev_manager", title: "مدير مصنع الحديد", department: "مصنع الحديد", clearance: "restricted", aliases: ["steel.factory@company.demo"] },
  { id: "usr_commercial", email: "commercial@arak.com", name: "م. محمد شكاك", role: "dev_manager", title: "مسؤول المشتريات والمستودعات والشؤون التجارية", department: "المشتريات والمستودعات", clearance: "restricted", aliases: ["commercial@company.demo"] },
  { id: "usr_factory", email: "factory@arak.com", name: "م. عبد الرحمن الحسام", role: "dev_manager", title: "مدير اراك الوطنية والمصنع", department: "المصنع واراك الوطنية", clearance: "restricted", aliases: ["factory@company.demo"] },
  { id: "usr_technical_office", email: "technical.office@arak.com", name: "م. إسلام محمد", role: "dev_manager", title: "مسؤول المكتب الفني", department: "المكتب الفني", clearance: "restricted", aliases: ["technical.office@company.demo"] },
  { id: "usr_wholesale", email: "wholesale@arak.com", name: "مدير مبيعات الجملة", role: "dev_manager", title: "مدير مبيعات الجملة", department: "مبيعات الجملة", clearance: "restricted", aliases: ["wholesale@company.demo"] },
  { id: "usr_stores", email: "stores@arak.com", name: "م. طه الأهدل", role: "dev_manager", title: "مدير اراك ستورز والتجارة الإلكترونية", department: "اراك ستورز", clearance: "restricted", aliases: ["stores@company.demo"] },
];

const now = () => new Date().toISOString();
const newId = (prefix) => `${prefix}_${crypto.randomUUID()}`;

function passwordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(String(password || ""), salt, 64).toString("hex") };
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

function validateNewPassword(password) {
  const value = String(password || "");
  const missing = [];
  if (value.length < 10) missing.push("10 خانات على الأقل");
  if (!/[A-Z]/.test(value)) missing.push("حرف إنجليزي كبير");
  if (!/[a-z]/.test(value)) missing.push("حرف إنجليزي صغير");
  if (!/\d/.test(value)) missing.push("رقم");
  if (!/[^A-Za-z0-9]/.test(value)) missing.push("رمز خاص");
  if (missing.length) {
    const error = new Error(`يجب أن تتضمن كلمة المرور الجديدة: ${missing.join("، ")}.`);
    error.status = 422;
    throw error;
  }
}

function seededUsers() {
  return USER_ROSTER.map((profile) => {
    const credentials = passwordHash(DEFAULT_TEMP_PASSWORD);
    return {
      ...profile,
      password_hash: credentials.hash,
      password_salt: credentials.salt,
      must_change_password: true,
      active: true,
      created_at: now(),
      updated_at: now(),
      directory_source: DIRECTORY_VERSION,
    };
  });
}

function seededState() {
  return { version: 1, directory_version: DIRECTORY_VERSION, users: seededUsers(), audit: [] };
}

function publicUser(user) {
  if (!user) return null;
  const { password_hash, password_salt, aliases, ...safe } = user;
  return safe;
}

function encodeState(state) {
  return `<!--${STATE_MARKER}${Buffer.from(JSON.stringify(state), "utf8").toString("base64url")}-->`;
}

function decodeState(description) {
  const match = String(description || "").match(/ARAAK_PASSWORD_DIRECTORY_V1:([A-Za-z0-9_-]+)/);
  if (!match) return null;
  try { return JSON.parse(Buffer.from(match[1], "base64url").toString("utf8")); }
  catch { return null; }
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.url}/json/2/${encodeURIComponent(model)}/${encodeURIComponent(method)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `bearer ${config.apiKey}`,
        "X-Odoo-Database": config.database,
        "User-Agent": "ARAAK-CEO-PASSWORD-DIRECTORY/1.0",
      },
      body: JSON.stringify({ context: { lang: config.language, active_test: false }, ...parameters }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || payload?.name || `HTTP ${response.status}`);
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

async function writeOdooState(recordId, state) {
  await odooCall("crm.lead", "write", {
    ids: [Number(recordId)],
    vals: { name: "[SYSTEM] ARAAK Password Directory", description: encodeState(state), active: true },
  });
}

async function loadDirectory() {
  const config = odooConfig();
  if (!config.apiKey) {
    if (!globalThis[LOCAL_STATE_KEY]) globalThis[LOCAL_STATE_KEY] = seededState();
    return { state: globalThis[LOCAL_STATE_KEY], recordId: null, persistent: false };
  }

  const rows = await odooCall("crm.lead", "search_read", {
    domain: [["description", "ilike", STATE_MARKER]],
    fields: ["id", "description", "write_date"],
    order: "write_date desc",
    limit: 1,
  });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    if (config.readOnly) throw new Error("مخزن المستخدمين مضبوط على القراءة فقط.");
    const state = seededState();
    const created = await odooCall("crm.lead", "create", {
      vals_list: [{ name: "[SYSTEM] ARAAK Password Directory", type: "opportunity", description: encodeState(state), active: true }],
    });
    const recordId = typeof created === "number" ? created : Array.isArray(created) ? Number(created[0]?.id || created[0]) : Number(created?.id);
    if (!recordId) throw new Error("تعذر إنشاء دليل المستخدمين.");
    return { state, recordId, persistent: true };
  }

  let state = decodeState(row.description) || seededState();
  if (state.directory_version !== DIRECTORY_VERSION) {
    state = seededState();
    if (!config.readOnly) await writeOdooState(row.id, state);
  }
  return { state, recordId: Number(row.id), persistent: true };
}

async function saveDirectory(loaded) {
  loaded.state.audit = Array.isArray(loaded.state.audit) ? loaded.state.audit.slice(-300) : [];
  if (!loaded.persistent) {
    globalThis[LOCAL_STATE_KEY] = loaded.state;
    return;
  }
  if (odooConfig().readOnly) throw new Error("مخزن المستخدمين مضبوط على القراءة فقط.");
  await writeOdooState(loaded.recordId, loaded.state);
}

function findByLogin(state, email) {
  const normalized = String(email || "").trim().toLowerCase();
  return (state.users || []).find((user) => user.email.toLowerCase() === normalized || (user.aliases || []).some((alias) => alias.toLowerCase() === normalized));
}

function parseToken(token) {
  try {
    const [payloadPart, signaturePart] = String(token || "").split(".");
    if (!payloadPart || !signaturePart) return null;
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(payloadPart).digest("base64url");
    if (expected.length !== signaturePart.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signaturePart))) return null;
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    return Number(payload.exp || 0) >= Date.now() ? payload : null;
  } catch { return null; }
}

export function signPasswordDirectoryToken(user) {
  const legacyIds = { admin: "usr_admin", ceo: "usr_ceo", vp_development: "usr_dev", vp_investment: "usr_inv", dev_manager: "usr_mgr", tracker: "usr_track" };
  const payload = Buffer.from(JSON.stringify({
    id: legacyIds[user.role] || user.id,
    profile_id: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 12 * 3600000,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export async function authenticatePasswordDirectory(email, password) {
  const loaded = await loadDirectory();
  const user = findByLogin(loaded.state, email);
  if (!user || user.active === false || !verifyPassword(password, user.password_salt, user.password_hash)) return null;
  return publicUser(user);
}

export async function currentPasswordDirectoryUser(request) {
  const authorization = request.headers.authorization || request.headers.Authorization || "";
  const decoded = parseToken(String(authorization).replace(/^Bearer\s+/i, ""));
  if (!decoded) return null;
  const loaded = await loadDirectory();
  const user = (loaded.state.users || []).find((item) => item.id === (decoded.profile_id || decoded.id));
  return user && user.active !== false ? publicUser(user) : null;
}

function requireAdmin(actor) {
  if (!actor || actor.role !== "admin") {
    const error = new Error("هذه العملية حصرية لمدير النظام.");
    error.status = 403;
    throw error;
  }
}

function audit(state, event, actor, target, details = {}) {
  state.audit = Array.isArray(state.audit) ? state.audit : [];
  state.audit.push({ id: newId("audit"), event, actor_id: actor?.id || null, target_id: target?.id || null, details, created_at: now() });
}

export async function listPasswordDirectoryUsers(actor) {
  requireAdmin(actor);
  const loaded = await loadDirectory();
  return (loaded.state.users || []).map(publicUser);
}

export async function rebuildPasswordDirectory(actor) {
  requireAdmin(actor);
  const loaded = await loadDirectory();
  loaded.state = seededState();
  audit(loaded.state, "user_directory_rebuilt", actor, null, { count: loaded.state.users.length });
  await saveDirectory(loaded);
  return { users: loaded.state.users.map(publicUser), temporary_password: DEFAULT_TEMP_PASSWORD };
}

export async function resetTemporaryPassword(userId, actor) {
  requireAdmin(actor);
  const loaded = await loadDirectory();
  const user = (loaded.state.users || []).find((item) => item.id === userId);
  if (!user) {
    const error = new Error("المستخدم غير موجود.");
    error.status = 404;
    throw error;
  }
  const credentials = passwordHash(DEFAULT_TEMP_PASSWORD);
  Object.assign(user, {
    password_hash: credentials.hash,
    password_salt: credentials.salt,
    must_change_password: true,
    active: true,
    password_reset_at: now(),
    updated_at: now(),
  });
  audit(loaded.state, "temporary_password_reset", actor, user);
  await saveDirectory(loaded);
  return { user: publicUser(user), temporary_password: DEFAULT_TEMP_PASSWORD };
}

export async function updatePasswordDirectoryUser(userId, payload, actor) {
  requireAdmin(actor);
  const loaded = await loadDirectory();
  const user = (loaded.state.users || []).find((item) => item.id === userId);
  if (!user) {
    const error = new Error("المستخدم غير موجود.");
    error.status = 404;
    throw error;
  }
  if (userId === actor.id && payload.active === false) {
    const error = new Error("لا يمكنك تعطيل حساب الإدارة المستخدم حالياً.");
    error.status = 400;
    throw error;
  }
  for (const key of ["name", "role", "title", "department", "active", "clearance"]) {
    if (payload[key] !== undefined) user[key] = payload[key];
  }
  user.updated_at = now();
  audit(loaded.state, "user_updated", actor, user);
  await saveDirectory(loaded);
  return publicUser(user);
}

export async function changeFirstLoginPassword(request, payload) {
  const authorization = request.headers.authorization || request.headers.Authorization || "";
  const decoded = parseToken(String(authorization).replace(/^Bearer\s+/i, ""));
  if (!decoded) {
    const error = new Error("انتهت جلسة الدخول. سجّل الدخول مرة أخرى.");
    error.status = 401;
    throw error;
  }
  const loaded = await loadDirectory();
  const user = (loaded.state.users || []).find((item) => item.id === (decoded.profile_id || decoded.id));
  if (!user || user.active === false) {
    const error = new Error("المستخدم غير موجود أو غير نشط.");
    error.status = 401;
    throw error;
  }
  if (!verifyPassword(payload.current_password, user.password_salt, user.password_hash)) {
    const error = new Error("كلمة المرور الحالية غير صحيحة.");
    error.status = 422;
    throw error;
  }
  validateNewPassword(payload.new_password);
  if (payload.current_password === payload.new_password) {
    const error = new Error("اختر كلمة مرور جديدة مختلفة عن المؤقتة.");
    error.status = 422;
    throw error;
  }
  const credentials = passwordHash(payload.new_password);
  Object.assign(user, {
    password_hash: credentials.hash,
    password_salt: credentials.salt,
    must_change_password: false,
    password_changed_at: now(),
    updated_at: now(),
  });
  audit(loaded.state, "password_changed", user, user, { first_login: true });
  await saveDirectory(loaded);
  return publicUser(user);
}

export function passwordDirectoryApiError(error) {
  return { status: Number(error?.status || 500), detail: error?.message || "حدث خطأ غير متوقع." };
}

export const TEMPORARY_PASSWORD = DEFAULT_TEMP_PASSWORD;
