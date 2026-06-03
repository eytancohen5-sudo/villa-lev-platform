// User-profile types and helpers for the role-based access model.
//
// Schema (Firestore):
//   users/{uid}     — one doc per signed-in human, holds role + metadata.
//   invites/{email} — pending invites, doc id = lowercased email.
//
// All emails (both as doc ids and as field values) are routed through
// `normalizeEmail()` so a sign-in with Mixed-Case@Foo.com claims an invite
// addressed to mixed-case@foo.com. Without this round-trip we'd lock users
// out the moment Google returns a slightly different case than the invite.
//
// Why client-side claimInvite (no Cloud Function): static export, no server
// runtime. The atomicity guarantee comes from a Firestore WriteBatch that
// pairs `users/{uid}` create with `invites/{email}` delete. Either both land
// or neither does — see `claimInvite` below.

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  type Firestore,
  type FieldValue,
} from "firebase/firestore";
import type { User } from "firebase/auth";
// USERS_COLLECTION and INVITES_COLLECTION are canonical in @/lib/firebase.
// They are re-exported here so callers that import from userProfile.ts
// continue to resolve them without change.
export { USERS_COLLECTION, INVITES_COLLECTION } from "@/lib/firebase";
import { USERS_COLLECTION, INVITES_COLLECTION } from "@/lib/firebase";

export type Role = "admin" | "editor" | "viewer";

export const ROLES: readonly Role[] = ["admin", "editor", "viewer"] as const;

export type UserStatus = 'pending' | 'approved';

export function isStatus(s: unknown): s is UserStatus {
  return s === 'pending' || s === 'approved';
}

export type UserProfile = {
  uid: string;
  email: string; // always lower-cased — see normalizeEmail()
  displayName: string | null;
  role: Role;
  createdAt: number; // ms epoch
  invitedBy: string | null; // uid of inviter, null for bootstrap admin
  lastSignInAt: number | null; // ms epoch
  // Approval gate (optional — legacy users with no status field are treated
  // as 'approved' everywhere; only explicit 'pending' blocks access).
  status?: UserStatus;
  approvedBy?: string | null;
  approvedAt?: number | null;
  revokedBy?: string | null;
  revokedAt?: number | null;
};

export type Invite = {
  email: string; // lower-cased, matches the doc id
  role: Role;
  invitedBy: string; // inviter uid
  invitedAt: number; // ms epoch
  note: string | null;
};

// Normalise an email for use both as a Firestore doc id and as the
// `email` field on user/invite docs. Trims whitespace and lower-cases.
// Returns "" for null/undefined so callers can short-circuit on falsy.
export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

// True iff `r` is one of the canonical roles. Defensive: any value coming
// out of Firestore goes through this before we trust it.
export function isRole(r: unknown): r is Role {
  return r === "admin" || r === "editor" || r === "viewer";
}

