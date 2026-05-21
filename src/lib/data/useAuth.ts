// Auth + RBAC hook. Wraps Firebase Auth with a single module-level subscription
// so every component reading `user` / `role` shares the same listeners (one
// onAuthStateChanged + one users/{uid} onSnapshot, fanned out via
// useSyncExternalStore — same pattern as useSeasonSnapshot).
//
// Scope: read-only pages (investor, pitch, dashboard) do NOT consume this
// hook — they stay public. The save-scenario UI on /admin/assumptions and
// every other gated /admin/* page reads `canEdit` / `canView` / `isAdmin`
// from here.
//
// Loading-gate contract (BLOCKER #6, plan-challenger SHOULD-FIX #7):
//   `loading` stays TRUE until BOTH the auth state AND the user-doc snapshot
//   have fired for the current user. The only exception is `user === null`,
//   where there's nothing to fetch and `loading` flips false immediately.
//   This prevents a freshly-signed-in viewer from seeing the Save button
//   flash visible-then-hidden while the role resolves.
//
// Legacy fallback (Step 8 deferred — do NOT remove until a soak week):
//   `ADMIN_EMAILS` / `isAdminEmail()` in firebase.ts and the corresponding
//   `isLegacyAdmin()` predicate in firestore.rules are KEPT ALIVE. If the
//   users/{uid} snapshot fails for any transient reason and the signed-in
//   email is on the legacy list, the hook synthesises role='admin' so
//   Eytan can't be locked out by a momentary Firestore hiccup. Plan to
//   remove this in a separate pass after one full week of clean operation.

"use client";

import { useSyncExternalStore } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getAuthInstance, getDb, isAdminEmail, USERS_COLLECTION } from "@/lib/firebase";
import {
  claimInvite,
  isRole,
  normalizeEmail,
  type Role,
  type UserProfile,
} from "@/lib/data/userProfile";

export type AuthResult = {
  user: User | null;
  role: Role | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  canEdit: boolean;
  canView: boolean;
  loading: boolean;
  // True iff there's an authenticated user but no users/{uid} doc and no
  // legacy fallback match. UI surface: "You're signed in but not invited —
  // ask Eytan for access." Distinct from `loading` (still resolving) and
  // from `user === null` (signed out).
  profileMissing: boolean;
  // signIn / signOut throw on failure (popup blocked, network) so callers
  // can surface the error in their existing alert flow.
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

type Listener = () => void;

// State shape:
//   user        — Firebase auth user or null (signed out).
//                 `undefined` would mean "auth state has not fired yet" but
//                 we collapse that to `null` + loading=true.
//   profile     — users/{uid} doc snapshot. `undefined` = snapshot pending;
//                 `null` = known missing (no doc found AND no legacy match).
//   authReady   — has the auth subscription fired at least once.
//   profileReady — has the profile subscription fired at least once for the
//                 CURRENT uid (resets to false on uid change).
type State = {
  user: User | null;
  profile: UserProfile | null | undefined;
  authReady: boolean;
  profileReady: boolean;
};

const INITIAL_STATE: State = Object.freeze({
  user: null,
  profile: undefined,
  authReady: false,
  profileReady: false,
});
const SERVER_STATE: State = Object.freeze({
  user: null,
  profile: null,
  authReady: true,
  profileReady: true,
});

let current: State = INITIAL_STATE;
const listeners = new Set<Listener>();
let unsubAuth: Unsubscribe | null = null;
let unsubProfile: Unsubscribe | null = null;
let currentProfileUid: string | null = null;
let subscribeCount = 0;

function emit(next: State) {
  current = next;
  for (const listener of listeners) listener();
}

// Synthesise an admin profile for a legacy-allow-list email so a transient
// users/{uid} read failure can't lock Eytan out. See Step 8 of the RBAC
// plan — this branch goes away once the legacy fallback is retired.
function legacyAdminProfile(user: User): UserProfile | null {
  if (!isAdminEmail(user.email)) return null;
  const email = normalizeEmail(user.email);
  return {
    uid: user.uid,
    email,
    displayName: user.displayName ?? null,
    role: "admin",
    createdAt: 0,
    invitedBy: null,
    lastSignInAt: null,
  };
}

function stopProfile() {
  if (unsubProfile) {
    unsubProfile();
    unsubProfile = null;
  }
  currentProfileUid = null;
}

function startProfile(user: User) {
  const db = getDb();
  if (!db) {
    // SSR / Firebase down — treat as legacy-fallback only.
    const fallback = legacyAdminProfile(user);
    emit({
      user,
      profile: fallback ?? null,
      authReady: true,
      profileReady: true,
    });
    return;
  }
  currentProfileUid = user.uid;
  const ref = doc(db, USERS_COLLECTION, user.uid);
  unsubProfile = onSnapshot(
    ref,
    (snap) => {
      // Guard against stale callbacks after a uid change (sign-out + sign-in
      // as a different user) — only accept this snapshot if it still matches
      // the uid we last started a subscription for.
      if (currentProfileUid !== user.uid) return;
      if (!snap.exists()) {
        // No users doc. Fall back to legacy admin if email is on the list,
        // otherwise surface as profileMissing.
        const fallback = legacyAdminProfile(user);
        emit({
          ...current,
          user,
          profile: fallback ?? null,
          authReady: true,
          profileReady: true,
        });
        return;
      }
      const data = snap.data();
      if (!isRole(data.role)) {
        // Corrupt role field — same handling as missing. The legacy fallback
        // covers Eytan; everyone else gets profileMissing UI.
        const fallback = legacyAdminProfile(user);
        emit({
          ...current,
          user,
          profile: fallback ?? null,
          authReady: true,
          profileReady: true,
        });
        return;
      }
      const profile: UserProfile = {
        uid: user.uid,
        email: normalizeEmail(data.email) || normalizeEmail(user.email),
        displayName: (data.displayName as string | null) ?? user.displayName,
        role: data.role,
        createdAt:
          typeof data.createdAt === "number" ? data.createdAt : Date.now(),
        invitedBy: (data.invitedBy as string | null) ?? null,
        lastSignInAt:
          typeof data.lastSignInAt === "number" ? data.lastSignInAt : null,
      };
      emit({
        ...current,
        user,
        profile,
        authReady: true,
        profileReady: true,
      });
    },
    (err) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[useAuth] users/{uid} onSnapshot error — falling back:",
          err?.message ?? err,
        );
      }
      // On error fall back to legacy admin if applicable; mark profileReady
      // so we don't pin `loading` forever on a permanent rules failure.
      const fallback = legacyAdminProfile(user);
      emit({
        ...current,
        user,
        profile: fallback ?? null,
        authReady: true,
        profileReady: true,
      });
    },
  );
}

