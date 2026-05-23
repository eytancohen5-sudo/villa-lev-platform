// ============================================================
// VILLA LEV GROUP — Cap-Table Waterfall (3-Layer Founder Model)
// ============================================================
//
// Wraps the spec-driven `founderWaterfall` engine to produce per-stakeholder
// distributions, IRR, MOIC, and equity payback.
//
// The economics are determined by a single founder economic % derived from:
//   Layer A  Pari-passu (= founder cash / total equity raised)
//   Layer B  Grant landing bonus (+4% if grant approved)
//   Layer C  Performance ratchet at exit (0 / 5 / 9 / 19 / 29 or 33%)
// Subject to two hard caps protecting investors:
//   • grant + ratchet ≤ +33%   (earned cap)
//   • pari-passu + earned ≤ 75% (investors keep ≥ 25%)
//
// Each year:
//   founder cash      = founderTotalPct × project distribution
//   per-investor cash = (investor cashIn / non-founder total)
//                       × investorTotalPct × project distribution
//
// All cap-table calculations across the app derive from `computeCapTable`.

import { ScenarioOutput } from './types';
import {
  resolveFounderWaterfall,
  FounderStakeBreakdown,
  ResolveOptions,
} from './founderWaterfall';

// Newton-Raphson IRR — local copy; identical math to founderWaterfall.ts but
// kept here so the cap-table module is self-contained.
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
  const fLo0 = npv(lo, cashFlows);
  const fHi0 = npv(hi, cashFlows);
  if (fLo0 * fHi0 > 0) return 0;
  let fLo = fLo0;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, cashFlows);
    if (Math.abs(fMid) < 1e-6) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

export interface CapTableStakeholder {
  id: string;
  name: string;
  cashIn: number;
  // Founder/sponsor. Exactly one stakeholder should be flagged; the
  // founderWaterfall engine treats this person's cash as Layer A pari-passu
  // and applies grant bonus + ratchet on top.
  isPromoter?: boolean;   // (legacy field name — kept for storage compat)
  // Legacy field, no longer drives the engine. Retained so old localStorage
  // entries deserialise without TS errors.
  isCoInvest?: boolean;
  notes?: string;
  // When true, cashIn is derived at render time as
  //   max(0, equityRequired − Σ(other stakeholders' cashIn))
  // so the cap table always sums to the model's equity requirement.
  // The page resolves this before calling computeCapTable; the stored
  // cashIn is a stale hint only.
  autoBalance?: boolean;
}

export interface WaterfallParams {
  // Developer/promote equity granted at inception (configurable, default 25%).
  // Applied to operating distributions only; exit reverts to pari-passu.
  developerEquityPct?: number;
  // Reserved. Legacy `promoterEquityRate`, `preferredReturnRate`,
  // `ppShareAbovePref`, `coInvestRepaymentYear` are ignored.
  reserved?: never;
}

export interface StakeholderYearDistribution {
  year: number;
  // For the founder this splits the total into its layers:
  //   pariPassuShare         — exit pari-passu + any ops pari-passu above dev equity
  //   developerEquityShare   — developer/promote equity (operations only)
  //   grantBonusShare        — Layer B grant bonus (operations only)
  //   performanceRatchetShare— Layer C ratchet (operations only)
  // For investors only `investorDistribution` is non-zero.
  pariPassuShare: number;
  developerEquityShare: number;
  grantBonusShare: number;
  performanceRatchetShare: number;
  investorDistribution: number;
  totalCashFlow: number;
}

export interface StakeholderResult {
  stakeholder: CapTableStakeholder;
  // For investors: cashIn / totalNonFounderCash. For founder: 0 (their
  // economic share is the layered founderTotalPct, not a PP fraction).
  ppFraction: number;
  // For investors: investorTotalPct × ppFraction; for founder: founderTotalPct.
  economicStake: number;
  yearly: StakeholderYearDistribution[];
  totalReceived: number;
  netProfit: number;
  moic: number;
  irr: number;
  paybackYear: number | null;
}

export interface CapTableResult {
  // 3-layer founder breakdown (the canonical waterfall output).
  founderBreakdown: FounderStakeBreakdown;
  iterations: number;
  converged: boolean;
  // Per-stakeholder per-year cash flows + aggregate metrics.
  stakeholders: StakeholderResult[];
  // Reconciliation: should equal project distributable (after fees).
  totalProjectDistributable: number;
  totalDistributed: number;
  reconciliationError: number;
  // Aggregate investor metrics (drove tier selection).
  investorIRR: number;
  investorMOIC: number;
  totalNonFounderCash: number;
  totalEquityRaised: number;
  founderCashInvested: number;
  grantApproved: boolean;
  // ── v2: derivation + fee totals (surfaced in UI + Excel) ─────────
  totalFounderManCoFee: number;
  totalDeferredAdvisoryFee: number;
}

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

