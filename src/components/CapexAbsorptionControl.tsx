"use client";

import { useState } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { formatCurrency } from "@/lib/hooks/useModel";
import {
  computeAbsorptionAmounts,
  SERVICE_PROVIDER_CATEGORIES,
  CONTINGENCY_CATEGORY,
} from "@/lib/engine/capexAbsorption";
import type { CapexBreakdown } from "@/lib/engine/types";

type PerPathLoans = { commercial: number; rrf: number; grant: number; tepixLoan: number; optima: number };

function pathKeyOf(activePath: string): keyof PerPathLoans {
  if (activePath === 'tepix-loan') return 'tepixLoan';
  return activePath as keyof PerPathLoans;
}

interface CapexAbsorptionControlProps {
  /** Raw (pre-absorption) CapEx breakdown */
  rawCapex: CapexBreakdown;
  /** Active financing path key */
  activePath: string;
  /** Post-absorption per-path loans from model.financingComparison */
  currentPerPathLoans: PerPathLoans | null;
  /** Pre-absorption per-path loans (baseline) */
  baselinePerPathLoans: PerPathLoans | null;
}

/** Small ON/OFF pill toggle */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={[
        "inline-flex items-center justify-center rounded-full px-3 py-0.5 text-xs font-semibold transition-colors select-none",
        on
          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
          : "bg-surface-secondary text-text-tertiary border border-surface-tertiary",
      ].join(" ")}
    >
      {on ? "ON" : "OFF"}
    </button>
  );
}

