"use client";

import { useState } from "react";
import Link from "next/link";
import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { LiveTrackRecord } from "@/components/LiveTrackRecord";
import { BankPnLSection } from "@/components/BankPnLSection";
import { SourcesUsesPanel } from "@/components/SourcesUsesPanel";
import { BankStressTest } from "@/components/BankStressTest";
import { ConstructionVatCashflow } from "@/components/ConstructionVatCashflow";
import { resolvePortfolio, PROJECT_CONSTANTS } from "@/lib/engine/defaults";
import { DistributionCovenantBadge } from "@/components/DistributionCovenantBadge";
import { computeTotalKeysMaxSplit, computeTotalBedrooms, bedroomsForPlot, keysForPlot } from "@/lib/engine/bedroomKeys";
import BankControlBar from "@/components/BankControlBar";
import BankSensitivityTab from "@/components/BankSensitivityTab";
import { PRESENTATION_LABEL } from "@/lib/presentationMeta";
import { PageTour, usePageTour } from "@/components/PageTour";
import { logPresenceActivity } from "@/lib/data/usePresence";
import { BANK_TOUR } from "@/lib/tours/configs";
import { VillaMarketDrawer } from "@/components/VillaMarketDrawer";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Label,
} from "recharts";

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
      <div className={`kpi-value ${valueClass ?? 'text-text-primary'}`}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary mt-2">{label}</div>
      {sublabel && <div className="text-xs text-text-tertiary mt-0.5">{sublabel}</div>}
    </div>
  );
}

