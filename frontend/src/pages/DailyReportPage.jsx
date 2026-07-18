import React, { useEffect, useState } from "react";
import api, { SECTOR_LABELS, PRIORITY_LABELS } from "../lib/api";
import RAGBadge from "../components/RAGBadge";
import DetailModal from "../components/DetailModal";
import AICommandBar from "../components/AICommandBar";
import { FileText, Printer, RefreshCw, AlertTriangle, Calendar as CalIcon, Mic, ClipboardList, TrendingUp } from "lucide-react";

export default function DailyReportPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/reports/daily-executive").then((response) => setReport(response.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openDetail = (type, item, title) => {
    setSelected({ type, item, title });
    setBrief(null);
  };

  const generateBrief = async (item) => {
    setBriefLoading(true);
    try {
      const response = await api.post("/ai/executive-brief", { source_type: selected?.type || "daily", item });
      setBrief(response.data);
    } finally {
      setBriefLoading(false);
    }
  };

  if (!report) return <div className="h-64 shimmer rounded-lg"></div>;

  const metrics = report.metrics || {};
  const today = new Date(report.generated_at).toLocaleDateString("ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div data-testid="daily-report-page" className="print:p-0" dir="rtl">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4 print:hidden">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">التقرير التنفيذي اليومي</div>
          <h1 className="font-heading text-4xl font-black mt-2 flex items-center gap-3"><FileText className="text-yellow-500"/> الموجز اليومي بالذكاء الاصطناعي</h1>
          <p className="text-slate-500 text-sm mt-1">{today}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-yellow-500/10 text-slate-300 hover:text-yellow-300 text-sm flex items-center gap-2">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""}/> تحديث
          </button>
          <button onClick={() => window.print()} className="px-5 py-2.5 rounded-lg bg-gradient-to-l from-yellow-500 to-yellow-600 text-black font-bold text-sm flex items-center gap-2">
            <Printer size={14}/> طباعة أو PDF
          </button>
        </div>
      </div>

      <div className="hidden print:block mb-6 text-center border-b pb-4">
        <div className="text-2xl font-bold">NEXGEN EXECUTIVES — التقرير التنفيذي اليومي</div>
        <div className="text-sm text-slate-500 mt-1">{today}</div>
        <div className="text-sm mt-1">مقدم إلى: {report.user?.name}</div>
      </div>

      <div className="print:hidden"><AICommandBar /></div>

      <div className="glass-card p-6 mb-5 border-yellow-500/30">
        <div className="flex items-center gap-2 mb-3">
          <div className="px-2 py-1 rounded bg-yellow-500/15 text-yellow-300 text-[10px] tracking-wider">إحاطة ذكية</div>
          <span className="text-sm text-slate-400">موجز تنفيذي عربي مهيأ لـGemini</span>
        </div>
        <p className="text-lg text-slate-100 leading-loose font-heading whitespace-pre-wrap">{report.ai_summary}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat icon={<TrendingUp/>} label="إجمالي المشروعات" value={metrics.total_projects} sub={`${metrics.active_projects} نشط`} onClick={() => openDetail("daily", report.metrics, "مؤشرات اليوم")} />
        <Stat icon={<AlertTriangle/>} label="المشروعات الحرجة" value={metrics.critical_projects} accent="red" onClick={() => openDetail("project", { critical_projects: report.critical_projects }, "المشروعات الحرجة")} />
        <Stat icon={<ClipboardList/>} label="المهام المتأخرة" value={metrics.overdue_tasks} accent="amber" onClick={() => openDetail("task", { overdue_tasks: report.overdue_tasks }, "المهام المتأخرة")} />
        <Stat icon={<CalIcon/>} label="اجتماعات اليوم" value={metrics.today_meetings} onClick={() => openDetail("meeting", { today_meetings: report.today_meetings }, "اجتماعات اليوم")} />
        <Stat icon={<CalIcon/>} label="الطلبات المعلقة" value={metrics.pending_requests} onClick={() => openDetail("meeting_request", { pending_requests: report.pending_requests }, "طلبات الاجتماعات المعلقة")} />
        <Stat icon={<Mic/>} label="التوجيهات الصوتية" value={metrics.pending_voice_directives} onClick={() => openDetail("daily", { pending_voice_directives: report.pending_voice_directives }, "التوجيهات الصوتية")} />
        <Stat icon={<TrendingUp/>} label="متوسط الإنجاز" value={`${metrics.avg_progress}%`} accent="green" onClick={() => openDetail("daily", { avg_progress: metrics.avg_progress }, "متوسط الإنجاز")} />
      </div>

      {(report.critical_projects || []).length > 0 && (
        <Section title="مشروعات حرجة تتطلب انتباهًا فوريًا" icon={<AlertTriangle className="text-rose-400"/>}>
          {report.critical_projects.map((project) => (
            <div key={project.id} onClick={() => openDetail("project", project, project.name)} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-rose-500/10 cursor-pointer hover:bg-white/[0.05]">
              <div>
                <div className="font-medium text-slate-100">{project.name}</div>
                <div className="text-xs text-slate-500">{SECTOR_LABELS[project.sector]} • الإنجاز {project.progress}%</div>
              </div>
              <RAGBadge rag={project.rag}/>
            </div>
          ))}
        </Section>
      )}

      {(report.today_meetings || []).length > 0 && (
        <Section title="اجتماعات اليوم" icon={<CalIcon className="text-yellow-400"/>}>
          {report.today_meetings.map((meeting) => (
            <div key={meeting.id} onClick={() => openDetail("meeting", meeting, meeting.title)} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.05]">
              <div className="font-medium text-slate-100">{meeting.title}</div>
              <div className="text-xs text-slate-500 mt-1">{new Date(meeting.date).toLocaleTimeString("ar", {timeStyle: "short"})} • {meeting.duration_minutes} دقيقة</div>
            </div>
          ))}
        </Section>
      )}

      {(report.overdue_tasks || []).length > 0 && (
        <Section title="المهام المتأخرة" icon={<ClipboardList className="text-amber-400"/>}>
          {report.overdue_tasks.map((task) => (
            <div key={task.id} onClick={() => openDetail("task", task, task.title)} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-amber-500/10 cursor-pointer hover:bg-white/[0.05]">
              <div>
                <div className="font-medium text-slate-100">{task.title}</div>
                <div className="text-xs text-slate-500">الاستحقاق: {new Date(task.due_date).toLocaleDateString("ar")} • {PRIORITY_LABELS[task.priority]}</div>
              </div>
              <span className="text-amber-400 tabular-nums text-sm">{task.progress}%</span>
            </div>
          ))}
        </Section>
      )}

      {(report.pending_requests || []).length > 0 && (
        <Section title="طلبات اجتماعات تنتظر قرارًا" icon={<CalIcon className="text-sky-400"/>}>
          {report.pending_requests.map((request) => (
            <div key={request.id} onClick={() => openDetail("meeting_request", request, request.subject)} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.05]">
              <div className="font-medium text-slate-100">{request.subject}</div>
              <div className="text-xs text-slate-500 mt-1">مقدم الطلب: {request.requester_name} • المقترح: {new Date(request.proposed_date).toLocaleDateString("ar")}</div>
            </div>
          ))}
        </Section>
      )}

      {(report.pending_voice_directives || []).length > 0 && (
        <Section title="التوجيهات الصوتية المعلقة" icon={<Mic className="text-violet-400"/>}>
          {report.pending_voice_directives.map((directive) => (
            <div key={directive.id} onClick={() => openDetail("daily", directive, "توجيه صوتي")} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer hover:bg-white/[0.05]">
              <div className="text-sm text-slate-100">{directive.summary || (directive.transcript || "").slice(0, 100)}</div>
              <div className="text-xs text-slate-500 mt-1">{(directive.suggested_tasks || []).length} مهمة مقترحة • {new Date(directive.created_at).toLocaleDateString("ar")}</div>
            </div>
          ))}
        </Section>
      )}

      {selected && <DetailModal item={selected.item} title={selected.title} type={selected.type} onClose={() => setSelected(null)} onGenerateBrief={generateBrief} brief={brief} loadingBrief={briefLoading} />}
    </div>
  );
}

function Stat({ icon, label, value, sub, accent, onClick }) {
  const colors = { red: "text-rose-400", amber: "text-amber-400", green: "text-emerald-400" };
  return (
    <div onClick={onClick} role={onClick ? "button" : undefined} className={`glass-card p-4 ${onClick ? "cursor-pointer hover:border-yellow-500/25 hover:bg-white/[0.03]" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] tracking-wider text-slate-500">{label}</div>
        <div className={`text-slate-500 ${colors[accent] || ""}`}>{icon}</div>
      </div>
      <div className={`mt-2 text-2xl font-heading font-bold tabular-nums ${colors[accent] || "text-slate-100"}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="glass-card p-5 mb-4">
      <h3 className="font-heading text-lg font-bold mb-4 flex items-center gap-2">{icon} {title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
