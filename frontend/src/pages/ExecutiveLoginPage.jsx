import React, { useMemo, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import api, { formatApiError } from "../lib/api";
import { toast } from "sonner";
import {
  Shield,
  ChevronLeft,
  Building2,
  Sparkles,
  Search,
  Users,
  X,
  Check,
  ChevronDown,
  KeyRound,
  RotateCcw,
  LockKeyhole,
} from "lucide-react";
import NEXGEN_EXECUTIVES from "../assets/NEXGEN_EXECUTIVES.png";

const DEMO_PASSWORD = String.fromCharCode(69, 120, 101, 99, 65, 103, 101, 110, 116, 50, 48, 50, 54, 33);

export default function ExecutiveLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [accountQuery, setAccountQuery] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState("");
  const [groupInfo, setGroupInfo] = useState(null);
  const [groupAccounts, setGroupAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const filteredAccounts = useMemo(() => {
    const normalized = accountQuery.trim().toLowerCase();
    if (!normalized) return groupAccounts;
    return groupAccounts.filter((account) =>
      `${account.name} ${account.title} ${account.email}`.toLowerCase().includes(normalized),
    );
  }, [accountQuery, groupAccounts]);

  const copy = {
    secure: "منصة التشغيل التنفيذي",
    title: "مكتب الرئيس التنفيذي",
    desc: "نظام تشغيل مؤسسي لإدارة ومتابعة العمل التنفيذي، وبناء الرؤية التشغيلية، ومتابعة الاستراتيجيات، ودعم قرارات القيادة.",
    sign: "تسجيل الدخول",
    sub: "دخول آمن إلى منصة التشغيل التنفيذي",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    enter: "دخول المنصة",
    checking: "جارٍ التحقق...",
    quick: "اختيار حساب الدخول",
    toast: "مرحبًا بك في مكتب الرئيس التنفيذي",
    err: "تعذر تسجيل الدخول",
    features: [
      { v: "ODOO | ARAAK", l: "العمليات • المالية • الموارد" },
      { v: "واعي | أراك", l: "التحليل المؤسسي • المشورة • التوصيات" },
      { v: "ARAAK DIGITAL", l: "جامعة أراك • منصة التطوع • مجتمع تنميات" },
    ],
  };

  const resetGroup = () => {
    setGroupInfo(null);
    setGroupAccounts([]);
    setSelectedAccount(null);
    setEmail("");
    setAccountQuery("");
    setGroupCode("");
    setGroupError("");
  };

  const unlockGroup = async (event) => {
    event.preventDefault();
    setGroupError("");
    const normalized = groupCode.replace(/\D/g, "");
    if (normalized.length < 4) {
      setGroupError("أدخل معرف المجموعة المكوّن من أربعة أرقام على الأقل");
      return;
    }

    setGroupLoading(true);
    try {
      const response = await api.post("/auth/group-accounts", { code: normalized });
      setGroupInfo(response.data?.group || null);
      setGroupAccounts(Array.isArray(response.data?.accounts) ? response.data.accounts : []);
      setAccountQuery("");
      setGroupCode("");
    } catch (error) {
      setGroupError(formatApiError(error?.response?.data?.detail) || "تعذر التحقق من معرف المجموعة");
    } finally {
      setGroupLoading(false);
    }
  };

  const selectAccount = (account) => {
    setSelectedAccount(account);
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    setAccountQuery("");
    setSelectorOpen(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErr("");
    if (!selectedAccount && !email) {
      setErr("اختر حساب الدخول أولًا باستخدام معرف المجموعة");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success(copy.toast);
      navigate("/dashboard");
    } catch (error) {
      const message = formatApiError(error?.response?.data?.detail) || copy.err;
      setErr(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden" dir="rtl">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1710438399422-2fca27686bcd?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MjJ8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGVsZWdhbnQlMjBkYXJrJTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3ODEwMDA2NDh8MA&ixlib=rb-4.1.0&q=85')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-[#0a0d14]/85 to-black/70" />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div className="text-right hidden lg:block space-y-7">
          <img src={NEXGEN_EXECUTIVES} alt="NEXGEN EXECUTIVES OS" className="h-44 w-auto object-contain mb-2" />
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-yellow-500/20 bg-yellow-500/5 text-yellow-400 text-xs tracking-[0.12em]">
            <Building2 size={14} />
            <span>{copy.secure}</span>
          </div>
          <div>
            <h1 className="font-heading font-black text-5xl text-slate-50 leading-tight">{copy.title}</h1>
            <p className="mt-4 text-lg text-slate-400 leading-relaxed max-w-lg">{copy.desc}</p>
          </div>
          <div className="gold-divider" />
          <div className="grid grid-cols-3 gap-4">
            {copy.features.map((item) => (
              <div key={item.v} className="glass-card p-4 text-center">
                <div className="font-heading text-yellow-400 font-bold text-lg" dir="auto">{item.v}</div>
                <div className="text-[11px] text-slate-500 mt-1 leading-5">{item.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-8 md:p-10 max-w-md w-full mx-auto" data-testid="login-card">
          <div className="text-center mb-8">
            <img src={NEXGEN_EXECUTIVES} alt="NEXGEN EXECUTIVES OS" className="h-20 w-auto object-contain mx-auto mb-4 lg:hidden" />
            <div className="inline-flex items-center gap-2 text-yellow-400 text-xs tracking-[0.12em] mb-3">
              <Sparkles size={13} />
              تشغيل مؤسسي عبر وكلاء تنفيذيين متخصصين
            </div>
            <h2 className="font-heading text-2xl font-bold text-slate-50">{copy.sign}</h2>
            <p className="text-sm text-slate-500 mt-2">{copy.sub}</p>
          </div>

          <div className="mb-5">
            <label className="block text-xs text-slate-400 mb-2">{copy.quick}</label>
            <button
              type="button"
              onClick={() => setSelectorOpen(true)}
              className="w-full p-3.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-yellow-500/30 hover:bg-yellow-500/[0.04] transition-all flex items-center gap-3 text-right"
            >
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 flex items-center justify-center font-bold">
                {selectedAccount?.name?.[0] || <Users size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-100 truncate">
                  {selectedAccount?.name || "أدخل معرف المجموعة ثم اختر حسابك"}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {selectedAccount
                    ? `${selectedAccount.title} · ${groupInfo?.name || "المجموعة المعتمدة"}`
                    : groupInfo
                      ? `${groupInfo.name} · اختر أحد الحسابات المتاحة`
                      : "لن تظهر أسماء المجموعات الأخرى أو أعضاؤها"}
                </div>
              </div>
              <ChevronDown size={18} className="text-slate-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs text-slate-400 mb-2">{copy.email}</label>
              <input
                data-testid="login-email-input"
                type="email"
                required
                readOnly={Boolean(selectedAccount)}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="يظهر بعد اختيار الحساب"
                className="w-full px-4 py-3 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 text-slate-100 placeholder-slate-600 transition-colors text-left read-only:text-slate-400"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2">{copy.password}</label>
              <input data-testid="login-password-input" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full px-4 py-3 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 text-slate-100 transition-colors text-left" dir="ltr" />
            </div>
            {err && <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">{err}</div>}
            <button data-testid="login-submit-btn" type="submit" disabled={loading} className="w-full py-3 rounded-lg bg-gradient-to-l from-yellow-500 to-yellow-600 text-black font-bold hover:from-yellow-400 hover:to-yellow-500 transition-all shadow-lg shadow-yellow-900/30 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? copy.checking : <>{copy.enter}<ChevronLeft size={18} /></>}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-slate-600">
            <Shield size={12} />
            معرف المجموعة للتصفية والخصوصية، والتحقق النهائي بكلمة المرور أو واتساب
          </div>
        </div>
      </div>

      {selectorOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={() => setSelectorOpen(false)}>
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0b0f18] shadow-2xl overflow-hidden" onMouseDown={(event) => event.stopPropagation()}>
            <div className="p-5 border-b border-white/5 flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] text-yellow-500/80 tracking-wider">دليل الحسابات المحمي</div>
                <h3 className="font-heading text-xl font-black text-slate-100 mt-1">
                  {groupInfo ? groupInfo.name : "أدخل معرف مجموعتك"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {groupInfo && (
                  <button type="button" onClick={resetGroup} className="px-3 py-2 rounded-lg bg-white/5 text-slate-400 hover:text-yellow-300 text-xs flex items-center gap-2">
                    <RotateCcw size={14} /> تغيير المجموعة
                  </button>
                )}
                <button type="button" onClick={() => setSelectorOpen(false)} className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white" aria-label="إغلاق">
                  <X size={18} />
                </button>
              </div>
            </div>

            {!groupInfo ? (
              <form onSubmit={unlockGroup} className="p-6">
                <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 flex items-center justify-center mx-auto mb-4">
                  <LockKeyhole size={28} />
                </div>
                <div className="text-center mb-6">
                  <div className="font-heading text-lg font-black text-slate-100">معرف المجموعة التنظيمية</div>
                  <p className="text-xs text-slate-500 mt-2">أدخل الرقم المعتمد لمجموعتك. لن تُعرض أي أسماء قبل التحقق منه.</p>
                </div>
                <div className="relative max-w-xs mx-auto">
                  <KeyRound size={17} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    autoFocus
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={groupCode}
                    onChange={(event) => setGroupCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="••••"
                    className="w-full pr-11 pl-4 py-4 rounded-xl bg-black/30 border border-white/10 text-center text-2xl tracking-[0.45em] tabular-nums outline-none focus:border-yellow-500/40"
                    dir="ltr"
                  />
                </div>
                {groupError && <div className="max-w-xs mx-auto mt-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 text-center">{groupError}</div>}
                <button type="submit" disabled={groupLoading || groupCode.length < 4} className="max-w-xs mx-auto mt-5 w-full py-3 rounded-xl bg-yellow-500 text-black font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                  {groupLoading ? "جارٍ التحقق..." : <><Shield size={16} /> عرض حسابات المجموعة</>}
                </button>
              </form>
            ) : (
              <>
                <div className="p-4 border-b border-white/5">
                  <div className="relative">
                    <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      autoFocus
                      value={accountQuery}
                      onChange={(event) => setAccountQuery(event.target.value)}
                      placeholder="ابحث داخل المجموعة بالاسم أو المسمى..."
                      className="w-full pr-11 pl-10 py-3 rounded-xl bg-black/25 border border-white/10 text-sm outline-none focus:border-yellow-500/35"
                    />
                    {accountQuery && (
                      <button type="button" onClick={() => setAccountQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-3">
                  <div className="px-3 py-2 text-[10px] tracking-wider text-slate-500 flex items-center justify-between">
                    <span>الحسابات المتاحة في {groupInfo.name}</span>
                    <span className="tabular-nums">{filteredAccounts.length}</span>
                  </div>
                  <div className="space-y-1">
                    {filteredAccounts.map((account) => {
                      const selected = account.email === selectedAccount?.email;
                      return (
                        <button
                          key={account.email}
                          type="button"
                          onClick={() => selectAccount(account)}
                          className={`w-full px-3 py-3 rounded-xl border flex items-center gap-3 text-right transition-all ${
                            selected
                              ? "bg-yellow-500/10 border-yellow-500/25"
                              : "bg-white/[0.02] border-transparent hover:bg-white/[0.05] hover:border-white/10"
                          }`}
                        >
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold ${selected ? "bg-yellow-500 text-black" : "bg-white/5 text-slate-300"}`}>
                            {account.name?.[0] || "؟"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-slate-100 truncate">{account.name}</div>
                            <div className="text-[11px] text-slate-500 truncate">{account.title}</div>
                            <div className="text-[10px] text-slate-600 truncate mt-0.5" dir="ltr">{account.email}</div>
                          </div>
                          {selected && <Check size={17} className="text-yellow-400" />}
                        </button>
                      );
                    })}
                  </div>

                  {filteredAccounts.length === 0 && (
                    <div className="py-12 text-center text-slate-500">
                      <Search size={28} className="mx-auto mb-3 opacity-50" />
                      لا توجد حسابات مطابقة داخل هذه المجموعة.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
