// ============================================================
// VILLA LEV GROUP — Founder Compensation Waterfall
// ============================================================
//
// Encodes the deal structure agreed between sponsor and investors:
//
//   Layer A  Pari-passu cash equity        = founder_cash / total_equity
//   Layer B  Grant landing bonus           = +4% if grant approved, else 0
//   Layer C  Performance ratchet at exit   = 0 (miss) / 9 (pref_met) / 29 (excellent)%
//
// Plus two hard caps that protect investors:
//   • Earned cap:  grant_bonus + ratchet ≤ +33%
//   • Total cap:   pari_passu + earned   ≤ 75%  (investors keep ≥ 25%)
//
// The ratchet trigger depends on *investor* IRR/MOIC at exit, which in turn
// depends on the founder's share. We solve the fixed point by iteration —
// converges in 2–3 rounds for all realistic inputs.

import { ScenarioOutput } from './types';

// ── Constants ──────────────────────────────────────────────────────────

export const EARNED_EQUITY_CAP = 0.33;      // grant_bonus + ratchet
export const TOTAL_FOUNDER_CAP = 0.75;      // pari_passu + earned
export const MIN_INVESTOR_SHARE = 1 - TOTAL_FOUNDER_CAP;

// Bucket 1A — Collateral pledge cap.
// Eytan pledges up to €1M collateral during building phase; documented for
// partners. Admin reference only — not a DCF input.
export const BUCKET_1A_COLLATERAL_CAP = 1_000_000;

// Layer B (grant bonus) is no longer hardcoded — it's *derived* from:
//   gross_fee   = grant × founderFeePct   (10% by default)
//   consultant  = grant × consultantPct   (5% by default → €200K cash out)
//   founder_net = gross_fee − consultant  (5% of grant kept by founder, as equity)
//   post_grant_equity = project_value − bank_loan
//   grant_bonus = founder_net / (post_grant_equity + founder_net)
// At defaults this works out to ≈ 3.92% (vs. the previous hardcoded 4%).
export const DEFAULT_GRANT_AMOUNT = 4_013_880;
/** Bucket 1B — Grant procurement fee (10% of grant). */
export const DEFAULT_GRANT_PROCUREMENT_FEE_PCT = 0.10;
/** Bucket 1B — Grant consultant share (5% of grant → ~€200K cash out). */
export const DEFAULT_GRANT_CONSULTANT_SHARE_PCT = 0.05;
/** @deprecated Use DEFAULT_GRANT_PROCUREMENT_FEE_PCT */
export const DEFAULT_FOUNDER_FEE_PCT = DEFAULT_GRANT_PROCUREMENT_FEE_PCT;
/** @deprecated Use DEFAULT_GRANT_CONSULTANT_SHARE_PCT */
export const DEFAULT_CONSULTANT_SHARE_PCT = DEFAULT_GRANT_CONSULTANT_SHARE_PCT;
export const DEFAULT_PROJECT_ASSET_VALUE = 8_440_000;
// Senior loan used in the Layer B *baseline* — the pre-grant commercial
// financing case. The grant bonus measures the founder's grant-landing
// service against the equity gap that would have existed WITHOUT the grant.
// This keeps Layer B stable as the user toggles between financing paths;
// otherwise switching to the grant path (which lowers the actual senior
// loan) would mechanically shrink the bonus.
export const DEFAULT_BASELINE_BANK_LOAN = 3_540_000;
// Year the consultant cash payment hits the PropCo books (grant approval).
export const DEFAULT_GRANT_APPROVAL_YEAR = 2027;
// Bucket 2A — Base management fee: 5% of gross revenue, subtracted from NCF
// before distributing to equity. Separate from the existing OPEX €90K/yr
// property-management line which covers operational costs (cleaning, accounting).
export const DEFAULT_BASE_MGMT_FEE_RATE = 0.05;
/** @deprecated Use DEFAULT_BASE_MGMT_FEE_RATE */
export const DEFAULT_FOUNDER_MANCO_FEE_RATE = DEFAULT_BASE_MGMT_FEE_RATE;

