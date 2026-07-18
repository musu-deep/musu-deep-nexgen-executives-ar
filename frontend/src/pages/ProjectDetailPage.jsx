import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { SECTOR_LABELS, STATUS_LABELS, PRIORITY_LABELS } from "../lib/api";
import RAGBadge from "../components/RAGBadge";
import { ArrowRight, Calendar, DollarSign, Flag, FileText } from "lucide-react";
import { toast } from "sonner";

const UPDATE_TYPE_LABELS = {
  progress: "تقدم",
  milestone: "معلم رئيسي",
  issue: "مشكلة",
  report: "تقرير",
  note: "ملاحظة",
};

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [tab, setTab] = useState("overview");
  const [newUpdate, setNewUpdate] = useState({ update_type: "progress", content: "", progress: "" });

  const load = async () => {
    const [projectResponse, taskResponse, updateResponse] = await Promise.all([
      api.get(`/projects/${id}`),
      api.get("/tasks", { params: { project_id: id } }),
      api.get("/progress", { params: { project_id: id } }),
    ]);
    setProject(projectResponse.data);
    setTasks(taskResponse.data);
    setUpdates(updateResponse.data);
  };

  useEffect(() => { load(); }, [id]);

  const submitUpdate = async (event) => {
    event.preventDefault();
    try {
      const payload = { project_id: id, update_type: newUpdate.update_type, content: newUpdate.content };
      if (newUpdate.progress !== "") payload.progress = Number(newUpdate.progress);
      await api.post("/progress", payload);
      toast.success("تم تسجيل التحديث بنجاح");
      setNewUpdate({ update_type: "progress", content: "", progress: "" });
      load();
    } catch {
      toast.error("تعذر إضافة التحديث");
    }
  };

  if (!project) return <div className="h-32 shimmer rounded-lg"></div>;

  return (
    <div data-testid="project-detail" dir="rtl">
      <Link to="/projects" className="text-xs text-slate-400 hover:text-yellow-400 flex items-center gap-1 mb-4">
        <ArrowRight size={14}/> العودة إلى المشروعات
      </Link>

      <div className="glass-card p-7 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[300px]">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <RAGBadge rag={project.rag} size="lg"/>
              <span className="text-[11px] tracking-wider text-yellow-500/80 px-2 py-1 bg-yellow-500/5 rounded">{SECTOR_LABELS[project.sector]}</span>
              <span className="text-[11px] tracking-wider text-slate-400 px-2 py-1 bg-white/5 rounded">{STATUS_LABELS[project.status]}</span>
            </div>
            <h1 className="font-heading text-3xl font-black text-slate-50">{project.name}</h1>
            <p className="text-slate-400 mt-2 leading-relaxed">{project.description}</p>
          </div>
          <div className="text-center">
            <div className="text-xs tracking-wider text-slate-500 mb-2">إنجاز المشروع</div>
            <div className="text-5xl font-heading font-black text-yellow-400 tabular-nums">{project.progress}%</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/5">
          <Info icon={<Calendar size={14}/>} label="تاريخ الانتهاء" value={project.end_date ? new Date(project.end_date).toLocaleDateString("ar") : "—"}/>
          <Info icon={<DollarSign size={14}/>} label="الميزانية" value={new Intl.NumberFormat("ar").format(project.budget || 0)}/>
          <Info icon={<Flag size={14}/>} label="الأولوية" value={PRIORITY_LABELS[project.priority]}/>
          <Info icon={<FileText size={14}/>} label="عدد المهام" value={tasks.length}/>
        </div>
      </div>

      <div className="flex gap-2 mb-5 border-b border-white/5">
        {[
          { key: "overview", label: "نظرة عامة" },
          { key: "tasks", label: `المهام (${tasks.length})` },
          { key: "updates", label: `التحديثات (${updates.length})` },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            data-testid={`tab-${item.key}`}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === item.key ? "border-yellow-500 text-yellow-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="glass-card p-6">
          <h3 className="font-heading text-lg font-bold mb-4">تقدم المشروع</h3>
          <div className="relative h-8 bg-white/5 rounded-lg overflow-hidden">
            <div className="absolute inset-y-0 right-0 rounded-lg bg-gradient-to-l from-yellow-400 via-yellow-500 to-yellow-700" style={{ width: `${project.progress}%` }}>
              <div className="h-full flex items-center justify-end px-3 text-xs font-bold text-black tabular-nums">{project.progress}%</div>
            </div>
          </div>
        </div>
      )}

      {tab === "tasks" && (
        <div className="glass-card p-6">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-slate-500">لا توجد مهام مرتبطة بالمشروع</div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/5 gap-4">
                  <div>
                    <div className="font-medium text-slate-100">{task.title}</div>
                    <div className="text-xs text-slate-500 mt-1 flex gap-3 flex-wrap">
                      <span>{STATUS_LABELS[task.status]}</span>
                      <span>الأولوية: {PRIORITY_LABELS[task.priority]}</span>
                      {task.due_date && <span>الاستحقاق: {new Date(task.due_date).toLocaleDateString("ar")}</span>}
                    </div>
                  </div>
                  <div className="text-yellow-400 tabular-nums font-bold">{task.progress}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "updates" && (
        <div className="grid lg:grid-cols-3 gap-5">
          <form onSubmit={submitUpdate} className="glass-card p-5 space-y-3">
            <h3 className="font-heading font-bold mb-2">إضافة تحديث</h3>
            <select value={newUpdate.update_type} onChange={(event) => setNewUpdate({...newUpdate, update_type: event.target.value})}
              className="w-full px-3 py-2 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm">
              {Object.entries(UPDATE_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <textarea required placeholder="محتوى التحديث..." value={newUpdate.content} onChange={(event) => setNewUpdate({...newUpdate, content: event.target.value})}
              className="w-full px-3 py-2 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm min-h-[100px]"/>
            <input type="number" min={0} max={100} placeholder="نسبة الإنجاز الجديدة — اختياري" value={newUpdate.progress} onChange={(event) => setNewUpdate({...newUpdate, progress: event.target.value})}
              className="w-full px-3 py-2 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"/>
            <button data-testid="submit-update" type="submit" className="w-full py-2.5 rounded-lg bg-yellow-500 text-black font-bold hover:bg-yellow-400">حفظ التحديث</button>
          </form>

          <div className="lg:col-span-2 space-y-2">
            {updates.length === 0 ? (
              <div className="glass-card p-8 text-center text-slate-500">لا توجد تحديثات متاحة</div>
            ) : updates.map((update) => (
              <div key={update.id} className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded">{UPDATE_TYPE_LABELS[update.update_type] || update.update_type}</span>
                  <span className="text-xs text-slate-500">{new Date(update.created_at).toLocaleString("ar")}</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">{update.content}</p>
                <div className="text-xs text-slate-500 mt-2">— {update.user_name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ icon, label, value }) {
  return (
    <div>
      <div className="text-[11px] tracking-wider text-slate-500 flex items-center gap-1.5">{icon} {label}</div>
      <div className="mt-1 text-slate-100 font-medium tabular-nums">{value}</div>
    </div>
  );
}
