// Reads the connectionHistory collection and surfaces recent sessions
// (ended or still active) for the admin Connections page.
//
// Design mirrors useConnectionsLog.ts — module-level store backed by
// useSyncExternalStore. One Firestore subscription shared across consumers.
//
// Retention: we show sessions from the last HISTORY_WINDOW_MS (7 days).
// Cleanup of older docs is handled by the connections page on mount.

import { useSyncExternalStore } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

// ── Public types ──────────────────────────────────────────────────────────────

export type ActionEntry = { action: string; actionAt: number };

export type HistoryEntry = {
  tabId: string;
  uid: string;
  displayName: string;
  isAnonymous: boolean;
  connectedAt: number;
  lastHeartbeat: number;
  disconnectedAt?: number;
  currentPage: string;
  status: "active" | "ended";
  /** All actions logged during this tab session, newest first. */
  actions: ActionEntry[];
  lastAction?: string;   // kept as fallback for pre-migration docs
  lastActionAt?: number; // kept as fallback for pre-migration docs
};

export type ConnectionHistoryResult = {
  entries: HistoryEntry[];
  loading: boolean;
  error: string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Module-level store ────────────────────────────────────────────────────────

type Listener = () => void;

const INITIAL: ConnectionHistoryResult = { entries: [], loading: true, error: null };
const EMPTY: ConnectionHistoryResult   = Object.freeze({ entries: [], loading: false, error: null });
const SERVER: ConnectionHistoryResult  = Object.freeze({ entries: [], loading: false, error: null });

let current: ConnectionHistoryResult = INITIAL;
const listeners = new Set<Listener>();
let unsub: Unsubscribe | null = null;
let subscribeCount = 0;

function emit(next: ConnectionHistoryResult) {
  current = next;
  for (const listener of listeners) listener();
}

function startListener() {
  const db = getDb();
  if (!db) { emit(EMPTY); return; }

  const cutoff = Date.now() - HISTORY_WINDOW_MS;
  const q = query(
    collection(db, "connectionHistory"),
    where("connectedAt", ">=", cutoff),
    orderBy("connectedAt", "desc"),
  );

  unsub = onSnapshot(
    q,
    (snap) => {
      const entries: HistoryEntry[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (
          typeof data.uid !== "string" ||
          typeof data.connectedAt !== "number" ||
          typeof data.lastHeartbeat !== "number"
        ) return;
        const rawActions = Array.isArray(data.actions)
          ? (data.actions as ActionEntry[])
              .filter((a) => typeof a.action === "string" && typeof a.actionAt === "number")
              .sort((a, b) => b.actionAt - a.actionAt)
          : [];
        entries.push({
          tabId: d.id,
          uid: data.uid,
          displayName: typeof data.displayName === "string" ? data.displayName : "",
          isAnonymous: data.isAnonymous === true,
          connectedAt: data.connectedAt,
          lastHeartbeat: data.lastHeartbeat,
          disconnectedAt: typeof data.disconnectedAt === "number" ? data.disconnectedAt : undefined,
          currentPage: typeof data.currentPage === "string" ? data.currentPage : "/",
          status: data.status === "ended" ? "ended" : "active",
          actions: rawActions,
          lastAction: typeof data.lastAction === "string" ? data.lastAction : undefined,
          lastActionAt: typeof data.lastActionAt === "number" ? data.lastActionAt : undefined,
        });
      });
      emit({ entries, loading: false, error: null });
    },
    (err) => {
      console.warn("[connectionHistory] subscribe failed:", err?.message ?? err);
      emit({ entries: [], loading: false, error: err?.message ?? "Failed to load history" });
    },
  );
}

function stopListener() {
  if (unsub) { unsub(); unsub = null; }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  subscribeCount += 1;
  if (subscribeCount === 1) startListener();
  return () => {
    listeners.delete(listener);
    subscribeCount -= 1;
    if (subscribeCount === 0) {
      stopListener();
      current = INITIAL;
    }
  };
}

function subscribeNoop(listener: Listener): () => void {
  void listener;
  return () => {};
}

function getSnapshot(): ConnectionHistoryResult { return current; }
function getServerSnapshot(): ConnectionHistoryResult { return SERVER; }

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useConnectionHistory(enabled = true): ConnectionHistoryResult {
  return useSyncExternalStore(
    enabled ? subscribe : subscribeNoop,
    getSnapshot,
    getServerSnapshot,
  );
}
