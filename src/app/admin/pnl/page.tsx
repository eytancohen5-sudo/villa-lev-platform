"use client";

import { useState } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { AnnualPnL } from "@/lib/engine/types";
import { PageTour, TourButton, usePageTour } from "@/components/PageTour";
import { Chevron } from "@/components/icons/Chevron";
import { PageSkeleton } from "@/components/Skeleton";
import { PNL_TOUR } from "@/lib/tours/configs";
import {
  DEFAULT_FOUNDER_MANCO_FEE_RATE,
  DEFAULT_GRANT_AMOUNT,
  DEFAULT_GRANT_PROCUREMENT_FEE_PCT,
  DEFAULT_GRANT_APPROVAL_YEAR,
  DEFAULT_GRANT_SUCCESS_FEE_PAYMENT_YEAR,
  DEFAULT_FEE_CASH_SPLIT_PCT,
} from "@/lib/engine/founderWaterfall";

type RowDef = {
  label: string;
  getValue: (p: AnnualPnL) => number;
  format: "currency" | "percent" | "multiple" | "number";
  bold?: boolean;
  color?: "negative" | "dynamic";
  indent?: boolean;
  anchorId?: string;
  /** Threshold above which a multiple cell is coloured positive */
  goodAt?: number;
  /** Section separator — shaded label row with optional expand toggle */
  separator?: boolean;
  /** Section key this separator controls */
  sectionKey?: string;
  /** Detail row — hidden when its section is collapsed */
  detail?: boolean;
  /** Which section this detail row belongs to */
  section?: string;
  /** Marks the equity distribution row for locale-safe gating indicator */
  isDistributionRow?: boolean;
};

