import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { ROLE_LABELS, formatApiError } from "../lib/api";
import { Copy, KeyRound, Network, Plus, RefreshCw, Shield, UserCheck, UserX, X } from "lucide-react";
import { toast } from "sonner";

const EMPTY_FORM = {
  email: "",
  name: "",
  role: "tracker",
  title: "",
  department: "",
};

const STATUS_LABELS = {
  active: "نشط",
  pending: "بانتظار التفعيل",
  expired: "انتهت الدعوة",
};

export default function AdminPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [inviteResult, setInviteResult] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setUsers((await api.get("/iam/users")).data || []);
    } catch (error) {
      toast.error(formatApiError(error?.response?.data?.detail) || "تعذر تحميل المستخدمين");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copyLink = async (link) => {
    await navigator.clipboard.writeText(link);
    toast.success("تم نسخ رابط التفعيل");
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post("/iam/users/invite", form);
      setInviteResult(response.data);
      toast.success("تم إنشاء الدعوة الآمنة");
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch (error) {
      toast.error(formatApiError(error?.response?.data?.detail) || "تعذر إنشاء الدعوة");
    }
  };

  const resetInvite = async (person) => {
    try {
      const response = await api.post(`/iam/users/${person.id}/reset-invite`);
      setInviteResult(response.data);
      toast.success("تم إلغاء الوصول السابق وإصدار دعوة جديدة");
      load();
    } catch (error) {
      toast.error(formatApiError(error?.response?.data?.detail) || "تعذر إعادة إصدار الدعوة");
    }
  };

  const toggleActive = async (person) => {
    try {
      await api.patch(`/iam/users/${person.id}`, { active: !person.active });
      toast.success(person.active ? "تم تعطيل الحساب" : "تم تفعيل الحساب");
      load();
    } catch (error) {
      toast.error(formatApiError(error?.response?.data?.detail) || "تعذر تحديث حالة الحساب");
    }
  };

  const changeRole = async (person, role) => {
    try {
      await api.patch(`/iam/users/${person.id}`, { role });
      toast.success("تم تحديث الدور الانتقالي");
      load();
    } catch (error) {
      toast.error(formatApiError(error?.response?.data?.detail) || "تعذر تحديث الدور");
    }
  };

  return (
    <div data-testid="admin-page" dir="rtl" className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">إدارة الهوية المؤسسية</div>
          <h1 className="font-heading text-4xl font-black mt-2 flex items-center gap-3"><Shield className="text-yellow-500"/> إدارة المستخدمين</h1>
          <p className="text-slate-500 text-sm mt-1">دعوات آمنة، تفعيل ذاتي لكلمة المرور، وتعطيل مركزي للحسابات.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => navigate("/access-control")} className="px-5 py-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-yellow-300 font-bold flex items-center gap-2"><Network size={18}/> نسيج الصلاحيات</button>
          <button onClick={() => setShowForm(true)} className="px-5 py-2.5 rounded-lg bg-gradient-to-l from-yellow-500 to-yellow-600 text-black font-bold flex items-center gap-2"><Plus size={18}/> دعوة مستخدم</button>
        </div>
      </div>

      <div className="glass-card p-5 border-emerald-500/10 bg-emerald-500/[0.025]">
        <div className="flex items-start gap-3"><KeyRound className="text-emerald-300 mt-0.5" size={20}/><div><div className="font-bold text-slate-100">لا توجد كلمات مرور داخل لوحة الإدارة</div><p className="text-sm text-slate-400 mt-1">يستلم المستخدم رابطاً أحادي الاستخدام ويختار كلمة مروره بنفسه. الآدمن يستطيع فقط إعادة إصدار الدعوة أو تعطيل الحساب.</p></div></div>
      </div>

      {inviteResult?.activation_url && (
        <div className="glass-card p-5 border-yellow-500/20">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div><div className="font-bold text-yellow-300">رابط التفعيل الآمن</div><div className="text-xs text-slate-500 mt-1">ينتهي: {new Date(inviteResult.expires_at).toLocaleString("ar-SA")}</div></div>
            <button onClick={() => copyLink(inviteResult.activation_url)} className="px-4 py-2 rounded-lg bg-yellow-500 text-black font-bold flex items-center gap-2"><Copy size={16}/> نسخ الرابط</button>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-black/30 border border-white/5 text-xs text-left break-all text-slate-400" dir="ltr">{inviteResult.activation_url}</div>
        </div>
      )}

      <div className="glass-card p-2 overflow-x-auto">
        {loading ? <div className="p-8 text-center text-slate-500">جارٍ تحميل المستخدمين...</div> : (
          <table className="w-full text-right text-sm">
            <thead><tr className="text-[11px] text-slate-500 border-b border-white/5"><th className="py-3 px-4">المستخدم</th><th className="py-3 px-4">البريد</th><th className="py-3 px-4">الدور الانتقالي</th><th className="py-3 px-4">حالة الوصول</th><th className="py-3 px-4">الإجراءات</th></tr></thead>
            <tbody>{users.map((person) => {
              const status = person.active ? "active" : person.invitation_status || "pending";
              return <tr key={person.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="py-3 px-4"><div className="font-medium text-slate-100">{person.name}</div><div className="text-xs text-slate-500">{person.title}{person.department ? ` · ${person.department}` : ""}</div></td>
                <td className="py-3 px-4 text-slate-400 text-xs text-left" dir="ltr">{person.email}</td>
                <td className="py-3 px-4"><select value={person.role} onChange={(event) => changeRole(person, event.target.value)} className="px-3 py-1.5 rounded bg-[#0a0d14] border border-white/10 text-xs">{Object.entries(ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></td>
                <td className="py-3 px-4"><span className={`text-[10px] px-2 py-1 rounded ${status === "active" ? "bg-emerald-500/15 text-emerald-300" : status === "expired" ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300"}`}>{STATUS_LABELS[status] || status}</span>{person.demo && <span className="mr-2 text-[9px] text-slate-600">تجريبي</span>}</td>
                <td className="py-3 px-4"><div className="flex items-center gap-1"><button onClick={() => resetInvite(person)} title="إعادة إصدار الدعوة" className="p-2 rounded text-yellow-300 hover:bg-yellow-500/10"><RefreshCw size={14}/></button><button onClick={() => toggleActive(person)} title={person.active ? "تعطيل الحساب" : "تفعيل الحساب"} className={`p-2 rounded ${person.active ? "text-rose-300 hover:bg-rose-500/10" : "text-emerald-300 hover:bg-emerald-500/10"}`}>{person.active ? <UserX size={14}/> : <UserCheck size={14}/>}</button></div></td>
              </tr>;
            })}</tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="glass-card p-6 max-w-md w-full" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><div><h2 className="font-heading text-xl font-bold">دعوة مستخدم جديد</h2><p className="text-xs text-slate-500 mt-1">لن تحدد له كلمة مرور؛ سيختارها بنفسه.</p></div><button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/10 rounded"><X size={18}/></button></div>
            <form onSubmit={submit} className="space-y-3">
              <input required placeholder="الاسم الكامل" value={form.name} onChange={(event) => setForm({...form, name: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"/>
              <input required type="email" placeholder="البريد المؤسسي" value={form.email} onChange={(event) => setForm({...form, email: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm text-left" dir="ltr"/>
              <input placeholder="المسمى الوظيفي" value={form.title} onChange={(event) => setForm({...form, title: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"/>
              <input placeholder="الإدارة أو الوحدة" value={form.department} onChange={(event) => setForm({...form, department: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"/>
              <select value={form.role} onChange={(event) => setForm({...form, role: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm">{Object.entries(ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
              <button type="submit" className="w-full py-3 rounded-lg bg-yellow-500 text-black font-bold hover:bg-yellow-400">إنشاء الدعوة الآمنة</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
