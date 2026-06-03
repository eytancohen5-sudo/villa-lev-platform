"use client";

// useTrackFeature — lightweight feature-usage telemetry for internal analytics.
//
// Usage:
//   const { track } = useTrackFeature();
//   useEffect(() => { track('feature-id'); }, [track]);
//
// FeatureId registry (keep in sync with /admin/analytics):
//   admin-dashboard      /admin/dashboard mount
//   admin-returns        /admin/returns mount
//   admin-pnl            /admin/pnl mount
//   admin-breakeven      /admin/breakeven mount
//   admin-sensitivity    /admin/sensitivity mount
//   admin-debt-coverage  /admin/debt-coverage mount
//   admin-financing      /admin/financing mount
//   admin-opco-split     /admin/opco-split mount
//   admin-cap-table      /admin/cap-table mount
//   admin-scenarios      /admin/scenarios mount
//   bank-overview        /bank mount
//   bank-optima          /bank/optima mount
//   pitch                /pitch mount
//
// Tracking is disabled when NEXT_PUBLIC_ANALYTICS_ENABLED !== 'true'.
// The addDoc call is fire-and-forget: the returned promise is intentionally
// discarded and errors are silently swallowed so telemetry never breaks UI.
//
// Firestore schema (collection: featureUsage):
//   { featureId, audience, sessionId, path, ts: serverTimestamp }
//
// Query note: the analytics page fetches with a limit(500) clause — avoid
// growing the collection beyond ~50K docs before adding pagination.

import { useCallback } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

type Audience = "admin" | "bank" | "unknown";

function getSessionId(): string {
  try {
    const KEY = "vl-analytics-session";
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

function detectAudience(): Audience {
  try {
    if (localStorage.getItem("vl-admin-pass") !== null) return "admin";
  } catch { /* private mode */ }
  try {
    if (sessionStorage.getItem("vl-bank-name") !== null) return "bank";
  } catch { /* private mode */ }
  return "unknown";
}

export function useTrackFeature(): { track: (featureId: string) => void } {
  const track = useCallback((featureId: string) => {
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true") return;

    const db = getDb();
    if (!db) return;

    const sessionId = getSessionId();
    const audience = detectAudience();
    const path =
      typeof window !== "undefined" ? window.location.pathname : "";

    // Fire-and-forget — do not await, do not surface errors to UI.
    void addDoc(collection(db, "featureUsage"), {
      featureId,
      audience,
      sessionId,
      path,
      ts: serverTimestamp(),
    }).catch(() => undefined);
  }, []);

  return { track };
}
