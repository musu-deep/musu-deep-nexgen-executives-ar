import crypto from "node:crypto";

const SECRET = process.env.JWT_SECRET || "nexgen-vercel-hosted-demo-secret-2026";
const DEMO_PASSWORD = "ExecAgent2026!";
const now = () => new Date().toISOString();
const id = (prefix = "id") => `${prefix}_${crypto.randomUUID()}`;

const USERS = [
  { id: "usr_admin", email: "admin@company.demo", name: "مدير المنصة", role: "admin", title: "مدير المنصة التنفيذية", active: true },
  { id: "usr_ceo", email: "ceo@company.demo", name: "الرئيس التنفيذي", role: "ceo", title: "الرئيس التنفيذي", active: true },
  { id: "usr_dev", email: "development@company.demo", name: "نائب الرئيس التنفيذي للتنمية", role: "vp_development", title: "نائب الرئيس التنفيذي للتنمية", active: true },
  { id: "usr_inv", email: "investment@company.demo", name: "نائب الرئيس التنفيذي للاستثمار", role: "vp_investment", title: "نائب الرئيس التنفيذي للاستثمار", active: true },
  { id: "usr_mgr", email: "manager@company.demo", name: "مدير وحدة الأعمال", role: "dev_manager", title: "مدير العمليات والتنفيذ", active: true },
  { id: "usr_track", email: "followup@company.demo", name: "المتابعة التنفيذية", role: "tracker", title: "المتابعة التنفيذية", active: true },
];

const PROJECTS = [
  { id: "prj_1", name: "التحول الرقمي المؤسسي", description: "تطوير منظومة موحدة لإدارة العمليات والقرارات التنفيذية.", sector: "digital", progress: 72, status: "active", budget: 2400000, priority: "high", owner_id: "usr_dev", end_date: "2026-12-31", created_at: "2026-06-01T09:00:00Z" },
  { id: "prj_2", name: "تطوير المحفظة الاستثمارية", description: "إعادة بناء نموذج تقييم الفرص ومراقبة العائد والمخاطر.", sector: "investment", progress: 44, status: "active", budget: 80000000, priority: "critical", owner_id: "usr_inv", end_date: "2026-11-15", created_at: "2026-06-03T09:00:00Z" },
  { id: "prj_3", name: "أكاديمية القيادات المستقبلية", description: "برامج تنفيذية لبناء قدرات القيادات والكوادر المؤسسية.", sector: "academy", progress: 63, status: "active", budget: 1250000, priority: "high", owner_id: "usr_dev", end_date: "2027-02-28", created_at: "2026-06-06T09:00:00Z" },
  { id: "prj_4", name: "خطة النمو الاستراتيجي 2026–2030", description: "خارطة طريق للنمو والتوسع والشراكات والحوكمة.", sector: "development", progress: 28, status: "active", budget: 500000, priority: "critical", owner_id: "usr_ceo", end_date: "2026-10-30", created_at: "2026-06-08T09:00:00Z" },
  { id: "prj_5", name: "تحديث الخدمات المؤسسية", description: "رفع كفاءة الموارد البشرية والمالية والخدمات المشتركة.", sector: "corporate", progress: 55, status: "active", budget: 950000, priority: "medium", owner_id: "usr_dev", end_date: "2026-09-30", created_at: "2026-06-10T09:00:00Z" },
  { id: "prj_6", name: "منظومة متابعة التنفيذ", description: "توحيد مؤشرات الإنجاز والتقارير ومسارات التصعيد.", sector: "arak_development", progress: 82, status: "active", budget: 700000, priority: "high", owner_id: "usr_mgr", end_date: "2026-08-31", created_at: "2026-06-12T09:00:00Z" },
];

