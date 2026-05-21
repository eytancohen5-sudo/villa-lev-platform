"use client";

import { useMemo, useState, useId } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { PageSkeleton } from "@/components/Skeleton";
import { computeCapTable } from "@/lib/engine/capTable";
import {
  EARNED_EQUITY_CAP,
  TOTAL_FOUNDER_CAP,
  MIN_INVESTOR_SHARE,
  founderCashExceedsAdvisory,
  advisoryFounderCashLimit,
} from "@/lib/engine/founderWaterfall";

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

export default function CapTablePage() {
  const { locale } = useTranslation();
  const {
    model,
    assumptions,
    activeScenario,
    capTable,
    waterfall,
    updateStakeholder,
    addStakeholder,
    removeStakeholder,
    resetCapTable,
  } = useModelStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [redacted, setRedacted] = useState(false);
  const [redactedTarget, setRedactedTarget] = useState<string | null>(null);

  const grantApproved = assumptions.financingPath === "grant";

  const result = useMemo(() => {
    if (!model) return null;
    const scenario = model.scenarios[activeScenario];
    return computeCapTable(scenario, capTable, waterfall, {
      grantApproved,
      // Layer B uses the engine's DEFAULT_BASELINE_BANK_LOAN (pre-grant
      // commercial financing), not the active scenario's loan.
    });
  }, [model, activeScenario, capTable, waterfall, grantApproved]);

  if (!model || !result) return <PageSkeleton variant="grid" />;

  const b = result.founderBreakdown;
  const totalEquity = result.totalEquityRaised;
  const scenarioLabel = activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1);
  const exitYear = model.scenarios[activeScenario].exitYear;
  const exitMultiple = model.scenarios[activeScenario].exitEbitdaMultiple;
  const founderCash = result.founderCashInvested;
  const advisoryExceeded = founderCashExceedsAdvisory(founderCash, grantApproved);
  const advisoryLimit = advisoryFounderCashLimit(grantApproved);

  const pathLabel =
    assumptions.financingPath === "grant"
      ? "Development Law Grant"
      : assumptions.financingPath === "rrf"
        ? "RRF Loan"
        : assumptions.financingPath === "tepix-loan"
          ? "TEPIX Loan Fund"
          : "Commercial Loan";

  const downloadInvestorPDF = async (stakeholderId: string) => {
    if (!result) return;
    const target = result.stakeholders.find((s) => s.stakeholder.id === stakeholderId);
    if (!target) return;
    const { exportInvestorReport } = await import("@/lib/pdf/exportInvestorReport");
    const blob = await exportInvestorReport(target, result, {
      pathLabel,
      scenarioLabel,
      exitYear,
      exitMultiple,
      redacted: redacted && redactedTarget === stakeholderId,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = target.stakeholder.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    a.download = `villa-lev-${safeName}-${activeScenario}-${assumptions.financingPath}-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const aggregateOthers = (targetId: string) => {
    const target = result.stakeholders.find((s) => s.stakeholder.id === targetId);
    const others = result.stakeholders.filter((s) => s.stakeholder.id !== targetId);
    const aggCashIn = others.reduce((s, o) => s + o.stakeholder.cashIn, 0);
    const aggReceived = others.reduce((s, o) => s + o.totalReceived, 0);
    return { target, others, aggCashIn, aggReceived };
  };

  // Layered founder share — pari-passu / grant / ratchet / total (with caps).
  // The colour-coded stacked bar gives an instant read of the deal structure.
  const layerColors = {
    pp: "#8B6914",         // brand gold
    grant: "#4A6A8B",      // blue
    ratchet: "#4A7C3F",    // green
    investor: "#D6CFC0",   // neutral
  };

  // The capBinding indicator:
  //   total_75 — investors keep their 25% floor; earned was reduced
  //   earned_33 — top-tier or near-top; earned hit the +33% ceiling
  //   none — no cap pressure; founder fully earns the tier
  const capLabel =
    b.capBinding === "total_75"
      ? `75% total cap binding — earned reduced to ${formatPercent(b.earnedPct)}`
      : b.capBinding === "earned_33"
        ? `33% earned cap reached`
        : "No cap binding";
  const capTone =
    b.capBinding === "total_75" ? "warning" : b.capBinding === "earned_33" ? "neutral" : "positive";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-text-primary">Cap Table</h1>
          <p className="text-sm text-text-secondary mt-1">
            {scenarioLabel} &middot; Exit {exitYear} @ {formatMultiple(exitMultiple)} &middot;
            3-layer founder waterfall with investor protection caps
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
        <span className="text-text-tertiary mx-3">·</span>
        Waterfall {result.converged ? `converged in ${result.iterations} iter${result.iterations === 1 ? "" : "s"}` : `did not converge (${result.iterations} iters)`}
      </div>

      {/* ── Founder compensation waterfall ─────────────────────────────── */}
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary mb-3 px-1">
        Founder compensation
      </h2>
      <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-5">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">
              Layer A — Pari-passu
            </div>
            <div className="font-mono text-2xl font-semibold text-text-primary">
              {formatPercent(b.pariPassuPct)}
            </div>
            <div className="text-xs text-text-tertiary mt-1">
              {formatCurrency(founderCash, true, locale)} ÷ {formatCurrency(totalEquity, true, locale)}
            </div>
          </div>
          <div title={
            grantApproved
              ? `Derived: founder_net €${Math.round(b.founderNetGrantCash / 1000)}K ÷ (post-grant equity €${(b.postGrantEquityValue / 1_000_000).toFixed(2)}M + founder_net) — adjusts with grant size, consultant share, and project valuation.`
              : "Layer B vests only when the Greek Development Law grant is approved."
          }>
            <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">
              Layer B — Grant bonus
            </div>
            <div className={`font-mono text-2xl font-semibold ${grantApproved ? "text-text-primary" : "text-text-tertiary"}`}>
              {grantApproved ? "+" + formatPercent(b.grantBonusPct) : "—"}
            </div>
            <div className="text-xs text-text-tertiary mt-1">
              {grantApproved
                ? `€${Math.round(b.founderNetGrantCash / 1000)}K net / €${Math.round((b.postGrantEquityValue + b.founderNetGrantCash) / 1000)}K`
                : "Inactive (no grant path)"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">
              Layer C — Performance ratchet
            </div>
            <div className="font-mono text-2xl font-semibold text-text-primary">
              +{formatPercent(b.performanceRatchetPct)}
            </div>
            <div className="text-xs text-text-tertiary mt-1">
              Tier: {b.ratchetTierLabel}
              {b.moicFloorReduction && <span className="ms-1 text-warning">· MOIC floor reduced</span>}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">
              Founder total
            </div>
            <div className="font-mono text-2xl font-semibold text-brand-700">
              {formatPercent(b.founderTotalPct)}
            </div>
            <div className="text-xs text-text-tertiary mt-1">
              {formatPercent(b.pariPassuPct)} + {formatPercent(b.earnedPct)} earned
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">
              Investors keep
            </div>
            <div className="font-mono text-2xl font-semibold text-positive">
              {formatPercent(b.investorTotalPct)}
            </div>
            <div className="text-xs text-text-tertiary mt-1">
              Floor protected at {formatPercent(MIN_INVESTOR_SHARE)}
            </div>
          </div>
        </div>

        {/* Stacked bar — founder layers + investor share */}
        <div className="mb-3">
          <div className="h-3 w-full rounded-full overflow-hidden flex bg-surface-tertiary">
            <div title={`Pari-passu ${formatPercent(b.pariPassuPct)}`}
                 style={{ width: `${b.pariPassuPct * 100}%`, backgroundColor: layerColors.pp }} />
            {grantApproved && b.grantBonusPct > 0 && (
              <div title={`Grant bonus +${formatPercent(b.grantBonusPct)}`}
                   style={{ width: `${b.grantBonusPct * 100}%`, backgroundColor: layerColors.grant }} />
            )}
            <div title={`Performance ratchet +${formatPercent(b.performanceRatchetPct)}`}
                 style={{ width: `${Math.max(0, b.founderTotalPct - b.pariPassuPct - (grantApproved ? b.grantBonusPct : 0)) * 100}%`, backgroundColor: layerColors.ratchet }} />
            <div title={`Investors keep ${formatPercent(b.investorTotalPct)}`}
                 style={{ width: `${b.investorTotalPct * 100}%`, backgroundColor: layerColors.investor }} />
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px] text-text-tertiary">
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: layerColors.pp }} /> Pari-passu</span>
            {grantApproved && b.grantBonusPct > 0 && (
              <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: layerColors.grant }} /> Grant bonus</span>
            )}
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: layerColors.ratchet }} /> Performance ratchet</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: layerColors.investor }} /> Investor pool</span>
          </div>
        </div>

        {/* Cap binding indicator */}
        <div className={`mt-4 rounded-lg p-3 text-xs border flex items-start gap-3 ${
          capTone === "warning"
            ? "bg-warning/10 border-warning/30 text-warning"
            : capTone === "neutral"
              ? "bg-surface-secondary border-surface-tertiary text-text-secondary"
              : "bg-positive/10 border-positive/20 text-positive"
        }`}>
          <span className="font-medium">{capLabel}.</span>
          <span className="text-text-tertiary">
            Earned cap {formatPercent(EARNED_EQUITY_CAP)} · Total founder cap {formatPercent(TOTAL_FOUNDER_CAP)} (investors keep ≥ {formatPercent(MIN_INVESTOR_SHARE)}).
          </span>
        </div>

        {/* Headline aggregate investor metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-surface-tertiary">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Total equity raised</div>
            <div className="font-mono text-base font-semibold mt-1">{formatCurrency(totalEquity, true, locale)}</div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Non-founder cash</div>
            <div className="font-mono text-base font-semibold mt-1">{formatCurrency(result.totalNonFounderCash, true, locale)}</div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Investor MOIC</div>
            <div className={`font-mono text-base font-semibold mt-1 ${result.investorMOIC >= 2 ? "text-positive" : ""}`}>
              {formatMultiple(result.investorMOIC)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">Investor IRR</div>
            <div className={`font-mono text-base font-semibold mt-1 ${result.investorIRR >= 0.15 ? "text-positive" : result.investorIRR > 0 ? "" : "text-warning"}`}>
              {result.investorIRR > 0 ? formatPercent(result.investorIRR) : "—"}
            </div>
          </div>
        </div>

        {/* Layer B derivation — surfaced so the bank can audit the +4% bonus
            instead of taking it as a magic number. */}
        {grantApproved && (
          <div className="mt-5 pt-4 border-t border-surface-tertiary">
            <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-2">
              Layer B derivation
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              <div>
                <div className="text-text-tertiary">Grant amount</div>
                <div className="font-mono font-medium mt-0.5">{formatCurrency(4_013_880, true, locale)}</div>
              </div>
              <div>
                <div className="text-text-tertiary">× 10% success fee</div>
                <div className="font-mono font-medium mt-0.5">{formatCurrency(4_013_880 * 0.10, true, locale)}</div>
              </div>
              <div>
                <div className="text-text-tertiary">− €200K consultant</div>
                <div className="font-mono font-medium mt-0.5">{formatCurrency(b.founderNetGrantCash, true, locale)} net</div>
              </div>
              <div>
                <div className="text-text-tertiary">Post-grant equity</div>
                <div className="font-mono font-medium mt-0.5">{formatCurrency(b.postGrantEquityValue, true, locale)}</div>
              </div>
              <div>
                <div className="text-text-tertiary">= Grant bonus</div>
                <div className="font-mono font-medium text-brand-700 mt-0.5">
                  {formatPercent(b.grantBonusPct)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Operating-fee context — these reduce cash distributable to equity. */}
        <div className="mt-4 pt-4 border-t border-surface-tertiary grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-text-tertiary">Founder ManCo fee (5% × revenue)</div>
            <div className="font-mono font-medium mt-0.5">
              {formatCurrency(result.totalFounderManCoFee, true, locale)} cumulative
            </div>
          </div>
          <div>
            <div className="text-text-tertiary">Consultant payment (Layer B)</div>
            <div className="font-mono font-medium mt-0.5">
              {result.totalConsultantPayment > 0
                ? formatCurrency(result.totalConsultantPayment, true, locale)
                : "—"}
            </div>
          </div>
          <div className="text-text-tertiary leading-snug">
            Both subtracted from NCF post-tax post-DS before splitting between founder and investors.
          </div>
        </div>

        {advisoryExceeded && (
          <div className="mt-4 rounded-lg p-3 text-xs bg-warning/10 border border-warning/30 text-warning">
            <span className="font-medium">Advisory:</span> Founder cash exceeds {formatCurrency(advisoryLimit, true, locale)} ({grantApproved ? "grant scenario" : "no-grant scenario"}). Additional cash provides limited upside — the {formatPercent(TOTAL_FOUNDER_CAP)} cap binds and earned equity is reduced.
          </div>
        )}
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
              Other stakeholders shown as aggregated &quot;Other investors&quot; line.
            </span>
          </div>
        </div>
      )}

      {/* ── Stakeholders table ─────────────────────────────────────────── */}
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
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">% of pool</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">Economic stake</th>
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
                const poolFractionLabel = sh.isPromoter
                  ? formatPercent(totalEquity > 0 ? sh.cashIn / totalEquity : 0)
                  : formatPercent(r.ppFraction);
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
                    <td className="py-2.5 px-4 text-right font-mono">{poolFractionLabel}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold">{formatPercent(r.economicStake)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatCurrency(r.totalReceived, true, locale)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatMultiple(r.moic)}</td>
                    <td className={`py-2.5 px-4 text-right font-mono ${r.irr >= 0.15 ? "text-positive" : r.irr > 0 ? "" : "text-warning"}`}>
                      {r.irr > 0 ? formatPercent(r.irr) : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">{r.paybackYear ?? "—"}</td>
                    <td className="py-2.5 px-4 text-right text-xs text-text-tertiary max-w-[150px] truncate">{sh.notes ?? ""}</td>
                    <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => downloadInvestorPDF(sh.id)}
                          className="text-xs text-text-tertiary hover:text-brand-700"
                          title="Download personal report (PDF)"
                        >
                          ↓ PDF
                        </button>
                        {capTable.length > 1 && !sh.isPromoter && (
                          <button
                            onClick={() => removeStakeholder(sh.id)}
                            className="text-xs text-text-tertiary hover:text-negative"
                            title="Remove"
                          >
                            ×
                          </button>
                        )}
                      </div>
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
                    <td className="py-2.5 px-4 text-right font-mono">{formatPercent(totalEquity > 0 ? aggCashIn / totalEquity : 0)}</td>
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
                <td className="py-2.5 px-4 text-right font-mono">{formatCurrency(totalEquity, true, locale)}</td>
                <td className="py-2.5 px-4 text-right font-mono">100.0%</td>
                <td className="py-2.5 px-4 text-right font-mono">100.0%</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatCurrency(result.totalDistributed, true, locale)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatMultiple(totalEquity > 0 ? result.totalDistributed / totalEquity : 0)}</td>
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
        const isFounder = !!sh.isPromoter;
        return (
          <div key={sh.id} className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-hidden mb-6">
            <div className="p-4 border-b border-surface-tertiary flex items-baseline justify-between">
              <div>
                <h3 className="font-display text-lg">{sh.name}</h3>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Cash in {formatCurrency(sh.cashIn, true, locale)} ·{" "}
                  {isFounder ? "Founder economic stake" : "Pool share"} {formatPercent(isFounder ? r.economicStake : r.ppFraction)} ·
                  Economic {formatPercent(r.economicStake)} · MOIC {formatMultiple(r.moic)} · IRR {formatPercent(r.irr)}
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
                    {isFounder ? (
                      <>
                        <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">Pari-passu</th>
                        <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">Grant bonus</th>
                        <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">Performance ratchet</th>
                      </>
                    ) : (
                      <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">Distribution</th>
                    )}
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {r.yearly.map((y) => (
                    <tr key={y.year} className="border-t border-surface-secondary/40">
                      <td className="py-1.5 px-3 font-sans">{y.year}</td>
                      {isFounder ? (
                        <>
                          <td className="py-1.5 px-3 text-right">{y.pariPassuShare > 0 ? formatCurrency(y.pariPassuShare, true, locale) : "—"}</td>
                          <td className="py-1.5 px-3 text-right">{y.grantBonusShare > 0 ? formatCurrency(y.grantBonusShare, true, locale) : "—"}</td>
                          <td className="py-1.5 px-3 text-right">{y.performanceRatchetShare > 0 ? formatCurrency(y.performanceRatchetShare, true, locale) : "—"}</td>
                        </>
                      ) : (
                        <td className="py-1.5 px-3 text-right">{y.investorDistribution > 0 ? formatCurrency(y.investorDistribution, true, locale) : "—"}</td>
                      )}
                      <td className={`py-1.5 px-3 text-right font-semibold ${y.totalCashFlow > 0 ? "text-positive" : ""}`}>
                        {y.totalCashFlow > 0 ? formatCurrency(y.totalCashFlow, true, locale) : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-surface-tertiary bg-surface-secondary/30 font-semibold">
                    <td className="py-2 px-3 font-sans">Total received</td>
                    {isFounder ? <td colSpan={3}></td> : <td></td>}
                    <td className="py-2 px-3 text-right text-positive">{formatCurrency(r.totalReceived, true, locale)}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="py-2 px-3 font-sans">Net profit (received − invested)</td>
                    {isFounder ? <td colSpan={3}></td> : <td></td>}
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

      <div className="text-xs text-text-tertiary mt-6 space-y-1">
        <p>
          <span className="font-medium text-text-secondary">How the waterfall works:</span> the founder&apos;s economic share is determined at exit by the three layers above; investors split the remainder pro-rata to their cash. The performance ratchet uses MOIC floors to prevent quick-exit gaming. Caps protect investors (≥ {formatPercent(MIN_INVESTOR_SHARE)} of distributions guaranteed).
        </p>
        <p>
          <span className="font-medium text-text-secondary">Operating fees (separate from equity):</span> the founder&apos;s ManCo receives 5% of gross revenue (brand + management combined) and a 10% grant success fee at grant approval (half cash to consultant, half re-invested as the Layer B equity bonus).
        </p>
        <p>
          Tip: click a row to expand its year-by-year detail. Change a contribution amount to recompute the waterfall. Switch Path / Scenario / Exit in the top bar to stress-test.
        </p>
      </div>
    </div>
  );
}
