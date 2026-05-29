"use client";

import { useState } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { formatCurrency } from "@/lib/hooks/useModel";
import { dscrColor } from "@/components/bankSensitivityHelpers";

interface CapexUpliftControlProps {
  /** portfolioTotal from model.capex when no uplift is active */
  baseCapexEur: number;
  /** loan total captured before any uplift was set (baseline reference) */
  baselineLoanEur: number;
  /** live sub-project loan from tabData — reflects the uplift when active */
  currentLoanEur: number;
  /** live DSCR from tabData */
  currentDscr: number;
}

type Mode = 'abs' | 'pct';

export function CapexUpliftControl({
  baseCapexEur,
  baselineLoanEur,
  currentLoanEur,
  currentDscr,
}: CapexUpliftControlProps) {
  const { t, locale } = useTranslation();
  const { setCapexUplift, clearCapexUplift, capexUpliftEur } = useModelStore();

  const [mode, setMode] = useState<Mode>('abs');
  const [inputValue, setInputValue] = useState('');

  function handleInput(raw: string) {
    setInputValue(raw);
    const v = parseFloat(raw);
    if (!raw.trim() || isNaN(v) || v <= 0) {
      clearCapexUplift();
      return;
    }
    const upliftEur = mode === 'abs' ? v * 1_000 : (baseCapexEur * v) / 100;
    setCapexUplift(upliftEur);
  }

  function handleModeSwitch(next: Mode) {
    setMode(next);
    setInputValue('');
    clearCapexUplift();
  }

  const isActive = capexUpliftEur !== null && capexUpliftEur > 0;

  // Delta computations
  const extraLoan = isActive ? currentLoanEur - baselineLoanEur : 0;
  const newEquity = isActive ? (capexUpliftEur ?? 0) - extraLoan : 0;

  return (
    <div className="rounded-xl border border-surface-tertiary bg-white shadow-sm p-5 print:hidden">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">
            {t('bank.optima.upliftTool')}
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
      <div className="grid grid-cols-3 divide-x divide-surface-tertiary rounded-xl border border-surface-tertiary overflow-hidden bg-surface-secondary/20">
        {/* Extra loan */}
        <div className="px-3 py-3 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-1">
            {t('bank.optima.upliftExtraLoan')}
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

        {/* DSCR — live, post-uplift, no delta language */}
        <div className="px-3 py-3 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-tertiary mb-1">
            DSCR
          </div>
          <div className={`font-mono font-bold text-base ${isActive ? dscrColor(currentDscr) : 'text-text-tertiary'}`}>
            {isActive && currentDscr > 0
              ? `${currentDscr.toFixed(2)}×`
              : <span className="text-text-tertiary">—</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
