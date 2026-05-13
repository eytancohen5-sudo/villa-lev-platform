"use client";

import { useModelStore } from "@/lib/store/modelStore";
import {
  formatCurrency,
  formatPercent,
  formatMultiple,
} from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { PageTour, TourButton, usePageTour } from "@/components/PageTour";
import { PageSkeleton } from "@/components/Skeleton";
import { DASHBOARD_TOUR } from "@/lib/tours/configs";
import { ACTUALS_SOURCE } from "@/lib/data/currentVillaActuals";
import { useSeasonSnapshot } from "@/lib/data/useSeasonSnapshot";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";

// ── Shared bits ─────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3 mt-8 first:mt-0 px-1">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
        {title}
      </h2>
      {sub && <span className="text-[11px] text-text-tertiary">{sub}</span>}
    </div>
  );
}

function StatusChip({
  label,
  ok,
}: {
  label: string;
  ok: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${
        ok
          ? "bg-positive/15 text-positive"
          : "bg-warning/15 text-warning"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-positive" : "bg-warning"}`} />
      {label}
    </span>
  );
}

function KPICard({
  label,
  value,
  sublabel,
  threshold,
  chip,
  accent = false,
  tone,
  valueSize = "default",
}: {
  label: string;
  value: string;
  sublabel?: string;
  threshold?: string;
  chip?: { label: string; ok: boolean };
  accent?: boolean;
  tone?: "positive" | "warning" | "neutral";
  valueSize?: "default" | "compact";
}) {
  const valueColor =
    tone === "positive" ? "text-positive" : tone === "warning" ? "text-warning" : "text-text-primary";
  const valueClass = valueSize === "compact" ? "kpi-value-compact" : "kpi-value";
  return (
    <div
      className={`relative rounded-xl border p-5 ${
        accent ? "bg-brand-50 border-brand-200" : "bg-white border-surface-tertiary"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
          {label}
        </div>
        {chip && <StatusChip label={chip.label} ok={chip.ok} />}
      </div>
      <div className={`${valueClass} ${valueColor}`}>{value}</div>
      {sublabel && <div className="text-xs text-text-tertiary mt-1">{sublabel}</div>}
      {threshold && (
        <div className="text-[11px] text-text-tertiary/80 mt-1.5 pt-1.5 border-t border-surface-tertiary/50">
          {threshold}
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "warning" | "neutral";
}) {
  const valueColor =
    tone === "positive"
      ? "text-positive"
      : tone === "warning"
        ? "text-warning"
        : "text-text-primary";
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-0.5">
        {label}
      </div>
      <div className={`font-display text-xl ${valueColor}`}>{value}</div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t, locale } = useTranslation();
  const { model, assumptions, activeScenario, projects } = useModelStore();
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(DASHBOARD_TOUR.storageKey);
  const {
    currentSeason,
    lastCompletedSeason,
    source: snapshotSource,
    pulledAt: snapshotPulledAt,
  } = useSeasonSnapshot();

  if (!model) return <PageSkeleton variant="grid" />;

  const activeScenarioOutput = model.scenarios[activeScenario];
  const activePnL = activeScenarioOutput.pnl;
  const stab = activeScenarioOutput.stabilisedYear;
  const wcY2 = activePnL.find((p) => p.year === 2029);
  const finalYear = activePnL[activePnL.length - 1] ?? null;

  const worstTrough = activePnL
    .filter((p) => p.year >= 2028)
    .reduce((max, p) => Math.max(max, p.wcTroughBalance), 0);

  const km = {
    ...model.keyMetrics,
    stabilisedRevenue: stab?.totalRevenue ?? 0,
    stabilisedEBITDA: stab?.ebitda ?? 0,
    stabilisedEBITDAMargin: stab?.ebitdaMargin ?? 0,
    stabilisedDSCR: stab?.dscr ?? 0,
    stabilisedNCF: stab?.netCashFlowPostVAT ?? 0,
    wcActive: assumptions.workingCapital.active,
    wcEffectiveFacility: activeScenarioOutput.wcEffectiveFacility,
    wcY2Peak: wcY2?.wcPeakBalance ?? 0,
    wcStabilisedAvg: stab?.wcAvgBalance ?? 0,
    wcStabilisedInterest: stab?.wcInterestExpense ?? 0,
    wcWorstTrough: worstTrough,
    wcSelfLiqViolation: activePnL.some((p) => p.wcSelfLiquidatingViolation),
    // New: bank metrics from active scenario
    minDSCRLoanLife: activeScenarioOutput.minDSCRLoanLife,
    dscrCovenantHeadroom: activeScenarioOutput.dscrCovenantHeadroom,
    icrStabilised: activeScenarioOutput.icrStabilised,
    llcr: activeScenarioOutput.llcr,
    plcr: activeScenarioOutput.plcr,
    gracePeriodInterestTotal: activeScenarioOutput.gracePeriodInterestTotal,
    netLeverage: activeScenarioOutput.netLeverage,
    peakDebtOutstanding: activeScenarioOutput.peakDebtOutstanding,
    yieldStabilised: activeScenarioOutput.yieldStabilised,
    cumulativeYieldFinal: activeScenarioOutput.cumulativeYieldFinal,
    totalMOIC: activeScenarioOutput.totalMOIC,
    terminalUnderwater: activeScenarioOutput.terminalUnderwater,
    equityPaybackYears: activeScenarioOutput.equityPaybackYears,
    equityIRR: activeScenarioOutput.equityIRR,
    projectIRR: activeScenarioOutput.projectIRR,
    roic: activeScenarioOutput.roic,
  };

  const pathLabel =
    assumptions.financingPath === "grant"
      ? t('path.grant')
      : assumptions.financingPath === "rrf"
        ? t('path.rrf')
        : assumptions.financingPath === "tepix-loan"
          ? t('path.tepixLoan')
          : t('path.commercial');

  const scenarioLabel = activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1);

  // ── Chart data ────────────────────────────────────────────
  const dscrTrajectoryData = model.dscrByYear
    .filter((d) => d.year >= 2028)
    .map((d) => ({
      year: d.year,
      Realistic: Number(d.realistic.toFixed(2)),
      Downside: Number(d.downside.toFixed(2)),
      Grant: Number(d.grant.toFixed(2)),
      "TEPIX Loan": Number(d.tepixLoan.toFixed(2)),
    }));

  // WC quarterly balance (from 2027 onward)
  const wcSparkData = activeScenarioOutput.wcQuarters
    .filter((q) => q.year >= 2027)
    .map((q) => ({
      label: `${q.year}Q${q.quarter}`,
      balance: Math.round(q.closingBalance),
    }));

  // Threshold helpers
  const dscrTone =
    km.minDSCRLoanLife >= 1.5 ? "positive" : km.minDSCRLoanLife >= 1.25 ? undefined : "warning";
  const ltvTone = km.ltv <= 0.75 ? "positive" : "warning";
  const acTone =
    km.assetCoverage >= 1.5 ? "positive" : km.assetCoverage >= 1.3 ? undefined : "warning";
  const icrTone =
    km.icrStabilised >= 3 ? "positive" : km.icrStabilised >= 2 ? undefined : "warning";
  const llcrTone =
    km.llcr >= 1.5 ? "positive" : km.llcr >= 1.25 ? undefined : "warning";
  const headroomTone =
    km.dscrCovenantHeadroom >= 0.2 ? "positive" : km.dscrCovenantHeadroom >= 0 ? undefined : "warning";

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
  // Ancillary in the BP is a single portfolio-wide line (not per-villa).
  // To compare apples-to-apples with the existing single villa, divide by
  // total villa-equivalent units across the planned portfolio.
  const totalVillaEquivalents =
    (assumptions.portfolio ?? []).reduce(
      (s, p) => s + (p.villaUnits + p.standardSuites + p.doubleSuites) * p.count,
      0,
    ) || 1;
  const bpAncillaryBaseTotal = rev.ancillaryBaseProfit;
  const bpAncillaryStabilisedTotal =
    rev.ancillaryBaseProfit *
    Math.pow(1 + rev.ancillaryGrowthRate, rev.ancillaryGrowthYears);
  const bpAncillaryBasePerVilla = bpAncillaryBaseTotal / totalVillaEquivalents;
  const bpAncillaryStabilisedPerVilla = bpAncillaryStabilisedTotal / totalVillaEquivalents;
  const revUpAncillaryStabilisedPerVilla =
    (revUp.ancillaryBaseProfit *
      Math.pow(1 + revUp.ancillaryGrowthRate, revUp.ancillaryGrowthYears)) /
    totalVillaEquivalents;

  // Portfolio totals (stabilised) — kept for the scale-up footer.
  const totalUnits = projects.reduce((s, p) => s + p.count, 0);
  const buildingTotalRevenue = stab?.totalRevenue ?? 0;
  const buildingEBITDA = stab?.ebitda ?? 0;
  // Upside scenario's stabilised totals for the BP UPSIDE column.
  const upsideStab = model.scenarios.upside.stabilisedYear;
  const upsideTotalRevenue = upsideStab?.totalRevenue ?? 0;
  const upsideEBITDA = upsideStab?.ebitda ?? 0;

  // Verdict helper: BP value vs live actual, expressed as % gap.
  // Negative gap = BP below live = conservative (positive tone).
  const conservatism = (bp: number, live: number) => {
    if (live <= 0) return { gap: 0, label: "—", tone: "neutral" as const };
    const gap = (bp / live - 1) * 100;
    const abs = Math.abs(gap).toFixed(gap === 0 ? 0 : 1);
    if (gap <= -1.5) return { gap, label: `BP ${abs}% below`, tone: "positive" as const };
    if (gap >= 1.5) return { gap, label: `BP ${abs}% above`, tone: "warning" as const };
    return { gap, label: "On par", tone: "neutral" as const };
  };

  const verdictADR = conservatism(bpADR, liveADR);
  const verdictNights = conservatism(bpNights, liveBookedNights);
  const verdictAccommodation = conservatism(bpAccommodationPerVilla, liveAccommodation);
  // Ancillary: compare BP per-villa-equivalent to live single-villa actual.
  const verdictAncillaryBase = conservatism(bpAncillaryBasePerVilla, liveServices2025);
  const verdictAncillaryStabilised = conservatism(bpAncillaryStabilisedPerVilla, liveServices2025);

  const verdictToneClass = (tone: "positive" | "warning" | "neutral") =>
    tone === "positive"
      ? "bg-positive/15 text-positive"
      : tone === "warning"
        ? "bg-warning/15 text-warning"
        : "bg-surface-secondary text-text-tertiary";

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-text-primary">{t('dash.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">
            {pathLabel} &middot; {scenarioLabel} &middot; {t('dash.stabilisedYear')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const { exportBusinessPlan } = await import('@/lib/excel/exportBP');
              const exportScenario = activeScenario === 'breakeven' ? 'realistic' : activeScenario;
              const blob = await exportBusinessPlan(assumptions, model, exportScenario);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `villa-lev-business-plan-${new Date().toISOString().slice(0, 10)}.xlsx`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-secondary text-text-secondary hover:bg-surface-tertiary transition-colors"
            title="Download a fully-linked Excel model with editable formulas"
          >
            ⬇ Download model (.xlsx)
          </button>
          <TourButton onClick={() => setTourOpen(true)} pulsing={!!neverSeen} />
        </div>
      </div>

      {/* Section — Conservatism Check */}
      <div id="section-conservatism" className="scroll-mt-24 mb-6">
        <SectionHeader
          title="Conservatism Check"
          sub="Per-villa BP assumptions vs the live single villa we already run today"
        />
        <div className="rounded-xl border border-positive/30 bg-positive/5 p-4 mb-3 flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[260px]">
            <div className="text-sm font-medium text-text-primary">
              The business plan models per-villa numbers we already exceed today.
            </div>
            <div className="text-xs text-text-secondary mt-1">
              {snapshotSource === "live" ? "Live data from " : "Snapshot from "}
              <a href={ACTUALS_SOURCE.url} target="_blank" rel="noreferrer" className="underline hover:text-text-primary">
                admin.villalevantiparos.com
              </a>
              {" "}(2025 complete, {currentSeason.year} in progress) sets a floor — actual portfolio outcomes should beat the plan.
            </div>
          </div>
          <div className="flex gap-2 text-[11px] flex-wrap items-center">
            {snapshotSource === "live" ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-positive/15 text-positive font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />
                LIVE · refreshed {new Date(snapshotPulledAt).toLocaleString(locale, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
              </span>
            ) : (
              <span className="px-2 py-1 rounded-md bg-surface-secondary text-text-tertiary text-[10px] uppercase tracking-wider">
                Snapshot · {snapshotPulledAt}
              </span>
            )}
            <span className="px-2 py-1 rounded-md bg-white/70 border border-surface-tertiary">
              {currentSeason.year} booked: <strong>{liveBookedNights} nights</strong> · <strong>€{liveADR.toLocaleString()}</strong> net ADR
            </span>
            <span className="px-2 py-1 rounded-md bg-white/70 border border-surface-tertiary">
              {lastCompletedSeason.year} total: <strong>{formatCurrency(liveTotal2025, true, locale)}</strong>
            </span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-tertiary bg-surface-secondary/30">
                  <th className="text-left py-2.5 pl-4 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    Assumption (per villa)
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs uppercase tracking-wider text-brand-700 font-medium">
                    BP Realistic
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    BP Upside
                  </th>
                  <th className="text-right py-2.5 px-3 text-xs uppercase tracking-wider text-text-secondary font-medium">
                    Live Villa Lev
                  </th>
                  <th className="text-right py-2.5 px-3 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    Verdict
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-surface-secondary/50">
                  <td className="py-2.5 pl-4 pr-4 text-text-secondary">
                    Peak-season nights
                    <div className="text-[11px] text-text-tertiary">120 available · 15 May – 15 Sept</div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">{bpNights}</td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-tertiary">{revUp.villaBaseNights}</td>
                  <td className="text-right py-2.5 px-3 data-cell">
                    {liveBookedNights}
                    <div className="text-[11px] text-text-tertiary">2026 booked, season in progress</div>
                  </td>
                  <td className="text-right py-2.5 px-3 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${verdictToneClass(verdictNights.tone)}`}>
                      {verdictNights.label}
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-surface-secondary/50">
                  <td className="py-2.5 pl-4 pr-4 text-text-secondary">
                    ADR (net, € per night)
                    <div className="text-[11px] text-text-tertiary">After OTA commissions</div>
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
                    Accommodation revenue / villa
                    <div className="text-[11px] text-text-tertiary">Nights × ADR (per villa, per season)</div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">{formatCurrency(bpAccommodationPerVilla, true, locale)}</td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-tertiary">
                    {formatCurrency(revUp.villaADR * revUp.villaBaseNights, true, locale)}
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">
                    {formatCurrency(liveAccommodation, true, locale)}
                    <div className="text-[11px] text-text-tertiary">2026 net rental (in progress)</div>
                  </td>
                  <td className="text-right py-2.5 px-3 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${verdictToneClass(verdictAccommodation.tone)}`}>
                      {verdictAccommodation.label}
                    </span>
                  </td>
                </tr>

                <tr className="bg-surface-secondary/20">
                  <td colSpan={5} className="py-1.5 pl-4 pr-4 text-[10px] uppercase tracking-wider text-text-tertiary font-medium">
                    Services &amp; events — BP ancillary divided by {totalVillaEquivalents} unit-equivalents AND grossed up 2× to compare on a like-for-like single-villa-revenue basis
                  </td>
                </tr>
                <tr className="border-b border-surface-secondary/50">
                  <td className="py-2.5 pl-4 pr-4 text-text-secondary">
                    Ancillary services — base (year 1)
                    <div className="text-[11px] text-text-tertiary">Chef · boat · car · quad · concierge</div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">
                    {formatCurrency(bpAncillaryBasePerVilla * 2, true, locale)}
                    <div className="text-[11px] text-text-tertiary">
                      gross ≈ 2× net of {formatCurrency(bpAncillaryBasePerVilla, true, locale)} per villa
                    </div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-tertiary">
                    {formatCurrency((revUp.ancillaryBaseProfit / totalVillaEquivalents) * 2, true, locale)}
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">
                    {formatCurrency(liveServices2025, true, locale)}
                    <div className="text-[11px] text-text-tertiary">2025 actual gross · one villa</div>
                  </td>
                  <td className="text-right py-2.5 px-3 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${verdictToneClass(conservatism(bpAncillaryBasePerVilla * 2, liveServices2025).tone)}`}>
                      {conservatism(bpAncillaryBasePerVilla * 2, liveServices2025).label}
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-surface-secondary/50">
                  <td className="py-2.5 pl-4 pr-4 text-text-secondary">
                    Ancillary services — stabilised
                    <div className="text-[11px] text-text-tertiary">+{(rev.ancillaryGrowthRate * 100).toFixed(0)}%/yr × {rev.ancillaryGrowthYears}y cap</div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">
                    {formatCurrency(bpAncillaryStabilisedPerVilla * 2, true, locale)}
                    <div className="text-[11px] text-text-tertiary">
                      gross ≈ 2× net of {formatCurrency(bpAncillaryStabilisedPerVilla, true, locale)} per villa
                    </div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-tertiary">
                    {formatCurrency(revUpAncillaryStabilisedPerVilla * 2, true, locale)}
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">
                    {formatCurrency(liveServices2025, true, locale)}
                    <div className="text-[11px] text-text-tertiary">single villa today (gross)</div>
                  </td>
                  <td className="text-right py-2.5 px-3 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${verdictToneClass(conservatism(bpAncillaryStabilisedPerVilla * 2, liveServices2025).tone)}`}>
                      {conservatism(bpAncillaryStabilisedPerVilla * 2, liveServices2025).label}
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-surface-secondary/50">
                  <td className="py-2.5 pl-4 pr-4 text-text-secondary">
                    Events (private hire)
                    <div className="text-[11px] text-text-tertiary">{rev.eventsPerYear}/yr × {formatCurrency(rev.netProfitPerEvent, false, locale)} net per event</div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">{formatCurrency(bpEventsPortfolio, true, locale)}</td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-tertiary">
                    {formatCurrency(revUp.eventsPerYear * revUp.netProfitPerEvent, true, locale)}
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-tertiary">—</td>
                  <td className="text-right py-2.5 px-3 pr-4">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-brand-100 text-brand-800">
                      New revenue line
                    </span>
                  </td>
                </tr>

                <tr className="font-medium border-t-2 border-surface-tertiary bg-surface-secondary/10">
                  <td className="py-2.5 pl-4 pr-4">
                    Portfolio scale-up (stabilised)
                    <div className="text-[11px] font-normal text-text-tertiary">Conservative per-villa × {totalUnits} units</div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell text-brand-700">
                    {formatCurrency(buildingTotalRevenue, true, locale)}
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell text-brand-700">
                    {formatCurrency(upsideTotalRevenue, true, locale)}
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-secondary">
                    {formatCurrency(liveTotal2025, true, locale)}
                    <div className="text-[11px] font-normal text-text-tertiary">2025 actual · one villa</div>
                  </td>
                  <td className="text-right py-2.5 px-3 pr-4 data-cell text-positive">
                    {(buildingTotalRevenue / liveTotal2025).toFixed(1)}× revenue
                  </td>
                </tr>
                <tr className="font-medium">
                  <td className="py-2.5 pl-4 pr-4">EBITDA (stabilised)</td>
                  <td className="text-right py-2.5 px-3 data-cell text-brand-700">
                    {formatCurrency(buildingEBITDA, true, locale)}
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell text-brand-700">
                    {formatCurrency(upsideEBITDA, true, locale)}
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-secondary">
                    {formatCurrency(liveTotal2025 * 0.55, true, locale)}
                    <div className="text-[11px] font-normal text-text-tertiary">~55% of 2025 net</div>
                  </td>
                  <td className="text-right py-2.5 px-3 pr-4 data-cell text-positive">
                    {(buildingEBITDA / (liveTotal2025 * 0.55)).toFixed(1)}× EBITDA
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-surface-tertiary/50 text-[11px] text-text-tertiary bg-surface-secondary/20 flex flex-wrap items-center justify-between gap-2">
            <span>
              Live source: <strong>2026 season</strong> (in progress, {liveBookedNights}/{currentSeason.availableNights} nights booked) and <strong>2025 actual</strong> ({formatCurrency(lastCompletedSeason.total, true, locale)}). Per-villa scope: villa-type assumptions only ({totalUnits} mixed villa/suite properties in the BP scale-up).
            </span>
            <span>
              Single-villa OpEx — housekeeping, utilities, management — assumed ~55% margin; the operator's reported P&amp;L shows a higher headline net margin (pre corporate-overhead allocation).
            </span>
          </div>
        </div>
      </div>

      {/* Section 0 — Deal Snapshot */}
      <div id="section-deal-snapshot" className="scroll-mt-24">
        <SectionHeader title={t('dash.section.dealSnapshot')} sub={t('dash.dealSnapshotSub')} />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <KPICard
            label={t('kpi.totalInvestment')}
            value={formatCurrency(km.totalCapex, true, locale)}
            sublabel={(() => {
              const n = projects.reduce((s, p) => s + p.count, 0);
              return `${n} ${t(n === 1 ? 'kpi.plotsSingular' : 'kpi.plots')}`;
            })()}
          />
          <KPICard
            label={t('kpi.loanAmount')}
            value={formatCurrency(km.loanAmount, true, locale)}
            sublabel={`${formatPercent(km.loanAmount / km.totalCapex, 0)} ${t('kpi.ofTotal')}`}
          />
          <KPICard
            label={t('kpi.equityRequired')}
            value={formatCurrency(km.equityRequired, true, locale)}
            sublabel={`${formatPercent(km.equityRequired / km.totalCapex, 0)} ${t('kpi.ofTotal')}`}
          />
          <KPICard
            label={t('kpi.annualDS')}
            value={formatCurrency(km.annualDS, true, locale)}
            sublabel={t('kpi.annualDSSub')}
          />
          {(() => {
            const grantAmt = assumptions.financingPath === "grant"
              ? Number(model.financingComparison.find((c) => c.key === 'grantReceived')?.grant ?? 0)
              : 0;
            if (grantAmt > 0) {
              return (
                <KPICard
                  label={t('kpi.activePath')}
                  value={`${pathLabel} · ${formatCurrency(grantAmt, true, locale)}`}
                  sublabel={`${t('field.grantAmount')} (${formatPercent(grantAmt / km.totalCapex, 0)})`}
                  valueSize="compact"
                  tone="positive"
                />
              );
            }
            return (
              <KPICard
                label={t('kpi.activePath')}
                value={pathLabel}
                sublabel={t('kpi.activeScenario') + ': ' + scenarioLabel}
                valueSize="compact"
              />
            );
          })()}
          <KPICard
            label={t('term.dscr')}
            value={formatMultiple(km.stabilisedDSCR)}
            sublabel={t('kpi.debtServiceCoverage')}
            tone={dscrTone}
            accent={km.stabilisedDSCR >= 1.5}
          />
        </div>
      </div>

      {/* HERO — DSCR trajectory */}
      <div id="section-dscr-hero" className="bg-white rounded-2xl border border-surface-tertiary p-5 mt-6 shadow-sm scroll-mt-24">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary">
            {t('dash.heroDscr')}
          </h3>
          <span className="text-[11px] text-text-tertiary">
            {t('dash.minDscr')}: {formatMultiple(km.minDSCRLoanLife)} · {t('kpi.gracePeriodInterest')}: {formatCurrency(km.gracePeriodInterestTotal, true, locale)}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={dscrTrajectoryData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}×`} domain={[0, 'dataMax + 0.5']} />
            <Tooltip formatter={(value) => `${Number(value).toFixed(2)}×`} contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={1.25} stroke="#9E3B3B" strokeDasharray="5 5" label={{ value: "1.25× covenant", fontSize: 10, fill: "#9E3B3B" }} />
            <ReferenceLine y={1.50} stroke="#6B7A3D" strokeDasharray="3 3" label={{ value: "1.50× comfort", fontSize: 10, fill: "#6B7A3D" }} />
            <Line type="monotone" dataKey="Realistic" name={t('scenario.realistic')} stroke="#8B6914" strokeWidth={2.5} />
            <Line type="monotone" dataKey="Downside" name={t('scenario.downside')} stroke="#9E3B3B" strokeWidth={1.8} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="Grant" name={t('path.grantShort')} stroke="#4A7C3F" strokeWidth={1.5} strokeDasharray="6 3" />
            <Line type="monotone" dataKey="TEPIX Loan" name={t('path.tepixLoanShort')} stroke="#7B5EA7" strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Section 1 — Coverage Ratios */}
      <div id="section-coverage" className="scroll-mt-24">
      <SectionHeader title={t('dash.section.coverage')} sub={t('dash.coverageSub')} />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard
          label={t('kpi.minDSCR')}
          value={km.minDSCRLoanLife > 0 ? formatMultiple(km.minDSCRLoanLife) : "—"}
          sublabel={t('kpi.minDSCRSub')}
          threshold={t('dash.kpi.dscrThreshold')}
          tone={dscrTone}
          accent={km.minDSCRLoanLife >= 1.5}
        />
        <KPICard
          label={t('kpi.icr')}
          value={km.icrStabilised > 0 ? formatMultiple(km.icrStabilised) : "—"}
          sublabel={t('kpi.icrSub')}
          tone={icrTone}
        />
        <KPICard
          label={t('kpi.llcr')}
          value={km.llcr > 0 ? formatMultiple(km.llcr) : "—"}
          sublabel={t('kpi.llcrSub')}
          tone={llcrTone}
        />
        <KPICard
          label={t('kpi.plcr')}
          value={km.plcr > 0 ? formatMultiple(km.plcr) : "—"}
          sublabel={t('kpi.plcrSub')}
          tone={km.plcr >= 1.7 ? "positive" : km.plcr >= 1.4 ? undefined : "warning"}
        />
        <KPICard
          label={t('kpi.covHeadroom')}
          value={km.minDSCRLoanLife > 0 ? formatPercent(km.dscrCovenantHeadroom) : "—"}
          sublabel={t('kpi.covHeadroomSub')}
          tone={headroomTone}
        />
      </div>
      </div>

      {/* Section 2 — Operating Performance. DSCR was here too but is already
          shown in Deal Snapshot (Section 0); duplicating it added noise. */}
      <SectionHeader title={t('dash.section.operating')} sub={t('dash.stabilisedYear')} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          label={t('kpi.stabilisedRevenue')}
          value={formatCurrency(km.stabilisedRevenue, true, locale)}
          sublabel={t('kpi.stabilisedRevenueSub')}
          accent
        />
        <KPICard
          label={t('term.ebitda')}
          value={formatCurrency(km.stabilisedEBITDA, true, locale)}
          sublabel={`${t('kpi.margin')} ${formatPercent(km.stabilisedEBITDAMargin)}`}
          threshold={t('kpi.ebitdaMarginNote')}
          accent
        />
        <KPICard
          label={t('kpi.netCashFlow')}
          value={formatCurrency(km.stabilisedNCF, true, locale)}
          sublabel={t('kpi.netCashFlowSub')}
        />
      </div>

      {/* Section 3 — Returns to Sponsor */}
      <div id="section-returns" className="scroll-mt-24">
      <SectionHeader title={t('dash.section.returns')} sub={t('dash.returnsSub')} />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label={t('kpi.equityYield')}
          value={km.yieldStabilised !== 0 ? formatPercent(km.yieldStabilised) : "—"}
          sublabel={t('kpi.equityYieldSub')}
          tone={km.yieldStabilised >= 0.15 ? "positive" : km.yieldStabilised > 0 ? undefined : "warning"}
          accent={km.yieldStabilised >= 0.15}
        />
        {/* Operating Yield = Σ NCF distributions / equity. Operating only — exit
            proceeds are NOT included. Renamed from "Cumulative Yield" so it
            reads honestly alongside Total MOIC below. */}
        <KPICard
          label={t('kpi.operatingYield')}
          value={km.cumulativeYieldFinal !== 0 ? formatYieldMultiple(km.cumulativeYieldFinal) : "—"}
          sublabel={t('kpi.operatingYieldSub')}
          tone={km.cumulativeYieldFinal >= 1 ? "positive" : km.cumulativeYieldFinal > 0 ? undefined : "warning"}
          threshold={t('kpi.operatingYieldNote')}
        />
        {/* Total MOIC = (Σ NCF + terminal equity proceeds) / equity. The
            "what you actually walk away with" number — surfaced as a peer to
            Operating Yield to make the relationship explicit. */}
        <KPICard
          label={t('kpi.totalMOIC')}
          value={km.totalMOIC !== 0 ? formatYieldMultiple(km.totalMOIC) : "—"}
          sublabel={t('kpi.totalMOICSub')}
          tone={km.terminalUnderwater ? "warning" : km.totalMOIC >= 2 ? "positive" : km.totalMOIC > 1 ? undefined : "warning"}
          accent={km.totalMOIC >= 3 && !km.terminalUnderwater}
          chip={km.terminalUnderwater ? { label: "underwater", ok: false } : undefined}
          threshold={km.terminalUnderwater ? t('kpi.totalMOICUnderwaterNote') : undefined}
        />
        <KPICard
          label={t('kpi.equityPayback')}
          value={
            km.equityPaybackYears !== null && km.equityPaybackYears !== undefined
              ? `${km.equityPaybackYears} ${t('dash.years')}`
              : t('dash.never')
          }
          sublabel={t('kpi.equityPaybackSub')}
          tone={
            km.equityPaybackYears && km.equityPaybackYears <= 8
              ? "positive"
              : km.equityPaybackYears && km.equityPaybackYears <= 12
                ? undefined
                : "warning"
          }
          threshold={t('kpi.equityPaybackNote')}
        />
        <KPICard
          label={t('kpi.equityIRR')}
          value={km.equityIRR > 0 ? formatPercent(km.equityIRR) : "—"}
          sublabel={t('kpi.equityIRRSub')}
          tone={km.equityIRR >= 0.15 ? "positive" : km.equityIRR > 0 ? undefined : "warning"}
        />
        <KPICard
          label={t('kpi.projectIRR')}
          value={km.projectIRR > 0 ? formatPercent(km.projectIRR) : "—"}
          sublabel={t('kpi.projectIRRSub')}
          tone={km.projectIRR >= 0.10 ? "positive" : km.projectIRR > 0 ? undefined : "warning"}
        />
      </div>
      </div>

      {/* Section 4 — Capital Structure & Debt */}
      <div id="section-capital" className="scroll-mt-24">
      <SectionHeader title={t('dash.section.capital')} sub={pathLabel} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label={t('kpi.gracePeriodInterest')}
          value={formatCurrency(km.gracePeriodInterestTotal, true, locale)}
          sublabel={t('kpi.gracePeriodInterestSub')}
        />
        <KPICard
          label={t('kpi.netLeverage')}
          value={km.netLeverage > 0 ? formatMultiple(km.netLeverage) : "—"}
          sublabel={t('kpi.netLeverageSub')}
          tone={km.netLeverage <= 5 ? "positive" : km.netLeverage <= 7 ? undefined : "warning"}
        />
        <KPICard
          label={t('kpi.peakDebt')}
          value={formatCurrency(km.peakDebtOutstanding, true, locale)}
          sublabel={t('kpi.peakDebtSub')}
        />
        <KPICard
          label={t('kpi.roic')}
          value={km.roic > 0 ? formatPercent(km.roic) : "—"}
          sublabel={t('kpi.roicSub')}
          tone={km.roic >= 0.07 ? "positive" : km.roic > 0 ? undefined : "warning"}
        />
      </div>
      </div>

      {/* Section 5 — Working Capital */}
      {km.wcActive && (
        <>
          <SectionHeader
            title={t('dash.section.workingCapital')}
            sub={t('dash.wcPanelSub')}
          />
          <div className="bg-white rounded-xl border border-surface-tertiary p-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-5 grid grid-cols-2 gap-x-6 gap-y-4">
                <MiniStat
                  label={t('dash.wcPeak')}
                  value={formatCurrency(km.wcY2Peak, true, locale)}
                />
                <MiniStat
                  label={t('dash.wcAvg')}
                  value={formatCurrency(km.wcStabilisedAvg, true, locale)}
                />
                <MiniStat
                  label={t('dash.wcTrough')}
                  value={formatCurrency(km.wcWorstTrough, true, locale)}
                  tone={km.wcSelfLiqViolation ? "warning" : "positive"}
                />
                <MiniStat
                  label={t('dash.wcInterestAnnual')}
                  value={formatCurrency(km.wcStabilisedInterest, true, locale)}
                />
                <div className="col-span-2 flex items-center gap-3 pt-2 border-t border-surface-tertiary/50">
                  <StatusChip
                    label={
                      km.wcSelfLiqViolation
                        ? t('kpi.wcSelfLiqFail')
                        : t('kpi.wcSelfLiqOk')
                    }
                    ok={!km.wcSelfLiqViolation}
                  />
                  <span className="text-[11px] text-text-tertiary">
                    {t('kpi.wcSelfLiqSub')} · {t('kpi.wcFacility')}{" "}
                    {formatCurrency(km.wcEffectiveFacility, true, locale)}
                  </span>
                </div>
              </div>
              <div className="lg:col-span-7">
                <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">
                  {t('dash.wcSparkLabel')}
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={wcSparkData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="wcGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8B6914" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#8B6914" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9 }}
                      interval={3}
                      tickFormatter={(v: string) => v.split('Q')[0]}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}K`}
                      width={50}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value), true, locale)}
                      labelFormatter={(label) => `${t('dash.wcQuarterly')} ${label}`}
                      contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="#8B6914"
                      strokeWidth={1.8}
                      fill="url(#wcGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Section 6 — Collateral (3 valuation tiers) */}
      <SectionHeader title={t('dash.section.collateral')} sub={t('dash.collateralTiers')} />
      <div className="bg-white rounded-xl border border-surface-tertiary p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('common.metric')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-warning font-medium">{t('sc.stress')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('sc.market')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-positive font-medium">{t('sc.optimistic')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-surface-secondary/50">
                <td className="py-2 pr-4 text-text-secondary">{t('kpi.portfolioValue')}</td>
                <td className="text-right py-2 px-3 data-cell">{formatCurrency(model.collateral.stress.value, true, locale)}</td>
                <td className="text-right py-2 px-3 data-cell">{formatCurrency(model.collateral.market.value, true, locale)}</td>
                <td className="text-right py-2 px-3 data-cell">{formatCurrency(model.collateral.optimistic.value, true, locale)}</td>
              </tr>
              <tr className="border-b border-surface-secondary/50">
                <td className="py-2 pr-4 text-text-secondary">{t('term.ltv')}</td>
                <td className={`text-right py-2 px-3 data-cell ${model.collateral.stress.ltv > 0.75 ? "text-warning" : "text-text-primary"}`}>{formatPercent(model.collateral.stress.ltv)}</td>
                <td className={`text-right py-2 px-3 data-cell ${model.collateral.market.ltv > 0.75 ? "text-warning" : "text-positive"}`}>{formatPercent(model.collateral.market.ltv)}</td>
                <td className="text-right py-2 px-3 data-cell text-positive">{formatPercent(model.collateral.optimistic.ltv)}</td>
              </tr>
              <tr className="font-medium">
                <td className="py-2 pr-4">{t('kpi.assetCoverage')}</td>
                <td className={`text-right py-2 px-3 data-cell ${model.collateral.stress.coverage < 1.3 ? "text-warning" : "text-text-primary"}`}>{formatMultiple(model.collateral.stress.coverage)}</td>
                <td className={`text-right py-2 px-3 data-cell ${model.collateral.market.coverage >= 1.5 ? "text-positive" : "text-text-primary"}`}>{formatMultiple(model.collateral.market.coverage)}</td>
                <td className="text-right py-2 px-3 data-cell text-positive">{formatMultiple(model.collateral.optimistic.coverage)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-surface-tertiary/50">
          <KPICard
            label={t('term.ltv')}
            value={formatPercent(km.ltv)}
            sublabel={t('kpi.ltvAtCompletion')}
            threshold={t('dash.kpi.ltvThreshold')}
            tone={ltvTone}
          />
          <KPICard
            label={t('kpi.assetCoverage')}
            value={formatMultiple(km.assetCoverage)}
            sublabel={t('kpi.assetCoverageSub')}
            threshold={t('dash.kpi.acThreshold')}
            tone={acTone}
          />
        </div>
      </div>

      {/* Section 7 — Compact P&L Snapshot */}
      <div id="section-pnl-summary" className="bg-white rounded-xl border border-surface-tertiary p-5 mt-8 scroll-mt-24">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary">
            {t('dash.pnlSummary')} — {scenarioLabel}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-text-tertiary font-medium text-xs uppercase tracking-wider">
                  {t('pnl.item')}
                </th>
                {activePnL.map((p) => (
                  <th
                    key={p.year}
                    className="text-right py-2 px-2 text-text-tertiary font-medium text-xs uppercase tracking-wider"
                  >
                    {p.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-surface-secondary/50">
                <td className="py-2 pr-4 text-text-secondary">{t('pnl.totalRevenue')}</td>
                {activePnL.map((p) => (
                  <td key={p.year} className="text-right py-2 px-2 data-cell">
                    {p.totalRevenue > 0 ? formatCurrency(p.totalRevenue, true, locale) : "—"}
                  </td>
                ))}
              </tr>
              <tr className="font-medium border-t border-surface-secondary/50">
                <td className="py-2 pr-4">{t('term.ebitda')}</td>
                {activePnL.map((p) => (
                  <td
                    key={p.year}
                    className={`text-right py-2 px-2 data-cell ${p.ebitda > 0 ? "text-positive" : p.ebitda < 0 ? "text-negative" : "text-text-tertiary"}`}
                  >
                    {p.ebitda !== 0 ? formatCurrency(p.ebitda, true, locale) : "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-surface-secondary/50">
                <td className="py-2 pr-4 text-text-secondary">{t('pnl.ebitdaMargin')}</td>
                {activePnL.map((p) => (
                  <td key={p.year} className="text-right py-2 px-2 data-cell text-text-tertiary">
                    {p.totalRevenue > 0 ? formatPercent(p.ebitdaMargin) : "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-surface-secondary/50">
                <td className="py-2 pr-4 text-text-secondary">{t('pnl.debtService')}</td>
                {activePnL.map((p) => (
                  <td key={p.year} className="text-right py-2 px-2 data-cell text-negative">
                    {p.debtService > 0 ? formatCurrency(p.debtService, true, locale) : "—"}
                  </td>
                ))}
              </tr>
              <tr className="font-medium border-t border-surface-secondary/50">
                <td className="py-2 pr-4">{t('pnl.ncfPostVAT')}</td>
                {activePnL.map((p) => (
                  <td
                    key={p.year}
                    className={`text-right py-2 px-2 data-cell ${p.netCashFlowPostVAT >= 0 ? "text-positive" : "text-negative"}`}
                  >
                    {formatCurrency(p.netCashFlowPostVAT, true, locale)}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-surface-secondary/50">
                <td className="py-2 pr-4 text-text-secondary">{t('pnl.cit')}</td>
                {activePnL.map((p) => (
                  <td key={p.year} className="text-right py-2 px-2 data-cell text-negative">
                    {p.citPayable !== 0 ? formatCurrency(p.citPayable, true, locale) : "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-surface-secondary/50">
                <td className="py-2 pr-4 text-text-secondary">{t('term.dscr')}</td>
                {activePnL.map((p) => (
                  <td
                    key={p.year}
                    className={`text-right py-2 px-2 data-cell ${
                      p.dscr >= 1.25
                        ? "text-positive"
                        : p.dscr > 0
                          ? "text-warning"
                          : "text-text-tertiary"
                    }`}
                  >
                    {p.dscr > 0 ? formatMultiple(p.dscr) : "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-surface-secondary/50">
                <td className="py-2 pr-4 text-text-secondary">{t('pnl.dscrLoaded')}</td>
                {activePnL.map((p) => (
                  <td
                    key={p.year}
                    className={`text-right py-2 px-2 data-cell ${
                      p.dscrLoaded >= 1.25
                        ? "text-positive"
                        : p.dscrLoaded > 0
                          ? "text-warning"
                          : "text-text-tertiary"
                    }`}
                  >
                    {p.dscrLoaded > 0 ? formatMultiple(p.dscrLoaded) : "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-surface-secondary/50">
                <td className="py-2 pr-4 text-text-secondary">{t('pnl.icr')}</td>
                {activePnL.map((p) => (
                  <td
                    key={p.year}
                    className={`text-right py-2 px-2 data-cell ${
                      p.interestCoverageRatio >= 3
                        ? "text-positive"
                        : p.interestCoverageRatio >= 1.5
                          ? "text-warning"
                          : "text-text-tertiary"
                    }`}
                  >
                    {p.interestCoverageRatio > 0 ? formatMultiple(p.interestCoverageRatio) : "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-surface-secondary/50">
                <td className="py-2 pr-4 text-text-secondary">{t('pnl.yieldOnEquity')}</td>
                {activePnL.map((p) => (
                  <td
                    key={p.year}
                    className={`text-right py-2 px-2 data-cell ${
                      p.yieldOnInitialEquity > 0
                        ? "text-positive"
                        : p.yieldOnInitialEquity < 0
                          ? "text-negative"
                          : "text-text-tertiary"
                    }`}
                  >
                    {p.yieldOnInitialEquity !== 0 ? formatPercent(p.yieldOnInitialEquity) : "—"}
                  </td>
                ))}
              </tr>
              <tr className="font-medium border-t border-surface-secondary/50">
                <td className="py-2 pr-4">{t('pnl.totalYieldOnEquity')}</td>
                {activePnL.map((p) => (
                  <td
                    key={p.year}
                    className={`text-right py-2 px-2 data-cell ${
                      p.cumulativeYieldOnInitialEquity > 0
                        ? "text-positive"
                        : p.cumulativeYieldOnInitialEquity < 0
                          ? "text-negative"
                          : "text-text-tertiary"
                    }`}
                  >
                    {p.cumulativeYieldOnInitialEquity !== 0 ? formatPercent(p.cumulativeYieldOnInitialEquity) : "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-surface-secondary/50">
                <td className="py-2 pr-4 text-text-secondary">{t('pnl.cumulativeNCF')}</td>
                {activePnL.map((p) => (
                  <td
                    key={p.year}
                    className={`text-right py-2 px-2 data-cell ${p.cumulativeNCF >= 0 ? "text-positive" : "text-negative"}`}
                  >
                    {formatCurrency(p.cumulativeNCF, true, locale)}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-surface-secondary/50">
                <td className="py-2 pr-4 text-text-secondary">{t('pnl.termLoanBalance')}</td>
                {activePnL.map((p) => (
                  <td key={p.year} className="text-right py-2 px-2 data-cell text-text-tertiary">
                    {p.termLoanBalance > 0 ? formatCurrency(p.termLoanBalance, true, locale) : "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 8 — Sensitivity & Stress */}
      <SectionHeader title={t('dash.section.sensitivity')} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard
          label={t('kpi.bufferBreakEven')}
          value={formatPercent(km.bufferToBreakEven)}
          sublabel={t('kpi.bufferBreakEvenSub')}
        />
        <KPICard
          label={`${t('kpi.minDSCR')} — ${t('scenario.downside')}`}
          value={
            model.scenarios.downside.minDSCRLoanLife > 0
              ? formatMultiple(model.scenarios.downside.minDSCRLoanLife)
              : "—"
          }
          sublabel={t('kpi.minDSCRSub')}
          tone={
            model.scenarios.downside.minDSCRLoanLife >= 1.25
              ? "positive"
              : model.scenarios.downside.minDSCRLoanLife > 0
                ? "warning"
                : "neutral"
          }
        />
        <KPICard
          label={`${t('kpi.equityIRR')} — ${t('scenario.downside')}`}
          value={
            model.scenarios.downside.equityIRR > 0
              ? formatPercent(model.scenarios.downside.equityIRR)
              : "—"
          }
          sublabel={t('kpi.equityIRRSub')}
          tone={
            model.scenarios.downside.equityIRR >= 0.10
              ? "positive"
              : model.scenarios.downside.equityIRR > 0
                ? undefined
                : "warning"
          }
        />
      </div>

      {/* Section 9 — Financing Comparison */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-5 mt-8">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
          {t('dash.financingComparison')}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-text-tertiary font-medium text-xs uppercase tracking-wider">
                  {t('common.metric')}
                </th>
                <th className="text-right py-2 px-3 text-text-tertiary font-medium text-xs uppercase tracking-wider">
                  {t('path.commercialShort')}
                </th>
                <th className="text-right py-2 px-3 text-text-tertiary font-medium text-xs uppercase tracking-wider">
                  {t('path.rrfShort')}
                </th>
                <th className="text-right py-2 px-3 text-text-tertiary font-medium text-xs uppercase tracking-wider">
                  {t('path.grantShort')}
                </th>
                <th className="text-right py-2 px-3 font-medium text-xs uppercase tracking-wider" style={{ color: '#7B5EA7' }}>
                  {t('path.tepixLoanShort')}
                </th>
              </tr>
            </thead>
            <tbody>
              {model.financingComparison.map((row, i) => {
                const formatVal = (val: string | number) =>
                  typeof val === "number"
                    ? row.key === 'stabilisedDSCR'
                      ? formatMultiple(val)
                      : formatCurrency(val, true, locale)
                    : val;
                return (
                  <tr key={i} className={i % 2 === 0 ? "bg-surface-secondary/30" : ""}>
                    <td className="py-2 pr-4 text-text-secondary">{row.metric}</td>
                    <td className="text-right py-2 px-3 data-cell">{formatVal(row.commercial)}</td>
                    <td className="text-right py-2 px-3 data-cell">{formatVal(row.rrf)}</td>
                    <td className="text-right py-2 px-3 data-cell text-positive font-medium">{formatVal(row.grant)}</td>
                    <td className="text-right py-2 px-3 data-cell" style={{ color: '#7B5EA7' }}>{formatVal(row.tepixLoan)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={DASHBOARD_TOUR} />
    </div>
  );
}
