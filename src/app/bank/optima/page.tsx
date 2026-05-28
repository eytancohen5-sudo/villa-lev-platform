"use client";

import { useEffect } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { optimaCapexView } from "@/lib/engine/optimaView";
import { computeOptimaCapResult } from "@/lib/engine/model";
import type { OptimaCapResult } from "@/lib/engine/model";
import { BankPnLSection } from "@/components/BankPnLSection";
import { SourcesUsesPanel } from "@/components/SourcesUsesPanel";
import { BankStressTest } from "@/components/BankStressTest";
import { ConstructionVatCashflow } from "@/components/ConstructionVatCashflow";
import { useEuribor } from "@/lib/hooks/useEuribor";

function MetricCell({
  value,
  label,
  sublabel,
  valueClass,
}: {
  value: string;
  label: string;
  sublabel?: string;
  valueClass?: string;
}) {
  return (
    <div className="text-center px-2">
      <div className={`kpi-value ${valueClass ?? "text-text-primary"}`}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary mt-2">
        {label}
      </div>
      {sublabel && (
        <div className="text-xs text-text-tertiary mt-0.5">{sublabel}</div>
      )}
    </div>
  );
}

export default function OptimaPage() {
  const { t, locale } = useTranslation();
  const { model, assumptions, setFinancingPathOverride, setOptimaEuriborRate } = useModelStore();

  // Override financing path to 'optima' for the duration of this page.
  // The layout sets 'commercial' on mount; this overrides that.
  useEffect(() => {
    setFinancingPathOverride("optima");
    return () => {
      setFinancingPathOverride("commercial");
    };
  }, [setFinancingPathOverride]);

  // Live Euribor feed (client-side, ECB SDMX)
  const euribor = useEuribor();
  useEffect(() => {
    if (euribor.rate !== null) setOptimaEuriborRate(euribor.rate);
  }, [euribor.rate, setOptimaEuriborRate]);

  if (!model) {
    return (
      <div className="flex items-center justify-center h-96 text-text-tertiary">
        {t("common.loading")}
      </div>
    );
  }

  const optimaLoan = assumptions.optimaLoan ?? {
    euriborRate: 0.025,
    spreadBps: 250,
    totalTermYears: 12,
    gracePeriodYears: 2,
    repaymentYears: 10,
    splitThresholdEur: 6_000_000,
    absorb: { serviceProviders: true, contingency: true },
  };

  const optimaScenario = model.optimaScenario;
  const stabilisedDscr = optimaScenario?.stabilisedYear?.dscr ?? 0;
  const dscrPass = stabilisedDscr >= (assumptions.dscrCovenantThreshold ?? 1.25);

  // Translated CAPEX view — no raw service-provider breakdown shown.
  const optimaCapex = optimaCapexView(model.capex, optimaLoan.absorb);

  // Construction ratio cap result
  const capResult: OptimaCapResult | null = optimaLoan
    ? computeOptimaCapResult(model.capex, optimaLoan)
    : null;

  // Effective rate = Euribor + spread
  const effectiveRatePct = (optimaLoan.euriborRate + optimaLoan.spreadBps / 10000) * 100;

  // Sub-project CAPEX allocation — use property-based allocation when available
  const totalCapex = model.capex.portfolioTotal;
  const subTotals = capResult?.subProjectTotalsPreCap ?? { A: totalCapex / 2, B: totalCapex / 2 };
  const subACapex = subTotals.A;
  const subBCapex = subTotals.B;

  // Optima loan amount: from keyMetrics when path = optima, else compute from scenario
  // We use optimaScenario to derive loan amount: loan balance at start of repayment.
  // Simpler: use a fixed CAPEX * coverage ratio. But the engine stores loanAmount in
  // keyMetrics only for the active path. We access it via the scenario's debtService year.
  // The cleanest signal is termLoanBalance at end of grace period.
  const graceEndYear = 2026 + optimaLoan.gracePeriodYears;
  const optimaLoanAmountFromScenario = optimaScenario?.pnl.find(
    (p) => p.year === graceEndYear
  )?.termLoanBalance ?? 0;

  // Fall back to portfolio CAPEX × 75% (commercial coverage) if scenario not available
  const optimaLoanAmount = optimaLoanAmountFromScenario > 0
    ? optimaLoanAmountFromScenario
    : totalCapex * 0.75;

  // Sub-project loan allocation proportional to CAPEX split
  const optimaDebtLoan = optimaLoanAmount;
  const subALoan = (subACapex + subBCapex) > 0
    ? optimaDebtLoan * (subACapex / (subACapex + subBCapex))
    : optimaDebtLoan / 2;
  const subBLoan = optimaDebtLoan - subALoan;

  // Projects per sub-project from allocation config
  const allocation = assumptions.optimaLoan?.subProjectAllocation ?? {};
  // Resolve project names from the current portfolio
  const portfolioProjects = model.capex.properties;

  // Optima loan annual DS from scenario
  const optimaAnnualDS = optimaScenario?.pnl.find(
    (p) => p.year === graceEndYear + 1
  )?.debtService ?? 0;

  const termSheetCells = [
    {
      label: t("kpi.loanAmount"),
      value: formatCurrency(optimaLoanAmount, true, locale),
      sub: `2 × ≤ €6M ${t("kpi.ofTotal")}`,
    },
    {
      label: t("dash.termsheet.term"),
      value: t("bank.optima.loanTerm"),
      sub: t("bank.optima.rateNote"),
      isText: true,
    },
    {
      label: t("dash.termsheet.rate"),
      value: `${effectiveRatePct.toFixed(2)}%`,
      sub: `Euribor ${(optimaLoan.euriborRate * 100).toFixed(2)}% + ${(optimaLoan.spreadBps / 100).toFixed(2)}%`,
    },
    {
      label: t("bank.optima.subProjects"),
      value: "2 × ≤ €6M",
      sub: `${t("bank.optima.subProjectA")} + ${t("bank.optima.subProjectB")}`,
      isText: true,
    },
    {
      label: t("term.dscr"),
      value: stabilisedDscr > 0 ? formatMultiple(stabilisedDscr) : "—",
      sub: `Covenant ≥ ${(assumptions.dscrCovenantThreshold ?? 1.25).toFixed(2)}×`,
      tone: dscrPass ? ("positive" as const) : ("warning" as const),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 print:px-0 print:py-2 print:max-w-none animate-fade-in">

      {/* Hero */}
      <div className="text-center mb-8 print:mb-4">
        <p className="text-sm text-brand-500 font-medium uppercase tracking-widest mb-3 print:mb-1">
          {t("bank.optima.eyebrow")}
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-text-primary mb-3 print:text-3xl">
          {t("app.title")}
        </h1>
        <p className="text-sm text-text-secondary mt-1 max-w-xl mx-auto text-center">
          {t("bank.pageIntro")}
        </p>
        <p className="text-text-secondary max-w-xl mx-auto">
          Optima Bank &middot; {t("app.confidential")}
        </p>
      </div>

      {/* Live Euribor badge */}
      <div className="flex justify-center -mt-2 mb-4">
        {euribor.status === 'loading' && (
          <span className="text-xs text-text-tertiary">Fetching live Euribor…</span>
        )}
        {euribor.status === 'live' && euribor.rate !== null && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-positive/10 text-positive border border-positive/20">
            <span className="w-1.5 h-1.5 rounded-full bg-positive inline-block" />
            Live 3M Euribor: {(euribor.rate * 100).toFixed(2)}% · ECB · {euribor.date}
          </span>
        )}
        {euribor.status === 'error' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-amber-50 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            Live rate unavailable — using {((optimaLoan?.euriborRate ?? 0.025) * 100).toFixed(2)}%
          </span>
        )}
      </div>

      {/* Loan Term Sheet strip */}
      <div className="mb-6" id="optima-term-sheet">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          {t("bank.section.termsheet")}
        </h3>
        <div className="bg-white rounded-xl border border-surface-tertiary shadow-sm overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-surface-tertiary">
            {termSheetCells.map((c, i) => (
              <div
                key={c.label}
                className={[
                  "flex flex-col gap-0.5 px-4 py-4",
                  i === 0 ? "pl-5" : "",
                  i === termSheetCells.length - 1 ? "pr-5" : "",
                  c.tone === "positive" ? "bg-positive/[0.03]" : "",
                  c.tone === "warning" ? "bg-warning/[0.04]" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary mb-0.5 leading-none">
                  {c.label}
                </span>
                <span
                  className={[
                    "leading-tight",
                    c.isText
                      ? "font-semibold text-sm text-text-primary"
                      : `font-mono font-bold text-xl ${c.tone === "positive" ? "text-positive" : c.tone === "warning" ? "text-warning" : "text-text-primary"}`,
                  ].join(" ")}
                >
                  {c.value}
                </span>
                {c.sub && (
                  <span className="text-[11px] text-text-tertiary leading-snug">{c.sub}</span>
                )}
                {c.tone && (
                  <span
                    className={[
                      "self-start inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-1",
                      c.tone === "positive"
                        ? "bg-positive/15 text-positive"
                        : "bg-warning/15 text-warning",
                    ].join(" ")}
                  >
                    <span className="w-1 h-1 rounded-full bg-current" aria-hidden="true" />
                    {dscrPass ? t("dash.termsheet.pass") : t("dash.termsheet.fail")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-project split panel */}
      <div className="mb-6" id="optima-subproject-split">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          {t("bank.optima.subProjectA")} / {t("bank.optima.subProjectB")} — {t("capex.totalCapex")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
          {[
            { label: t("bank.optima.subProjectA"), side: 'A' as const, capex: subACapex, loan: subALoan },
            { label: t("bank.optima.subProjectB"), side: 'B' as const, capex: subBCapex, loan: subBLoan },
          ].map((proj) => {
            const projsInSide = portfolioProjects.filter(
              (p) => (allocation[p.id] ?? 'B') === proj.side
            );
            return (
              <div
                key={proj.label}
                className="bg-white rounded-xl border border-surface-tertiary p-5"
              >
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-500 mb-3">
                  {proj.label}
                </div>
                {projsInSide.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {projsInSide.map((p) => (
                      <span key={p.id} className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 text-[11px] font-medium border border-brand-100">
                        {p.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-secondary">{t("kpi.totalInvestment")}</span>
                    <span className="font-mono font-semibold text-text-primary">
                      {formatCurrency(proj.capex, true, locale)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-secondary">{t("kpi.loanAmount")}</span>
                    <span className="font-mono font-semibold text-brand-600">
                      {formatCurrency(proj.loan, true, locale)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-secondary">{t("kpi.ltvAtCompletion")}</span>
                    <span className="font-mono text-text-secondary">
                      {proj.capex > 0 ? formatPercent(proj.loan / proj.capex, 0) : "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Cap badge */}
        {capResult?.applied && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 mb-2">
            {t('bank.optima.capApplied')} — {formatPercent(capResult.maxRatio)} ({t('bank.optima.reducedBy')} {formatCurrency(capResult.reductionEur, false, locale)})
          </div>
        )}
        {/* Split disclaimer */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-900 leading-relaxed">
          {t("bank.optima.splitDisclaimer")}
        </div>
      </div>

      {/* Translated CAPEX table — no raw service-provider breakdown */}
      <div className="mb-6" id="optima-capex">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          {t("capex.title")} — {t("bank.capex.useOfProceeds")}
        </h3>
        <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-secondary/40">
                  <th className="text-left py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium whitespace-nowrap">
                    {t("capex.costCategory")}
                  </th>
                  <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium whitespace-nowrap">
                    {t("capex.total")}
                  </th>
                  <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium whitespace-nowrap">
                    {formatPercent(1, 0)} {t("kpi.ofTotal")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {optimaCapex.categories.map((cat, i) => (
                  <tr
                    key={cat.name}
                    className={`border-t border-surface-secondary/60 ${
                      i % 2 === 0 ? "" : "bg-surface-secondary/10"
                    }`}
                  >
                    <td className="py-2.5 px-5 text-text-secondary whitespace-nowrap">
                      {cat.name}
                    </td>
                    <td className="text-right py-2.5 px-5 font-mono text-sm font-medium text-text-primary">
                      {formatCurrency(cat.grandTotal, false, locale)}
                    </td>
                    <td className="text-right py-2.5 px-5 font-mono text-sm text-text-secondary">
                      {optimaCapex.portfolioTotal > 0
                        ? formatPercent(cat.grandTotal / optimaCapex.portfolioTotal, 0)
                        : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-surface-tertiary bg-surface-secondary/30 font-semibold">
                  <td className="py-3.5 px-5 text-text-primary">{t("capex.totalCapex")}</td>
                  <td className="text-right py-3.5 px-5 font-mono text-brand-600">
                    {formatCurrency(optimaCapex.portfolioTotal, false, locale)}
                  </td>
                  <td className="text-right py-3.5 px-5 font-mono text-text-secondary">
                    100%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-surface-tertiary/50 bg-surface-secondary/10 text-[11px] text-text-tertiary italic">
            {t("bank.optima.capexNote")}
          </div>
        </div>
      </div>

      {/* Loan Metrics strip */}
      {optimaScenario && (
        <div className="bg-white rounded-xl border border-surface-tertiary p-6 shadow-md mb-6" id="optima-loan-metrics">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-primary border-b border-surface-tertiary pb-2 mb-4">
            {t("bank.section.loanMetrics")}
          </h3>
          <div className="grid grid-cols-3 divide-x divide-surface-tertiary mb-4">
            <MetricCell
              value={formatCurrency(totalCapex, true, locale)}
              label={t("kpi.totalInvestment")}
            />
            <MetricCell
              value={formatCurrency(optimaLoanAmount, true, locale)}
              label={t("kpi.loanAmount")}
              sublabel={`${optimaLoanAmount > 0 && totalCapex > 0 ? formatPercent(optimaLoanAmount / totalCapex, 0) : "—"} ${t("bank.kpi.ofCapex")}`}
              valueClass="text-brand-600"
            />
            <MetricCell
              value={optimaAnnualDS > 0 ? formatCurrency(optimaAnnualDS, true, locale) : "—"}
              label={t("kpi.annualDS")}
              sublabel={`${t("bank.optima.loanTerm")}`}
            />
          </div>
          <div className="grid grid-cols-2 divide-x divide-surface-tertiary pt-4 border-t border-surface-tertiary">
            <MetricCell
              value={stabilisedDscr > 0 ? formatMultiple(stabilisedDscr) : "—"}
              label={t("term.dscr")}
              sublabel={t("inv.stabilisedOps")}
              valueClass={stabilisedDscr >= 1.25 ? "text-positive" : "text-warning"}
            />
            <MetricCell
              value={
                optimaScenario.icrStabilised > 0
                  ? formatMultiple(optimaScenario.icrStabilised)
                  : "—"
              }
              label={t("kpi.icr")}
              sublabel={t("kpi.icrSub")}
            />
          </div>
        </div>
      )}

      {/* Sources & Uses */}
      <SourcesUsesPanel
        km={{
          loanAmount: optimaLoanAmount,
          equityRequired: totalCapex - optimaLoanAmount,
          grantAmount: 0,
        }}
        capexCategories={optimaCapex.categories}
        wc={{
          facilitySize: optimaScenario?.wcMinimumFacility ?? 0,
          internalCashBuffer: assumptions.workingCapital.internalCashBuffer ?? 100000,
        }}
        locale={locale}
      />

      {/* Stabilised year snapshot */}
      {optimaScenario?.stabilisedYear && (
        <div className="bg-white rounded-xl border border-surface-tertiary p-6 mb-6">
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            {t("inv.stabilisedOps")}
          </h3>
          <p className="text-xs text-text-tertiary mb-5">{t("bank.stabilisedOpsSub")}</p>
          <div className="space-y-4">
            {[
              {
                label: t("inv.annualRevenue"),
                value: formatCurrency(optimaScenario.stabilisedYear.totalRevenue, true, locale),
              },
              {
                label: t("term.ebitda"),
                value: formatCurrency(optimaScenario.stabilisedYear.ebitda, true, locale),
              },
              {
                label: t("term.ebitdaMargin"),
                value: formatPercent(optimaScenario.stabilisedYear.ebitdaMargin),
              },
              {
                label: t("kpi.annualDS"),
                value: formatCurrency(optimaScenario.stabilisedYear.debtService, true, locale),
              },
              {
                label: t("term.dscr"),
                value: formatMultiple(optimaScenario.stabilisedYear.dscr),
                highlight: true,
              },
              {
                label: t("pnl.ncfPostVAT"),
                value: formatCurrency(optimaScenario.stabilisedYear.netCashFlowPostVAT, true, locale),
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`flex justify-between items-center py-2 ${
                  item.highlight ? "bg-brand-50 -mx-3 px-3 rounded-lg" : ""
                }`}
              >
                <span className="text-sm text-text-secondary">{item.label}</span>
                <span
                  className={`data-cell font-medium ${
                    item.highlight ? "text-brand-600" : "text-text-primary"
                  }`}
                >
                  {item.value}
                </span>
              </div>
            ))}
            <p className="text-xs text-stone-500 mt-1">{t("bank.dscr.mgmtFeeNote")}</p>
          </div>
        </div>
      )}

      {/* P&L Timeline */}
      <div className="mb-6" id="optima-pnl">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          {t("pnl.title")}
        </h3>
        <BankPnLSection />
      </div>

      {/* Construction VAT Cashflow */}
      <div className="mb-6">
        <ConstructionVatCashflow />
      </div>

      {/* Cash-Flow Stress Test */}
      <div className="mb-6 print:hidden" id="optima-stress">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          {t("bank.section.stressAnalysis")}
        </h3>
        <h4 className="text-sm font-semibold text-text-primary mb-3">
          {t("bank.stress.cashFlowHeading")}
        </h4>
        <BankStressTest />
      </div>

      {/* Footer */}
      <div className="text-center py-8 border-t border-surface-tertiary">
        <p className="text-xs text-text-tertiary">
          {t("app.title")} &middot; {t("app.location")} &middot; {t("app.confidential")}
        </p>
        <p className="text-[11px] text-text-tertiary mt-1 italic">
          {t("bank.optima.capexNote")}
        </p>
      </div>
    </div>
  );
}