export default function PnLPage() {
  const { t, locale } = useTranslation();
  const { model, activeScenario, assumptions } = useModelStore();
  // Hooks must be unconditional — placed before early return.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const grantApproved = assumptions.financingPath === "grant";
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(PNL_TOUR.storageKey);

  if (!model) return <PageSkeleton variant="table" />;

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const isExpanded = (key: string) => !!expanded[key];
  const anyExpanded = Object.values(expanded).some(Boolean);

  // Grant success fee — cash portion paid in a single year, post-DS (no DSCR impact).
  // Total cash = grant × 10% (fee) × 50% (cash split). Only shown on the grant path.
  const grantPaymentYear = assumptions.grantSuccessFeePaymentYear ?? DEFAULT_GRANT_SUCCESS_FEE_PAYMENT_YEAR;
  const grantFeeTotal = (model.keyMetrics.grantAmount ?? DEFAULT_GRANT_AMOUNT) * DEFAULT_GRANT_PROCUREMENT_FEE_PCT;
  const grantFeeTotalCash = grantFeeTotal * DEFAULT_FEE_CASH_SPLIT_PCT;

  const pnl = model.scenarios[activeScenario].pnl;
  const opCoActive = pnl.some((p: AnnualPnL) => p.opCoTotalFee !== 0);
  const scenarioLabel =
    activeScenario === 'upside' ? t('scenario.upside') :
    activeScenario === 'downside' ? t('scenario.downside') :
    activeScenario === 'breakeven' ? t('scenario.breakeven') :
    t('scenario.realistic');

  const sampleYear = pnl.find((p) => p.propertyBreakdown.length > 0);
  const portfolioShape = sampleYear?.propertyBreakdown ?? [];

  const ancillaryEverCapped = pnl.some((p) => p.revenueAncillaryCapped);

  const rows: RowDef[] = [];

  // ── Revenue ──────────────────────────────────────────────────────────────
  rows.push({ label: t('pnl.revenue'), getValue: () => 0, format: "currency", separator: true, sectionKey: "revenue" });

  for (const prop of portfolioShape) {
    const propId = prop.id;
    rows.push({
      label: prop.count > 1 ? `${prop.name} (×${prop.count})` : prop.name,
      getValue: (p) => {
        const pb = p.propertyBreakdown.find((b) => b.id === propId);
        return pb ? (prop.count > 1 ? pb.totalRevenue : pb.revenuePerUnit) : 0;
      },
      format: "currency",
      indent: true,
      detail: true,
      section: "revenue",
    });
  }

  rows.push(
    {
      label: ancillaryEverCapped ? t('pnl.ancillaryCapped') : t('pnl.ancillary'),
      getValue: (p) => p.revenueAncillary,
      format: "currency",
      indent: true,
      detail: true,
      section: "revenue",
    },
    { label: t('pnl.events'), getValue: (p) => p.revenueEvents, format: "currency", indent: true, detail: true, section: "revenue" },
    { label: t('pnl.grossRevenue'),      getValue: (p) => p.grossRevenue,    format: "currency", bold: true, anchorId: "pnl-row-grossRevenue" },
    { label: t('pnl.otaCommissions'),    getValue: (p) => p.otaCommissions,  format: "currency", color: "negative", indent: true },
    { label: t('pnl.netRevenuePostOTA'), getValue: (p) => p.totalRevenue,    format: "currency", bold: true, anchorId: "pnl-row-totalRevenue" },
  );

  // ── Operating costs ───────────────────────────────────────────────────────
  rows.push({ label: t('pnl.totalOpex'), getValue: () => 0, format: "currency", separator: true, sectionKey: "opex" });

  for (const prop of portfolioShape) {
    const propId = prop.id;
    rows.push({
      label: prop.count > 1 ? `${prop.name} (×${prop.count})` : prop.name,
      getValue: (p) => {
        const pb = p.propertyBreakdown.find((b) => b.id === propId);
        return pb ? pb.totalOpex : 0;
      },
      format: "currency",
      indent: true,
      color: "negative",
      detail: true,
      section: "opex",
    });
  }

  rows.push(
    { label: t('pnl.portfolioStaff'),      getValue: (p) => p.portfolioOpex?.staffTotal    ?? 0, format: "currency", color: "negative", indent: true, detail: true, section: "opex" },
    { label: t('pnl.portfolioServices'),   getValue: (p) => p.portfolioOpex?.servicesTotal  ?? 0, format: "currency", color: "negative", indent: true, detail: true, section: "opex" },
    { label: t('pnl.portfolioOverhead'),   getValue: (p) => p.portfolioOpex?.overheadTotal  ?? 0, format: "currency", color: "negative", indent: true, detail: true, section: "opex" },
    { label: t('pnl.portfolioPreOpening'), getValue: (p) => p.portfolioOpex?.preOpeningAmort ?? 0, format: "currency", color: "negative", indent: true, detail: true, section: "opex" },
    { label: t('pnl.totalOpex'), getValue: (p) => p.totalOpex, format: "currency", bold: true },
    { label: t('pnl.ffeReserve'), getValue: (p) => p.propertyBreakdown.reduce((s, b) => s + (b.ffeReservePerUnit ?? 0) * b.count, 0), format: "currency", color: "negative", indent: true },
    { label: t('pnl.gopPreMgmt'), getValue: (p) => p.ebitdaPreOpCo, format: "currency", bold: true },
    { label: t('term.ebitdaMargin'), getValue: (p) => p.totalRevenue > 0 ? (p.ebitdaPreOpCo ?? 0) / p.totalRevenue : 0, format: "percent" },
    { label: t('pnl.depreciation'), getValue: (p) => -(p.annualDepreciation ?? 0), format: "currency", color: "negative", indent: true },
    { label: t('pnl.ebit'), getValue: (p) => (p.ebitdaPreOpCo ?? 0) - (p.annualDepreciation ?? 0), format: "currency", bold: true },
  );

  // ── Finance (WC interest + term loan detail) ──────────────────────────────
  rows.push({ label: t('pnl.debtServiceSection'), getValue: () => 0, format: "currency", separator: true, sectionKey: "finance" });
  rows.push(
    { label: t('pnl.wcInterest'), getValue: (p) => p.wcInterestExpense, format: "currency", color: "negative", detail: false, section: "finance" },
  );

  // ── Debt service ──────────────────────────────────────────────────────────
  rows.push({ label: t('pnl.debtServiceSection'), getValue: () => 0, format: "currency", separator: true, sectionKey: "debtService" });
  rows.push(
    { label: t('pnl.termLoanInterest'),  getValue: (p) => p.termLoanInterest,  format: "currency", color: "negative", indent: true, detail: true, section: "debtService" },
    { label: t('pnl.termLoanPrincipal'), getValue: (p) => p.termLoanPrincipal, format: "currency", color: "negative", indent: true, detail: true, section: "debtService" },
    { label: t('pnl.termLoanBalance'),   getValue: (p) => p.termLoanBalance,   format: "currency", indent: true, detail: true, section: "debtService" },
    { label: t('pnl.dsraDraw'),         getValue: (p: AnnualPnL) => p.dsraDraw ?? 0,         format: "currency", indent: true, detail: true, section: "debtService" },
    { label: t('pnl.dsraBalance'),      getValue: (p: AnnualPnL) => p.dsraBalance ?? 0,      format: "currency", indent: true, detail: true, section: "debtService" },
    { label: t('pnl.partnerRepayment'), getValue: (p: AnnualPnL) => p.partnerRepayment ?? 0, format: "currency", color: "negative", indent: true, detail: true, section: "debtService" },
    { label: t('pnl.debtService'),       getValue: (p) => p.debtService,       format: "currency", color: "negative", anchorId: "pnl-row-debtService" },
    { label: t('pnl.postDsResidual'),   getValue: (p) => p.ebitdaPreOpCo - p.debtService, format: "currency", bold: true },
    ...(opCoActive ? [
      {
        label: t('pnl.opcoIncentiveFee'),
        getValue: (p: AnnualPnL) => p.opCoIncentiveFee,
        format: "currency" as const,
        color: "negative" as const,
        bold: true,
      },
    ] : []),
    {
      label: opCoActive ? `${t('term.ebitda')} ${t('pnl.netOfMgmtFees')}` : t('term.ebitda'),
      getValue: (p: AnnualPnL) => p.ebitda,
      format: "currency" as const,
      bold: true,
    },
    { label: t('pnl.profitBeforeTax'),   getValue: (p) => (p.ebitdaPreOpCo ?? 0) - (p.annualDepreciation ?? 0) - (p.termLoanInterest ?? 0) - (p.wcInterestExpense ?? 0), format: "currency", bold: true, color: "dynamic" },
  );

  // ── Tax & distributions ───────────────────────────────────────────────────
  rows.push({ label: t('pnl.cfadsBridge'), getValue: () => 0, format: "currency", separator: true, sectionKey: "tax" });
  rows.push(
    { label: t('term.vatPayable'),       getValue: (p) => p.vatPayable,                      format: "currency", color: "negative", detail: true, section: "tax" },
    { label: t('term.citPayable'),       getValue: (p) => p.citPayable,                      format: "currency", color: "negative", detail: true, section: "tax" },
    { label: t('term.taxLossGenerated'), getValue: (p) => -(p.taxLossGenerated ?? 0),        format: "currency", color: "negative", detail: true, section: "tax" },
    { label: t('term.taxLossUtilised'),  getValue: (p) => p.taxLossUtilised ?? 0,            format: "currency", color: "dynamic",  detail: true, section: "tax" },
    { label: t('term.taxLossPoolBalance'), getValue: (p) => p.taxLossPoolBalance ?? 0,       format: "currency",                    detail: true, section: "tax" },
    { label: t('pnl.profitAfterTax'),   getValue: (p) => p.profitAfterTax,                  format: "currency", bold: true, color: "dynamic" },
    { label: t('pnl.ncfPostVAT'),     getValue: (p) => p.netCashFlowPostVAT, format: "currency", bold: true, color: "dynamic" },
    {
      label: `Founder ManCo fee (${(DEFAULT_FOUNDER_MANCO_FEE_RATE * 100).toFixed(0)}% × revenue)`,
      getValue: (p) => -(p.totalRevenue * DEFAULT_FOUNDER_MANCO_FEE_RATE),
      format: "currency",
      color: "negative",
      indent: true,
      detail: true,
      section: "tax",
    },
    ...(grantApproved ? [{
      label: `Grant success fee — cash (Aggelakakis + Eytan, ${grantPaymentYear})`,
      getValue: (p: AnnualPnL) => p.year === grantPaymentYear ? -grantFeeTotalCash : 0,
      format: "currency" as const,
      color: "negative" as const,
      indent: true,
      detail: true,
      section: "tax",
    }] : []),
    {
      label: t('pnl.distributableToEquity'),
      isDistributionRow: true,
      getValue: (p) => {
        if (p.distributionGated) return 0;
        const manCo = p.totalRevenue * DEFAULT_FOUNDER_MANCO_FEE_RATE;
        const grantFee = (grantApproved && p.year === grantPaymentYear) ? grantFeeTotalCash : 0;
        return Math.max(0, p.netCashFlowPostVAT - manCo - grantFee);
      },
      format: "currency",
      bold: true,
      color: "dynamic",
    },
  );

  // ── Returns & ratios ──────────────────────────────────────────────────────
  rows.push({ label: t('pnl.coverageSection'), getValue: () => 0, format: "currency", separator: true, sectionKey: "returns" });
  rows.push(
    { label: t('pnl.cfads'),              getValue: (p) => p.cfads,                        format: "currency", color: "dynamic", detail: true, section: "returns" },
    { label: t('pnl.yieldOnEquity'),      getValue: (p) => p.yieldOnInitialEquity,          format: "percent",  color: "dynamic", anchorId: "pnl-row-yieldOnEquity", detail: true, section: "returns" },
    { label: t('pnl.totalYieldOnEquity'), getValue: (p) => p.cumulativeYieldOnInitialEquity,format: "percent",  bold: true, color: "dynamic", detail: true, section: "returns" },
    { label: t('pnl.cumulativeNCF'),      getValue: (p) => p.cumulativeNCF,                 format: "currency", color: "dynamic" },
    { label: t('term.dscr'),              getValue: (p) => p.dscr,                          format: "multiple", anchorId: "pnl-row-dscr", goodAt: 1.25, bold: true },
    { label: t('pnl.dscrCfads'),          getValue: (p) => p.debtService > 0 ? (p.cfads ?? 0) / p.debtService : 0, format: "multiple", goodAt: 1.25, bold: true },
    { label: t('pnl.effectiveDSCR'),      getValue: (p: AnnualPnL) => p.effectiveDSCR ?? p.dscr ?? 0, format: "multiple", bold: true, goodAt: assumptions?.dsra?.targetDSCR ?? 1.25, detail: true, section: "returns" },
    { label: t('term.dscrLoaded'),        getValue: (p) => p.dscrLoaded,                    format: "multiple", goodAt: 1.25, detail: true, section: "returns" },
    { label: t('pnl.icr'),               getValue: (p) => p.interestCoverageRatio,          format: "multiple", goodAt: 2.0,  detail: true, section: "returns" },
  );

  // ── Working capital ───────────────────────────────────────────────────────
  rows.push({ label: t('pnl.wcSection'), getValue: () => 0, format: "currency", separator: true, sectionKey: "wc" });
  rows.push(
    { label: t('pnl.wcAvg'),            getValue: (p) => p.wcAvgBalance,      format: "currency", detail: true, section: "wc" },
    { label: t('pnl.wcPeak'),           getValue: (p) => p.wcPeakBalance,     format: "currency", detail: true, section: "wc" },
    { label: t('pnl.wcNetContribution'),getValue: (p) => p.wcNetContribution, format: "currency", color: "dynamic", detail: true, section: "wc" },
  );

  const expandAll = () => {
    const keys = rows.filter((r) => r.sectionKey).map((r) => r.sectionKey as string);
    setExpanded(Object.fromEntries(keys.map((k) => [k, true])));
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 flex-wrap sticky top-[49px] z-10 bg-surface-primary pt-4 pb-4 mb-2 border-b border-surface-tertiary">
        <div>
          <h1 className="font-display text-2xl text-text-primary border-l-[3px] border-brand-400 pl-3">{t('pnl.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('pnl.pageIntro')}</p>
          <p className="text-sm text-text-secondary mt-1">
            {scenarioLabel} &middot; {t('pnl.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!anyExpanded ? (
            <button
              onClick={expandAll}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-brand-500 text-brand-600 hover:bg-brand-50 transition-colors"
            >
              {t('pnl.expandAll')}
            </button>
          ) : (
            <button
              onClick={() => setExpanded({})}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-surface-tertiary text-text-secondary hover:bg-surface-secondary/60 transition-colors"
            >
              {t('pnl.collapseAll')}
            </button>
          )}
          <TourButton onClick={() => setTourOpen(true)} pulsing={!!neverSeen} />
        </div>
      </div>

      <div id="pnl-table" className="bg-white rounded-xl border border-surface-tertiary overflow-hidden scroll-mt-24">
        <div className="overflow-auto max-h-[calc(100vh-180px)]">
          <table className="min-w-max text-sm">
            <thead>
              <tr className="bg-surface-secondary sticky top-0 z-30">
                <th className="text-left py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium sticky left-0 bg-surface-secondary min-w-[200px] z-30">
                  {t('pnl.item')}
                </th>
                {pnl.map((p) => {
                  const phaseTone =
                    p.year <= 2028
                      ? 'border-t-4 border-earth-terracotta/60'
                      : p.year <= 2031
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
              {rows.filter((r) => !r.detail || isExpanded(r.section ?? "")).map((row, ri) => {
                // Section separator
                if (row.separator) {
                  const hasToggle = !!row.sectionKey;
                  const open = hasToggle && isExpanded(row.sectionKey!);
                  return (
                    <tr key={ri} className="bg-surface-secondary">
                      <td colSpan={pnl.length + 1} className="py-0 sticky left-0 z-20">
                        {hasToggle ? (
                          <button
                            onClick={() => toggle(row.sectionKey!)}
                            className="w-full flex items-center justify-between py-2 pl-5 pr-4 text-[10px] uppercase tracking-wider text-text-tertiary font-semibold hover:bg-surface-secondary/80 transition-colors group"
                          >
                            <span className="flex items-center gap-1.5">
                              <Chevron open={open} />
                              {row.label}
                            </span>
                            <span className={`normal-case tracking-normal text-[10px] font-medium transition-colors ${open ? "text-brand-500" : "text-text-tertiary/60 group-hover:text-brand-400"}`}>
                              {open ? t('common.collapse') : t('common.expand')}
                            </span>
                          </button>
                        ) : (
                          <div className="py-2 pl-5 pr-4 text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">
                            {row.label}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                }

                // Data row
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
                      const isDistributionRow = row.isDistributionRow === true;
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
                          {isDistributionRow && p.distributionGated
                            ? (
                              <span className="flex items-center justify-end gap-1 text-text-tertiary" title={t('covenant.distributionGatedTooltip')}>
                                <svg width="10" height="12" viewBox="0 0 10 12" fill="none" aria-hidden="true" className="shrink-0">
                                  <rect x="1.5" y="5" width="7" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                                  <path d="M3.2 5V3.5a1.8 1.8 0 113.6 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                </svg>
                                <span className="font-mono">—</span>
                              </span>
                            )
                            : display
                          }
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

      {(model.scenarios[activeScenario]?.dsraTarget ?? 0) > 0 && (
        <p className="text-[11px] text-text-tertiary mt-3 px-1 leading-relaxed">
          {t('dsra.pnlCaption')}
        </p>
      )}

      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={PNL_TOUR} />
    </div>
  );
}
