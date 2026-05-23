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
  /** Section separator — renders a shaded label row, no data cells */
  separator?: boolean;
  dscrRow?: boolean;
  /** Negative values rendered in warning colour (costs / outflows) */
  outflow?: boolean;
};

export function BankPnLSection() {
  const { t, locale } = useTranslation();
  const { model, activeScenario } = useModelStore();
  if (!model) return null;

  // Use the active scenario for revenue / cost / EBITDA rows so the P&L
  // responds to the scenario pill selection in the control bar.
  const activePnl = model.scenarios[activeScenario as keyof typeof model.scenarios]?.pnl
    ?? model.scenarios.realistic.pnl;
  const upside   = model.scenarios.upside.pnl;
  const downside = model.scenarios.downside.pnl;
  const years = activePnl.map((p) => p.year);

  // Portfolio shape and OpCo detection use realistic (structure is scenario-invariant)
  const sampleYear = model.scenarios.realistic.pnl.find((p) => p.propertyBreakdown.length > 0);
  const portfolioShape = sampleYear?.propertyBreakdown ?? [];
  const opCoActive = model.scenarios.realistic.pnl.some((p) => p.opCoTotalFee !== 0);

  const rows: RowDef[] = [];

  // ── Revenue block ────────────────────────────────────────────────────────
  rows.push({ label: "Revenue", getValue: () => "", format: "raw", separator: true });

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
    { label: t('pnl.events'),       getValue: (p) => p.revenueEvents,    format: "currency", indent: true },
    { label: t('pnl.ancillary'),    getValue: (p) => p.revenueAncillary, format: "currency", indent: true },
    { label: t('pnl.totalRevenue'), getValue: (p) => p.totalRevenue,     format: "currency", bold: true },
  );

  // ── Operating costs ───────────────────────────────────────────────────────
  rows.push(
    { label: t('pnl.totalOpex'), getValue: (p) => p.totalOpex, format: "currency", outflow: true },
  );

  // ── OpCo management fee waterfall (only when active) ─────────────────────
  if (opCoActive) {
    rows.push(
      { label: "GOP / EBITDA pre-management fees", getValue: (p) => p.ebitdaPreOpCo, format: "currency", bold: true },
      { label: "OpCo base fee",      getValue: (p) => p.opCoBaseFee,      format: "currency", indent: true, outflow: true },
      { label: "OpCo brand fee",     getValue: (p) => p.opCoBrandFee,     format: "currency", indent: true, outflow: true },
      { label: "OpCo incentive fee", getValue: (p) => p.opCoIncentiveFee, format: "currency", indent: true, outflow: true },
      { label: "Total OpCo fees",    getValue: (p) => p.opCoTotalFee,     format: "currency", bold: false, outflow: true },
    );
  }

  // ── EBITDA ────────────────────────────────────────────────────────────────
  rows.push(
    {
      label: opCoActive ? `${t('term.ebitda')} (net of mgmt fees)` : t('term.ebitda'),
      getValue: (p) => p.ebitda,
      format: "currency",
      bold: true,
    },
    { label: t('term.ebitdaMargin'), getValue: (p) => p.ebitdaMargin, format: "percent" },
  );

  // ── CFADS bridge (EBITDA → CIT → CFADS) ──────────────────────────────────
  // Finding 3: CIT must be explicit so the CFADS arithmetic is visible.
  // Finding 2: CFADS must be disclosed — it is the DSCR numerator.
  rows.push({ label: "CFADS bridge", getValue: () => "", format: "raw", separator: true });
  rows.push(
    {
      label: "Corporate income tax (CIT)",
      getValue: (p) => p.citPayable,   // stored negative in engine
      format: "currency",
      indent: true,
      outflow: true,
    },
    {
      label: "CFADS (DSCR numerator)",
      getValue: (p) => p.cfads,
      format: "currency",
      bold: true,
    },
  );

  // ── Debt service block ────────────────────────────────────────────────────
  // Finding 4: term-loan balance moved INTO this block (before the DS total)
  // so the sequence reads: Interest → Principal → Closing Balance → Debt Service
  rows.push({ label: "Debt service", getValue: () => "", format: "raw", separator: true });
  rows.push(
    { label: t('pnl.termLoanInterest'),   getValue: (p) => p.termLoanInterest,   format: "currency", indent: true, outflow: true },
    { label: t('pnl.termLoanPrincipal'),  getValue: (p) => p.termLoanPrincipal,  format: "currency", indent: true, outflow: true },
    { label: "Loan balance (closing)",    getValue: (p) => p.termLoanBalance,    format: "currency", indent: true },
    { label: t('pnl.debtService'),        getValue: (p) => p.debtService,        format: "currency", bold: true, outflow: true },
  );

  // ── Coverage ratios ───────────────────────────────────────────────────────
  // Finding 7: rename "DSCR Realistic" → "DSCR — Base Case"
  // Finding 6: Upside/Downside DSCR kept but separated with a label so it is
  // clear these are sensitivity values, not a second set of revenue assumptions.
  rows.push({ label: "Coverage", getValue: () => "", format: "raw", separator: true });
  rows.push(
    {
      label: "DSCR — Base Case",
      getValue: (p) => p.dscr,
      format: "multiple",
      bold: true,
      dscrRow: true,
    },
    {
      label: "DSCR — Upside",
      getValue: (p) => upside.find((u) => u.year === p.year)?.dscr ?? 0,
      format: "multiple",
      indent: true,
      dscrRow: true,
    },
    {
      label: "DSCR — Downside",
      getValue: (p) => downside.find((d) => d.year === p.year)?.dscr ?? 0,
      format: "multiple",
      indent: true,
      dscrRow: true,
    },
    {
      label: "DSCR Loaded (incl. WC interest)",
      getValue: (p) => p.dscrLoaded,
      format: "multiple",
      indent: true,
      dscrRow: true,
    },
    {
      label: "ICR (interest coverage)",
      getValue: (p) => p.interestCoverageRatio,
      format: "multiple",
      indent: true,
      dscrRow: true,
    },
  );

  // ── Equity return (last, after all debt metrics) ──────────────────────────
  // Finding 5: NCF moved below DSCR; Finding 8: renamed to standard label.
  rows.push({ label: "Equity return", getValue: () => "", format: "raw", separator: true });
  rows.push({
    label: "Net Cash Flow to Equity",
    getValue: (p) => p.netCashFlowPostVAT,
    format: "currency",
    bold: true,
  });

  // ── Formatting helpers ────────────────────────────────────────────────────
  const fmt = (val: number | string, row: RowDef): string => {
    if (typeof val === "string") return val;
    if (val === 0) return "—";
    switch (row.format) {
      case "currency": return formatCurrency(val, true, locale);
      case "percent":  return formatPercent(val);
      case "multiple": return formatMultiple(val);
      default:         return String(val);
    }
  };

  const dscrColor = (val: number | string): string => {
    if (typeof val !== "number" || val === 0) return "";
    if (val >= 1.5)  return "text-positive font-semibold";
    if (val >= 1.25) return "text-brand-600 font-semibold";
    if (val >  0)    return "text-warning font-semibold";
    return "";
  };

  const phaseLabel = (year: number) =>
    year <= 2027 ? "Dev" : year === 2028 ? "Ramp · grace" : year === 2029 ? "Ramp · full DS" : "Stab.";

  return (
    <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-hidden">
      <div className="px-6 pt-5 pb-3 border-b border-surface-tertiary">
        <h3 className="text-sm font-semibold text-text-primary">
          {t('pnl.title')} — {{
            realistic: t('bank.bar.realistic'),
            upside:    t('bank.bar.upside'),
            downside:  t('bank.bar.downside'),
            breakeven: t('bank.bar.breakeven'),
          }[activeScenario] ?? t('bank.bar.realistic')} · Year-by-Year
        </h3>
        <p className="text-xs text-text-tertiary mt-0.5">
          Revenue, OpEx, and EBITDA reflect the selected scenario. DSCR sensitivity rows always show Upside and Downside for comparison.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface-secondary/40">
              <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium sticky left-0 bg-surface-secondary/40 min-w-[220px] z-10">
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
              <td className="py-1 px-4 text-xs text-text-tertiary sticky left-0 bg-white z-10">
                Phase
              </td>
              {years.map((yr) => (
                <td key={yr} className="text-right py-1 px-2 text-xs text-text-tertiary">
                  {phaseLabel(yr)}
                </td>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, ri) => {
              // Section separator row
              if (row.separator) {
                return (
                  <tr key={ri} className="bg-surface-secondary/60">
                    <td
                      colSpan={years.length + 1}
                      className="py-1.5 pl-4 pr-4 text-[10px] uppercase tracking-wider text-text-tertiary font-semibold sticky left-0"
                    >
                      {row.label}
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={ri}
                  className={`border-t border-surface-secondary/40 ${row.bold ? "bg-surface-secondary/20 font-medium" : ""}`}
                >
                  <td
                    className={`py-2 px-4 sticky left-0 z-10 ${
                      row.bold
                        ? "bg-surface-secondary/20 font-medium text-text-primary"
                        : "bg-white text-text-secondary"
                    } ${row.indent ? "pl-9" : ""}`}
                  >
                    {row.label}
                  </td>

                  {activePnl.map((p) => {
                    const val     = row.getValue(p);
                    const display = fmt(val, row);
                    const numVal  = typeof val === "number" ? val : 0;

                    let colorClass = "";
                    if (row.dscrRow) {
                      colorClass = dscrColor(val);
                    } else if (row.outflow && numVal !== 0) {
                      colorClass = "text-text-secondary";
                    } else if (row.format === "currency" && row.bold) {
                      colorClass = numVal >= 0 ? "text-positive" : "text-warning";
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
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 border-t border-surface-tertiary bg-surface-secondary/20">
        <p className="text-xs text-text-tertiary">
          {t('bank.pnlFooterNote')}
          {" "}CFADS = EBITDA + CIT (tax stored negative). DSCR Loaded includes WC
          facility interest. Scenario sensitivity rows (Upside / Downside) apply
          to the DSCR and coverage metrics only — revenue and cost lines above
          are Base Case.
        </p>
      </div>
    </div>
  );
}
