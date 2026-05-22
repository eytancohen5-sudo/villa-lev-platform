// Team management — MVP for tonight's RBAC ship.
//
// Scope (per plan-challenger NICE-TO-HAVE #9 + task constraint #8):
//   - Invite form: writes invites/{lowercased-email} with chosen role.
//   - Read-only list of existing users/{*} so Eytan can see who's onboarded.
//
// Deferred to a follow-up pass:
//   - Per-row role edit. Eytan uses the Firebase Console for tonight.
//   - Per-row remove. Same.
//   - Pending-invites list. Easy to add later — the data is already there.
//
// Gating:
//   - The whole page is admin-only. `canView` would over-share (editors and
//     viewers don't need to see the roster).
//   - Loading state holds the gate until BOTH auth and profile have fired
//     (see useAuth.ts loading-gate contract — BLOCKER #6).

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import {
  getDb,
  USERS_COLLECTION,
  INVITES_COLLECTION,
} from "@/lib/firebase";
import { useEffectiveAuth } from "@/lib/data/useEffectiveAuth";
import {
  normalizeEmail,
  type Role,
  type UserProfile,
  ROLES,
} from "@/lib/data/userProfile";
import { PageTour, TourButton, usePageTour } from "@/components/PageTour";
import { TEAM_TOUR } from "@/lib/tours/configs";

