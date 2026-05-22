"use client";

import { useEffect, useRef } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function BankLayout({ children }: { children: React.ReactNode }) {
  const { init, setViewModeOverride } = useModelStore();

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
  // restored. Mirrors /investor and /pitch behavior, but without any link
  // back into admin chrome and without the BankViewToggle / ViewAsControl /
  // impersonation widgets — a banker who finds this URL must not be able to
  // discover the admin surface from it.
  useEffect(() => {
    setViewModeOverride('bank');
    return () => setViewModeOverride(null);
  }, [setViewModeOverride]);

  return (
    <div className="min-h-screen bg-surface-primary">
      <header className="border-b border-surface-tertiary bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-widest text-text-tertiary">
              Bank Review Portal
            </span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle />
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
