import React from "react";

export default function RAGBadge({ rag, size = "sm" }) {
  const map = {
    red: { label: "حرج", cls: "rag-red" },
    amber: { label: "تحت المراقبة", cls: "rag-amber" },
    green: { label: "سليم", cls: "rag-green" },
    gray: { label: "—", cls: "rag-gray" },
  };
  const info = map[rag] || map.gray;
  const sizeClass = size === "lg" ? "text-sm px-3 py-1.5" : "text-xs px-2.5 py-1";

  return (
    <span data-testid={`rag-badge-${rag}`} className={`inline-flex items-center gap-1.5 ${sizeClass} rounded-md font-semibold ${info.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${rag === "red" ? "bg-rose-400" : rag === "amber" ? "bg-amber-400" : rag === "green" ? "bg-emerald-400" : "bg-slate-400"}`}></span>
      {info.label}
    </span>
  );
}
