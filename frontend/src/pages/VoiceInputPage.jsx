import React, { useEffect, useRef, useState } from "react";
import api, { PRIORITY_LABELS, SECTOR_LABELS, formatApiError } from "../lib/api";
import { Mic, Square, Send, CheckCircle2, Wand2, Brain, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { translateArabicText } from "../i18n/ar";
import { translateExtraArabicText } from "../i18n/ar-extra";

function translate(value) {
  if (typeof value !== "string") return value;
  return translateExtraArabicText(translateArabicText(value));
}

export default function VoiceInputPage() {
  const [recordingMode, setRecordingMode] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [directive, setDirective] = useState(null);
  const [orchestration, setOrchestration] = useState(null);
  const [selected, setSelected] = useState({});
  const [users, setUsers] = useState([]);
  const [text, setText] = useState("");
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);

  useEffect(() => {
    api.get("/users").then((response) => setUsers(response.data));
    return () => {
      recognitionRef.current?.stop?.();
      if (mediaRef.current?.state === "recording") mediaRef.current.stop();
    };
  }, []);

  const runOrchestration = async (transcript) => {
    if (!transcript?.trim()) return toast.error("أدخل نص التوجيه أو أمْلِه أولًا");
    setProcessing(true);
    try {
      const response = await api.post("/ai/orchestrate", {
        source_type: "voice",
        command: transcript,
        text: transcript,
        create_task: false,
        create_meeting: false,
        notify: true,
      });
      setOrchestration(response.data);
      toast.success("تم تنسيق الأمر الصوتي بواسطة طبقة الذكاء الاصطناعي");
    } catch (error) {
      console.error(error);
      toast.error(formatApiError(error?.response?.data?.detail) || "تعذر تنسيق الأمر الصوتي");
    } finally {
      setProcessing(false);
    }
  };

  const startBrowserSpeech = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("التعرّف المباشر على الكلام غير متاح في هذا المتصفح. استخدم Chrome أو وضع تسجيل الصوت.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ar-SA";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setRecordingMode("speech");
    recognition.onend = () => setRecordingMode(null);
    recognition.onerror = () => {
      setRecordingMode(null);
      toast.error("تعذر التعرّف على الصوت");
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(" ");
      setText(transcript);
      runOrchestration(transcript);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopBrowserSpeech = () => recognitionRef.current?.stop();

  const startAudioCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecordingMode(null);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();

        reader.onloadend = async () => {
          setProcessing(true);
          try {
            const response = await api.post("/voice/transcribe", {
              audio_base64: reader.result,
              mime: "audio/webm",
            });
            setDirective(response.data);
            setText(response.data.transcript || "");
            const selections = {};
            (response.data.suggested_tasks || []).forEach((_, index) => { selections[index] = true; });
            setSelected(selections);
            toast.success("تم تحويل التسجيل إلى نص ومقترحات تنفيذية");
          } catch (error) {
            toast.error(formatApiError(error?.response?.data?.detail) || "تعذر تحليل التسجيل الصوتي");
          } finally {
            setProcessing(false);
          }
        };

        reader.readAsDataURL(blob);
      };

      mediaRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecordingMode("audio");
    } catch {
      toast.error("تعذر الوصول إلى الميكروفون");
    }
  };

  const stopAudioCapture = () => {
    if (mediaRef.current?.state === "recording") mediaRef.current.stop();
  };

  const apply = async () => {
    const tasks = (directive?.suggested_tasks || []).filter((_, index) => selected[index]);
    if (tasks.length === 0) return toast.error("اختر مهمة واحدة على الأقل");
    try {
      const response = await api.post("/voice/apply", {
        directive_id: directive.id,
        selected_tasks: tasks,
      });
      toast.success(`تم إنشاء ${response.data.created} مهمة بنجاح`);
      setDirective(null);
      setSelected({});
    } catch (error) {
      toast.error(formatApiError(error?.response?.data?.detail) || "تعذر إنشاء المهام المحددة");
    }
  };

  const speechRecording = recordingMode === "speech";
  const audioRecording = recordingMode === "audio";

  return (
    <div data-testid="voice-page" className="max-w-5xl mx-auto" dir="rtl">
      <div className="mb-7">
        <div className="text-xs tracking-[0.12em] text-yellow-500/80">تنسيق صوتي مهيأ للذكاء الاصطناعي</div>
        <h1 className="font-heading text-4xl font-black mt-2 flex items-center gap-3"><Wand2 className="text-yellow-500"/> الوكيل الصوتي الذكي</h1>
        <p className="text-slate-500 text-sm mt-1">أمْلِ التوجيهات أو سجّلها، ودع طبقة التنسيق الذكي تحولها إلى مهام واجتماعات وإشعارات وتنبيهات تنفيذية.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="glass-card p-8 text-center border-yellow-500/20">
          <div className="text-xs tracking-[0.12em] text-yellow-500/80 mb-4">إملاء صوتي مباشر</div>
          <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center transition-all ${speechRecording ? "bg-rose-500/20 border-2 border-rose-500 animate-pulse" : "bg-yellow-500/10 border-2 border-yellow-500/30 hover:bg-yellow-500/15"}`}>
            <button
              onClick={speechRecording ? stopBrowserSpeech : startBrowserSpeech}
              disabled={processing || audioRecording}
              className="w-full h-full flex items-center justify-center disabled:opacity-40"
              aria-label={speechRecording ? "إيقاف الاستماع" : "بدء الإملاء الصوتي"}
            >
              {speechRecording ? <Square size={48} className="text-rose-400"/> : <Mic size={48} className="text-yellow-400"/>}
            </button>
          </div>
          <div className="mt-5 text-lg font-heading font-bold">
            {processing ? "جارٍ المعالجة..." : speechRecording ? "جارٍ الاستماع... اضغط للإيقاف" : "اضغط لإملاء الأمر"}
          </div>
          <div className="text-xs text-slate-500 mt-2">يستخدم التعرّف الصوتي في المتصفح ثم يرسل النص مباشرة إلى طبقة التنسيق الذكي.</div>
        </div>

        <div className="glass-card p-8 text-center">
          <div className="text-xs tracking-[0.12em] text-yellow-500/80 mb-4">تسجيل صوتي وتحليل لاحق</div>
          <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center transition-all ${audioRecording ? "bg-rose-500/20 border-2 border-rose-500 animate-pulse" : "bg-white/5 border-2 border-white/10 hover:bg-white/10"}`}>
            <button
              onClick={audioRecording ? stopAudioCapture : startAudioCapture}
              disabled={processing || speechRecording}
              className="w-full h-full flex items-center justify-center disabled:opacity-40"
              aria-label={audioRecording ? "إيقاف التسجيل" : "بدء تسجيل الصوت"}
            >
              {audioRecording ? <Square size={48} className="text-rose-400"/> : <Mic size={48} className="text-slate-300"/>}
            </button>
          </div>
          <div className="mt-5 text-lg font-heading font-bold">{audioRecording ? "جارٍ تسجيل الصوت..." : "سجّل توجيهًا صوتيًا"}</div>
          <div className="text-xs text-slate-500 mt-2">الباكند مهيأ لـGoogle Cloud Speech-to-Text وGemini، مع تحليل احتياطي آمن لنسخة العرض.</div>
        </div>
      </div>

      <div className="glass-card p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="text-yellow-500"/>
          <div>
            <div className="text-xs tracking-[0.12em] text-yellow-500/80">تحرير النص أو إدخاله يدويًا</div>
            <div className="text-sm text-slate-500">راجع النص الملتقط وعدّله قبل توجيهه إلى طبقة الذكاء الاصطناعي.</div>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="ألصق نص الأمر الصوتي أو عدّله هنا..."
          className="w-full px-4 py-3 rounded-xl bg-[#0a0d14]/80 border border-white/10 text-sm min-h-[100px]"
          dir="rtl"
        />
        <button
          onClick={() => runOrchestration(text)}
          disabled={processing}
          className="mt-3 px-5 py-3 rounded-xl bg-yellow-500 text-black font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Send size={15}/> إرسال إلى طبقة التنسيق الذكي
        </button>
      </div>

      {orchestration && (
        <div className="glass-card p-6 mb-6 border-yellow-500/20">
          <div className="flex items-center gap-2 text-yellow-400 text-xs tracking-[0.12em] mb-3"><Sparkles size={14}/> نتيجة التنسيق الذكي</div>
          <div className="text-sm text-slate-300 mb-3">{translate(orchestration.summary)}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Box label="المخاطر" value={translate(orchestration.risk_level)}/>
            <Box label="المسؤول" value={orchestration.recommended_owner}/>
            <Box label="تم التوليد بواسطة" value={translate(orchestration.generated_by)}/>
          </div>
          {(orchestration.suggested_tasks || []).map((task, index) => (
            <div key={index} className="mt-3 rounded-xl bg-black/20 border border-white/5 p-3">
              <div className="font-bold text-slate-100">{translate(task.title)}</div>
              <div className="text-xs text-slate-500 mt-1">الأولوية: {PRIORITY_LABELS[task.priority] || translate(task.priority)}</div>
            </div>
          ))}
        </div>
      )}

      {directive && (
        <div className="mt-6 glass-card p-6" data-testid="directive-result">
          <h3 className="font-heading text-xl font-bold mb-3">نتيجة تحليل التسجيل الصوتي</h3>
          <div className="bg-white/[0.02] rounded-lg p-4 mb-4">
            <div className="text-xs text-slate-500 mb-1">النص المفرغ:</div>
            <p className="text-sm text-slate-200 leading-relaxed">{directive.transcript}</p>
          </div>
          {directive.summary && (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4 mb-4">
              <div className="text-xs text-yellow-500 mb-1">الملخص:</div>
              <p className="text-sm text-slate-200">{translate(directive.summary)}</p>
            </div>
          )}

          {directive.suggested_tasks?.length > 0 ? (
            <>
              <h4 className="font-heading font-bold mb-3">المهام المقترحة ({directive.suggested_tasks.length})</h4>
              <div className="space-y-2 mb-4">
                {directive.suggested_tasks.map((task, index) => {
                  const assignee = users.find((person) => person.id === task.assignee_id);
                  return (
                    <label key={index} className="flex items-start gap-3 p-4 rounded-lg bg-white/[0.02] border border-white/5 hover:border-yellow-500/30 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[index])}
                        onChange={(event) => setSelected({...selected, [index]: event.target.checked})}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-slate-100">{translate(task.title)}</div>
                        <div className="text-xs text-slate-400 mt-1">{translate(task.description)}</div>
                        <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-3">
                          <span>المكلّف: {assignee?.name || "غير محدد"}</span>
                          <span>الأولوية: {PRIORITY_LABELS[task.priority] || translate(task.priority)}</span>
                          <span>القطاع: {SECTOR_LABELS[task.sector] || task.sector || "غير محدد"}</span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <button onClick={apply} className="w-full py-3 rounded-lg bg-yellow-500 text-black font-bold flex items-center justify-center gap-2">
                <CheckCircle2 size={16}/> إنشاء المهام المحددة
              </button>
            </>
          ) : (
            <div className="text-center text-slate-500 py-4">لم تُستخرج مهام من هذا التسجيل.</div>
          )}
        </div>
      )}
    </div>
  );
}

function Box({ label, value }) {
  return (
    <div className="rounded-xl bg-black/20 border border-white/5 p-3">
      <div className="text-[10px] tracking-wider text-slate-500">{label}</div>
      <div className="text-sm text-slate-200 mt-1">{value || "—"}</div>
    </div>
  );
}
