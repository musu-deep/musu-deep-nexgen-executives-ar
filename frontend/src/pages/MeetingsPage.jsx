import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../lib/api";
import { Plus, Video, MapPin, Clock, X, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import DetailModal from "../components/DetailModal";
import AICommandBar from "../components/AICommandBar";

const TYPE_LABEL = { individual: "فردي", periodic: "دوري", emergency: "طارئ", board: "مجلس إدارة" };

export default function MeetingsPage() {
  const location = useLocation();
  const [meetings, setMeetings] = useState([]);
  const [users, setUsers] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", meeting_type: "individual", date: "", duration_minutes: 60, location: "", meeting_link: "", attendee_ids: [], is_remote: false });
  const [selected, setSelected] = useState(null);
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);

  const load = () => Promise.all([api.get("/meetings"), api.get("/users")]).then(([meetingResponse, userResponse]) => {
    setMeetings(meetingResponse.data);
    setUsers(userResponse.data);
  });

  useEffect(() => {
    load();
    if (location.state?.intent === "create_meeting") {
      setShow(true);
      setForm((previous) => ({
        ...previous,
        title: "اجتماع استراتيجي تنفيذي",
        description: "اجتماع طُلب عبر الوكيل التنفيذي الذكي",
        meeting_type: "individual",
        duration_minutes: 60,
      }));
    }
  }, []);

  const generateBrief = async (item) => {
    setBriefLoading(true);
    try {
      const response = await api.post("/ai/executive-brief", { source_type: "meeting", item });
      setBrief(response.data);
    } finally {
      setBriefLoading(false);
    }
  };

  const openDetail = (item) => { setSelected(item); setBrief(null); };

  const submit = async (event) => {
    event.preventDefault();
    try {
      await api.post("/meetings", { ...form, date: new Date(form.date).toISOString() });
      toast.success("تمت جدولة الاجتماع التنفيذي بنجاح");
      setShow(false);
      load();
      setForm({ title: "", description: "", meeting_type: "individual", date: "", duration_minutes: 60, location: "", meeting_link: "", attendee_ids: [], is_remote: false });
    } catch {
      toast.error("تعذر إنشاء الاجتماع");
    }
  };

  return (
    <div data-testid="meetings-page" dir="rtl">
      <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">إدارة الاجتماعات</div>
          <h1 className="font-heading text-4xl font-black mt-2">الاجتماعات التنفيذية</h1>
          <p className="text-slate-500 text-sm mt-1">{meetings.length} اجتماعًا مسجلًا</p>
        </div>
        <button data-testid="new-meeting-btn" onClick={() => setShow(true)} className="px-5 py-2.5 rounded-lg bg-gradient-to-l from-yellow-500 to-yellow-600 text-black font-bold flex items-center gap-2">
          <Plus size={18}/> اجتماع جديد
        </button>
      </div>

      <AICommandBar />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {meetings.length === 0 ? (
          <div className="glass-card p-12 text-center text-slate-500 col-span-2">لا توجد اجتماعات مجدولة</div>
        ) : meetings.map((meeting) => (
          <div key={meeting.id} className="glass-card p-5 cursor-pointer hover:border-yellow-500/25 hover:bg-white/[0.03] transition-colors" onClick={() => openDetail(meeting)}>
            <div className="flex items-start justify-between mb-3 gap-3">
              <span className="text-[10px] tracking-wider text-yellow-500/80 px-2 py-1 bg-yellow-500/5 rounded">{TYPE_LABEL[meeting.meeting_type]}</span>
              <span className="text-xs text-slate-500">{new Date(meeting.date).toLocaleString("ar", {dateStyle: "medium", timeStyle: "short"})}</span>
            </div>
            <h3 className="font-heading text-lg font-bold">{meeting.title}</h3>
            <p className="text-sm text-slate-400 mt-1 line-clamp-2">{meeting.description}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Clock size={12}/> {meeting.duration_minutes} دقيقة</span>
              {meeting.location && <span className="flex items-center gap-1"><MapPin size={12}/> {meeting.location}</span>}
              <span className="flex items-center gap-1"><UsersIcon size={12}/> {meeting.attendee_ids?.length || 0} من الحضور</span>
            </div>
            {meeting.meeting_link && (
              <a
                href={meeting.meeting_link}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="mt-3 inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
              >
                <Video size={12}/> دخول الاجتماع
              </a>
            )}
          </div>
        ))}
      </div>

      {show && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <div className="glass-card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-xl font-bold">إنشاء اجتماع جديد</h2>
              <button onClick={() => setShow(false)} aria-label="إغلاق"><X size={18}/></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <input required placeholder="عنوان الاجتماع" value={form.title} onChange={(event) => setForm({...form, title: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"/>
              <textarea placeholder="وصف الاجتماع" value={form.description} onChange={(event) => setForm({...form, description: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm min-h-[70px]"/>
              <div className="grid grid-cols-2 gap-3">
                <select value={form.meeting_type} onChange={(event) => setForm({...form, meeting_type: event.target.value})} className="px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm">
                  {Object.entries(TYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <input type="number" placeholder="مدة الاجتماع بالدقائق" value={form.duration_minutes} onChange={(event) => setForm({...form, duration_minutes: Number(event.target.value)})} className="px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"/>
                <input required type="datetime-local" value={form.date} onChange={(event) => setForm({...form, date: event.target.value})} className="col-span-2 px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"/>
                <input placeholder="الموقع" value={form.location} onChange={(event) => setForm({...form, location: event.target.value})} className="px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"/>
                <input placeholder="رابط Zoom أو Meet — اختياري" value={form.meeting_link} onChange={(event) => setForm({...form, meeting_link: event.target.value, is_remote: Boolean(event.target.value)})} className="px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm text-left" dir="ltr"/>
              </div>
              <div className="border border-white/10 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-2">الحضور</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {users.map((user) => (
                    <label key={user.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/5 px-2 py-1 rounded">
                      <input type="checkbox" checked={form.attendee_ids.includes(user.id)} onChange={(event) => {
                        const ids = event.target.checked ? [...form.attendee_ids, user.id] : form.attendee_ids.filter((id) => id !== user.id);
                        setForm({...form, attendee_ids: ids});
                      }}/>
                      <span>{user.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full py-3 rounded-lg bg-yellow-500 text-black font-bold">إنشاء الاجتماع</button>
            </form>
          </div>
        </div>
      )}

      {selected && <DetailModal item={selected} title={selected.title} type="meeting" onClose={() => setSelected(null)} onGenerateBrief={generateBrief} brief={brief} loadingBrief={briefLoading} />}
    </div>
  );
}
