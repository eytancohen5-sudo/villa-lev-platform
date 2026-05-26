"use client";

import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { PageTour, TourButton, usePageTour } from "@/components/PageTour";
import { PageSkeleton } from "@/components/Skeleton";
import { CAPEX_TOUR } from "@/lib/tours/configs";

export default function CapexPage() {
  const { t, locale } = useTranslation();
  const model = useModelStore(s => s.model);
  const templates = useModelStore(s => s.templates);
  const projects = useModelStore(s => s.projects);
  const assumptions = useModelStore(s => s.assumptions);
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(CAPEX_TOUR.storageKey);
  if (!model) return <PageSkeleton variant="table" />;

  const { capex } = model;
  const poolRate = assumptions.poolConstructionCostPerM2 ?? 1_000;

  // Expand each property into individual instance columns. Twin Villas with
  // count=2 → ["Twin Villas N°1", "Twin Villas N°2"]; Boutique Suites count=1
  // → ["Boutique Suites"]. Each instance carries the property's perUnit cost.
  const instances = capex.properties.flatMap((prop) =>
    Array.from({ length: prop.count }, (_, i) => ({
      key: `${prop.id}-${i}`,
      propId: prop.id,
      label: prop.count > 1 ? `${prop.name} N°${i + 1}` : prop.name,
      perUnit: prop.perUnit,
    }))
  );

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-text-primary mb-1 border-l-[3px] border-brand-400 pl-3">{t('capex.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('capex.pageIntro')}</p>
          <p className="text-sm text-text-secondary">{t('capex.subtitle')}</p>
        </div>
        <TourButton onClick={() => setTourOpen(true)} pulsing={!!neverSeen} />
      </div>

      {/* Pool configuration summary */}
      <div className="mb-6 bg-white rounded-xl border border-surface-tertiary p-5">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-text-secondary mb-3">
          {t('capex.poolConfig')}
        </h2>
        <p className="text-xs text-text-tertiary mb-4">{t('capex.poolConfigIntro')}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-text-tertiary border-b border-surface-secondary/60">
                <th className="text-left pb-2 pr-4">Property</th>
                <th className="text-left pb-2 pr-4">Slot</th>
                <th className="text-right pb-2 pr-4">Qty</th>
                <th className="text-right pb-2 pr-4">W (m)</th>
                <th className="text-right pb-2 pr-4">L (m)</th>
                <th className="text-right pb-2 pr-4">Area (m²)</th>
                <th className="text-right pb-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {templates.filter(tpl => projects.some(p => p.templateId === tpl.id)).map((tpl) => {
                if (tpl.wellnessFlatCost != null) {
                  return (
                    <tr key={tpl.id} className="border-b border-surface-secondary/30">
                      <td className="py-1.5 pr-4 text-text-secondary text-xs">{tpl.name}</td>
                      <td className="py-1.5 pr-4 text-text-tertiary text-xs italic">Wellness (flat)</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-xs">—</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-xs">—</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-xs">—</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-xs">—</td>
                      <td className="py-1.5 text-right font-mono text-xs">{formatCurrency(tpl.wellnessFlatCost, false, locale)}</td>
                    </tr>
                  );
                }
                if (!tpl.poolSlots || tpl.poolSlots.length === 0) return null;
                return tpl.poolSlots.map((slot, idx) => {
                  const area = slot.qty * slot.widthM * slot.lengthM;
                  const cost = area * poolRate;
                  return (
                    <tr key={`${tpl.id}-${slot.id}`} className="border-b border-surface-secondary/30">
                      <td className="py-1.5 pr-4 text-text-secondary text-xs">{idx === 0 ? tpl.name : ''}</td>
                      <td className="py-1.5 pr-4 text-text-tertiary text-xs">Pool {idx + 1}</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-xs">{slot.qty}</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-xs">{slot.widthM}</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-xs">{slot.lengthM}</td>
                      <td className="py-1.5 pr-4 text-right font-mono text-xs">{area}</td>
                      <td className="py-1.5 text-right font-mono text-xs">{formatCurrency(cost, false, locale)}</td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-text-tertiary">
          Rate: {formatCurrency(poolRate, false, locale)}/m²
        </div>
      </div>

      <div id="capex-table" className="bg-white rounded-xl border border-surface-tertiary overflow-hidden scroll-mt-24">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-secondary/40">
                <th className="text-left py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('capex.costCategory')}</th>
                {instances.map((inst) => (
                  <th key={inst.key} className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    {inst.label}
                  </th>
                ))}
                <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('capex.total')}</th>
              </tr>
            </thead>
            <tbody>
              {capex.categories.map((cat, i) => (
                <tr key={cat.name} className={`border-t border-surface-secondary/60 ${i % 2 === 0 ? '' : 'bg-surface-secondary/15'}`}>
                  <td className="py-3 px-5 text-text-secondary">{cat.name}</td>
                  {instances.map((inst) => {
                    const pp = cat.perProperty.find((p) => p.id === inst.propId);
                    return (
                      <td key={inst.key} className="text-right py-3 px-4 data-cell font-mono text-sm">
                        {pp && pp.perUnit > 0 ? formatCurrency(pp.perUnit, false, locale) : "—"}
                      </td>
                    );
                  })}
                  <td className="text-right py-3 px-4 data-cell font-mono text-sm font-medium">{formatCurrency(cat.grandTotal, false, locale)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-surface-tertiary bg-surface-secondary/40 font-semibold">
                <td className="py-4 px-5">{t('capex.totalCapex')}</td>
                {instances.map((inst) => (
                  <td key={inst.key} className="text-right py-4 px-4 data-cell font-mono">
                    {formatCurrency(inst.perUnit, false, locale)}
                  </td>
                ))}
                <td className="text-right py-4 px-4 data-cell font-mono text-brand-600">{formatCurrency(capex.portfolioTotal, false, locale)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-surface-tertiary p-6 text-center">
          <div className="text-xs uppercase tracking-wider text-text-tertiary mb-2">{t('capex.totalProjectCost')}</div>
          <div className="kpi-value text-brand-600">{formatCurrency(capex.portfolioTotal, true, locale)}</div>
          <div className="text-xs text-text-tertiary mt-1">
            {capex.properties.map((p) => `${p.count} ${p.name}`).join(' + ')}
          </div>
        </div>
        {capex.properties.map((prop) => (
          <div key={prop.id} className="bg-white rounded-xl border border-surface-tertiary p-6 text-center">
            <div className="text-xs uppercase tracking-wider text-text-tertiary mb-2">{prop.name} (each)</div>
            <div className="kpi-value text-text-primary">{formatCurrency(prop.perUnit, true, locale)}</div>
            {prop.count > 1 && (
              <div className="text-xs text-text-tertiary mt-1">&times;{prop.count} = {formatCurrency(prop.total, true, locale)}</div>
            )}
          </div>
        ))}
      </div>

      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={CAPEX_TOUR} />
    </div>
  );
}
