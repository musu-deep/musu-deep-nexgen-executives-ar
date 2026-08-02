import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Award, BrainCircuit, BriefcaseBusiness, CheckCircle2, CircleDot, Copy,
  ExternalLink, Globe2, Network, Plus, RefreshCw,
  Search, Send, ShieldAlert, Sparkles, Star, Trash2, UserPlus, UsersRound, X,
} from "lucide-react";
import api, { formatApiError } from "../lib/api";

const BUILD = "araak-recruitment-hub-2026-08-02-v1";
if (typeof window !== "undefined") console.info(`[ARAAK-HR] build ${BUILD}`);

const inputClass = "w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-sm outline-none focus:border-emerald-500/40";
const sectionClass = "glass-card border-emerald-500/10";
const defaultJob = {
  title: "", department: "", location: "الرياض", workplace_type: "onsite",
  employment_type: "FULL_TIME", description: "", responsibilities: "",
  required_skills: "", preferred_skills: "", internal_criteria: "",
  min_experience: 3, required_education: "bachelor", application_deadline: "",
  salary_min: "", salary_max: "", salary_currency: "SAR",
  channels: ["google_jobs", "linkedin", "indeed"],
};
const defaultCandidate = {
  job_id: "", name: "", email: "", phone: "", current_title: "",
  source: "internal", resume_url: "", experience_years: 0,
  education_level: "bachelor", skills: "", sector_fit_score: 50,
  interview_score: 0, values_score: 0, availability_score: 50,
  references_score: 50, committee_notes: "", stage: "new",
};

const STAGE_LABELS = {
  new: "جديد", screening: "فرز أولي", shortlisted: "قائمة قصيرة",
  interview: "مقابلة", assessment: "تقييم", offer: "عرض وظيفي",
  hired: "تم التعيين", rejected: "غير مختار",
};

const EDUCATION_LABELS = {
  secondary: "ثانوي", diploma: "دبلوم", bachelor: "بكالوريوس",
  master: "ماجستير", doctorate: "دكتوراه",
};

function asArray(value) { return Array.isArray(value) ? value : []; }
function apiError(error, fallback) { return formatApiError(error?.response?.data?.detail) || fallback; }
function formatDate(value) {
  if (!value) return "مفتوح";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}
function readinessStyle(value) {
  if (value === "ready") return "bg-emerald-500/10 border-emerald-500/20 text-emerald-300";
  if (value === "partner_required") return "bg-amber-500/10 border-amber-500/20 text-amber-300";
  if (value === "supporting_tool") return "bg-violet-500/10 border-violet-500/20 text-violet-300";
  return "bg-sky-500/10 border-sky-500/20 text-sky-300";
}
function scoreTone(score) {
  if (score >= 80) return "text-emerald-300";
  if (score >= 65) return "text-yellow-300";
  return "text-rose-300";
}

