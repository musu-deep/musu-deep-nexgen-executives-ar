import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Brain,
  Building2,
  Camera,
  CheckCircle2,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import api, { ROLE_LABELS } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import UserAvatar, { getUserAvatarStorageKey } from "./UserAvatar";
import { translateArabicText } from "../i18n/ar";
import { translateExtraArabicText } from "../i18n/ar-extra";

function translate(value) {
  if (typeof value !== "string") return value;
  return translateExtraArabicText(translateArabicText(value));
}

function resizeProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const size = 512;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        const crop = Math.min(image.width, image.height);
        const sourceX = Math.max((image.width - crop) / 2, 0);
        const sourceY = Math.max((image.height - crop) / 2, 0);
        context.drawImage(image, sourceX, sourceY, crop, crop, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.84));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ExecutiveIntelligenceCenter({ onSelectRisk }) {
  const { user } = useAuth();
  const avatarInputRef = useRef(null);
  const [radar, setRadar] = useState(null);
  const [chief, setChief] = useState(null);

  useEffect(() => {
    api.get("/ai/risk-radar").then((response) => setRadar(response.data)).catch(() => {});
    api.get("/ai/chief-of-staff").then((response) => setChief(response.data)).catch(() => {});
  }, []);

  const updateAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("اختر ملف صورة صالحًا");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("حجم الصورة كبير؛ الحد الأعلى 8 ميجابايت");
      return;
    }

    try {
      const dataUrl = await resizeProfilePhoto(file);
      localStorage.setItem(getUserAvatarStorageKey(user), dataUrl);
      window.dispatchEvent(new CustomEvent("arak-avatar-updated"));
      toast.success("تم تحديث الصورة الشخصية");
    } catch {
      toast.error("تعذر معالجة الصورة الشخصية");
    }
  };

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
          <div className="relative group">
            <UserAvatar user={user} size="lg" showStatus />
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-yellow-500 text-black border-2 border-[#0b0f18] flex items-center justify-center shadow-lg hover:bg-yellow-400 transition-colors"
              title="تحديث الصورة الشخصية"
              aria-label="تحديث الصورة الشخصية"
            >
              <Camera size={14} />
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" onChange={updateAvatar} className="hidden" />
          </div>
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
