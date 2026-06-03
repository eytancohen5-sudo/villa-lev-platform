"use client";

import { useEffect, useState, useCallback } from "react";
import { getDocs, collection, query, where, Timestamp, limit } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { SectionHeader } from "@/components/AdminUI";

type Range = "7d" | "30d" | "90d";

interface FeatureRow {
  featureId: string;
  totalOpens: number;
  uniqueSessions: number;
  adminOpens: number;
  bankOpens: number;
  lastUsed: Date | null;
}

function rangeDays(r: Range): number {
  return r === "7d" ? 7 : r === "30d" ? 30 : 90;
}

function formatDate(d: Date | null, noDataLabel: string): string {
  if (!d) return noDataLabel;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [range, setRange] = useState<Range>("30d");
  const [rows, setRows] = useState<FeatureRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      const db = getDb();
      if (!db) { setLoading(false); return; }

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - rangeDays(r));
      const rangeStart = Timestamp.fromDate(cutoff);

      const snap = await getDocs(
        query(
          collection(db, "featureUsage"),
          where("ts", ">=", rangeStart),
          limit(500),
        )
      );

      // Group by featureId client-side.
      const map = new Map<string, {
        totalOpens: number;
        sessions: Set<string>;
        adminOpens: number;
        bankOpens: number;
        lastTs: Date | null;
      }>();

      snap.docs.forEach((doc) => {
        const d = doc.data();
        const fid: string = d.featureId ?? "unknown";
        const session: string = d.sessionId ?? "";
        const audience: string = d.audience ?? "unknown";
        const ts: Date | null = d.ts?.toDate?.() ?? null;

        if (!map.has(fid)) {
          map.set(fid, { totalOpens: 0, sessions: new Set(), adminOpens: 0, bankOpens: 0, lastTs: null });
        }
        const entry = map.get(fid)!;
        entry.totalOpens += 1;
        if (session) entry.sessions.add(session);
        if (audience === "admin") entry.adminOpens += 1;
        if (audience === "bank") entry.bankOpens += 1;
        if (ts && (!entry.lastTs || ts > entry.lastTs)) entry.lastTs = ts;
      });

      const result: FeatureRow[] = Array.from(map.entries()).map(([featureId, v]) => ({
        featureId,
        totalOpens: v.totalOpens,
        uniqueSessions: v.sessions.size,
        adminOpens: v.adminOpens,
        bankOpens: v.bankOpens,
        lastUsed: v.lastTs,
      }));

      // Sort ascending by totalOpens (least-used first — pruning candidates at top).
      result.sort((a, b) => a.totalOpens - b.totalOpens);

      setRows(result);
    } catch {
      // Silently swallow — NEXT_PUBLIC_ANALYTICS_ENABLED may be false, or
      // Firestore rules may not include featureUsage yet.
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(range);
  }, [range, fetchData]);

  const ranges: { id: Range; label: string }[] = [
    { id: "7d",  label: t("analytics.range7d") },
    { id: "30d", label: t("analytics.range30d") },
    { id: "90d", label: t("analytics.range90d") },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t("analytics.title")}
        sub={t("analytics.pageIntro")}
      />

      {/* Range selector */}
      <div className="flex items-center gap-2">
        {ranges.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            aria-pressed={range === r.id}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              range === r.id
                ? "bg-brand-700 text-white"
                : "bg-surface-secondary text-text-secondary border border-surface-tertiary hover:bg-surface-tertiary"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-text-tertiary">{t("analytics.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-tertiary">{t("analytics.noData")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-tertiary">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary bg-surface-secondary text-text-tertiary text-[11px] uppercase tracking-wider">
                <th className="px-4 py-2.5 text-left">{t("analytics.colFeature")}</th>
                <th className="px-4 py-2.5 text-right">{t("analytics.colTotalOpens")}</th>
                <th className="px-4 py-2.5 text-right">{t("analytics.colUniqueSessions")}</th>
                <th className="px-4 py-2.5 text-right">{t("analytics.colAdminOpens")}</th>
                <th className="px-4 py-2.5 text-right">{t("analytics.colBankOpens")}</th>
                <th className="px-4 py-2.5 text-left">{t("analytics.colLastUsed")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-tertiary bg-white">
              {rows.map((row) => (
                <tr key={row.featureId} className="hover:bg-surface-secondary transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-text-primary">{row.featureId}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-text-primary">{row.totalOpens}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">{row.uniqueSessions}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">{row.adminOpens}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">{row.bankOpens}</td>
                  <td className="px-4 py-2.5 text-xs text-text-tertiary">{formatDate(row.lastUsed, t('common.noData'))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
