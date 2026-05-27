// ============================================================
// VILLA LEV GROUP — Founder Compensation Waterfall
// ============================================================
//
// Encodes the deal structure agreed between sponsor and investors:
//
//   Layer A  Pari-passu cash equity        = founder_cash / total_equity
//   Layer B  Grant landing bonus           = +4% if grant approved, else 0
//   Layer C  Performance ratchet at exit   = 0 (miss) / 9 (pref_met) / 10 (excellent)%
//
// Plus two hard caps that protect investors:
//   • Ratchet cap: ratchet ≤ +10%  (standalone; grant bonus and pari-passu are independent)
//   • Total cap:   pari_passu + earned   ≤ 75%  (investors keep ≥ 25%)
//
// The ratchet trigger depends on *investor* IRR/MOIC at exit, which in turn
// depends on the founder's share. We solve the fixed point by iteration —
// converges in 2–3 rounds for all realistic inputs.

import { ScenarioOutput } from './types';
import { PROJECT_CONSTANTS } from './defaults';
import { npv, irrNewton } from './financeUtils';

// ── Constants ──────────────────────────────────────────────────────────

/** Standalone cap on the Layer C performance ratchet. Grant bonus (Layer B) and
 *  pari-passu (Layer A) are not counted against this ceiling — each component is independent. */
export const RATCHET_STANDALONE_CAP = 0.10;
/** @deprecated The combined earned cap (grant_bonus + ratchet ≤ 33%) has been replaced
 *  by RATCHET_STANDALONE_CAP. Kept as a reference constant for legacy Excel cells. */
export const EARNED_EQUITY_CAP = 0.33;
export const TOTAL_FOUNDER_CAP = 0.75;      // pari_passu + earned
export const MIN_INVESTOR_SHARE = 1 - TOTAL_FOUNDER_CAP;
export const GRANT_ROUTE_IRR_THRESHOLD = 0.30;
export const GRANT_ROUTE_EXIT_CAP_BELOW_THRESHOLD = 0.55;

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
export const DEFAULT_GRANT_APPROVAL_YEAR = PROJECT_CONSTANTS.HORIZON_START_YEAR + 1;
/**
 * Default year in which both Aggelakakis's and Eytan's cash portions of the
 * grant success fee are paid from operating cash flow (post-debt-service).
 * Deferred to 2030 to avoid squeezing DSCR in the 2029 ramp year.
 * Configurable via ModelAssumptions.grantSuccessFeePaymentYear.
 */
export const DEFAULT_GRANT_SUCCESS_FEE_PAYMENT_YEAR = 2030;
/**
 * Default fraction of each party's grant success fee paid as cash (remainder = equity).
 * Aggelakakis equity portion = fixed € deducted from exit proceeds before shareholder split.
 * Eytan equity portion = feeds Layer B bonus calculation.
 */
export const DEFAULT_FEE_CASH_SPLIT_PCT = 0.50;
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

export const RATCHET_TIERS: readonly RatchetTierDef[] = [
  { id: 'miss',      label: 'Miss',      irrMin: -Infinity, irrMax: 0.08,     moicFloor: 0,   ratchetGrant: 0,    ratchetNoGrant: 0 },
  { id: 'pref_met',  label: 'Pref met',  irrMin: 0.08,      irrMax: 0.22,     moicFloor: 2.5, ratchetGrant: 0.09, ratchetNoGrant: 0.09 },
  { id: 'excellent', label: 'Excellent', irrMin: 0.22,      irrMax: Infinity, moicFloor: 6.0, ratchetGrant: 0.10, ratchetNoGrant: 0.10 },
];

