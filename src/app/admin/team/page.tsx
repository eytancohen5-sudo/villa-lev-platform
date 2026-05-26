// Team management — RBAC invite flow + approval gate.
//
// Scope:
//   - Invite form: writes invites/{lowercased-email} with chosen role.
//   - Pending approvals: self-registered users awaiting Eytan's approval.
//   - Approved users list: people who currently have access, with revoke.
//
// Gating:
//   - The whole page is admin-only.
//   - Loading state holds the gate until BOTH auth and profile have fired.

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
  approveUser,
  revokeUser,
  denyUser,
  type Role,
  type UserProfile,
  type UserStatus,
  ROLES,
} from "@/lib/data/userProfile";
import { PageTour, TourButton, usePageTour } from "@/components/PageTour";
import { TEAM_TOUR } from "@/lib/tours/configs";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { SectionHeader } from "@/components/AdminUI";

// Extended profile row that includes the approval-gate status field.
type UserRow = UserProfile & { status?: UserStatus };

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
  | { kind: "success"; email: string; inviteText: string }
  | { kind: "error"; message: string };

export default function TeamPage() {
  // Impersonation-aware: View-As as editor/viewer/banker collapses the
  // admin-only UI to the "restricted" message. `user` still references
  // the real Firebase user so the invite-write below works.
  const { t } = useTranslation();
  const { user, isAdmin, loading, profileMissing } = useEffectiveAuth();

  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [emailInput, setEmailInput] = useState("");
  const [roleInput, setRoleInput] = useState<Role>("viewer");
  const [noteInput, setNoteInput] = useState("");
  const [formState, setFormState] = useState<FormState>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(TEAM_TOUR.storageKey);

  // Live users list. We only subscribe when the caller is admin — rules
  // would reject a non-admin read anyway, but skipping the subscription
  // saves a noisy permission-denied in the console for editors/viewers
  // who navigate here directly.
  useEffect(() => {
    if (!isAdmin) return;
    const db = getDb();
    if (!db) return;
    const q = query(collection(db, USERS_COLLECTION), orderBy("createdAt", "asc"));
    let unsub: Unsubscribe | null = null;
    unsub = onSnapshot(
      q,
      (snap) => {
        const rows: UserRow[] = [];
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
            status: data.status === "pending" ? "pending" : data.status === "approved" ? "approved" : undefined,
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

  // Split users into pending and approved buckets.
  const pendingUsers = useMemo(() => {
    if (!users) return [];
    return [...users]
      .filter((u) => u.status === "pending")
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [users]);

  const approvedUsers = useMemo(() => {
    if (!users) return [];
    // Approved = status explicitly 'approved' OR no status field (legacy).
    return [...users]
      .filter((u) => u.status !== "pending")
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [users]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = normalizeEmail(emailInput);
    if (!email) {
      setFormState({ kind: "error", message: "Email is required." });
      return;
    }
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
      const appUrl = `${window.location.origin}/admin`;
      const lines = [
        `Hi,`,
        ``,
        `You've been invited to access the Villa Lev Finance model as a ${roleInput}.`,
        ``,
        `Sign in here: ${appUrl}`,
      ];
      if (noteInput.trim()) lines.push(``, `Note: ${noteInput.trim()}`);
      const inviteText = lines.join('\n');
      setFormState({ kind: "success", email, inviteText });
      setCopied(false);
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

  const handleCopy = () => {
    if (formState.kind !== 'success') return;
    navigator.clipboard.writeText(formState.inviteText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleApprove = async (targetUid: string) => {
    const db = getDb();
    if (!db || !user) return;
    try {
      await approveUser(user.uid, targetUid, db);
    } catch (err) {
      setUsersError((err as Error)?.message ?? "Failed to approve user.");
    }
  };

  const handleDeny = async (targetUid: string) => {
    const db = getDb();
    if (!db) return;
    try {
      await denyUser(targetUid, db);
    } catch (err) {
      setUsersError((err as Error)?.message ?? "Failed to deny user.");
    }
  };

  const handleRevoke = async (targetUid: string) => {
    const db = getDb();
    if (!db || !user) return;
    try {
      await revokeUser(user.uid, targetUid, db);
    } catch (err) {
      setUsersError((err as Error)?.message ?? "Failed to revoke access.");
    }
  };

  // ── Gating UI ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-3xl">
        <div className="text-sm text-text-tertiary">{t('team.loading')}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-display text-2xl text-text-primary mb-2 border-l-[3px] border-brand-400 pl-3">{t('team.title')}</h1>
        <p className="text-sm text-text-secondary">
          {t('team.signInPrompt')}
        </p>
      </div>
    );
  }

  if (profileMissing || !isAdmin) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-display text-2xl text-text-primary mb-2 border-l-[3px] border-brand-400 pl-3">{t('team.title')}</h1>
        <p className="text-sm text-text-secondary">
          {profileMissing ? t('team.notInvited') : t('team.restricted')}
        </p>
      </div>
    );
  }

  // ── Main UI ────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-text-primary border-l-[3px] border-brand-400 pl-3">{t('team.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('team.pageIntro')}</p>
          <p className="text-sm text-text-tertiary mt-1">
            {t('team.subtitle')}
          </p>
        </div>
        <TourButton onClick={() => setTourOpen(true)} pulsing={!!neverSeen} />
      </div>

      {/* Pending approvals */}
      <section className="bg-white rounded-xl border border-surface-tertiary p-6">
        <SectionHeader title={t('team.pendingApprovals')} />
        {usersError && (
          <p className="text-xs text-warning mb-2">{usersError}</p>
        )}
        {!users ? (
          <p className="text-sm text-text-tertiary">{t('team.loadingUsers')}</p>
        ) : pendingUsers.length === 0 ? (
          <p className="text-sm text-text-tertiary">{t('team.noPendingUsers')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-text-tertiary border-b border-surface-tertiary">
                <th className="py-2 pr-3 font-medium">{t('team.colEmail')}</th>
                <th className="py-2 pr-3 font-medium">{t('team.colJoined')}</th>
                <th className="py-2 pr-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map((u) => (
                <tr key={u.uid} className="border-b border-surface-tertiary/50">
                  <td className="py-2 pr-3 text-text-primary">
                    {u.email || <span className="text-text-tertiary">(no email)</span>}
                    {u.displayName && (
                      <span className="block text-[11px] text-text-tertiary">
                        {u.displayName}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-text-secondary">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove(u.uid)}
                        className="px-2.5 py-1 rounded-md bg-positive text-white text-[11px] font-medium hover:opacity-90 transition-opacity"
                      >
                        {t('team.approveBtn')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeny(u.uid)}
                        className="px-2.5 py-1 rounded-md bg-surface-secondary text-text-secondary text-[11px] font-medium hover:bg-warning/10 hover:text-warning transition-colors"
                      >
                        {t('team.denyBtn')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Invite form */}
      <section className="bg-white rounded-xl border border-surface-tertiary p-6">
        <SectionHeader title={t('team.sendInvite')} />
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1" htmlFor="invite-email">
              {t('team.emailLabel')}
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
              {t('team.emailNote')}
            </p>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1" htmlFor="invite-role">
              {t('team.roleLabel')}
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
              {t('team.roleNote')}
            </p>
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1" htmlFor="invite-note">
              {t('team.noteLabel')} <span className="text-text-tertiary">{t('team.noteOptional')}</span>
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
              {formState.kind === "submitting" ? t('team.sending') : t('team.sendBtn')}
            </button>
            {formState.kind === "error" && (
              <span className="text-xs text-warning">{formState.message}</span>
            )}
          </div>
          {formState.kind === "success" && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-positive">
                {t('team.inviteCreated').replace('{email}', formState.email)}
              </p>
              <div className="relative">
                <textarea
                  readOnly
                  value={formState.inviteText}
                  rows={5}
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-surface-tertiary bg-surface-secondary font-mono resize-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="absolute top-2 right-2 px-2 py-0.5 text-[11px] rounded bg-brand-700 text-white hover:bg-brand-800 transition-colors"
                >
                  {copied ? t('team.copiedBtn') : t('team.copyBtn')}
                </button>
              </div>
            </div>
          )}
        </form>
      </section>

      {/* Approved users list */}
      <section className="bg-white rounded-xl border border-surface-tertiary p-6">
        <SectionHeader title={t('team.peopleWithAccess')} />
        {!users ? (
          <p className="text-sm text-text-tertiary">{t('team.loadingUsers')}</p>
        ) : approvedUsers.length === 0 ? (
          <p className="text-sm text-text-tertiary">
            {t('team.noUsers')}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-text-tertiary border-b border-surface-tertiary">
                <th className="py-2 pr-3 font-medium">{t('team.colEmail')}</th>
                <th className="py-2 pr-3 font-medium">{t('team.colRole')}</th>
                <th className="py-2 pr-3 font-medium">{t('team.colStatus')}</th>
                <th className="py-2 pr-3 font-medium">{t('team.colJoined')}</th>
                <th className="py-2 pr-3 font-medium">{t('team.colLastSignIn')}</th>
                <th className="py-2 pr-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {approvedUsers.map((u) => (
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
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-positive/10 text-positive">
                      {t('team.statusApproved')}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-text-secondary">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="py-2 pr-3 text-text-secondary">
                    {formatDate(u.lastSignInAt)}
                  </td>
                  <td className="py-2 pr-3">
                    {/* Don't show revoke for the current admin to prevent self-lock */}
                    {u.uid !== user?.uid && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(u.uid)}
                        className="px-2.5 py-1 rounded-md bg-surface-secondary text-text-secondary text-[11px] font-medium hover:bg-warning/10 hover:text-warning transition-colors"
                      >
                        {t('team.revokeBtn')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-4 text-[11px] text-text-tertiary">
          {t('team.consoleNote')}
        </p>
      </section>

      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={TEAM_TOUR} />
    </div>
  );
}
