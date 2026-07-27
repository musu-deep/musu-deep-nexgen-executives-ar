import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Calculator,
  CheckCircle2,
  Coins,
  Database,
  FileText,
  Gauge,
  Save,
  Send,
  Target,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "nexgen-pricing-intelligence-v1";

const defaultModel = {
  projectName: "مشروع استشاري تنموي متكامل",
  client: "عميل استراتيجي",
  directCost: 1850000,
  overheadRate: 8,
  riskRate: 6,
  targetMargin: 18,
  strategicPremium: 4,
  competitorPrice: 2950000,
  winStrength: 78,
  notes: "يتضمن نطاق العمل التشخيص، التصميم، التنفيذ المرحلي، نقل المعرفة، وإدارة الأثر.",
};

const tabs = [
  ["cost", Calculator, "تحليل التكلفة"],
  ["price", TrendingUp, "تقدير السعر"],
  ["win", Target, "احتمالية الفوز"],
  ["risk", AlertTriangle, "تحليل المخاطر"],
  ["profit", Coins, "سيناريوهات الربحية"],
  ["ai", BrainCircuit, "التوصية التنفيذية"],
  ["memory", Database, "ذاكرة التسعير"],
  ["proposal", FileText, "عرض السعر"],
];

function formatNumber(value) {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function money(value) {
  return `${formatNumber(value)} ر.س`;
}

function Panel({ children, className = "" }) {
  return <div className={`glass-card rounded-2xl border border-white/10 p-5 ${className}`}>{children}</div>;
}

function Stat({ label, value, icon: Icon, tone = "yellow" }) {
  const tones = {
    yellow: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };
  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div><div className="text-xs text-slate-500">{label}</div><div className="mt-2 text-2xl font-black text-slate-100">{value}</div></div>
        <div className={`rounded-xl border p-3 ${tones[tone]}`}><Icon size={20} /></div>
      </div>
    </Panel>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-2 block text-xs text-slate-400">{label}</span>{children}</label>;
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "border-white/10 bg-white/5 text-slate-300",
    yellow: "border-yellow-500/20 bg-yellow-500/10 text-yellow-300",
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    rose: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  };
  return <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

export default function PricingIntelligencePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("cost");
  const [model, setModel] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultModel;
    } catch {
      return defaultModel;
    }
  });

  const calc = useMemo(() => {
    const direct = Number(model.directCost || 0);
    const overhead = direct * Number(model.overheadRate || 0) / 100;
    const risk = (direct + overhead) * Number(model.riskRate || 0) / 100;
    const fullCost = direct + overhead + risk;
    const floorPrice = fullCost / Math.max(0.01, 1 - 0.10);
    const recommendedPrice = fullCost / Math.max(0.01, 1 - Number(model.targetMargin || 0) / 100);
    const strategicPrice = recommendedPrice * (1 + Number(model.strategicPremium || 0) / 100);
    const expectedProfit = recommendedPrice - fullCost;
    const competitorGap = Number(model.competitorPrice || 0) - recommendedPrice;
    const marketAdjustment = competitorGap >= 0 ? 4 : -Math.min(12, Math.abs(competitorGap) / Math.max(recommendedPrice, 1) * 100);
    const priceFit = Math.max(0, Math.min(100, Number(model.winStrength || 0) + marketAdjustment));
    const riskScore = Math.min(100, Number(model.riskRate || 0) * 7 + Number(model.overheadRate || 0) * 2);
    return { direct, overhead, risk, fullCost, floorPrice, recommendedPrice, strategicPrice, expectedProfit, competitorGap, priceFit, riskScore };
  }, [model]);

  const update = (key, value) => setModel((current) => ({ ...current, [key]: value }));

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
    toast.success("تم حفظ نموذج التسعير في الذاكرة المؤسسية");
  };

  const recommendation = calc.priceFit >= 75
    ? "اعتماد السعر الموصى به مع إبقاء مساحة تفاوض لا تتجاوز 3%، وإبراز القيمة الاستراتيجية ونقل المعرفة في العرض."
    : calc.priceFit >= 60
      ? "تقديم السعر الموصى به في باقة أساسية، مع باقة بديلة أقل نطاقاً لحماية احتمالية الفوز والهامش."
      : "إعادة هندسة النطاق والتكلفة قبل التقديم؛ الفجوة الحالية قد تضعف القدرة التنافسية أو تضغط الربحية.";

  const scenarios = [
    { name: "تحفظي", price: calc.floorPrice, margin: 10, tone: "amber" },
    { name: "موصى به", price: calc.recommendedPrice, margin: Number(model.targetMargin || 0), tone: "emerald" },
    { name: "استراتيجي", price: calc.strategicPrice, margin: ((calc.strategicPrice - calc.fullCost) / Math.max(calc.strategicPrice, 1)) * 100, tone: "cyan" },
  ];

  return (
    <div dir="rtl" className="space-y-6 pb-24" data-testid="pricing-intelligence-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">منهجية التسعير التنفيذي</div>
          <h1 className="mt-2 flex items-center gap-3 font-heading text-4xl font-black text-slate-100"><Calculator className="text-yellow-400" /> مركز ذكاء التسعير</h1>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-500">تحليل التكلفة والسعر واحتمالية الفوز والمخاطر والربحية، ثم إصدار توصية وعرض سعر قابل للمراجعة.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate("/presidential-advisor")} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/10"><ArrowRight size={17} /> العودة للمستشار</button>
          <button onClick={save} className="flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-yellow-400"><Save size={17} /> حفظ النموذج</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="التكلفة الكاملة" value={money(calc.fullCost)} icon={Calculator} />
        <Stat label="السعر الموصى به" value={money(calc.recommendedPrice)} icon={TrendingUp} tone="emerald" />
        <Stat label="الربح المتوقع" value={money(calc.expectedProfit)} icon={Coins} tone="cyan" />
        <Stat label="احتمالية الفوز" value={`${Math.round(calc.priceFit)}%`} icon={Target} tone={calc.priceFit >= 70 ? "emerald" : "rose"} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Panel className="xl:col-span-4">
          <h2 className="font-heading text-lg font-black text-slate-100">بيانات المشروع</h2>
          <div className="mt-4 space-y-4">
            <Field label="اسم المشروع"><input className="field-control" value={model.projectName} onChange={(event) => update("projectName", event.target.value)} /></Field>
            <Field label="العميل"><input className="field-control" value={model.client} onChange={(event) => update("client", event.target.value)} /></Field>
            <Field label="التكلفة المباشرة"><input type="number" className="field-control" value={model.directCost} onChange={(event) => update("directCost", event.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="المصاريف غير المباشرة %"><input type="number" className="field-control" value={model.overheadRate} onChange={(event) => update("overheadRate", event.target.value)} /></Field><Field label="احتياطي المخاطر %"><input type="number" className="field-control" value={model.riskRate} onChange={(event) => update("riskRate", event.target.value)} /></Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="هامش الربح المستهدف %"><input type="number" className="field-control" value={model.targetMargin} onChange={(event) => update("targetMargin", event.target.value)} /></Field><Field label="علاوة القيمة الاستراتيجية %"><input type="number" className="field-control" value={model.strategicPremium} onChange={(event) => update("strategicPremium", event.target.value)} /></Field></div>
            <Field label="السعر المرجعي للمنافس"><input type="number" className="field-control" value={model.competitorPrice} onChange={(event) => update("competitorPrice", event.target.value)} /></Field>
            <Field label="قوة العرض غير السعرية %"><input type="number" min="0" max="100" className="field-control" value={model.winStrength} onChange={(event) => update("winStrength", event.target.value)} /></Field>
          </div>
        </Panel>

        <div className="space-y-5 xl:col-span-8">
          <Panel className="p-3"><div className="flex flex-wrap gap-2">{tabs.map(([key, Icon, label]) => <button key={key} onClick={() => setActiveTab(key)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${activeTab === key ? "bg-yellow-500 text-black" : "border border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-100"}`}><Icon size={16} /> {label}</button>)}</div></Panel>

          {activeTab === "cost" && <Panel><h2 className="font-heading text-xl font-black text-slate-100">تحليل التكلفة</h2><div className="mt-5 space-y-3">{[["التكلفة المباشرة", calc.direct], ["المصاريف غير المباشرة", calc.overhead], ["احتياطي المخاطر", calc.risk], ["التكلفة الكاملة", calc.fullCost]].map(([label, value], index) => <div key={label} className={`flex items-center justify-between rounded-xl border p-4 ${index === 3 ? "border-yellow-500/25 bg-yellow-500/10" : "border-white/10 bg-black/20"}`}><span className="text-sm text-slate-400">{label}</span><span className="font-black text-slate-100">{money(value)}</span></div>)}</div></Panel>}

          {activeTab === "price" && <Panel><h2 className="font-heading text-xl font-black text-slate-100">تقدير السعر</h2><div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">{scenarios.map((scenario) => <div key={scenario.name} className={`rounded-2xl border p-5 ${scenario.name === "موصى به" ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-black/20"}`}><Badge tone={scenario.tone}>{scenario.name}</Badge><div className="mt-4 text-2xl font-black text-slate-100">{money(scenario.price)}</div><div className="mt-2 text-xs text-slate-500">هامش تقريبي {scenario.margin.toFixed(1)}%</div></div>)}</div></Panel>}

          {activeTab === "win" && <Panel><div className="flex items-center justify-between"><div><h2 className="font-heading text-xl font-black text-slate-100">احتمالية الفوز</h2><p className="mt-1 text-xs text-slate-500">مزيج من قوة العرض والمواءمة السعرية</p></div><span className="text-4xl font-black text-yellow-300">{Math.round(calc.priceFit)}%</span></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-l from-yellow-500 to-emerald-400" style={{ width: `${calc.priceFit}%` }} /></div><p className="mt-5 text-sm leading-7 text-slate-300">الفجوة عن السعر المرجعي للمنافس: <strong className={calc.competitorGap >= 0 ? "text-emerald-300" : "text-rose-300"}>{money(calc.competitorGap)}</strong>. كلما كانت الفجوة موجبة مع قوة عرض جيدة، ارتفعت قابلية الفوز دون التضحية بالهامش.</p></Panel>}

          {activeTab === "risk" && <Panel><h2 className="font-heading text-xl font-black text-slate-100">تحليل المخاطر</h2><div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3"><div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4"><AlertTriangle className="text-rose-300" /><h3 className="mt-3 font-bold text-slate-100">ضغط التكلفة</h3><p className="mt-2 text-xs leading-6 text-slate-400">مؤشر المخاطر الحالي {Math.round(calc.riskScore)} من 100.</p></div><div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4"><Gauge className="text-amber-300" /><h3 className="mt-3 font-bold text-slate-100">مرونة التفاوض</h3><p className="mt-2 text-xs leading-6 text-slate-400">السعر الأدنى الآمن تقريباً {money(calc.floorPrice)}.</p></div><div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4"><BarChart3 className="text-cyan-300" /><h3 className="mt-3 font-bold text-slate-100">السوق</h3><p className="mt-2 text-xs leading-6 text-slate-400">راجع صلاحية السعر المرجعي ومصدره قبل الاعتماد.</p></div></div></Panel>}

          {activeTab === "profit" && <Panel><h2 className="font-heading text-xl font-black text-slate-100">سيناريوهات الربحية</h2><div className="mt-5 space-y-3">{scenarios.map((scenario) => { const profit = scenario.price - calc.fullCost; return <div key={scenario.name} className="grid grid-cols-3 items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4"><div><Badge tone={scenario.tone}>{scenario.name}</Badge></div><div className="text-center"><div className="text-[10px] text-slate-500">الإيراد</div><div className="mt-1 font-bold text-slate-100">{money(scenario.price)}</div></div><div className="text-left"><div className="text-[10px] text-slate-500">الربح</div><div className="mt-1 font-black text-emerald-300">{money(profit)}</div></div></div>; })}</div></Panel>}

          {activeTab === "ai" && <Panel><div className="flex items-center gap-2"><BrainCircuit className="text-yellow-400" /><h2 className="font-heading text-xl font-black text-slate-100">التوصية التنفيذية</h2></div><div className="mt-5 rounded-2xl border border-yellow-500/25 bg-yellow-500/10 p-5"><p className="text-sm leading-8 text-slate-200">{recommendation}</p></div><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"><div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-slate-500">السعر المقترح</div><div className="mt-2 font-black text-yellow-300">{money(calc.recommendedPrice)}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-slate-500">حد التفاوض</div><div className="mt-2 font-black text-slate-100">3%</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-slate-500">قرار التقديم</div><div className="mt-2 font-black text-emerald-300">تقديم مشروط</div></div></div></Panel>}

          {activeTab === "memory" && <Panel><div className="flex items-center gap-2"><Database className="text-yellow-400" /><h2 className="font-heading text-xl font-black text-slate-100">ذاكرة التسعير</h2></div><p className="mt-4 text-sm leading-7 text-slate-400">يحفظ النموذج محلياً داخل المنصة، ويمكن استخدامه كنقطة مرجعية عند تسعير فرص مشابهة ومقارنة الهوامش ومؤشرات الفوز.</p><button onClick={save} className="mt-5 flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-3 text-sm font-bold text-yellow-300"><Save size={17} /> تثبيت النموذج الحالي في الذاكرة</button></Panel>}

          {activeTab === "proposal" && <Panel><div className="flex items-center justify-between gap-3"><div><h2 className="font-heading text-xl font-black text-slate-100">مسودة عرض السعر</h2><p className="mt-1 text-xs text-slate-500">معاينة تنفيذية قابلة للنقل إلى الوثيقة الرسمية</p></div><Badge tone="yellow">مسودة</Badge></div><div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-6"><div className="text-xs text-yellow-500/80">عرض مالي وفني</div><h3 className="mt-2 text-2xl font-black text-slate-100">{model.projectName}</h3><p className="mt-1 text-sm text-slate-500">مقدم إلى: {model.client}</p><p className="mt-5 text-sm leading-8 text-slate-300">{model.notes}</p><div className="mt-6 flex items-end justify-between gap-4 border-t border-white/10 pt-5"><div><div className="text-xs text-slate-500">القيمة المقترحة قبل الضريبة</div><div className="mt-2 text-3xl font-black text-yellow-300">{money(calc.recommendedPrice)}</div></div><div className="text-left text-xs leading-6 text-slate-500">صلاحية العرض: 30 يوماً<br />الدفعات والمراحل تحدد في العرض النهائي</div></div></div></Panel>}
        </div>
      </div>
    </div>
  );
}
