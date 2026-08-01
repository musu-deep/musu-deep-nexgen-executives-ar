import crypto from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET || "nexgen-vercel-hosted-demo-secret-2026";
const STATE_MARKER = "ARAAK_PASSWORD_DIRECTORY_V1:";
const DIRECTORY_VERSION = "official-team-nine-v3";
const LOCAL_STATE_KEY = "__ARAAK_PASSWORD_DIRECTORY__";

// Official ARAAK team directory. Temporary credentials are stored only as scrypt hashes and salts.
const USER_ROSTER = Object.freeze([
  {
    id: "usr_admin",
    email: "louiabdalla1@gmail.com",
    name: "مدير النظام",
    role: "admin",
    title: "مدير النظام والمنصة",
    department: "إدارة المنصة",
    clearance: "executive_secret",
    capabilities: ["platform:admin", "platform:read_all", "tasks:assign", "tasks:distribute"],
    temporary_salt: "913164d81ea3563e930e2a2645d141d1",
    temporary_hash: "31e28ea90d8c99c7b8618dc25a401df42ed4f41fc94b8efb2baaf32eacfd900a259493d64b847f8e0c16ede125b97b8ef339bfad9f32fee94a8aed3f3cfa921b",
  },
  {
    id: "usr_ceo",
    email: "dr.ali@araak.org",
    name: "د. علي العتيبي",
    role: "ceo",
    title: "الرئيس التنفيذي",
    department: "مكتب الرئيس التنفيذي",
    clearance: "executive_secret",
    capabilities: ["platform:read_all", "tasks:assign", "tasks:distribute"],
    temporary_salt: "6a65a4dc910460c343f5c6bda24d982f",
    temporary_hash: "b6d3f66a0bf16f06a630344089027d2ca6fe247eb128afa80e9841c51c8afabb9846b97aba2441e4e953c5effd8cc79e60c6295d9bd1408c4caac7b950a10f84",
  },
  {
    id: "usr_dev",
    email: "sa.dc.1@araak.org",
    name: "د. لؤي عبد الله",
    role: "vp_development",
    title: "نائب الرئيس التنفيذي للتنمية",
    department: "الإدارة العليا",
    clearance: "confidential",
    capabilities: [],
    temporary_salt: "87f5ae2130d376fc6953c901b6b7fb75",
    temporary_hash: "55cb8af6be171c845b933085bf22c016e85a0c0a0cee3c68120a34629d45e4bc128db01c1d96f852793d2c846baab90fcac38b0caa30986abc8cf34380643181",
  },
  {
    id: "usr_national",
    email: "a.alhusam@araak.net",
    name: "م. عبد الرحمن الحسام",
    role: "national_executive",
    title: "المدير التنفيذي لشركة اراك الوطنية",
    department: "اراك الوطنية",
    clearance: "confidential",
    capabilities: [],
    temporary_salt: "7e84c5bf92aae1d4b4311619a4c82133",
    temporary_hash: "53eebb4fa535d62aa0b292e160d4807110c21484cf38c822c397d14397dd3afc779a3794bba6f3ef4bb9cc50de933aea3c65b728d53f1544b5143b80223949f8",
  },
  {
    id: "usr_followup",
    email: "a.alotaibi@araak.org",
    name: "م. عبد الله العتيبي",
    role: "tracker",
    title: "الإشراف والمتابعة",
    department: "مكتب الرئيس التنفيذي",
    clearance: "confidential",
    capabilities: ["platform:read_all", "tasks:assign"],
    temporary_salt: "6c4d310f1b92ce417efaf568d3f10754",
    temporary_hash: "34edf9808c3835d5b5ac5e058d4de60ec8df5935a7a9348b2894ba595d98f90804863a3843282ab5c3ed9b805ca226604a72dc925420123265da573923301d05",
  },
  {
    id: "usr_finance",
    email: "fm@araak.org",
    name: "أبو إياد",
    role: "finance",
    title: "المدير المالي",
    department: "الإدارة المالية",
    clearance: "financial_sensitive",
    capabilities: [],
    temporary_salt: "02abbf883f3bb65f2e890d63baeb3e79",
    temporary_hash: "8931fb5e8a9fca6390d0333d4729f897410eb9be4d6b4d11bfae02b950428907970196af36e6ed4306af0540c60b03369e971d98b7f00ce4d26431cbe44442ff",
  },
  {
    id: "usr_marketing",
    email: "scm@araak.org",
    name: "أ. محمود عوض",
    role: "marketing_tenders",
    title: "مسؤول منصة التسويق والمناقصات",
    department: "التسويق والمناقصات",
    clearance: "confidential",
    capabilities: ["platform:read_all", "tasks:assign", "tasks:distribute"],
    temporary_salt: "a00450a43ea775ee047c482745c301df",
    temporary_hash: "81b17a74b9eea14c0ff3d9c4d799845319035bd54b8d8e7a7d663d6a5171a1fc2b271aa6b56142f7bd930e04998f11c6da225c875c9067cb460b4ba281c52df1",
  },
  {
    id: "usr_procurement",
    email: "contracting@araak.org",
    name: "محمد شكاك",
    role: "procurement",
    title: "المشتريات",
    department: "المشتريات والتعاقدات",
    clearance: "restricted",
    capabilities: [],
    temporary_salt: "6d272721eb640003410f2a5a81bf228c",
    temporary_hash: "dafbf9095ccff78a78aa876828aa176d2c524db117707ae64ba60cb564a73271d58aecfa48f33c1212caf34e1aedcb68d4d7bd0c07f91a814f757675fb801508",
  },
  {
    id: "usr_tech",
    email: "sa.it.1@araak.org",
    name: "مشرف التقنية",
    role: "tech_supervisor",
    title: "مشرف التقنية",
    department: "تقنية المعلومات",
    clearance: "restricted",
    capabilities: [],
    temporary_salt: "5abe1ae640469075c41e9473f22deb75",
    temporary_hash: "6fd13070230b6575b0b6e69964b2de38f82c3eace6734668992a5892c02d6c351f8076c186c2731a8bebf6e1447c1094bbbd5ebba362ec527fde573f1e5e077b",
  }
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
    version: 3,
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