export interface DealTermsConfig {
  /** € agreed reference grant amount. Intentionally stable — NOT linked to live model output.
   *  Changing this does not recompute CAPEX or engine DSCR.
   *  @see DEFAULT_GRANT_AMOUNT for provenance (60% × non-plot eligible costs) */
  grantAmount: number;
  /** Decimal. Total success fee as % of grant (default 0.10 = 10%).
   *  Effective ceiling: raising this above ~0.10 causes grantBonusPct to approach
   *  EARNED_EQUITY_CAP (0.33), collapsing the Layer C ratchet toward zero.
   *  Do not set above 0.15 without reviewing EARNED_EQUITY_CAP arithmetic. */
  grantProcurementFeePct: number;
  /** € reference property appraisal at deal inception. Display-only — not in the Layer B formula. */
  projectAssetValue: number;
  /** € ghost commercial loan for Layer B stability across financing-path toggles.
   *  Source: commercial-path loan from BASE_CASE at deal-inception CAPEX. */
  baselineBankLoan: number;
  /** Calendar year of TEPIX III grant approval. Drives Bucket 1B payment timing.
   *  Default = HORIZON_START_YEAR + 1. Must match tepix/milestones.yaml disbursement schedule. */
  grantApprovalYear: number;
  /** Decimal. Base management fee on gross revenue (default 0.05 = 5%). */
  baseMgmtFeeRate: number;
  /** Layer C ratchet tiers. Contractual-grade — do not dial without legal review.
   *  NOTE: irrMin = -Infinity and irrMax = Infinity are JavaScript sentinels; they cannot
   *  be stored in Firestore without substitution (JSON.stringify produces null). */
  ratchetTiers: readonly RatchetTierDef[];
}

export const DEFAULT_DEAL_TERMS: DealTermsConfig = {
  grantAmount:            DEFAULT_GRANT_AMOUNT,
  grantProcurementFeePct: DEFAULT_GRANT_PROCUREMENT_FEE_PCT,
  projectAssetValue:      DEFAULT_PROJECT_ASSET_VALUE,
  baselineBankLoan:       DEFAULT_BASELINE_BANK_LOAN,
  grantApprovalYear:      DEFAULT_GRANT_APPROVAL_YEAR,
  baseMgmtFeeRate:        DEFAULT_BASE_MGMT_FEE_RATE,
  ratchetTiers:           RATCHET_TIERS,
};

