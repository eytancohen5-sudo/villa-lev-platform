"use client";

import { useEffect, useRef } from "react";
import { AssumptionsMemoButton } from "@/components/AssumptionsMemoButton";
import { useModelStore } from "@/lib/store/modelStore";
import { useSeasonSnapshot } from "@/lib/data/useSeasonSnapshot";
import { useReferenceScenarioAutoLoad } from "@/lib/hooks/useReferenceScenarioAutoLoad";
import { useTranslation } from "@/lib/i18n/I18nProvider";

export default function BankLayout({ children }: { children: React.ReactNode }) {
  const { init, setViewModeOverride, setFinancingPathOverride, initStressTestOverrides, deactivateStressTest } = useModelStore();
  useReferenceScenarioAutoLoad();
  const { t } = useTranslation();
  // Freshness banner: mirrors the same guard in /admin/layout.tsx. When the
  // Firestore subscription returns nothing (or shape-mismatches), the hook
  // falls back to the static snapshot in currentVillaActuals.ts. Surface that
  // to the banker so they know the figures are not live.
  const { source: snapshotSource, pulledAt: snapshotPulledAt } = useSeasonSnapshot();
  const showStaleBanner = snapshotSource === "static-fallback";

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
      {showStaleBanner && (
        <div
          role="status"
          aria-live="polite"
          className="bg-amber-50 border-b border-amber-300 text-amber-900 text-xs px-6 py-2 flex items-center gap-2 print:hidden"
        >
          <span aria-hidden="true">(!)</span>
          <span>
            {t('admin.banner.stalePart1')}{snapshotPulledAt ? <> <strong>{snapshotPulledAt}</strong></> : null}{' '}{t('admin.banner.stalePart2')}
          </span>
        </div>
      )}
      {children}
      {/* <AssumptionsMemoButton /> */}
    </div>
  );
}
