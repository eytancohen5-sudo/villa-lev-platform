// ============================================================
// Working Capital — quarterly schedule, annual aggregates
// ============================================================
//
// Models the revolving WC facility at quarterly granularity (Q1-Q4 each year)
// then aggregates to annual peak / trough / average / interest expense for the
// engine's annual P&L contract.
//
// Schedule (default Realistic):
//   • Q1-2029 → Q3-2029: pre-opening draw, €50K/quarter (×4 = €200K total)
//   • Q3-2029 (peak season / opening): self-liquidating repay of pre-opening balance
//   • Q4-2029: seasonal draw €150K + Y2 ramp buffer top-up €100K
//   • Q1-2030, Q2-2030: balance carries
//   • Q3-2030: self-liquidating repay
//   • Q4 each subsequent year: seasonal draw €150K
//   • Q3 each subsequent year: self-liquidating repay
//
// Downside applies a multiplier to the seasonal draw (×1.5) and a partial
// repayment ratio (70%), so balance carries forward year-over-year.
//
// Interest accrues quarterly on average-of-(opening,closing) at
// (term-loan rate + spread). Settled out of operating cash, not added to
// principal.

import { WorkingCapitalParams, WorkingCapitalQuarter } from './types';
import { DOWNSIDE_FACTORS, WC_TROUGH_THRESHOLD } from './defaults';

export interface AnnualWCAggregate {
  year: number;
  openingBalance: number;
  closingBalance: number;
  drawsTotal: number;
  repaymentsTotal: number;
  avgBalance: number;
  peakBalance: number;
  troughBalance: number;
  interestExpense: number;
  netContribution: number;
  selfLiquidatingViolation: boolean;
}

export interface WorkingCapitalSchedule {
  active: boolean;
  effectiveFacility: number;
  /** Computed minimum: VAT-bridge peak rounded up to nearest €50k. */
  minimumFacility: number;
  rate: number;
  quarters: WorkingCapitalQuarter[];
  annual: Map<number, AnnualWCAggregate>;
}

const EMPTY_SCHEDULE: WorkingCapitalSchedule = {
  active: false,
  effectiveFacility: 0,
  minimumFacility: 0,
  rate: 0,
  quarters: [],
  annual: new Map(),
};

// ── VAT-bridge sub-facility ──────────────────────────────────────────────────
// All 4 construction tranches fall within 2029 (mobilization + 3 milestones,
// March–July 2029). The project pays VAT on progress invoices and draws the
// revolving line to fund that cash outflow while AADE processes the refund.
// The outstanding balance (= VAT receivable still pending refund) is tracked
// here as a second sub-balance alongside the operational WC.
//
// All amounts are the CLOSING BALANCE of the VAT-bridge sub-facility at each
// quarter end. The engine computes incremental draws/repayments from the
// change in balance. Interest accrues on avg(opening, closing) like op WC, at
// the same rate, and is folded into `interestAccrual` so it flows to the P&L
// automatically.
//
// Construction VAT total: €7,589,108 (93.4% of professional services at 24%)
// Tranche schedule (4 equal tranches of 25% each):
//   Q1-2029 (March):     Tranche 1 — mobilization      25%
//   Q2-2029 (Apr-May):   Tranches 2 & 3 — main work    50%
//   Q3-2029 (June):      Tranche 4 — fit-out completion 25%
// AADE refund lag: received Q1-Q2 2030 after 2029 completion.
// Peak outstanding: Q3-Q4 2029 ≈ full VAT amount.
// Final refund received: Q1-Q2 2030, balance fully closed by Q2-2030.
const VAT_BRIDGE_CLOSING: Record<string, number> = {
  '2029Q1': 455_346,
  '2029Q2': 728_554,
  '2029Q3': 728_554,
  '2029Q4': 728_554,
  '2030Q1': 364_277,
  '2030Q2': 0,
};

