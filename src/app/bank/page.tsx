"use client";

import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { LiveTrackRecord } from "@/components/LiveTrackRecord";
import { ConservatismTriangle } from "@/components/ConservatismTriangle";
import { PageTour, TourButton, usePageTour } from "@/components/PageTour";
import { BankPnLSection } from "@/components/BankPnLSection";
import { BankStressTest } from "@/components/BankStressTest";
import BankControlBar from "@/components/BankControlBar";
import { BANK_TOUR } from "@/lib/tours/configs";
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

function HeroKPI({ value, label, sublabel }: { value: string; label: string; sublabel?: string }) {
  return (
    <div className="text-center">
      <div className="kpi-hero text-text-primary">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wider text-brand-500 mt-2">{label}</div>
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
    capTable,
    waterfall,
    financingPathOverride,
    setFinancingPathOverride,
  } = useModelStore();
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(BANK_TOUR.storageKey);

  if (!model) return (
    <div className="flex items-center justify-center h-96 text-text-tertiary">
      {t('common.loading')}
    </div>
  );

  // The active path for display is the ephemeral override if set, else the stored assumption.
  const activePath = financingPathOverride ?? assumptions.financingPath;

  const handleDownloadXlsx = async () => {
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
  };

  const handleDownloadPdf = async () => {
    const { exportBankReport } = await import('@/lib/pdf/exportBankReport');
    const blob = await exportBankReport(assumptions, model);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `villa-lev-bank-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const km = model.keyMetrics;
  const pnl = model.scenarios.realistic.pnl.filter((p) => p.year >= 2028);

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
            {t('app.loanApp')} &middot; {pathLabel} &middot; {t('app.confidential')}
          </p>

          {/* 2. Download buttons row */}
          <div className="mt-6 flex items-center justify-center gap-3 print:hidden flex-wrap">
            <button
              onClick={handleDownloadXlsx}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-all shadow-sm"
              title="Download a fully-linked Excel model with editable formulas"
            >
              ⬇ Download model (.xlsx)
            </button>
            <button
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-brand-700 border border-brand-200 text-sm font-medium hover:bg-brand-50 transition-all shadow-sm"
              title="Download a 4-page bank credit report PDF"
            >
              📄 Download bank report (.pdf)
            </button>
            <TourButton onClick={() => setTourOpen(true)} pulsing={!!neverSeen} />
          </div>
        </div>

        {/* 3. Full P&L Table — moved up */}
        <div id="bank-pnl" className="mb-10">
          <BankPnLSection />
        </div>

        {/* 4. Hero KPI strip */}
        <div id="bank-kpi-strip" className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-10 py-6 border-y border-surface-tertiary">
          <HeroKPI
            value={formatCurrency(km.totalCapex, true, locale)}
            label={t('kpi.totalInvestment')}
            sublabel={(() => {
              const n = projects.reduce((s, p) => s + p.count, 0);
              return `${n} ${t(n === 1 ? 'kpi.plotsSingular' : 'kpi.plots')}`;
            })()}
          />
          <HeroKPI
            value={formatCurrency(km.loanAmount, true, locale)}
            label={t('kpi.loanAmount')}
            sublabel={`${formatPercent(km.loanAmount / km.totalCapex, 0)} coverage`}
          />
          <HeroKPI
            value={`~${formatPercent(km.ltv, 0)}`}
            label={t('kpi.ltvAtCompletion')}
          />
          <HeroKPI
            value={formatMultiple(km.assetCoverage)}
            label={t('kpi.assetCoverage')}
            sublabel={`${formatCurrency(km.portfolioValue, true, locale)}`}
          />
          <HeroKPI
            value={formatMultiple(km.stabilisedDSCR)}
            label={t('term.dscr')}
            sublabel={t('bank.heroKpiDscrSub')}
          />
        </div>

        {/* 5. Capital Structure + Stabilised Metrics */}
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
          </div>

          <div className="bg-white rounded-xl border border-surface-tertiary p-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-1">
              {t('inv.stabilisedOps')}
            </h3>
            <p className="text-xs text-text-tertiary mb-5">{t('bank.stabilisedOpsSub')}</p>
            <div className="space-y-4">
              {[
                { label: t('inv.annualRevenue'), value: formatCurrency(km.stabilisedRevenue, true, locale) },
                { label: t('term.ebitda'), value: formatCurrency(km.stabilisedEBITDA, true, locale) },
                { label: t('term.ebitdaMargin'), value: formatPercent(km.stabilisedEBITDAMargin) },
                { label: t('kpi.annualDS'), value: formatCurrency(km.annualDS, true, locale) },
                { label: t('term.dscr'), value: formatMultiple(km.stabilisedDSCR), highlight: true },
                { label: t('pnl.ncfPostVAT'), value: formatCurrency(km.stabilisedNCF, true, locale) },
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

        {/* 6. DSCR Chart — renamed heading */}
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
              <ReferenceLine y={1.25} stroke="#9E3B3B" strokeDasharray="5 5" label={{ value: "1.25× min", fontSize: 10 }} />
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
        </div>

        {/* 7. Stress Test — open by default, moved up */}
        <div id="bank-stress-test" className="mb-6 print:hidden">
          <BankStressTest />
        </div>

        {/* 8. Live Track Record */}
        <div className="mb-10 print:hidden">
          <LiveTrackRecord />
        </div>

        {/* 9. Conservatism Triangle */}
        <div className="mb-10 print:hidden">
          <ConservatismTriangle
            bpStandardADR={assumptions.revenueRealistic.suiteStandardADR}
            bpPremiumADR={assumptions.revenueRealistic.suiteDoubleADR}
          />
        </div>

        {/* 10. Revenue & EBITDA Chart — renamed heading */}
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

        {/* 11. Financing Path Comparison — interactive columns */}
        <div id="bank-financing-comparison" className="bg-white rounded-xl border border-surface-tertiary p-6 mb-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-6">
            {t('dash.financingComparison')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-tertiary">
                  <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('common.metric')}</th>
                  <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass('commercial')}`}>
                    <button
                      onClick={() => setFinancingPathOverride('commercial')}
                      title="Switch to Commercial path"
                    >
                      <span className={activePath === 'commercial' ? 'bg-brand-500 text-white rounded px-2 py-0.5' : 'text-text-tertiary'}>
                        {t('path.commercialShort')}
                      </span>
                    </button>
                  </th>
                  <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass('rrf')}`}>
                    <button
                      onClick={() => setFinancingPathOverride('rrf')}
                      title="Switch to RRF path"
                    >
                      <span className={activePath === 'rrf' ? 'bg-brand-500 text-white rounded px-2 py-0.5' : 'text-text-tertiary'}>
                        {t('path.rrfShort')}
                      </span>
                    </button>
                  </th>
                  <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass('grant')}`}>
                    <button
                      onClick={() => setFinancingPathOverride('grant')}
                      title="Switch to Grant path"
                    >
                      <span className={activePath === 'grant' ? 'bg-brand-500 text-white rounded px-2 py-0.5' : 'text-positive'}>
                        {t('path.grantShort')}
                      </span>
                    </button>
                  </th>
                  <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass('tepix-loan')}`}>
                    <button
                      onClick={() => setFinancingPathOverride('tepix-loan')}
                      title="Switch to TEPIX Loan path"
                    >
                      <span className={activePath === 'tepix-loan' ? 'bg-brand-500 text-white rounded px-2 py-0.5' : ''} style={activePath !== 'tepix-loan' ? { color: '#7B5EA7' } : {}}>
                        {t('path.tepixLoanShort')}
                      </span>
                    </button>
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

        {/* 12. All-Paths DSCR Trajectory */}
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
              <ReferenceLine y={1.25} stroke="#9E3B3B" strokeDasharray="5 5" label={{ value: "1.25×", fontSize: 10 }} />
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

        {/* 13. Collateral — renamed heading */}
        <div id="bank-collateral" className="bg-white rounded-xl border border-surface-tertiary p-6 mb-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-6">
            {t('bank.section.collateral')}
          </h3>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="kpi-value text-text-primary">{formatMultiple(model.collateral.stress.coverage)}</div>
              <div className="text-xs text-text-tertiary mt-1">{t('sc.stress')}</div>
              <div className="text-xs text-text-tertiary">LTV {formatPercent(model.collateral.stress.ltv)}</div>
            </div>
            <div className="border-x border-surface-tertiary">
              <div className="kpi-value text-brand-600">{formatMultiple(model.collateral.market.coverage)}</div>
              <div className="text-xs text-text-tertiary mt-1">{t('sc.market')}</div>
              <div className="text-xs text-text-tertiary">LTV {formatPercent(model.collateral.market.ltv)}</div>
            </div>
            <div>
              <div className="kpi-value text-positive">{formatMultiple(model.collateral.optimistic.coverage)}</div>
              <div className="text-xs text-text-tertiary mt-1">{t('sc.optimistic')}</div>
              <div className="text-xs text-text-tertiary">LTV {formatPercent(model.collateral.optimistic.ltv)}</div>
            </div>
          </div>
        </div>

        {/* 14. Footer */}
        <div className="text-center py-8 border-t border-surface-tertiary">
          <p className="text-xs text-text-tertiary">
            {t('app.title')} &middot; Agios Georgios, Antiparos, Greece &middot; {t('app.confidential')}
          </p>
        </div>

        <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={BANK_TOUR} />
      </div>
    </>
  );
}
