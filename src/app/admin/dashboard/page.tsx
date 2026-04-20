"use client";

import { useModelStore } from "@/lib/store/modelStore";
import {
  formatCurrency,
  formatPercent,
  formatMultiple,
} from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
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
  Cell,
} from "recharts";

function KPICard({
  label,
  value,
  sublabel,
  accent = false,
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${accent ? "bg-brand-50 border-brand-200" : "bg-white border-surface-tertiary"}`}
    >
      <div className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-2">
        {label}
      </div>
      <div className="kpi-value text-text-primary">{value}</div>
      {sublabel && (
        <div className="text-xs text-text-tertiary mt-1">{sublabel}</div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { t, locale } = useTranslation();
  const { model, assumptions, activeScenario } = useModelStore();

  if (!model) {
    return (
      <div className="flex items-center justify-center h-64 text-text-tertiary">
        {t('common.loading')}
      </div>
    );
  }

  const activePnL = model.scenarios[activeScenario].pnl;
  const stab = model.scenarios[activeScenario].stabilisedYear;

  const km = {
    ...model.keyMetrics,
    stabilisedRevenue: stab?.totalRevenue ?? 0,
    stabilisedEBITDA: stab?.ebitda ?? 0,
    stabilisedEBITDAMargin: stab?.ebitdaMargin ?? 0,
    stabilisedDSCR: stab?.dscr ?? 0,
    stabilisedNCF: stab?.netCashFlowPostVAT ?? 0,
  };

  const pathLabel =
    assumptions.financingPath === "grant"
      ? t('path.grant')
      : assumptions.financingPath === "rrf"
        ? t('path.rrf')
        : assumptions.financingPath === "tepix-loan"
          ? t('path.tepixLoan')
          : t('path.commercial');

  const scenarioLabel = activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1);

  // Chart data
  const revenueChartData = activePnL
    .filter((p) => p.year >= 2028)
    .map((p) => ({
      year: p.year,
      Revenue: Math.round(p.totalRevenue),
      OPEX: Math.round(p.totalOpex),
      EBITDA: Math.round(p.ebitda),
      "Debt Service": Math.round(p.debtService),
      NCF: Math.round(p.netCashFlow),
    }));

  const dscrData = model.dscrByYear
    .filter((d) => d.year >= 2028)
    .map((d) => ({
      year: d.year,
      Realistic: Number(d.realistic.toFixed(2)),
      Upside: Number(d.upside.toFixed(2)),
      Downside: Number(d.downside.toFixed(2)),
      Grant: Number(d.grant.toFixed(2)),
      "TEPIX Loan": Number(d.tepixLoan.toFixed(2)),
    }));

  // Financing comparison chart data
  const compPaths = [
    { key: 'commercial', label: t('path.commercialShort'), color: '#8B6914' },
    { key: 'rrf', label: t('path.rrfShort'), color: '#4A6A8B' },
    { key: 'grant', label: t('path.grantShort'), color: '#4A7C3F' },
    { key: 'tepixLoan', label: t('path.tepixLoanShort'), color: '#7B5EA7' },
  ];

  const capitalStructureData = compPaths.map((p) => ({
    name: p.label,
    Loan: model.financingComparison[0]?.[p.key as keyof typeof model.financingComparison[0]] as number || 0,
    Equity: model.financingComparison[2]?.[p.key as keyof typeof model.financingComparison[0]] as number || 0,
    Grant: model.financingComparison[1]?.[p.key as keyof typeof model.financingComparison[0]] as number || 0,
  }));

  const annualDSData = compPaths.map((p) => ({
    name: p.label,
    DS: model.financingComparison[3]?.[p.key as keyof typeof model.financingComparison[0]] as number || 0,
    color: p.color,
  }));

  const stabilisedDSCRData = compPaths.map((p) => ({
    name: p.label,
    DSCR: model.financingComparison[4]?.[p.key as keyof typeof model.financingComparison[0]] as number || 0,
    color: p.color,
  }));

  // DSCR trajectory for all paths
  const dscrTrajectoryData = model.dscrByYear
    .filter((d) => d.year >= 2028)
    .map((d) => ({
      year: d.year,
      Commercial: Number(d.realistic.toFixed(2)),
      RRF: Number((d.year >= 2028 ? model.dscrByYear.find(r => r.year === d.year)?.realistic ?? 0 : 0).toFixed(2)),
      Grant: Number(d.grant.toFixed(2)),
      "TEPIX Loan": Number(d.tepixLoan.toFixed(2)),
    }));

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-text-primary">
            {t('dash.title')}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {pathLabel} &middot; {scenarioLabel} &middot; {t('dash.stabilisedYear')}
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPICard
          label={t('kpi.totalInvestment')}
          value={formatCurrency(km.totalCapex, true, locale)}
          sublabel={t('kpi.totalInvestmentSub')}
        />
        <KPICard
          label={t('kpi.stabilisedRevenue')}
          value={formatCurrency(km.stabilisedRevenue, true, locale)}
          sublabel={t('kpi.stabilisedRevenueSub')}
          accent
        />
        <KPICard
          label={t('term.ebitda')}
          value={formatCurrency(km.stabilisedEBITDA, true, locale)}
          sublabel={`${t('kpi.margin')} ${formatPercent(km.stabilisedEBITDAMargin)}`}
          accent
        />
        <KPICard
          label={t('term.dscr')}
          value={formatMultiple(km.stabilisedDSCR)}
          sublabel={t('kpi.debtServiceCoverage')}
          accent={km.stabilisedDSCR >= 1.5}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPICard
          label={t('kpi.loanAmount')}
          value={formatCurrency(km.loanAmount, true, locale)}
          sublabel={`${formatPercent(km.loanAmount / km.totalCapex, 0)} ${t('kpi.ofTotal')}`}
        />
        <KPICard
          label={t('kpi.equityRequired')}
          value={formatCurrency(km.equityRequired, true, locale)}
          sublabel={`${formatPercent(km.equityRequired / km.totalCapex, 0)} ${t('kpi.ofTotal')}`}
        />
        <KPICard
          label={t('kpi.annualDS')}
          value={formatCurrency(km.annualDS, true, locale)}
          sublabel={t('kpi.annualDSSub')}
        />
        <KPICard
          label={t('kpi.netCashFlow')}
          value={formatCurrency(km.stabilisedNCF, true, locale)}
          sublabel={t('kpi.netCashFlowSub')}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPICard
          label={t('kpi.portfolioValue')}
          value={formatCurrency(km.portfolioValue, true, locale)}
          sublabel={t('kpi.portfolioValueSub')}
        />
        <KPICard
          label={t('term.ltv')}
          value={formatPercent(km.ltv)}
          sublabel={t('kpi.ltvAtCompletion')}
        />
        <KPICard
          label={t('kpi.assetCoverage')}
          value={formatMultiple(km.assetCoverage)}
          sublabel={t('kpi.assetCoverageSub')}
        />
        <KPICard
          label={t('kpi.bufferBreakEven')}
          value={formatPercent(km.bufferToBreakEven)}
          sublabel={t('kpi.bufferBreakEvenSub')}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue & EBITDA Chart */}
        <div className="bg-white rounded-xl border border-surface-tertiary p-5">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
            {t('dash.revenueEbitda')}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value), false, locale)}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #EDE6D5",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" name={t('pnl.totalRevenue')} fill="#C4A55E" radius={[4, 4, 0, 0]} />
              <Bar dataKey="EBITDA" name={t('term.ebitda')} fill="#6B7A3D" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="Debt Service"
                name={t('pnl.debtService')}
                stroke="#9E3B3B"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* DSCR Chart */}
        <div className="bg-white rounded-xl border border-surface-tertiary p-5">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
            {t('dash.dscrByScenario')}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dscrData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `${v.toFixed(1)}×`}
              />
              <Tooltip
                formatter={(value) => `${Number(value).toFixed(2)}×`}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #EDE6D5",
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine
                y={1.25}
                stroke="#9E3B3B"
                strokeDasharray="5 5"
                label={{ value: "1.25× min", fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="Realistic"
                name={t('scenario.realistic')}
                stroke="#8B6914"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="Upside"
                name={t('scenario.upside')}
                stroke="#6B7A3D"
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
              <Line
                type="monotone"
                dataKey="Downside"
                name={t('scenario.downside')}
                stroke="#C4754B"
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
              <Line
                type="monotone"
                dataKey="Grant"
                name={t('scenario.grantPath')}
                stroke="#4A6A8B"
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cash Flow Table */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-5 mb-8">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
          {t('dash.pnlSummary')} — {scenarioLabel}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-text-tertiary font-medium text-xs uppercase tracking-wider">
                  {t('pnl.item')}
                </th>
                {activePnL.map((p) => (
                  <th
                    key={p.year}
                    className="text-right py-2 px-2 text-text-tertiary font-medium text-xs uppercase tracking-wider"
                  >
                    {p.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-surface-secondary">
                <td className="py-2 pr-4 text-text-secondary text-xs">
                  {t('pnl.phase')}
                </td>
                {activePnL.map((p) => (
                  <td
                    key={p.year}
                    className="text-right py-2 px-2 text-text-tertiary text-xs"
                  >
                    {p.phase}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium">{t('pnl.totalRevenue')}</td>
                {activePnL.map((p) => (
                  <td key={p.year} className="text-right py-2 px-2 data-cell">
                    {p.totalRevenue > 0
                      ? formatCurrency(p.totalRevenue, true, locale)
                      : "—"}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 pr-4 text-text-secondary">{t('pnl.totalOpex')}</td>
                {activePnL.map((p) => (
                  <td
                    key={p.year}
                    className="text-right py-2 px-2 data-cell text-text-secondary"
                  >
                    {p.totalOpex > 0
                      ? formatCurrency(p.totalOpex, true, locale)
                      : "—"}
                  </td>
                ))}
              </tr>
              <tr className="font-medium bg-surface-secondary/50">
                <td className="py-2 pr-4">{t('term.ebitda')}</td>
                {activePnL.map((p) => (
                  <td key={p.year} className="text-right py-2 px-2 data-cell">
                    {p.ebitda !== 0
                      ? formatCurrency(p.ebitda, true, locale)
                      : "—"}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 pr-4 text-text-secondary">
                  {t('pnl.debtService')}
                </td>
                {activePnL.map((p) => (
                  <td
                    key={p.year}
                    className="text-right py-2 px-2 data-cell text-negative"
                  >
                    {p.debtService > 0
                      ? formatCurrency(p.debtService, true, locale)
                      : "—"}
                  </td>
                ))}
              </tr>
              <tr className="font-medium border-t border-surface-tertiary">
                <td className="py-2 pr-4">{t('kpi.netCashFlow')}</td>
                {activePnL.map((p) => (
                  <td
                    key={p.year}
                    className={`text-right py-2 px-2 data-cell ${p.netCashFlow >= 0 ? "text-positive" : "text-negative"}`}
                  >
                    {formatCurrency(p.netCashFlow, true, locale)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 pr-4 text-text-secondary">{t('term.dscr')}</td>
                {activePnL.map((p) => (
                  <td
                    key={p.year}
                    className={`text-right py-2 px-2 data-cell ${
                      p.dscr >= 1.25
                        ? "text-positive"
                        : p.dscr > 0
                          ? "text-warning"
                          : "text-text-tertiary"
                    }`}
                  >
                    {p.dscr > 0 ? formatMultiple(p.dscr) : "—"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Financing Comparison Table */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-5 mb-8">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
          {t('dash.financingComparison')}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-text-tertiary font-medium text-xs uppercase tracking-wider">
                  {t('common.metric')}
                </th>
                <th className="text-right py-2 px-3 text-text-tertiary font-medium text-xs uppercase tracking-wider">
                  {t('path.commercialShort')}
                </th>
                <th className="text-right py-2 px-3 text-text-tertiary font-medium text-xs uppercase tracking-wider">
                  {t('path.rrfShort')}
                </th>
                <th className="text-right py-2 px-3 text-text-tertiary font-medium text-xs uppercase tracking-wider">
                  {t('path.grantShort')}
                </th>
                <th className="text-right py-2 px-3 font-medium text-xs uppercase tracking-wider" style={{ color: '#7B5EA7' }}>
                  {t('path.tepixLoanShort')}
                </th>
              </tr>
            </thead>
            <tbody>
              {model.financingComparison.map((row, i) => {
                const formatVal = (val: string | number) =>
                  typeof val === "number"
                    ? row.metric.includes("DSCR")
                      ? formatMultiple(val)
                      : formatCurrency(val, true, locale)
                    : val;
                return (
                  <tr key={i} className={i % 2 === 0 ? "bg-surface-secondary/30" : ""}>
                    <td className="py-2 pr-4 text-text-secondary">{row.metric}</td>
                    <td className="text-right py-2 px-3 data-cell">{formatVal(row.commercial)}</td>
                    <td className="text-right py-2 px-3 data-cell">{formatVal(row.rrf)}</td>
                    <td className="text-right py-2 px-3 data-cell text-positive font-medium">{formatVal(row.grant)}</td>
                    <td className="text-right py-2 px-3 data-cell" style={{ color: '#7B5EA7' }}>{formatVal(row.tepixLoan)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financing Path Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Capital Structure */}
        <div className="bg-white rounded-xl border border-surface-tertiary p-5">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
            {t('dash.capitalStructureChart')}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={capitalStructureData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `€${(v / 1_000_000).toFixed(1)}M`} />
              <Tooltip formatter={(value) => formatCurrency(Number(value), true, locale)} contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Loan" name={t('inv.loan')} stackId="a" fill="#8B6914" />
              <Bar dataKey="Equity" name={t('kpi.equityRequired')} stackId="a" fill="#6B7A3D" />
              <Bar dataKey="Grant" name={t('path.grantShort')} stackId="a" fill="#4A6A8B" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Annual DS */}
        <div className="bg-white rounded-xl border border-surface-tertiary p-5">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
            {t('dash.annualDSChart')}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={annualDSData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(value) => formatCurrency(Number(value), false, locale)} contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }} />
              <Bar dataKey="DS" name={t('kpi.annualDS')} radius={[4, 4, 0, 0]}>
                {annualDSData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stabilised DSCR */}
        <div className="bg-white rounded-xl border border-surface-tertiary p-5">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
            {t('dash.stabilisedDSCRChart')}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={stabilisedDSCRData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}×`} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(2)}×`} contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }} />
              <ReferenceLine y={1.25} stroke="#9E3B3B" strokeDasharray="5 5" label={{ value: "1.25× min", fontSize: 10 }} />
              <Bar dataKey="DSCR" name={t('term.dscr')} radius={[4, 4, 0, 0]}>
                {stabilisedDSCRData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* DSCR Trajectory */}
        <div className="bg-white rounded-xl border border-surface-tertiary p-5">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
            {t('dash.dscrTrajectory')}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dscrTrajectoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}×`} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(2)}×`} contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={1.25} stroke="#9E3B3B" strokeDasharray="5 5" label={{ value: "1.25×", fontSize: 10 }} />
              <Line type="monotone" dataKey="Commercial" name={t('path.commercialShort')} stroke="#8B6914" strokeWidth={2} />
              <Line type="monotone" dataKey="Grant" name={t('path.grantShort')} stroke="#4A7C3F" strokeWidth={1.5} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="TEPIX Loan" name={t('path.tepixLoanShort')} stroke="#7B5EA7" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
