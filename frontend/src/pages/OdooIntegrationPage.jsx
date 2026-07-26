import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Activity, Boxes, CheckCircle2, Database, Link2, RefreshCw,
  ServerCog, ShieldCheck, Unplug, Workflow, XCircle,
} from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

const SOURCE_LABELS = {
  mongo: "قاعدة المنصة",
  odoo: "Odoo مباشر",
  hybrid: "Odoo + قاعدة المنصة",
};

const PROTOCOL_LABELS = {
  auto: "اختيار تلقائي",
  json2: "JSON-2",
  xmlrpc: "XML-RPC",
};

const ACTIVE_MODELS = [
  { model: "project.project", label: "المشروعات", status: "active", text: "قراءة المشروعات ونسب الإنجاز والمراحل والمواعيد." },
  { model: "project.task", label: "المهام", status: "active", text: "قراءة المهام والأولويات والاستحقاقات وحالات التنفيذ." },
];

const NEXT_MODELS = [
  { model: "sale.order", label: "المبيعات", text: "أوامر البيع والعملاء والقيمة المتوقعة." },
  { model: "purchase.order", label: "المشتريات", text: "أوامر الشراء والموردون وحالة التوريد." },
  { model: "account.move", label: "المالية", text: "الفواتير والتحصيلات والالتزامات المالية." },
  { model: "stock.quant", label: "المخزون", text: "الأرصدة والتغطية والمخزون الراكد والتنبيهات." },
  { model: "hr.employee", label: "الموارد البشرية", text: "الهيكل والموظفون والوحدات والبيانات الأساسية." },
  { model: "mrp.production", label: "التصنيع", text: "أوامر الإنتاج والإنجاز والتأخير والقدرات." },
];

function yesNo(value) {
  return value ? "نعم" : "لا";
}