export type CapBinding = 'none' | 'ratchet_10' | 'total_75' | 'exit_55_grant';

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
  /**
   * Year in which both parties' cash portions of the grant success fee are paid.
   * Defaults to DEFAULT_GRANT_SUCCESS_FEE_PAYMENT_YEAR (2030).
   * Deferred to avoid squeezing DSCR in the 2029 ramp year.
   */
  grantSuccessFeePaymentYear?: number;
  /**
   * Fraction of each party's grant success fee paid as cash (0–1).
   * Remainder is treated as equity: Aggelakakis equity → deducted from exit proceeds;
   * Eytan equity → feeds Layer B bonus.
   * Default: DEFAULT_FEE_CASH_SPLIT_PCT (0.50).
   */
  feeCashSplitPct?: number;
  /** @deprecated Use grantSuccessFeePaymentYear instead. */
  bucket1BPaymentStartYear?: number;
  /** @deprecated Use grantSuccessFeePaymentYear instead. */
  loanDisbursementYear?: number;
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
  // True when the 55% grant exit cap fires (grantApproved + investor IRR < 30%).
  grantExitCapActive: boolean;
  // Backward-compat alias for founderOperatingPct (used by existing UI/tests).
  founderTotalPct: number;
  investorTotalPct: number;
  capBinding: CapBinding;
  ratchetTier: RatchetTier;
  ratchetTierLabel: string;
  moicFloorReduction: boolean;
  // ── Grant success fee breakdown (Bucket 1B) ──────────────────────
  // Total fee = grant × 10%, split between Aggelakakis (consultant) and Eytan (founder).
  // Each party's share is further split cash/equity per feeCashSplitPct.
  //   Aggelakakis cash  → paid from operating cash in grantSuccessFeePaymentYear
  //   Aggelakakis equity → fixed € deducted from exit proceeds before shareholder split
  //   Eytan cash        → paid from operating cash in grantSuccessFeePaymentYear
  //   Eytan equity      → feeds Layer B grantBonusPct calculation
  aggelakakisCash: number;          // Aggelakakis's cash portion (0 if no grant)
  aggelakakisEquityAtExit: number;  // EUR input used to derive aggelakakisEquityPct (kept for backward compat)
  /** % stake at inception — mirrors grantBonusPct for Eytan. Rides full waterfall (ops + exit). */
  aggelakakisEquityPct: number;
  eytan1BCash: number;              // Eytan's cash portion, Bucket 1B (0 if no grant)
  grantSuccessFeePaymentYear: number; // year cash portions are paid
  // Layer B telemetry (preserved for tooltips / Excel)
  founderNetGrantCash: number;       // Eytan's equity portion = input to grantBonusPct
  postGrantEquityValue: number;      // project_value − bank_loan (display only)
  /** @deprecated — use aggelakakisCash. Was: grant × consultantSharePct. */
  consultantCashPayment: number;
  /** @deprecated — use eytan1BCash. Was 3-yr spread. */
  bucket1B_deferredAdvisoryFee: number;
  /** @deprecated */
  bucket1B_annualPayment: number;
  /** @deprecated */
  bucket1B_paymentStartYear: number;
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

  // ── Grant success fee (Bucket 1B) — party split ──────────────────
  // Total fee = grant × founderFeePct (10%).
  // Party split: Aggelakakis (consultant) = consultantSharePct × grant (default 5%);
  //              Eytan (founder)          = remainder (default 5%).
  // Cash/equity split within each party: cashSplit% cash, (1−cashSplit)% equity.
  //   Aggelakakis cash        → paid from operating cash in grantSuccessFeePaymentYear
  //   Aggelakakis equity      → fixed € deducted from exit proceeds before shareholder split
  //   Eytan cash (Bucket 1B)  → paid from operating cash in grantSuccessFeePaymentYear
  //   Eytan equity            → feeds Layer B grantBonusPct calculation
  const grantAmount = input.grantAmount ?? DEFAULT_GRANT_AMOUNT;
  const founderFeePct = input.founderFeePct ?? DEFAULT_GRANT_PROCUREMENT_FEE_PCT;
  const projectAssetValue = input.projectAssetValue ?? DEFAULT_PROJECT_ASSET_VALUE;
  const bankLoanAmount = input.bankLoanAmount ?? DEFAULT_BASELINE_BANK_LOAN;
  const cashSplit = input.feeCashSplitPct ?? DEFAULT_FEE_CASH_SPLIT_PCT;
  const paymentYear = input.grantSuccessFeePaymentYear
    ?? input.bucket1BPaymentStartYear
    ?? DEFAULT_GRANT_SUCCESS_FEE_PAYMENT_YEAR;

  let grantBonus = 0;
  let aggelakakisCash = 0;
  let aggelakakisEquityAtExit = 0;
  let eytan1BCash = 0;
  let founderNetCash = 0;   // Eytan's equity portion → Layer B
  let postGrantEquity = 0;  // display only

  if (input.grantApproved) {
    const grossFee = grantAmount * founderFeePct;                      // 10% × grant
    const consultantShare = input.consultantSharePct ?? DEFAULT_GRANT_CONSULTANT_SHARE_PCT;
    const aggelakakisTotal = grantAmount * consultantShare;            // default 5% of grant
    const eytanTotal = grossFee - aggelakakisTotal;                    // default 5% of grant

    aggelakakisCash       = aggelakakisTotal * cashSplit;              // default 2.5%
    aggelakakisEquityAtExit = aggelakakisTotal * (1 - cashSplit);      // default 2.5%
    eytan1BCash           = eytanTotal * cashSplit;                    // default 2.5%
    founderNetCash        = eytanTotal * (1 - cashSplit);              // default 2.5% → Layer B

    postGrantEquity = Math.max(0, projectAssetValue - bankLoanAmount); // display only
    // Layer B: Eytan's equity portion priced pari-passu against total equity raised.
    grantBonus = input.totalEquityRaised > 0
      ? founderNetCash / input.totalEquityRaised
      : 0;
  }

  // Aggelakakis equity pct: same conversion as grantBonusPct — EUR input / equity pool.
  const aggelakakisEquityPct = (input.grantApproved && input.totalEquityRaised > 0)
    ? aggelakakisEquityAtExit / input.totalEquityRaised
    : 0;

  // Deprecated aliases — kept so existing call-sites don't break.
  const consultantCash = aggelakakisCash;
  const deferredAdvisoryFee = eytan1BCash;
  const advisoryAnnual = 0;
  const advisoryStartYear = paymentYear;

  // ── Layer C tier selection ────────────────────────────────────────
  let { tier, ratchet, reduced } = selectTier(input.investorIRR, input.investorMOIC, input.grantApproved);

  // ── Ratchet standalone cap ────────────────────────────────────────
  // Layer C is capped independently at RATCHET_STANDALONE_CAP (10%).
  // Grant bonus (Layer B) and pari-passu (Layer A) are not counted
  // against this ceiling — each component is independently bounded.
  let cap: CapBinding = 'none';
  if (ratchet > RATCHET_STANDALONE_CAP + 1e-9) {
    ratchet = RATCHET_STANDALONE_CAP;
    cap = 'ratchet_10';
  } else if (Math.abs(ratchet - RATCHET_STANDALONE_CAP) < 1e-9 && ratchet > 0) {
    cap = 'ratchet_10';
  }
  let earned = grantBonus + ratchet;  // no combined ceiling; layers are independent

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
  let founderExitPct = Math.min(TOTAL_FOUNDER_CAP, operationalBase + grantBonus);
  let grantExitCapActive = false;
  if (
    input.grantApproved &&
    input.investorIRR < GRANT_ROUTE_IRR_THRESHOLD &&
    founderExitPct > GRANT_ROUTE_EXIT_CAP_BELOW_THRESHOLD &&
    cap === 'none'
  ) {
    founderExitPct = GRANT_ROUTE_EXIT_CAP_BELOW_THRESHOLD;
    grantExitCapActive = true;
    cap = 'exit_55_grant';
  }

  return {
    pariPassuPct: pariPassu,
    developerEquityPct: developerEquity,
    grantBonusPct: input.grantApproved ? grantBonus : 0,
    performanceRatchetPct: ratchet,
    earnedPct: earned,
    founderOperatingPct,
    founderExitPct,
    grantExitCapActive,
    founderTotalPct: founderOperatingPct,   // backward-compat alias
    investorTotalPct: 1 - founderOperatingPct,
    capBinding: cap,
    ratchetTier: tier.id,
    ratchetTierLabel: tier.label,
    moicFloorReduction: reduced,
    aggelakakisCash,
    aggelakakisEquityAtExit,
    aggelakakisEquityPct,
    eytan1BCash,
    grantSuccessFeePaymentYear: paymentYear,
    founderNetGrantCash: founderNetCash,
    postGrantEquityValue: postGrantEquity,
    // deprecated aliases
    consultantCashPayment: consultantCash,
    bucket1B_deferredAdvisoryFee: deferredAdvisoryFee,
    bucket1B_annualPayment: advisoryAnnual,
    bucket1B_paymentStartYear: advisoryStartYear,
  };
}

