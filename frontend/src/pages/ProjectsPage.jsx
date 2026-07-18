import React, { useEffect, useState } from "react";
import api, { SECTOR_LABELS, STATUS_LABELS, PRIORITY_LABELS } from "../lib/api";
import RAGBadge from "../components/RAGBadge";
import { Link } from "react-router-dom";
import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

const SECTORS = Object.entries(SECTOR_LABELS);

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", sector: "arak_development",
    progress: 0, status: "active", priority: "medium",
    end_date: "", budget: 0,
  });

  const load = () => api.get("/projects").then((r) => setProjects(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const filtered = projects.filter((project) =>
    (sector === "all" || project.sector === sector) &&
    (!q || project.name.includes(q) || (project.description || "").includes(q))
  );

  const submit = async (event) => {
    event.preventDefault();
    try {
      await api.post("/projects", { ...form, progress: Number(form.progress), budget: Number(form.budget) });
      toast.success("تم إنشاء المشروع بنجاح");
      setShowForm(false);
      setForm({ name: "", description: "", sector: "arak_development", progress: 0, status: "active", priority: "medium", end_date: "", budget: 0 });
      load();
    } catch {
      toast.error("تعذر إنشاء المشروع");
    }
  };

  return (
    <div data-testid="projects-page" dir="rtl">
      <div className="flex items-center justify-between mb-7 flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">إدارة المشروعات</div>
          <h1 className="font-heading text-4xl font-black text-slate-50 mt-2">المشروعات</h1>
          <p className="text-slate-500 mt-1 text-sm">{filtered.length} مشروعًا • وفق صلاحيات الوصول الخاصة بك</p>
        </div>
        <button
          data-testid="new-project-btn"
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-l from-yellow-500 to-yellow-600 text-black font-bold flex items-center gap-2 hover:from-yellow-400 hover:to-yellow-500 shadow-lg shadow-yellow-900/20"
        >
          <Plus size={18}/> مشروع جديد
        </button>
      </div>

      <div className="glass-card p-4 mb-6 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
          <input
            data-testid="search-projects"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="ابحث في المشروعات..."
            className="w-full pr-10 pl-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:border-yellow-500/40 focus:outline-none text-sm"
          />
        </div>
        <select
          data-testid="filter-sector"
          value={sector}
          onChange={(event) => setSector(event.target.value)}
          className="px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:border-yellow-500/40 focus:outline-none text-sm"
        >
          <option value="all">جميع القطاعات</option>
          {SECTORS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map((item) => <div key={item} className="h-44 shimmer rounded-lg"></div>)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-slate-500">لم يتم العثور على مشروعات</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              data-testid={`project-card-${project.id}`}
              className="glass-card p-5 hover:border-yellow-500/30 transition-all hover:translate-y-[-2px] block group"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <RAGBadge rag={project.rag}/>
                <span className="text-[10px] tracking-wider text-slate-500">{SECTOR_LABELS[project.sector]}</span>
              </div>
              <h3 className="font-heading text-lg font-bold text-slate-100 group-hover:text-yellow-300 transition-colors line-clamp-2">{project.name}</h3>
              <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">{project.description}</p>
              <div className="mt-5">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400">نسبة الإنجاز</span>
                  <span className="text-yellow-400 tabular-nums font-bold">{project.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-l from-yellow-400 to-yellow-600" style={{width: `${project.progress}%`}}></div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
                <span className="px-2 py-1 rounded bg-white/5">{STATUS_LABELS[project.status]}</span>
                <span className="px-2 py-1 rounded bg-white/5">الأولوية: {PRIORITY_LABELS[project.priority]}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="glass-card p-6 max-w-lg w-full" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-xl font-bold">إنشاء مشروع جديد</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/10 rounded" aria-label="إغلاق"><X size={18}/></button>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <input data-testid="form-project-name" required placeholder="اسم المشروع" value={form.name} onChange={(event) => setForm({...form, name: event.target.value})}
                className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:border-yellow-500/40 focus:outline-none text-sm"/>
              <textarea placeholder="وصف مختصر للمشروع" value={form.description} onChange={(event) => setForm({...form, description: event.target.value})}
                className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:border-yellow-500/40 focus:outline-none text-sm min-h-[80px]"/>
              <div className="grid grid-cols-2 gap-3">
                <select data-testid="form-project-sector" value={form.sector} onChange={(event) => setForm({...form, sector: event.target.value})}
                  className="px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:outline-none text-sm">
                  {SECTORS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <select value={form.priority} onChange={(event) => setForm({...form, priority: event.target.value})}
                  className="px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:outline-none text-sm">
                  {Object.entries(PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>الأولوية: {label}</option>)}
                </select>
                <input type="number" min={0} max={100} placeholder="نسبة الإنجاز" value={form.progress} onChange={(event) => setForm({...form, progress: event.target.value})}
                  className="px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:outline-none text-sm"/>
                <input type="number" placeholder="الميزانية" value={form.budget} onChange={(event) => setForm({...form, budget: event.target.value})}
                  className="px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:outline-none text-sm"/>
                <input type="date" value={form.end_date} onChange={(event) => setForm({...form, end_date: event.target.value})}
                  className="col-span-2 px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:outline-none text-sm"/>
              </div>
              <button data-testid="form-submit-project" type="submit"
                className="w-full py-3 rounded-lg bg-gradient-to-l from-yellow-500 to-yellow-600 text-black font-bold hover:from-yellow-400">
                إنشاء المشروع
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