// Practical advisory limits where the 75% cap starts to bind for the
// default cap-table size. Surfaced as warnings, not hard errors.
export const ADVISORY_FOUNDER_CASH_GRANT = 400_000;
export const ADVISORY_FOUNDER_CASH_NO_GRANT = 700_000;

export type RatchetTier =
  | 'miss'            // IRR < 8% → 0% ratchet (merges old failure + below_pref)
  | 'pref_met'        // 8–22% IRR → +9%
  | 'excellent';      // ≥ 22% IRR → +29% (no-grant differential removed)

export interface RatchetTierDef {
  id: RatchetTier;
  label: string;
  irrMin: number;          // inclusive
  irrMax: number;          // exclusive (Infinity for top tier)
  moicFloor: number;       // sanity check that binds first
  ratchetGrant: number;    // ratchet % when grant approved
  ratchetNoGrant: number;  // ratchet % when grant denied
}

export const RATCHET_TIERS: RatchetTierDef[] = [
  { id: 'miss',      label: 'Miss',      irrMin: -Infinity, irrMax: 0.08,     moicFloor: 0,   ratchetGrant: 0,    ratchetNoGrant: 0 },
  { id: 'pref_met',  label: 'Pref met',  irrMin: 0.08,      irrMax: 0.22,     moicFloor: 2.5, ratchetGrant: 0.09, ratchetNoGrant: 0.09 },
  { id: 'excellent', label: 'Excellent', irrMin: 0.22,      irrMax: Infinity, moicFloor: 6.0, ratchetGrant: 0.29, ratchetNoGrant: 0.29 },
];

export type CapBinding = 'none' | 'earned_33' | 'total_75';

export interface FounderStakeInput {
  founderCashInvested: number;
  totalEquityRaised: number;
  grantApproved: boolean;
  // Inputs that drive the *derived* grant bonus (Layer B). All have
  // module-level defaults — callers can override per-scenario.
  grantAmount?: number;
  founderFeePct?: number;
  consultantSharePct?: number;
  projectAssetValue?: number;
  bankLoanAmount?: number;
  // Iterative IRR/MOIC for tier selection (Layer C).
  investorIRR: number;
  investorMOIC: number;
  // Developer/promote equity granted at inception (separate from cash).
  // Compensates the developer for sourcing, construction management, and
  // pledging collateral. ADDITIVE on top of pari-passu cash returns — the
  // two are distinct entitlements that stack. Both apply to operating
  // distributions AND exit proceeds. Only the ratchet (Layer C) is excluded
  // from exit.
  developerEquityPct?: number;
}

export interface FounderStakeBreakdown {
  pariPassuPct: number;
  // Developer/promote equity granted at inception (from WaterfallParams).
  developerEquityPct: number;
  // Derived from inputs. Tooltip on UI should show:
  //   founder_net_grant_cash / (post_grant_equity + founder_net_grant_cash)
  grantBonusPct: number;
  performanceRatchetPct: number;
  // grant_bonus + ratchet, with ratchet specifically reduced to honour the
  // earned cap (grant bonus is contractual; ratchet flexes).
  earnedPct: number;
  // Founder % applied to OPERATING cash distributions.
  // = max(pariPassu, developerEquity) + earnedPct, capped at 75%.
  founderOperatingPct: number;
  // Founder % applied to EXIT / sale proceeds.
  // = max(pariPassu, developerEquity) + grantBonusPct, capped at 75%.
  // The performance ratchet (Layer C) is the only component excluded from exit.
  founderExitPct: number;
  // Backward-compat alias for founderOperatingPct (used by existing UI/tests).
  founderTotalPct: number;
  investorTotalPct: number;
  capBinding: CapBinding;
  ratchetTier: RatchetTier;
  ratchetTierLabel: string;
  moicFloorReduction: boolean;
  // ── Layer B derivation telemetry (surfaced in UI/Excel) ──────────
  consultantCashPayment: number;     // grant × consultantSharePct
  founderNetGrantCash: number;       // gross_fee − consultant (drives equity bonus — UNCHANGED)
  postGrantEquityValue: number;      // project_value − bank_loan
  // ── Bucket 1B deferred advisory fee (restructured from grant-year) ──
  // Total advisory fee = grant × DEFAULT_GRANT_PROCUREMENT_FEE_PCT (10%).
  // Paid from operating cash flow after loan disbursement; NOT from grant proceeds.
  bucket1B_deferredAdvisoryFee: number;  // total amount (0 if no grant)
  bucket1B_annualPayment: number;        // total / 3 (0 if no grant)
  bucket1B_paymentStartYear: number;     // first payment year (loanDisbursementYear)
}

