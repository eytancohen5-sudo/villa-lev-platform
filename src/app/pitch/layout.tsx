"use client";

import { useEffect, useRef } from "react";
import { useModelStore } from "@/lib/store/modelStore";

export default function PitchLayout({ children }: { children: React.ReactNode }) {
  const { init } = useModelStore();
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      init();
    }
  }, [init]);

  return <div className="bg-surface-primary">{children}</div>;
}
