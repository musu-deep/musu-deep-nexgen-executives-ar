import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import {
  Send, Plus, X, Sparkles, MessageSquare, Users, AlertCircle, CheckCircle2,
  Forward, ListChecks, Route, Bot,
} from "lucide-react";
import { toast } from "sonner";
import { translateArabicText } from "../i18n/ar";
import { translateExtraArabicText } from "../i18n/ar-extra";

const CATEGORY_LABELS = {
  internal_coordination: "تنسيق داخلي",
  executive_decision: "قرار تنفيذي",
  follow_up: "متابعة",
  risk_alert: "تنبيه مخاطر",
  opportunity: "فرصة",
};

const PRIORITY_LABELS = {
  normal: "عادية",
  high: "مرتفعة",
  critical: "حرجة",
};

function translate(value) {
  if (typeof value !== "string") return value;
  return translateExtraArabicText(translateArabicText(value));
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [form, setForm] = useState({
    recipient_id: "",
    subject: "",
    body: "",
    priority: "normal",
    category: "internal_coordination",
  });

  const load = () => Promise.all([api.get("/messages"), api.get("/users")]).then(([messageResponse, userResponse]) => {
    setMessages(messageResponse.data);
    setUsers(userResponse.data.filter((item) => item.id !== user.id));
  });

  useEffect(() => {
    if (user?.id) load();
  }, [user?.id]);

  const submit = async (event) => {
    event.preventDefault();
    try {
      await api.post("/messages", form);
      toast.success("تم إرسال المراسلة بنجاح");
      setShow(false);
      setForm({ recipient_id: "", subject: "", body: "", priority: "normal", category: "internal_coordination" });
      load();
    } catch {
      toast.error("تعذر إرسال المراسلة");
    }
  };

  const openMessage = async (message) => {
    setSelected(message);
    setAiResult(null);
    if (message.recipient_id === user?.id && !message.read) {
      await api.patch(`/messages/${message.id}/read`);
      load();
    }
  };

  const aiAction = async (action) => {
    if (!selected) return;
    const endpoints = {
      summary: `/messages/${selected.id}/ai-summary`,
      actions: `/messages/${selected.id}/extract-actions`,
      routing: `/messages/${selected.id}/route`,
      followup: `/messages/${selected.id}/create-followup`,
    };
    try {
      const response = await api.post(endpoints[action]);
      setAiResult({ action, data: response.data });
      toast.success("تم إنشاء النتيجة الذكية");
      load();
    } catch (error) {
      console.error(error);
      toast.error("تعذر تنفيذ الإجراء الذكي");
    }
  };

  const unreadCount = messages.filter((message) => message.recipient_id === user?.id && !message.read).length;

  return (
    <div data-testid="messages-page" dir="rtl">
      <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">مركز الاتصالات الذكي</div>
          <h1 className="font-heading text-4xl font-black mt-2 flex items-center gap-3">
            <MessageSquare className="text-yellow-500"/> مركز الاتصالات المؤسسية
          </h1>
          <p className="text-slate-500 text-sm mt-1">{messages.length} مراسلة • {unreadCount} غير مقروءة • تنسيق مؤسسي مدعوم بالذكاء الاصطناعي</p>
        </div>
        <button onClick={() => setShow(true)} className="px-5 py-2.5 rounded-lg bg-gradient-to-l from-yellow-500 to-yellow-600 text-black font-bold flex items-center gap-2">
          <Plus size={18}/> مراسلة جديدة
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <InfoCard icon={<Bot size={14}/>} title="المنسق الذكي" tone="text-yellow-400">
          يوجه المراسلات ويلخصها ويصعّدها ويستخرج منها المتابعات والإجراءات.
        </InfoCard>
        <InfoCard icon={<Users size={14}/>} title="خريطة التفاعل" tone="text-sky-400" value={users.length}>
          مستخدمون داخليون نشطون
        </InfoCard>
        <InfoCard icon={<AlertCircle size={14}/>} title="بانتظار القراءة" tone="text-amber-400" value={unreadCount}>
          مراسلات غير مقروءة
        </InfoCard>
        <InfoCard icon={<CheckCircle2 size={14}/>} title="حالة التدفق" tone="text-emerald-400">
          التدفق الاتصالي مراقب وجاهز للتوجيه الذكي.
        </InfoCard>
      </div>

      <div className="space-y-2">
        {messages.length === 0 ? (
          <div className="glass-card p-10 text-center text-slate-500">لا توجد مراسلات متاحة</div>
        ) : messages.map((message) => {
          const incoming = message.recipient_id === user.id;
          const recipientName = users.find((person) => person.id === message.recipient_id)?.name || "—";
          return (
            <button
              key={message.id}
              onClick={() => openMessage(message)}
              className={`glass-card p-4 w-full text-right hover:border-yellow-500/40 transition-all ${incoming && !message.read ? "border-yellow-500/30" : ""}`}
            >
              <div className="flex items-center justify-between mb-2 gap-3">
                <span className="text-xs text-slate-400">{incoming ? `من: ${message.sender_name}` : `إلى: ${recipientName}`}</span>
                <span className="text-xs text-slate-500">{new Date(message.created_at).toLocaleString("ar")}</span>
              </div>
              {message.subject && <div className="font-bold text-slate-100">{message.subject}</div>}
              <div className="text-sm text-slate-300 mt-1 line-clamp-2">{message.body}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500">
                <span className="px-2 py-1 rounded bg-white/5">{CATEGORY_LABELS[message.category] || message.category}</span>
                <span className="px-2 py-1 rounded bg-white/5">الأولوية: {PRIORITY_LABELS[message.priority] || message.priority}</span>
                <span className="flex items-center gap-1 text-yellow-400/70"><Sparkles size={12}/> جاهزة للتلخيص والتوجيه واستخراج المتابعة</span>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="glass-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-xs tracking-[0.12em] text-yellow-500/80">تفاصيل المراسلة</div>
                <h2 className="font-heading text-2xl font-black mt-2">{selected.subject || "مراسلة بلا عنوان"}</h2>
              </div>
              <button onClick={() => setSelected(null)} aria-label="إغلاق"><X size={18}/></button>
            </div>

            <div className="text-xs text-slate-500 mb-4">{new Date(selected.created_at).toLocaleString("ar")}</div>
            <div className="rounded-xl bg-black/20 border border-white/10 p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{selected.body}</div>

            {aiResult && <AIResult result={aiResult} />}

            <div className="mt-4 text-[10px] tracking-[0.12em] text-slate-500">محرك الاتصالات الذكي • التوجيه • التلخيص • المتابعة • الذاكرة المؤسسية</div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-5">
              <ActionButton onClick={() => aiAction("summary")} icon={<Sparkles size={13}/>} label="تلخيص" />
              <ActionButton onClick={() => aiAction("actions")} icon={<ListChecks size={13}/>} label="استخراج الإجراءات" />
              <ActionButton onClick={() => aiAction("routing")} icon={<Route size={13}/>} label="اقتراح التوجيه" />
              <ActionButton onClick={() => toast.info("سيُفعّل إعادة التوجيه في الإصدار التالي")} icon={<Forward size={13}/>} label="إعادة توجيه" />
              <button onClick={() => aiAction("followup")} className="px-3 py-2 rounded-lg bg-yellow-500 text-black font-bold text-xs flex items-center justify-center gap-2">
                <CheckCircle2 size={13}/> إنشاء متابعة
              </button>
            </div>
          </div>
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShow(false)}>
          <div className="glass-card p-6 max-w-md w-full" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading text-xl font-bold">مراسلة ذكية جديدة</h2>
              <button onClick={() => setShow(false)} aria-label="إغلاق"><X size={18}/></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <select required value={form.recipient_id} onChange={(event) => setForm({ ...form, recipient_id: event.target.value })} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm">
                <option value="">— اختر المستلم —</option>
                {users.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm">
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm">
                {Object.entries(PRIORITY_LABELS).map(([key, label]) => <option key={key} value={key}>أولوية {label}</option>)}
              </select>
              <input placeholder="الموضوع" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm"/>
              <textarea required placeholder="نص المراسلة" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} className="w-full px-4 py-2.5 rounded-lg bg-[#0a0d14]/80 border border-white/10 text-sm min-h-[120px]"/>
              <button type="submit" className="w-full py-3 rounded-lg bg-yellow-500 text-black font-bold flex items-center justify-center gap-2"><Send size={14}/> إرسال المراسلة</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, title, tone, value, children }) {
  return (
    <div className="glass-card p-4">
      <div className={`flex items-center gap-2 text-xs tracking-wider ${tone}`}>{icon}{title}</div>
      {value != null && <div className="text-2xl font-black mt-2">{value}</div>}
      <div className="text-sm text-slate-300 mt-2">{children}</div>
    </div>
  );
}

function ActionButton({ onClick, icon, label }) {
  return <button onClick={onClick} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-yellow-500/10 text-xs flex items-center justify-center gap-2">{icon}{label}</button>;
}

function AIResult({ result }) {
  const data = result.data || {};
  const title = {
    summary: "الملخص الذكي",
    actions: "الإجراءات المستخرجة",
    routing: "توصية التوجيه الذكي",
    followup: "تم إنشاء المتابعة",
  }[result.action];

  return (
    <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
      <div className="text-xs tracking-[0.12em] text-yellow-400 mb-3">{title}</div>
      <div className="text-sm text-slate-300 space-y-3">
        {data.ai_summary && <p>{translate(data.ai_summary)}</p>}
        {data.action_items?.length > 0 && (
          <ul className="space-y-2">
            {data.action_items.map((item, index) => <li key={index} className="flex items-start gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-yellow-500"></span><span>{translate(String(item))}</span></li>)}
          </ul>
        )}
        {data.ai_route && (
          <div>
            <div className="font-bold text-yellow-300">{translate(data.ai_route)}</div>
            <div className="text-xs text-slate-500 mt-1">مستوى التصعيد: {translate(data.escalation_level)}</div>
          </div>
        )}
        {data.task && (
          <div>
            <div className="font-bold text-yellow-300">{translate(data.message)}</div>
            <div className="text-xs text-slate-400 mt-2">المهمة: {translate(data.task.title)}</div>
          </div>
        )}
        {!data.ai_summary && !data.action_items && !data.ai_route && !data.task && <pre className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>}
      </div>
    </div>
  );
}