export function computeCapTable(
  scenario: ScenarioOutput,
  stakeholders: CapTableStakeholder[],
  _params: WaterfallParams,
  options?: { grantApproved?: boolean } & ResolveOptions,
): CapTableResult {
  const founder = stakeholders.find((s) => s.isPromoter);
  const founderCash = founder?.cashIn ?? 0;
  const totalEquity = stakeholders.reduce((s, sh) => s + sh.cashIn, 0);
  const totalNonFounderCash = Math.max(0, totalEquity - founderCash);
  const grantApproved = options?.grantApproved ?? false;

  const resolved = resolveFounderWaterfall(
    scenario,
    founderCash,
    totalEquity,
    grantApproved,
    {
      grantAmount: options?.grantAmount,
      founderFeePct: options?.founderFeePct,
      consultantSharePct: options?.consultantSharePct,
      projectAssetValue: options?.projectAssetValue,
      bankLoanAmount: options?.bankLoanAmount,
      founderManCoFeeRate: options?.founderManCoFeeRate,
      loanDisbursementYear: options?.loanDisbursementYear,
      developerEquityPct: _params.developerEquityPct,
    },
  );
  const b = resolved.breakdown;

  // Each non-founder gets (cashIn / totalNonFounderCash) of the investor pool.
  const investorPoolFrac = (sh: CapTableStakeholder) =>
    !sh.isPromoter && totalNonFounderCash > 0 ? sh.cashIn / totalNonFounderCash : 0;

  // Per-stakeholder yearly distributions.
  const yearlyByStakeholder: Record<string, StakeholderYearDistribution[]> = {};
  stakeholders.forEach((sh) => {
    yearlyByStakeholder[sh.id] = [];
  });

  let projectDistributable = 0;
  resolved.yearly.forEach((y) => {
    projectDistributable += y.totalDistribution;

    // ── Founder layer split ──────────────────────────────────────────
    // Use y.founderShare (correctly split by operating vs exit rates) as
    // the canonical total to avoid double-counting the developer equity gap.
    const total = y.founderShare;

    const opShare = y.operatingDistribution;
    const exitShare = y.exitDistribution;

    // Developer equity and pari-passu are ADDITIVE — two distinct entitlements
    // that both apply to operations and exit. Only the ratchet is exit-excluded.
    const founderDevEq = (opShare + exitShare) * b.developerEquityPct;
    const founderPP    = (opShare + exitShare) * b.pariPassuPct;
    const founderGrant = (opShare + exitShare) * b.grantBonusPct;
    // Ratchet: operations ONLY — excluded from exit/sale proceeds.
    const founderRatchet = opShare * b.performanceRatchetPct;

    stakeholders.forEach((sh) => {
      if (sh.isPromoter) {
        yearlyByStakeholder[sh.id].push({
          year: y.year,
          pariPassuShare: founderPP,
          developerEquityShare: founderDevEq,
          grantBonusShare: founderGrant,
          performanceRatchetShare: founderRatchet,
          investorDistribution: 0,
          totalCashFlow: total,
        });
      } else {
        const frac = investorPoolFrac(sh);
        const inv = y.investorShare * frac;
        yearlyByStakeholder[sh.id].push({
          year: y.year,
          pariPassuShare: 0,
          developerEquityShare: 0,
          grantBonusShare: 0,
          performanceRatchetShare: 0,
          investorDistribution: inv,
          totalCashFlow: inv,
        });
      }
    });

  });

  // Build per-stakeholder summaries.
  let totalDistributed = 0;
  const results: StakeholderResult[] = stakeholders.map((sh) => {
    const yearly = yearlyByStakeholder[sh.id];
    const totalReceived = yearly.reduce((s, y) => s + y.totalCashFlow, 0);
    totalDistributed += totalReceived;

    const cfStream = [-sh.cashIn, ...yearly.map((y) => y.totalCashFlow)];
    const irrVal = sh.cashIn > 0 ? irrNewton(cfStream) : 0;
    const moic = sh.cashIn > 0 ? totalReceived / sh.cashIn : 0;
    const netProfit = totalReceived - sh.cashIn;

    let cum = 0;
    let paybackYear: number | null = null;
    for (const y of yearly) {
      cum += y.totalCashFlow;
      if (paybackYear === null && cum >= sh.cashIn) {
        paybackYear = y.year;
        break;
      }
    }

    const ppFraction = sh.isPromoter ? 0 : investorPoolFrac(sh);
    const economicStake = sh.isPromoter
      ? b.founderTotalPct
      : b.investorTotalPct * ppFraction;

    return {
      stakeholder: sh,
      ppFraction,
      economicStake,
      yearly,
      totalReceived: safe(totalReceived),
      netProfit: safe(netProfit),
      moic: safe(moic),
      irr: safe(irrVal),
      paybackYear,
    };
  });

  return {
    founderBreakdown: b,
    iterations: resolved.iterations,
    converged: resolved.converged,
    stakeholders: results,
    totalProjectDistributable: safe(projectDistributable),
    totalDistributed: safe(totalDistributed),
    reconciliationError: safe(totalDistributed - projectDistributable),
    investorIRR: safe(resolved.investorIRR),
    investorMOIC: safe(resolved.investorMOIC),
    totalNonFounderCash,
    totalEquityRaised: totalEquity,
    founderCashInvested: founderCash,
    grantApproved,
    totalFounderManCoFee: safe(resolved.totalFounderManCoFee),
    totalDeferredAdvisoryFee: safe(resolved.totalDeferredAdvisoryFee),
  };
}

// ── Defaults ──────────────────────────────────────────────────────────

export const DEFAULT_CAP_TABLE: CapTableStakeholder[] = [
  {
    id: 'eytan',
    name: 'Eytan (Founder)',
    cashIn: 200000,
    isPromoter: true,
    notes: 'Pari-passu + grant bonus + performance ratchet',
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
  {
    id: 'equity-balance',
    name: 'Equity Investor',
    cashIn: 0,
    autoBalance: true,
    notes: 'Auto-fills remaining equity gap — cashIn = equityRequired − Σ others',
  },
];

export const DEFAULT_WATERFALL: WaterfallParams = {
  developerEquityPct: 0.25,
};
