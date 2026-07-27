import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  BrainCircuit,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Loader2,
  Plus,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  UserCog,
  UserRoundCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import IntelligenceFilePicker from "../components/IntelligenceFilePicker";
import { downloadIntelligenceFile, uploadIntelligenceFile } from "../lib/intelligenceFiles";

const STORAGE_KEY = "nexgen-office-unit-advisor";
const TYPES = ["رأي استشاري", "مذكرة قرار", "دراسة", "تكليف خاص"];
const STATUS_ORDER = ["بانتظار الإجراء", "قيد المتابعة", "قيد المراجعة", "مكتمل"];

const DEFAULT_RECORDS = [
  {
    id: "adv-1",
    type: "مذكرة قرار",
    title: "بدائل معالجة تعثر المشروع الاستراتيجي",
    owner: "المستشار الخاص",
    dueDate: "2026-07-23",
    priority: "عاجل",
    status: "قيد المراجعة",
    details: "عرض ثلاثة بدائل تنفيذية مع الأثر المالي والمخاطر والقرار المقترح لكل بديل.",
    attachments: [],
  },
  {
    id: "adv-2",
    type: "دراسة",
    title: "دراسة فرص التوسع والشراكات للربع القادم",
    owner: "مكتب المستشار",
    dueDate: "2026-07-31",
    priority: "مرتفع",
    status: "قيد المتابعة",
    details: "تقييم الفرص وفق الملاءمة الاستراتيجية والجدوى والموارد المطلوبة وسرعة التنفيذ.",
    attachments: [],
  },
  {
    id: "adv-3",
    type: "تكليف خاص",
    title: "إعداد إحاطة سرية لاجتماع القيادة",
    owner: "المستشار الخاص",
    dueDate: "2026-07-24",
    priority: "عاجل",
    status: "بانتظار الإجراء",
    details: "تلخيص عناصر القرار ونقاط التفاوض والمواقف المحتملة والنتيجة المستهدفة.",
    attachments: [],
  },
];

const STATUS_STYLES = {
  "قيد المتابعة": "bg-sky-500/10 text-sky-300 border-sky-500/20",
  "بانتظار الإجراء": "bg-amber-500/10 text-amber-300 border-amber-500/20",
  "قيد المراجعة": "bg-violet-500/10 text-violet-300 border-violet-500/20",
  "مكتمل": "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
};

const PRIORITY_STYLES = {
  عاجل: "text-rose-300",
  مرتفع: "text-amber-300",
  عادي: "text-slate-400",
};

function readRecords() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_RECORDS;
  } catch {
    return DEFAULT_RECORDS;
  }
}

