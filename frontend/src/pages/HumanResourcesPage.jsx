import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgeDollarSign, BriefcaseBusiness, Building2, CalendarDays, EyeOff,
  RefreshCw, Search, ShieldCheck, UserRoundCheck, UsersRound, X,
} from "lucide-react";
import api from "../lib/api";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatNumber(value) {
  return new Intl.NumberFormat("ar", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "غير محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" });
}

function salaryLabel(employee) {
  const value = formatNumber(employee?.salary || 0);
  return employee?.salary_currency ? `${value} ${employee.salary_currency}` : value;
}

export default function HumanResourcesPage() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("الكل");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/hr/overview");
      setPayload(response.data || null);
      if (response.data?.warning) {
        toast.warning("تم عرض بيانات احتياطية لأن نموذج الموارد البشرية في Odoo لم يستجب.");
      }
    } catch (error) {
      setPayload(null);
      toast.error(error?.response?.data?.detail || "تعذر قراءة بيانات الموارد البشرية.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const employees = useMemo(() => asArray(payload?.employees), [payload]);
  const departments = useMemo(
    () => ["الكل", ...Array.from(new Set(employees.map((item) => item.department).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar"))],
    [employees],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesDepartment = department === "الكل" || employee.department === department;
      const text = `${employee.name} ${employee.title} ${employee.department} ${employee.email} ${employee.entity} ${employee.location}`.toLowerCase();
      return matchesDepartment && (!normalized || text.includes(normalized));
    });
  }, [employees, department, query]);

  if (loading) {
    return <div dir="rtl" className="space-y-5"><div className="h-32 shimmer rounded-2xl"/><div className="grid grid-cols-2 lg:grid-cols-5 gap-4">{[1,2,3,4,5].map((item) => <div key={item} className="h-28 shimmer rounded-2xl"/>)}</div><div className="h-80 shimmer rounded-2xl"/></div>;
  }

  const totals = payload?.totals || {};
  const compensationVisible = Boolean(payload?.compensation_visible);
  const sourceLabel = payload?.source === "odoo" ? "Odoo مباشر" : "قاعدة المنصة الاحتياطية";
  const maxDepartment = Math.max(1, ...asArray(payload?.departments).map((item) => Number(item.count || 0)));

  return (
    <div data-testid="human-resources-page" dir="rtl" className="space-y-6 pb-10">
      <section className="glass-card p-6 border-emerald-500/15 overflow-hidden relative">
        <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div>
            <div className="text-xs tracking-[0.14em] text-emerald-300/80">رأس المال البشري</div>
            <h1 className="font-heading text-4xl font-black mt-2 flex items-center gap-3"><UsersRound className="text-emerald-300"/> الموارد البشرية</h1>
            <p className="text-slate-500 text-sm mt-2 max-w-3xl leading-7">قراءة مباشرة للموظفين والإدارات والوظائف والتسلسل الإداري وبيانات العقود المخولة من Odoo.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-4 py-2.5 rounded-xl border text-xs font-bold ${payload?.source === "odoo" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>{sourceLabel}</span>
            <button type="button" onClick={loadData} className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:text-emerald-300 flex items-center gap-2 text-sm font-bold"><RefreshCw size={16}/> تحديث البيانات</button>
          </div>
        </div>
      </section>

      {payload?.warning && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-6 text-amber-200">تعذر الوصول إلى نموذج hr.employee في Odoo، لذلك عُرض دليل الحسابات المحلي مؤقتًا. بعد تشغيل سكربت الموارد البشرية سيصبح Odoo هو المصدر المباشر.</div>
      )}

      {compensationVisible && Number(totals.assumed_salary_records || 0) > 0 && (
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-4 py-3 text-xs leading-6 text-sky-200 flex items-start gap-2"><ShieldCheck size={16} className="mt-1 shrink-0"/><span>بيانات الرواتب الحالية افتراضية لبناء النموذج، وليست اعتمادًا ماليًا أو عقدًا نافذًا. تظهر فقط للحسابات المخولة.</span></div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Metric icon={<UsersRound size={18}/>} label="إجمالي الموظفين" value={formatNumber(totals.employees)} />
        <Metric icon={<UserRoundCheck size={18}/>} label="الموظفون النشطون" value={formatNumber(totals.active_employees)} tone="text-emerald-300" />
        <Metric icon={<Building2 size={18}/>} label="الإدارات" value={formatNumber(totals.departments)} />
        <Metric icon={<BriefcaseBusiness size={18}/>} label="المديرون المباشرون" value={formatNumber(totals.managers)} />
        <Metric
          icon={compensationVisible ? <BadgeDollarSign size={18}/> : <EyeOff size={18}/>}
          label={compensationVisible ? "الرواتب الشهرية التخطيطية" : "الرواتب"}
          value={compensationVisible ? formatNumber(totals.monthly_payroll) : "محجوب"}
          tone={compensationVisible ? "text-yellow-300" : "text-slate-500"}
        />
      </section>

      <section className="grid xl:grid-cols-3 gap-5">
        <div className="glass-card p-6 xl:col-span-2">
          <div className="flex items-center justify-between gap-4 mb-5"><div className="flex items-center gap-2"><Building2 size={19} className="text-emerald-300"/><h2 className="font-heading text-xl font-black">توزيع القوى العاملة حسب الإدارة</h2></div><span className="text-xs text-slate-600">{formatNumber(totals.departments)} إدارة</span></div>
          <div className="space-y-3">
            {asArray(payload?.departments).map((item) => (
              <button type="button" key={item.department} onClick={() => setDepartment(item.department)} className="w-full rounded-xl p-3 hover:bg-white/[0.035] text-right transition">
                <div className="flex justify-between text-sm mb-2"><span className="text-slate-300">{item.department}</span><strong className="text-emerald-300">{formatNumber(item.count)}</strong></div>
                <div className="h-2.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-emerald-700" style={{ width: `${Math.max(4, Number(item.count || 0) / maxDepartment * 100)}%` }}/></div>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-heading text-xl font-black">حماية بيانات التعويضات</h2>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${compensationVisible ? "bg-emerald-500/10 text-emerald-300" : "bg-slate-500/10 text-slate-400"}`}>{compensationVisible ? <ShieldCheck size={21}/> : <EyeOff size={21}/>}</div>
            <div className="font-bold text-slate-200 mt-4">{compensationVisible ? "صلاحية عرض الرواتب مفعلة" : "تفاصيل الرواتب محجوبة"}</div>
            <p className="text-xs text-slate-500 mt-2 leading-6">تُعرض التعويضات فقط للرئيس التنفيذي ومدير المنصة وحساب الموارد البشرية. تبويب فريق العمل لا يعرض أي بيانات مالية.</p>
          </div>
          {compensationVisible && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <SmallMetric label="متوسط الراتب" value={formatNumber(totals.average_salary)} />
              <SmallMetric label="سجلات افتراضية" value={formatNumber(totals.assumed_salary_records)} />
            </div>
          )}
        </div>
      </section>

      <section className="glass-card p-4 flex flex-col xl:flex-row xl:items-center gap-3 justify-between">
        <div className="relative flex-1 max-w-2xl">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو الوظيفة أو الإدارة أو الكيان..." className="w-full pr-10 pl-10 py-3 rounded-xl bg-black/20 border border-white/10 text-sm outline-none focus:border-emerald-500/35"/>
          {query && <button type="button" onClick={() => setQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X size={16}/></button>}
        </div>
        <select value={department} onChange={(event) => setDepartment(event.target.value)} className="min-w-64 px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-sm outline-none focus:border-emerald-500/35">
          {departments.map((item) => <option key={item} value={item}>{item === "الكل" ? "جميع الإدارات" : item}</option>)}
        </select>
      </section>

      <section className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between"><h2 className="font-heading text-xl font-black">سجل الموظفين</h2><span className="text-xs text-slate-500">{formatNumber(filtered.length)} سجل</span></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-white/[0.025] text-slate-500 text-xs"><tr><th className="text-right px-5 py-4">الموظف</th><th className="text-right px-4 py-4">الوظيفة</th><th className="text-right px-4 py-4">الإدارة</th><th className="text-right px-4 py-4">المدير المباشر</th><th className="text-right px-4 py-4">تاريخ التعيين</th><th className="text-right px-4 py-4">الموقع</th>{compensationVisible && <th className="text-right px-4 py-4">الراتب</th>}</tr></thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((employee) => (
                <tr key={employee.id || employee.email} className="hover:bg-white/[0.025]">
                  <td className="px-5 py-4"><div className="font-bold text-slate-100">{employee.name}</div><div dir="ltr" className="text-[11px] text-slate-600 text-right mt-1">{employee.email}</div></td>
                  <td className="px-4 py-4 text-slate-300">{employee.title || "غير محدد"}</td>
                  <td className="px-4 py-4 text-slate-400">{employee.department || "غير مصنف"}</td>
                  <td className="px-4 py-4 text-slate-400">{employee.manager || "—"}</td>
                  <td className="px-4 py-4 text-slate-400"><span className="flex items-center gap-1"><CalendarDays size={13}/>{formatDate(employee.hire_date)}</span></td>
                  <td className="px-4 py-4 text-slate-400">{employee.location || employee.entity || "—"}</td>
                  {compensationVisible && <td className="px-4 py-4"><div className="font-bold text-yellow-300">{salaryLabel(employee)}</div>{employee.salary_is_assumed && <div className="text-[10px] text-sky-400 mt-1">افتراضي</div>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-12 text-center text-slate-600">لا توجد سجلات مطابقة للبحث أو الإدارة المحددة.</div>}
      </section>
    </div>
  );
}

function Metric({ icon, label, value, tone = "text-slate-100" }) {
  return <div className="glass-card p-4"><div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center">{icon}</div><div className={`font-heading text-3xl font-black mt-4 ${tone}`}>{value ?? 0}</div><div className="text-xs text-slate-500 mt-2">{label}</div></div>;
}

function SmallMetric({ label, value }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="font-heading text-2xl font-black text-yellow-300">{value}</div><div className="text-[10px] text-slate-600 mt-1">{label}</div></div>;
}
