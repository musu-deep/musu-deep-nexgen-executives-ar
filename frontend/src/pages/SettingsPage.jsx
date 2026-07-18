import React, { useEffect, useMemo, useState } from "react";
import api, { ROLE_LABELS } from "../lib/api";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { Bell, Brain, Eye, Gauge, Layers, Lock, Radar, Shield, Sparkles, Users, Zap } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { change } = useTheme();
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    api.get("/notification-settings").then((response) => setSettings(response.data));
  }, []);

  useEffect(() => {
    if (user?.role === "admin") {
      setLoadingUsers(true);
      api.get("/users")
        .then((response) => setUsers(Array.isArray(response.data) ? response.data : []))
        .catch(() => toast.error("تعذر تحميل قاعدة بيانات المستخدمين"))
        .finally(() => setLoadingUsers(false));
    }
  }, [user]);

  const recommendedConfig = useMemo(() => {
    if (user?.role === "vp_investment") {
      return {
        focus: "ذكاء مخاطر الاستثمار والمحفظة",
        priority: "التعرض الرأسمالي، وأداء المحفظة، والفرص الاستراتيجية.",
        theme: "vision2030",
      };
    }
    if (user?.role === "vp_development") {
      return {
        focus: "ذكاء تنفيذ التنمية",
        priority: "مخاطر التنفيذ، والمعالم المتأخرة، وأداء المبادرات.",
        theme: "executiveGold",
      };
    }
    if (user?.role === "ceo") {
      return {
        focus: "القيادة التنفيذية الشاملة للمجموعة",
        priority: "المخاطر الاستراتيجية، والاعتمادات، والأداء، والتنسيق بين القطاعات.",
        theme: "executiveGold",
      };
    }
    return {
      focus: "ذكاء المراقبة التشغيلية",
      priority: "المهام والمشروعات والاجتماعات والمتابعة التنفيذية.",
      theme: "executiveGold",
    };
  }, [user]);

  const userInsights = useMemo(() => users.map((person) => {
    if (person.role === "admin") {
      return {
        user: person,
        action: "حماية الحساب",
        severity: "high",
        reason: "حساب المدير يمتلك صلاحيات مرتفعة ويجب حمايته ومراجعته دوريًا.",
      };
    }
    if (person.role === "tracker") {
      return {
        user: person,
        action: "مراجعة الوصول",
        severity: "medium",
        reason: "قد يمتلك دور المتابعة رؤية واسعة؛ ويُوصى بالتحقق من نطاقه قبل الاستخدام الإنتاجي.",
      };
    }
    if (["vp_investment", "vp_development", "ceo"].includes(person.role)) {
      return {
        user: person,
        action: "اعتماد",
        severity: "low",
        reason: "يبدو الوصول التنفيذي متوافقًا مع نطاق الرؤية القائم على الدور.",
      };
    }
    return {
      user: person,
      action: "مراجعة",
      severity: "medium",
      reason: "يحتاج ملف المستخدم إلى تحقق إداري.",
    };
  }), [users]);

  const save = async () => {
    try {
      await api.put("/notification-settings", settings);
      toast.success("تم حفظ إعدادات الذكاء التنفيذي");
    } catch {
      toast.error("تعذر حفظ الإعدادات");
    }
  };

  const applyRecommended = () => {
    try {
      change(recommendedConfig.theme);
      toast.success("تم تطبيق الإعداد الموصى به بالذكاء الاصطناعي");
    } catch {
      toast.error("تعذر تطبيق الإعداد الموصى به");
    }
  };

  const toggle = (key, value) => setSettings({ ...settings, [key]: value });
  const toggleEvent = (eventKey) => setSettings({ ...settings, events: { ...settings.events, [eventKey]: !settings.events[eventKey] } });

  return (
    <div data-testid="settings-page" dir="rtl" className="pb-10">
      <div className="mb-7">
        <div className="text-xs tracking-[0.12em] text-yellow-500/80">الإعدادات التنفيذية</div>
        <h1 className="font-heading text-4xl font-black mt-2">تفضيلات التشغيل الذكي</h1>
        <p className="text-slate-400 mt-2 max-w-3xl">اضبط طريقة تكيف المنصة مع الذكاء التنفيذي والتنبيهات والأولويات وحوكمة الوصول ومنطق المراقبة لكل دور قيادي.</p>
      </div>

      <div className="glass-card p-6 mb-5 overflow-hidden relative">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-yellow-500/10 blur-3xl rounded-full" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-sky-500/10 blur-3xl rounded-full" />

        <div className="relative flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="text-xs tracking-[0.12em] text-yellow-500/80">تجربة مدفوعة بالذكاء الاصطناعي</div>
            <h2 className="font-heading text-2xl font-black mt-2 flex items-center gap-2"><Brain className="text-yellow-500"/> إعداد الذكاء التنفيذي</h2>
            <p className="text-sm text-slate-400 mt-2 max-w-2xl">تتكيف مساحة العمل بحسب الدور القيادي ونطاق المحفظة ومستوى المخاطر ودرجة استعجال القرار.</p>
          </div>
          <div className="hidden md:flex px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold items-center gap-2">
            <Sparkles size={14}/> وضع التكيف الذكي: نشط
          </div>
        </div>

        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-4">
          <InfoCard icon={<Layers className="text-yellow-500" size={20}/>} label="واجهة تراعي الدور" title="عرض تنفيذي مخصص" text="تتكيّف اللوحات والتنبيهات والتوصيات تلقائيًا وفق مسؤولية المستخدم التنفيذية." />
          <InfoCard icon={<Radar className="text-rose-400" size={20}/>} label="إحاطة تراعي المخاطر" title="طبقة ذكاء الأولويات" text="تظهر المخاطر الحرجة والاعتمادات المعلقة والإجراءات المتأخرة قبل المعلومات الروتينية." />
          <InfoCard icon={<Zap className="text-sky-400" size={20}/>} label="محرك سياق القرار" title="إعدادات موجهة للعمل" text="تقترح المنصة ما يجب مراقبته أو تصعيده أو تضمينه في الموجز وفق المؤشرات المؤسسية." />
        </div>

        <div className="relative mt-6 p-5 rounded-xl bg-black/20 border border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="text-xs tracking-[0.12em] text-slate-500">التوصية الذكية الحالية</div>
              <div className="font-heading font-black text-xl mt-2">{recommendedConfig.focus}</div>
              <p className="text-sm text-slate-400 mt-1">{recommendedConfig.priority}</p>
              <div className="mt-3 text-xs text-slate-500">الملف النشط: <span className="text-slate-300 font-bold">{ROLE_LABELS[user?.role] || user?.title || "مستخدم تنفيذي"}</span></div>
            </div>
            <button onClick={applyRecommended} className="px-5 py-3 rounded-xl bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition">تطبيق الإعداد الموصى به</button>
          </div>
        </div>
      </div>

      {settings && (
        <div className="glass-card p-6 mb-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="font-heading text-xl font-bold mb-1 flex items-center gap-2"><Bell className="text-yellow-500"/> قائمة المراقبة الذكية</h2>
              <p className="text-sm text-slate-500">
                {user?.role === "admin" ? "تحكم في قنوات التنبيه التنفيذي والأحداث المراقبة عبر المنصة." : "اعرض الأحداث والقنوات المراقبة؛ يقتصر التعديل على مدير المنصة."}
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-white/[0.03] border border-white/10 px-3 py-2 rounded-full">
              {user?.role === "admin" ? <><Shield size={14} className="text-yellow-500"/> تحكم إداري</> : <><Eye size={14} className="text-yellow-500"/> وضع القراءة فقط</>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {[
              { key: "in_app_enabled", label: "تنبيهات داخل المنصة", description: "تظهر التنبيهات في مركز الإشعارات التنفيذي.", icon: Bell },
              { key: "email_enabled", label: "إشعارات البريد الإلكتروني", description: "تتطلب تكامل Resend أو SendGrid.", icon: Gauge },
              { key: "whatsapp_enabled", label: "إشعارات واتساب", description: "تتطلب تكامل Twilio WhatsApp API.", icon: Lock },
            ].map((channel) => {
              const Icon = channel.icon;
              const enabled = Boolean(settings[channel.key]);
              return (
                <label key={channel.key} className="p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center"><Icon size={18} className="text-yellow-500"/></div>
                    <input type="checkbox" checked={enabled} disabled={user?.role !== "admin"} onChange={(event) => toggle(channel.key, event.target.checked)} className="w-5 h-5"/>
                  </div>
                  <div className="font-medium text-slate-100 mt-4">{channel.label}</div>
                  <div className="text-xs text-slate-500 mt-1">{channel.description}</div>
                  <div className={`mt-4 inline-flex items-center gap-2 text-xs px-2.5 py-1 rounded-full ${enabled ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "bg-slate-500/10 text-slate-400 border border-slate-500/20"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${enabled ? "bg-emerald-400" : "bg-slate-500"}`}/>{enabled ? "مفعّل" : "معطّل"}
                  </div>
                </label>
              );
            })}
          </div>

          <div className="border-t border-white/5 pt-5">
            <h3 className="font-heading font-bold">الأحداث الذكية المراقبة</h3>
            <p className="text-xs text-slate-500 mt-1 mb-3">حدد المؤشرات التشغيلية التي يجب إدخالها إلى قائمة المراقبة التنفيذية.</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { key: "meeting", label: "الاجتماعات" },
                { key: "meeting_request", label: "الطلبات" },
                { key: "task", label: "المهام" },
                { key: "project", label: "المشروعات" },
                { key: "message", label: "المراسلات" },
              ].map((eventItem) => {
                const enabled = settings.events?.[eventItem.key] !== false;
                return (
                  <label key={eventItem.key} className={`flex items-center gap-2 p-3 rounded-lg border transition ${enabled ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-100" : "bg-white/[0.02] border-white/5 text-slate-400"}`}>
                    <input type="checkbox" checked={enabled} disabled={user?.role !== "admin"} onChange={() => toggleEvent(eventItem.key)}/>
                    <span className="text-sm">{eventItem.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {user?.role === "admin" && <button onClick={save} className="mt-6 w-full py-3 rounded-xl bg-yellow-500 text-black font-bold hover:bg-yellow-400 transition">حفظ إعدادات الذكاء التنفيذي</button>}
        </div>
      )}

      {user?.role === "admin" && (
        <div className="glass-card p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="text-xs tracking-[0.12em] text-yellow-500/80">وكيل حوكمة الذكاء الاصطناعي</div>
              <h2 className="font-heading text-2xl font-black mt-2 flex items-center gap-2"><Users className="text-yellow-500"/> ذكاء صلاحيات المستخدمين</h2>
              <p className="text-sm text-slate-400 mt-2 max-w-2xl">يراجع الوكيل أدوار المستخدمين ونطاق الوصول والصلاحيات التنفيذية، ثم يقترح الإجراءات الإدارية.</p>
            </div>
            <div className="hidden md:flex px-4 py-2 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-bold">متصل بقاعدة بيانات المستخدمين</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
            <Metric title="إجمالي المستخدمين" value={users.length}/>
            <Metric title="القيادات التنفيذية" value={users.filter((person) => ["ceo", "vp_development", "vp_investment"].includes(person.role)).length}/>
            <Metric title="حسابات الإدارة" value={users.filter((person) => person.role === "admin").length}/>
            <Metric title="تحتاج إلى مراجعة" value={userInsights.filter((insight) => insight.action.includes("مراجعة")).length}/>
          </div>

          {loadingUsers ? (
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 text-slate-400">جارٍ تحميل ذكاء المستخدمين...</div>
          ) : (
            <div className="space-y-3">
              {userInsights.map((insight) => (
                <div key={insight.user.id || insight.user.email} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="font-bold text-slate-100">{insight.user.name || "مستخدم دون اسم"}</div>
                    <div className="text-xs text-slate-500 mt-1" dir="ltr">{insight.user.email}</div>
                    <div className="text-xs text-slate-500 mt-1">{ROLE_LABELS[insight.user.role] || insight.user.role}</div>
                    <div className="text-sm text-slate-400 mt-2">{insight.reason}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-3 py-1 rounded-full border ${insight.severity === "high" ? "bg-rose-500/10 text-rose-300 border-rose-500/20" : insight.severity === "medium" ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/20" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"}`}>
                      {insight.severity === "high" ? "مرتفع" : insight.severity === "medium" ? "متوسط" : "منخفض"}
                    </span>
                    <button className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-sm">{insight.action}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, label, title, text }) {
  return (
    <div className="p-5 rounded-xl bg-white/[0.03] border border-white/10">
      <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-4">{icon}</div>
      <div className="text-yellow-400 text-sm font-bold mb-2">{label}</div>
      <div className="text-slate-100 font-heading font-bold text-lg">{title}</div>
      <p className="text-sm text-slate-500 mt-2">{text}</p>
    </div>
  );
}

function Metric({ title, value }) {
  return <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10"><div className="text-xs text-slate-500">{title}</div><div className="text-2xl font-black mt-1">{value}</div></div>;
}
