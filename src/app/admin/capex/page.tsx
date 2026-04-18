"use client";

import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";

export default function CapexPage() {
  const { t, locale } = useTranslation();
  const { model } = useModelStore();
  if (!model) return null;

  const { capex } = model;
  const nA = capex.numberOfPropertyA;
  const nB = capex.numberOfPropertyB;

  return (
    <div>
      <h1 className="font-display text-2xl text-text-primary mb-1">{t('capex.title')}</h1>
      <p className="text-sm text-text-secondary mb-6">{t('capex.subtitle')}</p>

      <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-secondary/40">
                <th className="text-left py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('capex.costCategory')}</th>
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('capex.propAPer')}</th>
                {nA > 1 && (
                  <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    Prop A &times;{nA}
                  </th>
                )}
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{nB > 1 ? `Prop B /unit` : t('capex.propB')}</th>
                {nB > 1 && (
                  <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    Prop B &times;{nB}
                  </th>
                )}
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('capex.total')}</th>
              </tr>
            </thead>
            <tbody>
              {capex.categories.map((cat, i) => (
                <tr key={cat.name} className={`border-t border-surface-secondary/60 ${i % 2 === 0 ? '' : 'bg-surface-secondary/15'}`}>
                  <td className="py-3 px-5 text-text-secondary">{cat.name}</td>
                  <td className="text-right py-3 px-4 data-cell font-mono text-sm">{formatCurrency(cat.propAPerUnit, false, locale)}</td>
                  {nA > 1 && (
                    <td className="text-right py-3 px-4 data-cell font-mono text-sm">{formatCurrency(cat.propATotal, false, locale)}</td>
                  )}
                  <td className="text-right py-3 px-4 data-cell font-mono text-sm">
                    {cat.propBPerUnit > 0 ? formatCurrency(cat.propBPerUnit, false, locale) : "—"}
                  </td>
                  {nB > 1 && (
                    <td className="text-right py-3 px-4 data-cell font-mono text-sm">
                      {cat.propBTotal > 0 ? formatCurrency(cat.propBTotal, false, locale) : "—"}
                    </td>
                  )}
                  <td className="text-right py-3 px-4 data-cell font-mono text-sm font-medium">{formatCurrency(cat.total, false, locale)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-surface-tertiary bg-surface-secondary/40 font-semibold">
                <td className="py-4 px-5">{t('capex.totalCapex')}</td>
                <td className="text-right py-4 px-4 data-cell font-mono">{formatCurrency(capex.propertyAPerUnit, false, locale)}</td>
                {nA > 1 && (
                  <td className="text-right py-4 px-4 data-cell font-mono">{formatCurrency(capex.propertyATotal, false, locale)}</td>
                )}
                <td className="text-right py-4 px-4 data-cell font-mono">{formatCurrency(capex.propertyBPerUnit, false, locale)}</td>
                {nB > 1 && (
                  <td className="text-right py-4 px-4 data-cell font-mono">{formatCurrency(capex.propertyBTotal, false, locale)}</td>
                )}
                <td className="text-right py-4 px-4 data-cell font-mono text-brand-600">{formatCurrency(capex.portfolioTotal, false, locale)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm p-6 text-center">
          <div className="text-xs uppercase tracking-wider text-text-tertiary mb-2">{t('capex.totalProjectCost')}</div>
          <div className="kpi-value text-brand-600">{formatCurrency(capex.portfolioTotal, true, locale)}</div>
          <div className="text-xs text-text-tertiary mt-1">{nA} villa{nA > 1 ? 's' : ''} + {nB} suite{nB > 1 ? 's' : ''} property</div>
        </div>
        <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm p-6 text-center">
          <div className="text-xs uppercase tracking-wider text-text-tertiary mb-2">{t('capex.propAEach')}</div>
          <div className="kpi-value text-text-primary">{formatCurrency(capex.propertyAPerUnit, true, locale)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm p-6 text-center">
          <div className="text-xs uppercase tracking-wider text-text-tertiary mb-2">Property B (each)</div>
          <div className="kpi-value text-text-primary">{formatCurrency(capex.propertyBPerUnit, true, locale)}</div>
        </div>
      </div>
    </div>
  );
}