export default function BankPage() {
  const { t, locale } = useTranslation();
  const {
    model,
    assumptions,
    projects,
    activeScenario,
    financingPathOverride,
    templates,
    capTable,
    waterfall,
  } = useModelStore();
  const [tourOpen, setTourOpen] = usePageTour(BANK_TOUR.storageKey);
  const [xlsxLoading, setXlsxLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'sensitivity'>('overview');
  const [docxLoading, setDocxLoading] = useState(false);
  const [villaSaleDrawerOpen, setVillaSaleDrawerOpen] = useState(false);

  const handleDownloadXlsx = async () => {
    if (!model || xlsxLoading) return;
    setXlsxLoading(true);
    void logPresenceActivity('excel_download');
    try {
      const { exportBusinessPlan } = await import('@/lib/excel/exportBP');
      const exportScenario = activeScenario === 'breakeven' ? 'realistic' : activeScenario;
      const blob = await exportBusinessPlan(
        { ...assumptions, viewMode: 'bank' },
        model,
        exportScenario,
        capTable,
        waterfall,
        locale,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `villa-lev-business-plan-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
      a.download = `villa-lev-bank-presentation-${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDocxLoading(false);
    }
  };

  if (!model) return (
    <div className="flex items-center justify-center h-96 text-text-tertiary">
      {t('common.loading')}
    </div>
  );

  // The active path for display is the ephemeral override if set, else the stored assumption.
  const activePath = financingPathOverride ?? assumptions.financingPath;

  // Resolve the active scenario's P&L — charts and tables respond to the scenario pill.
  // km (keyMetrics) stays on realistic: loan sizing, LTV, DS are always on base case.
  const activePnl = model.scenarios[activeScenario as keyof typeof model.scenarios]?.pnl
    ?? model.scenarios.realistic.pnl;

  const km = model.keyMetrics;
  const pnl = activePnl.filter((p) => p.year >= 2028);

  const isGated = !activePnl.some(p => (p.netCashFlowPostVAT ?? 0) >= PROJECT_CONSTANTS.DISTRIBUTION_RESERVE_THRESHOLD);

  // Active scenario output — drives all scenario-responsive metrics across the page.
  // `km` (keyMetrics) intentionally stays on realistic: term-sheet loan sizing,
  // LTV, and annual DS are always underwritten on the base case.
  const activeScenarioOutput = model.scenarios[activeScenario as keyof typeof model.scenarios]
    ?? model.scenarios.realistic;

  // Stabilised year for the active scenario — drives the Stabilised Ops panel.
  const activeStab = activeScenarioOutput.stabilisedYear;

  // Post-ramp 2030 DSCR from the active scenario — more meaningful to a lender.
  const dscr2030 =
    activePnl?.find((p) => p.year === 2030)?.dscr ??
    activeScenarioOutput.minDSCRLoanLife;

  // Coverage ratios — scenario-responsive.
  const icrStabilised = activeScenarioOutput.icrStabilised;
  const llcr = activeScenarioOutput.llcr;
  const plcr = activeScenarioOutput.plcr;

  // ── Ramp-year revenue haircut ──────────────────────────────────────────────
  // Dynamic: Y1 (2028) and Y2 (2029) from the active scenario PnL vs. its
  // stabilised year. Updates automatically when scenario pill changes.
  const stabRev = activeStab?.totalRevenue ?? 0;
  const pnlY1   = activePnl.find((p) => p.year === 2028);
  const pnlY2   = activePnl.find((p) => p.year === 2029);
  const year1HaircutPct = stabRev > 0 && pnlY1
    ? Math.round((1 - pnlY1.totalRevenue / stabRev) * 100) : 0;
  const year2HaircutPct = stabRev > 0 && pnlY2
    ? Math.round((1 - pnlY2.totalRevenue / stabRev) * 100) : 0;
  const year1HaircutAmt = pnlY1 ? stabRev - pnlY1.totalRevenue : 0;
  const year2HaircutAmt = pnlY2 ? stabRev - pnlY2.totalRevenue : 0;

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
          { year: 2028, label: t('bank.chart.year1Label'), pct: year1HaircutPct, amt: year1HaircutAmt },
          { year: 2029, label: t('bank.chart.year2Label'), pct: year2HaircutPct, amt: year2HaircutAmt },
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

  // Resolve full portfolio so "About the project" shows exact unit counts and m².
  // Uses the store's templates (includes custom) so all 4 plots — including the
  // 11-suite custom template — are reflected correctly.
  const portfolio = resolvePortfolio(templates, projects);
  const totalPlots = portfolio.reduce((s, p) => s + p.count, 0);
  const totalVillas = portfolio.reduce((s, p) => s + p.count * p.villaUnits, 0);
  const totalStdSuites = portfolio.reduce((s, p) => s + p.count * p.standardSuites, 0);
  const totalDblSuites = portfolio.reduce((s, p) => s + p.count * p.doubleSuites, 0);
  const totalSuites = totalStdSuites + totalDblSuites;
  const totalGIA = portfolio.reduce((s, p) => s + p.count * (p.constructionArea ?? 0), 0);
  const totalKeysMaxSplit = computeTotalKeysMaxSplit(portfolio);
  const totalBedrooms     = computeTotalBedrooms(portfolio);

  const pathLabel =
    activePath === "grant"
      ? t('path.grant')
      : activePath === "rrf"
        ? t('path.rrf')
        : activePath === "tepix-loan"
          ? t('path.tepixLoan')
          : t('path.commercial');

  // Term sheet params extracted to page scope (P1-01)
  const rate =
    activePath === "tepix-loan"
      ? assumptions.tepixLoan.bankInterestRate
      : activePath === "rrf"
        ? assumptions.rrf.commercialInterestRate
        : assumptions.commercialLoan.interestRate;
  const term =
    activePath === "tepix-loan"
      ? assumptions.tepixLoan.totalTermYears
      : activePath === "rrf"
        ? assumptions.rrf.repaymentTermYears
        : assumptions.commercialLoan.repaymentTermYears;
  const grace =
    activePath === "tepix-loan"
      ? assumptions.tepixLoan.gracePeriodYears
      : activePath === "rrf"
        ? assumptions.rrf.gracePeriodYears
        : activePath === "grant"
          ? assumptions.grant.gracePeriodYears
          : assumptions.commercialLoan.gracePeriodYears;
  const termSheetCovenant = assumptions.dscrCovenantThreshold ?? 1.25;

  const grantAmount = km.grantAmount;
  const capitalData = [
    { name: t('inv.loan'), value: km.loanAmount, color: "#8B6914" },
    { name: t('kpi.equityRequired'), value: km.equityRequired, color: "#6B7A3D" },
    ...(grantAmount > 0
      ? [{ name: t('path.grantShort'), value: grantAmount, color: "#4A6A8B" }]
      : []),
  ];

  const chartData = pnl.map((p) => ({
    year: p.year,
    Revenue: Math.round(p.totalRevenue),
    EBITDA: Math.round(p.ebitda),
    "Net Cash Flow": Math.round(p.netCashFlow),
  }));

  // Drive DSCR chart from model.scenarios so it reflects the active financing path.
  // dscrByYear.realistic/upside/downside are always commercial — they don't switch.
  const dscrChart = model.scenarios.realistic.pnl
    .filter((p) => p.year >= 2028)
    .map((p) => {
      const up   = model.scenarios.upside.pnl.find((u) => u.year === p.year);
      const down = model.scenarios.downside.pnl.find((d) => d.year === p.year);
      return {
        year: p.year,
        Conservative: Number(p.dscr.toFixed(2)),
        'Realistic':  Number((up?.dscr ?? 0).toFixed(2)),
        Downside:     Number((down?.dscr ?? 0).toFixed(2)),
      };
    });

  // Column active-highlight helper
  const colClass = (pathKey: string) =>
    activePath === pathKey ? "bg-brand-50" : "";

  return (
    <>
      <BankControlBar />

      {/* Tab navigation strip */}
      <div className="max-w-6xl mx-auto px-4 mt-4 mb-0 print:hidden">
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('overview')}
            aria-pressed={activeTab === 'overview'}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'overview'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t('bank.tabs.overview')}
          </button>
          <button
            onClick={() => setActiveTab('sensitivity')}
            aria-pressed={activeTab === 'sensitivity'}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === 'sensitivity'
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t('bank.tabs.sensitivity')}
          </button>
        </div>
      </div>

      {/* Sensitivity tab — replaces the entire content area */}
      {activeTab === 'sensitivity' && <BankSensitivityTab />}

      {/* Overview tab — existing content */}
      {activeTab === 'overview' && <div key={activeScenario} className="animate-fade-in max-w-6xl mx-auto px-6 py-8 print:px-0 print:py-2 print:max-w-none">

        {/* 2. Hero + Quick Access */}
        <div className="text-center mb-6 relative print:mb-4 print:break-after-avoid">
          <p className="text-sm text-brand-500 font-medium uppercase tracking-widest mb-3 print:mb-1">
            {t('bank.hero.eyebrow')}
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-text-primary mb-3 print:text-3xl">
            {t('app.title')}
          </h1>
          <p className="text-sm text-text-secondary mt-1 max-w-xl mx-auto text-center">{t('bank.pageIntro')}</p>
          <p className="text-text-secondary max-w-xl mx-auto">
            {pathLabel} &middot; {t('app.confidential')}
          </p>
        </div>

        {/* 2b. Quick Access — Tour · Presentation · Model */}
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

            {/* Bank Presentation — PDF viewer */}
            <a
              href={`/presentation?lang=${locale}&from=bank`}
              target="_blank"
              rel="noopener noreferrer"
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

            {/* Download the Model */}
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

        {/* 3. Executive Summary / Portfolio Table */}
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
                <span className="font-semibold text-text-primary">{totalPlots} {t('bank.about.plotsIn')}</span>
                {' '}
                <span className="font-semibold text-text-primary">{totalVillas} {t('bank.about.villaDesc')}</span>
                {' '}
                <span className="font-semibold text-text-primary">{totalSuites} {t('bank.about.suiteDesc')}</span>
                {' '}{t('bank.about.inventoryIntro')}{' '}
                <span className="font-semibold text-text-primary">{totalBedrooms} {t('bank.about.bedroomsAcross')}</span>
                {' '}
                <span className="font-semibold text-text-primary">{totalKeysMaxSplit} {t('bank.about.rentableKeys')}</span>
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

            {/* Per-plot portfolio breakdown */}
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
                  {portfolio.map((p) => (
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
                    <td className="py-2.5 px-3 text-center font-semibold text-text-primary">{totalPlots}</td>
                    <td className="py-2.5 px-3" />
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-text-secondary">
                      {totalKeysMaxSplit} {t('bank.about.totalKeysLabel')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">
                      {totalBedrooms} {t('bank.about.totalBedroomsLabel')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-text-primary">
                      ~{Math.round(totalGIA).toLocaleString()} m²
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* 1. Term Sheet */}
        {(() => {
          const stabDscr = km.stabilisedDSCR;
          const dscrPass = stabDscr >= termSheetCovenant;
          type Cell = {
            label: string;
            value: string;
            sub?: string;
            tone?: 'positive' | 'warning';
            badge?: { text: string; tone: 'positive' | 'warning' };
            isText?: boolean;
          };
          const cells: Cell[] = [
            { label: t('dash.termsheet.loan'), value: formatCurrency(km.loanAmount, true, locale), sub: `${(km.ltv * 100).toFixed(0)}% ${t('dash.termsheet.loanSub')}` },
            { label: t('dash.termsheet.term'), value: `${term}y · ${grace}y`, sub: t('dash.termsheet.termSub') },
            { label: t('dash.termsheet.rate'), value: `${(rate * 100).toFixed(2)}%`, sub: pathLabel },
            { label: t('dash.termsheet.annualDS'), value: formatCurrency(km.annualDS, true, locale), sub: `${t('kpi.assetCoverage')} ${formatMultiple(km.assetCoverage)}` },
            {
              label: t('dash.termsheet.dscrCovenant'),
              value: formatMultiple(stabDscr),
              sub: `Covenant ≥ ${termSheetCovenant.toFixed(2)}×`,
              badge: { text: dscrPass ? t('dash.termsheet.pass') : t('dash.termsheet.fail'), tone: dscrPass ? 'positive' : 'warning' },
              tone: dscrPass ? 'positive' : 'warning',
            },
            { label: t('kpi.equityRequired'), value: formatCurrency(km.equityRequired, true, locale), sub: `${formatPercent(km.equityRequired / km.totalCapex, 0)} ${t('kpi.ofTotal')}` },
            { label: t('kpi.totalInvestment'), value: formatCurrency(km.totalCapex, true, locale), sub: `${formatCurrency(km.loanAmount, true, locale)} + ${formatCurrency(km.equityRequired, true, locale)}${grantAmount > 0 ? ` + ${formatCurrency(grantAmount, true, locale)} grant` : ''}` },
            { label: t('bank.termsheet.securityLabel'), value: t('bank.termsheet.securityValue'), sub: t('bank.termsheet.securitySub'), isText: true },
          ];
          const colCount = cells.length;
          return (
            <div id="bank-term-sheet" className="mb-6">
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                {t('bank.section.termsheet')}
              </h3>
              <div className="bg-white rounded-xl border border-surface-tertiary shadow-sm overflow-hidden">
                {/* Metrics grid */}
                <div className={`grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-surface-tertiary ${colCount >= 8 ? 'lg:grid-cols-8' : 'lg:grid-cols-7'}`}>
                  {cells.map((c, i) => (
                    <div
                      key={c.label}
                      className={[
                        'flex flex-col gap-0.5 px-4 py-4',
                        i === 0 ? 'pl-5' : '',
                        i === cells.length - 1 ? 'pr-5' : '',
                        c.tone === 'positive' ? 'bg-positive/[0.03]' : '',
                        c.tone === 'warning' ? 'bg-warning/[0.04]' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary mb-0.5 leading-none">
                        {c.label}
                      </span>
                      <span className={[
                        'leading-tight',
                        c.isText ? 'font-semibold text-base text-text-primary' : `font-mono font-bold text-xl ${c.tone === 'positive' ? 'text-positive' : c.tone === 'warning' ? 'text-warning' : 'text-text-primary'}`,
                      ].join(' ')}>
                        {c.value}
                      </span>
                      {c.sub && (
                        <span className="text-[11px] text-text-tertiary leading-snug">{c.sub}</span>
                      )}
                      {c.badge && (
                        <span className={[
                          'self-start inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1',
                          c.badge.tone === 'positive' ? 'bg-positive/15 text-positive' : 'bg-warning/15 text-warning',
                        ].join(' ')}>
                          <span className="w-1 h-1 rounded-full bg-current" aria-hidden="true" />
                          {c.badge.text}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {/* Credit Facilities Requested — term loan + WC revolving */}
                <div className="border-t border-surface-tertiary bg-amber-50/30 px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary">
                      {t('bank.creditAsk.heading')}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {t('bank.creditAsk.total')}:{" "}
                      <span className="font-mono font-semibold text-text-primary">
                        {formatCurrency(km.loanAmount + activeScenarioOutput.wcMinimumFacility, true, locale)}
                      </span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Facility 1 — Term Loan */}
                    <div className="rounded-lg border border-brand-200 bg-white px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-brand-500 mb-1.5">
                        {t('bank.creditAsk.facility1.label')}
                      </div>
                      <div className="font-mono font-bold text-xl text-text-primary leading-none">
                        {formatCurrency(km.loanAmount, true, locale)}
                      </div>
                      <div className="text-[11px] text-text-secondary mt-1.5 font-medium">
                        {(rate * 100).toFixed(2)}% · {term}y · {grace}y grace
                      </div>
                      <div className="text-[10px] text-text-tertiary mt-1 leading-snug">
                        {t('bank.creditAsk.facility1.purpose')}
                      </div>
                    </div>
                    {/* Facility 2 — WC Revolving */}
                    <div className="rounded-lg border border-amber-200 bg-white px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1.5">
                        {t('bank.creditAsk.facility2.label')}
                      </div>
                      <div className="font-mono font-bold text-xl text-text-primary leading-none">
                        {formatCurrency(activeScenarioOutput.wcMinimumFacility, true, locale)}
                      </div>
                      <div className="text-[11px] text-text-secondary mt-1.5 font-medium">
                        {assumptions.workingCapital.spreadOverTermRate > 0
                          ? `+${(assumptions.workingCapital.spreadOverTermRate * 10000).toFixed(0)} bps`
                          : ""}
                        {assumptions.workingCapital.selfLiquidating ? " · self-liquidating" : ""}
                      </div>
                      <div className="text-[10px] text-text-tertiary mt-1 leading-snug">
                        {t('bank.creditAsk.facility2.purpose')}
                      </div>
                      <div className="text-[9px] text-amber-600/80 mt-1.5 italic">
                        {t('bank.creditAsk.facility2.separate')}
                      </div>
                    </div>
                  </div>
                  {/* Dual-use detail */}
                  <div className="mt-3 space-y-1">
                    <div className="text-[10px]">
                      <span className="font-medium text-text-secondary">{t('bank.wc.dual.vatBridgeLabel')}</span>
                      {" · "}<span className="text-text-tertiary">{t('bank.wc.dual.vatBridgeSub')}</span>
                    </div>
                    <div className="text-[10px]">
                      <span className="font-medium text-text-secondary">{t('bank.wc.dual.opWcLabel')}</span>
                      {" · "}<span className="text-text-tertiary">{t('bank.wc.dual.opWcSub')}</span>
                    </div>
                    <div className="text-[10px] text-text-tertiary/70 italic mt-0.5">
                      {t('bank.wc.dual.sizingNote')}
                    </div>
                  </div>
                </div>
              </div>
              {/* Distribution covenant badge (ADR-0014) */}
              <div className="mt-2">
                <DistributionCovenantBadge gated={isGated} />
              </div>
            </div>
          );
        })()}

        {/* 3b. Operating Track Record — proof of operator */}
        <div id="live-track-record" className="mb-6 print:hidden">
          <LiveTrackRecord />
        </div>

        {/* 4 + 5. Collateral & Loan Metrics — unified card pair */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* 4. Collateral — Security Package */}
          <div id="bank-collateral" className="bg-white rounded-xl border border-surface-tertiary p-6 shadow-md">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-primary border-b border-surface-tertiary pb-2 mb-4">
              {t('bank.section.collateral')}
            </h3>
            <p className="text-xs text-text-tertiary mb-6">{t('bank.collateral.sub')}</p>
            <div className="grid grid-cols-2 divide-x divide-surface-tertiary">
              <MetricCell
                value={formatMultiple(model.collateral.market.coverage)}
                label={t('sc.market')}
                sublabel={`${formatCurrency(model.collateral.market.value, true, locale)} · LTV ${formatPercent(model.collateral.market.ltv)}`}
                valueClass="text-brand-600"
              />
              <MetricCell
                value={formatMultiple(model.collateral.optimistic.coverage)}
                label={t('sc.optimistic')}
                sublabel={`${formatCurrency(model.collateral.optimistic.value, true, locale)} · LTV ${formatPercent(model.collateral.optimistic.ltv)}`}
                valueClass="text-positive"
              />
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setVillaSaleDrawerOpen(true)}
                className="group inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-semibold text-amber-700 border border-amber-300 bg-amber-50 hover:bg-amber-100 hover:border-amber-500 hover:text-amber-900 transition-all duration-150"
              >
                <span>{t('collateral.saleMarketStudy')}</span>
                <span className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
              </button>
            </div>
          </div>

          {/* 5. Loan Metrics */}
          <div id="bank-kpi-strip" className="bg-white rounded-xl border border-surface-tertiary p-6 shadow-md">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-primary border-b border-surface-tertiary pb-2 mb-4">
              {t('bank.section.loanMetrics')}
            </h3>
            <p className="text-xs text-text-tertiary mb-6">
              {pathLabel} · {
                activeScenario === 'upside' ? t('scenario.upside') :
                activeScenario === 'downside' ? t('scenario.downside') :
                activeScenario === 'breakeven' ? t('scenario.breakeven') :
                t('scenario.realistic')
              }
            </p>
            <div className="grid grid-cols-3 divide-x divide-surface-tertiary mb-4">
              <MetricCell
                value={formatCurrency(km.totalCapex, true, locale)}
                label={t('kpi.totalInvestment')}
                sublabel={(() => {
                  const n = projects.reduce((s, p) => s + p.count, 0);
                  return `${n} ${t(n === 1 ? 'kpi.plotsSingular' : 'kpi.plots')}`;
                })()}
              />
              <MetricCell
                value={formatCurrency(km.loanAmount, true, locale)}
                label={t('kpi.loanAmount')}
                sublabel={`${formatPercent(km.loanAmount / km.totalCapex, 0)} ${t('bank.kpi.ofCapex')}`}
                valueClass="text-brand-600"
              />
              <MetricCell
                value={formatPercent(km.ltv, 0)}
                label={t('kpi.ltvAtCompletion')}
                sublabel={t('bank.kpi.appraisedValue')}
              />
            </div>
            <div className="grid grid-cols-2 divide-x divide-surface-tertiary pt-4 border-t border-surface-tertiary">
              <MetricCell
                value={formatMultiple(km.assetCoverage)}
                label={t('kpi.assetCoverage')}
                sublabel={formatCurrency(km.portfolioValue, true, locale)}
              />
              <MetricCell
                value={formatMultiple(dscr2030)}
                label={t('term.dscr')}
                sublabel={t('bank.kpi.postRamp2030')}
                valueClass={dscr2030 >= 1.25 ? 'text-positive' : 'text-warning'}
              />
            </div>
          </div>

        </div>

        {/* 7. CAPEX Breakdown — one column per plot instance, total at right */}
        {(() => {
          const capexInstances = model.capex.properties.flatMap((prop) =>
            Array.from({ length: prop.count }, (_, i) => ({
              key: `${prop.id}-${i}`,
              propId: prop.id,
              label: prop.count > 1 ? `${prop.name} N°${i + 1}` : prop.name,
              perUnit: prop.perUnit,
            }))
          );
          return (
            <div id="bank-capex" className="mb-6">
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                {t('capex.title')} — {t('bank.capex.useOfProceeds')}
              </h3>
              <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-secondary/40">
                        <th className="text-left py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium whitespace-nowrap">{t('capex.costCategory')}</th>
                        {capexInstances.map((inst) => (
                          <th key={inst.key} className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium whitespace-nowrap">
                            {inst.label}
                          </th>
                        ))}
                        <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium whitespace-nowrap">{t('capex.total')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.capex.categories.map((cat, i) => (
                        <tr key={cat.name} className={`border-t border-surface-secondary/60 ${i % 2 === 0 ? '' : 'bg-surface-secondary/10'}`}>
                          <td className="py-2.5 px-5 text-text-secondary whitespace-nowrap">{cat.name}</td>
                          {capexInstances.map((inst) => {
                            const pp = cat.perProperty.find((p) => p.id === inst.propId);
                            return (
                              <td key={inst.key} className="text-right py-2.5 px-4 font-mono text-sm text-text-secondary">
                                {pp && pp.perUnit > 0 ? formatCurrency(pp.perUnit, false, locale) : '—'}
                              </td>
                            );
                          })}
                          <td className="text-right py-2.5 px-5 font-mono text-sm font-medium text-text-primary">{formatCurrency(cat.grandTotal, false, locale)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-surface-tertiary bg-surface-secondary/30 font-semibold">
                        <td className="py-3.5 px-5 text-text-primary">{t('capex.totalCapex')}</td>
                        {capexInstances.map((inst) => (
                          <td key={inst.key} className="text-right py-3.5 px-4 font-mono text-text-primary">
                            {formatCurrency(inst.perUnit, false, locale)}
                          </td>
                        ))}
                        <td className="text-right py-3.5 px-5 font-mono text-brand-600">{formatCurrency(model.capex.portfolioTotal, false, locale)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-2.5 border-t border-surface-tertiary/50 bg-surface-secondary/10 text-[11px] text-text-tertiary">
                  {t('bank.capex.footerLoan')} {formatCurrency(km.loanAmount, true, locale)} · {t('bank.capex.footerEquity')} {formatCurrency(km.equityRequired, true, locale)}{grantAmount > 0 ? ` · ${t('bank.capex.footerGrant')} ${formatCurrency(grantAmount, true, locale)}` : ''} · {t('bank.capex.footerTotal')} {formatCurrency(km.totalCapex, true, locale)}
                </div>
              </div>
            </div>
          );
        })()}

        {/* 7b. Sources & Uses Panel */}
        <SourcesUsesPanel
          km={{
            loanAmount: km.loanAmount,
            equityRequired: km.equityRequired,
            grantAmount: km.grantAmount,
          }}
          capexCategories={model.capex.categories}
          wc={{
            facilitySize: activeScenarioOutput.wcMinimumFacility,
            internalCashBuffer: assumptions.workingCapital.internalCashBuffer ?? 100000,
          }}
          locale={locale}
        />

        {/* 8. Capital Structure + Stabilised Metrics */}
        <div id="bank-capital-structure" className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
          <div className="bg-white rounded-xl border border-surface-tertiary p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-6">
              {t('inv.capitalStructure')}
            </h3>
            <div className="flex flex-col items-center">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={capitalData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={2} stroke="#FEFCF7">
                      {capitalData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                      <Label value={formatCurrency(km.totalCapex, true, locale)} position="center" fontSize={13} fill="#3A3632" fontWeight={600} />
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value), false, locale)}
                      contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
                {capitalData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <div>
                      <span className="text-sm font-medium text-text-primary">{formatCurrency(item.value, true, locale)}</span>
                      <span className="text-xs text-text-tertiary ml-1">{item.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Fix 3 — net leverage and peak debt rows */}
            <div className="mt-4 pt-4 border-t border-surface-tertiary/50 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary">{t('bank.capitalStructure.netLeverage')}</span>
                <span className="font-mono font-medium text-text-primary">
                  {activeScenarioOutput.netLeverage > 0 ? `${activeScenarioOutput.netLeverage.toFixed(1)}${t('bank.capitalStructure.xEbitda')}` : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary">{t('bank.capitalStructure.peakDebt')}</span>
                <span className="font-mono font-medium text-text-primary">
                  {activeScenarioOutput.peakDebtOutstanding > 0
                    ? formatCurrency(activeScenarioOutput.peakDebtOutstanding, true, locale)
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-surface-tertiary p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-1">
              {t('inv.stabilisedOps')}
            </h3>
            <p className="text-xs text-text-tertiary mb-5">{t('bank.stabilisedOpsSub')}</p>
            <div className="space-y-4">
              {[
                { label: t('inv.annualRevenue'), value: formatCurrency(activeStab?.totalRevenue ?? 0, true, locale) },
                { label: t('term.ebitda'), value: formatCurrency(activeStab?.ebitda ?? 0, true, locale) },
                { label: t('term.ebitdaMargin'), value: formatPercent(activeStab?.ebitdaMargin ?? 0) },
                { label: t('kpi.annualDS'), value: formatCurrency(km.annualDS, true, locale) },
                { label: t('term.dscr'), value: formatMultiple(activeStab?.dscr ?? 0), highlight: true },
                { label: t('pnl.ncfPostVAT'), value: formatCurrency(activeStab?.netCashFlow ?? 0, true, locale) },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex justify-between items-center py-2 ${item.highlight ? "bg-brand-50 -mx-3 px-3 rounded-lg" : ""}`}
                >
                  <span className="text-sm text-text-secondary">{item.label}</span>
                  <span className={`data-cell font-medium ${item.highlight ? "text-brand-600" : "text-text-primary"}`}>
                    {item.value}
                  </span>
                </div>
              ))}
              <p className="text-xs text-stone-500 mt-1">{t('bank.dscr.mgmtFeeNote')}</p>
            </div>
          </div>
        </div>

        {/* 7. ICR / LLCR / PLCR coverage ratio cards */}
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('bank.coverage.groupHeading')}</h3>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            {
              label: t('bank.coverage.icrStabilised'),
              value: icrStabilised > 0 ? formatMultiple(icrStabilised) : "—",
              sub: t('bank.coverage.icrSub'),
              tone: icrStabilised >= 3.0 ? "text-positive" : icrStabilised >= 2.0 ? "text-text-primary" : "text-warning",
            },
            {
              label: t('bank.coverage.llcr'),
              value: llcr > 0 ? formatMultiple(llcr) : "—",
              sub: t('bank.coverage.llcrSub'),
              tone: llcr >= 1.3 ? "text-positive" : llcr >= 1.0 ? "text-text-primary" : "text-warning",
            },
            {
              label: t('bank.coverage.plcr'),
              value: plcr > 0 ? formatMultiple(plcr) : "—",
              sub: t('bank.coverage.plcrSub'),
              tone: plcr >= 1.5 ? "text-positive" : plcr >= 1.0 ? "text-text-primary" : "text-warning",
            },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-surface-tertiary p-5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">
                {card.label}
              </div>
              <div className={`kpi-value ${card.tone}`}>{card.value}</div>
              <div className="text-xs text-text-tertiary mt-1">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* 9. Debt Service Coverage Ratio (DSCR) Chart */}
        <div id="bank-dscr-chart" className="bg-white rounded-xl border border-surface-tertiary p-6 mb-6 shadow-sm">
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            {t('bank.section.repaymentCapacity')}
          </h3>
          <p className="text-xs text-text-tertiary mb-5 max-w-2xl">{t('bank.dscrChartSub')}</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dscrChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}×`} domain={[0.75, "dataMax + 0.5"]} />
              <Tooltip
                formatter={(value) => `${Number(value).toFixed(2)}×`}
                contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={1.25} stroke="#9E3B3B" strokeDasharray="5 5" label={{ value: t('bank.chart.covenantLabel'), position: 'insideTopLeft', fontSize: 10, fill: '#9E3B3B' }} />
              <ReferenceLine
                x={2029}
                stroke="#8B6914"
                strokeDasharray="3 3"
                label={{ value: t('bank.chart.firstFullDS'), position: "insideTopRight", fontSize: 9, fill: "#8B6914" }}
              />
              <Line type="monotone" dataKey="Conservative" name={t('scenario.realistic')} stroke="#8B6914" strokeWidth={2.5} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="Realistic" name={t('scenario.upside')} stroke="#6B7A3D" strokeWidth={1.5} strokeDasharray="4 2" activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="Downside" name={t('scenario.downside')} stroke="#C4754B" strokeWidth={1.5} strokeDasharray="4 2" activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          {rampHaircutNote}
        </div>

        {/* 10. Revenue & EBITDA Chart */}
        <div id="bank-revenue-chart" className="bg-white rounded-xl border border-surface-tertiary p-6 mb-6">
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            {t('bank.section.projectedRevenue')}
          </h3>
          <p className="text-xs text-text-tertiary mb-5 max-w-2xl">{t('bank.revenueEbitdaSub')}</p>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value), false, locale)}
                contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" name={t('pnl.totalRevenue')} fill="#C4A55E" radius={[4, 4, 0, 0]} maxBarSize={64} />
              <Bar dataKey="EBITDA" name={t('term.ebitda')} fill="#6B7A3D" radius={[4, 4, 0, 0]} maxBarSize={64} />
              <Line type="monotone" dataKey="Net Cash Flow" name={t('kpi.netCashFlow')} stroke="#C4754B" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Fix 4 — Scenario DSCR summary table (before full stress test) */}
        {(() => {
          const covenant = assumptions.dscrCovenantThreshold ?? 1.25;
          const rows = [
            {
              scenario: t('scenario.upside'),
              stabDscr: model.scenarios.upside.stabilisedYear?.dscr ?? 0,
              avgDscr: model.scenarios.upside.avgDSCRLoanLife,
              minDscr: model.scenarios.upside.minDSCRLoanLife,
            },
            {
              scenario: t('scenario.realistic'),
              stabDscr: model.scenarios.realistic.stabilisedYear?.dscr ?? 0,
              avgDscr: model.scenarios.realistic.avgDSCRLoanLife,
              minDscr: model.scenarios.realistic.minDSCRLoanLife,
            },
            {
              scenario: t('scenario.downside'),
              stabDscr: model.scenarios.downside.stabilisedYear?.dscr ?? 0,
              avgDscr: model.scenarios.downside.avgDSCRLoanLife,
              minDscr: model.scenarios.downside.minDSCRLoanLife,
            },
          ];
          const worstMinYear = (() => {
            const minVal = model.scenarios.realistic.minDSCRLoanLife;
            if (!minVal) return null;
            return model.scenarios.realistic.pnl.find((p) => p.dscr === minVal) ?? null;
          })();
          return (
            <div id="bank-dscr-summary" className="bg-white rounded-xl border border-surface-tertiary p-5 mb-4">
              <h3 className="text-sm font-semibold text-text-primary mb-4">
                {t('bank.section.dscrSummary')}
              </h3>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-tertiary">
                    <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('bank.dscrTable.scenario')}</th>
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('bank.dscrTable.stabilised')}</th>
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('bank.dscrTable.avgLoanLife')}</th>
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('bank.dscrTable.minLoanLife')}</th>
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('bank.dscrTable.covenant')} {covenant.toFixed(2)}×</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const pass = row.avgDscr >= covenant;
                    return (
                      <tr key={row.scenario} className="border-b border-surface-secondary/50">
                        <td className="py-2.5 pr-4 text-text-secondary font-medium">{row.scenario}</td>
                        <td className="text-right py-2.5 px-3 font-mono text-text-primary">{row.stabDscr > 0 ? formatMultiple(row.stabDscr) : "—"}</td>
                        <td className={`text-right py-2.5 px-3 font-mono font-semibold ${pass ? "text-positive" : "text-warning"}`}>
                          {row.avgDscr > 0 ? formatMultiple(row.avgDscr) : "—"}
                        </td>
                        <td className={`text-right py-2.5 px-3 font-mono text-sm ${row.minDscr >= (covenant ?? 1.25) ? 'text-positive' : 'text-warning'}`}>
                          {row.minDscr > 0 ? row.minDscr.toFixed(2) + '×' : '—'}
                        </td>
                        <td className="text-right py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${pass ? "bg-positive/15 text-positive" : "bg-warning/15 text-warning"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${pass ? "bg-positive" : "bg-warning"}`} />
                            {pass ? t('dash.termsheet.pass') : t('dash.termsheet.fail')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              {worstMinYear && (
                <p className="mt-3 text-[10px] text-text-tertiary">
                  {t('bank.dscrSummary.footnote')} {worstMinYear.year} {t('bank.dscrSummary.footnoteRamp')} {formatMultiple(worstMinYear.dscr)} {t('bank.dscrSummary.footnoteSee')}
                </p>
              )}
            </div>
          );
        })()}

        {/* 11. DSRA — Debt Service Reserve Account (conditional) */}
        {(activeScenarioOutput.dsraTarget ?? 0) > 0 && (() => {
          const dsraTarget = activeScenarioOutput.dsraTarget ?? 0;
          const dsraChartData = activePnl
            .filter((p) => p.year >= 2029)
            .map((p) => ({
              year: p.year,
              balance: Math.round(p.dsraBalance ?? 0),
              draw: Math.round(p.dsraDraw ?? 0),
              replenishment: Math.round(p.dsraReplenishment ?? 0),
            }));
          const hasActivity = dsraChartData.some((d) => d.draw > 0 || d.replenishment > 0);
          return (
            <div id="bank-dsra" className="bg-white rounded-xl border border-surface-tertiary p-6 mb-6">
              <h3 className="text-sm font-semibold text-text-primary mb-1">
                {t('dsra.sectionTitle')}
              </h3>
              <p className="text-xs text-text-tertiary mb-5 max-w-2xl">{t('dsra.bankSub')}</p>

              {/* KPI strip */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: t('dsra.target'), value: formatCurrency(dsraTarget, true, locale), sub: t('dsra.targetSub') },
                  { label: t('dsra.sweep'), value: formatCurrency(activeScenarioOutput.dsraSweep2028 ?? 0, true, locale), sub: t('dsra.sweepSub') },
                  { label: t('dsra.partnerAdvance'), value: formatCurrency(activeScenarioOutput.dsraPartnerAdvance ?? 0, true, locale), sub: t('dsra.partnerAdvanceSub') },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-surface-secondary/40 border border-surface-tertiary px-4 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1">{item.label}</div>
                    <div className="font-display text-xl text-text-primary">{item.value}</div>
                    <div className="text-[10px] text-text-tertiary mt-0.5">{item.sub}</div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                  {t('dsra.chartTitle')}
                </span>
              </div>
              <p className="text-[11px] text-text-tertiary mb-3">{t('dsra.chartSub')}</p>
              {hasActivity ? (
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart data={dsraChartData} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bankDsraGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C4A55E" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#C4A55E" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
                    <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}K`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}K`} />
                    <Tooltip
                      formatter={(v) => formatCurrency(Number(v), false, locale)}
                      contentStyle={{ borderRadius: 8, border: '1px solid #EDE6D5', fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine
                      y={dsraTarget}
                      stroke="#8B6914"
                      strokeDasharray="5 4"
                      label={{ value: t('dsra.target'), position: 'insideTopRight', fontSize: 9, fill: '#8B6914' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      name={t('dsra.legend.balance')}
                      stroke="#C4A55E"
                      strokeWidth={2.2}
                      fill="url(#bankDsraGrad)"
                    />
                    <Bar
                      dataKey="replenishment"
                      name={t('dsra.legend.replenish')}
                      yAxisId="right"
                      barSize={16}
                      fill="#6B7A3D"
                    />
                    <Bar
                      dataKey="draw"
                      name={t('dsra.legend.draw')}
                      yAxisId="right"
                      barSize={16}
                      fill="#9E3B3B"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center gap-2 h-20 text-xs text-positive font-medium">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <circle cx="7" cy="7" r="6.5" stroke="#6B7A3D" />
                    <path d="M4 7l2.5 2.5L10 4.5" stroke="#6B7A3D" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t('dsra.noActivity')}
                </div>
              )}
            </div>
          );
        })()}

        {/* 11b. Construction VAT Cashflow (ADR-0015) */}
        <div className="mb-6">
          <ConstructionVatCashflow />
        </div>

        {/* 12. Stress Analysis — Collateral + Cash-Flow */}
        <div id="bank-stress-analysis" className="mb-6 print:hidden">
          <h3 className="text-sm font-semibold text-text-primary mb-4">{t('bank.section.stressAnalysis')}</h3>
          <div className="space-y-4">

            {/* I — Collateral Stress */}
            <div className="bg-white rounded-xl border border-surface-tertiary p-6 shadow-sm">
              <h4 className="text-sm font-semibold text-text-primary mb-1">{t('bank.stress.collateralHeading')}</h4>
              <p className="text-xs text-text-tertiary mb-5">{t('bank.collateral.sub')}</p>
              <div className="grid grid-cols-3 divide-x divide-surface-tertiary">
                <MetricCell
                  value={formatMultiple(model.collateral.stress.coverage)}
                  label={t('sc.stress')}
                  sublabel={`${formatCurrency(model.collateral.stress.value, true, locale)} · LTV ${formatPercent(model.collateral.stress.ltv)}`}
                />
                <MetricCell
                  value={formatMultiple(model.collateral.market.coverage)}
                  label={t('sc.market')}
                  sublabel={`${formatCurrency(model.collateral.market.value, true, locale)} · LTV ${formatPercent(model.collateral.market.ltv)}`}
                  valueClass="text-brand-600"
                />
                <MetricCell
                  value={formatMultiple(model.collateral.optimistic.coverage)}
                  label={t('sc.optimistic')}
                  sublabel={`${formatCurrency(model.collateral.optimistic.value, true, locale)} · LTV ${formatPercent(model.collateral.optimistic.ltv)}`}
                  valueClass="text-positive"
                />
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setVillaSaleDrawerOpen(true)}
                  className="group inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-semibold text-amber-700 border border-amber-300 bg-amber-50 hover:bg-amber-100 hover:border-amber-500 hover:text-amber-900 transition-all duration-150"
                >
                  <span>{t('collateral.saleMarketStudy')}</span>
                  <span className="transition-transform duration-150 group-hover:translate-x-0.5">→</span>
                </button>
              </div>
            </div>

            {/* II — Cash-Flow Stress */}
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-3">{t('bank.stress.cashFlowHeading')}</h4>
              <BankStressTest />
            </div>

          </div>
        </div>

        {/* 12. Financing Path Comparison */}
        <div id="bank-financing-comparison" className="bg-white rounded-xl border border-surface-tertiary p-6 mb-6">
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            {t('dash.financingComparison')}
          </h3>
          <p className="text-[11px] text-text-tertiary mb-5">{t('bank.financing.sub')}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-tertiary">
                  <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('common.metric')}</th>
                  <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass('commercial')}`}>
                    <span className={activePath === 'commercial' ? 'bg-brand-500 text-white rounded px-2 py-0.5' : 'text-text-tertiary'}>
                      {t('path.commercialShort')}
                    </span>
                  </th>
                  <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass('rrf')}`}>
                    <span className={activePath === 'rrf' ? 'bg-brand-500 text-white rounded px-2 py-0.5' : 'text-text-tertiary'}>
                      {t('path.rrfShort')}
                    </span>
                  </th>
                  <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass('grant')}`}>
                    <span className={activePath === 'grant' ? 'bg-brand-500 text-white rounded px-2 py-0.5' : 'text-positive'}>
                      {t('path.grantShort')}
                    </span>
                  </th>
                  <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass('tepix-loan')}`}>
                    <span className={activePath === 'tepix-loan' ? 'bg-brand-500 text-white rounded px-2 py-0.5' : 'text-tepix-purple'}>
                      {t('path.tepixLoanShort')}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {model.financingComparison.filter((r) => r.key !== 'graceInterestCarry').map((row, i) => {
                  const formatVal = (val: string | number) =>
                    typeof val === "number"
                      ? row.metric.includes("DSCR") ? formatMultiple(val) : formatCurrency(val, true, locale)
                      : val;
                  return (
                    <tr key={i} className="border-b border-surface-secondary/50">
                      <td className="py-2.5 pr-4 text-text-secondary">{(t as (k: string) => string)(`finComp.${row.key}`) || row.metric}</td>
                      <td className={`text-right py-2.5 px-3 data-cell ${colClass('commercial')}`}>{formatVal(row.commercial)}</td>
                      <td className={`text-right py-2.5 px-3 data-cell ${colClass('rrf')}`}>{formatVal(row.rrf)}</td>
                      <td className={`text-right py-2.5 px-3 data-cell text-positive font-medium ${colClass('grant')}`}>{formatVal(row.grant)}</td>
                      <td className={`text-right py-2.5 px-3 data-cell text-tepix-purple ${colClass('tepix-loan')}`}>{formatVal(row.tepixLoan)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 13. All-Paths DSCR Trajectory — includes RRF */}
        <div id="bank-allpaths-dscr" className="bg-white rounded-xl border border-surface-tertiary p-6 mb-6">
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            {t('dash.dscrTrajectory')}
          </h3>
          <p className="text-xs text-text-tertiary mb-5 max-w-2xl">{t('bank.allPathsChartSub')}</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={model.dscrByYear.filter((d) => d.year >= 2028).map((d) => ({
              year: d.year,
              Commercial: Number(d.realistic.toFixed(2)),
              Grant: Number(d.grant.toFixed(2)),
              "TEPIX Loan": Number(d.tepixLoan.toFixed(2)),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}×`} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(2)}×`} contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={1.25} stroke="#9E3B3B" strokeDasharray="5 5" label={{ value: t('bank.chart.covenantLabel'), fontSize: 10, fill: "#9E3B3B" }} />
              <ReferenceLine
                x={2029}
                stroke="#8B6914"
                strokeDasharray="3 3"
                label={{ value: t('bank.chart.firstFullDS'), position: "insideTopRight", fontSize: 9, fill: "#8B6914" }}
              />
              <Line type="monotone" dataKey="Commercial" name={t('path.commercialShort')} stroke="#8B6914" strokeWidth={2} />
              <Line type="monotone" dataKey="Grant" name={t('path.grantShort')} stroke="#4A7C3F" strokeWidth={1.5} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="TEPIX Loan" name={t('path.tepixLoanShort')} stroke="#7B5EA7" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 14. P&L Timeline — detailed evidence */}
        <div id="bank-pnl" className="mb-6">
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            {t('pnl.title')}
          </h3>
          {rampHaircutNote}
          <BankPnLSection />
        </div>

        {/* 15. Footer */}
        <div className="text-center py-8 border-t border-surface-tertiary">
          <p className="text-xs text-text-tertiary">
            {t('app.title')} &middot; {t('app.location')} &middot; {t('app.confidential')}
          </p>
        </div>

      </div>}

      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={BANK_TOUR} />
      <VillaMarketDrawer
        open={villaSaleDrawerOpen}
        onClose={() => setVillaSaleDrawerOpen(false)}
        initialTab="sale"
        onlyTab="sale"
      />
    </>
  );
}
