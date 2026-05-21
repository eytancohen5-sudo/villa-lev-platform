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
import type { ModelAssumptions, ModelOutput, ScenarioOutput } from "@/lib/engine/types";
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

      {/* Explainer */}
      <div className="rounded-xl border border-surface-tertiary bg-surface-secondary/40 p-4 mb-6 text-sm text-text-secondary leading-relaxed">
        <p className="mb-2">
          <strong className="text-text-primary">How the split works.</strong>{" "}
          When enabled, OpCo earns three layers of fees against the portfolio:
          a base management fee on total revenue, a brand / marketing fee on
          room revenue, and an incentive fee on the GOP that exceeds the
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <RateInput
          label="Base fee"
          sub="% of total revenue"
          value={opCo.baseFeeRate}
          onChange={(v) => setAssumption("opCoFee.baseFeeRate", v, "OpCo base fee")}
        />
        <RateInput
          label="Brand / marketing fee"
          sub="% of room revenue"
          value={opCo.brandFeeRate}
          onChange={(v) => setAssumption("opCoFee.brandFeeRate", v, "OpCo brand fee")}
        />
        <RateInput
          label="Incentive fee"
          sub="% of GOP over hurdle"
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
                  label="Room revenue (basis for brand fee)"
                  value={stabRoomRevenue}
                  locale={locale}
                  indent
                />
                <WaterfallRow
                  label="EBITDA (= GOP) before OpCo fees"
                  value={stabEbitdaPreFee}
                  locale={locale}
                  bold
                />
                <WaterfallRow
                  label={`Base fee (${formatPercent(opCo.baseFeeRate)} × total revenue)`}
                  value={-stab.opCoBaseFee}
                  locale={locale}
                  tone="negative"
                />
                <WaterfallRow
                  label={`Brand fee (${formatPercent(opCo.brandFeeRate)} × room revenue)`}
                  value={-stab.opCoBrandFee}
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
                    label="Base fee"
                    pnl={scenario.pnl}
                    pick={(p) => p.opCoBaseFee}
                    locale={locale}
                  />
                  <YearRow
                    label="Brand fee"
                    pnl={scenario.pnl}
                    pick={(p) => p.opCoBrandFee}
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
                  Base: p.opCoBaseFee,
                  Brand: p.opCoBrandFee,
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
                <Bar dataKey="Base" stackId="opco" name="Base fee" fill="#C4A55E" />
                <Bar dataKey="Brand" stackId="opco" name="Brand fee" fill="#8B6914" />
                <Bar dataKey="Incentive" stackId="opco" name="Incentive fee" fill="#6B7A3D" radius={[4, 4, 0, 0]} />
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
            Receives: 6 fee streams from PropCo (see below)
          </div>
        </div>
      </div>
      <div className="rounded-xl border-2 border-surface-tertiary bg-white p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">Investors</div>
        <div className="font-display text-base mb-2">Cap-table holders</div>
        <div className="text-xs space-y-1">
          <div><span className="text-text-tertiary">Hold:</span> Equity claims on PropCo</div>
          <div className="text-text-tertiary pt-1 border-t border-surface-tertiary">
            Receive: distributions per waterfall (8% pref · 70/30 above)
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
  scenario,
  locale,
}: {
  assumptions: ModelAssumptions;
  stab: ScenarioOutput["stabilisedYear"];
  opCoStabilisedFee: number;
  scenario: ScenarioOutput;
  locale: Locale;
}) {
  // Hard costs (construction + FF&E) — proxy for development fee basis.
  const hardCosts = assumptions.portfolio.reduce((sum, p) => {
    const area = (p.constructionArea ?? 0) > 0
      ? p.constructionArea ?? 0
      : 0;
    const construction = area * p.constructionCostPerM2;
    return sum + (construction + p.ffeCost) * p.count;
  }, 0);
  const developmentFee = hardCosts * 0.03;
  const grantAmount = scenario.pnl.length > 0
    ? (Math.max(0, assumptions.grant?.grantRate ?? 0)) * hardCosts
    : 0;
  // Grant success fee = 10% of grant, less 5% to consultant → 5% net to founder
  const grantSuccessFee = grantAmount * 0.05;
  const brandMgmtFee = stab ? (stab.totalRevenue * 0.05) : 0;
  // Incentive — use stabilised opCo total fee as proxy
  const incentiveFee = opCoStabilisedFee;
  // PG fee — 0.75% × €2.5M
  const pgFee = 2500000 * 0.0075;
  // Disposition fee — 1% of sale price (terminal asset value)
  const dispositionFee = scenario.terminalAssetValue * 0.01;

  return (
    <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-secondary/40">
            <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">Fee</th>
            <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">Rate</th>
            <th className="text-right py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">Annual €</th>
            <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">Duration</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          <tr className="border-t border-surface-secondary/40">
            <td className="py-2 px-4">Development fee</td>
            <td className="py-2 px-4 text-xs text-text-tertiary">3% of hard costs</td>
            <td className="py-2 px-4 text-right font-mono">{formatCurrency(developmentFee, true, locale)}</td>
            <td className="py-2 px-4 text-xs text-text-tertiary">One-time (split Y0/Y1, construction)</td>
          </tr>
          <tr className="border-t border-surface-secondary/40">
            <td className="py-2 px-4">Grant success fee</td>
            <td className="py-2 px-4 text-xs text-text-tertiary">10% of grant − 5% consultant = 5% net</td>
            <td className="py-2 px-4 text-right font-mono">{formatCurrency(grantSuccessFee, true, locale)}</td>
            <td className="py-2 px-4 text-xs text-text-tertiary">One-time (at grant approval)</td>
          </tr>
          <tr className="border-t border-surface-secondary/40">
            <td className="py-2 px-4">Brand + management fee</td>
            <td className="py-2 px-4 text-xs text-text-tertiary">5% of gross revenue</td>
            <td className="py-2 px-4 text-right font-mono">{formatCurrency(brandMgmtFee, true, locale)}/yr</td>
            <td className="py-2 px-4 text-xs text-text-tertiary">Years 1–10 of operations</td>
          </tr>
          <tr className="border-t border-surface-secondary/40">
            <td className="py-2 px-4">Incentive management fee</td>
            <td className="py-2 px-4 text-xs text-text-tertiary">10% of NCF above 8% ROE hurdle</td>
            <td className="py-2 px-4 text-right font-mono">{formatCurrency(incentiveFee, true, locale)}/yr</td>
            <td className="py-2 px-4 text-xs text-text-tertiary">Years 1–10</td>
          </tr>
          <tr className="border-t border-surface-secondary/40">
            <td className="py-2 px-4">Personal guarantee fee</td>
            <td className="py-2 px-4 text-xs text-text-tertiary">0.75% × €2.5M PG</td>
            <td className="py-2 px-4 text-right font-mono">{formatCurrency(pgFee, true, locale)}/yr</td>
            <td className="py-2 px-4 text-xs text-text-tertiary">Until DSCR &gt; 1.5× sustained (~2031)</td>
          </tr>
          <tr className="border-t border-surface-secondary/40">
            <td className="py-2 px-4">Disposition fee</td>
            <td className="py-2 px-4 text-xs text-text-tertiary">1% of sale price</td>
            <td className="py-2 px-4 text-right font-mono">{formatCurrency(dispositionFee, true, locale)}</td>
            <td className="py-2 px-4 text-xs text-text-tertiary">One-time (at exit)</td>
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
  // Sum across exit horizon — approximate using stabilised rates × years.
  const hardCosts = assumptions.portfolio.reduce((sum, p) => {
    const area = (p.constructionArea ?? 0) > 0 ? p.constructionArea ?? 0 : 0;
    return sum + (area * p.constructionCostPerM2 + p.ffeCost) * p.count;
  }, 0);
  const developmentFee = hardCosts * 0.03;
  const grantSuccessFee = hardCosts * (assumptions.grant?.grantRate ?? 0) * 0.05;
  const exitYear = scenario.exitYear ?? 2036;
  const operatingYears = Math.max(0, exitYear - 2028 + 1);
  const stab = scenario.stabilisedYear;
  const brandMgmtAnnual = stab ? stab.totalRevenue * 0.05 : 0;
  const pgFee = 2500000 * 0.0075;
  // PG paid until 2031 (3 years post-launch)
  const pgYears = 3;
  const dispositionFee = scenario.terminalAssetValue * 0.01;
  const totalFounderComp =
    developmentFee +
    grantSuccessFee +
    brandMgmtAnnual * operatingYears +
    opCoStabilisedFee * operatingYears +
    pgFee * pgYears +
    dispositionFee;

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 mt-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-brand-700">
            Total founder compensation, 2026 → exit
          </div>
          <div className="font-display text-2xl text-brand-700 mt-1">
            {formatCurrency(totalFounderComp, true, locale)}
          </div>
        </div>
        <div className="text-xs text-text-tertiary text-right max-w-md">
          Development + grant success + brand &amp; management × {operatingYears}y +
          incentive × {operatingYears}y + PG × {pgYears}y + disposition.
          Approximate (uses stabilised rates × duration).
        </div>
      </div>
    </div>
  );
}

function WaterfallMechanicsBox() {
  const steps = [
    { i: 1, label: "Bank gets paid", detail: "Annual debt service first" },
    { i: 2, label: "OpCo fees paid", detail: "Development phase or ongoing operations" },
    { i: 3, label: "Tax paid", detail: "Corporate income tax + VAT" },
    { i: 4, label: "Reserve account funded", detail: "If DSRA required by bank" },
    { i: 5, label: "Founder co-invest returned", detail: "€200K one-time at hotel launch (2028)" },
    { i: 6, label: "8% preferred return", detail: "Pro-rata to pari-passu equity" },
    { i: 7, label: "70% LP / 30% sponsor on excess", detail: "Promote split above pref" },
  ];
  return (
    <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-hidden">
      <ol className="divide-y divide-surface-secondary/40">
        {steps.map((s) => (
          <li key={s.i} className="px-4 py-3 flex items-start gap-3">
            <span className="font-display text-lg text-brand-700 w-6 text-center">{s.i}</span>
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
        <div className="text-xs text-text-tertiary mt-1">Eytan's cash — returned at hotel launch 2028</div>
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