function makeTasks() {
  const statuses = ["pending", "in_progress", "awaiting_approval", "completed", "delayed"];
  const tasks = [];
  for (const project of PROJECTS) {
    for (let index = 0; index < 3; index += 1) {
      tasks.push({
        id: `tsk_${project.id}_${index + 1}`,
        title: ["استكمال المتطلبات التنفيذية", "مراجعة مؤشرات الأداء", "إغلاق التبعيات الحرجة"][index],
        description: `مهمة تنفيذية مرتبطة بمشروع ${project.name}`,
        project_id: project.id,
        sector: project.sector,
        assignee_id: project.owner_id,
        due_date: new Date(Date.now() + (index - 1) * 7 * 86400000).toISOString(),
        priority: ["medium", "high", "critical"][index],
        status: statuses[(index + PROJECTS.indexOf(project)) % statuses.length],
        progress: [25, 60, 85][index],
        created_at: project.created_at,
        updated_at: now(),
      });
    }
  }
  return tasks;
}

function createStore() {
  return {
    users: structuredClone(USERS),
    projects: structuredClone(PROJECTS),
    tasks: makeTasks(),
    meetings: [
      { id: "meet_1", title: "اجتماع مراجعة الأداء التنفيذي", description: "مراجعة مؤشرات القطاعات والمشروعات الحرجة.", meeting_type: "periodic", date: new Date(Date.now() + 3 * 86400000).toISOString(), duration_minutes: 60, location: "قاعة الاجتماعات التنفيذية", meeting_link: "", attendee_ids: ["usr_ceo", "usr_dev", "usr_inv"], organizer_id: "usr_ceo", organizer_name: "الرئيس التنفيذي", status: "scheduled", created_at: now() },
    ],
    meetingRequests: [
      { id: "req_1", subject: "اعتماد التدخل في المشروع الاستراتيجي", description: "طلب اجتماع لحسم التبعيات والموارد المطلوبة.", proposed_date: new Date(Date.now() + 2 * 86400000).toISOString(), duration_minutes: 45, urgency: "high", status: "pending", requester_id: "usr_dev", requester_name: "نائب الرئيس التنفيذي للتنمية", created_at: now() },
    ],
    documents: [
      { id: "doc_1", title: "التقرير التنفيذي الشهري", description: "ملخص الأداء والمخاطر والقرارات المطلوبة.", category: "report", url: "", file_type: "PDF", is_public: true, uploaded_by: "usr_ceo", uploaded_by_name: "الرئيس التنفيذي", intelligence_status: "processed", intelligence: { summary: "يركز التقرير على فجوات التنفيذ والمشروعات الحرجة.", risk_level: "high", key_points: ["تسريع القرارات المتأخرة", "إغلاق التبعيات الحرجة"], created_task_id: null }, created_at: now() },
    ],
    messages: [
      { id: "msg_1", sender_id: "usr_ceo", sender_name: "الرئيس التنفيذي", recipient_id: "usr_dev", recipient_name: "نائب الرئيس التنفيذي للتنمية", subject: "مراجعة أولويات التنفيذ", body: "يرجى تحديث حالة المشروعات الحرجة قبل الاجتماع القادم.", priority: "high", category: "follow_up", read: false, created_at: now() },
    ],
    notifications: [
      { id: "not_1", user_id: "usr_ceo", type: "risk", title: "مشروع يحتاج إلى تدخل تنفيذي", body: "خطة النمو الاستراتيجي أقل من مستوى الإنجاز المستهدف.", link: "/projects/prj_4", read: false, created_at: now() },
    ],
    calendar: [
      { id: "cal_1", title: "الموجز التنفيذي الأسبوعي", description: "إعداد واعتماد موجز القيادة.", start: new Date(Date.now() + 86400000).toISOString(), end: new Date(Date.now() + 86400000 + 3600000).toISOString(), event_type: "executive", active: true, user_id: "usr_ceo", created_at: now() },
    ],
    progress: [],
    theme: "luxury",
    notificationSettings: {
      in_app_enabled: true,
      email_enabled: false,
      push_enabled: true,
      daily_digest: true,
      events: { critical_risk: true, overdue_task: true, decision_required: true, meeting_request: true, document_routed: true },
    },
    agentActivity: [],
  };
}

