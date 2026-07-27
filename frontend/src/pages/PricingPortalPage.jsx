import React, { useState } from "react";
import PricingIntakePortal from "../components/PricingIntakePortal";
import PricingIntelligencePage from "./PricingIntelligencePage";

const STORAGE_KEY = "nexgen-pricing-intelligence-v2";

function sanitiseStoredPricing() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!stored?.analysis) return;
    const analysis = { ...stored.analysis };
    analysis.offer_options = (analysis.offer_options || []).map((option) => {
      if (option?.key === "aggressive" || String(option?.name || "").includes("هجومي")) {
        return {
          ...option,
          key: "competitive",
          name: "عرض تنافسي",
          purpose: "تعزيز قابلية الفوز مع الحفاظ على الحد المالي الآمن",
        };
      }
      return option;
    });
    analysis.recommendation = String(analysis.recommendation || "")
      .replaceAll("الباقة الهجومية", "الخيار التنافسي")
      .replaceAll("العرض الهجومي", "العرض التنافسي")
      .replaceAll("هجومي", "تنافسي");
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, analysis }));
  } catch {}
}

export default function PricingPortalPage() {
  const [revision, setRevision] = useState(() => {
    sanitiseStoredPricing();
    return 0;
  });
  return (
    <div className="space-y-8">
      <PricingIntakePortal onApplied={() => setRevision((value) => value + 1)} />
      <PricingIntelligencePage key={revision} />
    </div>
  );
}
