"use client";

// /admin/connections — live browser-session presence board + session history.
// Admin-only: only Eytan (Google-auth admin) sees this page.
// Stale-doc cleanup runs on mount for docs older than 10 minutes.

import { useEffect } from "react";
import { collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useEffectiveAuth } from "@/lib/data/useEffectiveAuth";
import { useConnectionsLog, type ConnectionEntry } from "@/lib/data/useConnectionsLog";
import { useConnectionHistory, type HistoryEntry } from "@/lib/data/useConnectionHistory";
import { useTranslation } from "@/lib/i18n/I18nProvider";

// ── Inline helpers ────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  excel_download:    "Excel ↓",
  presentation_view: "Presentation",
  tour_start:        "Tour",
};

function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5)  return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(startMs: number, endMs: number): string {
  const diff = Math.max(0, endMs - startMs);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function PageChips({ pages }: { pages: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {pages.map((page) => {
        const isBank  = page.startsWith("/bank");
        const isPitch = page.startsWith("/pitch");
        return (
          <span
            key={page}
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono ${
              isBank
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : isPitch
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-brand-50 text-brand-700 border border-brand-200"
            }`}
          >
            {page}
          </span>
        );
      })}
    </div>
  );
}

// ── Page component ────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const { t } = useTranslation();
  const { user, isAdmin, loading } = useEffectiveAuth();
  const { entries, loading: logLoading, error } = useConnectionsLog(isAdmin);
  const { entries: historyEntries, loading: histLoading } = useConnectionHistory(isAdmin);

  // Stale-doc cleanup on mount: delete presence docs >10 min old, and
  // connectionHistory docs >7 days old (admin-only cleanup pass).
  useEffect(() => {
    if (!isAdmin) return;
    const db = getDb();
    if (!db) return;

    void (async () => {
      try {
        // Clean up stale live presence docs.
        const presSnap = await getDocs(collection(db, "presence"));
        const presenceCutoff = Date.now() - 600_000;
        const deletions: Promise<void>[] = [];
        presSnap.forEach((d) => {
          const data = d.data();
          if (typeof data.lastHeartbeat === "number" && data.lastHeartbeat < presenceCutoff) {
            deletions.push(deleteDoc(doc(db, "presence", d.id)));
          }
        });
        // Clean up connectionHistory docs older than 7 days.
        const historyCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const histSnap = await getDocs(
          query(collection(db, "connectionHistory"), where("connectedAt", "<", historyCutoff)),
        );
        histSnap.forEach((d) => {
          deletions.push(deleteDoc(doc(db, "connectionHistory", d.id)));
        });
        await Promise.allSettled(deletions);
      } catch {
        // Non-fatal.
      }
    })();
  }, [isAdmin]);

  // ── Gating ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-4xl">
        <div className="text-sm text-text-tertiary">{t("connections.loading")}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-4xl">
        <h1 className="font-display text-2xl text-text-primary mb-2 border-s-[3px] border-brand-400 ps-3">
          {t("connections.title")}
        </h1>
        <p className="text-sm text-text-secondary">{t("connections.signInPrompt")}</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-4xl">
        <h1 className="font-display text-2xl text-text-primary mb-2 border-s-[3px] border-brand-400 ps-3">
          {t("connections.title")}
        </h1>
        <p className="text-sm text-text-secondary">{t("connections.restricted")}</p>
      </div>
    );
  }

  // Ended sessions from history (exclude active — already shown in live table).
  const endedSessions = historyEntries.filter((e) => e.status === "ended");

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl space-y-10">
      <div>
        <h1 className="font-display text-2xl text-text-primary border-s-[3px] border-brand-400 ps-3">
          {t("connections.title")}
        </h1>
        <p className="text-sm text-text-secondary mt-1">{t("connections.pageIntro")}</p>
      </div>

      {/* ── Live connections ─────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-surface-tertiary p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">
          {t("connections.sectionLive")}
        </h2>
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
                <th className="py-2 pe-3 font-medium text-start">{t("connections.colUser")}</th>
                <th className="py-2 pe-3 font-medium text-start">{t("connections.colSessions")}</th>
                <th className="py-2 pe-3 font-medium text-start">{t("connections.colConnectedSince")}</th>
                <th className="py-2 pe-3 font-medium text-start">{t("connections.colLastSeen")}</th>
                <th className="py-2 pe-3 font-medium text-start">{t("connections.colOpenPages")}</th>
                <th className="py-2 pe-3 font-medium text-start">{t("connections.colLastAction")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry: ConnectionEntry) => (
                <tr key={entry.uid} className="border-b border-surface-tertiary/50">
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
                  <td className="py-2 pe-3 text-text-secondary tabular-nums">{entry.sessionCount}</td>
                  <td className="py-2 pe-3 text-text-secondary">{formatRelative(entry.connectedSince)}</td>
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
                  <td className="py-2 pe-3">
                    <PageChips pages={entry.pages} />
                  </td>
                  <td className="py-2 pe-3">
                    {entry.lastAction && entry.lastActionAt ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[11px] font-medium text-text-secondary">
                          {ACTION_LABELS[entry.lastAction] ?? entry.lastAction}
                        </span>
                        <span className="text-[11px] text-text-tertiary">
                          {formatRelative(entry.lastActionAt)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-text-tertiary">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Session history ───────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-surface-tertiary p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary mb-4">
          {t("connections.sectionHistory")}
        </h2>

        {histLoading ? (
          <p className="text-sm text-text-tertiary">{t("connections.loading")}</p>
        ) : endedSessions.length === 0 ? (
          <p className="text-sm text-text-tertiary">{t("connections.noHistory")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-[10px] uppercase tracking-wider text-text-tertiary border-b border-surface-tertiary">
                <th className="py-2 pe-3 font-medium text-start">{t("connections.colUser")}</th>
                <th className="py-2 pe-3 font-medium text-start">{t("connections.colConnectedAt")}</th>
                <th className="py-2 pe-3 font-medium text-start">{t("connections.colDuration")}</th>
                <th className="py-2 pe-3 font-medium text-start">{t("connections.colLastPage")}</th>
                <th className="py-2 pe-3 font-medium text-start">{t("connections.colLastAction")}</th>
              </tr>
            </thead>
            <tbody>
              {endedSessions.map((entry: HistoryEntry) => (
                <tr key={entry.tabId} className="border-b border-surface-tertiary/50">
                  <td className="py-2 pe-3 text-text-primary">
                    <span className="font-medium">{entry.displayName || "—"}</span>
                    {entry.isAnonymous && (
                      <span className="ms-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-surface-tertiary text-text-tertiary">
                        anon
                      </span>
                    )}
                  </td>
                  <td className="py-2 pe-3 text-text-secondary">
                    {formatRelative(entry.connectedAt)}
                  </td>
                  <td className="py-2 pe-3 text-text-secondary tabular-nums">
                    {entry.disconnectedAt
                      ? formatDuration(entry.connectedAt, entry.disconnectedAt)
                      : "—"}
                  </td>
                  <td className="py-2 pe-3">
                    <PageChips pages={[entry.currentPage]} />
                  </td>
                  <td className="py-2 pe-3">
                    {entry.lastAction && entry.lastActionAt ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[11px] font-medium text-text-secondary">
                          {ACTION_LABELS[entry.lastAction] ?? entry.lastAction}
                        </span>
                        <span className="text-[11px] text-text-tertiary">
                          {formatRelative(entry.lastActionAt)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-text-tertiary">—</span>
                    )}
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