// ── Cash-flow level helpers (npv, irrNewton) → financeUtils.ts ────────

export interface YearDistribution {
  year: number;
  totalDistribution: number;  // project cash distributable this year (post-fees)
  // Operating vs exit split — used to apply different founder rates.
  // operatingDistribution = post-fee NCF; exitDistribution = terminal equity (exit year only).
  operatingDistribution: number;
  exitDistribution: number;
  founderShare: number;       // founder equity share this year
  investorShare: number;      // total investor share this year
  aggelakakisShare: number;   // Aggelakakis equity stake share this year (ops + exit)
  // ── Per-year fee deductions (informational) ───────────────────────
  founderManCoFee: number;          // Bucket 2A: 5% × revenue (base management fee)
  grantSuccessFeePayment: number;   // Bucket 1B: total cash (Aggelakakis + Eytan) in payment year; 0 other years
  ncfPreFees: number;               // NCF post-VAT before founder fees subtracted
  /** @deprecated Use grantSuccessFeePayment. Was 3-yr spread. */
  deferredAdvisoryFeePayment: number;
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
  totalAggelakakisCash: number;       // total cash paid to Aggelakakis from operating cash
  totalEytan1BCash: number;           // total cash paid to Eytan (Bucket 1B) from operating cash
  aggelakakisEquityPct: number;       // % stake at inception (new — mirrors grantBonusPct)
  aggelakakisEquityAtExit: number;    // EUR input preserved for UI backward compat
  /** @deprecated Use totalAggelakakisCash + totalEytan1BCash. */
  totalDeferredAdvisoryFee: number;
}

export interface DistributionStreamOptions {
  // Bucket 2A: 5% of gross revenue — base management fee.
  baseMgmtFeeRate?: number;
  /** @deprecated Use baseMgmtFeeRate. */
  founderManCoFeeRate?: number;
  // Bucket 1B: grant success fee cash portions — paid in a single year (not spread).
  // Combined Aggelakakis + Eytan cash. Paid post-debt-service; does not affect DSCR.
  aggelakakisCash?: number;        // Aggelakakis's cash portion
  eytan1BCash?: number;            // Eytan's cash portion (Bucket 1B)
  /** % stake at inception — preferred. Rides full waterfall (ops + exit). */
  aggelakakisEquityPct?: number;
  /** @deprecated — EUR input; pass aggelakakisEquityPct instead. */
  aggelakakisEquityAtExit?: number;
  /** Single year in which both cash portions are paid. Default: DEFAULT_GRANT_SUCCESS_FEE_PAYMENT_YEAR. */
  grantSuccessFeePaymentYear?: number;
  /** @deprecated Use grantSuccessFeePaymentYear. */
  bucket1BPaymentStartYear?: number;
  /** @deprecated Use grantSuccessFeePaymentYear. */
  loanDisbursementYear?: number;
  /** @deprecated Use aggelakakisCash + eytan1BCash. */
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
  const feeRate = options.baseMgmtFeeRate ?? (options as { founderManCoFeeRate?: number }).founderManCoFeeRate ?? DEFAULT_DEAL_TERMS.baseMgmtFeeRate;

