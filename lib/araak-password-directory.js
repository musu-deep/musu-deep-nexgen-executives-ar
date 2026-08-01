import crypto from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET || "nexgen-vercel-hosted-demo-secret-2026";
const STATE_MARKER = "ARAAK_PASSWORD_DIRECTORY_V1:";
const DIRECTORY_VERSION = "authorized-executive-six-v2";
const LOCAL_STATE_KEY = "__ARAAK_PASSWORD_DIRECTORY__";

// The executive access roster is intentionally limited to six approved identities.
// Assigned temporary passwords are stored only as scrypt hashes and salts.
const USER_ROSTER = Object.freeze([
  {
    id: "usr_admin",
    email: "admin@arak.com",
    name: "مدير النظام",
    role: "admin",
    title: "مدير النظام والمنصة",
    department: "إدارة المنصة",
    clearance: "executive_secret",
    temporary_salt: "829f0230290fa2bdc04b2befed01cf1c",
    temporary_hash: "80ec5c871007db6f586196b43b7bffb8932aab5bee8d0c6b420ca0aa767e86b671d6a23f6d4ade6bef1b59feb87522e0c281ab0731cf8209fce9ac8cc49ad59e",
  },
  {
    id: "usr_ceo",
    email: "ceo@arak.com",
    name: "د. علي العتيبي",
    role: "ceo",
    title: "رئيس مجلس الإدارة والرئيس التنفيذي",
    department: "مكتب الرئيس التنفيذي",
    clearance: "executive_secret",
    temporary_salt: "f8b8438d42eab17de0b90fad43446d33",
    temporary_hash: "03d9f6722b694ad7037d804bf7ee2267d2fa1be9d0f560711be2e08ec84225b123418728b6241845d8647144a343900f60fad413d1bd14da08b433403760886d",
  },
  {
    id: "usr_dev",
    email: "vp.dev@arak.com",
    name: "د. لؤي عبد الله أحمد",
    role: "vp_development",
    title: "نائب الرئيس التنفيذي للتنمية",
    department: "الإدارة العليا",
    clearance: "confidential",
    temporary_salt: "8925cf73f08ebef96519fa65fe9daaab",
    temporary_hash: "392e027916e710f21513c562f1a422fd007b4433707e8a86b43d86a90a767f0421029201410f52cf3bd845340807d69cb5e0e2a09be14873a5e099f46abd569b",
  },
  {
    id: "usr_inv",
    email: "vp.invest@arak.com",
    name: "نائب الرئيس التنفيذي للاستثمار",
    role: "vp_investment",
    title: "نائب الرئيس التنفيذي للاستثمار",
    department: "قطاع الاستثمار",
    clearance: "financial_sensitive",
    temporary_salt: "8483e575a54ad26d3f3ac3069a5250d8",
    temporary_hash: "513b254934f31b6fedd26ce94a43dabdfebb9f962a4ff2870a76f523590427c0354b2e92d0b9d0ff073e8cd267d8b3047244e53acabef2cb09b62428d8b7b962",
  },
  {
    id: "usr_mgr",
    email: "dev.manager@arak.com",
    name: "مدير وحدة الأعمال",
    role: "dev_manager",
    title: "مدير العمليات والتنفيذ",
    department: "العمليات والتنفيذ",
    clearance: "restricted",
    temporary_salt: "7060061cac1b3ac15395aca96fa71fd6",
    temporary_hash: "b0d459df80df91de1264294d98ba6421ca7ef426768a4fd8eae64f6f948de4e20e78749ae9bc16528e122e93872c41b244a50aacd68384280ee6444e4721762b",
  },
  {
    id: "usr_track",
    email: "tracker@arak.com",
    name: "المتابعة التنفيذية",
    role: "tracker",
    title: "مسؤول المتابعة التنفيذية",
    department: "مكتب الرئيس التنفيذي",
    clearance: "confidential",
    temporary_salt: "cddd1929619c23ffd5468188569d72a8",
    temporary_hash: "e37b928f1d5b6799d5de84943ea034dd00a71aef30094dca6fae0a7c72cf2b6d3807d9912f95bb0e2a0ed27417be80f618497356e150e457337f65e1c17d9708",
  },
]);

const now = () => new Date().toISOString();
const newId = (prefix) => `${prefix}_${crypto.randomUUID()}`;

function passwordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: crypto.scryptSync(String(password || ""), salt, 64).toString("hex"),
  };
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

function rosterEntry(userId) {
  return USER_ROSTER.find((profile) => profile.id === String(userId || ""));
}

function seededUsers() {
  const createdAt = now();
  return USER_ROSTER.map(({ temporary_hash, temporary_salt, ...profile }) => ({
    ...profile,
    password_hash: temporary_hash,
    password_salt: temporary_salt,
    must_change_password: true,
    active: true,
    created_at: createdAt,
    updated_at: createdAt,
    directory_source: DIRECTORY_VERSION,
  }));
}

function seededState() {
  return {
    version: 2,
    directory_version: DIRECTORY_VERSION,
    users: seededUsers(),
    audit: [],
  };
}

function publicUser(user) {
  if (!user) return null;
  const {
    password_hash,
    password_salt,
    temporary_hash,
    temporary_salt,
    ...safe
  } = user;
  return safe;
}

function encodeState(state) {
  const encoded = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `<!--${STATE_MARKER}${encoded}-->`;
}

