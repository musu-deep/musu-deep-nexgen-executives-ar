import React, { useState } from "react";
import PricingIntakePortal from "../components/PricingIntakePortal";
import PricingIntelligencePage from "./PricingIntelligencePage";

export default function PricingPortalPage() {
  const [revision, setRevision] = useState(0);
  return (
    <div className="space-y-8">
      <PricingIntakePortal onApplied={() => setRevision((value) => value + 1)} />
      <PricingIntelligencePage key={revision} />
    </div>
  );
}
