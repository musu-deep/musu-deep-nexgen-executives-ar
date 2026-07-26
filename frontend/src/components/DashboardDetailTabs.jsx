import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, AlertTriangle, BriefcaseBusiness, CalendarDays, CheckCircle2,
  ChevronLeft, CircleDollarSign, FolderKanban, ListChecks, Target, X,
} from "lucide-react";

const PROJECT_STATUS_LABELS = {
  planning: "قيد التخطيط",
  planned: "مخطط",
  active: "نشط",
  completed: "مكتمل",
  delayed: "متعثر",
  on_hold: "متوقف مؤقتًا",
  cancelled: "ملغى",
};

const TASK_STATUS_LABELS = {
  pending: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  awaiting_approval: "بانتظار الاعتماد",
  delayed: "متأخرة",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const SECTOR_LABELS = {
  development: "التنمية المؤسسية",
  investment: "الاستثمار",
  arak_development: "العمليات والتنفيذ",
  academy: "بناء القدرات",
  digital: "التحول الرقمي",
  corporate: "الخدمات المؤسسية",
};

const RAG_LABELS = {
  green: "سليم",
  amber: "تحت المراقبة",
  red: "حرج",
  gray: "غير مصنف",
};

const RAG_STYLES = {
  green: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  red: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  gray: "bg-white/5 text-slate-300 border-white/10",
};

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

function isOverdue(task) {
  if (["completed", "cancelled"].includes(String(task?.status || ""))) return false;
  if (String(task?.status || "") === "delayed") return true;
  const dueDate = parseDate(task?.due_date);
  return Boolean(dueDate && dueDate < new Date());
}

function getProjectId(project) {
  return String(project?.id || project?._id || project?.project_id || project?.name || "");
}

function getTaskProjectId(task) {
  const value = task?.project_id || task?.project?.id || task?.project?._id || task?.project;
  return value == null ? "" : String(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("ar", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" }) : "غير محدد";
}

export default function DashboardDetailTabs({ detail, sources, onClose }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(detail?.defaultTab || "overview");

  useEffect(() => {
    setActiveTab(detail?.defaultTab || "overview");
  }, [detail]);

  useEffect(() => {
    if (!detail) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detail, onClose]);

  const view = useMemo(() => {
    const projects = asArray(sources?.projects).map((project) => ({ ...project, rag: inferProjectRag(project) }));
    const tasks = asArray(sources?.tasks).map((task) => ({ ...task, overdue: isOverdue(task) }));
    let filteredProjects = [...projects];
    let filteredTasks = [...tasks];

    if (!detail) return { projects: [], tasks: [], allProjects: projects };

    if (detail.kind === "projects" && detail.status) {
      filteredProjects = projects.filter((project) => project.status === detail.status);
    } else if (detail.kind === "rag") {
      filteredProjects = projects.filter((project) => project.rag === detail.rag);
    } else if (detail.kind === "sector") {
      filteredProjects = projects.filter((project) => project.sector === detail.sector);
    } else if (detail.kind === "project") {
      filteredProjects = projects.filter((project) => getProjectId(project) === String(detail.projectId));
    }

    if (detail.kind === "tasks") {
      filteredTasks = detail.overdueOnly ? tasks.filter((task) => task.overdue) : tasks;
    } else if (detail.kind === "taskStatus") {
      filteredTasks = tasks.filter((task) => String(task.status || "pending") === detail.status);
    }

    const projectDriven = ["projects", "rag", "sector", "project", "budget", "progress"].includes(detail.kind);
    const taskDriven = ["tasks", "taskStatus"].includes(detail.kind);

    if (projectDriven) {
      const projectIds = new Set(filteredProjects.map(getProjectId).filter(Boolean));
      filteredTasks = tasks.filter((task) => projectIds.has(getTaskProjectId(task)));
    }

    if (taskDriven) {
      const projectIds = new Set(filteredTasks.map(getTaskProjectId).filter(Boolean));
      filteredProjects = projects.filter((project) => projectIds.has(getProjectId(project)));
    }

    if (detail.kind === "budget") {
      filteredProjects.sort((left, right) => Number(right.budget || 0) - Number(left.budget || 0));
    } else if (detail.kind === "progress") {
      filteredProjects.sort((left, right) => Number(right.progress || 0) - Number(left.progress || 0));
    } else {
      filteredProjects.sort((left, right) => Number(right.progress || 0) - Number(left.progress || 0));
    }

    filteredTasks.sort((left, right) => {
      if (left.overdue !== right.overdue) return left.overdue ? -1 : 1;
      return (parseDate(left.due_date)?.getTime() || Number.MAX_SAFE_INTEGER) - (parseDate(right.due_date)?.getTime() || Number.MAX_SAFE_INTEGER);
    });

    return { projects: filteredProjects, tasks: filteredTasks, allProjects: projects };
  }, [detail, sources]);

  if (!detail) return null;

  const projectMap = new Map(view.allProjects.map((project) => [getProjectId(project), project]));
  const totalBudget = view.projects.reduce((sum, project) => sum + Number(project.budget || 0), 0);
  const avgProgress = Math.round(view.projects.reduce((sum, project) => sum + Number(project.progress || 0), 0) / Math.max(view.projects.length, 1));
  const overdueCount = view.tasks.filter((task) => task.overdue).length;

  const tabs = [
    { id: "overview", label: "نظرة عامة", icon: <Target size={16} /> },
    { id: "projects", label: `المشروعات (${view.projects.length})`, icon: <FolderKanban size={16} /> },
    { id: "tasks", label: `المهام (${view.tasks.length})`, icon: <ListChecks size={16} /> },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm p-3 md:p-6 flex items-center justify-center" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="w-full max-w-6xl max-h-[92vh] rounded-3xl border border-white/10 bg-slate-950 shadow-2xl overflow-hidden" dir="rtl" role="dialog" aria-modal="true" aria-label={detail.title}>
        <header className="px-5 md:px-7 py-5 border-b border-white/10 bg-white/[0.025] flex items-start justify-between gap-5">
          <div>
            <div className="text-xs text-yellow-500/80 mb-2">التفاصيل التنفيذية</div>
            <h2 className="font-heading text-2xl md:text-3xl font-black text-slate-100">{detail.title}</h2>
            <p className="text-sm text-slate-500 mt-2">{detail.subtitle || "استعراض تفصيلي للبيانات المرتبطة بالمؤشر المحدد."}</p>
          </div>
          <button type="button" onClick={onClose} className="w-11 h-11 rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center" aria-label="إغلاق التفاصيل"><X size={20} /></button>
        </header>

        <div className="px-5 md:px-7 pt-4 border-b border-white/10 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`px-4 py-3 rounded-t-xl flex items-center gap-2 text-sm font-bold border-b-2 transition ${activeTab === tab.id ? "border-yellow-400 text-yellow-300 bg-yellow-500/10" : "border-transparent text-slate-500 hover:text-slate-200 hover:bg-white/5"}`}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 md:p-7 overflow-y-auto max-h-[calc(92vh-190px)]">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard icon={<BriefcaseBusiness size={18}/>} label="المشروعات المرتبطة" value={formatNumber(view.projects.length)} />
                <SummaryCard icon={<ListChecks size={18}/>} label="المهام المرتبطة" value={formatNumber(view.tasks.length)} />
                <SummaryCard icon={<Activity size={18}/>} label="متوسط الإنجاز" value={`${avgProgress}%`} tone="text-yellow-300" />
                <SummaryCard icon={<AlertTriangle size={18}/>} label="المهام المتأخرة" value={formatNumber(overdueCount)} tone="text-rose-300" />
              </div>

              <div className="grid lg:grid-cols-2 gap-5">
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <div className="flex items-center gap-2 text-slate-300 font-bold"><CircleDollarSign size={18} className="text-yellow-400"/> القيمة الإجمالية للميزانيات</div>
                  <div className="font-heading text-4xl font-black text-yellow-300 mt-5">{formatNumber(totalBudget)}</div>
                  <div className="text-xs text-slate-600 mt-2">وفق المشروعات الظاهرة في هذا التبويب</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <div className="flex items-center gap-2 text-slate-300 font-bold"><CheckCircle2 size={18} className="text-emerald-400"/> توزيع حالة الأداء</div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {Object.keys(RAG_LABELS).map((rag) => <MiniStatus key={rag} label={RAG_LABELS[rag]} value={view.projects.filter((project) => project.rag === rag).length} css={RAG_STYLES[rag]} />)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => navigate("/projects")} className="px-4 py-3 rounded-xl bg-yellow-500 text-black font-black text-sm flex items-center gap-2">فتح وحدة المشروعات <ChevronLeft size={16}/></button>
                <button type="button" onClick={() => navigate("/tasks")} className="px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-slate-200 font-bold text-sm flex items-center gap-2">فتح وحدة المهام <ChevronLeft size={16}/></button>
              </div>
            </div>
          )}

          {activeTab === "projects" && (
            <div className="space-y-3">
              {view.projects.length ? view.projects.map((project) => (
                <ProjectRow key={getProjectId(project)} project={project} onOpen={() => setActiveTab("overview")} />
              )) : <EmptyState text="لا توجد مشروعات مطابقة لهذا المؤشر." />}
            </div>
          )}

          {activeTab === "tasks" && (
            <div className="space-y-3">
              {view.tasks.length ? view.tasks.map((task, index) => (
                <TaskRow key={task.id || task._id || `${task.title}-${index}`} task={task} project={projectMap.get(getTaskProjectId(task))} />
              )) : <EmptyState text="لا توجد مهام مطابقة لهذا المؤشر." />}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ icon, label, value, tone = "text-slate-100" }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><div className="w-9 h-9 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center">{icon}</div><div className={`font-heading text-3xl font-black mt-4 ${tone}`}>{value}</div><div className="text-xs text-slate-500 mt-2">{label}</div></div>;
}

function MiniStatus({ label, value, css }) {
  return <div className={`rounded-xl border p-3 ${css}`}><div className="font-heading text-2xl font-black">{value}</div><div className="text-[11px] opacity-80 mt-1">{label}</div></div>;
}

function ProjectRow({ project }) {
  const rag = inferProjectRag(project);
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 md:p-5 hover:border-yellow-500/25 transition">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-100">{project.name || project.title || "مشروع تنفيذي"}</h3>
            <span className={`px-2 py-1 rounded-lg border text-[10px] ${RAG_STYLES[rag]}`}>{RAG_LABELS[rag]}</span>
          </div>
          <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <span>{SECTOR_LABELS[project.sector] || project.sector || "غير مصنف"}</span>
            <span>{PROJECT_STATUS_LABELS[project.status] || project.status || "غير محدد"}</span>
            <span>الانتهاء: {formatDate(project.end_date)}</span>
            <span>الميزانية: {formatNumber(project.budget)}</span>
          </div>
        </div>
        <div className="md:w-56 shrink-0">
          <div className="flex justify-between text-xs mb-2"><span className="text-slate-500">نسبة الإنجاز</span><strong className="text-yellow-300">{Number(project.progress || 0)}%</strong></div>
          <div className="h-2.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-l from-yellow-400 to-yellow-600" style={{ width: `${Math.min(100, Math.max(0, Number(project.progress || 0)))}%` }} /></div>
        </div>
      </div>
    </article>
  );
}

function TaskRow({ task, project }) {
  return (
    <article className={`rounded-2xl border p-4 md:p-5 ${task.overdue ? "border-rose-500/20 bg-rose-500/[0.045]" : "border-white/10 bg-white/[0.025]"}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-100">{task.title || task.name || "مهمة تنفيذية"}</h3>
            {task.overdue && <span className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[10px]">متأخرة</span>}
          </div>
          <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <span>{project?.name || task.project_name || "دون مشروع مرتبط"}</span>
            <span>{TASK_STATUS_LABELS[task.status] || task.status || "قيد الانتظار"}</span>
            <span className="flex items-center gap-1"><CalendarDays size={12}/> الاستحقاق: {formatDate(task.due_date)}</span>
          </div>
        </div>
        <div className="text-xs text-slate-600">الأولوية: {task.priority || "غير محددة"}</div>
      </div>
    </article>
  );
}

function EmptyState({ text }) {
  return <div className="p-10 text-center rounded-2xl border border-dashed border-white/10 text-slate-600 text-sm">{text}</div>;
}
