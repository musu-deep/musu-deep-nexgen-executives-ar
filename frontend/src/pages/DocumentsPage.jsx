import React, { useEffect, useState } from "react";
import api, { PRIORITY_LABELS } from "../lib/api";
import { Plus, X, FileText, ExternalLink, Trash2, Brain, Sparkles, Link2, CalendarClock, ListChecks, ShieldAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { translateArabicText } from "../i18n/ar";
import { translateExtraArabicText } from "../i18n/ar-extra";

const CATEGORY_LABELS = {
  meeting_notes: "محاضر الاجتماعات",
  correspondence: "المراسلات",
  report: "التقارير",
  memo: "المذكرات",
  presentation: "العروض التقديمية",
  other: "أخرى",
};

const CATEGORY_COLORS = {
  meeting_notes: "bg-sky-500/15 text-sky-300",
  correspondence: "bg-emerald-500/15 text-emerald-300",
  report: "bg-amber-500/15 text-amber-300",
  memo: "bg-violet-500/15 text-violet-300",
  presentation: "bg-rose-500/15 text-rose-300",
  other: "bg-slate-500/15 text-slate-300",
};

function translate(value) {
  if (typeof value !== "string") return value;
  return translateExtraArabicText(translateArabicText(value));
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [filter, setFilter] = useState("all");
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
  const [loadingIntelligence, setLoadingIntelligence] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "report", url: "", file_type: "PDF", is_public: true });

  const load = () => api.get("/documents").then((response) => setDocuments(response.data));
  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    try {
      await api.post("/documents", form);
      toast.success("تم رفع المستند وتحليله بواسطة وكيل ذكاء المستندات");
      setShow(false);
      setForm({ title: "", description: "", category: "report", url: "", file_type: "PDF", is_public: true });
      load();
    } catch {
      toast.error("تعذر رفع المستند");
    }
  };

  const deleteDocument = async (id) => {
    if (!window.confirm("هل تريد حذف المستند؟")) return;
    await api.delete(`/documents/${id}`);
    load();
    toast.success("تم حذف المستند");
  };

  const openIntelligence = async (document) => {
    setSelected(document);
    setIntelligence(document.intelligence ? { analysis: document.intelligence, created_task_id: document.intelligence?.created_task_id } : null);
    setLoadingIntelligence(true);
    try {
      const response = await api.get(`/documents/${document.id}/intelligence`);
      setIntelligence(response.data);
    } catch {
      toast.error("تعذر تحميل تحليل المستند");
    } finally {
      setLoadingIntelligence(false);
    }
  };

  const rerun = async () => {
    if (!selected) return;
    setLoadingIntelligence(true);
    try {
      const response = await api.post(`/documents/${selected.id}/intelligence`);
      setIntelligence(response.data);
      toast.success("تم تحديث تحليل المستند وتوجيهه");
      load();
    } catch {
      toast.error("تعذر إعادة تشغيل التحليل");
    } finally {
      setLoadingIntelligence(false);
    }
  };

  const filtered = filter === "all" ? documents : documents.filter((document) => document.category === filter);

  return (
    <div data-testid="documents-page" dir="rtl">
      <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">محطة ذكاء المستندات</div>
          <h1 className="font-heading text-4xl font-black mt-2 flex items-center gap-3"><Brain className="text-yellow-500"/> محطة الذاكرة المؤسسية</h1>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} مستندًا • تصنيف وتحليل وتوجيه وربط تلقائي بالعمل المؤسسي</p>
        </div>
        <button onClick={() => setShow(true)} className="px-5 py-2.5 rounded-lg bg-gradient-to-l from-yellow-500 to-yellow-600 text-black font-bold flex items-center gap-2">
          <Plus size={18}/> رفع وتحليل
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <IntelMetric icon={<FileText size={15}/>} label="المستندات" value={documents.length}/>
        <IntelMetric icon={<Sparkles size={15}/>} label="تمت معالجتها" value={documents.filter((document) => document.intelligence_status === "processed" || document.intelligence).length}/>
        <IntelMetric icon={<ShieldAlert size={15}/>} label="مخاطر مرتفعة أو متوسطة" value={documents.filter((document) => ["high", "medium"].includes(document.intelligence?.risk_level)).length}/>
        <IntelMetric icon={<ListChecks size={15}/>} label="مهام أنشأها الوكيل" value={documents.filter((document) => document.intelligence?.created_task_id).length}/>
      </div>

      <div className="glass-card p-4 mb-5 border-yellow-500/20">
        <div className="text-xs tracking-[0.12em] text-yellow-500/80 mb-2">كيف تعمل المحطة؟</div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs text-slate-400">
          <Step icon={<FileText size={13}/>} text="قراءة المستند" />
          <Step icon={<Brain size={13}/>} text="تحليل المحتوى" />
          <Step icon={<Link2 size={13}/>} text="التوجيه والربط" />
          <Step icon={<ListChecks size={13}/>} text="إنشاء المهام" />
          <Step icon={<CalendarClock size={13}/>} text="اقتراح الاجتماعات" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setFilter("all")} className={`px-4 py-2 rounded-lg text-sm transition-colors ${filter === "all" ? "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30" : "bg-white/5 text-slate-400 hover:text-slate-200 border border-white/5"}`}>الكل</button>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${filter === key ? "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30" : "bg-white/5 text-slate-400 hover:text-slate-200 border border-white/5"}`}>{label}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="glass-card p-10 text-center text-slate-500 col-span-3">لم يتم العثور على مستندات</div>
        ) : filtered.map((document) => (
          <div key={document.id} className="glass-card p-5 hover:border-yellow-500/30 group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400"><FileText size={20}/></div>
              <span className={`text-[10px] px-2 py-1 rounded ${CATEGORY_COLORS[document.category]}`}>{CATEGORY_LABELS[document.category]}</span>
            </div>
            <h3 className="font-heading font-bold text-slate-100 line-clamp-1">{document.title}</h3>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{document.description}</p>
            <div className="mt-3 flex items-center gap-2 text-[10px] tracking-wider text-yellow-400/80">
              <Sparkles size={12}/>{document.intelligence_status === "processed" || document.intelligence ? "تمت المعالجة الذكية" : "في قائمة التحليل"}
            </div>
            {document.intelligence?.risk_level && <div className="mt-2 text-xs text-slate-500">مستوى المخاطر: <span className="text-yellow-300">{translate(document.intelligence.risk_level)}</span></div>}
            <div className="mt-3 text-xs text-slate-500">رفعه: {document.uploaded_by_name}</div>
            <div className="text-[11px] text-slate-600">{new Date(document.created_at).toLocaleDateString("ar")}</div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => openIntelligence(document)} className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded bg-yellow-500/15 text-yellow-300 text-xs hover:bg-yellow-500/25"><Brain size={12}/> التحليل الذكي</button>
              <a href={document.url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded bg-white/5 text-slate-300 text-xs hover:bg-white/10" aria-label="فتح المستند"><ExternalLink size={12}/></a>
              <button onClick={() => deleteDocument(document.id)} className="px-3 py-2 rounded bg-rose-500/10 text-rose-300 hover:bg-rose-500/20" aria-label="حذف المستند"><Trash2 size={12}/></button>
            </div>
          </div>
        ))}
      </div>

      {selected && <IntelligenceModal document={selected} item={intelligence} loading={loadingIntelligence} onClose={() => setSelected(null)} onRerun={rerun}/>} 

      {show && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <div className="glass-card p-6 max-w-md w-full" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-xl font-bold">رفع مستند إلى محطة الذكاء</h2>
              <button onClick={() => setShow(false)} aria-label="إغلاق"><X size={18}/></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <input required placeholder="عنوان المستند" value={form.title} onChange={(event) => setForm({...form, title: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"/>
              <textarea placeholder="ألصق الملخص أو الالتزامات أو الأطراف أو التواريخ أو ملاحظات المخاطر" value={form.description} onChange={(event) => setForm({...form, description: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm min-h-[90px]"/>
              <select value={form.category} onChange={(event) => setForm({...form, category: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm">
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <input required placeholder="رابط المستند — Google Drive أو OneDrive أو رابط مباشر" value={form.url} onChange={(event) => setForm({...form, url: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm text-left" dir="ltr"/>
              <button type="submit" className="w-full py-3 rounded-lg bg-yellow-500 text-black font-bold">حفظ وتحليل وتوجيه</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function IntelMetric({ icon, label, value }) {
  return <div className="glass-card p-4"><div className="flex items-center gap-2 text-slate-500 text-[10px] tracking-wider">{icon}{label}</div><div className="text-2xl font-heading font-black text-slate-100 mt-1 tabular-nums">{value}</div></div>;
}

function Step({ icon, text }) {
  return <div className="rounded-xl bg-black/20 border border-white/5 p-3 flex items-center gap-2">{icon}<span>{text}</span></div>;
}

function IntelligenceModal({ document, item, loading, onClose, onRerun }) {
  const analysis = item?.analysis || document?.intelligence || {};
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} dir="rtl">
      <div className="glass-card p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div><div className="text-xs tracking-[0.12em] text-yellow-500/80">مخرجات ذكاء المستندات</div><h2 className="font-heading text-2xl font-black mt-2">{document.title}</h2></div>
          <button onClick={onClose} aria-label="إغلاق"><X size={18}/></button>
        </div>

        {loading ? <div className="text-slate-500 py-8 text-center">جارٍ التحليل...</div> : (
          <>
            <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/20 p-4 mb-4">
              <div className="text-xs tracking-[0.12em] text-yellow-400 mb-2">الملخص</div>
              <p className="text-sm text-slate-300">{translate(analysis.summary || "لا يوجد ملخص متاح.")}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Panel title="الأطراف" items={analysis.parties}/>
              <Panel title="التواريخ" items={analysis.dates}/>
              <Panel title="الالتزامات" items={analysis.obligations}/>
              <Panel title="البنود المهمة" items={analysis.important_clauses}/>
            </div>

            <div className="rounded-xl bg-black/20 border border-white/5 p-4 mb-4">
              <div className="text-xs tracking-[0.12em] text-rose-300 mb-2">المخاطر</div>
              {analysis.risks?.length ? analysis.risks.map((risk, index) => (
                <div key={index} className="text-sm text-slate-300 mb-2">
                  <span className="text-rose-300 text-xs ml-2">{translate(risk.level)}</span>{translate(risk.risk)}
                </div>
              )) : <div className="text-sm text-slate-500">لم تُرصد مخاطر جوهرية.</div>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-black/20 border border-white/5 p-4">
                <div className="text-xs tracking-[0.12em] text-yellow-400 mb-2">المهمة المقترحة</div>
                <div className="font-bold text-slate-100">{translate(analysis.suggested_task?.title)}</div>
                <div className="text-xs text-slate-500 mt-1">الأولوية: {PRIORITY_LABELS[analysis.suggested_task?.priority] || translate(analysis.suggested_task?.priority)}</div>
                <div className="text-xs text-emerald-300 mt-2">معرف المهمة المنشأة: {item?.created_task_id || analysis.created_task_id || "—"}</div>
              </div>
              <div className="rounded-xl bg-black/20 border border-white/5 p-4">
                <div className="text-xs tracking-[0.12em] text-yellow-400 mb-2">الاجتماع المقترح</div>
                <div className="font-bold text-slate-100">{translate(analysis.suggested_meeting?.title)}</div>
                <div className="text-xs text-slate-500 mt-1">{translate(analysis.suggested_meeting?.reason)}</div>
              </div>
            </div>

            <button onClick={onRerun} className="mt-5 px-4 py-2 rounded-lg bg-white/5 hover:bg-yellow-500/10 text-slate-300 hover:text-yellow-300 text-sm flex items-center gap-2">
              <RefreshCw size={14}/> إعادة تشغيل التحليل الذكي
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Panel({ title, items = [] }) {
  return (
    <div className="rounded-xl bg-black/20 border border-white/5 p-4">
      <div className="text-xs tracking-[0.12em] text-yellow-400 mb-2">{title}</div>
      {items?.length ? (
        <ul className="space-y-2 text-sm text-slate-300">
          {items.map((item, index) => <li key={index} className="flex gap-2"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2"></span><span>{translate(String(item))}</span></li>)}
        </ul>
      ) : <div className="text-sm text-slate-500">لم تُستخرج عناصر.</div>}
    </div>
  );
}
