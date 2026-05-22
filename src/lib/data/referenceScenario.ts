// Reference-scenario singleton: a one-doc app-wide pointer that designates
// which saved scenario every visitor should land on by default until they
// make a local edit. Lives in Firestore at `appConfig/current`.
//
// Public read (matches /scenarios posture so the banker share-link path
// works unauthenticated). Admin-only write — enforced in firestore.rules.
//
// Shape:
//   {
//     referenceScenarioId: string | null,
//     updatedAt: number,
//     updatedBy: string,
//   }
//
// Why not store this on the scenario doc itself? A boolean flag on each
// scenario would require a transactional flip across two docs every time
// the admin re-points the reference (set new = true, clear old = false).
// A single pointer doc makes "switch the reference" a one-write atomic
// operation and aligns with the firestore.rules guard which would
// otherwise have to permit two writes per re-point.

import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";

const APP_CONFIG_COLLECTION = "appConfig";
const CURRENT_DOC_ID = "current";

export type ReferenceScenarioDoc = {
  referenceScenarioId: string | null;
  updatedAt: number;
  updatedBy: string;
};

/**
 * One-time read of the reference scenario id. Returns null if the doc
 * doesn't exist yet (no reference has ever been set) or if Firestore
 * is unreachable / SSR (db is null).
 *
 * Errors are swallowed and logged — callers should never block UI on
 * this lookup. The caller is expected to fall back to local-only state
 * if this returns null.
 */
export async function getReferenceScenarioId(
  db: Firestore | null,
): Promise<string | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, APP_CONFIG_COLLECTION, CURRENT_DOC_ID));
    if (!snap.exists()) return null;
    const data = snap.data() as Partial<ReferenceScenarioDoc>;
    const id = data.referenceScenarioId;
    return typeof id === "string" ? id : null;
  } catch (err) {
    console.warn("[referenceScenario] read failed", err);
    return null;
  }
}

/**
 * Live subscription to the reference scenario id. Fires immediately
 * with the current value, then again on every server-side change.
 * Returns an unsubscribe function — call it on unmount.
 *
 * If db is null (SSR / Firebase init failed), returns a no-op
 * unsubscribe so callers can wire it into useEffect without a null
 * check at the cleanup site.
 */
export function subscribeReferenceScenarioId(
  db: Firestore | null,
  callback: (id: string | null) => void,
): Unsubscribe {
  if (!db) return () => {};
  try {
    return onSnapshot(
      doc(db, APP_CONFIG_COLLECTION, CURRENT_DOC_ID),
      (snap) => {
        if (!snap.exists()) {
          callback(null);
          return;
        }
        const data = snap.data() as Partial<ReferenceScenarioDoc>;
        const id = data.referenceScenarioId;
        callback(typeof id === "string" ? id : null);
      },
      (err) => {
        console.warn("[referenceScenario] subscription failed", err);
      },
    );
  } catch (err) {
    console.warn("[referenceScenario] subscribe init failed", err);
    return () => {};
  }
}

/**
 * Set (or clear) the reference scenario. Admin-only at the rules layer
 * — a non-admin will see a permission-denied error here. The caller
 * passes the writer's uid so the audit trail (updatedBy) reflects who
 * made the change.
 *
 * Throws a clear error if the write is denied or Firestore is
 * unreachable. Callers should catch and surface to the user via the
 * existing requestAlert flow.
 */
export async function setReferenceScenarioId(
  db: Firestore | null,
  scenarioId: string | null,
  uid: string,
): Promise<void> {
  if (!db) {
    throw new Error(
      "Firestore is not available. Reference scenario was not updated.",
    );
  }
  const payload: ReferenceScenarioDoc = {
    referenceScenarioId: scenarioId,
    updatedAt: Date.now(),
    updatedBy: uid,
  };
  try {
    await setDoc(doc(db, APP_CONFIG_COLLECTION, CURRENT_DOC_ID), payload);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown Firestore error.";
    throw new Error(
      `Failed to update the reference scenario: ${message}. ` +
        `This requires admin permissions — check that you are signed in as an admin.`,
    );
  }
}

/**
 * Convenience wrapper for unsetting the reference scenario. Equivalent
 * to setReferenceScenarioId(db, null, uid) but reads more clearly at
 * the call site.
 */
export async function clearReferenceScenarioId(
  db: Firestore | null,
  uid: string,
): Promise<void> {
  return setReferenceScenarioId(db, null, uid);
}
