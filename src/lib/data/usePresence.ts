// FIRESTORE RULES: add to your firestore.rules file:
//
// match /presence/{tabId} {
//   allow create, update: if request.auth != null
//                         && request.resource.data.uid == request.auth.uid;
//   allow delete: if request.auth != null
//                 && resource.data.uid == request.auth.uid;
//   allow read: if isAdmin();
// }
//
// match /connectionHistory/{tabId} {
//   allow create: if request.auth != null
//                 && request.resource.data.uid == request.auth.uid
//                 && request.resource.data.schemaVersion == 1;
//   allow update: if request.auth != null
//                 && resource.data.uid == request.auth.uid
//                 && request.resource.data.uid == resource.data.uid;
//   allow delete: if request.auth != null
//                 && (resource.data.uid == request.auth.uid || isAdmin());
//   allow read: if isAdmin();
// }

import { useEffect } from "react";
import { doc, setDoc, deleteDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getDb, getAuthInstance } from "@/lib/firebase";
import { getGateName } from "@/components/AuthGate";
import { getBankName } from "@/components/BankGate";

// Module-level stable tab identifier — survives re-renders.
const TAB_ID: string =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const HEARTBEAT_INTERVAL_MS = 30_000;
/** How often to check whether the user navigated to a new page. */
const PAGE_CHECK_INTERVAL_MS = 3_000;

// ── Optional activity logging ─────────────────────────────────────────────────

export type ActionEntry = { action: string; actionAt: number };
export type PresenceAction = "excel_download" | "presentation_view" | "tour_start";

/**
 * Log a user activity against both the live presence doc and the history doc.
 * Uses arrayUnion so every call appends a new entry — no overwrites.
 * Non-fatal — silently ignored if either doc doesn't exist yet.
 */
export async function logPresenceActivity(action: PresenceAction): Promise<void> {
  const db = getDb();
  if (!db) return;
  const entry: ActionEntry = { action, actionAt: Date.now() };
  await Promise.allSettled([
    updateDoc(doc(db, "presence", TAB_ID), {
      lastAction: entry.action,
      lastActionAt: entry.actionAt,
      actions: arrayUnion(entry),
    }),
    updateDoc(doc(db, "connectionHistory", TAB_ID), {
      lastAction: entry.action,
      lastActionAt: entry.actionAt,
      actions: arrayUnion(entry),
    }),
  ]);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePresence(): void {
  useEffect(() => {
    const db = getDb();
    const auth = getAuthInstance();
    if (!db || !auth) return;

    let heartbeatId: ReturnType<typeof setInterval> | null = null;
    let pageCheckId: ReturnType<typeof setInterval> | null = null;
    let cleanedUp = false;
    // Track the last known pathname so the page-check poll can fire only on change.
    let lastPage: string =
      typeof window !== "undefined" ? window.location.pathname : "/";

    const presenceRef = doc(db, "presence", TAB_ID);
    const historyRef  = doc(db, "connectionHistory", TAB_ID);

    /** Immediately push the new pathname to both docs (no heartbeat timestamp bump). */
    async function updateCurrentPage(page: string) {
      if (cleanedUp) return;
      await Promise.allSettled([
        updateDoc(presenceRef, { currentPage: page }),
        updateDoc(historyRef,  { currentPage: page }),
      ]);
    }

    async function writeInitial(uid: string, displayName: string, isAnonymous: boolean) {
      if (cleanedUp) return;
      const safeDisplayName = displayName.trim().slice(0, 120);
      const now = Date.now();
      const currentPage = typeof window !== "undefined" ? window.location.pathname : "/";
      lastPage = currentPage;
      const payload = {
        uid,
        displayName: safeDisplayName,
        isAnonymous,
        connectedAt: now,
        lastHeartbeat: now,
        currentPage,
        tabId: TAB_ID,
        schemaVersion: 1,
        actions: [],
      };
      await Promise.allSettled([
        // Live presence doc (deleted on tab close).
        setDoc(presenceRef, payload),
        // Persistent history doc — survives tab close; updated on heartbeat.
        setDoc(historyRef, { ...payload, status: "active" }),
      ]);
    }

    async function sendHeartbeat() {
      if (cleanedUp) return;
      const now = Date.now();
      const page = typeof window !== "undefined" ? window.location.pathname : "/";
      // Sync lastPage so the page-check poll doesn't fire a redundant update
      // right after the heartbeat already wrote the same path.
      lastPage = page;
      await Promise.allSettled([
        updateDoc(presenceRef, { lastHeartbeat: now, currentPage: page }),
        updateDoc(historyRef,  { lastHeartbeat: now, currentPage: page }),
      ]);
    }

    async function cleanup() {
      cleanedUp = true;
      if (heartbeatId !== null) {
        clearInterval(heartbeatId);
        heartbeatId = null;
      }
      if (pageCheckId !== null) {
        clearInterval(pageCheckId);
        pageCheckId = null;
      }
      await Promise.allSettled([
        // Mark the history doc as ended BEFORE deleting presence, so the
        // history write has the best chance of surviving the page unload.
        updateDoc(historyRef, { disconnectedAt: Date.now(), status: "ended" }),
        deleteDoc(presenceRef),
      ]);
    }

    // Wait for auth to resolve before writing the first doc.
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      if (cleanedUp) return;

      const uid = user.uid;
      const displayName =
        !user.isAnonymous && user.displayName
          ? user.displayName
          : getBankName() || getGateName() || user.displayName || "Anonymous";
      const isAnonymous = user.isAnonymous;

      void writeInitial(uid, displayName, isAnonymous).then(() => {
        if (cleanedUp) return;
        // 30 s heartbeat — keeps lastHeartbeat fresh and currentPage in sync.
        heartbeatId = setInterval(() => {
          void sendHeartbeat();
        }, HEARTBEAT_INTERVAL_MS);
        // 3 s page-change detector — updates currentPage immediately on
        // Next.js client-side navigation without waiting for the next heartbeat.
        if (typeof window !== "undefined") {
          pageCheckId = setInterval(() => {
            const page = window.location.pathname;
            if (page !== lastPage) {
              lastPage = page;
              void updateCurrentPage(page);
            }
          }, PAGE_CHECK_INTERVAL_MS);
        }
      });

      unsubAuth();
    });

    const handleBeforeUnload = () => {
      void cleanup();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      unsubAuth();
      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      }
      void cleanup();
    };
  }, []);
}
