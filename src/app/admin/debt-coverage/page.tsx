"use client";

import { useEffect } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import {
  formatCurrency,
  formatPercent,
  formatMultiple,
} from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { PageSkeleton } from "@/components/Skeleton";
import { PageTour, TourButton, usePageTour } from "@/components/PageTour";
import { DEBT_COVERAGE_TOUR } from "@/lib/tours/configs";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { PROJECT_CONSTANTS } from "@/lib/engine/defaults";
import type { GraceMode } from "@/lib/engine/types";
import { SectionHeader, StatusChip, KPICard } from "@/components/AdminUI";
import { ConstructionVatCashflow } from "@/components/ConstructionVatCashflow";
import { useTrackFeature } from "@/lib/hooks/useTrackFeature";

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

export default function DebtCoveragePage() {
  const { track } = useTrackFeature();
  useEffect(() => { track("admin-debt-coverage"); }, [track]);
  const { t, locale } = useTranslation();
  const { model, assumptions, activeScenario, setAssumption, financingPathOverride } = useModelStore();
  const graceMode = (assumptions.commercialLoan?.graceMode ?? 'standard') as GraceMode;
  const effectivePath = financingPathOverride ?? assumptions.financingPath;
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(DEBT_COVERAGE_TOUR.storageKey);

  if (!model) return <PageSkeleton variant="grid" />;

  const activeScenarioOutput = model.scenarios[activeScenario];
  const activePnL = activeScenarioOutput.pnl;
  const stab = activeScenarioOutput.stabilisedYear;

  const minDSCRLoanLife = activeScenarioOutput.minDSCRLoanLife;
  const avgDSCRLoanLife = activeScenarioOutput.avgDSCRLoanLife ?? 0;
  const dscrCovenantHeadroom = activeScenarioOutput.dscrCovenantHeadroom;
  const icrStabilised = activeScenarioOutput.icrStabilised;
  const llcr = activeScenarioOutput.llcr;
  const plcr = activeScenarioOutput.plcr;
  const gracePeriodInterestTotal = activeScenarioOutput.gracePeriodInterestTotal;
  const commitmentFeeEnabled = assumptions.commercialLoan?.commitmentFeeEnabled ?? false;
  const cumulativeCommitmentFee = activePnL.reduce(
    (sum, p) => sum + (p.commitmentFee && p.commitmentFee > 0 ? p.commitmentFee : 0),
    0
  );
  const netLeverage = activeScenarioOutput.netLeverage;
  const peakDebtOutstanding = activeScenarioOutput.peakDebtOutstanding;
  const roic = activeScenarioOutput.roic;

  const stabilisedRevenue = stab?.totalRevenue ?? 0;
  const stabilisedEBITDA = stab?.ebitda ?? 0;
  const stabilisedNCF = stab?.netCashFlowPostVAT ?? 0;

  const wcActive = assumptions.workingCapital.active;
  const wcEffectiveFacility = activeScenarioOutput.wcEffectiveFacility;
  const wcSelfLiqViolation = activePnL.some((p) => p.wcSelfLiquidatingViolation);
  const wcY2 = activePnL.find((p) => p.year === 2029);
  const wcY2Peak = wcY2?.wcPeakBalance ?? 0;
  const wcStabilisedAvg = stab?.wcAvgBalance ?? 0;
  const wcStabilisedInterest = stab?.wcInterestExpense ?? 0;
  const worstTrough = activePnL
    .filter((p) => p.year >= PROJECT_CONSTANTS.OPENING_YEAR)
    .reduce((max, p) => Math.max(max, p.wcTroughBalance), 0);
  // VAT-bridge balances come directly from the engine (vatBridgeBalance per quarter,
  // derived from the static VAT_BRIDGE_CLOSING schedule in workingCapital.ts).
  const wcSparkData = activeScenarioOutput.wcQuarters
    .filter((q) => q.year >= 2026)
    .map((q) => {
      const vatBridge = Math.round(q.vatBridgeBalance ?? 0);
      const opWc = Math.round(q.closingBalance);
      return {
        label: `${q.year}Q${q.quarter}`,
        opWc,
        vatBridge,
        total: vatBridge + opWc,
      };
    });
  const WC_FACILITY_SIZE = assumptions.workingCapital.facilitySize;
  const wcPeakCombined = Math.max(...wcSparkData.map(d => d.total));

  const icrTone =
    icrStabilised >= 3 ? "positive" : icrStabilised >= 2 ? undefined : "warning";
  const llcrTone =
    llcr >= 1.5 ? "positive" : llcr >= 1.25 ? undefined : "warning";

  const pathLabel =
    effectivePath === "grant"
      ? t("path.grant")
      : effectivePath === "rrf"
        ? t("path.rrf")
        : effectivePath === "tepix-loan"
          ? t("path.tepixLoan")
          : effectivePath === "optima"
            ? t("bank.bar.optima")
            : t("path.commercial");

  const scenarioLabel =
    activeScenario === 'upside' ? t('scenario.upside') :
    activeScenario === 'downside' ? t('scenario.downside') :
    activeScenario === 'breakeven' ? t('scenario.breakeven') :
    t('scenario.realistic');

  // DSCR trajectory chart — realistic/downside/upside use the active path's debt schedule.
  // Grant is kept as a fixed reference line (always grant debt, path-invariant).
  const dscrTrajectoryData = model.scenarios.realistic.pnl
    .filter((p) => p.year >= PROJECT_CONSTANTS.OPENING_YEAR)
    .map((p) => {
      const up   = model.scenarios.upside.pnl.find((u) => u.year === p.year);
      const down = model.scenarios.downside.pnl.find((d) => d.year === p.year);
      const grantRow = model.dscrByYear.find((d) => d.year === p.year);
      return {
        year: p.year,
        Conservative: Number(p.dscr.toFixed(2)),
        Downside:     Number((down?.dscr ?? 0).toFixed(2)),
        Grant:        Number((grantRow?.grant ?? 0).toFixed(2)),
        Realistic:    Number((up?.dscr ?? 0).toFixed(2)),
      };
    });

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-text-primary border-l-[3px] border-brand-400 pl-3">{t('dc.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('dc.pageIntro')}</p>
          <p className="text-sm font-medium text-text-secondary mt-1">
            <span className="text-text-primary">{pathLabel}</span>
            <span className="text-text-tertiary"> &middot; </span>
            {scenarioLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TourButton onClick={() => setTourOpen(true)} pulsing={!!neverSeen} />
        </div>
      </div>

      {/* Grace structure toggle — commercial, grant, and optima paths support draw structure */}
      {(['commercial', 'grant', 'optima'] as string[]).includes(effectivePath) && <div className="bg-white rounded-xl border border-surface-tertiary px-5 py-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary shrink-0 w-36">
            {t('bank.graceMode.label')}
          </span>
          <div className="flex gap-1">
            {(['rolling-cohort', 'rolling'] as GraceMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setAssumption('commercialLoan.graceMode', m, 'Grace structure')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  graceMode === m
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-secondary text-text-secondary hover:bg-surface-tertiary'
                }`}
              >
                {t(`bank.graceMode.${m.replace(/-/g, '_')}` as 'bank.graceMode.rolling' | 'bank.graceMode.rolling_cohort')}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[12px] text-text-secondary leading-relaxed mt-3">
          {graceMode === 'rolling'
            ? t('bank.graceMode.rolling.desc')
            : graceMode === 'rolling-cohort'
              ? t('bank.graceMode.rolling_cohort.desc')
              : t('bank.graceMode.two_phase.desc')}
        </p>
      </div>}

      {/* Section 1 — DSCR Trajectory Chart */}
      <div id="section-dscr-hero" className="bg-white rounded-xl border border-surface-tertiary p-5 scroll-mt-24">
        <div className="mb-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary">
              {t("dash.heroDscr")}
            </h3>
            <span className="text-[11px] text-text-tertiary">
              {t("dash.minDscr")}: {formatMultiple(minDSCRLoanLife)} · {t("kpi.gracePeriodInterest")}: {formatCurrency(gracePeriodInterestTotal, true, locale)}
            </span>
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            {t("dash.heroDscrSub")}
          </p>
        </div>
        <ResponsiveContainer key={`dscr-trajectory-${activeScenario}-${assumptions.financingPath}-${graceMode}`} width="100%" height={260}>
          <LineChart data={dscrTrajectoryData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `${v.toFixed(1)}×`}
              domain={[0, "dataMax + 0.5"]}
            />
            <Tooltip
              formatter={(value) => `${Number(value).toFixed(2)}×`}
              contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine
              y={assumptions?.dscrCovenantThreshold ?? 1.25}
              stroke="#9E3B3B"
              strokeDasharray="5 5"
              label={{ value: t('dc.covenantLabel'), fontSize: 10, fill: "#9E3B3B" }}
            />
            <ReferenceLine
              y={1.50}
              stroke="#6B7A3D"
              strokeDasharray="3 3"
              label={{ value: t('dc.comfortLabel'), fontSize: 10, fill: "#6B7A3D" }}
            />
            <Line
              type="monotone"
              dataKey="Conservative"
              name={t("scenario.realistic")}
              stroke="#8B6914"
              strokeWidth={2.5}
            />
            <Line
              type="monotone"
              dataKey="Downside"
              name={t("scenario.downside")}
              stroke="#9E3B3B"
              strokeWidth={1.8}
              strokeDasharray="4 2"
            />
            <Line
              type="monotone"
              dataKey="Grant"
              name={t("dc.grantLineName")}
              stroke="#4A7C3F"
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
            <Line
              type="monotone"
              dataKey="Realistic"
              name="Realistic"
              stroke="#7B5EA7"
              strokeWidth={1.5}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Section 2 — Coverage Ratios */}
      <div id="section-coverage-ratios" className="scroll-mt-24">
      <SectionHeader title={t("dash.section.coverage")} sub={t("dash.coverageSub")} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label={t("kpi.icr")}
          value={icrStabilised > 0 ? formatMultiple(icrStabilised) : "—"}
          sublabel={t("kpi.icrSub")}
          tone={icrTone}
        />
        <KPICard
          label={t("kpi.llcr")}
          value={llcr > 0 ? formatMultiple(llcr) : "—"}
          sublabel={t("kpi.llcrSub")}
          tone={llcrTone}
        />
        <KPICard
          label={t("kpi.plcr")}
          value={plcr > 0 ? formatMultiple(plcr) : "—"}
          sublabel={t("kpi.plcrSub")}
          tone={plcr >= 1.7 ? "positive" : plcr >= 1.4 ? undefined : "warning"}
        />
        <KPICard
          label={t("kpi.covHeadroom")}
          value={(() => {
            if (avgDSCRLoanLife <= 0) return "—";
            const covenant = assumptions?.dscrCovenantThreshold ?? 1.25;
            const deltaPct = (avgDSCRLoanLife - covenant) / covenant;
            const sign = deltaPct >= 0 ? "+" : "−";
            return `${sign}${(Math.abs(deltaPct) * 100).toFixed(1)}%`;
          })()}
          sublabel={t("kpi.covHeadroomSub")}
          tone={
            avgDSCRLoanLife - (assumptions?.dscrCovenantThreshold ?? 1.25) >= 0.2
              ? "positive"
              : avgDSCRLoanLife >= (assumptions?.dscrCovenantThreshold ?? 1.25)
                ? undefined
                : "warning"
          }
        />
      </div>
      </div>{/* end section-coverage-ratios */}

      {/* Section 3 — Capital Structure & Debt */}
      <SectionHeader title={t("dash.section.capital")} sub={pathLabel} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label={t("kpi.gracePeriodInterest")}
          value={formatCurrency(gracePeriodInterestTotal, true, locale)}
          sublabel={t("kpi.gracePeriodInterestSub")}
        />
        <KPICard
          label={t("kpi.netLeverage")}
          value={netLeverage > 0 ? formatMultiple(netLeverage) : "—"}
          sublabel={t("kpi.netLeverageSub")}
          tone={netLeverage <= 5 ? "positive" : netLeverage <= 7 ? undefined : "warning"}
        />
        <KPICard
          label={t("kpi.peakDebt")}
          value={formatCurrency(peakDebtOutstanding, true, locale)}
          sublabel={t("kpi.peakDebtSub")}
        />
        <KPICard
          label={t("kpi.roic")}
          value={roic > 0 ? formatPercent(roic) : "—"}
          sublabel={t("kpi.roicSub")}
          tone={roic >= 0.07 ? "positive" : roic > 0 ? undefined : "warning"}
        />
      </div>
      {commitmentFeeEnabled && cumulativeCommitmentFee > 0 && (
        <div className="mt-3 px-1">
          <MiniStat
            label={t("pnl.commitmentFee")}
            value={formatCurrency(cumulativeCommitmentFee, true, locale)}
            tone="neutral"
          />
        </div>
      )}

      {/* Section 4 — Operating Performance */}
      <SectionHeader title={t("dash.section.operating")} sub={t("dash.stabilisedYear")} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          label={t("kpi.stabilisedRevenue")}
          value={formatCurrency(stabilisedRevenue, true, locale)}
          sublabel={t("kpi.stabilisedRevenueSub")}
          accent
        />
        <KPICard
          label={t("term.ebitda")}
          value={formatCurrency(stabilisedEBITDA, true, locale)}
          sublabel={`${t("kpi.margin")} ${formatPercent(stab?.ebitdaMargin ?? 0)}`}
          threshold={t("kpi.ebitdaMarginNote")}
          accent
        />
        <KPICard
          label={t("kpi.netCashFlow")}
          value={formatCurrency(stabilisedNCF, true, locale)}
          sublabel={t("kpi.netCashFlowSub")}
        />
      </div>

      {/* Section 5 — Working Capital (conditional) */}
      {wcActive && (
        <>
          <SectionHeader
            title={t("dash.section.workingCapital")}
            sub={t("dash.wcPanelSub")}
          />
          <div className="bg-white rounded-xl border border-surface-tertiary p-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-5 grid grid-cols-2 gap-x-6 gap-y-4">
                <MiniStat
                  label={t("dash.wcCombinedPeak")}
                  value={formatCurrency(wcPeakCombined, true, locale)}
                  tone={wcPeakCombined > WC_FACILITY_SIZE ? "warning" : undefined}
                />
                <MiniStat
                  label={t("dash.wcAvg")}
                  value={formatCurrency(wcStabilisedAvg, true, locale)}
                />
                <MiniStat
                  label={t("dash.wcTrough")}
                  value={formatCurrency(worstTrough, true, locale)}
                  tone={wcSelfLiqViolation ? "warning" : "positive"}
                />
                <MiniStat
                  label={t("dash.wcInterestAnnual")}
                  value={formatCurrency(wcStabilisedInterest, true, locale)}
                />
                <div className="col-span-2 flex items-center gap-3 pt-2 border-t border-surface-tertiary/50">
                  <StatusChip
                    label={wcSelfLiqViolation ? t("kpi.wcSelfLiqFail") : t("kpi.wcSelfLiqOk")}
                    ok={!wcSelfLiqViolation}
                  />
                  <span className="text-[11px] text-text-tertiary">
                    {t("kpi.wcSelfLiqSub")} · {t("kpi.wcFacility")}{" "}
                    {formatCurrency(wcEffectiveFacility, true, locale)}
                  </span>
                </div>
              </div>
              <div className="lg:col-span-7">
                <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">
                  {t("dash.wcSparkLabel")}
                </div>
                <ResponsiveContainer width="100%" height={170}>
                  <AreaChart data={wcSparkData} margin={{ top: 10, right: 70, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="wcVatGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B5FA0" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#3B5FA0" stopOpacity={0.12} />
                      </linearGradient>
                      <linearGradient id="wcOpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8B6914" stopOpacity={0.65} />
                        <stop offset="100%" stopColor="#8B6914" stopOpacity={0.15} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9 }}
                      interval={3}
                      tickFormatter={(v: string) => v.replace('Q', ' Q')}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}K`}
                      width={50}
                      domain={[0, Math.ceil(Math.max(WC_FACILITY_SIZE, wcPeakCombined) * 1.12 / 50_000) * 50_000]}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        formatCurrency(Number(value), true, locale),
                        name === 'vatBridge'
                          ? t('bank.wc.dual.vatBridgeLabel')
                          : name === 'opWc'
                            ? t('bank.wc.dual.opWcLabel')
                            : 'Total draw',
                      ]}
                      labelFormatter={(label, payload) => {
                        const total = Array.isArray(payload)
                          ? (payload as Array<{ value?: number }>).reduce((s, e) => s + (e.value ?? 0), 0)
                          : 0;
                        return `${t("dash.wcQuarterly")} ${label}  ·  Total ${formatCurrency(total, true, locale)}`;
                      }}
                      contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 11 }}
                    />
                    {/* Covenant ceiling */}
                    <ReferenceLine
                      y={WC_FACILITY_SIZE}
                      stroke="#DC2626"
                      strokeDasharray="4 3"
                      strokeWidth={1.2}
                      label={{ value: `€${(WC_FACILITY_SIZE / 1000).toFixed(0)}K limit`, position: 'right', fontSize: 9, fill: '#DC2626' }}
                    />
                    {/* Peak combined draw annotation */}
                    {wcPeakCombined > 0 && (
                      <ReferenceLine
                        y={wcPeakCombined}
                        stroke="#6B7280"
                        strokeDasharray="2 3"
                        strokeWidth={1}
                        label={{ value: `Peak €${(wcPeakCombined / 1000).toFixed(0)}K`, position: 'right', fontSize: 9, fill: '#6B7280' }}
                      />
                    )}
                    {/* Stacked: VAT bridge (bottom) + operational WC (top) — combined height = total facility draw */}
                    <Area
                      stackId="wc"
                      type="stepAfter"
                      dataKey="vatBridge"
                      stroke="#3B5FA0"
                      strokeWidth={1.5}
                      fill="url(#wcVatGrad)"
                      name="vatBridge"
                    />
                    <Area
                      stackId="wc"
                      type="stepAfter"
                      dataKey="opWc"
                      stroke="#8B6914"
                      strokeWidth={1.5}
                      fill="url(#wcOpGrad)"
                      name="opWc"
                    />
                    <Legend
                      iconType="square"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 9, paddingTop: 2 }}
                      formatter={(value) =>
                        value === 'vatBridge'
                          ? t('bank.wc.dual.vatBridgeLabel')
                          : t('bank.wc.dual.opWcLabel')
                      }
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Dual-use facility note (ADR-0015) */}
            <div className="border-t border-surface-tertiary bg-surface-secondary/40 px-5 py-3 mt-0">
              <div className="flex items-start gap-2 text-[11px] text-text-tertiary">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 mt-0.5 text-text-tertiary/60" aria-hidden="true">
                  <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.1"/>
                  <path d="M6.5 5.5v4M6.5 4h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span>
                  <span className="font-medium text-text-secondary">{t('bank.wc.title')}</span>
                  {" "}—{" "}
                  {formatCurrency(assumptions.workingCapital.facilitySize, true, locale)} {t('bank.wc.revolving')}
                  {" "}·{" "}
                  <span className="font-medium text-text-secondary">{t('bank.wc.notIncluded')}</span>
                </span>
              </div>
              <div className="mt-2 ml-5 space-y-1">
                <div className="text-[11px]">
                  <span className="font-medium text-text-secondary">{t('bank.wc.dual.vatBridgeLabel')}</span>
                  {" · "}<span className="text-text-tertiary">{t('bank.wc.dual.vatBridgeSub')}</span>
                </div>
                <div className="text-[11px]">
                  <span className="font-medium text-text-secondary">{t('bank.wc.dual.opWcLabel')}</span>
                  {" · "}<span className="text-text-tertiary">{t('bank.wc.dual.opWcSub')}</span>
                </div>
                <div className="text-[10px] text-text-tertiary/70 italic mt-1">
                  {t('bank.wc.dual.sizingNote')}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Section — DSRA (conditional) */}
      {(activeScenarioOutput?.dsraTarget ?? 0) > 0 && (() => {
        const dsraTarget = activeScenarioOutput.dsraTarget ?? 0;
        const dsraChartData = activePnL
          .filter((p) => p.year >= PROJECT_CONSTANTS.OPENING_YEAR)
          .map((p) => ({
            year: p.year,
            balance: Math.round(p.dsraBalance ?? 0),
            draw: Math.round(p.dsraDraw ?? 0),
            replenishment: Math.round(p.dsraReplenishment ?? 0),
          }));
        const hasActivity = dsraChartData.some((d) => d.draw > 0 || d.replenishment > 0);
        return (
          <section>
            <div className="mb-3 mt-6">
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                {t('dsra.sectionTitle')}
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">{t('dsra.sectionSub')}</p>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <KPICard
                label={t('dsra.target')}
                value={formatCurrency(dsraTarget, true, locale)}
                sublabel={t('dsra.targetSub')}
              />
              <KPICard
                label={t('dsra.sweep')}
                value={formatCurrency(activeScenarioOutput.dsraSweep2028 ?? 0, true, locale)}
                sublabel={t('dsra.sweepSub')}
              />
              <KPICard
                label={t('dsra.partnerAdvance')}
                value={formatCurrency(activeScenarioOutput.dsraPartnerAdvance ?? 0, true, locale)}
                sublabel={t('dsra.partnerAdvanceSub')}
              />
            </div>

            {/* DSRA Balance & Activity chart */}
            <div className="bg-white rounded-xl border border-surface-tertiary p-5">
              <div className="flex items-baseline justify-between mb-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  {t('dsra.chartTitle')}
                </h4>
                <span className="text-[10px] text-text-tertiary font-mono">
                  {t('dsra.target')}: {formatCurrency(dsraTarget, true, locale)}
                </span>
              </div>
              <p className="text-[11px] text-text-tertiary mb-4">{t('dsra.chartSub')}</p>
              {hasActivity ? (
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={dsraChartData} margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dsraBalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C4A55E" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#C4A55E" stopOpacity={0.05} />
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
                      strokeWidth={2}
                      fill="url(#dsraBalGrad)"
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
                <div className="flex items-center justify-center h-24 text-xs text-positive font-medium gap-2">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <circle cx="7" cy="7" r="6.5" stroke="#6B7A3D" />
                    <path d="M4 7l2.5 2.5L10 4.5" stroke="#6B7A3D" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t('dsra.noActivity')}
                </div>
              )}
            </div>

            <p className="text-[11px] text-text-tertiary mt-3 leading-relaxed">
              {t('dsra.debtCoverageCaption')}
            </p>
          </section>
        );
      })()}

      {/* Section 5b — Construction VAT Cashflow (ADR-0015) */}
      <div className="mb-6">
        <ConstructionVatCashflow />
      </div>

      {/* Section 6 — Collateral */}
      <div id="section-collateral" className="scroll-mt-24">
      <SectionHeader title={t("dash.section.collateral")} sub={t("dash.collateralTiers")} />
      <div className="bg-white rounded-xl border border-surface-tertiary p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                  {t("common.metric")}
                </th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-warning font-medium">
                  {t("sc.stress")}
                </th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                  {t("sc.market")}
                </th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-positive font-medium">
                  {t("sc.optimistic")}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-surface-secondary/50">
                <td className="py-2 pr-4 text-text-secondary">{t("kpi.portfolioValue")}</td>
                <td className="text-right py-2 px-3 data-cell">
                  {formatCurrency(model.collateral.stress.value, true, locale)}
                </td>
                <td className="text-right py-2 px-3 data-cell">
                  {formatCurrency(model.collateral.market.value, true, locale)}
                </td>
                <td className="text-right py-2 px-3 data-cell">
                  {formatCurrency(model.collateral.optimistic.value, true, locale)}
                </td>
              </tr>
              <tr className="border-b border-surface-secondary/50">
                <td className="py-2 pr-4 text-text-secondary">{t("term.ltv")}</td>
                <td
                  className={`text-right py-2 px-3 data-cell ${
                    model.collateral.stress.ltv > 0.75 ? "text-warning" : "text-text-primary"
                  }`}
                >
                  {formatPercent(model.collateral.stress.ltv)}
                </td>
                <td
                  className={`text-right py-2 px-3 data-cell ${
                    model.collateral.market.ltv > 0.75 ? "text-warning" : "text-positive"
                  }`}
                >
                  {formatPercent(model.collateral.market.ltv)}
                </td>
                <td className="text-right py-2 px-3 data-cell text-positive">
                  {formatPercent(model.collateral.optimistic.ltv)}
                </td>
              </tr>
              <tr className="font-medium">
                <td className="py-2 pr-4">{t("kpi.assetCoverage")}</td>
                <td
                  className={`text-right py-2 px-3 data-cell ${
                    model.collateral.stress.coverage < 1.3 ? "text-warning" : "text-text-primary"
                  }`}
                >
                  {formatMultiple(model.collateral.stress.coverage)}
                </td>
                <td
                  className={`text-right py-2 px-3 data-cell ${
                    model.collateral.market.coverage >= 1.5 ? "text-positive" : "text-text-primary"
                  }`}
                >
                  {formatMultiple(model.collateral.market.coverage)}
                </td>
                <td className="text-right py-2 px-3 data-cell text-positive">
                  {formatMultiple(model.collateral.optimistic.coverage)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-surface-tertiary/50">
          <KPICard
            label={t("term.ltv")}
            value={formatPercent(model.keyMetrics.ltv)}
            sublabel={t("kpi.ltvAtCompletion")}
            threshold={t("dash.kpi.ltvThreshold")}
            tone={model.keyMetrics.ltv <= 0.75 ? "positive" : "warning"}
          />
          <KPICard
            label={t("kpi.assetCoverage")}
            value={formatMultiple(model.keyMetrics.assetCoverage)}
            sublabel={t("kpi.assetCoverageSub")}
            threshold={t("dash.kpi.acThreshold")}
            tone={
              model.keyMetrics.assetCoverage >= 1.5
                ? "positive"
                : model.keyMetrics.assetCoverage >= 1.3
                  ? undefined
                  : "warning"
            }
          />
        </div>
      </div>
      </div>{/* end section-collateral */}
      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={DEBT_COVERAGE_TOUR} />
    </div>
  );
}
