"use client";

import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
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

export default function InvestorPage() {
  const { t, locale } = useTranslation();
  const { model, assumptions } = useModelStore();
  if (!model) return <div className="flex items-center justify-center h-96 text-text-tertiary">{t('common.loading')}</div>;

  const km = model.keyMetrics;
  const pnl = model.scenarios.realistic.pnl.filter((p) => p.year >= 2028);

  const pathLabel =
    assumptions.financingPath === "grant"
      ? t('path.grant')
      : assumptions.financingPath === "rrf"
        ? t('path.rrf')
        : t('path.commercial');

  // Capital structure pie
  const grantAmount =
    assumptions.financingPath === "grant"
      ? km.totalCapex - km.loanAmount - km.equityRequired
      : 0;
  const capitalData = [
    { name: t('inv.loan'), value: km.loanAmount, color: "#8B6914" },
    { name: t('kpi.equityRequired'), value: km.equityRequired, color: "#6B7A3D" },
    ...(grantAmount > 0
      ? [{ name: t('path.grantShort'), value: grantAmount, color: "#4A6A8B" }]
      : []),
  ];

  // Revenue/EBITDA chart
  const chartData = pnl.map((p) => ({
    year: p.year,
    Revenue: Math.round(p.totalRevenue),
    EBITDA: Math.round(p.ebitda),
    "Net Cash Flow": Math.round(p.netCashFlow),
  }));

  // DSCR chart
  const dscrChart = model.dscrByYear
    .filter((d) => d.year >= 2028)
    .map((d) => ({
      year: d.year,
      Realistic: Number(d.realistic.toFixed(2)),
      Upside: Number(d.upside.toFixed(2)),
      Downside: Number(d.downside.toFixed(2)),
    }));

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <p className="text-sm text-brand-500 font-medium uppercase tracking-widest mb-3">
          {t('inv.portfolioExpansion')}
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-text-primary mb-3">
          {t('app.title')}
        </h1>
        <p className="text-text-secondary max-w-xl mx-auto">
          {t('app.loanApp')} &middot; {pathLabel} &middot; {t('app.confidential')}
        </p>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16 py-8 border-y border-surface-tertiary">
        <HeroKPI
          value={formatCurrency(km.totalCapex, true, locale)}
          label={t('kpi.totalInvestment')}
          sublabel={t('kpi.totalInvestmentSub')}
        />
        <HeroKPI
          value={formatCurrency(km.loanAmount, true, locale)}
          label={t('kpi.loanAmount')}
          sublabel={`${formatPercent(km.loanAmount / km.totalCapex, 0)} coverage`}
        />
        <HeroKPI
          value={`~${formatPercent(km.ltv, 0)}`}
          label={t('kpi.ltvAtCompletion')}
          sublabel={`${formatMultiple(km.assetCoverage)}`}
        />
        <HeroKPI
          value={formatMultiple(km.assetCoverage)}
          label={t('kpi.assetCoverage')}
          sublabel={`${formatCurrency(km.portfolioValue, true, locale)}`}
        />
      </div>

      {/* Two-column: Capital Structure + Stabilised Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
        {/* Capital Structure */}
        <div className="bg-white rounded-xl border border-surface-tertiary p-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-6">
            {t('inv.capitalStructure')}
          </h3>
          <div className="flex items-center gap-6">
            <div className="w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={capitalData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="#FEFCF7"
                  >
                    {capitalData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value), false, locale)}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #EDE6D5",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {capitalData.map((item) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      {formatCurrency(item.value, true, locale)}
                    </div>
                    <div className="text-xs text-text-tertiary">{item.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stabilised Year */}
        <div className="bg-white rounded-xl border border-surface-tertiary p-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-6">
            {t('inv.stabilisedOps')}
          </h3>
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

      {/* Revenue & EBITDA Chart */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-6 mb-8">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-6">
          {t('inv.revenueEbitda')}
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData}>
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
            <Bar dataKey="Revenue" name={t('pnl.totalRevenue')} fill="#C4A55E" radius={[4, 4, 0, 0]} />
            <Bar dataKey="EBITDA" name={t('term.ebitda')} fill="#6B7A3D" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="Net Cash Flow" name={t('kpi.netCashFlow')} stroke="#4A6A8B" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* DSCR Chart */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-6 mb-8">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-6">
          {t('term.dscrFull')}
        </h3>
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
            <Line type="monotone" dataKey="Realistic" name={t('scenario.realistic')} stroke="#8B6914" strokeWidth={2.5} />
            <Line type="monotone" dataKey="Upside" name={t('scenario.upside')} stroke="#6B7A3D" strokeWidth={1.5} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="Downside" name={t('scenario.downside')} stroke="#C4754B" strokeWidth={1.5} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Financing Path Comparison */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-6 mb-8">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-6">
          {t('dash.financingComparison')}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('common.metric')}</th>
                <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('path.commercialShort')}</th>
                <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">+ {t('path.rrfShort')}</th>
                <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-positive font-medium">+ {t('path.grantShort')}</th>
              </tr>
            </thead>
            <tbody>
              {model.financingComparison.map((row, i) => (
                <tr key={i} className="border-b border-surface-secondary/50">
                  <td className="py-2.5 pr-4 text-text-secondary">{row.metric}</td>
                  <td className="text-right py-2.5 px-4 data-cell">
                    {typeof row.commercial === "number"
                      ? row.metric.includes("DSCR") ? formatMultiple(row.commercial) : formatCurrency(row.commercial, true, locale)
                      : row.commercial}
                  </td>
                  <td className="text-right py-2.5 px-4 data-cell">
                    {typeof row.rrf === "number"
                      ? row.metric.includes("DSCR") ? formatMultiple(row.rrf) : formatCurrency(row.rrf, true, locale)
                      : row.rrf}
                  </td>
                  <td className="text-right py-2.5 px-4 data-cell text-positive font-medium">
                    {typeof row.grant === "number"
                      ? row.metric.includes("DSCR") ? formatMultiple(row.grant) : formatCurrency(row.grant, true, locale)
                      : row.grant}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collateral */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-6 mb-8">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-6">
          {t('inv.collateralAsset')}
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

      {/* Footer */}
      <div className="text-center py-8 border-t border-surface-tertiary">
        <p className="text-xs text-text-tertiary">
          {t('app.title')} &middot; Agios Georgios, Antiparos, Greece &middot; {t('app.confidential')}
        </p>
      </div>
    </div>
  );
}
