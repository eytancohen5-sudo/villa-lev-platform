# ADR 0002 — RBAC roles and users collection

**Status:** accepted
**Date:** 2026-05-21
**Decider:** Eytan (operator) — planner / plan-challenger / implementer trio
**Plan:** `villa-lev-platform/docs/rbac-plan-2026-05-21.md`
**Supersedes:** none. Implements the long-term resolution to
`docs/db-and-export-audit-2026-05-21.md` §A.2 #1, #3.

## Context

Before this change, write access to the finance model
(`villa-lev-platform`) was gated by a single hardcoded admin email
(`ADMIN_EMAILS = ['eytancohen5@gmail.com']` in `src/lib/firebase.ts`) and
the sibling `isAdmin()` rule in
`~/Desktop/Villa Lev Claude/villa-lev-admin/firestore.rules` keyed off the
same email. To bring on a co-founder, accountant, banker, or partner with
write access we'd had to hand-edit both source files and redeploy.

The DB audit already flagged this as the top open issue. We needed:

1. Multiple authenticated humans, each with a named role.
2. The role to be readable from the client (the UI hides write buttons
   for read-only users — `canEdit`) and enforceable server-side (Firestore
   rules deny the write at the source of truth).
3. The unauthenticated banker share-link path on `/investor`, `/pitch`,
   and any other read-only page to keep working.
4. No Cloud Functions, no API routes, no middleware (static export must
   keep building).

## Decision

Three roles, stored client-readably in a Firestore `users/{uid}` collection,
with a sibling `invites/{email}` collection for pending onboarding.

### Roles

| Role | Read admin pages | Write scenarios / assumptions | Manage team |
|---|---|---|---|
| `admin` | yes | yes | yes |
| `editor` | yes | yes | no |
| `viewer` | yes | no | no |
| *(unauthenticated)* | `/investor`, `/pitch`, `scenarios` reads only | no | no |

No fourth "banker" role — bankers consume share-link reads that are
already public; giving them an account adds management overhead with zero
gain.

### Schema

```
users/{uid}    — id == request.auth.uid; one doc per signed-in human.
  { uid, email (lower-cased), displayName, role, createdAt,
    invitedBy (uid|null), lastSignInAt }

invites/{email}  — id == lowercased(email); one doc per pending invite.
  { email, role, invitedBy (uid), invitedAt, note }
```

### Onboarding (no Cloud Function)

`src/lib/data/userProfile.ts:claimInvite()` runs inside the client after
`signInWithPopup`. Sequence:

1. Look up `users/{uid}` — if present, return existing (idempotent).
2. Look up `invites/{lowercased(email)}` — if missing, sign out with
   "not invited".
3. Atomic Firestore batch: create `users/{uid}` from the invite fields +
   delete `invites/{email}`.

Email is normalised to lower-case at every boundary (`normalizeEmail`),
so an invite to `foo@bar.com` is claimable by a sign-in as
`Foo@Bar.com`.

### Rules (admin repo is source of truth)

New helpers in `firestore.rules`:

- `isLegacyAdmin()` — the old email-based gate, **kept alive** as a
  transitional safety net.
- `userExists()`, `userDoc()`, `hasRole(role)` — doc-based role lookup.
- `isAdmin()` = `hasRole('admin') || isLegacyAdmin()`.
- `canEdit()` = `hasRole('admin') || hasRole('editor') || isLegacyAdmin()`.
- `canView()` = `canEdit() || hasRole('viewer')`.
- `isValidRoleWrite()` = `request.resource.data.role in ['admin','editor','viewer']`.
  **Required on every users/invites write** (BLOCKER #1 — without it a
  typo `role: 'owner'` would lock the user out the moment we retire the
  legacy fallback).
- `isLastSignInOnly()` = `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lastSignInAt'])`.
  **Required on the self-update carve-out** (BLOCKER #2 — without it a
  viewer could self-elevate to admin).

New collection blocks: `users/{uid}` and `invites/{inviteId}`. Existing
`scenarios/{scenarioId}` write predicate switched from
`request.auth != null` to `canEdit()` plus the shape validation.

