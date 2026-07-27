import React, { useState } from "react";
import { Calculator, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";

function amountFromRecord(record = {}) {
  const candidates = [
    record.actual_cost,
    record.estimated_cost,
    record.direct_cost,
    record.cost,
    record.amount,
    record.budget,
  ];
  for (const value of candidates) {
    const numeric = Number(value || 0);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return 0;
}

export default function PricingReferralButton({ sourceType, record, compact = false, reviewMode = "active" }) {
  const [sending, setSending] = useState(false);

  const send = async (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!record) return;
    setSending(true);
    try {
      const title = sourceType === "project"
        ? `مراجعة تسعير مشروع: ${record.name || record.title || "مشروع"}`
        : `مراجعة تكلفة مهمة: ${record.title || record.name || "مهمة"}`;
      await api.post("/pricing/intake", {
        source_type: sourceType,
        source_id: record.id,
        title,
        description: record.description || "",
        amount: amountFromRecord(record),
        currency: record.currency || "SAR",
        review_mode: reviewMode,
        priority: record.priority || "medium",
        source_snapshot: record,
      });
      toast.success("تمت إحالة البند إلى مركز التسعير للمراجعة والتوصية");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "تعذر إحالة البند إلى مركز التسعير");
    } finally {
      setSending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={send}
      disabled={sending}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 font-bold text-cyan-300 transition hover:bg-cyan-500/20 disabled:opacity-60 ${compact ? "px-2 py-1 text-[10px]" : "px-3 py-2 text-xs"}`}
      title="إحالة المشروع أو المهمة إلى مركز التسعير"
    >
      {sending ? <Loader2 size={compact ? 11 : 14} className="animate-spin" /> : <Calculator size={compact ? 11 : 14} />}
      {sending ? "جارٍ الإحالة" : "إحالة للتسعير"}
    </button>
  );
}
