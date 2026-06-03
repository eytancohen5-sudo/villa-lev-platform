"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Break-even analysis was merged into Sensitivity (ADR/Nights/Heatmap).
// Any bookmark or inbound link to /admin/breakeven is redirected here.
export default function BreakevenRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/sensitivity");
  }, [router]);
  return null;
}
