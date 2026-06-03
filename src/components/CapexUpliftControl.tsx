"use client";

import { useState } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { formatCurrency } from "@/lib/hooks/useModel";
import { dscrColor } from "@/components/bankSensitivityHelpers";
import type { CapexBreakdown } from "@/lib/engine/types";

type CapexCategory = CapexBreakdown['categories'][number];

interface CapexUpliftControlProps {
  /** portfolioTotal from model.capex when no uplift is active */
  baseCapexEur: number;
  /** loan total for the active path captured before any uplift was set */
  baselineLoanEur: number;
  /** live sub-project loan from tabData — reflects the uplift when active */
  currentLoanEur: number;
  /** live DSCR from tabData */
  currentDscr: number;
  /** DSCR before any uplift was applied */
  baselineDscr?: number;
  /** CapEx categories before uplift — for the expandable breakdown */
  baseCapexCategories?: CapexCategory[] | null;
  /** CapEx categories after uplift (live from model) */
  currentCapexCategories?: CapexCategory[] | null;
}

type Mode = 'abs' | 'pct';

export function CapexUpliftControl({
  baseCapexEur,
  baselineLoanEur,
  currentLoanEur,
  currentDscr,
  baselineDscr,
  baseCapexCategories,
  currentCapexCategories,
}: CapexUpliftControlProps) {
  const { t, locale } = useTranslation();
  const { setCapexUplift, clearCapexUplift, capexUpliftEur, capexUpliftBase, capexUpliftMode, setCapexUpliftMode } = useModelStore();
  const [saved, setSaved] = useState(false);
  const [loanExpanded, setLoanExpanded] = useState(false);

  const mode = capexUpliftMode;

  const [inputValue, setInputValue] = useState(() => {
    if (capexUpliftEur === null || capexUpliftEur <= 0) return '';
    if (capexUpliftMode === 'abs') return (capexUpliftEur / 1_000).toString();
    const base = baseCapexEur > 0 ? baseCapexEur : (capexUpliftBase ?? 0);
    if (base <= 0) return '';
    return ((capexUpliftEur / base) * 100).toString();
  });

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function handleInput(raw: string) {
    setInputValue(raw);
    const v = parseFloat(raw);
    if (!raw.trim() || isNaN(v) || v <= 0) {
      clearCapexUplift();
      return;
    }
    const upliftEur = mode === 'abs' ? v * 1_000 : (baseCapexEur * v) / 100;
    setCapexUplift(
      upliftEur,
      baseCapexEur > 0 ? baseCapexEur : undefined,
    );
    flashSaved();
  }

  function handleModeSwitch(next: Mode) {
    setCapexUpliftMode(next);
    setInputValue('');
  }

  const isActive = capexUpliftEur !== null && capexUpliftEur > 0;

  const extraLoan = isActive ? currentLoanEur - baselineLoanEur : 0;
  const newEquity = isActive ? (capexUpliftEur ?? 0) - extraLoan : 0;

  // Build capex category diff for the expandable breakdown
  const capexDiff: { name: string; before: number; after: number; delta: number; pct: number }[] = [];
  if (isActive && baseCapexCategories && currentCapexCategories) {
    for (const after of currentCapexCategories) {
      const before = baseCapexCategories.find(c => c.name === after.name);
      if (!before) continue;
      const delta = after.grandTotal - before.grandTotal;
      if (Math.abs(delta) < 1) continue;
      capexDiff.push({
        name: after.name,
        before: before.grandTotal,
        after: after.grandTotal,
        delta,
        pct: before.grandTotal > 0 ? delta / before.grandTotal : 0,
      });
    }
  }

  return (
    <div className="rounded-xl border border-surface-tertiary bg-white shadow-sm p-5 print:hidden">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            {t('bank.optima.upliftTool')}
            <span
              className={`text-[10px] font-medium transition-opacity duration-300 ${
                saved ? 'opacity-100 text-emerald-600' : 'opacity-0'
              }`}
            >
              {t('bank.optima.upliftSaved')}
            </span>
          </h4>
          <p className="text-xs text-text-tertiary mt-0.5">
            {t('bank.optima.upliftSub')}
          </p>
        </div>
        {/* Mode toggle */}
        <div className="flex rounded-lg border border-surface-tertiary overflow-hidden text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleModeSwitch('abs')}
            className={[
              "px-3 py-1.5 transition-colors",
              mode === 'abs'
                ? "bg-brand-600 text-white"
                : "bg-white text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary",
            ].join(" ")}
          >
            {t('bank.optima.upliftModeAbs')}
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('pct')}
            className={[
              "px-3 py-1.5 transition-colors",
              mode === 'pct'
                ? "bg-brand-600 text-white"
                : "bg-white text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary",
            ].join(" ")}
          >
            {t('bank.optima.upliftModePct')}
          </button>
        </div>
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 mb-4">
        <label className="text-xs font-medium text-text-secondary whitespace-nowrap">
          {t('bank.optima.upliftLabel')}
        </label>
        <div className="relative flex-1 max-w-[180px]">
          <input
            type="number"
            min="0"
            step={mode === 'abs' ? '10' : '0.5'}
            value={inputValue}
            onChange={(e) => handleInput(e.target.value)}
            placeholder={mode === 'abs' ? '0' : '0.0'}
            className="w-full rounded-lg border border-surface-tertiary bg-surface-secondary/40 px-3 py-1.5 text-sm font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">
            {mode === 'abs' ? '€k' : '%'}
          </span>
        </div>
      </div>

      {/* Output strip — 3 cells */}
      <div className="rounded-xl border border-surface-tertiary overflow-hidden bg-surface-secondary/20">
        <div className="grid grid-cols-3 divide-x divide-surface-tertiary">
          {/* Extra loan — expandable when active */}
          <div className="px-3 py-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary">
                {t('bank.optima.upliftExtraLoan')}
              </span>
              {isActive && capexDiff.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLoanExpanded(v => !v)}
                  className="text-text-tertiary hover:text-text-secondary transition-colors"
                  aria-label={loanExpanded ? t('bank.optima.upliftCollapseBreakdown') : t('bank.optima.upliftExpandBreakdown')}
                >
                  <svg
                    width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"
                    className={`transition-transform ${loanExpanded ? 'rotate-180' : ''}`}
                  >
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>
            <div className="font-mono font-bold text-base text-text-primary">
              {isActive
                ? formatCurrency(extraLoan, true, locale)
                : <span className="text-text-tertiary">—</span>}
            </div>
          </div>

          {/* Net new equity */}
          <div className="px-3 py-3 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-1">
              {t('bank.optima.upliftNewEquity')}
            </div>
            <div className="font-mono font-bold text-base text-text-primary">
              {isActive
                ? formatCurrency(newEquity, true, locale)
                : <span className="text-text-tertiary">—</span>}
            </div>
          </div>

          {/* DSCR */}
          <div className="px-3 py-3 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-1">
              DSCR
            </div>
            <div className={`font-mono font-bold text-base ${isActive ? dscrColor(currentDscr) : 'text-text-tertiary'}`}>
              {isActive && currentDscr > 0
                ? `${currentDscr.toFixed(2)}×`
                : <span className="text-text-tertiary">—</span>}
            </div>
            {isActive && baselineDscr && baselineDscr > 0 && (
              (() => {
                const delta = currentDscr - baselineDscr;
                const sign = delta >= 0 ? '+' : '';
                const color = delta >= 0 ? 'text-emerald-600' : 'text-red-500';
                return (
                  <div className={`text-[10px] font-mono mt-0.5 ${color}`}>
                    {sign}{delta.toFixed(2)}× {t('bank.optima.upliftDscrVsBase')}
                  </div>
                );
              })()
            )}
          </div>
        </div>

        {/* Expandable CapEx category breakdown */}
        {loanExpanded && capexDiff.length > 0 && (
          <div className="border-t border-surface-tertiary px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary mb-2">
              {t('bank.optima.upliftCapexBreakdown')}
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-tertiary">
                  <th className="text-left font-medium pb-1">{t('bank.optima.upliftCategory')}</th>
                  <th className="text-right font-medium pb-1">{t('bank.optima.upliftBefore')}</th>
                  <th className="text-right font-medium pb-1">{t('bank.optima.upliftAfter')}</th>
                  <th className="text-right font-medium pb-1">{t('bank.optima.upliftDeltaAmt')}</th>
                  <th className="text-right font-medium pb-1">{t('bank.optima.upliftDeltaPct')}</th>
                </tr>
              </thead>
              <tbody>
                {capexDiff.map(row => (
                  <tr key={row.name} className="border-t border-surface-secondary/60">
                    <td className="py-1 text-text-secondary pr-2">{row.name}</td>
                    <td className="py-1 text-right font-mono text-text-tertiary">{formatCurrency(row.before, true, locale)}</td>
                    <td className="py-1 text-right font-mono text-text-primary">{formatCurrency(row.after, true, locale)}</td>
                    <td className="py-1 text-right font-mono text-amber-600">+{formatCurrency(row.delta, true, locale)}</td>
                    <td className="py-1 text-right font-mono text-amber-600">+{(row.pct * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
