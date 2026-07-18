import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Plus, X, Check, Calendar as CalIcon, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import DetailModal from "../components/DetailModal";
import AICommandBar from "../components/AICommandBar";

const STATUS_COLOR = {
  pending: "bg-amber-500/15 text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-300",
  rescheduled: "bg-sky-500/15 text-sky-300",
};

const STATUS_LABEL = {
  pending: "بانتظار المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  rescheduled: "أعيدت جدولته",
};

export default function MeetingRequestsPage() {
  const { user } = useAuth();
  const isExecutive = ["ceo", "admin", "tracker"].includes(user?.role);
  const [requests, setRequests] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ subject: "", description: "", proposed_date: "", duration_minutes: 30, urgency: "medium" });
  const [selected, setSelected] = useState(null);
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);

  const load = () => api.get("/meeting-requests").then((response) => setRequests(response.data));
  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    try {
      await api.post("/meeting-requests", { ...form, proposed_date: new Date(form.proposed_date).toISOString() });
      toast.success("تم إرسال طلب الاجتماع");
      setShow(false);
      setForm({ subject: "", description: "", proposed_date: "", duration_minutes: 30, urgency: "medium" });
      load();
    } catch {
      toast.error("تعذر إرسال طلب الاجتماع");
    }
  };

  const generateBrief = async (item) => {
    setBriefLoading(true);
    try {
      const response = await api.post("/ai/executive-brief", { source_type: "meeting_request", item });
      setBrief(response.data);
    } finally {
      setBriefLoading(false);
    }
  };

  const openDetail = (item) => { setSelected(item); setBrief(null); };

  const decide = async (requestId, decision, newDate) => {
    const note = decision === "rejected" ? window.prompt("سبب الرفض — اختياري:") || "" : "";
    try {
      const payload = { decision, note };
      if (decision === "rescheduled") {
        const proposed = newDate || window.prompt("أدخل التاريخ والوقت الجديدين بصيغة YYYY-MM-DD HH:MM:");
        if (!proposed) return;
        payload.new_date = new Date(proposed).toISOString();
      }
      await api.post(`/meeting-requests/${requestId}/decision`, payload);
      toast.success("تم تسجيل القرار");
      load();
    } catch {
      toast.error("تعذر تنفيذ القرار");
    }
  };

  const executiveActions = (request) => isExecutive && request.status === "pending" ? (
    <div className="flex gap-2 flex-wrap">
      <button onClick={() => decide(request.id, "approved")} className="px-3 py-2 rounded bg-emerald-500/15 text-emerald-300 text-xs">اعتماد</button>
      <button onClick={() => decide(request.id, "rescheduled")} className="px-3 py-2 rounded bg-sky-500/15 text-sky-300 text-xs">إعادة جدولة</button>
      <button onClick={() => decide(request.id, "rejected")} className="px-3 py-2 rounded bg-rose-500/15 text-rose-300 text-xs">رفض</button>
    </div>
  ) : null;

  return (
    <div data-testid="meeting-requests-page" dir="rtl">
      <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">طلبات الاجتماعات</div>
          <h1 className="font-heading text-4xl font-black mt-2">جدولة اجتماع مع الرئيس التنفيذي</h1>
          <p className="text-slate-500 text-sm mt-1">{requests.length} طلبًا</p>
        </div>
        {!isExecutive && (
          <button onClick={() => setShow(true)} className="px-5 py-2.5 rounded-lg bg-gradient-to-l from-yellow-500 to-yellow-600 text-black font-bold flex items-center gap-2">
            <Plus size={18}/> طلب اجتماع جديد
          </button>
        )}
      </div>

      <AICommandBar />

      <div className="space-y-3">
        {requests.length === 0 ? (
          <div className="glass-card p-10 text-center text-slate-500">لا توجد طلبات اجتماعات</div>
        ) : requests.map((request) => (
          <div key={request.id} onClick={() => openDetail(request)} className="glass-card p-5 cursor-pointer hover:border-yellow-500/25 hover:bg-white/[0.03] transition-colors">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-[10px] px-2 py-1 rounded ${STATUS_COLOR[request.status]}`}>{STATUS_LABEL[request.status]}</span>
                  {request.urgency === "high" && <span className="text-[10px] px-2 py-1 rounded bg-rose-500/15 text-rose-300 flex items-center gap-1"><AlertCircle size={10}/> عاجل</span>}
                </div>
                <h3 className="font-heading font-bold text-slate-100">{request.subject}</h3>
                <p className="text-sm text-slate-400 mt-1">{request.description}</p>
                <div className="mt-3 text-xs text-slate-500 flex flex-wrap gap-4">
                  <span>مقدم الطلب: {request.requester_name}</span>
                  <span>الموعد المقترح: {new Date(request.proposed_date).toLocaleString("ar")}</span>
                  <span>المدة: {request.duration_minutes} دقيقة</span>
                </div>
                {request.decision_note && <div className="mt-2 text-xs text-slate-400 bg-white/[0.02] rounded p-2">ملاحظة القرار: {request.decision_note}</div>}
              </div>
              {isExecutive && request.status === "pending" && (
                <div className="flex gap-2 flex-wrap">
                  <button onClick={(event) => { event.stopPropagation(); decide(request.id, "approved"); }} className="px-3 py-2 rounded bg-emerald-500/15 text-emerald-300 text-xs hover:bg-emerald-500/25 flex items-center gap-1"><Check size={12}/> اعتماد</button>
                  <button onClick={(event) => { event.stopPropagation(); decide(request.id, "rescheduled"); }} className="px-3 py-2 rounded bg-sky-500/15 text-sky-300 text-xs hover:bg-sky-500/25 flex items-center gap-1"><CalIcon size={12}/> إعادة جدولة</button>
                  <button onClick={(event) => { event.stopPropagation(); decide(request.id, "rejected"); }} className="px-3 py-2 rounded bg-rose-500/15 text-rose-300 text-xs hover:bg-rose-500/25 flex items-center gap-1"><X size={12}/> رفض</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {show && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <div className="glass-card p-6 max-w-md w-full" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-xl font-bold">طلب اجتماع مع الرئيس التنفيذي</h2>
              <button onClick={() => setShow(false)} aria-label="إغلاق"><X size={18}/></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <input required placeholder="موضوع الاجتماع" value={form.subject} onChange={(event) => setForm({...form, subject: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"/>
              <textarea placeholder="الوصف وأهمية الاجتماع" value={form.description} onChange={(event) => setForm({...form, description: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm min-h-[80px]"/>
              <input required type="datetime-local" value={form.proposed_date} onChange={(event) => setForm({...form, proposed_date: event.target.value})} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"/>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="المدة بالدقائق" value={form.duration_minutes} onChange={(event) => setForm({...form, duration_minutes: Number(event.target.value)})} className="px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"/>
                <select value={form.urgency} onChange={(event) => setForm({...form, urgency: event.target.value})} className="px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm">
                  <option value="low">عادي</option>
                  <option value="medium">مهم</option>
                  <option value="high">عاجل</option>
                </select>
              </div>
              <button type="submit" className="w-full py-3 rounded-lg bg-yellow-500 text-black font-bold">إرسال الطلب</button>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <DetailModal
          item={selected}
          title={selected.subject}
          type="meeting_request"
          onClose={() => setSelected(null)}
          onGenerateBrief={generateBrief}
          brief={brief}
          loadingBrief={briefLoading}
          actions={executiveActions(selected)}
        />
      )}
    </div>
  );
}