export default function RecruitmentPage() {
  const [data, setData] = useState({ jobs: [], candidates: [], channels: [], totals: {}, activity: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [query, setQuery] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobModal, setJobModal] = useState(false);
  const [candidateModal, setCandidateModal] = useState(false);
  const [jobForm, setJobForm] = useState(defaultJob);
  const [candidateForm, setCandidateForm] = useState(defaultCandidate);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/recruitment");
      setData(response.data || { jobs: [], candidates: [], channels: [], totals: {}, activity: [] });
      const jobs = asArray(response.data?.jobs);
      setSelectedJobId((current) => current && jobs.some((job) => job.id === current) ? current : (jobs[0]?.id || ""));
    } catch (error) {
      toast.error(apiError(error, "تعذر تحميل مركز التوظيف."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedJob = useMemo(
    () => asArray(data.jobs).find((job) => job.id === selectedJobId) || null,
    [data.jobs, selectedJobId],
  );
  const filteredJobs = useMemo(() => {
    const text = query.trim().toLowerCase();
    return asArray(data.jobs).filter((job) => !text || `${job.title} ${job.department} ${job.location}`.toLowerCase().includes(text));
  }, [data.jobs, query]);

  const mutate = async (request, success) => {
    setSaving(true);
    try {
      await request();
      toast.success(success);
      setJobModal(false);
      setCandidateModal(false);
      setJobForm(defaultJob);
      setCandidateForm({ ...defaultCandidate, job_id: selectedJobId || "" });
      await load();
    } catch (error) {
      toast.error(apiError(error, "تعذر إكمال العملية."));
    } finally {
      setSaving(false);
    }
  };

  const createJob = (event) => {
    event.preventDefault();
    mutate(() => api.post("/recruitment", { action: "create_job", job: jobForm }), "تم إنشاء الوظيفة وإعداد معايير المفاضلة.");
  };

  const addCandidate = (event) => {
    event.preventDefault();
    mutate(() => api.post("/recruitment", { action: "add_candidate", candidate: candidateForm }), "تمت إضافة المرشح وحساب درجة الملاءمة.");
  };

  const publishJob = async (job) => {
    setSaving(true);
    try {
      const response = await api.post("/recruitment", { action: "publish_job", job_id: job.id, channels: job.channels });
      toast.success(`تم تجهيز ${response.data?.plan?.length || 0} قناة للنشر.`);
      await load();
    } catch (error) {
      toast.error(apiError(error, "تعذر تجهيز قنوات النشر."));
    } finally {
      setSaving(false);
    }
  };

  const updateCandidateStage = async (candidate, stage) => {
    setSaving(true);
    try {
      await api.post("/recruitment", { action: "update_candidate", candidate_id: candidate.id, candidate: { ...candidate, stage } });
      toast.success(`تم نقل المرشح إلى: ${STAGE_LABELS[stage]}`);
      await load();
    } catch (error) {
      toast.error(apiError(error, "تعذر تحديث مرحلة المرشح."));
    } finally {
      setSaving(false);
    }
  };

  const deleteCandidate = async (candidate) => {
    if (!window.confirm(`حذف المرشح ${candidate.name} من هذه الوظيفة؟`)) return;
    setSaving(true);
    try {
      await api.post("/recruitment", { action: "delete_candidate", candidate_id: candidate.id });
      toast.success("تم حذف المرشح.");
      await load();
    } catch (error) {
      toast.error(apiError(error, "تعذر حذف المرشح."));
    } finally {
      setSaving(false);
    }
  };

  const copyPublicUrl = async (job) => {
    const url = `${window.location.origin}/jobs/${job.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ رابط الوظيفة العامة.");
    } catch {
      window.prompt("انسخ رابط الوظيفة:", url);
    }
  };

  const openCandidateForm = (jobId = selectedJobId) => {
    setCandidateForm({ ...defaultCandidate, job_id: jobId || "" });
    setCandidateModal(true);
  };

  if (loading) {
    return <div dir="rtl" className="space-y-5"><div className="h-36 shimmer rounded-2xl"/><div className="grid grid-cols-2 lg:grid-cols-5 gap-4">{[1,2,3,4,5].map((item) => <div key={item} className="h-28 shimmer rounded-2xl"/>)}</div><div className="h-96 shimmer rounded-2xl"/></div>;
  }

  const tabs = [
    ["dashboard", "الملخص", BrainCircuit],
    ["jobs", "الوظائف", BriefcaseBusiness],
    ["candidates", "المفاضلة والمرشحون", Award],
    ["channels", "قنوات التوظيف", Network],
  ];

  return (
    <div dir="rtl" className="space-y-6 pb-12" data-testid="recruitment-page">
      <section className={`${sectionClass} p-6 overflow-hidden relative`}>
        <div className="absolute -top-32 -left-16 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl"/>
        <div className="relative flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div>
            <div className="text-xs tracking-[0.16em] text-emerald-300/80">ARAAK TALENT INTELLIGENCE</div>
            <h1 className="font-heading text-4xl font-black mt-2 flex items-center gap-3"><Sparkles className="text-yellow-400"/> التوظيف الذكي</h1>
            <p className="text-slate-500 text-sm mt-2 max-w-4xl leading-7">أنشئ الوظيفة مرة واحدة، جهّز قنوات النشر، اجمع المرشحين، ثم استخدم مفاضلة مؤسسية قابلة للتفسير لاختيار الأنسب مع بقاء القرار النهائي للجنة التوظيف.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <span className={`px-4 py-2.5 rounded-xl border text-xs font-bold ${data.persistent ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>
              {data.persistent ? "حفظ مؤسسي عبر Odoo" : "حفظ مؤقت في الذاكرة"}
            </span>
            <button type="button" onClick={load} className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-200 hover:text-emerald-300 flex items-center gap-2 text-sm font-bold"><RefreshCw size={16}/> تحديث</button>
            <button type="button" onClick={() => setJobModal(true)} className="px-5 py-2.5 rounded-xl bg-yellow-500 text-black font-black flex items-center gap-2"><Plus size={17}/> وظيفة جديدة</button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Metric icon={<BriefcaseBusiness size={18}/>} label="الوظائف" value={data.totals?.jobs || 0}/>
        <Metric icon={<CircleDot size={18}/>} label="المفتوحة والمنشورة" value={data.totals?.open_jobs || 0} tone="text-emerald-300"/>
        <Metric icon={<UsersRound size={18}/>} label="المرشحون" value={data.totals?.candidates || 0}/>
        <Metric icon={<Star size={18}/>} label="القائمة القصيرة" value={data.totals?.shortlisted || 0} tone="text-yellow-300"/>
        <Metric icon={<Send size={18}/>} label="العروض الوظيفية" value={data.totals?.offers || 0} tone="text-sky-300"/>
      </section>

      <section className="flex gap-2 flex-wrap border-b border-white/5 pb-3">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 border ${tab === id ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-200" : "border-transparent text-slate-500 hover:bg-white/5 hover:text-slate-200"}`}>
            <Icon size={16}/>{label}
          </button>
        ))}
      </section>

      {tab === "dashboard" && (
        <div className="grid xl:grid-cols-[1.25fr_.75fr] gap-5">
          <section className={`${sectionClass} p-6`}>
            <div className="flex items-center justify-between gap-4 mb-5"><div><h2 className="font-heading text-xl font-black">التوصية التنفيذية الحالية</h2><p className="text-xs text-slate-500 mt-1">اختر وظيفة لمراجعة ترتيب المرشحين وأسباب الاختيار.</p></div><select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)} className="min-w-72 px-4 py-2.5 rounded-xl bg-black/20 border border-white/10 text-sm"><option value="">لا توجد وظيفة</option>{asArray(data.jobs).map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></div>
            {!selectedJob ? <EmptyState icon={<BriefcaseBusiness size={28}/>} title="ابدأ بإنشاء وظيفة" text="حدد المتطلبات والمهارات وقنوات النشر، ثم أضف المرشحين."/> : !selectedJob.recommendation ? <EmptyState icon={<UserPlus size={28}/>} title="لم يضف مرشحون بعد" text="أضف مرشحاً أو انشر رابط الوظيفة العام لاستقبال الطلبات." action={<button onClick={() => openCandidateForm(selectedJob.id)} className="px-4 py-2 rounded-lg bg-yellow-500 text-black font-bold">إضافة مرشح</button>}/> : (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.045] p-6">
                <div className="flex items-start justify-between gap-5 flex-wrap">
                  <div><div className="text-xs text-emerald-300">المرشح الأعلى ملاءمة</div><h3 className="text-2xl font-black mt-2">{selectedJob.recommendation.candidate_name}</h3><div className="mt-2 text-sm text-yellow-300 font-bold">{selectedJob.recommendation.decision}</div></div>
                  <div className={`text-5xl font-black ${scoreTone(selectedJob.recommendation.score)}`}>{selectedJob.recommendation.score}<span className="text-sm text-slate-500">/100</span></div>
                </div>
                <div className="grid md:grid-cols-2 gap-3 mt-6">{asArray(selectedJob.recommendation.reasons).map((reason) => <div key={reason} className="flex gap-2 items-start text-sm text-slate-300"><CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0"/>{reason}</div>)}</div>
                <p className="mt-5 text-[11px] leading-6 text-slate-500">التوصية مساندة للقرار ولا تستبدل التحقق البشري، والمقابلة، والمراجع، وعدم التمييز في التوظيف.</p>
              </div>
            )}
          </section>

          <section className={`${sectionClass} p-6`}>
            <div className="flex items-center gap-2"><Globe2 size={19} className="text-sky-300"/><h2 className="font-heading text-xl font-black">جاهزية القنوات</h2></div>
            <div className="space-y-3 mt-5">{asArray(data.channels).slice(0, 6).map((channel) => <div key={channel.id} className="rounded-xl border border-white/7 p-3 flex items-center justify-between gap-3"><div><div className="font-bold text-sm">{channel.short_name}</div><div className="text-[10px] text-slate-600 mt-1">{channel.category}</div></div><span className={`px-2.5 py-1.5 rounded-lg border text-[10px] ${readinessStyle(channel.readiness)}`}>{channel.readiness_label}</span></div>)}</div>
            <button type="button" onClick={() => setTab("channels")} className="w-full mt-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm text-slate-300">عرض القنوات العشر</button>
          </section>
        </div>
      )}

      {tab === "jobs" && (
        <div className="space-y-5">
          <div className={`${sectionClass} p-4 flex flex-col md:flex-row gap-3 justify-between`}>
            <div className="relative flex-1 max-w-2xl"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في الوظائف..." className={`${inputClass} pr-10`}/>{query && <button onClick={() => setQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><X size={15}/></button>}</div>
            <button type="button" onClick={() => setJobModal(true)} className="px-5 py-3 rounded-xl bg-yellow-500 text-black font-black flex items-center justify-center gap-2"><Plus size={17}/> إنشاء وظيفة</button>
          </div>
          <div className="grid lg:grid-cols-2 gap-5">
            {filteredJobs.map((job) => (
              <article key={job.id} className={`${sectionClass} p-5`}>
                <div className="flex items-start justify-between gap-4"><div><span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] border ${job.status === "published" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-slate-500/10 border-slate-500/20 text-slate-400"}`}>{job.status === "published" ? "منشورة" : "مسودة"}</span><h3 className="font-heading text-xl font-black mt-3">{job.title}</h3><p className="text-xs text-slate-500 mt-2">{job.department} · {job.location} · {job.min_experience} سنوات خبرة</p></div><div className="text-center"><div className="text-2xl font-black text-emerald-300">{job.candidate_count || 0}</div><div className="text-[10px] text-slate-600">مرشح</div></div></div>
                <div className="flex gap-1.5 flex-wrap mt-4">{asArray(job.required_skills).slice(0, 6).map((skill) => <span key={skill} className="px-2 py-1 rounded-md bg-white/5 text-[10px] text-slate-400">{skill}</span>)}</div>
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-3 flex-wrap"><div className="text-xs text-slate-500">آخر تقديم: {formatDate(job.application_deadline)}</div><div className="flex gap-2"><button type="button" onClick={() => { setSelectedJobId(job.id); setTab("candidates"); }} className="px-3 py-2 rounded-lg border border-white/10 text-xs hover:bg-white/5">المفاضلة</button><button type="button" onClick={() => openCandidateForm(job.id)} className="px-3 py-2 rounded-lg border border-white/10 text-xs hover:bg-white/5"><UserPlus size={14}/></button><button type="button" onClick={() => copyPublicUrl(job)} className="px-3 py-2 rounded-lg border border-white/10 text-xs hover:bg-white/5"><Copy size={14}/></button><button type="button" disabled={saving} onClick={() => publishJob(job)} className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs"><Send size={14}/></button></div></div>
                {job.recommendation && <div className="mt-4 rounded-xl bg-yellow-500/[0.045] border border-yellow-500/10 p-3 flex items-center justify-between gap-3"><div><div className="text-[10px] text-yellow-300">الأعلى ملاءمة</div><div className="font-bold text-sm mt-1">{job.recommendation.candidate_name}</div></div><div className={`text-xl font-black ${scoreTone(job.recommendation.score)}`}>{job.recommendation.score}</div></div>}
              </article>
            ))}
          </div>
          {filteredJobs.length === 0 && <EmptyState icon={<BriefcaseBusiness size={28}/>} title="لا توجد وظائف" text="أنشئ أول طلب توظيف وحدد متطلبات المفاضلة وقنوات النشر."/>}
        </div>
      )}

      {tab === "candidates" && (
        <div className="space-y-5">
          <div className={`${sectionClass} p-4 flex flex-col md:flex-row gap-3 justify-between items-center`}>
            <select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)} className={`${inputClass} max-w-xl`}><option value="">اختر الوظيفة</option>{asArray(data.jobs).map((job) => <option key={job.id} value={job.id}>{job.title} · {job.candidate_count || 0} مرشح</option>)}</select>
            <button type="button" disabled={!selectedJobId} onClick={() => openCandidateForm()} className="px-5 py-3 rounded-xl bg-yellow-500 text-black font-black flex items-center gap-2 disabled:opacity-40"><UserPlus size={17}/> إضافة مرشح</button>
          </div>
          {!selectedJob ? <EmptyState icon={<Award size={28}/>} title="اختر وظيفة للمفاضلة" text="سيظهر ترتيب المرشحين ودرجات المهارات والخبرة والتقييم الداخلي."/> : (
            <div className="grid xl:grid-cols-[1fr_360px] gap-5">
              <section className={`${sectionClass} overflow-hidden`}>
                <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between"><div><h2 className="font-heading text-xl font-black">ترتيب المرشحين</h2><p className="text-xs text-slate-600 mt-1">{selectedJob.title}</p></div><span className="text-xs text-slate-500">{asArray(selectedJob.ranking).length} مرشح</span></div>
                <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="bg-white/[0.025] text-slate-500 text-xs"><tr><th className="text-right p-4">الترتيب</th><th className="text-right p-4">المرشح</th><th className="text-right p-4">الدرجة</th><th className="text-right p-4">المهارات</th><th className="text-right p-4">الخبرة</th><th className="text-right p-4">المقابلة</th><th className="text-right p-4">المرحلة</th><th className="p-4"></th></tr></thead><tbody className="divide-y divide-white/5">{asArray(selectedJob.ranking).map((candidate, index) => <tr key={candidate.id} className="hover:bg-white/[0.02]"><td className="p-4"><span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${index === 0 ? "bg-yellow-500/15 text-yellow-300" : "bg-white/5 text-slate-500"}`}>{index + 1}</span></td><td className="p-4"><div className="font-bold text-slate-100">{candidate.name}</div><div className="text-[10px] text-slate-600 mt-1">{candidate.current_title || candidate.source}</div><div className="mt-2 text-[10px] text-slate-500 max-w-60">{candidate.score?.reasons?.[0]}</div></td><td className="p-4"><div className={`text-2xl font-black ${scoreTone(candidate.score?.total || 0)}`}>{candidate.score?.total || 0}</div><div className="text-[9px] text-slate-600">من 100</div></td><td className="p-4"><div>{candidate.score?.required_match_percent || 0}%</div><div className="text-[10px] text-rose-300 mt-1">{asArray(candidate.score?.missing_skills).slice(0,2).join("، ")}</div></td><td className="p-4 text-slate-300">{candidate.experience_years} سنوات</td><td className="p-4 text-slate-300">{candidate.interview_score || 0}%</td><td className="p-4"><select value={candidate.stage} disabled={saving} onChange={(event) => updateCandidateStage(candidate, event.target.value)} className="px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-xs">{Object.entries(STAGE_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="p-4"><button type="button" onClick={() => deleteCandidate(candidate)} className="p-2 rounded-lg text-rose-300 hover:bg-rose-500/10"><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>
                {asArray(selectedJob.ranking).length === 0 && <div className="p-12 text-center text-slate-600">لا يوجد مرشحون لهذه الوظيفة بعد.</div>}
              </section>
              <aside className={`${sectionClass} p-5 h-fit`}>
                <div className="flex items-center gap-2"><BrainCircuit size={19} className="text-yellow-300"/><h2 className="font-heading text-lg font-black">منهج المفاضلة</h2></div>
                <p className="text-xs text-slate-500 leading-6 mt-3">الدرجة ليست صندوقاً أسود؛ كل عنصر ظاهر ويمكن للجنة مراجعة نتائجه.</p>
                <div className="space-y-3 mt-5">{Object.entries(selectedJob.weights || {}).map(([key,value]) => <div key={key}><div className="flex justify-between text-xs mb-1"><span className="text-slate-400">{weightLabel(key)}</span><strong className="text-emerald-300">{Math.round(value)}%</strong></div><div className="h-2 rounded-full bg-white/5 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{width:`${value}%`}}/></div></div>)}</div>
                <div className="mt-6 rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4 text-[11px] leading-6 text-amber-100/80 flex gap-2"><ShieldAlert size={16} className="shrink-0 mt-1"/>لا تستخدم العمر أو الجنس أو الجنسية أو الحالة الاجتماعية ضمن الدرجة. القرار النهائي موثق لدى لجنة التوظيف.</div>
              </aside>
            </div>
          )}
        </div>
      )}

      {tab === "channels" && (
        <div className="grid lg:grid-cols-2 gap-5">
          {asArray(data.channels).map((channel, index) => (
            <article key={channel.id} className={`${sectionClass} p-5`}>
              <div className="flex items-start gap-4"><div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-lg text-emerald-300">{index + 1}</div><div className="flex-1"><div className="flex items-start justify-between gap-3"><div><h3 className="font-heading text-xl font-black">{channel.name}</h3><div className="text-xs text-slate-600 mt-1">{channel.category}</div></div><span className={`px-2.5 py-1.5 rounded-lg border text-[10px] ${readinessStyle(channel.readiness)}`}>{channel.readiness_label}</span></div><p className="text-sm leading-7 text-slate-400 mt-4">{channel.description}</p><a href={channel.employer_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-4 text-xs text-sky-300 hover:text-sky-200"><ExternalLink size={14}/> فتح قناة صاحب العمل</a></div></div>
            </article>
          ))}
          <div className="lg:col-span-2 rounded-2xl border border-sky-500/15 bg-sky-500/[0.035] p-5 text-sm leading-7 text-sky-100/80"><strong>ملاحظة تشغيلية:</strong> الترتيب في المقاطع الاجتماعية ليس معياراً مهنياً ثابتاً. Rezi أداة لتحسين السيرة، وGoogle for Jobs طبقة اكتشاف في البحث، بينما LinkedIn وIndeed وHandshake قنوات توظيف تتباين آليات الربط معها. في المنصة نصنفها حسب الغرض والجاهزية، لا حسب ترتيب دعائي.</div>
        </div>
      )}

      {jobModal && <Modal title="إنشاء طلب توظيف" onClose={() => setJobModal(false)}><JobForm form={jobForm} setForm={setJobForm} channels={data.channels} saving={saving} onSubmit={createJob}/></Modal>}
      {candidateModal && <Modal title="إضافة مرشح وتقييمه" onClose={() => setCandidateModal(false)}><CandidateForm form={candidateForm} setForm={setCandidateForm} jobs={data.jobs} saving={saving} onSubmit={addCandidate}/></Modal>}
    </div>
  );
}

function JobForm({ form, setForm, channels, saving, onSubmit }) {
  const toggleChannel = (id) => setForm((current) => ({ ...current, channels: current.channels.includes(id) ? current.channels.filter((item) => item !== id) : [...current.channels, id] }));
  return <form onSubmit={onSubmit} className="space-y-5"><div className="grid md:grid-cols-2 gap-3"><Field label="المسمى الوظيفي"><input required className={inputClass} value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></Field><Field label="الإدارة"><input required className={inputClass} value={form.department} onChange={(e)=>setForm({...form,department:e.target.value})}/></Field><Field label="الموقع"><input className={inputClass} value={form.location} onChange={(e)=>setForm({...form,location:e.target.value})}/></Field><Field label="نمط العمل"><select className={inputClass} value={form.workplace_type} onChange={(e)=>setForm({...form,workplace_type:e.target.value})}><option value="onsite">حضوري</option><option value="hybrid">هجين</option><option value="remote">عن بعد</option></select></Field><Field label="نوع التعاقد"><select className={inputClass} value={form.employment_type} onChange={(e)=>setForm({...form,employment_type:e.target.value})}><option value="FULL_TIME">دوام كامل</option><option value="PART_TIME">دوام جزئي</option><option value="CONTRACTOR">عقد</option><option value="INTERN">تدريب</option><option value="TEMPORARY">مؤقت</option></select></Field><Field label="الحد الأدنى للخبرة"><input type="number" min="0" max="50" className={inputClass} value={form.min_experience} onChange={(e)=>setForm({...form,min_experience:e.target.value})}/></Field><Field label="المؤهل المطلوب"><select className={inputClass} value={form.required_education} onChange={(e)=>setForm({...form,required_education:e.target.value})}>{Object.entries(EDUCATION_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field><Field label="آخر موعد للتقديم"><input type="date" className={inputClass} value={form.application_deadline} onChange={(e)=>setForm({...form,application_deadline:e.target.value})}/></Field></div><Field label="وصف الوظيفة"><textarea required rows="4" className={inputClass} value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></Field><div className="grid md:grid-cols-2 gap-3"><Field label="المسؤوليات — كل بند في سطر"><textarea rows="4" className={inputClass} value={form.responsibilities} onChange={(e)=>setForm({...form,responsibilities:e.target.value})}/></Field><Field label="المعايير الداخلية — كل معيار في سطر"><textarea rows="4" className={inputClass} value={form.internal_criteria} onChange={(e)=>setForm({...form,internal_criteria:e.target.value})}/></Field><Field label="المهارات الأساسية — مفصولة بفواصل"><textarea rows="3" required className={inputClass} value={form.required_skills} onChange={(e)=>setForm({...form,required_skills:e.target.value})}/></Field><Field label="المهارات المفضلة"><textarea rows="3" className={inputClass} value={form.preferred_skills} onChange={(e)=>setForm({...form,preferred_skills:e.target.value})}/></Field></div><div><div className="text-xs font-bold text-slate-400 mb-3">قنوات النشر المقترحة</div><div className="grid sm:grid-cols-2 gap-2">{asArray(channels).map((channel)=><label key={channel.id} className={`rounded-xl border p-3 flex items-center gap-3 cursor-pointer ${form.channels.includes(channel.id)?"border-emerald-500/25 bg-emerald-500/[0.05]":"border-white/8"}`}><input type="checkbox" checked={form.channels.includes(channel.id)} onChange={()=>toggleChannel(channel.id)}/><div><div className="text-sm font-bold">{channel.short_name}</div><div className="text-[10px] text-slate-600">{channel.readiness_label}</div></div></label>)}</div></div><button disabled={saving} className="w-full py-3.5 rounded-xl bg-yellow-500 text-black font-black disabled:opacity-50">{saving?"جارٍ الحفظ...":"إنشاء الوظيفة"}</button></form>;
}

function CandidateForm({ form, setForm, jobs, saving, onSubmit }) {
  return <form onSubmit={onSubmit} className="space-y-5"><div className="grid md:grid-cols-2 gap-3"><Field label="الوظيفة"><select required className={inputClass} value={form.job_id} onChange={(e)=>setForm({...form,job_id:e.target.value})}><option value="">اختر الوظيفة</option>{asArray(jobs).map((job)=><option key={job.id} value={job.id}>{job.title}</option>)}</select></Field><Field label="اسم المرشح"><input required className={inputClass} value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></Field><Field label="البريد الإلكتروني"><input type="email" className={inputClass} value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></Field><Field label="رقم التواصل"><input className={inputClass} value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/></Field><Field label="المسمى الحالي"><input className={inputClass} value={form.current_title} onChange={(e)=>setForm({...form,current_title:e.target.value})}/></Field><Field label="مصدر المرشح"><select className={inputClass} value={form.source} onChange={(e)=>setForm({...form,source:e.target.value})}><option value="internal">ترشيح داخلي</option><option value="linkedin">LinkedIn</option><option value="indeed">Indeed</option><option value="google_jobs">Google for Jobs</option><option value="handshake">Handshake</option><option value="glassdoor">Glassdoor</option><option value="bayt">بيت.كوم</option><option value="other">أخرى</option></select></Field><Field label="سنوات الخبرة"><input type="number" min="0" max="60" className={inputClass} value={form.experience_years} onChange={(e)=>setForm({...form,experience_years:e.target.value})}/></Field><Field label="المؤهل"><select className={inputClass} value={form.education_level} onChange={(e)=>setForm({...form,education_level:e.target.value})}>{Object.entries(EDUCATION_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field><Field label="رابط السيرة الذاتية"><input type="url" className={inputClass} value={form.resume_url} onChange={(e)=>setForm({...form,resume_url:e.target.value})}/></Field><Field label="المرحلة"><select className={inputClass} value={form.stage} onChange={(e)=>setForm({...form,stage:e.target.value})}>{Object.entries(STAGE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field></div><Field label="المهارات — مفصولة بفواصل"><textarea required rows="3" className={inputClass} value={form.skills} onChange={(e)=>setForm({...form,skills:e.target.value})}/></Field><div className="grid md:grid-cols-2 gap-4"><ScoreInput label="الملاءمة القطاعية" value={form.sector_fit_score} onChange={(value)=>setForm({...form,sector_fit_score:value})}/><ScoreInput label="المقابلة" value={form.interview_score} onChange={(value)=>setForm({...form,interview_score:value})}/><ScoreInput label="التوافق القيمي والمؤسسي" value={form.values_score} onChange={(value)=>setForm({...form,values_score:value})}/><ScoreInput label="الجاهزية للبدء" value={form.availability_score} onChange={(value)=>setForm({...form,availability_score:value})}/></div><Field label="ملاحظات اللجنة"><textarea rows="4" className={inputClass} value={form.committee_notes} onChange={(e)=>setForm({...form,committee_notes:e.target.value})}/></Field><button disabled={saving} className="w-full py-3.5 rounded-xl bg-yellow-500 text-black font-black disabled:opacity-50">{saving?"جارٍ التقييم...":"إضافة المرشح وحساب الملاءمة"}</button></form>;
}

function Modal({ title, onClose, children }) {
  return <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 md:p-8" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><div className="w-full max-w-5xl rounded-2xl bg-[#0d131d] border border-white/10 shadow-2xl"><div className="p-5 border-b border-white/8 flex items-center justify-between"><h2 className="font-heading text-2xl font-black">{title}</h2><button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-slate-400"><X size={20}/></button></div><div className="p-5 md:p-7">{children}</div></div></div>;
}
function Field({ label, children }) { return <label className="block"><span className="block text-xs font-bold text-slate-400 mb-2">{label}</span>{children}</label>; }
function ScoreInput({ label, value, onChange }) { return <div className="rounded-xl border border-white/8 p-3"><div className="flex justify-between text-xs mb-2"><span className="text-slate-400">{label}</span><strong className="text-emerald-300">{value}%</strong></div><input type="range" min="0" max="100" step="5" value={value} onChange={(e)=>onChange(Number(e.target.value))} className="w-full accent-emerald-500"/></div>; }
function Metric({ icon, label, value, tone = "text-slate-100" }) { return <div className={`${sectionClass} p-4`}><div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center">{icon}</div><div className={`font-heading text-3xl font-black mt-4 ${tone}`}>{value}</div><div className="text-[11px] text-slate-600 mt-1">{label}</div></div>; }
function EmptyState({ icon, title, text, action }) { return <div className="py-14 text-center"><div className="w-14 h-14 rounded-2xl bg-white/5 text-slate-500 flex items-center justify-center mx-auto">{icon}</div><h3 className="font-bold text-slate-300 mt-4">{title}</h3><p className="text-xs text-slate-600 mt-2 max-w-md mx-auto leading-6">{text}</p>{action && <div className="mt-4">{action}</div>}</div>; }
function weightLabel(key) { return ({ skills:"المهارات",experience:"الخبرة",education:"المؤهل",sector_fit:"الملاءمة القطاعية",interview:"المقابلة",values:"التوافق المؤسسي",availability:"الجاهزية" })[key] || key; }
