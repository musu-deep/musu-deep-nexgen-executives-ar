import crypto from "node:crypto";

const STORE_KEY = Symbol.for("ARAAK_RECRUITMENT_HUB_V1");
const ATTACHMENT_NAME = "[SYSTEM] ARAAK Recruitment Hub.json";
const ATTACHMENT_MIMETYPE = "application/json";
const STATE_VERSION = 1;

export const RECRUITMENT_CHANNELS = Object.freeze([
  {
    id: "google_jobs",
    name: "Google for Jobs",
    short_name: "Google Jobs",
    category: "محرك بحث وظيفي",
    integration: "structured_data",
    readiness: "ready",
    readiness_label: "جاهز عبر صفحة الوظيفة",
    description: "ينشر صفحة عامة متوافقة مع JobPosting لتصبح مؤهلة للظهور في بحث Google للوظائف.",
    employer_url: "https://developers.google.com/search/docs/appearance/structured-data/job-posting",
  },
  {
    id: "linkedin",
    name: "LinkedIn Jobs",
    short_name: "LinkedIn",
    category: "شبكة مهنية",
    integration: "partner_api",
    readiness: "partner_required",
    readiness_label: "يتطلب اعتماد شريك",
    description: "تجهيز حزمة الإعلان والرابط العام الآن، والربط الآلي عند اعتماد LinkedIn Talent Solutions.",
    employer_url: "https://www.linkedin.com/talent/post-a-job",
  },
  {
    id: "indeed",
    name: "Indeed",
    short_name: "Indeed",
    category: "منصة توظيف",
    integration: "ats_partner_or_feed",
    readiness: "partner_required",
    readiness_label: "ATS أو تغذية وظائف",
    description: "يدعم النشر عبر شركاء ATS أو تغذية أصحاب العمل؛ تُجهز بيانات الوظيفة بصيغة قابلة للتصدير.",
    employer_url: "https://employers.indeed.com/",
  },
  {
    id: "handshake",
    name: "Handshake",
    short_name: "Handshake",
    category: "خريجون ومواهب ناشئة",
    integration: "enterprise_ats",
    readiness: "partner_required",
    readiness_label: "يتطلب خطة مؤسسية",
    description: "مناسب للتدريب والخريجين، والربط الآلي متاح عبر تكاملات ATS المؤسسية.",
    employer_url: "https://app.joinhandshake.com/employer_registrations/new",
  },
  {
    id: "glassdoor",
    name: "Glassdoor",
    short_name: "Glassdoor",
    category: "سمعة صاحب العمل",
    integration: "manual_employer",
    readiness: "manual_ready",
    readiness_label: "نشر ومتابعة يدوية",
    description: "قناة للعلامة الوظيفية والمراجعات؛ تُدار من خلال حساب صاحب العمل مع رابط الإعلان العام.",
    employer_url: "https://www.glassdoor.com/employers/",
  },
  {
    id: "bayt",
    name: "Bayt.com",
    short_name: "بيت.كوم",
    category: "الشرق الأوسط",
    integration: "manual_employer",
    readiness: "manual_ready",
    readiness_label: "جاهز للنشر اليدوي",
    description: "قناة إقليمية واسعة للوصول إلى المرشحين في الشرق الأوسط وشمال أفريقيا.",
    employer_url: "https://www.bayt.com/en/employers/",
  },
  {
    id: "gulftalent",
    name: "GulfTalent",
    short_name: "GulfTalent",
    category: "الخليج والقيادات",
    integration: "manual_employer",
    readiness: "manual_ready",
    readiness_label: "جاهز للنشر اليدوي",
    description: "مناسب للوظائف المهنية والقيادية في أسواق الخليج.",
    employer_url: "https://www.gulftalent.com/employers",
  },
  {
    id: "naukrigulf",
    name: "Naukrigulf",
    short_name: "Naukrigulf",
    category: "الخليج",
    integration: "manual_employer",
    readiness: "manual_ready",
    readiness_label: "جاهز للنشر اليدوي",
    description: "قناة إقليمية للوظائف الفنية والإدارية والتشغيلية.",
    employer_url: "https://www.naukrigulf.com/recruiter",
  },
  {
    id: "tanqeeb",
    name: "Tanqeeb",
    short_name: "تنقيب",
    category: "تجميع وظائف عربي",
    integration: "manual_employer",
    readiness: "manual_ready",
    readiness_label: "جاهز للنشر اليدوي",
    description: "يدعم توسيع الوصول العربي عبر صفحة الوظيفة العامة وحزمة النشر.",
    employer_url: "https://www.tanqeeb.com/",
  },
  {
    id: "rezi",
    name: "Rezi",
    short_name: "Rezi",
    category: "تهيئة السيرة الذاتية",
    integration: "candidate_enablement",
    readiness: "supporting_tool",
    readiness_label: "أداة مساندة للمرشح",
    description: "ليست لوحة وظائف رئيسية؛ تُستخدم لتحسين السيرة الذاتية وملاءمتها لنظام تتبع المتقدمين.",
    employer_url: "https://www.rezi.ai/",
  },
]);

