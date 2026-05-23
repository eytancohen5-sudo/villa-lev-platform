"use client";

import { useEffect, useRef } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { useSeasonSnapshot } from "@/lib/data/useSeasonSnapshot";

export default function BankLayout({ children }: { children: React.ReactNode }) {
  const { init, setViewModeOverride, setFinancingPathOverride } = useModelStore();
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
    return () => {
      setViewModeOverride(null);
      setFinancingPathOverride(null);
    };
  }, [setViewModeOverride, setFinancingPathOverride]);

  return (
    <div className="min-h-screen bg-surface-primary">
      {showStaleBanner && (
        <div
          role="status"
          aria-live="polite"
          className="bg-amber-50 border-b border-amber-300 text-amber-900 text-xs px-6 py-2 flex items-center gap-2 print:hidden"
        >
          <span aria-hidden="true">⚠</span>
          <span>
            Showing static snapshot from <strong>{snapshotPulledAt}</strong> — live
            <code className="mx-1 px-1 rounded bg-amber-100 font-mono">seasonSnapshots/latest</code>
            feed not connected.
          </span>
        </div>
      )}
      {!showStaleBanner && (
        <div
          role="status"
          aria-live="polite"
          className="bg-surface-secondary border-b border-surface-tertiary text-text-tertiary text-xs px-6 py-1.5 flex items-center gap-2 print:hidden"
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />
          <span>
            Live data · refreshed <time dateTime={snapshotPulledAt}>{snapshotPulledAt}</time>
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