// ── Tier resolution ────────────────────────────────────────────────────

/**
 * Select the ratchet tier given investor IRR and MOIC. IRR alone picks the
 * tier; the MOIC floor must be met or we drop to the next lower tier
 * (recursively). Prevents quick-exit gaming where a 100% IRR over 1 year
 * with 2× MOIC unlocks the top tier.
 */
function selectTier(irr: number, moic: number, grantApproved: boolean): {
  tier: RatchetTierDef;
  ratchet: number;
  reduced: boolean;
} {
  // Walk tiers high → low. First tier whose IRR band contains `irr` and
  // whose MOIC floor is met, wins. Else drop down.
  let idealIdx = -1;
  for (let i = 0; i < RATCHET_TIERS.length; i++) {
    const t = RATCHET_TIERS[i];
    if (irr >= t.irrMin && irr < t.irrMax) {
      idealIdx = i;
      break;
    }
  }
  if (idealIdx < 0) {
    // Fallback (shouldn't happen given Infinity bounds).
    const t = RATCHET_TIERS[0];
    return { tier: t, ratchet: grantApproved ? t.ratchetGrant : t.ratchetNoGrant, reduced: false };
  }
  for (let i = idealIdx; i >= 0; i--) {
    const t = RATCHET_TIERS[i];
    if (moic >= t.moicFloor) {
      return {
        tier: t,
        ratchet: grantApproved ? t.ratchetGrant : t.ratchetNoGrant,
        reduced: i < idealIdx,
      };
    }
  }
  const t = RATCHET_TIERS[0];
  return { tier: t, ratchet: 0, reduced: true };
}

// ── Stake breakdown (pure function, per spec pseudocode) ───────────────

