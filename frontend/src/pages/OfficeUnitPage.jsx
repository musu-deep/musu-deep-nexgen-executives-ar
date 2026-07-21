import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FileText,
  Gavel,
  GraduationCap,
  HeartHandshake,
  Landmark,
  MessageSquareText,
  Plus,
  Scale,
  Search,
  ShieldCheck,
  UserCog,
  UserRoundCog,
  UsersRound,
  X,
} from "lucide-react";

const STATUS_STYLES = {
  "قيد المتابعة": "bg-sky-500/10 text-sky-300 border-sky-500/20",
  "بانتظار الإجراء": "bg-amber-500/10 text-amber-300 border-amber-500/20",
  "قيد المراجعة": "bg-violet-500/10 text-violet-300 border-violet-500/20",
  "مكتمل": "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
};

const PRIORITY_STYLES = {
  "عاجل": "text-rose-300",
  "مرتفع": "text-amber-300",
  "عادي": "text-slate-400",
};

const UNIT_CONFIG = {
  secretariat: {
    eyebrow: "إدارة مكتب الرئيس التنفيذي",
    title: "السكرتارية التنفيذية",
    description: "إدارة جدول أعمال الرئيس التنفيذي، والمكالمات والمذكرات والمراسلات، ومتابعة الترتيبات والبنود التحضيرية.",
    icon: BriefcaseBusiness,
    addLabel: "إضافة معاملة مكتبية",
    types: ["جدول أعمال", "اتصال", "مذكرة", "مراسلة"],
    records: [
      {
        id: "sec-1",
        type: "جدول أعمال",
        title: "استكمال الملف التحضيري لاجتماع مجلس الإدارة",
        owner: "السكرتير التنفيذي",
        dueDate: "2026-07-23",
        priority: "عاجل",
        status: "قيد المتابعة",
        details: "التأكد من اكتمال التقارير والعروض والقرارات المطلوب اعتمادها قبل الاجتماع.",
      },
      {
        id: "sec-2",
        type: "اتصال",
        title: "تنسيق اتصال الرئيس التنفيذي مع الشريك الاستراتيجي",
        owner: "مكتب الرئيس التنفيذي",
        dueDate: "2026-07-24",
        priority: "مرتفع",
        status: "بانتظار الإجراء",
        details: "تأكيد الموعد وإعداد موجز مختصر بالموضوعات ذات الأولوية.",
      },
      {
        id: "sec-3",
        type: "مذكرة",
        title: "مذكرة متابعة القرارات الصادرة هذا الأسبوع",
        owner: "مسؤول المتابعة",
        dueDate: "2026-07-25",
        priority: "عادي",
        status: "قيد المراجعة",
        details: "حصر القرارات وربط كل قرار بالمسؤول والموعد وحالة التنفيذ.",
      },
    ],
  },
  legal: {
    eyebrow: "الحوكمة والالتزام",
    title: "الشؤون القانونية",
    description: "إدارة العقود والاتفاقيات والقضايا والتراخيص، ومتابعة الالتزامات والمواعيد والإجراءات القانونية ذات الصلة.",
    icon: Scale,
    addLabel: "إضافة ملف قانوني",
    types: ["عقد", "اتفاقية", "قضية", "ترخيص"],
    records: [
      {
        id: "leg-1",
        type: "عقد",
        title: "مراجعة عقد التوريد والتشغيل",
        owner: "المستشار القانوني",
        dueDate: "2026-07-26",
        priority: "عاجل",
        status: "قيد المراجعة",
        details: "مراجعة المسؤوليات والضمانات وشروط الإنهاء وتسوية النزاعات قبل الاعتماد.",
      },
      {
        id: "leg-2",
        type: "قضية",
        title: "متابعة ملف النزاع التعاقدي",
        owner: "إدارة الشؤون القانونية",
        dueDate: "2026-07-29",
        priority: "مرتفع",
        status: "قيد المتابعة",
        details: "تحديث الموقف الإجرائي وتجهيز المذكرة والوثائق الداعمة ومسار التسوية المقترح.",
      },
      {
        id: "leg-3",
        type: "ترخيص",
        title: "تجديد ترخيص النشاط التشغيلي",
        owner: "مسؤول الالتزام",
        dueDate: "2026-08-02",
        priority: "عادي",
        status: "بانتظار الإجراء",
        details: "استكمال المتطلبات النظامية والرسوم والموافقات وإثباتات السريان.",
      },
    ],
  },
  advisor: {
    eyebrow: "الدعم المباشر للقيادة",
    title: "المستشار الخاص للرئيس التنفيذي",
    description: "مساحة مخصصة للدراسات والمذكرات والتوصيات والبدائل المرتبطة بقرارات الرئيس التنفيذي والملفات الحساسة.",
    icon: UserRoundCog,
    addLabel: "إضافة ملف استشاري",
    types: ["رأي استشاري", "مذكرة قرار", "دراسة", "تكليف خاص"],
    records: [
      {
        id: "adv-1",
        type: "مذكرة قرار",
        title: "بدائل معالجة تعثر المشروع الاستراتيجي",
        owner: "المستشار الخاص",
        dueDate: "2026-07-23",
        priority: "عاجل",
        status: "قيد المراجعة",
        details: "عرض ثلاثة بدائل تنفيذية مع الأثر المالي والمخاطر والقرار المقترح لكل بديل.",
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
      },
    ],
  },
  hr: {
    eyebrow: "رأس المال البشري",
    title: "الموارد البشرية",
    description: "متابعة القوى العاملة والاحتياجات الوظيفية والتقييم والتطوير والتعاقب الوظيفي والملفات الإدارية للموظفين.",
    icon: UsersRound,
    addLabel: "إضافة معاملة موارد بشرية",
    types: ["توظيف", "أداء", "تطوير", "إجراء إداري"],
    records: [
      {
        id: "hr-1",
        type: "توظيف",
        title: "استكمال شغل وظيفة مدير العمليات",
        owner: "مدير الموارد البشرية",
        dueDate: "2026-07-30",
        priority: "مرتفع",
        status: "قيد المتابعة",
        details: "استكمال الفرز والمقابلات ورفع القائمة المختصرة والتوصية النهائية للاعتماد.",
      },
      {
        id: "hr-2",
        type: "أداء",
        title: "إغلاق دورة تقييم الأداء نصف السنوية",
        owner: "فريق الأداء المؤسسي",
        dueDate: "2026-08-05",
        priority: "مرتفع",
        status: "قيد المراجعة",
        details: "مراجعة النماذج والنتائج وخطط التحسين وربطها بالأهداف الوظيفية المعتمدة.",
      },
      {
        id: "hr-3",
        type: "تطوير",
        title: "خطة تطوير القيادات والصف الثاني",
        owner: "إدارة التعلم والتطوير",
        dueDate: "2026-08-12",
        priority: "عادي",
        status: "بانتظار الإجراء",
        details: "تحديد الفجوات والبرامج والمسارات المهنية والمرشحين ومؤشرات قياس الأثر.",
      },
    ],
  },
};