const STORE_KEY = "__NEXGEN_HOSTED_STORE__";
const store = globalThis[STORE_KEY] || (globalThis[STORE_KEY] = createStore());

function send(response, status, payload) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  return response.status(status).json(payload);
}

function bodyOf(request) {
  if (request.body == null) return {};
  if (typeof request.body === "object") return request.body;
  try { return JSON.parse(request.body); } catch { return {}; }
}

function safeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

function signToken(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, email: user.email, role: user.role, exp: Date.now() + 12 * 3600000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function parseToken(token) {
  try {
    const [payload, signature] = String(token || "").split(".");
    if (!payload || !signature) return null;
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (decoded.exp < Date.now()) return null;
    return store.users.find((user) => user.id === decoded.id && user.active !== false) || null;
  } catch { return null; }
}

function currentUser(request) {
  const auth = request.headers.authorization || request.headers.Authorization || "";
  return parseToken(auth.startsWith("Bearer ") ? auth.slice(7) : "");
}

function rag(project) {
  if (project.status === "completed") return "green";
  if (project.priority === "critical" || Number(project.progress || 0) < 30) return "red";
  if (Number(project.progress || 0) < 70) return "amber";
  return "green";
}

function intelligenceFor(document) {
  return {
    analysis: document.intelligence || {
      summary: `تحليل تنفيذي للمستند: ${document.title}`,
      stakeholders: ["الرئيس التنفيذي", "الجهة المالكة"],
      key_dates: [],
      obligations: ["مراجعة البنود ذات الأثر التنفيذي"],
      risks: ["تأخر المتابعة أو غياب المسؤولية الواضحة"],
      risk_level: "medium",
      recommended_route: "مكتب الرئيس التنفيذي",
      suggested_tasks: [{ title: `متابعة ${document.title}`, priority: "high" }],
    },
    created_task_id: document.intelligence?.created_task_id || null,
  };
}

function agentsPayload() {
  const agents = [
    ["ceo-office", "مكتب الرئيس التنفيذي", "ينسق الأولويات والقرارات والإحاطات التنفيذية.", "/dashboard"],
    ["project-intelligence", "وكيل ذكاء المشروعات", "يربط المشروعات بالمهام والمخاطر ونسب الإنجاز.", "/projects"],
    ["meeting-intelligence", "وكيل ذكاء الاجتماعات", "يحوّل الاجتماعات إلى قرارات ومهام ومتابعات.", "/meetings"],
    ["risk-monitor", "وكيل مراقبة المخاطر", "يرصد الإشارات الحرجة ويقترح مسارات التصعيد.", "/dashboard"],
    ["document-intelligence", "وكيل ذكاء المستندات", "يقرأ المستندات ويستخرج الالتزامات والإجراءات.", "/documents"],
    ["communication", "وكيل الاتصالات", "ينظم المراسلات والتوجيه والمتابعة المؤسسية.", "/messages"],
    ["reporting", "وكيل التقارير", "ينتج تقارير القيادة والإدارة العليا.", "/reports"],
  ].map(([agentId, name, role, route], index) => ({
    id: agentId, name, role, route,
    status: index === 3 ? "يحتاج إلى انتباه" : "نشط",
    tone: index === 3 ? "amber" : "emerald",
    last_action: index === 3 ? "راجع مؤشرات المشروعات الحرجة" : "مساحة العمل مراقبة وجاهزة للأوامر التنفيذية",
    recommendations: index + 1,
  }));
  return { agents, activity: store.agentActivity.slice(-20).reverse() };
}

function dashboard() {
  const projects = store.projects.map((project) => ({ ...project, rag: rag(project) }));
  const tasks = store.tasks;
  const ragCounts = { red: 0, amber: 0, green: 0, gray: 0 };
  projects.forEach((project) => { ragCounts[project.rag] = (ragCounts[project.rag] || 0) + 1; });
  const sectors = [...new Set(projects.map((project) => project.sector))].map((sector) => {
    const items = projects.filter((project) => project.sector === sector);
    return { sector, count: items.length, avg_progress: Math.round(items.reduce((sum, item) => sum + Number(item.progress || 0), 0) / (items.length || 1)) };
  });
  const taskStatus = {};
  tasks.forEach((task) => { taskStatus[task.status] = (taskStatus[task.status] || 0) + 1; });
  return {
    totals: {
      projects: projects.length,
      active_projects: projects.filter((project) => project.status === "active").length,
      tasks: tasks.length,
      overdue_tasks: tasks.filter((task) => task.status === "delayed" || (task.due_date && new Date(task.due_date) < new Date() && task.status !== "completed")).length,
      avg_progress: Math.round(projects.reduce((sum, item) => sum + Number(item.progress || 0), 0) / (projects.length || 1)),
      total_budget: projects.reduce((sum, item) => sum + Number(item.budget || 0), 0),
    },
    rag: ragCounts,
    by_sector: sectors,
    task_status: taskStatus,
    recent_projects: projects.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 8),
  };
}

