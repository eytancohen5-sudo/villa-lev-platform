"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, ComposedChart, Area, Bar } from "recharts";
import { useModelStore } from "@/lib/store/modelStore";
import {
  formatCurrency,
  formatPercent,
  formatMultiple,
} from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { PageSkeleton } from "@/components/Skeleton";
import { LiveTrackRecord } from "@/components/LiveTrackRecord";
import { PageTour, TourButton, usePageTour } from "@/components/PageTour";
import { DASHBOARD_TOUR } from "@/lib/tours/configs";
import { logPresenceActivity } from "@/lib/data/usePresence";
import {
  SERVICES_PROFIT_MARGIN,
  BP_ANCILLARY_PROFIT_PER_VILLA,
  BP_ANCILLARY_SUITE_TOTAL,
  BP_ANCILLARY_SUITE_ROOMS,
  BP_ANCILLARY_PORTFOLIO_TOTAL,
} from "@/lib/data/currentVillaActuals";
import { useSeasonSnapshot } from "@/lib/data/useSeasonSnapshot";
import { computeCapTable } from "@/lib/engine/capTable";
import { resolvePortfolio, PROJECT_CONSTANTS } from "@/lib/engine/defaults";
import { computeTotalKeysMaxSplit, computeTotalBedrooms, bedroomsForPlot, keysForPlot } from "@/lib/engine/bedroomKeys";
import { SectionHeader, KPICard, StatusChip } from "@/components/AdminUI";
import { CapexUpliftControl } from "@/components/CapexUpliftControl";
import { useTrackFeature } from "@/lib/hooks/useTrackFeature";

// ── Page ────────────────────────────────────────────────────