const DEFAULT_WEIGHTS = Object.freeze({
  skills: 30,
  experience: 20,
  education: 10,
  sector_fit: 10,
  interview: 15,
  values: 10,
  availability: 5,
});

const EDUCATION_RANK = Object.freeze({ secondary: 0, diploma: 1, bachelor: 2, master: 3, doctorate: 4 });
const now = () => new Date().toISOString();
const newId = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value || 0)));
const normalizeText = (value) => String(value || "").trim();
const normalizeEmail = (value) => normalizeText(value).toLowerCase();
const arrayOf = (value) => Array.isArray(value) ? value.map(normalizeText).filter(Boolean) : String(value || "").split(/[,،\n]/).map(normalizeText).filter(Boolean);
const unique = (values) => [...new Set(values.map((item) => item.toLowerCase()))];

function seedState() {
  return { version: STATE_VERSION, jobs: [], candidates: [], activity: [], created_at: now(), updated_at: now() };
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
        "User-Agent": "ARAAK-CEO-RECRUITMENT-HUB/1.0",
      },
      body: JSON.stringify({ context: { lang: config.language, active_test: false }, ...parameters }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.message || payload?.name || `Odoo HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

const encodeState = (state) => Buffer.from(JSON.stringify(state), "utf8").toString("base64");
function decodeState(datas) {
  try {
    const parsed = JSON.parse(Buffer.from(String(datas || ""), "base64").toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch { return null; }
}

async function loadState() {
  const config = odooConfig();
  if (!config.apiKey) {
    if (!globalThis[STORE_KEY]) globalThis[STORE_KEY] = seedState();
    return { state: globalThis[STORE_KEY], persistent: false, attachmentId: null, storage: "memory" };
  }
  const rows = await odooCall("ir.attachment", "search_read", {
    domain: [["name", "=", ATTACHMENT_NAME]],
    fields: ["id", "name", "datas", "write_date"],
    order: "write_date desc",
    limit: 1,
  });
  const row = Array.isArray(rows) ? rows[0] : null;
  const decoded = row ? decodeState(row.datas) : null;
  if (decoded?.version === STATE_VERSION) return { state: decoded, persistent: true, attachmentId: Number(row.id), storage: "odoo" };
  if (config.readOnly) {
    const error = new Error("مخزن التوظيف مضبوط على القراءة فقط ولا يحتوي بيانات صالحة.");
    error.status = 503;
    throw error;
  }
  const state = seedState();
  if (row?.id) {
    await odooCall("ir.attachment", "write", { ids: [Number(row.id)], vals: { name: ATTACHMENT_NAME, type: "binary", mimetype: ATTACHMENT_MIMETYPE, datas: encodeState(state) } });
    return { state, persistent: true, attachmentId: Number(row.id), storage: "odoo" };
  }
  const created = await odooCall("ir.attachment", "create", { vals_list: [{ name: ATTACHMENT_NAME, type: "binary", mimetype: ATTACHMENT_MIMETYPE, datas: encodeState(state) }] });
  const createdId = Array.isArray(created) ? created[0] : created;
  return { state, persistent: true, attachmentId: Number(createdId), storage: "odoo" };
}

async function saveState(loaded) {
  loaded.state.updated_at = now();
  loaded.state.activity = Array.isArray(loaded.state.activity) ? loaded.state.activity.slice(-250) : [];
  if (!loaded.persistent) { globalThis[STORE_KEY] = loaded.state; return; }
  if (odooConfig().readOnly) {
    const error = new Error("مخزن التوظيف مضبوط على القراءة فقط.");
    error.status = 503;
    throw error;
  }
  await odooCall("ir.attachment", "write", { ids: [loaded.attachmentId], vals: { name: ATTACHMENT_NAME, type: "binary", mimetype: ATTACHMENT_MIMETYPE, datas: encodeState(loaded.state) } });
}

function requireRead(actor) {
  const allowed = new Set(["admin", "ceo", "vp_development", "dev_manager", "hr", "tracker"]);
  if (!actor || !allowed.has(actor.role)) {
    const error = new Error("لا تملك صلاحية الاطلاع على مركز التوظيف.");
    error.status = 403;
    throw error;
  }
}
function requireManage(actor) {
  const allowed = new Set(["admin", "ceo", "vp_development", "dev_manager", "hr"]);
  if (!actor || !allowed.has(actor.role)) {
    const error = new Error("لا تملك صلاحية إدارة الوظائف والمرشحين.");
    error.status = 403;
    throw error;
  }
}
function addActivity(state, action, actor, details = {}) {
  state.activity = Array.isArray(state.activity) ? state.activity : [];
  state.activity.push({ id: newId("ract"), action, actor_id: actor?.id || null, actor_name: actor?.name || "النظام", details, created_at: now() });
}
function normalizedWeights(value) {
  const candidate = { ...DEFAULT_WEIGHTS, ...(value || {}) };
  const total = Object.values(candidate).reduce((sum, item) => sum + Math.max(0, Number(item || 0)), 0) || 100;
  return Object.fromEntries(Object.entries(candidate).map(([key, item]) => [key, Math.round(Math.max(0, Number(item || 0)) / total * 10000) / 100]));
}

function normalizeJob(payload, actor, existing = null) {
  const requiredSkills = unique(arrayOf(payload.required_skills ?? existing?.required_skills));
  const preferredSkills = unique(arrayOf(payload.preferred_skills ?? existing?.preferred_skills));
  const internalCriteria = arrayOf(payload.internal_criteria ?? existing?.internal_criteria);
  const selectedChannels = unique(arrayOf(payload.channels ?? existing?.channels));
  const title = normalizeText(payload.title ?? existing?.title);
  if (!title) { const error = new Error("المسمى الوظيفي مطلوب."); error.status = 422; throw error; }
  return {
    ...(existing || {}),
    id: existing?.id || newId("job"),
    title,
    department: normalizeText(payload.department ?? existing?.department) || "غير محدد",
    location: normalizeText(payload.location ?? existing?.location) || "مرن",
    workplace_type: normalizeText(payload.workplace_type ?? existing?.workplace_type) || "onsite",
    employment_type: normalizeText(payload.employment_type ?? existing?.employment_type) || "FULL_TIME",
    description: normalizeText(payload.description ?? existing?.description),
    responsibilities: arrayOf(payload.responsibilities ?? existing?.responsibilities),
    required_skills: requiredSkills,
    preferred_skills: preferredSkills,
    internal_criteria: internalCriteria,
    min_experience: Math.max(0, Number((payload.min_experience ?? existing?.min_experience) || 0)),
    required_education: normalizeText(payload.required_education ?? existing?.required_education) || "bachelor",
    salary_min: payload.salary_min === "" || payload.salary_min == null ? (existing?.salary_min ?? null) : Number(payload.salary_min),
    salary_max: payload.salary_max === "" || payload.salary_max == null ? (existing?.salary_max ?? null) : Number(payload.salary_max),
    salary_currency: normalizeText(payload.salary_currency ?? existing?.salary_currency) || "SAR",
    application_deadline: normalizeText(payload.application_deadline ?? existing?.application_deadline) || null,
    channels: selectedChannels,
    weights: normalizedWeights(payload.weights ?? existing?.weights),
    status: normalizeText(payload.status ?? existing?.status) || "draft",
    publication: existing?.publication || {},
    created_by: existing?.created_by || actor?.id || null,
    created_by_name: existing?.created_by_name || actor?.name || null,
    created_at: existing?.created_at || now(),
    updated_at: now(),
  };
}

function normalizeCandidate(payload, actor, existing = null) {
  const name = normalizeText(payload.name ?? existing?.name);
  const jobId = normalizeText(payload.job_id ?? existing?.job_id);
  if (!name || !jobId) { const error = new Error("اسم المرشح والوظيفة مطلوبان."); error.status = 422; throw error; }
  return {
    ...(existing || {}),
    id: existing?.id || newId("cand"),
    job_id: jobId,
    name,
    email: normalizeEmail(payload.email ?? existing?.email),
    phone: normalizeText(payload.phone ?? existing?.phone),
    current_title: normalizeText(payload.current_title ?? existing?.current_title),
    source: normalizeText(payload.source ?? existing?.source) || "internal",
    resume_url: normalizeText(payload.resume_url ?? existing?.resume_url),
    experience_years: Math.max(0, Number((payload.experience_years ?? existing?.experience_years) || 0)),
    education_level: normalizeText(payload.education_level ?? existing?.education_level) || "bachelor",
    skills: unique(arrayOf(payload.skills ?? existing?.skills)),
    sector_fit_score: clamp(payload.sector_fit_score ?? existing?.sector_fit_score ?? 50),
    interview_score: clamp(payload.interview_score ?? existing?.interview_score ?? 0),
    values_score: clamp(payload.values_score ?? existing?.values_score ?? 0),
    availability_score: clamp(payload.availability_score ?? existing?.availability_score ?? 50),
    references_score: clamp(payload.references_score ?? existing?.references_score ?? 50),
    committee_notes: normalizeText(payload.committee_notes ?? existing?.committee_notes),
    stage: normalizeText(payload.stage ?? existing?.stage) || "new",
    disqualified: Boolean(payload.disqualified ?? existing?.disqualified ?? false),
    created_by: existing?.created_by || actor?.id || null,
    created_at: existing?.created_at || now(),
    updated_at: now(),
  };
}

function educationScore(required, actual) {
  const requiredRank = EDUCATION_RANK[required] ?? 2;
  const actualRank = EDUCATION_RANK[actual] ?? 0;
  return requiredRank === 0 ? 100 : clamp(actualRank / requiredRank * 100);
}

export function scoreCandidate(job, candidate) {
  const required = unique(job.required_skills || []);
  const preferred = unique(job.preferred_skills || []);
  const skills = new Set(unique(candidate.skills || []));
  const requiredMatched = required.filter((skill) => skills.has(skill));
  const preferredMatched = preferred.filter((skill) => skills.has(skill));
  const requiredRatio = required.length ? requiredMatched.length / required.length : 1;
  const preferredRatio = preferred.length ? preferredMatched.length / preferred.length : 1;
  const components = {
    skills: clamp((requiredRatio * 0.8 + preferredRatio * 0.2) * 100),
    experience: job.min_experience > 0 ? clamp(candidate.experience_years / job.min_experience * 100) : 100,
    education: educationScore(job.required_education, candidate.education_level),
    sector_fit: clamp(candidate.sector_fit_score),
    interview: clamp(candidate.interview_score),
    values: clamp(candidate.values_score),
    availability: clamp(candidate.availability_score),
  };
  const weights = normalizedWeights(job.weights);
  let total = Object.entries(components).reduce((sum, [key, value]) => sum + value * (weights[key] || 0) / 100, 0);
  const missingRequired = required.filter((skill) => !skills.has(skill));
  const hardGap = required.length >= 2 && requiredRatio < 0.5;
  if (hardGap) total -= 15;
  if (candidate.disqualified) total = 0;
  total = Math.round(clamp(total) * 10) / 10;
  const reasons = [];
  if (requiredMatched.length) reasons.push(`يطابق ${requiredMatched.length} من ${required.length || requiredMatched.length} مهارة أساسية`);
  if (candidate.experience_years >= job.min_experience) reasons.push(`الخبرة ${candidate.experience_years} سنوات وتحقق الحد المطلوب`);
  if (candidate.interview_score >= 80) reasons.push("تقييم المقابلة مرتفع");
  if (candidate.values_score >= 80) reasons.push("توافق مؤسسي وقيمي مرتفع");
  if (missingRequired.length) reasons.push(`فجوات مهارية: ${missingRequired.slice(0, 3).join("، ")}`);
  if (!reasons.length) reasons.push("يحتاج إلى استكمال التقييم الداخلي قبل القرار");
  return { candidate_id: candidate.id, total, eligible: !candidate.disqualified && !hardGap, components, weights, required_match_percent: Math.round(requiredRatio * 100), matched_skills: requiredMatched, missing_skills: missingRequired, reasons };
}

function rankedForJob(state, job) {
  return (state.candidates || []).filter((candidate) => candidate.job_id === job.id).map((candidate) => ({ ...candidate, score: scoreCandidate(job, candidate) })).sort((a, b) => Number(b.score.total) - Number(a.score.total));
}
function jobView(state, job) {
  const ranking = rankedForJob(state, job);
  const top = ranking.find((item) => item.score.eligible) || ranking[0] || null;
  return {
    ...job,
    candidate_count: ranking.length,
    ranking,
    recommendation: top ? {
      candidate_id: top.id,
      candidate_name: top.name,
      score: top.score.total,
      reasons: top.score.reasons,
      decision: top.score.total >= 80 ? "موصى به بقوة" : top.score.total >= 65 ? "موصى بالمقابلة النهائية" : "يحتاج إلى استكمال التقييم",
    } : null,
    public_url: `/jobs/${job.id}`,
  };
}
function publicationPlan(job) {
  const selected = new Set(job.channels || []);
  return RECRUITMENT_CHANNELS.filter((channel) => selected.has(channel.id)).map((channel) => ({
    channel_id: channel.id,
    channel_name: channel.name,
    readiness: channel.readiness,
    readiness_label: channel.readiness_label,
    employer_url: channel.employer_url,
    action: channel.id === "google_jobs" ? "public_job_ready" : channel.readiness === "partner_required" ? "connection_required" : "manual_publish_ready",
  }));
}

export async function recruitmentDashboard(actor) {
  requireRead(actor);
  const loaded = await loadState();
  const jobs = (loaded.state.jobs || []).map((job) => jobView(loaded.state, job));
  const candidates = loaded.state.candidates || [];
  return {
    storage: loaded.storage,
    persistent: loaded.persistent,
    channels: RECRUITMENT_CHANNELS.map((channel) => ({ ...channel })),
    jobs,
    candidates,
    activity: (loaded.state.activity || []).slice().reverse().slice(0, 30),
    totals: {
      jobs: jobs.length,
      open_jobs: jobs.filter((job) => job.status === "open" || job.status === "published").length,
      candidates: candidates.length,
      shortlisted: candidates.filter((candidate) => candidate.stage === "shortlisted").length,
      interviews: candidates.filter((candidate) => candidate.stage === "interview").length,
      offers: candidates.filter((candidate) => candidate.stage === "offer").length,
    },
  };
}

export async function createRecruitmentJob(payload, actor) {
  requireManage(actor);
  const loaded = await loadState();
  const job = normalizeJob(payload, actor);
  loaded.state.jobs.unshift(job);
  addActivity(loaded.state, "job_created", actor, { job_id: job.id, title: job.title });
  await saveState(loaded);
  return jobView(loaded.state, job);
}
export async function updateRecruitmentJob(jobId, payload, actor) {
  requireManage(actor);
  const loaded = await loadState();
  const index = loaded.state.jobs.findIndex((item) => item.id === jobId);
  if (index < 0) { const error = new Error("الوظيفة غير موجودة."); error.status = 404; throw error; }
  const job = normalizeJob(payload, actor, loaded.state.jobs[index]);
  loaded.state.jobs[index] = job;
  addActivity(loaded.state, "job_updated", actor, { job_id: job.id, title: job.title });
  await saveState(loaded);
  return jobView(loaded.state, job);
}
export async function publishRecruitmentJob(jobId, payload, actor) {
  requireManage(actor);
  const loaded = await loadState();
  const job = loaded.state.jobs.find((item) => item.id === jobId);
  if (!job) { const error = new Error("الوظيفة غير موجودة."); error.status = 404; throw error; }
  job.channels = unique(arrayOf(payload.channels ?? job.channels));
  job.status = "published";
  job.published_at = now();
  job.publication = Object.fromEntries(publicationPlan(job).map((item) => [item.channel_id, { ...item, prepared_at: now() }]));
  job.updated_at = now();
  addActivity(loaded.state, "job_publication_prepared", actor, { job_id: job.id, channels: job.channels });
  await saveState(loaded);
  return { job: jobView(loaded.state, job), plan: publicationPlan(job) };
}
export async function addRecruitmentCandidate(payload, actor) {
  requireManage(actor);
  const loaded = await loadState();
  const job = loaded.state.jobs.find((item) => item.id === payload.job_id);
  if (!job) { const error = new Error("اختر وظيفة صحيحة للمرشح."); error.status = 422; throw error; }
  const candidate = normalizeCandidate(payload, actor);
  loaded.state.candidates.unshift(candidate);
  addActivity(loaded.state, "candidate_added", actor, { candidate_id: candidate.id, job_id: candidate.job_id, source: candidate.source });
  await saveState(loaded);
  return { ...candidate, score: scoreCandidate(job, candidate) };
}
export async function updateRecruitmentCandidate(candidateId, payload, actor) {
  requireManage(actor);
  const loaded = await loadState();
  const index = loaded.state.candidates.findIndex((item) => item.id === candidateId);
  if (index < 0) { const error = new Error("المرشح غير موجود."); error.status = 404; throw error; }
  const candidate = normalizeCandidate(payload, actor, loaded.state.candidates[index]);
  const job = loaded.state.jobs.find((item) => item.id === candidate.job_id);
  if (!job) { const error = new Error("الوظيفة المرتبطة غير موجودة."); error.status = 422; throw error; }
  loaded.state.candidates[index] = candidate;
  addActivity(loaded.state, "candidate_updated", actor, { candidate_id: candidate.id, stage: candidate.stage });
  await saveState(loaded);
  return { ...candidate, score: scoreCandidate(job, candidate) };
}
export async function deleteRecruitmentCandidate(candidateId, actor) {
  requireManage(actor);
  const loaded = await loadState();
  const candidate = loaded.state.candidates.find((item) => item.id === candidateId);
  if (!candidate) return { ok: true };
  loaded.state.candidates = loaded.state.candidates.filter((item) => item.id !== candidateId);
  addActivity(loaded.state, "candidate_removed", actor, { candidate_id: candidateId });
  await saveState(loaded);
  return { ok: true };
}

export async function getPublicRecruitmentJob(jobId) {
  const loaded = await loadState();
  const job = loaded.state.jobs.find((item) => item.id === jobId && ["published", "open"].includes(item.status));
  if (!job) { const error = new Error("الوظيفة غير متاحة للنشر العام."); error.status = 404; throw error; }
  return {
    id: job.id, title: job.title, department: job.department, location: job.location,
    workplace_type: job.workplace_type, employment_type: job.employment_type,
    description: job.description, responsibilities: job.responsibilities,
    required_skills: job.required_skills, preferred_skills: job.preferred_skills,
    min_experience: job.min_experience, required_education: job.required_education,
    salary_min: job.salary_min, salary_max: job.salary_max, salary_currency: job.salary_currency,
    application_deadline: job.application_deadline, published_at: job.published_at || job.created_at,
  };
}

export async function publicRecruitmentApply(payload) {
  if (normalizeText(payload.website)) return { ok: true };
  const loaded = await loadState();
  const job = loaded.state.jobs.find((item) => item.id === payload.job_id && ["published", "open"].includes(item.status));
  if (!job) { const error = new Error("الوظيفة غير متاحة للتقديم."); error.status = 404; throw error; }
  const email = normalizeEmail(payload.email);
  if (!email || !normalizeText(payload.name)) { const error = new Error("الاسم والبريد الإلكتروني مطلوبان."); error.status = 422; throw error; }
  const duplicate = loaded.state.candidates.find((item) => item.job_id === job.id && normalizeEmail(item.email) === email);
  if (duplicate) return { ok: true, duplicate: true, candidate_id: duplicate.id };
  const candidate = normalizeCandidate({ ...payload, source: "public_portal", stage: "new" }, null);
  loaded.state.candidates.unshift(candidate);
  addActivity(loaded.state, "public_application_received", null, { candidate_id: candidate.id, job_id: job.id });
  await saveState(loaded);
  return { ok: true, candidate_id: candidate.id };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

export function publicJobHtml(job, origin = "") {
  const url = `${String(origin || "").replace(/\/$/, "")}/jobs/${encodeURIComponent(job.id)}`;
  const description = job.description || `فرصة وظيفية لدى مجموعة اراك للتنمية في ${job.department}.`;
  const schema = {
    "@context": "https://schema.org/", "@type": "JobPosting", title: job.title, description,
    datePosted: String(job.published_at || now()).slice(0, 10), validThrough: job.application_deadline || undefined,
    employmentType: job.employment_type,
    hiringOrganization: { "@type": "Organization", name: "مجموعة اراك للتنمية", sameAs: "https://araak.org" },
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.location, addressCountry: "SA" } },
    directApply: true, url,
  };
  if (job.salary_min || job.salary_max) schema.baseSalary = { "@type": "MonetaryAmount", currency: job.salary_currency || "SAR", value: { "@type": "QuantitativeValue", minValue: job.salary_min || undefined, maxValue: job.salary_max || undefined, unitText: "MONTH" } };
  const skills = (job.required_skills || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const responsibilities = (job.responsibilities || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(job.title)} | اراك</title><meta name="description" content="${escapeHtml(description.slice(0,155))}"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,"\\u003c")}</script><style>body{margin:0;background:#081017;color:#edf3f0;font-family:Arial,sans-serif}.wrap{max-width:920px;margin:auto;padding:44px 20px}.card{background:#0e1821;border:1px solid #23313b;border-radius:22px;padding:28px;margin-bottom:18px}.tag{display:inline-block;padding:8px 12px;border-radius:999px;background:#123629;color:#7ee2aa;margin:3px}.grid{display:grid;grid-template-columns:1.3fr .7fr;gap:18px}input,textarea{width:100%;box-sizing:border-box;background:#081017;border:1px solid #2b3a45;border-radius:12px;padding:13px;color:white;margin-top:8px}button{width:100%;padding:14px;border:0;border-radius:12px;background:#eab308;font-weight:800;cursor:pointer}.muted{color:#94a3b8;line-height:1.8}@media(max-width:760px){.grid{grid-template-columns:1fr}}</style></head><body><main class="wrap"><div class="card"><div style="color:#7ee2aa;font-size:13px">مجموعة اراك للتنمية · فرصة وظيفية</div><h1>${escapeHtml(job.title)}</h1><span class="tag">${escapeHtml(job.department)}</span><span class="tag">${escapeHtml(job.location)}</span><span class="tag">${escapeHtml(job.employment_type)}</span><p class="muted">${escapeHtml(description)}</p></div><div class="grid"><div><div class="card"><h2>المسؤوليات</h2><ul class="muted">${responsibilities || "<li>تُعرض التفاصيل خلال عملية الترشيح.</li>"}</ul></div><div class="card"><h2>المهارات الأساسية</h2><ul class="muted">${skills || "<li>وفق متطلبات الوظيفة المعتمدة.</li>"}</ul></div></div><form class="card" id="apply"><h2>تقديم سريع</h2><input name="name" required maxlength="120" placeholder="الاسم الكامل"><input name="email" required type="email" maxlength="160" placeholder="البريد الإلكتروني"><input name="phone" maxlength="40" placeholder="رقم التواصل"><input name="current_title" maxlength="120" placeholder="المسمى الحالي"><input name="experience_years" type="number" min="0" max="60" placeholder="سنوات الخبرة"><input name="skills" placeholder="المهارات مفصولة بفواصل"><input name="resume_url" type="url" placeholder="رابط السيرة الذاتية"><input name="website" tabindex="-1" autocomplete="off" style="display:none"><textarea name="committee_notes" rows="4" maxlength="1000" placeholder="نبذة مختصرة"></textarea><button type="submit">إرسال طلب الترشح</button><p id="status" class="muted"></p></form></div></main><script>document.getElementById('apply').addEventListener('submit',async function(e){e.preventDefault();const status=document.getElementById('status');status.textContent='جارٍ الإرسال...';const data=Object.fromEntries(new FormData(this).entries());data.action='public_apply';data.job_id=${JSON.stringify(job.id)};try{const r=await fetch('/api/recruitment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const j=await r.json();if(!r.ok)throw new Error(j.detail||'تعذر الإرسال');status.textContent='تم استلام طلبك بنجاح.';this.reset()}catch(err){status.textContent=err.message}}</script></body></html>`;
}

export function recruitmentApiError(error) {
  return { status: Number(error?.status || 500), detail: error?.message || "حدث خطأ في مركز التوظيف." };
}