  // Bucket 1B: single-year cash payment (Aggelakakis + Eytan combined).
  // Backward-compat: if old deferredAdvisoryFee is passed, treat it as the total.
  const legacyAdvisoryFee = options.deferredAdvisoryFee ?? 0;
  const aggelakakisCash = options.aggelakakisCash ?? (legacyAdvisoryFee * 0.5);
  const eytan1BCash = options.eytan1BCash ?? (legacyAdvisoryFee * 0.5);
  const totalCashFeePayment = aggelakakisCash + eytan1BCash;
  // Prefer the pct form; fall back to zero (deprecated EUR form no longer drives stream).
  const aggelakakisEquityPct = options.aggelakakisEquityPct ?? 0;
  const cashPaymentYear = options.grantSuccessFeePaymentYear
    ?? options.bucket1BPaymentStartYear
    ?? options.loanDisbursementYear
    ?? DEFAULT_GRANT_SUCCESS_FEE_PAYMENT_YEAR;

  const exitYear = scenario.exitYear;
  const pnlAll = scenario.pnl;
  const exitIdx = pnlAll.findIndex((p) => p.year === exitYear);
  const pnl = exitIdx >= 0 ? pnlAll.slice(0, exitIdx + 1) : pnlAll;

  return pnl.map((p, i) => {
    const isExit = i === pnl.length - 1;
    const ncfPreFees = Math.max(0, p.netCashFlowPostVAT);
    const manCoFee = Math.max(0, p.totalRevenue) * feeRate;
    // Grant success fee cash: paid in a single year, post-debt-service (no DSCR impact).
    const grantFeeThisYear = (totalCashFeePayment > 0 && p.year === cashPaymentYear)
      ? totalCashFeePayment : 0;
    // Operating component: post-fee NCF (floored at 0).
    const operatingDistribution = Math.max(0, ncfPreFees - manCoFee - grantFeeThisYear);
    // Exit component: full terminal equity (Aggelakakis rides as a % stake, not a deduction).
    const exitDistribution = isExit ? Math.max(0, scenario.terminalEquityValue) : 0;
    // Aggelakakis's % stake: carved out of gross distributable before founder/investor split.
    const grossDistribution = operatingDistribution + exitDistribution;
    const aggelakakisShare = grossDistribution * aggelakakisEquityPct;
    const totalDistribution = Math.max(0, grossDistribution - aggelakakisShare);
    return {
      year: p.year,
      totalDistribution,
      operatingDistribution,
      exitDistribution,
      founderShare: 0,    // populated after waterfall resolves
      investorShare: 0,
      aggelakakisShare,
      founderManCoFee: manCoFee,
      grantSuccessFeePayment: grantFeeThisYear,
      deferredAdvisoryFeePayment: grantFeeThisYear, // deprecated alias
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
  /** Single year in which both cash portions are paid. Default 2030. */
  grantSuccessFeePaymentYear?: number;
  /** @deprecated Use grantSuccessFeePaymentYear. */
  bucket1BPaymentStartYear?: number;
  /** @deprecated Use grantSuccessFeePaymentYear. */
  loanDisbursementYear?: number;
  maxIterations?: number;
  /** Fraction of each party's fee paid as cash; remainder = equity at exit. Default 0.50. */
  feeCashSplitPct?: number;
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
  const grantAmount = options.grantAmount ?? DEFAULT_DEAL_TERMS.grantAmount;
  const feePct = options.founderFeePct ?? DEFAULT_DEAL_TERMS.grantProcurementFeePct;
  const consultantSharePct = options.consultantSharePct ?? DEFAULT_GRANT_CONSULTANT_SHARE_PCT;
  const cashSplit = options.feeCashSplitPct ?? DEFAULT_FEE_CASH_SPLIT_PCT;
  const paymentYear = options.grantSuccessFeePaymentYear
    ?? options.bucket1BPaymentStartYear
    ?? options.loanDisbursementYear
    ?? DEFAULT_GRANT_SUCCESS_FEE_PAYMENT_YEAR;

  // Compute the party-split amounts for the distribution stream.
  let aggelakakisCash = 0;
  let aggelakakisEquityAtExit = 0;
  let eytan1BCash = 0;
  if (grantApproved) {
    const grossFee = grantAmount * feePct;
    const aggelakakisTotal = grantAmount * consultantSharePct;
    const eytanTotal = grossFee - aggelakakisTotal;
    aggelakakisCash = aggelakakisTotal * cashSplit;
    aggelakakisEquityAtExit = aggelakakisTotal * (1 - cashSplit);
    eytan1BCash = eytanTotal * cashSplit;
  }

  // Aggelakakis's % stake — carved from gross distributable before the founder/investor split.
  // Both founder and investors are diluted proportionally (same mechanism as Eytan's grantBonusPct).
  const aggelakakisEqPct = totalEquityRaised > 0 ? aggelakakisEquityAtExit / totalEquityRaised : 0;

  const stream = buildDistributionStream(scenario, {
    baseMgmtFeeRate: options.baseMgmtFeeRate ?? (options as { founderManCoFeeRate?: number }).founderManCoFeeRate,
    aggelakakisCash,
    eytan1BCash,
    aggelakakisEquityPct: aggelakakisEqPct,
    grantSuccessFeePaymentYear: paymentYear,
  });
  const totalProject = stream.reduce((s, y) => s + y.totalDistribution, 0);
  const totalFounderManCoFee = stream.reduce((s, y) => s + y.founderManCoFee, 0);
  const totalGrantSuccessFeePayment = stream.reduce((s, y) => s + y.grantSuccessFeePayment, 0);
  const totalNonFounderCash = Math.max(0, totalEquityRaised - founderCashInvested);

  const stakeInputBase = {
    founderCashInvested,
    totalEquityRaised,
    grantApproved,
    grantAmount,
    founderFeePct: feePct,
    consultantSharePct,
    projectAssetValue: options.projectAssetValue,
    bankLoanAmount: options.bankLoanAmount,
    grantSuccessFeePaymentYear: paymentYear,
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
  seen.add(`${breakdown.ratchetTier}|${breakdown.performanceRatchetPct.toFixed(6)}|${breakdown.founderExitPct.toFixed(6)}`);

  for (let i = 0; i < maxIterations; i++) {
    iterations = i + 1;
    // Investors share the pool that remains after Aggelakakis's equity carve-out.
    // Apply founderPct to the reduced distributions so both founder and investors
    // bear the Aggelakakis dilution proportionally.
    const investorYearly = stream.map((y) => {
      const opInvestor = y.operatingDistribution * (1 - aggelakakisEqPct) * (1 - breakdown.founderOperatingPct);
      const exitInvestor = y.exitDistribution * (1 - aggelakakisEqPct) * (1 - breakdown.founderExitPct);
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
    const nextKey = `${nextBreakdown.ratchetTier}|${nextBreakdown.performanceRatchetPct.toFixed(6)}|${nextBreakdown.founderExitPct.toFixed(6)}`;

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
    // Founder and investors split the pool that remains after Aggelakakis's equity carve-out.
    // Apply founderPct to the reduced distributions (gross × (1 − aggelakakisEqPct)) so that
    // both founder and investors bear the dilution proportionally — not investors alone.
    const founderShare =
      y.operatingDistribution * (1 - aggelakakisEqPct) * breakdown.founderOperatingPct +
      y.exitDistribution * (1 - aggelakakisEqPct) * breakdown.founderExitPct;
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
    totalAggelakakisCash: aggelakakisCash,
    totalEytan1BCash: eytan1BCash,
    aggelakakisEquityPct: breakdown.aggelakakisEquityPct,
    aggelakakisEquityAtExit,
    totalDeferredAdvisoryFee: totalGrantSuccessFeePayment, // deprecated alias
  };
}

// ── Advisory / warning helpers ──────────────────────────────────────────

export function advisoryFounderCashLimit(grantApproved: boolean): number {
  return grantApproved ? ADVISORY_FOUNDER_CASH_GRANT : ADVISORY_FOUNDER_CASH_NO_GRANT;
}

export function founderCashExceedsAdvisory(founderCash: number, grantApproved: boolean): boolean {
  return founderCash > advisoryFounderCashLimit(grantApproved);
}
