import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Brain, Mic, Square, Send, Sparkles, Activity, ExternalLink, ShieldAlert, FileText, MessageSquare, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import api, { PRIORITY_LABELS } from "../lib/api";
import { translateArabicText } from "../i18n/ar";
import { translateExtraArabicText } from "../i18n/ar-extra";

const TONE_CLASS = {
  emerald: "border-emerald-500/20 text-emerald-300 bg-emerald-500/10",
  amber: "border-amber-500/20 text-amber-300 bg-amber-500/10",
  rose: "border-rose-500/20 text-rose-300 bg-rose-500/10",
};

function translate(value) {
  if (typeof value !== "string") return value;
  return translateExtraArabicText(translateArabicText(value));
}

export default function AgentLoungePage() {
  const [data, setData] = useState({ agents: [], activity: [] });
  const [command, setCommand] = useState("");
  const [result, setResult] = useState(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const load = () => api.get("/ai/agents").then((response) => setData(response.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const run = async (extra = {}) => {
    const text = (extra.text ?? command).trim();
    if (!text) return toast.error("اكتب أو أمْلِ أمرًا تنفيذيًا أولًا");
    try {
      const response = await api.post("/ai/orchestrate", {
        source_type: extra.source_type || "free_text",
        command: text,
        text,
        create_task: extra.create_task || false,
        create_meeting: extra.create_meeting || false,
        notify: true,
      });
      setResult(response.data);
      toast.success("اكتملت عملية التنسيق التنفيذي");
      load();
    } catch (error) {
      console.error(error);
      toast.error("تعذر تنفيذ عملية التنسيق التنفيذي");
    }
  };

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("التعرّف الصوتي غير متاح في هذا المتصفح. استخدم Chrome أو اكتب الأمر.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); toast.error("تعذر التقاط الصوت"); };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((resultItem) => resultItem[0].transcript).join(" ");
      setCommand(transcript);
      run({ text: transcript, source_type: "voice" });
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopVoice = () => recognitionRef.current?.stop();

  return (
    <div data-testid="agent-lounge-page" dir="rtl">
      <div className="flex items-end justify-between mb-7 flex-wrap gap-4">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80">مركز العمليات التنفيذية</div>
          <h1 className="font-heading text-4xl font-black mt-2 flex items-center gap-3"><Brain className="text-yellow-500"/> مركز الوكلاء التنفيذيين</h1>
          <p className="text-slate-500 text-sm mt-1">بيئة تشغيل موحدة للوكلاء المتخصصين ومسارات العمل المؤسسية عبر المنصة.</p>
        </div>
        <Link to="/dashboard" className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-yellow-500/10 hover:text-yellow-300 text-sm">العودة إلى لوحة القيادة</Link>
      </div>

      <div className="glass-card p-5 mb-6 border-yellow-500/20">
        <div className="flex items-center gap-2 mb-3">
          <Bot className="text-yellow-500"/>
          <div>
            <div className="text-xs tracking-[0.12em] text-yellow-500/80">طبقة التنسيق التنفيذي</div>
            <div className="text-sm text-slate-400">تحوّل الأوامر النصية والصوتية إلى مهام واجتماعات وتوجيه للمستندات وتنبيهات تنفيذية.</div>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="مثال: حلّل المهام المتأخرة وأنشئ متابعة، وجّه أحدث مستند، جهّز تنبيه مخاطر للرئيس التنفيذي..."
            className="flex-1 px-4 py-3 rounded-xl bg-[#0a0d14]/80 border border-white/10 text-sm outline-none focus:border-yellow-500/40"
            dir="rtl"
          />
          <button onClick={() => run()} className="px-5 py-3 rounded-xl bg-yellow-500 text-black font-bold flex items-center justify-center gap-2"><Send size={15}/> تنسيق وتنفيذ</button>
          <button onClick={listening ? stopVoice : startVoice} className={`px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${listening ? "bg-rose-500 text-white" : "bg-white/5 text-slate-200 hover:bg-white/10"}`}>
            {listening ? <Square size={15}/> : <Mic size={15}/>} {listening ? "إيقاف" : "أمر صوتي"}
          </button>
        </div>
        {result && (
          <div className="mt-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 p-4">
            <div className="text-xs tracking-[0.12em] text-yellow-400 mb-2 flex items-center gap-2"><Sparkles size={14}/> مخرجات التنسيق التنفيذي</div>
            <ResultView result={result}/>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {(data.agents || []).map((agent) => (
          <div key={agent.id} className="glass-card p-5 hover:border-yellow-500/30 transition-all">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/10 text-yellow-300 flex items-center justify-center"><AgentIcon id={agent.id}/></div>
              <span className={`text-[10px] tracking-wider px-2 py-1 rounded border ${TONE_CLASS[agent.tone] || TONE_CLASS.emerald}`}>{translate(agent.status)}</span>
            </div>
            <h3 className="font-heading text-lg font-black text-slate-100">{translate(agent.name)}</h3>
            <p className="text-sm text-slate-400 mt-2 min-h-[60px]">{translate(agent.role)}</p>
            <div className="mt-4 rounded-xl bg-black/20 border border-white/5 p-3">
              <div className="text-[10px] tracking-wider text-slate-500">آخر إجراء</div>
              <div className="text-sm text-slate-300 mt-1">{translate(agent.last_action)}</div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{agent.recommendations} توصية</span>
              <Link to={agent.route || "/dashboard"} className="text-yellow-400 hover:text-yellow-300 flex items-center gap-1">فتح وحدة العمل <ExternalLink size={12}/></Link>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4"><Activity className="text-yellow-500"/><h3 className="font-heading text-xl font-black">سجل نشاط الوكلاء</h3></div>
        <div className="space-y-2">
          {(data.activity || []).map((activity, index) => (
            <div key={index} className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex gap-3">
              <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2"></div>
              <div className="flex-1">
                <div className="text-sm text-slate-100">{translate(activity.agent)}</div>
                <div className="text-sm text-slate-400 mt-1">{translate(activity.action)}</div>
                <div className="text-[10px] text-slate-600 mt-1">{activity.time ? new Date(activity.time).toLocaleString("ar") : "—"}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentIcon({ id }) {
  if (id?.includes("risk")) return <ShieldAlert size={22}/>;
  if (id?.includes("document")) return <FileText size={22}/>;
  if (id?.includes("communication")) return <MessageSquare size={22}/>;
  if (id?.includes("meeting")) return <CalendarClock size={22}/>;
  return <Bot size={22}/>;
}

function ResultView({ result }) {
  return (
    <div className="text-sm text-slate-300 space-y-3">
      <p>{translate(result.summary)}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Badge label="المخاطر" value={translate(result.risk_level)}/>
        <Badge label="المسؤول" value={result.recommended_owner}/>
        <Badge label="تم التوليد بواسطة" value={translate(result.generated_by)}/>
      </div>
      {result.suggested_tasks?.length > 0 && (
        <div>
          <div className="text-xs text-yellow-400 tracking-wider mb-2">المهام المقترحة</div>
          {result.suggested_tasks.map((task, index) => (
            <div key={index} className="rounded-lg bg-black/20 border border-white/5 p-3 mb-2">
              <div className="font-bold text-slate-100">{translate(task.title)}</div>
              <div className="text-xs text-slate-500 mt-1">الأولوية: {PRIORITY_LABELS[task.priority] || translate(task.priority)}</div>
            </div>
          ))}
        </div>
      )}
      {result.suggested_meetings?.length > 0 && (
        <div>
          <div className="text-xs text-yellow-400 tracking-wider mb-2">الاجتماعات المقترحة</div>
          {result.suggested_meetings.map((meeting, index) => (
            <div key={index} className="rounded-lg bg-black/20 border border-white/5 p-3 mb-2">
              <div className="font-bold text-slate-100">{translate(meeting.title)}</div>
              <div className="text-xs text-slate-500 mt-1">{translate(meeting.reason)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Badge({ label, value }) {
  return <div className="rounded-lg bg-black/20 border border-white/5 p-3"><div className="text-[10px] tracking-wider text-slate-500">{label}</div><div className="text-sm text-slate-200 mt-1">{value || "—"}</div></div>;
}
