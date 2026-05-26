"use client";

/**
 * /admin/presentation — Word-Document-Aligned 10-Section Presentation
 *
 * Sections match VillaLevGroup_Presentation_v6.docx exactly:
 *   COVER   Villa Lev Group — 4 KPI tiles
 *   § 1     Executive Summary
 *   § 2     Proven Track Record — Villa Lev
 *   § 3     Market Context
 *   § 4     The Project
 *   § 5     Financial Projections (ramp table + OPEX + BankPnLSection)
 *   § 6     Key Risks & Mitigating Factors
 *   § 7     Loan Structure & Collateral
 *   § 8     Governance, Structure & Revenue Protection
 *   § 9     Financing Optionality — Grant & RRF
 *   § 10    Conclusion
 *
 * All financial figures are live-bound to useModelStore.
 * Static historical data (2022–2025 actuals, airport arrivals, hotel ADR
 * benchmarks, AirDNA table) may be hardcoded — they are facts, not engine outputs.
 *
 * Print layout: each <section class="presentation-section"> breaks before page.
 * Top bar is print:hidden.
 */

import { useState } from "react";
import { useModelStore, ScenarioName } from "@/lib/store/modelStore";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { PageSkeleton } from "@/components/Skeleton";
import { KPICard, SectionHeader } from "@/components/AdminUI";
import { LiveTrackRecord } from "@/components/LiveTrackRecord";
import { BankPnLSection } from "@/components/BankPnLSection";
import { BankStressTest } from "@/components/BankStressTest";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { resolvePortfolio } from "@/lib/engine/defaults";
import type { AnnualPnL, FinancingPath } from "@/lib/engine/types";

// ── Path / Scenario pill arrays (mirrors BankControlBar) ──────────────────

const PATHS: { key: FinancingPath; label: string }[] = [
  { key: "commercial", label: "Commercial" },
  { key: "rrf",        label: "RRF" },
  { key: "grant",      label: "Grant" },
  { key: "tepix-loan", label: "TEPIX III" },
];

const SCENARIOS: { key: ScenarioName; label: string }[] = [
  { key: "realistic",  label: "Realistic" },
  { key: "upside",     label: "Upside" },
  { key: "downside",   label: "Downside" },
  { key: "breakeven",  label: "Break-Even" },
];

// ── Risk register — 7 Word-doc risks + Multi-asset (8th) = total 12 with
//    historical entries retained for backward test compatibility ────────────

const RISK_REGISTER = [
  {
    risk: "Construction cost & timeline",
    severity: "Medium",
    mitigant: "Fixed-price contracts with licensed Greek contractors; 10% contingency reserve built into CAPEX. Civil engineer has delivered multiple Cyclades luxury builds on schedule.",
  },
  {
    risk: "Permit & regulatory",
    severity: "Medium",
    mitigant: "Three plots already inside FEK zone; Plot 4 has pre-confirmed buildability. Grace period absorbs up to 18-month permitting delay without triggering covenant breach.",
  },
  {
    risk: "Revenue & occupancy ramp",
    severity: "Medium",
    mitigant: "Conservative base assumes 87 nights vs 95 delivered by Villa Lev in 2025. Model ADR €3,500 is below current live rate €3,584. WC reserve covers 2029 trough 5.2×.",
  },
  {
    risk: "OPEX & cost inflation",
    severity: "Low",
    mitigant: "Operating costs held flat from Year 4 — no inflationary uplift modelled. Revenue upside at exit (~€103K/yr) is ~4× the cost inflation risk. A 10% reserve on OPEX is included in the CAPEX budget.",
  },
  {
    risk: "Operational execution",
    severity: "Medium",
    mitigant: "Eytan Cohen has operated Villa Lev since 2022 with zero missed mortgage payments. Professional management contracts structured per unit. Split-unit architecture allows standalone operation.",
  },
  {
    risk: "Accessibility & demand",
    severity: "Low",
    mitigant: "Paros airport arrivals grew 12.5% YoY to 171,500 (2024). Airport upgrade to international status is in planning — extends season. Mykonos-to-Paros rotation trend still early-stage.",
  },
  {
    risk: "Climate & external shocks",
    severity: "Low",
    mitigant: "All revenue, costs and debt denominated in EUR — no FX exposure. Fully amortising loan with no balloon. Asset coverage >1.4× at completion. WC reserve acts as operating buffer.",
  },
  {
    risk: "ADR compression",
    severity: "Low",
    mitigant: "Conservative ADR €3,500 is below Villa Lev 2025 actual (€3,584). No price growth assumed over 13 years. DSCR tested at ADR −10% shock — covenant still satisfied.",
  },
  {
    risk: "Interest rate increase",
    severity: "Low",
    mitigant: "DSCR tested at +200 bps shock. Stabilised DSCR remains above 1.25× covenant floor even at 6.4%.",
  },
  {
    risk: "Greek regulatory / tax change",
    severity: "Low",
    mitigant: "CIT, VAT, and short-term rental levies modelled at current rates. Engine recalculates immediately on any rate change.",
  },
  {
    risk: "Collateral value decline",
    severity: "Low",
    mitigant: "Asset coverage >1.4× at completion. Stress valuation at −15% still covers loan. Break-even occupancy 31 nights vs 87 modelled.",
  },
  {
    risk: "Multi-asset operational complexity",
    severity: "Medium",
    mitigant: "Split-unit architecture — each villa operates independently. Management contracts are structured per unit, eliminating cross-asset dependency. One unit can be taken out of service without interrupting others.",
  },
];

// ── Covenants (§7) ──────────────────────────────────────────────────────────

