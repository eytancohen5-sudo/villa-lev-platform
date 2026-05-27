"use client";

// /admin/connections — live browser-session presence board.
// Admin-only: only Eytan (Google-auth admin) sees this page.
// Stale-doc cleanup runs on mount for docs older than 10 minutes.

import { useEffect } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useEffectiveAuth } from "@/lib/data/useEffectiveAuth";
import { useConnectionsLog, type ConnectionEntry } from "@/lib/data/useConnectionsLog";
import { useTranslation } from "@/lib/i18n/I18nProvider";

// ── Inline helper ─────────────────────────────────────────────────────────────

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Page component ────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const { t } = useTranslation();
  const { user, isAdmin, loading } = useEffectiveAuth();
  const { entries, loading: logLoading, error } = useConnectionsLog(isAdmin);

  // Stale-doc cleanup: delete any presence doc with lastHeartbeat older
  // than 10 minutes. Runs once on mount, only when the caller is admin.
  useEffect(() => {
    if (!isAdmin) return;
    const db = getDb();
    if (!db) return;

    void (async () => {
      try {
        const snap = await getDocs(collection(db, "presence"));
        const cutoff = Date.now() - 600_000; // 10 minutes
        const deletions: Promise<void>[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (typeof data.lastHeartbeat === "number" && data.lastHeartbeat < cutoff) {
            deletions.push(deleteDoc(doc(db, "presence", d.id)));
          }
        });
        await Promise.allSettled(deletions);
      } catch {
        // Non-fatal: cleanup is best-effort.
      }
    })();
  }, [isAdmin]);

  // ── Gating ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-3xl">
        <div className="text-sm text-text-tertiary">{t("connections.loading")}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-display text-2xl text-text-primary mb-2 border-s-[3px] border-brand-400 ps-3">
          {t("connections.title")}
        </h1>
        <p className="text-sm text-text-secondary">{t("connections.signInPrompt")}</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-display text-2xl text-text-primary mb-2 border-s-[3px] border-brand-400 ps-3">
          {t("connections.title")}
        </h1>
        <p className="text-sm text-text-secondary">{t("connections.restricted")}</p>
      </div>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl text-text-primary border-s-[3px] border-brand-400 ps-3">
          {t("connections.title")}
        </h1>
        <p className="text-sm text-text-secondary mt-1">{t("connections.pageIntro")}</p>
      </div>

      <section className="bg-white rounded-xl border border-surface-tertiary p-6">
        {error && (
          <p className="text-xs text-warning mb-4">{error}</p>
        )}

        {logLoading ? (
          <p className="text-sm text-text-tertiary">{t("connections.loading")}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-text-tertiary">{t("connections.noConnections")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-[10px] uppercase tracking-wider text-text-tertiary border-b border-surface-tertiary">
                <th className="py-2 pe-3 font-medium text-start">
                  {t("connections.colUser")}
                </th>
                <th className="py-2 pe-3 font-medium text-start">
                  {t("connections.colSessions")}
                </th>
                <th className="py-2 pe-3 font-medium text-start">
                  {t("connections.colConnectedSince")}
                </th>
                <th className="py-2 pe-3 font-medium text-start">
                  {t("connections.colLastSeen")}
                </th>
                <th className="py-2 pe-3 font-medium text-start">
                  {t("connections.colCurrentPage")}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry: ConnectionEntry) => (
                <tr
                  key={entry.uid}
                  className="border-b border-surface-tertiary/50"
                >
                  {/* User */}
                  <td className="py-2 pe-3 text-text-primary">
                    <span className="font-medium">{entry.displayName}</span>
                    {entry.isAnonymous && (
                      <span className="ms-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-surface-tertiary text-text-tertiary">
                        anon
                      </span>
                    )}
                    <span className="block text-[11px] text-text-tertiary font-mono">
                      {entry.uid.slice(0, 12)}&hellip;
                    </span>
                  </td>

                  {/* Sessions */}
                  <td className="py-2 pe-3 text-text-secondary tabular-nums">
                    {entry.sessionCount}
                  </td>

                  {/* Connected since */}
                  <td className="py-2 pe-3 text-text-secondary">
                    {formatRelative(entry.connectedSince)}
                  </td>

                  {/* Last seen */}
                  <td className="py-2 pe-3">
                    <span className={entry.isStale ? "text-text-tertiary" : "text-text-secondary"}>
                      {formatRelative(entry.lastSeen)}
                    </span>
                    {entry.isStale && (
                      <span className="ms-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-surface-tertiary text-text-tertiary">
                        {t("connections.staleBadge")}
                      </span>
                    )}
                  </td>

                  {/* Current page */}
                  <td className="py-2 pe-3 text-text-tertiary font-mono text-[11px]">
                    {entry.currentPage}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
