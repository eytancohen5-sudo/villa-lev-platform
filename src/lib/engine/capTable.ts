// ============================================================
// VILLA LEV GROUP — Cap-Table Waterfall Engine
// ============================================================
//
// Computes per-stakeholder cash flows, IRR, MOIC, and equity payback
// against the project NCF stream produced by the main model.
//
// Waterfall (each operating year + exit):
//   1. Bank gets paid — already netted from NCF before this module runs.
//   2. Tax paid — already netted from NCF.
//   3. OpCo fees paid — already inside OPEX in EBITDA → flows to Eytan via the
//      separate "founder compensation" track, not the equity distributions.
//   4. Founder co-invest returned in `coInvestRepaymentYear` (one-time).
//   5. 8% preferred return paid pro-rata to pari-passu equity holders on their
//      *remaining* contributed capital each year.
//   6. Excess: 70% to pari-passu pool / 30% to sponsor (promoter equity carry).
//   7. Plus: promoter equity (e.g. 25%) gets that fraction of every
//      distribution off the top, pre-pref — represents Eytan's free carry for
//      being the deal sponsor.
//
// Naming convention: PP = pari-passu (cash-invested equity). PROM = promoter.

import { ScenarioOutput } from './types';

// Newton-Raphson IRR — local copy to avoid coupling to model.ts internals.
function npv(rate: number, cashFlows: number[]): number {
  let total = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    total += cashFlows[t] / Math.pow(1 + rate, t);
  }
  return total;
}
function irrNewton(cashFlows: number[], guess = 0.1): number {
  const hasNeg = cashFlows.some((cf) => cf < 0);
  const hasPos = cashFlows.some((cf) => cf > 0);
  if (!hasNeg || !hasPos) return 0;
  let r = guess;
  for (let i = 0; i < 200; i++) {
    const f = npv(r, cashFlows);
    const dr = 1e-6;
    const fPrime = (npv(r + dr, cashFlows) - f) / dr;
    if (Math.abs(fPrime) < 1e-14) break;
    const newR = r - f / fPrime;
    if (!isFinite(newR)) break;
    if (Math.abs(newR - r) < 1e-9) return newR;
    r = newR;
  }
  let lo = -0.99;
  let hi = 5.0;
  let fLo = npv(lo, cashFlows);
  let fHi = npv(hi, cashFlows);
  if (fLo * fHi > 0) return 0;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, cashFlows);
    if (Math.abs(fMid) < 1e-6) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
    void fHi;
  }
  return (lo + hi) / 2;
}

export interface CapTableStakeholder {
  id: string;
  name: string;
  // Cash invested in the pari-passu pool. Eytan's co-invest sits here too.
  cashIn: number;
  // True for the founder/sponsor — gets the promoter-equity carry on top of
  // their pari-passu economics. Exactly one stakeholder should be flagged.
  isPromoter?: boolean;
  // True if this stakeholder's cash is co-invest that gets returned at
  // `coInvestRepaymentYear` (typically the founder).
  isCoInvest?: boolean;
  // Optional notes for display (e.g. "PP repaid at launch").
  notes?: string;
}

export interface WaterfallParams {
  // Promoter equity % — the sponsor's free carry on every distribution
  // before pari-passu economics apply. Default 25%.
  promoterEquityRate: number;
  // Annual preferred return paid to pari-passu cash before promote. Default 8%.
  preferredReturnRate: number;
  // Above pref, fraction going to pari-passu pool (the rest goes to sponsor).
  // Default 0.70 (70% LP / 30% sponsor).
  ppShareAbovePref: number;
  // Year the founder's co-invest is repaid. Default 2028 (hotel launch).
  coInvestRepaymentYear: number;
}

export interface StakeholderYearDistribution {
  year: number;
  // Cumulative co-invest principal returned this year (only > 0 in repay yr).
  coInvestReturn: number;
  // Pref return earned and paid in this year (8% × outstanding PP capital).
  preferredReturn: number;
  // Promote / promoter equity off-the-top share.
  promoterDraw: number;
  // Excess split (PP pool share for this holder).
  ppExcessShare: number;
  // Sponsor catch on excess.
  sponsorCatch: number;
  // Total cash flow to this stakeholder in this year.
  totalCashFlow: number;
}

export interface StakeholderResult {
  stakeholder: CapTableStakeholder;
  // Pari-passu fraction within the PP class (= cashIn / sum of PP cashIn).
  ppFraction: number;
  // Total economic stake — counts promoter equity + PP share × (1 - promRate).
  economicStake: number;
  // Year-by-year cash flow (negative t=0 = capital call; positives = distributions).
  yearly: StakeholderYearDistribution[];
  // Aggregate metrics over the project life.
  totalReceived: number;
  netProfit: number;
  moic: number;
  irr: number;
  paybackYear: number | null;
}

export interface CapTableResult {
  stakeholders: StakeholderResult[];
  // Reconciliation: total distributed across stakeholders should equal
  // project distributable cash (sum of positive NCFs + terminal equity).
  totalProjectDistributable: number;
  totalDistributed: number;
  reconciliationError: number; // distributed − project (should be ≈ 0)
}

