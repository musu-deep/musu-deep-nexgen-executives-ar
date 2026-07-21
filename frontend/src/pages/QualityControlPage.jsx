import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  CalendarCheck,
  X,
} from "lucide-react";

const STORAGE_KEY = "nexgen-quality-control-records";

const INITIAL_RECORDS = [
  {
    id: "qc-1",
    type: "تدقيق جودة",
    title: "مراجعة جودة المواد الخام الواردة إلى مصنع الحديد",
    owner: "عاصم الملاحمة",
    department: "التفتيش والرقابة والجودة",
    dueDate: "2026-07-25",
    priority: "عاجل",
    status: "قيد المتابعة",
    details: "التحقق من شهادات المطابقة ونتائج الفحص ومطابقة الموردين للمعايير والمواصفات المعتمدة.",
  },
  {
    id: "qc-2",
    type: "تفتيش تشغيلي",
    title: "جولة رقابية على المستودعات وسلامة إجراءات التخزين",
    owner: "عاصم الملاحمة",
    department: "التفتيش والرقابة والجودة",
    dueDate: "2026-07-28",
    priority: "مرتفع",
    status: "قيد المراجعة",
    details: "فحص الالتزام بترميز الأصناف، ودقة الأرصدة، وسلامة التخزين، ومسارات الاستلام والصرف.",
  },
  {
    id: "qc-3",
    type: "إجراء تصحيحي",
    title: "إغلاق الملاحظات المتكررة في تقارير الجودة الشهرية",
    owner: "إدارة التفتيش والرقابة والجودة",
    department: "التفتيش والرقابة والجودة",
    dueDate: "2026-08-03",
    priority: "مرتفع",
    status: "بانتظار الإجراء",
    details: "تحديد السبب الجذري لكل ملاحظة، والمسؤول، والإجراء التصحيحي، وموعد التحقق من الفاعلية.",
  },
];

const STATUS_STYLES = {
  "بانتظار الإجراء": "bg-amber-500/10 text-amber-300 border-amber-500/20",
  "قيد المتابعة": "bg-sky-500/10 text-sky-300 border-sky-500/20",
  "قيد المراجعة": "bg-violet-500/10 text-violet-300 border-violet-500/20",
  "مكتمل": "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
};

function loadRecords() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : INITIAL_RECORDS;
  } catch {
    return INITIAL_RECORDS;
  }
}

