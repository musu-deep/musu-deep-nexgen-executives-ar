import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, Bell, BriefcaseBusiness, CalendarDays, CheckCircle2,
  Clock3, FolderKanban, ListChecks, MessageSquare, RefreshCw,
} from "lucide-react";
import api from "../lib/api";
import { FUNCTIONAL_AREA_LABELS, functionalAreaForUser } from "../lib/accessPolicy";

function asArray(payload, key) {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.[key]) ? payload[key] : [];
}

function formatNumber(value) {
  return new Intl.NumberFormat("ar").format(Number(value || 0));
}

function isOverdue(task) {
  if (["completed", "cancelled"].includes(task?.status)) return false;
  if (task?.status === "delayed") return true;
  if (!task?.due_date) return false;
  const date = new Date(task.due_date);
  return !Number.isNaN(date.getTime()) && date < new Date();
}

export default function PersonalExecutiveDashboard({ user }) {
  const [payload, setPayload] = useState({ projects: [], tasks: [], meetings: [], requests: [], notifications: [], messages: [] });
  const [loading, setLoading] = useState(true);
  const [sourceCount, setSourceCount] = useState(0);

  const load = async () => {
    setLoading(true);
    const sources = [
      ["projects", api.get("/projects")], ["tasks", api.get("/tasks")],
      ["meetings", api.get("/meetings")], ["requests", api.get("/araak-ceo/meeting-requests")],
      ["notifications", api.get("/notifications")], ["messages", api.get("/araak-ceo/messages")],
    ];
    const settled = await Promise.allSettled(sources.map(([, promise]) => promise));
    const next = { projects: [], tasks: [], meetings: [], requests: [], notifications: [], messages: [] };
    let successful = 0;
    settled.forEach((result, index) => {
      if (result.status !== "fulfilled") return;
      successful += 1;
      const key = sources[index][0];
      next[key] = asArray(result.value?.data, key);
    });
    setPayload(next);
    setSourceCount(successful);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const area = functionalAreaForUser(user);
  const areaLabel = FUNCTIONAL_AREA_LABELS[area] || FUNCTIONAL_AREA_LABELS.general;
  const overdue = payload.tasks.filter(isOverdue);
  const openTasks = payload.tasks.filter((task) => !["completed", "cancelled"].includes(task.status));
  const pendingRequests = payload.requests.filter((request) => request.status === "pending");
  const upcomingMeetings = payload.meetings
    .filter((meeting) => meeting.date && new Date(meeting.date) >= new Date() && meeting.status !== "cancelled")
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const unreadNotifications = payload.notifications.filter((item) => !item.read);
  const unreadMessages = payload.messages.filter((item) => !item.read && (
    item.recipient_user_id === user?.id || String(item.recipient_email || "").toLowerCase() === String(user?.email || "").toLowerCase()
  ));

  const priorityTasks = useMemo(() => [...openTasks].sort((left, right) => {
    if (isOverdue(left) !== isOverdue(right)) return isOverdue(left) ? -1 : 1;
    return new Date(left.due_date || "2999-12-31") - new Date(right.due_date || "2999-12-31");
  }).slice(0, 6), [payload.tasks]);

  if (loading) return <div className="space-y-5" dir="rtl"><div className="h-28 shimmer rounded-2xl"/><div className="grid grid-cols-2 lg:grid-cols-6 gap-4">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 shimmer rounded-2xl"/>)}</div></div>;

  return (
    <div dir="rtl" data-testid="personal-executive-dashboard" className="space-y-6">
      <section className="glass-card p-6 border-yellow-500/15 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
        <div>
          <div className="text-xs tracking-[0.14em] text-yellow-500/80">الملخص التنفيذي الشخصي • {areaLabel}</div>
          <h1 className="font-heading text-4xl font-black mt-2">مرحبًا، {user?.name}</h1>
          <p className="text-slate-500 text-sm mt-2">تظهر هنا فقط الأعمال والمشروعات والاجتماعات والاتصالات المرتبطة بك أو المشتركة معك.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-xs font-bold">{sourceCount}/6 مصادر متاحة</span>
          <button onClick={load} className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:text-yellow-300 flex items-center gap-2 text-sm font-bold"><RefreshCw size={16}/> تحديث الملخص</button>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Metric icon={<FolderKanban size={19}/>} label="المشروعات المشتركة" value={formatNumber(payload.projects.length)} to="/projects" />
        <Metric icon={<ListChecks size={19}/>} label="المهام المفتوحة" value={formatNumber(openTasks.length)} to="/tasks" />
        <Metric icon={<AlertTriangle size={19}/>} label="المهام المتأخرة" value={formatNumber(overdue.length)} tone="text-rose-300" to="/tasks" />
        <Metric icon={<CalendarDays size={19}/>} label="الاجتماعات القادمة" value={formatNumber(upcomingMeetings.length)} to="/meetings" />
        <Metric icon={<Clock3 size={19}/>} label="طلبات الاجتماع" value={formatNumber(pendingRequests.length)} to="/meeting-requests" />
        <Metric icon={<Bell size={19}/>} label="تنبيهات غير مقروءة" value={formatNumber(unreadNotifications.length + unreadMessages.length)} tone="text-amber-300" to="/notifications" />
      </section>

      <section className="glass-card p-5 border-yellow-500/20">
        <div className="text-[10px] tracking-[0.12em] text-yellow-400 mb-2">الخلاصة التنفيذية ضمن نطاقك الوظيفي</div>
        <p className="text-sm text-slate-300 leading-7">
          لديك {formatNumber(payload.projects.length)} مشروعًا مشتركًا و{formatNumber(openTasks.length)} مهمة مفتوحة، منها {formatNumber(overdue.length)} متأخرة. كما تظهر {formatNumber(upcomingMeetings.length)} اجتماعات قادمة و{formatNumber(pendingRequests.length)} طلب اجتماع قائم. الأولوية اليومية هي إغلاق المهام المتأخرة، ثم مراجعة أقرب الاستحقاقات والاستعداد للاجتماعات المرتبطة بك.
        </p>
      </section>

      <section className="grid xl:grid-cols-3 gap-5">
        <div className="glass-card p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-5"><div><div className="text-xs text-slate-500">الأولوية التنفيذية</div><h2 className="font-heading text-xl font-black mt-1">مهامي القادمة</h2></div><Link to="/tasks" className="text-xs text-yellow-400">عرض المهام</Link></div>
          <div className="space-y-3">{priorityTasks.length ? priorityTasks.map((task) => <div key={task.id || task.title} className="p-4 rounded-xl bg-white/[0.025] border border-white/5 flex items-center justify-between gap-4"><div><div className="font-bold">{task.title}</div><div className="text-xs text-slate-500 mt-1">{task.due_date ? new Date(task.due_date).toLocaleDateString("ar") : "دون تاريخ استحقاق"}</div></div><span className={`text-xs px-2 py-1 rounded ${isOverdue(task) ? "bg-rose-500/10 text-rose-300" : "bg-emerald-500/10 text-emerald-300"}`}>{isOverdue(task) ? "متأخرة" : "قائمة"}</span></div>) : <Empty text="لا توجد مهام مسندة أو مشتركة حاليًا."/>}</div>
        </div>
        <div className="glass-card p-6">
          <div className="text-xs text-slate-500">اللقاءات</div><h2 className="font-heading text-xl font-black mt-1 mb-5">أقرب الاجتماعات</h2>
          <div className="space-y-3">{upcomingMeetings.slice(0, 5).map((meeting) => <div key={meeting.id || meeting.title} className="p-3 rounded-xl bg-white/[0.025] border border-white/5"><div className="font-bold text-sm">{meeting.title}</div><div className="text-xs text-slate-500 mt-1">{new Date(meeting.date).toLocaleString("ar")}</div></div>)}{!upcomingMeetings.length && <Empty text="لا توجد اجتماعات قادمة مرتبطة بك."/>}</div>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        <QuickLink icon={<MessageSquare size={18}/>} title="الاتصالات الشخصية" text="المراسلات المرسلة إليك أو الصادرة منك فقط." to="/messages" />
        <QuickLink icon={<BriefcaseBusiness size={18}/>} title="نطاق الصلاحية" text={`الوصول مقيد بوظيفة: ${areaLabel}.`} to="/settings" />
        <QuickLink icon={<CheckCircle2 size={18}/>} title="طلب لقاء" text="تقديم طلب اجتماع ومتابعة قرار اعتماده." to="/meeting-requests" />
      </section>
    </div>
  );
}

function Metric({ icon, label, value, tone = "text-slate-100", to }) {
  return <Link to={to} className="glass-card p-4 hover:border-yellow-500/25 hover:-translate-y-0.5 transition"><div className="flex justify-between items-start"><span className="w-10 h-10 rounded-xl bg-yellow-500/10 text-yellow-400 flex items-center justify-center">{icon}</span><strong className={`font-heading text-3xl font-black ${tone}`}>{value}</strong></div><div className="text-xs text-slate-500 mt-4">{label}</div></Link>;
}
function QuickLink({ icon, title, text, to }) { return <Link to={to} className="glass-card p-5 hover:border-yellow-500/25 transition"><div className="text-yellow-400">{icon}</div><h3 className="font-bold mt-3">{title}</h3><p className="text-xs text-slate-500 mt-2 leading-6">{text}</p></Link>; }
function Empty({ text }) { return <div className="p-6 text-center rounded-xl border border-dashed border-white/10 text-slate-600 text-sm">{text}</div>; }
