"use client";

import { useMemo, useState, useId } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { PageSkeleton } from "@/components/Skeleton";
import { computeCapTable } from "@/lib/engine/capTable";

function NumberInput({
  value,
  onCommit,
  step = 1000,
  prefix,
  suffix,
  width = "w-32",
}: {
  value: number;
  onCommit: (next: number) => void;
  step?: number;
  prefix?: string;
  suffix?: string;
  width?: string;
}) {
  // Uncontrolled — `key` reset forces remount when external value changes.
  const id = useId();
  return (
    <div className="inline-flex items-center gap-1">
      {prefix && <span className="text-text-tertiary text-xs" aria-hidden>{prefix}</span>}
      <input
        key={`${id}-${value}`}
        type="number"
        step={step}
        defaultValue={value}
        aria-label={`${prefix ?? ""}${value}${suffix ?? ""}`}
        onBlur={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onCommit(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            (e.target as HTMLInputElement).value = String(value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={`${width} px-2 py-1 text-sm font-mono text-right rounded border border-surface-tertiary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30`}
      />
      {suffix && <span className="text-text-tertiary text-xs" aria-hidden>{suffix}</span>}
    </div>
  );
}

function PercentInputSmall({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (v: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="number"
        step={0.5}
        min={0}
        max={100}
        defaultValue={Number((value * 100).toFixed(2))}
        aria-label={`Percent value, currently ${(value * 100).toFixed(1)}`}
        onBlur={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onCommit(Math.max(0, Math.min(100, v)) / 100);
        }}
        className="w-16 px-2 py-1 text-sm font-mono text-right rounded border border-surface-tertiary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      />
      <span className="text-text-tertiary text-xs" aria-hidden>%</span>
    </div>
  );
}

export default function CapTablePage() {
  const { locale } = useTranslation();
  const {
    model,
    activeScenario,
    capTable,
    waterfall,
    updateStakeholder,
    addStakeholder,
    removeStakeholder,
    setWaterfallParam,
    resetCapTable,
  } = useModelStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [redacted, setRedacted] = useState(false);
  const [redactedTarget, setRedactedTarget] = useState<string | null>(null);

  const result = useMemo(() => {
    if (!model) return null;
    const scenario = model.scenarios[activeScenario];
    return computeCapTable(scenario, capTable, waterfall);
  }, [model, activeScenario, capTable, waterfall]);

  if (!model || !result) return <PageSkeleton variant="grid" />;

  const totalPP = capTable.reduce((s, sh) => s + sh.cashIn, 0);
  const scenarioLabel = activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1);
  const exitYear = model.scenarios[activeScenario].exitYear;
  const exitMultiple = model.scenarios[activeScenario].exitEbitdaMultiple;

  // For redacted view: only show the targeted stakeholder named; others aggregated.
  const aggregateOthers = (targetId: string) => {
    const target = result.stakeholders.find((s) => s.stakeholder.id === targetId);
    const others = result.stakeholders.filter((s) => s.stakeholder.id !== targetId);
    const aggCashIn = others.reduce((s, o) => s + o.stakeholder.cashIn, 0);
    const aggReceived = others.reduce((s, o) => s + o.totalReceived, 0);
    return { target, others, aggCashIn, aggReceived };
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-text-primary">Cap Table</h1>
          <p className="text-sm text-text-secondary mt-1">
            {scenarioLabel} &middot; Exit {exitYear} @ {formatMultiple(exitMultiple)} &middot;
            Per-stakeholder cash flows, IRR, MOIC, equity payback
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setRedacted(!redacted);
              if (!redacted && capTable.length > 0) setRedactedTarget(capTable[0].id);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              redacted
                ? "bg-warning/15 text-warning border-warning/30"
                : "bg-surface-secondary text-text-secondary border-surface-tertiary hover:bg-surface-tertiary"
            }`}
            title="Show only the named investor's row; aggregate the others"
          >
            {redacted ? "Redacted view ON" : "Generate investor report"}
          </button>
          <button
            type="button"
            onClick={resetCapTable}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-secondary text-text-secondary border border-surface-tertiary hover:bg-surface-tertiary"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Reconciliation health */}
      <div className="rounded-xl border border-surface-tertiary bg-surface-secondary/40 p-3 mb-6 text-xs font-mono">
        <span className="text-text-tertiary mr-3">Reconciliation:</span>
        Project distributable {formatCurrency(result.totalProjectDistributable, true, locale)} ·
        Stakeholder distributions {formatCurrency(result.totalDistributed, true, locale)} ·
        <span className={Math.abs(result.reconciliationError) < 1 ? "text-positive ml-1" : "text-warning ml-1"}>
          diff {formatCurrency(result.reconciliationError, true, locale)}
        </span>
      </div>

      {/* Redacted target picker */}
      {redacted && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 mb-6 text-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-text-secondary">Show full detail for:</span>
            <select
              value={redactedTarget ?? ""}
              onChange={(e) => setRedactedTarget(e.target.value)}
              className="px-3 py-1.5 rounded border border-surface-tertiary bg-white text-sm"
            >
              {capTable.map((sh) => (
                <option key={sh.id} value={sh.id}>{sh.name}</option>
              ))}
            </select>
            <span className="text-xs text-text-tertiary">
              Other stakeholders shown as aggregated "Other investors" line.
            </span>
          </div>
        </div>
      )}

      {/* Waterfall params */}
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary mb-3 px-1">
        Waterfall mechanics
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <div className="rounded-xl border border-surface-tertiary bg-white p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Promoter equity
          </div>
          <PercentInputSmall
            value={waterfall.promoterEquityRate}
            onCommit={(v) => setWaterfallParam("promoterEquityRate", v)}
          />
          <div className="text-[11px] text-text-tertiary mt-1">Sponsor's free carry</div>
        </div>
        <div className="rounded-xl border border-surface-tertiary bg-white p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Preferred return
          </div>
          <PercentInputSmall
            value={waterfall.preferredReturnRate}
            onCommit={(v) => setWaterfallParam("preferredReturnRate", v)}
          />
          <div className="text-[11px] text-text-tertiary mt-1">Annual pref on PP capital</div>
        </div>
        <div className="rounded-xl border border-surface-tertiary bg-white p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            LP share above pref
          </div>
          <PercentInputSmall
            value={waterfall.ppShareAbovePref}
            onCommit={(v) => setWaterfallParam("ppShareAbovePref", v)}
          />
          <div className="text-[11px] text-text-tertiary mt-1">{formatPercent(1 - waterfall.ppShareAbovePref)} to sponsor</div>
        </div>
        <div className="rounded-xl border border-surface-tertiary bg-white p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Co-invest repaid in
          </div>
          <input
            type="number"
            min={2028}
            max={2036}
            step={1}
            defaultValue={waterfall.coInvestRepaymentYear}
            onBlur={(e) => {
              const v = parseInt(e.target.value, 10);
              if (Number.isFinite(v)) setWaterfallParam("coInvestRepaymentYear", Math.max(2028, Math.min(2036, v)));
            }}
            className="w-20 px-2 py-1 text-sm font-mono text-right rounded border border-surface-tertiary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          <div className="text-[11px] text-text-tertiary mt-1">Founder PP returned</div>
        </div>
      </div>

      {/* Cap table summary */}
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary mb-3 px-1">
        Stakeholders
      </h2>
      <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-secondary/40">
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">Stakeholder</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">Cash in</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">% PP</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">Total stake</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">Total received</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">MOIC</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">IRR</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">Payback</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">Notes</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {result.stakeholders.map((r) => {
                const sh = r.stakeholder;
                const hide = redacted && redactedTarget !== sh.id;
                if (hide) return null;
                return (
                  <tr
                    key={sh.id}
                    className="border-t border-surface-secondary/40 hover:bg-surface-secondary/20 cursor-pointer"
                    onClick={() => setExpanded((e) => ({ ...e, [sh.id]: !e[sh.id] }))}
                  >
                    <td className="py-2.5 px-4 font-medium">
                      {sh.isPromoter && <span className="text-[10px] uppercase tracking-wider bg-brand-50 text-brand-700 rounded px-1.5 py-0.5 mr-2">Founder</span>}
                      {sh.name}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono" onClick={(e) => e.stopPropagation()}>
                      <NumberInput
                        value={sh.cashIn}
                        step={10000}
                        prefix="€"
                        onCommit={(v) => updateStakeholder(sh.id, { cashIn: Math.max(0, v) })}
                      />
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatPercent(r.ppFraction)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold">{formatPercent(r.economicStake)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatCurrency(r.totalReceived, true, locale)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatMultiple(r.moic)}</td>
                    <td className={`py-2.5 px-4 text-right font-mono ${r.irr >= 0.15 ? "text-positive" : r.irr > 0 ? "" : "text-warning"}`}>
                      {r.irr > 0 ? formatPercent(r.irr) : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">{r.paybackYear ?? "—"}</td>
                    <td className="py-2.5 px-4 text-right text-xs text-text-tertiary max-w-[150px] truncate">{sh.notes ?? ""}</td>
                    <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      {capTable.length > 1 && !sh.isPromoter && (
                        <button
                          onClick={() => removeStakeholder(sh.id)}
                          className="text-xs text-text-tertiary hover:text-negative"
                          title="Remove"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {redacted && redactedTarget && (() => {
                const { aggCashIn, aggReceived } = aggregateOthers(redactedTarget);
                const othersAvgMoic = aggCashIn > 0 ? aggReceived / aggCashIn : 0;
                return (
                  <tr className="border-t border-surface-secondary/40 bg-surface-secondary/40 font-medium">
                    <td className="py-2.5 px-4 italic text-text-secondary">Other investors (aggregated)</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatCurrency(aggCashIn, true, locale)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatPercent(totalPP > 0 ? aggCashIn / totalPP : 0)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">—</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatCurrency(aggReceived, true, locale)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatMultiple(othersAvgMoic)}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-text-tertiary">—</td>
                    <td className="py-2.5 px-4 text-right font-mono">—</td>
                    <td className="py-2.5 px-4 text-right text-xs text-text-tertiary">redacted</td>
                    <td></td>
                  </tr>
                );
              })()}
              <tr className="border-t-2 border-surface-tertiary font-medium">
                <td className="py-2.5 px-4">Total (cash)</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatCurrency(totalPP, true, locale)}</td>
                <td className="py-2.5 px-4 text-right font-mono">100.0%</td>
                <td className="py-2.5 px-4 text-right font-mono">100.0%</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatCurrency(result.totalDistributed, true, locale)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatMultiple(totalPP > 0 ? result.totalDistributed / totalPP : 0)}</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => {
            const id = `inv-${Date.now()}`;
            addStakeholder({ id, name: "New investor", cashIn: 100000 });
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100"
        >
          + Add investor
        </button>
      </div>

      {/* Expanded per-stakeholder detail panels */}
      {result.stakeholders.map((r) => {
        const sh = r.stakeholder;
        if (!expanded[sh.id]) return null;
        if (redacted && redactedTarget !== sh.id) return null;
        return (
          <div key={sh.id} className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-hidden mb-6">
            <div className="p-4 border-b border-surface-tertiary flex items-baseline justify-between">
              <div>
                <h3 className="font-display text-lg">{sh.name}</h3>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Cash in {formatCurrency(sh.cashIn, true, locale)} · PP {formatPercent(r.ppFraction)} · Economic {formatPercent(r.economicStake)} · MOIC {formatMultiple(r.moic)} · IRR {formatPercent(r.irr)}
                </p>
              </div>
              <button
                onClick={() => setExpanded((e) => ({ ...e, [sh.id]: false }))}
                className="text-xs text-text-tertiary hover:text-text-primary"
              >
                Collapse ▴
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="bg-surface-secondary/40">
                    <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">Year</th>
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">Co-invest return</th>
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">Pref return</th>
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">Promoter draw</th>
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">PP excess</th>
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">Sponsor catch</th>
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {r.yearly.map((y) => (
                    <tr key={y.year} className="border-t border-surface-secondary/40">
                      <td className="py-1.5 px-3 font-sans">{y.year}</td>
                      <td className="py-1.5 px-3 text-right">{y.coInvestReturn > 0 ? formatCurrency(y.coInvestReturn, true, locale) : "—"}</td>
                      <td className="py-1.5 px-3 text-right">{y.preferredReturn > 0 ? formatCurrency(y.preferredReturn, true, locale) : "—"}</td>
                      <td className="py-1.5 px-3 text-right">{y.promoterDraw > 0 ? formatCurrency(y.promoterDraw, true, locale) : "—"}</td>
                      <td className="py-1.5 px-3 text-right">{y.ppExcessShare > 0 ? formatCurrency(y.ppExcessShare, true, locale) : "—"}</td>
                      <td className="py-1.5 px-3 text-right">{y.sponsorCatch > 0 ? formatCurrency(y.sponsorCatch, true, locale) : "—"}</td>
                      <td className={`py-1.5 px-3 text-right font-semibold ${y.totalCashFlow > 0 ? "text-positive" : ""}`}>
                        {y.totalCashFlow > 0 ? formatCurrency(y.totalCashFlow, true, locale) : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-surface-tertiary bg-surface-secondary/30 font-semibold">
                    <td className="py-2 px-3 font-sans">Total received</td>
                    <td colSpan={5}></td>
                    <td className="py-2 px-3 text-right text-positive">{formatCurrency(r.totalReceived, true, locale)}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="py-2 px-3 font-sans">Net profit (received − invested)</td>
                    <td colSpan={5}></td>
                    <td className={`py-2 px-3 text-right ${r.netProfit > 0 ? "text-positive" : "text-warning"}`}>
                      {formatCurrency(r.netProfit, true, locale)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="text-xs text-text-tertiary mt-6">
        Tip: click a row to expand its year-by-year detail. Change a contribution amount to
        recompute the entire waterfall. Use the Path / Scenario / Exit controls in the top bar
        to stress-test against different futures.
      </div>

    </div>
  );
}
