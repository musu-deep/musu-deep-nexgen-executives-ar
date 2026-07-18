import React from "react";

export default function KPICard({ label, value, sublabel, accent = "default", icon, testId, onClick }) {
  const accents = {
    default: "border-white/5",
    gold: "border-yellow-500/30 shadow-yellow-500/5",
    red: "border-rose-500/20",
    amber: "border-amber-500/20",
    green: "border-emerald-500/20",
  };
  return (
    <div data-testid={testId} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} className={`glass-card p-5 ${accents[accent] || accents.default} hover:translate-y-[-2px] transition-transform ${onClick ? "cursor-pointer hover:border-yellow-500/30" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400 font-medium">{label}</div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-slate-50 font-heading">{value}</div>
          {sublabel && <div className="mt-1 text-xs text-slate-500">{sublabel}</div>}
        </div>
        {icon && <div className="text-slate-500 opacity-80">{icon}</div>}
      </div>
    </div>
  );
}
