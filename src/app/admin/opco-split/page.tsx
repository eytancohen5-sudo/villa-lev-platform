"use client";

import { useModelStore } from "@/lib/store/modelStore";
import {
  formatCurrency,
  formatPercent,
  formatMultiple,
} from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { Locale } from "@/lib/i18n/types";
import { PageSkeleton } from "@/components/Skeleton";
import { PageTour, TourButton, usePageTour } from "@/components/PageTour";
import { OPCO_SPLIT_TOUR } from "@/lib/tours/configs";
import type { ModelAssumptions, ModelOutput, ScenarioOutput } from "@/lib/engine/types";
import {
  DEFAULT_GRANT_AMOUNT,
  DEFAULT_GRANT_PROCUREMENT_FEE_PCT,
} from "@/lib/engine/founderWaterfall";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function StatusChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${
        ok ? "bg-positive/15 text-positive" : "bg-warning/15 text-warning"
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
  tone,
  accent = false,
  chip,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "positive" | "warning" | "neutral";
  accent?: boolean;
  chip?: { label: string; ok: boolean };
}) {
  const valueColor =
    tone === "positive"
      ? "text-positive"
      : tone === "warning"
        ? "text-warning"
        : "text-text-primary";
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
      <div className={`kpi-value ${valueColor}`}>{value}</div>
      {sublabel && <div className="text-xs text-text-tertiary mt-1">{sublabel}</div>}
    </div>
  );
}

function RateInput({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block rounded-xl border border-surface-tertiary bg-white p-4">
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        {label}
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <input
          type="number"
          step="0.5"
          min={0}
          max={100}
          value={Number((value * 100).toFixed(2))}
          onChange={(e) => {
            const pct = parseFloat(e.target.value);
            if (!Number.isFinite(pct)) return;
            onChange(Math.max(0, Math.min(100, pct)) / 100);
          }}
          className="w-24 text-3xl font-display tabular-nums bg-transparent focus:outline-none border-b border-surface-tertiary focus:border-brand-500"
        />
        <span className="text-lg text-text-secondary">%</span>
      </div>
      <div className="text-[11px] text-text-tertiary mt-1">{sub}</div>
    </label>
  );
}

