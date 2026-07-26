import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { buildDashboardData, loadOperationalSources } from "../lib/executiveData";
import { getDataMode, setDataMode as persistDataMode } from "../lib/dataMode";
import { DataModeSelector, DataSourceBadge, DemoModeNotice } from "../components/DataModeControl";
import DashboardDetailTabs from "../components/DashboardDetailTabs";
import { useAuth } from "../contexts/AuthContext";
import {
  Activity, AlertTriangle, BarChart3, BriefcaseBusiness, CheckCircle2,
  ChevronLeft, FolderKanban, ListChecks, RefreshCw, TrendingUp, WalletCards,
} from "lucide-react";

const EMPTY_DASHBOARD = buildDashboardData([], []);
const EMPTY_SOURCES = { projects: [], tasks: [], meetings: [], requests: [] };

const SECTOR_LABELS = {
  development: "التنمية المؤسسية",
  investment: "الاستثمار",
  arak_development: "العمليات والتنفيذ",
  academy: "بناء القدرات",
  digital: "التحول الرقمي",
  corporate: "الخدمات المؤسسية",
};

const STATUS_LABELS = {
  pending: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  awaiting_approval: "بانتظار الاعتماد",
  delayed: "متأخرة",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const PROJECT_STATUS_LABELS = {
  active: "نشط",
  completed: "مكتمل",
  delayed: "متعثر",
  on_hold: "متوقف مؤقتًا",
  planned: "مخطط",
};

function formatNumber(value) {
  return new Intl.NumberFormat("ar").format(Number(value || 0));
}

export default function ExecutiveDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(EMPTY_DASHBOARD);
  const [operationalSources, setOperationalSources] = useState(EMPTY_SOURCES);
  const [loading, setLoading] = useState(true);
  const [sourceState, setSourceState] = useState("loading");
  const [dataMode, setDataMode] = useState(() => getDataMode());
  const [detailView, setDetailView] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setSourceState("loading");
    try {
      const sources = await loadOperationalSources(api, dataMode);
      if (!sources.isAvailable) throw new Error("Operational sources unavailable");

      setOperationalSources({
        projects: Array.isArray(sources.projects) ? sources.projects : [],
        tasks: Array.isArray(sources.tasks) ? sources.tasks : [],
        meetings: Array.isArray(sources.meetings) ? sources.meetings : [],
        requests: Array.isArray(sources.requests) ? sources.requests : [],
      });
      setData(buildDashboardData(sources.projects, sources.tasks));
      setSourceState(sources.sourceState);

      if (sources.sourceState === "partial") {
        toast.warning("تم تحديث المؤشرات من المصادر المباشرة المتاحة؛ بعض الوحدات لم تستجب.");
      } else if (sources.sourceState === "auto_demo") {
        toast.warning("تعذر الاتصال بالبيانات الفعلية؛ تم الانتقال تلقائيًا إلى بيانات العرض التجريبي.");
      }
    } catch (error) {
      console.error("Executive dashboard load failed", error);
      setOperationalSources(EMPTY_SOURCES);
      setData(EMPTY_DASHBOARD);
      setSourceState("offline");
      toast.error("تعذر قراءة بيانات المشروعات والمهام الفعلية.");
    } finally {
      setLoading(false);
    }
  }, [dataMode]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const handleModeChange = (nextMode) => {
    const savedMode = persistDataMode(nextMode);
    setDataMode(savedMode);
    setDetailView(null);
  };

  const openDetails = (configuration) => setDetailView(configuration);

  const totals = data.totals || EMPTY_DASHBOARD.totals;
  const sectors = data.by_sector || [];
  const maxSectorCount = Math.max(1, ...sectors.map((item) => Number(item.count || 0)));
  const taskStatuses = useMemo(() => Object.entries(data.task_status || {}), [data.task_status]);

  if (loading) {
    return <div className="space-y-5" dir="rtl"><div className="h-28 shimmer rounded-2xl"/><div className="grid grid-cols-2 lg:grid-cols-6 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 shimmer rounded-2xl"/>)}</div><div className="h-72 shimmer rounded-2xl"/></div>;
  }

  return (
    <div dir="rtl" data-testid="dashboard-page" className="space-y-6">
      <section className="glass-card p-6 border-yellow-500/15 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
        <div>
          <div className="text-xs tracking-[0.14em] text-yellow-500/80">لوحة القيادة التنفيذية</div>
          <h1 className="font-heading text-4xl font-black mt-2">مرحبًا، {user?.name || "الرئيس التنفيذي"}</h1>
          <p className="text-slate-500 text-sm mt-2">رؤية موحدة لبيانات المشروعات والمهام والأداء والمخاطر التنفيذية.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DataModeSelector value={dataMode} onChange={handleModeChange} />
          <DataSourceBadge state={sourceState} />
          <button onClick={loadDashboard} className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:text-yellow-300 flex items-center gap-2 text-sm font-bold"><RefreshCw size={16}/> تحديث البيانات</button>
        </div>
      </section>

      <DemoModeNotice state={sourceState} />

      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Metric icon={<FolderKanban size={19}/>} label="إجمالي المشروعات" value={formatNumber(totals.projects)} onClick={() => openDetails({ kind: "projects", title: "إجمالي المشروعات", subtitle: "جميع المشروعات المسجلة مع نسب الإنجاز والميزانيات والمهام المرتبطة.", defaultTab: "projects" })} />
        <Metric icon={<Activity size={19}/>} label="المشروعات النشطة" value={formatNumber(totals.active_projects)} tone="text-emerald-300" onClick={() => openDetails({ kind: "projects", status: "active", title: "المشروعات النشطة", subtitle: "المشروعات الجاري تنفيذها حاليًا والمهام المرتبطة بها.", defaultTab: "projects" })} />
        <Metric icon={<CheckCircle2 size={19}/>} label="المشروعات المكتملة" value={formatNumber(totals.completed_projects)} tone="text-sky-300" onClick={() => openDetails({ kind: "projects", status: "completed", title: "المشروعات المكتملة", subtitle: "المشروعات التي أُغلقت أعمالها ووصلت إلى حالة الاكتمال.", defaultTab: "projects" })} />
        <Metric icon={<ListChecks size={19}/>} label="إجمالي المهام" value={formatNumber(totals.tasks)} onClick={() => openDetails({ kind: "tasks", title: "إجمالي المهام", subtitle: "جميع المهام التنفيذية موزعة حسب الحالة والأولوية والاستحقاق.", defaultTab: "tasks" })} />
        <Metric icon={<AlertTriangle size={19}/>} label="المهام المتأخرة" value={formatNumber(totals.overdue_tasks)} tone="text-rose-300" onClick={() => openDetails({ kind: "tasks", overdueOnly: true, title: "المهام المتأخرة", subtitle: "المهام التي تجاوزت تاريخ الاستحقاق أو صُنفت كمهام متأخرة.", defaultTab: "tasks" })} />
        <Metric icon={<TrendingUp size={19}/>} label="متوسط الإنجاز" value={`${Number(totals.avg_progress || 0)}%`} tone="text-yellow-300" onClick={() => openDetails({ kind: "progress", title: "تحليل متوسط الإنجاز", subtitle: "ترتيب المشروعات حسب نسبة الإنجاز مع عرض المهام المرتبطة بكل مشروع.", defaultTab: "projects" })} />
      </section>

      <section className="grid xl:grid-cols-3 gap-5">
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-5"><BarChart3 size={18} className="text-yellow-400"/><h2 className="font-heading text-xl font-black">مؤشر حالة الأداء</h2></div>
          <div className="grid grid-cols-2 gap-3">
            <StatusBox label="سليم" value={data.rag?.green || 0} css="text-emerald-300 bg-emerald-500/10" onClick={() => openDetails({ kind: "rag", rag: "green", title: "المشروعات السليمة", subtitle: "المشروعات ذات الأداء المستقر أو المكتملة وفق مؤشر الحالة.", defaultTab: "projects" })} />
            <StatusBox label="تحت المراقبة" value={data.rag?.amber || 0} css="text-amber-300 bg-amber-500/10" onClick={() => openDetails({ kind: "rag", rag: "amber", title: "مشروعات تحت المراقبة", subtitle: "المشروعات التي تستلزم متابعة استباقية قبل تحولها إلى حالة حرجة.", defaultTab: "projects" })} />
            <StatusBox label="حرج" value={data.rag?.red || 0} css="text-rose-300 bg-rose-500/10" onClick={() => openDetails({ kind: "rag", rag: "red", title: "المشروعات الحرجة", subtitle: "المشروعات المتعثرة أو ذات الأولوية الحرجة التي تحتاج تدخلًا تنفيذيًا.", defaultTab: "projects" })} />
            <StatusBox label="غير مصنف" value={data.rag?.gray || 0} css="text-slate-300 bg-white/5" onClick={() => openDetails({ kind: "rag", rag: "gray", title: "المشروعات غير المصنفة", subtitle: "المشروعات التي لم تتوفر لها بعد معايير كافية لتحديد حالة الأداء.", defaultTab: "projects" })} />
          </div>
          <button type="button" onClick={() => openDetails({ kind: "budget", title: "تفاصيل الميزانية الإجمالية", subtitle: "ترتيب المشروعات حسب الميزانية المخصصة مع مؤشرات التنفيذ المرتبطة.", defaultTab: "projects" })} className="w-full mt-5 pt-5 border-t border-white/5 flex justify-between items-center rounded-b-xl hover:bg-white/[0.025] transition group text-right">
            <span className="text-sm text-slate-500 flex items-center gap-2"><WalletCards size={15}/> إجمالي الميزانية</span>
            <span className="flex items-center gap-2"><strong className="font-heading text-xl font-black text-yellow-300">{formatNumber(Math.round(totals.total_budget || 0))}</strong><ChevronLeft size={15} className="text-slate-600 group-hover:text-yellow-400 transition"/></span>
          </button>
        </div>

        <div className="glass-card p-6 xl:col-span-2">
          <div className="flex items-center gap-2 mb-5"><BriefcaseBusiness size={18} className="text-yellow-400"/><h2 className="font-heading text-xl font-black">الأداء حسب القطاع</h2></div>
          <div className="space-y-2">
            {sectors.length ? sectors.map((sector) => (
              <button type="button" key={sector.sector} onClick={() => openDetails({ kind: "sector", sector: sector.sector, title: `قطاع ${SECTOR_LABELS[sector.sector] || sector.sector}`, subtitle: "عرض مشروعات القطاع ومهامه ومتوسط الإنجاز والميزانية المرتبطة به.", defaultTab: "projects" })} className="w-full p-3 rounded-xl hover:bg-white/[0.035] focus:outline-none focus:ring-2 focus:ring-yellow-500/30 transition group text-right">
                <div className="flex justify-between text-sm mb-2"><span className="text-slate-300 group-hover:text-yellow-200 transition">{SECTOR_LABELS[sector.sector] || sector.sector}</span><span className="text-slate-500 flex items-center gap-2">{sector.count} مشروع • {sector.avg_progress || 0}% <ChevronLeft size={14} className="group-hover:text-yellow-400"/></span></div>
                <div className="h-2.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-l from-yellow-400 to-yellow-600" style={{ width: `${Math.max(3, (Number(sector.count || 0) / maxSectorCount) * 100)}%` }}/></div>
              </button>
            )) : <EmptyState text="لا توجد بيانات قطاعات مسجلة حتى الآن." />}
          </div>
        </div>
      </section>

      <section className="grid xl:grid-cols-3 gap-5">
        <div className="glass-card p-6">
          <h2 className="font-heading text-xl font-black mb-5">حالات المهام</h2>
          <div className="space-y-3">{taskStatuses.length ? taskStatuses.map(([status, value]) => <button type="button" key={status} onClick={() => openDetails({ kind: "taskStatus", status, title: `المهام: ${STATUS_LABELS[status] || status}`, subtitle: "عرض المهام المطابقة للحالة المحددة مع المشروعات وتواريخ الاستحقاق.", defaultTab: "tasks" })} className="w-full flex justify-between p-3 rounded-xl bg-white/[0.025] border border-white/5 hover:border-yellow-500/25 hover:bg-white/[0.045] transition group text-right"><span className="text-slate-400 group-hover:text-slate-200">{STATUS_LABELS[status] || status}</span><span className="flex items-center gap-2"><strong>{value}</strong><ChevronLeft size={14} className="text-slate-600 group-hover:text-yellow-400"/></span></button>) : <EmptyState text="لا توجد مهام مصنفة حاليًا." />}</div>
        </div>
        <div className="glass-card p-6 xl:col-span-2">
          <h2 className="font-heading text-xl font-black mb-5">آخر المشروعات</h2>
          <div className="space-y-3">{(data.recent_projects || []).length ? data.recent_projects.map((project) => <button type="button" key={project.id || project.name} onClick={() => openDetails({ kind: "project", projectId: project.id || project._id || project.name, title: project.name || "تفاصيل المشروع", subtitle: "بطاقة المشروع التنفيذية والمهام المرتبطة به ومؤشرات الإنجاز.", defaultTab: "overview" })} className="w-full p-4 rounded-xl bg-white/[0.025] border border-white/5 hover:border-yellow-500/25 hover:bg-white/[0.045] transition flex items-center justify-between gap-4 text-right group"><div><div className="font-bold group-hover:text-yellow-200 transition">{project.name}</div><div className="text-xs text-slate-500 mt-1">{SECTOR_LABELS[project.sector] || project.sector || "غير مصنف"}</div></div><div className="flex items-center gap-3"><div className="text-left"><div className="font-heading text-xl font-black text-yellow-300">{project.progress || 0}%</div><div className="text-[10px] text-slate-600">{PROJECT_STATUS_LABELS[project.status] || project.status || "نشط"}</div></div><ChevronLeft size={16} className="text-slate-600 group-hover:text-yellow-400"/></div></button>) : <EmptyState text="لا توجد مشروعات حديثة للعرض." />}</div>
        </div>
      </section>

      <DashboardDetailTabs detail={detailView} sources={operationalSources} onClose={() => setDetailView(null)} />
    </div>
  );
}