### Loading-gate contract on `useAuth`

`loading` stays `true` until **both** the auth state and the user-doc
snapshot have fired (or the user is known-null). This prevents a freshly-
signed-in viewer from briefly seeing the save UI before the role
resolves and hides it. See `useAuth.ts` for the state machine.

### Custom claims rejected

The natural alternative — storing the role in a Firebase custom claim —
was rejected because setting a custom claim requires the Firebase Admin
SDK, which only runs server-side (Cloud Function or another runtime).
Both violate the "no Cloud Functions / no runtime" constraint. The cost
is one extra `onSnapshot` per session, which Firestore bills as one
document read; at single-digit saves per hour the cost is negligible.

## Consequences

### Positive

- Adding a teammate is a click in `/admin/team`, not a code change.
- Server-side enforcement: a `viewer` who tampers with their `users/{uid}`
  doc to set `role: 'admin'` is rejected by the `isLastSignInOnly()`
  whitelist.
- Banker share-link reads are unaffected — `scenarios.read` and
  `seasonSnapshots.read` are still `if true`.
- Static export is unchanged; no new runtime.

### Negative / risks

- Every scenarios write now does one `get(users/{uid})` inside the rule
  eval. Firestore bills it as one extra doc read per write. At current
  write volume (single-digit per hour) this is invisible; if/when we go
  to high-frequency writes the cost may matter.
- The `users/{uid}` `onSnapshot` is one more thing that can fail. The
  legacy-admin fallback in `useAuth.ts` covers Eytan during a transient
  fetch failure; non-legacy users see "profile failed — try again".

### Deferred (Step 8 — separate pass after a soak week)

- Remove `isLegacyAdmin()` from rules.
- Remove `ADMIN_EMAILS` / `isAdminEmail()` from `src/lib/firebase.ts`.
- Remove the legacy synthesis branch in `useAuth.ts`.

This MUST NOT ship in the same window as the initial RBAC rollout — if
Eytan's `users/{uid}` doc has a transient `onSnapshot` failure on next
morning sign-in with no legacy fallback, he gets locked out of his own
finance model. Soak for one full week with the fallback live, then
remove in a focused commit. Plan-challenger BLOCKER #3.

### Deferred — admin/team UI

The MVP `/admin/team` page ships with:
- Invite form (writes `invites/{lowercased-email}` with a chosen role).
- Read-only list of `users/*`.

Deferred:
- Per-row role edit (use Firebase Console in the interim).
- Per-row remove (same).
- Pending-invites list display.

### Deferred — emulator-based rules tests

The canonical Firestore rules test path is
`@firebase/rules-unit-testing` which spins up the Firestore emulator
(requires Java). The build host doesn't have a JRE; rather than block
the ship on installing one we use:

- Pure-TS unit tests on `userProfile.ts` helpers + `claimInvite` against
  an in-memory Firestore mock.
- A structural/lexical rules-text test that asserts the BLOCKER guards
  (`isValidRoleWrite`, `isLastSignInOnly`, the legacy-fallback union,
  the `canEdit()` gate on scenarios writes) are present in the rules
  file.

Follow-up work: install a JRE on the build host and add an emulator-
backed suite under `~/Desktop/Villa Lev Claude/villa-lev-admin/tests/`.

## Rollback

If anything goes wrong after the rules deploy:

```
cd ~/Desktop/Villa\ Lev\ Claude/villa-lev-admin
# Replace the rules file with the pre-edit backup taken automatically
# by the implementer (see .claude/logs/rbac-rollback-*.rules in the
# project workspace):
cp "/Users/esmacbookprom2/Desktop/Villa Project Saint George Claude/.claude/logs/rbac-rollback-<TIMESTAMP>.rules" firestore.rules
firebase deploy --only firestore:rules --project villa-lev-admin
```

Or, if the change is already committed:

```
cd ~/Desktop/Villa\ Lev\ Claude/villa-lev-admin
git revert <rbac-commit-sha>
firebase deploy --only firestore:rules --project villa-lev-admin
```

Either path restores the pre-RBAC state in under five minutes.
