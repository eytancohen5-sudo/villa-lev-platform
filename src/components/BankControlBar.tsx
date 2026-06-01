'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useModelStore, ScenarioName } from '@/lib/store/modelStore';
import { useTranslation } from '@/lib/i18n/I18nProvider';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useAuth } from '@/lib/data/useAuth';

const PATHS = [
  { key: 'commercial', labelKey: 'bank.bar.commercial' },
  { key: 'rrf',        labelKey: 'bank.bar.rrf' },
  { key: 'grant',      labelKey: 'bank.bar.grant' },
  { key: 'tepix-loan', labelKey: 'bank.bar.tepix' },
  { key: 'optima',     labelKey: 'bank.bar.optima' },
] as const;

const SCENARIOS = [
  { key: 'realistic', labelKey: 'bank.bar.realistic' },
  { key: 'upside',    labelKey: 'bank.bar.upside' },
  { key: 'downside',  labelKey: 'bank.bar.downside' },
  { key: 'breakeven', labelKey: 'bank.bar.breakeven' },
] as const;

function OptimaRatePopover() {
  const { t } = useTranslation();
  const { assumptions, setOptimaSpreadBps } = useModelStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const loan = assumptions.optimaLoan;
  if (!loan) return null;

  const euriborPct = loan.euriborRate * 100;
  const spreadPct = loan.spreadBps / 100;
  const effectivePct = euriborPct + spreadPct;

  const nudgeSpread = (deltaBps: number) => {
    const next = Math.max(0, Math.min(1000, loan.spreadBps + deltaBps));
    if (next !== loan.spreadBps) setOptimaSpreadBps(next);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider transition-colors ${
          open
            ? 'bg-brand-50 text-brand-700 border border-brand-200'
            : 'bg-surface-secondary text-text-secondary border border-surface-tertiary hover:bg-surface-tertiary'
        }`}
        aria-expanded={open}
        title={t('bank.bar.optimaRate')}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0">
          <line x1="1" y1="2.5" x2="11" y2="2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="1" y1="6"   x2="11" y2="6"   stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="1" y1="9.5" x2="11" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="4"  cy="2.5" r="1.5" fill="currentColor" />
          <circle cx="8"  cy="6"   r="1.5" fill="currentColor" />
          <circle cx="5"  cy="9.5" r="1.5" fill="currentColor" />
        </svg>
        {effectivePct.toFixed(2)}%
      </button>
      {open && (
        <div className="absolute top-full mt-2 right-0 z-30 bg-white border border-surface-tertiary rounded-xl shadow-lg p-4 min-w-[220px]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">
            {t('bank.bar.optimaRate')}
          </div>
          <div className="space-y-3">
            {/* Euribor (read-only) */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-text-secondary">{t('bank.bar.optimaEuribor')}</span>
              <span className="text-xs font-mono text-text-primary">{euriborPct.toFixed(2)}%</span>
            </div>
            {/* Spread */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-text-secondary">{t('bank.bar.optimaSpread')}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => nudgeSpread(-25)}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-surface-secondary border border-surface-tertiary hover:bg-surface-tertiary text-xs font-mono text-text-secondary"
                  aria-label="Decrease spread by 25bps"
                >
                  −
                </button>
                <span className="w-16 text-center text-xs font-mono text-text-primary">{loan.spreadBps} bps</span>
                <button
                  type="button"
                  onClick={() => nudgeSpread(25)}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-surface-secondary border border-surface-tertiary hover:bg-surface-tertiary text-xs font-mono text-text-secondary"
                  aria-label="Increase spread by 25bps"
                >
                  +
                </button>
              </div>
            </div>
            {/* Effective */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-surface-secondary">
              <span className="text-xs font-semibold text-text-primary">{t('bank.bar.optimaEffective')}</span>
              <span className="text-xs font-mono font-bold text-brand-600">{effectivePct.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BankControlBar() {
  const { t } = useTranslation();
  const { financingPathOverride, setFinancingPathOverride, activeScenario, setActiveScenario } = useModelStore();
  const { user } = useAuth();

  const activePath = financingPathOverride ?? 'commercial'; // default if null

  return (
    <div className="sticky top-0 z-50 bg-surface-primary/90 backdrop-blur-md border-b border-surface-tertiary print:hidden">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
        {/* Left: back-link (operator only) + brand */}
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
            aria-label="Back to admin dashboard"
          >
            ← Admin
          </Link>
          <span className="font-semibold text-sm text-text-primary">Villa Lev Group</span>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-4">
          {/* Path pills */}
          <div className="flex gap-1">
            {PATHS.map(p => (
              <button
                key={p.key}
                onClick={() => setFinancingPathOverride(p.key)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activePath === p.key
                    ? 'bg-brand-500 text-white'
                    : 'text-text-secondary hover:bg-surface-secondary'
                }`}
              >
                {t(p.labelKey)}
              </button>
            ))}
          </div>

          {/* Optima rate modifier */}
          {activePath === 'optima' && (
            <>
              <div className="w-px h-5 bg-surface-tertiary" />
              <OptimaRatePopover />
            </>
          )}

          {/* Divider */}
          <div className="w-px h-5 bg-surface-tertiary" />

          {/* Scenario pills */}
          <div className="flex gap-1">
            {SCENARIOS.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveScenario(s.key as ScenarioName)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activeScenario === s.key
                    ? 'bg-earth-olive text-white'
                    : 'text-text-secondary hover:bg-surface-secondary'
                }`}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </div>

          {/* Language toggle */}
          <LanguageToggle placement="down" />
        </div>
      </div>
    </div>
  );
}