function Metric({ icon, label, value, tone = "text-slate-100", onClick }) {
  return <button type="button" onClick={onClick} className="glass-card p-4 text-right hover:border-yellow-500/25 hover:-translate-y-0.5 transition focus:outline-none focus:ring-2 focus:ring-yellow-500/30 group"><div className="flex justify-between items-start"><span className="w-10 h-10 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center">{icon}</span><strong className={`font-heading text-3xl font-black ${tone}`}>{value}</strong></div><div className="flex items-center justify-between gap-2 mt-4"><span className="text-xs text-slate-500 group-hover:text-slate-300 transition">{label}</span><ChevronLeft size={14} className="text-slate-700 group-hover:text-yellow-400 transition"/></div></button>;
}

function StatusBox({ label, value, css, onClick }) {
  return <button type="button" onClick={onClick} className={`rounded-xl p-4 text-right border border-transparent hover:border-current/20 hover:-translate-y-0.5 transition focus:outline-none focus:ring-2 focus:ring-yellow-500/30 group ${css}`}><div className="flex justify-between items-start"><div className="font-heading text-3xl font-black">{value}</div><ChevronLeft size={14} className="opacity-30 group-hover:opacity-100 transition"/></div><div className="text-xs opacity-75 mt-1">{label}</div></button>;
}

function EmptyState({ text }) {
  return <div className="p-8 text-center rounded-xl border border-dashed border-white/10 text-slate-600 text-sm">{text}</div>;
}
