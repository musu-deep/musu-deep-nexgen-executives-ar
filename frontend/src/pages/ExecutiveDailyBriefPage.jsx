import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import {
  AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, FileText,
  Mic, Printer, RefreshCw, TrendingUp,
} from "lucide-react";

const EMPTY_REPORT = {
  generated_at: new Date().toISOString(),
  user: {},
  ai_summary: "لا توجد بيانات تنفيذية متاحة حاليًا. تستمر المنصة في العمل بوضع الاستمرارية إلى حين استعادة الاتصال بمصدر البيانات.",
  metrics: {
    total_projects: 0,
    active_projects: 0,
    critical_projects: 0,
    overdue_tasks: 0,
    today_meetings: 0,
    pending_requests: 0,
    pending_voice_directives: 0,
    avg_progress: 0,
  },
  critical_projects: [],
  overdue_tasks: [],
  today_meetings: [],
  pending_requests: [],
  pending_voice_directives: [],
};

export default function ExecutiveDailyBriefPage() {
  const [report, setReport] = useState(EMPTY_REPORT);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/executive-data", { params: { view: "daily" } });
      setReport({ ...EMPTY_REPORT, ...(response.data || {}), metrics: { ...EMPTY_REPORT.metrics, ...(response.data?.metrics || {}) } });
      setOfflineMode(false);
    } catch (error) {
      console.error("Executive daily brief load failed", error);
      setReport(EMPTY_REPORT);
      setOfflineMode(true);
      toast.warning("تعذر الاتصال بالمصدر التنفيذي؛ تم عرض موجز الاستمرارية.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReport(); }, [loadReport]);

  if (loading) return <div className="space-y-5" dir="rtl"><div className="h-28 shimmer rounded-2xl"/><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 shimmer rounded-2xl"/>)}</div><div className="h-64 shimmer rounded-2xl"/></div>;

  const metrics = report.metrics || EMPTY_REPORT.metrics;
  const generatedAt = new Date(report.generated_at || Date.now());

  return (
    <div dir="rtl" data-testid="daily-report-page" className="space-y-6 print:p-0">
      <section className="glass-card p-6 border-yellow-500/15 flex flex-col xl:flex-row xl:items-center justify-between gap-5 print:hidden">
        <div>
          <div className="text-xs tracking-[0.14em] text-yellow-500/80">الموجز التنفيذي اليومي</div>
          <h1 className="font-heading text-4xl font-black mt-2 flex items-center gap-3"><FileText className="text-yellow-500"/> إحاطة اليوم التنفيذية</h1>
          <p className="text-slate-500 text-sm mt-2">{generatedAt.toLocaleDateString("ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {offlineMode && <span className="px-3 py-2 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300 text-xs">وضع الاستمرارية</span>}
          <button onClick={loadReport} className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:text-yellow-300 flex items-center gap-2 text-sm font-bold"><RefreshCw size={16}/> تحديث</button>
          <button onClick={() => window.print()} className="px-5 py-3 rounded-xl bg-yellow-500 text-black flex items-center gap-2 text-sm font-black"><Printer size={16}/> طباعة أو PDF</button>
        </div>
      </section>

      <section className="glass-card p-6 border-yellow-500/25 bg-yellow-500/[0.025]">
        <div className="flex items-center justify-between gap-4 mb-4"><div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-yellow-400"/><h2 className="font-heading text-xl font-black">الخلاصة التنفيذية</h2></div><span className="text-[10px] px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-300">جاهز للمراجعة</span></div>
        <p className="text-lg leading-9 text-slate-200 whitespace-pre-wrap">{report.ai_summary || EMPTY_REPORT.ai_summary}</p>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        <Metric icon={<TrendingUp size={17}/>} label="إجمالي المشروعات" value={metrics.total_projects} />
        <Metric icon={<CheckCircle2 size={17}/>} label="المشروعات النشطة" value={metrics.active_projects} tone="text-emerald-300" />
        <Metric icon={<AlertTriangle size={17}/>} label="المشروعات الحرجة" value={metrics.critical_projects} tone="text-rose-300" />
        <Metric icon={<ClipboardList size={17}/>} label="المهام المتأخرة" value={metrics.overdue_tasks} tone="text-amber-300" />
        <Metric icon={<CalendarDays size={17}/>} label="اجتماعات اليوم" value={metrics.today_meetings} />
        <Metric icon={<CalendarDays size={17}/>} label="الطلبات المعلقة" value={metrics.pending_requests} />
        <Metric icon={<Mic size={17}/>} label="التوجيهات الصوتية" value={metrics.pending_voice_directives} />
      </section>

      <section className="grid xl:grid-cols-2 gap-5">
        <Panel title="المشروعات الحرجة" icon={<AlertTriangle size={18} className="text-rose-400"/>} items={report.critical_projects} empty="لا توجد مشروعات حرجة مسجلة." render={(item) => <Item key={item.id || item.name} title={item.name || item.title} meta={`الإنجاز ${item.progress || 0}% • ${item.status || "قيد المتابعة"}`} />} />
        <Panel title="المهام المتأخرة" icon={<ClipboardList size={18} className="text-amber-400"/>} items={report.overdue_tasks} empty="لا توجد مهام متأخرة مسجلة." render={(item) => <Item key={item.id || item.title} title={item.title} meta={item.due_date ? `الاستحقاق ${new Date(item.due_date).toLocaleDateString("ar")}` : "دون تاريخ استحقاق"} />} />
        <Panel title="اجتماعات اليوم" icon={<CalendarDays size={18} className="text-sky-400"/>} items={report.today_meetings} empty="لا توجد اجتماعات مجدولة اليوم." render={(item) => <Item key={item.id || item.title} title={item.title} meta={item.date ? new Date(item.date).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }) : "الوقت غير محدد"} />} />
        <Panel title="طلبات تنتظر قرارًا" icon={<CalendarDays size={18} className="text-violet-400"/>} items={report.pending_requests} empty="لا توجد طلبات معلقة." render={(item) => <Item key={item.id || item.subject} title={item.subject || item.title} meta={item.requester_name ? `مقدم الطلب: ${item.requester_name}` : "بانتظار القرار"} />} />
      </section>

      <section className="glass-card p-5">
        <div className="flex items-center justify-between gap-4"><div><div className="text-xs text-slate-500">متوسط الإنجاز المؤسسي</div><div className="font-heading text-4xl font-black text-yellow-300 mt-2">{Number(metrics.avg_progress || 0)}%</div></div><div className="w-2/3 max-w-2xl h-3 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-l from-yellow-400 to-yellow-600" style={{ width: `${Math.min(100, Math.max(0, Number(metrics.avg_progress || 0)))}%` }}/></div></div>
      </section>
    </div>
  );
}

function Metric({ icon, label, value, tone = "text-slate-100" }) {
  return <div className="glass-card p-4"><div className="flex justify-between items-start"><span className="w-9 h-9 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center">{icon}</span><strong className={`font-heading text-3xl font-black ${tone}`}>{value || 0}</strong></div><div className="text-xs text-slate-500 mt-4">{label}</div></div>;
}

function Panel({ title, icon, items = [], empty, render }) {
  return <div className="glass-card p-5"><h2 className="font-heading text-xl font-black flex items-center gap-2 mb-4">{icon}{title}</h2><div className="space-y-3">{items.length ? items.map(render) : <div className="p-8 text-center rounded-xl border border-dashed border-white/10 text-slate-600 text-sm">{empty}</div>}</div></div>;
}

function Item({ title, meta }) {
  return <div className="p-4 rounded-xl bg-white/[0.025] border border-white/5"><div className="font-bold text-slate-100">{title || "عنصر تنفيذي"}</div><div className="text-xs text-slate-500 mt-1">{meta}</div></div>;
}
