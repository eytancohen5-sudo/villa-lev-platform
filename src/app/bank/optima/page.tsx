"use client";

import { useEffect, useState } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { optimaCapexView } from "@/lib/engine/optimaView";
import { computeOptimaCapResult } from "@/lib/engine/model";
import type { OptimaCapResult } from "@/lib/engine/model";
import { BankPnLSection } from "@/components/BankPnLSection";
import { VillaMarketDrawer } from "@/components/VillaMarketDrawer";
import { SourcesUsesPanel } from "@/components/SourcesUsesPanel";
import { BankStressTest } from "@/components/BankStressTest";
import { ConstructionVatCashflow } from "@/components/ConstructionVatCashflow";
import { useEuribor } from "@/lib/hooks/useEuribor";
import { resolvePortfolio } from "@/lib/engine/defaults";
import { computeTotalKeysMaxSplit, computeTotalBedrooms, bedroomsForPlot, keysForPlot } from "@/lib/engine/bedroomKeys";
import { LiveTrackRecord } from "@/components/LiveTrackRecord";
import BankControlBar from "@/components/BankControlBar";
import { PageTour, usePageTour } from "@/components/PageTour";
import { BANK_TOUR } from "@/lib/tours/configs";
import { PRESENTATION_LABEL } from "@/lib/presentationMeta";
import { logPresenceActivity } from "@/lib/data/usePresence";
import Link from "next/link";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from "recharts";

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
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-secondary mt-2">
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
  const {
    model,
    assumptions,
    templates,
    projects,
    activeScenario,
    capTable,
    waterfall,
    setFinancingPathOverride,
    setOptimaEuriborRate,
  } = useModelStore();
  const [tourOpen, setTourOpen] = usePageTour(BANK_TOUR.storageKey);
  const [xlsxLoading, setXlsxLoading] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabSide>('A');
  const [villaSaleDrawerOpen, setVillaSaleDrawerOpen] = useState(false);

  const handleDownloadXlsx = async () => {
    if (!model || xlsxLoading) return;
    setXlsxLoading(true);
    void logPresenceActivity('excel_download');
    try {
      const { exportBusinessPlan } = await import('@/lib/excel/exportBP');
      const exportScenario = activeScenario === 'breakeven' ? 'realistic' : activeScenario;
      const blob = await exportBusinessPlan(
        { ...assumptions, viewMode: 'bank', financingPath: 'optima' },
        model,
        exportScenario,
        capTable,
        waterfall,
        locale,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `villa-lev-optima-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setXlsxLoading(false);
    }
  };

  const handleDownloadDocx = async () => {
    if (!model || docxLoading) return;
    setDocxLoading(true);
    try {
      const { exportBankPresentation } = await import('@/lib/docx/exportBankPresentation');
      const blob = await exportBankPresentation(
        { ...assumptions, viewMode: 'bank' },
        model,
        locale,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `villa-lev-optima-presentation-${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDocxLoading(false);
    }
  };

  // Override financing path to 'optima' for the duration of this page.
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
  const isUnallocated = Object.keys(allocation).length === 0;
  const portfolioProjects = model.capex.properties;
  const totalCapex = model.capex.portfolioTotal;

  // Build a count lookup so the per-unit helpers can split multi-unit projects.
  const propCountMap = Object.fromEntries(portfolioProjects.map(p => [p.id, p.count]));

  /** Resolve allocation side for one unit of a property (mirrors engine logic). */
  function unitSide(propId: string, unitIndex: number): 'A' | 'B' {
    return allocation[`${propId}__u${unitIndex}`] ?? allocation[propId] ?? 'B';
  }

  /** Expand portfolioProjects into per-unit display items for the chip list. */
  const portfolioUnits = portfolioProjects.flatMap(p =>
    Array.from({ length: p.count }, (_, i) => ({
      id: p.count > 1 ? `${p.id}__u${i}` : p.id,
      name: p.count > 1 ? `${p.name} ${i + 1}` : p.name,
      side: unitSide(p.id, i),
    }))
  );

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

  // ── Portfolio base (resolved from CAPEX model plots) ──
  // Source of truth: portfolioProjects (model.capex.properties) — the exact plots driving the
  // Optima loan. Joined with template-resolved data to get display fields (villaUnits, GIA…).
  const allResolvedPortfolio = resolvePortfolio(templates, projects);
  const resolvedById = Object.fromEntries(allResolvedPortfolio.map(p => [p.id, p]));
  const portfolio = portfolioProjects
    .map(capexProp => {
      const resolved = resolvedById[capexProp.id];
      return resolved ? { ...resolved, count: capexProp.count } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  // ── Per-tab data computation ──
  // This function derives all display values for a given sub-project side.
  // Pure computation — no state mutations.
  function getTabData(side: TabSide) {
    // Chip list: per-unit items so multi-unit projects appear as separate chips.
    const tabUnits = isUnallocated
      ? portfolioUnits
      : portfolioUnits.filter((u) => u.side === side);

    // Total CAPEX for this sub-project (all categories combined).
    // Engine already handles per-unit allocation via resolveUnitSide.
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

    // Per-tab CAPEX rows.
    // When unallocated: engine splits 50/50, show grandTotal/2 per category.
    // When allocated: split each perProperty entry proportionally by per-unit allocation.
    const tabCapexRows = isUnallocated
      ? optimaCapex.categories
          .map((cat) => ({ name: cat.name, total: cat.grandTotal / 2 }))
          .filter((r) => r.total > 0)
      : optimaCapex.categories
          .map((cat) => {
            const catTotal = cat.perProperty.reduce((s, pp) => {
              const count = propCountMap[pp.id] ?? 1;
              let sideUnits = 0;
              for (let i = 0; i < count; i++) {
                if (unitSide(pp.id, i) === side) sideUnits++;
              }
              return s + pp.perUnit * sideUnits;
            }, 0);
            return { name: cat.name, total: catTotal };
          })
          .filter((r) => r.total > 0);

    return {
      tabProjects: tabUnits,
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

  // ── Tab-scoped "About the project" variables ──
  // Only shows plots that are allocated to the ACTIVE tab.
  // baseIdOf strips per-unit suffixes (__u0, __u1…) back to the property root id.
  const baseIdOf = (uid: string) => uid.includes('__u') ? uid.split('__u')[0] : uid;
  const tabUnitCountById = tabData.tabProjects.reduce<Record<string, number>>(
    (acc, u) => { const b = baseIdOf(u.id); acc[b] = (acc[b] ?? 0) + 1; return acc; },
    {}
  );
  const tabPortfolio = portfolio
    .map(p => { const c = tabUnitCountById[p.id] ?? 0; return c > 0 ? { ...p, count: c } : null; })
    .filter((p): p is NonNullable<typeof p> => p !== null);
  const tabTotalPlots = tabPortfolio.reduce((s, p) => s + p.count, 0);
  const tabTotalVillas = tabPortfolio.reduce((s, p) => s + p.count * p.villaUnits, 0);
  const tabTotalStdSuites = tabPortfolio.reduce((s, p) => s + p.count * p.standardSuites, 0);
  const tabTotalDblSuites = tabPortfolio.reduce((s, p) => s + p.count * p.doubleSuites, 0);
  const tabTotalSuites = tabTotalStdSuites + tabTotalDblSuites;
  const tabTotalGIA = tabPortfolio.reduce((s, p) => s + p.count * (p.constructionArea ?? 0), 0);
  const tabTotalKeysMaxSplit = computeTotalKeysMaxSplit(tabPortfolio);
  const tabTotalBedrooms = computeTotalBedrooms(tabPortfolio);

  const dscrPass = tabData.tabDSCR >= dscrCovenant;

  const tabLabels: Record<TabSide, string> = {
    A: t("bank.optima.project1"),
    B: t("bank.optima.project2"),
  };

  // ── Ramp-year revenue haircut (Section 2) ──
  // Computed from optimaScenario PnL (or realistic fallback).
  // Amounts are then scaled by tabData.capexRatio so the callout is
  // proportional to the active sub-project.
  const optimaPnl = optimaScenario?.pnl ?? model.scenarios.realistic.pnl;
  const stabRev = optimaScenario?.stabilisedYear?.totalRevenue ?? 0;
  const pnlY1 = optimaPnl.find((p) => p.year === 2029);
  const pnlY2 = optimaPnl.find((p) => p.year === 2030);
  const year1HaircutPct = stabRev > 0 && pnlY1
    ? Math.round((1 - pnlY1.totalRevenue / stabRev) * 100) : 0;
  const year2HaircutPct = stabRev > 0 && pnlY2
    ? Math.round((1 - pnlY2.totalRevenue / stabRev) * 100) : 0;
  // Scale amounts to the active sub-project share
  const year1HaircutAmt = pnlY1
    ? (stabRev - pnlY1.totalRevenue) * tabData.capexRatio : 0;
  const year2HaircutAmt = pnlY2
    ? (stabRev - pnlY2.totalRevenue) * tabData.capexRatio : 0;

  const rampHaircutNote = stabRev > 0 ? (
    <div className="mt-4 rounded-xl border border-brand-400/30 bg-brand-50/60 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex-1 min-w-[200px]">
        <p className="text-xs font-semibold text-text-primary leading-snug mb-1">
          {t('bank.ramp.discountTitle')}
        </p>
        <p className="text-xs text-text-secondary leading-relaxed">
          {t('bank.ramp.discountBody')}
        </p>
      </div>
      <div className="flex gap-3 flex-shrink-0">
        {[
          { year: 2029, label: t('bank.chart.year1Label'), pct: year1HaircutPct, amt: year1HaircutAmt },
          { year: 2030, label: t('bank.chart.year2Label'), pct: year2HaircutPct, amt: year2HaircutAmt },
        ].map(({ year, label, pct, amt }) => (
          <div key={year} className="rounded-lg bg-white border border-surface-tertiary px-4 py-2.5 text-center min-w-[100px]">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">{label}</div>
            <div className="text-xl font-bold text-warning mt-0.5">-{pct}%</div>
            <div className="text-[10px] font-mono text-text-tertiary mt-0.5">
              {formatCurrency(amt, true, locale)} {t('bank.chart.belowStab')}
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const dscrChartData = (optimaScenario?.pnl ?? [])
    .filter((p) => p.year >= 2029)
    .map((p) => ({
      year: p.year,
      DSCR: Number(p.dscr.toFixed(2)),
    }));

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
    <>
    <BankControlBar />
    <div className="max-w-6xl mx-auto px-6 py-8 print:px-0 print:py-2 print:max-w-none animate-fade-in">

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

      {/* ── Quick Access ── */}
      <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50/60 to-white p-6 mb-8 print:hidden">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-500">
            {t('bank.actions.heading')}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">

          {/* Tour */}
          <button
            onClick={() => { void logPresenceActivity('tour_start'); setTourOpen(true); }}
            className="group relative flex flex-col gap-4 rounded-xl border border-surface-tertiary bg-white p-5 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 transition-all text-left w-full"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" className="text-brand-500"/>
                  <path d="M6 5.5l5 2.5-5 2.5V5.5z" fill="currentColor" className="text-brand-500"/>
                </svg>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-400 bg-brand-50 px-2 py-0.5 rounded-full">{t('bank.tourDuration')}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary leading-tight">{t('bank.actions.tour.title')}</p>
              <p className="text-xs text-text-tertiary mt-1 leading-relaxed">{t('bank.actions.tour.sub')}</p>
            </div>
          </button>

          {/* Presentation */}
          <a
            href={`/presentation?lang=${locale}&from=bank`}
            onClick={() => void logPresenceActivity('presentation_view')}
            className="group relative flex flex-col gap-4 rounded-xl border border-surface-tertiary bg-white p-5 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors shrink-0">
                <svg width="15" height="16" viewBox="0 0 15 16" fill="none" aria-hidden="true">
                  <path d="M2 1.5h7l4 4V14.5H2V1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" className="text-brand-500"/>
                  <path d="M9 1.5V5.5H13" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" className="text-brand-500"/>
                  <path d="M4.5 9h6M4.5 11.5h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" className="text-brand-400"/>
                </svg>
              </div>
              <span className="text-[10px] font-semibold tracking-wider text-brand-400 bg-brand-50 px-2 py-0.5 rounded-full">{PRESENTATION_LABEL}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary leading-tight">{t('bank.actions.presentation.title')}</p>
              <p className="text-xs text-text-tertiary mt-1 leading-relaxed">{t('bank.actions.presentation.sub')}</p>
            </div>
          </a>

          {/* Excel */}
          <button
            onClick={handleDownloadXlsx}
            disabled={!model || xlsxLoading}
            className="group relative flex flex-col gap-4 rounded-xl border border-surface-tertiary bg-white p-5 hover:border-emerald-300 hover:shadow-md hover:-translate-y-0.5 transition-all text-left w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3" className="text-emerald-600"/>
                  <path d="M4.5 5h7M4.5 8h7M4.5 11h4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" className="text-emerald-500"/>
                </svg>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Excel</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary leading-tight">
                {xlsxLoading ? t('bar.preparing') : t('bank.actions.model.title')}
              </p>
              <p className="text-xs text-text-tertiary mt-1 leading-relaxed">{t('bank.actions.model.sub')}</p>
            </div>
          </button>

        </div>
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
      {isUnallocated && (
        <div className="mb-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 leading-relaxed">
          {t('bank.optima.unallocatedSplit')}
        </div>
      )}
      {tabData.tabProjects.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-5">
          {tabData.tabProjects.map((p) => (
            <span
              key={p.id}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                isUnallocated
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-brand-50 text-brand-600 border-brand-100'
              }`}
            >
              {p.name}
            </span>
          ))}
        </div>
      ) : (
        <div className="mb-5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 leading-relaxed">
          {t('bank.optima.noProjectsAssigned')}
        </div>
      )}

      {/* ── About this sub-project ── */}
      {tabPortfolio.length > 0 && (
        <div className="mb-6 print:mb-4">
          <div className="flex items-baseline justify-between mb-3 px-1">
            <h2 className="text-sm font-semibold text-text-primary">
              {t('bank.about.title')}
            </h2>
          </div>
          <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden print:border-0 print:shadow-none">
            <div className="px-6 py-5 border-b border-surface-tertiary">
              <p className="text-sm text-text-secondary leading-relaxed">
                <span className="font-semibold text-text-primary">Villa Lev Group</span>
                {' '}{t('bank.about.isDeveloping')}{' '}
                <span className="font-semibold text-text-primary">{tabTotalPlots} {t('bank.about.plotsIn')}</span>
                {' '}
                {tabTotalVillas > 0 && (
                  <>
                    <span className="font-semibold text-text-primary">{tabTotalVillas} {t('bank.about.villaDesc')}</span>
                    {tabTotalSuites > 0 ? <>{' '}{t('bank.about.and')}{' '}</> : <>{'. '}</>}
                  </>
                )}
                {tabTotalSuites > 0 && (
                  <><span className="font-semibold text-text-primary">{tabTotalSuites} {t('bank.about.suiteDesc')}</span>{' '}</>
                )}
                {t('bank.about.inventoryIntro')}{' '}
                <span className="font-semibold text-text-primary">{tabTotalBedrooms} {t('bank.about.bedroomsAcross')}</span>
                {' '}
                <span className="font-semibold text-text-primary">{tabTotalKeysMaxSplit} {t('bank.about.rentableKeys')}</span>
                {' '}{t('bank.about.anchorPrefix')}{' '}
                <a
                  href="https://www.airbnb.com/rooms/49627193?guests=1&adults=1&s=67&unique_share_id=20f5564b-2002-4925-a2c1-17be7c330dea"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900 transition-colors"
                >
                  Villa Lev Antiparos
                </a>
                {' '}{t('bank.about.anchorSuffix')}
              </p>
            </div>

            {/* Per-plot breakdown — only plots in the active tab */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-secondary/40 border-b border-surface-tertiary">
                    <th className="text-left py-2.5 px-4 font-semibold uppercase tracking-wider text-text-tertiary">{t('bank.about.colPlot')}</th>
                    <th className="text-center py-2.5 px-3 font-semibold uppercase tracking-wider text-text-tertiary">{t('bank.about.colCount')}</th>
                    <th className="text-left py-2.5 px-3 font-semibold uppercase tracking-wider text-text-tertiary">{t('bank.about.colType')}</th>
                    <th className="text-right py-2.5 px-3 font-semibold uppercase tracking-wider text-text-tertiary">{t('bank.about.colKeysPerPlot')}</th>
                    <th className="text-right py-2.5 px-3 font-semibold uppercase tracking-wider text-text-tertiary">{t('bank.about.colBedrooms')}</th>
                    <th className="text-right py-2.5 px-4 font-semibold uppercase tracking-wider text-text-tertiary">{t('bank.about.colGiaPerPlot')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tabPortfolio.map((p) => (
                    <tr key={p.id} className="border-b border-surface-secondary/50">
                      <td className="py-2.5 px-4 font-medium text-text-primary">{p.name}</td>
                      <td className="py-2.5 px-3 text-center text-text-secondary">×{p.count}</td>
                      <td className="py-2.5 px-3 text-text-secondary">
                        {p.villaUnits > 0 ? t('bank.about.typeLuxuryVilla') : t('bank.about.typeHotelRooms')}
                      </td>
                      <td className="py-2.5 px-3 text-right text-text-secondary">
                        {p.villaUnits > 0
                          ? <>{1} {t('bank.about.villaUnitMixWhole')} / {keysForPlot(p)} {t('bank.about.villaUnitMixMaxSplit')}</>
                          : <>{p.standardSuites} {t('bank.about.unitStd')} · {p.doubleSuites} {t('bank.about.unitDbl')} = {p.standardSuites + p.doubleSuites}</>
                        }
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-text-secondary">
                        {bedroomsForPlot(p)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-text-secondary">
                        ~{Math.round(p.constructionArea ?? 0).toLocaleString()} m²
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-surface-tertiary bg-surface-secondary/20">
                    <td className="py-2.5 px-4 font-semibold text-text-primary">{t('bank.about.totalRow')}</td>
                    <td className="py-2.5 px-3 text-center font-semibold text-text-primary">{tabTotalPlots}</td>
                    <td className="py-2.5 px-3" />
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-text-secondary">
                      {tabTotalKeysMaxSplit} {t('bank.about.totalKeysLabel')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">
                      {tabTotalBedrooms} {t('bank.about.totalBedroomsLabel')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-text-primary">
                      ~{Math.round(tabTotalGIA).toLocaleString()} m²
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      <div id="live-track-record" className="mb-6 print:hidden">
        <LiveTrackRecord />
      </div>

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

      {/* CAPEX — per sub-project, clean use-of-proceeds table, no admin annotations */}
      <div className="mb-6" id="optima-capex">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          {t("bank.optima.capexBreakdown")}
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
                {tabData.tabCapexRows.map((row, i) => (
                  <tr
                    key={row.name}
                    className={`border-t border-surface-secondary/60 ${i % 2 === 0 ? "" : "bg-surface-secondary/10"}`}
                  >
                    <td className="py-2.5 px-5 text-text-secondary whitespace-nowrap">
                      {row.name}
                    </td>
                    <td className="text-right py-2.5 px-5 font-mono text-sm font-medium text-text-primary">
                      {formatCurrency(row.total, false, locale)}
                    </td>
                    <td className="text-right py-2.5 px-5 font-mono text-sm text-text-secondary">
                      {tabData.tabCapexTotal > 0 ? formatPercent(row.total / tabData.tabCapexTotal, 0) : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-surface-tertiary bg-surface-secondary/30 font-semibold">
                  <td className="py-3.5 px-5 text-text-primary">{t("capex.totalCapex")}</td>
                  <td className="text-right py-3.5 px-5 font-mono text-brand-600">
                    {formatCurrency(tabData.tabCapexTotal, false, locale)}
                  </td>
                  <td className="text-right py-3.5 px-5 font-mono text-text-secondary">100%</td>
                </tr>
              </tbody>
            </table>
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
          {(() => {
            const pv = model.keyMetrics.portfolioValue * tabData.capexRatio;
            const ltv = pv > 0 ? tabData.tabLoan / pv : 0;
            const coverage = ltv > 0 ? 1 / ltv : 0;
            return (
              <div className="text-center px-2 flex flex-col items-center">
                <div className="kpi-value text-text-primary">{coverage > 0 ? formatMultiple(coverage) : "—"}</div>
                <div className="text-sm font-medium text-text-tertiary mt-0.5">{ltv > 0 ? formatPercent(ltv, 0) : "—"}</div>
                <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-secondary mt-2">{t("kpi.ltvAtCompletion")}</div>
                <div className="text-xs text-text-tertiary mt-0.5">{formatCurrency(model.collateral.market.valuationPerM2, false, locale)}/m²</div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setVillaSaleDrawerOpen(true)}
                    className="group inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-semibold text-amber-700 border border-amber-300 bg-amber-50 hover:bg-amber-100 hover:border-amber-500 hover:text-amber-900 transition-all duration-150"
                  >
                    <span>{t("collateral.saleMarketStudy")}</span>
                    <span className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
                  </button>
                </div>
              </div>
            );
          })()}
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

      {/* DSCR over time */}
      {dscrChartData.length > 0 && (
        <div id="optima-dscr-chart" className="bg-white rounded-xl border border-surface-tertiary p-6 mb-6 shadow-sm">
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            {t('bank.section.repaymentCapacity')}
          </h3>
          <p className="text-xs text-text-tertiary mb-5 max-w-2xl">{t('bank.dscrChartSub')}</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dscrChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}×`} domain={[0.75, "dataMax + 0.5"]} />
              <Tooltip
                formatter={(value) => `${Number(value).toFixed(2)}×`}
                contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={dscrCovenant} stroke="#9E3B3B" strokeDasharray="5 5" label={{ value: t('bank.chart.covenantLabel'), position: 'insideTopLeft', fontSize: 10, fill: '#9E3B3B' }} />
              <ReferenceLine
                x={2029}
                stroke="#8B6914"
                strokeDasharray="3 3"
                label={{ value: t('bank.chart.firstFullDS'), position: "insideTopRight", fontSize: 9, fill: "#8B6914" }}
              />
              <Line type="monotone" dataKey="DSCR" name="DSCR (Optima)" stroke="#8B6914" strokeWidth={2.5} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          {rampHaircutNote}
        </div>
      )}

      {/* ── SHARED PORTFOLIO-LEVEL SECTIONS ── */}

      {/* Sources & Uses (total portfolio) */}
      <SourcesUsesPanel
        km={{
          loanAmount: tabData.tabLoan,
          equityRequired: tabData.tabCapexTotal - tabData.tabLoan,
          grantAmount: 0,
        }}
        capexCategories={tabData.tabCapexRows}
        wc={{
          facilitySize: (optimaScenario?.wcMinimumFacility ?? 0) * tabData.capexRatio,
          internalCashBuffer: assumptions.workingCapital.internalCashBuffer ?? 100000,
        }}
        locale={locale}
      />

      {/* P&L Timeline */}
      <div className="mb-6" id="optima-pnl">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          {t("pnl.title")}
        </h3>
        <BankPnLSection
          capexRatio={tabData.capexRatio}
          subProjectLabel={tabLabels[activeTab]}
          suppressCoverageRows={true}
          annualDebtServiceOverride={tabData.tabAnnualDS}
        />
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

      {/* Footer */}
      <div className="text-center py-8 border-t border-surface-tertiary">
        <p className="text-xs text-text-tertiary">
          {t("app.title")} &middot; {t("app.location")} &middot; {t("app.confidential")}
        </p>
        <p className="text-[11px] text-text-tertiary mt-1 italic">
          {t("bank.optima.capexNote")}
        </p>
      </div>

      <VillaMarketDrawer
        open={villaSaleDrawerOpen}
        onClose={() => setVillaSaleDrawerOpen(false)}
        initialTab="sale"
      />
    </div>
    <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={BANK_TOUR} />
    </>
  );
}
