import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileSearch,
  Gauge,
  Layers3,
  Loader2,
  MapPinned,
  Plus,
  Radar,
  Save,
  Scale,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import IntelligenceFilePicker from "../components/IntelligenceFilePicker";
import { downloadIntelligenceFile, uploadIntelligenceFile } from "../lib/intelligenceFiles";

const STORAGE_KEY = "nexgen-opportunity-intelligence-v2";

const defaultOpportunity = {
  id: "opp-ain-alkhaif-2026",
  title: "مخطط عين الخيف السكني – المدينة المنورة",
  classification: "مخطط سكني متعدد القطع",
  city: "المدينة المنورة",
  district: "عين الخيف / ميطان",
  askingPrice: 0,
  status: "قيد الدراسة",
  stage: "جمع الأدلة",
  readiness: 58,
  confidence: 54,
  strategicFit: 82,
  objective: "تحديد نموذج التطوير والمنتج السكني الأنسب لكل شريحة مستهدفة، وبناء قرار مرحلي للتطوير أو الشراكة أو التخارج على مستوى المخطط كاملاً.",
  missingData: [
    "المخطط العام المعتمد شاملاً أرقام ومساحات القطع والطرق والخدمات.",
    "المساحة الإجمالية الصافية والإجمالية وعدد القطع وتصنيفها.",
    "سعر العرض وشروط التملك أو الشراكة والدفعات.",
    "تكلفة البنية الأساسية والربط بالخدمات.",
    "بيانات صفقات فعلية حديثة ومقابلات طلب محلية.",
  ],
  evidence: [
    ["رابط الموقع والإحداثيات", "موثق", "مكاني"],
    ["كروكي قطعة مرجعية", "موثق", "فني"],
    ["المخطط العام وحدود جميع القطع", "مفقود", "نظامي"],
    ["سجل الصفقات والأسعار المقارنة", "قيد المراجعة", "سوقي"],
    ["اشتراطات الاستعمال والكثافة والخدمات", "قيد المراجعة", "نظامي"],
    ["سعر الأرض وشروط العرض", "مفقود", "مالي"],
  ],
  scenarios: [
    { name: "المحافظ", score: 74, risk: "منخفض", model: "تطوير البنية الأساسية وطرح القطع السكنية على مراحل مع احتفاظ محدود بقطع استراتيجية.", mix: "قطع فلل + خدمات أساسية + قطع مختارة للاحتفاظ", duration: "24–30 شهراً" },
    { name: "المتوازن", score: 86, risk: "متوسط", model: "بيع جزء من القطع وتطوير منتجات نموذجية على القطع الأعلى قيمة لرفع الهامش.", mix: "فلل + تاون هاوس تجريبي + عمائر محدودة + خدمات حي", duration: "30–36 شهراً" },
    { name: "تعظيم القيمة", score: 79, risk: "مرتفع", model: "تطوير المخطط كوجهة سكنية متكاملة بهوية موحدة ومنتجات ومراحل إطلاق مترابطة.", mix: "فلل متنوعة + تاون هاوس + عمائر مختارة + تجاري وخدمات", duration: "42–54 شهراً" },
  ],
  market: [
    ["عين الخيف", "شقق تمليك عائلية", "125–165 م²", "مؤشر معلن يحتاج تحققاً", "متوسطة"],
    ["ميطان والمخططات القريبة", "فلل ودوبلكسات", "حسب مساحة القطعة", "قيد بناء العينة", "منخفضة"],
    ["نطاق منافس بالمدينة", "تاون هاوس", "منتج بديل للاختبار", "غير محسوم", "منخفضة"],
  ],
  stakeholders: [
    ["المالك", "تعظيم قيمة الأصل وسرعة التسييل أو الشراكة", "مرتفع"],
    ["الرئيس التنفيذي", "الملاءمة الاستراتيجية والعائد والمخاطر", "مرتفع"],
    ["الاستثمار والمالية", "السعر والتمويل والتدفقات والحساسية", "مرتفع"],
    ["الفريق الفني", "قابلية التنفيذ والاشتراطات والكفاءة", "متوسط"],
    ["الجهات التنظيمية والخدمية", "الاستعمالات والخدمات والسلامة", "مرتفع"],
    ["المشتري والمستفيد", "السعر والتمويل والخصوصية والجودة", "متوسط"],
  ],
  risks: [
    ["عدم اكتمال المخطط العام", 20, "تعليق التوصية الكمية حتى استلام المخطط والرفع المساحي"],
    ["الخلط بين أسعار العرض والصفقات", 16, "قاعدة مقارنات متعددة المصادر ودرجة ثقة لكل رصد"],
    ["اختيار المنتج قبل اختبار الطلب", 12, "اختبار المفهوم والسعر على عملاء ووسطاء وممولين"],
    ["تضخم تكلفة البنية الأساسية", 15, "تقديرات مستقلة واحتياطي مخاطر وتنفيذ مرحلي"],
    ["بطء الامتصاص وتعطل التدفقات", 15, "ربط إطلاق المراحل بمؤشرات حجز وتمويل واضحة"],
  ],
  attachments: [],
};

