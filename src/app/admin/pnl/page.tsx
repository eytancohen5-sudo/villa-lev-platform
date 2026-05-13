"use client";

import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { AnnualPnL } from "@/lib/engine/types";
import { PageTour, TourButton, usePageTour } from "@/components/PageTour";
import { PageSkeleton } from "@/components/Skeleton";
import { PNL_TOUR } from "@/lib/tours/configs";

type RowDef = {
  label: string;
  getValue: (p: AnnualPnL) => number;
  format: "currency" | "percent" | "multiple" | "number";
  bold?: boolean;
  color?: "negative" | "dynamic";
  indent?: boolean;
  anchorId?: string;
  // For multiple-format rows: threshold above which the cell is coloured
  // positive (green). DSCR uses 1.25×; ICR conventionally uses 2×.
  goodAt?: number;
};

export default function PnLPage() {
  const { t, locale } = useTranslation();
  const { model, activeScenario } = useModelStore();
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(PNL_TOUR.storageKey);

  if (!model) return <PageSkeleton variant="table" />;

  const pnl = model.scenarios[activeScenario].pnl;
  const scenarioLabel = activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1);

  // Get property breakdown from first operational year to know the portfolio shape
  const sampleYear = pnl.find((p) => p.propertyBreakdown.length > 0);
  const portfolioShape = sampleYear?.propertyBreakdown ?? [];

  // Build rows dynamically based on portfolio
  // Order: revenue lines → Total Revenue → opex lines → Total OPEX → EBITDA →
  // EBITDA margin → Debt Service → NCF (pre-tax) → VAT → CIT → NCF post-tax →
  // Cumulative NCF → DSCR
  const rows: RowDef[] = [];

  // Revenue rows — one per property in portfolio
  for (const prop of portfolioShape) {
    const propId = prop.id;
    if (prop.count > 1) {
      rows.push({
        label: `${prop.name} (×${prop.count})`,
        getValue: (p) => {
          const pb = p.propertyBreakdown.find((b) => b.id === propId);
          return pb ? pb.totalRevenue : 0;
        },
        format: "currency",
        indent: true,
      });
    } else {
      rows.push({
        label: prop.name,
        getValue: (p) => {
          const pb = p.propertyBreakdown.find((b) => b.id === propId);
          return pb ? pb.revenuePerUnit : 0;
        },
        format: "currency",
        indent: true,
      });
    }
  }

  const ancillaryEverCapped = pnl.some((p) => p.revenueAncillaryCapped);

  rows.push(
    { label: t('pnl.events'), getValue: (p) => p.revenueEvents, format: "currency", indent: true },
    {
      label: ancillaryEverCapped ? t('pnl.ancillaryCapped') : t('pnl.ancillary'),
      getValue: (p) => p.revenueAncillary,
      format: "currency",
      indent: true,
    },
    { label: t('pnl.totalRevenue'), getValue: (p) => p.totalRevenue, format: "currency", bold: true, anchorId: "pnl-row-totalRevenue" },
  );

  // OPEX rows — one per property (label matches the revenue side)
  for (const prop of portfolioShape) {
    const propId = prop.id;
    const label = prop.count > 1 ? `${prop.name} (×${prop.count})` : prop.name;
    rows.push({
      label,
      getValue: (p) => {
        const pb = p.propertyBreakdown.find((b) => b.id === propId);
        return pb ? pb.totalOpex : 0;
      },
      format: "currency",
      indent: true,
    });
  }

  rows.push(
    { label: t('pnl.wcInterest'), getValue: (p) => p.wcInterestExpense, format: "currency", color: "negative", indent: true },
    { label: t('pnl.totalOpex'), getValue: (p) => p.totalOpex, format: "currency", bold: true },
    { label: t('term.ebitda'), getValue: (p) => p.ebitda, format: "currency", bold: true },
    { label: t('term.ebitdaMargin'), getValue: (p) => p.ebitdaMargin, format: "percent" },
    { label: t('pnl.debtService'), getValue: (p) => p.debtService, format: "currency", color: "negative", anchorId: "pnl-row-debtService" },
    { label: t('pnl.termLoanInterest'), getValue: (p) => p.termLoanInterest, format: "currency", color: "negative", indent: true },
    { label: t('pnl.termLoanPrincipal'), getValue: (p) => p.termLoanPrincipal, format: "currency", color: "negative", indent: true },
    { label: t('pnl.termLoanBalance'), getValue: (p) => p.termLoanBalance, format: "currency", indent: true },
    { label: t('term.ncfFull'), getValue: (p) => p.netCashFlow, format: "currency", bold: true, color: "dynamic" },
    { label: t('term.vatPayable'), getValue: (p) => p.vatPayable, format: "currency", color: "negative" },
    { label: t('term.citPayable'), getValue: (p) => p.citPayable, format: "currency", color: "negative" },
    { label: t('pnl.profitAfterTax'), getValue: (p) => p.profitAfterTax, format: "currency", bold: true, color: "dynamic" },
    { label: t('pnl.ncfPostVAT'), getValue: (p) => p.netCashFlowPostVAT, format: "currency", bold: true, color: "dynamic" },
    { label: t('pnl.cfads'), getValue: (p) => p.cfads, format: "currency", color: "dynamic" },
    { label: t('pnl.yieldOnEquity'), getValue: (p) => p.yieldOnInitialEquity, format: "percent", color: "dynamic", anchorId: "pnl-row-yieldOnEquity" },
    { label: t('pnl.totalYieldOnEquity'), getValue: (p) => p.cumulativeYieldOnInitialEquity, format: "percent", bold: true, color: "dynamic" },
    { label: t('pnl.cumulativeNCF'), getValue: (p) => p.cumulativeNCF, format: "currency", color: "dynamic" },
    { label: t('term.dscr'), getValue: (p) => p.dscr, format: "multiple", anchorId: "pnl-row-dscr", goodAt: 1.25 },
    { label: t('term.dscrLoaded'), getValue: (p) => p.dscrLoaded, format: "multiple", goodAt: 1.25 },
    { label: t('pnl.icr'), getValue: (p) => p.interestCoverageRatio, format: "multiple", goodAt: 2.0 },
    { label: t('pnl.wcAvg'), getValue: (p) => p.wcAvgBalance, format: "currency" },
    { label: t('pnl.wcPeak'), getValue: (p) => p.wcPeakBalance, format: "currency" },
    { label: t('pnl.wcNetContribution'), getValue: (p) => p.wcNetContribution, format: "currency", color: "dynamic" },
  );

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-text-primary">{t('pnl.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{scenarioLabel} &middot; {t('pnl.subtitle')}</p>
        </div>
        <TourButton onClick={() => setTourOpen(true)} pulsing={!!neverSeen} />
      </div>

      <div id="pnl-table" className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-hidden scroll-mt-24">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-secondary/40">
                <th className="text-left py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium sticky left-0 bg-surface-secondary/40 min-w-[200px] z-10">
                  {t('pnl.item')}
                </th>
                {pnl.map((p) => {
                  // Per-phase color band on the year header — helps the eye
                  // group dev / Y1-Y2 ramp / stabilised columns when scanning
                  // 11 years horizontally.
                  const phaseTone =
                    p.year <= 2027
                      ? 'border-t-4 border-earth-terracotta/60'
                      : p.year <= 2029
                        ? 'border-t-4 border-warning/60'
                        : 'border-t-4 border-positive/60';
                  return (
                    <th
                      key={p.year}
                      className={`text-right py-3 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium min-w-[95px] ${phaseTone}`}
                    >
                      {p.year}
                    </th>
                  );
                })}
              </tr>
              <tr>
                <td className="py-1.5 px-5 text-xs text-text-tertiary sticky left-0 bg-white z-10">{t('pnl.phase')}</td>
                {pnl.map((p) => (
                  <td key={p.year} className="text-right py-1.5 px-3 text-xs text-text-tertiary">{p.phase}</td>
                ))}
              </tr>
              <tr>
                <td className="py-1.5 px-5 text-xs text-text-tertiary sticky left-0 bg-white z-10">{t('pnl.villaNights')}</td>
                {pnl.map((p) => (
                  <td key={p.year} className="text-right py-1.5 px-3 text-xs text-text-tertiary font-mono">{p.villaNights > 0 ? p.villaNights.toLocaleString() : '—'}</td>
                ))}
              </tr>
              <tr className="border-b border-surface-tertiary">
                <td className="py-1.5 px-5 text-xs text-text-tertiary sticky left-0 bg-white z-10">{t('pnl.suiteNights')}</td>
                {pnl.map((p) => (
                  <td key={p.year} className="text-right py-1.5 px-3 text-xs text-text-tertiary font-mono">{p.suiteNights > 0 ? p.suiteNights.toLocaleString() : '—'}</td>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const isSection = row.bold;
                return (
                  <tr
                    key={ri}
                    id={row.anchorId}
                    className={`border-t border-surface-secondary/40 scroll-mt-24 ${isSection ? "bg-surface-secondary/30 font-medium" : ""}`}
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
                                  ? val >= (row.goodAt ?? 1.25)
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

      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={PNL_TOUR} />
    </div>
  );
}