function riskRadar() {
  const projectRisks = store.projects.filter((project) => rag(project) !== "green").map((project) => ({
    id: project.id, type: "project", type_label: "مشروع", title: project.name,
    level: rag(project) === "red" ? "حرج" : "مرتفع",
    reason: rag(project) === "red" ? "انخفاض الإنجاز أو ارتفاع الأولوية يستلزم مراجعة تنفيذية." : "المشروع يحتاج إلى متابعة لصيقة لضمان المسار.",
    recommended_action: "تحديد المسؤول والتدخل المطلوب خلال 48 ساعة.",
  }));
  const taskRisks = store.tasks.filter((task) => task.status === "delayed").map((task) => ({
    id: task.id, type: "task", type_label: "مهمة", title: task.title, level: "مرتفع",
    reason: "تأخر المهمة قد يؤثر في مسار التنفيذ.", recommended_action: "إعادة تأكيد المسؤول والموعد والتبعيات.",
  }));
  const risks = [...projectRisks, ...taskRisks];
  return {
    counts: {
      critical: risks.filter((item) => item.level === "حرج").length,
      high: risks.filter((item) => item.level === "مرتفع").length,
      medium: risks.filter((item) => item.level === "متوسط").length,
    },
    risks,
    generated_by: "رادار المخاطر التنفيذي العربي",
  };
}

function executiveBrief(sourceType, item = {}) {
  const title = item.title || item.name || "الإحاطة التنفيذية";
  return {
    title: `موجز تنفيذي: ${title}`,
    executive_summary: ["تم تحليل البند وربطه بالأولويات التنفيذية الحالية.", "يحتاج التنفيذ إلى مسؤول واضح وموعد محدد للمتابعة."],
    decisions_required: ["اعتماد الإجراء التالي والمسؤول التنفيذي.", "تحديد مستوى التصعيد عند تجاوز الموعد."],
    risks: [{ level: "متوسط", risk: "تأخر القرار أو ضعف وضوح المسؤولية." }],
    recommended_actions: ["تثبيت المسؤول والموعد في لوحة المهام.", "مراجعة الأثر في الموجز التنفيذي القادم."],
    strategic_impact: "رفع سرعة القرار وتحسين اتساق التنفيذ بين القطاعات.",
    generated_by: "مكتب الرئيس التنفيذي الرقمي",
    confidence: 0.94,
    source_type: sourceType,
  };
}

