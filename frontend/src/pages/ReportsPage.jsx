import React, { useEffect, useMemo, useState } from "react";
import api, { SECTOR_LABELS, STATUS_LABELS } from "../lib/api";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar,
} from "recharts";
import { Database, RefreshCw } from "lucide-react";

const COLORS = ["#D4AF37", "#34d399", "#60a5fa", "#fbbf24", "#a78bfa", "#fb7185"];
const formatNumber = (value) => new Intl.NumberFormat("ar").format(value || 0);
const asArray = (payload, key) => Array.isArray(payload) ? payload : (Array.isArray(payload?.[key]) ? payload[key] : []);

export default function ReportsPage() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceCount, setSourceCount] = useState(0);

  const load = async () => {
    setLoading(true);
    const sources = [
      { key: "projects", call: api.get("/projects") },
      { key: "tasks", call: api.get("/tasks") },
      { key: "employees", call: api.get("/employees") },
      { key: "meetings", call: api.get("/office/meetings") },
      { key: "documents", call: api.get("/documents") },
      { key: "requests", call: api.get("/araak-ceo/meeting-requests") },
      { key: "messages", call: api.get("/araak-ceo/messages") },
    ];
    const settled = await Promise.allSettled(sources.map((source) => source.call));
    let successful = 0;
    settled.forEach((result, index) => {
      const key = sources[index].key;
      if (result.status !== "fulfilled") return;
      successful += 1;
      const payload = result.value?.data;
      if (key === "projects") setProjects(asArray(payload, "projects"));
      if (key === "tasks") setTasks(asArray(payload, "tasks"));
      if (key === "employees") setEmployees(asArray(payload, "employees"));
      if (key === "meetings") setMeetings(asArray(payload, "meetings"));
      if (key === "documents") setDocuments(asArray(payload, "documents"));
      if (key === "requests") setRequests(asArray(payload, "requests"));
      if (key === "messages") setMessages(asArray(payload, "messages"));
    });
    setSourceCount(successful);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sectorData = useMemo(() => {
    const sectorAggregation = {};
    projects.forEach((project) => {
      const sector = project.sector || "corporate";
      sectorAggregation[sector] = sectorAggregation[sector] || { sector, count: 0, progress: 0, budget: 0, completed: 0 };
      sectorAggregation[sector].count += 1;
      sectorAggregation[sector].progress += Number(project.progress || 0);
      sectorAggregation[sector].budget += Number(project.budget || 0);
      if (project.status === "completed") sectorAggregation[sector].completed += 1;
    });
    return Object.values(sectorAggregation).map((sector) => ({
      ...sector,
      name: SECTOR_LABELS[sector.sector] || sector.sector,
      avgProgress: Math.round(sector.progress / Math.max(sector.count, 1)),
      completionRate: Math.round((sector.completed / Math.max(sector.count, 1)) * 100),
    }));
  }, [projects]);

  const radarData = sectorData.map((sector) => ({
    subject: sector.name,
    progress: sector.avgProgress,
    completion: sector.completionRate,
  }));

  const statusData = ["planning", "active", "on_hold", "completed", "cancelled"].map((status) => ({
    name: STATUS_LABELS[status] || status,
    value: projects.filter((project) => project.status === status).length,
  }));

  const now = new Date();
  const totalProjects = projects.length;
  const activeProjects = projects.filter((project) => project.status === "active").length;
  const averageProgress = totalProjects === 0 ? 0 : Math.round(projects.reduce((sum, project) => sum + Number(project.progress || 0), 0) / totalProjects);
  const totalBudget = projects.reduce((sum, project) => sum + Number(project.budget || 0), 0);
  const criticalProjects = projects.filter((project) => project.priority === "critical" || project.rag === "red").length;
  const overdueTasks = tasks.filter((task) => task.status === "delayed").length;
  const activeEmployees = employees.filter((employee) => employee.active !== false).length;
  const upcomingMeetings = meetings.filter((meeting) => meeting.date && new Date(meeting.date) >= now && meeting.status !== "cancelled").length;
  const pendingRequests = requests.filter((request) => request.status === "pending").length;
  const persistentMessages = messages.filter((message) => message.source === "araak_ceo_odoo").length;
  const pieDataKey = totalBudget > 0 ? "budget" : "count";
  const pieTitle = totalBudget > 0 ? "الميزانية حسب القطاع" : "توزيع المشروعات حسب القطاع";
  const pieSubtitle = totalBudget > 0 ? "توزيع إجمالي الميزانية عبر القطاعات" : "يُستخدم عدد المشروعات حتى اكتمال بيانات الميزانية في Odoo";

  const tooltipStyle = {
    background: "#111622",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    direction: "rtl",
  };

  return (
    <div data-testid="reports-page" dir="rtl">
      <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">التقارير والتحليلات • ARAAK CEO</div>
          <h1 className="font-heading text-4xl font-black mt-2">التحليلات التنفيذية المتكاملة</h1>
          <p className="text-slate-500 text-sm mt-1">تجميع لحظي من Odoo ومسارات القرار والاتصالات في ARAAK CEO</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs font-bold flex items-center gap-2"><Database size={14}/>{sourceCount}/7 مصادر فاعلة</span>
          <button onClick={load} className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-yellow-300 flex items-center gap-2"><RefreshCw size={16}/> تحديث التقرير</button>
        </div>
      </div>

      {loading && <div className="glass-card p-4 mb-5 text-sm text-slate-400">جارٍ تجميع التقرير التنفيذي من المصادر التشغيلية...</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-5">
        <KPI label="إجمالي المشروعات" value={totalProjects} />
        <KPI label="متوسط الإنجاز" value={`${averageProgress}%`} />
        <KPI label="المهام المتأخرة" value={overdueTasks} />
        <KPI label="الموظفون النشطون" value={activeEmployees} />
        <KPI label="الاجتماعات القادمة" value={upcomingMeetings} />
        <KPI label="طلبات تنتظر القرار" value={pendingRequests} />
        <KPI label="المستندات المؤسسية" value={documents.length} />
        <KPI label="مراسلات محفوظة" value={persistentMessages || messages.length} />
      </div>

      <div className="glass-card p-5 mb-5 border-yellow-500/20">
        <div className="text-[10px] tracking-[0.12em] text-yellow-400 mb-2">رؤية تنفيذية موحدة</div>
        <p className="text-sm text-slate-300 leading-relaxed">
          تعرض ARAAK CEO حاليًا {activeProjects} مشروعًا نشطًا بمتوسط إنجاز {averageProgress}%، و{criticalProjects} مشروعًا حرجًا، و{overdueTasks} مهمة متأخرة. كما توجد {pendingRequests} طلبات اجتماعات تنتظر القرار، و{upcomingMeetings} اجتماعات قادمة، و{activeEmployees} موظفًا نشطًا في دليل Odoo. الأولوية التنفيذية هي إغلاق المهام المتأخرة، ثم تحويل الطلبات المنتظرة إلى قرارات ومواعيد، وربط المراسلات الحرجة بمهام متابعة في Odoo.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <ChartCard title="مصفوفة أداء القطاعات" subtitle="التقدم ومعدل الإكمال عبر القطاعات الاستراتيجية">
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fill: "#94a3b8", fontSize: 10 }} domain={[0, 100]} />
              <Radar name="متوسط الإنجاز" dataKey="progress" stroke="#D4AF37" fill="#D4AF37" fillOpacity={0.3} />
              <Radar name="معدل الإكمال" dataKey="completion" stroke="#34d399" fill="#34d399" fillOpacity={0.2} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={pieTitle} subtitle={pieSubtitle}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={sectorData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2} dataKey={pieDataKey} nameKey="name" label={(entry) => entry.name} labelLine={false}>
                {sectorData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="none" />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => pieDataKey === "budget" ? formatNumber(value) : value} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="glass-card p-6 lg:col-span-2">
          <h3 className="font-heading text-lg font-bold mb-1">التقدم مقابل الإكمال</h3>
          <p className="text-xs text-slate-500 mb-4">مقارنة القطاعات بحسب متوسط الإنجاز ومعدل الإكمال</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sectorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${value}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="avgProgress" name="متوسط الإنجاز" fill="#D4AF37" radius={[6, 6, 0, 0]} />
              <Bar dataKey="completionRate" name="معدل الإكمال" fill="#34d399" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6">
          <h3 className="font-heading text-lg font-bold mb-1">حالات المشروعات</h3>
          <p className="text-xs text-slate-500 mb-4">التوزيع الحالي حسب دورة حياة المشروع</p>
          <div className="space-y-3 mt-6">
            {statusData.map((status, index) => {
              const total = statusData.reduce((sum, item) => sum + item.value, 0) || 1;
              const percentage = Math.round((status.value / total) * 100);
              return (
                <div key={index}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300">{status.name}</span>
                    <span className="text-slate-500 tabular-nums">{status.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${percentage}%`, background: COLORS[index] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="font-heading text-lg font-bold mb-4">ملخص أداء القطاعات</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="text-[11px] text-slate-500 border-b border-white/5">
                <th className="py-3 font-semibold">القطاع</th>
                <th className="py-3 font-semibold">عدد المشروعات</th>
                <th className="py-3 font-semibold">متوسط الإنجاز</th>
                <th className="py-3 font-semibold">الميزانية</th>
                <th className="py-3 font-semibold">معدل الإكمال</th>
              </tr>
            </thead>
            <tbody>
              {sectorData.map((sector) => (
                <tr key={sector.sector} className="border-b border-white/5">
                  <td className="py-4 text-slate-100 font-medium">{sector.name}</td>
                  <td className="py-4 tabular-nums text-slate-300">{sector.count}</td>
                  <td className="py-4 tabular-nums text-yellow-400">{sector.avgProgress}%</td>
                  <td className="py-4 tabular-nums text-slate-300">{formatNumber(sector.budget)}</td>
                  <td className="py-4 tabular-nums text-emerald-400">{sector.completionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value }) {
  return (
    <div className="glass-card p-4">
      <div className="text-[10px] tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-heading font-bold text-slate-100 tabular-nums">{value}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="glass-card p-6">
      <h3 className="font-heading text-lg font-bold mb-1">{title}</h3>
      <p className="text-xs text-slate-500 mb-4">{subtitle}</p>
      {children}
    </div>
  );
}
