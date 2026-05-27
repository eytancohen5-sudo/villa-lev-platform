// Subscribes to the live presence collection at `presence/{tabId}` and
// groups entries by uid for the Connections admin page.
//
// Implementation mirrors useSeasonSnapshot.ts — module-level store backed
// by useSyncExternalStore. One subscription, shared across all consumers.
// The 60-second re-emit interval starts when subscribeCount goes 0→1 and
// stops when it drops back to 0 (lockstep with the Firestore subscription).

import { useSyncExternalStore } from "react";
import { collection, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

// ── Public types ────────────────────────────────────────────────────────────

export type ConnectionEntry = {
  uid: string;
  displayName: string;
  isAnonymous: boolean;
  sessionCount: number;
  connectedSince: number;
  lastSeen: number;
  currentPage: string;
  isStale: boolean;
  tabIds: string[];
  lastAction?: string;
  lastActionAt?: number;
};

export type ConnectionsLogResult = {
  entries: ConnectionEntry[];
  loading: boolean;
  error: string | null;
};

// ── Constants ────────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 90_000;
const REEMIT_INTERVAL_MS = 60_000;

// ── Module-level store ───────────────────────────────────────────────────────

type Listener = () => void;

// Raw presence doc shape from Firestore.
type PresenceDoc = {
  uid: string;
  displayName: string;
  isAnonymous: boolean;
  connectedAt: number;
  lastHeartbeat: number;
  currentPage: string;
  tabId: string;
  schemaVersion: number;
  lastAction?: string;
  lastActionAt?: number;
};

const INITIAL: ConnectionsLogResult = { entries: [], loading: true, error: null };
const EMPTY: ConnectionsLogResult = Object.freeze({ entries: [], loading: false, error: null });
const SERVER: ConnectionsLogResult = Object.freeze({ entries: [], loading: false, error: null });

let current: ConnectionsLogResult = INITIAL;
const listeners = new Set<Listener>();
let unsub: Unsubscribe | null = null;
let subscribeCount = 0;
let reemitInterval: ReturnType<typeof setInterval> | null = null;

// Raw docs keyed by tabId — kept in module scope so the re-emit tick can
// re-derive stale flags without a new Firestore read.
let rawDocs: Map<string, PresenceDoc> = new Map();

function emit(next: ConnectionsLogResult) {
  current = next;
  for (const listener of listeners) listener();
}

function deriveEntries(): ConnectionEntry[] {
  const now = Date.now();
  const byUid = new Map<string, PresenceDoc[]>();

  for (const presDoc of rawDocs.values()) {
    const uid = presDoc.uid;
    if (!byUid.has(uid)) byUid.set(uid, []);
    byUid.get(uid)!.push(presDoc);
  }

  const entries: ConnectionEntry[] = [];
  for (const [uid, docs] of byUid.entries()) {
    const connectedSince = Math.min(...docs.map((d) => d.connectedAt));
    const lastSeen = Math.max(...docs.map((d) => d.lastHeartbeat));
    // Current page: take from the most-recently-seen tab.
    const mostRecent = docs.reduce((a, b) =>
      a.lastHeartbeat >= b.lastHeartbeat ? a : b,
    );
    // Most recent action across all tabs for this user.
    const latestActionDoc = docs.reduce<PresenceDoc | null>((best, d) => {
      if (!d.lastActionAt) return best;
      if (!best || !best.lastActionAt || d.lastActionAt > best.lastActionAt) return d;
      return best;
    }, null);

    entries.push({
      uid,
      displayName: mostRecent.displayName || uid.slice(0, 8),
      isAnonymous: mostRecent.isAnonymous,
      sessionCount: docs.length,
      connectedSince,
      lastSeen,
      currentPage: mostRecent.currentPage,
      isStale: now - lastSeen > STALE_THRESHOLD_MS,
      tabIds: docs.map((d) => d.tabId),
      lastAction: latestActionDoc?.lastAction,
      lastActionAt: latestActionDoc?.lastActionAt,
    });
  }

  // Sort by connectedSince ascending (earliest connected first).
  entries.sort((a, b) => a.connectedSince - b.connectedSince);
  return entries;
}

function startFirestoreListener() {
  const db = getDb();
  if (!db) {
    emit(EMPTY);
    return;
  }
  const ref = collection(db, "presence");
  unsub = onSnapshot(
    ref,
    (snap) => {
      rawDocs = new Map();
      snap.forEach((d) => {
        const data = d.data();
        // Minimal shape validation before accepting the doc.
        if (
          typeof data.uid === "string" &&
          typeof data.connectedAt === "number" &&
          typeof data.lastHeartbeat === "number"
        ) {
          rawDocs.set(d.id, {
            uid: data.uid,
            displayName: typeof data.displayName === "string" ? data.displayName : "",
            isAnonymous: data.isAnonymous === true,
            connectedAt: data.connectedAt,
            lastHeartbeat: data.lastHeartbeat,
            currentPage: typeof data.currentPage === "string" ? data.currentPage : "/",
            tabId: typeof data.tabId === "string" ? data.tabId : d.id,
            schemaVersion: typeof data.schemaVersion === "number" ? data.schemaVersion : 1,
            lastAction: typeof data.lastAction === "string" ? data.lastAction : undefined,
            lastActionAt: typeof data.lastActionAt === "number" ? data.lastActionAt : undefined,
          });
        }
      });
      emit({ entries: deriveEntries(), loading: false, error: null });
    },
    (err) => {
      console.warn("[connectionsLog] subscribe failed:", err?.message ?? err);
      emit({ entries: [], loading: false, error: err?.message ?? "Failed to load connections" });
    },
  );

  // Re-emit every 60 s so isStale badges refresh without a Firestore round-trip.
  reemitInterval = setInterval(() => {
    if (rawDocs.size > 0) {
      emit({ entries: deriveEntries(), loading: false, error: null });
    }
  }, REEMIT_INTERVAL_MS);
}

function stopFirestoreListener() {
  if (unsub) {
    unsub();
    unsub = null;
  }
  if (reemitInterval !== null) {
    clearInterval(reemitInterval);
    reemitInterval = null;
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
      rawDocs = new Map();
      current = INITIAL;
    }
  };
}

function getSnapshot(): ConnectionsLogResult {
  return current;
}

function getServerSnapshot(): ConnectionsLogResult {
  return SERVER;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

// No-op subscribe variant — used when the caller is not admin, so we never
// open a Firestore subscription that would immediately fail with permission-
// denied and waste a read quota.
function subscribeNoop(listener: Listener): () => void {
  void listener;
  return () => {};
}

export function useConnectionsLog(enabled = true): ConnectionsLogResult {
  return useSyncExternalStore(
    enabled ? subscribe : subscribeNoop,
    getSnapshot,
    getServerSnapshot,
  );
}
