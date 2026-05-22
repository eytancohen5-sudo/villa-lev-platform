"use client";

import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatMultiple, formatPercent } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { computeModel } from "@/lib/engine/model";
import type { ModelAssumptions } from "@/lib/engine/types";
import { useMemo } from "react";
import { PageTour, TourButton, usePageTour } from "@/components/PageTour";
import { SENSITIVITY_TOUR } from "@/lib/tours/configs";

// ── Tornado helpers ────────────────────────────────────────────────────
// Tornado chart: vary one input at a time around the baseline, capture how
// equity IRR moves, sort by absolute swing. The bar farthest from zero on
// the chart is the input with the most leverage on returns.

interface TornadoInput {
  label: string;
  // Apply the variation to a fresh copy of `a`. `side` is 'low' or 'high'.
  vary: (a: ModelAssumptions, side: 'low' | 'high') => ModelAssumptions;
  lowLabel: string;
  highLabel: string;
}

interface TornadoBarData {
  label: string;
  baseIRR: number;     // baseline equity IRR
  lowIRR: number;      // IRR at the low side
  highIRR: number;     // IRR at the high side
  lowLabel: string;
  highLabel: string;
  // Signed deltas from baseline (in IRR percentage points). lowDelta is usually
  // negative, highDelta positive — but for inputs like interest rate, "low"
  // (lower rate) actually improves IRR so the signs flip.
  lowDelta: number;
  highDelta: number;
  // Absolute swing — used for sorting (largest at top of tornado).
  swing: number;
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function computeTornado(baseline: ModelAssumptions): { bars: TornadoBarData[]; baseIRR: number; maxSwing: number } {
  const baseIRR = computeModel(baseline).scenarios.realistic.equityIRR;

  const inputs: TornadoInput[] = [
    {
      label: 'Villa ADR',
      vary: (a, s) => { a.revenueRealistic.villaADR *= s === 'low' ? 0.9 : 1.1; return a; },
      lowLabel: '−10%', highLabel: '+10%',
    },
    {
      label: 'Suite ADR (std + dbl)',
      vary: (a, s) => {
        const f = s === 'low' ? 0.9 : 1.1;
        a.revenueRealistic.suiteStandardADR *= f;
        a.revenueRealistic.suiteDoubleADR *= f;
        return a;
      },
      lowLabel: '−10%', highLabel: '+10%',
    },
    {
      label: 'Villa nights / yr',
      vary: (a, s) => { a.revenueRealistic.villaBaseNights = Math.round(a.revenueRealistic.villaBaseNights * (s === 'low' ? 0.9 : 1.1)); return a; },
      lowLabel: '−10%', highLabel: '+10%',
    },
    {
      label: 'Suite nights / yr',
      vary: (a, s) => { a.revenueRealistic.suiteBaseNights = Math.round(a.revenueRealistic.suiteBaseNights * (s === 'low' ? 0.9 : 1.1)); return a; },
      lowLabel: '−10%', highLabel: '+10%',
    },
    {
      label: 'Interest rate',
      // Rates: ±100bps absolute, NOT ±10%, since 10% of 5% (50bps) is too small to be meaningful in stress-tests.
      vary: (a, s) => { a.commercialLoan.interestRate += s === 'low' ? -0.01 : 0.01; return a; },
      lowLabel: '−100bp', highLabel: '+100bp',
    },
    {
      label: 'Loan coverage rate',
      // ±5pp absolute — same reason; small loan-coverage moves shift equity meaningfully.
      vary: (a, s) => { a.commercialLoan.loanCoverageRate += s === 'low' ? -0.05 : 0.05; return a; },
      lowLabel: '−5pp', highLabel: '+5pp',
    },
    {
      label: 'Exit EBITDA multiple',
      vary: (a, s) => { a.exitEbitdaMultiple *= s === 'low' ? 0.8 : 1.2; return a; },
      lowLabel: '−20%', highLabel: '+20%',
    },
    {
      label: 'Exit year',
      // Earlier exit usually lifts IRR (terminal lump lands sooner, less
      // discounting); later exit usually lowers it. Bracket ±2 years from base.
      vary: (a, s) => {
        const base = a.exitYear ?? 2036;
        const lo = Math.max(2030, base - 2);
        const hi = Math.min(2036, base + 2);
        a.exitYear = s === 'low' ? lo : hi;
        return a;
      },
      lowLabel: '−2y', highLabel: '+2y',
    },
    {
      label: 'Construction €/m²',
      vary: (a, s) => {
        const f = s === 'low' ? 0.9 : 1.1;
        a.portfolio.forEach((p) => { p.constructionCostPerM2 *= f; });
        return a;
      },
      lowLabel: '−10%', highLabel: '+10%',
    },
    {
      label: 'FF&E per unit',
      vary: (a, s) => {
        const f = s === 'low' ? 0.9 : 1.1;
        a.portfolio.forEach((p) => { p.ffeCost *= f; });
        return a;
      },
      lowLabel: '−10%', highLabel: '+10%',
    },
    {
      label: 'Acquisition legal / plot',
      vary: (a, s) => { a.acquisitionLegalPerPlot *= s === 'low' ? 0.8 : 1.2; return a; },
      lowLabel: '−20%', highLabel: '+20%',
    },
  ];

  const bars: TornadoBarData[] = inputs.map((input) => {
    const low = computeModel(input.vary(clone(baseline), 'low')).scenarios.realistic.equityIRR;
    const high = computeModel(input.vary(clone(baseline), 'high')).scenarios.realistic.equityIRR;
    return {
      label: input.label,
      baseIRR,
      lowIRR: low,
      highIRR: high,
      lowLabel: input.lowLabel,
      highLabel: input.highLabel,
      lowDelta: low - baseIRR,
      highDelta: high - baseIRR,
      swing: Math.abs(high - low),
    };
  });

  bars.sort((a, b) => b.swing - a.swing);
  const maxSwing = Math.max(...bars.map((b) => Math.max(Math.abs(b.lowDelta), Math.abs(b.highDelta))));
  return { bars, baseIRR, maxSwing };
}

function TornadoBar({ bar, maxSwing }: { bar: TornadoBarData; maxSwing: number }) {
  // Percentage of the half-width to use for each side, scaled to the global max.
  const lowPct = maxSwing > 0 ? (Math.abs(bar.lowDelta) / maxSwing) * 100 : 0;
  const highPct = maxSwing > 0 ? (Math.abs(bar.highDelta) / maxSwing) * 100 : 0;
  // Color: red side = whichever direction lowers IRR; green side = the other.
  const lowColor = bar.lowDelta < 0 ? 'bg-negative/70' : 'bg-positive/70';
  const highColor = bar.highDelta > 0 ? 'bg-positive/70' : 'bg-negative/70';
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-44 text-xs text-text-secondary text-right truncate" title={bar.label}>
        {bar.label}
      </div>
      <div className="flex-1 grid grid-cols-2 relative">
        {/* Centerline (baseline IRR) */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-text-tertiary/40 z-10" />
        {/* Left half (low side) */}
        <div className="flex justify-end pr-px">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-tertiary font-mono">
              {(bar.lowIRR * 100).toFixed(1)}%
            </span>
            <div
              className={`h-5 ${lowColor} rounded-l`}
              style={{ width: `max(${lowPct}%, 2px)` }}
              title={`${bar.lowLabel}: equity IRR ${(bar.lowIRR * 100).toFixed(2)}% (Δ ${bar.lowDelta >= 0 ? '+' : ''}${(bar.lowDelta * 100).toFixed(2)}pp)`}
            />
          </div>
        </div>
        {/* Right half (high side) */}
        <div className="flex justify-start pl-px">
          <div className="flex items-center gap-1">
            <div
              className={`h-5 ${highColor} rounded-r`}
              style={{ width: `max(${highPct}%, 2px)` }}
              title={`${bar.highLabel}: equity IRR ${(bar.highIRR * 100).toFixed(2)}% (Δ ${bar.highDelta >= 0 ? '+' : ''}${(bar.highDelta * 100).toFixed(2)}pp)`}
            />
            <span className="text-[10px] text-text-tertiary font-mono">
              {(bar.highIRR * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      <div className="w-20 text-[10px] text-text-tertiary font-mono text-right tabular-nums">
        {(bar.swing * 100).toFixed(2)}pp
      </div>
    </div>
  );
}

export default function SensitivityPage() {
  const { t, locale } = useTranslation();
  const { assumptions } = useModelStore();
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(SENSITIVITY_TOUR.storageKey);

  const sensitivityData = useMemo(() => {
    // ADR sensitivity
    const adrDeltas = [-500, -250, -100, 0, 100, 250, 500];
    const adrRows = adrDeltas.map((delta) => {
      const modified = {
        ...assumptions,
        revenueRealistic: {
          ...assumptions.revenueRealistic,
          villaADR: assumptions.revenueRealistic.villaADR + delta,
        },
      };
      const result = computeModel(modified);
      const stab = result.scenarios.realistic.stabilisedYear;
      return {
        label: delta === 0 ? t('sens.base') : `${delta > 0 ? "+" : ""}€${delta}`,
        adr: assumptions.revenueRealistic.villaADR + delta,
        ebitda: stab?.ebitda ?? 0,
        dscr: stab?.dscr ?? 0,
        ncf: stab?.netCashFlowPostVAT ?? 0,
        isBase: delta === 0,
      };
    });

    // Nights sensitivity
    const nightsDeltas = [-20, -10, -5, 0, 5, 10, 15];
    const nightsRows = nightsDeltas.map((delta) => {
      const modified = {
        ...assumptions,
        revenueRealistic: {
          ...assumptions.revenueRealistic,
          villaBaseNights: assumptions.revenueRealistic.villaBaseNights + delta,
          suiteBaseNights: assumptions.revenueRealistic.suiteBaseNights + delta,
        },
      };
      const result = computeModel(modified);
      const stab = result.scenarios.realistic.stabilisedYear;
      return {
        label: delta === 0 ? t('sens.base') : `${delta > 0 ? "+" : ""}${delta} nights`,
        nights: assumptions.revenueRealistic.villaBaseNights + delta,
        ebitda: stab?.ebitda ?? 0,
        dscr: stab?.dscr ?? 0,
        ncf: stab?.netCashFlowPostVAT ?? 0,
        isBase: delta === 0,
      };
    });

    // Interest rate sensitivity
    const rateDeltas = [-0.02, -0.01, -0.005, 0, 0.005, 0.01, 0.02];
    const rateRows = rateDeltas.map((delta) => {
      const modified = {
        ...assumptions,
        commercialLoan: {
          ...assumptions.commercialLoan,
          interestRate: assumptions.commercialLoan.interestRate + delta,
        },
      };
      const result = computeModel(modified);
      const stab = result.scenarios.realistic.stabilisedYear;
      return {
        label: delta === 0 ? t('sens.base') : `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1)}%`,
        rate: ((assumptions.commercialLoan.interestRate + delta) * 100).toFixed(2) + "%",
        ebitda: stab?.ebitda ?? 0,
        dscr: stab?.dscr ?? 0,
        ncf: stab?.netCashFlowPostVAT ?? 0,
        ds: stab?.debtService ?? 0,
        isBase: delta === 0,
      };
    });

    // Working capital facility-size sensitivity
    const wcFacilities = [300000, 400000, 500000];
    const wcRows = wcFacilities.map((size) => {
      const modified = {
        ...assumptions,
        workingCapital: {
          ...assumptions.workingCapital,
          active: true,
          facilitySize: size,
        },
      };
      const result = computeModel(modified);
      const real = result.scenarios.realistic;
      const stab = real.stabilisedYear;
      const y2 = real.pnl.find((p) => p.year === 2029);
      return {
        label: `€${(size / 1000).toFixed(0)}K`,
        size,
        wcY2Peak: y2?.wcPeakBalance ?? 0,
        wcY2Trough: y2?.wcTroughBalance ?? 0,
        wcInterest: stab?.wcInterestExpense ?? 0,
        ncf: stab?.netCashFlowPostVAT ?? 0,
        isBase: size === assumptions.workingCapital.facilitySize,
      };
    });

    // Exit year × multiple matrix — equity IRR for every cell. The headline
    // sensitivity for exit-side underwriting. 4 years × 8 multiples = 32 runs.
    // Multiple range widened past the legacy 14× cap per Eytan 2026-05-22 —
    // sponsor wants to stress the optimistic ceiling without the input clamp.
    const exitYears = [2030, 2032, 2034, 2036];
    const exitMultiples = [6, 8, 10, 12, 14, 16, 18, 20];
    const exitMatrix = exitYears.map((year) => ({
      year,
      cells: exitMultiples.map((mult) => {
        const modified = { ...assumptions, exitYear: year, exitEbitdaMultiple: mult };
        const result = computeModel(modified).scenarios.realistic;
        return {
          mult,
          irr: result.equityIRR,
          moic: result.totalMOIC,
          underwater: result.terminalUnderwater,
          isBase:
            year === (assumptions.exitYear ?? 2036) &&
            Math.abs(mult - assumptions.exitEbitdaMultiple) < 0.01,
        };
      }),
    }));

    return { adrRows, nightsRows, rateRows, wcRows, exitMatrix, exitMultiples };
  }, [assumptions]);

  // Tornado is its own memo — 20+ engine runs, only redo when assumptions change.
  const tornado = useMemo(() => computeTornado(assumptions), [assumptions]);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-text-primary mb-1">{t('sens.title')}</h1>
          <p className="text-sm text-text-secondary">{t('sens.subtitle')}</p>
        </div>
        <TourButton onClick={() => setTourOpen(true)} pulsing={!!neverSeen} />
      </div>

      {/* Tornado — which inputs move equity IRR the most. */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-5 mb-6">
        <div className="flex items-baseline justify-between mb-4 gap-4 flex-wrap">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary">
            Tornado — equity IRR sensitivity
          </h3>
          <div className="text-xs text-text-tertiary">
            Baseline: <span className="font-mono text-text-primary">{formatPercent(tornado.baseIRR, 1)}</span>{' '}
            · {tornado.bars.length} inputs · ranked by absolute swing
          </div>
        </div>

        {/* Centered axis label row */}
        <div className="flex items-center gap-3 mb-2 text-[10px] uppercase tracking-wider text-text-tertiary">
          <div className="w-44 text-right">Input</div>
          <div className="flex-1 grid grid-cols-2">
            <div className="text-right pr-2">↓ lower equity IRR</div>
            <div className="pl-2">higher equity IRR ↑</div>
          </div>
          <div className="w-20 text-right">Swing</div>
        </div>

        <div className="border-t border-surface-secondary/50 pt-2">
          {tornado.bars.map((bar) => (
            <TornadoBar key={bar.label} bar={bar} maxSwing={tornado.maxSwing} />
          ))}
        </div>

        <p className="mt-4 text-[11px] text-text-tertiary leading-relaxed">
          Each row varies one input ± while everything else stays at the baseline, then captures equity IRR. Bars on the red side mean the variation drops IRR; green side means IRR goes up. Inputs near the top have the most leverage on returns; inputs near the bottom barely move the needle. <strong>Rates ±100bp absolute, loan coverage ±5pp absolute, exit multiple ±20%, everything else ±10%.</strong>
        </p>
      </div>

      {/* Exit Year × Multiple matrix — investor-facing exit sensitivity */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-5 mb-6">
        <div className="flex items-baseline justify-between mb-4 gap-4 flex-wrap">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary">
            Exit year × multiple — equity IRR matrix
          </h3>
          <div className="text-xs text-text-tertiary">
            Active: <span className="font-mono text-text-primary">{assumptions.exitYear ?? 2036} @ {assumptions.exitEbitdaMultiple}×</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                  Exit year ↓ / Multiple →
                </th>
                {sensitivityData.exitMultiples.map((m) => (
                  <th key={m} className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    {m}×
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sensitivityData.exitMatrix.map((row) => (
                <tr key={row.year} className="border-b border-surface-secondary/50">
                  <td className="py-2 pr-4 font-medium">{row.year}</td>
                  {row.cells.map((cell) => {
                    // Color: warning if underwater, else gradient by IRR
                    const tone = cell.underwater
                      ? "bg-warning/15 text-warning"
                      : cell.irr >= 0.25
                        ? "bg-positive/20 text-positive font-semibold"
                        : cell.irr >= 0.15
                          ? "bg-positive/8"
                          : cell.irr >= 0.08
                            ? ""
                            : "bg-negative/8 text-negative";
                    const ringClass = cell.isBase ? " ring-2 ring-brand-500 ring-inset" : "";
                    return (
                      <td
                        key={cell.mult}
                        className={`text-right py-2 px-3 data-cell ${tone}${ringClass}`}
                        title={
                          cell.underwater
                            ? `Underwater: debt > asset value at this exit. MOIC ${formatMultiple(cell.moic)}.`
                            : `MOIC ${formatMultiple(cell.moic)}`
                        }
                      >
                        {cell.irr > 0 ? formatPercent(cell.irr, 1) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-text-tertiary leading-relaxed">
          Equity IRR for every combination of exit year (2030–2036) and exit EBITDA multiple (6× to 20×).
          Active configuration is ringed; cells in <span className="text-warning">amber</span> are underwater
          (remaining debt &gt; asset value, equity sale proceeds floor at €0). Hover for MOIC.
        </p>
      </div>

      {/* ADR Sensitivity */}
      <div id="sens-occupancy" className="bg-white rounded-xl border border-surface-tertiary p-5 mb-6 scroll-mt-24">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
          {t('sens.adrSensitivity')} ({t('sens.base')}: €{assumptions.revenueRealistic.villaADR})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('sens.change')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('term.adr')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('term.ebitda')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('term.dscr')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('pnl.ncfPostVAT')}</th>
              </tr>
            </thead>
            <tbody>
              {sensitivityData.adrRows.map((row) => (
                <tr key={row.label} className={`border-b border-surface-secondary/50 ${row.isBase ? "bg-brand-50/50 font-medium" : ""}`}>
                  <td className="py-2 pr-4">{row.label}</td>
                  <td className="text-right py-2 px-3 data-cell">€{row.adr.toLocaleString()}</td>
                  <td className="text-right py-2 px-3 data-cell">{formatCurrency(row.ebitda, true, locale)}</td>
                  <td className={`text-right py-2 px-3 data-cell ${row.dscr >= 1.25 ? "text-positive" : "text-warning"}`}>
                    {formatMultiple(row.dscr)}
                  </td>
                  <td className={`text-right py-2 px-3 data-cell ${row.ncf >= 0 ? "text-positive" : "text-negative"}`}>
                    {formatCurrency(row.ncf, true, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nights Sensitivity */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-5 mb-6">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
          {t('sens.occupancySensitivity')} ({t('sens.base')}: {assumptions.revenueRealistic.villaBaseNights} nights)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('sens.change')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('field.nights')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('term.ebitda')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('term.dscr')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('pnl.ncfPostVAT')}</th>
              </tr>
            </thead>
            <tbody>
              {sensitivityData.nightsRows.map((row) => (
                <tr key={row.label} className={`border-b border-surface-secondary/50 ${row.isBase ? "bg-brand-50/50 font-medium" : ""}`}>
                  <td className="py-2 pr-4">{row.label}</td>
                  <td className="text-right py-2 px-3 data-cell">{row.nights}</td>
                  <td className="text-right py-2 px-3 data-cell">{formatCurrency(row.ebitda, true, locale)}</td>
                  <td className={`text-right py-2 px-3 data-cell ${row.dscr >= 1.25 ? "text-positive" : "text-warning"}`}>
                    {formatMultiple(row.dscr)}
                  </td>
                  <td className={`text-right py-2 px-3 data-cell ${row.ncf >= 0 ? "text-positive" : "text-negative"}`}>
                    {formatCurrency(row.ncf, true, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interest Rate Sensitivity */}
      <div id="sens-rate" className="bg-white rounded-xl border border-surface-tertiary p-5 scroll-mt-24">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
          {t('sens.interestSensitivity')} ({t('sens.base')}: {(assumptions.commercialLoan.interestRate * 100).toFixed(1)}%)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('sens.change')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('field.rate')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('kpi.annualDS')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('term.dscr')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('pnl.ncfPostVAT')}</th>
              </tr>
            </thead>
            <tbody>
              {sensitivityData.rateRows.map((row) => (
                <tr key={row.label} className={`border-b border-surface-secondary/50 ${row.isBase ? "bg-brand-50/50 font-medium" : ""}`}>
                  <td className="py-2 pr-4">{row.label}</td>
                  <td className="text-right py-2 px-3 data-cell">{row.rate}</td>
                  <td className="text-right py-2 px-3 data-cell">{formatCurrency(row.ds, true, locale)}</td>
                  <td className={`text-right py-2 px-3 data-cell ${row.dscr >= 1.25 ? "text-positive" : "text-warning"}`}>
                    {formatMultiple(row.dscr)}
                  </td>
                  <td className={`text-right py-2 px-3 data-cell ${row.ncf >= 0 ? "text-positive" : "text-negative"}`}>
                    {formatCurrency(row.ncf, true, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Working Capital Sensitivity */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-5 mt-6">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-4">
          {t('sens.wcSensitivity')} ({t('sens.base')}: {formatCurrency(assumptions.workingCapital.facilitySize, true, locale)})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('sens.facility')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('pnl.wcPeak')} (Y2)</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('sens.wcY2Trough')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('pnl.wcInterest')}</th>
                <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('pnl.ncfPostVAT')}</th>
              </tr>
            </thead>
            <tbody>
              {sensitivityData.wcRows.map((row) => (
                <tr key={row.label} className={`border-b border-surface-secondary/50 ${row.isBase ? "bg-brand-50/50 font-medium" : ""}`}>
                  <td className="py-2 pr-4">{row.label}</td>
                  <td className="text-right py-2 px-3 data-cell">{formatCurrency(row.wcY2Peak, true, locale)}</td>
                  <td className={`text-right py-2 px-3 data-cell ${row.wcY2Trough <= 50000 ? "text-positive" : "text-warning"}`}>
                    {formatCurrency(row.wcY2Trough, true, locale)}
                  </td>
                  <td className="text-right py-2 px-3 data-cell text-negative">
                    {formatCurrency(row.wcInterest, true, locale)}
                  </td>
                  <td className={`text-right py-2 px-3 data-cell ${row.ncf >= 0 ? "text-positive" : "text-negative"}`}>
                    {formatCurrency(row.ncf, true, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={SENSITIVITY_TOUR} />
    </div>
  );
}
