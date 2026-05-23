"use client";

import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { AnnualPnL } from "@/lib/engine/types";

type RowDef = {
  label: string;
  getValue: (p: AnnualPnL) => number | string;
  format: "currency" | "percent" | "multiple" | "raw";
  bold?: boolean;
  indent?: boolean;
  dscrRow?: boolean;
};

export function BankPnLSection() {
  const { t, locale } = useTranslation();
  const { model } = useModelStore();
  if (!model) return null;

  const realistic = model.scenarios.realistic.pnl;
  const upside = model.scenarios.upside.pnl;
  const downside = model.scenarios.downside.pnl;
  const years = realistic.map((p) => p.year);

  const sampleYear = realistic.find((p) => p.propertyBreakdown.length > 0);
  const portfolioShape = sampleYear?.propertyBreakdown ?? [];

  const rows: RowDef[] = [];

  // Revenue lines — per property
  for (const prop of portfolioShape) {
    rows.push({
      label: prop.count > 1 ? `${prop.name} (×${prop.count})` : prop.name,
      getValue: (p) => {
        const pb = p.propertyBreakdown.find((b) => b.id === prop.id);
        return pb ? (prop.count > 1 ? pb.totalRevenue : pb.revenuePerUnit) : 0;
      },
      format: "currency",
      indent: true,
    });
  }

  rows.push(
    { label: t('pnl.events'), getValue: (p) => p.revenueEvents, format: "currency", indent: true },
    { label: t('pnl.ancillary'), getValue: (p) => p.revenueAncillary, format: "currency", indent: true },
    { label: t('pnl.totalRevenue'), getValue: (p) => p.totalRevenue, format: "currency", bold: true },
    { label: t('pnl.totalOpex'), getValue: (p) => p.totalOpex, format: "currency", bold: false },
    { label: t('term.ebitda'), getValue: (p) => p.ebitda, format: "currency", bold: true },
    { label: t('term.ebitdaMargin'), getValue: (p) => p.ebitdaMargin, format: "percent" },
    { label: t('pnl.termLoanInterest'), getValue: (p) => p.termLoanInterest, format: "currency", indent: true },
    { label: t('pnl.termLoanPrincipal'), getValue: (p) => p.termLoanPrincipal, format: "currency", indent: true },
    { label: t('pnl.debtService'), getValue: (p) => p.debtService, format: "currency", bold: true },
    { label: t('pnl.ncfPostVAT'), getValue: (p) => p.netCashFlowPostVAT, format: "currency", bold: true },
    { label: t('pnl.termLoanBalance'), getValue: (p) => p.termLoanBalance, format: "currency", indent: true },
    // DSCR row (realistic) — colored
    { label: `${t('term.dscr')} (Realistic)`, getValue: (p) => p.dscr, format: "multiple", bold: true, dscrRow: true },
    // Upside DSCR
    { label: `${t('term.dscr')} (Upside)`, getValue: (p) => {
        const u = upside.find((u) => u.year === p.year);
        return u?.dscr ?? 0;
      }, format: "multiple", indent: true, dscrRow: true },
    // Downside DSCR
    { label: `${t('term.dscr')} (Downside)`, getValue: (p) => {
        const d = downside.find((d) => d.year === p.year);
        return d?.dscr ?? 0;
      }, format: "multiple", indent: true, dscrRow: true },
  );

  const fmt = (val: number | string, row: RowDef): string => {
    if (typeof val === "string") return val;
    if (val === 0) return "—";
    switch (row.format) {
      case "currency": return formatCurrency(val, true, locale);
      case "percent": return formatPercent(val);
      case "multiple": return formatMultiple(val);
      default: return String(val);
    }
  };

  const dscrColor = (val: number | string): string => {
    if (typeof val !== "number" || val === 0) return "";
    if (val >= 1.25) return "text-positive font-semibold";
    if (val > 0) return "text-warning font-semibold";
    return "";
  };

  const phaseLabel = (year: number) =>
    year <= 2027 ? "Dev" : year === 2028 ? "Ramp · grace" : year === 2029 ? "Ramp · full DS" : "Stab.";

  return (
    <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-hidden">
      <div className="px-6 pt-5 pb-3 border-b border-surface-tertiary">
        <h3 className="text-sm font-semibold text-text-primary">
          {t('pnl.title')} — Bank View (Realistic Scenario)
        </h3>
        <p className="text-xs text-text-tertiary mt-0.5">
          Year-by-year P&amp;L with DSCR across all three scenarios
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface-secondary/40">
              <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium sticky left-0 bg-surface-secondary/40 min-w-[200px] z-10">
                Line
              </th>
              {years.map((yr) => {
                const tone =
                  yr <= 2027
                    ? "border-t-4 border-earth-terracotta/60"
                    : yr <= 2029
                      ? "border-t-4 border-warning/60"
                      : "border-t-4 border-positive/60";
                return (
                  <th
                    key={yr}
                    className={`text-right py-2.5 px-2 text-xs uppercase tracking-wider text-text-tertiary font-medium min-w-[80px] ${tone}`}
                  >
                    {yr}
                  </th>
                );
              })}
            </tr>
            <tr className="border-b border-surface-tertiary">
              <td className="py-1 px-4 text-xs text-text-tertiary sticky left-0 bg-white z-10">Phase</td>
              {years.map((yr) => (
                <td key={yr} className="text-right py-1 px-2 text-xs text-text-tertiary">{phaseLabel(yr)}</td>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={ri}
                className={`border-t border-surface-secondary/40 ${row.bold ? "bg-surface-secondary/30 font-medium" : ""}`}
              >
                <td
                  className={`py-2 px-4 sticky left-0 z-10 ${
                    row.bold ? "bg-surface-secondary/30 font-medium text-text-primary" : "bg-white text-text-secondary"
                  } ${row.indent ? "pl-8" : ""}`}
                >
                  {row.label}
                </td>
                {realistic.map((p) => {
                  const val = row.getValue(p);
                  const display = fmt(val, row);
                  const numVal = typeof val === "number" ? val : 0;

                  let colorClass = "";
                  if (row.dscrRow) {
                    colorClass = dscrColor(val);
                  } else if (row.format === "currency" && row.bold) {
                    colorClass = numVal >= 0 ? "text-positive" : "text-negative";
                  }

                  return (
                    <td
                      key={p.year}
                      className={`text-right py-2 px-2 font-mono ${colorClass}`}
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
      <div className="px-6 py-3 border-t border-surface-tertiary bg-surface-secondary/20">
        <p className="text-xs text-text-tertiary">
          {t('bank.pnlFooterNote')}
        </p>
      </div>
    </div>
  );
}