export function CapexAbsorptionControl({
  rawCapex,
  activePath,
  currentPerPathLoans,
  baselinePerPathLoans,
}: CapexAbsorptionControlProps) {
  const { t, locale } = useTranslation();
  const {
    capexAbsorptionServiceProviders,
    capexAbsorptionContingency,
    setCapexAbsorptionServiceProviders,
    setCapexAbsorptionContingency,
  } = useModelStore();

  const [pathsExpanded, setPathsExpanded] = useState(true);

  // Compute the EUR amounts each toggle would add (from raw/pre-absorption capex)
  const amounts = computeAbsorptionAmounts(rawCapex, {
    serviceProviders: true,
    contingency: true,
  });
  const activeAmounts = computeAbsorptionAmounts(rawCapex, {
    serviceProviders: capexAbsorptionServiceProviders,
    contingency: capexAbsorptionContingency,
  });

  const isAnyOn = capexAbsorptionServiceProviders || capexAbsorptionContingency;

  // Construction cost before/after
  const constructionCatBefore = rawCapex.categories.find(c => c.name === 'Building & excavation');
  const constructionBefore = constructionCatBefore?.grandTotal ?? 0;
  const constructionAfter = constructionBefore + activeAmounts.total;

  // Service provider category names for the detail list
  const serviceProviderDetail = rawCapex.categories
    .filter(c => (SERVICE_PROVIDER_CATEGORIES as string[]).includes(c.name) && c.grandTotal > 0)
    .map(c => ({ name: c.name, amount: c.grandTotal }));

  const contingencyDetail = rawCapex.categories.find(c => c.name === CONTINGENCY_CATEGORY && c.grandTotal > 0);

  const PATH_LABELS: { key: keyof PerPathLoans; label: string }[] = [
    { key: 'commercial', label: t('path.commercialShort') },
    { key: 'rrf', label: t('path.rrfShort') },
    { key: 'grant', label: t('path.grantShort') },
    { key: 'tepixLoan', label: t('path.tepixLoanShort') },
    { key: 'optima', label: t('bank.bar.optima') },
  ];

  return (
    <div className="rounded-xl border border-surface-tertiary bg-white shadow-sm overflow-hidden print:hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-surface-tertiary/60">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary mb-0.5">
          {t('capexAbs.title')}
        </p>
        <p className="text-xs text-text-secondary leading-relaxed">
          {t('capexAbs.subtitle')}
        </p>
      </div>

      {/* Toggle rows */}
      <div className="divide-y divide-surface-tertiary/60">
        {/* Row 1 — Service providers */}
        <div className="flex items-center gap-4 px-5 py-3.5">
          <span className="text-sm text-text-primary font-medium w-52 shrink-0">
            {t('capexAbs.serviceProviders')}
          </span>
          <Toggle
            on={capexAbsorptionServiceProviders}
            onChange={setCapexAbsorptionServiceProviders}
          />
          <span className="text-xs text-text-tertiary leading-relaxed flex-1">
            {serviceProviderDetail.length > 0
              ? serviceProviderDetail.map(d => `${d.name} (${formatCurrency(d.amount, true, locale)})`).join(', ')
              : t('capexAbs.serviceProvidersDesc')}
            {amounts.serviceProviders > 0 && (
              <span className={`ml-2 font-mono font-semibold ${capexAbsorptionServiceProviders ? 'text-amber-600' : 'text-text-tertiary'}`}>
                {formatCurrency(amounts.serviceProviders, true, locale)}
              </span>
            )}
          </span>
        </div>

        {/* Row 2 — Contingency */}
        <div className="flex items-center gap-4 px-5 py-3.5">
          <span className="text-sm text-text-primary font-medium w-52 shrink-0">
            {t('capexAbs.contingency')}
          </span>
          <Toggle
            on={capexAbsorptionContingency}
            onChange={setCapexAbsorptionContingency}
          />
          <span className="text-xs text-text-tertiary leading-relaxed flex-1">
            {contingencyDetail
              ? `${t('capexAbs.contingencyDesc')} (${formatCurrency(contingencyDetail.grandTotal, true, locale)})`
              : t('capexAbs.contingencyDesc')}
            {amounts.contingency > 0 && (
              <span className={`ml-2 font-mono font-semibold ${capexAbsorptionContingency ? 'text-amber-600' : 'text-text-tertiary'}`}>
                {formatCurrency(amounts.contingency, true, locale)}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Results — shown when any toggle is ON */}
      {isAnyOn && (
        <div className="border-t border-surface-tertiary">
          {/* Construction cost impact summary */}
          {(() => {
            const totalBudget = rawCapex.portfolioTotal;
            const pctBefore = totalBudget > 0 ? (constructionBefore / totalBudget) * 100 : 0;
            const pctAfter  = totalBudget > 0 ? (constructionAfter  / totalBudget) * 100 : 0;
            const pctDelta  = pctAfter - pctBefore;
            return (
              <div className="px-5 py-3 bg-surface-secondary/30 grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-0.5">
                    {t('capexAbs.constructionBefore')}
                  </p>
                  <p className="font-mono font-semibold text-text-secondary">{formatCurrency(constructionBefore, true, locale)}</p>
                  <p className="text-[10px] font-mono text-text-tertiary mt-0.5">{pctBefore.toFixed(1)}% {t('capexAbs.ofTotalBudget')}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-0.5">
                    {t('capexAbs.constructionAfter')}
                  </p>
                  <p className="font-mono font-bold text-text-primary">{formatCurrency(constructionAfter, true, locale)}</p>
                  <p className="text-[10px] font-mono text-amber-600 mt-0.5">{pctAfter.toFixed(1)}% {t('capexAbs.ofTotalBudget')}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-0.5">
                    {t('capexAbs.constructionDelta')}
                  </p>
                  <p className="font-mono font-bold text-amber-600">+{formatCurrency(activeAmounts.total, true, locale)}</p>
                  <p className="text-[10px] font-mono text-amber-600 mt-0.5">+{pctDelta.toFixed(1)} pp</p>
                </div>
              </div>
            );
          })()}

          {/* Per-path absorption panel */}
          {baselinePerPathLoans && currentPerPathLoans && (
            <>
              <button
                type="button"
                onClick={() => setPathsExpanded(v => !v)}
                className="w-full flex items-center justify-between px-5 py-2.5 text-left hover:bg-surface-secondary/40 transition-colors border-t border-surface-tertiary/60"
              >
                <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.08em]">
                  {t('capexAbs.pathImpactTitle')}
                </span>
                <svg
                  width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
                  className={`transition-transform shrink-0 text-text-tertiary ${pathsExpanded ? 'rotate-180' : ''}`}
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {pathsExpanded && (
                <div className="px-5 pb-4 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-text-tertiary border-b border-surface-secondary">
                        <th className="text-left font-medium pb-2 pr-3">{t('common.metric')}</th>
                        <th className="text-right font-medium pb-2 px-2">{t('capexAbs.pathBaseline')}</th>
                        <th className="text-right font-medium pb-2 px-2">{t('capexAbs.pathNew')}</th>
                        <th className="text-right font-medium pb-2 px-2">{t('capexAbs.pathDeltaLoan')}</th>
                        <th className="text-right font-medium pb-2 px-2">{t('capexAbs.pathDeltaPct')}</th>
                        <th className="text-right font-medium pb-2 pl-2">{t('capexAbs.pathEquityChange')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PATH_LABELS.map(({ key, label }) => {
                        const baseline = baselinePerPathLoans[key];
                        const current = currentPerPathLoans[key];
                        const delta = current - baseline;
                        const pct = baseline > 0 ? delta / baseline : 0;
                        const equityChg = activeAmounts.total - delta;
                        const isActivePath = pathKeyOf(activePath) === key;
                        return (
                          <tr key={key} className={`border-b border-surface-secondary/50 ${isActivePath ? 'bg-brand-50' : ''}`}>
                            <td className={`py-2 pr-3 font-medium ${isActivePath ? 'text-brand-700' : 'text-text-secondary'}`}>
                              {label}
                              {isActivePath && (
                                <span className="ml-1.5 text-[9px] bg-brand-500 text-white rounded px-1 py-0.5 uppercase tracking-wide">
                                  {t('config.active')}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-text-tertiary">
                              {baseline > 0 ? formatCurrency(baseline, true, locale) : '—'}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-text-primary">
                              {current > 0 ? formatCurrency(current, true, locale) : '—'}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-amber-600">
                              {delta > 1 ? `+${formatCurrency(delta, true, locale)}` : delta < -1 ? formatCurrency(delta, true, locale) : '—'}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-amber-600">
                              {Math.abs(pct) > 0.0001 ? `${pct >= 0 ? '+' : ''}${(pct * 100).toFixed(1)}%` : '—'}
                            </td>
                            <td className="py-2 pl-2 text-right font-mono text-text-secondary">
                              {equityChg > 1 ? formatCurrency(equityChg, true, locale) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
