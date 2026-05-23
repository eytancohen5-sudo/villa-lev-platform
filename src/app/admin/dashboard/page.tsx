"use client";

import { useModelStore } from "@/lib/store/modelStore";
import {
  formatCurrency,
  formatPercent,
  formatMultiple,
} from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { PageSkeleton } from "@/components/Skeleton";
import { LiveTrackRecord } from "@/components/LiveTrackRecord";
import {
  SERVICES_PROFIT_MARGIN,
  BP_ANCILLARY_PROFIT_PER_VILLA,
  BP_ANCILLARY_SUITE_TOTAL,
  BP_ANCILLARY_SUITE_ROOMS,
  BP_ANCILLARY_PORTFOLIO_TOTAL,
} from "@/lib/data/currentVillaActuals";
import { useSeasonSnapshot } from "@/lib/data/useSeasonSnapshot";
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
  const { currentSeason, lastCompletedSeason } = useSeasonSnapshot();

  if (!model) return <PageSkeleton variant="grid" />;

  const activeScenarioOutput = model.scenarios[activeScenario];
  const activePnL = activeScenarioOutput.pnl;
  const stab = activeScenarioOutput.stabilisedYear;

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
      : founderBd.capBinding === "earned_33"
        ? t('dash.founder.capEarned33')
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

  const scenarioLabel = activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1);

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
            {showDriftAlert && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 border border-warning-200 px-2 py-0.5 text-[11px] font-medium text-warning-700 ml-2">
                &#9888; ADR/nights drift &gt;10%
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
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
              } catch (err) {
                useModelStore.getState().requestAlert({
                  title: 'Export failed',
                  message: `Could not generate the Excel file: ${(err as Error).message ?? 'Unknown error'}. Try refreshing the page and exporting again.`,
                  tone: 'error',
                });
              }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-secondary text-text-secondary hover:bg-surface-tertiary transition-colors"
            title="Download a fully-linked Excel model with editable formulas"
          >
            ⬇ Download model (.xlsx)
          </button>
        </div>
      </div>

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
        </div>
      </div>

      {/* Three-Scenario Return Table */}
      <div id="section-three-scenario" className="mb-8 mt-6">
        <SectionHeader
          title={t('dash.section.threeScenario')}
          sub={t('dash.threeScenarioSub')}
        />
        <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary bg-surface-secondary/40">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-tertiary uppercase tracking-wide">Scenario</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wide">Equity IRR</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wide">Cash Yield</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-text-tertiary uppercase tracking-wide">Total MOIC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-tertiary/50">
              {[
                { label: "Upside", s: model.scenarios.upside, isBase: false },
                { label: "Base", s: model.scenarios.realistic, isBase: true },
                { label: "Downside", s: model.scenarios.downside, isBase: false },
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
            <a href="/admin/returns" className="text-[11px] font-medium text-brand-700 hover:underline">
              Full returns analysis →
            </a>
          </div>
        </div>
      </div>

      {/* Exit Analysis compact card */}
      <div id="section-exit-analysis" className="mb-8">
        <SectionHeader title="Exit Analysis" sub="Preferred exit path · drill down for full returns" />
        <a
          href="/admin/returns"
          className="block bg-white rounded-xl border border-surface-tertiary hover:border-brand-300 hover:shadow-sm transition-all p-5 group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-xs text-text-tertiary mb-0.5">Preferred Exit</div>
                <div className="text-sm font-medium text-text-primary">
                  {km.propertyExitDominates ? "Property Sale" : "Hotel Sale"}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-tertiary mb-0.5">Exit Value</div>
                <div className="text-sm font-medium text-text-primary tabular-nums">
                  {formatCurrency(km.propertyExitDominates ? km.terminalAssetValuePropertySale : km.terminalAssetValue, true, locale)}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-tertiary mb-0.5">Net to Equity</div>
                <div className="text-sm font-medium text-text-primary tabular-nums">
                  {formatCurrency(km.propertyExitDominates ? km.terminalEquityValuePropertySale : km.terminalEquityValue, true, locale)}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-tertiary mb-0.5">Exit IRR</div>
                <div className={`text-sm font-semibold tabular-nums ${(km.propertyExitDominates ? km.equityIRRPropertySale : km.equityIRR) >= 0.20 ? "text-positive" : "text-text-primary"}`}>
                  {formatPercent(km.propertyExitDominates ? km.equityIRRPropertySale : km.equityIRR)}
                </div>
              </div>
            </div>
            <span className="text-text-tertiary group-hover:text-brand-700 transition-colors text-sm">→</span>
          </div>
          <div className="mt-3 text-[11px] text-text-tertiary group-hover:text-brand-600">
            Full returns analysis — both exit paths, scenario grid, IRR waterfall
          </div>
        </a>
      </div>



      {/* Section — Conservatism Check.
          Restructure 2026-05-22: LiveTrackRecord was lifted out of this
          section and placed directly under the Term Sheet strip (banker-
          proof lede). What stays here is the per-villa BP-vs-live comparison
          table — the audit detail that proves the conservatism story. */}
      <div id="section-conservatism" className="scroll-mt-24 mb-6 mt-6">
        <SectionHeader
          title="Stress & Margin Analysis"
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
            <a href="/admin/sensitivity" className="text-[11px] font-medium text-brand-700 hover:underline">
              Sensitivity detail →
            </a>
          </div>
        </div>
      </div>

      {/* Founder waterfall compact card */}
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

      {/* Sections 4-9 moved to /admin/debt-coverage and /admin/financing */}

    </div>
  );
}