function emptyForm() {
  return {
    type: TYPES[0],
    title: "",
    owner: "",
    dueDate: new Date().toISOString().slice(0, 10),
    priority: "عادي",
    details: "",
  };
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Metric({ icon, label, value, tone = "text-slate-100" }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 text-[10px] tracking-wider text-slate-500">{icon}{label}</div>
      <div className={`mt-2 font-heading text-3xl font-black tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

export default function AdvisorWorkspacePage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState(readRecords);
  const [activeType, setActiveType] = useState("الكل");
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records.filter((record) => {
      const typeMatch = activeType === "الكل" || record.type === activeType;
      const searchText = `${record.title} ${record.owner} ${record.details} ${record.type} ${(record.attachments || []).map((item) => item.file_name).join(" ")}`.toLowerCase();
      return typeMatch && (!normalized || searchText.includes(normalized));
    });
  }, [records, activeType, query]);

  const stats = {
    total: records.length,
    active: records.filter((record) => record.status !== "مكتمل").length,
    urgent: records.filter((record) => record.priority === "عاجل" && record.status !== "مكتمل").length,
    completed: records.filter((record) => record.status === "مكتمل").length,
  };

  const closeModal = () => {
    if (uploading) return;
    setShowModal(false);
    setForm(emptyForm());
    setFiles([]);
  };

  const createRecord = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setUploading(true);
    const recordId = `advisor-${Date.now()}`;
    const attachments = [];
    try {
      for (const file of files) {
        const uploaded = await uploadIntelligenceFile(file, {
          title: `${form.title.trim()} — ${file.name}`,
          description: form.details,
          category: form.type === "دراسة" ? "report" : "memo",
          purpose: "advisory",
          reference_id: recordId,
          is_public: false,
        });
        attachments.push(uploaded);
      }

      const record = {
        id: recordId,
        ...form,
        title: form.title.trim(),
        owner: form.owner.trim() || "مكتب الرئيس التنفيذي",
        status: "بانتظار الإجراء",
        createdAt: new Date().toISOString(),
        attachments,
        intelligenceSummary: attachments[0]?.intelligence?.summary || "",
        intelligenceRisk: attachments[0]?.intelligence?.risk_level || "",
      };
      setRecords((current) => [record, ...current]);
      toast.success(attachments.length ? `تم حفظ الملف الاستشاري وقراءة ${attachments.length} مرفق` : "تم حفظ الملف الاستشاري");
      closeModal();
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "تعذر رفع وتحليل الملف الاستشاري");
    } finally {
      setUploading(false);
    }
  };

  const advanceStatus = (id) => {
    setRecords((current) => current.map((record) => {
      if (record.id !== id) return record;
      const index = STATUS_ORDER.indexOf(record.status);
      return { ...record, status: STATUS_ORDER[Math.min(index + 1, STATUS_ORDER.length - 1)] };
    }));
  };

  const downloadAttachment = async (attachment) => {
    try {
      await downloadIntelligenceFile(attachment);
    } catch (error) {
      toast.error(error?.response?.data?.detail || "تعذر تنزيل الملف");
    }
  };

  return (
    <div data-testid="advisor-workspace-page" dir="rtl" className="pb-24">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">الدعم المباشر للقيادة</div>
          <h1 className="mt-2 flex items-center gap-3 font-heading text-4xl font-black">
            <UserRoundCog className="text-yellow-500" /> المستشار الخاص للرئيس التنفيذي
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-500">مساحة للدراسات والمذكرات والتوصيات والبدائل، مع رفع الملفات وقراءتها وتحليلها وربط مخرجاتها بالقرار التنفيذي.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 rounded-xl bg-yellow-500 px-5 py-3 font-bold text-black transition hover:bg-yellow-400">
            <Plus size={17} /> إضافة ملف استشاري
          </button>
          <button onClick={() => navigate("/opportunity-intelligence")} className="flex items-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-5 py-3 font-bold text-cyan-200 transition hover:bg-cyan-500/20">
            <Radar size={17} /> دراسة الفرص والعروض
          </button>
          <button onClick={() => navigate("/pricing-intelligence")} className="flex items-center gap-2 rounded-xl border border-yellow-500/45 bg-yellow-500/10 px-5 py-3 font-bold text-yellow-300 transition hover:bg-yellow-500 hover:text-black">
            <Tag size={17} /> التسعير
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric icon={<FileText size={17} />} label="إجمالي السجلات" value={stats.total} />
        <Metric icon={<Clock3 size={17} />} label="قيد العمل" value={stats.active} />
        <Metric icon={<AlertTriangle size={17} />} label="عاجل" value={stats.urgent} tone="text-rose-300" />
        <Metric icon={<CheckCircle2 size={17} />} label="مكتمل" value={stats.completed} tone="text-emerald-300" />
      </div>

      <div className="glass-card mb-5 flex flex-col justify-between gap-3 p-4 xl:flex-row xl:items-center">
        <div className="flex flex-wrap gap-2">
          {["الكل", ...TYPES].map((type) => (
            <button key={type} onClick={() => setActiveType(type)} className={`rounded-lg border px-4 py-2 text-xs font-bold transition-colors ${activeType === type ? "border-yellow-500/25 bg-yellow-500/15 text-yellow-300" : "border-white/5 bg-white/[0.02] text-slate-400 hover:text-slate-200"}`}>
              {type}
            </button>
          ))}
        </div>
        <div className="relative min-w-[280px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="البحث في الملفات والمرفقات..." className="w-full rounded-lg border border-white/10 bg-black/20 py-2.5 pl-4 pr-10 text-sm outline-none focus:border-yellow-500/35" />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((record) => (
          <div key={record.id} className="glass-card p-5 transition-colors hover:border-yellow-500/20">
            <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
              <div className="flex flex-1 items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-300"><BrainCircuit size={22} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-slate-400">{record.type}</span>
                    <span className={`rounded border px-2 py-1 text-[10px] ${STATUS_STYLES[record.status] || STATUS_STYLES["قيد المتابعة"]}`}>{record.status}</span>
                    <span className={`text-[10px] font-bold ${PRIORITY_STYLES[record.priority] || PRIORITY_STYLES.عادي}`}>الأولوية: {record.priority}</span>
                    {(record.attachments || []).length > 0 && <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-300">{record.attachments.length} مرفق محلل</span>}
                  </div>
                  <h3 className="mt-2 font-heading text-lg font-black text-slate-100">{record.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{record.details}</p>
                  {record.intelligenceSummary && (
                    <div className="mt-3 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] p-3">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-yellow-300"><Sparkles size={12} /> خلاصة القراءة الذكية</div>
                      <p className="mt-2 line-clamp-3 text-xs leading-6 text-slate-300">{record.intelligenceSummary}</p>
                    </div>
                  )}
                  {(record.attachments || []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {record.attachments.map((attachment) => (
                        <button key={attachment.id} onClick={() => downloadAttachment(attachment)} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-slate-300 hover:border-yellow-500/30 hover:text-yellow-300">
                          <Download size={13} /> {attachment.file_name || attachment.title}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1"><UserCog size={13} /> المسؤول: {record.owner}</span>
                    <span className="flex items-center gap-1"><CalendarCheck size={13} /> الاستحقاق: {new Date(record.dueDate).toLocaleDateString("ar")}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => advanceStatus(record.id)} disabled={record.status === "مكتمل"} className="flex items-center justify-center gap-2 rounded-lg bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-yellow-500/10 hover:text-yellow-300 disabled:cursor-not-allowed disabled:opacity-50">
                <BadgeCheck size={15} /> {record.status === "مكتمل" ? "تم الإغلاق" : "تحديث الحالة"}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="glass-card p-12 text-center text-slate-500">لا توجد ملفات مطابقة للبحث أو التصنيف المحدد.</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="glass-card max-h-[92vh] w-full max-w-3xl overflow-y-auto border-yellow-500/20 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div><div className="text-xs tracking-wider text-yellow-500/80">المستشار الخاص للرئيس التنفيذي</div><h2 className="mt-1 font-heading text-2xl font-black">إضافة ملف استشاري</h2></div>
              <button onClick={closeModal} disabled={uploading} className="rounded-lg bg-white/5 p-2 text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={createRecord} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="نوع السجل"><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="field-control">{TYPES.map((type) => <option key={type}>{type}</option>)}</select></Field>
                <Field label="الأولوية"><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className="field-control"><option>عادي</option><option>مرتفع</option><option>عاجل</option></select></Field>
              </div>
              <Field label="العنوان"><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="field-control" placeholder="اكتب عنوان الملف أو الدراسة" /></Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="المسؤول"><input value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} className="field-control" placeholder="اسم المسؤول أو الإدارة" /></Field>
                <Field label="تاريخ الاستحقاق"><input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className="field-control" /></Field>
              </div>
              <Field label="التفاصيل والإجراء المطلوب"><textarea value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} className="field-control min-h-28 resize-y" placeholder="اكتب السياق، السؤال الاستشاري، والمخرج المتوقع" /></Field>
              <div>
                <div className="mb-2 text-xs text-slate-400">المرفقات</div>
                <IntelligenceFilePicker files={files} onChange={setFiles} />
              </div>
              <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.05] p-3 text-[11px] leading-6 text-slate-400">سيقرأ النظام النصوص والجداول والقيم والتواريخ، ويولد ملخصًا ومخاطر والتزامات ومهمة متابعة مقترحة. الملفات المصورة بالكامل تحتاج لاحقًا إلى خدمة OCR.</div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeModal} disabled={uploading} className="rounded-lg bg-white/5 px-5 py-2.5 text-sm text-slate-300">إلغاء</button>
                <button type="submit" disabled={uploading} className="flex items-center gap-2 rounded-lg bg-yellow-500 px-5 py-2.5 text-sm font-bold text-black disabled:opacity-60">
                  {uploading ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                  {uploading ? "جارٍ الرفع والقراءة..." : "حفظ ورفع وتحليل"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
