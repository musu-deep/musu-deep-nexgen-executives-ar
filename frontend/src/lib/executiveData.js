const CLOSED_TASK_STATUSES = new Set(["completed", "cancelled"]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inferProjectRag(project) {
  if (["red", "amber", "green", "gray"].includes(project?.rag)) return project.rag;
  const status = String(project?.status || "");
  const priority = String(project?.priority || "");
  const progress = Number(project?.progress || 0);
  const endDate = parseDate(project?.end_date);
  const now = new Date();

  if (priority === "critical" || status === "delayed" || (endDate && endDate < now && status !== "completed")) return "red";
  if (priority === "high" || status === "on_hold" || (status === "active" && progress < 45)) return "amber";
  if (status === "completed" || (status === "active" && progress >= 45)) return "green";
  return "gray";
}

function isOverdue(task, now = new Date()) {
  if (CLOSED_TASK_STATUSES.has(String(task?.status || ""))) return false;
  if (String(task?.status || "") === "delayed") return true;
  const due = parseDate(task?.due_date);
  return Boolean(due && due < now);
}

function sortRecent(items) {
  return [...items].sort((a, b) => {
    const left = parseDate(a?.updated_at || a?.created_at)?.getTime() || 0;
    const right = parseDate(b?.updated_at || b?.created_at)?.getTime() || 0;
    return right - left;
  });
}

export function buildDashboardData(projectInput, taskInput) {
  const projects = asArray(projectInput).map((project) => ({ ...project, rag: inferProjectRag(project) }));
  const tasks = asArray(taskInput);
  const now = new Date();
  const rag = { green: 0, amber: 0, red: 0, gray: 0 };
  const sectors = new Map();
  const taskStatus = {};

  projects.forEach((project) => {
    rag[project.rag] = (rag[project.rag] || 0) + 1;
    const sector = project.sector || "corporate";
    const current = sectors.get(sector) || { sector, count: 0, progress: 0 };
    current.count += 1;
    current.progress += Number(project.progress || 0);
    sectors.set(sector, current);
  });

  tasks.forEach((task) => {
    const status = task.status || "pending";
    taskStatus[status] = (taskStatus[status] || 0) + 1;
  });

  const totalProgress = projects.reduce((sum, project) => sum + Number(project.progress || 0), 0);
  const totalBudget = projects.reduce((sum, project) => sum + Number(project.budget || 0), 0);

  return {
    totals: {
      projects: projects.length,
      active_projects: projects.filter((project) => project.status === "active").length,
      completed_projects: projects.filter((project) => project.status === "completed").length,
      tasks: tasks.length,
      overdue_tasks: tasks.filter((task) => isOverdue(task, now)).length,
      avg_progress: Math.round(totalProgress / Math.max(projects.length, 1)),
      total_budget: totalBudget,
    },
    rag,
    by_sector: [...sectors.values()].map((sector) => ({
      sector: sector.sector,
      count: sector.count,
      avg_progress: Math.round(sector.progress / Math.max(sector.count, 1)),
    })),
    task_status: taskStatus,
    recent_projects: sortRecent(projects).slice(0, 6),
  };
}

export function buildDailyData({ projects: projectInput, tasks: taskInput, meetings: meetingInput, requests: requestInput, user }) {
  const projects = asArray(projectInput).map((project) => ({ ...project, rag: inferProjectRag(project) }));
  const tasks = asArray(taskInput);
  const meetings = asArray(meetingInput);
  const requests = asArray(requestInput);
  const now = new Date();

  const overdueTasks = tasks.filter((task) => isOverdue(task, now));
  const criticalProjects = projects.filter((project) => project.rag === "red");
  const todayMeetings = meetings.filter((meeting) => {
    const date = parseDate(meeting.date);
    return date && date.toDateString() === now.toDateString();
  });
  const pendingRequests = requests.filter((request) => request.status === "pending");
  const avgProgress = Math.round(projects.reduce((sum, project) => sum + Number(project.progress || 0), 0) / Math.max(projects.length, 1));

  const summary = [
    `يعرض الموجز التنفيذي ${projects.length} مشروعًا، منها ${projects.filter((project) => project.status === "active").length} مشروعًا نشطًا و${criticalProjects.length} مشروعًا يحتاج تدخلًا عاجلًا.`,
    `توجد ${overdueTasks.length} مهمة متأخرة، و${todayMeetings.length} اجتماعًا مجدولًا اليوم، و${pendingRequests.length} طلب اجتماع ينتظر القرار.`,
    criticalProjects.length || overdueTasks.length
      ? "الأولوية اليوم هي إغلاق أسباب التعثر، وتثبيت المسؤوليات والمواعيد، ثم مراجعة البنود الحرجة قبل نهاية يوم العمل."
      : "المؤشرات الحالية مستقرة، ويوصى بالمحافظة على وتيرة المتابعة وإغلاق البنود المفتوحة في مواعيدها.",
  ].join("\n\n");

  return {
    generated_at: new Date().toISOString(),
    user: { name: user?.name, role: user?.role },
    ai_summary: summary,
    metrics: {
      total_projects: projects.length,
      active_projects: projects.filter((project) => project.status === "active").length,
      critical_projects: criticalProjects.length,
      overdue_tasks: overdueTasks.length,
      today_meetings: todayMeetings.length,
      pending_requests: pendingRequests.length,
      pending_voice_directives: 0,
      avg_progress: avgProgress,
    },
    critical_projects: criticalProjects.slice(0, 10),
    overdue_tasks: overdueTasks.slice(0, 15),
    today_meetings: todayMeetings,
    pending_requests: pendingRequests.slice(0, 10),
    pending_voice_directives: [],
  };
}

export async function loadOperationalSources(api) {
  const requests = [
    ["projects", api.get("/projects")],
    ["tasks", api.get("/tasks")],
    ["meetings", api.get("/meetings")],
    ["requests", api.get("/meeting-requests")],
  ];
  const settled = await Promise.allSettled(requests.map(([, promise]) => promise));
  const data = { projects: [], tasks: [], meetings: [], requests: [] };
  let successful = 0;

  settled.forEach((result, index) => {
    const key = requests[index][0];
    if (result.status === "fulfilled") {
      data[key] = asArray(result.value?.data);
      successful += 1;
    }
  });

  return {
    ...data,
    successful,
    total: requests.length,
    isLive: successful >= 2,
    isPartial: successful > 0 && successful < requests.length,
  };
}
