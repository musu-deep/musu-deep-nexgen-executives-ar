import React, { useEffect, useState } from "react";
import api, { SECTOR_LABELS, STATUS_LABELS } from "../lib/api";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar,
} from "recharts";

const COLORS = ["#D4AF37", "#34d399", "#60a5fa", "#fbbf24", "#a78bfa", "#fb7185"];
const formatNumber = (value) => new Intl.NumberFormat("ar").format(value || 0);

export default function ReportsPage() {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    Promise.all([api.get("/projects"), api.get("/tasks")]).then(([projectResponse, taskResponse]) => {
      setProjects(projectResponse.data);
      setTasks(taskResponse.data);
    });
  }, []);

  const sectorAggregation = {};
  projects.forEach((project) => {
    const sector = project.sector;
    sectorAggregation[sector] = sectorAggregation[sector] || { sector, count: 0, progress: 0, budget: 0, completed: 0 };
    sectorAggregation[sector].count += 1;
    sectorAggregation[sector].progress += project.progress || 0;
    sectorAggregation[sector].budget += project.budget || 0;
    if (project.status === "completed") sectorAggregation[sector].completed += 1;
  });

  const sectorData = Object.values(sectorAggregation).map((sector) => ({
    ...sector,
    name: SECTOR_LABELS[sector.sector] || sector.sector,
    avgProgress: Math.round(sector.progress / Math.max(sector.count, 1)),
    completionRate: Math.round((sector.completed / Math.max(sector.count, 1)) * 100),
  }));

  const radarData = sectorData.map((sector) => ({
    subject: sector.name,
    progress: sector.avgProgress,
    completion: sector.completionRate,
  }));

  const statusData = ["planning", "active", "on_hold", "completed", "cancelled"].map((status) => ({
    name: STATUS_LABELS[status] || status,
    value: projects.filter((project) => project.status === status).length,
  }));

  const totalProjects = projects.length;
  const activeProjects = projects.filter((project) => project.status === "active").length;
  const averageProgress = totalProjects === 0 ? 0 : Math.round(projects.reduce((sum, project) => sum + (project.progress || 0), 0) / totalProjects);
  const totalBudget = projects.reduce((sum, project) => sum + (project.budget || 0), 0);
  const criticalProjects = projects.filter((project) => project.priority === "critical" || project.rag === "red").length;
  const overdueTasks = tasks.filter((task) => task.status === "delayed").length;

  const tooltipStyle = {
    background: "#111622",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    direction: "rtl",
  };

  return (
    <div data-testid="reports-page" dir="rtl">
      <div className="mb-7">
        <div className="text-xs tracking-[0.12em] text-yellow-500/80">التقارير والتحليلات</div>
        <h1 className="font-heading text-4xl font-black mt-2">التحليلات التنفيذية</h1>
        <p className="text-slate-500 text-sm mt-1">رؤى عملية تدعم القرارات الاستراتيجية للقيادة التنفيذية</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <KPI label="إجمالي المشروعات" value={totalProjects} />
        <KPI label="المشروعات النشطة" value={activeProjects} />
        <KPI label="متوسط الإنجاز" value={`${averageProgress}%`} />
        <KPI label="إجمالي الميزانية" value={formatNumber(totalBudget)} />
        <KPI label="المهام المتأخرة" value={overdueTasks} />
      </div>

      <div className="glass-card p-5 mb-5 border-yellow-500/20">
        <div className="text-[10px] tracking-[0.12em] text-yellow-400 mb-2">رؤية تنفيذية ذكية</div>
        <p className="text-sm text-slate-300 leading-relaxed">
          تُظهر تحليلات المحفظة وجود {activeProjects} مشروعًا نشطًا بمتوسط إنجاز يبلغ {averageProgress}%. ويوجد {criticalProjects} مشروعًا حرجًا و{overdueTasks} مهمة متأخرة تتطلب متابعة تنفيذية. يُوصى بمراجعة توزيع الميزانية وأداء القطاعات قبل دورة القرار التنفيذي التالية.
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

        <ChartCard title="الميزانية حسب القطاع" subtitle="توزيع إجمالي الميزانية عبر القطاعات">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={sectorData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2} dataKey="budget" nameKey="name" label={(entry) => entry.name} labelLine={false}>
                {sectorData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="none" />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatNumber(value)} />
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
