import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Send } from "lucide-react";
import api from "../lib/api";
import { translateArabicText } from "../i18n/ar";

export default function AICommandBar() {
  const [command, setCommand] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (!command.trim()) return;
    setLoading(true);
    try {
      const res = await api.post("/ai/command", { command });
      setReply(translateArabicText(res.data.message));
      setTimeout(() => {
        navigate(res.data.route, { state: { intent: res.data.intent } });
      }, 350);
    } catch {
      setReply("تعذر تنفيذ الأمر الآن، لكن مركز الأوامر التنفيذي جاهز.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-4 mb-6 border-yellow-500/20" dir="rtl">
      <form onSubmit={submit} className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="flex items-center gap-3 min-w-fit">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/15 text-yellow-300 flex items-center justify-center"><Bot size={20}/></div>
          <div>
            <div className="text-xs tracking-[0.12em] text-yellow-500/80">مركز الأوامر التنفيذية</div>
            <div className="font-heading font-bold text-slate-100">اطلب من المنصة فتح أي وحدة عمل أو إعداد موجز أو إجراء مراجعة</div>
          </div>
        </div>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="جرّب: افتح طلبات الاجتماعات، اعرض رادار المخاطر، جهّز الموجز اليومي..."
          className="flex-1 px-4 py-3 rounded-xl bg-[#0a0d14]/80 border border-white/10 text-sm text-slate-100 outline-none focus:border-yellow-500/40"
          dir="rtl"
        />
        <button className="px-5 py-3 rounded-xl bg-yellow-500 text-black font-bold flex items-center justify-center gap-2" disabled={loading}>
          <Send size={15}/> {loading ? "جارٍ التنفيذ" : "تنفيذ"}
        </button>
      </form>
      {reply && <div className="mt-3 text-xs text-slate-400">{reply}</div>}
    </div>
  );
}
