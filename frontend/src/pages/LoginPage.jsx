import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { formatApiError } from "../lib/api";
import { toast } from "sonner";
import { Shield, ChevronLeft, Building2, Sparkles } from "lucide-react";
import NEXGEN_EXECUTIVES from "../assets/NEXGEN_EXECUTIVES.png";

const DEMO_PASSWORD = "ExecAgent2026!";

const ROLE_QUICK = [
  { email: "ceo@company.demo", label: "الرئيس التنفيذي", role: "ceo" },
  { email: "development@company.demo", label: "نائب الرئيس التنفيذي للتنمية", role: "vp_development" },
  { email: "investment@company.demo", label: "نائب الرئيس التنفيذي للاستثمار", role: "vp_investment" },
  { email: "manager@company.demo", label: "مدير وحدة الأعمال", role: "dev_manager" },
  { email: "followup@company.demo", label: "المتابعة التنفيذية", role: "tracker" },
  { email: "admin@company.demo", label: "مدير المنصة", role: "admin" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const copy = {
    secure: "منصة الذكاء التنفيذي",
    title: "رئيس الديوان الذكي",
    desc: "نظام تشغيل مؤسسي مدعوم بالذكاء الاصطناعي لتنسيق العمل التنفيذي، وبناء الرؤية التشغيلية، ومتابعة الاستراتيجيات، ودعم قرارات القيادة.",
    sign: "تسجيل الدخول",
    sub: "دخول آمن إلى منصة الذكاء التنفيذي",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    enter: "دخول المنصة",
    checking: "جارٍ التحقق...",
    quick: "حسابات الدخول السريع",
    demo: "كلمة مرور العرض:",
    toast: "مرحبًا بك في NEXGEN EXECUTIVES",
    err: "تعذر تسجيل الدخول",
    features: [
      { v: "Gemini", l: "الذكاء التنفيذي" },
      { v: "MongoDB", l: "الذاكرة المؤسسية" },
      { v: "MCP", l: "تكامل الوكلاء" },
    ],
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      await login(email, password);
      toast.success(copy.toast);
      navigate("/dashboard");
    } catch (e) {
      const msg = formatApiError(e?.response?.data?.detail) || copy.err;
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative flex items-center justify-center overflow-hidden"
      dir="rtl"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1710438399422-2fca27686bcd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MjJ8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGVsZWdhbnQlMjBkYXJrJTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3ODEwMDA2NDh8MA&ixlib=rb-4.1.0&q=85')",
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-[#0a0d14]/85 to-black/70" />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div className="text-right hidden lg:block space-y-7">
          <img
            src={NEXGEN_EXECUTIVES}
            alt="NEXGEN EXECUTIVES OS"
            className="h-44 w-auto object-contain mb-2"
          />

          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-yellow-500/20 bg-yellow-500/5 text-yellow-400 text-xs tracking-[0.12em]">
            <Building2 size={14} />
            <span>{copy.secure}</span>
          </div>

          <div>
            <h1 className="font-heading font-black text-5xl text-slate-50 leading-tight">
              {copy.title}
            </h1>
            <p className="mt-4 text-lg text-slate-400 leading-relaxed max-w-lg">
              {copy.desc}
            </p>
          </div>

          <div className="gold-divider" />

          <div className="grid grid-cols-3 gap-4">
            {copy.features.map((item) => (
              <div key={item.v} className="glass-card p-4 text-center">
                <div className="font-heading text-yellow-400 font-bold text-xl" dir="ltr">
                  {item.v}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {item.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="glass-card p-8 md:p-10 max-w-md w-full mx-auto"
          data-testid="login-card"
        >
          <div className="text-center mb-8">
            <img
              src={NEXGEN_EXECUTIVES}
              alt="NEXGEN EXECUTIVES OS"
              className="h-20 w-auto object-contain mx-auto mb-4 lg:hidden"
            />

            <div className="inline-flex items-center gap-2 text-yellow-400 text-xs tracking-[0.12em] mb-3">
              <Sparkles size={13} />
              نسخة الهاكاثون
            </div>

            <h2 className="font-heading text-2xl font-bold text-slate-50">
              {copy.sign}
            </h2>

            <p className="text-sm text-slate-500 mt-2">{copy.sub}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs text-slate-400 mb-2">
                {copy.email}
              </label>
              <input
                data-testid="login-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.demo"
                className="w-full px-4 py-3 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 text-slate-100 placeholder-slate-600 transition-colors text-left"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-2">
                {copy.password}
              </label>
              <input
                data-testid="login-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 text-slate-100 placeholder-slate-600 transition-colors text-left"
                dir="ltr"
              />
            </div>

            {err && (
              <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">
                {err}
              </div>
            )}

            <button
              data-testid="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-gradient-to-l from-yellow-500 to-yellow-600 text-black font-bold hover:from-yellow-400 hover:to-yellow-500 transition-all shadow-lg shadow-yellow-900/30 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                copy.checking
              ) : (
                <>
                  {copy.enter}
                  <ChevronLeft size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 pt-6 border-t border-white/5">
            <div className="text-[11px] text-slate-500 mb-3 flex items-center gap-2">
              <Shield size={12} />
              {copy.quick}
            </div>

            <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pl-1">
              {ROLE_QUICK.map((role) => (
                <button
                  key={role.email}
                  type="button"
                  data-testid={`quick-login-${role.role}`}
                  onClick={() => {
                    setEmail(role.email);
                    setPassword(DEMO_PASSWORD);
                  }}
                  className="px-3 py-2 rounded-md text-xs bg-white/[0.02] hover:bg-yellow-500/5 hover:border-yellow-500/20 border border-white/5 text-slate-300 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="font-medium">{role.label}</span>
                  <span className="text-slate-500 text-[10px] tabular-nums" dir="ltr">
                    {role.email}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-3 text-[10px] text-slate-600 text-center">
              {copy.demo}{" "}
              <span className="text-yellow-500 font-bold tabular-nums" dir="ltr">
                {DEMO_PASSWORD}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
