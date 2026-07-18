import React, { useEffect, useState } from "react";
import api, { ROLE_LABELS, formatApiError } from "../lib/api";
import { Plus, X, Shield, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";

const EMPTY_FORM = {
  email: "",
  password: "",
  name: "",
  role: "tracker",
  title: "",
};

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = () => api.get("/users").then((response) => setUsers(response.data));
  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    try {
      await api.post("/users", form);
      toast.success("تم إنشاء المستخدم بنجاح");
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (error) {
      toast.error(formatApiError(error?.response?.data?.detail) || "تعذر إنشاء المستخدم");
    }
  };

  const toggleActive = async (person) => {
    try {
      await api.patch(`/users/${person.id}`, { active: !person.active });
      toast.success(person.active ? "تم تعطيل الحساب" : "تم تفعيل الحساب");
      load();
    } catch {
      toast.error("تعذر تحديث حالة الحساب");
    }
  };

  const changeRole = async (person, role) => {
    try {
      await api.patch(`/users/${person.id}`, { role });
      toast.success("تم تحديث الدور الوظيفي");
      load();
    } catch {
      toast.error("تعذر تحديث الدور");
    }
  };

  return (
    <div data-testid="admin-page" dir="rtl">
      <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">إدارة النظام</div>
          <h1 className="font-heading text-4xl font-black mt-2 flex items-center gap-3">
            <Shield className="text-yellow-500"/> لوحة إدارة المنصة
          </h1>
          <p className="text-slate-500 text-sm mt-1">إدارة المستخدمين والأدوار والصلاحيات وحالة الحسابات</p>
        </div>
        <button
          data-testid="new-user-btn"
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-l from-yellow-500 to-yellow-600 text-black font-bold flex items-center gap-2"
        >
          <Plus size={18}/> مستخدم جديد
        </button>
      </div>

      <div className="glass-card p-2 overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="text-[11px] text-slate-500 border-b border-white/5">
              <th className="py-3 px-4 font-semibold">الاسم</th>
              <th className="py-3 px-4 font-semibold">البريد الإلكتروني</th>
              <th className="py-3 px-4 font-semibold">الدور</th>
              <th className="py-3 px-4 font-semibold">الحالة</th>
              <th className="py-3 px-4 font-semibold">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((person) => (
              <tr key={person.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-3 px-4">
                  <div className="font-medium text-slate-100">{person.name}</div>
                  <div className="text-xs text-slate-500">{person.title}</div>
                </td>
                <td className="py-3 px-4 text-slate-400 text-xs text-left" dir="ltr">{person.email}</td>
                <td className="py-3 px-4">
                  <select
                    value={person.role}
                    onChange={(event) => changeRole(person, event.target.value)}
                    className="px-3 py-1.5 rounded bg-[#0a0d14] border border-white/10 text-xs"
                  >
                    {Object.entries(ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </td>
                <td className="py-3 px-4">
                  {person.active ? (
                    <span className="text-[10px] px-2 py-1 rounded bg-emerald-500/15 text-emerald-300">نشط</span>
                  ) : (
                    <span className="text-[10px] px-2 py-1 rounded bg-rose-500/15 text-rose-300">معطّل</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => toggleActive(person)}
                    title={person.active ? "تعطيل الحساب" : "تفعيل الحساب"}
                    aria-label={person.active ? "تعطيل الحساب" : "تفعيل الحساب"}
                    className={`p-2 rounded transition-colors ${person.active ? "hover:bg-rose-500/10 text-rose-300" : "hover:bg-emerald-500/10 text-emerald-300"}`}
                  >
                    {person.active ? <UserX size={14}/> : <UserCheck size={14}/>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="glass-card p-6 max-w-md w-full" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-xl font-bold">إنشاء مستخدم جديد</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/10 rounded" aria-label="إغلاق"><X size={18}/></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <input
                required
                placeholder="الاسم الكامل"
                value={form.name}
                onChange={(event) => setForm({...form, name: event.target.value})}
                className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"
              />
              <input
                required
                type="email"
                placeholder="البريد الإلكتروني"
                value={form.email}
                onChange={(event) => setForm({...form, email: event.target.value})}
                className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm text-left"
                dir="ltr"
              />
              <input
                required
                type="password"
                placeholder="كلمة المرور"
                value={form.password}
                onChange={(event) => setForm({...form, password: event.target.value})}
                className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm text-left"
                dir="ltr"
              />
              <input
                placeholder="المسمى الوظيفي"
                value={form.title}
                onChange={(event) => setForm({...form, title: event.target.value})}
                className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"
              />
              <select
                value={form.role}
                onChange={(event) => setForm({...form, role: event.target.value})}
                className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"
              >
                {Object.entries(ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <button type="submit" className="w-full py-3 rounded-lg bg-yellow-500 text-black font-bold hover:bg-yellow-400">إنشاء الحساب</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
