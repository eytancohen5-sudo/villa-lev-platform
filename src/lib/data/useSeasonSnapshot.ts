// Subscribes to the live season snapshot at `seasonSnapshots/latest` published
// by the ops app (villa-lev-admin hosting site, same Firebase project).
// Falls back to the static snapshot in currentVillaActuals.ts if Firestore
// returns nothing — the dashboard still renders end-to-end with no network.
//
// Returns the same shape the dashboard previously imported as a constant, so
// the comparative section just swaps `import { currentSeason } …` for
// `const { currentSeason } = useSeasonSnapshot()`.

"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import {
  ACTUALS_SOURCE,
  currentSeason as staticCurrentSeason,
  historicalYears as staticHistoricalYears,
  lastCompletedSeason as staticLastCompleted,
  type HistoricalYear,
  type SeasonActuals,
} from "@/lib/data/currentVillaActuals";

export const SEASON_SNAPSHOT_PATH = "seasonSnapshots/latest" as const;

type Source = "live" | "static-fallback";

export type SeasonSnapshotResult = {
  currentSeason: SeasonActuals;
  historicalYears: HistoricalYear[];
  lastCompletedSeason: HistoricalYear;
  source: Source;
  // ISO string from the writer (`pulledAt`). For static fallback this is the
  // ACTUALS_SOURCE.pulledAt date.
  pulledAt: string;
  // True while the Firestore subscription is still doing its first read.
  loading: boolean;
};

const STATIC_RESULT: SeasonSnapshotResult = {
  currentSeason: staticCurrentSeason,
  historicalYears: staticHistoricalYears,
  lastCompletedSeason: staticLastCompleted,
  source: "static-fallback",
  pulledAt: ACTUALS_SOURCE.pulledAt,
  loading: false,
};

export function useSeasonSnapshot(): SeasonSnapshotResult {
  const [state, setState] = useState<SeasonSnapshotResult>(() => ({
    ...STATIC_RESULT,
    loading: true,
  }));

  useEffect(() => {
    const db = getDb();
    if (!db) {
      // SSR or Firebase not initialised → stay on static.
      setState({ ...STATIC_RESULT, loading: false });
      return;
    }

    const ref = doc(db, SEASON_SNAPSHOT_PATH);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setState({ ...STATIC_RESULT, loading: false });
          return;
        }
        const data = snap.data() as Partial<{
          schemaVersion: number;
          pulledAt: string;
          currentSeason: SeasonActuals;
          historicalYears: HistoricalYear[];
        }>;
        if (!data.currentSeason || !Array.isArray(data.historicalYears)) {
          // Shape mismatch — keep showing the static snapshot but log so we
          // notice if the writer drifts away from the contract.
          if (process.env.NODE_ENV !== "production") {
            console.warn("[seasonSnapshot] live doc missing required fields, using static");
          }
          setState({ ...STATIC_RESULT, loading: false });
          return;
        }
        const last =
          data.historicalYears.find((y) => y.year === 2025) ??
          staticLastCompleted;
        setState({
          currentSeason: data.currentSeason,
          historicalYears: data.historicalYears,
          lastCompletedSeason: last,
          source: "live",
          pulledAt: data.pulledAt ?? new Date().toISOString(),
          loading: false,
        });
      },
      (err) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[seasonSnapshot] subscribe failed, using static:", err?.message ?? err);
        }
        setState({ ...STATIC_RESULT, loading: false });
      },
    );
    return unsub;
  }, []);

  return state;
}
