import React from "react";
import { X, Sparkles, AlertTriangle, TrendingUp } from "lucide-react";
import { SECTOR_LABELS, STATUS_LABELS, PRIORITY_LABELS } from "../lib/api";
import { translateArabicText } from "../i18n/ar";
import { translateExtraArabicText } from "../i18n/ar-extra";

const LABELS = {
  title: "العنوان",
  subject: "الموضوع",
  name: "الاسم",
  description: "الوصف",
  status: "الحالة",
  priority: "الأولوية",
  urgency: "درجة الاستعجال",
  progress: "نسبة الإنجاز",
  requester_name: "مقدم الطلب",
  proposed_date: "التاريخ المقترح",
  duration_minutes: "المدة بالدقائق",
  date: "التاريخ",
  location: "الموقع",
  organizer_name: "المنظم",
  meeting_type: "نوع الاجتماع",
  sector: "القطاع",
  budget: "الميزانية",
  due_date: "تاريخ الاستحقاق",
  assignee_id: "المكلّف",
  decision_note: "ملاحظة القرار",
  created_at: "تاريخ الإنشاء",
  updated_at: "آخر تحديث",
  generated_by: "تم التوليد بواسطة",
  confidence: "درجة الثقة",
  risk_level: "مستوى المخاطر",
  recommended_owner: "المسؤول الموصى به",
  source_type: "نوع المصدر",
};

const MEETING_TYPE_LABELS = {
  individual: "فردي",
  periodic: "دوري",
  emergency: "طارئ",
  board: "مجلس إدارة",
};

function translate(value) {
  return translateExtraArabicText(translateArabicText(value));
}

function renderValue(value, key) {
  if (value == null || value === "") return "—";

  if (key === "status") return STATUS_LABELS[value] || translate(String(value));
  if (key === "priority" || key === "urgency") return PRIORITY_LABELS[value] || translate(String(value));
  if (key === "sector") return SECTOR_LABELS[value] || translate(String(value));
  if (key === "meeting_type") return MEETING_TYPE_LABELS[value] || translate(String(value));
  if (key === "progress") return `${value}%`;
  if (key === "confidence" && typeof value === "number") return `${Math.round(value * 100)}%`;

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "object" && item !== null) {
        return translate(item.name || item.title || item.subject || item.requester_name || JSON.stringify(item, null, 2));
      }
      return translate(String(item));
    }).join("\n");
  }

  if (typeof value === "object") {
    return translate(value.name || value.title || value.subject || value.requester_name || JSON.stringify(value, null, 2));
  }

  if (typeof value === "string" && value.includes("T") && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toLocaleString("ar");
  }

  return translate(String(value));
}

