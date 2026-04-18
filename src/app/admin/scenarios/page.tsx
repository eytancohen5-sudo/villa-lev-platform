"use client";

import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";

export default function ScenariosPage() {
  const { t, locale } = useTranslation();
  const { model } = useModelStore();
  if (!model) return null;

  const { realistic, upside, downside } = model.scenarios;
  const grant = model.grantScenario;

  const stabR = realistic.stabilisedYear;
  const stabU = upside.stabilisedYear;
  const stabD = downside.stabilisedYear;
  const stabG = grant.stabilisedYear;

  if (!stabR || !stabU || !stabD || !stabG) return null;

  const metrics = [
    { label: t('pnl.villaNights'), r: stabR.villaNightsPerProject, u: stabU.villaNightsPerProject, d: stabD.villaNightsPerProject, g: stabG.villaNightsPerProject, fmt: "n" },
    { label: t('pnl.suiteNights'), r: stabR.suiteNightsPerSuite, u: stabU.suiteNightsPerSuite, d: stabD.suiteNightsPerSuite, g: stabG.suiteNightsPerSuite, fmt: "n" },
    { label: t('pnl.totalRevenue'), r: stabR.totalRevenue, u: stabU.totalRevenue, d: stabD.totalRevenue, g: stabG.totalRevenue, fmt: "c" },
    { label: t('pnl.totalOpex'), r: stabR.totalOpex, u: stabU.totalOpex, d: stabD.totalOpex, g: stabG.totalOpex, fmt: "c" },
    { label: t('term.ebitda'), r: stabR.ebitda, u: stabU.ebitda, d: stabD.ebitda, g: stabG.ebitda, fmt: "c", bold: true },
    { label: t('term.ebitdaMargin'), r: stabR.ebitdaMargin, u: stabU.ebitdaMargin, d: stabD.ebitdaMargin, g: stabG.ebitdaMargin, fmt: "p" },
    { label: t('kpi.annualDS'), r: stabR.debtService, u: stabU.debtService, d: stabD.debtService, g: stabG.debtService, fmt: "c" },
    { label: t('term.dscr'), r: stabR.dscr, u: stabU.dscr, d: stabD.dscr, g: stabG.dscr, fmt: "x", bold: true },
    { label: t('pnl.ncfPostVAT'), r: stabR.netCashFlowPostVAT, u: stabU.netCashFlowPostVAT, d: stabD.netCashFlowPostVAT, g: stabG.netCashFlowPostVAT, fmt: "c", bold: true },
  ];

  const format = (v: number, fmt: string) => {
    if (fmt === "c") return formatCurrency(v, true, locale);
    if (fmt === "p") return formatPercent(v);
    if (fmt === "x") return formatMultiple(v);
    return v.toLocaleString();
  };

  return (
    <div>
      <h1 className="font-display text-2xl text-text-primary mb-1">{t('sc.title')}</h1>
      <p className="text-sm text-text-secondary mb-6">{t('sc.subtitle')}</p>

      <div className="bg-white rounded-xl border border-surface-tertiary p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-tertiary">
              <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium min-w-[180px]">{t('common.metric')}</th>
              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-brand-600 font-medium">{t('scenario.realistic')}</th>
              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-positive font-medium">{t('scenario.upside')}</th>
              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-earth-terracotta font-medium">{t('scenario.downside')}</th>
              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-info font-medium">{t('scenario.grantPath')}</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.label} className={`border-b border-surface-secondary/50 ${m.bold ? "bg-surface-secondary/30 font-medium" : ""}`}>
                <td className={`py-2 pr-4 ${m.bold ? "font-medium" : "text-text-secondary"}`}>{m.label}</td>
                <td className="text-right py-2 px-4 data-cell">{format(m.r, m.fmt)}</td>
                <td className="text-right py-2 px-4 data-cell text-positive">{format(m.u, m.fmt)}</td>
                <td className="text-right py-2 px-4 data-cell text-earth-terracotta">{format(m.d, m.fmt)}</td>
                <td className="text-right py-2 px-4 data-cell text-info">{format(m.g, m.fmt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DSCR Year-by-Year */}
      <h2 className="font-display text-lg text-text-primary mt-8 mb-4">{t('sc.dscrByYear')}</h2>
      <div className="bg-white rounded-xl border border-surface-tertiary p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-tertiary">
              <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('common.year')}</th>
              <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-brand-600 font-medium">{t('scenario.realistic')}</th>
              <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-positive font-medium">{t('scenario.upside')}</th>
              <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-earth-terracotta font-medium">{t('scenario.downside')}</th>
              <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-info font-medium">{t('scenario.grantPath')}</th>
            </tr>
          </thead>
          <tbody>
            {model.dscrByYear.filter(d => d.year >= 2028).map((d) => (
              <tr key={d.year} className="border-b border-surface-secondary/50">
                <td className="py-2 pr-4 font-medium">{d.year}</td>
                <td className={`text-right py-2 px-3 data-cell ${d.realistic >= 1.25 ? "text-positive" : d.realistic > 0 ? "text-warning" : ""}`}>
                  {d.realistic > 0 ? formatMultiple(d.realistic) : "—"}
                </td>
                <td className={`text-right py-2 px-3 data-cell ${d.upside >= 1.25 ? "text-positive" : d.upside > 0 ? "text-warning" : ""}`}>
                  {d.upside > 0 ? formatMultiple(d.upside) : "—"}
                </td>
                <td className={`text-right py-2 px-3 data-cell ${d.downside >= 1.25 ? "text-positive" : d.downside > 0 ? "text-warning" : ""}`}>
                  {d.downside > 0 ? formatMultiple(d.downside) : "—"}
                </td>
                <td className={`text-right py-2 px-3 data-cell ${d.grant >= 1.25 ? "text-positive" : d.grant > 0 ? "text-warning" : ""}`}>
                  {d.grant > 0 ? formatMultiple(d.grant) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Collateral */}
      <h2 className="font-display text-lg text-text-primary mt-8 mb-4">{t('sc.collateral')}</h2>
      <div className="bg-white rounded-xl border border-surface-tertiary p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-tertiary">
              <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('common.metric')}</th>
              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('sc.stress')}</th>
              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('sc.market')}</th>
              <th className="text-right py-2 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('sc.optimistic')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-surface-secondary/50">
              <td className="py-2 pr-4 text-text-secondary">{t('sc.portfolioValue')}</td>
              <td className="text-right py-2 px-4 data-cell">{formatCurrency(model.collateral.stress.value, true, locale)}</td>
              <td className="text-right py-2 px-4 data-cell">{formatCurrency(model.collateral.market.value, true, locale)}</td>
              <td className="text-right py-2 px-4 data-cell">{formatCurrency(model.collateral.optimistic.value, true, locale)}</td>
            </tr>
            <tr className="border-b border-surface-secondary/50">
              <td className="py-2 pr-4 text-text-secondary">LTV (%)</td>
              <td className="text-right py-2 px-4 data-cell">{formatPercent(model.collateral.stress.ltv)}</td>
              <td className="text-right py-2 px-4 data-cell">{formatPercent(model.collateral.market.ltv)}</td>
              <td className="text-right py-2 px-4 data-cell">{formatPercent(model.collateral.optimistic.ltv)}</td>
            </tr>
            <tr className="border-b border-surface-secondary/50 font-medium">
              <td className="py-2 pr-4">{t('kpi.assetCoverage')}</td>
              <td className="text-right py-2 px-4 data-cell">{formatMultiple(model.collateral.stress.coverage)}</td>
              <td className="text-right py-2 px-4 data-cell">{formatMultiple(model.collateral.market.coverage)}</td>
              <td className="text-right py-2 px-4 data-cell text-positive">{formatMultiple(model.collateral.optimistic.coverage)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-text-tertiary mt-3">{t('sc.builtSurface')}: {model.collateral.builtSurface}m² &middot; {t('sc.loanOutstanding')}: {formatCurrency(model.keyMetrics.loanAmount, false, locale)}</p>
      </div>
    </div>
  );
}
