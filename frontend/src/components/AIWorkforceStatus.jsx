import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, ChevronLeft, Activity, ShieldAlert, FileText, ListChecks } from "lucide-react";
import api from "../lib/api";
import { translateArabicText } from "../i18n/ar";
import { translateExtraArabicText } from "../i18n/ar-extra";

const DOT = {
  emerald: "bg-emerald-400 shadow-emerald-400/40",
  amber: "bg-amber-400 shadow-amber-400/40",
  rose: "bg-rose-400 shadow-rose-400/40",
};

function translate(value) {
  if (typeof value !== "string") return value;
  return translateExtraArabicText(translateArabicText(value));
}

export default function AIWorkforceStatus() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/ai/workforce-status").then((response) => setData(response.data)).catch(() => {});
  }, []);

  const agents = data?.agents || [
    { name: "وكيل رئيس الديوان", tone: "emerald", status: "نشط" },
    { name: "وكيل ذكاء المشروعات", tone: "emerald", status: "قيد المراقبة" },
    { name: "وكيل ذكاء الاجتماعات", tone: "emerald", status: "قيد المراقبة" },
    { name: "وكيل مراقبة المخاطر", tone: "amber", status: "يحتاج إلى انتباه" },
    { name: "وكيل ذكاء المستندات", tone: "emerald", status: "نشط" },
    { name: "وكيل التقارير", tone: "emerald", status: "نشط" },
    { name: "وكيل الإحاطة التنفيذية", tone: "emerald", status: "نشط" },
  ];

  return (
    <Link to="/ai-lounge" className="glass-card p-6 block hover:border-yellow-500/30 transition-all mb-6 border-yellow-500/20" dir="rtl">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="text-xs tracking-[0.12em] text-yellow-500/80 flex items-center gap-2"><Bot size={15}/> حالة القوى العاملة الذكية</div>
          <h3 className="font-heading text-2xl font-black mt-2">الوكلاء التنفيذيون يعملون خلف المنصة</h3>
          <p className="text-sm text-slate-500 mt-1">اضغط لدخول صالة الوكلاء واستعراض القوى العاملة المؤسسية النشطة.</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 text-yellow-300 flex items-center justify-center"><ChevronLeft size={20}/></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <Metric icon={<Activity size={15}/>} label="الوكلاء" value={data?.metrics?.agents || agents.length}/>
        <Metric icon={<FileText size={15}/>} label="المستندات" value={data?.metrics?.documents || 0}/>
        <Metric icon={<ListChecks size={15}/>} label="المهام" value={data?.metrics?.tasks || 0}/>
        <Metric icon={<ShieldAlert size={15}/>} label="المخاطر الحرجة" value={data?.metrics?.critical_risks || 0}/>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {agents.slice(0, 7).map((agent) => (
          <div key={agent.id || agent.name} className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full shadow-lg ${DOT[agent.tone] || DOT.emerald}`}></span>
            <div className="min-w-0">
              <div className="text-sm text-slate-100 font-medium truncate">{translate(agent.name)}</div>
              <div className="text-[10px] tracking-wider text-slate-500">{translate(agent.status)}</div>
            </div>
          </div>
        ))}
      </div>
    </Link>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="rounded-xl bg-black/20 border border-white/5 p-3">
      <div className="flex items-center gap-2 text-slate-500 text-[10px] tracking-wider">{icon}{label}</div>
      <div className="text-2xl font-heading font-black text-slate-100 mt-1 tabular-nums">{value}</div>
    </div>
  );
}
