"use client";

import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";

export default function PnLPage() {
  const { t, locale } = useTranslation();
  const { model, activeScenario } = useModelStore();

  if (!model) return null;

  const pnl = model.scenarios[activeScenario].pnl;
  const scenarioLabel = activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1);

  const rows: { label: string; key: string; bold?: boolean; color?: string; format?: "currency" | "percent" | "multiple" | "number" }[] = [
    { label: t('pnl.villaNights'), key: "villaNightsPerProject", format: "number" },
    { label: t('pnl.suiteNights'), key: "suiteNightsPerSuite", format: "number" },
    { label: t('pnl.propA1'), key: "revenueA1", format: "currency" },
    { label: t('pnl.propA2'), key: "revenueA2", format: "currency" },
    { label: t('pnl.propB'), key: "revenueB", format: "currency" },
    { label: t('pnl.events'), key: "revenueEvents", format: "currency" },
    { label: t('pnl.ancillary'), key: "revenueAncillary", format: "currency" },
    { label: t('pnl.totalRevenue'), key: "totalRevenue", format: "currency", bold: true },
    { label: t('pnl.opexA1'), key: "opexA1", format: "currency" },
    { label: t('pnl.opexA2'), key: "opexA2", format: "currency" },
    { label: t('pnl.opexB'), key: "opexB", format: "currency" },
    { label: t('pnl.totalOpex'), key: "totalOpex", format: "currency", bold: true },
    { label: t('term.ebitda'), key: "ebitda", format: "currency", bold: true },
    { label: t('term.ebitdaMargin'), key: "ebitdaMargin", format: "percent" },
    { label: t('pnl.debtService'), key: "debtService", format: "currency", color: "negative" },
    { label: t('kpi.netCashFlow'), key: "netCashFlow", format: "currency", bold: true },
    { label: t('pnl.cumulativeNCF'), key: "cumulativeNCF", format: "currency" },
    { label: t('term.vatPayable'), key: "vatPayable", format: "currency", color: "negative" },
    { label: t('pnl.ncfPostVAT'), key: "netCashFlowPostVAT", format: "currency", bold: true },
    { label: t('term.dscr'), key: "dscr", format: "multiple" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-text-primary">{t('pnl.title')}</h1>
        <p className="text-sm text-text-secondary mt-1">{scenarioLabel} &middot; {t('pnl.subtitle')}</p>
      </div>

      <div className="bg-white rounded-xl border border-surface-tertiary p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-tertiary">
              <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium sticky left-0 bg-white min-w-[200px]">
                {t('pnl.item')}
              </th>
              {pnl.map((p) => (
                <th key={p.year} className="text-right py-2 px-2 text-xs uppercase tracking-wider text-text-tertiary font-medium min-w-[90px]">
                  {p.year}
                </th>
              ))}
            </tr>
            <tr className="border-b border-surface-secondary">
              <td className="py-1 pr-4 text-xs text-text-tertiary sticky left-0 bg-white">{t('pnl.phase')}</td>
              {pnl.map((p) => (
                <td key={p.year} className="text-right py-1 px-2 text-xs text-text-tertiary">{p.phase}</td>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className={`border-b border-surface-secondary/50 ${row.bold ? "bg-surface-secondary/30 font-medium" : ""}`}
              >
                <td className={`py-2 pr-4 sticky left-0 ${row.bold ? "bg-surface-secondary/30 font-medium" : "bg-white text-text-secondary"}`}>
                  {row.label}
                </td>
                {pnl.map((p) => {
                  const val = (p as unknown as Record<string, number>)[row.key];
                  const display =
                    val === 0 || val === undefined
                      ? "—"
                      : row.format === "number"
                        ? val.toLocaleString()
                        : row.format === "percent"
                          ? formatPercent(val)
                          : row.format === "multiple"
                            ? formatMultiple(val)
                            : formatCurrency(val, true, locale);
                  return (
                    <td
                      key={p.year}
                      className={`text-right py-2 px-2 data-cell ${
                        row.color === "negative"
                          ? "text-negative"
                          : row.key === "netCashFlow" || row.key === "netCashFlowPostVAT"
                            ? val >= 0
                              ? "text-positive"
                              : "text-negative"
                            : row.key === "dscr"
                              ? val >= 1.25
                                ? "text-positive"
                                : val > 0
                                  ? "text-warning"
                                  : ""
                              : ""
                      }`}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
