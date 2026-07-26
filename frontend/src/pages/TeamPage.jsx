import React, { useCallback, useEffect, useMemo, useState } from "react";
import api, { ROLE_LABELS } from "../lib/api";
import {
  Briefcase, Building2, CalendarDays, Mail, MapPin, RefreshCw,
  Search, UserRoundCheck, UsersRound, X,
} from "lucide-react";

const ROLE_COLORS = {
  ceo: "from-yellow-500 to-yellow-700",
  admin: "from-rose-500 to-rose-700",
  vp_development: "from-emerald-500 to-emerald-700",
  vp_investment: "from-sky-500 to-sky-700",
  dev_manager: "from-violet-500 to-violet-700",
  tracker: "from-amber-500 to-amber-700",
};

function normaliseEmployee(person) {
  return {
    ...person,
    email: person?.email || person?.work_email || "",
    title: person?.title || person?.job_title || "",
    department: person?.department || "",
    active: person?.active !== false,
  };
}

function formatDate(value) {
  if (!value) return "غير محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" });
}

export default function TeamPage() {
  const [serverUsers, setServerUsers] = useState([]);
  const [source, setSource] = useState("loading");
  const [warning, setWarning] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("الكل");

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setWarning("");
    try {
      const response = await api.get("/employees");
      const payload = response.data || {};
      const employees = Array.isArray(payload) ? payload : payload.employees;
      setServerUsers(Array.isArray(employees) ? employees.map(normaliseEmployee) : []);
      setSource(payload.source || "odoo");
      setWarning(payload.warning || "");
    } catch {
      try {
        const fallback = await api.get("/users");
        setServerUsers(Array.isArray(fallback.data) ? fallback.data.map(normaliseEmployee) : []);
        setSource("platform");
        setWarning("تعذر قراءة دليل الموظفين من Odoo؛ عُرض دليل حسابات المنصة مؤقتًا.");
      } catch {
        setServerUsers([]);
        setSource("offline");
        setWarning("تعذر قراءة بيانات فريق العمل.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDirectory(); }, [loadDirectory]);

  const users = useMemo(
    () => serverUsers.filter((person) => person.active !== false),
    [serverUsers],
  );

  const departments = useMemo(
    () => ["الكل", ...Array.from(new Set(users.map((person) => person.department).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar"))],
    [users],
  );

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((person) => {
      const matchesDepartment = department === "الكل" || person.department === department;
      const text = `${person.name} ${person.title} ${person.department} ${person.email} ${person.manager} ${person.entity} ${person.location}`.toLowerCase();
      return matchesDepartment && (!normalized || text.includes(normalized));
    });
  }, [users, query, department]);

  const clearFilters = () => {
    setQuery("");
    setDepartment("الكل");
  };

  if (loading) {
    return <div dir="rtl" className="space-y-5"><div className="h-28 shimmer rounded-2xl"/><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map((item) => <div key={item} className="h-24 shimmer rounded-2xl"/>)}</div><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map((item) => <div key={item} className="h-56 shimmer rounded-2xl"/>)}</div></div>;
  }

  const sourceLabel = source === "odoo" ? "Odoo مباشر" : source === "platform" ? "قاعدة المنصة" : "غير متاح";

  return (
    <div data-testid="team-page" dir="rtl">
      <div className="mb-7 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">المكتب التنفيذي</div>
          <h1 className="font-heading text-4xl font-black mt-2">أعضاء الفريق</h1>
          <p className="text-slate-500 text-sm mt-1">عرض {filteredUsers.length} من أصل {users.length} موظفًا مسجلًا</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className={`px-3 py-2 rounded-xl border text-xs font-bold ${source === "odoo" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>{sourceLabel}</span>
          <button type="button" onClick={loadDirectory} className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:text-yellow-300 flex items-center gap-2 text-sm font-bold"><RefreshCw size={16}/> تحديث الدليل</button>
        </div>
      </div>

      {warning && <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-6 text-amber-200">{warning}</div>}

      <div className="glass-card p-3 flex flex-col md:flex-row gap-3 md:items-center mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو المسمى أو الإدارة أو الكيان..." className="w-full pr-10 pl-9 py-2.5 rounded-lg bg-black/20 border border-white/10 text-sm outline-none focus:border-yellow-500/35" />
          {query && <button type="button" onClick={() => setQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label="مسح البحث"><X size={15} /></button>}
        </div>

        <div className="relative md:w-64">
          <Building2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <select value={department} onChange={(event) => setDepartment(event.target.value)} className="w-full pr-10 pl-4 py-2.5 rounded-lg bg-black/20 border border-white/10 text-sm outline-none focus:border-yellow-500/35 appearance-none">
            {departments.map((item) => <option key={item} value={item}>{item === "الكل" ? "جميع الإدارات" : item}</option>)}
          </select>
        </div>

        {(query || department !== "الكل") && <button type="button" onClick={clearFilters} className="px-4 py-2.5 rounded-lg bg-white/5 text-slate-300 hover:bg-rose-500/10 hover:text-rose-300 text-xs font-bold whitespace-nowrap">إعادة الضبط</button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<UsersRound size={16}/>} label="إجمالي الموظفين" value={users.length} />
        <StatCard icon={<Building2 size={16}/>} label="الإدارات" value={Math.max(departments.length - 1, 0)} />
        <StatCard icon={<Search size={16}/>} label="النتائج الحالية" value={filteredUsers.length} />
        <StatCard icon={<UserRoundCheck size={16}/>} label="الموظفون النشطون" value={users.filter((person) => person.active !== false).length} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((person) => (
          <div key={person.email || person.id} className="glass-card p-6 hover:border-yellow-500/30 transition-all">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${ROLE_COLORS[person.role] || "from-slate-500 to-slate-700"} flex items-center justify-center text-2xl font-heading font-bold text-white shadow-lg`}>{person.name?.[0] || "؟"}</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-heading text-lg font-bold text-slate-100 truncate">{person.name}</h3>
                <div className="text-xs text-yellow-400/80 mt-0.5 line-clamp-2">{person.title || ROLE_LABELS[person.role]}</div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 space-y-2 text-xs text-slate-400">
              {person.department && <div className="flex items-center gap-2"><Building2 size={12}/>{person.department}</div>}
              {person.title && <div className="flex items-center gap-2"><Briefcase size={12}/>{person.title}</div>}
              {person.manager && <div className="flex items-center gap-2"><UserRoundCheck size={12}/>المدير المباشر: {person.manager}</div>}
              {person.hire_date && <div className="flex items-center gap-2"><CalendarDays size={12}/>تاريخ التعيين: {formatDate(person.hire_date)}</div>}
              {(person.location || person.entity) && <div className="flex items-center gap-2"><MapPin size={12}/>{person.location || person.entity}</div>}
              {person.email && <div className="flex items-center gap-2" dir="ltr"><Mail size={12}/>{person.email}</div>}
            </div>
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="glass-card p-14 text-center text-slate-500">
          <UsersRound size={34} className="mx-auto mb-3 opacity-50" />
          <div className="font-bold text-slate-300">لا توجد نتائج مطابقة</div>
          <p className="text-xs mt-2">غيّر عبارة البحث أو اختر إدارة أخرى.</p>
          <button type="button" onClick={clearFilters} className="mt-4 px-4 py-2 rounded-lg bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 text-xs font-bold">عرض جميع الموظفين</button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return <div className="glass-card p-4"><div className="flex items-center gap-2 text-[10px] tracking-wider text-slate-500">{icon}{label}</div><div className="text-3xl font-heading font-black text-slate-100 mt-2 tabular-nums">{value}</div></div>;
}