function pathInfo(request) {
  const url = new URL(request.url, "http://localhost");
  const pathname = url.pathname.replace(/^\/api\/?/, "").replace(/^\/+|\/+$/g, "");
  return { url, segments: pathname ? pathname.split("/").map(decodeURIComponent) : [] };
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") return send(response, 200, { ok: true });
  const { url, segments } = pathInfo(request);
  const route = segments.join("/");
  const method = request.method || "GET";
  const payload = bodyOf(request);

  if (route === "health" && method === "GET") return send(response, 200, { status: "ready", service: "NEXGEN EXECUTIVES", runtime: "vercel-node-full" });
  if (route === "auth/login" && method === "POST") {
    const email = String(payload.email || "").toLowerCase();
    const user = store.users.find((item) => item.email === email && item.active !== false);
    if (!user || payload.password !== DEMO_PASSWORD) return send(response, 401, { detail: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    return send(response, 200, { user: safeUser(user), access_token: signToken(user) });
  }
  if (route === "auth/logout" && method === "POST") return send(response, 200, { ok: true });
  if (route === "theme" && method === "GET") return send(response, 200, { active_theme: store.theme });

  const user = currentUser(request);
  if (!user) return send(response, 401, { detail: "Not authenticated" });

  if (route === "auth/me" && method === "GET") return send(response, 200, { user: safeUser(user) });
  if (route === "theme" && method === "PUT") { store.theme = payload.active_theme || store.theme; return send(response, 200, { active_theme: store.theme }); }
  if (route === "notification-settings" && method === "GET") return send(response, 200, store.notificationSettings);
  if (route === "notification-settings" && method === "PUT") { store.notificationSettings = { ...store.notificationSettings, ...payload, events: { ...store.notificationSettings.events, ...(payload.events || {}) } }; return send(response, 200, store.notificationSettings); }

  if (route === "users" && method === "GET") return send(response, 200, store.users.map(safeUser));
  if (route === "users" && method === "POST") {
    if (store.users.some((item) => item.email === String(payload.email || "").toLowerCase())) return send(response, 400, { detail: "البريد الإلكتروني مستخدم بالفعل" });
    const created = { id: id("usr"), email: String(payload.email || "").toLowerCase(), name: payload.name || "مستخدم جديد", role: payload.role || "tracker", title: payload.title || "", active: payload.active !== false, created_at: now() };
    store.users.push(created); return send(response, 201, safeUser(created));
  }
  if (segments[0] === "users" && segments[1] && method === "PATCH") {
    const item = store.users.find((entry) => entry.id === segments[1]);
    if (!item) return send(response, 404, { detail: "User not found" });
    Object.assign(item, payload); return send(response, 200, safeUser(item));
  }

  if (route === "dashboard" && method === "GET") return send(response, 200, dashboard());

  if (route === "projects" && method === "GET") return send(response, 200, store.projects.map((project) => ({ ...project, rag: rag(project) })));
  if (route === "projects" && method === "POST") {
    const created = { ...payload, id: id("prj"), owner_id: payload.owner_id || user.id, created_by: user.id, created_at: now(), updated_at: now() };
    store.projects.unshift(created); return send(response, 201, { ...created, rag: rag(created) });
  }
  if (segments[0] === "projects" && segments[1]) {
    const item = store.projects.find((entry) => entry.id === segments[1]);
    if (!item) return send(response, 404, { detail: "Project not found" });
    if (method === "GET") return send(response, 200, { ...item, rag: rag(item) });
    if (method === "PATCH") { Object.assign(item, payload, { updated_at: now() }); return send(response, 200, { ...item, rag: rag(item) }); }
    if (method === "DELETE") { store.projects = store.projects.filter((entry) => entry.id !== item.id); store.tasks = store.tasks.filter((entry) => entry.project_id !== item.id); return send(response, 200, { ok: true }); }
  }

  if (route === "tasks" && method === "GET") {
    const projectId = url.searchParams.get("project_id");
    return send(response, 200, projectId ? store.tasks.filter((task) => task.project_id === projectId) : store.tasks);
  }
  if (route === "tasks" && method === "POST") {
    const created = { ...payload, id: id("tsk"), created_by: user.id, created_at: now(), updated_at: now(), progress: Number(payload.progress || 0) };
    store.tasks.unshift(created); return send(response, 201, created);
  }
  if (segments[0] === "tasks" && segments[1]) {
    const item = store.tasks.find((entry) => entry.id === segments[1]);
    if (!item) return send(response, 404, { detail: "Task not found" });
    if (segments[2] === "approve" && method === "POST") { Object.assign(item, { status: "completed", progress: 100, updated_at: now() }); return send(response, 200, item); }
    if (method === "PATCH") { Object.assign(item, payload, { updated_at: now() }); return send(response, 200, item); }
    if (method === "DELETE") { store.tasks = store.tasks.filter((entry) => entry.id !== item.id); return send(response, 200, { ok: true }); }
  }

  if (route === "progress" && method === "GET") return send(response, 200, store.progress.filter((entry) => !url.searchParams.get("project_id") || entry.project_id === url.searchParams.get("project_id")));
  if (route === "progress" && method === "POST") {
    const created = { ...payload, id: id("upd"), created_by: user.id, created_by_name: user.name, created_at: now() };
    store.progress.unshift(created);
    if (payload.progress !== undefined) { const project = store.projects.find((entry) => entry.id === payload.project_id); if (project) project.progress = Number(payload.progress); }
    return send(response, 201, created);
  }

  if (route === "meetings" && method === "GET") return send(response, 200, store.meetings);
  if (route === "meetings" && method === "POST") {
    const created = { ...payload, id: id("meet"), organizer_id: user.id, organizer_name: user.name, status: payload.status || "scheduled", created_at: now() };
    store.meetings.unshift(created); return send(response, 201, created);
  }
  if (segments[0] === "meetings" && segments[1]) {
    const item = store.meetings.find((entry) => entry.id === segments[1]);
    if (!item) return send(response, 404, { detail: "Meeting not found" });
    if (method === "PATCH") { Object.assign(item, payload, { updated_at: now() }); return send(response, 200, item); }
    if (method === "DELETE") { store.meetings = store.meetings.filter((entry) => entry.id !== item.id); return send(response, 200, { ok: true }); }
  }

  if (route === "meeting-requests" && method === "GET") return send(response, 200, store.meetingRequests);
  if (route === "meeting-requests" && method === "POST") {
    const created = { ...payload, id: id("req"), requester_id: user.id, requester_name: user.name, status: "pending", created_at: now() };
    store.meetingRequests.unshift(created); return send(response, 201, created);
  }
  if (segments[0] === "meeting-requests" && segments[1] && segments[2] === "decision" && method === "POST") {
    const item = store.meetingRequests.find((entry) => entry.id === segments[1]);
    if (!item) return send(response, 404, { detail: "Meeting request not found" });
    Object.assign(item, { status: payload.decision || payload.status || "approved", decision_note: payload.note || payload.reason || "", decided_by: user.id, updated_at: now() });
    return send(response, 200, item);
  }

  if (route === "documents" && method === "GET") return send(response, 200, store.documents);
  if (route === "documents" && method === "POST") {
    const created = { ...payload, id: id("doc"), uploaded_by: user.id, uploaded_by_name: user.name, intelligence_status: "processed", created_at: now() };
    created.intelligence = intelligenceFor(created).analysis;
    store.documents.unshift(created); return send(response, 201, created);
  }
  if (segments[0] === "documents" && segments[1]) {
    const item = store.documents.find((entry) => entry.id === segments[1]);
    if (!item) return send(response, 404, { detail: "Document not found" });
    if (segments[2] === "intelligence" && ["GET", "POST"].includes(method)) { const result = intelligenceFor(item); item.intelligence = result.analysis; item.intelligence_status = "processed"; return send(response, 200, result); }
    if (method === "DELETE") { store.documents = store.documents.filter((entry) => entry.id !== item.id); return send(response, 200, { ok: true }); }
  }

  if (route === "messages" && method === "GET") return send(response, 200, store.messages.filter((message) => message.sender_id === user.id || message.recipient_id === user.id || ["admin", "ceo", "tracker"].includes(user.role)));
  if (route === "messages" && method === "POST") {
    const recipient = store.users.find((entry) => entry.id === payload.recipient_id);
    const created = { ...payload, id: id("msg"), sender_id: user.id, sender_name: user.name, recipient_name: recipient?.name || "", read: false, created_at: now() };
    store.messages.unshift(created); return send(response, 201, created);
  }
  if (segments[0] === "messages" && segments[1]) {
    const item = store.messages.find((entry) => entry.id === segments[1]);
    if (!item) return send(response, 404, { detail: "Message not found" });
    if (segments[2] === "read" && method === "PATCH") { item.read = true; return send(response, 200, item); }
    if (segments[2] === "ai-summary" && method === "POST") return send(response, 200, { summary: `ملخص المراسلة: ${item.subject}. ${item.body}` });
    if (segments[2] === "extract-actions" && method === "POST") return send(response, 200, { actions: [{ title: `متابعة: ${item.subject}`, priority: item.priority === "critical" ? "critical" : "high" }] });
    if (segments[2] === "route" && method === "POST") return send(response, 200, { recommended_route: "مكتب الرئيس التنفيذي", reason: "المراسلة ذات أثر تنفيذي وتتطلب متابعة." });
    if (segments[2] === "create-followup" && method === "POST") {
      const task = { id: id("tsk"), title: `متابعة: ${item.subject}`, description: item.body, sector: "corporate", assignee_id: item.recipient_id, priority: "high", status: "pending", progress: 0, created_by: user.id, created_at: now() };
      store.tasks.unshift(task); return send(response, 200, { created_task: task, created_task_id: task.id });
    }
  }

  if (route === "notifications" && method === "GET") return send(response, 200, store.notifications.filter((item) => item.user_id === user.id || ["admin", "ceo"].includes(user.role)));
  if (route === "notifications/read-all" && method === "POST") { store.notifications.forEach((item) => { if (item.user_id === user.id) item.read = true; }); return send(response, 200, { ok: true }); }
  if (segments[0] === "notifications" && segments[1] && segments[2] === "read" && method === "POST") { const item = store.notifications.find((entry) => entry.id === segments[1]); if (item) item.read = true; return send(response, 200, { ok: true }); }

  if (route === "calendar" && method === "GET") return send(response, 200, store.calendar);
  if (route === "calendar" && method === "POST") { const created = { ...payload, id: id("cal"), user_id: user.id, created_at: now() }; store.calendar.unshift(created); return send(response, 201, created); }
  if (segments[0] === "calendar" && segments[1]) {
    const item = store.calendar.find((entry) => entry.id === segments[1]);
    if (!item) return send(response, 404, { detail: "Event not found" });
    if (method === "PATCH") { Object.assign(item, payload, { updated_at: now() }); return send(response, 200, item); }
    if (method === "DELETE") { store.calendar = store.calendar.filter((entry) => entry.id !== item.id); return send(response, 200, { ok: true }); }
  }

  if (route === "reports/daily-executive" && method === "GET") {
    const data = dashboard();
    return send(response, 200, {
      date: new Date().toISOString().slice(0, 10),
      title: "الموجز التنفيذي اليومي",
      metrics: { total_projects: data.totals.projects, active_projects: data.totals.active_projects, critical_projects: data.rag.red, overdue_tasks: data.totals.overdue_tasks, pending_requests: store.meetingRequests.filter((item) => item.status === "pending").length, avg_progress: data.totals.avg_progress },
      ai_summary: `يوجد ${data.rag.red} مشروع حرج و${data.totals.overdue_tasks} مهمة متأخرة. الأولوية اليوم لحسم القرارات المعلقة وإغلاق التبعيات الحرجة.`,
      critical_projects: store.projects.filter((project) => rag(project) === "red"),
      overdue_tasks: store.tasks.filter((task) => task.status === "delayed"),
      pending_meeting_requests: store.meetingRequests.filter((item) => item.status === "pending"),
      recommended_actions: ["مراجعة المشروعات الحرجة", "حسم طلبات الاجتماعات المعلقة", "إعادة توجيه المهام المتأخرة"],
      language: "ar",
    });
  }

  if (route === "ai/risk-radar" && method === "GET") return send(response, 200, riskRadar());
  if (route === "ai/chief-of-staff" && method === "GET") {
    const data = dashboard();
    return send(response, 200, {
      greeting: `صباح الخير، ${user.name}`,
      headline: "تحتاج القرارات والمخاطر ومسارات التنفيذ المتأخرة إلى انتباهك التنفيذي.",
      insights: [`${data.rag.red} من البنود الاستراتيجية تتطلب اطلاعًا مباشرًا.`, `${data.totals.overdue_tasks} من المهام متأخرة وقد تحتاج إلى تصعيد.`, `${store.tasks.filter((task) => task.status === "awaiting_approval").length} من المهام تنتظر الاعتماد.`, `${store.meetingRequests.filter((item) => item.status === "pending").length} من طلبات الاجتماعات تنتظر قرارًا.`],
      recommended_next_step: "ابدأ بالمخاطر الحرجة، ثم احسم الطلبات المعلقة، وأعد توجيه مسارات التنفيذ المتأخرة.",
      confidence: 0.95, language: "ar",
    });
  }
  if (route === "ai/workforce-status" && method === "GET") {
    const agents = agentsPayload().agents;
    return send(response, 200, { title: "حالة القوى العاملة الذكية", status: "يعمل بكفاءة", summary: "يراقب الوكلاء التدفق المؤسسي عبر المشروعات والمستندات والاجتماعات والمهام والاتصالات والمخاطر.", metrics: { agents: agents.length, documents: store.documents.length, tasks: store.tasks.length, critical_risks: riskRadar().counts.critical }, agents, language: "ar" });
  }
  if (route === "ai/agents" && method === "GET") return send(response, 200, { ...agentsPayload(), language: "ar" });
  if (route === "ai/executive-brief" && method === "POST") return send(response, 200, executiveBrief(payload.source_type || "dashboard", payload.item || {}));
  if (route === "ai/orchestrate" && method === "POST") {
    const command = payload.command || payload.text || "أمر تنفيذي";
    const result = { summary: `تم تحليل الأمر التنفيذي: ${command}`, risk_level: /خطر|متأخر|حرج/.test(command) ? "مرتفع" : "متوسط", recommended_owner: "مكتب الرئيس التنفيذي", suggested_tasks: [{ title: `متابعة الأمر: ${command.slice(0, 70)}`, priority: "high" }], suggested_meeting: payload.create_meeting ? { title: "اجتماع متابعة تنفيذي", duration_minutes: 45 } : null, generated_by: "طبقة تنسيق الذكاء الاصطناعي العربية", language: "ar" };
    store.agentActivity.push({ agent: "مكتب الرئيس التنفيذي", action: result.summary, time: now() });
    if (payload.create_task) { const task = { id: id("tsk"), title: result.suggested_tasks[0].title, description: command, sector: "corporate", priority: "high", status: "pending", progress: 0, created_by: user.id, created_at: now() }; store.tasks.unshift(task); result.created_task = task; }
    return send(response, 200, result);
  }
  if (route === "ai/command" && method === "POST") {
    const command = String(payload.command || "");
    const routeMap = command.includes("اجتماع") ? "/meetings" : command.includes("مشروع") ? "/projects" : command.includes("مهمة") ? "/tasks" : command.includes("تقرير") ? "/reports" : command.includes("خطر") ? "/dashboard" : "/dashboard";
    return send(response, 200, { route: routeMap, message: "تم توجيه الأمر إلى المساحة التنفيذية المناسبة." });
  }

  if (route === "voice/transcribe" && method === "POST") return send(response, 200, { id: id("voice"), transcript: "تم التقاط التوجيه الصوتي. راجع النص ثم طبّق المهام المقترحة.", suggested_tasks: [{ title: "متابعة التوجيه الصوتي", priority: "high", sector: "corporate" }], created_at: now() });
  if (route === "voice/apply" && method === "POST") {
    const selected = Array.isArray(payload.selected_tasks) ? payload.selected_tasks : [];
    selected.forEach((taskPayload) => store.tasks.unshift({ ...taskPayload, id: id("tsk"), status: taskPayload.status || "pending", progress: Number(taskPayload.progress || 0), created_by: user.id, created_at: now() }));
    return send(response, 200, { created: selected.length });
  }

  return send(response, 404, { detail: `API route not found: ${method} /api/${route}` });
}
