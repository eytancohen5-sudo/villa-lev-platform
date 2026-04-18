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

      <div className="bg-white rounded-xl border border-surface-tertiary p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-tertiary">
              <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('capex.costCategory')}</th>
              <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('capex.propAPer')}</th>
              <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('capex.propAx2')}</th>
              <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('capex.propB')}</th>
              <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('capex.total')}</th>
            </tr>
          </thead>
          <tbody>
            {capex.categories.map((cat) => (
              <tr key={cat.name} className="border-b border-surface-secondary/50">
                <td className="py-2 pr-4 text-text-secondary">{cat.name}</td>
                <td className="text-right py-2 px-3 data-cell">{formatCurrency(cat.propAPerUnit, false, locale)}</td>
                <td className="text-right py-2 px-3 data-cell">{formatCurrency(cat.propATotal, false, locale)}</td>
                <td className="text-right py-2 px-3 data-cell">{cat.propB > 0 ? formatCurrency(cat.propB, false, locale) : "—"}</td>
                <td className="text-right py-2 px-3 data-cell font-medium">{formatCurrency(cat.total, false, locale)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-surface-tertiary bg-surface-secondary/30 font-medium">
              <td className="py-3 pr-4">{t('capex.totalCapex')}</td>
              <td className="text-right py-3 px-3 data-cell">{formatCurrency(capex.propertyAPerUnit, false, locale)}</td>
              <td className="text-right py-3 px-3 data-cell">{formatCurrency(capex.propertyATotal, false, locale)}</td>
              <td className="text-right py-3 px-3 data-cell">{formatCurrency(capex.propertyBTotal, false, locale)}</td>
              <td className="text-right py-3 px-3 data-cell text-brand-600">{formatCurrency(capex.portfolioTotal, false, locale)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Financing summary */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-surface-tertiary p-5 text-center">
          <div className="text-xs uppercase tracking-wider text-text-tertiary mb-2">{t('capex.totalProjectCost')}</div>
          <div className="kpi-value text-brand-600">{formatCurrency(capex.portfolioTotal, true, locale)}</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-tertiary p-5 text-center">
          <div className="text-xs uppercase tracking-wider text-text-tertiary mb-2">{t('capex.propAEach')}</div>
          <div className="kpi-value text-text-primary">{formatCurrency(capex.propertyAPerUnit, true, locale)}</div>
        </div>
        <div className="bg-white rounded-xl border border-surface-tertiary p-5 text-center">
          <div className="text-xs uppercase tracking-wider text-text-tertiary mb-2">{t('capex.propB')}</div>
          <div className="kpi-value text-text-primary">{formatCurrency(capex.propertyBTotal, true, locale)}</div>
        </div>
      </div>
    </div>
  );
}
