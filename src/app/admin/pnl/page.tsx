"use client";

import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { AnnualPnL } from "@/lib/engine/types";

type RowDef = {
  label: string;
  getValue: (p: AnnualPnL) => number;
  format: "currency" | "percent" | "multiple" | "number";
  bold?: boolean;
  color?: "negative" | "dynamic";
  indent?: boolean;
};

export default function PnLPage() {
  const { t, locale } = useTranslation();
  const { model, activeScenario, assumptions } = useModelStore();

  if (!model) return null;

  const pnl = model.scenarios[activeScenario].pnl;
  const scenarioLabel = activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1);
  const nA = assumptions.numberOfPropertyA;
  const nB = assumptions.numberOfPropertyB;

  // Build rows dynamically based on property counts
  const rows: RowDef[] = [
    { label: t('pnl.villaNights'), getValue: (p) => p.villaNightsPerProject, format: "number" },
    { label: t('pnl.suiteNights'), getValue: (p) => p.suiteNightsPerSuite, format: "number" },
  ];

  // Revenue rows — one per Property A unit
  for (let i = 0; i < nA; i++) {
    rows.push({
      label: nA === 1 ? 'Property A — Villas' : `Property A${i + 1} — Villas`,
      getValue: (p) => p.revenuePerA,
      format: "currency",
      indent: true,
    });
  }
  // Revenue rows — one per Property B unit
  for (let i = 0; i < nB; i++) {
    rows.push({
      label: nB === 1 ? 'Property B — Suites' : `Property B${i + 1} — Suites`,
      getValue: (p) => p.revenuePerB,
      format: "currency",
      indent: true,
    });
  }

  rows.push(
    { label: t('pnl.events'), getValue: (p) => p.revenueEvents, format: "currency", indent: true },
    { label: t('pnl.ancillary'), getValue: (p) => p.revenueAncillary, format: "currency", indent: true },
    { label: t('pnl.totalRevenue'), getValue: (p) => p.totalRevenue, format: "currency", bold: true },
  );

  // OPEX rows
  for (let i = 0; i < nA; i++) {
    rows.push({
      label: nA === 1 ? 'OPEX Property A' : `OPEX Property A${i + 1}`,
      getValue: (p) => p.opexPerA,
      format: "currency",
      indent: true,
    });
  }
  for (let i = 0; i < nB; i++) {
    rows.push({
      label: nB === 1 ? 'OPEX Property B' : `OPEX Property B${i + 1}`,
      getValue: (p) => p.opexPerB,
      format: "currency",
      indent: true,
    });
  }

  rows.push(
    { label: t('pnl.totalOpex'), getValue: (p) => p.totalOpex, format: "currency", bold: true },
    { label: t('term.ebitda'), getValue: (p) => p.ebitda, format: "currency", bold: true },
    { label: t('term.ebitdaMargin'), getValue: (p) => p.ebitdaMargin, format: "percent" },
    { label: t('pnl.debtService'), getValue: (p) => p.debtService, format: "currency", color: "negative" },
    { label: t('kpi.netCashFlow'), getValue: (p) => p.netCashFlow, format: "currency", bold: true, color: "dynamic" },
    { label: t('pnl.cumulativeNCF'), getValue: (p) => p.cumulativeNCF, format: "currency", color: "dynamic" },
    { label: t('term.vatPayable'), getValue: (p) => p.vatPayable, format: "currency", color: "negative" },
    { label: t('pnl.ncfPostVAT'), getValue: (p) => p.netCashFlowPostVAT, format: "currency", bold: true, color: "dynamic" },
    { label: t('term.dscr'), getValue: (p) => p.dscr, format: "multiple" },
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-text-primary">{t('pnl.title')}</h1>
        <p className="text-sm text-text-secondary mt-1">{scenarioLabel} &middot; {t('pnl.subtitle')}</p>
      </div>

      <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-secondary/40">
                <th className="text-left py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium sticky left-0 bg-surface-secondary/40 min-w-[200px] z-10">
                  {t('pnl.item')}
                </th>
                {pnl.map((p) => (
                  <th key={p.year} className="text-right py-3 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium min-w-[95px]">
                    {p.year}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-surface-tertiary">
                <td className="py-1.5 px-5 text-xs text-text-tertiary sticky left-0 bg-white z-10">{t('pnl.phase')}</td>
                {pnl.map((p) => (
                  <td key={p.year} className="text-right py-1.5 px-3 text-xs text-text-tertiary">{p.phase}</td>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const isSection = row.bold;
                return (
                  <tr
                    key={ri}
                    className={`border-t border-surface-secondary/40 ${isSection ? "bg-surface-secondary/30 font-medium" : ""}`}
                  >
                    <td className={`py-2.5 px-5 sticky left-0 z-10 ${isSection ? "bg-surface-secondary/30 font-medium" : "bg-white text-text-secondary"} ${row.indent ? "pl-8" : ""}`}>
                      {row.label}
                    </td>
                    {pnl.map((p) => {
                      const val = row.getValue(p);
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
                          className={`text-right py-2.5 px-3 data-cell font-mono text-sm ${
                            row.color === "negative"
                              ? "text-negative"
                              : row.color === "dynamic"
                                ? val >= 0
                                  ? "text-positive"
                                  : "text-negative"
                                : row.format === "multiple"
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