const UNIT_ICONS = {
  secretariat: CalendarCheck,
  legal: Gavel,
  advisor: Landmark,
  hr: UserCog,
};

function loadRecords(unit, defaults) {
  try {
    const stored = localStorage.getItem(`nexgen-office-unit-${unit}`);
    return stored ? JSON.parse(stored) : defaults;
  } catch {
    return defaults;
  }
}

export default function OfficeUnitPage({ unit }) {
  const config = UNIT_CONFIG[unit] || UNIT_CONFIG.secretariat;
  const PageIcon = config.icon;
  const RecordIcon = UNIT_ICONS[unit] || FileText;
  const [records, setRecords] = useState(() => loadRecords(unit, config.records));
  const [activeType, setActiveType] = useState("الكل");
  const [query, setQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    type: config.types[0],
    title: "",
    owner: "",
    dueDate: new Date().toISOString().slice(0, 10),
    priority: "عادي",
    details: "",
  });

  useEffect(() => {
    setRecords(loadRecords(unit, config.records));
    setActiveType("الكل");
    setQuery("");
    setForm({
      type: config.types[0],
      title: "",
      owner: "",
      dueDate: new Date().toISOString().slice(0, 10),
      priority: "عادي",
      details: "",
    });
  }, [unit]);

  useEffect(() => {
    localStorage.setItem(`nexgen-office-unit-${unit}`, JSON.stringify(records));
  }, [records, unit]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesType = activeType === "الكل" || record.type === activeType;
      const matchesQuery = !normalizedQuery || `${record.title} ${record.owner} ${record.details} ${record.type}`.toLowerCase().includes(normalizedQuery);
      return matchesType && matchesQuery;
    });
  }, [records, activeType, query]);

  const stats = {
    total: records.length,
    active: records.filter((record) => record.status !== "مكتمل").length,
    urgent: records.filter((record) => record.priority === "عاجل" && record.status !== "مكتمل").length,
    completed: records.filter((record) => record.status === "مكتمل").length,
  };

  const createRecord = (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    const record = {
      id: `${unit}-${Date.now()}`,
      ...form,
      owner: form.owner.trim() || "مكتب الرئيس التنفيذي",
      status: "بانتظار الإجراء",
      createdAt: new Date().toISOString(),
    };
    setRecords((current) => [record, ...current]);
    setShowModal(false);
    setForm({
      type: config.types[0],
      title: "",
      owner: "",
      dueDate: new Date().toISOString().slice(0, 10),
      priority: "عادي",
      details: "",
    });
  };

  const advanceStatus = (id) => {
    const order = ["بانتظار الإجراء", "قيد المتابعة", "قيد المراجعة", "مكتمل"];
    setRecords((current) => current.map((record) => {
      if (record.id !== id) return record;
      const currentIndex = order.indexOf(record.status);
      return { ...record, status: order[Math.min(currentIndex + 1, order.length - 1)] };
    }));
  };

  return (
    <div data-testid={`office-unit-${unit}`} dir="rtl">
      <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">{config.eyebrow}</div>
          <h1 className="font-heading text-4xl font-black mt-2 flex items-center gap-3">
            <PageIcon className="text-yellow-500" /> {config.title}
          </h1>
          <p className="text-slate-500 text-sm mt-2 max-w-4xl leading-relaxed">{config.description}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-3 rounded-xl bg-yellow-500 text-black font-bold flex items-center gap-2 hover:bg-yellow-400 transition-colors"
        >
          <Plus size={17} /> {config.addLabel}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Metric icon={<FileText size={17} />} label="إجمالي السجلات" value={stats.total} />
        <Metric icon={<Clock3 size={17} />} label="قيد العمل" value={stats.active} />
        <Metric icon={<AlertTriangle size={17} />} label="عاجل" value={stats.urgent} tone="text-rose-300" />
        <Metric icon={<CheckCircle2 size={17} />} label="مكتمل" value={stats.completed} tone="text-emerald-300" />
      </div>

      <div className="glass-card p-4 mb-5 flex flex-col xl:flex-row xl:items-center gap-3 justify-between">
        <div className="flex gap-2 flex-wrap">
          {["الكل", ...config.types].map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
                activeType === type
                  ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/25"
                  : "bg-white/[0.02] text-slate-400 border-white/5 hover:text-slate-200"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="relative min-w-[280px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="البحث في السجلات..."
            className="w-full pr-10 pl-4 py-2.5 rounded-lg bg-black/20 border border-white/10 text-sm outline-none focus:border-yellow-500/35"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((record) => (
          <div key={record.id} className="glass-card p-5 hover:border-yellow-500/20 transition-colors">
            <div className="flex flex-col xl:flex-row xl:items-center gap-5 justify-between">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl bg-yellow-500/10 text-yellow-300 flex items-center justify-center flex-shrink-0">
                  <RecordIcon size={22} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] px-2 py-1 rounded border border-white/10 bg-white/[0.03] text-slate-400">{record.type}</span>
                    <span className={`text-[10px] px-2 py-1 rounded border ${STATUS_STYLES[record.status] || STATUS_STYLES["قيد المتابعة"]}`}>{record.status}</span>
                    <span className={`text-[10px] font-bold ${PRIORITY_STYLES[record.priority] || PRIORITY_STYLES["عادي"]}`}>الأولوية: {record.priority}</span>
                  </div>
                  <h3 className="font-heading text-lg font-black text-slate-100 mt-2">{record.title}</h3>
                  <p className="text-sm text-slate-400 mt-2 leading-relaxed">{record.details}</p>
                  <div className="flex gap-4 flex-wrap text-[11px] text-slate-500 mt-3">
                    <span className="flex items-center gap-1"><UserCog size={13} /> المسؤول: {record.owner}</span>
                    <span className="flex items-center gap-1"><CalendarCheck size={13} /> الاستحقاق: {new Date(record.dueDate).toLocaleDateString("ar")}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => advanceStatus(record.id)}
                disabled={record.status === "مكتمل"}
                className="px-4 py-2.5 rounded-lg bg-white/5 text-slate-300 hover:bg-yellow-500/10 hover:text-yellow-300 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <BadgeCheck size={15} /> {record.status === "مكتمل" ? "تم الإغلاق" : "تحديث الحالة"}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="glass-card p-12 text-center text-slate-500">لا توجد سجلات مطابقة للبحث أو التصنيف المحدد.</div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass-card p-6 border-yellow-500/20 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-xs tracking-wider text-yellow-500/80">{config.title}</div>
                <h2 className="font-heading text-2xl font-black mt-1">{config.addLabel}</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={createRecord} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="نوع السجل">
                  <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="field-control">
                    {config.types.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </Field>
                <Field label="الأولوية">
                  <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className="field-control">
                    <option value="عادي">عادي</option>
                    <option value="مرتفع">مرتفع</option>
                    <option value="عاجل">عاجل</option>
                  </select>
                </Field>
              </div>
              <Field label="العنوان">
                <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="field-control" placeholder="اكتب عنوان المعاملة أو الملف" />
              </Field>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="المسؤول">
                  <input value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} className="field-control" placeholder="اسم المسؤول أو الإدارة" />
                </Field>
                <Field label="تاريخ الاستحقاق">
                  <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className="field-control" />
                </Field>
              </div>
              <Field label="التفاصيل">
                <textarea value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} className="field-control min-h-28 resize-y" placeholder="اكتب التفاصيل والإجراء المطلوب" />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-lg bg-white/5 text-slate-300 text-sm">إلغاء</button>
                <button type="submit" className="px-5 py-2.5 rounded-lg bg-yellow-500 text-black font-bold text-sm flex items-center gap-2"><ShieldCheck size={15} /> حفظ السجل</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value, tone = "text-slate-100" }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 text-[10px] tracking-wider text-slate-500">{icon}{label}</div>
      <div className={`text-3xl font-heading font-black mt-2 tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-2">{label}</span>
      {children}
    </label>
  );
}
