"use client";

import { useEffect, useState } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { optimaCapexView } from "@/lib/engine/optimaView";
import { computeOptimaCapResult } from "@/lib/engine/model";
import type { OptimaCapResult } from "@/lib/engine/model";
import { BankPnLSection } from "@/components/BankPnLSection";
import { SourcesUsesPanel } from "@/components/SourcesUsesPanel";
import { BankStressTest } from "@/components/BankStressTest";
import { ConstructionVatCashflow } from "@/components/ConstructionVatCashflow";
import { useEuribor } from "@/lib/hooks/useEuribor";
import Link from "next/link";

type TabSide = 'A' | 'B';

function MetricCell({
  value,
  label,
  sublabel,
  valueClass,
}: {
  value: string;
  label: string;
  sublabel?: string;
  valueClass?: string;
}) {
  return (
    <div className="text-center px-2">
      <div className={`kpi-value ${valueClass ?? "text-text-primary"}`}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary mt-2">
        {label}
      </div>
      {sublabel && (
        <div className="text-xs text-text-tertiary mt-0.5">{sublabel}</div>
      )}
    </div>
  );
}

export default function OptimaPage() {
  const { t, locale } = useTranslation();
  const { model, assumptions, setFinancingPathOverride, setOptimaEuriborRate } = useModelStore();
  const [activeTab, setActiveTab] = useState<TabSide>('A');

  // Override financing path to 'optima' for the duration of this page.
  // The layout sets 'commercial' on mount; this overrides that.
  useEffect(() => {
    setFinancingPathOverride("optima");
    return () => {
      setFinancingPathOverride("commercial");
    };
  }, [setFinancingPathOverride]);

  // Live Euribor feed (client-side, ECB SDMX)
  const euribor = useEuribor();
  useEffect(() => {
    if (euribor.rate !== null) setOptimaEuriborRate(euribor.rate);
  }, [euribor.rate, setOptimaEuriborRate]);

  if (!model) {
    return (
      <div className="flex items-center justify-center h-96 text-text-tertiary">
        {t("common.loading")}
      </div>
    );
  }

  const optimaLoan = assumptions.optimaLoan ?? {
    euriborRate: 0.025,
    spreadBps: 250,
    totalTermYears: 12,
    gracePeriodYears: 2,
    repaymentYears: 10,
    splitThresholdEur: 6_000_000,
    absorb: { serviceProviders: true, contingency: true },
  };

  const optimaScenario = model.optimaScenario;
  const allocation = assumptions.optimaLoan?.subProjectAllocation ?? {};
  const portfolioProjects = model.capex.properties;
  const totalCapex = model.capex.portfolioTotal;

  // Translated CAPEX view — absorbs service providers + contingency into construction
  const optimaCapex = optimaCapexView(model.capex, optimaLoan.absorb);

  // Construction ratio cap result (Optima-specific, admin-only — not displayed on bank view)
  const capResult: OptimaCapResult | null = optimaLoan
    ? computeOptimaCapResult(model.capex, optimaLoan)
    : null;

  // Effective interest rate = Euribor + spread
  const effectiveRate = optimaLoan.euriborRate + optimaLoan.spreadBps / 10000;
  const effectiveRatePct = effectiveRate * 100;
  const repayYears = optimaLoan.repaymentYears ?? 10;
  const dscrCovenant = assumptions.dscrCovenantThreshold ?? 1.25;

  // Portfolio-level optima loan total (for shared sections)
  const graceEndYear = 2026 + optimaLoan.gracePeriodYears;
  const optimaLoanAmountFromScenario = optimaScenario?.pnl.find(
    (p) => p.year === graceEndYear
  )?.termLoanBalance ?? 0;
  const optimaLoanAmount =
    optimaLoanAmountFromScenario > 0 ? optimaLoanAmountFromScenario : totalCapex * 0.75;

  // ── Per-tab data computation ──
  // This function derives all display values for a given sub-project side.
  // Pure computation — no state mutations.
  function getTabData(side: TabSide) {
    // Projects assigned to this side
    const tabProjects = portfolioProjects.filter(
      (p) => (allocation[p.id] ?? 'B') === side
    );

    // Total CAPEX for this sub-project (all categories combined)
    // capResult.subProjectTotalsPreCap sums ALL translated categories, not just construction.
    const tabCapexTotal =
      capResult?.subProjectTotalsPreCap[side] ?? totalCapex / 2;

    // CAPEX weight for P&L proportioning
    const capexRatio = totalCapex > 0 ? tabCapexTotal / totalCapex : 0.5;

    // Sub-project loan (already respects 60% construction cap + €6M per-project threshold)
    const tabLoan = capResult?.subProjectLoans[side] ?? optimaLoanAmount / 2;

    // Annual debt service via PMT: (PV × r) / (1 − (1+r)^−n)
    const tabAnnualDS =
      repayYears > 0 && effectiveRate > 0 && tabLoan > 0
        ? (tabLoan * effectiveRate) / (1 - Math.pow(1 + effectiveRate, -repayYears))
        : 0;

    // Annual interest component (for ICR)
    const tabInterestAnnual = tabLoan * effectiveRate;

    // Stabilised P&L scaled by CAPEX weight (revenue and EBITDA scale with asset share)
    const stabYear = optimaScenario?.stabilisedYear;
    const tabRevenue = stabYear ? stabYear.totalRevenue * capexRatio : 0;
    const tabEbitda = stabYear ? stabYear.ebitda * capexRatio : 0;
    const tabEbitdaMargin = stabYear?.ebitdaMargin ?? 0; // margin stays the same
    const tabDSCR =
      tabAnnualDS > 0 && tabEbitda > 0 ? tabEbitda / tabAnnualDS : 0;
    const tabICR =
      tabInterestAnnual > 0 && tabEbitda > 0 ? tabEbitda / tabInterestAnnual : 0;
    const tabNCF = stabYear ? stabYear.netCashFlowPostVAT * capexRatio : 0;

    // Per-tab CAPEX rows: filter each category's perProperty by side, then sum
    const tabCapexRows = optimaCapex.categories
      .map((cat) => {
        const catTotal = cat.perProperty
          .filter((pp) => (allocation[pp.id] ?? 'B') === side)
          .reduce((s, pp) => s + pp.total, 0);
        return { name: cat.name, total: catTotal };
      })
      .filter((r) => r.total > 0);

    return {
      tabProjects,
      tabCapexTotal,
      capexRatio,
      tabLoan,
      tabAnnualDS,
      tabRevenue,
      tabEbitda,
      tabEbitdaMargin,
      tabDSCR,
      tabICR,
      tabNCF,
      tabCapexRows,
    };
  }

  const tabData = getTabData(activeTab);
  const dscrPass = tabData.tabDSCR >= dscrCovenant;

  const tabLabels: Record<TabSide, string> = {
    A: t("bank.optima.project1"),
    B: t("bank.optima.project2"),
  };

  // Term Sheet cells — scoped to active sub-project
  const termSheetCells = [
    {
      label: t("kpi.loanAmount"),
      value: formatCurrency(tabData.tabLoan, true, locale),
    },
    {
      label: t("dash.termsheet.term"),
      value: t("bank.optima.loanTerm"),
      sub: t("bank.optima.rateNote"),
      isText: true,
    },
    {
      label: t("dash.termsheet.rate"),
      value: `${effectiveRatePct.toFixed(2)}%`,
      sub: `Euribor ${(optimaLoan.euriborRate * 100).toFixed(2)}% + ${(optimaLoan.spreadBps / 100).toFixed(2)}%`,
    },
    {
      label: t("kpi.ltvAtCompletion"),
      value:
        tabData.tabCapexTotal > 0
          ? formatPercent(tabData.tabLoan / tabData.tabCapexTotal, 0)
          : "—",
    },
    {
      label: t("term.dscr"),
      value: tabData.tabDSCR > 0 ? formatMultiple(tabData.tabDSCR) : "—",
      sub: `Covenant ≥ ${dscrCovenant.toFixed(2)}×`,
      tone: dscrPass ? ("positive" as const) : ("warning" as const),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 print:px-0 print:py-2 print:max-w-none animate-fade-in">

      {/* ── Back to admin ── */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link
          href={`/admin/assumptions?lang=${locale}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-tertiary hover:text-brand-600 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t('common.back')} Admin
        </Link>
      </div>

      {/* ── Hero (shared) ── */}
      <div className="text-center mb-8 print:mb-4">
        <p className="text-sm text-brand-500 font-medium uppercase tracking-widest mb-3 print:mb-1">
          {t("bank.optima.eyebrow")}
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-text-primary mb-3 print:text-3xl">
          {t("app.title")}
        </h1>
        <p className="text-sm text-text-secondary mt-1 max-w-xl mx-auto text-center">
          {t("bank.pageIntro")}
        </p>
        <p className="text-text-secondary max-w-xl mx-auto">
          Optima Bank &middot; {t("app.confidential")}
        </p>
      </div>

      {/* ── Live Euribor badge (shared) ── */}
      <div className="flex justify-center -mt-2 mb-6">
        {euribor.status === 'loading' && (
          <span className="text-xs text-text-tertiary">Fetching live Euribor…</span>
        )}
        {euribor.status === 'live' && euribor.rate !== null && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-positive/10 text-positive border border-positive/20">
            <span className="w-1.5 h-1.5 rounded-full bg-positive inline-block" />
            Live 3M Euribor: {(euribor.rate * 100).toFixed(2)}% · ECB · {euribor.date}
          </span>
        )}
        {euribor.status === 'error' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            Live rate unavailable — using {((optimaLoan?.euriborRate ?? 0.025) * 100).toFixed(2)}%
          </span>
        )}
      </div>

      {/* ── Tab selector ── */}
      <div className="flex border-b border-surface-tertiary mb-6 print:hidden" role="tablist">
        {(['A', 'B'] as TabSide[]).map((side) => (
          <button
            key={side}
            role="tab"
            aria-selected={activeTab === side}
            onClick={() => setActiveTab(side)}
            className={[
              "px-6 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors focus:outline-none",
              activeTab === side
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-text-tertiary hover:text-text-secondary hover:border-surface-tertiary",
            ].join(" ")}
          >
            {tabLabels[side]}
          </button>
        ))}
        {/* Print: show active tab label */}
        <div className="hidden print:block text-sm font-semibold text-brand-600 pb-2 border-b-2 border-brand-500 px-6">
          {tabLabels[activeTab]}
        </div>
      </div>

      {/* ── PER-TAB CONTENT ── */}

      {/* Projects in this sub-project */}
      {tabData.tabProjects.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {tabData.tabProjects.map((p) => (
            <span
              key={p.id}
              className="px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-xs font-medium border border-brand-100"
            >
              {p.name}
            </span>
          ))}
        </div>
      )}

      {/* Term Sheet strip */}
      <div className="mb-6" id="optima-term-sheet">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          {t("bank.section.termsheet")}
        </h3>
        <div className="bg-white rounded-xl border border-surface-tertiary shadow-sm overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-surface-tertiary">
            {termSheetCells.map((c, i) => (
              <div
                key={c.label}
                className={[
                  "flex flex-col gap-0.5 px-4 py-4",
                  i === 0 ? "pl-5" : "",
                  i === termSheetCells.length - 1 ? "pr-5" : "",
                  c.tone === "positive" ? "bg-positive/[0.03]" : "",
                  c.tone === "warning" ? "bg-warning/[0.04]" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary mb-0.5 leading-none">
                  {c.label}
                </span>
                <span
                  className={[
                    "leading-tight",
                    c.isText
                      ? "font-semibold text-sm text-text-primary"
                      : `font-mono font-bold text-xl ${
                          c.tone === "positive"
                            ? "text-positive"
                            : c.tone === "warning"
                            ? "text-warning"
                            : "text-text-primary"
                        }`,
                  ].join(" ")}
                >
                  {c.value}
                </span>
                {c.sub && (
                  <span className="text-[11px] text-text-tertiary leading-snug">{c.sub}</span>
                )}
                {c.tone && (
                  <span
                    className={[
                      "self-start inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1",
                      c.tone === "positive"
                        ? "bg-positive/15 text-positive"
                        : "bg-warning/15 text-warning",
                    ].join(" ")}
                  >
                    <span className="w-1 h-1 rounded-full bg-current" aria-hidden="true" />
                    {dscrPass ? t("dash.termsheet.pass") : t("dash.termsheet.fail")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CAPEX table — filtered to this sub-project */}
      <div className="mb-6" id="optima-capex">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          {t("capex.title")} — {t("bank.capex.useOfProceeds")}
        </h3>
        <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-secondary/40">
                  <th className="text-left py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium whitespace-nowrap">
                    {t("capex.costCategory")}
                  </th>
                  <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium whitespace-nowrap">
                    {t("capex.total")}
                  </th>
                  <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium whitespace-nowrap">
                    {formatPercent(1, 0)} {t("kpi.ofTotal")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {tabData.tabCapexRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-text-tertiary text-xs">
                      {t("common.loading")}
                    </td>
                  </tr>
                ) : (
                  tabData.tabCapexRows.map((row, i) => (
                    <tr
                      key={row.name}
                      className={`border-t border-surface-secondary/60 ${
                        i % 2 === 0 ? "" : "bg-surface-secondary/10"
                      }`}
                    >
                      <td className="py-2.5 px-5 text-text-secondary whitespace-nowrap">
                        {row.name}
                      </td>
                      <td className="text-right py-2.5 px-5 font-mono text-sm font-medium text-text-primary">
                        {formatCurrency(row.total, false, locale)}
                      </td>
                      <td className="text-right py-2.5 px-5 font-mono text-sm text-text-secondary">
                        {tabData.tabCapexTotal > 0
                          ? formatPercent(row.total / tabData.tabCapexTotal, 0)
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
                <tr className="border-t-2 border-surface-tertiary bg-surface-secondary/30 font-semibold">
                  <td className="py-3.5 px-5 text-text-primary">{t("capex.totalCapex")}</td>
                  <td className="text-right py-3.5 px-5 font-mono text-brand-600">
                    {formatCurrency(tabData.tabCapexTotal, false, locale)}
                  </td>
                  <td className="text-right py-3.5 px-5 font-mono text-text-secondary">
                    100%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-surface-tertiary/50 bg-surface-secondary/10 text-[11px] text-text-tertiary italic">
            {t("bank.optima.capexNote")}
          </div>
        </div>
      </div>

      {/* Loan Metrics strip — per sub-project */}
      <div
        className="bg-white rounded-xl border border-surface-tertiary p-6 shadow-md mb-6"
        id="optima-loan-metrics"
      >
        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-primary border-b border-surface-tertiary pb-2 mb-4">
          {t("bank.section.loanMetrics")}
        </h3>
        <div className="grid grid-cols-3 divide-x divide-surface-tertiary mb-4">
          <MetricCell
            value={formatCurrency(tabData.tabCapexTotal, true, locale)}
            label={t("kpi.totalInvestment")}
          />
          <MetricCell
            value={formatCurrency(tabData.tabLoan, true, locale)}
            label={t("kpi.loanAmount")}
            sublabel={`${
              tabData.tabCapexTotal > 0
                ? formatPercent(tabData.tabLoan / tabData.tabCapexTotal, 0)
                : "—"
            } ${t("bank.kpi.ofCapex")}`}
            valueClass="text-brand-600"
          />
          <MetricCell
            value={
              tabData.tabAnnualDS > 0
                ? formatCurrency(tabData.tabAnnualDS, true, locale)
                : "—"
            }
            label={t("kpi.annualDS")}
            sublabel={t("bank.optima.loanTerm")}
          />
        </div>
        <div className="grid grid-cols-2 divide-x divide-surface-tertiary pt-4 border-t border-surface-tertiary">
          <MetricCell
            value={tabData.tabDSCR > 0 ? formatMultiple(tabData.tabDSCR) : "—"}
            label={t("term.dscr")}
            sublabel={t("inv.stabilisedOps")}
            valueClass={
              tabData.tabDSCR >= dscrCovenant ? "text-positive" : "text-warning"
            }
          />
          <MetricCell
            value={tabData.tabICR > 0 ? formatMultiple(tabData.tabICR) : "—"}
            label={t("kpi.icr")}
            sublabel={t("kpi.icrSub")}
          />
        </div>
      </div>

      {/* Stabilised year snapshot — scaled by CAPEX weight */}
      {optimaScenario?.stabilisedYear && (
        <div className="bg-white rounded-xl border border-surface-tertiary p-6 mb-6">
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            {t("bank.optima.stabilisedSnapshot")}
          </h3>
          <p className="text-xs text-text-tertiary mb-5">{t("bank.stabilisedOpsSub")}</p>
          <div className="space-y-4">
            {[
              {
                label: t("inv.annualRevenue"),
                value: formatCurrency(tabData.tabRevenue, true, locale),
              },
              {
                label: t("term.ebitda"),
                value: formatCurrency(tabData.tabEbitda, true, locale),
              },
              {
                label: t("term.ebitdaMargin"),
                value: formatPercent(tabData.tabEbitdaMargin),
              },
              {
                label: t("kpi.annualDS"),
                value: formatCurrency(tabData.tabAnnualDS, true, locale),
              },
              {
                label: t("term.dscr"),
                value: tabData.tabDSCR > 0 ? formatMultiple(tabData.tabDSCR) : "—",
                highlight: true,
              },
              {
                label: t("pnl.ncfPostVAT"),
                value: formatCurrency(tabData.tabNCF, true, locale),
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`flex justify-between items-center py-2 ${
                  item.highlight ? "bg-brand-50 -mx-3 px-3 rounded-lg" : ""
                }`}
              >
                <span className="text-sm text-text-secondary">{item.label}</span>
                <span
                  className={`data-cell font-medium ${
                    item.highlight ? "text-brand-600" : "text-text-primary"
                  }`}
                >
                  {item.value}
                </span>
              </div>
            ))}
            <p className="text-xs text-stone-500 mt-1 italic">{t("bank.optima.pnlProjection")}</p>
          </div>
        </div>
      )}

      {/* ── SHARED PORTFOLIO-LEVEL SECTIONS ── */}

      {/* Sources & Uses (total portfolio) */}
      <SourcesUsesPanel
        km={{
          loanAmount: optimaLoanAmount,
          equityRequired: totalCapex - optimaLoanAmount,
          grantAmount: 0,
        }}
        capexCategories={optimaCapex.categories}
        wc={{
          facilitySize: optimaScenario?.wcMinimumFacility ?? 0,
          internalCashBuffer: assumptions.workingCapital.internalCashBuffer ?? 100000,
        }}
        locale={locale}
      />

      {/* P&L Timeline */}
      <div className="mb-6" id="optima-pnl">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          {t("pnl.title")}
        </h3>
        <BankPnLSection />
      </div>

      {/* Construction VAT Cashflow */}
      <div className="mb-6">
        <ConstructionVatCashflow />
      </div>

      {/* Cash-Flow Stress Test */}
      <div className="mb-6 print:hidden" id="optima-stress">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          {t("bank.section.stressAnalysis")}
        </h3>
        <h4 className="text-sm font-semibold text-text-primary mb-3">
          {t("bank.stress.cashFlowHeading")}
        </h4>
        <BankStressTest />
      </div>

      {/* Sub-project boundary disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900 leading-relaxed mb-6">
        {t("bank.optima.splitDisclaimer")}
      </div>

      {/* Footer */}
      <div className="text-center py-8 border-t border-surface-tertiary">
        <p className="text-xs text-text-tertiary">
          {t("app.title")} &middot; {t("app.location")} &middot; {t("app.confidential")}
        </p>
        <p className="text-[11px] text-text-tertiary mt-1 italic">
          {t("bank.optima.capexNote")}
        </p>
      </div>
    </div>
  );
}
