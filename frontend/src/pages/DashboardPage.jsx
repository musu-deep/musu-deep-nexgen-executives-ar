import React, { useEffect, useState } from "react";
import api, { SECTOR_LABELS, STATUS_LABELS } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import KPICard from "../components/KPICard";
import RAGBadge from "../components/RAGBadge";
import AICommandBar from "../components/AICommandBar";
import ExecutiveIntelligenceCenter from "../components/ExecutiveIntelligenceCenter";
import AIWorkforceStatus from "../components/AIWorkforceStatus";
import DetailModal from "../components/DetailModal";
import { Link } from "react-router-dom";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, AreaChart, Area,
} from "recharts";
import { FolderKanban, ListChecks, AlertTriangle, TrendingUp, DollarSign, Layers, ArrowLeft } from "lucide-react";

const RAG_COLORS = { red: "#fb7185", amber: "#fbbf24", green: "#34d399", gray: "#64748b" };
const SECTOR_COLORS = ["#D4AF37", "#34d399", "#60a5fa", "#fbbf24", "#a78bfa", "#fb7185"];
const RAG_LABELS = { green: "سليم", amber: "تحت المراقبة", red: "حرج", gray: "غير مصنف" };

function formatNumber(value) {
  return new Intl.NumberFormat("ar").format(value || 0);
}

