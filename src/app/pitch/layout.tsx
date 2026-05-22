"use client";

import { useEffect, useRef } from "react";
import { useModelStore } from "@/lib/store/modelStore";

export default function PitchLayout({ children }: { children: React.ReactNode }) {
  const { init, setViewModeOverride } = useModelStore();
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      init();
    }
  }, [init]);

  // /pitch is banker-facing: force OpCo-subordinated cash waterfall.
  // Cleared on unmount so admin navigation back to /admin/* restores the
  // admin's toggle / default.
  useEffect(() => {
    setViewModeOverride('bank');
    return () => setViewModeOverride(null);
  }, [setViewModeOverride]);

  return <div className="bg-surface-primary">{children}</div>;
}