const tabs = [
  ["overview", "غرفة القيادة", Radar],
  ["evidence", "الأدلة والملفات", FileSearch],
  ["market", "السوق والمعرفة", Database],
  ["scenarios", "السيناريوهات", Layers3],
  ["stakeholders", "الأطراف والمخاطر", Users],
  ["decision", "مذكرة القرار", Scale],
];

const classifications = [
  "مخطط سكني متعدد القطع",
  "قطعة تطوير مفردة",
  "أرض خام",
  "مجمع سكني",
  "مشروع متعدد الاستخدامات",
  "فرصة صناعية",
  "فرصة تعليمية",
  "فرصة تقنية",
  "استحواذ أو شراكة",
];

function Panel({ children, className = "" }) {
  return <div className={`glass-card rounded-2xl border border-white/10 p-5 shadow-xl ${className}`}>{children}</div>;
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

function Progress({ value, tone = "yellow" }) {
  const gradients = { yellow: "from-yellow-500 to-amber-300", cyan: "from-cyan-500 to-blue-400", emerald: "from-emerald-500 to-lime-400", rose: "from-rose-500 to-orange-400" };
  return <div className="h-2 overflow-hidden rounded-full bg-white/5"><div className={`h-full rounded-full bg-gradient-to-l ${gradients[tone]}`} style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} /></div>;
}

function Metric({ label, value, icon: Icon, tone = "yellow" }) {
  const tones = { yellow: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", rose: "text-rose-400 bg-rose-500/10 border-rose-500/20" };
  return <Panel><div className="flex items-start justify-between gap-3"><div><div className="text-xs text-slate-500">{label}</div><div className="mt-2 text-3xl font-black text-slate-100">{value}</div></div><div className={`rounded-xl border p-3 ${tones[tone]}`}><Icon size={20} /></div></div></Panel>;
}

function emptyForm() {
  return { title: "", classification: classifications[0], city: "", district: "", objective: "", askingPrice: "" };
}

function readLocal() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) && stored.length ? stored : [defaultOpportunity];
  } catch {
    return [defaultOpportunity];
  }
}

