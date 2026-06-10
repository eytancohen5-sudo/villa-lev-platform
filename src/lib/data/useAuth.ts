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
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  type Auth,
  type User,
  type Unsubscribe,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { getAuthInstance, getDb, isAdminEmail, USERS_COLLECTION } from "@/lib/firebase";
import {
  claimInvite,
  selfRegister,
  isRole,
  isStatus,
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
  // True iff the user is signed in, profile is loaded, and status is
  // explicitly 'pending'. Undefined/missing status is treated as 'approved'.
  // Only an explicit 'pending' value triggers the approval gate.
  statusPending: boolean;
  // signIn / signOut throw on failure (popup blocked, network) so callers
  // can surface the error in their existing alert flow.
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  doSignInEmail: (email: string, password: string) => Promise<void>;
  doSignUpEmail: (email: string, password: string, displayName?: string) => Promise<void>;
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
let profileTimeoutId: ReturnType<typeof setTimeout> | null = null;
let subscribeCount = 0;
// Incremented by stopAuth() so that any authStateReady() promise that was
// pending when the subscription was torn down will see a stale generation
// and skip wireAuthListener — prevents duplicate/leaked subscriptions.
let authGeneration = 0;

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
  if (profileTimeoutId !== null) {
    clearTimeout(profileTimeoutId);
    profileTimeoutId = null;
  }
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

  // Safety net: if onSnapshot stalls (Firestore connection issue, expired token
  // not yet refreshed, etc.), unblock authLoading after 5 s so the save row
  // renders. The snapshot may still arrive later and will update state normally.
  profileTimeoutId = setTimeout(() => {
    profileTimeoutId = null;
    if (currentProfileUid !== user.uid || current.profileReady) return;
    const fallback = legacyAdminProfile(user);
    emit({ ...current, user, profile: fallback ?? null, authReady: true, profileReady: true });
  }, 5000);

  unsubProfile = onSnapshot(
    ref,
    (snap) => {
      if (profileTimeoutId !== null) { clearTimeout(profileTimeoutId); profileTimeoutId = null; }
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
        // BLOCKER-1 fix: read status from Firestore so statusPending works.
        // isStatus() rejects any value other than 'pending' | 'approved'.
        // undefined means no status field — treated as 'approved' everywhere.
        status: isStatus(data.status) ? data.status : undefined,
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
      if (profileTimeoutId !== null) { clearTimeout(profileTimeoutId); profileTimeoutId = null; }
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

// The actual onAuthStateChanged wiring, extracted so it can be called either
// directly (fallback) or after auth.authStateReady() resolves (preferred).
function wireAuthListener(auth: Auth) {
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

function startAuth() {
  const auth = getAuthInstance();
  if (!auth) {
    // SSR / Firebase not wired — match SERVER_STATE so client mount is a
    // no-op when there's no auth backend to talk to.
    emit({ ...SERVER_STATE });
    return;
  }

  // auth.authStateReady() resolves once Firebase has read the initial auth
  // state from the persistence layer (localStorage / IndexedDB). Awaiting it
  // before subscribing to onAuthStateChanged prevents the null-then-user
  // double-fire that causes a redirect bounce on hard refresh:
  //
  //   Without this: Firebase fires onAuthStateChanged(null) immediately on
  //   startup (before IndexedDB read completes), AuthGate sees user=null and
  //   redirects to /admin/login, then Firebase fires again with the real user,
  //   login page sees user and redirects back — a hard-refresh bounce every
  //   single session.
  //
  //   With this: we block until Firebase has resolved persistence. The very
  //   first onAuthStateChanged fires with the correct final user state.
  const gen = ++authGeneration;
  const wire = () => {
    // If stopAuth() was called while authStateReady() was pending, the
    // generation will have advanced — bail out to avoid a leaked subscription.
    if (gen !== authGeneration) return;
    wireAuthListener(auth);
  };

  if (typeof (auth as { authStateReady?: unknown }).authStateReady === 'function') {
    (auth as { authStateReady: () => Promise<void> })
      .authStateReady()
      .then(wire)
      .catch(wire); // on error still subscribe — better than hanging forever
  } else {
    wire();
  }
}

function stopAuth() {
  authGeneration++; // invalidate any pending authStateReady promise
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

// SHOULD-FIX-1: Map raw Firebase error codes to a small safe set so we
// never leak user-enumeration signals (auth/user-not-found) or internal
// details to the DOM. The safe code is thrown as an Error message and the
// login page maps it to an i18n key before rendering.
function toSafeAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  if (
    code === 'auth/user-not-found' ||
    code === 'auth/wrong-password' ||
    code === 'auth/invalid-credential'
  ) {
    return 'auth/invalid-credentials';
  }
  if (code === 'auth/email-already-in-use') return 'auth/email-in-use';
  if (code === 'auth/too-many-requests') return 'auth/too-many-requests';
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  ) {
    return 'auth/cancelled';
  }
  if (code === 'auth/popup-blocked') return 'auth/popup-blocked';
  if (code === 'auth/unauthorized-domain') return 'auth/unauthorized-domain';
  return 'auth/unknown';
}

async function doSignIn(): Promise<void> {
  const auth = getAuthInstance();
  if (!auth) throw new Error("Auth not available (SSR or Firebase not initialised)");
  const provider = new GoogleAuthProvider();
  // Uses signInWithPopup with authDomain:'villa-lev-finance.web.app' so the
  // popup opens same-origin — no third-party storage partitioning issues.
  // Requires a genuine user-gesture click (browser popup policy).
  //
  // Note: signInWithRedirect is intentionally NOT used as a fallback.
  // Firebase SDK v12 stores the pending redirect state in a format the
  // Firebase Hosting /__/auth/handler uses a different version to read,
  // causing the handler to fail with "missing initial state". The result is
  // the user navigates away and back but is never signed in. If popup is
  // blocked for any reason, we surface auth/popup-blocked so the user can
  // allow popups and retry — far better than a silent broken redirect loop.
  let cred;
  try {
    cred = await signInWithPopup(auth, provider);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[useAuth.doSignIn] signInWithPopup failed:", err);
    }
    throw new Error(toSafeAuthError(err));
  }
  const db = getDb();
  if (db) {
    try {
      const result = await claimInvite(cred.user, db);
      if (result.kind === "not-invited") {
        if (!isAdminEmail(cred.user.email)) {
          await selfRegister(cred.user, db);
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn("[useAuth.doSignIn] invite/onboarding failed (non-fatal):", (err as Error)?.message ?? err);
      }
      // Non-fatal: Firebase auth succeeded but Firestore onboarding failed
      // (e.g. rules deny selfRegister for uninvited user). Leave the user
      // signed in — AuthGate will show profileMissing screen. Admin emails
      // are covered by legacyAdminProfile and never need a Firestore doc.
    }
  }
}

async function doSignOut(): Promise<void> {
  const auth = getAuthInstance();
  if (!auth) return;
  // Clear any active impersonation before signing out. Without this, the
  // ImpersonationBanner briefly shows stale isImpersonating=true after
  // signOut fires, and a user who clicks "Exit" in that window gets an
  // unintended route.
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem('villa-lev-viewAs');
      window.dispatchEvent(new CustomEvent('villa-lev-viewAs-change'));
    } catch { /* private mode — ignore */ }
  }
  await fbSignOut(auth);
}

async function doSignInEmail(email: string, password: string): Promise<void> {
  const auth = getAuthInstance();
  if (!auth) throw new Error("Auth not available (SSR or Firebase not initialised)");
  const db = getDb();
  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    throw new Error(toSafeAuthError(err));
  }
  if (db) {
    try {
      const result = await claimInvite(cred.user, db);
      if (result.kind === "not-invited") {
        if (!isAdminEmail(cred.user.email)) {
          // Self-register as pending — user stays signed in.
          await selfRegister(cred.user, db);
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn("[useAuth.doSignInEmail] invite/onboarding failed (non-fatal):", (err as Error)?.message ?? err);
      }
      // Non-fatal: same rationale as doSignIn — leave user signed in so
      // AuthGate can show profileMissing instead of cycling to login.
    }
  }
}

async function doSignUpEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<void> {
  const auth = getAuthInstance();
  if (!auth) throw new Error("Auth not available (SSR or Firebase not initialised)");
  const db = getDb();
  // Note: if this email is already registered under a different provider
  // (e.g. Google), Firebase creates a separate UID. Cross-provider linking
  // is out of scope; both accounts will appear separately in the approval
  // queue. The admin can deny the duplicate from /admin/team.
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password);
  } catch (err) {
    throw new Error(toSafeAuthError(err));
  }
  if (displayName) {
    try {
      await updateProfile(cred.user, { displayName });
    } catch {
      // Non-fatal — displayName is cosmetic; proceed with registration.
    }
  }
  if (db) {
    // Admin-email users skip selfRegister entirely — the legacy-admin fallback
    // in startProfile grants them access without a Firestore doc. Creating a
    // pending doc here would lock them in the approval queue until someone
    // (themselves) approves them, which is nonsensical.
    if (!isAdminEmail(cred.user.email)) {
      try {
        await selfRegister(cred.user, db);
      } catch (err) {
        const msg = (err as Error)?.message ?? "";
        // Non-fatal for the auth itself — the user is signed in; the
        // Firestore write will be retried when the onSnapshot fires.
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn("[useAuth.doSignUpEmail] selfRegister failed:", msg);
        }
      }
    }
  }
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

  // statusPending: signed in, profile loaded, and status is EXPLICITLY
  // 'pending'. undefined/missing status is treated as 'approved'.
  const statusPending =
    state.user !== null &&
    state.profileReady &&
    state.profile != null &&
    state.profile.status === 'pending';

  return {
    user: state.user,
    role,
    profile: state.profile ?? null,
    isAdmin,
    canEdit,
    canView,
    loading,
    profileMissing,
    statusPending,
    signIn: doSignIn,
    signOut: doSignOut,
    doSignInEmail,
    doSignUpEmail,
  };
}
