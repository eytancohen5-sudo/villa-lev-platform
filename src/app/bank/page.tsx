"use client";

import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { LiveTrackRecord } from "@/components/LiveTrackRecord";
import { BankPnLSection } from "@/components/BankPnLSection";
import { BankStressTest } from "@/components/BankStressTest";
import { resolvePortfolio } from "@/lib/engine/defaults";
import BankControlBar from "@/components/BankControlBar";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from "recharts";

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
      <div className={`kpi-value ${valueClass ?? 'text-text-primary'}`}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary mt-2">{label}</div>
      {sublabel && <div className="text-xs text-text-tertiary mt-0.5">{sublabel}</div>}
    </div>
  );
}

export default function BankPage() {
  const { t, locale } = useTranslation();
  const {
    model,
    assumptions,
    projects,
    activeScenario,
    financingPathOverride,
    templates,
  } = useModelStore();

  if (!model) return (
    <div className="flex items-center justify-center h-96 text-text-tertiary">
      {t('common.loading')}
    </div>
  );

  // The active path for display is the ephemeral override if set, else the stored assumption.
  const activePath = financingPathOverride ?? assumptions.financingPath;

  // Resolve the active scenario's P&L — all charts and the P&L table respond to the
  // scenario pill selection in the control bar. Falls back to realistic if key missing.
  const activePnl = model.scenarios[activeScenario as keyof typeof model.scenarios]?.pnl
    ?? model.scenarios.realistic.pnl;

  // Downloads are now handled in BankControlBar (sticky bar) — removed from page.

  const km = model.keyMetrics;
  const pnl = activePnl.filter((p) => p.year >= 2028);

  // Active scenario output — drives all scenario-responsive metrics across the page.
  // `km` (keyMetrics) intentionally stays on realistic: term-sheet loan sizing,
  // LTV, and annual DS are always underwritten on the base case.
  const activeScenarioOutput = model.scenarios[activeScenario as keyof typeof model.scenarios]
    ?? model.scenarios.realistic;

  // Stabilised year for the active scenario — drives the Stabilised Ops panel.
  const activeStab = activeScenarioOutput.stabilisedYear;

  // Post-ramp 2030 DSCR from the active scenario — more meaningful to a lender.
  const dscr2030 =
    activePnl?.find((p) => p.year === 2030)?.dscr ??
    activeScenarioOutput.minDSCRLoanLife;

  // Coverage ratios — scenario-responsive.
  const icrStabilised = activeScenarioOutput.icrStabilised;
  const llcr = activeScenarioOutput.llcr;
  const plcr = activeScenarioOutput.plcr;

  // Exit IRR — scenario-responsive.
  const hotelExitIRR = activeScenarioOutput.equityIRR;
  const propertyExitIRR = activeScenarioOutput.equityIRRPropertySale;
  const propertyExitDominates = activeScenarioOutput.propertyExitDominates;

  // ── Ramp-year revenue haircut ──────────────────────────────────────────────
  // Dynamic: Y1 (2028) and Y2 (2029) from the active scenario PnL vs. its
  // stabilised year. Updates automatically when scenario pill changes.
  const stabRev = activeStab?.totalRevenue ?? 0;
  const pnlY1   = activePnl.find((p) => p.year === 2028);
  const pnlY2   = activePnl.find((p) => p.year === 2029);
  const year1HaircutPct = stabRev > 0 && pnlY1
    ? Math.round((1 - pnlY1.totalRevenue / stabRev) * 100) : 0;
  const year2HaircutPct = stabRev > 0 && pnlY2
    ? Math.round((1 - pnlY2.totalRevenue / stabRev) * 100) : 0;
  const year1HaircutAmt = pnlY1 ? stabRev - pnlY1.totalRevenue : 0;
  const year2HaircutAmt = pnlY2 ? stabRev - pnlY2.totalRevenue : 0;

  const rampHaircutNote = stabRev > 0 ? (
    <div className="mt-4 rounded-xl border border-brand-400/30 bg-brand-50/60 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex-1 min-w-[200px]">
        <p className="text-xs font-semibold text-text-primary leading-snug mb-1">
          Opening years modelled at a deliberate revenue discount
        </p>
        <p className="text-xs text-text-secondary leading-relaxed">
          Inbound requests already exceed available inventory for this period —
          these projections represent a near-worst-case opening scenario.
        </p>
      </div>
      <div className="flex gap-3 flex-shrink-0">
        {[
          { year: 2028, label: 'Year 1 · 2028', pct: year1HaircutPct, amt: year1HaircutAmt },
          { year: 2029, label: 'Year 2 · 2029', pct: year2HaircutPct, amt: year2HaircutAmt },
        ].map(({ year, label, pct, amt }) => (
          <div key={year} className="rounded-lg bg-white border border-surface-tertiary px-4 py-2.5 text-center min-w-[100px]">
            <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">{label}</div>
            <div className="text-xl font-bold text-warning mt-0.5">-{pct}%</div>
            <div className="text-[10px] font-mono text-text-tertiary mt-0.5">
              {formatCurrency(amt, true, locale)} below stab.
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  // Resolve full portfolio so "About the project" shows exact unit counts and m².
  // Uses the store's templates (includes custom) so all 4 plots — including the
  // 11-suite custom template — are reflected correctly.
  const portfolio = resolvePortfolio(templates, projects);
  const totalPlots = portfolio.reduce((s, p) => s + p.count, 0);
  const totalVillas = portfolio.reduce((s, p) => s + p.count * p.villaUnits, 0);
  const totalStdSuites = portfolio.reduce((s, p) => s + p.count * p.standardSuites, 0);
  const totalDblSuites = portfolio.reduce((s, p) => s + p.count * p.doubleSuites, 0);
  const totalSuites = totalStdSuites + totalDblSuites;
  const totalGIA = portfolio.reduce((s, p) => s + p.count * (p.constructionArea ?? 0), 0);

  const pathLabel =
    activePath === "grant"
      ? t('path.grant')
      : activePath === "rrf"
        ? t('path.rrf')
        : activePath === "tepix-loan"
          ? t('path.tepixLoan')
          : t('path.commercial');

  const grantAmount =
    activePath === "grant"
      ? km.totalCapex - km.loanAmount - km.equityRequired
      : 0;
  const capitalData = [
    { name: t('inv.loan'), value: km.loanAmount, color: "#8B6914" },
    { name: t('kpi.equityRequired'), value: km.equityRequired, color: "#6B7A3D" },
    ...(grantAmount > 0
      ? [{ name: t('path.grantShort'), value: grantAmount, color: "#4A6A8B" }]
      : []),
  ];

  const chartData = pnl.map((p) => ({
    year: p.year,
    Revenue: Math.round(p.totalRevenue),
    EBITDA: Math.round(p.ebitda),
    "Net Cash Flow": Math.round(p.netCashFlow),
  }));

  const dscrChart = model.dscrByYear
    .filter((d) => d.year >= 2028)
    .map((d) => ({
      year: d.year,
      Realistic: Number(d.realistic.toFixed(2)),
      Upside: Number(d.upside.toFixed(2)),
      Downside: Number(d.downside.toFixed(2)),
    }));

  // Column active-highlight helper
  const colClass = (pathKey: string) =>
    activePath === pathKey ? "bg-brand-50" : "";

  return (
    <>
      <BankControlBar />
      <div className="max-w-6xl mx-auto px-6 py-8 print:px-0 print:py-2 print:max-w-none">

        {/* 1. Hero */}
        <div className="text-center mb-10 relative print:mb-4 print:break-after-avoid">
          <p className="text-sm text-brand-500 font-medium uppercase tracking-widest mb-3 print:mb-1">
            {t('bank.hero.eyebrow')}
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-text-primary mb-3 print:text-3xl">
            {t('app.title')}
          </h1>
          <p className="text-text-secondary max-w-xl mx-auto">
            {pathLabel} &middot; {t('app.confidential')}
          </p>
        </div>

        {/* 2. Executive Summary */}
        <div className="rounded-2xl border border-surface-tertiary bg-white shadow-sm p-6 mb-8 print:mb-4 print:border-0 print:shadow-none print:p-0">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary mb-3">About the project</h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-4">
            <span className="font-semibold text-text-primary">Villa Lev Group</span> is developing{" "}
            <span className="font-semibold text-text-primary">{totalPlots} plots</span> in Agios Georgios, Antiparos —{" "}
            {totalVillas > 0 && (
              <><span className="font-semibold text-text-primary">{totalVillas} luxury villa{totalVillas > 1 ? "s" : ""}</span>{totalSuites > 0 ? " and " : ""}</>
            )}
            {totalSuites > 0 && (
              <><span className="font-semibold text-text-primary">{totalSuites} boutique hotel suite{totalSuites > 1 ? "s" : ""}</span></>
            )}
            {" "}under a single branded hospitality concept.
            The anchor asset —{" "}
            <a
              href="https://www.airbnb.com/rooms/49627193?guests=1&adults=1&s=67&unique_share_id=20f5564b-2002-4925-a2c1-17be7c330dea"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900 transition-colors"
            >
              Villa Lev Antiparos
            </a>{" "}
            — is live today and provides the operating track record for all projections in this package.
          </p>

          {/* Per-plot portfolio breakdown */}
          <div className="overflow-x-auto mb-5 rounded-lg border border-surface-tertiary">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-secondary/50">
                  <th className="text-left py-2 px-3 font-semibold uppercase tracking-wider text-text-tertiary">Plot</th>
                  <th className="text-center py-2 px-3 font-semibold uppercase tracking-wider text-text-tertiary">Count</th>
                  <th className="text-left py-2 px-3 font-semibold uppercase tracking-wider text-text-tertiary">Type</th>
                  <th className="text-right py-2 px-3 font-semibold uppercase tracking-wider text-text-tertiary">Units / plot</th>
                  <th className="text-right py-2 px-3 font-semibold uppercase tracking-wider text-text-tertiary">GIA / plot</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.map((p) => (
                  <tr key={p.id} className="border-t border-surface-secondary/60">
                    <td className="py-2 px-3 font-medium text-text-primary">{p.name}</td>
                    <td className="py-2 px-3 text-center text-text-secondary">×{p.count}</td>
                    <td className="py-2 px-3 text-text-secondary">
                      {p.villaUnits > 0 ? "Luxury villa" : "Hotel rooms"}
                    </td>
                    <td className="py-2 px-3 text-right text-text-secondary">
                      {p.villaUnits > 0
                        ? `${p.villaUnits} villa`
                        : `${p.standardSuites} standard · ${p.doubleSuites} double`}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-text-secondary">
                      ~{Math.round(p.constructionArea ?? 0).toLocaleString()} m²
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-surface-tertiary bg-surface-secondary/20">
                  <td className="py-2 px-3 font-semibold text-text-primary">Total</td>
                  <td className="py-2 px-3 text-center font-semibold text-text-primary">{totalPlots}</td>
                  <td className="py-2 px-3" />
                  <td className="py-2 px-3 text-right text-text-secondary">
                    {totalVillas > 0 && `${totalVillas} villa${totalVillas > 1 ? "s" : ""}`}
                    {totalVillas > 0 && totalSuites > 0 && " · "}
                    {totalSuites > 0 && `${totalStdSuites} std + ${totalDblSuites} dbl suites`}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-semibold text-text-primary">
                    ~{Math.round(totalGIA).toLocaleString()} m²
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/presentation"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M2 2h6.5L12 5.5V12H2V2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <path d="M8 2v4h4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
              Full Presentation
            </a>
            <span className="text-xs text-text-tertiary">VillaLevGroup_Presentation_v6.docx — confidential</span>
          </div>
        </div>

        {/* 3. Term Sheet — The Ask */}
        {(() => {
          const rate =
            activePath === "tepix-loan"
              ? assumptions.tepixLoan.bankInterestRate
              : activePath === "rrf"
                ? assumptions.rrf.commercialInterestRate
                : assumptions.commercialLoan.interestRate;
          const term =
            activePath === "tepix-loan"
              ? assumptions.tepixLoan.totalTermYears
              : activePath === "rrf"
                ? assumptions.rrf.repaymentTermYears
                : assumptions.commercialLoan.repaymentTermYears;
          const grace =
            activePath === "tepix-loan"
              ? assumptions.tepixLoan.gracePeriodYears
              : activePath === "rrf"
                ? assumptions.rrf.gracePeriodYears
                : assumptions.commercialLoan.gracePeriodYears;
          const covenant = assumptions.dscrCovenantThreshold ?? 1.25;
          const stabDscr = km.stabilisedDSCR;
          const dscrPass = stabDscr >= covenant;
          const cells = [
            { label: t('dash.termsheet.loan'), value: formatCurrency(km.loanAmount, true, locale), sub: `${(km.ltv * 100).toFixed(0)}% ${t('dash.termsheet.loanSub')}` },
            { label: t('dash.termsheet.term'), value: `${term}y · ${grace}y`, sub: t('dash.termsheet.termSub') },
            { label: t('dash.termsheet.rate'), value: `${(rate * 100).toFixed(2)}%`, sub: pathLabel },
            { label: t('dash.termsheet.annualDS'), value: formatCurrency(km.annualDS, true, locale), sub: `${t('kpi.assetCoverage')} ${formatMultiple(km.assetCoverage)}` },
            { label: t('dash.termsheet.dscrCovenant'), value: formatMultiple(stabDscr), sub: `Covenant ≥ ${covenant.toFixed(2)}× — ${dscrPass ? t('dash.termsheet.pass') : t('dash.termsheet.fail')}`, tone: dscrPass ? 'positive' : 'warning' as const },
            { label: t('kpi.equityRequired'), value: formatCurrency(km.equityRequired, true, locale), sub: `${formatPercent(km.equityRequired / km.totalCapex, 0)} ${t('kpi.ofTotal')}` },
            { label: t('dash.termsheet.security'), value: '1st-rank mortgage', sub: 'Land + completed structure' },
          ];
          return (
            <div className="mb-10">
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3">
                Term Sheet — The Ask
              </h3>
              <div className="bg-white rounded-xl border border-surface-tertiary shadow-sm px-5 py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-x-6 gap-y-4 divide-y md:divide-y-0 md:divide-x divide-surface-tertiary/60">
                  {cells.map((c, i) => (
                    <div key={c.label} className={`${i > 0 ? 'pt-3 md:pt-0 md:pl-6' : ''} flex flex-col gap-0.5`}>
                      <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">{c.label}</span>
                      <span className={`font-mono font-semibold text-base ${c.tone === 'positive' ? 'text-positive' : c.tone === 'warning' ? 'text-warning' : 'text-text-primary'}`}>{c.value}</span>
                      {c.sub && <span className="text-[11px] text-text-tertiary">{c.sub}</span>}
                    </div>
                  ))}
                </div>
              </div>
              {/* WC facility note — clarifies this is separate from the term loan */}
              <div className="px-5 pt-3 pb-4 border-t border-surface-tertiary/50 flex items-start gap-2 text-[11px] text-text-tertiary">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 mt-0.5 text-text-tertiary/60" aria-hidden="true">
                  <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.1"/>
                  <path d="M6.5 5.5v4M6.5 4h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span>
                  <span className="font-medium text-text-secondary">Working capital facility</span>
                  {" "}—{" "}
                  {formatCurrency(assumptions.workingCapital.facilitySize, true, locale)} revolving credit line
                  {assumptions.workingCapital.spreadOverTermRate > 0
                    ? ` · +${(assumptions.workingCapital.spreadOverTermRate * 10000).toFixed(0)} bps spread over term rate`
                    : ""}
                  {assumptions.workingCapital.selfLiquidating
                    ? " · self-liquidating (repaid end of each peak season)"
                    : ""}
                  {" "}·{" "}
                  <span className="font-medium text-text-secondary">not included in the term loan amount above</span>
                </span>
              </div>
            </div>
          );
        })()}

        {/* 3. Operating Track Record — proof of operator */}
        <div className="mb-10 print:hidden">
          <LiveTrackRecord />
        </div>

        {/* 4 + 5. Collateral & Loan Metrics — unified card pair */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">

          {/* 4. Collateral — Security Package */}
          <div id="bank-collateral" className="bg-white rounded-xl border border-surface-tertiary p-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-0.5">
              {t('bank.section.collateral')}
            </h3>
            <p className="text-xs text-text-tertiary mb-6">Land + completed structure · 1st-rank mortgage · three valuation tiers</p>
            <div className="grid grid-cols-3 divide-x divide-surface-tertiary">
              <MetricCell
                value={formatMultiple(model.collateral.stress.coverage)}
                label={t('sc.stress')}
                sublabel={`${formatCurrency(model.collateral.stress.value, true, locale)} · LTV ${formatPercent(model.collateral.stress.ltv)}`}
              />
              <MetricCell
                value={formatMultiple(model.collateral.market.coverage)}
                label={t('sc.market')}
                sublabel={`${formatCurrency(model.collateral.market.value, true, locale)} · LTV ${formatPercent(model.collateral.market.ltv)}`}
                valueClass="text-brand-600"
              />
              <MetricCell
                value={formatMultiple(model.collateral.optimistic.coverage)}
                label={t('sc.optimistic')}
                sublabel={`${formatCurrency(model.collateral.optimistic.value, true, locale)} · LTV ${formatPercent(model.collateral.optimistic.ltv)}`}
                valueClass="text-positive"
              />
            </div>
          </div>

          {/* 5. Loan Metrics */}
          <div id="bank-kpi-strip" className="bg-white rounded-xl border border-surface-tertiary p-6">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-0.5">
              Loan Metrics
            </h3>
            <p className="text-xs text-text-tertiary mb-6">
              {pathLabel} · {
                activeScenario === 'upside' ? t('scenario.upside') :
                activeScenario === 'downside' ? t('scenario.downside') :
                activeScenario === 'breakeven' ? t('scenario.breakeven') :
                t('scenario.realistic')
              }
            </p>
            <div className="grid grid-cols-3 divide-x divide-surface-tertiary mb-4">
              <MetricCell
                value={formatCurrency(km.totalCapex, true, locale)}
                label={t('kpi.totalInvestment')}
                sublabel={(() => {
                  const n = projects.reduce((s, p) => s + p.count, 0);
                  return `${n} ${t(n === 1 ? 'kpi.plotsSingular' : 'kpi.plots')}`;
                })()}
              />
              <MetricCell
                value={formatCurrency(km.loanAmount, true, locale)}
                label={t('kpi.loanAmount')}
                sublabel={`${formatPercent(km.loanAmount / km.totalCapex, 0)} of CAPEX`}
                valueClass="text-brand-600"
              />
              <MetricCell
                value={formatPercent(km.ltv, 0)}
                label={t('kpi.ltvAtCompletion')}
                sublabel="appraised value"
              />
            </div>
            <div className="grid grid-cols-2 divide-x divide-surface-tertiary pt-4 border-t border-surface-tertiary">
              <MetricCell
                value={formatMultiple(km.assetCoverage)}
                label={t('kpi.assetCoverage')}
                sublabel={formatCurrency(km.portfolioValue, true, locale)}
              />
              <MetricCell
                value={formatMultiple(dscr2030)}
                label={t('term.dscr')}
                sublabel="Post-ramp · 2030"
                valueClass={dscr2030 >= 1.25 ? 'text-positive' : 'text-warning'}
              />
            </div>
          </div>

        </div>

        {/* 7. CAPEX Breakdown — where the money goes */}
        <div className="mb-10">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3">
            {t('capex.title')} — Use of Proceeds
          </h3>
          <div className="bg-white rounded-xl border border-surface-tertiary shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-secondary/40">
                  <th className="text-left py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('capex.costCategory')}</th>
                  <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('capex.total')}</th>
                  <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('capex.pctTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {model.capex.categories.map((cat, i) => (
                  <tr key={cat.name} className={`border-t border-surface-secondary/60 ${i % 2 === 0 ? '' : 'bg-surface-secondary/10'}`}>
                    <td className="py-2.5 px-5 text-text-secondary">{cat.name}</td>
                    <td className="text-right py-2.5 px-5 font-mono text-sm text-text-primary">{formatCurrency(cat.grandTotal, false, locale)}</td>
                    <td className="text-right py-2.5 px-5 font-mono text-sm text-text-tertiary">
                      {model.capex.portfolioTotal > 0
                        ? `${((cat.grandTotal / model.capex.portfolioTotal) * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-surface-tertiary bg-surface-secondary/30 font-semibold">
                  <td className="py-3.5 px-5 text-text-primary">{t('capex.totalCapex')}</td>
                  <td className="text-right py-3.5 px-5 font-mono text-brand-600">{formatCurrency(model.capex.portfolioTotal, false, locale)}</td>
                  <td className="text-right py-3.5 px-5 font-mono text-text-tertiary">100%</td>
                </tr>
              </tbody>
            </table>
            <div className="px-5 py-2.5 border-t border-surface-tertiary/50 bg-surface-secondary/10 text-[11px] text-text-tertiary">
              Loan: {formatCurrency(km.loanAmount, true, locale)} · Equity: {formatCurrency(km.equityRequired, true, locale)}{grantAmount > 0 ? ` · Grant: ${formatCurrency(grantAmount, true, locale)}` : ''} · Total: {formatCurrency(km.totalCapex, true, locale)}
            </div>
          </div>
        </div>

        {/* 8. Capital Structure + Stabilised Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          <div className="bg-white rounded-xl border border-surface-tertiary p-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-6">
              {t('inv.capitalStructure')}
            </h3>
            <div className="flex items-center gap-6">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={capitalData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={2} stroke="#FEFCF7">
                      {capitalData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value), false, locale)}
                      contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {capitalData.map((item) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <div>
                      <div className="text-sm font-medium text-text-primary">{formatCurrency(item.value, true, locale)}</div>
                      <div className="text-xs text-text-tertiary">{item.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Fix 3 — net leverage and peak debt rows */}
            <div className="mt-4 pt-4 border-t border-surface-tertiary/50 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary">Net leverage</span>
                <span className="font-mono font-medium text-text-primary">
                  {activeScenarioOutput.netLeverage > 0 ? `${activeScenarioOutput.netLeverage.toFixed(1)}× EBITDA` : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-text-secondary">Peak debt outstanding</span>
                <span className="font-mono font-medium text-text-primary">
                  {activeScenarioOutput.peakDebtOutstanding > 0
                    ? formatCurrency(activeScenarioOutput.peakDebtOutstanding, true, locale)
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-surface-tertiary p-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-1">
              {t('inv.stabilisedOps')}
            </h3>
            <p className="text-xs text-text-tertiary mb-5">{t('bank.stabilisedOpsSub')}</p>
            <div className="space-y-4">
              {[
                { label: t('inv.annualRevenue'), value: formatCurrency(activeStab?.totalRevenue ?? 0, true, locale) },
                { label: t('term.ebitda'), value: formatCurrency(activeStab?.ebitda ?? 0, true, locale) },
                { label: t('term.ebitdaMargin'), value: formatPercent(activeStab?.ebitdaMargin ?? 0) },
                { label: t('kpi.annualDS'), value: formatCurrency(km.annualDS, true, locale) },
                { label: t('term.dscr'), value: formatMultiple(activeStab?.dscr ?? 0), highlight: true },
                { label: t('pnl.ncfPostVAT'), value: formatCurrency(activeStab?.netCashFlow ?? 0, true, locale) },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex justify-between items-center py-2 ${item.highlight ? "bg-brand-50 -mx-3 px-3 rounded-lg" : ""}`}
                >
                  <span className="text-sm text-text-secondary">{item.label}</span>
                  <span className={`data-cell font-medium ${item.highlight ? "text-brand-600" : "text-text-primary"}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fix 2 — ICR / LLCR / PLCR coverage ratio cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            {
              label: "ICR — Stabilised",
              value: icrStabilised > 0 ? formatMultiple(icrStabilised) : "—",
              sub: "EBITDA / interest expense",
              tone: icrStabilised >= 3.0 ? "text-positive" : icrStabilised >= 2.0 ? "text-text-primary" : "text-warning",
            },
            {
              label: "LLCR — Loan Life",
              value: llcr > 0 ? formatMultiple(llcr) : "—",
              sub: "NPV(CFADS) / loan balance",
              tone: llcr >= 1.3 ? "text-positive" : llcr >= 1.0 ? "text-text-primary" : "text-warning",
            },
            {
              label: "PLCR — Project Life",
              value: plcr > 0 ? formatMultiple(plcr) : "—",
              sub: "NPV(CFADS, full horizon) / loan",
              tone: plcr >= 1.5 ? "text-positive" : plcr >= 1.0 ? "text-text-primary" : "text-warning",
            },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl border border-surface-tertiary p-5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-2">
                {card.label}
              </div>
              <div className={`kpi-value ${card.tone}`}>{card.value}</div>
              <div className="text-xs text-text-tertiary mt-1">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* 9. Debt Service Coverage Ratio (DSCR) Chart */}
        <div className="bg-white rounded-xl border border-surface-tertiary p-6 mb-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-1">
            {t('bank.section.repaymentCapacity')}
          </h3>
          <p className="text-xs text-text-tertiary mb-5 max-w-2xl">{t('bank.dscrChartSub')}</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dscrChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}×`} />
              <Tooltip
                formatter={(value) => `${Number(value).toFixed(2)}×`}
                contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={1.25} stroke="#9E3B3B" strokeDasharray="5 5" label={{ value: "1.25× covenant", fontSize: 10, fill: "#9E3B3B" }} />
              <ReferenceLine
                x={2029}
                stroke="#8B6914"
                strokeDasharray="3 3"
                label={{ value: "First full DS year", position: "insideTopRight", fontSize: 9, fill: "#8B6914" }}
              />
              <Line type="monotone" dataKey="Realistic" name={t('scenario.realistic')} stroke="#8B6914" strokeWidth={2.5} />
              <Line type="monotone" dataKey="Upside" name={t('scenario.upside')} stroke="#6B7A3D" strokeWidth={1.5} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="Downside" name={t('scenario.downside')} stroke="#C4754B" strokeWidth={1.5} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
          {rampHaircutNote}
        </div>

        {/* 10. Revenue & EBITDA Chart */}
        <div className="bg-white rounded-xl border border-surface-tertiary p-6 mb-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-1">
            {t('bank.section.projectedRevenue')}
          </h3>
          <p className="text-xs text-text-tertiary mb-5 max-w-2xl">{t('bank.revenueEbitdaSub')}</p>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value), false, locale)}
                contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" name={t('pnl.totalRevenue')} fill="#C4A55E" radius={[4, 4, 0, 0]} />
              <Bar dataKey="EBITDA" name={t('term.ebitda')} fill="#6B7A3D" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="Net Cash Flow" name={t('kpi.netCashFlow')} stroke="#4A6A8B" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Fix 4 — Scenario DSCR summary table (before full stress test) */}
        {(() => {
          const covenant = assumptions.dscrCovenantThreshold ?? 1.25;
          const rows = [
            {
              scenario: "Upside",
              stabDscr: model.scenarios.upside.stabilisedYear?.dscr ?? 0,
              minDscr: model.scenarios.upside.minDSCRLoanLife,
            },
            {
              scenario: "Realistic",
              stabDscr: model.scenarios.realistic.stabilisedYear?.dscr ?? 0,
              minDscr: model.scenarios.realistic.minDSCRLoanLife,
            },
            {
              scenario: "Downside",
              stabDscr: model.scenarios.downside.stabilisedYear?.dscr ?? 0,
              minDscr: model.scenarios.downside.minDSCRLoanLife,
            },
          ];
          return (
            <div className="bg-white rounded-xl border border-surface-tertiary p-5 mb-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-4">
                Scenario DSCR Summary
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-tertiary">
                    <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">Scenario</th>
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">Stabilised DSCR</th>
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">Min DSCR (loan life)</th>
                    <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">Covenant {covenant.toFixed(2)}×</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const pass = row.minDscr >= covenant;
                    return (
                      <tr key={row.scenario} className="border-b border-surface-secondary/50">
                        <td className="py-2.5 pr-4 text-text-secondary font-medium">{row.scenario}</td>
                        <td className="text-right py-2.5 px-3 font-mono text-text-primary">{row.stabDscr > 0 ? formatMultiple(row.stabDscr) : "—"}</td>
                        <td className={`text-right py-2.5 px-3 font-mono font-semibold ${pass ? "text-positive" : "text-warning"}`}>
                          {row.minDscr > 0 ? formatMultiple(row.minDscr) : "—"}
                        </td>
                        <td className="text-right py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${pass ? "bg-positive/15 text-positive" : "bg-warning/15 text-warning"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${pass ? "bg-positive" : "bg-warning"}`} />
                            {pass ? "Pass" : "Fail"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* 11. Stress Scenarios */}
        <div id="bank-stress-test" className="mb-6 print:hidden">
          <BankStressTest />
          <div className="mt-3 text-right print:hidden">
            <a href="/admin/sensitivity" className="text-xs text-brand-700 hover:underline font-medium">
              Full sensitivity analysis →
            </a>
          </div>
        </div>

        {/* 12. Financing Path Comparison */}
        <div id="bank-financing-comparison" className="bg-white rounded-xl border border-surface-tertiary p-6 mb-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-1">
            {t('dash.financingComparison')}
          </h3>
          <p className="text-[11px] text-text-tertiary mb-5">Use the path pills in the bar above to switch the active path. The highlighted column shows the currently selected structure.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-tertiary">
                  <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('common.metric')}</th>
                  <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass('commercial')}`}>
                    <span className={activePath === 'commercial' ? 'bg-brand-500 text-white rounded px-2 py-0.5' : 'text-text-tertiary'}>
                      {t('path.commercialShort')}
                    </span>
                  </th>
                  <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass('rrf')}`}>
                    <span className={activePath === 'rrf' ? 'bg-brand-500 text-white rounded px-2 py-0.5' : 'text-text-tertiary'}>
                      {t('path.rrfShort')}
                    </span>
                  </th>
                  <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass('grant')}`}>
                    <span className={activePath === 'grant' ? 'bg-brand-500 text-white rounded px-2 py-0.5' : 'text-positive'}>
                      {t('path.grantShort')}
                    </span>
                  </th>
                  <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass('tepix-loan')}`}>
                    <span className={activePath === 'tepix-loan' ? 'bg-brand-500 text-white rounded px-2 py-0.5' : ''} style={activePath !== 'tepix-loan' ? { color: '#7B5EA7' } : {}}>
                      {t('path.tepixLoanShort')}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {model.financingComparison.map((row, i) => {
                  const formatVal = (val: string | number) =>
                    typeof val === "number"
                      ? row.metric.includes("DSCR") ? formatMultiple(val) : formatCurrency(val, true, locale)
                      : val;
                  return (
                    <tr key={i} className="border-b border-surface-secondary/50">
                      <td className="py-2.5 pr-4 text-text-secondary">{row.metric}</td>
                      <td className={`text-right py-2.5 px-3 data-cell ${colClass('commercial')}`}>{formatVal(row.commercial)}</td>
                      <td className={`text-right py-2.5 px-3 data-cell ${colClass('rrf')}`}>{formatVal(row.rrf)}</td>
                      <td className={`text-right py-2.5 px-3 data-cell text-positive font-medium ${colClass('grant')}`}>{formatVal(row.grant)}</td>
                      <td className={`text-right py-2.5 px-3 data-cell ${colClass('tepix-loan')}`} style={{ color: '#7B5EA7' }}>{formatVal(row.tepixLoan)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fix 5 — Hotel exit IRR vs Property exit IRR */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`rounded-xl border p-5 ${!propertyExitDominates ? "bg-brand-50 border-brand-200" : "bg-white border-surface-tertiary"}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                Hotel Exit — Equity IRR
              </div>
              {!propertyExitDominates && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-positive/15 text-positive">
                  <span className="w-1.5 h-1.5 rounded-full bg-positive" />
                  Preferred exit
                </span>
              )}
            </div>
            <div className={`kpi-value ${hotelExitIRR >= 0.15 ? "text-positive" : hotelExitIRR > 0 ? "text-text-primary" : "text-warning"}`}>
              {hotelExitIRR > 0 ? formatPercent(hotelExitIRR) : "—"}
            </div>
            <div className="text-xs text-text-tertiary mt-1">EBITDA × exit multiple</div>
          </div>
          <div className={`rounded-xl border p-5 ${propertyExitDominates ? "bg-brand-50 border-brand-200" : "bg-white border-surface-tertiary"}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                Property Exit — Equity IRR
              </div>
              {propertyExitDominates && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-positive/15 text-positive">
                  <span className="w-1.5 h-1.5 rounded-full bg-positive" />
                  Preferred exit
                </span>
              )}
            </div>
            <div className={`kpi-value ${propertyExitIRR >= 0.15 ? "text-positive" : propertyExitIRR > 0 ? "text-text-primary" : "text-warning"}`}>
              {propertyExitIRR > 0 ? formatPercent(propertyExitIRR) : "—"}
            </div>
            <div className="text-xs text-text-tertiary mt-1">Built surface × €/m²</div>
          </div>
        </div>

        {/* 13. All-Paths DSCR Trajectory — includes RRF */}
        <div className="bg-white rounded-xl border border-surface-tertiary p-6 mb-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-1">
            {t('dash.dscrTrajectory')}
          </h3>
          <p className="text-xs text-text-tertiary mb-5 max-w-2xl">{t('bank.allPathsChartSub')}</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={model.dscrByYear.filter((d) => d.year >= 2028).map((d) => ({
              year: d.year,
              Commercial: Number(d.realistic.toFixed(2)),
              Grant: Number(d.grant.toFixed(2)),
              "TEPIX Loan": Number(d.tepixLoan.toFixed(2)),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}×`} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(2)}×`} contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={1.25} stroke="#9E3B3B" strokeDasharray="5 5" label={{ value: "1.25× covenant", fontSize: 10, fill: "#9E3B3B" }} />
              <ReferenceLine
                x={2029}
                stroke="#8B6914"
                strokeDasharray="3 3"
                label={{ value: "First full DS year", position: "insideTopRight", fontSize: 9, fill: "#8B6914" }}
              />
              <Line type="monotone" dataKey="Commercial" name={t('path.commercialShort')} stroke="#8B6914" strokeWidth={2} />
              <Line type="monotone" dataKey="Grant" name={t('path.grantShort')} stroke="#4A7C3F" strokeWidth={1.5} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="TEPIX Loan" name={t('path.tepixLoanShort')} stroke="#7B5EA7" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 14. P&L Timeline — detailed evidence */}
        <div id="bank-pnl" className="mb-10">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3">
            {t('pnl.title')}
          </h3>
          {rampHaircutNote}
          <BankPnLSection />
        </div>

        {/* 15. Footer */}
        <div className="text-center py-8 border-t border-surface-tertiary">
          <p className="text-xs text-text-tertiary">
            {t('app.title')} &middot; Agios Georgios, Antiparos, Greece &middot; {t('app.confidential')}
          </p>
        </div>

      </div>
    </>
  );
}