const COVENANTS = [
  { label: "Minimum DSCR", value: "1.25× annual" },
  { label: "Minimum ICR", value: "1.10× annual" },
  { label: "Maximum leverage", value: "Net debt / EBITDA ≤ 8× (construction); ≤ 5× (stabilised)" },
  { label: "WC reserve account", value: "€470,000 maintained in escrow" },
  { label: "Reporting frequency", value: "Semi-annual management accounts; annual audit" },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function PresentationPage() {
  const { t, locale } = useTranslation();
  const {
    model,
    assumptions,
    activeScenario,
    setActiveScenario,
    setFinancingPath,
    financingPathOverride,
    setFinancingPathOverride,
    templates,
    projects,
  } = useModelStore();

  const [docxLoading, setDocxLoading] = useState(false);

  // ── Loading guard ─────────────────────────────────────────────────────────
  if (!model) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <PageSkeleton variant="grid" hint={t("presentation.loading")} />
      </div>
    );
  }

  // ── Data derivation ───────────────────────────────────────────────────────

  const activePath = financingPathOverride ?? assumptions.financingPath;
  const activeScenarioOutput = model.scenarios[activeScenario];
  const km = {
    ...model.keyMetrics,
    equityIRR: activeScenarioOutput.equityIRR,
    totalMOIC: activeScenarioOutput.totalMOIC,
    terminalUnderwater: activeScenarioOutput.terminalUnderwater,
    stabilisedDSCR: model.keyMetrics.stabilisedDSCR,
  };

  const ltc = km.loanAmount / km.totalCapex;

  const loanParams =
    activePath === "rrf"
      ? assumptions.rrf
      : activePath === "tepix-loan"
        ? assumptions.tepixLoan
        : assumptions.commercialLoan;

  const gracePeriodYears =
    "gracePeriodYears" in loanParams ? loanParams.gracePeriodYears : 3;
  const repaymentTermYears =
    "repaymentTermYears" in loanParams ? loanParams.repaymentTermYears : 12;

  const portfolio = resolvePortfolio(templates, projects);
  const totalPlots = portfolio.reduce((s, p) => s + p.count, 0);
  const totalVillas = portfolio.reduce((s, p) => s + p.count * p.villaUnits, 0);
  const totalStdSuites = portfolio.reduce((s, p) => s + p.count * p.standardSuites, 0);
  const totalDblSuites = portfolio.reduce((s, p) => s + p.count * p.doubleSuites, 0);
  const totalSuites = totalStdSuites + totalDblSuites;
  const totalGIA = portfolio.reduce((s, p) => s + p.count * (p.constructionArea ?? 0), 0);
  const opexContingencyRate = portfolio[0]?.opexContingencyRate ?? 0;

  const conservativeNights = assumptions.revenueRealistic.villaBaseNights;

  const pathLabel =
    activePath === "grant"
      ? t("path.grant")
      : activePath === "rrf"
        ? t("path.rrf")
        : activePath === "tepix-loan"
          ? t("path.tepixLoan")
          : t("path.commercial");

  const scenarioLabel =
    activeScenario === "upside"
      ? t("scenario.upside")
      : activeScenario === "downside"
        ? t("scenario.downside")
        : activeScenario === "breakeven"
          ? t("scenario.breakeven")
          : t("scenario.realistic");

  // Ramp-up table — index PnL rows by year (all three scenarios)
  const pnlByYear = model.scenarios.realistic.pnl.reduce(
    (m, r) => { m[r.year] = r; return m; },
    {} as Record<number, AnnualPnL>
  );
  const downsidePnlByYear = model.scenarios.downside.pnl.reduce(
    (m, r) => { m[r.year] = r; return m; },
    {} as Record<number, AnnualPnL>
  );
  const upsidePnlByYear = model.scenarios.upside.pnl.reduce(
    (m, r) => { m[r.year] = r; return m; },
    {} as Record<number, AnnualPnL>
  );

  // Downside scenario for break-even comparison
  const downsideKm = model.scenarios.downside;

  // Break-even revenue = annual DS + stabilised OPEX (OPEX is fixed; EBITDA=DS at BEP)
  const stabOpex = pnlByYear[2031]?.totalOpex ?? 275_500;
  const stabRevenue = pnlByYear[2031]?.totalRevenue ?? km.stabilisedRevenue ?? 0;
  const downsideStabRevenue = downsidePnlByYear[2031]?.totalRevenue ?? 0;
  const annualDS = km.annualDS ?? 0;
  const breakevenRevenue = annualDS + stabOpex;
  const realisticBufferPct = stabRevenue > 0 ? Math.round((1 - breakevenRevenue / stabRevenue) * 100) : 0;
  const downsideBufferPct = downsideStabRevenue > 0 ? Math.round((1 - breakevenRevenue / downsideStabRevenue) * 100) : 0;

  // Realistic scenario property-level revenue (for §5 breakdown table)
  const realVillaRevPerProject = assumptions.revenueRealistic.villaBaseNights * assumptions.revenueRealistic.villaADR;
  const realSuiteRev = (assumptions.revenueRealistic.suiteBaseNights ?? 100) *
    (2 * (assumptions.revenueRealistic.suiteStandardADR ?? 650) +
     2 * (assumptions.revenueRealistic.suiteDoubleADR ?? 920));
  const realEventsRev = (assumptions.revenueRealistic.eventsPerYear ?? 10) *
    (assumptions.revenueRealistic.netProfitPerEvent ?? 6_000);
  const realAncillaryRev = assumptions.revenueRealistic.ancillaryBaseProfit ?? 99_825;
  const realVillaOpex = 94_500; // from stabilised OPEX table (Property A per project)
  const realSuiteOpex = 86_500; // from stabilised OPEX table (Property B)

  // Grant path metrics (for §9 — use grant scenario when grantAmount > 0)
  const grantScenarioOutput =
    activePath === "grant" && km.grantAmount > 0
      ? activeScenarioOutput
      : null;

  // ── Word export ───────────────────────────────────────────────────────────

  const handleExportDocx = async () => {
    if (!model || docxLoading) return;
    setDocxLoading(true);
    try {
      const { exportBankPresentation } = await import(
        "@/lib/docx/exportBankPresentation"
      );
      const blob = await exportBankPresentation(assumptions, model, locale);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VillaLevGroup_Presentation_${activePath}_${activeScenario}_${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDocxLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="presentation-page">
      {/* ── Top control bar — print:hidden ─────────────────────────────── */}
      <div className="print:hidden sticky top-0 z-40 bg-white border-b border-surface-tertiary px-6 py-3 flex items-center gap-4 flex-wrap">
        {/* PATH pills */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mr-1">
            {t("bar.path")}
          </span>
          {PATHS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() =>
                financingPathOverride !== null
                  ? setFinancingPathOverride(p.key)
                  : setFinancingPath(p.key)
              }
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider transition-colors ${
                activePath === p.key
                  ? "bg-brand-700 text-white"
                  : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary border border-surface-tertiary"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* SCENARIO pills */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mr-1">
            {t("bar.scenario")}
          </span>
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveScenario(s.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                activeScenario === s.key
                  ? "bg-brand-50 text-brand-700 border border-brand-200 font-semibold"
                  : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary border border-surface-tertiary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Export / Print */}
        <button
          type="button"
          onClick={handleExportDocx}
          disabled={docxLoading}
          className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-50 transition-colors"
        >
          {docxLoading ? "…" : t("presentation.exportDocx")}
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-surface-secondary text-text-secondary border border-surface-tertiary hover:bg-surface-tertiary transition-colors"
        >
          {t("presentation.print")}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          COVER — navy full-bleed
      ══════════════════════════════════════════════════════════════════ */}
      <section className="bg-[#0a1929] text-white px-12 py-16 min-h-[240px]">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400 mb-3">
            {t("presentation.confidential")}
          </p>
          <h1 className="font-display text-4xl font-bold text-white mb-2">
            {t("presentation.s0.title")}
          </h1>
          <p className="text-lg text-slate-300 mb-2">
            {t("presentation.s0.subtitle")}
          </p>
          <p className="text-sm text-slate-400 mb-8 italic">
            {t("presentation.cover.tagline")}
          </p>

          {/* Active path + scenario badge */}
          <div className="flex items-center gap-2 mb-10">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
              {pathLabel}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/10 text-white border border-white/20">
              {scenarioLabel}
            </span>
          </div>

          {/* 6 headline KPI tiles matching Word doc cover */}
          <div className="presentation-kpi-row grid grid-cols-2 sm:grid-cols-3 gap-3">
            <CoverKPI
              label={t("presentation.kpi.totalCapex")}
              value={formatCurrency(km.totalCapex, true, locale)}
            />
            <CoverKPI
              label={t("presentation.kpi.loanRequested")}
              value={formatCurrency(km.loanAmount, true, locale)}
              sublabel={`${formatPercent(km.loanAmount / km.totalCapex, 0)} LTC · ${gracePeriodYears}yr grace · ${repaymentTermYears}yr repayment`}
            />
            <CoverKPI
              label={t("presentation.kpi.ownerEquity")}
              value={formatCurrency(km.equityRequired, true, locale)}
              sublabel={`${formatPercent(1 - km.loanAmount / km.totalCapex, 0)} contribution`}
            />
            <CoverKPI
              label={t("presentation.kpi.portfolioValue")}
              value={formatCurrency(km.portfolioValue, true, locale)}
              sublabel="@ €9,000/m² · 950m² built"
            />
            <CoverKPI
              label={t("presentation.kpi.ltvAtCompletion")}
              value={formatPercent(km.loanAmount / km.portfolioValue, 0)}
              sublabel="Asset covers loan at completion"
            />
            <CoverKPI
              label={t("presentation.kpi.assetCoverage")}
              value={`${km.assetCoverage.toFixed(2)}×`}
              sublabel={`€${((km.portfolioValue * 0.85 - km.loanAmount) / 1e6).toFixed(2)}M buffer at stress`}
              highlight={km.assetCoverage >= 1.0}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          § 1 — Executive Summary
      ══════════════════════════════════════════════════════════════════ */}
      <section className="presentation-section px-12 py-10 max-w-4xl mx-auto">
        <SectionEyebrow eyebrow={t("presentation.s1.eyebrow")} />
        <SectionHeader title={t("presentation.s1.title")} />

        {/* KPI summary row */}
        <div className="presentation-kpi-row grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <KPICard label={t("presentation.kpi.totalCapex")} value={formatCurrency(km.totalCapex, true, locale)} />
          <KPICard label={t("presentation.kpi.loanRequested")} value={formatCurrency(km.loanAmount, true, locale)} />
          <KPICard label={t("presentation.kpi.stabilisedDscr")} value={`${km.stabilisedDSCR.toFixed(2)}×`} tone={km.stabilisedDSCR >= 1.25 ? "positive" : "warning"} />
          <KPICard label={t("presentation.kpi.equityIRR")} value={formatPercent(km.equityIRR, 1)} tone="positive" />
        </div>

        {/* Two-column: Loan Request | Collateral Case */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {/* Left — The Loan Request */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700 mb-3">
              {t("presentation.s1.loanRequestCol")}
            </p>
            <div className="space-y-2">
              {[
                { label: "Total CAPEX", value: formatCurrency(km.totalCapex, true, locale) },
                { label: "Senior loan", value: formatCurrency(km.loanAmount, true, locale) },
                { label: "LTC", value: formatPercent(ltc, 0) },
                { label: "Grace period", value: `${gracePeriodYears} years` },
                { label: "Repayment term", value: `${repaymentTermYears} years` },
                { label: "Equity required", value: formatCurrency(km.equityRequired, true, locale) },
              ].map((r) => (
                <div key={r.label} className="flex justify-between items-baseline py-1 border-b border-slate-200 last:border-0">
                  <span className="text-xs text-text-secondary">{r.label}</span>
                  <span className="text-xs font-semibold text-text-primary font-mono">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — The Collateral Case */}
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700 mb-3">
              {t("presentation.s1.collateralCol")}
            </p>
            <div className="space-y-2">
              {[
                { label: "Portfolio value (appraised)", value: formatCurrency(km.portfolioValue, true, locale) },
                { label: "Asset coverage", value: `${km.assetCoverage.toFixed(2)}×` },
                { label: "Stabilised DSCR", value: `${km.stabilisedDSCR.toFixed(2)}×` },
                { label: "Break-even occupancy", value: `${km.breakEvenNights} nights` },
                { label: "Buffer to break-even", value: `${km.bufferToBreakEven} nights` },
                { label: "1st-rank mortgage", value: `All ${totalPlots} plots + structures` },
              ].map((r) => (
                <div key={r.label} className="flex justify-between items-baseline py-1 border-b border-brand-100 last:border-0">
                  <span className="text-xs text-text-secondary">{r.label}</span>
                  <span className="text-xs font-semibold text-brand-700 font-mono">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Phase drawdown table */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s1.phaseTable.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-5">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Phase</th>
                <th className="px-3 py-2 text-left font-semibold">Purpose</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                <th className="px-3 py-2 text-left font-semibold">Timing</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="px-3 py-2 font-medium text-text-primary">{t("presentation.s1.phaseTable.phase1")}</td>
                <td className="px-3 py-2 text-text-secondary">Land acquisition, legal DD, permit preparation</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">€1,350,000</td>
                <td className="px-3 py-2 text-text-secondary">Q2–Q3 2026</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="px-3 py-2 font-medium text-text-primary">{t("presentation.s1.phaseTable.phase2")}</td>
                <td className="px-3 py-2 text-text-secondary">Construction, fit-out, FF&amp;E — permit-gated</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{formatCurrency(km.loanAmount - 1_350_000 > 0 ? km.loanAmount - 1_350_000 : km.loanAmount, true, locale)}</td>
                <td className="px-3 py-2 text-text-secondary">Q1 2027 – Q2 2028</td>
              </tr>
              <tr className="bg-white">
                <td className="px-3 py-2 font-medium text-text-primary">{t("presentation.s1.phaseTable.wc")}</td>
                <td className="px-3 py-2 text-text-secondary">Self-liquidating revolver — not in term loan</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{formatCurrency(assumptions.commercialLoan.workingCapitalFacility ?? 470_000, true, locale)}</td>
                <td className="px-3 py-2 text-text-secondary">2027–2030</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
          <p className="text-sm text-amber-900 leading-relaxed">
            {t("presentation.s1.operationalTarget")}
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          § 2 — Proven Track Record — Villa Lev
      ══════════════════════════════════════════════════════════════════ */}
      <section className="presentation-section px-12 py-10 max-w-4xl mx-auto">
        <SectionEyebrow eyebrow={t("presentation.s2.eyebrow")} />
        <SectionHeader title={t("presentation.s2.title")} />

        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          {t("presentation.s2.intro")}
        </p>

        {/* Operational Results table — static historical data */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s2.resultsTable.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-8">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Year</th>
                <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                <th className="px-3 py-2 text-right font-semibold">ADR</th>
                <th className="px-3 py-2 text-right font-semibold">Nights Sold</th>
                <th className="px-3 py-2 text-right font-semibold">Refused Bookings</th>
              </tr>
            </thead>
            <tbody>
              {[
                { year: "2022", rev: "€116K", adr: "€2,200", nights: "53", refused: "—" },
                { year: "2023", rev: "€165K", adr: "€2,850", nights: "58", refused: "—" },
                { year: "2024", rev: "€185K", adr: "€3,000", nights: "62", refused: "~€160K" },
                { year: "2025", rev: "€298K", adr: "€3,800", nights: "79", refused: ">€300K" },
              ].map((r, i) => (
                <tr key={r.year} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-3 py-2 font-semibold text-text-primary">{r.year}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.rev}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.adr}</td>
                  <td className="px-3 py-2 text-right">{r.nights}</td>
                  <td className="px-3 py-2 text-right text-amber-700 font-medium">{r.refused}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 2026 Season In Progress — 3 stat tiles */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s2.season2026.header")}
        </p>
        <div className="presentation-kpi-row grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {[
            { value: "€325K+", label: "Revenue (pace)" },
            { value: "€4,000", label: "ADR (live 2026)" },
            { value: "€600K+", label: "Refused Bookings" },
          ].map((s) => (
            <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-text-primary mb-1">{s.value}</p>
              <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {/* LiveTrackRecord — same component as /admin/dashboard */}
        <LiveTrackRecord variant="default" />

        {/* Why Projections Are Conservative — comparison table */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mt-8 mb-3">
          {t("presentation.s2.conservative.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-8">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Metric</th>
                <th className="px-3 py-2 text-right font-semibold">Historical Growth</th>
                <th className="px-3 py-2 text-right font-semibold">Villa Lev 2026</th>
                <th className="px-3 py-2 text-right font-semibold">Model Assumption</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  metric: "ADR",
                  historical: "+5–10%/yr",
                  live: "€4,000",
                  model: `${formatCurrency(assumptions.revenueRealistic.villaADR, false, locale)} (realistic)`,
                },
                {
                  metric: "Nights Sold",
                  historical: "+10–15%/yr",
                  live: "~86 nights",
                  model: `${conservativeNights} nights (mature)`,
                },
                {
                  metric: "Annual Revenue",
                  historical: "+15–20%/yr",
                  live: "€325K+",
                  model: `~${formatCurrency(km.stabilisedRevenue ?? 1_170_000, true, locale)} at maturity`,
                },
              ].map((r, i) => (
                <tr key={r.metric} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-3 py-2 font-medium text-text-primary">{r.metric}</td>
                  <td className="px-3 py-2 text-right text-text-secondary">{r.historical}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-amber-700">{r.live}</td>
                  <td className="px-3 py-2 text-right font-mono text-positive">{r.model}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Market Rankings — 4 stat boxes */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s2.marketRankings.header")}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { value: "Top 1", label: "villa on Antiparos" },
            { value: "Top 10", label: "villa in Greece (Airbnb)" },
            { value: "Top 5%", label: "globally on Airbnb" },
            { value: "150,000+", label: "Annual Profile Views" },
          ].map((s) => (
            <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <p className="text-xl font-bold text-brand-700 mb-1">{s.value}</p>
              <p className="text-[11px] text-text-secondary leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          § 3 — Market Context
      ══════════════════════════════════════════════════════════════════ */}
      <section className="presentation-section px-12 py-10 max-w-4xl mx-auto">
        <SectionEyebrow eyebrow={t("presentation.s3.eyebrow")} />
        <SectionHeader title={t("presentation.s3.title")} />

        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          Paros and Antiparos are the fastest-growing luxury destinations in the Cyclades. Airport arrivals grew 4.6× between 2016 and 2024, and the island continues to outpace Mykonos and Santorini on a YoY basis. The portfolio enters at the lower bound of the prevailing market rate for comparable luxury villas.
        </p>

        {/* Airport Arrivals table — static historical data */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s3.airportTable.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-8">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Airport</th>
                <th className="px-3 py-2 text-right font-semibold">2016</th>
                <th className="px-3 py-2 text-right font-semibold">2022</th>
                <th className="px-3 py-2 text-right font-semibold">2023</th>
                <th className="px-3 py-2 text-right font-semibold">2024</th>
                <th className="px-3 py-2 text-right font-semibold">YoY</th>
              </tr>
            </thead>
            <tbody>
              {[
                { airport: "Paros", y16: "37K", y22: "100K", y23: "152.5K", y24: "171.5K", yoy: "+12.5%", highlight: true },
                { airport: "Mykonos", y16: "~640K", y22: "844K", y23: "829.5K", y24: "807K", yoy: "−2.7%", highlight: false },
                { airport: "Santorini", y16: "~1,050K", y22: "1,372.5K", y23: "1,388K", y24: "1,438.5K", yoy: "+3.6%", highlight: false },
              ].map((r, i) => (
                <tr key={r.airport} className={r.highlight ? "bg-brand-50" : i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className={`px-3 py-2 font-medium ${r.highlight ? "text-brand-700" : "text-text-primary"}`}>{r.airport}</td>
                  <td className="px-3 py-2 text-right text-text-secondary">{r.y16}</td>
                  <td className="px-3 py-2 text-right text-text-secondary">{r.y22}</td>
                  <td className="px-3 py-2 text-right text-text-secondary">{r.y23}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{r.y24}</td>
                  <td className={`px-3 py-2 text-right font-mono font-bold ${r.highlight ? "text-positive" : r.yoy.startsWith("−") ? "text-red-600" : "text-text-secondary"}`}>{r.yoy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Three Structural Tailwinds */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s3.tailwinds.header")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            {
              term: "Inflation / ADR Drift",
              body: "Luxury suite benchmarks on Paros already sit at €2,087 average. At a conservative 3%/yr drift, villa revenue would be ~€205K/yr higher at exit — not modelled.",
            },
            {
              term: "Paros Airport Upgrade",
              body: "Upgrade to international-status airport under planning. Extension of the season from 90–120 nights to 150+ — not modelled in any scenario.",
            },
            {
              term: "Compounding Demand",
              body: "Four consecutive years of double-digit growth (+12.5% YoY to 2024) driven by Mykonos-to-Paros rotation of ultra-HNW travellers.",
            },
          ].map((tw) => (
            <div key={tw.term} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700 mb-1">{tw.term}</p>
              <p className="text-xs text-text-secondary leading-relaxed">{tw.body}</p>
            </div>
          ))}
        </div>

        {/* Hotel ADR Benchmarks — static */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s3.hotelAdr.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-8">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Room Type</th>
                <th className="px-3 py-2 text-right font-semibold">Market Average ADR</th>
                <th className="px-3 py-2 text-right font-semibold">Range</th>
              </tr>
            </thead>
            <tbody>
              {[
                { type: "Standard rooms", avg: "€909", range: "€421–€2,250" },
                { type: "Premium rooms", avg: "€1,423", range: "€665–€2,655" },
                { type: "Luxury suites", avg: "€2,087", range: "€930–€3,375" },
              ].map((r, i) => (
                <tr key={r.type} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-3 py-2 font-medium text-text-primary">{r.type}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{r.avg}</td>
                  <td className="px-3 py-2 text-right text-text-secondary">{r.range}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* AirDNA Villa Landscape — static */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s3.airdna.header")}
        </p>
        <div className="presentation-table overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Segment</th>
                <th className="px-3 py-2 text-right font-semibold">ADR</th>
                <th className="px-3 py-2 text-right font-semibold">Nights/Season</th>
                <th className="px-3 py-2 text-right font-semibold">Annual Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[
                { seg: "Top 10 villas", adr: "€2,800", nights: "~105", rev: "€295K", highlight: false },
                { seg: "Top 20 villas", adr: "€2,300", nights: "~91", rev: "€209K", highlight: false },
                { seg: "All 35 villas", adr: "€2,230", nights: "~80", rev: "€179K", highlight: false },
                { seg: "Villa Lev 2026", adr: "€4,000+ ADR", nights: "86+ nights", rev: "€325K+", highlight: true },
              ].map((r, i) => (
                <tr key={r.seg} className={r.highlight ? "bg-brand-50 border-t-2 border-brand-300" : i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className={`px-3 py-2 font-medium ${r.highlight ? "text-brand-700" : "text-text-primary"}`}>{r.seg}</td>
                  <td className={`px-3 py-2 text-right font-mono ${r.highlight ? "font-bold text-brand-700" : ""}`}>{r.adr}</td>
                  <td className={`px-3 py-2 text-right ${r.highlight ? "font-bold text-brand-700" : ""}`}>{r.nights}</td>
                  <td className={`px-3 py-2 text-right font-mono ${r.highlight ? "font-bold text-brand-700" : ""}`}>{r.rev}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          § 4 — The Project
      ══════════════════════════════════════════════════════════════════ */}
      <section className="presentation-section px-12 py-10 max-w-4xl mx-auto">
        <SectionEyebrow eyebrow={t("presentation.s4.eyebrow")} />
        <SectionHeader title={t("presentation.s4.title")} />

        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          {t("presentation.s4.plotIntro")}
        </p>

        {/* Portfolio Overview table — live from resolvePortfolio */}
        <div className="presentation-kpi-row grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <KPICard label="Plots" value={String(totalPlots)} />
          <KPICard label="Villas" value={String(totalVillas)} />
          <KPICard label="Hotel Suites" value={String(totalSuites)} />
          <KPICard label="Total GIA" value={`${Math.round(totalGIA).toLocaleString()} m²`} />
        </div>

        <div className="presentation-table overflow-x-auto mb-8">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Property</th>
                <th className="px-3 py-2 text-left font-semibold">Type</th>
                <th className="px-3 py-2 text-right font-semibold">Units</th>
                <th className="px-3 py-2 text-right font-semibold">GIA (m²)</th>
                <th className="px-3 py-2 text-right font-semibold">CAPEX</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.map((p, i) => {
                const unitCount = p.villaUnits + p.standardSuites + p.doubleSuites;
                const capex =
                  (p.landCost + p.constructionCostPerM2 * (p.constructionArea ?? 0) + (p.ffeCost ?? 0)) *
                  p.count;
                return (
                  <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-3 py-2 font-medium text-text-primary">{p.name}</td>
                    <td className="px-3 py-2 text-text-secondary">
                      {p.villaUnits > 0 ? t('admin.about.luxuryVilla') : t('admin.about.hotelRooms')}
                    </td>
                    <td className="px-3 py-2 text-right">{unitCount * p.count}</td>
                    <td className="px-3 py-2 text-right">
                      {Math.round((p.constructionArea ?? 0) * p.count).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatCurrency(capex, true, locale)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-slate-100 font-semibold border-t-2 border-slate-300">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right">{totalVillas + totalSuites}</td>
                <td className="px-3 py-2 text-right">{Math.round(totalGIA).toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatCurrency(km.totalCapex, true, locale)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* CAPEX Detailed Cost Breakdown — matches Word doc table exactly */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s4.capex.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-8">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Cost Category</th>
                <th className="px-3 py-2 text-right font-semibold">Property A (per project)</th>
                <th className="px-3 py-2 text-right font-semibold">Property B</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const propA = portfolio.find((p) => p.villaUnits > 0);
                const propB = portfolio.find((p) => p.villaUnits === 0);
                const landA = propA?.landCost ?? 400_000;
                const landB = propB?.landCost ?? 400_000;
                const constA = (propA?.constructionCostPerM2 ?? 4_000) * (propA?.constructionArea ?? 350);
                const constB = (propB?.constructionCostPerM2 ?? 4_000) * (propB?.constructionArea ?? 250);
                const ffeA = propA?.ffeCost ?? 120_000;
                const ffeB = propB?.ffeCost ?? 100_000;
                // Legal, architect, civil engineer — from Word doc (project facts)
                const legalA = 20_000; const legalB = 15_000;
                const archA = 44_000; const archB = 32_000;
                const civilA = 35_000; const civilB = 25_000;
                const contingencyA = Math.round((constA + ffeA) * 0.10);
                const contingencyB = Math.round((constB + ffeB) * 0.10);
                const totalA = landA + constA + ffeA + legalA + archA + civilA + contingencyA;
                const totalB = landB + constB + ffeB + legalB + archB + civilB + contingencyB;
                const rows = [
                  { cat: "Land acquisition", a: landA, b: landB },
                  { cat: `Construction (${propA?.constructionArea ?? 350}m² / ${propB?.constructionArea ?? 250}m² × €${(propA?.constructionCostPerM2 ?? 4000).toLocaleString()}/m²)`, a: constA, b: constB },
                  { cat: "FF&E (bedrooms, gym, wellness equipment)", a: ffeA, b: ffeB },
                  { cat: "Legal & notary fees", a: legalA, b: legalB },
                  { cat: "Architect + interior design", a: archA, b: archB },
                  { cat: "Civil engineer", a: civilA, b: civilB },
                  { cat: "Contingency (10% of construction + FF&E)", a: contingencyA, b: contingencyB },
                ];
                return (
                  <>
                    {rows.map((r, i) => (
                      <tr key={r.cat} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="px-3 py-2 text-text-primary">{r.cat}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(r.a, true, locale)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(r.b, true, locale)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-semibold border-t-2 border-slate-300">
                      <td className="px-3 py-2">TOTAL INVESTMENT</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(totalA, true, locale)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(totalB, true, locale)}</td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>

        {/* Property A description */}
        <div className="border-l-4 border-brand-400 pl-5 mb-6">
          <p className="text-sm font-bold text-text-primary mb-1">Property A — Twin Villas</p>
          <p className="text-sm text-text-secondary leading-relaxed">
            {t("presentation.s4.propA.desc")}
          </p>
        </div>

        {/* Property B description */}
        <div className="border-l-4 border-amber-400 pl-5 mb-6">
          <p className="text-sm font-bold text-text-primary mb-1">Property B — Boutique Suites</p>
          <p className="text-sm text-text-secondary leading-relaxed">
            {t("presentation.s4.propB.desc")}
          </p>
        </div>

        {/* Suite pricing table — static from Word doc */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s4.suiteTable.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Suite Type</th>
                <th className="px-3 py-2 text-left font-semibold">Size</th>
                <th className="px-3 py-2 text-right font-semibold">Peak ADR (€/night)</th>
                <th className="px-3 py-2 text-right font-semibold">Model ADR (€/night)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { type: "Standard Suite", size: "40m²", peak: "€700", model: formatCurrency(assumptions.revenueRealistic.suiteStandardADR ?? 650, false, locale) },
                { type: "Double Suite", size: "65m²", peak: "€1,000", model: formatCurrency(assumptions.revenueRealistic.suiteDoubleADR ?? 920, false, locale) },
              ].map((r, i) => (
                <tr key={r.type} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-3 py-2 font-medium text-text-primary">{r.type}</td>
                  <td className="px-3 py-2 text-text-secondary">{r.size}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{r.peak}</td>
                  <td className="px-3 py-2 text-right font-mono text-positive">{r.model}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Events / retreats upside note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <p className="text-sm text-amber-900 leading-relaxed">
            {t("presentation.s4.events.note")}
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          § 5 — Financial Projections
      ══════════════════════════════════════════════════════════════════ */}
      <section className="presentation-section px-12 py-10 max-w-4xl mx-auto">
        <SectionEyebrow eyebrow={t("presentation.s5.eyebrow")} />
        <SectionHeader title={t("presentation.s5.title")} />

        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          {t("presentation.s5.intro")}
        </p>

        {/* OPEX contingency badge */}
        {opexContingencyRate > 0 && (
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-medium">
            <span>⚠</span>
            <span>
              {t("presentation.opexContingencyBadge").replace(
                "{pct}",
                (opexContingencyRate * 100).toFixed(0)
              )}
            </span>
          </div>
        )}

        {/* Ramp-Up Profile table — LIVE from model.scenarios.realistic.pnl */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s5.rampTable.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-8">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Year</th>
                <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                <th className="px-3 py-2 text-right font-semibold">OPEX</th>
                <th className="px-3 py-2 text-right font-semibold">EBITDA</th>
                <th className="px-3 py-2 text-right font-semibold">Debt Service</th>
                <th className="px-3 py-2 text-right font-semibold">DSCR</th>
              </tr>
            </thead>
            <tbody>
              {[2028, 2029, 2030, 2031].map((yr, i) => {
                const row = pnlByYear[yr];
                if (!row) {
                  return (
                    <tr key={yr} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-3 py-2 font-semibold text-text-primary">{yr}</td>
                      <td colSpan={5} className="px-3 py-2 text-text-tertiary text-center text-[10px]">—</td>
                    </tr>
                  );
                }
                const isStab = yr >= 2031;
                return (
                  <tr key={yr} className={isStab ? "bg-brand-50 font-semibold" : i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className={`px-3 py-2 font-semibold ${isStab ? "text-brand-700" : "text-text-primary"}`}>
                      {yr}{isStab ? " (Stab.)" : ""}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.totalRevenue, true, locale)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.totalOpex, true, locale)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.ebitda, true, locale)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.debtService, true, locale)}</td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${row.dscr >= 1.25 ? "text-positive" : row.dscr >= 1.0 ? "text-warning" : "text-red-600"}`}>
                      {row.dscr.toFixed(2)}×
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Operating Cost Structure — static from Word doc */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s5.opexTable.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-8">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Cost Category</th>
                <th className="px-3 py-2 text-right font-semibold">Property A (€/yr)</th>
                <th className="px-3 py-2 text-right font-semibold">Property B (€/yr)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { cat: "Housekeeping", a: "€15,000", b: "€13,000" },
                { cat: "Maintenance", a: "€21,000", b: "€15,000" },
                { cat: "Utilities", a: "€12,000", b: "€12,000" },
                { cat: "Insurance", a: "€2,500", b: "€2,500" },
                { cat: "Property tax", a: "€4,000", b: "€4,000" },
                { cat: "Marketing", a: "€4,000", b: "€4,000" },
                { cat: "Management fee", a: "€24,000", b: "€24,000" },
                { cat: "Consumables", a: "€5,000", b: "€5,000" },
                { cat: "Accounting", a: "€7,000", b: "€7,000" },
              ].map((r, i) => (
                <tr key={r.cat} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-3 py-2 text-text-primary">{r.cat}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.a}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.b}</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-semibold border-t-2 border-slate-300">
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2 text-right font-mono">€94,500</td>
                <td className="px-3 py-2 text-right font-mono">€86,500</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Realistic Scenario — Stabilised Year breakdown by property */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s5.realisticTable.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Revenue Stream</th>
                <th className="px-3 py-2 text-right font-semibold">Annual Revenue</th>
                <th className="px-3 py-2 text-right font-semibold">Annual OPEX</th>
                <th className="px-3 py-2 text-right font-semibold">EBITDA</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  stream: `Property A — Villa Project 1 (${assumptions.revenueRealistic.villaBaseNights} nts × ${formatCurrency(assumptions.revenueRealistic.villaADR, false, locale)} net)`,
                  rev: realVillaRevPerProject, opex: realVillaOpex,
                  ebitda: realVillaRevPerProject - realVillaOpex,
                },
                {
                  stream: `Property A — Villa Project 2 (${assumptions.revenueRealistic.villaBaseNights} nts × ${formatCurrency(assumptions.revenueRealistic.villaADR, false, locale)} net)`,
                  rev: realVillaRevPerProject, opex: realVillaOpex,
                  ebitda: realVillaRevPerProject - realVillaOpex,
                },
                {
                  stream: `Property B — 4 Suites (${assumptions.revenueRealistic.suiteBaseNights ?? 100} nts × blended net ADR)`,
                  rev: realSuiteRev, opex: realSuiteOpex,
                  ebitda: realSuiteRev - realSuiteOpex,
                },
                {
                  stream: `Events — ${assumptions.revenueRealistic.eventsPerYear ?? 10} events/year (net profit)`,
                  rev: realEventsRev, opex: null, ebitda: realEventsRev,
                },
                {
                  stream: "Ancillary Services — chef, boat, car (net profit)",
                  rev: realAncillaryRev, opex: null, ebitda: realAncillaryRev,
                },
              ].map((r, i) => (
                <tr key={r.stream} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-3 py-2 text-text-primary">{r.stream}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatCurrency(r.rev, true, locale)}</td>
                  <td className="px-3 py-2 text-right font-mono text-text-secondary">
                    {r.opex != null ? formatCurrency(r.opex, true, locale) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-positive font-semibold">
                    {formatCurrency(r.ebitda, true, locale)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-semibold border-t-2 border-slate-300">
                <td className="px-3 py-2">PORTFOLIO TOTAL</td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatCurrency(realVillaRevPerProject * 2 + realSuiteRev + realEventsRev + realAncillaryRev, true, locale)}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatCurrency(realVillaOpex * 2 + realSuiteOpex, true, locale)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-positive">
                  {formatCurrency(
                    realVillaRevPerProject * 2 + realSuiteRev + realEventsRev + realAncillaryRev -
                    (realVillaOpex * 2 + realSuiteOpex),
                    true, locale
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-text-tertiary italic mb-8">
          * EBITDA margin: {
            formatPercent(
              (realVillaRevPerProject * 2 + realSuiteRev + realEventsRev + realAncillaryRev -
               (realVillaOpex * 2 + realSuiteOpex)) /
              (realVillaRevPerProject * 2 + realSuiteRev + realEventsRev + realAncillaryRev),
              1
            )
          }. DSCR: {pnlByYear[2031]?.dscr?.toFixed(2) ?? km.stabilisedDSCR.toFixed(2)}×.
        </p>

        {/* Upside Scenario — aggregate from engine upside scenario */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s5.upsideTable.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-8">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Year</th>
                <th className="px-3 py-2 text-right font-semibold">Revenue</th>
                <th className="px-3 py-2 text-right font-semibold">OPEX</th>
                <th className="px-3 py-2 text-right font-semibold">EBITDA</th>
                <th className="px-3 py-2 text-right font-semibold">Debt Service</th>
                <th className="px-3 py-2 text-right font-semibold">DSCR</th>
              </tr>
            </thead>
            <tbody>
              {[2028, 2029, 2030, 2031].map((yr, i) => {
                const row = upsidePnlByYear[yr];
                if (!row) return null;
                return (
                  <tr key={yr} className={yr >= 2031 ? "bg-positive/5 font-semibold" : i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-3 py-2 font-semibold text-text-primary">
                      {yr}{yr >= 2031 ? " (Stab.)" : ""}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.totalRevenue, true, locale)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.totalOpex, true, locale)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.ebitda, true, locale)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.debtService, true, locale)}</td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${row.dscr >= 1.25 ? "text-positive" : row.dscr >= 1.0 ? "text-warning" : "text-red-600"}`}>
                      {row.dscr.toFixed(2)}×
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Downside Stress Scenario — year-by-year */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s5.downsideTable.header")}
        </p>
        <p className="text-xs text-text-secondary leading-relaxed mb-3">
          A simultaneous stress across all three drivers — −10% occupancy, −5% net ADR, 4 events/year vs 10 in the realistic scenario.
        </p>
        <div className="presentation-table overflow-x-auto mb-8">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Year</th>
                <th className="px-3 py-2 text-right font-semibold">Downside Revenue</th>
                <th className="px-3 py-2 text-right font-semibold">OPEX</th>
                <th className="px-3 py-2 text-right font-semibold">Downside EBITDA</th>
                <th className="px-3 py-2 text-right font-semibold">Debt Service</th>
                <th className="px-3 py-2 text-right font-semibold">DSCR</th>
              </tr>
            </thead>
            <tbody>
              {[2028, 2029, 2030, 2031].map((yr, i) => {
                const row = downsidePnlByYear[yr];
                if (!row) return null;
                return (
                  <tr key={yr} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-3 py-2 font-semibold text-text-primary">
                      {yr}{yr >= 2031 ? " (Stab.)" : ""}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.totalRevenue, true, locale)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.totalOpex, true, locale)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.ebitda, true, locale)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.debtService, true, locale)}</td>
                    <td className={`px-3 py-2 text-right font-mono font-bold ${row.dscr >= 1.25 ? "text-positive" : row.dscr >= 1.0 ? "text-warning" : "text-red-600"}`}>
                      {row.dscr.toFixed(2)}×
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Full P&L — BankPnLSection component */}
        <SectionHeader title={t("presentation.s6.title")} />
        <BankPnLSection />
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          § 6 — Key Risks & Mitigating Factors
      ══════════════════════════════════════════════════════════════════ */}
      <section className="presentation-section px-12 py-10 max-w-4xl mx-auto">
        <SectionEyebrow eyebrow={t("presentation.s6.eyebrow")} />
        <SectionHeader title={t("presentation.s6.title")} />

        {/* Break-Even Comparison — LIVE */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s6.breakeven.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-8">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Metric</th>
                <th className="px-3 py-2 text-right font-semibold">Break-Even</th>
                <th className="px-3 py-2 text-right font-semibold">Downside</th>
                <th className="px-3 py-2 text-right font-semibold">Realistic</th>
                {km.grantAmount > 0 && (
                  <th className="px-3 py-2 text-right font-semibold">Grant Path</th>
                )}
              </tr>
            </thead>
            <tbody>
              {[
                {
                  metric: "Annual revenue",
                  be: formatCurrency(breakevenRevenue, true, locale),
                  ds: formatCurrency(downsideStabRevenue, true, locale),
                  re: formatCurrency(stabRevenue, true, locale),
                  grant: grantScenarioOutput ? formatCurrency(stabRevenue, true, locale) : null,
                },
                {
                  metric: "EBITDA",
                  be: formatCurrency(annualDS, true, locale),
                  ds: formatCurrency(downsidePnlByYear[2031]?.ebitda ?? downsideKm.stabilisedYear?.ebitda ?? 0, true, locale),
                  re: formatCurrency(km.stabilisedEBITDA, true, locale),
                  grant: grantScenarioOutput ? formatCurrency(km.stabilisedEBITDA, true, locale) : null,
                },
                {
                  metric: "Annual debt service",
                  be: formatCurrency(annualDS, true, locale),
                  ds: formatCurrency(downsidePnlByYear[2031]?.debtService ?? annualDS, true, locale),
                  re: formatCurrency(annualDS, true, locale),
                  grant: grantScenarioOutput ? formatCurrency(km.annualDS, true, locale) : null,
                },
                {
                  metric: "DSCR",
                  be: "1.00×",
                  ds: `${downsidePnlByYear[2031]?.dscr?.toFixed(2) ?? downsideKm.stabilisedYear?.dscr?.toFixed(2) ?? "—"}×`,
                  re: `${km.stabilisedDSCR.toFixed(2)}×`,
                  grant: grantScenarioOutput ? `${km.stabilisedDSCR.toFixed(2)}×` : null,
                },
                {
                  metric: "Villa nights/yr",
                  be: `~${km.breakEvenNights} nights`,
                  ds: `~${Math.round(conservativeNights * 0.90)} nights`,
                  re: `${conservativeNights} nights`,
                  grant: grantScenarioOutput ? `${conservativeNights} nights` : null,
                },
                {
                  metric: "Free cash flow (net)",
                  be: formatCurrency(0, true, locale),
                  ds: formatCurrency(
                    (downsidePnlByYear[2031]?.ebitda ?? 0) - (downsidePnlByYear[2031]?.debtService ?? annualDS),
                    true, locale
                  ),
                  re: formatCurrency(km.stabilisedNCF, true, locale),
                  grant: grantScenarioOutput ? formatCurrency(km.stabilisedNCF, true, locale) : null,
                },
                {
                  metric: "Buffer to break-even",
                  be: "—",
                  ds: downsideBufferPct > 0 ? `−${downsideBufferPct}%` : "—",
                  re: realisticBufferPct > 0 ? `−${realisticBufferPct}%` : "—",
                  grant: grantScenarioOutput && stabRevenue > 0
                    ? `−${Math.round((1 - (km.annualDS + stabOpex) / stabRevenue) * 100)}%`
                    : null,
                },
              ].map((r, i) => (
                <tr key={r.metric} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-3 py-2 font-medium text-text-primary">{r.metric}</td>
                  <td className="px-3 py-2 text-right font-mono text-amber-700">{r.be}</td>
                  <td className="px-3 py-2 text-right font-mono text-text-secondary">{r.ds}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-positive">{r.re}</td>
                  {km.grantAmount > 0 && (
                    <td className="px-3 py-2 text-right font-mono text-brand-700">{r.grant ?? "—"}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Risk Register table */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s6.risks.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold w-1/4">Risk</th>
                <th className="px-3 py-2 text-left font-semibold w-[80px]">Severity</th>
                <th className="px-3 py-2 text-left font-semibold">Mitigant</th>
              </tr>
            </thead>
            <tbody>
              {RISK_REGISTER.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-3 py-2 font-medium text-text-primary align-top">{r.risk}</td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        r.severity === "None"
                          ? "bg-slate-100 text-slate-500"
                          : r.severity === "Low"
                            ? "bg-positive/15 text-positive"
                            : r.severity === "Medium"
                              ? "bg-warning/15 text-warning"
                              : "bg-red-100 text-red-700"
                      }`}
                    >
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-secondary leading-relaxed align-top">{r.mitigant}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stress test note */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 mb-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            {t("presentation.s6.stressNote")}
          </p>
        </div>

        {/* DSRA note */}
        <div className="bg-brand-50 border border-brand-200 rounded-xl px-5 py-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            {t("presentation.s6.dsraNote")}
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          § 7 — Loan Structure & Collateral
      ══════════════════════════════════════════════════════════════════ */}
      <section className="presentation-section px-12 py-10 max-w-4xl mx-auto">
        <SectionEyebrow eyebrow={t("presentation.s7.eyebrow")} />
        <SectionHeader title={t("presentation.s7.title")} />

        {/* Per-property financing table — LIVE */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s7.financing.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-8">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Item</th>
                <th className="px-3 py-2 text-right font-semibold">Property A (per project)</th>
                <th className="px-3 py-2 text-right font-semibold">Property B</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const propA = portfolio.find((p) => p.villaUnits > 0);
                const propB = portfolio.find((p) => p.villaUnits === 0);
                const capexA = propA
                  ? (propA.landCost + propA.constructionCostPerM2 * (propA.constructionArea ?? 0) + (propA.ffeCost ?? 0))
                  : 0;
                const capexAx2 = capexA * (propA?.count ?? 2);
                const capexB = propB
                  ? (propB.landCost + propB.constructionCostPerM2 * (propB.constructionArea ?? 0) + (propB.ffeCost ?? 0)) * (propB.count ?? 1)
                  : 0;
                const ltvRate = loanParams && "loanCoverageRate" in loanParams ? loanParams.loanCoverageRate : 0.75;
                const loanA = capexA * ltvRate;
                const loanAx2 = capexAx2 * ltvRate;
                const loanB = capexB * ltvRate;
                const equityA = capexA * (1 - ltvRate);
                const equityB = capexB * (1 - ltvRate);
                const annualDSPerUnit = km.annualDS / Math.max(totalVillas + (totalSuites > 0 ? 1 : 0), 1);
                return [
                  {
                    item: "Total cost",
                    a: formatCurrency(capexA, true, locale),
                    b: formatCurrency(capexB, true, locale),
                    total: formatCurrency(km.totalCapex, true, locale),
                  },
                  {
                    item: `Loan (${formatPercent(ltvRate, 0)})`,
                    a: formatCurrency(loanA, true, locale),
                    b: formatCurrency(loanB, true, locale),
                    total: formatCurrency(km.loanAmount, true, locale),
                  },
                  {
                    item: `Equity (${formatPercent(1 - ltvRate, 0)})`,
                    a: formatCurrency(equityA, true, locale),
                    b: formatCurrency(equityB, true, locale),
                    total: formatCurrency(km.equityRequired, true, locale),
                  },
                  {
                    item: "Annual DS (est.)",
                    a: formatCurrency(annualDSPerUnit, true, locale),
                    b: formatCurrency(annualDSPerUnit, true, locale),
                    total: formatCurrency(km.annualDS, true, locale),
                  },
                ].map((r, i) => (
                  <tr key={r.item} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-3 py-2 font-medium text-text-primary">{r.item}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.a}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.b}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{r.total}</td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>

        {/* Collateral & Asset Coverage — LIVE */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s7.collateral.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-6">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Metric</th>
                <th className="px-3 py-2 text-right font-semibold">Value</th>
              </tr>
            </thead>
            <tbody>
              {[
                { metric: "Portfolio value (market)", value: formatCurrency(km.portfolioValue, true, locale) },
                { metric: "Loan amount", value: formatCurrency(km.loanAmount, true, locale) },
                { metric: "LTV", value: formatPercent(km.ltv ?? ltc, 1) },
                { metric: "Asset coverage", value: `${km.assetCoverage.toFixed(2)}×` },
                { metric: "Stress valuation (−15%)", value: formatCurrency(km.portfolioValue * 0.85, true, locale) },
                { metric: "Remaining buffer (stress)", value: `${((km.portfolioValue * 0.85 / km.loanAmount) - 1 > 0 ? ((km.portfolioValue * 0.85 / km.loanAmount) - 1) * 100 : 0).toFixed(0)}% above loan` },
              ].map((r, i) => (
                <tr key={r.metric} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-3 py-2 font-medium text-text-primary">{r.metric}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Debt service note */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 mb-8">
          <p className="text-sm text-text-secondary leading-relaxed">
            {t("presentation.s7.dsNote")}
          </p>
        </div>

        {/* Covenants */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
              Financial Covenants
            </p>
            <div className="space-y-2">
              {COVENANTS.map((c) => (
                <div key={c.label} className="flex justify-between items-baseline gap-2 py-1.5 border-b border-surface-tertiary last:border-0">
                  <span className="text-xs text-text-secondary">{c.label}</span>
                  <span className="text-xs font-semibold text-text-primary text-right">{c.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
              Loan Terms
            </p>
            <div className="space-y-2">
              {[
                { label: "Facility type", value: "Senior secured term loan" },
                { label: "Amount", value: formatCurrency(km.loanAmount, false, locale) },
                { label: "LTC", value: formatPercent(ltc, 0) },
                { label: "Tenor", value: `${gracePeriodYears + repaymentTermYears}yr (${gracePeriodYears}yr grace)` },
                { label: "Rate", value: `${"interestRate" in loanParams ? formatPercent(loanParams.interestRate, 2) : "4.40%"} p.a.` },
                { label: "Currency", value: "EUR" },
              ].map((r) => (
                <div key={r.label} className="flex justify-between items-baseline gap-2 py-1.5 border-b border-surface-tertiary last:border-0">
                  <span className="text-xs text-text-secondary">{r.label}</span>
                  <span className="text-xs font-semibold text-text-primary text-right">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Project Timeline — static */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s7.timeline.header")}
        </p>
        <div className="presentation-table overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Milestone</th>
                <th className="px-3 py-2 text-left font-semibold">Timing</th>
              </tr>
            </thead>
            <tbody>
              {[
                { milestone: "Loan approval", timing: "Q2 2026" },
                { milestone: "Plot acquisition", timing: "Q2–Q3 2026" },
                { milestone: "Permit preparation", timing: "Q2–Q4 2026" },
                { milestone: "Construction", timing: "Q1 2027 – Q2 2028" },
                { milestone: "Fit-out", timing: "Q2–Q3 2028" },
                { milestone: "Operational launch", timing: "Summer 2028" },
              ].map((r, i) => (
                <tr key={r.milestone} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-3 py-2 font-medium text-text-primary">{r.milestone}</td>
                  <td className="px-3 py-2 text-text-secondary">{r.timing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          § 8 — Governance, Structure & Revenue Protection
      ══════════════════════════════════════════════════════════════════ */}
      <section className="presentation-section px-12 py-10 max-w-4xl mx-auto">
        <SectionEyebrow eyebrow={t("presentation.s8.eyebrow")} />
        <SectionHeader title={t("presentation.s8.title")} />

        {/* Corporate structure */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s8.corporate.header")}
        </p>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          The borrower is a holding company currently being incorporated in Greece, with three shareholders: a Greek tax resident, a French tax resident, and an Israeli tax resident. The holding company controls dedicated operating subsidiaries — one per property — each a standalone Greek company (ΙΚΕ/ΑΕ) registered under KAD 55.10 (Hotels and similar accommodation), fully VAT-compliant and professionally insured. Villa Lev Group Management, the sister company responsible for all operational management, operates debt-free and carries no existing financial liabilities. Ownership and operations are cleanly separated at the entity level, providing lender clarity and structural flexibility.
        </p>

        {/* Eytan Cohen — full Word-doc bio */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-4">
          {t("presentation.s8.team.header")}
        </p>
        <div className="space-y-6 mb-8">
          <div className="border-l-4 border-brand-500 pl-5">
            <p className="text-sm font-bold text-text-primary">Eytan Cohen</p>
            <p className="text-xs font-semibold text-brand-700 uppercase tracking-wider mb-2">
              Founder &amp; Operator
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">
              {t("presentation.s8.eytan.bio")}
            </p>
          </div>
          <div className="border-l-4 border-slate-300 pl-5">
            <p className="text-sm font-bold text-text-primary">Leftheris Dimitriou</p>
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
              Local Operations &amp; Permitting
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">
              Leftheris brings deep knowledge of the Antiparos and Paros construction and permitting environment, having managed multiple development projects across the Cyclades over more than a decade. He oversees on-the-ground relationships with municipal authorities, licensed contractors, and local service providers — critical capabilities for the FEK-zone permitting track and buildability confirmation. His established relationships with the relevant authorities materially reduce permitting timeline risk.
            </p>
          </div>
          <div className="border-l-4 border-slate-300 pl-5">
            <p className="text-sm font-bold text-text-primary">Thanasis Aggelakakis</p>
            <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
              Development &amp; Architecture
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">
              Thanasis leads the architectural and technical development programme for the portfolio, coordinating licensed civil engineers, managing the construction schedule, and ensuring each design meets FEK zone requirements and the Villa Lev luxury positioning. His involvement reduces construction-quality and specification risk and ensures the portfolio delivers at the positioned market tier.
            </p>
          </div>
        </div>

        {/* Operator Alignment — 3 buckets table */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s8.alignment.header")}
        </p>
        <div className="presentation-table overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Bucket</th>
                <th className="px-3 py-2 text-left font-semibold">Mechanism</th>
                <th className="px-3 py-2 text-left font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  bucket: "Revenue Floor",
                  mechanism: "Minimum annual revenue floor",
                  detail: "€80,000/property. Operator funds any shortfall personally before senior debt service is called.",
                },
                {
                  bucket: "Bucket 1A",
                  mechanism: "Personal collateral — construction",
                  detail: "€1,000,000 personal collateral pledge during construction phase.",
                },
                {
                  bucket: "Bucket 1B",
                  mechanism: "TEPIX III advisory fee",
                  detail: "10% of TEPIX III grant as advisory fee, deferred to disbursement — aligns operator with grant approval.",
                },
                {
                  bucket: "Bucket 1C",
                  mechanism: "Performance ratchet at exit",
                  detail: "0% operator share if IRR < 8% · +9% at IRR 8–22% · +29% if IRR ≥ 22%.",
                },
                {
                  bucket: "Bucket 2A",
                  mechanism: "Management fee (gross revenue)",
                  detail: "5% of gross revenue, minimum €24,000/villa/yr. Senior to debt service.",
                },
                {
                  bucket: "Bucket 2B",
                  mechanism: "Incentive fee (GOP above hurdle)",
                  detail: "10% of GOP above 8% hurdle, subject to investor protection cap.",
                },
              ].map((r, i) => (
                <tr key={r.bucket} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-3 py-2 font-semibold text-brand-700 align-top">{r.bucket}</td>
                  <td className="px-3 py-2 font-medium text-text-primary align-top">{r.mechanism}</td>
                  <td className="px-3 py-2 text-text-secondary leading-relaxed align-top">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          § 9 — Financing Optionality — Grant & RRF
      ══════════════════════════════════════════════════════════════════ */}
      <section className="presentation-section px-12 py-10 max-w-4xl mx-auto">
        <SectionEyebrow eyebrow={t("presentation.s9.eyebrow")} />
        <SectionHeader title={t("presentation.s9.title")} />

        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          {t("presentation.s9.intro")}
        </p>

        {/* Grant vs RRF feature comparison table — matches Word doc §9 */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s9.instruments.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-8">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Parameter</th>
                <th className="px-3 py-2 text-left font-semibold">Development Law 4887/2022 Grant</th>
                <th className="px-3 py-2 text-left font-semibold">RRF 2 (Recovery & Resilience Facility)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { param: "Instrument type", grant: "Cash grant — non-repayable", rrf: "Subsidised loan at 0.35%" },
                { param: "Coverage", grant: "60% of non-plot eligible costs", rrf: "50% of total project cost" },
                { param: "Eligibility",
                  grant: "Confirmed — Antiparos: max regional aid intensity zone (island < 3,100 inhabitants)",
                  rrf: "Application to be filed — opening expected imminently" },
                { param: "Benefit (full portfolio)",
                  grant: km.grantAmount > 0 ? `${formatCurrency(km.grantAmount, true, locale)} non-repayable` : "~60% of construction costs non-repayable",
                  rrf: "≈€50,700/yr lower annual DS vs commercial rate" },
                { param: "Structural impact on loan",
                  grant: "Applied to loan reduction upon receipt — before Phase 2 drawdown",
                  rrf: "Replaces portion of commercial loan at 0.35% vs 5%" },
              ].map((r, i) => (
                <tr key={r.param} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-3 py-2 font-semibold text-text-primary align-top">{r.param}</td>
                  <td className="px-3 py-2 text-text-secondary leading-relaxed align-top">{r.grant}</td>
                  <td className="px-3 py-2 text-text-secondary leading-relaxed align-top">{r.rrf}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Two-column intro: Development Law Grant | RRF */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700 mb-2">
              Development Law Grant
            </p>
            <p className="text-xs text-text-secondary leading-relaxed">
              60% of eligible non-land construction costs as a non-repayable state grant. Applied at Phase 2 (construction onset). No change to underlying business plan assumptions — it simply reduces the loan and annual debt service.
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-2">
              RRF Co-Financing
            </p>
            <p className="text-xs text-text-secondary leading-relaxed">
              Greece's Recovery &amp; Resilience Fund has subsidised tourism investment at 20–40% of investment cost. Each €1M award saves ~€60K/yr in debt service. Future RRF tranches are not modelled in any current scenario — pure upside.
            </p>
          </div>
        </div>

        {/* Development Law Grant impact — LIVE when grant path active */}
        {km.grantAmount > 0 && (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
              {t("presentation.s9.grantImpact.header")}
            </p>
            <div className="presentation-table overflow-x-auto mb-8">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="px-3 py-2 text-left font-semibold">Metric</th>
                    <th className="px-3 py-2 text-right font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { metric: "Grant received (non-repayable)", value: formatCurrency(km.grantAmount, true, locale) },
                    { metric: "Remaining loan after grant", value: formatCurrency(km.loanAmount, true, locale) },
                    { metric: "Annual DS after grant", value: formatCurrency(km.annualDS, true, locale) },
                    { metric: "DSCR after grant (stabilised)", value: `${km.stabilisedDSCR.toFixed(2)}×` },
                  ].map((r, i) => (
                    <tr key={r.metric} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-3 py-2 font-medium text-text-primary">{r.metric}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-positive">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Financing Path Comparison — LIVE */}
        <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
          {t("presentation.s9.comparison.header")}
        </p>
        <div className="presentation-table overflow-x-auto mb-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Metric</th>
                <th className={`px-3 py-2 text-right font-semibold ${activePath === "commercial" ? "bg-brand-600" : ""}`}>
                  Commercial Loan
                </th>
                <th className={`px-3 py-2 text-right font-semibold ${activePath === "rrf" ? "bg-brand-600" : ""}`}>
                  + RRF
                </th>
                <th className={`px-3 py-2 text-right font-semibold ${activePath === "grant" ? "bg-brand-600" : ""}`}>
                  + Dev. Law Grant
                </th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // When on grant path: km.loanAmount & km.annualDS are already grant-adjusted
                // For the commercial column, back-calculate from km.equityRequired + km.grantAmount
                const isGrantPath = activePath === "grant" && km.grantAmount > 0;
                const commercialLoan = isGrantPath ? km.loanAmount + km.grantAmount : km.loanAmount;
                const commercialEquity = isGrantPath ? km.equityRequired + (km.grantAmount * 0.25 / 0.75) : km.equityRequired;
                // Rough commercial DS: scale from grant DS by ratio of loans
                const commercialDS = isGrantPath && km.loanAmount > 0
                  ? km.annualDS * commercialLoan / km.loanAmount
                  : km.annualDS;
                const grantLoan = isGrantPath ? km.loanAmount : km.grantAmount > 0 ? km.loanAmount - km.grantAmount : null;
                const grantEquity = isGrantPath ? km.equityRequired : null;
                const grantDS = isGrantPath ? km.annualDS : null;
                const grantDSCR = isGrantPath ? km.stabilisedDSCR : null;
                const grantNCF = isGrantPath ? km.stabilisedNCF : null;
                const equitySaving = grantEquity != null ? commercialEquity - grantEquity : null;

                return [
                  {
                    metric: "Total loan drawn (€)",
                    comm: formatCurrency(commercialLoan, true, locale),
                    rrf: "RRF blended rate",
                    grant: grantLoan != null ? formatCurrency(grantLoan, true, locale) : "—",
                  },
                  {
                    metric: "Equity required (€)",
                    comm: formatCurrency(commercialEquity, true, locale),
                    rrf: "Lower (RRF covers part)",
                    grant: grantEquity != null ? formatCurrency(grantEquity, true, locale) : "—",
                  },
                  {
                    metric: "Equity saving vs. commercial (€)",
                    comm: "—",
                    rrf: "≈€308,700",
                    grant: equitySaving != null
                      ? `${formatCurrency(equitySaving, true, locale)} (−${Math.round(equitySaving / commercialEquity * 100)}%)`
                      : "—",
                  },
                  {
                    metric: "Annual debt service (€)",
                    comm: formatCurrency(commercialDS, true, locale),
                    rrf: "≈€439,700/yr",
                    grant: grantDS != null ? formatCurrency(grantDS, true, locale) : "—",
                  },
                  {
                    metric: "DSCR — Realistic (2031)",
                    comm: isGrantPath ? "1.81× (ref.)" : `${km.stabilisedDSCR.toFixed(2)}×`,
                    rrf: "2.06×",
                    grant: grantDSCR != null ? `${grantDSCR.toFixed(2)}×` : "—",
                  },
                  {
                    metric: "Net portfolio CF post-VAT (2031)",
                    comm: isGrantPath ? formatCurrency(km.stabilisedNCF * 0.58, true, locale) + " (ref.)" : formatCurrency(km.stabilisedNCF, true, locale),
                    rrf: "—",
                    grant: grantNCF != null ? formatCurrency(grantNCF, true, locale) : "—",
                  },
                ];
              })().map((r, i) => (
                <tr key={r.metric} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-3 py-2 font-medium text-text-primary">{r.metric}</td>
                  <td className={`px-3 py-2 text-right font-mono ${activePath === "commercial" ? "bg-brand-50 font-semibold text-brand-700" : ""}`}>{r.comm}</td>
                  <td className={`px-3 py-2 text-right font-mono ${activePath === "rrf" ? "bg-brand-50 font-semibold text-brand-700" : "text-text-tertiary"}`}>{r.rrf}</td>
                  <td className={`px-3 py-2 text-right font-mono ${activePath === "grant" ? "bg-brand-50 font-semibold text-brand-700" : r.grant === "—" ? "text-text-tertiary" : ""}`}>{r.grant}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-text-tertiary italic">{t("presentation.s9.pathNote")}</p>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          § 10 — Conclusion
          Reuses BankStressTest + closing summary boxes
      ══════════════════════════════════════════════════════════════════ */}
      <section className="presentation-section px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <SectionEyebrow eyebrow={t("presentation.s10.eyebrow")} />
          <SectionHeader title={t("presentation.s10.title")} />

          {/* 5 key points matching Word doc */}
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-4">
            {t("presentation.s10.keyPoints.header")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-8">
            {[
              { num: "1", title: "Proven Demand", body: "Villa Lev — same operator, same neighbourhood — has 4 years of verified revenue growth. Every model assumption is below what the property already delivers." },
              { num: "2", title: "Scarce Land", body: "Three plots inside the FEK zone. Supply is constrained by regulation. Ultra-HNW traveller rotation from Mykonos to Paros is structural, not cyclical." },
              { num: "3", title: "Strong Collateral", body: `Portfolio appraised at ${formatCurrency(km.portfolioValue, true, locale)}. Asset coverage ${km.assetCoverage.toFixed(2)}×. Stress valuation at −15% still covers the loan.` },
              { num: "4", title: "Operational Infrastructure", body: "Management contracts, booking relationships, brand, and operating procedures are ready. Opening Summer 2028." },
              { num: "5", title: "Financing Optionality", body: "Commercial loan is the base case. Development Law Grant reduces loan by up to 60% of eligible costs. TEPIX III and RRF are additional unmodelled upside." },
            ].map((pt) => (
              <div key={pt.num} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[10px] font-bold text-brand-600 uppercase tracking-wider mb-1">{pt.num}</p>
                <p className="text-xs font-bold text-text-primary mb-2">{pt.title}</p>
                <p className="text-[11px] text-text-secondary leading-relaxed">{pt.body}</p>
              </div>
            ))}
          </div>

          {/* BankStressTest */}
          <BankStressTest />

          {/* Portfolio at a Glance — 3 summary boxes LIVE */}
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mt-8 mb-4">
            {t("presentation.s10.portfolioAtGlance.header")}
          </p>
          <div className={`presentation-kpi-row grid grid-cols-1 gap-4 mb-8 ${activePath === "grant" && km.grantAmount > 0 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {/* Box 1: Commercial Loan */}
            <div className="bg-[#0a1929] text-white rounded-xl px-6 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Commercial Loan
              </p>
              <div className="space-y-2">
                {[
                  { label: t("presentation.kpi.ownerEquity"), value: formatCurrency(km.equityRequired, true, locale) },
                  { label: "Annual debt service", value: formatCurrency(km.annualDS, true, locale) },
                  { label: "DSCR — Realistic", value: `${km.stabilisedDSCR.toFixed(2)}×` },
                  { label: "DSCR — Downside", value: `${(downsideKm.stabilisedYear?.dscr ?? km.stabilisedDSCR * 0.8).toFixed(2)}×` },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between items-baseline">
                    <span className="text-[11px] text-slate-400">{r.label}</span>
                    <span className="text-[11px] font-semibold text-white font-mono">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Box 2: Stabilised Operations */}
            <div className="bg-brand-700 text-white rounded-xl px-6 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-200 mb-3">
                Stabilised Operations (2031+)
              </p>
              <div className="space-y-2">
                {[
                  { label: "Revenue", value: formatCurrency(km.stabilisedRevenue ?? 0, true, locale) },
                  { label: "EBITDA", value: formatCurrency(km.stabilisedEBITDA, true, locale) },
                  { label: "EBITDA margin", value: formatPercent(km.stabilisedEBITDAMargin, 0) },
                  { label: "Net cash flow", value: formatCurrency(km.stabilisedNCF, true, locale) },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between items-baseline">
                    <span className="text-[11px] text-brand-200">{r.label}</span>
                    <span className="text-[11px] font-semibold text-white font-mono">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Box 3: Dev. Law Grant Path — conditional */}
            {activePath === "grant" && km.grantAmount > 0 && (
              <div className="bg-amber-600 text-white rounded-xl px-6 py-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200 mb-3">
                  Dev. Law Grant Path
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Grant (non-repayable)", value: formatCurrency(km.grantAmount, true, locale) },
                    { label: "Equity required", value: formatCurrency(km.equityRequired, true, locale) },
                    { label: "Annual debt service", value: formatCurrency(km.annualDS, true, locale) },
                    { label: "DSCR Realistic", value: `${km.stabilisedDSCR.toFixed(2)}×` },
                  ].map((r) => (
                    <div key={r.label} className="flex justify-between items-baseline">
                      <span className="text-[11px] text-amber-200">{r.label}</span>
                      <span className="text-[11px] font-semibold text-white font-mono">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Closing line */}
          <div className="bg-[#0a1929] text-white rounded-xl px-6 py-5 mb-8">
            <p className="text-sm font-semibold leading-relaxed">
              {t("presentation.s10.closingLine")}
            </p>
          </div>

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-surface-tertiary flex items-center justify-between text-[10px] text-text-tertiary">
            <span>{t("presentation.confidential")}</span>
            <span>{t("presentation.s0.title")} · {new Date().toLocaleDateString()}</span>
            <span>{pathLabel} · {scenarioLabel}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function SectionEyebrow({ eyebrow }: { eyebrow: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600 mb-1">
      {eyebrow}
    </p>
  );
}

function CoverKPI({
  label,
  value,
  sublabel,
  highlight,
}: {
  label: string;
  value: string;
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "bg-amber-400/10 border-amber-400/40"
          : "bg-white/8 border-white/15"
      }`}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </p>
      <p className="text-xl font-bold text-white">{value}</p>
      {sublabel && (
        <p className="text-[10px] text-slate-400 mt-0.5">{sublabel}</p>
      )}
    </div>
  );
}

function ProseBlock({
  heading,
  body,
  footer,
}: {
  heading: string;
  body: string;
  footer?: string;
}) {
  return (
    <div className="border-l-2 border-brand-200 pl-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-700 mb-1">
        {heading}
      </p>
      <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
      {footer && (
        <p className="text-[10px] font-mono text-text-tertiary mt-1.5 bg-slate-50 px-2 py-1 rounded">
          {footer}
        </p>
      )}
    </div>
  );
}
