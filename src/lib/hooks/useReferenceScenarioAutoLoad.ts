"use client";

import { useEffect, useRef } from "react";
import { getDb } from "@/lib/firebase";
import { subscribeReferenceScenarioId } from "@/lib/data/referenceScenario";
import { useModelStore } from "@/lib/store/modelStore";

/**
 * Shared hook that auto-loads the reference scenario (Firestore
 * `appConfig/current` → `referenceScenarioId`) on first visit, before the
 * user makes any local edits. Mount it in both admin/layout.tsx and
 * bank/layout.tsx so every route lands on Eytan's saved scenario instead of
 * BASE_CASE.
 *
 * Guards:
 *   - Store-level flag (`referenceAutoLoadAttempted`) survives client-side
 *     route changes within the session.
 *   - Component-level ref (`didAttempt`) guards against React Strict Mode
 *     double-invocation, which would otherwise call loadConfig twice and
 *     trigger two Firestore writes in the copy-on-load path.
 *   - User has pending edits — don't overwrite their work.
 *   - Already on the reference scenario — mark done without re-loading.
 *   - Scenario list hasn't arrived yet — retry via the savedConfigs
 *     Zustand subscriber once init()'s background fetch lands.
 *
 * Note: the Zustand store uses vanilla `create` (no subscribeWithSelector),
 * so we use the single-argument subscribe form and re-read latestRefId from
 * the closure.
 */
export function useReferenceScenarioAutoLoad() {
  // Strict Mode guard: prevents double-invocation from calling loadConfig twice
  // (which can produce two Firestore writes in the copy-on-load path)
  const didAttempt = useRef(false);

  useEffect(() => {
    const db = getDb();
    if (!db) return;

    // Core attempt logic — shared between the Firestore callback and the
    // savedConfigs Zustand subscriber (retry path)
    function tryLoad(id: string | null) {
      // Never act on a null id — don't set the flag either
      if (!id) return;

      const state = useModelStore.getState();

      // Store-level flag: survives client-side route changes within the session
      if (state.referenceAutoLoadAttempted) return;
      // Strict Mode / double-invocation guard (component-level)
      if (didAttempt.current) return;
      // User has pending edits — don't overwrite
      if (state.editsSinceLastSave > 0) return;
      // Already on the reference scenario
      if (state.activeConfigId === id) {
        didAttempt.current = true;
        useModelStore.setState({ referenceAutoLoadAttempted: true });
        return;
      }
      // Scenario list hasn't loaded yet — retry will fire via savedConfigs subscriber
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!state.savedConfigs.some((c: any) => c.id === id)) return;

      // All guards passed — auto-load
      didAttempt.current = true;
      useModelStore.setState({ referenceAutoLoadAttempted: true });
      state.loadConfig(id);
    }

    // Capture the latest reference scenario id for the savedConfigs retry path
    let latestRefId: string | null = null;

    const unsubFirestore = subscribeReferenceScenarioId(db, (id) => {
      latestRefId = id;
      tryLoad(id);
    });

    // Retry path: savedConfigs may arrive after the Firestore callback.
    // The store uses vanilla subscribe (no subscribeWithSelector middleware),
    // so we use the single-argument form and read latestRefId from the closure.
    const unsubZustand = useModelStore.subscribe(() => {
      if (latestRefId) tryLoad(latestRefId);
    });

    return () => {
      unsubFirestore();
      unsubZustand();
    };
  }, []);
}
