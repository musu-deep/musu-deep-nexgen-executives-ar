import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { ChevronRight, ChevronLeft, Plus, X, Bell, Palette as PaletteIcon, Trash2, Edit3, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

const COLORS = [
  { value: "#D4AF37", name: "ذهبي" },
  { value: "#10b981", name: "أخضر" },
  { value: "#3b82f6", name: "أزرق" },
  { value: "#f59e0b", name: "كهرماني" },
  { value: "#ef4444", name: "أحمر" },
  { value: "#a855f7", name: "بنفسجي" },
  { value: "#ec4899", name: "وردي" },
  { value: "#64748b", name: "رمادي" },
];

const REMINDERS = [
  { value: 0, label: "عند موعد الحدث" },
  { value: 5, label: "قبل 5 دقائق" },
  { value: 15, label: "قبل 15 دقيقة" },
  { value: 30, label: "قبل 30 دقيقة" },
  { value: 60, label: "قبل ساعة" },
  { value: 1440, label: "قبل يوم" },
];

const EMPTY_FORM = {
  title: "",
  description: "",
  start_date: "",
  start_time: "09:00",
  end_time: "10:00",
  all_day: false,
  color: "#D4AF37",
  reminder_minutes: 15,
  active: true,
  event_type: "manual",
};

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [current, setCurrent] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedSystemEvent, setSelectedSystemEvent] = useState(null);

  const load = () => api.get("/calendar").then((response) => setEvents(response.data));
  useEffect(() => { load(); }, []);

  const openAdd = (dateString) => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, start_date: dateString || new Date().toISOString().slice(0, 10) });
    setShowForm(true);
  };

  const openEdit = (eventItem) => {
    if (!eventItem.id?.startsWith("manual") && !eventItem.user_id) {
      setSelectedSystemEvent(eventItem);
      return;
    }
    const date = new Date(eventItem.start);
    setEditing(eventItem);
    setForm({
      title: eventItem.title.replace(/^(اجتماع|مهمة):\s*/, ""),
      description: eventItem.description || "",
      start_date: date.toISOString().slice(0, 10),
      start_time: date.toTimeString().slice(0, 5),
      end_time: eventItem.end ? new Date(eventItem.end).toTimeString().slice(0, 5) : "10:00",
      all_day: eventItem.all_day || false,
      color: eventItem.color || "#D4AF37",
      reminder_minutes: eventItem.reminder_minutes ?? 15,
      active: eventItem.active !== false,
      event_type: "manual",
    });
    setShowForm(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      const start = form.all_day
        ? new Date(`${form.start_date}T00:00:00`).toISOString()
        : new Date(`${form.start_date}T${form.start_time}`).toISOString();
      const end = form.all_day ? null : new Date(`${form.start_date}T${form.end_time}`).toISOString();
      const payload = {
        title: form.title,
        description: form.description,
        start,
        end,
        event_type: "manual",
        color: form.color,
        all_day: form.all_day,
        reminder_minutes: Number(form.reminder_minutes),
        active: form.active,
      };
      if (editing && (editing.user_id || editing.id?.startsWith("manual"))) {
        await api.patch(`/calendar/${editing.id}`, payload);
        toast.success("تم تحديث الحدث");
      } else {
        await api.post("/calendar", payload);
        toast.success("تمت إضافة الحدث");
      }
      setShowForm(false);
      load();
    } catch {
      toast.error("تعذر حفظ الحدث");
    }
  };

  const deleteEvent = async () => {
    if (!editing || !window.confirm("هل تريد حذف هذا الحدث؟")) return;
    await api.delete(`/calendar/${editing.id}`);
    toast.success("تم حذف الحدث");
    setShowForm(false);
    load();
  };

  const toggleActive = async (event) => {
    event.stopPropagation?.();
    try {
      await api.patch(`/calendar/${editing.id}`, { active: !form.active });
      setForm({ ...form, active: !form.active });
      load();
    } catch {
      toast.error("تعذر تغيير حالة الحدث");
    }
  };

  const year = current.getFullYear();
  const month = current.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const cells = [];
  for (let index = 0; index < first.getDay(); index += 1) cells.push(null);
  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = new Date(year, month, day);
    const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayEvents = events.filter((eventItem) => {
      const eventDate = new Date(eventItem.start);
      return eventDate.getFullYear() === year && eventDate.getMonth() === month && eventDate.getDate() === day;
    });
    cells.push({ day, date, dateString, events: dayEvents });
  }

  const monthName = current.toLocaleDateString("ar", { month: "long", year: "numeric" });
  const weekDays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  return (
    <div data-testid="calendar-page" dir="rtl">
      <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">التقويم</div>
          <h1 className="font-heading text-4xl font-black mt-2">التقويم التنفيذي</h1>
          <p className="text-slate-500 text-sm mt-1">اضغط على أي يوم لإضافة حدث، أو على الحدث لتعديله</p>
        </div>
        <button onClick={() => openAdd()} data-testid="add-event-btn" className="px-5 py-2.5 rounded-lg bg-gradient-to-l from-yellow-500 to-yellow-600 text-black font-bold flex items-center gap-2"><Plus size={18}/> حدث جديد</button>
      </div>

      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => setCurrent(new Date(year, month - 1, 1))} className="p-2 rounded hover:bg-white/5" aria-label="الشهر السابق"><ChevronRight size={18}/></button>
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-xl font-bold">{monthName}</h2>
            <button onClick={() => setCurrent(new Date())} className="text-xs px-3 py-1 rounded bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20">اليوم</button>
          </div>
          <button onClick={() => setCurrent(new Date(year, month + 1, 1))} className="p-2 rounded hover:bg-white/5" aria-label="الشهر التالي"><ChevronLeft size={18}/></button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((dayName) => <div key={dayName} className="text-center text-[11px] text-slate-500 py-2">{dayName}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, index) => {
            if (!cell) return <div key={index} className="h-28"></div>;
            const isToday = new Date().toDateString() === cell.date.toDateString();
            return (
              <div
                key={index}
                onClick={() => openAdd(cell.dateString)}
                className={`h-28 p-2 rounded-lg border cursor-pointer transition-all ${isToday ? "border-yellow-500/40 bg-yellow-500/5" : "border-white/5 bg-white/[0.02] hover:border-yellow-500/30 hover:bg-yellow-500/[0.03]"} overflow-hidden group`}
              >
                <div className="flex items-center justify-between">
                  <div className={`text-xs font-bold tabular-nums ${isToday ? "text-yellow-300" : "text-slate-400"}`}>{cell.day}</div>
                  <Plus size={12} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"/>
                </div>
                <div className="mt-1 space-y-0.5">
                  {cell.events.slice(0, 3).map((eventItem, eventIndex) => (
                    <button
                      key={eventIndex}
                      onClick={(event) => { event.stopPropagation(); openEdit(eventItem); }}
                      className="block w-full text-right text-[10px] truncate px-1.5 py-0.5 rounded hover:opacity-90"
                      style={{ background: `${eventItem.color || "#D4AF37"}25`, color: eventItem.color || "#D4AF37", opacity: eventItem.active === false ? 0.4 : 1 }}
                    >
                      {eventItem.title}
                    </button>
                  ))}
                  {cell.events.length > 3 && <div className="text-[10px] text-slate-500 px-1.5">+{cell.events.length - 3} أخرى</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedSystemEvent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedSystemEvent(null)}>
          <div className="glass-card p-6 max-w-md w-full" onClick={(event) => event.stopPropagation()}>
            <h2 className="font-heading text-lg font-bold mb-2">{selectedSystemEvent.title}</h2>
            <div className="text-xs text-slate-400 mb-3">{new Date(selectedSystemEvent.start).toLocaleString("ar")}</div>
            {selectedSystemEvent.description && <p className="text-sm text-slate-300">{selectedSystemEvent.description}</p>}
            <div className="mt-4 text-xs text-slate-500">حدث تلقائي تتم إدارته من الوحدة الأصلية المرتبطة به</div>
            <button onClick={() => setSelectedSystemEvent(null)} className="mt-4 w-full py-2 rounded bg-white/5">إغلاق</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="glass-card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-xl font-bold flex items-center gap-2">
                {editing ? <><Edit3 size={18}/> تعديل الحدث</> : <><Plus size={18}/> حدث جديد</>}
              </h2>
              <div className="flex items-center gap-1">
                {editing && (
                  <>
                    <button onClick={toggleActive} title={form.active ? "تعطيل الحدث" : "تفعيل الحدث"} className="p-2 rounded hover:bg-white/10">
                      {form.active ? <ToggleRight className="text-emerald-400" size={18}/> : <ToggleLeft className="text-slate-500" size={18}/>} 
                    </button>
                    <button onClick={deleteEvent} className="p-2 rounded hover:bg-rose-500/10 text-rose-300" aria-label="حذف"><Trash2 size={16}/></button>
                  </>
                )}
                <button onClick={() => setShowForm(false)} className="p-2 rounded hover:bg-white/10" aria-label="إغلاق"><X size={18}/></button>
              </div>
            </div>

            <form onSubmit={submit} className="space-y-3">
              <input required autoFocus placeholder="عنوان الحدث" value={form.title} onChange={(event) => setForm({...form, title: event.target.value})} className="w-full px-4 py-3 rounded-lg bg-[#0a0d14]/80 border border-white/10 focus:border-yellow-500/40 focus:outline-none text-base font-medium"/>
              <textarea placeholder="الوصف — اختياري" value={form.description} onChange={(event) => setForm({...form, description: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm min-h-[70px]"/>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.all_day} onChange={(event) => setForm({...form, all_day: event.target.checked})}/>
                <span>طوال اليوم</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">التاريخ</label>
                  <input required type="date" value={form.start_date} onChange={(event) => setForm({...form, start_date: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"/>
                </div>
                {!form.all_day && (
                  <>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">من</label>
                      <input type="time" value={form.start_time} onChange={(event) => setForm({...form, start_time: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"/>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">إلى</label>
                      <input type="time" value={form.end_time} onChange={(event) => setForm({...form, end_time: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"/>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-2 flex items-center gap-1"><Bell size={12}/> التذكير</label>
                <select value={form.reminder_minutes} onChange={(event) => setForm({...form, reminder_minutes: Number(event.target.value)})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm">
                  {REMINDERS.map((reminder) => <option key={reminder.value} value={reminder.value}>{reminder.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-2 flex items-center gap-1"><PaletteIcon size={12}/> اللون</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setForm({...form, color: color.value})}
                      className={`w-9 h-9 rounded-full transition-all ${form.color === color.value ? "ring-2 ring-offset-2 ring-offset-[#0a0d14] ring-white scale-110" : "hover:scale-105"}`}
                      style={{ background: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full py-3 rounded-lg bg-yellow-500 text-black font-bold hover:bg-yellow-400">{editing ? "حفظ التغييرات" : "إضافة الحدث"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