export function computeFounderStake(input: FounderStakeInput): FounderStakeBreakdown {
  const pariPassu = input.totalEquityRaised > 0
    ? input.founderCashInvested / input.totalEquityRaised
    : 0;

  // ── Layer B derivation (transparent from inputs) ───────────────────
  // Grant success fee structure:
  //   grossFee   = grant × 10%
  //   cashPortion  = 50% of grossFee  → paid to Eytan in cash (deferred, Bucket 1B)
  //   equityPortion = 50% of grossFee → converted to equity at pari-passu valuation
  //   grantBonus = equityPortion / totalEquityRaised   (pari-passu: €/equity pool)
  //
  // The denominator is the total equity raised from investors, NOT the project
  // appraised value — the 50% equity portion is priced at the same rate as
  // every other euro invested in equity.
  const grantAmount = input.grantAmount ?? DEFAULT_GRANT_AMOUNT;
  const founderFeePct = input.founderFeePct ?? DEFAULT_GRANT_PROCUREMENT_FEE_PCT;
  const projectAssetValue = input.projectAssetValue ?? DEFAULT_PROJECT_ASSET_VALUE;
  const bankLoanAmount = input.bankLoanAmount ?? DEFAULT_BASELINE_BANK_LOAN;

  let grantBonus = 0;
  let consultantCash = 0;   // renamed conceptually: this is Eytan's 50% cash fee
  let founderNetCash = 0;   // Eytan's 50% equity portion (drives grantBonus)
  let postGrantEquity = 0;  // retained for display only — no longer in formula
  if (input.grantApproved) {
    const grossFee = grantAmount * founderFeePct;          // 10% × grant
    consultantCash = grossFee * 0.5;                        // 50% cash to Eytan
    founderNetCash = grossFee * 0.5;                        // 50% equity portion
    postGrantEquity = Math.max(0, projectAssetValue - bankLoanAmount); // display only
    // Equity valued pari-passu: fraction = equityPortion / totalEquityRaised
    grantBonus = input.totalEquityRaised > 0
      ? founderNetCash / input.totalEquityRaised
      : 0;
  }

  // ── Bucket 1B deferred advisory fee ──────────────────────────────
  // Only the CASH portion (50% of 10% = 5% of grant) flows through PropCo
  // as a deferred cash payment. The equity portion (50%) is captured in
  // grantBonus above and creates no PropCo cash outflow.
  // Paid from operating cash after loan disbursement over 3 years.
  const deferredAdvisoryFee = input.grantApproved
    ? grantAmount * DEFAULT_GRANT_PROCUREMENT_FEE_PCT * 0.5  // cash half only
    : 0;
  const advisoryAnnual = deferredAdvisoryFee > 0 ? deferredAdvisoryFee / 3 : 0;
  const advisoryStartYear = (input as FounderStakeInput & { loanDisbursementYear?: number }).loanDisbursementYear
    ?? DEFAULT_GRANT_APPROVAL_YEAR + 1;

  // ── Layer C tier selection (unchanged) ─────────────────────────────
  let { tier, ratchet, reduced } = selectTier(input.investorIRR, input.investorMOIC, input.grantApproved);

  // ── Earned cap (33%) — reduce ratchet, preserve grant bonus ────────
  // The grant bonus is contractual (the founder earned it by landing the
  // grant); the ratchet is the flexible portion that absorbs the cap.
  let cap: CapBinding = 'none';
  const earnedRaw = grantBonus + ratchet;
  if (earnedRaw > EARNED_EQUITY_CAP + 1e-9) {
    ratchet = Math.max(0, EARNED_EQUITY_CAP - grantBonus);
    cap = 'earned_33';
  } else if (Math.abs(earnedRaw - EARNED_EQUITY_CAP) < 1e-9) {
    cap = 'earned_33';
  }
  let earned = Math.min(grantBonus + ratchet, EARNED_EQUITY_CAP);

  // ── Developer equity (additive on top of pari-passu) ──────────────
  // Developer equity (promote) and pari-passu (cash returns) are two
  // separate entitlements — they stack, not substitute.
  //   • pari-passu      = cash return proportional to cash invested
  //   • developerEquity = promote for sourcing, construction, collateral
  // Both apply to operations AND exit; only the ratchet is exit-excluded.
  const developerEquity = input.developerEquityPct ?? 0;
  const operationalBase = pariPassu + developerEquity;  // additive

  // ── Total cap (75%) on OPERATING rate — reduce earned if needed ─────
  let operatingTotal = operationalBase + earned;
  if (operatingTotal > TOTAL_FOUNDER_CAP + 1e-9) {
    earned = Math.max(0, TOTAL_FOUNDER_CAP - operationalBase);
    if (earned < 0) earned = 0;
    operatingTotal = operationalBase + earned;
    if (operatingTotal > TOTAL_FOUNDER_CAP) operatingTotal = TOTAL_FOUNDER_CAP;
    cap = 'total_75';
  }

  const founderOperatingPct = operatingTotal;
  // Exit: developer equity + grant bonus apply, but NOT the ratchet.
  // The ratchet is the only performance component excluded from sale proceeds.
  const founderExitPct = Math.min(TOTAL_FOUNDER_CAP, operationalBase + grantBonus);

  return {
    pariPassuPct: pariPassu,
    developerEquityPct: developerEquity,
    grantBonusPct: input.grantApproved ? grantBonus : 0,
    performanceRatchetPct: ratchet,
    earnedPct: earned,
    founderOperatingPct,
    founderExitPct,
    founderTotalPct: founderOperatingPct,   // backward-compat alias
    investorTotalPct: 1 - founderOperatingPct,
    capBinding: cap,
    ratchetTier: tier.id,
    ratchetTierLabel: tier.label,
    moicFloorReduction: reduced,
    consultantCashPayment: consultantCash,
    founderNetGrantCash: founderNetCash,
    postGrantEquityValue: postGrantEquity,
    bucket1B_deferredAdvisoryFee: deferredAdvisoryFee,
    bucket1B_annualPayment: advisoryAnnual,
    bucket1B_paymentStartYear: advisoryStartYear,
  };
}