export default function DetailModal({
  item,
  title,
  type = "item",
  onClose,
  onGenerateBrief,
  brief,
  loadingBrief,
  actions,
}) {
  if (!item) return null;

  const entries = Object.entries(item).filter(([key]) => !["id", "_id", "password_hash"].includes(key));
  const isCriticalProjects = item?.critical_projects && Array.isArray(item.critical_projects);

  return (
    <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} dir="rtl">
      <div className="glass-card max-w-5xl w-full max-h-[88vh] overflow-y-auto p-6 border-yellow-500/20" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="text-[10px] tracking-[0.12em] text-yellow-500/80">تفاصيل تنفيذية تفاعلية</div>
            <h2 className="font-heading text-2xl font-black mt-1 text-slate-50">
              {translate(title || item.title || item.subject || item.name || "التفاصيل")}
            </h2>
            <p className="text-xs text-slate-500 mt-1">عرض تنفيذي للوصول السريع إلى الرؤى والقرارات.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-400" aria-label="إغلاق">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {onGenerateBrief && (
            <button
              onClick={() => onGenerateBrief(item)}
              disabled={loadingBrief}
              className="px-4 py-2 rounded-lg bg-yellow-500 text-black font-bold text-sm flex items-center gap-2 disabled:opacity-60"
            >
              <Sparkles size={15} />
              {loadingBrief ? "جارٍ توليد الموجز..." : "توليد موجز للرئيس التنفيذي"}
            </button>
          )}
          {actions}
        </div>

        {isCriticalProjects && (
          <div className="space-y-4 mb-6">
            {item.critical_projects.map((project) => (
              <div key={project.id} className="rounded-2xl border border-rose-500/20 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-100">{project.name}</h3>
                  <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs">حرج</span>
                </div>

                <div className="grid md:grid-cols-3 gap-3 mt-4">
                  <Metric label="نسبة الإنجاز" value={`${project.progress || 0}%`} />
                  <Metric label="القطاع" value={SECTOR_LABELS[project.sector] || project.sector || "غير متاح"} />
                  <Metric label="الحالة" value={STATUS_LABELS[project.status] || "حرج"} />
                </div>

                <div className="mt-4 rounded-xl bg-black/20 border border-white/5 p-4">
                  <div className="flex items-center gap-2 text-yellow-400 text-xs mb-2">
                    <AlertTriangle size={14} /> رؤية تنفيذية
                  </div>
                  <div className="text-sm text-slate-300">يتطلب هذا المشروع انتباهًا تنفيذيًا بسبب حالته الحرجة وانخفاض الإنجاز عن المستهدف.</div>
                </div>

                <div className="mt-3 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20 p-4">
                  <div className="flex items-center gap-2 text-emerald-300 text-xs mb-2">
                    <TrendingUp size={14} /> الإجراء الموصى به
                  </div>
                  <div className="text-sm text-slate-300">جدول مراجعة تنفيذية وتحقق من خطة التعافي خلال 48 ساعة.</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isCriticalProjects && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
            {entries.map(([key, value]) => (
              <div key={key} className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
                <div className="text-[10px] tracking-wider text-slate-500 mb-1">{LABELS[key] || key.replaceAll("_", " ")}</div>
                <div className="text-sm text-slate-200 whitespace-pre-wrap break-words" dir="auto">
                  {renderValue(value, key)}
                </div>
              </div>
            ))}
          </div>
        )}

        {brief && (
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.04] p-5">
            <div className="text-[10px] tracking-[0.12em] text-yellow-400 mb-2">مخرجات رئيس الديوان الذكي</div>
            <h3 className="font-heading text-xl font-bold mb-3">{translate(brief.title)}</h3>

            <BriefList title="الملخص التنفيذي" items={brief.executive_summary} />
            <BriefList title="القرارات المطلوبة" items={brief.decisions_required} />

            <div className="mb-4">
              <div className="text-xs text-slate-500 mb-2">المخاطر</div>
              <div className="space-y-2">
                {(brief.risks || []).map((risk, index) => (
                  <div key={index} className="rounded-lg bg-black/20 border border-white/5 p-3 text-sm">
                    <span className="text-rose-300 font-semibold">{translate(risk.level)}</span>
                    <span className="text-slate-400"> — {translate(risk.risk)}</span>
                  </div>
                ))}
              </div>
            </div>

            <BriefList title="الإجراءات الموصى بها" items={brief.recommended_actions} />

            <div className="text-sm text-slate-300 mt-3">
              <span className="text-yellow-400">الأثر الاستراتيجي:</span>{" "}
              {translate(brief.strategic_impact)}
            </div>

            {brief.gemini_brief && (
              <div className="mt-5 rounded-xl border border-white/5 bg-black/20 p-4">
                <div className="text-xs text-yellow-400 mb-2">تحليل Gemini</div>
                <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{brief.gemini_brief}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3">
      <div className="text-[10px] tracking-wider text-slate-500">{label}</div>
      <div className="text-slate-100 font-semibold mt-1">{value}</div>
    </div>
  );
}

function BriefList({ title, items = [] }) {
  return (
    <div className="mb-4">
      <div className="text-xs text-slate-500 mb-2">{title}</div>
      <ul className="space-y-1.5 text-sm text-slate-300">
        {(items || []).map((item, index) => (
          <li key={index} className="flex gap-2">
            <span className="text-yellow-500">•</span>
            <span>{translate(String(item))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
