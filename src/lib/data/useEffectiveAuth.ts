// View-As / impersonation wrapper around useAuth().
//
// Why this exists: Eytan (admin) wants to preview what a banker, viewer,
// or editor sees WITHOUT signing out and losing his session. The override
// is a UI-only construct — the user's real Firebase token is unchanged,
// so Firestore reads/writes still resolve against their actual role.
//
// Contract:
//   - Returns the exact same shape as useAuth() (so consumers can swap
//     in place) PLUS extra impersonation fields.
//   - When impersonating, `role` / `isAdmin` / `canEdit` / `canView` are
//     OVERRIDDEN to the impersonated role's flags. `user` stays the real
//     Firebase user so data fetches still work.
//   - Only `actualRole === 'admin'` can flip the impersonation switch.
//     A non-admin who manually writes to localStorage gets their flag
//     ignored (`canImpersonate === false` ⇒ no override applied).
//
// Persistence: localStorage key `villa-lev-viewAs`. Value is one of the
// strings 'banker' | 'viewer' | 'editor', or absent for "no override".
// We listen to both same-window updates (via a custom event) and cross-
// window updates (via the native `storage` event) so multiple tabs stay
// in sync.
//
// SSR: localStorage is window-scoped. We initialise impersonation to null
// on the server and let it hydrate on the client. This is fine — the
// banner / View-As widget render `null` until both this hook and the
// underlying useAuth() have finished loading.

"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useAuth, type AuthResult } from "@/lib/data/useAuth";
import type { Role } from "@/lib/data/userProfile";

export type ImpersonationTarget = "banker" | "viewer" | "editor";
export type EffectiveRole = Role | "banker";

const STORAGE_KEY = "villa-lev-viewAs";
const SAME_WINDOW_EVENT = "villa-lev-viewAs-change";

const VALID_TARGETS: readonly ImpersonationTarget[] = [
  "banker",
  "viewer",
  "editor",
] as const;

function isValidTarget(v: unknown): v is ImpersonationTarget {
  return typeof v === "string" && (VALID_TARGETS as readonly string[]).includes(v);
}

// Read the persisted target. Returns null on SSR or if the value is
// missing / malformed.
function readStored(): ImpersonationTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isValidTarget(raw) ? raw : null;
  } catch {
    // Private mode / disabled storage — fail closed.
    return null;
  }
}

// External-store wiring for useSyncExternalStore. We cache the snapshot
// so the getter returns a stable reference between events (React 18+
// bails out of a render when the snapshot is referentially equal —
// otherwise we'd thrash on every store read).
let cachedSnapshot: ImpersonationTarget | null = null;
let snapshotInitialised = false;

function refreshSnapshot(): void {
  cachedSnapshot = readStored();
  snapshotInitialised = true;
}

function getSnapshot(): ImpersonationTarget | null {
  if (!snapshotInitialised) refreshSnapshot();
  return cachedSnapshot;
}

function getServerSnapshot(): ImpersonationTarget | null {
  return null;
}

function subscribeStore(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    refreshSnapshot();
    listener();
  };
  const onSameWindow = () => {
    refreshSnapshot();
    listener();
  };
  // Refresh once on subscribe so a remount picks up any value that was
  // written while no consumers were mounted.
  refreshSnapshot();
  window.addEventListener("storage", onStorage);
  window.addEventListener(SAME_WINDOW_EVENT, onSameWindow);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SAME_WINDOW_EVENT, onSameWindow);
  };
}

// Pure: compute the override values for a given target. Exported so it
// can be unit-tested without spinning up React. The 'banker' branch
// returns the unauthenticated-public-viewer profile.
export function impersonationOverrides(target: ImpersonationTarget): {
  role: Role | null;
  isAdmin: boolean;
  canEdit: boolean;
  canView: boolean;
} {
  switch (target) {
    case "banker":
      return { role: null, isAdmin: false, canEdit: false, canView: false };
    case "viewer":
      return { role: "viewer", isAdmin: false, canEdit: false, canView: true };
    case "editor":
      return { role: "editor", isAdmin: false, canEdit: true, canView: true };
  }
}

