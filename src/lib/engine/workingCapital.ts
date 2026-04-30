// ============================================================
// Working Capital — quarterly schedule, annual aggregates
// ============================================================
//
// Models the revolving WC facility at quarterly granularity (Q1-Q4 each year)
// then aggregates to annual peak / trough / average / interest expense for the
// engine's annual P&L contract.
//
// Schedule (default Realistic):
//   • Q3-2027 → Q2-2028: pre-opening draw, €50K/quarter (×4 = €200K total)
//   • Q3-2028 (peak season): self-liquidating repay of pre-opening balance
//   • Q4-2028: seasonal draw €150K + Y2 ramp buffer top-up €100K
//   • Q1-2029, Q2-2029: balance carries
//   • Q3-2029: self-liquidating repay
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
  rate: number;
  quarters: WorkingCapitalQuarter[];
  annual: Map<number, AnnualWCAggregate>;
}

const EMPTY_SCHEDULE: WorkingCapitalSchedule = {
  active: false,
  effectiveFacility: 0,
  rate: 0,
  quarters: [],
  annual: new Map(),
};

export function computeWorkingCapital(
  params: WorkingCapitalParams,
  termRate: number,
  startYear: number,
  endYear: number,
  isDownside: boolean = false
): WorkingCapitalSchedule {
  if (!params.active) return EMPTY_SCHEDULE;

  const rate = termRate + params.spreadOverTermRate;
  const dsraLock = params.dsraConversionEnabled ? params.dsraLockAmount : 0;
  const effectiveFacility = Math.max(0, params.facilitySize - dsraLock);

  const seasonalMult = isDownside ? DOWNSIDE_FACTORS.wcSeasonalDrawMultiplier : 1;
  const repaymentRatio = isDownside ? DOWNSIDE_FACTORS.wcRepaymentRatio : 1;
  const seasonalDraw = params.seasonalDrawPerCycle * seasonalMult;

  const preOpenPerQuarter = params.preOpeningTotalDraw / 4;

  const quarters: WorkingCapitalQuarter[] = [];
  let balance = 0;

  const QUARTERS: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];
  for (let y = startYear; y <= endYear; y++) {
    for (const q of QUARTERS) {
      const opening = balance;
      let draws = 0;
      let repayments = 0;

      // Pre-opening draws: Q3-2027, Q4-2027, Q1-2028, Q2-2028.
      const isPreOpenQuarter =
        (y === 2027 && (q === 3 || q === 4)) ||
        (y === 2028 && (q === 1 || q === 2));
      if (isPreOpenQuarter) {
        draws += preOpenPerQuarter;
      }

      // Seasonal draw: Q4 of every operational year (2028+).
      if (y >= 2028 && q === 4) {
        draws += seasonalDraw;
      }

      // Y2 ramp buffer top-up: drawn alongside Q4-2028 seasonal cycle.
      if (y === 2028 && q === 4) {
        draws += params.y2RampBufferTopup;
      }

      // Self-liquidating repayment: Q3 each operational year.
      if (params.selfLiquidating && y >= 2028 && q === 3) {
        repayments = opening * repaymentRatio;
      }

      const closing = opening + draws - repayments;
      const avgQ = (opening + closing) / 2;
      const interestAccrual = avgQ * (rate / 4);

      quarters.push({
        year: y,
        quarter: q,
        openingBalance: opening,
        draws,
        repayments,
        closingBalance: closing,
        interestAccrual,
      });

      balance = closing;
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
      selfLiquidatingViolation: y >= 2028 && trough > WC_TROUGH_THRESHOLD,
    });
  }

  return { active: true, effectiveFacility, rate, quarters, annual };
}
