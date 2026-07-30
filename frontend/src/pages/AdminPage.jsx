import React, { useEffect, useState } from "react";
import api, { ROLE_LABELS, formatApiError } from "../lib/api";
import { KeyRound, RefreshCw, RotateCcw, Shield, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";

const TEMP_PASSWORD = "Arak@2026";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setUsers((await api.get("/users")).data || []); }
    catch (error) { toast.error(formatApiError(error?.response?.data?.detail) || "تعذر تحميل المستخدمين"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const rebuild = async () => {
    if (!window.confirm("سيتم إعادة جميع المستخدمين إلى كلمة المرور المؤقتة وإجبارهم على تغييرها عند أول دخول. هل تريد المتابعة؟")) return;
    setBusy(true);
    try {
      const response = await api.post("/users", { action: "rebuild" });
      toast.success(`تمت إعادة بناء ${response.data?.users?.length || 0} مستخدماً`);
      await load();
    } catch (error) {
      toast.error(formatApiError(error?.response?.data?.detail) || "تعذر إعادة بناء المستخدمين");
    } finally { setBusy(false); }
  };

  const resetPassword = async (person) => {
    try {
      await api.patch("/users", { action: "reset_password", user_id: person.id });
      toast.success(`أُعيدت كلمة مرور ${person.name} إلى المؤقتة`);
      await load();
    } catch (error) { toast.error(formatApiError(error?.response?.data?.detail) || "تعذر إعادة ضبط كلمة المرور"); }
  };

  const updateUser = async (person, patch) => {
    try {
      await api.patch("/users", { user_id: person.id, ...patch });
      toast.success("تم تحديث المستخدم");
      await load();
    } catch (error) { toast.error(formatApiError(error?.response?.data?.detail) || "تعذر تحديث المستخدم"); }
  };

  return (
    <div data-testid="admin-page" dir="rtl" className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">إدارة الحسابات المؤسسية</div>
          <h1 className="font-heading text-4xl font-black mt-2 flex items-center gap-3"><Shield className="text-yellow-500"/> إدارة المستخدمين</h1>
          <p className="text-slate-500 text-sm mt-1">حسابات جاهزة، كلمة مرور مؤقتة، وتغيير إلزامي عند أول دخول.</p>
        </div>
        <button disabled={busy} onClick={rebuild} className="px-5 py-2.5 rounded-lg bg-yellow-500 text-black font-black flex items-center gap-2 disabled:opacity-50"><RotateCcw size={18}/>{busy ? "جارٍ إعادة البناء..." : "إعادة بناء جميع المستخدمين"}</button>
      </div>

      <div className="glass-card p-5 border-emerald-500/15 bg-emerald-500/[0.025]">
        <div className="flex items-start justify-between gap-5 flex-wrap">
          <div className="flex items-start gap-3"><KeyRound className="text-emerald-300 mt-0.5" size={20}/><div><div className="font-bold text-slate-100">كلمة المرور المؤقتة الموحدة</div><p className="text-sm text-slate-400 mt-1">يدخل كل مستخدم بها مرة واحدة، ثم ينقله النظام إجبارياً إلى شاشة اختيار كلمة مروره الخاصة.</p></div></div>
          <code className="px-4 py-2 rounded-lg bg-black/30 border border-white/10 text-yellow-300 text-lg font-black" dir="ltr">{TEMP_PASSWORD}</code>
        </div>
      </div>

      <div className="glass-card p-2 overflow-x-auto">
        {loading ? <div className="p-8 text-center text-slate-500">جارٍ تحميل المستخدمين...</div> : (
          <table className="w-full text-right text-sm">
            <thead><tr className="text-[11px] text-slate-500 border-b border-white/5"><th className="py-3 px-4">المستخدم</th><th className="py-3 px-4">البريد</th><th className="py-3 px-4">الدور</th><th className="py-3 px-4">حالة كلمة المرور</th><th className="py-3 px-4">الإجراءات</th></tr></thead>
            <tbody>{users.map((person) => <tr key={person.id} className="border-b border-white/5 hover:bg-white/[0.02]">
              <td className="py-3 px-4"><div className="font-medium text-slate-100">{person.name}</div><div className="text-xs text-slate-500">{person.title}{person.department ? ` · ${person.department}` : ""}</div></td>
              <td className="py-3 px-4 text-slate-400 text-xs text-left" dir="ltr">{person.email}</td>
              <td className="py-3 px-4"><select value={person.role} onChange={(event) => updateUser(person, { role: event.target.value })} className="px-3 py-1.5 rounded bg-[#0a0d14] border border-white/10 text-xs">{Object.entries(ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></td>
              <td className="py-3 px-4"><span className={`text-[10px] px-2 py-1 rounded ${person.must_change_password ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}>{person.must_change_password ? "يجب تغييرها عند الدخول" : "تم تغييرها"}</span></td>
              <td className="py-3 px-4"><div className="flex items-center gap-1"><button onClick={() => resetPassword(person)} title="إعادة كلمة المرور المؤقتة" className="p-2 rounded text-yellow-300 hover:bg-yellow-500/10"><RefreshCw size={14}/></button><button onClick={() => updateUser(person, { active: !person.active })} title={person.active ? "تعطيل الحساب" : "تفعيل الحساب"} className={`p-2 rounded ${person.active ? "text-rose-300 hover:bg-rose-500/10" : "text-emerald-300 hover:bg-emerald-500/10"}`}>{person.active ? <UserX size={14}/> : <UserCheck size={14}/>}</button></div></td>
            </tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