function startAuth() {
  const auth = getAuthInstance();
  if (!auth) {
    // SSR / Firebase not wired — match SERVER_STATE so client mount is a
    // no-op when there's no auth backend to talk to.
    emit({ ...SERVER_STATE });
    return;
  }
  unsubAuth = onAuthStateChanged(
    auth,
    (firebaseUser) => {
      if (!firebaseUser) {
        stopProfile();
        emit({
          user: null,
          profile: null,
          authReady: true,
          profileReady: true,
        });
        return;
      }
      // Auth fired with a user — start the profile subscription (or restart
      // if the uid changed). Profile is `undefined` (pending) until the
      // snapshot lands, which is what gates `loading` to true.
      if (currentProfileUid !== firebaseUser.uid) {
        stopProfile();
        emit({
          user: firebaseUser,
          profile: undefined,
          authReady: true,
          profileReady: false,
        });
        startProfile(firebaseUser);
      } else {
        // Same uid, second auth callback (token refresh etc.) — just bump
        // the user reference without disturbing the profile snapshot.
        emit({
          ...current,
          user: firebaseUser,
          authReady: true,
        });
      }
    },
    (err) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[useAuth] onAuthStateChanged error:", err?.message ?? err);
      }
      stopProfile();
      emit({
        user: null,
        profile: null,
        authReady: true,
        profileReady: true,
      });
    },
  );
}

function stopAuth() {
  if (unsubAuth) {
    unsubAuth();
    unsubAuth = null;
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  subscribeCount += 1;
  if (subscribeCount === 1) startAuth();
  return () => {
    listeners.delete(listener);
    subscribeCount -= 1;
    if (subscribeCount === 0) {
      stopProfile();
      stopAuth();
      current = INITIAL_STATE;
    }
  };
}

function getSnapshot(): State {
  return current;
}

function getServerSnapshot(): State {
  return SERVER_STATE;
}

async function doSignIn(): Promise<void> {
  const auth = getAuthInstance();
  if (!auth) throw new Error("Auth not available (SSR or Firebase not initialised)");
  const db = getDb();
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);

  // First attempt: claim an invite if one is pending. This converts an
  // invites/{email} doc into a users/{uid} doc atomically. If the user
  // already has a users doc, claimInvite returns 'existing' as a no-op.
  if (db) {
    try {
      const result = await claimInvite(cred.user, db);
      if (result.kind === "not-invited") {
        // No users doc AND no invite. Allow if legacy admin, else sign back
        // out with a clear error.
        if (!isAdminEmail(cred.user.email)) {
          await fbSignOut(auth);
          throw new Error(
            `${cred.user.email ?? "This account"} is not invited. Ask Eytan to send you an invite from /admin/team.`,
          );
        }
        // Legacy admin: useAuth will synthesise an admin profile via the
        // legacyAdminProfile() branch in startProfile().
      }
    } catch (err) {
      // Re-throw "not invited" cleanly; for any other unexpected error
      // during claimInvite we keep the user signed in if they're a legacy
      // admin (Eytan), otherwise sign them out so they don't sit in a
      // broken half-onboarded state.
      const msg = (err as Error)?.message ?? "";
      if (msg.includes("is not invited")) throw err;
      if (!isAdminEmail(cred.user.email)) {
        await fbSignOut(auth);
        throw new Error(
          `Sign-in succeeded but onboarding failed: ${msg || "unknown error"}. Try again or ask Eytan.`,
        );
      }
    }
  }
}

async function doSignOut(): Promise<void> {
  const auth = getAuthInstance();
  if (!auth) return;
  await fbSignOut(auth);
}

export function useAuth(): AuthResult {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Loading gate: true until BOTH auth and profile have fired (or user is
  // known-null, in which case there's no profile to fetch).
  const loading =
    !state.authReady ||
    (state.user !== null && !state.profileReady);

  const role: Role | null = state.profile ? state.profile.role : null;
  const isAdmin = role === "admin";
  const canEdit = isAdmin || role === "editor";
  const canView = canEdit || role === "viewer";

  // profileMissing: auth resolved, user signed in, no profile (and no
  // legacy fallback). Distinct from `loading` and from `!user`.
  const profileMissing =
    state.authReady &&
    state.user !== null &&
    state.profileReady &&
    state.profile === null;

  return {
    user: state.user,
    role,
    profile: state.profile ?? null,
    isAdmin,
    canEdit,
    canView,
    loading,
    profileMissing,
    signIn: doSignIn,
    signOut: doSignOut,
  };
}
