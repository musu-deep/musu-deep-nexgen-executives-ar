import React, { useEffect, useMemo, useState } from "react";
import api, { ROLE_LABELS } from "../lib/api";
import { Mail, Briefcase, Building2, Search, UsersRound, X } from "lucide-react";

const ROLE_COLORS = {
  ceo: "from-yellow-500 to-yellow-700",
  admin: "from-rose-500 to-rose-700",
  vp_development: "from-emerald-500 to-emerald-700",
  vp_investment: "from-sky-500 to-sky-700",
  dev_manager: "from-violet-500 to-violet-700",
  tracker: "from-amber-500 to-amber-700",
};

const APPROVED_EMPLOYEES = [
  { id: "usr_secretariat", email: "secretariat@company.demo", name: "خالد العوبثاني", role: "tracker", title: "مسؤول السكرتارية التنفيذية", department: "السكرتارية التنفيذية", active: true },
  { id: "usr_hr", email: "hr@company.demo", name: "محمد السقاف", role: "dev_manager", title: "مسؤول الموارد البشرية", department: "الموارد البشرية", active: true },
  { id: "usr_finance", email: "finance@company.demo", name: "محمد السيمت أبو إياد", role: "dev_manager", title: "المدير المالي", department: "الإدارة المالية", active: true },
  { id: "usr_quality", email: "quality@company.demo", name: "عاصم الملاحمة", role: "dev_manager", title: "مدير التفتيش والرقابة والجودة", department: "التفتيش والرقابة والجودة", active: true },
  { id: "usr_steel_factory", email: "steel.factory@company.demo", name: "سامر الملاحمة", role: "dev_manager", title: "مدير مصنع الحديد", department: "مصنع الحديد", active: true },
  { id: "usr_commercial", email: "commercial@company.demo", name: "م. محمد شكاك", role: "dev_manager", title: "مسؤول المشتريات والمستودعات والشؤون التجارية", department: "المشتريات والمستودعات", active: true },
  { id: "usr_factory", email: "factory@company.demo", name: "م. عبد الرحمن الحسام", role: "dev_manager", title: "مدير أراك الوطنية والمصنع", department: "المصنع وأراك الوطنية", active: true },
  { id: "usr_technical_office", email: "technical.office@company.demo", name: "م. إسلام محمد", role: "dev_manager", title: "مسؤول المكتب الفني", department: "المكتب الفني", active: true },
  { id: "usr_wholesale", email: "wholesale@company.demo", name: "مدير مبيعات الجملة", role: "dev_manager", title: "مدير مبيعات الجملة", department: "مبيعات الجملة", active: true },
  { id: "usr_stores", email: "stores@company.demo", name: "م. طه الأهدل", role: "dev_manager", title: "مدير أراك ستورز والتجارة الإلكترونية", department: "أراك ستورز", active: true },
];

function mergeDirectory(serverUsers) {
  const byEmail = new Map();
  [...serverUsers, ...APPROVED_EMPLOYEES].forEach((person) => {
    const key = String(person.email || person.id).toLowerCase();
    byEmail.set(key, { ...(byEmail.get(key) || {}), ...person });
  });
  return [...byEmail.values()].filter((person) => person.active !== false);
}

export default function TeamPage() {
  const [serverUsers, setServerUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("الكل");

  useEffect(() => {
    api.get("/users")
      .then((response) => setServerUsers(Array.isArray(response.data) ? response.data : []))
      .catch(() => setServerUsers([]));
  }, []);

  const users = useMemo(() => mergeDirectory(serverUsers), [serverUsers]);

  const departments = useMemo(
    () => ["الكل", ...Array.from(new Set(users.map((person) => person.department).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar"))],
    [users],
  );

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((person) => {
      const matchesDepartment = department === "الكل" || person.department === department;
      const matchesQuery = !normalized || `${person.name} ${person.title} ${person.department} ${person.email}`.toLowerCase().includes(normalized);
      return matchesDepartment && matchesQuery;
    });
  }, [users, query, department]);

  const clearFilters = () => {
    setQuery("");
    setDepartment("الكل");
  };

  return (
    <div data-testid="team-page" dir="rtl">
      <div className="mb-7 flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">المكتب التنفيذي</div>
          <h1 className="font-heading text-4xl font-black mt-2">أعضاء الفريق</h1>
          <p className="text-slate-500 text-sm mt-1">
            عرض {filteredUsers.length} من أصل {users.length} عضوًا في النظام
          </p>
        </div>

        <div className="glass-card p-3 flex flex-col md:flex-row gap-3 md:items-center w-full xl:w-auto xl:min-w-[620px]">
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث بالاسم أو المسمى أو البريد..."
              className="w-full pr-10 pl-9 py-2.5 rounded-lg bg-black/20 border border-white/10 text-sm outline-none focus:border-yellow-500/35"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label="مسح البحث">
                <X size={15} />
              </button>
            )}
          </div>

          <div className="relative md:w-56">
            <Building2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-lg bg-black/20 border border-white/10 text-sm outline-none focus:border-yellow-500/35 appearance-none"
            >
              {departments.map((item) => <option key={item} value={item}>{item === "الكل" ? "جميع الإدارات" : item}</option>)}
            </select>
          </div>

          {(query || department !== "الكل") && (
            <button type="button" onClick={clearFilters} className="px-4 py-2.5 rounded-lg bg-white/5 text-slate-300 hover:bg-rose-500/10 hover:text-rose-300 text-xs font-bold whitespace-nowrap">
              إعادة الضبط
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="إجمالي الأعضاء" value={users.length} />
        <StatCard label="الإدارات" value={Math.max(departments.length - 1, 0)} />
        <StatCard label="النتائج الحالية" value={filteredUsers.length} />
        <StatCard label="الحسابات النشطة" value={users.filter((person) => person.active !== false).length} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((person) => (
          <div key={person.email || person.id} className="glass-card p-6 hover:border-yellow-500/30 transition-all">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${ROLE_COLORS[person.role] || "from-slate-500 to-slate-700"} flex items-center justify-center text-2xl font-heading font-bold text-white shadow-lg`}>
                {person.name?.[0] || "؟"}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-heading text-lg font-bold text-slate-100 truncate">{person.name}</h3>
                <div className="text-xs text-yellow-400/80 mt-0.5 truncate">{person.title || ROLE_LABELS[person.role]}</div>
              </div>
              {!person.active && <span className="text-[10px] px-2 py-1 rounded bg-rose-500/15 text-rose-300">معطّل</span>}
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 space-y-2 text-xs text-slate-400">
              {person.department && <div className="flex items-center gap-2"><Building2 size={12}/>{person.department}</div>}
              {person.title && <div className="flex items-center gap-2"><Briefcase size={12}/>{person.title}</div>}
              <div className="flex items-center gap-2" dir="ltr"><Mail size={12}/>{person.email}</div>
            </div>
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="glass-card p-14 text-center text-slate-500">
          <UsersRound size={34} className="mx-auto mb-3 opacity-50" />
          <div className="font-bold text-slate-300">لا توجد نتائج مطابقة</div>
          <p className="text-xs mt-2">غيّر عبارة البحث أو اختر إدارة أخرى.</p>
          <button type="button" onClick={clearFilters} className="mt-4 px-4 py-2 rounded-lg bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 text-xs font-bold">
            عرض جميع الأعضاء
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="glass-card p-4">
      <div className="text-[10px] tracking-wider text-slate-500">{label}</div>
      <div className="text-3xl font-heading font-black text-slate-100 mt-2 tabular-nums">{value}</div>
    </div>
  );
}