function decodeState(description) {
  const match = String(description || "").match(/ARAAK_PASSWORD_DIRECTORY_V1:([A-Za-z0-9_-]+)/);
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.url}/json/2/${encodeURIComponent(model)}/${encodeURIComponent(method)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `bearer ${config.apiKey}`,
        "X-Odoo-Database": config.database,
        "User-Agent": "ARAAK-CEO-AUTHORIZED-DIRECTORY/2.0",
      },
      body: JSON.stringify({
        context: { lang: config.language, active_test: false },
        ...parameters,
      }),
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
    vals: {
      name: "[SYSTEM] ARAAK Authorized Password Directory",
      description: encodeState(state),
      active: true,
    },
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
      vals_list: [{
        name: "[SYSTEM] ARAAK Authorized Password Directory",
        type: "opportunity",
        description: encodeState(state),
        active: true,
      }],
    });
    const recordId = typeof created === "number"
      ? created
      : Array.isArray(created)
        ? Number(created[0]?.id || created[0])
        : Number(created?.id);
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
  loaded.state.audit = Array.isArray(loaded.state.audit)
    ? loaded.state.audit.slice(-300)
    : [];

  if (!loaded.persistent) {
    globalThis[LOCAL_STATE_KEY] = loaded.state;
    return;
  }

  if (odooConfig().readOnly) throw new Error("مخزن المستخدمين مضبوط على القراءة فقط.");
  await writeOdooState(loaded.recordId, loaded.state);
}

function findByLogin(state, email) {
  const normalized = String(email || "").trim().toLowerCase();
  return (state.users || []).find((user) => String(user.email || "").toLowerCase() === normalized);
}

function parseToken(token) {
  try {
    const [payloadPart, signaturePart] = String(token || "").split(".");
    if (!payloadPart || !signaturePart) return null;
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(payloadPart).digest("base64url");
    if (expected.length !== signaturePart.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signaturePart))) return null;
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    return Number(payload.exp || 0) >= Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function requireAdmin(actor) {
  if (!actor || actor.role !== "admin") {
    const error = new Error("هذه العملية متاحة لمدير النظام فقط.");
    error.status = 403;
    throw error;
  }
}

function audit(state, event, actor, target, details = {}) {
  state.audit = Array.isArray(state.audit) ? state.audit : [];
  state.audit.push({
    id: newId("audit"),
    event,
    actor_id: actor?.id || null,
    target_id: target?.id || null,
    details,
    created_at: now(),
  });
}

export function signPasswordDirectoryToken(user) {
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

export async function authenticatePasswordDirectory(email, password) {
  const loaded = await loadDirectory();
  const user = findByLogin(loaded.state, email);
  if (!user || user.active === false) return null;
  if (!verifyPassword(password, user.password_salt, user.password_hash)) return null;
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

export async function listPasswordDirectoryUsers(actor) {
  requireAdmin(actor);
  const loaded = await loadDirectory();
  return (loaded.state.users || []).map(publicUser);
}

export async function rebuildPasswordDirectory(actor) {
  requireAdmin(actor);
  const loaded = await loadDirectory();
  loaded.state = seededState();
  audit(loaded.state, "authorized_directory_rebuilt", actor, null, {
    count: loaded.state.users.length,
  });
  await saveDirectory(loaded);
  return { users: loaded.state.users.map(publicUser) };
}

export async function resetTemporaryPassword(userId, actor) {
  requireAdmin(actor);
  const loaded = await loadDirectory();
  const user = (loaded.state.users || []).find((item) => item.id === userId);
  const profile = rosterEntry(userId);

  if (!user || !profile) {
    const error = new Error("المستخدم غير موجود أو غير مخول.");
    error.status = 404;
    throw error;
  }

  user.password_hash = profile.temporary_hash;
  user.password_salt = profile.temporary_salt;
  user.must_change_password = true;
  user.updated_at = now();
  audit(loaded.state, "individual_temporary_password_reset", actor, user);
  await saveDirectory(loaded);
  return { user: publicUser(user) };
}

export async function updatePasswordDirectoryUser(userId, payload, actor) {
  requireAdmin(actor);
  const loaded = await loadDirectory();
  const user = (loaded.state.users || []).find((item) => item.id === userId);

  if (!user || !rosterEntry(userId)) {
    const error = new Error("المستخدم غير موجود أو غير مخول.");
    error.status = 404;
    throw error;
  }

  const allowedFields = ["name", "role", "title", "department", "clearance", "active"];
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(payload || {}, field)) user[field] = payload[field];
  }
  user.updated_at = now();
  audit(loaded.state, "authorized_user_updated", actor, user);
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
  if (!user || user.active === false || !rosterEntry(user.id)) {
    const error = new Error("الحساب غير مخول أو غير نشط.");
    error.status = 403;
    throw error;
  }

  const currentPassword = String(payload?.current_password || "");
  const newPassword = String(payload?.new_password || "");
  if (!verifyPassword(currentPassword, user.password_salt, user.password_hash)) {
    const error = new Error("كلمة المرور الحالية غير صحيحة.");
    error.status = 401;
    throw error;
  }

  validateNewPassword(newPassword);
  if (currentPassword === newPassword) {
    const error = new Error("اختر كلمة مرور جديدة مختلفة عن المؤقتة.");
    error.status = 422;
    throw error;
  }

  const credentials = passwordHash(newPassword);
  user.password_hash = credentials.hash;
  user.password_salt = credentials.salt;
  user.must_change_password = false;
  user.updated_at = now();
  audit(loaded.state, "password_changed", user, user, { first_login: true });
  await saveDirectory(loaded);
  return publicUser(user);
}

export function passwordDirectoryApiError(error) {
  return {
    status: Number(error?.status || 500),
    detail: error?.message || "حدث خطأ غير متوقع.",
  };
}

// Retained only for backwards-compatible imports; no password is exposed.
export const TEMPORARY_PASSWORD = null;
