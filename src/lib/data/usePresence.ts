// FIRESTORE RULES: add to your firestore.rules file:
//
// match /presence/{tabId} {
//   // Any authenticated user (including anonymous) can write their own tab doc.
//   allow create, update: if request.auth != null
//                         && request.resource.data.uid == request.auth.uid;
//   // A user may only delete their own tab doc (uid matches, not path segment).
//   allow delete: if request.auth != null
//                 && resource.data.uid == request.auth.uid;
//   // Admins (isAdmin flag in Firestore users/{uid}.role == 'admin') can read
//   // all presence docs. For now, allow any authenticated user to read so
//   // the Connections page can load without a custom claims round-trip.
//   allow read: if request.auth != null;
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

export async function logPresenceActivity(action: PresenceAction): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await updateDoc(doc(db, "presence", TAB_ID), {
      lastAction: action,
      lastActionAt: Date.now(),
    });
  } catch {
    // Non-fatal: presence doc may not exist yet.
  }
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

    async function writeInitial(uid: string, displayName: string, isAnonymous: boolean) {
      if (cleanedUp) return;
      const safeDisplayName = displayName.trim().slice(0, 120);
      try {
        await setDoc(presenceRef, {
          uid,
          displayName: safeDisplayName,
          isAnonymous,
          connectedAt: Date.now(),
          lastHeartbeat: Date.now(),
          // Note: must never be a URL containing auth tokens or sensitive IDs in the path.
          currentPage: typeof window !== "undefined" ? window.location.pathname : "/",
          tabId: TAB_ID,
          schemaVersion: 1,
        });
      } catch {
        // Non-fatal: Firestore rules may not be deployed yet.
      }
    }

    async function sendHeartbeat(uid: string) {
      if (cleanedUp) return;
      try {
        await updateDoc(presenceRef, {
          lastHeartbeat: Date.now(),
          currentPage: typeof window !== "undefined" ? window.location.pathname : "/",
        });
      } catch {
        void uid;
      }
    }

    async function cleanup() {
      cleanedUp = true;
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      try {
        await deleteDoc(presenceRef);
      } catch {
        // Non-fatal.
      }
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
          void sendHeartbeat(uid);
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
