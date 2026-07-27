import React, { useEffect, useMemo, useState } from "react";
import {
  ArchiveRestore,
  BriefcaseBusiness,
  Calculator,
  CheckSquare,
  ClipboardList,
  FileUp,
  Loader2,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import IntelligenceFilePicker from "./IntelligenceFilePicker";
import { uploadIntelligenceFile } from "../lib/intelligenceFiles";

const PRICING_STORAGE_KEY = "nexgen-pricing-intelligence-v2";

const SOURCE_MODES = [
  ["file", "ملف خارجي", FileUp, "عروض منافسين أو جداول تكاليف أو نطاقات أعمال"],
  ["project", "مشروع جارٍ", BriefcaseBusiness, "مراجعة الميزانية أو أي تكلفة مرتبطة بالمشروع"],
  ["task", "مهمة أو بند عمل", ClipboardList, "إحالة مهمة تتضمن توريدًا أو تنفيذًا أو تكلفة"],
  ["manual", "بند تكلفة", PlusCircle, "إدخال تكلفة أو تسعيرة وردت داخل منظومة العمل"],
  ["retrospective", "مراجعة لاحقة", ArchiveRestore, "مقارنة المعتمد أو المتعاقد عليه بالتكلفة الفعلية"],
];

const REVIEW_MODES = [
  ["pre_award", "قبل التقديم أو التعاقد"],
  ["active", "أثناء التنفيذ"],
  ["retrospective", "بعد التنفيذ أو الالتزام"],
];

const SOURCE_LABELS = {
  file: "ملف خارجي",
  project: "مشروع جارٍ",
  task: "مهمة أو بند عمل",
  manual: "بند تكلفة يدوي",
  retrospective: "مراجعة لاحقة",
  document: "مستند مؤسسي",
};

function Field({ label, children }) {
  return <label className="block"><span className="mb-2 block text-xs text-slate-400">{label}</span>{children}</label>;
}

function numericAmount(record = {}) {
  for (const key of ["actual_cost", "estimated_cost", "direct_cost", "cost", "amount", "budget"]) {
    const value = Number(record?.[key] || 0);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function readPricingState() {
  try {
    return JSON.parse(localStorage.getItem(PRICING_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export default function PricingIntakePortal({ onApplied }) {
  const [mode, setMode] = useState("file");
  const [files, setFiles] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [intake, setIntake] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [reviewMode, setReviewMode] = useState("active");
  const [manual, setManual] = useState({ title: "", description: "", amount: "", currency: "SAR" });
  const [retro, setRetro] = useState({ title: "", description: "", approvedAmount: "", actualAmount: "", currency: "SAR" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [analysing, setAnalysing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [projectResponse, taskResponse, intakeResponse] = await Promise.all([
        api.get("/projects").catch(() => ({ data: [] })),
        api.get("/tasks").catch(() => ({ data: [] })),
        api.get("/pricing/intake").catch(() => ({ data: [] })),
      ]);
      setProjects(Array.isArray(projectResponse.data) ? projectResponse.data : []);
      setTasks(Array.isArray(taskResponse.data) ? taskResponse.data : []);
      const items = Array.isArray(intakeResponse.data) ? intakeResponse.data : [];
      setIntake(items);
      setSelectedIds((current) => current.filter((id) => items.some((item) => item.id === id)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const pendingCount = useMemo(() => intake.filter((item) => item.status !== "تم التحليل").length, [intake]);
  const selectedItems = useMemo(() => intake.filter((item) => selectedIds.includes(item.id)), [intake, selectedIds]);

  const toggleItem = (id) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const createIntake = async (payload) => {
    setSubmitting(true);
    try {
      const response = await api.post("/pricing/intake", payload);
      const item = response.data;
      setIntake((current) => [item, ...current.filter((existing) => existing.id !== item.id)]);
      setSelectedIds((current) => [item.id, ...current.filter((id) => id !== item.id)]);
      toast.success("تمت إضافة البند إلى صندوق مراجعة التسعير");
      return item;
    } catch (error) {
      toast.error(error?.response?.data?.detail || "تعذر إضافة البند إلى مركز التسعير");
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const addProject = async () => {
    const project = projects.find((item) => String(item.id) === String(selectedProject));
    if (!project) return toast.error("اختر مشروعًا للمراجعة");
    await createIntake({
      source_type: "project",
      source_id: project.id,
      title: `مراجعة تسعير مشروع: ${project.name || project.title}`,
      description: project.description || "",
      amount: numericAmount(project),
      currency: project.currency || "SAR",
      review_mode: reviewMode,
      priority: project.priority || "medium",
      source_snapshot: project,
    });
  };

  const addTask = async () => {
    const task = tasks.find((item) => String(item.id) === String(selectedTask));
    if (!task) return toast.error("اختر مهمة أو بند عمل للمراجعة");
    const project = projects.find((item) => String(item.id) === String(task.project_id));
    await createIntake({
      source_type: "task",
      source_id: task.id,
      title: `مراجعة تكلفة مهمة: ${task.title || task.name}`,
      description: [task.description, project?.name ? `المشروع المرتبط: ${project.name}` : ""].filter(Boolean).join("\n"),
      amount: numericAmount(task),
      currency: task.currency || "SAR",
      review_mode: reviewMode,
      priority: task.priority || "medium",
      source_snapshot: { ...task, project_name: project?.name || "" },
    });
  };

  const addManual = async () => {
    if (!manual.title.trim()) return toast.error("اكتب عنوان بند التكلفة");
    const item = await createIntake({
      source_type: "manual",
      title: manual.title,
      description: manual.description,
      amount: Number(manual.amount || 0),
      currency: manual.currency,
      review_mode: reviewMode,
      source_snapshot: { amount: Number(manual.amount || 0), currency: manual.currency },
    });
    if (item) setManual({ title: "", description: "", amount: "", currency: manual.currency });
  };

  const addRetrospective = async () => {
    if (!retro.title.trim()) return toast.error("اكتب عنوان المراجعة اللاحقة");
    const item = await createIntake({
      source_type: "retrospective",
      title: retro.title,
      description: retro.description,
      amount: Number(retro.actualAmount || 0),
      currency: retro.currency,
      review_mode: "retrospective",
      source_snapshot: {
        planned_cost: Number(retro.approvedAmount || 0),
        actual_cost: Number(retro.actualAmount || 0),
        variance: Number(retro.actualAmount || 0) - Number(retro.approvedAmount || 0),
      },
    });
    if (item) setRetro({ title: "", description: "", approvedAmount: "", actualAmount: "", currency: retro.currency });
  };

  const analyseSources = async () => {
    if (!files.length && !selectedIds.length) return toast.error("اختر مصدرًا واحدًا على الأقل للتحليل");
    setAnalysing(true);
    try {
      const stored = readPricingState();
      const model = stored.model || {};
      const documents = [];
      const referenceId = `pricing-portal-${Date.now()}`;
      for (const file of files) {
        const uploaded = await uploadIntelligenceFile(file, {
          title: `${model.projectName || "مراجعة تسعير"} — ${file.name}`,
          description: model.notes || "",
          category: "report",
          purpose: "pricing",
          reference_id: referenceId,
          is_public: false,
        });
        documents.push(uploaded);
      }

      const response = await api.post("/pricing/analyse-sources", {
        document_ids: documents.map((item) => item.id),
        intake_ids: selectedIds,
        project_name: model.projectName || selectedItems[0]?.title || "مراجعة تسعير مؤسسية",
        client: model.client || "جهة داخلية أو عميل استراتيجي",
        target_margin: Number(model.targetMargin || 18),
        overhead_rate: Number(model.overheadRate || 8),
        risk_rate: Number(model.riskRate || 6),
        win_strength: Number(model.winStrength || 75),
      }, { timeout: 90000 });

      const analysis = { ...response.data, documents, intake_items: selectedItems };
      const patch = analysis.model_patch || {};
      const nextModel = {
        ...model,
        projectName: model.projectName || selectedItems[0]?.title || "مراجعة تسعير مؤسسية",
        directCost: Number(patch.directCost || model.directCost || 0),
        competitorPrice: Number(patch.competitorPrice || model.competitorPrice || 0),
        winStrength: Number(patch.winStrength || model.winStrength || 75),
      };
      localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify({
        model: nextModel,
        analysis,
        uploadedDocuments: [...(stored.uploadedDocuments || []), ...documents],
      }));
      setFiles([]);
      await load();
      toast.success("تمت قراءة المصادر وتحديث نموذج التسعير والتوصية التنفيذية");
      onApplied?.();
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || "تعذر تحليل مصادر التسعير");
    } finally {
      setAnalysing(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-5" data-testid="pricing-intake-portal">
      <div className="glass-card rounded-2xl border border-cyan-500/20 bg-gradient-to-l from-cyan-500/[0.06] via-yellow-500/[0.04] to-transparent p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs tracking-[0.12em] text-cyan-300">بوابة تغذية مركز التسعير</div>
            <h2 className="mt-2 flex items-center gap-2 font-heading text-2xl font-black text-slate-100"><Calculator className="text-yellow-400" /> مصادر متعددة ومراجعة قبلية وجارية ولاحقة</h2>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-400">استقبال الملفات الخارجية، والمشروعات والمهام الجارية، وبنود التكلفة الواردة من الإدارات، ومراجعة الانحرافات بعد التنفيذ؛ ثم تحويلها إلى مقارنة وتوصية وحد تفاوض وذاكرة تسعير.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300">بانتظار المراجعة {pendingCount}</span>
            <button onClick={load} className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-400 hover:text-yellow-300" title="تحديث صندوق الإحالات"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-5">
          {SOURCE_MODES.map(([key, label, Icon, description]) => (
            <button key={key} onClick={() => setMode(key)} className={`rounded-xl border p-3 text-right transition ${mode === key ? "border-yellow-500/35 bg-yellow-500/10" : "border-white/10 bg-black/20 hover:border-white/20"}`}>
              <Icon size={17} className={mode === key ? "text-yellow-300" : "text-slate-500"} />
              <div className="mt-2 text-xs font-black text-slate-100">{label}</div>
              <div className="mt-1 text-[10px] leading-5 text-slate-500">{description}</div>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
          {mode === "file" && <IntelligenceFilePicker files={files} onChange={setFiles} compact />}

          {mode === "project" && (
            <div className="grid gap-3 md:grid-cols-[1fr_240px_auto] md:items-end">
              <Field label="المشروع الجاري"><select className="field-control" value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)}><option value="">اختر مشروعًا</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name || project.title}</option>)}</select></Field>
              <Field label="نوع المراجعة"><select className="field-control" value={reviewMode} onChange={(event) => setReviewMode(event.target.value)}>{REVIEW_MODES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
              <button onClick={addProject} disabled={submitting} className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-black disabled:opacity-60">إضافة للمراجعة</button>
            </div>
          )}

          {mode === "task" && (
            <div className="grid gap-3 md:grid-cols-[1fr_240px_auto] md:items-end">
              <Field label="المهمة أو بند العمل"><select className="field-control" value={selectedTask} onChange={(event) => setSelectedTask(event.target.value)}><option value="">اختر مهمة</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title || task.name}</option>)}</select></Field>
              <Field label="نوع المراجعة"><select className="field-control" value={reviewMode} onChange={(event) => setReviewMode(event.target.value)}>{REVIEW_MODES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
              <button onClick={addTask} disabled={submitting} className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-black disabled:opacity-60">إضافة للمراجعة</button>
            </div>
          )}

          {mode === "manual" && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="عنوان بند التكلفة"><input className="field-control" value={manual.title} onChange={(event) => setManual({ ...manual, title: event.target.value })} placeholder="مثال: توريد مواد المرحلة الثانية" /></Field>
              <div className="grid grid-cols-[1fr_120px] gap-2"><Field label="القيمة"><input type="number" className="field-control" value={manual.amount} onChange={(event) => setManual({ ...manual, amount: event.target.value })} /></Field><Field label="العملة"><select className="field-control" value={manual.currency} onChange={(event) => setManual({ ...manual, currency: event.target.value })}><option>SAR</option><option>USD</option><option>GBP</option><option>AED</option><option>EUR</option><option>XOF</option></select></Field></div>
              <Field label="السياق والنطاق"><textarea className="field-control min-h-24 resize-y" value={manual.description} onChange={(event) => setManual({ ...manual, description: event.target.value })} placeholder="مصدر التكلفة، الكمية، المورد، النطاق، الافتراضات أو أي ملاحظة مؤثرة" /></Field>
              <div className="grid gap-3"><Field label="نوع المراجعة"><select className="field-control" value={reviewMode} onChange={(event) => setReviewMode(event.target.value)}>{REVIEW_MODES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><button onClick={addManual} disabled={submitting} className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-black disabled:opacity-60">إضافة بند التكلفة</button></div>
            </div>
          )}

          {mode === "retrospective" && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="عنوان المراجعة اللاحقة"><input className="field-control" value={retro.title} onChange={(event) => setRetro({ ...retro, title: event.target.value })} placeholder="مثال: مراجعة تكلفة تنفيذ الحزمة الأولى" /></Field>
              <div className="grid grid-cols-2 gap-2"><Field label="القيمة المعتمدة أو المتعاقد عليها"><input type="number" className="field-control" value={retro.approvedAmount} onChange={(event) => setRetro({ ...retro, approvedAmount: event.target.value })} /></Field><Field label="التكلفة الفعلية"><input type="number" className="field-control" value={retro.actualAmount} onChange={(event) => setRetro({ ...retro, actualAmount: event.target.value })} /></Field></div>
              <Field label="أسباب الانحراف أو الملاحظات"><textarea className="field-control min-h-24 resize-y" value={retro.description} onChange={(event) => setRetro({ ...retro, description: event.target.value })} placeholder="التغييرات، الكميات، التأخير، الموردون، أخطاء التقدير أو الظروف الاستثنائية" /></Field>
              <div className="grid gap-3"><Field label="العملة"><select className="field-control" value={retro.currency} onChange={(event) => setRetro({ ...retro, currency: event.target.value })}><option>SAR</option><option>USD</option><option>GBP</option><option>AED</option><option>EUR</option><option>XOF</option></select></Field><button onClick={addRetrospective} disabled={submitting} className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-black disabled:opacity-60">إضافة المراجعة اللاحقة</button></div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">
        <div className="glass-card rounded-2xl border border-white/10 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-heading text-lg font-black text-slate-100">صندوق الإحالات وبنود المراجعة</h3><p className="mt-1 text-xs text-slate-500">اختر بندًا أو أكثر لدمجه مع الملفات الخارجية في تحليل واحد</p></div><span className="text-xs text-cyan-300">المحدد {selectedIds.length}</span></div>
          <div className="max-h-[360px] space-y-2 overflow-y-auto">
            {intake.map((item) => {
              const selected = selectedIds.includes(item.id);
              return <button key={item.id} onClick={() => toggleItem(item.id)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-right transition ${selected ? "border-cyan-500/35 bg-cyan-500/10" : "border-white/10 bg-black/20 hover:border-white/20"}`}>
                {selected ? <CheckSquare size={17} className="mt-0.5 shrink-0 text-cyan-300" /> : <Square size={17} className="mt-0.5 shrink-0 text-slate-600" />}
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-black text-slate-100">{item.title}</span><span className="rounded border border-white/10 px-2 py-0.5 text-[9px] text-slate-400">{item.source_label || SOURCE_LABELS[item.source_type]}</span><span className={`rounded px-2 py-0.5 text-[9px] ${item.status === "تم التحليل" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>{item.status}</span></div><div className="mt-1 text-[10px] text-slate-500">{item.review_mode_label} • أحاله {item.referred_by_name || "مستخدم المنصة"}</div>{Number(item.amount || 0) > 0 && <div className="mt-1 text-[10px] font-bold text-yellow-300">{Number(item.amount).toLocaleString("en-GB")} {item.currency}</div>}</div>
              </button>;
            })}
            {!intake.length && !loading && <div className="py-10 text-center text-sm text-slate-500">لا توجد إحالات بعد. أضف مصدرًا من الأعلى أو استخدم زر «إحالة للتسعير» داخل المشاريع والمهام.</div>}
          </div>
        </div>

        <div className="glass-card h-fit rounded-2xl border border-yellow-500/20 p-5">
          <div className="flex items-center gap-2 text-yellow-300"><Sparkles size={18} /><h3 className="font-heading text-lg font-black">تشغيل المراجعة</h3></div>
          <div className="mt-4 space-y-2 text-xs leading-6 text-slate-400"><div>• ملفات خارجية محددة: <strong className="text-slate-200">{files.length}</strong></div><div>• بنود داخلية محددة: <strong className="text-slate-200">{selectedIds.length}</strong></div><div>• تشمل المراجعة السابقة واللاحقة في نموذج موحد، مع تمييز نوع كل مصدر.</div></div>
          <button onClick={analyseSources} disabled={analysing || (!files.length && !selectedIds.length)} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-yellow-500 to-yellow-600 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50">{analysing ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}{analysing ? "جارٍ القراءة والمقارنة..." : "تحليل المصادر وتحديث التوصية"}</button>
        </div>
      </div>
    </div>
  );
}