export default function DashboardPage() {
  const { track } = useTrackFeature();
  useEffect(() => { track("admin-dashboard"); }, [track]);
  const { t, locale } = useTranslation();
  const { model, assumptions, activeScenario, projects, capTable, waterfall, setFinancingPath, templates, capexUpliftEur, capexUpliftBaselineLoans, financingPathOverride } = useModelStore();
  const { currentSeason, lastCompletedSeason } = useSeasonSnapshot();
  const [showStressDetail, setShowStressDetail] = useState(false);
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(DASHBOARD_TOUR.storageKey);
  const [xlsxLoading, setXlsxLoading] = useState(false);
  const baseCapexRef = useRef<number>(0);
  const baselineLoanRef = useRef<number>(0);
  const baselineDscrRef = useRef<number>(0);

  const handleDownloadXlsx = async () => {
    if (!model || xlsxLoading) return;
    setXlsxLoading(true);
    void logPresenceActivity('excel_download');
    try {
      const { exportBusinessPlan } = await import('@/lib/excel/exportBP');
      const exportScenario = activeScenario === 'breakeven' ? 'realistic' : activeScenario;
      const blob = await exportBusinessPlan(assumptions, model, exportScenario, capTable, waterfall, locale);
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

  if (!model) return <PageSkeleton variant="grid" />;

  const activeScenarioOutput = model.scenarios[activeScenario];
  const activePnL = activeScenarioOutput.pnl;

  const portfolio = resolvePortfolio(templates, projects);
  const totalPlots = portfolio.reduce((s, p) => s + p.count, 0);
  const totalVillas = portfolio.reduce((s, p) => s + p.count * p.villaUnits, 0);
  const totalStdSuites = portfolio.reduce((s, p) => s + p.count * p.standardSuites, 0);
  const totalDblSuites = portfolio.reduce((s, p) => s + p.count * p.doubleSuites, 0);
  const totalSuites = totalStdSuites + totalDblSuites;
  const totalGIA = portfolio.reduce((s, p) => s + p.count * (p.constructionArea ?? 0), 0);
  const totalKeysMaxSplit = computeTotalKeysMaxSplit(portfolio);
  const totalBedrooms     = computeTotalBedrooms(portfolio);
  const stab = activeScenarioOutput.stabilisedYear;

  const covenant = assumptions.dscrCovenantThreshold ?? 1.25;

  const dscrRows = [
    {
      label: t('scenario.upside'),
      stabDscr: model.scenarios.upside.pnl.find((p) => p.year === 2031)?.dscr ?? 0,
      avgDscr: model.scenarios.upside.avgDSCRLoanLife,
      minDscr: model.scenarios.upside.minDSCRLoanLife,
      isBase: false,
    },
    {
      label: t('scenario.realistic'),
      stabDscr: model.scenarios.realistic.pnl.find((p) => p.year === 2031)?.dscr ?? 0,
      avgDscr: model.scenarios.realistic.avgDSCRLoanLife,
      minDscr: model.scenarios.realistic.minDSCRLoanLife,
      isBase: true,
    },
    {
      label: t('scenario.downside'),
      stabDscr: model.scenarios.downside.pnl.find((p) => p.year === 2031)?.dscr ?? 0,
      avgDscr: model.scenarios.downside.avgDSCRLoanLife,
      minDscr: model.scenarios.downside.minDSCRLoanLife,
      isBase: false,
    },
  ];

  const showDscrTepixCol = assumptions.financingPath === 'tepix-loan';
  const tepixDscr = {
    stabDscr: model.tepixLoanScenario?.stabilisedYear?.dscr ?? 0,
    avgDscr: model.tepixLoanScenario?.avgDSCRLoanLife ?? 0,
    minDscr: model.tepixLoanScenario?.minDSCRLoanLife ?? 0,
  };

  const dscrDashboardData = model.scenarios.realistic.pnl
    .filter((p) => p.year >= 2026)
    .map((p) => {
      const up   = model.scenarios.upside.pnl.find((u) => u.year === p.year);
      const down = model.scenarios.downside.pnl.find((d) => d.year === p.year);
      const hasDs = p.dscr > 0;
      return {
        year: p.year,
        Upside:    hasDs ? Number((up?.dscr ?? 0).toFixed(2)) : null,
        Realistic: hasDs ? Number(p.dscr.toFixed(2))          : null,
        Downside:  hasDs ? Number((down?.dscr ?? 0).toFixed(2)) : null,
      };
    });

  const debtServiceChartData = activePnL
    .filter((p) => p.year >= 2026)
    .map((p) => ({
      year: p.year,
      cfads: Math.round(p.cfads),
      fundingGap: Math.max(0, Math.round(p.debtService - p.cfads)),
      debtService: Math.round(p.debtService),
      interest: Math.round(p.termLoanInterest),
    }));

  const dashDsraTarget = activeScenarioOutput.dsraTarget ?? 0;
  const dashDsraData = dashDsraTarget > 0
    ? activePnL
        .filter((p) => p.year >= 2026)
        .map((p) => ({
          year: p.year,
          balance: Math.round(p.dsraBalance ?? 0),
          draw: Math.round(p.dsraDraw ?? 0),
          replenishment: Math.round(p.dsraReplenishment ?? 0),
        }))
    : [];

  const km = {
    ...model.keyMetrics,
    totalMOIC: activeScenarioOutput.totalMOIC,
    terminalUnderwater: activeScenarioOutput.terminalUnderwater,
    equityIRR: activeScenarioOutput.equityIRR,
    terminalAssetValue: activeScenarioOutput.terminalAssetValue,
    terminalAssetValuePropertySale: activeScenarioOutput.terminalAssetValuePropertySale,
    terminalEquityValue: activeScenarioOutput.terminalEquityValue,
    terminalEquityValuePropertySale: activeScenarioOutput.terminalEquityValuePropertySale,
    equityIRRPropertySale: activeScenarioOutput.equityIRRPropertySale,
    propertyExitDominates: activeScenarioOutput.propertyExitDominates,
  };

  // Founder waterfall — derived once, shared with Cap Table page. The
  // dashboard surfaces just the headline split + cap status; full
  // year-by-year detail lives on /admin/cap-table.
  //
  // Layer B (grant bonus) is derived from the active scenario's senior
  // loan balance, so the % adjusts automatically as financing terms move.
  const founderResult = computeCapTable(
    activeScenarioOutput,
    capTable,
    waterfall,
    {
      grantApproved: assumptions.financingPath === "grant",
      // Use the engine's DEFAULT_BASELINE_BANK_LOAN — Layer B is measured
      // against the pre-grant commercial-financing equity gap so it stays
      // stable across path toggles.
    },
  );
  const founderBd = founderResult.founderBreakdown;
  const capStatusLabel =
    founderBd.capBinding === "total_75"
      ? t('dash.founder.capBinding75')
      : founderBd.capBinding === "ratchet_10"
        ? t('dash.founder.capRatchet10')
        : founderBd.capBinding === 'exit_55_grant'
          ? t('dash.founder.capExit55Grant')
          : t('dash.founder.capFree');

  const pathLabel =
    assumptions.financingPath === "grant"
      ? t('path.grant')
      : assumptions.financingPath === "rrf"
        ? t('path.rrf')
        : assumptions.financingPath === "tepix-loan"
          ? t('path.tepixLoan')
          : t('path.commercial');

  // ACTIVE PATH tile was removed from the KPI grid (restructure 2026-05-22);
  // path metadata now lives in the page header subtitle as `pathLabel`. The
  // pathLabelShort variant was only used for that tile and has been dropped.

  const scenarioLabel =
    activeScenario === 'upside' ? t('scenario.upside') :
    activeScenario === 'downside' ? t('scenario.downside') :
    activeScenario === 'breakeven' ? t('scenario.breakeven') :
    t('scenario.realistic');

  const formatYieldMultiple = (v: number) => `${v.toFixed(2)}×`;

  // ── Conservatism Check ─────────────────────────────────────────
  // Per-villa BP assumptions vs the existing villa's live performance.
  // Live numbers come from admin.villalevantiparos.com via currentVillaActuals.
  // Story: every per-villa modeled value is at or below today's actuals, so
  // the BP is downside-biased — real portfolio outcomes should beat the plan.
  const rev = assumptions.revenueRealistic;
  const revUp = assumptions.revenueUpside;

  // Live per-villa actuals from the operating villa today.
  const liveADR = currentSeason.netADR;
  const liveBookedNights = currentSeason.bookedNights;
  const liveAccommodation = currentSeason.rentalNet;
  // Services are seasonal — 2025 is the most recently completed full year.
  const liveServices2025 = lastCompletedSeason.services;
  const liveTotal2025 = lastCompletedSeason.total;

  // BP per-villa modeled values.
  const bpADR = rev.villaADR;
  const bpNights = rev.villaBaseNights;
  const bpAccommodationPerVilla = bpADR * bpNights;
  const bpEventsPortfolio = rev.eventsPerYear * rev.netProfitPerEvent;
  // Ancillary: the BP allocates ancillary profit explicitly per-villa
  // (€15K) and separately to suite rooms (€30K across 11 villa suites). For the
  // per-villa conservatism comparison we use the villa value directly —
  // suite rooms have a different service mix (fewer guests per room) and
  // belong in a different comparator if surfaced.
  const totalVillaUnits =
    (assumptions.portfolio ?? []).reduce(
      (s, p) => s + p.villaUnits * p.count,
      0,
    ) || 1;
  const bpAncillaryPerVilla = BP_ANCILLARY_PROFIT_PER_VILLA;

  // Portfolio totals (stabilised) — kept for the scale-up footer.
  const totalUnits = projects.reduce((s, p) => s + p.count, 0);
  const buildingTotalRevenue = stab?.totalRevenue ?? 0;
  const buildingEBITDA = stab?.ebitda ?? 0;
  // Upside scenario's stabilised totals for the BP UPSIDE column.
  const upsideStab = model.scenarios.upside.stabilisedYear;
  const upsideTotalRevenue = upsideStab?.totalRevenue ?? 0;

  // Verdict helper: BP value vs live actual, expressed as % gap.
  // Negative gap = BP below live = conservative (positive tone).
  const conservatism = (bp: number, live: number) => {
    if (live <= 0) return { gap: 0, label: "—", tone: "neutral" as const };
    const gap = (bp / live - 1) * 100;
    const abs = Math.abs(gap).toFixed(gap === 0 ? 0 : 1);
    if (gap <= -1.5) return { gap, label: `${t('dash.stress.verdictBelow')} ${abs}% below`, tone: "positive" as const };
    if (gap >= 1.5) return { gap, label: `${t('dash.stress.verdictAbove')} ${abs}% above`, tone: "warning" as const };
    return { gap, label: t('dash.stress.verdictPar'), tone: "neutral" as const };
  };

  const verdictADR = conservatism(bpADR, liveADR);
  const verdictNights = conservatism(bpNights, liveBookedNights);
  const verdictAccommodation = conservatism(bpAccommodationPerVilla, liveAccommodation);

  // Drift alert: surface a header-level chip when the BP per-villa ADR or
  // booked-nights assumption is >10% off the live actuals. The Conservatism
  // Check section below carries fine-grained tone; this chip is the at-a-
  // glance escalation so an operator opening the dashboard immediately sees
  // when the model has drifted from reality. The threshold is loose enough
  // that normal scenario tweaking doesn't fire it.
  const DRIFT_ALERT_THRESHOLD = 0.10;
  const adrDrift = liveADR > 0 ? bpADR / liveADR - 1 : 0;
  const nightsDrift = liveBookedNights > 0 ? bpNights / liveBookedNights - 1 : 0;
  const adrDriftFires = Math.abs(adrDrift) > DRIFT_ALERT_THRESHOLD;
  const nightsDriftFires = Math.abs(nightsDrift) > DRIFT_ALERT_THRESHOLD;
  const showDriftAlert = adrDriftFires || nightsDriftFires;
  // Ancillary is compared NET PROFIT to NET PROFIT.
  // - BP per villa is the explicit €15K allocation from the BP breakdown.
  // - Live services on the ops dashboard are gross revenue; we multiply by
  //   SERVICES_PROFIT_MARGIN (25%) to land on a comparable profit number.
  const liveServicesProfit2025 = liveServices2025 * SERVICES_PROFIT_MARGIN;
  const verdictAncillary = conservatism(bpAncillaryPerVilla, liveServicesProfit2025);

  const verdictToneClass = (tone: "positive" | "warning" | "neutral") =>
    tone === "positive"
      ? "bg-positive/15 text-positive"
      : tone === "warning"
        ? "bg-warning/15 text-warning"
        : "bg-surface-secondary text-text-tertiary";

  return (
    <div>
      {/* Quick Access — Tour · Presentation · Model */}
      <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50/60 to-white p-4 mb-6 print:hidden">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-500">
            {t('admin.actions.heading')}
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
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-400 bg-brand-50 px-2 py-0.5 rounded-full">5 min</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary leading-tight">{t('admin.actions.tour.title')}</p>
              <p className="text-xs text-text-tertiary mt-1 leading-relaxed">{t('admin.actions.tour.sub')}</p>
            </div>
          </button>

          {/* Investor Presentation */}
          <a
            href="/presentation"
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
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-400 bg-brand-50 px-2 py-0.5 rounded-full">PDF</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary leading-tight">{t('admin.actions.presentation.title')}</p>
              <p className="text-xs text-text-tertiary mt-1 leading-relaxed">{t('admin.actions.presentation.sub')}</p>
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
                {xlsxLoading ? t('bar.preparing') : t('admin.actions.model.title')}
              </p>
              <p className="text-xs text-text-tertiary mt-1 leading-relaxed">{t('admin.actions.model.sub')}</p>
            </div>
          </button>

        </div>
      </div>

      {/* About the project */}
      <div className="rounded-xl border border-surface-tertiary bg-white p-6 mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary mb-3">{t('dash.about.title')}</h2>
        <p className="text-sm text-text-secondary leading-relaxed mb-4">
          <span className="font-semibold text-text-primary">{t('dash.about.aboutVillaLevGroup')}</span>
          {' '}{t('dash.about.isDeveloping')}{' '}
          <span className="font-semibold text-text-primary">{totalPlots} {t('dash.about.plotsIn')}</span>
          {' '}
          <span className="font-semibold text-text-primary">{totalVillas} {t('dash.about.villaDesc')}</span>
          {' '}
          <span className="font-semibold text-text-primary">{totalSuites} {t('dash.about.suiteDesc')}</span>
          {' '}{t('dash.about.inventoryIntro')}{' '}
          <span className="font-semibold text-text-primary">{totalBedrooms} {t('dash.about.bedroomsAcross')}</span>
          {' '}
          <span className="font-semibold text-text-primary">{totalKeysMaxSplit} {t('dash.about.rentableKeys')}</span>
          {' '}{t('dash.about.anchorPrefix')}{' '}
          <a
            href="https://www.airbnb.com/rooms/49627193?guests=1&adults=1&s=67&unique_share_id=20f5564b-2002-4925-a2c1-17be7c330dea"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900 transition-colors"
          >
            Villa Lev Antiparos
          </a>
          {' '}{t('dash.about.anchorSuffix')}
        </p>
        <div className="overflow-x-auto rounded-lg border border-surface-tertiary">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-secondary/50">
                <th className="text-left py-2 px-3 font-semibold uppercase tracking-wider text-text-tertiary">{t('dash.about.colPlot')}</th>
                <th className="text-center py-2 px-3 font-semibold uppercase tracking-wider text-text-tertiary">{t('dash.about.colCount')}</th>
                <th className="text-left py-2 px-3 font-semibold uppercase tracking-wider text-text-tertiary">{t('dash.about.colType')}</th>
                <th className="text-right py-2 px-3 font-semibold uppercase tracking-wider text-text-tertiary">{t('dash.about.colKeysPerPlot')}</th>
                <th className="text-right py-2 px-3 font-semibold uppercase tracking-wider text-text-tertiary">{t('dash.about.colBedrooms')}</th>
                <th className="text-right py-2 px-3 font-semibold uppercase tracking-wider text-text-tertiary">{t('dash.about.colGia')}</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((p) => (
                <tr key={p.id} className="border-t border-surface-secondary/60">
                  <td className="py-2 px-3 font-medium text-text-primary">{p.name}</td>
                  <td className="py-2 px-3 text-center text-text-secondary">×{p.count}</td>
                  <td className="py-2 px-3 text-text-secondary">
                    {p.villaUnits > 0 ? t('dash.about.typeLuxuryVilla') : t('dash.about.typeSuiteVillas')}
                  </td>
                  <td className="py-2 px-3 text-right text-text-secondary">
                    {p.villaUnits > 0
                      ? <>{1} {t('dash.about.keysWhole')} / {keysForPlot(p)} {t('dash.about.keysMaxSplit')}</>
                      : <>{p.standardSuites} std · {p.doubleSuites} dbl = {p.standardSuites + p.doubleSuites}</>
                    }
                  </td>
                  <td className="py-2 px-3 text-right text-text-secondary font-mono">
                    {bedroomsForPlot(p)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-text-secondary">
                    ~{Math.round(p.constructionArea ?? 0).toLocaleString()} m²
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-surface-tertiary bg-surface-secondary/20">
                <td className="py-2 px-3 font-semibold text-text-primary">{t('dash.about.totalRow')}</td>
                <td className="py-2 px-3 text-center font-semibold text-text-primary">{totalPlots}</td>
                <td className="py-2 px-3" />
                <td className="py-2 px-3 text-right text-text-secondary">
                  {totalKeysMaxSplit} {t('dash.about.totalKeysLabel')}
                </td>
                <td className="py-2 px-3 text-right font-mono font-semibold text-text-primary">
                  {totalBedrooms} {t('dash.about.totalBedroomsLabel')}
                </td>
                <td className="py-2 px-3 text-right font-mono font-semibold text-text-primary">
                  ~{Math.round(totalGIA).toLocaleString()} m²
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Header — active-path metadata lives here (path · scenario · stab year),
          NOT as a KPICard in the metric grid. Plan 2026-05-22: demote ACTIVE PATH
          from the KPI grid; the subtitle below is now the single source of truth
          for "which configuration am I looking at?". */}
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-text-primary border-l-[3px] border-brand-400 pl-3">{t('dash.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('dash.pageIntro')}</p>
          <p className="text-sm font-medium text-text-secondary mt-1">
            <span className="text-text-primary">{pathLabel}</span>
            <span className="text-text-tertiary"> &middot; </span>
            {scenarioLabel}
            <span className="text-text-tertiary"> &middot; </span>
            {t('dash.stabilisedYear')}
            {showDriftAlert && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 border border-warning-200 px-2 py-0.5 text-[11px] font-medium text-warning-700 ml-2">
                &#9888; {t('dash.driftAlert')}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* P1-14: Sticky in-page anchor bar (UX-07) */}
      <nav
        aria-label={t('dash.anchor.overview')}
        className="sticky top-0 z-40 bg-surface-primary/95 backdrop-blur-sm border-b border-surface-tertiary mb-6 scroll-smooth print:hidden"
      >
        <div className="flex gap-1 overflow-x-auto px-1 py-2 scrollbar-none">
          {([
            { href: '#section-deal-snapshot', label: t('dash.anchor.overview') },
            { href: '#section-three-scenario', label: t('dash.anchor.returns') },
            { href: '#section-dscr-summary',  label: t('dash.anchor.dscr') },
            { href: '#section-conservatism',  label: t('dash.anchor.conservatism') },
            { href: '#section-founder',       label: t('dash.anchor.founder') },
          ] as const).map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="shrink-0 px-3 py-1 rounded-full text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      {/* LiveTrackRecord — banker proof, lifted ABOVE the Headline KPI grid so
          the first thing under the Term Sheet is the real-villa track record,
          not modeled figures. Used to sit inside the Conservatism Check
          section; restructure 2026-05-22 surfaces it as the lede. */}
      <div className="mb-6">
        <LiveTrackRecord />
      </div>

{/* Market position evidence is fully covered by the Villa and Hotel rooms
          sections inside LiveTrackRecord above — no separate strip needed. */}


      {/* Section 0 — Headline KPIs (was "Deal Snapshot").
          Restructure 2026-05-22: stripped duplicates with the Term Sheet
          strip above. Removed: Loan Amount, Annual DS (both in Term Sheet);
          ACTIVE PATH tile (demoted to the page subtitle in the header).
          Kept: Total Investment, Equity Required, DSCR · 2030, Equity IRR —
          the 4 underwriting figures a banker reads after the deal terms.
          Stabilised DSCR removed 2026-05-22 — it's the same metric as
          DSCR · 2030 at a later horizon; bankers quote the 2030 figure
          because that's the post-ramp, covenant-relevant year. The
          stabilised value still lives in `km.stabilisedDSCR` for the
          downside-scenario block and the comparison table further down.
          Anchor id preserved for the page tour. */}
      <div id="section-deal-snapshot" className="scroll-mt-24">
        <SectionHeader title={t('dash.section.headline')} sub={t('dash.headlineSub')} />
        <div key={activeScenario} className={`animate-fade-in grid grid-cols-2 gap-3 ${assumptions.financingPath === "grant" ? "md:grid-cols-4 lg:grid-cols-7" : "md:grid-cols-3 lg:grid-cols-6"}`}>
          <KPICard
            label={t('kpi.totalInvestment')}
            value={formatCurrency(km.totalCapex, true, locale)}
            sublabel={(() => {
              const n = projects.reduce((s, p) => s + p.count, 0);
              return `${n} ${t(n === 1 ? 'kpi.plotsSingular' : 'kpi.plots')}`;
            })()}
          />
          <KPICard
            label={t('kpi.capexEquity')}
            value={formatCurrency(km.equityRequired, true, locale)}
            sublabel={`${formatPercent(km.equityRequired / km.totalCapex, 0)} ${t('kpi.ofTotal')}`}
          />
          {km.graceInterestCarry > 0 && (
            <KPICard
              label={t('kpi.graceInterestCarry')}
              value={formatCurrency(km.graceInterestCarry, true, locale)}
              sublabel={t('kpi.graceInterestCarrySub')}
            />
          )}
          <KPICard
            label={t('kpi.totalMOIC')}
            value={km.totalMOIC !== 0 ? formatYieldMultiple(km.totalMOIC) : "—"}
            sublabel={t('kpi.totalMOICSub')}
            tone={km.terminalUnderwater ? "warning" : km.totalMOIC >= 2 ? "positive" : km.totalMOIC > 1 ? undefined : "warning"}
            chip={km.terminalUnderwater ? { label: "underwater", ok: false } : undefined}
          />
          <KPICard
            label={t('kpi.equityIRR')}
            value={km.equityIRR > 0 ? formatPercent(km.equityIRR) : "—"}
            sublabel={t('kpi.equityIRRSub')}
            tone={km.equityIRR >= 0.15 ? "positive" : km.equityIRR > 0 ? undefined : "warning"}
          />
          <KPICard
            label={t('kpi.stabilisedRevenue')}
            value={buildingTotalRevenue > 0 ? formatCurrency(buildingTotalRevenue, true, locale) : "—"}
            sublabel={t('kpi.stabilisedRevenueSub')}
          />
          <KPICard
            label={t('term.ebitda')}
            value={buildingEBITDA > 0 ? formatCurrency(buildingEBITDA, true, locale) : "—"}
            sublabel={buildingTotalRevenue > 0 ? `${formatPercent(buildingEBITDA / buildingTotalRevenue, 0)} ${t('term.ebitdaMargin')}` : "—"}
            tone={buildingEBITDA > 0 ? "positive" : undefined}
          />
          {assumptions.financingPath === "grant" && (
            <KPICard
              label={t('kpi.grantAmount')}
              value={formatCurrency(km.grantAmount, true, locale)}
              sublabel={`${formatPercent(assumptions.grant.grantRate, 0)} ${t('kpi.grantAmountSub')}`}
              tone="positive"
            />
          )}
          {(activeScenarioOutput?.dsraTarget ?? 0) > 0 && (
            <KPICard
              label={t('dsra.dashKpiLabel')}
              value={formatCurrency(activeScenarioOutput.dsraTarget ?? 0, true, locale)}
              sublabel={`${formatCurrency(activeScenarioOutput.dsraPartnerAdvance ?? 0, true, locale)} ${t('dsra.dashKpiSub')}`}
            />
          )}
        </div>
        {assumptions.financingPath !== "grant" && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setFinancingPath("grant")}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-positive/10 border border-positive/30 text-positive text-xs font-medium hover:bg-positive/20 hover:border-positive/50 transition-all"
            >
              {t('dash.activateGrantPath')}
            </button>
          </div>
        )}
      </div>

      {/* CAPEX uplift sensitivity — ephemeral, affects all paths */}
      {(() => {
        if (capexUpliftEur === null) {
          baseCapexRef.current = model.capex.portfolioTotal;
          baselineLoanRef.current = km.loanAmount;
          baselineDscrRef.current = model.scenarios.realistic.minDSCRLoanLife;
        }
        const activePathKey = (financingPathOverride ?? assumptions.financingPath) === 'tepix-loan' ? 'tepixLoan' : (financingPathOverride ?? assumptions.financingPath) as 'commercial' | 'rrf' | 'grant' | 'optima';
        const baselineLoanEur = capexUpliftBaselineLoans?.[activePathKey] ?? baselineLoanRef.current;
        return (
          <div className="mb-4">
            <CapexUpliftControl
              baseCapexEur={baseCapexRef.current}
              baselineLoanEur={baselineLoanEur}
              currentLoanEur={km.loanAmount}
              currentDscr={model.scenarios.realistic.minDSCRLoanLife}
              baselineDscr={baselineDscrRef.current > 0 ? baselineDscrRef.current : undefined}
            />
          </div>
        );
      })()}

      {/* Equity at close breakdown — always visible regardless of scenario */}
      <div className="mb-6">
        <div className="bg-white rounded-xl border border-surface-tertiary shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-tertiary bg-surface-secondary/40 flex items-center justify-between">
            <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">{t('equity.atCloseTitle')}</span>
            <span className="text-xs text-text-tertiary">{t('kpi.ofTotal')}</span>
          </div>
          <div className="divide-y divide-surface-tertiary/50">
            {[
              {
                label: t('kpi.capexEquity'),
                value: km.equityRequired,
                pct: km.totalCapex > 0 ? km.equityRequired / km.totalCapex : 0,
              },
              {
                label: t('kpi.graceInterestCarry'),
                value: km.graceInterestCarry,
                pct: km.totalCapex > 0 ? km.graceInterestCarry / km.totalCapex : 0,
              },
              {
                label: t('dsra.partnerAdvance'),
                value: activeScenarioOutput?.dsraPartnerAdvance ?? 0,
                pct: km.totalCapex > 0 ? (activeScenarioOutput?.dsraPartnerAdvance ?? 0) / km.totalCapex : 0,
              },
            ].map(({ label, value, pct }) => (
              <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-text-secondary">{label}</span>
                <div className="flex items-center gap-3 tabular-nums">
                  <span className="text-text-tertiary text-xs">{formatPercent(pct, 0)}</span>
                  <span className="font-mono text-text-primary w-28 text-right">{formatCurrency(value, true, locale)}</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold bg-surface-secondary/30">
              <span className="text-text-primary">{t('pnl.equityAtClose')}</span>
              <div className="flex items-center gap-3 tabular-nums">
                <span className="text-text-tertiary text-xs">
                  {formatPercent(km.totalCapex > 0 ? (km.equityRequired + km.graceInterestCarry + (activeScenarioOutput?.dsraPartnerAdvance ?? 0)) / km.totalCapex : 0, 0)}
                </span>
                <span className="font-mono text-text-primary w-28 text-right">
                  {formatCurrency(km.equityRequired + km.graceInterestCarry + (activeScenarioOutput?.dsraPartnerAdvance ?? 0), true, locale)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Three-Scenario Return Table */}
      <div id="section-three-scenario" className="mb-6">
        <SectionHeader
          title={t('dash.section.threeScenario')}
          sub={t('dash.threeScenarioSub')}
        />
        <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary bg-surface-secondary/40">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wide">{t('dash.colScenario')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wide">{t('kpi.equityIRR')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wide">{t('dash.colCashYield')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wide">{t('kpi.totalMOIC')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-tertiary/50">
              {[
                { label: t('scenario.upside'), s: model.scenarios.upside, isBase: false },
                { label: t('scenario.realistic'), s: model.scenarios.realistic, isBase: true },
                { label: t('scenario.downside'), s: model.scenarios.downside, isBase: false },
              ].map(({ label, s, isBase }) => (
                <tr key={label} className={isBase ? "bg-brand-50/50 font-medium" : ""}>
                  <td className="px-4 py-3 text-text-primary">{label}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${s.equityIRR >= 0.20 ? "text-positive" : s.equityIRR < 0.12 ? "text-warning" : "text-text-primary"}`}>
                    {formatPercent(s.equityIRR)}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${s.yieldStabilised >= 0.12 ? "text-positive" : s.yieldStabilised < 0.08 ? "text-warning" : "text-text-primary"}`}>
                    {formatPercent(s.yieldStabilised)}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${s.totalMOIC >= 2 ? "text-positive" : s.totalMOIC < 1.5 ? "text-warning" : "text-text-primary"}`}>
                    {s.totalMOIC.toFixed(2)}×
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-surface-tertiary bg-surface-secondary/20 text-right">
            <Link href="/admin/returns" className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-[11px] font-medium hover:bg-brand-100 hover:border-brand-400 transition-all">
              {t('dash.fullReturnsLink')}
            </Link>
          </div>
        </div>
      </div>

      {/* DSCR Summary — chart + compact cross-scenario table; drill-in at /admin/debt-coverage */}
      <div id="section-dscr-summary" className="mb-6 scroll-mt-24">
        <SectionHeader
          title={t('bank.section.dscrSummary')}
          sub={`${t('bank.dscrTable.covenant')} ${covenant.toFixed(2)}× · ${t('bank.dscrTable.minLoanLife')}`}
        />

        {/* Row 1 — DSCR trajectory + Payment Capacity (2-column, same x-axis 2026→) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* DSCR trajectory chart */}
          <div className="bg-white rounded-xl border border-surface-tertiary p-5 shadow-sm">
            <div className="flex items-start justify-between mb-1">
              <h3 className="text-base font-semibold text-text-primary">{t('dash.heroDscr')}</h3>
              <span className="text-sm text-text-secondary font-mono">
                {t('dash.minDscr')} {formatMultiple(model.scenarios.realistic.minDSCRLoanLife)}
              </span>
            </div>
            <p className="text-xs text-text-tertiary mb-4">{t('dash.heroDscrSub')}</p>
            <ResponsiveContainer key={`dscr-dashboard-${activeScenario}-${assumptions.financingPath}`} width="100%" height={260}>
              <LineChart data={dscrDashboardData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}×`} domain={[0.75, "dataMax + 0.5"]} />
                <Tooltip formatter={(value) => value != null ? `${Number(value).toFixed(2)}×` : '—'} contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={assumptions?.dscrCovenantThreshold ?? 1.25} stroke="#9E3B3B" strokeDasharray="5 5" label={{ value: t('dc.covenantLabel'), fontSize: 10, fill: "#9E3B3B" }} />
                <ReferenceLine y={1.50} stroke="#6B7A3D" strokeDasharray="3 3" label={{ value: t('dc.comfortLabel'), fontSize: 10, fill: "#6B7A3D" }} />
                <Line connectNulls={false} type="monotone" dataKey="Upside" name={t('scenario.upside')} stroke="#4A7C3F" strokeWidth={1.8} strokeDasharray="6 3" dot={false} activeDot={{ r: 4 }} />
                <Line connectNulls={false} type="monotone" dataKey="Realistic" name={t('scenario.realistic')} stroke="#8B6914" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line connectNulls={false} type="monotone" dataKey="Downside" name={t('scenario.downside')} stroke="#9E3B3B" strokeWidth={1.8} strokeDasharray="4 2" dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Payment Capacity chart */}
          <div className="bg-white rounded-xl border border-surface-tertiary p-5 shadow-sm">
            <div className="mb-1">
              <h3 className="text-base font-semibold text-text-primary">{t('dash.annualDSChart')}</h3>
            </div>
            <p className="text-xs text-text-tertiary mb-4">{t('dash.dsChart.sub')}</p>
            <ResponsiveContainer key={`ds-chart-${activeScenario}-${assumptions.financingPath}`} width="100%" height={260}>
              <ComposedChart data={debtServiceChartData}>
                <defs>
                  <linearGradient id="dsObligation" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9E3B3B" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#9E3B3B" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}K`} domain={['auto', 'dataMax']} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const cfadsVal = Number(payload.find((p) => p.dataKey === 'cfads')?.value ?? 0);
                    const dsVal = Number(payload.find((p) => p.dataKey === 'debtService')?.value ?? 0);
                    const impliedDscr = dsVal > 0 ? (cfadsVal / dsVal).toFixed(2) : '—';
                    return (
                      <div style={{ background: 'white', border: '1px solid #EDE6D5', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
                        {payload.map((p) => (
                          <div key={p.dataKey as string} style={{ color: p.color, marginBottom: 2 }}>
                            {p.name}: {formatCurrency(Number(p.value), false, locale)}
                          </div>
                        ))}
                        <div style={{ color: '#6B7280', borderTop: '1px solid #EDE6D5', marginTop: 4, paddingTop: 4 }}>
                          DSCR: {impliedDscr}×
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="debtService" name={t('pnl.debtService')} stroke="#9E3B3B" strokeWidth={2} fill="url(#dsObligation)" dot={false} />
                <Line type="monotone" dataKey="fundingGap" name={t('dash.dsChart.fundingGap')} stroke="#C4754B" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="interest" name={t('pnl.termLoanInterest')} stroke="#6B7280" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Row 2 — DSRA (half-width, conditional) */}
        {dashDsraTarget > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-xl border border-surface-tertiary p-5 shadow-sm">
              <h3 className="text-base font-semibold text-text-primary mb-1">{t('dsra.sectionTitle')}</h3>
              <p className="text-xs text-text-tertiary mb-4">{t('dsra.chartSub')}</p>
              {dashDsraData.some((d) => d.draw > 0 || d.replenishment > 0) ? (
                <ResponsiveContainer key={`dsra-dash-${activeScenario}-${assumptions.financingPath}`} width="100%" height={260}>
                  <ComposedChart data={dashDsraData} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dashDsraGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C4A55E" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#C4A55E" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}K`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v), false, locale)} contentStyle={{ borderRadius: 8, border: '1px solid #EDE6D5', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={dashDsraTarget} stroke="#8B6914" strokeDasharray="5 4" label={{ value: t('dsra.target'), position: 'insideTopRight', fontSize: 9, fill: '#8B6914' }} />
                    <Area type="monotone" dataKey="balance" name={t('dsra.legend.balance')} stroke="#C4A55E" strokeWidth={2.2} fill="url(#dashDsraGrad)" />
                    <Bar dataKey="replenishment" name={t('dsra.legend.replenish')} yAxisId="right" barSize={16} fill="#6B7A3D" />
                    <Bar dataKey="draw" name={t('dsra.legend.draw')} yAxisId="right" barSize={16} fill="#9E3B3B" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center gap-2 h-20 text-xs text-positive font-medium">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="6.5" stroke="#6B7A3D" /><path d="M4 7l2.5 2.5L10 4.5" stroke="#6B7A3D" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {t('dsra.noActivity')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cross-scenario table */}
        <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary bg-surface-secondary/40">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                  {t('bank.dscrTable.scenario')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                  {t('bank.dscrTable.stabilised')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                  {t('bank.dscrTable.avgLoanLife')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                  {t('bank.dscrTable.minLoanLife')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                  {t('bank.dscrTable.covenant')} {covenant.toFixed(2)}×
                </th>
                {showDscrTepixCol && (
                  <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                    {t('path.tepixLoanShort')} (Base)
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-tertiary/50">
              {dscrRows.map((row) => (
                <tr
                  key={row.label}
                  className={row.isBase ? 'bg-brand-50/50 font-medium' : undefined}
                >
                  <td className="px-4 py-3 text-text-primary">{row.label}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-text-primary">
                    {row.stabDscr > 0 ? formatMultiple(row.stabDscr) : '—'}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums font-semibold ${row.avgDscr >= covenant ? 'text-positive' : 'text-warning'}`}>
                    {formatMultiple(row.avgDscr)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums ${row.minDscr >= covenant ? 'text-positive' : 'text-warning'}`}>
                    {formatMultiple(row.minDscr)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusChip
                      ok={row.minDscr >= covenant}
                      label={row.minDscr >= covenant ? t('dash.termsheet.pass') : t('dash.termsheet.fail')}
                    />
                  </td>
                  {showDscrTepixCol && (
                    <td className={`px-4 py-3 text-right font-mono tabular-nums ${tepixDscr.minDscr >= covenant ? 'text-positive' : 'text-warning'}`}>
                      {/* Fixed to Base/Realistic TEPIX path — engine has no per-scenario TEPIX variants */}
                      {formatMultiple(tepixDscr.minDscr)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-surface-tertiary bg-surface-secondary/20 text-right">
            <Link href="/admin/debt-coverage" className="text-xs text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1">
              {t('nav.debtCoverage')} →
            </Link>
          </div>
        </div>
      </div>

      {/* Exit Analysis compact card */}
      <div id="section-exit-analysis" className="mb-6">
        <SectionHeader title={t('dash.section.exitAnalysis')} sub={t('dash.exitAnalysisSub')} />
        <Link
          href="/admin/returns"
          className="block bg-white rounded-xl border border-surface-tertiary shadow-sm hover:border-brand-400 hover:shadow-md transition-all p-5 group"
        >
          <div className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-tertiary">
                  <th className="text-left py-1.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">{t('dash.exit.route')}</th>
                  <th className="text-right py-1.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">{t('dash.exit.exitValue')}</th>
                  <th className="text-right py-1.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">{t('dash.exit.netToEquity')}</th>
                  <th className="text-right py-1.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">{t('dash.exit.exitIRR')}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: t('dash.exit.hotelSale'),
                    assetValue: km.terminalAssetValue,
                    netEquity: km.terminalEquityValue,
                    irr: km.equityIRR,
                    preferred: !km.propertyExitDominates,
                  },
                  {
                    label: t('dash.exit.propertySale'),
                    assetValue: km.terminalAssetValuePropertySale,
                    netEquity: km.terminalEquityValuePropertySale,
                    irr: km.equityIRRPropertySale,
                    preferred: km.propertyExitDominates,
                  },
                ].map((row) => (
                  <tr key={row.label} className={row.preferred ? 'bg-brand-50/60' : ''}>
                    <td className="py-2 text-sm font-medium text-text-primary">
                      {row.label}
                      {row.preferred && (
                        <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-brand-100 text-brand-700">{t('dash.exit.preferred')}</span>
                      )}
                    </td>
                    <td className="py-2 text-right font-mono text-sm">{row.assetValue != null ? formatCurrency(row.assetValue, true, locale) : '—'}</td>
                    <td className="py-2 text-right font-mono text-sm">{row.netEquity != null ? formatCurrency(row.netEquity, true, locale) : '—'}</td>
                    <td className="py-2 text-right font-mono text-sm text-positive">{row.irr != null ? (row.irr * 100).toFixed(1) + '%' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-[11px] text-text-tertiary group-hover:text-brand-600">
              {t('dash.exit.description')}
            </div>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-medium group-hover:bg-brand-100 group-hover:border-brand-400 group-hover:translate-x-0.5 transition-all shrink-0">
              {t('dash.exit.deepDive')}
            </span>
          </div>
        </Link>
      </div>



      {/* Section — Conservatism Check.
          Restructure 2026-05-22: LiveTrackRecord was lifted out of this
          section and placed directly under the Term Sheet strip (banker-
          proof lede). What stays here is the per-villa BP-vs-live comparison
          table — the audit detail that proves the conservatism story. */}
      <div id="section-conservatism" className="scroll-mt-24 mb-6">
        <SectionHeader
          title={t('dash.section.stressMargin')}
          sub={t('dash.stressMarginSub')}
          rightSlot={
            <button
              onClick={() => setShowStressDetail(v => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-brand-200 bg-brand-50 text-brand-700 text-xs font-medium hover:bg-brand-100 hover:border-brand-300 transition-colors whitespace-nowrap"
            >
              {showStressDetail ? t('dash.hideDetail') : t('dash.showDetail')}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className={`transition-transform duration-150 ${showStressDetail ? 'rotate-180' : ''}`}>
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          }
        />
        {!showStressDetail && (
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { label: 'ADR', tone: verdictADR.tone, verdict: verdictADR.label },
              { label: t('dash.stress.row.nights'), tone: verdictNights.tone, verdict: verdictNights.label },
              { label: t('dash.stress.row.accommodation'), tone: verdictAccommodation.tone, verdict: verdictAccommodation.label },
            ].map(row => (
              <span
                key={row.label}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                  row.tone === 'positive' ? 'bg-positive/10 text-positive' :
                  row.tone === 'warning' ? 'bg-warning/10 text-warning' :
                  'bg-surface-secondary text-text-secondary'
                }`}
              >
                {row.label}: {row.verdict}
              </span>
            ))}
          </div>
        )}
        {showStressDetail && <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-tertiary bg-surface-secondary/30">
                  <th className="text-left py-2.5 pl-4 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    {t('dash.stress.colAssumption')}
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs uppercase tracking-wider text-brand-700 font-medium">
                    {t('dash.stress.colBpConservative')}
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    {t('dash.stress.colBpRealistic')}
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs uppercase tracking-wider text-text-secondary font-medium">
                    {t('dash.stress.colLiveVilla')}
                  </th>
                  <th className="text-right py-2.5 px-3 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    {t('dash.stress.colVerdict')}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-surface-secondary/20">
                  <td colSpan={5} className="py-1.5 pl-4 pr-4 text-[10px] uppercase tracking-wider text-text-tertiary font-medium">
                    {t('dash.stress.row.perVillaConservatism')}
                  </td>
                </tr>
                <tr className="border-b border-surface-secondary/50">
                  <td className="py-2.5 pl-4 pr-4 text-text-secondary">
                    {t('dash.stress.row.nights')} <span className="text-text-tertiary">({t('dash.stress.row.nightsUnit')})</span>
                    <div className="text-[11px] text-text-tertiary">{t('dash.stress.row.nightsNote')}</div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">{bpNights}</td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-tertiary">{revUp.villaBaseNights}</td>
                  <td className="text-right py-2.5 px-3 data-cell">
                    {liveBookedNights}
                    <div className="text-[11px] text-text-tertiary">{t('dash.stress.row.nightsLiveNote')}</div>
                  </td>
                  <td className="text-right py-2.5 px-3 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${verdictToneClass(verdictNights.tone)}`}>
                      {verdictNights.label}
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-surface-secondary/50">
                  <td className="py-2.5 pl-4 pr-4 text-text-secondary">
                    ADR — Net <span className="text-text-tertiary">({t('dash.stress.row.adrUnit')})</span>
                    <div className="text-[11px] text-text-tertiary">{t('dash.stress.row.adrNote')}</div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">{formatCurrency(bpADR, false, locale)}</td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-tertiary">{formatCurrency(revUp.villaADR, false, locale)}</td>
                  <td className="text-right py-2.5 px-3 data-cell">
                    {formatCurrency(liveADR, false, locale)}
                    <div className="text-[11px] text-text-tertiary">2026 net · gross {formatCurrency(currentSeason.grossADR, false, locale)}</div>
                  </td>
                  <td className="text-right py-2.5 px-3 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${verdictToneClass(verdictADR.tone)}`}>
                      {verdictADR.label}
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-surface-secondary/50">
                  <td className="py-2.5 pl-4 pr-4 text-text-secondary">
                    {t('dash.stress.row.accommodation')} <span className="text-text-tertiary">({t('dash.stress.row.accommodationUnit')})</span>
                    <div className="text-[11px] text-text-tertiary">{t('dash.stress.row.accommodationNote')}</div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">{formatCurrency(bpAccommodationPerVilla, true, locale)}</td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-tertiary">
                    {formatCurrency(revUp.villaADR * revUp.villaBaseNights, true, locale)}
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">
                    {formatCurrency(liveAccommodation, true, locale)}
                    <div className="text-[11px] text-text-tertiary">{t('dash.stress.row.accommodationLiveNote')}</div>
                  </td>
                  <td className="text-right py-2.5 px-3 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${verdictToneClass(verdictAccommodation.tone)}`}>
                      {verdictAccommodation.label}
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-surface-secondary/50">
                  <td className="py-2.5 pl-4 pr-4 text-text-secondary">
                    {t('dash.stress.row.ancillary')} <span className="text-text-tertiary">— {t('dash.stress.row.ancillaryUnit')}</span>
                    <div className="text-[11px] text-text-tertiary">{t('dash.stress.row.ancillaryNote')}</div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">
                    {formatCurrency(bpAncillaryPerVilla, true, locale)}<span className="text-text-tertiary"> / villa</span>
                    <div className="text-[11px] text-text-tertiary">
                      portfolio {formatCurrency(BP_ANCILLARY_PORTFOLIO_TOTAL, true, locale)} = €{(BP_ANCILLARY_PROFIT_PER_VILLA / 1000).toFixed(0)}K × {totalVillaUnits} villa{totalVillaUnits === 1 ? '' : 's'} + {formatCurrency(BP_ANCILLARY_SUITE_TOTAL, true, locale)} across {BP_ANCILLARY_SUITE_ROOMS} suite rooms
                    </div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-tertiary">
                    {formatCurrency(bpAncillaryPerVilla, true, locale)}<span className="text-text-tertiary"> / villa</span>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">
                    {formatCurrency(liveServicesProfit2025, true, locale)}<span className="text-text-tertiary"> / villa</span>
                    <div className="text-[11px] text-text-tertiary">
                      {Math.round(SERVICES_PROFIT_MARGIN * 100)}% × {formatCurrency(liveServices2025, true, locale)} services rev (2025)
                    </div>
                  </td>
                  <td className="text-right py-2.5 px-3 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${verdictToneClass(verdictAncillary.tone)}`}>
                      {verdictAncillary.label}
                    </span>
                  </td>
                </tr>

                <tr className="bg-surface-secondary border-t-2 border-surface-tertiary">
                  <td colSpan={5} className="py-1.5 pl-4 pr-4 text-[10px] uppercase tracking-wider text-text-tertiary font-medium">
                    {t('dash.stress.row.portfolioFraming')}
                  </td>
                </tr>
                <tr className="border-b border-surface-secondary/50">
                  <td className="py-2.5 pl-4 pr-4 text-text-secondary">
                    {t('dash.stress.row.events')} <span className="text-text-tertiary">({t('dash.stress.row.eventsUnit')})</span>
                    <div className="text-[11px] text-text-tertiary">{rev.eventsPerYear}/yr × {formatCurrency(rev.netProfitPerEvent, false, locale)} net per event · {totalUnits}-property total</div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">{formatCurrency(bpEventsPortfolio, true, locale)}</td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-tertiary">
                    {formatCurrency(revUp.eventsPerYear * revUp.netProfitPerEvent, true, locale)}
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-tertiary">
                    €0
                    <div className="text-[11px] text-text-tertiary">{t('dash.stress.row.eventsLiveNote')}</div>
                  </td>
                  <td className="text-right py-2.5 px-3 pr-4">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-brand-100 text-brand-800">
                      {t('dash.stress.row.pureUpside')}
                    </span>
                  </td>
                </tr>
                {/* Events disclosure row — full-width amber note below the events data row */}
                <tr>
                  <td colSpan={5} className="px-4 py-2 bg-amber-50">
                    <div className="flex items-start gap-1.5 text-[11px] text-amber-800 leading-relaxed">
                      <svg className="mt-0.5 shrink-0" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M8 5v4M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      {t('inv.events.disclosure')}
                    </div>
                  </td>
                </tr>
                <tr className="font-medium">
                  <td className="py-2.5 pl-4 pr-4">
                    {t('dash.stress.row.portfolioTotal')} <span className="text-text-tertiary font-normal">({t('dash.stress.row.portfolioTotalUnit')})</span>
                    <div className="text-[11px] font-normal text-text-tertiary">{totalUnits} properties · BP totals from the model</div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell text-brand-700">
                    {formatCurrency(buildingTotalRevenue, true, locale)}
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell text-brand-700">
                    {formatCurrency(upsideTotalRevenue, true, locale)}
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-secondary">
                    {formatCurrency(liveTotal2025, true, locale)}
                    <div className="text-[11px] font-normal text-text-tertiary">{t('dash.stress.row.liveNote2025')}</div>
                  </td>
                  <td className="text-right py-2.5 px-3 pr-4 data-cell text-positive">
                    {t('dash.stress.row.portfolioMultiple').replace('{{x}}', (buildingTotalRevenue / liveTotal2025).toFixed(1))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-surface-tertiary/50 text-[11px] text-text-tertiary bg-surface-secondary/20 flex flex-wrap items-center justify-between gap-2">
            <span>{t('dash.stress.footnote1')
              .replace('{{nights}}', String(liveBookedNights))
              .replace('{{available}}', String(currentSeason.availableNights))
              .replace('{{lastYear}}', formatCurrency(lastCompletedSeason.total, true, locale))
            }</span>
            <span>{t('dash.stress.footnote2')
              .replace('{{ancK}}', String((BP_ANCILLARY_PROFIT_PER_VILLA / 1000).toFixed(0)))
              .replace('{{villas}}', String(totalVillaUnits))
              .replace('{{suiteTotal}}', formatCurrency(BP_ANCILLARY_SUITE_TOTAL, true, locale))
              .replace('{{suiteRooms}}', String(BP_ANCILLARY_SUITE_ROOMS))
              .replace('{{portfolioTotal}}', formatCurrency(BP_ANCILLARY_PORTFOLIO_TOTAL, true, locale))
              .replace('{{profitMarginPct}}', String(Math.round(SERVICES_PROFIT_MARGIN * 100)))
              .replace('{{servicesRev}}', formatCurrency(liveServices2025, true, locale))
            }</span>
            <Link href="/admin/sensitivity" className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-[11px] font-medium hover:bg-brand-100 hover:border-brand-400 transition-all">
              {t('bank.stressLink')}
            </Link>
          </div>
        </div>}
      </div>

      {/* Founder waterfall compact card */}
      <div id="section-founder" className="scroll-mt-24 mb-6">
      <SectionHeader title={t('dash.founder.section')} sub={t('dash.founder.sectionSub')} />
      <Link
        href="/admin/cap-table"
        className="block bg-white rounded-xl border border-surface-tertiary shadow-sm hover:border-brand-400 hover:shadow-md transition-all p-5 group"
      >
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div className="flex flex-wrap gap-x-6 gap-y-2 items-baseline">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                {t('dash.founder.founderTotal')}
              </div>
              <div className="font-display text-xl text-text-primary">
                {formatPercent(founderBd.founderTotalPct)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                {t('dash.founder.investorsKeep')}
              </div>
              <div className="font-display text-xl text-positive">
                {formatPercent(founderBd.investorTotalPct)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                {t('dash.founder.capStatus')}
              </div>
              <div className={`text-sm font-medium ${founderBd.capBinding === "total_75" || founderBd.capBinding === "exit_55_grant" ? "text-warning" : founderBd.capBinding === "ratchet_10" ? "text-text-primary" : "text-positive"}`}>
                {capStatusLabel}
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-medium group-hover:bg-brand-100 group-hover:border-brand-400 group-hover:translate-x-0.5 transition-all shrink-0">
            {t('dash.drillDown')}
          </span>
        </div>
        <div className="text-[11px] text-text-tertiary mt-3 pt-3 border-t border-surface-tertiary/50">
          {t('dash.founderDrillDown')}
        </div>
      </Link>
      </div>

      {/* Sections 4-9 moved to /admin/debt-coverage and /admin/financing */}

      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={DASHBOARD_TOUR} />
    </div>
  );
}
