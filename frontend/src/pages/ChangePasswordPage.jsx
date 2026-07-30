import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { formatApiError } from "../lib/api";
import NEXGEN_EXECUTIVES from "../assets/NEXGEN_EXECUTIVES.png";

export default function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("تأكيد كلمة المرور غير مطابق.");
      return;
    }
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("تم تغيير كلمة المرور. أهلاً بك في المنصة.");
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      const message = formatApiError(requestError?.response?.data?.detail) || "تعذر تغيير كلمة المرور";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#070a11]" dir="rtl">
      <div className="glass-card w-full max-w-lg p-8 md:p-10">
        <img src={NEXGEN_EXECUTIVES} alt="مكتب الرئيس التنفيذي" className="h-20 w-auto object-contain mx-auto mb-5" />
        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 flex items-center justify-center mx-auto mb-4"><KeyRound size={26} /></div>
          <h1 className="font-heading text-2xl font-black text-slate-50">تغيير كلمة المرور عند أول دخول</h1>
          <p className="text-sm text-slate-400 mt-2">مرحباً {user?.name}. لحماية حسابك، اختر كلمة مرور خاصة بك قبل دخول المنصة.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block"><span className="block text-xs text-slate-400 mb-2">كلمة المرور المؤقتة</span><div className="relative"><input required type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="w-full px-4 py-3 pl-11 rounded-lg bg-[#0a0d14] border border-white/10 text-left" dir="ltr" autoComplete="current-password"/><LockKeyhole size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"/></div></label>
          <label className="block"><span className="block text-xs text-slate-400 mb-2">كلمة المرور الجديدة</span><input required type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full px-4 py-3 rounded-lg bg-[#0a0d14] border border-white/10 text-left" dir="ltr" autoComplete="new-password"/></label>
          <label className="block"><span className="block text-xs text-slate-400 mb-2">تأكيد كلمة المرور الجديدة</span><input required type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full px-4 py-3 rounded-lg bg-[#0a0d14] border border-white/10 text-left" dir="ltr" autoComplete="new-password"/></label>
          <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3 text-xs text-slate-400 flex gap-2"><ShieldCheck size={16} className="text-emerald-400 flex-shrink-0"/><span>استخدم 10 خانات على الأقل، وحرفاً كبيراً وصغيراً ورقماً ورمزاً خاصاً.</span></div>
          {error && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
          <button disabled={loading} className="w-full py-3 rounded-lg bg-yellow-500 text-black font-black hover:bg-yellow-400 disabled:opacity-50">{loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور والدخول"}</button>
        </form>

        <button type="button" onClick={async () => { await logout(); navigate("/login", { replace: true }); }} className="w-full mt-3 py-2.5 text-sm text-slate-500 hover:text-slate-300">العودة إلى تسجيل الدخول</button>
      </div>
    </div>
  );
}
