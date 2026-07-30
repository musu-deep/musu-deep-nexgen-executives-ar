import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import api, { formatApiError } from "../lib/api";
import NEXGEN_EXECUTIVES from "../assets/NEXGEN_EXECUTIVES.png";

export default function ActivateAccountPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [account, setAccount] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("رمز الدعوة غير موجود.");
      setLoading(false);
      return;
    }
    api.get("/auth/invitation", { params: { token } })
      .then((response) => setAccount(response.data))
      .catch((requestError) => setError(formatApiError(requestError?.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/activate", { token, password });
      setComplete(true);
    } catch (requestError) {
      setError(formatApiError(requestError?.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a10] text-slate-100 flex items-center justify-center p-6" dir="rtl">
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-emerald-500/5" />
      <div className="relative w-full max-w-md glass-card p-8 md:p-10">
        <img src={NEXGEN_EXECUTIVES} alt="مكتب الرئيس التنفيذي" className="h-20 w-auto object-contain mx-auto mb-6" />

        {loading ? <div className="text-center text-slate-400">جارٍ التحقق من الدعوة الآمنة...</div> : complete ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto text-emerald-300" size={48} />
            <h1 className="font-heading text-2xl font-bold mt-4">تم تفعيل الحساب</h1>
            <p className="text-sm text-slate-400 mt-2">كلمة مرورك خاصة ولم تكن ظاهرة لمدير النظام.</p>
            <button onClick={() => navigate("/login")} className="mt-6 w-full py-3 rounded-lg bg-yellow-500 text-black font-bold hover:bg-yellow-400">الانتقال إلى تسجيل الدخول</button>
          </div>
        ) : error && !account ? (
          <div className="text-center">
            <ShieldCheck className="mx-auto text-rose-300" size={44} />
            <h1 className="font-heading text-xl font-bold mt-4">الدعوة غير متاحة</h1>
            <p className="text-sm text-rose-300 mt-3">{error}</p>
            <button onClick={() => navigate("/login")} className="mt-6 w-full py-3 rounded-lg border border-white/10 hover:bg-white/5">العودة إلى تسجيل الدخول</button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <KeyRound className="mx-auto text-yellow-400" size={34} />
              <h1 className="font-heading text-2xl font-bold mt-3">تفعيل حسابك</h1>
              <p className="text-sm text-slate-400 mt-2">مرحباً {account?.name}. أنشئ كلمة مرورك الخاصة للحساب <span dir="ltr">{account?.email}</span>.</p>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-2">كلمة المرور</label>
                <div className="relative">
                  <input required minLength={12} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full px-4 py-3 pl-11 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:border-yellow-500/50 focus:outline-none text-slate-100 text-left" dir="ltr" autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-2">تأكيد كلمة المرور</label>
                <input required minLength={12} type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full px-4 py-3 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:border-yellow-500/50 focus:outline-none text-slate-100 text-left" dir="ltr" autoComplete="new-password" />
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">استخدم 12 خانة على الأقل، تشمل حرفاً كبيراً وصغيراً ورقماً ورمزاً خاصاً. الدعوة صالحة للاستخدام مرة واحدة.</p>
              {error && <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">{error}</div>}
              <button disabled={submitting} type="submit" className="w-full py-3 rounded-lg bg-yellow-500 text-black font-bold hover:bg-yellow-400 disabled:opacity-50">{submitting ? "جارٍ التفعيل..." : "حفظ كلمة المرور وتفعيل الحساب"}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
