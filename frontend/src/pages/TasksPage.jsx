import React, { useEffect, useState } from "react";
import api, { PRIORITY_LABELS, SECTOR_LABELS } from "../lib/api";
import { Plus, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const COLUMNS = [
  { key: "pending", label: "قيد الانتظار", color: "bg-slate-500/10 border-slate-500/30 text-slate-300" },
  { key: "in_progress", label: "قيد التنفيذ", color: "bg-sky-500/10 border-sky-500/30 text-sky-300" },
  { key: "awaiting_approval", label: "بانتظار الاعتماد", color: "bg-amber-500/10 border-amber-500/30 text-amber-300" },
  { key: "delayed", label: "متأخرة", color: "bg-rose-500/10 border-rose-500/30 text-rose-300" },
  { key: "completed", label: "مكتملة", color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" },
];

const PRIORITY_DOT = {
  critical: "bg-rose-500",
  high: "bg-amber-500",
  medium: "bg-yellow-500",
  low: "bg-slate-500",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  project_id: "",
  sector: "arak_development",
  priority: "medium",
  status: "pending",
  due_date: "",
  progress: 0,
};

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    try {
      const [taskResponse, projectResponse] = await Promise.all([
        api.get("/tasks"),
        api.get("/projects"),
      ]);
      setTasks(taskResponse.data);
      setProjects(projectResponse.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (taskId, newStatus) => {
    try {
      await api.patch(`/tasks/${taskId}`, { status: newStatus });
      toast.success("تم تحديث حالة المهمة");
      load();
    } catch {
      toast.error("تعذر تحديث المهمة");
    }
  };

  const approveTask = async (taskId) => {
    try {
      await api.post(`/tasks/${taskId}/approve`);
      toast.success("تم اعتماد المهمة بنجاح");
      load();
    } catch {
      toast.error("ليست لديك صلاحية اعتماد هذه المهمة");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      const payload = { ...form, progress: Number(form.progress) };
      if (!payload.project_id) delete payload.project_id;
      await api.post("/tasks", payload);
      toast.success("تم إنشاء المهمة بنجاح");
      setShowForm(false);
      setForm(EMPTY_FORM);
      load();
    } catch {
      toast.error("تعذر إنشاء المهمة");
    }
  };

  return (
    <div data-testid="tasks-page" dir="rtl">
      <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">إدارة المهام</div>
          <h1 className="font-heading text-4xl font-black mt-2">لوحة المهام التنفيذية</h1>
          <p className="text-slate-500 mt-1 text-sm">{tasks.length} مهمة • {COLUMNS.length} حالات تنفيذية</p>
        </div>
        <button
          data-testid="new-task-btn"
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-l from-yellow-500 to-yellow-600 text-black font-bold flex items-center gap-2"
        >
          <Plus size={18} /> مهمة جديدة
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {COLUMNS.map((column) => <div key={column.key} className="h-80 shimmer rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {COLUMNS.map((column) => {
            const columnTasks = tasks.filter((task) => task.status === column.key);
            return (
              <div key={column.key} className="glass-card p-3" data-testid={`column-${column.key}`}>
                <div className={`text-xs font-bold rounded px-3 py-2 mb-3 ${column.color} border flex items-center justify-between`}>
                  <span>{column.label}</span>
                  <span className="tabular-nums">{columnTasks.length}</span>
                </div>

                <div className="space-y-2 min-h-[200px]">
                  {columnTasks.map((task) => (
                    <div key={task.id} className="bg-[#0a0d14]/80 border border-white/5 rounded-lg p-3 hover:border-yellow-500/30 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority]} mt-1.5`} />
                        <div className="text-xs text-slate-500">{SECTOR_LABELS[task.sector]?.slice(0, 18)}</div>
                      </div>

                      <div className="text-sm font-medium text-slate-100 line-clamp-2">{task.title}</div>
                      {task.due_date && (
                        <div className="text-[11px] text-slate-500 mt-1.5">
                          الاستحقاق: {new Date(task.due_date).toLocaleDateString("ar")}
                        </div>
                      )}

                      <div className="mt-2.5 h-1 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full bg-yellow-500" style={{ width: `${task.progress}%` }} />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1">
                        {column.key === "awaiting_approval" && (
                          <button
                            onClick={() => approveTask(task.id)}
                            className="text-[10px] px-2 py-1 bg-emerald-500/15 text-emerald-300 rounded hover:bg-emerald-500/25 flex items-center gap-1"
                          >
                            <CheckCircle2 size={10} /> اعتماد
                          </button>
                        )}
                        {COLUMNS.filter((candidate) => candidate.key !== task.status).slice(0, 2).map((candidate) => (
                          <button
                            key={candidate.key}
                            onClick={() => updateStatus(task.id, candidate.key)}
                            className="text-[10px] px-2 py-1 bg-white/5 text-slate-400 rounded hover:bg-yellow-500/10 hover:text-yellow-300"
                          >
                            ← {candidate.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {columnTasks.length === 0 && (
                    <div className="text-xs text-slate-600 text-center py-6">لا توجد مهام</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="glass-card p-6 max-w-lg w-full" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-xl font-bold">مهمة تنفيذية جديدة</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/10 rounded" aria-label="إغلاق"><X size={18} /></button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <input required placeholder="عنوان المهمة" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm" />
              <textarea placeholder="وصف المهمة" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })}
                className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm min-h-[70px]" />

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={form.project_id}
                  onChange={(event) => {
                    const project = projects.find((item) => item.id === event.target.value);
                    setForm({ ...form, project_id: event.target.value, sector: project ? project.sector : form.sector });
                  }}
                  className="px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"
                >
                  <option value="">دون مشروع مرتبط</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>

                <select value={form.sector} onChange={(event) => setForm({ ...form, sector: event.target.value })}
                  className="px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm">
                  {Object.entries(SECTOR_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>

                <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}
                  className="px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm">
                  {Object.entries(PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>الأولوية: {label}</option>)}
                </select>

                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}
                  className="px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm">
                  {COLUMNS.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
                </select>

                <input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })}
                  className="col-span-2 px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm" />
              </div>

              <button type="submit" className="w-full py-3 rounded-lg bg-yellow-500 text-black font-bold hover:bg-yellow-400">إنشاء المهمة</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