function Header({ user }) {
  return (
    <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
      <div>
        <div className="text-xs tracking-[0.12em] text-yellow-500/80 font-semibold">لوحة القيادة التنفيذية</div>
        <h1 className="font-heading text-4xl font-black text-slate-50 mt-2">مرحبًا، {user?.name}</h1>
        <p className="text-slate-500 mt-1">رؤية لحظية شاملة لأداء المجموعة ومسارات التنفيذ</p>
      </div>
      <div className="text-xs text-slate-500 tabular-nums">
        {new Date().toLocaleDateString("ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);

  useEffect(() => {
    api.get("/dashboard").then((response) => setData(response.data)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="h-24 shimmer rounded-lg mb-6"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">{[1,2,3,4,5,6].map((item) => <div key={item} className="h-32 shimmer rounded-lg"></div>)}</div>
      </div>
    );
  }
  if (!data) return <div className="glass-card p-10 text-center text-slate-500">تعذر تحميل بيانات لوحة القيادة</div>;

  const openDetail = (type, item, title) => {
    setSelected({ type, item, title });
    setBrief(null);
  };

  const generateBrief = async (item) => {
    setBriefLoading(true);
    try {
      const response = await api.post("/ai/executive-brief", { source_type: selected?.type || "dashboard", item });
      setBrief(response.data);
    } finally {
      setBriefLoading(false);
    }
  };

  const ragData = Object.entries(data.rag || {}).map(([key, value]) => ({ name: RAG_LABELS[key] || key, value, color: RAG_COLORS[key] }));
  const sectorData = (data.by_sector || []).map((sector, index) => ({
    name: SECTOR_LABELS[sector.sector] || sector.sector,
    value: sector.count,
    progress: sector.avg_progress,
    fill: SECTOR_COLORS[index % SECTOR_COLORS.length],
  }));
  const taskStatusData = Object.entries(data.task_status || {}).map(([key, value]) => ({ name: STATUS_LABELS[key] || key, value }));
  const totals = data.totals || {};

  return (
    <div data-testid="dashboard-page" dir="rtl">
      <Header user={user} />
      <AICommandBar />
      <ExecutiveIntelligenceCenter onSelectRisk={(risk) => openDetail("risk", risk, risk.title)} />
      <AIWorkforceStatus />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <KPICard testId="kpi-total-projects" label="إجمالي المشروعات" value={formatNumber(totals.projects)} sublabel={`${formatNumber(totals.active_projects)} نشط`} icon={<FolderKanban size={20}/>} accent="gold" onClick={() => openDetail("dashboard", totals, "إجماليات لوحة القيادة")} />
        <KPICard testId="kpi-active-projects" label="المشروعات النشطة" value={formatNumber(totals.active_projects)} icon={<Layers size={20}/>} accent="green" onClick={() => openDetail("dashboard", { active_projects: totals.active_projects, recent_projects: data.recent_projects }, "المشروعات النشطة")} />
        <KPICard testId="kpi-tasks" label="إجمالي المهام" value={formatNumber(totals.tasks)} icon={<ListChecks size={20}/>} onClick={() => openDetail("dashboard", { tasks: totals.tasks, task_status: data.task_status }, "نظرة عامة على حالات المهام")} />
        <KPICard testId="kpi-overdue" label="المهام المتأخرة" value={formatNumber(totals.overdue_tasks)} accent="red" icon={<AlertTriangle size={20}/>} onClick={() => openDetail("risk", { overdue_tasks: totals.overdue_tasks, recommendation: "راجع مسارات التنفيذ المتأخرة فورًا." }, "مخاطر المهام المتأخرة")} />
        <KPICard testId="kpi-progress" label="متوسط الإنجاز" value={`${totals.avg_progress}%`} accent="amber" icon={<TrendingUp size={20}/>} onClick={() => openDetail("dashboard", { avg_progress: totals.avg_progress, by_sector: data.by_sector }, "تحليل متوسط الإنجاز")} />
        <KPICard testId="kpi-budget" label="إجمالي الميزانية" value={formatNumber(Math.round(totals.total_budget || 0))} sublabel="القيمة المسجلة" icon={<DollarSign size={20}/>} onClick={() => openDetail("dashboard", { total_budget: totals.total_budget }, "نظرة عامة على الميزانية")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="glass-card p-6" data-testid="chart-rag">
          <div className="mb-4">
            <div className="text-xs tracking-wider text-slate-500">صحة المشروعات</div>
            <h3 className="font-heading text-lg font-bold mt-1">مؤشر حالة الأداء</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={ragData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                {ragData.map((entry, index) => <Cell key={index} fill={entry.color} stroke="none" />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#111622", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, direction: "rtl" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-around mt-3 text-xs">
            {["green", "amber", "red"].map((key) => (
              <div key={key} className="text-center">
                <div className="text-2xl font-heading font-bold tabular-nums" style={{color: RAG_COLORS[key]}}>{data.rag?.[key] || 0}</div>
                <div className="text-slate-500">{RAG_LABELS[key]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 lg:col-span-2" data-testid="chart-sectors">
          <div className="mb-4">
            <div className="text-xs tracking-wider text-slate-500">القطاعات</div>
            <h3 className="font-heading text-lg font-bold mt-1">المشروعات حسب القطاع</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={sectorData} margin={{ right: 20, left: 20, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#111622", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, direction: "rtl" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} name="عدد المشروعات">
                {sectorData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="glass-card p-6">
          <div className="text-xs tracking-wider text-slate-500 mb-1">المهام</div>
          <h3 className="font-heading text-lg font-bold mb-4">حالات المهام</h3>
          <div className="space-y-3">
            {taskStatusData.map((status, index) => {
              const total = taskStatusData.reduce((sum, item) => sum + item.value, 0) || 1;
              const percentage = Math.round((status.value / total) * 100);
              return (
                <div key={index}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300">{status.name}</span>
                    <span className="text-slate-500 tabular-nums">{status.value} • {percentage}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-l from-yellow-400 to-yellow-600" style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-card p-6 lg:col-span-2">
          <div className="text-xs tracking-wider text-slate-500 mb-1">متوسط الإنجاز</div>
          <h3 className="font-heading text-lg font-bold mb-4">معدل الإنجاز حسب القطاع</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={sectorData}>
              <defs>
                <linearGradient id="gradGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.6}/>
                  <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }}/>
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} domain={[0, 100]}/>
              <Tooltip contentStyle={{ background: "#111622", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, direction: "rtl" }} formatter={(value) => `${value}%`} />
              <Area type="monotone" dataKey="progress" stroke="#D4AF37" fill="url(#gradGold)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card p-6" data-testid="recent-projects">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs tracking-wider text-slate-500">آخر التحديثات</div>
            <h3 className="font-heading text-lg font-bold mt-1">المشروعات النشطة</h3>
          </div>
          <Link to="/projects" className="text-xs text-yellow-500 hover:text-yellow-400 flex items-center gap-1">عرض الكل <ArrowLeft size={14} /></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="text-[11px] text-slate-500 border-b border-white/5">
                <th className="py-3 font-semibold">المشروع</th>
                <th className="py-3 font-semibold">القطاع</th>
                <th className="py-3 font-semibold">الحالة</th>
                <th className="py-3 font-semibold">نسبة الإنجاز</th>
                <th className="py-3 font-semibold">المؤشر</th>
              </tr>
            </thead>
            <tbody>
              {(data.recent_projects || []).map((project) => (
                <tr key={project.id} onClick={() => openDetail("project", project, project.name)} className="border-b border-white/5 hover:bg-white/[0.04] cursor-pointer">
                  <td className="py-4"><Link to={`/projects/${project.id}`} className="text-slate-100 hover:text-yellow-400 font-medium">{project.name}</Link></td>
                  <td className="py-4 text-slate-400 text-xs">{SECTOR_LABELS[project.sector]}</td>
                  <td className="py-4 text-slate-400 text-xs">{STATUS_LABELS[project.status]}</td>
                  <td className="py-4 w-40">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-l from-yellow-400 to-yellow-600" style={{width: `${project.progress}%`}}></div>
                      </div>
                      <span className="text-xs tabular-nums text-slate-300">{project.progress}%</span>
                    </div>
                  </td>
                  <td className="py-4"><RAGBadge rag={project.rag} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <DetailModal item={selected.item} title={selected.title} type={selected.type} onClose={() => setSelected(null)} onGenerateBrief={generateBrief} brief={brief} loadingBrief={briefLoading} />}
    </div>
  );
}
