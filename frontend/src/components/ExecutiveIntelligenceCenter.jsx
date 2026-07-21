import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Brain,
  Building2,
  CheckCircle2,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import api, { ROLE_LABELS } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import UserAvatar from "./UserAvatar";
import { translateArabicText } from "../i18n/ar";
import { translateExtraArabicText } from "../i18n/ar-extra";

function translate(value) {
  if (typeof value !== "string") return value;
  return translateExtraArabicText(translateArabicText(value));
}

export default function ExecutiveIntelligenceCenter({ onSelectRisk }) {
  const { user } = useAuth();
  const [radar, setRadar] = useState(null);
  const [chief, setChief] = useState(null);

  useEffect(() => {
    api.get("/ai/risk-radar").then((response) => setRadar(response.data)).catch(() => {});
    api.get("/ai/chief-of-staff").then((response) => setChief(response.data)).catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6" dir="rtl">
      <div className="glass-card p-6 xl:col-span-2 border-yellow-500/20">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-xs tracking-[0.12em] text-yellow-500/80">مركز التحليل التنفيذي</div>
            <h3 className="font-heading text-2xl font-black mt-1 flex items-center gap-2"><Brain className="text-yellow-500"/> مكتب الرئيس التنفيذي</h3>
            <p className="text-sm text-slate-500 mt-1">منظومة مؤسسية لدعم القرارات والمخاطر والمتابعة وإعداد الأولويات التنفيذية.</p>
          </div>
          <span className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 text-[10px] tracking-wider">مباشر</span>
        </div>

        <div className="rounded-2xl bg-gradient-to-l from-yellow-500/[0.08] to-white/[0.025] border border-yellow-500/15 p-4 mb-4 flex flex-col md:flex-row md:items-center gap-4">
          <UserAvatar user={user} size="lg" showStatus />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] tracking-wider text-yellow-400/80">المستخدم النشط</span>
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                <ShieldCheck size={11} /> جلسة موثقة
              </span>
            </div>
            <div className="font-heading text-xl font-black text-slate-50 mt-1">{user?.name || "مستخدم تنفيذي"}</div>
            <div className="text-sm text-yellow-300/80 mt-0.5">{user?.title || ROLE_LABELS[user?.role] || "عضو الفريق التنفيذي"}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-500 mt-3">
              {user?.department && <span className="flex items-center gap-1.5"><Building2 size={13} /> {user.department}</span>}
              {user?.email && <span className="flex items-center gap-1.5" dir="ltr"><Mail size={13} /> {user.email}</span>}
            </div>
          </div>
          <div className="md:text-left text-right">
            <div className="text-[10px] text-slate-500">حالة الاتصال</div>
            <div className="text-sm font-bold text-emerald-300 mt-1">متصل بالمنصة</div>
            <div className="text-[10px] text-slate-600 mt-1">تم تخصيص الإحاطة وفق الدور</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-5 mb-4">
          <div className="text-lg font-heading font-bold text-slate-100">{translate(chief?.greeting || `صباح الخير ${user?.name || ""}`)}</div>
          <p className="text-slate-400 mt-2">{translate(chief?.headline || "جارٍ إعداد السياق التنفيذي.")}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
            {(chief?.insights || []).map((insight, index) => (
              <div key={index} className="rounded-lg bg-black/20 border border-white/5 p-3 text-sm flex gap-2">
                <CheckCircle2 size={15} className="text-yellow-400 mt-0.5"/>
                <span className="text-slate-300">{translate(insight)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-sm text-yellow-200/90 flex gap-2"><Sparkles size={15}/> {translate(chief?.recommended_next_step)}</div>
        </div>
      </div>

      <div className="glass-card p-6 border-rose-500/20">
        <div className="flex items-center gap-2 mb-3"><AlertTriangle className="text-rose-400"/><h3 className="font-heading text-lg font-bold">رادار المخاطر التنفيذي</h3></div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <RiskCount label="حرج" value={radar?.counts?.critical || 0} tone="text-rose-300"/>
          <RiskCount label="مرتفع" value={radar?.counts?.high || 0} tone="text-amber-300"/>
          <RiskCount label="متوسط" value={radar?.counts?.medium || 0} tone="text-sky-300"/>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {(radar?.risks || []).slice(0, 6).map((risk) => {
            const isCritical = ["Critical", "حرج"].includes(risk.level);
            return (
              <button
                key={`${risk.type}-${risk.id}`}
                onClick={() => onSelectRisk?.(risk)}
                className="w-full text-right rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 p-3 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] px-2 py-1 rounded ${isCritical ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-300"}`}>{translate(risk.level)}</span>
                  <span className="text-[10px] text-slate-500">{risk.type_label || translate(risk.type)}</span>
                </div>
                <div className="font-medium text-slate-100 mt-2 line-clamp-1">{risk.title}</div>
                <div className="text-xs text-slate-500 mt-1 line-clamp-2">{translate(risk.reason)}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RiskCount({ label, value, tone }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 text-center">
      <div className={`text-2xl font-heading font-bold tabular-nums ${tone}`}>{value}</div>
      <div className="text-[10px] text-slate-500 tracking-wider">{label}</div>
    </div>
  );
}