export default function QualityControlPage() {
  const [records, setRecords] = useState(loadRecords);
  const [query, setQuery] = useState("");
  const [activeType, setActiveType] = useState("الكل");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    type: "تدقيق جودة",
    title: "",
    owner: "عاصم الملاحمة",
    dueDate: new Date().toISOString().slice(0, 10),
    priority: "عادي",
    details: "",
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  const types = ["تدقيق جودة", "تفتيش تشغيلي", "عدم مطابقة", "إجراء تصحيحي", "اعتماد مورد"];

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return records.filter((record) => {
      const typeMatches = activeType === "الكل" || record.type === activeType;
      const textMatches = !normalized || `${record.title} ${record.owner} ${record.details} ${record.type}`.toLowerCase().includes(normalized);
      return typeMatches && textMatches;
    });
  }, [records, query, activeType]);

  const stats = {
    total: records.length,
    open: records.filter((record) => record.status !== "مكتمل").length,
    urgent: records.filter((record) => record.priority === "عاجل" && record.status !== "مكتمل").length,
    completed: records.filter((record) => record.status === "مكتمل").length,
  };

  const createRecord = (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    setRecords((current) => [
      {
        id: `qc-${Date.now()}`,
        ...form,
        owner: form.owner.trim() || "عاصم الملاحمة",
        department: "التفتيش والرقابة والجودة",
        status: "بانتظار الإجراء",
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setShowModal(false);
    setForm({
      type: "تدقيق جودة",
      title: "",
      owner: "عاصم الملاحمة",
      dueDate: new Date().toISOString().slice(0, 10),
      priority: "عادي",
      details: "",
    });
  };

  const advanceStatus = (id) => {
    const flow = ["بانتظار الإجراء", "قيد المتابعة", "قيد المراجعة", "مكتمل"];
    setRecords((current) => current.map((record) => {
      if (record.id !== id) return record;
      const index = flow.indexOf(record.status);
      return { ...record, status: flow[Math.min(index + 1, flow.length - 1)] };
    }));
  };

  return (
    <div data-testid="quality-control-page" dir="rtl">
      <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">التفتيش المؤسسي والامتثال التشغيلي</div>
          <h1 className="font-heading text-4xl font-black mt-2 flex items-center gap-3">
            <ShieldCheck className="text-yellow-500" /> التفتيش والرقابة والجودة
          </h1>
          <p className="text-slate-500 text-sm mt-2 max-w-4xl leading-relaxed">
            إدارة التفتيش وتدقيق الجودة وحالات عدم المطابقة والإجراءات التصحيحية واعتماد الموردين، بقيادة عاصم الملاحمة.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-5 py-3 rounded-xl bg-yellow-500 text-black font-bold flex items-center gap-2 hover:bg-yellow-400 transition-colors">
          <Plus size={17} /> إضافة سجل رقابي
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Metric icon={<ClipboardCheck size={17} />} label="إجمالي السجلات" value={stats.total} />
        <Metric icon={<FileCheck2 size={17} />} label="قيد العمل" value={stats.open} />
        <Metric icon={<AlertTriangle size={17} />} label="عاجل" value={stats.urgent} tone="text-rose-300" />
        <Metric icon={<CheckCircle2 size={17} />} label="مكتمل" value={stats.completed} tone="text-emerald-300" />
      </div>

      <div className="glass-card p-4 mb-5 flex flex-col xl:flex-row xl:items-center gap-3 justify-between">
        <div className="flex gap-2 flex-wrap">
          {["الكل", ...types].map((type) => (
            <button key={type} onClick={() => setActiveType(type)} className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${activeType === type ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/25" : "bg-white/[0.02] text-slate-400 border-white/5 hover:text-slate-200"}`}>
              {type}
            </button>
          ))}
        </div>
        <div className="relative min-w-[280px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="البحث في سجلات التفتيش والرقابة والجودة..." className="w-full pr-10 pl-4 py-2.5 rounded-lg bg-black/20 border border-white/10 text-sm outline-none focus:border-yellow-500/35" />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((record) => (
          <div key={record.id} className="glass-card p-5 hover:border-yellow-500/20 transition-colors">
            <div className="flex flex-col xl:flex-row xl:items-center gap-5 justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl bg-yellow-500/10 text-yellow-300 flex items-center justify-center flex-shrink-0"><ClipboardCheck size={22} /></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] px-2 py-1 rounded border border-white/10 bg-white/[0.03] text-slate-400">{record.type}</span>
                    <span className={`text-[10px] px-2 py-1 rounded border ${STATUS_STYLES[record.status] || STATUS_STYLES["قيد المتابعة"]}`}>{record.status}</span>
                    <span className={`text-[10px] font-bold ${record.priority === "عاجل" ? "text-rose-300" : record.priority === "مرتفع" ? "text-amber-300" : "text-slate-400"}`}>الأولوية: {record.priority}</span>
                  </div>
                  <h3 className="font-heading text-lg font-black text-slate-100 mt-2">{record.title}</h3>
                  <p className="text-sm text-slate-400 mt-2 leading-relaxed">{record.details}</p>
                  <div className="flex gap-4 flex-wrap text-[11px] text-slate-500 mt-3">
                    <span className="flex items-center gap-1"><UserCog size={13} /> المسؤول: {record.owner}</span>
                    <span className="flex items-center gap-1"><CalendarCheck size={13} /> الاستحقاق: {new Date(record.dueDate).toLocaleDateString("ar")}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => advanceStatus(record.id)} disabled={record.status === "مكتمل"} className="px-4 py-2.5 rounded-lg bg-white/5 text-slate-300 hover:bg-yellow-500/10 hover:text-yellow-300 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                <BadgeCheck size={15} /> {record.status === "مكتمل" ? "تم الإغلاق" : "تحديث الحالة"}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="glass-card p-12 text-center text-slate-500">لا توجد سجلات مطابقة.</div>}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass-card p-6 border-yellow-500/20 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div><div className="text-xs tracking-wider text-yellow-500/80">التفتيش والرقابة والجودة</div><h2 className="font-heading text-2xl font-black mt-1">إضافة سجل رقابي</h2></div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={createRecord} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="نوع السجل"><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="field-control">{types.map((type) => <option key={type} value={type}>{type}</option>)}</select></Field>
                <Field label="الأولوية"><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className="field-control"><option value="عادي">عادي</option><option value="مرتفع">مرتفع</option><option value="عاجل">عاجل</option></select></Field>
              </div>
              <Field label="العنوان"><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="field-control" placeholder="عنوان المراجعة أو الملاحظة" /></Field>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="المسؤول"><input value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} className="field-control" /></Field>
                <Field label="تاريخ الاستحقاق"><input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className="field-control" /></Field>
              </div>
              <Field label="التفاصيل"><textarea value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} className="field-control min-h-28 resize-y" placeholder="الملاحظة، المعيار، والإجراء المطلوب" /></Field>
              <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-lg bg-white/5 text-slate-300 text-sm">إلغاء</button><button type="submit" className="px-5 py-2.5 rounded-lg bg-yellow-500 text-black font-bold text-sm flex items-center gap-2"><ShieldCheck size={15} /> حفظ السجل</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value, tone = "text-slate-100" }) {
  return <div className="glass-card p-4"><div className="flex items-center gap-2 text-[10px] tracking-wider text-slate-500">{icon}{label}</div><div className={`text-3xl font-heading font-black mt-2 tabular-nums ${tone}`}>{value}</div></div>;
}

function Field({ label, children }) {
  return <label className="block"><span className="block text-xs text-slate-400 mb-2">{label}</span>{children}</label>;
}
