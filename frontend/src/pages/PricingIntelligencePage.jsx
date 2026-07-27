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
  FileSearch,
  FileText,
  Gauge,
  Loader2,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import IntelligenceFilePicker from "../components/IntelligenceFilePicker";
import { uploadIntelligenceFile } from "../lib/intelligenceFiles";

const STORAGE_KEY = "nexgen-pricing-intelligence-v2";

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
  ["sources", FileSearch, "تحليل الملفات"],
  ["cost", Calculator, "تحليل التكلفة"],
  ["price", TrendingUp, "تقدير السعر"],
  ["win", Target, "احتمالية الفوز"],
  ["risk", AlertTriangle, "تحليل المخاطر"],
  ["profit", Coins, "سيناريوهات الربحية"],
  ["ai", BrainCircuit, "التوصية التنفيذية"],
  ["memory", Database, "ذاكرة التسعير"],
  ["proposal", FileText, "عرض السعر"],
];

const CURRENCY_LABELS = {
  SAR: "ر.س",
  USD: "USD",
  AED: "AED",
  EUR: "EUR",
  GBP: "GBP",
  XOF: "FCFA",
};

function formatNumber(value) {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function money(value, currency = "SAR") {
  return `${formatNumber(value)} ${CURRENCY_LABELS[currency] || currency || "ر.س"}`;
}

function Panel({ children, className = "" }) {
  return <div className={`glass-card rounded-2xl border border-white/10 p-5 ${className}`}>{children}</div>;
}

function Stat({ label, value, icon: Icon, tone = "yellow", note = "" }) {
  const tones = {
    yellow: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };
  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-black text-slate-100">{value}</div>
          {note && <div className="mt-2 text-[10px] leading-5 text-slate-500">{note}</div>}
        </div>
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

function readStoredState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored) return { model: defaultModel, analysis: null, uploadedDocuments: [] };
    if (stored.model) {
      return {
        model: { ...defaultModel, ...stored.model },
        analysis: stored.analysis || null,
        uploadedDocuments: stored.uploadedDocuments || [],
      };
    }
    return { model: { ...defaultModel, ...stored }, analysis: null, uploadedDocuments: [] };
  } catch {
    return { model: defaultModel, analysis: null, uploadedDocuments: [] };
  }
}

