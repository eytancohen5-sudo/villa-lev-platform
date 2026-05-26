"use client";

import { useEffect, useRef } from "react";
import { useModelStore } from "@/lib/store/modelStore";

/**
 * /admin/presentation layout
 *
 * Intentionally chrome-free: no sidebar, no top control bar.
 * Bankers open this route directly or arrive from the nav entry;
 * they see only the presentation content.
 *
 * Init pattern: mirrors /pitch/layout.tsx — useRef guard prevents
 * double-init on StrictMode double-mount; setViewModeOverride('bank')
 * forces the OpCo-subordinated cash waterfall for the entire session
 * and is cleared on unmount so admin routes are unaffected.
 */
export default function PresentationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { init, setViewModeOverride } = useModelStore();

  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      init();
    }
  }, [init]);

  useEffect(() => {
    setViewModeOverride("bank");
    return () => setViewModeOverride(null);
  }, [setViewModeOverride]);

  return (
    <div className="presentation-root bg-white min-h-screen">
      {children}
    </div>
  );
}
