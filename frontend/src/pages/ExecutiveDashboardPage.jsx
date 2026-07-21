import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import {
  Activity, AlertTriangle, BarChart3, BriefcaseBusiness, CheckCircle2,
  FolderKanban, ListChecks, RefreshCw, TrendingUp, WalletCards,
} from "lucide-react";

const EMPTY_DASHBOARD = {
  totals: {
    projects: 0,
    active_projects: 0,
    completed_projects: 0,
    tasks: 0,
    overdue_tasks: 0,
    avg_progress: 0,
    total_budget: 0,
  },
  rag: { green: 0, amber: 0, red: 0, gray: 0 },
  by_sector: [],
  task_status: {},
  recent_projects: [],
};

const SECTOR_LABELS = {
  development: "التنمية المؤسسية",
  investment: "الاستثمار",
  arak_development: "العمليات والتنفيذ",
  academy: "بناء القدرات",
  digital: "التحول الرقمي",
  corporate: "الخدمات المؤسسية",
};

function formatNumber(value) {
  return new Intl.NumberFormat("ar").format(Number(value || 0));
}

export default function ExecutiveDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/executive-data", { params: { view: "dashboard" } });
      setData({ ...EMPTY_DASHBOARD, ...(response.data || {}) });
      setOfflineMode(false);
    } catch (error) {
      console.error("Executive dashboard load failed", error);
      setData(EMPTY_DASHBOARD);
      setOfflineMode(true);
      toast.warning("تعذر الاتصال بالمصدر التنفيذي؛ تم تشغيل وضع الاستمرارية.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

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
          <p className="text-slate-500 text-sm mt-2">رؤية موحدة للمشروعات والمهام والأداء والمخاطر التنفيذية.</p>
        </div>
        <div className="flex items-center gap-3">
          {offlineMode && <span className="px-3 py-2 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300 text-xs">وضع الاستمرارية</span>}
          <button onClick={loadDashboard} className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:text-yellow-300 flex items-center gap-2 text-sm font-bold"><RefreshCw size={16}/> تحديث البيانات</button>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Metric icon={<FolderKanban size={19}/>} label="إجمالي المشروعات" value={formatNumber(totals.projects)} />
        <Metric icon={<Activity size={19}/>} label="المشروعات النشطة" value={formatNumber(totals.active_projects)} tone="text-emerald-300" />
        <Metric icon={<CheckCircle2 size={19}/>} label="المشروعات المكتملة" value={formatNumber(totals.completed_projects)} tone="text-sky-300" />
        <Metric icon={<ListChecks size={19}/>} label="إجمالي المهام" value={formatNumber(totals.tasks)} />
        <Metric icon={<AlertTriangle size={19}/>} label="المهام المتأخرة" value={formatNumber(totals.overdue_tasks)} tone="text-rose-300" />
        <Metric icon={<TrendingUp size={19}/>} label="متوسط الإنجاز" value={`${Number(totals.avg_progress || 0)}%`} tone="text-yellow-300" />
      </section>

      <section className="grid xl:grid-cols-3 gap-5">
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-5"><BarChart3 size={18} className="text-yellow-400"/><h2 className="font-heading text-xl font-black">مؤشر حالة الأداء</h2></div>
          <div className="grid grid-cols-2 gap-3">
            <StatusBox label="سليم" value={data.rag?.green || 0} css="text-emerald-300 bg-emerald-500/10" />
            <StatusBox label="تحت المراقبة" value={data.rag?.amber || 0} css="text-amber-300 bg-amber-500/10" />
            <StatusBox label="حرج" value={data.rag?.red || 0} css="text-rose-300 bg-rose-500/10" />
            <StatusBox label="غير مصنف" value={data.rag?.gray || 0} css="text-slate-300 bg-white/5" />
          </div>
          <div className="mt-5 pt-5 border-t border-white/5 flex justify-between items-center">
            <span className="text-sm text-slate-500 flex items-center gap-2"><WalletCards size={15}/> إجمالي الميزانية</span>
            <span className="font-heading text-xl font-black text-yellow-300">{formatNumber(Math.round(totals.total_budget || 0))}</span>
          </div>
        </div>

        <div className="glass-card p-6 xl:col-span-2">
          <div className="flex items-center gap-2 mb-5"><BriefcaseBusiness size={18} className="text-yellow-400"/><h2 className="font-heading text-xl font-black">الأداء حسب القطاع</h2></div>
          <div className="space-y-4">
            {sectors.length ? sectors.map((sector) => (
              <div key={sector.sector}>
                <div className="flex justify-between text-sm mb-2"><span className="text-slate-300">{SECTOR_LABELS[sector.sector] || sector.sector}</span><span className="text-slate-500">{sector.count} مشروع • {sector.avg_progress || 0}%</span></div>
                <div className="h-2.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-l from-yellow-400 to-yellow-600" style={{ width: `${Math.max(3, (Number(sector.count || 0) / maxSectorCount) * 100)}%` }}/></div>
              </div>
            )) : <EmptyState text="لا توجد بيانات قطاعات مسجلة حتى الآن." />}
          </div>
        </div>
      </section>

      <section className="grid xl:grid-cols-3 gap-5">
        <div className="glass-card p-6">
          <h2 className="font-heading text-xl font-black mb-5">حالات المهام</h2>
          <div className="space-y-3">{taskStatuses.length ? taskStatuses.map(([status, value]) => <div key={status} className="flex justify-between p-3 rounded-xl bg-white/[0.025] border border-white/5"><span className="text-slate-400">{status}</span><strong>{value}</strong></div>) : <EmptyState text="لا توجد مهام مصنفة حاليًا." />}</div>
        </div>
        <div className="glass-card p-6 xl:col-span-2">
          <h2 className="font-heading text-xl font-black mb-5">آخر المشروعات</h2>
          <div className="space-y-3">{(data.recent_projects || []).length ? data.recent_projects.map((project) => <div key={project.id || project.name} className="p-4 rounded-xl bg-white/[0.025] border border-white/5 flex items-center justify-between gap-4"><div><div className="font-bold">{project.name}</div><div className="text-xs text-slate-500 mt-1">{SECTOR_LABELS[project.sector] || project.sector || "غير مصنف"}</div></div><div className="text-left"><div className="font-heading text-xl font-black text-yellow-300">{project.progress || 0}%</div><div className="text-[10px] text-slate-600">{project.status || "نشط"}</div></div></div>) : <EmptyState text="لا توجد مشروعات حديثة للعرض." />}</div>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon, label, value, tone = "text-slate-100" }) {
  return <div className="glass-card p-4"><div className="flex justify-between items-start"><span className="w-10 h-10 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center">{icon}</span><strong className={`font-heading text-3xl font-black ${tone}`}>{value}</strong></div><div className="text-xs text-slate-500 mt-4">{label}</div></div>;
}

function StatusBox({ label, value, css }) {
  return <div className={`rounded-xl p-4 ${css}`}><div className="font-heading text-3xl font-black">{value}</div><div className="text-xs opacity-75 mt-1">{label}</div></div>;
}

function EmptyState({ text }) {
  return <div className="p-8 text-center rounded-xl border border-dashed border-white/10 text-slate-600 text-sm">{text}</div>;
}