// ── Cash-flow level helpers ────────────────────────────────────────────

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
  // Bisection fallback.
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

export interface YearDistribution {
  year: number;
  totalDistribution: number;  // project cash distributable this year (post-fees)
  // Operating vs exit split — used to apply different founder rates.
  // operatingDistribution = post-fee NCF; exitDistribution = terminal equity (exit year only).
  operatingDistribution: number;
  exitDistribution: number;
  founderShare: number;       // founder equity share this year
  investorShare: number;      // total investor share this year
  // ── Per-year fee deductions (informational) ───────────────────────
  founderManCoFee: number;          // Bucket 2A: 5% × revenue (base management fee)
  deferredAdvisoryFeePayment: number; // Bucket 1B: deferred advisory fee instalment (spread over 3 years post-disbursement)
  ncfPreFees: number;               // NCF post-VAT before founder fees subtracted
}

export interface ResolvedFounderWaterfall {
  breakdown: FounderStakeBreakdown;
  // Convergence telemetry.
  iterations: number;
  converged: boolean;
  // Per-year distributions actually realised (post-resolution).
  yearly: YearDistribution[];
  // Investor aggregate metrics derived from the converged split.
  investorIRR: number;
  investorMOIC: number;
  totalNonFounderCash: number;
  totalProjectDistributable: number;
  // Aggregate fee totals (over the projection window, useful for UI).
  totalFounderManCoFee: number;
  totalDeferredAdvisoryFee: number;
}

export interface DistributionStreamOptions {
  // Bucket 2A: 5% of gross revenue — base management fee. Subtracted from
  // NCF before equity distributions, so equity holders see post-fee cash.
  baseMgmtFeeRate?: number;
  /** @deprecated Use baseMgmtFeeRate. Accepted for backward compat. */
  founderManCoFeeRate?: number;
  // Bucket 1B: deferred advisory fee (grant × 10%) paid from operating cash
  // over 3 years starting from loanDisbursementYear. NOT from grant proceeds.
  // Default: (grantApprovalYear ?? DEFAULT_GRANT_APPROVAL_YEAR) + 1.
  loanDisbursementYear?: number;
  // Total Bucket 1B advisory fee to spread; 0 if no grant.
  deferredAdvisoryFee?: number;
}

/**
 * Build the per-year distribution stream from a scenario, subtracting:
 *   • Founder ManCo fee = 5% × gross revenue (annual)          [Bucket 2A]
 *   • Deferred advisory fee = grant × 10% spread equally over
 *     3 years starting from loanDisbursementYear                [Bucket 1B]
 *
 * The Bucket 1B fee is paid from operating cash flow after loan disbursement,
 * NOT deducted from grant proceeds in the grant approval year. This avoids
 * EU GBER rule violations (grant funds must flow to eligible project costs).
 *
 * Result is post-fee cash distributable to equity, used by the waterfall.
 */
export function buildDistributionStream(
  scenario: ScenarioOutput,
  options: DistributionStreamOptions = {},
): YearDistribution[] {
  const feeRate = options.baseMgmtFeeRate ?? (options as { founderManCoFeeRate?: number }).founderManCoFeeRate ?? DEFAULT_BASE_MGMT_FEE_RATE;
  const disbursementYear = options.loanDisbursementYear ?? (DEFAULT_GRANT_APPROVAL_YEAR + 1);
  const totalAdvisoryFee = options.deferredAdvisoryFee ?? 0;
  const annualAdvisoryFee = totalAdvisoryFee > 0 ? totalAdvisoryFee / 3 : 0;
  // Payment years: [disbursementYear, disbursementYear+1, disbursementYear+2]
  const advisoryPaymentYears = new Set([
    disbursementYear,
    disbursementYear + 1,
    disbursementYear + 2,
  ]);

  const exitYear = scenario.exitYear;
  const pnlAll = scenario.pnl;
  const exitIdx = pnlAll.findIndex((p) => p.year === exitYear);
  const pnl = exitIdx >= 0 ? pnlAll.slice(0, exitIdx + 1) : pnlAll;

  return pnl.map((p, i) => {
    const isExit = i === pnl.length - 1;
    const ncfPreFees = Math.max(0, p.netCashFlowPostVAT);
    const manCoFee = Math.max(0, p.totalRevenue) * feeRate;
    const advisoryThisYear = advisoryPaymentYears.has(p.year) ? annualAdvisoryFee : 0;
    // Operating component: post-fee NCF (floored at 0).
    const operatingDistribution = Math.max(0, ncfPreFees - manCoFee - advisoryThisYear);
    // Exit component: terminal equity value, added only at the exit year.
    // Kept separate so the waterfall can apply the developer-equity rate to
    // operating cash while using pari-passu only for the exit proceeds.
    const exitDistribution = isExit ? Math.max(0, scenario.terminalEquityValue) : 0;
    return {
      year: p.year,
      totalDistribution: operatingDistribution + exitDistribution,
      operatingDistribution,
      exitDistribution,
      founderShare: 0,    // populated after waterfall resolves
      investorShare: 0,
      founderManCoFee: manCoFee,
      deferredAdvisoryFeePayment: advisoryThisYear,
      ncfPreFees,
    };
  });
}

