"use client";

import { useEffect, useRef } from "react";
import { getDb } from "@/lib/firebase";
import { subscribeReferenceScenarioId } from "@/lib/data/referenceScenario";
import { useModelStore } from "@/lib/store/modelStore";

/**
 * Shared hook that handles the reference scenario on first visit.
 *
 * When `onPrompt` is omitted (bank layout): silently auto-loads — bankers
 * always see the designated reference scenario.
 *
 * When `onPrompt` is provided (admin layout): instead of loading directly,
 * calls `onPrompt(id, name)` so the admin shell can show a named banner
 * ("Load reference scenario '[name]'?") and let Eytan decide. This prevents
 * the auto-load from silently wiping unsaved local work.
 *
 * Guards (both modes):
 *   - Store-level flag (`referenceAutoLoadAttempted`) survives client-side
 *     route changes within the session.
 *   - Component-level ref (`didAttempt`) guards against React Strict Mode
 *     double-invocation.
 *   - Already on the reference scenario — mark done without re-loading.
 *   - Scenario list hasn't arrived yet — retry via the savedConfigs
 *     Zustand subscriber once init()'s background fetch lands.
 *
 * Note: the Zustand store uses vanilla `create` (no subscribeWithSelector),
 * so we use the single-argument subscribe form and re-read latestRefId from
 * the closure.
 */
export function useReferenceScenarioAutoLoad(
  onPrompt?: (id: string, name: string) => void
) {
  const didAttempt = useRef(false);
  const onPromptRef = useRef(onPrompt);
  onPromptRef.current = onPrompt;

  useEffect(() => {
    const db = getDb();
    if (!db) return;

    function tryLoad(id: string | null) {
      if (!id) return;

      const state = useModelStore.getState();

      if (state.referenceAutoLoadAttempted) return;
      if (didAttempt.current) return;
      // Already on the reference scenario
      if (state.activeConfigId === id) {
        didAttempt.current = true;
        useModelStore.setState({ referenceAutoLoadAttempted: true });
        return;
      }
      // Scenario list hasn't loaded yet — retry will fire via savedConfigs subscriber
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = state.savedConfigs.find((c: any) => c.id === id);
      if (!config) return;

      didAttempt.current = true;
      useModelStore.setState({ referenceAutoLoadAttempted: true });

      if (onPromptRef.current) {
        // Admin mode: surface a named prompt instead of loading silently.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onPromptRef.current(id, (config as any).name ?? 'Reference scenario');
      } else {
        // Bank mode: silent auto-load — no pending-edits guard needed since
        // bankers don't create local work here.
        state.loadConfig(id);
      }
    }

    let latestRefId: string | null = null;

    const unsubFirestore = subscribeReferenceScenarioId(db, (id) => {
      latestRefId = id;
      tryLoad(id);
    });

    const unsubZustand = useModelStore.subscribe(() => {
      if (latestRefId) tryLoad(latestRefId);
    });

    return () => {
      unsubFirestore();
      unsubZustand();
    };
  }, []);
}