export default function PricingIntelligencePage() {
  const navigate = useNavigate();
  const stored = useMemo(readStoredState, []);
  const [activeTab, setActiveTab] = useState(stored.analysis ? "sources" : "cost");
  const [model, setModel] = useState(stored.model);
  const [analysis, setAnalysis] = useState(stored.analysis);
  const [uploadedDocuments, setUploadedDocuments] = useState(stored.uploadedDocuments);
  const [files, setFiles] = useState([]);
  const [analysing, setAnalysing] = useState(false);

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ model, analysis, uploadedDocuments }));
    toast.success("تم حفظ نموذج التسعير وتحليل الملفات في الذاكرة المؤسسية");
  };

  const analyseFiles = async () => {
    if (!files.length) {
      toast.error("اختر ملف عرض أو تكلفة واحدًا على الأقل");
      return;
    }
    setAnalysing(true);
    try {
      const documents = [];
      const referenceId = `pricing-${Date.now()}`;
      for (const file of files) {
        const uploaded = await uploadIntelligenceFile(file, {
          title: `${model.projectName || "تحليل تسعير"} — ${file.name}`,
          description: model.notes,
          category: "report",
          purpose: "pricing",
          reference_id: referenceId,
          is_public: false,
        });
        documents.push(uploaded);
      }

      const response = await api.post("/pricing/analyse-documents", {
        document_ids: documents.map((item) => item.id),
        project_name: model.projectName,
        client: model.client,
        target_margin: Number(model.targetMargin || 18),
        overhead_rate: Number(model.overheadRate || 8),
        risk_rate: Number(model.riskRate || 6),
        win_strength: Number(model.winStrength || 75),
      }, { timeout: 90000 });

      const result = { ...response.data, documents };
      const patch = result.model_patch || {};
      setAnalysis(result);
      setUploadedDocuments(documents);
      setModel((current) => ({
        ...current,
        competitorPrice: Number(patch.competitorPrice || current.competitorPrice || 0),
        directCost: Number(patch.directCost || current.directCost || 0),
        winStrength: Number(patch.winStrength || current.winStrength || 0),
      }));
      setFiles([]);
      setActiveTab("sources");
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        model: {
          ...model,
          competitorPrice: Number(patch.competitorPrice || model.competitorPrice || 0),
          directCost: Number(patch.directCost || model.directCost || 0),
          winStrength: Number(patch.winStrength || model.winStrength || 0),
        },
        analysis: result,
        uploadedDocuments: documents,
      }));
      toast.success(`تمت قراءة ${documents.length} ملف ومقارنة الأسعار وبناء العرض التنافسي`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "تعذر تحليل ملفات التسعير");
    } finally {
      setAnalysing(false);
    }
  };

  const recommendation = analysis?.recommendation || (calc.priceFit >= 75
    ? "اعتماد السعر الموصى به مع إبقاء مساحة تفاوض لا تتجاوز 3%، وإبراز القيمة الاستراتيجية ونقل المعرفة في العرض."
    : calc.priceFit >= 60
      ? "تقديم السعر الموصى به في باقة أساسية، مع باقة بديلة أقل نطاقاً لحماية احتمالية الفوز والهامش."
      : "إعادة هندسة النطاق والتكلفة قبل التقديم؛ الفجوة الحالية قد تضعف القدرة التنافسية أو تضغط الربحية.");

  const scenarios = analysis?.offer_options?.length
    ? analysis.offer_options.map((item, index) => ({
        name: item.name,
        price: item.price,
        margin: ((Number(item.price || 0) - calc.fullCost) / Math.max(Number(item.price || 0), 1)) * 100,
        tone: index === 0 ? "amber" : index === 1 ? "emerald" : "cyan",
        purpose: item.purpose,
      }))
    : [
        { name: "تحفظي", price: calc.floorPrice, margin: 10, tone: "amber", purpose: "حماية الحد الأدنى الآمن" },
        { name: "موصى به", price: calc.recommendedPrice, margin: Number(model.targetMargin || 0), tone: "emerald", purpose: "أفضل توازن بين الهامش والفوز" },
        { name: "استراتيجي", price: calc.strategicPrice, margin: ((calc.strategicPrice - calc.fullCost) / Math.max(calc.strategicPrice, 1)) * 100, tone: "cyan", purpose: "قيمة مضافة ونطاق أوسع" },
      ];

  const resultCurrency = analysis?.currency || "SAR";
  const recommendedDisplayPrice = analysis?.recommended_price || calc.recommendedPrice;
  const probability = analysis?.win_probability ?? calc.priceFit;

  return (
    <div dir="rtl" className="space-y-6 pb-24" data-testid="pricing-intelligence-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">منهجية التسعير التنفيذي</div>
          <h1 className="mt-2 flex items-center gap-3 font-heading text-4xl font-black text-slate-100"><Calculator className="text-yellow-400" /> مركز ذكاء التسعير</h1>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-500">رفع عروض المنافسين وجداول التكاليف، قراءة القيم ومقارنتها، ثم إعداد باقات سعرية وحد تفاوض وعرض تنافسي قابل للمراجعة.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate("/presidential-advisor")} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/10"><ArrowRight size={17} /> العودة للمستشار</button>
          <button onClick={save} className="flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-yellow-400"><Save size={17} /> حفظ النموذج</button>
        </div>
      </div>

      <Panel className="border-yellow-500/20 bg-gradient-to-l from-yellow-500/[0.06] to-cyan-500/[0.03]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-yellow-300"><UploadCloud size={20} /><h2 className="font-heading text-xl font-black">رفع وتحليل عروض الأسعار والتكاليف</h2></div>
            <p className="mt-2 text-xs leading-6 text-slate-400">ارفع عدة عروض منافسين، عرضًا سابقًا، جدول تكلفة، نطاق أعمال أو طلب تقديم عروض. سيستخرج النظام الأرقام والعملات والمؤشرات ويقارنها تلقائيًا.</p>
          </div>
          <div className="w-full xl:max-w-2xl">
            <IntelligenceFilePicker files={files} onChange={setFiles} compact />
            <button onClick={analyseFiles} disabled={analysing || !files.length} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-yellow-500 to-yellow-600 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50">
              {analysing ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
              {analysing ? "جارٍ قراءة الملفات ومقارنة الأسعار..." : "قراءة وتحليل وبناء العرض التنافسي"}
            </button>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="التكلفة الكاملة" value={money(calc.fullCost)} icon={Calculator} note={analysis ? "يشمل التكلفة المستخرجة أو المدخلة والاحتياطيات" : "وفق المدخلات الحالية"} />
        <Stat label="السعر التنافسي الموصى به" value={money(recommendedDisplayPrice, resultCurrency)} icon={TrendingUp} tone="emerald" note={analysis ? `ثقة التحليل ${analysis.confidence || 0}%` : "وفق نموذج التكلفة والهامش"} />
        <Stat label="حد التفاوض الآمن" value={money(analysis?.negotiation_floor || calc.floorPrice, resultCurrency)} icon={ShieldCheck} tone="cyan" note="لا يوصى بالنزول عنه دون خفض النطاق" />
        <Stat label="احتمالية الفوز" value={`${Math.round(probability)}%`} icon={Target} tone={probability >= 70 ? "emerald" : "rose"} note={analysis ? `عينة المقارنة ${analysis.benchmark?.sample_size || 0} ملف سعري` : "قوة العرض والمواءمة السعرية"} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Panel className="xl:col-span-4">
          <h2 className="font-heading text-lg font-black text-slate-100">بيانات المشروع والنموذج</h2>
          <div className="mt-4 space-y-4">
            <Field label="اسم المشروع"><input className="field-control" value={model.projectName} onChange={(event) => update("projectName", event.target.value)} /></Field>
            <Field label="العميل"><input className="field-control" value={model.client} onChange={(event) => update("client", event.target.value)} /></Field>
            <Field label="التكلفة المباشرة"><input type="number" className="field-control" value={model.directCost} onChange={(event) => update("directCost", event.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="المصاريف غير المباشرة %"><input type="number" className="field-control" value={model.overheadRate} onChange={(event) => update("overheadRate", event.target.value)} /></Field><Field label="احتياطي المخاطر %"><input type="number" className="field-control" value={model.riskRate} onChange={(event) => update("riskRate", event.target.value)} /></Field></div>
            <div className="grid grid-cols-2 gap-3"><Field label="هامش الربح المستهدف %"><input type="number" className="field-control" value={model.targetMargin} onChange={(event) => update("targetMargin", event.target.value)} /></Field><Field label="علاوة القيمة الاستراتيجية %"><input type="number" className="field-control" value={model.strategicPremium} onChange={(event) => update("strategicPremium", event.target.value)} /></Field></div>
            <Field label="السعر المرجعي للمنافس"><input type="number" className="field-control" value={model.competitorPrice} onChange={(event) => update("competitorPrice", event.target.value)} /></Field>
            <Field label="قوة العرض غير السعرية %"><input type="number" min="0" max="100" className="field-control" value={model.winStrength} onChange={(event) => update("winStrength", event.target.value)} /></Field>
            <Field label="النطاق وملاحظات القيمة"><textarea className="field-control min-h-28 resize-y" value={model.notes} onChange={(event) => update("notes", event.target.value)} /></Field>
          </div>
        </Panel>

        <div className="space-y-5 xl:col-span-8">
          <Panel className="p-3"><div className="flex flex-wrap gap-2">{tabs.map(([key, Icon, label]) => <button key={key} onClick={() => setActiveTab(key)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${activeTab === key ? "bg-yellow-500 text-black" : "border border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-100"}`}><Icon size={16} /> {label}</button>)}</div></Panel>

          {activeTab === "sources" && (
            <div className="space-y-5">
              {!analysis ? (
                <Panel><div className="py-10 text-center"><FileSearch className="mx-auto text-slate-600" size={36} /><h2 className="mt-4 font-heading text-xl font-black text-slate-200">لم يتم تحليل ملفات بعد</h2><p className="mt-2 text-sm text-slate-500">ارفع عروضًا أو جداول تكلفة من القسم العلوي لبدء المقارنة.</p></div></Panel>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <Panel><div className="text-[10px] text-slate-500">أدنى عرض مرصود</div><div className="mt-2 text-xl font-black text-slate-100">{money(analysis.benchmark?.minimum, resultCurrency)}</div></Panel>
                    <Panel><div className="text-[10px] text-slate-500">وسيط السوق</div><div className="mt-2 text-xl font-black text-yellow-300">{money(analysis.benchmark?.median, resultCurrency)}</div></Panel>
                    <Panel><div className="text-[10px] text-slate-500">أعلى عرض مرصود</div><div className="mt-2 text-xl font-black text-slate-100">{money(analysis.benchmark?.maximum, resultCurrency)}</div></Panel>
                    <Panel><div className="text-[10px] text-slate-500">درجة الثقة</div><div className="mt-2 text-xl font-black text-cyan-300">{analysis.confidence || 0}%</div></Panel>
                  </div>

                  <Panel>
                    <div className="mb-4 flex items-center justify-between"><Badge tone="cyan">{analysis.files?.length || 0} ملفات مقروءة</Badge><div><h2 className="font-heading text-xl font-black text-slate-100">تفصيل المقارنات المستخرجة</h2><p className="mt-1 text-xs text-slate-500">يعرض السعر التمثيلي والتكلفة والأرقام المكتشفة في كل ملف</p></div></div>
                    <div className="space-y-3">{(analysis.files || []).map((item, index) => <div key={`${item.document_id}-${index}`} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div className="flex gap-2"><Badge tone={item.representative_price > 0 ? "emerald" : "rose"}>{item.amount_count || 0} قيمة</Badge>{item.warning && <Badge tone="amber">تنبيه قراءة</Badge>}</div><div className="text-right"><h3 className="text-sm font-black text-slate-100">{item.filename || item.title}</h3><p className="mt-1 text-[10px] text-slate-500">سعر تمثيلي: {money(item.representative_price, resultCurrency)} • تكلفة مكتشفة: {money(item.detected_cost, resultCurrency)}</p></div></div>{item.warning && <p className="mt-3 rounded-lg border border-amber-500/15 bg-amber-500/[0.05] p-2 text-[10px] leading-5 text-amber-200">{item.warning}</p>}<div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">{(item.amounts || []).slice(0, 4).map((amount, amountIndex) => <div key={amountIndex} className="rounded-lg border border-white/5 bg-white/[0.02] p-2"><div className="text-[9px] text-slate-500">{amount.kind === "cost" ? "تكلفة" : amount.kind === "total" ? "إجمالي" : amount.kind === "quote" ? "سعر عرض" : "قيمة"}</div><div className="mt-1 text-xs font-bold text-slate-200">{money(amount.value, amount.currency || resultCurrency)}</div></div>)}</div></div>)}</div>
                  </Panel>
                </>
              )}
            </div>
          )}

          {activeTab === "cost" && <Panel><h2 className="font-heading text-xl font-black text-slate-100">تحليل التكلفة</h2><div className="mt-5 space-y-3">{[["التكلفة المباشرة", calc.direct], ["المصاريف غير المباشرة", calc.overhead], ["احتياطي المخاطر", calc.risk], ["التكلفة الكاملة", calc.fullCost]].map(([label, value], index) => <div key={label} className={`flex items-center justify-between rounded-xl border p-4 ${index === 3 ? "border-yellow-500/25 bg-yellow-500/10" : "border-white/10 bg-black/20"}`}><span className="text-sm text-slate-400">{label}</span><span className="font-black text-slate-100">{money(value)}</span></div>)}</div>{analysis?.cost && <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4"><div className="text-xs font-bold text-cyan-300">قراءة الملفات</div><p className="mt-2 text-xs leading-6 text-slate-400">التكلفة المباشرة المكتشفة: {money(analysis.cost.detected_direct_cost, resultCurrency)} • التكلفة التقديرية: {money(analysis.cost.estimated_direct_cost, resultCurrency)} • الحد الأدنى الآمن: {money(analysis.cost.safe_floor, resultCurrency)}</p></div>}</Panel>}

          {activeTab === "price" && <Panel><div className="flex items-center justify-between gap-3"><Badge tone={analysis ? "cyan" : "slate"}>{analysis ? "مبني على الملفات" : "مبني على المدخلات"}</Badge><h2 className="font-heading text-xl font-black text-slate-100">خيارات العرض التنافسي</h2></div><div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">{scenarios.map((scenario) => <div key={scenario.name} className={`rounded-2xl border p-5 ${scenario.tone === "emerald" ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-black/20"}`}><Badge tone={scenario.tone}>{scenario.name}</Badge><div className="mt-4 text-2xl font-black text-slate-100">{money(scenario.price, resultCurrency)}</div><div className="mt-2 text-xs text-slate-500">هامش تقريبي {Number(scenario.margin || 0).toFixed(1)}%</div><p className="mt-3 text-[11px] leading-5 text-slate-400">{scenario.purpose}</p></div>)}</div></Panel>}

          {activeTab === "win" && <Panel><div className="flex items-center justify-between"><div><h2 className="font-heading text-xl font-black text-slate-100">احتمالية الفوز</h2><p className="mt-1 text-xs text-slate-500">مزيج من قوة العرض والمواءمة السعرية وبيانات المقارنة</p></div><span className="text-4xl font-black text-yellow-300">{Math.round(probability)}%</span></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-l from-yellow-500 to-emerald-400" style={{ width: `${probability}%` }} /></div><p className="mt-5 text-sm leading-7 text-slate-300">الفجوة عن المؤشر المرجعي: <strong className={(analysis?.competitive_gap ?? calc.competitorGap) >= 0 ? "text-emerald-300" : "text-rose-300"}>{money(analysis?.competitive_gap ?? calc.competitorGap, resultCurrency)}</strong>. الميزة السعرية التقديرية: <strong className="text-cyan-300">{analysis?.price_advantage_percent ?? 0}%</strong>.</p></Panel>}

          {activeTab === "risk" && <Panel><h2 className="font-heading text-xl font-black text-slate-100">تحليل المخاطر</h2><div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3"><div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4"><AlertTriangle className="text-rose-300" /><h3 className="mt-3 font-bold text-slate-100">ضغط التكلفة</h3><p className="mt-2 text-xs leading-6 text-slate-400">مؤشر المخاطر الحالي {Math.round(calc.riskScore)} من 100.</p></div><div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4"><Gauge className="text-amber-300" /><h3 className="mt-3 font-bold text-slate-100">مرونة التفاوض</h3><p className="mt-2 text-xs leading-6 text-slate-400">حد التفاوض الآمن {money(analysis?.negotiation_floor || calc.floorPrice, resultCurrency)}.</p></div><div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4"><BarChart3 className="text-cyan-300" /><h3 className="mt-3 font-bold text-slate-100">جودة البيانات</h3><p className="mt-2 text-xs leading-6 text-slate-400">ثقة التحليل {analysis?.confidence || 0}%، وترتفع بإضافة عروض حديثة وجداول تكلفة مفصلة.</p></div></div></Panel>}

          {activeTab === "profit" && <Panel><h2 className="font-heading text-xl font-black text-slate-100">سيناريوهات الربحية</h2><div className="mt-5 space-y-3">{scenarios.map((scenario) => { const profit = Number(scenario.price || 0) - calc.fullCost; return <div key={scenario.name} className="grid grid-cols-3 items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4"><div><Badge tone={scenario.tone}>{scenario.name}</Badge></div><div className="text-center"><div className="text-[10px] text-slate-500">الإيراد</div><div className="mt-1 font-bold text-slate-100">{money(scenario.price, resultCurrency)}</div></div><div className="text-left"><div className="text-[10px] text-slate-500">الربح</div><div className={`mt-1 font-black ${profit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{money(profit, resultCurrency)}</div></div></div>; })}</div></Panel>}

          {activeTab === "ai" && <Panel><div className="flex items-center gap-2"><BrainCircuit className="text-yellow-400" /><h2 className="font-heading text-xl font-black text-slate-100">التوصية التنفيذية</h2></div><div className="mt-5 rounded-2xl border border-yellow-500/25 bg-yellow-500/10 p-5"><p className="text-sm leading-8 text-slate-200">{recommendation}</p></div><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"><div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-slate-500">السعر المقترح</div><div className="mt-2 font-black text-yellow-300">{money(recommendedDisplayPrice, resultCurrency)}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-slate-500">حد التفاوض</div><div className="mt-2 font-black text-slate-100">{money(analysis?.negotiation_floor || calc.floorPrice, resultCurrency)}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-slate-500">قرار التقديم</div><div className="mt-2 font-black text-emerald-300">{probability >= 70 ? "تقديم موصى به" : "تقديم مشروط"}</div></div></div></Panel>}

          {activeTab === "memory" && <Panel><div className="flex items-center gap-2"><Database className="text-yellow-400" /><h2 className="font-heading text-xl font-black text-slate-100">ذاكرة التسعير</h2></div><p className="mt-4 text-sm leading-7 text-slate-400">يحفظ النظام النموذج والتحليل والملفات المرجعية محليًا، بينما تبقى الملفات الأصلية والتحليل المسجل في الذاكرة المؤسسية للمنصة.</p><div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"><div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-[10px] text-slate-500">ملفات مرجعية</div><div className="mt-2 text-xl font-black text-slate-100">{uploadedDocuments.length}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-[10px] text-slate-500">عينات سعرية</div><div className="mt-2 text-xl font-black text-slate-100">{analysis?.benchmark?.sample_size || 0}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-[10px] text-slate-500">آخر ثقة</div><div className="mt-2 text-xl font-black text-cyan-300">{analysis?.confidence || 0}%</div></div></div><button onClick={save} className="mt-5 flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-3 text-sm font-bold text-yellow-300"><Save size={17} /> تثبيت النموذج والتحليل الحالي</button></Panel>}

          {activeTab === "proposal" && <Panel><div className="flex items-center justify-between gap-3"><div><h2 className="font-heading text-xl font-black text-slate-100">مسودة العرض التنافسي</h2><p className="mt-1 text-xs text-slate-500">معاينة تنفيذية تتضمن باقة موصى بها وبدائل تفاوضية</p></div><Badge tone="yellow">مسودة</Badge></div><div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-6"><div className="text-xs text-yellow-500/80">عرض مالي وفني</div><h3 className="mt-2 text-2xl font-black text-slate-100">{model.projectName}</h3><p className="mt-1 text-sm text-slate-500">مقدم إلى: {model.client}</p><p className="mt-5 text-sm leading-8 text-slate-300">{model.notes}</p><div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">{scenarios.map((scenario) => <div key={scenario.name} className={`rounded-xl border p-4 ${scenario.tone === "emerald" ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-white/[0.02]"}`}><Badge tone={scenario.tone}>{scenario.name}</Badge><div className="mt-3 text-lg font-black text-slate-100">{money(scenario.price, resultCurrency)}</div><p className="mt-2 text-[10px] leading-5 text-slate-500">{scenario.purpose}</p></div>)}</div><div className="mt-6 flex flex-col justify-between gap-4 border-t border-white/10 pt-5 md:flex-row md:items-end"><div><div className="text-xs text-slate-500">القيمة المقترحة قبل الضريبة</div><div className="mt-2 text-3xl font-black text-yellow-300">{money(recommendedDisplayPrice, resultCurrency)}</div></div><div className="text-xs leading-6 text-slate-500">صلاحية العرض: 30 يومًا<br />حد التفاوض الداخلي: {money(analysis?.negotiation_floor || calc.floorPrice, resultCurrency)}<br />الدفعات والمراحل تحدد في العرض النهائي</div></div></div><button type="button" onClick={() => toast.success("تم تجهيز مسودة العرض للمراجعة التنفيذية")} className="mt-4 flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-3 text-sm font-black text-black"><Send size={16} /> اعتماد المسودة للمراجعة</button></Panel>}
        </div>
      </div>
    </div>
  );
}
