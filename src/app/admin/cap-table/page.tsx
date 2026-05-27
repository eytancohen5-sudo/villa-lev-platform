"use client";

import { useMemo, useState, useId } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { PageSkeleton } from "@/components/Skeleton";
import { PageTour, TourButton, usePageTour } from "@/components/PageTour";
import { CAP_TABLE_TOUR } from "@/lib/tours/configs";
import { computeCapTable } from "@/lib/engine/capTable";
import {
  RATCHET_STANDALONE_CAP,
  TOTAL_FOUNDER_CAP,
  MIN_INVESTOR_SHARE,
  DEFAULT_GRANT_PROCUREMENT_FEE_PCT,
  DEFAULT_GRANT_CONSULTANT_SHARE_PCT,
  DEFAULT_FEE_CASH_SPLIT_PCT,
} from "@/lib/engine/founderWaterfall";
import { SectionHeader } from "@/components/AdminUI";
import { EytanReturnBreakdown } from "@/components/EytanReturnBreakdown";

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
  const { locale, t } = useTranslation();
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
    setWaterfallParam,
    setAssumption,
  } = useModelStore();
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(CAP_TABLE_TOUR.storageKey);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [redacted, setRedacted] = useState(false);
  const [redactedTarget, setRedactedTarget] = useState<string | null>(null);
  const [docxGenerating, setDocxGenerating] = useState(false);
  // Collapsible panel state — all default collapsed so investors see clean outputs first
  const [auditOpen, setAuditOpen] = useState(false);
  const [dealParamsOpen, setDealParamsOpen] = useState(false);
  const [waterfallDetailOpen, setWaterfallDetailOpen] = useState(false);

  const grantApproved = assumptions.financingPath === "grant";

  // Resolve auto-balance investor before running the waterfall so the cap
  // table always sums to the model's equity requirement.
  const equityRequired = model?.keyMetrics.equityRequired ?? 0;
  const resolvedCapTable = useMemo(() => {
    const autoIdx = capTable.findIndex((sh) => sh.autoBalance);
    if (autoIdx < 0) return capTable;
    const othersCash = capTable.reduce(
      (s, sh, i) => (i !== autoIdx ? s + sh.cashIn : s),
      0
    );
    const balanceCash = Math.max(0, equityRequired - othersCash);
    return capTable.map((sh, i) =>
      i === autoIdx ? { ...sh, cashIn: balanceCash } : sh
    );
  }, [capTable, equityRequired]);

  const result = useMemo(() => {
    if (!model) return null;
    const scenario = model.scenarios[activeScenario];
    const liveGrantAmount = grantApproved
      ? model.keyMetrics.totalCapex - model.keyMetrics.loanAmount - model.keyMetrics.equityRequired
      : undefined;
    return computeCapTable(scenario, resolvedCapTable, waterfall, {
      grantApproved,
      equityRequired: model.keyMetrics.equityRequired,
      grantAmount: liveGrantAmount,
      founderFeePct: assumptions.grantProcurementFeePct ?? DEFAULT_GRANT_PROCUREMENT_FEE_PCT,
      consultantSharePct: assumptions.consultantSharePct ?? DEFAULT_GRANT_CONSULTANT_SHARE_PCT,
      feeCashSplitPct: assumptions.feeCashSplitPct ?? DEFAULT_FEE_CASH_SPLIT_PCT,
      grantSuccessFeePaymentYear: assumptions.grantSuccessFeePaymentYear,
    });
  }, [model, activeScenario, resolvedCapTable, waterfall, grantApproved, assumptions]);

  if (!model || !result) return <PageSkeleton variant="grid" />;

  const b = result.founderBreakdown;
  const totalEquity = result.totalEquityRaised;
  const grantAmount = grantApproved
    ? model.keyMetrics.totalCapex - model.keyMetrics.loanAmount - model.keyMetrics.equityRequired
    : 0;
  // Aggelakakis exit EUR: based on promote-layer exit slice (devEq + grantBonus only, ratchet excluded).
  const terminalEquityValue = model.scenarios[activeScenario].terminalEquityValue ?? 0;
  const aggelakakisExitEUR = b.aggelakakisExitPct * terminalEquityValue;
  const scenarioLabel =
    activeScenario === 'upside' ? t('scenario.upside') :
    activeScenario === 'downside' ? t('scenario.downside') :
    activeScenario === 'breakeven' ? t('scenario.breakeven') :
    t('scenario.realistic');
  const exitYear = model.scenarios[activeScenario].exitYear;
  const exitMultiple = model.scenarios[activeScenario].exitEbitdaMultiple;
  const founderCash = result.founderCashInvested;

  // Portfolio label for the investor PDF
  const pdfTotalVillaUnits = assumptions.portfolio.reduce((s, p) => s + p.villaUnits * p.count, 0);
  const pdfTotalSuites = assumptions.portfolio.reduce((s, p) => s + (p.standardSuites + p.doubleSuites) * p.count, 0);
  const pdfPortfolioLabel = [
    pdfTotalVillaUnits > 0 ? `${pdfTotalVillaUnits}× Villa${pdfTotalVillaUnits !== 1 ? 's' : ''}` : '',
    pdfTotalSuites > 0 ? `${pdfTotalSuites}× Suite${pdfTotalSuites !== 1 ? 's' : ''}` : '',
  ].filter(Boolean).join(' + ');

  const pathLabel =
    assumptions.financingPath === "grant"
      ? t("path.grant")
      : assumptions.financingPath === "rrf"
        ? t("path.rrf")
        : assumptions.financingPath === "tepix-loan"
          ? t("path.tepixLoan")
          : t("path.commercial");

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
      portfolioLabel: pdfPortfolioLabel || undefined,
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

  const downloadInvestorDocx = async () => {
    if (!result || !model) return;
    setDocxGenerating(true);
    try {
      const { exportInvestorPresentation } = await import('@/lib/docx/exportInvestorPresentation');
      const blob = await exportInvestorPresentation(result, assumptions, model, locale);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `villa-lev-investor-presentation-${activeScenario}-${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDocxGenerating(false);
    }
  };

  const aggregateOthers = (targetId: string) => {
    const target = result.stakeholders.find((s) => s.stakeholder.id === targetId);
    const others = result.stakeholders.filter((s) => s.stakeholder.id !== targetId);
    const aggCashIn = others.reduce((s, o) => s + o.stakeholder.cashIn, 0);
    const aggReceived = others.reduce((s, o) => s + o.totalReceived, 0);
    return { target, others, aggCashIn, aggReceived };
  };

  // Layered founder share colours — devEq / pari-passu / grant / ratchet / investor.
  const layerColors = {
    devEq: "#6B4F10",
    pp: "#B8922A",
    grant: "#4A6A8B",
    ratchet: "#4A7C3F",
    investor: "#D6CFC0",
  };

  const capLabel =
    b.capBinding === "total_75"
      ? t('ct.capBinding75Detail').replace('{{pct}}', formatPercent(b.earnedPct))
      : b.capBinding === "ratchet_10"
        ? t('ct.capRatchet10Detail')
        : b.capBinding === "exit_55_grant"
          ? t('dash.founder.capExit55Grant')
          : t('ct.capNoBinding');
  const capTone =
    b.capBinding === "total_75" || b.capBinding === "exit_55_grant" ? "warning" : b.capBinding === "ratchet_10" ? "neutral" : "positive";

  return (
    <div>

      {/* ── A: Page header ───────────────────────────────────────────── */}
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-text-primary border-l-[3px] border-brand-400 pl-3">{t('ct.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('ct.pageIntro')}</p>
          <p className="text-sm text-text-secondary mt-1">
            {scenarioLabel} &middot;{' '}
            {t('ct.exitAt')
              .replace('{year}', String(exitYear))
              .replace('{multiple}', formatMultiple(exitMultiple))}{' '}
            &middot; {t('ct.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TourButton onClick={() => setTourOpen(true)} pulsing={!!neverSeen} />
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
            {redacted ? t('ct.redactedOn') : t('ct.generateReport')}
          </button>
          <button
            type="button"
            onClick={resetCapTable}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-secondary text-text-secondary border border-surface-tertiary hover:bg-surface-tertiary"
          >
            {t('ct.reset')}
          </button>
        </div>
      </div>

      {/* ── B: Deal Headline KPI strip ──────────────────────────────── */}
      <div className="mb-5">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-text-tertiary">{t('ct.dealHeadline')}</div>
            <p className="text-xs text-text-secondary mt-0.5">{t('ct.dealHeadlineSub')}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-surface-tertiary p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">{t('ct.investorPoolSize')}</div>
              <div className="font-mono text-2xl font-semibold text-text-primary">
                {formatCurrency(Math.max(0, totalEquity - founderCash), true, locale)}
              </div>
              <div className="text-[10px] text-text-tertiary mt-1">{t('ct.investorPoolSizeSub')}</div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">{t('ct.investorMOIC')}</div>
              <div className={`font-mono text-2xl font-semibold mt-0 ${result.investorMOIC >= 2 ? "text-positive" : "text-text-primary"}`}>
                {formatMultiple(result.investorMOIC)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">{t('ct.investorIRR')}</div>
              <div className={`font-mono text-2xl font-semibold mt-0 ${result.investorIRR >= 0.15 ? "text-positive" : result.investorIRR > 0 ? "text-text-primary" : "text-warning"}`}>
                {result.investorIRR > 0 ? formatPercent(result.investorIRR) : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">{t('ct.equityPoolModel')}</div>
              <div className="font-mono text-base font-semibold text-text-primary mt-1">
                {formatCurrency(totalEquity, true, locale)}
              </div>
              <div className="text-[10px] text-text-tertiary mt-0.5">
                {t('ct.committed')} {formatCurrency(result.totalNonFounderCash, true, locale)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── C: Equity coverage bar ──────────────────────────────────── */}
      {(() => {
        const totalCommitted = result.totalEquityCommitted;
        const gap = equityRequired - totalCommitted;
        const covered = Math.abs(gap) < 1;
        const overCommitted = gap < -1;
        const pct = equityRequired > 0 ? Math.min(1, totalCommitted / equityRequired) : 1;
        const borderCls = covered
          ? "border-positive/30 bg-positive/5"
          : overCommitted
            ? "border-surface-tertiary bg-surface-secondary/40"
            : "border-warning/40 bg-warning/8";
        const labelCls = covered ? "text-positive" : overCommitted ? "text-text-secondary" : "text-warning";
        const chipCls = covered
          ? "bg-positive/15 text-positive"
          : overCommitted
            ? "bg-surface-tertiary text-text-secondary"
            : "bg-warning/15 text-warning";
        const chipLabel = covered
          ? t('ct.chipCovered')
          : overCommitted
            ? `${formatCurrency(Math.abs(gap), true, locale)} ${t('ct.chipOver')}`
            : `${formatCurrency(gap, true, locale)} ${t('ct.chipGap')}`;
        const barCls = covered ? "bg-positive" : overCommitted ? "bg-brand-400" : "bg-warning";
        return (
          <div className={`rounded-xl border p-4 mb-6 ${borderCls}`}>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold uppercase tracking-wider ${labelCls}`}>
                  {t('ct.equityCoverage')}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${chipCls}`}>
                  {chipLabel}
                </span>
              </div>
              <span className="text-xs text-text-tertiary font-mono">
                {formatCurrency(totalCommitted, true, locale)} committed · {formatCurrency(equityRequired, true, locale)} required
              </span>
            </div>
            {overCommitted && (
              <p className="text-[11px] text-text-tertiary mb-2">
                {t('ct.overCommittedNote')}
              </p>
            )}
            <div className="h-2 w-full rounded-full bg-surface-tertiary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barCls}`}
                style={{ width: `${pct * 100}%` }}
              />
            </div>
            {!covered && !overCommitted && (
              <p className="text-xs text-text-secondary mt-2">
                {t('ct.autoFillNote')}
              </p>
            )}
          </div>
        );
      })()}

      {/* ── D: Stakeholders table ────────────────────────────────────── */}
      <SectionHeader title={t('ct.stakeholders')} />

      {/* Redact target picker — adjacent to the table it controls */}
      {redacted && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 mb-4 text-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-text-secondary">{t('ct.redactedShowFor')}</span>
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
              {t('ct.redactedOthersNote')}
            </span>
          </div>
        </div>
      )}

      <div id="captable-stakeholders" className="bg-white rounded-xl border border-surface-tertiary overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-secondary/40">
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('ct.colStakeholder')}</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('ct.colCashIn')}</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('ct.colPoolPct')}</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('ct.colEconomicStake')}</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('ct.colTotalReceived')}</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('ct.colMOIC')}</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('ct.colIRR')}</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('ct.colPayback')}</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('ct.colNotes')}</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {result.stakeholders.map((r) => {
                const sh = r.stakeholder;
                const hide = redacted && redactedTarget !== sh.id;
                if (hide) return null;
                const isAutoBalance = !!sh.autoBalance;
                const poolFractionLabel = sh.isPromoter
                  ? formatPercent(totalEquity > 0 ? sh.cashIn / totalEquity : 0)
                  : formatPercent(r.ppFraction);
                return (
                  <tr
                    key={sh.id}
                    className={`border-t border-surface-secondary/40 hover:bg-surface-secondary/20 cursor-pointer ${isAutoBalance ? "bg-surface-secondary/20" : ""}`}
                    onClick={() => !isAutoBalance && setExpanded((e) => ({ ...e, [sh.id]: !e[sh.id] }))}
                  >
                    <td className="py-2.5 px-4 font-medium">
                      {sh.isPromoter && <span className="text-[10px] uppercase tracking-wider bg-brand-50 text-brand-700 rounded px-1.5 py-0.5 mr-2">{t('ct.founderTag')}</span>}
                      {isAutoBalance && <span className="text-[10px] uppercase tracking-wider bg-surface-tertiary text-text-tertiary rounded px-1.5 py-0.5 mr-2">{t('ct.autoTag')}</span>}
                      {sh.name}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono" onClick={(e) => e.stopPropagation()}>
                      {isAutoBalance ? (
                        <span className="font-mono text-sm text-text-secondary" title="Derived: equityRequired − Σ others">
                          €{(sh.cashIn / 1000).toFixed(0)}K
                        </span>
                      ) : (
                        <NumberInput
                          value={sh.cashIn}
                          step={10000}
                          prefix="€"
                          onCommit={(v) => updateStakeholder(sh.id, { cashIn: Math.max(0, v) })}
                        />
                      )}
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
                        {!isAutoBalance && (
                          <button
                            onClick={() => downloadInvestorPDF(sh.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-[11px] font-medium hover:bg-brand-100 hover:border-brand-400 transition-all"
                            title="Download personal report (PDF)"
                          >
                            ↓ PDF
                          </button>
                        )}
                        <button
                          onClick={downloadInvestorDocx}
                          disabled={!result || docxGenerating}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-secondary border border-surface-tertiary text-text-secondary text-[11px] font-medium hover:bg-surface-tertiary disabled:opacity-40 transition-all"
                          title="Download investor presentation (Word)"
                        >
                          {docxGenerating ? '…' : `↓ ${t('ct.exportDocx')}`}
                        </button>
                        {capTable.length > 1 && !sh.isPromoter && !isAutoBalance && (
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
                    <td className="py-2.5 px-4 italic text-text-secondary">{t('ct.othersAggregated')}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatCurrency(aggCashIn, true, locale)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatPercent(totalEquity > 0 ? aggCashIn / totalEquity : 0)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">—</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatCurrency(aggReceived, true, locale)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{formatMultiple(othersAvgMoic)}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-text-tertiary">—</td>
                    <td className="py-2.5 px-4 text-right font-mono">—</td>
                    <td className="py-2.5 px-4 text-right text-xs text-text-tertiary">{t('ct.redactedLabel')}</td>
                    <td></td>
                  </tr>
                );
              })()}
              <tr className="border-t-2 border-surface-tertiary font-medium">
                <td className="py-2.5 px-4">{t('ct.totalCash')}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatCurrency(result.totalEquityCommitted, true, locale)}</td>
                <td className="py-2.5 px-4 text-right font-mono">100.0%</td>
                <td className="py-2.5 px-4 text-right font-mono">100.0%</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatCurrency(result.totalDistributed, true, locale)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatMultiple(result.totalEquityCommitted > 0 ? result.totalDistributed / result.totalEquityCommitted : 0)}</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => {
            const id = `inv-${Date.now()}`;
            addStakeholder({ id, name: "New investor", cashIn: 100000 });
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100"
        >
          {t('ct.addInvestor')}
        </button>
      </div>

      {/* Per-stakeholder expanded detail panels — adjacent to the table */}
      {result.stakeholders.map((r) => {
        const sh = r.stakeholder;
        if (!expanded[sh.id]) return null;
        if (redacted && redactedTarget !== sh.id) return null;
        const isFounder = !!sh.isPromoter;
        return (
          <div key={sh.id} className="bg-white rounded-xl border border-surface-tertiary overflow-hidden mb-4">
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
                {t('ct.collapse')}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="bg-surface-secondary/40">
                    <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('ct.detail.year')}</th>
                    {isFounder ? (
                      <>
                        <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('ct.detail.devEquity')}</th>
                        <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('ct.detail.pariPassu')}</th>
                        <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('ct.detail.grantBonus')}</th>
                        <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('ct.detail.perfRatchet')}</th>
                      </>
                    ) : (
                      <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('ct.detail.distribution')}</th>
                    )}
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('ct.detail.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.yearly.map((y) => (
                    <tr key={y.year} className="border-t border-surface-secondary/40">
                      <td className="py-1.5 px-3 font-sans">{y.year}</td>
                      {isFounder ? (
                        <>
                          <td className="py-1.5 px-3 text-right">{y.developerEquityShare > 0 ? formatCurrency(y.developerEquityShare, true, locale) : "—"}</td>
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
                    <td className="py-2 px-3 font-sans">{t('ct.totalReceived')}</td>
                    {isFounder ? <td colSpan={4}></td> : <td></td>}
                    <td className="py-2 px-3 text-right text-positive">{formatCurrency(r.totalReceived, true, locale)}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="py-2 px-3 font-sans">{t('ct.netProfit')}</td>
                    {isFounder ? <td colSpan={4}></td> : <td></td>}
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

      {/* ── E: Sponsor alignment ─────────────────────────────────────── */}
      <div className="mb-4 mt-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-text-tertiary">{t('ct.sponsorAlignment')}</div>
        <p className="text-xs text-text-secondary mt-0.5">{t('ct.sponsorAlignmentSub')}</p>
      </div>
      {(() => {
        const _founderResult = result.stakeholders.find((s) => s.stakeholder.isPromoter);
        return _founderResult ? (
          <EytanReturnBreakdown
            result={result}
            founderResult={_founderResult}
            grantApproved={grantApproved}
            grantAmount={grantAmount}
            locale={locale}
            formatCurrency={(v) => formatCurrency(v, true, locale)}
            formatPercent={formatPercent}
          />
        ) : null;
      })()}

      {/* ── F: Waterfall detail (collapsible) ───────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-text-tertiary">{t('ct.waterfallDetail')}</div>
            <p className="text-xs text-text-secondary mt-0.5">{t('ct.waterfallDetailSub')}</p>
          </div>
          <button
            type="button"
            onClick={() => setWaterfallDetailOpen((v) => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-secondary text-text-secondary border border-surface-tertiary hover:bg-surface-tertiary"
          >
            {waterfallDetailOpen ? t('ct.waterfallDetailHide') : t('ct.waterfallDetailToggle')}
          </button>
        </div>

        <div id="captable-founder-waterfall" className="bg-white rounded-xl border border-surface-tertiary p-5">

          {/* Always visible: stacked bar + legend */}
          <div className="mb-3">
            <div className="h-5 w-full rounded-full overflow-hidden flex bg-surface-tertiary">
              {b.developerEquityPct > 0 && (
                <div title={`Developer equity ${formatPercent(b.developerEquityPct)}`}
                     style={{ width: `${b.developerEquityPct * 100}%`, backgroundColor: layerColors.devEq }} />
              )}
              <div title={`Pari-passu ${formatPercent(b.pariPassuPct)}`}
                   style={{ width: `${b.pariPassuPct * 100}%`, backgroundColor: layerColors.pp }} />
              {grantApproved && b.grantBonusPct > 0 && (
                <div title={`Grant bonus +${formatPercent(b.grantBonusPct)}`}
                     style={{ width: `${b.grantBonusPct * 100}%`, backgroundColor: layerColors.grant }} />
              )}
              <div title={`Performance ratchet +${formatPercent(b.performanceRatchetPct)}`}
                   style={{ width: `${b.performanceRatchetPct * 100}%`, backgroundColor: layerColors.ratchet }} />
              <div title={`Investors keep ${formatPercent(b.investorTotalPct)}`}
                   style={{ width: `${b.investorTotalPct * 100}%`, backgroundColor: layerColors.investor }} />
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px] text-text-tertiary">
              {b.developerEquityPct > 0 && (
                <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: layerColors.devEq }} /> {t('ct.devEquity')} ({formatPercent(b.developerEquityPct)})</span>
              )}
              <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: layerColors.pp }} /> {t('ct.layerA')} ({formatPercent(b.pariPassuPct)})</span>
              {grantApproved && b.grantBonusPct > 0 && (
                <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: layerColors.grant }} /> {t('ct.layerB')} ({formatPercent(b.grantBonusPct)})</span>
              )}
              <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: layerColors.ratchet }} /> {t('ct.layerC')} ({formatPercent(b.performanceRatchetPct)})</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: layerColors.investor }} /> {t('ct.investorsKeep')} ({formatPercent(b.investorTotalPct)})</span>
            </div>
          </div>

          {/* Always visible: cap binding indicator */}
          <div className={`rounded-lg p-3 text-xs border flex items-start gap-3 ${
            capTone === "warning"
              ? "bg-warning/10 border-warning/30 text-warning"
              : capTone === "neutral"
                ? "bg-surface-secondary border-surface-tertiary text-text-secondary"
                : "bg-positive/10 border-positive/20 text-positive"
          }`}>
            <span className="font-medium">{capLabel}.</span>
            <span className="text-text-tertiary">
              {t('ct.capBindingNote')
                .replace('{{earnedCap}}', formatPercent(RATCHET_STANDALONE_CAP))
                .replace('{{totalCap}}', formatPercent(TOTAL_FOUNDER_CAP))
                .replace('{{minInvestor}}', formatPercent(MIN_INVESTOR_SHARE))}
            </span>
          </div>

          {/* Always visible: operating fee context */}
          <div className="mt-4 pt-4 border-t border-surface-tertiary grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-text-tertiary">{t('ct.opFeeManCo')}</div>
              <div className="font-mono font-medium mt-0.5">
                {formatCurrency(result.totalFounderManCoFee, true, locale)} cumulative
              </div>
            </div>
            <div className="text-text-tertiary leading-snug">
              {t('ct.opFeeNote')}
            </div>
          </div>

          {/* Expanded: per-layer stat grid (developer equity read-only) + Layer B */}
          {waterfallDetailOpen && (
            <div className="mt-5 pt-5 border-t border-surface-tertiary">

              {/* 6-tile stat grid — devEq is read-only display; editable in Deal Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-5">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">
                    {t('ct.devEquity')}
                  </div>
                  <div className="font-mono text-2xl font-semibold text-text-primary">
                    {formatPercent(waterfall.developerEquityPct ?? 0.25)}
                  </div>
                  <div className="text-xs text-text-tertiary mt-1">
                    {t('ct.founder.devEquityNote')}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">
                    {t('ct.layerA')}
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
                    ? `Derived: 50% equity portion €${Math.round(b.founderNetGrantCash / 1000)}K ÷ total equity pool €${Math.round(totalEquity / 1000)}K = ${(b.grantBonusPct * 100).toFixed(1)}%. The equity half of the 10% grant success fee, valued at pari-passu.`
                    : "Layer B vests only when the Greek Development Law grant is approved."
                }>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">
                    {t('ct.layerB')}
                  </div>
                  <div className={`font-mono text-2xl font-semibold ${grantApproved ? "text-text-primary" : "text-text-tertiary"}`}>
                    {grantApproved ? "+" + formatPercent(b.grantBonusPct) : "—"}
                  </div>
                  <div className="text-xs text-text-tertiary mt-1">
                    {grantApproved
                      ? `€${Math.round(b.founderNetGrantCash / 1000)}K net / €${Math.round(totalEquity / 1000)}K equity pool`
                      : t('ct.founder.layerBInactive')}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">
                    {t('ct.layerC')}
                  </div>
                  <div className="font-mono text-2xl font-semibold text-text-primary">
                    +{formatPercent(b.performanceRatchetPct)}
                  </div>
                  <div className="text-xs text-text-tertiary mt-1">
                    {t('ct.founder.layerCNote')} {b.ratchetTierLabel}
                    {b.moicFloorReduction && <span className="ms-1 text-warning">· MOIC floor reduced</span>}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">
                    {t('ct.founderOps')}
                  </div>
                  <div className="font-mono text-2xl font-semibold text-brand-700">
                    {formatPercent(b.founderOperatingPct)}
                  </div>
                  <div className="text-xs text-text-tertiary mt-1">
                    {t('ct.founder.exitNote')} {formatPercent(b.founderExitPct)} (devEq + grant, no ratchet)
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">
                    {t('ct.investorsKeep')}
                  </div>
                  <div className="font-mono text-2xl font-semibold text-positive">
                    {formatPercent(b.investorTotalPct)}
                  </div>
                  <div className="text-xs text-text-tertiary mt-1">
                    {t('ct.founder.floorNote')} {formatPercent(MIN_INVESTOR_SHARE)}
                  </div>
                </div>
              </div>

              {/* Layer B derivation — auditable formula, gated on grant */}
              {grantApproved && (
                <div className="pt-4 border-t border-surface-tertiary">
                  <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
                    <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                      {t('ct.layerB.heading')}
                    </div>
                    <div className="text-xs text-text-tertiary font-mono">
                      {t('ct.layerB.totalFee')}: <span className="font-medium text-text-primary">{formatCurrency(grantAmount * (assumptions.grantProcurementFeePct ?? DEFAULT_GRANT_PROCUREMENT_FEE_PCT), true, locale)}</span>
                      <span className="ml-2 text-text-tertiary/60">·</span>
                      <span className="ml-2">{t('ct.layerB.paymentYear')}: <span className="font-medium text-text-primary">{b.grantSuccessFeePaymentYear}</span></span>
                    </div>
                  </div>
                  {/* Two-party breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Aggelakakis */}
                    <div className="rounded-lg bg-surface-secondary/50 border border-surface-tertiary p-3 text-xs">
                      <div className="font-medium text-text-primary mb-2 flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-earth-terracotta/70" />
                        {t('ct.layerB.aggelakakis')}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-text-tertiary">{t('ct.layerB.cashPortion').replace('{year}', String(b.grantSuccessFeePaymentYear))}</div>
                          <div className="font-mono font-medium mt-0.5 text-negative">{formatCurrency(b.aggelakakisCash, true, locale)}</div>
                        </div>
                        <div>
                          <div className="text-text-tertiary">{t('ct.grantConv.aggelakakisExitPct')}</div>
                          <div className="font-mono font-medium mt-0.5">
                            {b.aggelakakisPromotePct > 0 ? formatPercent(b.aggelakakisPromotePct) : '—'}
                          </div>
                          <div className="text-text-tertiary/60 text-[10px] mt-0.5">{t('ct.grantConv.aggelakakisSubLabel')}</div>
                        </div>
                        <div>
                          <div className="text-text-tertiary">{t('ct.layerB.equityAtExit')}</div>
                          <div className="font-mono font-medium mt-0.5">
                            {aggelakakisExitEUR > 0 ? formatCurrency(aggelakakisExitEUR, true, locale) : '—'}
                          </div>
                          {aggelakakisExitEUR > 0 && (
                            <div className="text-text-tertiary/60 text-[10px] mt-0.5">
                              {formatPercent(b.aggelakakisExitPct)} × terminal equity
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Eytan */}
                    <div className="rounded-lg bg-brand-50/60 border border-brand-200/60 p-3 text-xs">
                      <div className="font-medium text-text-primary mb-2 flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500" />
                        {t('ct.layerB.eytan')}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-text-tertiary">{t('ct.layerB.cashPortion').replace('{year}', String(b.grantSuccessFeePaymentYear))}</div>
                          <div className="font-mono font-medium mt-0.5 text-negative">{formatCurrency(b.eytan1BCash, true, locale)}</div>
                        </div>
                        <div>
                          <div className="text-text-tertiary">{t('ct.layerB.layerBEquity')}</div>
                          <div className="font-mono font-medium mt-0.5 text-brand-700">
                            {formatCurrency(b.founderNetGrantCash, true, locale)}
                            <span className="text-text-tertiary font-normal ml-1">÷ {formatCurrency(totalEquity, true, locale)}</span>
                            <span className="ml-1">= {formatPercent(b.grantBonusPct)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── G: Deal Parameters (collapsible) ────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-text-tertiary">{t('ct.dealParams')}</div>
            <p className="text-xs text-text-secondary mt-0.5">{t('ct.dealParamsSub')}</p>
          </div>
          <button
            type="button"
            onClick={() => setDealParamsOpen((v) => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-secondary text-text-secondary border border-surface-tertiary hover:bg-surface-tertiary"
          >
            {dealParamsOpen ? t('ct.dealParamsHide') : t('ct.dealParamsToggle')}
          </button>
        </div>

        {dealParamsOpen && (
          <div className="rounded-xl border border-surface-tertiary bg-surface-secondary/30 p-4">
            {/* Developer equity % input */}
            <div className="mb-4">
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">
                {t('ct.devEquity')}
              </div>
              <div className="flex items-baseline gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={75}
                  step={1}
                  defaultValue={Math.round((waterfall.developerEquityPct ?? 0.25) * 100)}
                  key={Math.round((waterfall.developerEquityPct ?? 0.25) * 100)}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) setWaterfallParam('developerEquityPct', Math.max(0, Math.min(0.75, v / 100)));
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="w-16 px-2 py-1 text-xl font-mono font-semibold text-right rounded border border-surface-tertiary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
                <span className="font-mono text-xl font-semibold text-text-primary">%</span>
              </div>
              <div className="text-xs text-text-tertiary mt-1">
                {t('ct.founder.devEquityNote')}
              </div>
            </div>

            {/* Grant fee controls — only visible when grant path active */}
            {grantApproved && (
              <div className="pt-4 border-t border-surface-tertiary">
                <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-3">
                  {t('ct.grantConv.heading')}
                </div>
                <div className="flex flex-wrap gap-6 text-xs">
                  <div>
                    <div className="text-text-tertiary mb-1">{t('ct.grantConv.feePct')} <span className="text-text-tertiary/60">({t('ct.grantConv.subGrant')})</span></div>
                    <NumberInput
                      value={Math.round((assumptions.grantProcurementFeePct ?? DEFAULT_GRANT_PROCUREMENT_FEE_PCT) * 1000) / 10}
                      onCommit={(v) => setAssumption('grantProcurementFeePct', v / 100)}
                      step={0.5}
                      suffix="%"
                      width="w-20"
                    />
                    <div className="text-text-tertiary/70 mt-0.5 font-mono">{formatCurrency(grantAmount * (assumptions.grantProcurementFeePct ?? DEFAULT_GRANT_PROCUREMENT_FEE_PCT), true, locale)}</div>
                  </div>
                  <div>
                    <div className="text-text-tertiary mb-1">{t('ct.grantConv.consultantSharePct')} <span className="text-text-tertiary/60">({t('ct.grantConv.subGrant')} → Aggelakakis)</span></div>
                    <NumberInput
                      value={Math.round((assumptions.consultantSharePct ?? DEFAULT_GRANT_CONSULTANT_SHARE_PCT) * 1000) / 10}
                      onCommit={(v) => setAssumption('consultantSharePct', v / 100)}
                      step={0.5}
                      suffix="%"
                      width="w-20"
                    />
                    <div className="text-text-tertiary/70 mt-0.5 font-mono">{formatCurrency(grantAmount * (assumptions.consultantSharePct ?? DEFAULT_GRANT_CONSULTANT_SHARE_PCT), true, locale)}</div>
                  </div>
                  <div>
                    <div className="text-text-tertiary mb-1">{t('ct.grantConv.cashSplitPct')} <span className="text-text-tertiary/60">({t('ct.grantConv.subCash')})</span></div>
                    <NumberInput
                      value={Math.round((assumptions.feeCashSplitPct ?? DEFAULT_FEE_CASH_SPLIT_PCT) * 100)}
                      onCommit={(v) => setAssumption('feeCashSplitPct', v / 100)}
                      step={5}
                      suffix="%"
                      width="w-20"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── H: Reconciliation audit (collapsible, default collapsed) ── */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAuditOpen((v) => !v)}
            className="text-[11px] text-text-tertiary underline-offset-2 underline cursor-pointer hover:text-text-secondary"
          >
            {auditOpen ? t('ct.auditToggleHide') : t('ct.auditToggle')}
          </button>
          {/* Error badge — always visible even when audit is collapsed */}
          {Math.abs(result.reconciliationError) >= 1 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium">
              {formatCurrency(result.reconciliationError, true, locale)} diff
            </span>
          )}
        </div>
        {auditOpen && (
          <div className="rounded-xl border border-surface-tertiary bg-surface-secondary/40 p-3 mt-2 text-xs font-mono">
            <span className="text-text-tertiary mr-3">{t('ct.recon.label')}</span>
            {t('ct.recon.projDist')} {formatCurrency(result.totalProjectDistributable, true, locale)} ·
            {t('ct.recon.stakeholderDist')} {formatCurrency(result.totalDistributed, true, locale)} ·
            <span className={Math.abs(result.reconciliationError) < 1 ? "text-positive ml-1" : "text-warning ml-1"}>
              {t('ct.recon.diff')} {formatCurrency(result.reconciliationError, true, locale)}
            </span>
            <span className="text-text-tertiary mx-3">·</span>
            {t('ct.recon.waterfall')} {result.converged ? `${t('ct.recon.converged')} ${result.iterations} iter${result.iterations === 1 ? "" : "s"}` : `${t('ct.recon.diverged')} (${result.iterations} iters)`}
          </div>
        )}
      </div>

      {/* ── J: Footnotes ─────────────────────────────────────────────── */}
      <div className="text-xs text-text-tertiary mt-2 space-y-1">
        <p>
          {t('ct.footnoteWaterfall').replace('{minShare}', formatPercent(MIN_INVESTOR_SHARE))}
        </p>
        <p>
          {t('ct.footnoteFees')}
        </p>
        <p>
          {t('ct.footnoteTip')}
        </p>
      </div>

      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={CAP_TABLE_TOUR} />
    </div>
  );
}
