import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, BriefcaseBusiness, Building2, CalendarDays, Database,
  FileWarning, MapPin, RefreshCw, UserCheck, UserCog, Users,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import api from "../lib/api";
import KPICard from "./KPICard";
import DetailModal from "./DetailModal";
import AICommandBar from "./AICommandBar";

const CHART_COLORS = ["#D4AF37", "#34d399", "#60a5fa", "#fbbf24", "#a78bfa", "#fb7185"];

function formatNumber(value) {
  return new Intl.NumberFormat("ar").format(Number(value || 0));
}

function isPresent(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function percentage(value, total) {
  return Math.round((Number(value || 0) / Math.max(Number(total || 0), 1)) * 100);
}

function formatDate(value) {
  if (!value) return "غير محدد";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" });
}

export function isHumanResourcesUser(user) {
  const text = [user?.email, user?.title, user?.department, user?.name].filter(Boolean).join(" ").toLowerCase();
  return String(user?.email || "").trim().toLowerCase() === "hr@company.demo"
    || text.includes("الموارد البشرية")
    || text.includes("human resources");
}

export default function HRExecutiveDashboard({ user }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get("/hr/overview");
      setOverview(response.data || null);
    } catch {
      setOverview(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const employees = overview?.employees || [];
  const totals = overview?.totals || {};
  const activeEmployees = employees.filter((employee) => employee.active !== false);

  const derived = useMemo(() => {
    const jobs = new Set(activeEmployees.map((employee) => employee.title || employee.job_title).filter(Boolean));
    const locations = new Set(activeEmployees.map((employee) => employee.location).filter(Boolean));
    const withManagers = activeEmployees.filter((employee) => isPresent(employee.manager)).length;
    const withContracts = activeEmployees.filter((employee) => employee.contract_id).length;
    const withoutContracts = Math.max(activeEmployees.length - withContracts, 0);
    const completeProfiles = activeEmployees.filter((employee) => (
      isPresent(employee.name)
      && isPresent(employee.email || employee.work_email)
      && isPresent(employee.title || employee.job_title)
      && isPresent(employee.department)
      && isPresent(employee.location)
      && isPresent(employee.hire_date)
    )).length;
    const missingLocation = activeEmployees.filter((employee) => !isPresent(employee.location)).length;
    const missingManager = activeEmployees.filter((employee) => !isPresent(employee.manager)).length;
    const missingEmail = activeEmployees.filter((employee) => !isPresent(employee.email || employee.work_email)).length;

    return {
      jobs: jobs.size,
      locations: locations.size,
      withManagers,
      withContracts,
      withoutContracts,
      completeProfiles,
      missingLocation,
      missingManager,
      missingEmail,
      hierarchyCoverage: percentage(withManagers, activeEmployees.length),
      contractCoverage: percentage(withContracts, activeEmployees.length),
      profileCompleteness: percentage(completeProfiles, activeEmployees.length),
    };
  }, [activeEmployees]);

  const departmentData = (overview?.departments || []).slice(0, 10).map((item, index) => ({
    name: item.department,
    count: item.count,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  const recentEmployees = [...activeEmployees]
    .sort((left, right) => new Date(right.updated_at || right.created_at || 0) - new Date(left.updated_at || left.created_at || 0))
    .slice(0, 8);

  const openDetail = (title, item, type = "human_resources") => setSelected({ title, item, type });

  if (loading) {
    return (
      <div dir="rtl">
        <div className="h-28 shimmer rounded-xl mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-28 shimmer rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="hr-executive-dashboard" dir="rtl">
      <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80 font-semibold">الملخص التنفيذي للموارد البشرية • ARAAK CEO</div>
          <h1 className="font-heading text-4xl font-black text-slate-50 mt-2">مرحبًا، {user?.name}</h1>
          <p className="text-slate-500 mt-1">رؤية تشغيلية للقوى العاملة والهيكل والوظائف وجاهزية الملفات الوظيفية</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 ${overview?.source === "odoo" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>
            <Database size={14} /> {overview?.source === "odoo" ? "Odoo مباشر" : "بيانات احتياطية"}
          </span>
          <button onClick={load} className="px-4 py-2.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-yellow-300 flex items-center gap-2">
            <RefreshCw size={16} /> تحديث
          </button>
          <Link to="/hr" className="px-4 py-2.5 rounded-lg bg-yellow-500 text-black font-bold flex items-center gap-2">
            فتح الموارد البشرية <ArrowLeft size={15} />
          </Link>
        </div>
      </div>

      {overview?.warning && (
        <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-6 text-amber-200">
          تعذر الوصول الكامل إلى بيانات Odoo؛ عُرضت البيانات الاحتياطية المتاحة. التفاصيل التقنية: {overview.warning}
        </div>
      )}

      {!overview ? (
        <div className="glass-card p-10 text-center">
          <FileWarning className="mx-auto text-amber-400 mb-3" size={34} />
          <h2 className="font-heading text-xl font-bold">تعذر تحميل ملخص الموارد البشرية</h2>
          <p className="text-sm text-slate-500 mt-2">الملخص الوظيفي مستقل عن بيانات المشروعات، لكنه يحتاج وصول مسار الموارد البشرية إلى Odoo أو البيانات الاحتياطية.</p>
          <button onClick={load} className="mt-5 px-5 py-2.5 rounded-lg bg-yellow-500 text-black font-bold">إعادة المحاولة</button>
        </div>
      ) : (
        <>
          <AICommandBar />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <KPICard label="إجمالي الموظفين" value={formatNumber(totals.employees)} sublabel={`${formatNumber(totals.active_employees)} نشط`} icon={<Users size={20} />} accent="gold" onClick={() => openDetail("القوى العاملة المسجلة", { totals, employees: activeEmployees })} />
            <KPICard label="الموظفون النشطون" value={formatNumber(totals.active_employees)} sublabel={`${formatNumber(totals.inactive_employees)} غير نشط`} icon={<UserCheck size={20} />} accent="green" onClick={() => openDetail("حالة الموظفين", { active: totals.active_employees, inactive: totals.inactive_employees, employees })} />
            <KPICard label="الإدارات الممثلة" value={formatNumber(totals.departments)} sublabel="وفق الملفات النشطة" icon={<Building2 size={20} />} onClick={() => openDetail("توزيع الموظفين على الإدارات", { departments: overview.departments })} />
            <KPICard label="الوظائف المسجلة" value={formatNumber(derived.jobs)} sublabel="مسميات وظيفية نشطة" icon={<BriefcaseBusiness size={20} />} onClick={() => openDetail("المسميات الوظيفية", { jobs: [...new Set(activeEmployees.map((employee) => employee.title).filter(Boolean))] })} />
            <KPICard label="تغطية التسلسل الإداري" value={`${derived.hierarchyCoverage}%`} sublabel={`${formatNumber(derived.missingManager)} دون مدير مباشر`} icon={<UserCog size={20} />} accent={derived.missingManager ? "amber" : "green"} onClick={() => openDetail("جودة التسلسل الإداري", { coverage: derived.hierarchyCoverage, missing_manager: derived.missingManager, employees_without_manager: activeEmployees.filter((employee) => !employee.manager) })} />
            <KPICard label="ملفات بلا عقود" value={formatNumber(derived.withoutContracts)} sublabel={`${derived.contractCoverage}% تغطية تعاقدية`} icon={<FileWarning size={20} />} accent={derived.withoutContracts ? "red" : "green"} onClick={() => openDetail("جاهزية العقود", { contract_coverage: derived.contractCoverage, without_contracts: derived.withoutContracts, salary_note: overview.salary_note })} />
          </div>

          <div className="glass-card p-5 mb-6 border-yellow-500/20">
            <div className="text-[10px] tracking-[0.12em] text-yellow-400 mb-2">الخلاصة التنفيذية لمسؤول الموارد البشرية</div>
            <p className="text-sm text-slate-300 leading-7">
              تضم قاعدة القوى العاملة {formatNumber(totals.active_employees)} موظفًا نشطًا موزعين على {formatNumber(totals.departments)} إدارة ممثلة و{formatNumber(derived.jobs)} وظيفة و{formatNumber(derived.locations)} مواقع عمل. تبلغ اكتمالية الملفات الأساسية {derived.profileCompleteness}%، وتغطية التسلسل الإداري {derived.hierarchyCoverage}%. الأولوية الحالية هي استكمال {formatNumber(derived.withoutContracts)} ملفًا دون عقد تشغيلي، ومعالجة {formatNumber(derived.missingManager)} ملفًا دون مدير مباشر و{formatNumber(derived.missingLocation)} ملفًا دون موقع عمل.
            </p>
            {overview.salary_note && <p className="text-xs text-amber-300 mt-3">تنبيه مالي: {overview.salary_note}</p>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
            <div className="glass-card p-6 lg:col-span-2">
              <div className="text-xs tracking-wider text-slate-500">توزيع القوى العاملة</div>
              <h3 className="font-heading text-lg font-bold mt-1 mb-4">أكبر الإدارات حسب عدد الموظفين</h3>
              {departmentData.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={departmentData} layout="vertical" margin={{ right: 20, left: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={160} tick={{ fill: "#94a3b8", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#111622", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, direction: "rtl" }} />
                    <Bar dataKey="count" name="الموظفون" radius={[0, 6, 6, 0]}>
                      {departmentData.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-64 grid place-items-center text-sm text-slate-500">لا توجد بيانات إدارات قابلة للرسم</div>}
            </div>

            <div className="glass-card p-6">
              <div className="text-xs tracking-wider text-slate-500">جودة البيانات الوظيفية</div>
              <h3 className="font-heading text-lg font-bold mt-1 mb-5">مؤشرات الاكتمال</h3>
              <QualityRow label="اكتمال الملفات الأساسية" value={derived.profileCompleteness} />
              <QualityRow label="ربط المدير المباشر" value={derived.hierarchyCoverage} />
              <QualityRow label="التغطية التعاقدية" value={derived.contractCoverage} danger={derived.contractCoverage < 50} />
              <div className="mt-5 pt-4 border-t border-white/5 space-y-2 text-xs text-slate-400">
                <div className="flex justify-between"><span>ملفات بلا موقع عمل</span><b className="text-slate-200">{formatNumber(derived.missingLocation)}</b></div>
                <div className="flex justify-between"><span>ملفات بلا بريد وظيفي</span><b className="text-slate-200">{formatNumber(derived.missingEmail)}</b></div>
                <div className="flex justify-between"><span>مواقع العمل</span><b className="text-slate-200">{formatNumber(derived.locations)}</b></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
            <div className="glass-card p-6">
              <div className="text-xs tracking-wider text-slate-500">أولويات مسؤول الموارد البشرية</div>
              <h3 className="font-heading text-lg font-bold mt-1 mb-4">الإجراءات المقترحة</h3>
              <div className="space-y-3">
                <PriorityItem level={derived.withoutContracts ? "high" : "good"} title="استكمال العقود والبيانات التعاقدية" detail={`${formatNumber(derived.withoutContracts)} ملفًا يحتاج عقدًا أو سجلًا تعاقديًا معتمدًا.`} />
                <PriorityItem level={derived.missingManager ? "medium" : "good"} title="تثبيت التسلسل الإداري" detail={`${formatNumber(derived.missingManager)} ملفًا يحتاج تحديد المدير المباشر.`} />
                <PriorityItem level={(derived.missingLocation + derived.missingEmail) ? "medium" : "good"} title="تحسين اكتمال الملف الوظيفي" detail={`${formatNumber(derived.missingLocation + derived.missingEmail)} فجوة في الموقع أو البريد الوظيفي.`} />
              </div>
            </div>

            <div className="glass-card p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs tracking-wider text-slate-500">آخر الملفات تحديثًا</div>
                  <h3 className="font-heading text-lg font-bold mt-1">سجل الموظفين</h3>
                </div>
                <Link to="/hr" className="text-xs text-yellow-500 hover:text-yellow-400 flex items-center gap-1">عرض الكل <ArrowLeft size={14} /></Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead><tr className="text-[11px] text-slate-500 border-b border-white/5"><th className="py-3">الموظف</th><th className="py-3">الوظيفة</th><th className="py-3">الإدارة</th><th className="py-3">المدير</th><th className="py-3">تاريخ التعيين</th></tr></thead>
                  <tbody>
                    {recentEmployees.map((employee) => (
                      <tr key={employee.id} onClick={() => openDetail(employee.name, employee, "employee")} className="border-b border-white/5 hover:bg-white/[0.04] cursor-pointer">
                        <td className="py-4 font-medium text-slate-100">{employee.name}</td>
                        <td className="py-4 text-xs text-slate-400">{employee.title || "غير محدد"}</td>
                        <td className="py-4 text-xs text-slate-400">{employee.department || "غير محدد"}</td>
                        <td className="py-4 text-xs text-slate-400">{employee.manager || "—"}</td>
                        <td className="py-4 text-xs text-slate-400"><span className="inline-flex items-center gap-1"><CalendarDays size={12} />{formatDate(employee.hire_date)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {selected && <DetailModal item={selected.item} title={selected.title} type={selected.type} onClose={() => setSelected(null)} />}
    </div>
  );
}

function QualityRow({ label, value, danger = false }) {
  const fill = danger ? "from-rose-500 to-amber-500" : "from-emerald-400 to-yellow-500";
  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs mb-1.5"><span className="text-slate-300">{label}</span><span className="text-slate-400 tabular-nums">{value}%</span></div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden"><div className={`h-full rounded-full bg-gradient-to-l ${fill}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  );
}

function PriorityItem({ level, title, detail }) {
  const tones = {
    high: "border-rose-500/20 bg-rose-500/[0.06] text-rose-300",
    medium: "border-amber-500/20 bg-amber-500/[0.06] text-amber-300",
    good: "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300",
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[level] || tones.medium}`}>
      <div className="font-bold text-sm">{title}</div>
      <div className="text-xs text-slate-400 mt-1 leading-5">{detail}</div>
    </div>
  );
}