// ── Helpers ─────────────────────────────────────────────────────────────

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

// ── Main: compute the full waterfall and per-stakeholder returns ──────

export function computeCapTable(
  scenario: ScenarioOutput,
  stakeholders: CapTableStakeholder[],
  params: WaterfallParams,
): CapTableResult {
  const exitYear = scenario.exitYear;
  const promRate = params.promoterEquityRate;
  const prefRate = params.preferredReturnRate;
  const ppShare = params.ppShareAbovePref;

  // Truncate the PnL to the exit year.
  const pnlAll = scenario.pnl;
  const exitIdx = pnlAll.findIndex((p) => p.year === exitYear);
  const pnl = exitIdx >= 0 ? pnlAll.slice(0, exitIdx + 1) : pnlAll;

  const promoter = stakeholders.find((s) => s.isPromoter);
  const ppTotal = stakeholders.reduce((s, sh) => s + sh.cashIn, 0);

  // Per-stakeholder PP fraction (zero-safe).
  const ppFraction = (sh: CapTableStakeholder): number =>
    ppTotal > 0 ? sh.cashIn / ppTotal : 0;

  // Per-stakeholder economic stake:
  //   promoter: promRate + (1 - promRate) × ppFraction
  //   non-promoter: (1 - promRate) × ppFraction
  const economicStake = (sh: CapTableStakeholder): number =>
    (sh.isPromoter ? promRate : 0) + (1 - promRate) * ppFraction(sh);

  // Outstanding PP capital balance per stakeholder. Decreases as pref accrues
  // and as principal is "returned" (simple model: pref accrues on the original
  // basis throughout; principal is repaid only via the residual exit lump).
  // For this initial implementation we accrue pref on the ORIGINAL basis each
  // year (i.e. no amortising of basis). Reasonable simplification for a
  // 10-year hold with terminal liquidity.
  const ppBasis: Record<string, number> = {};
  stakeholders.forEach((sh) => {
    ppBasis[sh.id] = sh.cashIn;
  });
  // Co-invest is special: founder's cash is returned at coInvestRepaymentYear
  // and from then on pref accrues only on their remaining (zero) basis.
  // Track that separately.
  const coInvestActive: Record<string, boolean> = {};
  stakeholders.forEach((sh) => {
    coInvestActive[sh.id] = !!sh.isCoInvest;
  });

  // Pre-allocate per-stakeholder yearly rows.
  const yearlyByStakeholder: Record<string, StakeholderYearDistribution[]> = {};
  stakeholders.forEach((sh) => {
    yearlyByStakeholder[sh.id] = [];
  });

  // Walk each year of the truncated PnL, distributing NCF + (at exit) the
  // terminal equity proceeds via the waterfall.
  let projectDistributable = 0;

  pnl.forEach((p, i) => {
    const isExit = i === pnl.length - 1;
    let cashIn = Math.max(0, p.netCashFlowPostVAT);
    if (isExit) {
      cashIn += scenario.terminalEquityValue;
    }
    projectDistributable += cashIn;

    // Empty year — push zero rows.
    if (cashIn <= 0) {
      stakeholders.forEach((sh) => {
        yearlyByStakeholder[sh.id].push({
          year: p.year,
          coInvestReturn: 0,
          preferredReturn: 0,
          promoterDraw: 0,
          ppExcessShare: 0,
          sponsorCatch: 0,
          totalCashFlow: 0,
        });
      });
      return;
    }

    let remaining = cashIn;

    // Step 1: Co-invest return at the repayment year.
    const coInvestThisYear: Record<string, number> = {};
    if (p.year === params.coInvestRepaymentYear) {
      stakeholders.forEach((sh) => {
        if (coInvestActive[sh.id] && sh.cashIn > 0 && remaining > 0) {
          const pay = Math.min(sh.cashIn, remaining);
          coInvestThisYear[sh.id] = pay;
          remaining -= pay;
          coInvestActive[sh.id] = false; // repaid
        }
      });
    }

    // Step 2: Promoter draw — promRate × remaining off the top.
    const promoterDraw = promoter ? remaining * promRate : 0;
    remaining -= promoterDraw;

    // Step 3: Preferred return on outstanding PP capital (active = cash basis
    // still in the deal). Repaid co-invest no longer accrues pref.
    const prefByStakeholder: Record<string, number> = {};
    let prefDemand = 0;
    stakeholders.forEach((sh) => {
      const stillIn = coInvestActive[sh.id] ? sh.cashIn : (sh.isCoInvest ? 0 : sh.cashIn);
      prefByStakeholder[sh.id] = stillIn * prefRate;
      prefDemand += prefByStakeholder[sh.id];
    });

    // If remaining < prefDemand, pay pro-rata; otherwise pay full pref and
    // continue to excess split.
    const prefPaymentScale = prefDemand > 0 ? Math.min(1, remaining / prefDemand) : 0;
    const prefByStakeholderPaid: Record<string, number> = {};
    stakeholders.forEach((sh) => {
      prefByStakeholderPaid[sh.id] = prefByStakeholder[sh.id] * prefPaymentScale;
    });
    const prefPaidTotal = Math.min(remaining, prefDemand);
    remaining -= prefPaidTotal;

    // Step 4: Excess above pref splits ppShare / (1 - ppShare). The ppShare
    // portion divides among PP holders pro-rata to outstanding capital.
    // Non-PP (zero cash) holders get nothing from the PP share.
    let excessPP = 0;
    let excessSponsor = 0;
    if (remaining > 0) {
      excessPP = remaining * ppShare;
      excessSponsor = remaining - excessPP;
    }
    const ppExcessByStakeholder: Record<string, number> = {};
    if (excessPP > 0 && prefDemand > 0) {
      stakeholders.forEach((sh) => {
        const stillIn = coInvestActive[sh.id] ? sh.cashIn : (sh.isCoInvest ? 0 : sh.cashIn);
        const frac = stillIn / (stakeholders.reduce((acc, x) => acc + (coInvestActive[x.id] ? x.cashIn : (x.isCoInvest ? 0 : x.cashIn)), 0) || 1);
        ppExcessByStakeholder[sh.id] = excessPP * frac;
      });
    } else {
      stakeholders.forEach((sh) => {
        ppExcessByStakeholder[sh.id] = 0;
      });
    }

    // Sponsor catch on the (1-ppShare) slice goes entirely to the promoter
    // stakeholder (typically the founder).
    const sponsorCatchByStakeholder: Record<string, number> = {};
    stakeholders.forEach((sh) => {
      sponsorCatchByStakeholder[sh.id] = sh.isPromoter ? excessSponsor : 0;
    });

    stakeholders.forEach((sh) => {
      const coRet = coInvestThisYear[sh.id] ?? 0;
      const pref = prefByStakeholderPaid[sh.id] ?? 0;
      const promDraw = sh.isPromoter ? promoterDraw : 0;
      const ppEx = ppExcessByStakeholder[sh.id] ?? 0;
      const spCat = sponsorCatchByStakeholder[sh.id] ?? 0;
      const total = coRet + pref + promDraw + ppEx + spCat;
      yearlyByStakeholder[sh.id].push({
        year: p.year,
        coInvestReturn: coRet,
        preferredReturn: pref,
        promoterDraw: promDraw,
        ppExcessShare: ppEx,
        sponsorCatch: spCat,
        totalCashFlow: total,
      });
    });
  });

  // Build per-stakeholder summary results.
  let totalDistributed = 0;
  const results: StakeholderResult[] = stakeholders.map((sh) => {
    const yearly = yearlyByStakeholder[sh.id];
    const totalReceived = yearly.reduce((s, y) => s + y.totalCashFlow, 0);
    totalDistributed += totalReceived;

    // IRR: t=0 outflow = cashIn; then per-year distributions.
    const cfStream = [-sh.cashIn, ...yearly.map((y) => y.totalCashFlow)];
    const irrVal = sh.cashIn > 0 ? irrNewton(cfStream) : 0;
    const moic = sh.cashIn > 0 ? totalReceived / sh.cashIn : 0;
    const netProfit = totalReceived - sh.cashIn;

    // Payback: first year cumulative ≥ cashIn.
    let cum = 0;
    let paybackYear: number | null = null;
    for (const y of yearly) {
      cum += y.totalCashFlow;
      if (paybackYear === null && cum >= sh.cashIn) {
        paybackYear = y.year;
        break;
      }
    }

    return {
      stakeholder: sh,
      ppFraction: ppFraction(sh),
      economicStake: economicStake(sh),
      yearly,
      totalReceived: safe(totalReceived),
      netProfit: safe(netProfit),
      moic: safe(moic),
      irr: safe(irrVal),
      paybackYear,
    };
  });

  return {
    stakeholders: results,
    totalProjectDistributable: safe(projectDistributable),
    totalDistributed: safe(totalDistributed),
    reconciliationError: safe(totalDistributed - projectDistributable),
  };
}

// ── Default cap table for Villa Lev ────────────────────────────────────

export const DEFAULT_CAP_TABLE: CapTableStakeholder[] = [
  {
    id: 'eytan',
    name: 'Eytan (Founder)',
    cashIn: 200000,
    isPromoter: true,
    isCoInvest: true,
    notes: 'PP repaid at launch (2028)',
  },
  {
    id: 'inv-a',
    name: 'Investor A (anchor)',
    cashIn: 300000,
  },
  {
    id: 'inv-b',
    name: 'Investor B (anchor)',
    cashIn: 200000,
  },
  {
    id: 'ff',
    name: 'Friends & Family',
    cashIn: 185000,
  },
];

export const DEFAULT_WATERFALL: WaterfallParams = {
  promoterEquityRate: 0.25,
  preferredReturnRate: 0.08,
  ppShareAbovePref: 0.70,
  coInvestRepaymentYear: 2028,
};