export type EffectiveAuthResult = AuthResult & {
  // The real Firestore-doc role (unmodified by impersonation).
  actualRole: Role | null;
  // The role being rendered. 'banker' is the synthetic unauthenticated
  // role — distinct from `null` (still loading / no auth).
  effectiveRole: EffectiveRole | null;
  // True iff the impersonation override is currently applied (i.e. an
  // admin clicked a View-As option and we are honouring it).
  isImpersonating: boolean;
  // True iff the caller is allowed to use View-As. Locks the feature to
  // actual admins so a viewer can't escalate via devtools localStorage.
  canImpersonate: boolean;
  // Writes the target to localStorage and broadcasts a same-window event
  // so every consumer re-renders. Pass null to clear.
  // No-op if the caller is not allowed to impersonate (defence-in-depth).
  setImpersonation: (target: ImpersonationTarget | null) => void;
};

export function useEffectiveAuth(): EffectiveAuthResult {
  const base = useAuth();

  // External-store pattern (mirrors useAuth's own useSyncExternalStore).
  // - Same-window writes dispatch SAME_WINDOW_EVENT.
  // - Cross-window writes fire the native `storage` event.
  // - SSR returns null (no localStorage).
  const target = useSyncExternalStore(
    subscribeStore,
    getSnapshot,
    getServerSnapshot,
  );

  const actualRole = base.role;
  const canImpersonate = actualRole === "admin";

  const setImpersonation = useCallback(
    (next: ImpersonationTarget | null) => {
      // Defence-in-depth: silently no-op for non-admins. The widget is
      // also hidden from non-admins, but this protects against direct
      // hook usage (e.g. someone calling setImpersonation from devtools).
      if (!canImpersonate) return;
      if (typeof window === "undefined") return;
      try {
        if (next === null) {
          window.localStorage.removeItem(STORAGE_KEY);
        } else if (isValidTarget(next)) {
          window.localStorage.setItem(STORAGE_KEY, next);
        } else {
          return;
        }
        // Refresh the cached snapshot synchronously so the dispatched
        // event's listeners see the new value when they read getSnapshot.
        refreshSnapshot();
        window.dispatchEvent(new CustomEvent(SAME_WINDOW_EVENT));
      } catch {
        // Private mode — ignore. The widget will reflect that the click
        // had no effect by virtue of `target` not changing.
      }
    },
    [canImpersonate],
  );

  // Only honour the stored target if the caller is actually allowed to
  // impersonate. A viewer who wrote to localStorage manually sees no
  // effect — the impersonation flag stays false and no override applies.
  const activeTarget: ImpersonationTarget | null =
    canImpersonate && target ? target : null;
  const isImpersonating = activeTarget !== null;

  if (!isImpersonating) {
    // No override — return the base auth result, decorated with the
    // impersonation-tracking fields.
    return {
      ...base,
      actualRole,
      effectiveRole: actualRole,
      isImpersonating: false,
      canImpersonate,
      setImpersonation,
    };
  }

  const overrides = impersonationOverrides(activeTarget);
  const effectiveRole: EffectiveRole | null =
    activeTarget === "banker" ? "banker" : overrides.role;

  return {
    // Pass through user / loading / profile / signIn / signOut /
    // profileMissing untouched — only the role-derived flags change.
    user: base.user,
    profile: base.profile,
    loading: base.loading,
    profileMissing: base.profileMissing,
    signIn: base.signIn,
    signOut: base.signOut,
    // Overridden by impersonation:
    role: overrides.role,
    isAdmin: overrides.isAdmin,
    canEdit: overrides.canEdit,
    canView: overrides.canView,
    // Impersonation-tracking fields:
    actualRole,
    effectiveRole,
    isImpersonating: true,
    canImpersonate,
    setImpersonation,
  };
}