export function computeWorkingCapital(
  params: WorkingCapitalParams,
  termRate: number,
  startYear: number,
  endYear: number,
  isDownside: boolean = false,
  // Map of year → cumulative net-cash-flow-post-tax through end of that year,
  // computed in a baseline pass without WC interest. Used to gate the seasonal
  // draw: when prior-year cum cash exceeds `internalCashBuffer`, the surplus
  // replaces drawn revolver 1-for-1.
  cumulativeCashByYear: Map<number, number> = new Map()
): WorkingCapitalSchedule {
  if (!params.active) return EMPTY_SCHEDULE;

  const rate = termRate + params.spreadOverTermRate;
  const dsraLock = params.dsraConversionEnabled ? params.dsraLockAmount : 0;
  const effectiveFacility = Math.max(0, params.facilitySize - dsraLock);

  const seasonalMult = isDownside ? DOWNSIDE_FACTORS.wcSeasonalDrawMultiplier : 1;
  const repaymentRatio = isDownside ? DOWNSIDE_FACTORS.wcRepaymentRatio : 1;
  const baseSeasonalDraw = params.seasonalDrawPerCycle * seasonalMult;

  const preOpenPerQuarter = params.preOpeningTotalDraw / 4;

  // Helper: given a draw amount for year y, reduce by the prior-year surplus
  // above the safety buffer.
  const gateDrawByCash = (year: number, draw: number): number => {
    const priorCum = cumulativeCashByYear.get(year - 1) ?? -Infinity;
    if (priorCum === -Infinity) return draw;
    const surplus = Math.max(0, priorCum - params.internalCashBuffer);
    return Math.max(0, draw - surplus);
  };

  const quarters: WorkingCapitalQuarter[] = [];
  let balance = 0;
  // VAT-bridge sub-balance (tracked separately; never gated by cash surplus).
  let vatBalance = 0;

  const QUARTERS: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
  for (let y = startYear; y <= endYear; y++) {
    for (const q of QUARTERS) {
      const opening = balance;
      let draws = 0;
      let repayments = 0;

      // Pre-opening draws: Q1-2029, Q2-2029, Q3-2029 (construction tranches).
      const isPreOpenQuarter =
        y === 2029 && (q === 1 || q === 2 || q === 3);
      if (isPreOpenQuarter) {
        draws += preOpenPerQuarter;
      }

      // Seasonal draw: Q4 of every operational year (2029+).
      // Gated by prior-year cumulative cash — once the company has built up
      // surplus above its internal cash buffer, the revolver stops drawing.
      if (y >= 2029 && q === 4) {
        draws += gateDrawByCash(y, baseSeasonalDraw);
      }

      // Y2 ramp buffer top-up: drawn alongside Q4-2029 seasonal cycle.
      // Same cash-gating applies (in 2029 cum cash is negative, so this
      // typically draws in full — but kept consistent for symmetry).
      if (y === 2029 && q === 4) {
        draws += gateDrawByCash(y, params.y2RampBufferTopup);
      }

      // Self-liquidating repayment: Q3 each operational year.
      if (params.selfLiquidating && y >= 2029 && q === 3) {
        repayments = opening * repaymentRatio;
      }

      const closing = opening + draws - repayments;
      const avgQ = (opening + closing) / 2;

      // VAT-bridge sub-facility: derive closing balance from static schedule.
      // Keys not in the map default to 0 (before construction starts / after
      // final AADE refund clears).
      const vatOpening = vatBalance;
      const vatClosing = VAT_BRIDGE_CLOSING[`${y}Q${q}`] ?? 0;
      const vatAvgQ = (vatOpening + vatClosing) / 2;

      // Combined interest: operational WC avg + VAT-bridge avg, at same rate.
      const interestAccrual = (avgQ + vatAvgQ) * (rate / 4);

      quarters.push({
        year: y,
        quarter: q,
        openingBalance: opening,
        draws,
        repayments,
        closingBalance: closing,
        interestAccrual,
        vatBridgeBalance: vatClosing,
      });

      balance = closing;
      vatBalance = vatClosing;
    }
  }

  const annual = new Map<number, AnnualWCAggregate>();
  for (let y = startYear; y <= endYear; y++) {
    const yearQs = quarters.filter((qe) => qe.year === y);
    if (yearQs.length === 0) continue;
    const closings = yearQs.map((qe) => qe.closingBalance);
    const drawsTotal = yearQs.reduce((s, qe) => s + qe.draws, 0);
    const repaymentsTotal = yearQs.reduce((s, qe) => s + qe.repayments, 0);
    const interestExpense = yearQs.reduce((s, qe) => s + qe.interestAccrual, 0);
    const peak = Math.max(...closings);
    const trough = Math.min(...closings);
    const avg = closings.reduce((s, b) => s + b, 0) / closings.length;
    annual.set(y, {
      year: y,
      openingBalance: yearQs[0].openingBalance,
      closingBalance: yearQs[yearQs.length - 1].closingBalance,
      drawsTotal,
      repaymentsTotal,
      avgBalance: avg,
      peakBalance: peak,
      troughBalance: trough,
      interestExpense,
      netContribution: drawsTotal - repaymentsTotal,
      selfLiquidatingViolation: y >= 2029 && trough > WC_TROUGH_THRESHOLD,
    });
  }

  // Minimum facility: VAT-bridge peak rounded up to nearest €50k.
  const vatBridgePeak = Math.max(0, ...quarters.map((q) => q.vatBridgeBalance ?? 0));
  const minimumFacility = Math.ceil(vatBridgePeak / 50_000) * 50_000;

  return { active: true, effectiveFacility, minimumFacility, rate, quarters, annual };
}