function RoleBadge({ role }: { role: Role }) {
  const cls =
    role === "admin"
      ? "bg-brand-700 text-white"
      : role === "editor"
        ? "bg-brand-100 text-brand-700"
        : "bg-surface-tertiary text-text-secondary";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${cls}`}
    >
      {role}
    </span>
  );
}

function formatDate(ms: number | null): string {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleDateString();
  } catch {
    return "—";
  }
}

type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; email: string }
  | { kind: "error"; message: string };

export default function TeamPage() {
  // Impersonation-aware: View-As as editor/viewer/banker collapses the
  // admin-only UI to the "restricted" message. `user` still references
  // the real Firebase user so the invite-write below works.
  const { user, isAdmin, loading, profileMissing } = useEffectiveAuth();

  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [emailInput, setEmailInput] = useState("");
  const [roleInput, setRoleInput] = useState<Role>("viewer");
  const [noteInput, setNoteInput] = useState("");
  const [formState, setFormState] = useState<FormState>({ kind: "idle" });
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(TEAM_TOUR.storageKey);

  // Live users list. We only subscribe when the caller is admin — rules
  // would reject a non-admin read anyway, but skipping the subscription
  // saves a noisy permission-denied in the console for editors/viewers
  // who navigate here directly. Non-admin renders read `null` via the
  // initial useState value; we do NOT setState() synchronously inside the
  // effect (React 19 strict-mode flags that as a cascading render anti-
  // pattern — see eslint react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!isAdmin) return; // users stays at its previous value (null on first load)
    const db = getDb();
    if (!db) return;
    const q = query(collection(db, USERS_COLLECTION), orderBy("createdAt", "asc"));
    let unsub: Unsubscribe | null = null;
    unsub = onSnapshot(
      q,
      (snap) => {
        const rows: UserProfile[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (
            data.role !== "admin" &&
            data.role !== "editor" &&
            data.role !== "viewer"
          ) {
            return; // skip corrupt docs in the UI
          }
          rows.push({
            uid: d.id,
            email: typeof data.email === "string" ? data.email : "",
            displayName:
              typeof data.displayName === "string" ? data.displayName : null,
            role: data.role,
            createdAt:
              typeof data.createdAt === "number" ? data.createdAt : 0,
            invitedBy:
              typeof data.invitedBy === "string" ? data.invitedBy : null,
            lastSignInAt:
              typeof data.lastSignInAt === "number" ? data.lastSignInAt : null,
          });
        });
        setUsers(rows);
        setUsersError(null);
      },
      (err) => {
        setUsersError(err?.message ?? "Failed to load users");
      },
    );
    return () => {
      if (unsub) unsub();
    };
  }, [isAdmin]);

  const sortedUsers = useMemo(() => {
    if (!users) return null;
    return [...users].sort((a, b) => a.createdAt - b.createdAt);
  }, [users]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = normalizeEmail(emailInput);
    if (!email) {
      setFormState({ kind: "error", message: "Email is required." });
      return;
    }
    // Cheap shape check — Firestore rules don't validate email syntax.
    if (!email.includes("@") || email.length < 5) {
      setFormState({ kind: "error", message: "That doesn't look like a valid email." });
      return;
    }
    const db = getDb();
    if (!db || !user) {
      setFormState({ kind: "error", message: "Sign-in required." });
      return;
    }
    setFormState({ kind: "submitting" });
    try {
      await setDoc(doc(db, INVITES_COLLECTION, email), {
        email,
        role: roleInput,
        invitedBy: user.uid,
        invitedAt: Date.now(),
        note: noteInput.trim() || null,
      });
      setFormState({ kind: "success", email });
      setEmailInput("");
      setNoteInput("");
      setRoleInput("viewer");
    } catch (err) {
      setFormState({
        kind: "error",
        message: (err as Error)?.message ?? "Failed to write invite.",
      });
    }
  };

  // ── Gating UI ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-3xl">
        <div className="text-sm text-text-tertiary">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-display text-2xl text-text-primary mb-2">Team</h1>
        <p className="text-sm text-text-secondary">
          Sign in from <a className="underline" href="/admin/assumptions">/admin/assumptions</a> to manage the team.
        </p>
      </div>
    );
  }

  if (profileMissing || !isAdmin) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-display text-2xl text-text-primary mb-2">Team</h1>
        <p className="text-sm text-text-secondary">
          {profileMissing
            ? "You're signed in but not invited. Ask Eytan to send an invite."
            : "Team management is restricted to admins."}
        </p>
      </div>
    );
  }

  // ── Main UI ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-text-primary">Team</h1>
          <p className="text-sm text-text-tertiary mt-1">
            Invite people and review who has access to the model.
          </p>
        </div>
        <TourButton onClick={() => setTourOpen(true)} pulsing={!!neverSeen} />
      </div>

      {/* Invite form */}
      <section className="bg-white rounded-2xl border border-surface-tertiary shadow-sm p-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary mb-4">
          Send an invite
        </h2>
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1" htmlFor="invite-email">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="someone@example.com"
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-tertiary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            <p className="mt-1 text-[11px] text-text-tertiary">
              Stored lower-cased; case in the input is ignored when they sign in.
            </p>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1" htmlFor="invite-role">
              Role
            </label>
            <select
              id="invite-role"
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value as Role)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-tertiary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-text-tertiary">
              admin: full access incl. team management. editor: save/edit scenarios. viewer: read only.
            </p>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1" htmlFor="invite-note">
              Note <span className="text-text-tertiary">(optional)</span>
            </label>
            <input
              id="invite-note"
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="e.g. co-founder, banker at NBG"
              className="w-full px-3 py-2 text-sm rounded-lg border border-surface-tertiary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={formState.kind === "submitting"}
              className="px-4 py-2 rounded-lg bg-brand-700 text-white text-sm font-medium hover:bg-brand-800 disabled:opacity-50"
            >
              {formState.kind === "submitting" ? "Sending…" : "Send invite"}
            </button>
            {formState.kind === "success" && (
              <span className="text-xs text-positive">
                Invite created for {formState.email}. Share the sign-in URL with them.
              </span>
            )}
            {formState.kind === "error" && (
              <span className="text-xs text-warning">{formState.message}</span>
            )}
          </div>
        </form>
      </section>

      {/* Users list */}
      <section className="bg-white rounded-2xl border border-surface-tertiary shadow-sm p-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary mb-4">
          People with access
        </h2>
        {usersError && (
          <p className="text-xs text-warning mb-2">{usersError}</p>
        )}
        {!sortedUsers ? (
          <p className="text-sm text-text-tertiary">Loading users…</p>
        ) : sortedUsers.length === 0 ? (
          <p className="text-sm text-text-tertiary">
            No users yet. Once an invite is claimed they&apos;ll appear here.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-text-tertiary border-b border-surface-tertiary">
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                <th className="py-2 pr-3 font-medium">Joined</th>
                <th className="py-2 pr-3 font-medium">Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((u) => (
                <tr key={u.uid} className="border-b border-surface-tertiary/50">
                  <td className="py-2 pr-3 text-text-primary">
                    {u.email || <span className="text-text-tertiary">(no email)</span>}
                    {u.displayName && (
                      <span className="block text-[11px] text-text-tertiary">
                        {u.displayName}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="py-2 pr-3 text-text-secondary">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="py-2 pr-3 text-text-secondary">
                    {formatDate(u.lastSignInAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-4 text-[11px] text-text-tertiary">
          Per-row role changes and removal aren&apos;t shipped yet — use the Firebase Console at{" "}
          <code className="font-mono">villa-lev-admin → Firestore → users</code> in the meantime.
        </p>
      </section>

      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={TEAM_TOUR} />
    </div>
  );
}
