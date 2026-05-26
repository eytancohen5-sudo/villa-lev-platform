"use client";

import { useEffect, useRef } from "react";
import { AssumptionsMemoButton } from "@/components/AssumptionsMemoButton";
import { useModelStore } from "@/lib/store/modelStore";
import { useReferenceScenarioAutoLoad } from "@/lib/hooks/useReferenceScenarioAutoLoad";

export default function BankLayout({ children }: { children: React.ReactNode }) {
  const { init, setViewModeOverride, setFinancingPathOverride, initStressTestOverrides, deactivateStressTest } = useModelStore();
  useReferenceScenarioAutoLoad();

  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      init();
    }
  }, [init]);

  // /bank is the dedicated banker-shareable URL: hard-pin the OpCo-subordinated
  // cash waterfall regardless of admin toggle state. Cleared on unmount so an
  // admin who navigates here and back to /admin/* sees their own toggle state
  // restored. Mirrors /pitch behavior, but without any link back into admin
  // chrome and without the BankViewToggle / ViewAsControl / impersonation
  // widgets — a banker who finds this URL must not be able to discover the
  // admin surface from it.
  useEffect(() => {
    setViewModeOverride('bank');
    initStressTestOverrides();
    return () => {
      setViewModeOverride(null);
      setFinancingPathOverride(null);
      deactivateStressTest();
    };
  }, [setViewModeOverride, setFinancingPathOverride, initStressTestOverrides, deactivateStressTest]);

  return (
    <div className="min-h-screen bg-surface-primary">
      {children}
    </div>
  );
}