export default function OpCoSplitPage() {
  const { locale, t } = useTranslation();
  const { model, assumptions, activeScenario, setAssumption } = useModelStore();
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(OPCO_SPLIT_TOUR.storageKey);

  if (!model) return <PageSkeleton variant="grid" />;

  const opCo = assumptions.opCoFee;
  const opCoOn = !!opCo?.enabled;

  const scenario = model.scenarios[activeScenario];
  const stab = scenario.stabilisedYear;
  const equityRequired = model.keyMetrics.equityRequired;

  const stabRevenue = stab?.totalRevenue ?? 0;
  const stabRoomRevenue =
    stab?.propertyBreakdown.reduce((s, p) => s + p.totalRevenue, 0) ?? 0;
  const stabEbitdaPreFee = stab?.ebitdaPreOpCo ?? 0;
  const stabEbitdaPostFee = stab?.ebitda ?? 0;
  const priorityReturn = equityRequired * (opCo?.ownerPriorityReturnRate ?? 0);

  const opCoStabilisedFee = scenario.opCoStabilisedFee;
  const equityIRR = scenario.equityIRR;
  const equityIRRPreOpCo = scenario.equityIRRPreOpCo;
  const irrCost = equityIRRPreOpCo - equityIRR;

  const scenarioLabel =
    activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-text-primary">
            OpCo / PropCo Split
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {scenarioLabel} &middot; Compare an owner-only structure to one where a
            separate management company (OpCo) operates the assets and the asset
            owner (PropCo) holds the real estate.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TourButton onClick={() => setTourOpen(true)} pulsing={!!neverSeen} />
          <button
            type="button"
            onClick={() => setAssumption("opCoFee.enabled", !opCoOn, "OpCo split")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              opCoOn
                ? "bg-positive/15 text-positive border-positive/30"
                : "bg-surface-secondary text-text-secondary border-surface-tertiary hover:bg-surface-tertiary"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${opCoOn ? "bg-positive" : "bg-text-tertiary"}`} />
            {opCoOn ? t('opco.splitOn') : t('opco.splitOff')}
          </button>
        </div>
      </div>

      {/* Explainer */}
      <div className="rounded-xl border border-surface-tertiary bg-surface-secondary/40 p-4 mb-6 text-sm text-text-secondary leading-relaxed">
        <p className="mb-2">
          <strong className="text-text-primary">How the split works.</strong>{" "}
          When enabled, OpCo earns two fee streams against the portfolio:
          Bucket 2A — a base management fee (5% of gross revenue), and
          Bucket 2B — an incentive fee on the GOP that exceeds the
          owner&apos;s priority return on invested equity.
        </p>
        <p className="mb-0">
          <strong className="text-text-primary">All metrics below are PropCo&apos;s</strong> —
          DSCR, NCF, equity IRR all reflect the cash flow that survives to the
          asset owner after OpCo fees are paid. The <em>IRR cost of split</em> card
          quantifies how much equity return moves from PropCo to OpCo.
        </p>
      </div>

      {/* Entity diagram */}
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary mb-3 px-1">
        {t('opco.entityStructure')}
      </h2>
      <EntityDiagram
        propCoLoan={model.keyMetrics.loanAmount}
        propCoEquity={model.keyMetrics.equityRequired}
        propCoCapex={model.keyMetrics.totalCapex}
        totalPlots={assumptions.portfolio.reduce((s, p) => s + p.count, 0)}
        locale={locale}
      />

      {/* Expanded fee streams */}
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary mt-8 mb-3 px-1">
        {t('opco.feeStreams')}
      </h2>
      <FeeStreamsTable
        assumptions={assumptions}
        stab={stab}
        opCoStabilisedFee={opCoStabilisedFee}
        scenario={scenario}
        locale={locale}
      />

      {/* Total founder compensation KPI */}
      <FounderCompKPI
        assumptions={assumptions}
        scenario={scenario}
        opCoStabilisedFee={opCoStabilisedFee}
        locale={locale}
      />

      {/* Waterfall mechanics */}
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary mt-8 mb-3 px-1">
        {t('opco.waterfallMechanics')}
      </h2>
      <WaterfallMechanicsBox />

      {/* Cap structure block — moved up from previous design */}
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary mt-8 mb-3 px-1">
        {t('opco.capStructure')}
      </h2>
      <CapStructureSummary
        assumptions={assumptions}
        keyMetrics={model.keyMetrics}
        locale={locale}
      />

      {/* Fee rates */}
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary mb-3 px-1">
        {t('opco.feeStructure')}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <RateInput
          label="Base management fee (Bucket 2A)"
          sub="5% of gross revenue"
          value={opCo.baseMgmtFeeRate}
          onChange={(v) => setAssumption("opCoFee.baseMgmtFeeRate", v, "OpCo base management fee")}
        />
        <RateInput
          label="Incentive fee (Bucket 2B)"
          sub="% of GOP above 8% hurdle"
          value={opCo.incentiveFeeRate}
          onChange={(v) => setAssumption("opCoFee.incentiveFeeRate", v, "OpCo incentive fee")}
        />
        <RateInput
          label="Owner priority return"
          sub="% of initial equity"
          value={opCo.ownerPriorityReturnRate}
          onChange={(v) =>
            setAssumption(
              "opCoFee.ownerPriorityReturnRate",
              v,
              "Owner priority return"
            )
          }
        />
      </div>

      {!opCoOn && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 mb-6 text-sm text-text-secondary">
          The split is currently OFF. All other pages (Dashboard, P&amp;L, Scenarios)
          show <strong>owner-only</strong> numbers. Toggle on above to apply the
          OpCo fee waterfall and see the impact on PropCo&apos;s return.
        </div>
      )}

      {/* PropCo headline KPIs (always shown — when OFF, PropCo == full owner) */}
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary mb-3 px-1">
        {t('opco.stabilisedOutcome')}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <KPICard
          label="OpCo fee — stabilised"
          value={opCoOn ? formatCurrency(opCoStabilisedFee, true, locale) : "—"}
          sublabel={
            opCoOn
              ? `${formatPercent(opCoStabilisedFee / (stabRevenue || 1))} of revenue`
              : "Toggle split ON"
          }
          tone={opCoOn ? "warning" : undefined}
        />
        <KPICard
          label="PropCo EBITDA"
          value={formatCurrency(stabEbitdaPostFee, true, locale)}
          sublabel={
            opCoOn
              ? `vs ${formatCurrency(stabEbitdaPreFee, true, locale)} pre-split`
              : `${formatPercent(stab?.ebitdaMargin ?? 0)} margin`
          }
          accent={opCoOn}
        />
        <KPICard
          label="PropCo equity IRR"
          value={equityIRR > 0 ? formatPercent(equityIRR) : "—"}
          sublabel="Levered, with terminal value"
          tone={
            equityIRR >= 0.15 ? "positive" : equityIRR > 0 ? undefined : "warning"
          }
        />
        <KPICard
          label="IRR cost of split"
          value={
            !opCoOn
              ? "—"
              : irrCost > 0.0005
                ? `−${formatPercent(irrCost)}`
                : irrCost < -0.0005
                  ? `+${formatPercent(-irrCost)}`
                  : "0%"
          }
          sublabel={
            opCoOn
              ? `Pre-split: ${formatPercent(equityIRRPreOpCo)}`
              : "Owner takes 100% of GOP"
          }
          tone={
            !opCoOn
              ? undefined
              : irrCost <= 0.03
                ? "positive"
                : irrCost <= 0.06
                  ? undefined
                  : "warning"
          }
        />
      </div>

      {/* Side-by-side comparison */}
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary mb-3 px-1">
        Owner-only vs. PropCo / OpCo — stabilised 2031
      </h2>
      <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-secondary/40">
              <th className="text-left py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                Metric
              </th>
              <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                Owner-only (pre-split)
              </th>
              <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                PropCo (post OpCo fees)
              </th>
              <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                Delta
              </th>
            </tr>
          </thead>
          <tbody className="font-mono">
            <ComparisonRow
              label="Total revenue (stabilised)"
              left={stabRevenue}
              right={stabRevenue}
              format="currency"
              locale={locale}
            />
            <ComparisonRow
              label="EBITDA"
              left={stabEbitdaPreFee}
              right={stabEbitdaPostFee}
              format="currency"
              locale={locale}
            />
            <ComparisonRow
              label="EBITDA margin"
              left={stabRevenue > 0 ? stabEbitdaPreFee / stabRevenue : 0}
              right={stabRevenue > 0 ? stabEbitdaPostFee / stabRevenue : 0}
              format="percent"
              locale={locale}
            />
            <ComparisonRow
              label="Stabilised DSCR"
              left={
                stabRevenue > 0 && model.keyMetrics.annualDS > 0
                  ? stabEbitdaPreFee / model.keyMetrics.annualDS
                  : 0
              }
              right={stab?.dscr ?? 0}
              format="multiple"
              locale={locale}
              good="higher"
              threshold={1.25}
            />
            <ComparisonRow
              label="Equity IRR"
              left={equityIRRPreOpCo}
              right={equityIRR}
              format="percent"
              locale={locale}
              good="higher"
              threshold={0.15}
            />
          </tbody>
        </table>
      </div>

      {/* Fee waterfall — stabilised year */}
      {opCoOn && stab && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary mb-3 px-1">
            Stabilised 2031 fee waterfall
          </h2>
          <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-hidden mb-8">
            <table className="w-full text-sm font-mono">
              <tbody>
                <WaterfallRow
                  label="Total revenue"
                  value={stabRevenue}
                  locale={locale}
                />
                <WaterfallRow
                  label="EBITDA (= GOP) before OpCo fees"
                  value={stabEbitdaPreFee}
                  locale={locale}
                  bold
                />
                <WaterfallRow
                  label={`Base management fee — Bucket 2A (${formatPercent(opCo.baseMgmtFeeRate)} × gross revenue)`}
                  value={-stab.opCoBaseFee}
                  locale={locale}
                  tone="negative"
                />
                <WaterfallRow
                  label={`Owner priority return (${formatPercent(opCo.ownerPriorityReturnRate)} × €${(equityRequired / 1000).toFixed(0)}K equity)`}
                  value={priorityReturn}
                  locale={locale}
                  ghost
                />
                <WaterfallRow
                  label={`Incentive fee (${formatPercent(opCo.incentiveFeeRate)} × GOP above hurdle)`}
                  value={-stab.opCoIncentiveFee}
                  locale={locale}
                  tone="negative"
                />
                <WaterfallRow
                  label="OpCo earns"
                  value={stab.opCoTotalFee}
                  locale={locale}
                  bold
                  tone="warning"
                />
                <WaterfallRow
                  label="PropCo retains (EBITDA)"
                  value={stabEbitdaPostFee}
                  locale={locale}
                  bold
                  tone="positive"
                />
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Year-by-year fee table */}
      {opCoOn && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary mb-3 px-1">
            OpCo fees by year ({scenarioLabel})
          </h2>
          <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="bg-surface-secondary/40">
                    <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium sticky left-0 bg-surface-secondary/40">
                      Item
                    </th>
                    {scenario.pnl.map((p) => (
                      <th
                        key={p.year}
                        className="text-right py-2.5 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium min-w-[80px]"
                      >
                        {p.year}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <YearRow
                    label="Base management fee (Bucket 2A)"
                    pnl={scenario.pnl}
                    pick={(p) => p.opCoBaseFee}
                    locale={locale}
                  />
                  <YearRow
                    label="Incentive fee"
                    pnl={scenario.pnl}
                    pick={(p) => p.opCoIncentiveFee}
                    locale={locale}
                  />
                  <YearRow
                    label="OpCo total"
                    pnl={scenario.pnl}
                    pick={(p) => p.opCoTotalFee}
                    locale={locale}
                    bold
                  />
                  <YearRow
                    label="EBITDA pre-fees"
                    pnl={scenario.pnl}
                    pick={(p) => p.ebitdaPreOpCo}
                    locale={locale}
                  />
                  <YearRow
                    label="PropCo EBITDA"
                    pnl={scenario.pnl}
                    pick={(p) => p.ebitda}
                    locale={locale}
                    bold
                  />
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-surface-tertiary p-5 shadow-sm mb-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-4">
              OpCo fee composition by year ({scenarioLabel})
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={scenario.pnl.map((p) => ({
                  year: p.year,
                  BaseMgmt: p.opCoBaseFee,
                  Incentive: p.opCoIncentiveFee,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), false, locale)}
                  contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="BaseMgmt" stackId="opco" name="Base management fee (Bucket 2A)" fill="#C4A55E" />
                <Bar dataKey="Incentive" stackId="opco" name="Incentive fee (Bucket 2B)" fill="#6B7A3D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-xs text-text-tertiary">
            Tip: change the financing path or scenario from the top bar to see how
            the same fee schedule plays out under different revenue assumptions.
            Use ROIC and DSCR delta on the Dashboard to judge whether bank
            covenants still pass after the split.
          </div>
        </>
      )}

      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={OPCO_SPLIT_TOUR} />
    </div>
  );
}

function ComparisonRow({
  label,
  left,
  right,
  format,
  locale,
  good,
  threshold,
}: {
  label: string;
  left: number;
  right: number;
  format: "currency" | "percent" | "multiple";
  locale: Locale;
  good?: "higher" | "lower";
  threshold?: number;
}) {
  const fmt = (v: number) =>
    format === "currency"
      ? formatCurrency(v, true, locale)
      : format === "percent"
        ? formatPercent(v)
        : formatMultiple(v);

  const delta = right - left;
  const deltaSign = delta > 0 ? "+" : "";
  const deltaDisplay =
    Math.abs(delta) < 1e-6
      ? "—"
      : format === "currency"
        ? `${deltaSign}${formatCurrency(delta, true, locale)}`
        : format === "percent"
          ? `${deltaSign}${formatPercent(delta)}`
          : `${deltaSign}${formatMultiple(delta)}`;

  const deltaIsBad =
    good && Math.abs(delta) > 1e-6
      ? (good === "higher" && delta < 0) || (good === "lower" && delta > 0)
      : false;
  const deltaColor =
    Math.abs(delta) < 1e-6
      ? "text-text-tertiary"
      : deltaIsBad
        ? "text-warning"
        : "text-positive";

  const rightTone =
    threshold !== undefined && format === "multiple"
      ? right >= threshold
        ? "text-positive"
        : "text-warning"
      : "";

  return (
    <tr className="border-t border-surface-secondary/40">
      <td className="py-2.5 px-5 text-text-secondary font-sans">{label}</td>
      <td className="text-right py-2.5 px-5">{fmt(left)}</td>
      <td className={`text-right py-2.5 px-5 ${rightTone}`}>{fmt(right)}</td>
      <td className={`text-right py-2.5 px-5 ${deltaColor}`}>{deltaDisplay}</td>
    </tr>
  );
}

function WaterfallRow({
  label,
  value,
  locale,
  bold,
  indent,
  tone,
  ghost,
}: {
  label: string;
  value: number;
  locale: Locale;
  bold?: boolean;
  indent?: boolean;
  tone?: "negative" | "positive" | "warning";
  ghost?: boolean;
}) {
  const valueColor =
    tone === "negative"
      ? "text-negative"
      : tone === "positive"
        ? "text-positive"
        : tone === "warning"
          ? "text-warning"
          : "text-text-primary";
  return (
    <tr
      className={`border-t border-surface-secondary/40 ${bold ? "bg-surface-secondary/30 font-semibold" : ""} ${ghost ? "opacity-60" : ""}`}
    >
      <td
        className={`py-2.5 px-5 ${indent ? "pl-10" : ""} ${bold ? "text-text-primary" : "text-text-secondary"} font-sans`}
      >
        {label}
      </td>
      <td className={`text-right py-2.5 px-5 ${valueColor}`}>
        {value === 0 ? "—" : formatCurrency(value, true, locale)}
      </td>
    </tr>
  );
}

interface AnnualPnLForRow {
  year: number;
  opCoBaseFee: number;
  opCoBrandFee: number;
  opCoIncentiveFee: number;
  opCoTotalFee: number;
  ebitdaPreOpCo: number;
  ebitda: number;
}

function YearRow({
  label,
  pnl,
  pick,
  locale,
  bold,
}: {
  label: string;
  pnl: AnnualPnLForRow[];
  pick: (p: AnnualPnLForRow) => number;
  locale: Locale;
  bold?: boolean;
}) {
  return (
    <tr
      className={`border-t border-surface-secondary/40 ${bold ? "bg-surface-secondary/30 font-semibold" : ""}`}
    >
      <td
        className={`py-2 px-4 sticky left-0 ${bold ? "bg-surface-secondary/30 text-text-primary" : "bg-white text-text-secondary"} font-sans`}
      >
        {label}
      </td>
      {pnl.map((p) => {
        const v = pick(p);
        return (
          <td key={p.year} className="text-right py-2 px-3">
            {v === 0 ? "—" : formatCurrency(v, true, locale)}
          </td>
        );
      })}
    </tr>
  );
}

// ── New visualization components (Feature 2 refresh) ──────────────────

function EntityDiagram({
  propCoLoan,
  propCoEquity,
  propCoCapex,
  totalPlots,
  locale,
}: {
  propCoLoan: number;
  propCoEquity: number;
  propCoCapex: number;
  totalPlots: number;
  locale: Locale;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="rounded-xl border-2 border-brand-200 bg-brand-50 p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-brand-700 mb-1">PropCo (Greek SPV)</div>
        <div className="font-display text-base mb-2">Holds real estate</div>
        <div className="text-xs space-y-1">
          <div><span className="text-text-tertiary">Owns:</span> {totalPlots} {totalPlots === 1 ? "plot" : "plots"} + buildings + FF&amp;E</div>
          <div><span className="text-text-tertiary">CapEx:</span> {formatCurrency(propCoCapex, true, locale)}</div>
          <div><span className="text-text-tertiary">Owes bank:</span> {formatCurrency(propCoLoan, true, locale)}</div>
          <div><span className="text-text-tertiary">Equity:</span> {formatCurrency(propCoEquity, true, locale)}</div>
          <div className="text-text-tertiary pt-1 border-t border-brand-200/60">
            Receives: NCF · grant (if approved) · equity contributions
          </div>
        </div>
      </div>
      <div className="rounded-xl border-2 border-positive/30 bg-positive/5 p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-positive mb-1">OpCo / ManCo</div>
        <div className="font-display text-base mb-2">Villa Lev Group</div>
        <div className="text-xs space-y-1">
          <div><span className="text-text-tertiary">Owns:</span> Brand IP + operational know-how</div>
          <div><span className="text-text-tertiary">Provides:</span> Mgmt services · brand · dev supervision</div>
          <div className="text-text-tertiary pt-1 border-t border-positive/20">
            Receives: 4 fee buckets from PropCo (see below)
          </div>
        </div>
      </div>
      <div className="rounded-xl border-2 border-surface-tertiary bg-white p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">Investors</div>
        <div className="font-display text-base mb-2">Cap-table holders</div>
        <div className="text-xs space-y-1">
          <div><span className="text-text-tertiary">Hold:</span> Equity claims on PropCo</div>
          <div className="text-text-tertiary pt-1 border-t border-surface-tertiary">
            Receive: distributions per 3-layer waterfall (pari-passu · dev equity · ratchet)
          </div>
        </div>
      </div>
      <div className="rounded-xl border-2 border-warning/30 bg-warning/5 p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-warning mb-1">Bank</div>
        <div className="font-display text-base mb-2">Senior secured lender</div>
        <div className="text-xs space-y-1">
          <div><span className="text-text-tertiary">Holds:</span> Senior debt on PropCo</div>
          <div><span className="text-text-tertiary">Receives:</span> Annual debt service + residual principal at exit</div>
        </div>
      </div>
    </div>
  );
}

function FeeStreamsTable({
  assumptions,
  stab,
  opCoStabilisedFee,
  locale,
}: {
  assumptions: ModelAssumptions;
  stab: ScenarioOutput["stabilisedYear"];
  opCoStabilisedFee: number;
  scenario: ScenarioOutput;
  locale: Locale;
}) {
  const isGrant = assumptions.financingPath === "grant";
  // Bucket 1B — Grant advisory fee: 10% of grant (DEFAULT_GRANT_AMOUNT used by engine)
  const grantAmount = isGrant ? DEFAULT_GRANT_AMOUNT : 0;
  const grantAdvisoryGross = grantAmount * DEFAULT_GRANT_PROCUREMENT_FEE_PCT; // 10%
  const grantAdvisoryCash = grantAdvisoryGross * 0.5; // 50% cash deferred to PropCo
  // Bucket 2A — Base management fee at stabilisation
  const baseMgmtFee = stab ? stab.totalRevenue * 0.05 : 0;
  // Bucket 2B — Incentive fee at stabilisation
  const incentiveFee = opCoStabilisedFee;

  return (
    <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-secondary/40">
            <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">Fee</th>
            <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">Rate</th>
            <th className="text-right py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">Amount</th>
            <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">When</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {/* Bucket 1A */}
          <tr className="border-t border-surface-secondary/40">
            <td className="py-2.5 px-4 font-medium">
              Bucket 1A — Developer equity
              <div className="text-[11px] text-text-tertiary font-normal mt-0.5">Sourcing · construction mgmt · €2.5M bank collateral</div>
            </td>
            <td className="py-2 px-4 text-xs text-text-tertiary">25% promote (equity)</td>
            <td className="py-2 px-4 text-right font-mono text-text-tertiary">— (equity only)</td>
            <td className="py-2 px-4 text-xs text-text-tertiary">Inception · no PropCo cash outflow</td>
          </tr>
          {/* Bucket 1B */}
          <tr className={`border-t border-surface-secondary/40 ${isGrant ? "" : "opacity-40"}`}>
            <td className="py-2.5 px-4 font-medium">
              Bucket 1B — Grant advisory fee
              <div className="text-[11px] text-text-tertiary font-normal mt-0.5">
                {isGrant
                  ? `50% cash (${formatCurrency(grantAdvisoryCash, true, locale)} deferred 3 yr) + 50% equity → Layer B`
                  : "Active on Grant path only"}
              </div>
            </td>
            <td className="py-2 px-4 text-xs text-text-tertiary">10% of grant · 50% cash / 50% equity</td>
            <td className="py-2 px-4 text-right font-mono">
              {isGrant ? formatCurrency(grantAdvisoryCash, true, locale) : "—"}
            </td>
            <td className="py-2 px-4 text-xs text-text-tertiary">At grant approval · cash spread over 3 yr</td>
          </tr>
          {/* Bucket 2A */}
          <tr className="border-t border-surface-secondary/40">
            <td className="py-2.5 px-4 font-medium">
              Bucket 2A — Base management fee
              <div className="text-[11px] text-text-tertiary font-normal mt-0.5">Brand + operational management combined</div>
            </td>
            <td className="py-2 px-4 text-xs text-text-tertiary">5% of gross revenue</td>
            <td className="py-2 px-4 text-right font-mono">
              {baseMgmtFee > 0 ? <>{formatCurrency(baseMgmtFee, true, locale)}/yr</> : "—"}
            </td>
            <td className="py-2 px-4 text-xs text-text-tertiary">Annual · 2028 → exit</td>
          </tr>
          {/* Bucket 2B */}
          <tr className="border-t border-surface-secondary/40">
            <td className="py-2.5 px-4 font-medium">
              Bucket 2B — Incentive fee
              <div className="text-[11px] text-text-tertiary font-normal mt-0.5">OpCo share of GOP above owner priority return</div>
            </td>
            <td className="py-2 px-4 text-xs text-text-tertiary">% of NCF above 8% hurdle</td>
            <td className="py-2 px-4 text-right font-mono">
              {incentiveFee > 0 ? <>{formatCurrency(incentiveFee, true, locale)}/yr</> : "—"}
            </td>
            <td className="py-2 px-4 text-xs text-text-tertiary">Annual · 2028 → exit</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function FounderCompKPI({
  assumptions,
  scenario,
  opCoStabilisedFee,
  locale,
}: {
  assumptions: ModelAssumptions;
  scenario: ScenarioOutput;
  opCoStabilisedFee: number;
  locale: Locale;
}) {
  const isGrant = assumptions.financingPath === "grant";
  // Bucket 1B — cash advisory fee (50% of 10% of grant)
  const grantAdvisoryCash = isGrant
    ? DEFAULT_GRANT_AMOUNT * DEFAULT_GRANT_PROCUREMENT_FEE_PCT * 0.5
    : 0;
  const exitYear = scenario.exitYear ?? 2036;
  const operatingYears = Math.max(0, exitYear - 2028 + 1);
  const stab = scenario.stabilisedYear;
  // Bucket 2A — base management fee × operating years
  const baseMgmtAnnual = stab ? stab.totalRevenue * 0.05 : 0;
  // Bucket 2B — incentive fee × operating years
  const totalFounderComp =
    grantAdvisoryCash +
    baseMgmtAnnual * operatingYears +
    opCoStabilisedFee * operatingYears;

  const parts = [
    isGrant ? `Bucket 1B advisory €${Math.round(grantAdvisoryCash / 1000)}K` : null,
    `Bucket 2A base mgmt × ${operatingYears}yr`,
    `Bucket 2B incentive × ${operatingYears}yr`,
  ].filter(Boolean).join(" + ");

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 mt-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-brand-700">
            Total OpCo fee income, 2026 → exit
          </div>
          <div className="font-display text-2xl text-brand-700 mt-1">
            {formatCurrency(totalFounderComp, true, locale)}
          </div>
        </div>
        <div className="text-xs text-text-tertiary text-right max-w-md">
          {parts}. Approximate — uses stabilised rates × duration.
          Excludes Bucket 1A developer equity (equity value, not cash fee).
        </div>
      </div>
    </div>
  );
}

function WaterfallMechanicsBox() {
  const steps = [
    { i: 1, label: "Bank gets paid", detail: "Annual debt service — interest + amortisation — senior and first" },
    { i: 2, label: "OpCo fees deducted (Buckets 2A + 2B)", detail: "Base management fee + incentive fee subtracted from NCF before splitting" },
    { i: 3, label: "Bucket 1B advisory fee (Grant path only)", detail: "Deferred cash advisory fee spread over 3 years post-disbursement" },
    { i: 4, label: "Tax paid", detail: "Corporate income tax on taxable income" },
    { i: 5, label: "Founder takes Layer A + B + C (operating)", detail: "Pari-passu cash share + 25% developer equity promote + grant bonus + performance ratchet" },
    { i: 6, label: "Investors split the remainder", detail: "Pro-rata to their cash invested — same IRR for all non-founder equity" },
    { i: 7, label: "At exit — Layer C excluded", detail: "Sale / terminal proceeds split on pari-passu + dev equity + grant bonus only; ratchet does not apply to exit" },
  ];
  return (
    <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-hidden">
      <ol className="divide-y divide-surface-secondary/40">
        {steps.map((s) => (
          <li key={s.i} className="px-4 py-3 flex items-start gap-3">
            <span className="font-display text-lg text-brand-700 w-6 text-center flex-shrink-0">{s.i}</span>
            <div>
              <div className="font-medium text-sm">{s.label}</div>
              <div className="text-xs text-text-tertiary mt-0.5">{s.detail}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CapStructureSummary({
  assumptions,
  keyMetrics,
  locale,
}: {
  assumptions: ModelAssumptions;
  keyMetrics: ModelOutput["keyMetrics"];
  locale: Locale;
}) {
  const grantRate = assumptions.grant?.grantRate ?? 0;
  const isGrant = assumptions.financingPath === "grant";
  const grantAmount = isGrant ? keyMetrics.totalCapex * grantRate : 0;
  const totalPlots = assumptions.portfolio.reduce((s, p) => s + p.count, 0);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <div className="rounded-xl border border-surface-tertiary bg-white p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Founder promoter equity</div>
        <div className="font-display text-2xl mt-1">25%</div>
        <div className="text-xs text-text-tertiary mt-1">Eytan's free carry — no cash required</div>
      </div>
      <div className="rounded-xl border border-surface-tertiary bg-white p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Co-invest (pari-passu)</div>
        <div className="font-display text-2xl mt-1">{formatCurrency(200000, true, locale)}</div>
        <div className="text-xs text-text-tertiary mt-1">Eytan's cash — pari-passu with investors until exit</div>
      </div>
      <div className="rounded-xl border border-surface-tertiary bg-white p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Other investors (pari-passu)</div>
        <div className="font-display text-2xl mt-1">{formatCurrency(Math.max(0, keyMetrics.equityRequired - 200000), true, locale)}</div>
        <div className="text-xs text-text-tertiary mt-1">8% pref · 70/30 above</div>
      </div>
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-warning">Bank loan</div>
        <div className="font-display text-2xl mt-1">{formatCurrency(keyMetrics.loanAmount, true, locale)}</div>
        <div className="text-xs text-text-tertiary mt-1">@ {formatPercent(assumptions.commercialLoan.interestRate)} · {assumptions.commercialLoan.repaymentTermYears}y amort post-grace</div>
      </div>
      <div className="rounded-xl border border-positive/30 bg-positive/5 p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-positive">Grant</div>
        <div className="font-display text-2xl mt-1">
          {isGrant ? formatCurrency(grantAmount, true, locale) : "—"}
        </div>
        <div className="text-xs text-text-tertiary mt-1">
          {isGrant ? `${formatPercent(grantRate)} of eligible CapEx` : "Not in current path"}
        </div>
      </div>
      <div className="rounded-xl border border-surface-tertiary bg-white p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Total CapEx</div>
        <div className="font-display text-2xl mt-1">{formatCurrency(keyMetrics.totalCapex, true, locale)}</div>
        <div className="text-xs text-text-tertiary mt-1">{totalPlots} {totalPlots === 1 ? "plot" : "plots"} + construction + FF&amp;E + soft costs</div>
      </div>
    </div>
  );
}
