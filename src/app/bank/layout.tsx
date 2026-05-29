"use client";

import { useEffect, useRef } from "react";
import { AssumptionsMemoButton } from "@/components/AssumptionsMemoButton";
import { useModelStore } from "@/lib/store/modelStore";
import { BankGate } from "@/components/BankGate";
import { usePresence } from "@/lib/data/usePresence";
import { useReferenceScenarioAutoLoad } from "@/lib/hooks/useReferenceScenarioAutoLoad";

export default function BankLayout({ children }: { children: React.ReactNode }) {
  const { init, setViewModeOverride, setFinancingPathOverride, initStressTestOverrides, deactivateStressTest, clearCapexUplift } = useModelStore();
  useReferenceScenarioAutoLoad();
  usePresence();

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
    setFinancingPathOverride('commercial');
    initStressTestOverrides();
    return () => {
      setViewModeOverride(null);
      setFinancingPathOverride(null);
      deactivateStressTest();
      clearCapexUplift();
    };
  }, [setViewModeOverride, setFinancingPathOverride, initStressTestOverrides, deactivateStressTest, clearCapexUplift]);

  return (
    <BankGate>
      <div className="min-h-screen bg-surface-primary">
        {children}
      </div>
    </BankGate>
  );
}
