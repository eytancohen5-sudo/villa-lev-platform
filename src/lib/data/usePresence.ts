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
import { doc, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
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

// ── Optional activity logging ─────────────────────────────────────────────────

export type PresenceAction = "excel_download" | "presentation_view" | "tour_start";

/**
 * Log a user activity against both the live presence doc and the history doc.
 * Non-fatal — silently ignored if either doc doesn't exist yet.
 */
export async function logPresenceActivity(action: PresenceAction): Promise<void> {
  const db = getDb();
  if (!db) return;
  const update = { lastAction: action, lastActionAt: Date.now() };
  await Promise.allSettled([
    updateDoc(doc(db, "presence", TAB_ID), update),
    updateDoc(doc(db, "connectionHistory", TAB_ID), update),
  ]);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePresence(): void {
  useEffect(() => {
    const db = getDb();
    const auth = getAuthInstance();
    if (!db || !auth) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let cleanedUp = false;

    const presenceRef = doc(db, "presence", TAB_ID);
    const historyRef  = doc(db, "connectionHistory", TAB_ID);

    async function writeInitial(uid: string, displayName: string, isAnonymous: boolean) {
      if (cleanedUp) return;
      const safeDisplayName = displayName.trim().slice(0, 120);
      const now = Date.now();
      const payload = {
        uid,
        displayName: safeDisplayName,
        isAnonymous,
        connectedAt: now,
        lastHeartbeat: now,
        currentPage: typeof window !== "undefined" ? window.location.pathname : "/",
        tabId: TAB_ID,
        schemaVersion: 1,
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
      await Promise.allSettled([
        updateDoc(presenceRef, { lastHeartbeat: now, currentPage: page }),
        updateDoc(historyRef,  { lastHeartbeat: now, currentPage: page }),
      ]);
    }

    async function cleanup() {
      cleanedUp = true;
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
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
        intervalId = setInterval(() => {
          void sendHeartbeat();
        }, HEARTBEAT_INTERVAL_MS);
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