export default function OpportunityIntelligencePage() {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState(readLocal);
  const [selectedId, setSelectedId] = useState(() => readLocal()[0]?.id);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const current = opportunities.find((item) => item.id === selectedId) || opportunities[0] || defaultOpportunity;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opportunities));
  }, [opportunities]);

  useEffect(() => {
    let cancelled = false;
    api.get("/opportunities").then((response) => {
      if (cancelled) return;
      const items = Array.isArray(response.data) ? response.data : [];
      if (items.length) {
        setOpportunities(items);
        setSelectedId((currentId) => items.some((item) => item.id === currentId) ? currentId : items[0].id);
      }
    }).catch(() => {}).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const bestScenario = useMemo(() => [...(current.scenarios || [])].sort((a, b) => b.score - a.score)[0], [current]);
  const verified = (current.evidence || []).filter((item) => item[1] === "موثق").length;
  const highRisks = (current.risks || []).filter((item) => item[1] >= 16).length;
  const filteredOpportunities = opportunities.filter((item) => `${item.title} ${item.city} ${item.district} ${item.classification}`.toLowerCase().includes(searchQuery.toLowerCase()));

  const updateCurrent = (patch) => setOpportunities((items) => items.map((item) => item.id === current.id ? { ...item, ...patch } : item));

  const saveCurrent = async () => {
    try {
      const response = await api.patch(`/opportunities/${current.id}`, current);
      updateCurrent(response.data);
      toast.success("تم حفظ وتحديث دراسة الفرصة");
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(opportunities));
      toast.success("تم حفظ دراسة الفرصة محليًا");
    }
  };

  const createOpportunity = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      let created;
      try {
        const response = await api.post("/opportunities", { ...form, askingPrice: Number(form.askingPrice || 0) });
        created = response.data;
      } catch {
        created = {
          ...defaultOpportunity,
          ...form,
          askingPrice: Number(form.askingPrice || 0),
          id: `opp-${Date.now()}`,
          status: "مسودة",
          stage: "استقبال الفرصة",
          readiness: 15,
          confidence: 10,
          strategicFit: 50,
          evidence: [],
          attachments: [],
        };
      }

      const attachments = [];
      for (const file of files) {
        const uploaded = await uploadIntelligenceFile(file, {
          title: `${created.title} — ${file.name}`,
          description: created.objective,
          category: "report",
          purpose: "opportunity",
          reference_id: created.id,
          is_public: false,
        });
        attachments.push(uploaded);
      }

      if (attachments.length) {
        created = {
          ...created,
          attachments,
          evidence: [
            ...(created.evidence || []),
            ...attachments.map((item) => [item.file_name || item.title, "موثق", "مرفق محلل"]),
          ],
          confidence: Math.min(95, Number(created.confidence || 10) + attachments.length * 8),
          readiness: Math.min(95, Number(created.readiness || 15) + attachments.length * 5),
        };
        try {
          const response = await api.patch(`/opportunities/${created.id}`, created);
          created = response.data;
        } catch {}
      }

      setOpportunities((items) => [created, ...items.filter((item) => item.id !== created.id)]);
      setSelectedId(created.id);
      setActiveTab("overview");
      setShowCreate(false);
      setForm(emptyForm());
      setFiles([]);
      toast.success(attachments.length ? `تم إنشاء الفرصة وربط ${attachments.length} مرفق محلل` : "تم إنشاء الفرصة وإظهارها في المختبر");
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "تعذر إنشاء الفرصة");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCurrent = async () => {
    if (!window.confirm(`حذف الفرصة «${current.title}»؟`)) return;
    try { await api.delete(`/opportunities/${current.id}`); } catch {}
    const remaining = opportunities.filter((item) => item.id !== current.id);
    setOpportunities(remaining.length ? remaining : [defaultOpportunity]);
    setSelectedId((remaining[0] || defaultOpportunity).id);
    toast.success("تم حذف الفرصة");
  };

  const toggleEvidence = (index) => {
    const evidence = (current.evidence || []).map((item, itemIndex) => itemIndex === index ? [item[0], item[1] === "موثق" ? "قيد المراجعة" : "موثق", item[2]] : item);
    updateCurrent({ evidence });
  };

  const downloadAttachment = async (attachment) => {
    try { await downloadIntelligenceFile(attachment); } catch { toast.error("تعذر تنزيل الملف"); }
  };

  return (
    <div dir="rtl" className="space-y-6 pb-24" data-testid="opportunity-intelligence-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">مختبر ذكاء الفرص والعروض</div>
          <h1 className="mt-2 flex items-center gap-3 font-heading text-4xl font-black text-slate-100"><Radar className="text-yellow-400" /> دراسة الفرص والعروض</h1>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-500">إنشاء فرص فعلية، ربط الملفات والأدلة، مقارنة السيناريوهات، ثم إعداد مذكرة قرار قابلة للحفظ والمتابعة.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate("/presidential-advisor")} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-300 hover:bg-white/10"><ArrowRight size={17} /> العودة للمستشار</button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-2.5 text-sm font-bold text-yellow-300 hover:bg-yellow-500/20"><Plus size={17} /> فرصة جديدة</button>
          <button onClick={saveCurrent} className="flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-yellow-400"><Save size={17} /> حفظ الدراسة</button>
          <button onClick={deleteCurrent} className="flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-300"><Trash2 size={16} /> حذف</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[300px_1fr]">
        <Panel className="h-fit xl:sticky xl:top-24">
          <div className="relative mb-4"><Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="البحث في الفرص..." className="field-control pr-10" /></div>
          <div className="mb-3 flex items-center justify-between text-xs"><span className="text-slate-500">الفرص المسجلة</span><Badge tone="yellow">{opportunities.length}</Badge></div>
          <div className="max-h-[620px] space-y-2 overflow-y-auto">
            {filteredOpportunities.map((item) => (
              <button key={item.id} onClick={() => setSelectedId(item.id)} className={`w-full rounded-xl border p-3 text-right transition ${item.id === current.id ? "border-yellow-500/35 bg-yellow-500/10" : "border-white/10 bg-black/20 hover:border-white/20"}`}>
                <div className="text-xs font-black text-slate-100">{item.title}</div>
                <div className="mt-1 text-[10px] text-slate-500">{item.city || "الموقع غير محدد"} • {item.status}</div>
                <div className="mt-3 flex items-center gap-2"><div className="flex-1"><Progress value={item.readiness || 0} /></div><span className="text-[10px] font-bold text-yellow-300">{item.readiness || 0}%</span></div>
              </button>
            ))}
            {loading && <div className="py-5 text-center text-xs text-slate-500">جارٍ تحميل الفرص...</div>}
          </div>
        </Panel>

        <div className="min-w-0 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="جاهزية القرار" value={`${current.readiness || 0}%`} icon={Gauge} />
            <Metric label="الثقة في الأدلة" value={`${current.confidence || 0}%`} icon={ClipboardCheck} tone="cyan" />
            <Metric label="الملاءمة الاستراتيجية" value={`${current.strategicFit || 0}%`} icon={Target} tone="emerald" />
            <Metric label="مخاطر عالية" value={highRisks} icon={AlertTriangle} tone="rose" />
          </div>

          <Panel className="p-3"><div className="flex flex-wrap gap-2">{tabs.map(([key, label, Icon]) => <button key={key} onClick={() => setActiveTab(key)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${activeTab === key ? "bg-yellow-500 text-black" : "border border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-100"}`}><Icon size={16} /> {label}</button>)}</div></Panel>

          {activeTab === "overview" && (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
              <Panel className="xl:col-span-8">
                <div className="flex flex-wrap items-start justify-between gap-4"><div><Badge tone="yellow">{current.classification}</Badge><h2 className="mt-4 font-heading text-2xl font-black text-slate-100">{current.title}</h2><div className="mt-2 flex flex-wrap gap-2"><Badge>{current.city || "الموقع غير محدد"}</Badge><Badge>{current.district || "النطاق غير محدد"}</Badge><Badge tone="cyan">{current.stage}</Badge>{current.askingPrice > 0 && <Badge tone="emerald">سعر العرض: {Number(current.askingPrice).toLocaleString("ar-SA")} ر.س</Badge>}</div></div><Badge tone="amber">{current.status}</Badge></div>
                <p className="mt-5 text-sm leading-8 text-slate-300">{current.objective || "لم يحدد هدف الدراسة بعد."}</p>
                <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">{(current.scenarios || []).map((scenario) => <div key={scenario.name} className={`rounded-2xl border p-4 ${scenario.name === bestScenario?.name ? "border-yellow-500/40 bg-yellow-500/10" : "border-white/10 bg-black/20"}`}><div className="flex items-center justify-between"><Badge tone={scenario.risk === "مرتفع" ? "rose" : scenario.risk === "متوسط" ? "amber" : "emerald"}>{scenario.risk}</Badge><span className="text-2xl font-black text-slate-100">{scenario.score}</span></div><h3 className="mt-3 font-bold text-slate-100">{scenario.name}</h3><p className="mt-2 text-xs leading-6 text-slate-400">{scenario.model}</p><div className="mt-4"><Progress value={scenario.score} tone={scenario.risk === "مرتفع" ? "rose" : "yellow"} /></div></div>)}</div>
              </Panel>
              <Panel className="xl:col-span-4"><div className="flex items-center gap-2"><Sparkles className="text-yellow-400" size={20} /><h2 className="font-heading text-lg font-bold text-slate-100">الإجراء الأعلى أولوية</h2></div><p className="mt-4 text-sm leading-7 text-slate-300">استكمال البيانات الناقصة ورفع المستندات الأساسية قبل تثبيت المزيج أو السعر أو نموذج التنفيذ.</p><div className="mt-4 space-y-2">{(current.missingData || []).map((item, index) => <div key={item} className="flex gap-3 rounded-xl border border-white/5 bg-black/20 p-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-[10px] font-black text-amber-300">{index + 1}</span><p className="text-[11px] leading-5 text-slate-400">{item}</p></div>)}</div></Panel>
            </div>
          )}

          {activeTab === "evidence" && (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
              <Panel className="xl:col-span-7"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-heading text-xl font-black text-slate-100">غرفة أدلة الفرصة</h2><p className="mt-1 text-xs text-slate-500">{verified} من {(current.evidence || []).length} عناصر موثقة — اضغط لتحديث الحالة</p></div><MapPinned className="text-yellow-400" /></div><div className="grid grid-cols-1 gap-3 md:grid-cols-2">{(current.evidence || []).map(([title, status, category], index) => <button key={`${title}-${index}`} onClick={() => toggleEvidence(index)} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-right hover:bg-white/[0.06]"><div><div className="font-bold text-slate-100">{title}</div><div className="mt-1 text-xs text-slate-500">{category}</div></div><Badge tone={status === "موثق" ? "emerald" : status === "مفقود" ? "rose" : "amber"}>{status}</Badge></button>)}</div></Panel>
              <Panel className="xl:col-span-5"><div className="mb-4 flex items-center gap-2"><FileSearch className="text-cyan-300" /><h2 className="font-heading text-lg font-black text-slate-100">المرفقات المقروءة</h2></div>{(current.attachments || []).length ? <div className="space-y-3">{current.attachments.map((attachment) => <div key={attachment.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><button onClick={() => downloadAttachment(attachment)} className="rounded-lg bg-white/5 p-2 text-slate-300 hover:text-yellow-300"><Download size={15} /></button><div className="text-right"><div className="text-xs font-bold text-slate-100">{attachment.file_name || attachment.title}</div><div className="mt-1 text-[10px] text-slate-500">{attachment.file_type} • {attachment.extraction?.characters || 0} حرف مستخرج</div></div></div><p className="mt-3 line-clamp-3 text-[11px] leading-6 text-slate-400">{attachment.intelligence?.summary}</p></div>)}</div> : <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-500">لا توجد مرفقات بعد. أضفها عند إنشاء الفرصة.</div>}</Panel>
            </div>
          )}

          {activeTab === "market" && <Panel><div className="mb-5 flex items-center gap-2"><Database className="text-yellow-400" /><div><h2 className="font-heading text-xl font-black text-slate-100">قاعدة المعرفة السوقية</h2><p className="mt-1 text-xs text-slate-500">الأسعار والمنتجات والمساحات ودرجة الثقة</p></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="border-b border-white/10 text-xs text-slate-500"><tr><th className="p-3">النطاق</th><th className="p-3">المنتج</th><th className="p-3">المساحة</th><th className="p-3">السعر</th><th className="p-3">الثقة</th></tr></thead><tbody>{(current.market || []).map((row) => <tr key={row[0] + row[1]} className="border-b border-white/5"><td className="p-3 font-bold text-slate-100">{row[0]}</td><td className="p-3 text-slate-300">{row[1]}</td><td className="p-3 text-slate-400">{row[2]}</td><td className="p-3 text-slate-300">{row[3]}</td><td className="p-3"><Badge tone={row[4] === "مرتفعة" ? "emerald" : row[4] === "متوسطة" ? "amber" : "rose"}>{row[4]}</Badge></td></tr>)}</tbody></table></div></Panel>}

          {activeTab === "scenarios" && <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">{(current.scenarios || []).map((scenario) => <Panel key={scenario.name} className={scenario.name === bestScenario?.name ? "border-yellow-500/40 bg-yellow-500/10" : ""}><div className="flex items-start justify-between"><Badge tone={scenario.risk === "مرتفع" ? "rose" : scenario.risk === "متوسط" ? "amber" : "emerald"}>مخاطر {scenario.risk}</Badge><span className="text-4xl font-black text-slate-100">{scenario.score}</span></div><h2 className="mt-4 font-heading text-xl font-black text-slate-100">{scenario.name}</h2><p className="mt-3 text-sm leading-7 text-slate-300">{scenario.model}</p><div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-[10px] text-slate-500">مزيج المنتج</div><div className="mt-1 text-xs leading-6 text-slate-200">{scenario.mix}</div></div><div className="mt-3 flex items-center justify-between text-xs"><span className="text-slate-500">مدة التطوير والامتصاص</span><span className="font-bold text-yellow-300">{scenario.duration}</span></div></Panel>)}</div>}

          {activeTab === "stakeholders" && <div className="grid grid-cols-1 gap-5 xl:grid-cols-2"><Panel><div className="mb-5 flex items-center gap-2"><Users className="text-yellow-400" /><h2 className="font-heading text-xl font-black text-slate-100">خريطة أصحاب المصلحة</h2></div><div className="space-y-3">{(current.stakeholders || []).map(([name, interest, influence]) => <div key={name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center justify-between"><Badge tone={influence === "مرتفع" ? "rose" : "amber"}>تأثير {influence}</Badge><h3 className="font-bold text-slate-100">{name}</h3></div><p className="mt-3 text-xs leading-6 text-slate-400">{interest}</p></div>)}</div></Panel><Panel><div className="mb-5 flex items-center gap-2"><ShieldAlert className="text-rose-400" /><h2 className="font-heading text-xl font-black text-slate-100">سجل المخاطر</h2></div><div className="space-y-3">{(current.risks || []).map(([title, score, mitigation]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-start justify-between gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black ${score >= 16 ? "bg-rose-500/10 text-rose-300" : "bg-amber-500/10 text-amber-300"}`}>{score}</span><div><h3 className="font-bold text-slate-100">{title}</h3><p className="mt-2 text-xs leading-6 text-slate-400">{mitigation}</p></div></div></div>)}</div></Panel></div>}

          {activeTab === "decision" && <div className="grid grid-cols-1 gap-5 xl:grid-cols-12"><Panel className="xl:col-span-8"><Badge tone="yellow">مذكرة قرار تنفيذية</Badge><h2 className="mt-4 font-heading text-2xl font-black text-slate-100">اعتماد مشروط للانتقال إلى الدراسة المفاهيمية</h2><p className="mt-4 text-sm leading-8 text-slate-300">تعتمد التوصية على اكتمال الأدلة وجودة المقارنات وصحة نموذج التكلفة والتنفيذ. السيناريو الأعلى حاليًا هو «{bestScenario?.name || "غير محدد"}»، وتظل التوصية مشروطة بإغلاق البيانات الناقصة والمخاطر الحرجة.</p><div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3"><div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4"><CheckCircle2 className="text-emerald-300" /><h3 className="mt-3 font-bold text-slate-100">اعتماد مشروط</h3><p className="mt-2 text-xs leading-6 text-slate-400">الانتقال بعد إغلاق النواقص الحرجة.</p></div><div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4"><Building2 className="text-amber-300" /><h3 className="mt-3 font-bold text-slate-100">اختبار المنتج</h3><p className="mt-2 text-xs leading-6 text-slate-400">اختبار المزيج والسعر قبل التثبيت النهائي.</p></div><div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4"><BarChart3 className="text-cyan-300" /><h3 className="mt-3 font-bold text-slate-100">تنفيذ مرحلي</h3><p className="mt-2 text-xs leading-6 text-slate-400">ربط كل مرحلة بالطلب والتمويل والمخاطر.</p></div></div></Panel><Panel className="xl:col-span-4"><h2 className="font-heading text-lg font-black text-slate-100">شروط الانتقال</h2><div className="mt-4 space-y-3">{(current.missingData || []).map((item, index) => <div key={item} className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-yellow-500/10 text-xs font-black text-yellow-300">G{index + 1}</span><p className="text-xs leading-6 text-slate-300">{item}</p></div>)}</div></Panel></div>}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="glass-card max-h-[92vh] w-full max-w-3xl overflow-y-auto border-yellow-500/20 p-6">
            <div className="mb-6 flex items-center justify-between"><div><div className="text-xs text-yellow-500/80">استقبال وتصنيف فرصة جديدة</div><h2 className="mt-1 font-heading text-2xl font-black">إنشاء بطاقة فرصة</h2></div><button onClick={() => !submitting && setShowCreate(false)} className="rounded-lg bg-white/5 p-2 text-slate-400"><X size={18} /></button></div>
            <form onSubmit={createOpportunity} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2"><label><span className="mb-2 block text-xs text-slate-400">عنوان الفرصة</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="field-control" placeholder="اسم المشروع أو العرض أو الأصل" /></label><label><span className="mb-2 block text-xs text-slate-400">التصنيف</span><select value={form.classification} onChange={(event) => setForm({ ...form, classification: event.target.value })} className="field-control">{classifications.map((item) => <option key={item}>{item}</option>)}</select></label></div>
              <div className="grid gap-4 md:grid-cols-3"><label><span className="mb-2 block text-xs text-slate-400">المدينة</span><input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} className="field-control" /></label><label><span className="mb-2 block text-xs text-slate-400">الحي أو النطاق</span><input value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })} className="field-control" /></label><label><span className="mb-2 block text-xs text-slate-400">سعر العرض</span><input type="number" value={form.askingPrice} onChange={(event) => setForm({ ...form, askingPrice: event.target.value })} className="field-control" placeholder="ريال سعودي" /></label></div>
              <label><span className="mb-2 block text-xs text-slate-400">هدف الدراسة والقرار المطلوب</span><textarea value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} className="field-control min-h-28 resize-y" placeholder="ما الذي نحتاج إلى تقييمه واعتماده؟" /></label>
              <div><div className="mb-2 text-xs text-slate-400">المخططات والعروض والمستندات</div><IntelligenceFilePicker files={files} onChange={setFiles} /></div>
              <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowCreate(false)} disabled={submitting} className="rounded-lg bg-white/5 px-5 py-2.5 text-sm text-slate-300">إلغاء</button><button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-lg bg-yellow-500 px-5 py-2.5 text-sm font-bold text-black disabled:opacity-60">{submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}{submitting ? "جارٍ الإنشاء والتحليل..." : "إنشاء وإظهار الفرصة"}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