export interface ResolveOptions {
  // Layer B derivation inputs (override defaults; usually scenario-specific
  // bank_loan_amount comes from the model's active financing path).
  grantAmount?: number;
  founderFeePct?: number;
  consultantSharePct?: number;
  projectAssetValue?: number;
  bankLoanAmount?: number;
  // Cash-flow stream options (base mgmt fee + deferred advisory fee timing).
  baseMgmtFeeRate?: number;
  /** @deprecated Use baseMgmtFeeRate. Accepted for backward compat. */
  founderManCoFeeRate?: number;
  // First year Bucket 1B deferred advisory fee is paid from operating cash.
  // Default: DEFAULT_GRANT_APPROVAL_YEAR + 1 (i.e., year after grant approval).
  loanDisbursementYear?: number;
  maxIterations?: number;
  // Developer/promote equity granted at inception. See FounderStakeInput.
  developerEquityPct?: number;
}

/**
 * Iterative fixed-point: starting from ratchet = 0, compute investor IRR/
 * MOIC, then re-derive ratchet, repeat until stable. The Layer B grant
 * bonus is derived from the inputs (not hardcoded); the founder's ManCo fee
 * (5% × revenue, Bucket 2A) and Bucket 1B deferred advisory fee (grant × 10%,
 * spread over 3 years from loanDisbursementYear, paid from operating cash —
 * NOT from grant proceeds) are subtracted from the distribution stream before
 * the equity split.
 */
