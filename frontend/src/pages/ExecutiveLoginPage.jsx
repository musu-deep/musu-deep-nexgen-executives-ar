import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { formatApiError } from "../lib/api";
import { toast } from "sonner";
import { Shield, ChevronLeft, Building2, Sparkles, LockKeyhole, Mail } from "lucide-react";
import NEXGEN_EXECUTIVES from "../assets/NEXGEN_EXECUTIVES.png";

export default function ExecutiveLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("مرحبًا بك في مكتب الرئيس التنفيذي");
      navigate("/dashboard");
    } catch (requestError) {
      const message = formatApiError(requestError?.response?.data?.detail) || "تعذر تسجيل الدخول";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { v: "ODOO | ARAAK", l: "العمليات • المالية • الموارد" },
    { v: "واعي | أراك", l: "التحليل المؤسسي • المشورة • التوصيات" },
    { v: "ARAAK DIGITAL", l: "تكامل المنصات والخدمات الرقمية" },
  ];

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden" dir="rtl">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1710438399422-2fca27686bcd?crop=entropy&cs=srgb&fm=jpg&ixlib=rb-4.1.0&q=85')" }} />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-[#0a0d14]/90 to-black/75" />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div className="text-right hidden lg:block space-y-7">
          <img src={NEXGEN_EXECUTIVES} alt="مكتب الرئيس التنفيذي" className="h-44 w-auto object-contain mb-2" />
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-yellow-500/20 bg-yellow-500/5 text-yellow-400 text-xs tracking-[0.12em]">
            <Building2 size={14} /><span>منصة التشغيل التنفيذي</span>
          </div>
          <div>
            <h1 className="font-heading font-black text-5xl text-slate-50 leading-tight">مكتب الرئيس التنفيذي</h1>
            <p className="mt-4 text-lg text-slate-400 leading-relaxed max-w-lg">نظام تشغيل مؤسسي لإدارة العمل التنفيذي والصلاحيات والقرارات والمتابعة ضمن هوية مؤسسية موحدة.</p>
          </div>
          <div className="gold-divider" />
          <div className="grid grid-cols-3 gap-4">
            {features.map((item) => <div key={item.v} className="glass-card p-4 text-center"><div className="font-heading text-yellow-400 font-bold text-lg" dir="auto">{item.v}</div><div className="text-[11px] text-slate-500 mt-1 leading-5">{item.l}</div></div>)}
          </div>
        </div>

        <div className="glass-card p-8 md:p-10 max-w-md w-full mx-auto" data-testid="login-card">
          <div className="text-center mb-8">
            <img src={NEXGEN_EXECUTIVES} alt="مكتب الرئيس التنفيذي" className="h-20 w-auto object-contain mx-auto mb-4 lg:hidden" />
            <div className="inline-flex items-center gap-2 text-yellow-400 text-xs tracking-[0.12em] mb-3"><Sparkles size={13} />دخول مؤسسي محمي</div>
            <h2 className="font-heading text-2xl font-bold text-slate-50">تسجيل الدخول</h2>
            <p className="text-sm text-slate-500 mt-2">استخدم الحساب الذي أنشأه مدير النظام</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-xs text-slate-400 mb-2">البريد الإلكتروني المؤسسي</label>
              <div className="relative">
                <input data-testid="login-email-input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@araak.org" className="w-full px-4 py-3 pl-11 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:border-yellow-500/50 focus:outline-none text-slate-100 placeholder-slate-600 text-left" dir="ltr" autoComplete="username" />
                <Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">كلمة المرور</label>
              <div className="relative">
                <input data-testid="login-password-input" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full px-4 py-3 pl-11 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:border-yellow-500/50 focus:outline-none text-slate-100 text-left" dir="ltr" autoComplete="current-password" />
                <LockKeyhole size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              </div>
            </div>
            {error && <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">{error}</div>}
            <button data-testid="login-submit-btn" type="submit" disabled={loading} className="w-full py-3 rounded-lg bg-gradient-to-l from-yellow-500 to-yellow-600 text-black font-bold hover:from-yellow-400 hover:to-yellow-500 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? "جارٍ التحقق..." : <>دخول المنصة<ChevronLeft size={18} /></>}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5 space-y-2 text-center">
            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500"><Shield size={12} />لا يوجد تسجيل ذاتي أو دليل حسابات عام</div>
            <div className="text-[10px] text-slate-600">الحسابات والدعوات والصلاحيات تدار حصرياً بواسطة مدير النظام.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
