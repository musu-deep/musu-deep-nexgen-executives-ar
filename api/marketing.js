import crypto from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET || "nexgen-vercel-hosted-demo-secret-2026";
const MARKER = "ARAAK_MARKETING_V1:";
const DEFAULT_SOURCES = ["اعتماد", "فرصة", "منافس", "مناقصات", "إحالة مباشرة", "مصدر داخلي"];
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const MAX_FILES = 5;

function setHeaders(response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function send(response, status, payload) {
  setHeaders(response);
  return response.status(status).json(payload);
}

function bodyOf(request) {
  if (request.body == null) return {};
  if (typeof request.body === "object") return request.body;
  try {
    return JSON.parse(request.body);
  } catch {
    return {};
  }
}

function parseInstitutionalToken(request) {
  const authorization = request.headers.authorization || request.headers.Authorization || "";
  const token = String(authorization).replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  try {
    const [payloadPart, signaturePart] = token.split(".");
    if (!payloadPart || !signaturePart) return null;
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(payloadPart).digest("base64url");
    if (expected.length !== signaturePart.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signaturePart))) return null;
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    if (!payload?.email || Number(payload.exp || 0) < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function odooConfig() {
  return {
    enabled: String(process.env.ODOO_ENABLED || "true").toLowerCase() !== "false",
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
  if (!config.enabled) throw new Error("التكامل المؤسسي غير مفعل.");
  if (!config.apiKey) throw new Error("مفتاح التكامل المؤسسي غير مضاف إلى بيئة ARAAK CEO.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.url}/json/2/${encodeURIComponent(model)}/${encodeURIComponent(method)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `bearer ${config.apiKey}`,
        "X-Odoo-Database": config.database,
        "User-Agent": "ARAAK-CEO-Marketing-Gateway/1.0",
      },
      body: JSON.stringify({
        context: { lang: config.language },
        ...parameters,
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.message || payload?.name || payload?.error || `HTTP ${response.status}`;
      throw new Error(`تعذر تنفيذ العملية في السجل المركزي: ${message}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<!--.*?-->/gs, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function encodeMetadata(metadata) {
  return Buffer.from(JSON.stringify(metadata), "utf8").toString("base64url");
}

function decodeMetadata(description) {
  const match = String(description || "").match(/ARAAK_MARKETING_V1:([A-Za-z0-9_-]+)/);
  if (!match) return null;
  try {
    return JSON.parse(Buffer.from(match[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function buildDescription(metadata, description, requirements) {
  const marker = `<!--${MARKER}${encodeMetadata(metadata)}-->`;
  const sections = [
    description ? `<p><strong>الوصف:</strong> ${escapeHtml(description)}</p>` : "",
    requirements ? `<p><strong>المتطلبات:</strong> ${escapeHtml(requirements)}</p>` : "",
    metadata.reference ? `<p><strong>المرجع:</strong> ${escapeHtml(metadata.reference)}</p>` : "",
    metadata.source ? `<p><strong>المصدر:</strong> ${escapeHtml(metadata.source)}</p>` : "",
  ].filter(Boolean);
  return `${marker}${sections.join("\n")}`;
}

function createdId(result) {
  if (typeof result === "number") return result;
  if (Array.isArray(result)) {
    const first = result[0];
    if (typeof first === "number") return first;
    if (first && typeof first.id === "number") return first.id;
  }
  if (result && typeof result.id === "number") return result.id;
  return null;
}

function many2oneLabel(value) {
  return Array.isArray(value) ? String(value[1] || "") : "";
}

function normaliseAttachment(record) {
  return {
    id: Number(record.id),
    name: String(record.name || "ملف"),
    mime_type: String(record.mimetype || "application/octet-stream"),
    file_size: Number(record.file_size || 0),
    created_at: record.create_date || null,
  };
}

function normaliseLead(record, attachmentsByLead) {
  const metadata = decodeMetadata(record.description) || {};
  return {
    id: Number(record.id),
    kind: metadata.kind === "tender" ? "tender" : "opportunity",
    title: String(record.name || ""),
    reference: metadata.reference || null,
    client: record.partner_name || metadata.client || null,
    entity: metadata.entity || null,
    city: record.city || metadata.city || null,
    value: Number(record.expected_revenue || metadata.value || 0) || null,
    deadline: record.date_deadline || metadata.deadline || null,
    publication_date: metadata.publication_date || null,
    description: metadata.description || stripHtml(record.description),
    requirements: metadata.requirements || null,
    source: metadata.source || "مصدر داخلي",
    source_url: metadata.source_url || null,
    status: metadata.status || (record.active === false ? "cancelled" : "active"),
    current_stage: metadata.current_stage || many2oneLabel(record.stage_id) || "الاستقبال",
    stage_label: many2oneLabel(record.stage_id) || metadata.current_stage || "الاستقبال",
    probability: Number(record.probability || 0),
    owner: many2oneLabel(record.user_id) || null,
    team: many2oneLabel(record.team_id) || null,
    created_at: record.create_date || null,
    updated_at: record.write_date || null,
    attachments: attachmentsByLead.get(Number(record.id)) || [],
  };
}

async function listRecords(kind) {
  const records = await odooCall("crm.lead", "search_read", {
    domain: [["description", "ilike", MARKER]],
    fields: [
      "id", "name", "partner_name", "city", "expected_revenue", "date_deadline",
      "description", "stage_id", "probability", "active", "create_date", "write_date",
      "user_id", "team_id",
    ],
    order: "create_date desc",
    limit: 250,
  });

  const leads = Array.isArray(records) ? records : [];
  const ids = leads.map((record) => Number(record.id)).filter(Boolean);
  const attachmentsByLead = new Map();

  if (ids.length > 0) {
    const attachments = await odooCall("ir.attachment", "search_read", {
      domain: [["res_model", "=", "crm.lead"], ["res_id", "in", ids]],
      fields: ["id", "name", "mimetype", "file_size", "create_date", "res_id"],
      order: "create_date desc",
      limit: 1000,
    });
    for (const attachment of Array.isArray(attachments) ? attachments : []) {
      const leadId = Number(attachment.res_id);
      const current = attachmentsByLead.get(leadId) || [];
      current.push(normaliseAttachment(attachment));
      attachmentsByLead.set(leadId, current);
    }
  }

  return leads
    .map((record) => normaliseLead(record, attachmentsByLead))
    .filter((record) => !kind || record.kind === kind);
}

async function createRecord(payload, user) {
  const config = odooConfig();
  if (config.readOnly) throw new Error("التكامل المؤسسي مضبوط حاليًا على القراءة فقط.");

  const kind = payload.kind === "tender" ? "tender" : "opportunity";
  const record = payload.record || {};
  if (!String(record.title || "").trim()) throw new Error("عنوان الفرصة أو المنافسة مطلوب.");

  const metadata = {
    kind,
    reference: String(record.reference || "").trim() || null,
    client: String(record.client || "").trim() || null,
    entity: String(record.entity || "").trim() || null,
    city: String(record.city || "").trim() || null,
    value: record.value ? Number(record.value) : null,
    deadline: record.deadline || null,
    publication_date: record.publication_date || null,
    description: String(record.description || "").trim() || null,
    requirements: String(record.requirements || "").trim() || null,
    source: String(record.source || "مصدر داخلي").trim(),
    source_url: String(record.source_url || "").trim() || null,
    status: kind === "tender" ? "in_progress" : "new",
    current_stage: kind === "tender" ? "الاستقبال" : "الدراسة الأولية",
    created_by_email: user.email,
    created_by_role: user.role || null,
    created_at: new Date().toISOString(),
  };

  const values = compact({
    name: String(record.title).trim(),
    type: "opportunity",
    partner_name: String(record.client || record.entity || "").trim() || undefined,
    city: String(record.city || "").trim() || undefined,
    expected_revenue: record.value ? Number(record.value) : undefined,
    date_deadline: record.deadline || undefined,
    description: buildDescription(metadata, record.description, record.requirements),
  });

  const result = await odooCall("crm.lead", "create", { vals_list: [values] });
  const leadId = createdId(result);
  if (!leadId) throw new Error("تم إرسال السجل، لكن لم يُرجع النظام رقمًا مرجعيًا صالحًا.");

  const files = Array.isArray(payload.files) ? payload.files.slice(0, MAX_FILES) : [];
  const createdAttachments = [];
  for (const file of files) {
    const size = Number(file.size || 0);
    if (!file.name || !file.data_base64) continue;
    if (size > MAX_FILE_SIZE) throw new Error(`الملف ${file.name} يتجاوز الحد المسموح عبر البوابة.`);

    const attachmentValues = {
      name: String(file.name),
      type: "binary",
      datas: String(file.data_base64).replace(/^data:[^;]+;base64,/, ""),
      mimetype: String(file.mime_type || "application/octet-stream"),
      res_model: "crm.lead",
      res_id: leadId,
      public: false,
    };
    const attachmentResult = await odooCall("ir.attachment", "create", { vals_list: [attachmentValues] });
    const attachmentId = createdId(attachmentResult);
    if (attachmentId) createdAttachments.push(attachmentId);
  }

  const records = await listRecords(kind);
  return {
    record: records.find((item) => item.id === leadId) || { id: leadId, kind, title: values.name },
    attachment_ids: createdAttachments,
  };
}

async function downloadAttachment(attachmentId) {
  const attachmentRows = await odooCall("ir.attachment", "read", {
    ids: [Number(attachmentId)],
    fields: ["id", "name", "mimetype", "datas", "file_size", "res_model", "res_id"],
    load: null,
  });
  const attachment = Array.isArray(attachmentRows) ? attachmentRows[0] : null;
  if (!attachment || attachment.res_model !== "crm.lead") throw new Error("الملف المطلوب غير متاح.");

  const leadRows = await odooCall("crm.lead", "read", {
    ids: [Number(attachment.res_id)],
    fields: ["id", "description"],
    load: null,
  });
  const lead = Array.isArray(leadRows) ? leadRows[0] : null;
  if (!lead || !decodeMetadata(lead.description)) throw new Error("الملف غير مرتبط بسجل مسموح.");

  return {
    id: Number(attachment.id),
    name: String(attachment.name || "file"),
    mime_type: String(attachment.mimetype || "application/octet-stream"),
    file_size: Number(attachment.file_size || 0),
    data_base64: String(attachment.datas || ""),
  };
}

export default async function handler(request, response) {
  setHeaders(response);
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return send(response, 405, { ok: false, message: "Method not allowed" });

  const user = parseInstitutionalToken(request);
  if (!user) return send(response, 401, { ok: false, message: "انتهت الجلسة المؤسسية؛ سجّل الدخول من جديد." });

  const payload = bodyOf(request);
  const action = String(payload.action || "list");

  try {
    if (action === "sources") return send(response, 200, { ok: true, sources: DEFAULT_SOURCES });
    if (action === "status") {
      const config = odooConfig();
      return send(response, 200, {
        ok: true,
        configured: config.enabled && Boolean(config.apiKey),
        read_only: config.readOnly,
      });
    }
    if (action === "list") {
      const records = await listRecords(payload.kind === "tender" ? "tender" : payload.kind === "opportunity" ? "opportunity" : null);
      return send(response, 200, { ok: true, records, total: records.length });
    }
    if (action === "create") {
      const result = await createRecord(payload, user);
      return send(response, 201, { ok: true, ...result });
    }
    if (action === "download") {
      const file = await downloadAttachment(payload.attachment_id);
      return send(response, 200, { ok: true, file });
    }
    return send(response, 400, { ok: false, message: "العملية المطلوبة غير مدعومة." });
  } catch (error) {
    console.error("marketing gateway failed", error);
    return send(response, 502, {
      ok: false,
      message: error instanceof Error ? error.message : "تعذر تنفيذ العملية في السجل المركزي.",
    });
  }
}
