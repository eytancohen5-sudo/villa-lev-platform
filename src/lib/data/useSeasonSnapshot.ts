// Subscribes to the live season snapshot at `seasonSnapshots/latest` published
// by the ops app (villa-lev-admin hosting site, same Firebase project).
// Falls back to the static snapshot in currentVillaActuals.ts if Firestore
// returns nothing — the dashboard still renders end-to-end with no network.
//
// Returns the same shape the dashboard previously imported as a constant, so
// the comparative section just swaps `import { currentSeason } …` for
// `const { currentSeason } = useSeasonSnapshot()`.
//
// Implementation: a module-level store backed by useSyncExternalStore. The
// store subscribes lazily on first React `subscribe()` call so SSR/static
// render still gets a deterministic STATIC_RESULT, and the live cache is
// shared across every component reading the snapshot (no duplicate
// onSnapshot listeners, no static-then-live flash on mount).

"use client";

import { useSyncExternalStore } from "react";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
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

const STATIC_RESULT: SeasonSnapshotResult = Object.freeze({
  currentSeason: staticCurrentSeason,
  historicalYears: staticHistoricalYears,
  lastCompletedSeason: staticLastCompleted,
  source: "static-fallback",
  pulledAt: ACTUALS_SOURCE.pulledAt,
  loading: false,
}) as SeasonSnapshotResult;

const INITIAL_LOADING_RESULT: SeasonSnapshotResult = Object.freeze({
  ...STATIC_RESULT,
  loading: true,
}) as SeasonSnapshotResult;

// ── Module-level store ──
// One snapshot, one subscription, shared across every consumer. We do NOT
// initialise the subscription at import time — useSyncExternalStore calls
// subscribe() on first React mount, which is when we want network work to
// start. Until then, getSnapshot() returns the static fallback so that even
// component trees that only render once still get a usable value.

type Listener = () => void;

let current: SeasonSnapshotResult = INITIAL_LOADING_RESULT;
const listeners = new Set<Listener>();
let unsub: Unsubscribe | null = null;
let subscribeCount = 0;

function emit(next: SeasonSnapshotResult) {
  current = next;
  for (const listener of listeners) listener();
}

function startFirestoreListener() {
  const db = getDb();
  if (!db) {
    // SSR or Firebase not initialised → stay on static.
    emit(STATIC_RESULT);
    return;
  }
  const ref = doc(db, SEASON_SNAPSHOT_PATH);
  unsub = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        emit(STATIC_RESULT);
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
        emit(STATIC_RESULT);
        return;
      }
      const last =
        data.historicalYears.find((y) => y.year === 2025) ??
        staticLastCompleted;
      emit({
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
      emit(STATIC_RESULT);
    },
  );
}

function stopFirestoreListener() {
  if (unsub) {
    unsub();
    unsub = null;
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  subscribeCount += 1;
  if (subscribeCount === 1) {
    startFirestoreListener();
  }
  return () => {
    listeners.delete(listener);
    subscribeCount -= 1;
    if (subscribeCount === 0) {
      stopFirestoreListener();
      // Reset cached value so a remount after teardown starts fresh.
      current = INITIAL_LOADING_RESULT;
    }
  };
}

function getSnapshot(): SeasonSnapshotResult {
  return current;
}

// SSR / static-export render: always return the static fallback. The frozen
// reference is stable across calls so useSyncExternalStore is happy.
function getServerSnapshot(): SeasonSnapshotResult {
  return STATIC_RESULT;
}

export function useSeasonSnapshot(): SeasonSnapshotResult {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