// Role partial-order. `roleAtLeast('viewer', 'admin')` is false;
// `roleAtLeast('admin', 'viewer')` is true.
const ROLE_RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };
export function roleAtLeast(role: Role | null | undefined, min: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

// Result of `claimInvite`:
//   - 'created'   : new users/{uid} doc was written from a matching invite,
//                   invite was deleted in the same batch.
//   - 'existing'  : users/{uid} already exists — sign-in is just refreshing
//                   `lastSignInAt`; caller may stamp that separately.
//   - 'not-invited': neither an existing user doc nor an invite was found.
//                   Caller MUST sign the user back out unless `isLegacyAdmin`
//                   covers them.
export type ClaimResult =
  | { kind: "created"; profile: UserProfile }
  | { kind: "existing"; profile: UserProfile }
  | { kind: "not-invited" };

// claimInvite — runtime onboarding step.
//
// 1. Look up users/{uid}. If present, we're done (idempotent re-sign-in).
// 2. Look up invites/{lowercased(email)}. If missing → not-invited.
// 3. Batch: create users/{uid} from invite + delete invites/{email}.
//
// The batch makes the create+delete atomic at Firestore's level. If two
// parallel sign-ins race for the same invite (rare — only matters if Eytan
// resends an invite while the user is signing in), the second batch fails
// because the users doc now exists; rules also re-check the invite at write
// time. Either way no orphaned state.
export async function claimInvite(
  authUser: User,
  db: Firestore,
): Promise<ClaimResult> {
  const uid = authUser.uid;
  const email = normalizeEmail(authUser.email);
  if (!email) {
    // Anonymous / passwordless flows without an email can't claim. Should
    // never hit this path in the Google-only sign-in we ship today.
    return { kind: "not-invited" };
  }

  const userRef = doc(db, USERS_COLLECTION, uid);
  const existingSnap = await getDoc(userRef);
  if (existingSnap.exists()) {
    const data = existingSnap.data();
    if (!isRole(data.role)) {
      // Defensive: if a doc somehow has a corrupt role field, treat as
      // not-invited so the caller signs out rather than silently treating
      // them as viewer. Surfaces drift loudly.
      return { kind: "not-invited" };
    }
    const profile: UserProfile = {
      uid,
      email: normalizeEmail(data.email) || email,
      displayName: (data.displayName as string | null) ?? authUser.displayName,
      role: data.role,
      createdAt: typeof data.createdAt === "number" ? data.createdAt : Date.now(),
      invitedBy: (data.invitedBy as string | null) ?? null,
      lastSignInAt:
        typeof data.lastSignInAt === "number" ? data.lastSignInAt : null,
    };
    return { kind: "existing", profile };
  }

  const inviteRef = doc(db, INVITES_COLLECTION, email);
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) {
    return { kind: "not-invited" };
  }
  const inviteData = inviteSnap.data();
  if (!isRole(inviteData.role)) {
    // Corrupt invite — refuse to claim so we don't write a corrupt user doc.
    return { kind: "not-invited" };
  }

  const now = Date.now();
  const newProfile: UserProfile & { createdAt: number | FieldValue } = {
    uid,
    email,
    displayName: authUser.displayName ?? null,
    role: inviteData.role,
    createdAt: now,
    invitedBy: (inviteData.invitedBy as string | null) ?? null,
    lastSignInAt: now,
  };

  const batch = writeBatch(db);
  // Strip the FieldValue widening for the actual write — we use the numeric
  // `now` so it round-trips identically on read.
  batch.set(userRef, {
    uid,
    email,
    displayName: newProfile.displayName,
    role: newProfile.role,
    createdAt: now,
    invitedBy: newProfile.invitedBy,
    lastSignInAt: now,
  });
  batch.delete(inviteRef);
  await batch.commit();

  return { kind: "created", profile: { ...newProfile, createdAt: now } };
}

// selfRegister — creates a pending users/{uid} doc for a user who signed in
// without a matching invite. The doc shares the same field layout as the
// claimInvite create path so both code paths produce identical schemas.
//
// Returns:
//   { kind: 'created' }   — new pending doc written.
//   { kind: 'existing', status } — users/{uid} already existed; caller can
//                                  decide whether to surface the current status.
export async function selfRegister(
  authUser: User,
  db: Firestore,
): Promise<{ kind: 'created' } | { kind: 'existing'; status: UserStatus | undefined }> {
  const uid = authUser.uid;
  const email = normalizeEmail(authUser.email);
  const userRef = doc(db, USERS_COLLECTION, uid);
  const existingSnap = await getDoc(userRef);
  if (existingSnap.exists()) {
    const data = existingSnap.data();
    const status = isStatus(data.status) ? data.status : undefined;
    return { kind: 'existing', status };
  }
  const now = Date.now();
  await setDoc(userRef, {
    uid,
    email,
    displayName: authUser.displayName ?? null,
    role: 'viewer' as Role,
    createdAt: now,
    invitedBy: null,
    lastSignInAt: now,
    status: 'pending' as UserStatus,
  });
  return { kind: 'created' };
}

// approveUser — sets status:'approved' on a pending user doc (admin action).
// Uses updateDoc (partial update) — does NOT touch role, email, or any other field.
export async function approveUser(
  adminUid: string,
  targetUid: string,
  db: Firestore,
): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, targetUid);
  await updateDoc(userRef, {
    status: 'approved' as UserStatus,
    approvedBy: adminUid,
    approvedAt: Date.now(),
  });
}

// revokeUser — sets status:'pending' on an approved user doc (admin action).
// Uses updateDoc (partial update). The revoked user's live onSnapshot causes
// AuthGate to show the pending screen within seconds. Firebase client SDK
// cannot sign out another user's session — do NOT attempt fbSignOut here.
export async function revokeUser(
  adminUid: string,
  targetUid: string,
  db: Firestore,
): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, targetUid);
  await updateDoc(userRef, {
    status: 'pending' as UserStatus,
    revokedBy: adminUid,
    revokedAt: Date.now(),
  });
}

// denyUser — deletes a pending (never-approved) user doc outright.
// Used when Eytan clicks "Deny" on a self-registered user who has never
// been approved. Different from revokeUser (which demotes approved→pending).
export async function denyUser(
  targetUid: string,
  db: Firestore,
): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, targetUid);
  await deleteDoc(userRef);
}

// serverTimestamp re-export so callers can use it for `lastSignInAt` self-
// updates without re-importing from firebase/firestore (centralises the
// firebase dependency surface).
export { serverTimestamp };
