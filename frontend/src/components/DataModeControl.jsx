import React from "react";
import { DATA_MODE_OPTIONS } from "../lib/dataMode";

export function DataModeSelector({ value, onChange, disabled = false }) {
  return (
    <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-400">
      <span className="whitespace-nowrap">مصدر البيانات</span>
      <select
        aria-label="مصدر البيانات"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-slate-100 font-bold outline-none cursor-pointer disabled:cursor-not-allowed"
      >
        {DATA_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value} className="bg-slate-950">{option.label}</option>)}
      </select>
    </label>
  );
}

export function DataSourceBadge({ state }) {
  const badges = {
    loading: ["جارٍ التحقق", "border-slate-500/20 bg-slate-500/10 text-slate-300"],
    live: ["بيانات مباشرة", "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"],
    partial: ["بيانات مباشرة جزئية", "border-amber-500/20 bg-amber-500/10 text-amber-300"],
    demo: ["بيانات تجريبية", "border-sky-500/20 bg-sky-500/10 text-sky-300"],
    auto_demo: ["تحويل تلقائي للتجريبي", "border-violet-500/20 bg-violet-500/10 text-violet-300"],
    offline: ["المصدر غير متاح", "border-rose-500/20 bg-rose-500/10 text-rose-300"],
  };
  const [label, css] = badges[state] || badges.offline;
  return <span className={`px-3 py-2 rounded-xl border text-xs whitespace-nowrap ${css}`}>{label}</span>;
}

export function DemoModeNotice({ state }) {
  if (state !== "demo" && state !== "auto_demo") return null;

  const text = state === "demo"
    ? "وضع العرض التجريبي مفعّل؛ البيانات المعروضة محاكاة تشغيلية وليست سجلات فعلية."
    : "تعذر الوصول إلى بيانات المشروعات والمهام الفعلية؛ انتقلت المنصة تلقائيًا إلى بيانات المحاكاة.";

  return (
    <div className="rounded-xl border border-sky-500/15 bg-sky-500/[0.06] px-4 py-3 text-xs leading-6 text-sky-200">
      {text}
    </div>
  );
}