export function resolveFounderWaterfall(
  scenario: ScenarioOutput,
  founderCashInvested: number,
  totalEquityRaised: number,
  grantApproved: boolean,
  options: ResolveOptions = {},
): ResolvedFounderWaterfall {
  const maxIterations = options.maxIterations ?? 8;
  // Bucket 1B deferred advisory fee: only the 50% cash portion of the grant
  // success fee flows through PropCo (grant × 10% × 50% = 5% of grant).
  // The equity 50% is priced into grantBonus and has no PropCo cash outflow.
  const grantAmount = options.grantAmount ?? DEFAULT_GRANT_AMOUNT;
  const deferredAdvisoryFee = grantApproved
    ? grantAmount * DEFAULT_GRANT_PROCUREMENT_FEE_PCT * 0.5
    : 0;
  const disbursementYear = options.loanDisbursementYear ?? (DEFAULT_GRANT_APPROVAL_YEAR + 1);
  const stream = buildDistributionStream(scenario, {
    baseMgmtFeeRate: options.baseMgmtFeeRate ?? (options as { founderManCoFeeRate?: number }).founderManCoFeeRate,
    loanDisbursementYear: disbursementYear,
    deferredAdvisoryFee,
  });
  const totalProject = stream.reduce((s, y) => s + y.totalDistribution, 0);
  const totalFounderManCoFee = stream.reduce((s, y) => s + y.founderManCoFee, 0);
  const totalDeferredAdvisoryFee = stream.reduce((s, y) => s + y.deferredAdvisoryFeePayment, 0);
  const totalNonFounderCash = Math.max(0, totalEquityRaised - founderCashInvested);

  const stakeInputBase = {
    founderCashInvested,
    totalEquityRaised,
    grantApproved,
    grantAmount,
    founderFeePct: options.founderFeePct,
    consultantSharePct: options.consultantSharePct ?? DEFAULT_CONSULTANT_SHARE_PCT,
    projectAssetValue: options.projectAssetValue,
    bankLoanAmount: options.bankLoanAmount,
    loanDisbursementYear: disbursementYear,
    developerEquityPct: options.developerEquityPct,
  };

  // Initial breakdown with ratchet = 0 (i.e. investor IRR = -∞ guess).
  let breakdown = computeFounderStake({
    ...stakeInputBase,
    investorIRR: -1,
    investorMOIC: 0,
  });

  let iterations = 0;
  let converged = false;
  let lastRatchet = breakdown.performanceRatchetPct;
  let investorIRR = 0;
  let investorMOIC = 0;
  // Detect cycles (oscillation between two adjacent tiers when the trigger
  // straddles a band boundary). On cycle, end on the *lower* ratchet to be
  // investor-friendly and flag as converged-by-stabilisation.
  const seen = new Set<string>();
  seen.add(`${breakdown.ratchetTier}|${breakdown.performanceRatchetPct.toFixed(6)}`);

  for (let i = 0; i < maxIterations; i++) {
    iterations = i + 1;
    // Investors get: (1 − founderOperatingPct) of operating distributions
    // and (1 − founderExitPct) of exit proceeds (devEq + grant, no ratchet at exit).
    const investorYearly = stream.map((y) => {
      const opInvestor = y.operatingDistribution * (1 - breakdown.founderOperatingPct);
      const exitInvestor = y.exitDistribution * (1 - breakdown.founderExitPct);
      return opInvestor + exitInvestor;
    });
    const cfStream = [-totalNonFounderCash, ...investorYearly];
    investorIRR = totalNonFounderCash > 0 ? irrNewton(cfStream) : 0;
    const investorTotalReceived = investorYearly.reduce((s, v) => s + v, 0);
    investorMOIC = totalNonFounderCash > 0 ? investorTotalReceived / totalNonFounderCash : 0;

    const nextBreakdown = computeFounderStake({
      ...stakeInputBase,
      investorIRR,
      investorMOIC,
    });
    const nextKey = `${nextBreakdown.ratchetTier}|${nextBreakdown.performanceRatchetPct.toFixed(6)}`;

    if (Math.abs(nextBreakdown.performanceRatchetPct - lastRatchet) < 1e-9) {
      breakdown = nextBreakdown;
      converged = true;
      break;
    }
    if (seen.has(nextKey)) {
      breakdown = nextBreakdown.performanceRatchetPct < lastRatchet ? nextBreakdown : breakdown;
      converged = true;
      break;
    }
    seen.add(nextKey);
    lastRatchet = nextBreakdown.performanceRatchetPct;
    breakdown = nextBreakdown;
  }

  const yearly: YearDistribution[] = stream.map((y) => {
    // Founder: developer equity + grant on both operations and exit; ratchet on operations only.
    const founderShare =
      y.operatingDistribution * breakdown.founderOperatingPct +
      y.exitDistribution * breakdown.founderExitPct;
    return { ...y, founderShare, investorShare: y.totalDistribution - founderShare };
  });

  return {
    breakdown,
    iterations,
    converged,
    yearly,
    investorIRR,
    investorMOIC,
    totalNonFounderCash,
    totalProjectDistributable: totalProject,
    totalFounderManCoFee,
    totalDeferredAdvisoryFee,
  };
}

// ── Advisory / warning helpers ──────────────────────────────────────────

export function advisoryFounderCashLimit(grantApproved: boolean): number {
  return grantApproved ? ADVISORY_FOUNDER_CASH_GRANT : ADVISORY_FOUNDER_CASH_NO_GRANT;
}

export function founderCashExceedsAdvisory(founderCash: number, grantApproved: boolean): boolean {
  return founderCash > advisoryFounderCashLimit(grantApproved);
}
