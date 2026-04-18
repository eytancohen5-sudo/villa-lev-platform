"use client";

import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";

export default function CapexPage() {
  const { t, locale } = useTranslation();
  const { model } = useModelStore();
  if (!model) return null;

  const { capex } = model;

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
                {capex.properties.map((prop) => (
                  <th key={`${prop.id}-per`} className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    {prop.name} /unit
                  </th>
                ))}
                {capex.properties.filter((p) => p.count > 1).length > 0 && capex.properties.map((prop) =>
                  prop.count > 1 ? (
                    <th key={`${prop.id}-total`} className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                      {prop.name} &times;{prop.count}
                    </th>
                  ) : null
                )}
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('capex.total')}</th>
              </tr>
            </thead>
            <tbody>
              {capex.categories.map((cat, i) => (
                <tr key={cat.name} className={`border-t border-surface-secondary/60 ${i % 2 === 0 ? '' : 'bg-surface-secondary/15'}`}>
                  <td className="py-3 px-5 text-text-secondary">{cat.name}</td>
                  {capex.properties.map((prop) => {
                    const pp = cat.perProperty.find((p) => p.id === prop.id);
                    return (
                      <td key={`${prop.id}-per`} className="text-right py-3 px-4 data-cell font-mono text-sm">
                        {pp && pp.perUnit > 0 ? formatCurrency(pp.perUnit, false, locale) : "—"}
                      </td>
                    );
                  })}
                  {capex.properties.filter((p) => p.count > 1).length > 0 && capex.properties.map((prop) =>
                    prop.count > 1 ? (
                      <td key={`${prop.id}-total`} className="text-right py-3 px-4 data-cell font-mono text-sm">
                        {(() => {
                          const pp = cat.perProperty.find((p) => p.id === prop.id);
                          return pp && pp.total > 0 ? formatCurrency(pp.total, false, locale) : "—";
                        })()}
                      </td>
                    ) : null
                  )}
                  <td className="text-right py-3 px-4 data-cell font-mono text-sm font-medium">{formatCurrency(cat.grandTotal, false, locale)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-surface-tertiary bg-surface-secondary/40 font-semibold">
                <td className="py-4 px-5">{t('capex.totalCapex')}</td>
                {capex.properties.map((prop) => (
                  <td key={`${prop.id}-per`} className="text-right py-4 px-4 data-cell font-mono">
                    {formatCurrency(prop.perUnit, false, locale)}
                  </td>
                ))}
                {capex.properties.filter((p) => p.count > 1).length > 0 && capex.properties.map((prop) =>
                  prop.count > 1 ? (
                    <td key={`${prop.id}-total`} className="text-right py-4 px-4 data-cell font-mono">
                      {formatCurrency(prop.total, false, locale)}
                    </td>
                  ) : null
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
          <div className="text-xs text-text-tertiary mt-1">
            {capex.properties.map((p) => `${p.count} ${p.name}`).join(' + ')}
          </div>
        </div>
        {capex.properties.map((prop) => (
          <div key={prop.id} className="bg-white rounded-2xl border border-surface-tertiary shadow-sm p-6 text-center">
            <div className="text-xs uppercase tracking-wider text-text-tertiary mb-2">{prop.name} (each)</div>
            <div className="kpi-value text-text-primary">{formatCurrency(prop.perUnit, true, locale)}</div>
            {prop.count > 1 && (
              <div className="text-xs text-text-tertiary mt-1">&times;{prop.count} = {formatCurrency(prop.total, true, locale)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