export default function OdooIntegrationPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/odoo/status");
      setStatus(response.data || null);
    } catch {
      setStatus(null);
      toast.error("تعذر قراءة إعدادات تكامل Odoo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await api.post("/odoo/test");
      setStatus(response.data || null);
      if (response.data?.connected) toast.success("تم الاتصال بـ Odoo بنجاح");
      else toast.error(response.data?.message || "تعذر الاتصال بـ Odoo");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "تعذر اختبار اتصال Odoo");
    } finally {
      setTesting(false);
    }
  };

  const connectionState = useMemo(() => {
    if (!status?.enabled) return { label: "غير مفعّل", css: "text-slate-400 bg-white/5 border-white/10", icon: Unplug };
    if (!status?.configured) return { label: "الإعدادات غير مكتملة", css: "text-amber-300 bg-amber-500/10 border-amber-500/20", icon: XCircle };
    if (status?.connected) return { label: "متصل", css: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 };
    return { label: "جاهز للاختبار", css: "text-sky-300 bg-sky-500/10 border-sky-500/20", icon: Activity };
  }, [status]);

  const ConnectionIcon = connectionState.icon;
  const canTest = ["admin", "ceo"].includes(user?.role);

  if (loading) {
    return <div className="space-y-5" dir="rtl"><div className="h-32 shimmer rounded-2xl"/><div className="grid md:grid-cols-4 gap-4">{[1,2,3,4].map((item) => <div key={item} className="h-28 shimmer rounded-2xl"/>)}</div><div className="h-72 shimmer rounded-2xl"/></div>;
  }

  return (
    <div dir="rtl" data-testid="odoo-integration-page" className="space-y-6 pb-10">
      <section className="glass-card p-6 border-violet-500/15 overflow-hidden relative">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-violet-500/10 blur-3xl rounded-full" />
        <div className="relative flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div>
            <div className="text-xs tracking-[0.14em] text-violet-300/80">طبقة البيانات المؤسسية</div>
            <h1 className="font-heading text-4xl font-black mt-2 flex items-center gap-3"><Database className="text-violet-300"/> بيئة تكامل Odoo</h1>
            <p className="text-slate-400 text-sm mt-2 max-w-3xl leading-7">تجعل Odoo المصدر التشغيلي للمشروعات والمهام، مع الإبقاء على منصة القيادة كطبقة للمؤشرات والمخاطر والقرارات والذكاء التنفيذي.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-4 py-2.5 rounded-xl border text-sm font-bold flex items-center gap-2 ${connectionState.css}`}><ConnectionIcon size={17}/>{connectionState.label}</span>
            <button type="button" onClick={loadStatus} className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:text-yellow-300 flex items-center gap-2 text-sm font-bold"><RefreshCw size={16}/> تحديث الحالة</button>
            {canTest && <button type="button" onClick={testConnection} disabled={testing || !status?.configured} className="px-4 py-2.5 rounded-xl bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-black"><Link2 size={16}/>{testing ? "جارٍ الاختبار..." : "اختبار الاتصال"}</button>}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={<Database size={18}/>} label="المصدر التشغيلي" value={SOURCE_LABELS[status?.operational_source] || status?.operational_source || "قاعدة المنصة"} />
        <MetricCard icon={<ServerCog size={18}/>} label="البروتوكول" value={PROTOCOL_LABELS[status?.resolved_protocol || status?.protocol] || status?.protocol || "تلقائي"} />
        <MetricCard icon={<ShieldCheck size={18}/>} label="نمط الوصول" value={status?.read_only !== false ? "قراءة آمنة" : "قراءة وكتابة"} />
        <MetricCard icon={<Activity size={18}/>} label="إصدار Odoo" value={status?.version || "غير محدد"} />
      </section>

      <section className="grid xl:grid-cols-3 gap-5">
        <div className="glass-card p-6 xl:col-span-2">
          <div className="flex items-center gap-2 mb-5"><Workflow className="text-violet-300" size={20}/><h2 className="font-heading text-2xl font-black">مسار التكامل التشغيلي</h2></div>
          <div className="grid md:grid-cols-3 gap-4">
            <FlowCard number="01" title="Odoo" text="المصدر المعتمد للعمليات والمشروعات والمهام والوحدات المالية والتشغيلية." />
            <FlowCard number="02" title="بوابة التكامل" text="تحقق آمن، مواءمة للحقول، تطبيق الصلاحيات، وتحويل البيانات إلى نموذج المنصة." />
            <FlowCard number="03" title="مكتب الرئيس التنفيذي" text="مؤشرات وتنبيهات ومخاطر وموجزات وتوصيات جاهزة لاتخاذ القرار." />
          </div>
          <div className={`mt-5 p-4 rounded-xl border ${status?.connected ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/10 bg-white/[0.025]"}`}>
            <div className="font-bold text-slate-200">حالة البيئة</div>
            <p className="text-sm text-slate-400 mt-2 leading-7">{status?.message || "لم تصل معلومات حالة التكامل من الخادم."}</p>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-5"><ServerCog className="text-yellow-400" size={20}/><h2 className="font-heading text-xl font-black">الإعدادات الآمنة</h2></div>
          <div className="space-y-3 text-sm">
            <StatusLine label="التفعيل" value={yesNo(status?.enabled)} ok={status?.enabled} />
            <StatusLine label="اكتمال الإعداد" value={yesNo(status?.configured)} ok={status?.configured} />
            <StatusLine label="مفتاح API" value={status?.has_api_key ? "موجود ومحجوب" : "غير موجود"} ok={status?.has_api_key} />
            <StatusLine label="قاعدة Odoo" value={status?.database || "يحددها النطاق"} ok={Boolean(status?.database || status?.url)} />
            <StatusLine label="عنوان الخادم" value={status?.url || "غير مضبوط"} ok={Boolean(status?.url)} mono />
          </div>
          <div className="mt-5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-200/80 leading-6">مفتاح Odoo يبقى داخل متغيرات الخادم ولا يُرسل إلى المتصفح أو يُعرض في هذه الصفحة.</div>
        </div>
      </section>

      <section className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5"><Boxes className="text-yellow-400" size={20}/><h2 className="font-heading text-2xl font-black">نماذج Odoo المدعومة</h2></div>
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {ACTIVE_MODELS.map((item) => <ModelCard key={item.model} {...item} />)}
        </div>
        <div className="border-t border-white/10 pt-5">
          <div className="text-sm font-bold text-slate-300 mb-4">امتدادات جاهزة للمرحلة التالية</div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {NEXT_MODELS.map((item) => <ModelCard key={item.model} {...item} status="planned" />)}
          </div>
        </div>
      </section>

      <section className="glass-card p-6">
        <h2 className="font-heading text-xl font-black mb-4">متغيرات الخادم المطلوبة</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {["ODOO_ENABLED=true", "OPERATIONAL_DATA_SOURCE=hybrid", "ODOO_URL=https://company.odoo.com", "ODOO_DATABASE=database_name", "ODOO_USERNAME=integration@company.com", "ODOO_API_KEY=********", "ODOO_PROTOCOL=auto", "ODOO_READ_ONLY=true", "ODOO_DEFAULT_SECTOR=corporate"].map((value) => <code key={value} dir="ltr" className="block p-3 rounded-xl bg-black/25 border border-white/10 text-xs text-sky-200 overflow-x-auto">{value}</code>)}
        </div>
        <p className="text-xs text-slate-500 mt-4 leading-6">يوصى بالبدء بوضع hybrid حتى تبقى سجلات المنصة المحلية ظاهرة إلى جانب بيانات Odoo، ثم الانتقال إلى odoo بعد اكتمال مواءمة جميع الحقول.</p>
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value }) {
  return <div className="glass-card p-4"><div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-300 flex items-center justify-center">{icon}</div><div className="font-heading text-xl font-black mt-4 text-slate-100 break-words">{value}</div><div className="text-xs text-slate-500 mt-2">{label}</div></div>;
}

function FlowCard({ number, title, text }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="text-xs font-black text-violet-300">{number}</div><div className="font-heading text-xl font-black mt-3">{title}</div><p className="text-sm text-slate-500 mt-2 leading-7">{text}</p></div>;
}

function StatusLine({ label, value, ok, mono = false }) {
  return <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/[0.025] border border-white/5"><span className="text-slate-500">{label}</span><span dir={mono ? "ltr" : undefined} className={`text-left break-all ${ok ? "text-emerald-300" : "text-slate-300"}`}>{value}</span></div>;
}

function ModelCard({ model, label, text, status }) {
  const active = status === "active";
  return <div className={`rounded-2xl border p-4 ${active ? "border-emerald-500/20 bg-emerald-500/[0.04]" : "border-white/10 bg-white/[0.025]"}`}><div className="flex items-start justify-between gap-3"><div><div className="font-heading text-lg font-black">{label}</div><code dir="ltr" className="text-[11px] text-sky-300 mt-1 block">{model}</code></div><span className={`text-[10px] px-2.5 py-1 rounded-full border ${active ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" : "text-slate-400 bg-white/5 border-white/10"}`}>{active ? "مفعّل" : "مرحلة تالية"}</span></div><p className="text-sm text-slate-500 mt-3 leading-6">{text}</p></div>;
}
