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
import { LiveTrackRecord } from "@/components/LiveTrackRecord";
import { ConservatismTriangle } from "@/components/ConservatismTriangle";
import { DASHBOARD_TOUR } from "@/lib/tours/configs";
import {
  SERVICES_PROFIT_MARGIN,
  BP_ANCILLARY_PROFIT_PER_VILLA,
  BP_ANCILLARY_SUITE_TOTAL,
  BP_ANCILLARY_SUITE_ROOMS,
  BP_ANCILLARY_PORTFOLIO_TOTAL,
} from "@/lib/data/currentVillaActuals";
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
import { computeCapTable } from "@/lib/engine/capTable";

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
  const { model, assumptions, activeScenario, projects, capTable, waterfall } = useModelStore();
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(DASHBOARD_TOUR.storageKey);
  const { currentSeason, lastCompletedSeason } = useSeasonSnapshot();

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
    // DSCR at year openingYear+2 (= 2030): post-ramp, pre-stabilisation.
    // Used as the headline DSCR figure on the dashboard because the absolute
    // loan-life minimum (often ~1.0× in the very first amortising year) is
    // covenant-relevant but visually misleading as a headline. The 2030 figure
    // shows what bankers actually underwrite against once the ramp is past.
    // Falls back to minDSCRLoanLife if 2030 isn't in the pnl array (defensive).
    dscrPostRamp: activePnL.find((p) => p.year === 2030)?.dscr ?? activeScenarioOutput.minDSCRLoanLife,
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
    // Parallel exit-valuation path: sell the underlying property instead of
    // the operating hotel. terminalAssetValuePropertySale = builtSurface × €/m².
    terminalAssetValue: activeScenarioOutput.terminalAssetValue,
    terminalAssetValuePropertySale: activeScenarioOutput.terminalAssetValuePropertySale,
    terminalEquityValuePropertySale: activeScenarioOutput.terminalEquityValuePropertySale,
    equityIRRPropertySale: activeScenarioOutput.equityIRRPropertySale,
    projectIRRPropertySale: activeScenarioOutput.projectIRRPropertySale,
    totalMOICPropertySale: activeScenarioOutput.totalMOICPropertySale,
    propertyExitDominates: activeScenarioOutput.propertyExitDominates,
    exitValuationPerM2: activeScenarioOutput.exitValuationPerM2,
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
      ? "75% total cap — earned reduced"
      : founderBd.capBinding === "earned_33"
        ? "33% earned cap reached"
        : "Free (no cap binding)";

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

  // Threshold helpers — headline DSCR tone reflects the post-ramp (2030)
  // figure, not the absolute loan-life minimum.
  const dscrTone =
    km.dscrPostRamp >= 1.5 ? "positive" : km.dscrPostRamp >= 1.25 ? undefined : "warning";
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
  // Ancillary: the BP allocates ancillary profit explicitly per-villa
  // (€15K) and separately to suite rooms (€30K across 11 rooms). For the
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
    if (gap <= -1.5) return { gap, label: `BP ${abs}% below`, tone: "positive" as const };
    if (gap >= 1.5) return { gap, label: `BP ${abs}% above`, tone: "warning" as const };
    return { gap, label: "On par", tone: "neutral" as const };
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
      {/* Drift alert: BP per-villa assumption >10% off live actuals.
          See Conservatism Check section below for the fine-grained verdict. */}
      {showDriftAlert && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-warning/40 bg-warning/10 text-warning px-4 py-3 text-sm flex flex-wrap items-baseline gap-x-3 gap-y-1 print:hidden"
        >
          <strong className="uppercase tracking-wider text-[11px]">Drift alert</strong>
          <span className="text-text-primary">
            BP per-villa assumption is {">"} {Math.round(DRIFT_ALERT_THRESHOLD * 100)}% off live actuals:
          </span>
          {adrDriftFires && (
            <span className="font-mono text-xs">
              ADR {adrDrift >= 0 ? "+" : ""}{(adrDrift * 100).toFixed(1)}%
              <span className="text-text-tertiary"> (BP {formatCurrency(bpADR, false, locale)} vs live {formatCurrency(liveADR, false, locale)})</span>
            </span>
          )}
          {nightsDriftFires && (
            <span className="font-mono text-xs">
              Nights {nightsDrift >= 0 ? "+" : ""}{(nightsDrift * 100).toFixed(1)}%
              <span className="text-text-tertiary"> (BP {bpNights} vs live {liveBookedNights})</span>
            </span>
          )}
          <span className="text-text-tertiary ml-auto text-[11px]">Tune in <em>Assumptions</em>.</span>
        </div>
      )}
      {/* Header — active-path metadata lives here (path · scenario · stab year),
          NOT as a KPICard in the metric grid. Plan 2026-05-22: demote ACTIVE PATH
          from the KPI grid; the subtitle below is now the single source of truth
          for "which configuration am I looking at?". */}
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-text-primary">{t('dash.title')}</h1>
          <p className="text-sm font-medium text-text-secondary mt-1">
            <span className="text-text-primary">{pathLabel}</span>
            <span className="text-text-tertiary"> &middot; </span>
            {scenarioLabel}
            <span className="text-text-tertiary"> &middot; </span>
            {t('dash.stabilisedYear')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              const { exportBusinessPlan } = await import('@/lib/excel/exportBP');
              const exportScenario = activeScenario === 'breakeven' ? 'realistic' : activeScenario;
              const blob = await exportBusinessPlan(assumptions, model, exportScenario, capTable, waterfall);
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

      {/* Term sheet at a glance — what the credit committee skims first.
          Restructure 2026-05-22: condensed horizontal STRIP (no per-cell
          kpi-value sized boxes — those competed visually with the Headline
          KPI grid below). The deal terms a banker scans for first sit in
          one inline row that stacks on <md. Source-of-truth for Loan, Term ·
          Grace, Rate, Annual DS, DSCR covenant — these are NOT repeated in
          the Headline KPI grid. */}
      {(() => {
        const path = assumptions.financingPath;
        const ratePct =
          path === "tepix-loan"
            ? assumptions.tepixLoan.bankInterestRate
            : path === "rrf"
              ? assumptions.rrf.commercialInterestRate
              : assumptions.commercialLoan.interestRate;
        const term =
          path === "tepix-loan"
            ? assumptions.tepixLoan.totalTermYears
            : path === "rrf"
              ? assumptions.rrf.repaymentTermYears
              : assumptions.commercialLoan.repaymentTermYears;
        const grace =
          path === "tepix-loan"
            ? assumptions.tepixLoan.gracePeriodYears
            : path === "rrf"
              ? assumptions.rrf.gracePeriodYears
              : assumptions.commercialLoan.gracePeriodYears;
        const covenant = assumptions.dscrCovenantThreshold;
        const minDscr = activeScenarioOutput.minDSCRLoanLife;
        const dscrPass = minDscr >= covenant;
        // Term Sheet strip cells: deal terms only. Equity Required moved to
        // the Headline KPI grid below — it's an underwriting figure, not a
        // term-sheet field. Keeps the strip to 5 banker-scan cells.
        const cells: Array<{ label: string; value: string; sub?: string; tone?: "positive" | "warning" }> = [
          {
            label: t('dash.termsheet.loan'),
            value: formatCurrency(km.loanAmount, true, locale),
            sub: `${(km.ltv * 100).toFixed(0)}% ${t('dash.termsheet.loanSub')}`,
          },
          {
            label: t('dash.termsheet.term'),
            value: `${term}y · ${grace}y`,
            sub: t('dash.termsheet.termSub'),
          },
          {
            label: t('dash.termsheet.rate'),
            value: `${(ratePct * 100).toFixed(2)}%`,
            sub: pathLabel,
          },
          {
            label: t('dash.termsheet.annualDS'),
            value: formatCurrency(km.annualDS, true, locale),
            sub: `${t('kpi.assetCoverage')} ${formatMultiple(km.assetCoverage)}`,
          },
          {
            label: t('dash.termsheet.dscrCovenant'),
            value: `${covenant.toFixed(2)}×`,
            sub: `${t('dash.termsheet.min')} ${minDscr.toFixed(2)}× — ${dscrPass ? t('dash.termsheet.pass') : t('dash.termsheet.fail')}`,
            tone: dscrPass ? "positive" : "warning",
          },
        ];
        return (
          <div id="section-termsheet" className="scroll-mt-24 mb-6">
            <SectionHeader
              title={t('dash.termsheet.title')}
              sub={`${pathLabel} · ${scenarioLabel}`}
            />
            {/* Horizontal condensed strip: flex on md+, stacks vertically
                on mobile. NO kpi-value sizing — the value sits inline with
                the label so the strip stays bar-shaped, not card-grid-shaped. */}
            <div className="bg-white rounded-xl border border-surface-tertiary shadow-sm px-4 md:px-5 py-3 md:py-3.5">
              <div className="flex flex-col md:flex-row md:items-center md:flex-wrap md:gap-x-6 md:gap-y-2 gap-y-2.5 md:divide-x md:divide-surface-tertiary/60">
                {cells.map((c, i) => (
                  <div
                    key={c.label}
                    className={`flex flex-col md:flex-row md:items-baseline md:gap-2 ${i > 0 ? "md:pl-6" : ""} text-sm`}
                  >
                    <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                      {c.label}
                    </span>
                    <span
                      className={`font-mono font-semibold ${
                        c.tone === "positive"
                          ? "text-positive"
                          : c.tone === "warning"
                            ? "text-warning"
                            : "text-text-primary"
                      }`}
                    >
                      {c.value}
                    </span>
                    {c.sub && (
                      <span className="text-[11px] text-text-tertiary leading-snug md:before:content-['·'] md:before:mr-1.5 md:before:text-text-tertiary/60">
                        {c.sub}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* LiveTrackRecord — banker proof, lifted ABOVE the Headline KPI grid so
          the first thing under the Term Sheet is the real-villa track record,
          not modeled figures. Used to sit inside the Conservatism Check
          section; restructure 2026-05-22 surfaces it as the lede. */}
      <div className="mb-6">
        <LiveTrackRecord />
      </div>

      {/* Market Position — Conservatism Triangle. Replaces the old static
          KPI grid (ADR 0003, 2026-05-22): two-tier hero strip with BP vs
          Villa Lev live vs 2025 Greek-market average, plus a drawer of all
          41 comparables behind the "See the N comparables" link. Greek-only
          headline; international comparables stay in the drawer only as
          supporting evidence (never weighted into the strip). Villa row
          intentionally absent — Villa Lev's own actuals in LiveTrackRecord
          above are the truer villa-tier comparable. */}
      <ConservatismTriangle
        id="section-market-position"
        bpStandardADR={rev.suiteStandardADR}
        bpPremiumADR={rev.suiteDoubleADR}
        liveVillaADR={liveADR}
      />


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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard
            label={t('kpi.totalInvestment')}
            value={formatCurrency(km.totalCapex, true, locale)}
            sublabel={(() => {
              const n = projects.reduce((s, p) => s + p.count, 0);
              return `${n} ${t(n === 1 ? 'kpi.plotsSingular' : 'kpi.plots')}`;
            })()}
          />
          <KPICard
            label={t('kpi.equityRequired')}
            value={formatCurrency(km.equityRequired, true, locale)}
            sublabel={`${formatPercent(km.equityRequired / km.totalCapex, 0)} ${t('kpi.ofTotal')}`}
          />
          <KPICard
            label={t('kpi.dscrPostRamp')}
            value={km.dscrPostRamp > 0 ? formatMultiple(km.dscrPostRamp) : "—"}
            sublabel={t('kpi.dscrPostRampSub')}
            tone={dscrTone}
          />
          <KPICard
            label={t('kpi.equityIRR')}
            value={km.equityIRR > 0 ? formatPercent(km.equityIRR) : "—"}
            sublabel={t('kpi.equityIRRSub')}
            tone={km.equityIRR >= 0.15 ? "positive" : km.equityIRR > 0 ? undefined : "warning"}
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

      {/* Section 1 — Coverage Ratios.
          Restructure 2026-05-22: DSCR · 2030 moved to the Headline KPI grid
          above (the single source of truth for the headline DSCR figure).
          This section keeps the 4 secondary coverage metrics — ICR, LLCR,
          PLCR, covenant headroom — which are what a credit committee asks
          about AFTER the headline DSCR. */}
      <div id="section-coverage" className="scroll-mt-24">
      <SectionHeader title={t('dash.section.coverage')} sub={t('dash.coverageSub')} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          value={(() => {
            // Headroom as percent of the covenant threshold:
            //   (dscrPostRamp − 1.25) / 1.25
            // e.g. dscrPostRamp = 1.42 → +13.6%. Reverted 2026-05-22 from
            // the absolute multiple-delta format ("+0.17×") at Eytan's
            // request — bankers read "we're 14% above covenant" more
            // naturally than "+0.17×". The covenant target itself stays in
            // multiples in the sublabel ("vs. 1.25× covenant") because
            // that's how the covenant is written in the loan document.
            if (km.dscrPostRamp <= 0) return "—";
            const covenant = 1.25;
            const deltaPct = (km.dscrPostRamp - covenant) / covenant;
            const sign = deltaPct >= 0 ? "+" : "−";
            return `${sign}${(Math.abs(deltaPct) * 100).toFixed(1)}%`;
          })()}
          sublabel={t('kpi.covHeadroomSub')}
          tone={
            km.dscrPostRamp - 1.25 >= 0.2
              ? "positive"
              : km.dscrPostRamp >= 1.25
                ? undefined
                : "warning"
          }
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

      {/* Exit path comparison — hotel sale (EBITDA × multiple) vs property
          sale (builtSurface × €/m²). A rational sponsor elects whichever
          terminal asset value is higher; the DOMINANT EXIT badge marks it.
          Both paths share the same operating-year cash flows; only the
          terminal lump sum differs. €/m² is editable in the top bar. */}
      <div className="mt-6 mb-2 px-1 flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">
          Exit path comparison
        </h3>
        <p className="text-[11px] text-text-tertiary leading-snug max-w-2xl">
          Hotel sale (EBITDA × multiple) vs property sale (built surface × €/m²). Sponsor elects the higher exit at sale. Adjust €/m² in the top bar to stress the property-sale path.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label="Exit value — hotel sale"
          value={km.terminalAssetValue > 0 ? formatCurrency(km.terminalAssetValue, true, locale) : "—"}
          sublabel={`EBITDA × ${(activeScenarioOutput.exitEbitdaMultiple ?? 10).toFixed(1)}× at ${activeScenarioOutput.exitYear ?? 2036}`}
          tone={!km.propertyExitDominates && km.terminalAssetValue > 0 ? "positive" : undefined}
          chip={!km.propertyExitDominates && km.terminalAssetValue > 0 ? { label: "DOMINANT", ok: true } : undefined}
        />
        <KPICard
          label="Equity IRR — hotel sale"
          value={km.equityIRR > 0 ? formatPercent(km.equityIRR) : "—"}
          sublabel={`MOIC ${km.totalMOIC > 0 ? km.totalMOIC.toFixed(2) + "×" : "—"}`}
          tone={km.equityIRR >= 0.15 ? "positive" : km.equityIRR > 0 ? undefined : "warning"}
        />
        <KPICard
          label="Exit value — property sale"
          value={km.terminalAssetValuePropertySale > 0 ? formatCurrency(km.terminalAssetValuePropertySale, true, locale) : "—"}
          sublabel={`Built surface × ${formatCurrency(km.exitValuationPerM2, false, locale)}/m²`}
          tone={km.propertyExitDominates ? "positive" : undefined}
          chip={km.propertyExitDominates ? { label: "DOMINANT", ok: true } : undefined}
        />
        <KPICard
          label="Equity IRR — property sale"
          value={km.equityIRRPropertySale > 0 ? formatPercent(km.equityIRRPropertySale) : "—"}
          sublabel={`MOIC ${km.totalMOICPropertySale > 0 ? km.totalMOICPropertySale.toFixed(2) + "×" : "—"}`}
          tone={km.equityIRRPropertySale >= 0.15 ? "positive" : km.equityIRRPropertySale > 0 ? undefined : "warning"}
        />
      </div>
      </div>

      {/* Section — Conservatism Check.
          Restructure 2026-05-22: LiveTrackRecord was lifted out of this
          section and placed directly under the Term Sheet strip (banker-
          proof lede). What stays here is the per-villa BP-vs-live comparison
          table — the audit detail that proves the conservatism story. */}
      <div id="section-conservatism" className="scroll-mt-24 mb-6 mt-6">
        <SectionHeader
          title="Conservatism Check"
          sub="Per-villa BP assumptions vs the live single villa we already run today"
        />
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
                <tr className="bg-surface-secondary/20">
                  <td colSpan={5} className="py-1.5 pl-4 pr-4 text-[10px] uppercase tracking-wider text-text-tertiary font-medium">
                    Per-villa conservatism — every BP value below is at or under what one live villa already delivers
                  </td>
                </tr>
                <tr className="border-b border-surface-secondary/50">
                  <td className="py-2.5 pl-4 pr-4 text-text-secondary">
                    Peak-season nights <span className="text-text-tertiary">(count)</span>
                    <div className="text-[11px] text-text-tertiary">120 available · 15 May – 15 Sept</div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">{bpNights}</td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-tertiary">{revUp.villaBaseNights}</td>
                  <td className="text-right py-2.5 px-3 data-cell">
                    {liveBookedNights}
                    <div className="text-[11px] text-text-tertiary">2026 booked through May; trending to full</div>
                  </td>
                  <td className="text-right py-2.5 px-3 pr-4">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${verdictToneClass(verdictNights.tone)}`}>
                      {verdictNights.label}
                    </span>
                  </td>
                </tr>
                <tr className="border-b border-surface-secondary/50">
                  <td className="py-2.5 pl-4 pr-4 text-text-secondary">
                    ADR <span className="text-text-tertiary">(net of OTA commissions)</span>
                    <div className="text-[11px] text-text-tertiary">€ per night</div>
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
                    Accommodation <span className="text-text-tertiary">(revenue, net of commissions)</span>
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
                <tr className="border-b border-surface-secondary/50">
                  <td className="py-2.5 pl-4 pr-4 text-text-secondary">
                    Ancillary profit <span className="text-text-tertiary">— per villa</span>
                    <div className="text-[11px] text-text-tertiary">Chef · boat · car · quad · concierge · explicit per-villa BP allocation</div>
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

                <tr className="bg-surface-secondary/20 border-t-2 border-surface-tertiary">
                  <td colSpan={5} className="py-1.5 pl-4 pr-4 text-[10px] uppercase tracking-wider text-text-tertiary font-medium">
                    Portfolio framing — not conservatism (different scope; shown for scale, not like-for-like comparison)
                  </td>
                </tr>
                <tr className="border-b border-surface-secondary/50">
                  <td className="py-2.5 pl-4 pr-4 text-text-secondary">
                    Events <span className="text-text-tertiary">(portfolio profit)</span>
                    <div className="text-[11px] text-text-tertiary">{rev.eventsPerYear}/yr × {formatCurrency(rev.netProfitPerEvent, false, locale)} net per event · {totalUnits}-property total</div>
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell">{formatCurrency(bpEventsPortfolio, true, locale)}</td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-tertiary">
                    {formatCurrency(revUp.eventsPerYear * revUp.netProfitPerEvent, true, locale)}
                  </td>
                  <td className="text-right py-2.5 px-3 data-cell text-text-tertiary">
                    €0
                    <div className="text-[11px] text-text-tertiary">not run today</div>
                  </td>
                  <td className="text-right py-2.5 px-3 pr-4">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-brand-100 text-brand-800">
                      Pure upside
                    </span>
                  </td>
                </tr>
                <tr className="font-medium">
                  <td className="py-2.5 pl-4 pr-4">
                    Portfolio total <span className="text-text-tertiary font-normal">(revenue, stabilised)</span>
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
                    <div className="text-[11px] font-normal text-text-tertiary">2025 actual · one villa</div>
                  </td>
                  <td className="text-right py-2.5 px-3 pr-4 data-cell text-positive">
                    Portfolio = {(buildingTotalRevenue / liveTotal2025).toFixed(1)}× single-villa run-rate
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-surface-tertiary/50 text-[11px] text-text-tertiary bg-surface-secondary/20 flex flex-wrap items-center justify-between gap-2">
            <span>
              Live source: <strong>2026 season</strong> (in progress, {liveBookedNights}/{currentSeason.availableNights} nights booked) for ADR / accommodation, <strong>2025 actual</strong> ({formatCurrency(lastCompletedSeason.total, true, locale)}) for ancillary — 2025 is the most recent complete year.
            </span>
            <span>
              BP ancillary allocated per the pitch: €{(BP_ANCILLARY_PROFIT_PER_VILLA / 1000).toFixed(0)}K/villa × {totalVillaUnits} villas + {formatCurrency(BP_ANCILLARY_SUITE_TOTAL, true, locale)} across {BP_ANCILLARY_SUITE_ROOMS} suite rooms = {formatCurrency(BP_ANCILLARY_PORTFOLIO_TOTAL, true, locale)} total. Live profit = {Math.round(SERVICES_PROFIT_MARGIN * 100)}% × {formatCurrency(liveServices2025, true, locale)} revenue.
            </span>
          </div>
        </div>
      </div>

      {/* Section 3b — Founder waterfall.
          Restructure 2026-05-22: the full 6-tile inline grid duplicated the
          dedicated /admin/cap-table page. Replaced with a compact summary
          row + drill-down link so the dashboard surfaces just the headline
          founder/investor split, not the full 3-layer breakdown. Anchor id
          `section-founder` preserved for the page tour. */}
      <div id="section-founder" className="scroll-mt-24">
      <SectionHeader title={t('dash.founder.section')} sub={t('dash.founder.sectionSub')} />
      <a
        href="/admin/cap-table"
        className="block bg-white rounded-xl border border-surface-tertiary hover:border-brand-300 hover:shadow-sm transition-all p-5 group"
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
              <div className={`text-sm font-medium ${founderBd.capBinding === "total_75" ? "text-warning" : founderBd.capBinding === "earned_33" ? "text-text-primary" : "text-positive"}`}>
                {capStatusLabel}
              </div>
            </div>
          </div>
          <span className="text-xs text-brand-700 group-hover:text-brand-800 font-medium">
            {t('dash.drillDown')}
          </span>
        </div>
        <div className="text-[11px] text-text-tertiary mt-3 pt-3 border-t border-surface-tertiary/50">
          {t('dash.founderDrillDown')}
        </div>
      </a>
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

      {/* Section 7 — P&L Summary drill-down.
          Restructure 2026-05-22: the inline year-by-year P&L table (~180
          lines, 13 rows × every year) duplicated the dedicated /admin/pnl
          page. Replaced with a compact "drill down" card showing the active-
          scenario stabilised headline figures (already shown in Operating
          Performance above) + a link to the full timeline. Anchor id
          `section-pnl-summary` preserved for the page tour. */}
      <a
        id="section-pnl-summary"
        href="/admin/pnl"
        className="block bg-white rounded-xl border border-surface-tertiary hover:border-brand-300 hover:shadow-sm transition-all p-5 mt-8 scroll-mt-24 group"
      >
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary">
              {t('dash.pnlSummary')} — {scenarioLabel}
            </h3>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm">
              <span className="text-text-secondary">
                <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary me-1">
                  {t('pnl.totalRevenue')}
                </span>
                <span className="font-mono font-semibold text-text-primary">
                  {finalYear && finalYear.totalRevenue > 0 ? formatCurrency(finalYear.totalRevenue, true, locale) : "—"}
                </span>
              </span>
              <span className="text-text-secondary">
                <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary me-1">
                  {t('term.ebitda')}
                </span>
                <span className="font-mono font-semibold text-positive">
                  {finalYear && finalYear.ebitda !== 0 ? formatCurrency(finalYear.ebitda, true, locale) : "—"}
                </span>
              </span>
              <span className="text-text-secondary">
                <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary me-1">
                  {t('pnl.ncfPostVAT')}
                </span>
                <span className={`font-mono font-semibold ${finalYear && finalYear.netCashFlowPostVAT >= 0 ? "text-positive" : "text-negative"}`}>
                  {finalYear ? formatCurrency(finalYear.netCashFlowPostVAT, true, locale) : "—"}
                </span>
              </span>
            </div>
          </div>
          <span className="text-xs text-brand-700 group-hover:text-brand-800 font-medium">
            {t('dash.drillDown')}
          </span>
        </div>
        <div className="text-[11px] text-text-tertiary mt-3 pt-3 border-t border-surface-tertiary/50">
          {t('dash.pnlDrillDown')}
        </div>
      </a>

      {/* Section 8 — Sensitivity & Stress */}
      <SectionHeader title={t('dash.section.sensitivity')} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard
          label={t('kpi.bufferBreakEven')}
          value={formatPercent(km.bufferToBreakEven)}
          sublabel={t('kpi.bufferBreakEvenSub')}
        />
        {(() => {
          const downsideStab = model.scenarios.downside.stabilisedYear?.dscr ?? 0;
          const downsideMin = model.scenarios.downside.minDSCRLoanLife;
          const minDisplay = downsideMin > 0 ? formatMultiple(downsideMin) : "—";
          return (
            <KPICard
              label={t('kpi.stabilisedDSCRDownside')}
              value={downsideStab > 0 ? formatMultiple(downsideStab) : "—"}
              sublabel={`${t('kpi.stabilisedDSCRDownsideSub')} · ${t('kpi.minOverLoanLife')}: ${minDisplay}`}
              tone={
                downsideStab >= 1.25
                  ? "positive"
                  : downsideStab > 0
                    ? "warning"
                    : "neutral"
              }
            />
          );
        })()}
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
