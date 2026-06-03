"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { Locale } from "@/lib/i18n/types";

interface SourcesAndUsesPanelProps {
  km: {
    loanAmount: number;
    equityRequired: number;
    grantAmount: number;
  };
  capexCategories: Array<{ name: string; grandTotal?: number; total?: number }>;
  wc: {
    facilitySize: number;
    internalCashBuffer: number;
  };
  locale: Locale;
}

const SOURCE_COLORS: Record<string, string> = {
  loan:   "#8B6914",
  equity: "#6B7A3D",
  carry:  "#9B6914",
  grant:  "#4A6A8B",
};

export function SourcesUsesPanel({ km, capexCategories, wc, locale }: SourcesAndUsesPanelProps) {
  const { t } = useTranslation();

  const sourcesTotal =
    km.loanAmount +
    km.equityRequired +
    (km.grantAmount ?? 0);

  const usesTotal = capexCategories
    .filter((c) => (c.grandTotal ?? c.total ?? 0) > 0)
    .reduce((s, c) => s + (c.grandTotal ?? c.total ?? 0), 0);

  // Stacked bar data
  const barData = [
    {
      "Term Loan":  km.loanAmount,
      "Equity":     km.equityRequired,
      "Grant":      km.grantAmount ?? 0,
    },
  ];

  const barSegments: Array<{ key: string; color: string }> = [
    { key: "Term Loan", color: SOURCE_COLORS.loan },
    { key: "Equity",    color: SOURCE_COLORS.equity },
    ...(km.grantAmount > 0        ? [{ key: "Grant", color: SOURCE_COLORS.grant }] : []),
  ];

  const fmtAmt = (v: number) => formatCurrency(v, true, locale);

  return (
    <div className="bg-white rounded-xl border border-surface-tertiary p-5 md:p-6 mb-6">
      {/* Section header */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-primary">{t('sau.sectionTitle')}</h3>
        <p className="text-xs text-text-tertiary mt-0.5">{t('sau.sectionSub')}</p>
      </div>

      {/* Stacked bar */}
      <div className="mb-5">
        <ResponsiveContainer width="100%" height={52}>
          <BarChart layout="vertical" data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" hide />
            <Tooltip
              formatter={(value: unknown, name: unknown) => [fmtAmt(Number(value ?? 0)), String(name ?? '')]}
              contentStyle={{ fontSize: 11, borderRadius: 6 }}
            />
            {barSegments.map((seg) => (
              <Bar key={seg.key} dataKey={seg.key} stackId="su" barSize={28} fill={seg.color}>
                <Cell key={seg.key} fill={seg.color} />
                <LabelList
                  dataKey={seg.key}
                  position="center"
                  style={{ fontSize: 10, fill: "#FFFFFF", fontWeight: 600 }}
                  formatter={(v: unknown) => {
                    const num = Number(v ?? 0);
                    return num > sourcesTotal * 0.08
                      ? `${Math.round((num / sourcesTotal) * 100)}%`
                      : "";
                  }}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>

        {/* Colour legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {barSegments.map((seg) => (
            <span key={seg.key} className="flex items-center gap-1.5 text-[10px] text-text-secondary">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: seg.color }}
              />
              {seg.key}
            </span>
          ))}
        </div>
      </div>

      {/* Two-column grid */}
      <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium mb-3">
        ≈ {t('sau.sectionTitle')}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Sources column */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            {t('sau.sources')}
          </p>
          <div className="space-y-1.5">
            {/* Term loan */}
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <span
                  className="inline-block w-2 h-2 rounded-sm shrink-0"
                  style={{ background: SOURCE_COLORS.loan }}
                />
                {t('inv.loan')}
              </span>
              <span className="font-mono text-text-primary">{fmtAmt(km.loanAmount)}</span>
            </div>

            {/* Structural equity */}
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <span
                  className="inline-block w-2 h-2 rounded-sm shrink-0"
                  style={{ background: SOURCE_COLORS.equity }}
                />
                {t('kpi.capexEquity')}
              </span>
              <span className="font-mono text-text-primary">{fmtAmt(km.equityRequired)}</span>
            </div>

            {/* WC memo line (undrawn — not in total) */}
            <div className="flex items-center justify-between text-xs mt-1 pt-1 border-t border-surface-secondary/60">
              <span className="text-text-tertiary italic">
                {t('sau.wcMemo')} ²
              </span>
              <span className="font-mono text-text-tertiary italic">{fmtAmt(wc.facilitySize)}</span>
            </div>

            {/* Grant — omit if 0 */}
            {km.grantAmount > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-text-secondary">
                  <span
                    className="inline-block w-2 h-2 rounded-sm shrink-0"
                    style={{ background: SOURCE_COLORS.grant }}
                  />
                  {t('path.grantShort')}
                </span>
                <span className="font-mono text-text-primary">{fmtAmt(km.grantAmount)}</span>
              </div>
            )}

            {/* Sources total */}
            <div className="flex items-center justify-between text-xs font-semibold pt-1.5 border-t border-surface-tertiary mt-1">
              <span className="text-text-primary">{t('common.total')}</span>
              <span className="font-mono text-text-primary">{fmtAmt(sourcesTotal)}</span>
            </div>
          </div>
        </div>

        {/* Uses column */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
            {t('sau.uses')}
          </p>
          <div className="space-y-1.5">
            {capexCategories
              .filter((c) => (c.grandTotal ?? c.total ?? 0) > 0)
              .map((cat) => (
                <div key={cat.name} className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary truncate pr-2">{cat.name}</span>
                  <span className="font-mono text-text-primary shrink-0">{fmtAmt(cat.grandTotal ?? cat.total ?? 0)}</span>
                </div>
              ))}

            {/* Uses total */}
            <div className="flex items-center justify-between text-xs font-semibold pt-1.5 border-t border-surface-tertiary mt-1">
              <span className="text-text-primary">{t('common.total')}</span>
              <span className="font-mono text-text-primary">{fmtAmt(usesTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footnotes */}
      <div className="mt-4 pt-3 border-t border-surface-secondary/50 space-y-1">
        <p className="text-[10px] text-text-tertiary leading-relaxed">{t('sau.balanceNote')}</p>
        <p className="text-[10px] text-text-tertiary leading-relaxed">{t('sau.wcNote')}</p>
        {/* FI-12: equity draw order confirmation */}
        <p className="text-[10px] text-text-tertiary leading-relaxed font-medium">{t('sau.equityFirstNote')}</p>
      </div>
    </div>
  );
}
