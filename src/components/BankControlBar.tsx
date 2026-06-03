'use client';

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
  const { assumptions, setOptimaSpreadBps, setOptimaEuriborRate, setAssumption } = useModelStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Draft strings — let the user type freely; commit on blur / Enter
  const [euriborDraft, setEuriborDraft] = useState('');
  const [spreadDraft, setSpreadDraft] = useState('');
  const [loanPctDraft, setLoanPctDraft] = useState('');

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Sync drafts from store whenever popover opens
  const loan = assumptions.optimaLoan;
  useEffect(() => {
    if (!open || !loan) return;
    setEuriborDraft((loan.euriborRate * 100).toFixed(2));
    setSpreadDraft(String(loan.spreadBps));
    setLoanPctDraft(String(Math.round((loan.loanCoverageRate ?? 0.70) * 100)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!loan) return null;

  const euriborPct = loan.euriborRate * 100;
  const spreadPct = loan.spreadBps / 100;
  const effectivePct = euriborPct + spreadPct;
  const loanCoveragePct = Math.round((loan.loanCoverageRate ?? 0.70) * 100);

  // ── Nudge helpers (also sync draft so display stays consistent after click) ──
  const nudgeEuribor = (deltaBps: number) => {
    const nextBps = Math.max(0, Math.min(1500, Math.round(loan.euriborRate * 10000) + deltaBps));
    const next = nextBps / 10000;
    if (next !== loan.euriborRate) {
      setOptimaEuriborRate(next);
      setEuriborDraft((next * 100).toFixed(2));
    }
  };

  const nudgeSpread = (deltaBps: number) => {
    const next = Math.max(0, Math.min(1000, loan.spreadBps + deltaBps));
    if (next !== loan.spreadBps) {
      setOptimaSpreadBps(next);
      setSpreadDraft(String(next));
    }
  };

  const nudgeLoanCoverage = (deltaPct: number) => {
    const current = Math.round((loan.loanCoverageRate ?? 0.70) * 100);
    const next = Math.max(50, Math.min(95, current + deltaPct));
    if (next !== current) {
      setAssumption('optimaLoan.loanCoverageRate', next / 100, 'Optima loan %');
      setLoanPctDraft(String(next));
    }
  };

  // ── Commit helpers ──
  const commitEuribor = (val: string) => {
    const pct = parseFloat(val);
    if (!isNaN(pct)) {
      const clamped = Math.max(0, Math.min(15, pct));
      setOptimaEuriborRate(clamped / 100);
      setEuriborDraft(clamped.toFixed(2));
    } else {
      setEuriborDraft((loan.euriborRate * 100).toFixed(2));
    }
  };

  const commitSpread = (val: string) => {
    const bps = parseInt(val, 10);
    if (!isNaN(bps)) {
      const clamped = Math.max(0, Math.min(1000, bps));
      setOptimaSpreadBps(clamped);
      setSpreadDraft(String(clamped));
    } else {
      setSpreadDraft(String(loan.spreadBps));
    }
  };

  const commitLoanPct = (val: string) => {
    const pct = parseInt(val, 10);
    if (!isNaN(pct)) {
      const clamped = Math.max(50, Math.min(95, pct));
      setAssumption('optimaLoan.loanCoverageRate', clamped / 100, 'Optima loan %');
      setLoanPctDraft(String(clamped));
    } else {
      setLoanPctDraft(String(Math.round((loan.loanCoverageRate ?? 0.70) * 100)));
    }
  };

  const btnClass = "w-6 h-6 flex items-center justify-center rounded-md bg-surface-secondary border border-surface-tertiary hover:bg-surface-tertiary text-xs font-mono text-text-secondary shrink-0";
  const inputClass = "w-14 text-center text-xs font-mono text-text-primary bg-surface-secondary border border-surface-tertiary rounded px-1 py-0.5 focus:outline-none focus:border-brand-400 focus:bg-white";

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
        {effectivePct.toFixed(2)}% · {loanCoveragePct}%
      </button>
      {open && (
        <div className="absolute top-full mt-2 right-0 z-30 bg-white border border-surface-tertiary rounded-xl shadow-lg p-4 min-w-[260px]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">
            {t('bank.bar.optimaRate')}
          </div>
          <div className="space-y-3">

            {/* Euribor — editable */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-text-secondary shrink-0">{t('bank.bar.optimaEuribor')}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => nudgeEuribor(-25)} className={btnClass} aria-label="−25bps">−</button>
                <div className="flex items-center">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={euriborDraft}
                    onChange={e => setEuriborDraft(e.target.value)}
                    onBlur={e => commitEuribor(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { commitEuribor(euriborDraft); (e.target as HTMLInputElement).blur(); }
                      if (e.key === 'Escape') setEuriborDraft((loan.euriborRate * 100).toFixed(2));
                    }}
                    className={inputClass}
                    aria-label="Euribor rate %"
                  />
                  <span className="text-xs text-text-tertiary ml-0.5">%</span>
                </div>
                <button type="button" onClick={() => nudgeEuribor(25)} className={btnClass} aria-label="+25bps">+</button>
              </div>
            </div>

            {/* Spread — editable */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-text-secondary shrink-0">{t('bank.bar.optimaSpread')}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => nudgeSpread(-25)} className={btnClass} aria-label="−25bps">−</button>
                <div className="flex items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={spreadDraft}
                    onChange={e => setSpreadDraft(e.target.value)}
                    onBlur={e => commitSpread(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { commitSpread(spreadDraft); (e.target as HTMLInputElement).blur(); }
                      if (e.key === 'Escape') setSpreadDraft(String(loan.spreadBps));
                    }}
                    className={inputClass}
                    aria-label="Spread bps"
                  />
                  <span className="text-xs text-text-tertiary ml-0.5">bps</span>
                </div>
                <button type="button" onClick={() => nudgeSpread(25)} className={btnClass} aria-label="+25bps">+</button>
              </div>
            </div>

            {/* Effective — read-only computed */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-surface-secondary">
              <span className="text-xs font-semibold text-text-primary">{t('bank.bar.optimaEffective')}</span>
              <span className="text-xs font-mono font-bold text-brand-600">{effectivePct.toFixed(2)}%</span>
            </div>

            {/* Loan % — editable */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-surface-secondary">
              <span className="text-xs text-text-secondary shrink-0">{t('bank.bar.optimaLoanPct')}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => nudgeLoanCoverage(-5)} className={btnClass} aria-label="−5pp">−</button>
                <div className="flex items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={loanPctDraft}
                    onChange={e => setLoanPctDraft(e.target.value)}
                    onBlur={e => commitLoanPct(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { commitLoanPct(loanPctDraft); (e.target as HTMLInputElement).blur(); }
                      if (e.key === 'Escape') setLoanPctDraft(String(Math.round((loan.loanCoverageRate ?? 0.70) * 100)));
                    }}
                    className={inputClass}
                    aria-label="Loan coverage %"
                  />
                  <span className="text-xs text-text-tertiary ml-0.5">%</span>
                </div>
                <button type="button" onClick={() => nudgeLoanCoverage(5)} className={btnClass} aria-label="+5pp">+</button>
              </div>
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
                className={`px-3 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand-400/60 ${
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
                title={s.key === 'breakeven' ? t('bank.bar.breakevenSub') : undefined}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand-400/60 ${
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
