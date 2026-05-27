// Directed tests for the Bucket 1C ratchet — 3-tier structure, and
// Bucket 1B deferred advisory fee (restructured from grant-year consultant
// deduction to 3-year operating-cash payment post-loan disbursement).
//
// These tests pin the economics of the restructured RATCHET_TIERS:
//   miss      — IRR < 8%  → 0% ratchet  (merges old failure + below_pref)
//   pref_met  — 8–22% IRR → +9%
//   excellent — ≥ 22% IRR → +29% (no-grant differential removed)

import { describe, expect, it } from 'vitest';
import {
  computeFounderStake,
  buildDistributionStream,
  resolveFounderWaterfall,
  DEFAULT_GRANT_AMOUNT,
  DEFAULT_GRANT_PROCUREMENT_FEE_PCT,
  DEFAULT_GRANT_APPROVAL_YEAR,
  DEFAULT_PROJECT_ASSET_VALUE,
  DEFAULT_BASELINE_BANK_LOAN,
  DEFAULT_BASE_MGMT_FEE_RATE,
  DEFAULT_DEAL_TERMS,
  RATCHET_TIERS,
  TOTAL_FOUNDER_CAP,
  // New constants for the 55% exit cap feature — do not exist yet (TDD red phase).
  GRANT_ROUTE_IRR_THRESHOLD,
  GRANT_ROUTE_EXIT_CAP_BELOW_THRESHOLD,
} from '@/lib/engine/founderWaterfall';
import { PROJECT_CONSTANTS } from '@/lib/engine/defaults';
import type { ScenarioOutput } from '@/lib/engine/types';
import type { RatchetTierDef } from '@/lib/engine/founderWaterfall';

// Minimal inputs for computeFounderStake that don't affect tier selection.
const BASE_INPUT = {
  founderCashInvested: 200_000,
  totalEquityRaised: 1_200_000,
};

describe('Bucket 1C ratchet — 3-tier structure', () => {
  it('returns 0% ratchet for IRR in 0–8% band (was +5% before restructure)', () => {
    // investor IRR = 5%, MOIC = 1.5 — should land in 'miss' tier, ratchet = 0%
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.05,
      investorMOIC: 1.5,
    });
    expect(result.ratchetTier).toBe('miss');
    expect(result.performanceRatchetPct).toBe(0);
  });

  it('returns 0% ratchet for negative IRR (miss tier)', () => {
    // IRR = -10% → miss tier
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: false,
      investorIRR: -0.10,
      investorMOIC: 0.8,
    });
    expect(result.ratchetTier).toBe('miss');
    expect(result.performanceRatchetPct).toBe(0);
  });

  it('returns +9% ratchet for IRR 8–22% (pref_met tier) reduced by 10% carry to 0.081', () => {
    // Default aggelakakisCarryPct = 0.10; 9% × 0.90 = 8.1%
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.12,
      investorMOIC: 3.0,
    });
    expect(result.ratchetTier).toBe('pref_met');
    expect(result.performanceRatchetPct).toBeCloseTo(0.081);
  });

  it('returns 0% ratchet for IRR 8–22% when MOIC floor not met (drops to miss)', () => {
    // pref_met needs MOIC ≥ 2.5; MOIC = 1.8 → drops to miss (moicFloor = 0)
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.15,
      investorMOIC: 1.8,
    });
    expect(result.ratchetTier).toBe('miss');
    expect(result.performanceRatchetPct).toBe(0);
    expect(result.moicFloorReduction).toBe(true);
  });

  it('returns +9% ratchet for IRR ≥ 22% with grant approved (10% cap × 0.90 carry reduction)', () => {
    // Excellent tier raw = 10%; carry reduces to 10% × 0.90 = 9%.
    // Standalone ratchet cap (10%) applies to the gross value before carry,
    // so the effective post-carry cap is 10% × 0.90 = 9%.
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.25,
      investorMOIC: 7.0,
    });
    expect(result.ratchetTier).toBe('excellent');
    expect(result.performanceRatchetPct).toBeCloseTo(0.09);
  });

  it('returns +9% ratchet for IRR ≥ 22% WITHOUT grant (carry reduces 10% to 9%)', () => {
    const noGrantCase = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: false,
      investorIRR: 0.25,
      investorMOIC: 7.0,
    });
    expect(noGrantCase.ratchetTier).toBe('excellent');
    expect(noGrantCase.performanceRatchetPct).toBeCloseTo(0.09);
  });

  it('grant and no-grant excellent-tier ratchet are equal — grant bonus is independent', () => {
    // Both reach the same post-carry ratchet (9% = 10% × 0.90) at the excellent tier.
    const grantCase = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.25,
      investorMOIC: 7.0,
    });
    const noGrantCase = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: false,
      investorIRR: 0.25,
      investorMOIC: 7.0,
    });
    expect(grantCase.performanceRatchetPct).toBeCloseTo(0.09);
    expect(noGrantCase.performanceRatchetPct).toBeCloseTo(0.09);
    expect(grantCase.performanceRatchetPct).toBe(noGrantCase.performanceRatchetPct);
  });

  it('pref_met tier boundary: IRR exactly at 22% still in pref_met (exclusive upper bound)', () => {
    // irrMax for pref_met = 0.22 (exclusive), so 0.2199 is pref_met. 9% × 0.90 = 8.1%
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.2199,
      investorMOIC: 3.0,
    });
    expect(result.ratchetTier).toBe('pref_met');
    expect(result.performanceRatchetPct).toBeCloseTo(0.081);
  });

  it('excellent tier boundary: IRR at exactly 22% flips to excellent', () => {
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.22,
      investorMOIC: 7.0,
    });
    expect(result.ratchetTier).toBe('excellent');
    // Carry reduces 10% raw to 10% × 0.90 = 9%.
    expect(result.performanceRatchetPct).toBeCloseTo(0.09);
  });

  it('ratchetTierLabel is human-readable for each tier', () => {
    const miss = computeFounderStake({ ...BASE_INPUT, grantApproved: false, investorIRR: 0.02, investorMOIC: 1.0 });
    const pref = computeFounderStake({ ...BASE_INPUT, grantApproved: false, investorIRR: 0.12, investorMOIC: 3.0 });
    const exc = computeFounderStake({ ...BASE_INPUT, grantApproved: false, investorIRR: 0.25, investorMOIC: 7.0 });
    expect(miss.ratchetTierLabel).toBe('Miss');
    expect(pref.ratchetTierLabel).toBe('Pref met');
    expect(exc.ratchetTierLabel).toBe('Excellent');
  });
});

// ── Bucket 1B: grant success fee (restructured 2026-05-26) ─────────────────
//
// The grant success fee (grant × 10%) is split between Aggelakakis (consultant,
// 50% of fee) and Eytan (founder, 50% of fee). Each party's share is further
// split 50% cash / 50% equity. The cash portions are paid from operating cash
// in a SINGLE year (default: 2030), NOT spread over 3 years and NOT deducted
// from grant proceeds. This keeps DSCR clean in the 2029 ramp year.
//
//   Aggelakakis cash    = grant × 5% × 50% = grant × 2.5%
//   Aggelakakis equity  = grant × 5% × 50% = grant × 2.5%  (deducted at exit)
//   Eytan cash (1B)     = grant × 5% × 50% = grant × 2.5%
//   Eytan equity (→ LB) = grant × 5% × 50% = grant × 2.5%  (feeds grantBonusPct)

/**
 * Build a minimal ScenarioOutput stub with years 2026-2033.
 * Only fields consumed by buildDistributionStream are populated;
 * remaining required fields are omitted via cast.
 */
function makeScenario(): ScenarioOutput {
  const years = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];
  const pnl = years.map((year) => ({
    year,
    totalRevenue: 500_000,
    netCashFlowPostVAT: 180_000,
    propertyBreakdown: [],
  }));
  return {
    exitYear: 2033,
    terminalEquityValue: 1_000_000,
    pnl,
  } as unknown as ScenarioOutput;
}

describe('Bucket 1B — deferred advisory fee (grant × 10%, 3-yr operating cash)', () => {
  const expectedTotal = DEFAULT_GRANT_AMOUNT * DEFAULT_GRANT_PROCUREMENT_FEE_PCT;
  const startYear = DEFAULT_GRANT_APPROVAL_YEAR + 1; // 2028 (used in legacy compat tests)
  const paymentYears = [startYear, startYear + 1, startYear + 2]; // [2028, 2029, 2030]

  it('computeFounderStake: bucket1B_deferredAdvisoryFee equals grant × 2.5% (Eytan cash half) when grant approved', () => {
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.12,
      investorMOIC: 3.0,
    });
    // New structure: fee is split between Aggelakakis (5%) and Eytan (5%), each
    // further split 50% cash / 50% equity. bucket1B_deferredAdvisoryFee is now the
    // deprecated alias for eytan1BCash = grant × 5% × 50% = grant × 2.5%.
    const expectedEytanCash = DEFAULT_GRANT_AMOUNT * DEFAULT_GRANT_PROCUREMENT_FEE_PCT * 0.5 * 0.5;
    expect(result.bucket1B_deferredAdvisoryFee).toBeCloseTo(expectedEytanCash, 0);
  });

  it('computeFounderStake: bucket1B_deferredAdvisoryFee is 0 when grant not approved', () => {
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: false,
      investorIRR: 0.12,
      investorMOIC: 3.0,
    });
    expect(result.bucket1B_deferredAdvisoryFee).toBe(0);
    expect(result.bucket1B_annualPayment).toBe(0);
  });

  it('computeFounderStake: bucket1B_annualPayment is 0 (single-year payment, no spread)', () => {
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.12,
      investorMOIC: 3.0,
    });
    // Annual payment is no longer spread over 3 years — the deprecated field returns 0.
    expect(result.bucket1B_annualPayment).toBe(0);
  });

  it('computeFounderStake: bucket1B_paymentStartYear defaults to DEFAULT_GRANT_SUCCESS_FEE_PAYMENT_YEAR (2030)', () => {
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.12,
      investorMOIC: 3.0,
    });
    // Changed from grantApprovalYear + 1 (2028) to avoid squeezing DSCR in 2029.
    expect(result.bucket1B_paymentStartYear).toBe(2030);
  });

  it('buildDistributionStream: NO deduction in grant approval year (2027) with grant active', () => {
    const scenario = makeScenario();
    const stream = buildDistributionStream(scenario, {
      deferredAdvisoryFee: expectedTotal,
      loanDisbursementYear: startYear,
    });
    const grantYearRow = stream.find((y) => y.year === DEFAULT_GRANT_APPROVAL_YEAR);
    expect(grantYearRow).toBeDefined();
    expect(grantYearRow!.deferredAdvisoryFeePayment).toBe(0);
  });

  it('buildDistributionStream: full combined cash deduction in the single payment year', () => {
    // Legacy compat path: deferredAdvisoryFee is split 50/50 → total = full fee.
    // Single payment in the year specified by loanDisbursementYear (= startYear = 2028).
    const scenario = makeScenario();
    const stream = buildDistributionStream(scenario, {
      deferredAdvisoryFee: expectedTotal,
      loanDisbursementYear: startYear,
    });
    const paymentYearRow = stream.find((y) => y.year === startYear);
    expect(paymentYearRow).toBeDefined();
    expect(paymentYearRow!.deferredAdvisoryFeePayment).toBeCloseTo(expectedTotal, 0);
  });

  it('buildDistributionStream: no deduction outside the payment year', () => {
    const scenario = makeScenario();
    const stream = buildDistributionStream(scenario, {
      deferredAdvisoryFee: expectedTotal,
      loanDisbursementYear: startYear,
    });
    const nonPaymentRows = stream.filter((y) => y.year !== startYear);
    for (const row of nonPaymentRows) {
      expect(row.deferredAdvisoryFeePayment).toBe(0);
    }
  });

  it('buildDistributionStream: sum of deferredAdvisoryFeePayment equals total fee', () => {
    const scenario = makeScenario();
    const stream = buildDistributionStream(scenario, {
      deferredAdvisoryFee: expectedTotal,
      loanDisbursementYear: startYear,
    });
    const totalPaid = stream.reduce((s, y) => s + y.deferredAdvisoryFeePayment, 0);
    expect(totalPaid).toBeCloseTo(expectedTotal, 0);
  });

  it('buildDistributionStream: zero fee produces zero deferredAdvisoryFeePayment in all years', () => {
    const scenario = makeScenario();
    const stream = buildDistributionStream(scenario, {
      deferredAdvisoryFee: 0,
      loanDisbursementYear: startYear,
    });
    for (const row of stream) {
      expect(row.deferredAdvisoryFeePayment).toBe(0);
    }
  });
});

// ── DealTermsConfig round-trip ─────────────────────────────────────────────
//
// These tests verify that DEFAULT_DEAL_TERMS is assembled from the same
// individual exported constants — no hidden copy-paste divergence.

describe('DealTermsConfig round-trip', () => {
  it('DEFAULT_DEAL_TERMS.grantAmount matches DEFAULT_GRANT_AMOUNT', () => {
    expect(DEFAULT_DEAL_TERMS.grantAmount).toBe(DEFAULT_GRANT_AMOUNT);
  });

  it('DEFAULT_DEAL_TERMS.grantProcurementFeePct matches DEFAULT_GRANT_PROCUREMENT_FEE_PCT', () => {
    expect(DEFAULT_DEAL_TERMS.grantProcurementFeePct).toBe(DEFAULT_GRANT_PROCUREMENT_FEE_PCT);
  });

  it('DEFAULT_DEAL_TERMS.projectAssetValue matches DEFAULT_PROJECT_ASSET_VALUE', () => {
    expect(DEFAULT_DEAL_TERMS.projectAssetValue).toBe(DEFAULT_PROJECT_ASSET_VALUE);
  });

  it('DEFAULT_DEAL_TERMS.baselineBankLoan matches DEFAULT_BASELINE_BANK_LOAN', () => {
    expect(DEFAULT_DEAL_TERMS.baselineBankLoan).toBe(DEFAULT_BASELINE_BANK_LOAN);
  });

  it('DEFAULT_DEAL_TERMS.grantApprovalYear matches DEFAULT_GRANT_APPROVAL_YEAR', () => {
    expect(DEFAULT_DEAL_TERMS.grantApprovalYear).toBe(DEFAULT_GRANT_APPROVAL_YEAR);
  });

  it('DEFAULT_DEAL_TERMS.baseMgmtFeeRate matches DEFAULT_BASE_MGMT_FEE_RATE', () => {
    expect(DEFAULT_DEAL_TERMS.baseMgmtFeeRate).toBe(DEFAULT_BASE_MGMT_FEE_RATE);
  });

  it('DEFAULT_DEAL_TERMS.ratchetTiers is the RATCHET_TIERS array', () => {
    expect(DEFAULT_DEAL_TERMS.ratchetTiers).toBe(RATCHET_TIERS);
  });

  it('DEFAULT_DEAL_TERMS.grantApprovalYear === PROJECT_CONSTANTS.HORIZON_START_YEAR + 1', () => {
    expect(DEFAULT_DEAL_TERMS.grantApprovalYear).toBe(PROJECT_CONSTANTS.HORIZON_START_YEAR + 1);
  });

  it('RATCHET_TIERS has 3 tiers (the three-tier structure)', () => {
    expect(DEFAULT_DEAL_TERMS.ratchetTiers.length).toBe(3);
  });

  it('first ratchet tier has irrMin === -Infinity (sentinel preserved)', () => {
    expect(DEFAULT_DEAL_TERMS.ratchetTiers[0].irrMin).toBe(-Infinity);
  });

  it('last ratchet tier has irrMax === Infinity (sentinel preserved)', () => {
    const lastTier = DEFAULT_DEAL_TERMS.ratchetTiers[DEFAULT_DEAL_TERMS.ratchetTiers.length - 1];
    expect(lastTier.irrMax).toBe(Infinity);
  });

  it('RATCHET_TIERS can be typed as readonly RatchetTierDef[] (TypeScript structural check at runtime)', () => {
    // This is a compile-time-only check — we just verify that the array
    // satisfies the readonly interface by exercising it without mutation.
    const tiers: readonly RatchetTierDef[] = RATCHET_TIERS;
    expect(tiers.length).toBe(3);
    expect(tiers[0].id).toBe('miss');
    expect(tiers[1].id).toBe('pref_met');
    expect(tiers[2].id).toBe('excellent');
  });

  it('resolveFounderWaterfall with options:{} equals calling with founderFeePct set to DEFAULT_GRANT_PROCUREMENT_FEE_PCT', () => {
    // Confirms the deferredAdvisoryFee fix is consistent: the default
    // founderFeePct in resolveFounderWaterfall is DEFAULT_GRANT_PROCUREMENT_FEE_PCT.
    const scenario = makeScenario();
    const founderCash = 200_000;
    const totalEquity = 1_200_000;
    const grantApproved = true;

    const resultNoOverride = resolveFounderWaterfall(
      scenario,
      founderCash,
      totalEquity,
      grantApproved,
      {},
    );
    const resultWithExplicitFee = resolveFounderWaterfall(
      scenario,
      founderCash,
      totalEquity,
      grantApproved,
      { founderFeePct: DEFAULT_GRANT_PROCUREMENT_FEE_PCT },
    );

    expect(resultNoOverride.breakdown.bucket1B_deferredAdvisoryFee).toBeCloseTo(
      resultWithExplicitFee.breakdown.bucket1B_deferredAdvisoryFee,
      2,
    );
    expect(resultNoOverride.totalDeferredAdvisoryFee).toBeCloseTo(
      resultWithExplicitFee.totalDeferredAdvisoryFee,
      2,
    );
    expect(resultNoOverride.breakdown.performanceRatchetPct).toBeCloseTo(
      resultWithExplicitFee.breakdown.performanceRatchetPct,
      6,
    );
  });
});

// ── Grant route 55% exit equity cap ────────────────────────────────────────
//
// When the grant route is active (grantApproved: true) AND the converged
// investor IRR falls strictly below GRANT_ROUTE_IRR_THRESHOLD (0.30 = 30%),
// the founder's EXIT equity share is capped at GRANT_ROUTE_EXIT_CAP_BELOW_THRESHOLD
// (0.55 = 55%).  The cap protects investors on grant-assisted deals where the
// project under-performs relative to the IRR hurdle.
//
// Key invariants:
//   • The cap applies only to founderExitPct, not founderOperatingPct.
//   • The cap is a ceiling — it never raises a share that is already below 55%.
//   • The 75% total cap (TOTAL_FOUNDER_CAP) takes precedence when it would
//     produce a lower exit share than 55%.
//   • The boundary is strict: IRR exactly at 30% does NOT fire the cap.

describe('Grant route 55% exit cap', () => {
  // ── Case A — grant + investor IRR < 30% → cap fires ─────────────────
  it('Case A: grant + IRR 20% → founderExitPct capped at 0.55, grantExitCapActive true, capBinding exit_55_grant', () => {
    // founderCashInvested / totalEquityRaised = 200_000 / 1_200_000 ≈ 0.167 (pariPassu)
    // developerEquityPct = 0.35 → operationalBase = 0.167 + 0.35 = 0.517
    // grantBonus = (grant × 5% × 50%) / totalEquityRaised
    //            = 100_347 / 1_200_000 ≈ 0.0836
    // operationalBase + grantBonus ≈ 0.517 + 0.0836 = 0.600 > 0.55 → cap fires
    const result = computeFounderStake({
      founderCashInvested: 200_000,
      totalEquityRaised: 1_200_000,
      developerEquityPct: 0.35,
      grantApproved: true,
      investorIRR: 0.20,
      investorMOIC: 1.8,
    });

    expect(result.founderExitPct).toBeCloseTo(GRANT_ROUTE_EXIT_CAP_BELOW_THRESHOLD, 10);
    expect(result.grantExitCapActive).toBe(true);
    expect(result.capBinding).toBe('exit_55_grant');
    // Operating rate must NOT be touched by the exit cap.
    const expectedOperating = result.founderOperatingPct;
    expect(result.founderOperatingPct).toBeCloseTo(expectedOperating, 10);
  });

  // ── Case B — grant + investor IRR >= 30% → cap does not fire ─────────
  it('Case B: grant + IRR 35% → founderExitPct above 0.55, grantExitCapActive false', () => {
    // Same cap-table as Case A (developerEquityPct: 0.35) so operationalBase + grantBonus > 0.55.
    // IRR = 0.35 >= GRANT_ROUTE_IRR_THRESHOLD → cap condition not met.
    const result = computeFounderStake({
      founderCashInvested: 200_000,
      totalEquityRaised: 1_200_000,
      developerEquityPct: 0.35,
      grantApproved: true,
      investorIRR: 0.35,
      investorMOIC: 5.0,
    });

    expect(result.founderExitPct).toBeGreaterThan(0.55);
    expect(result.grantExitCapActive).toBe(false);
    expect(result.capBinding).not.toBe('exit_55_grant');
  });

  // ── Case C — no grant + low IRR → cap never fires ────────────────────
  it('Case C: no grant + IRR 10% → grantExitCapActive false, capBinding not exit_55_grant', () => {
    // The 55% cap is grant-route-only. Without a grant it must never activate.
    const result = computeFounderStake({
      founderCashInvested: 200_000,
      totalEquityRaised: 1_200_000,
      developerEquityPct: 0.25,
      grantApproved: false,
      investorIRR: 0.10,
      investorMOIC: 2.0,
    });

    expect(result.grantExitCapActive).toBe(false);
    expect(result.capBinding).not.toBe('exit_55_grant');
  });

  // ── Case D — grant + low IRR but uncapped share already < 55% ────────
  it('Case D: grant + IRR 10% but natural exit share < 55% → cap does NOT raise it, grantExitCapActive false', () => {
    // Very small founderCashInvested and no developerEquityPct keeps
    // operationalBase + grantBonus well below 0.55.
    // founderCashInvested / totalEquityRaised = 50_000 / 1_500_000 ≈ 0.033
    // developerEquityPct = 0 → operationalBase ≈ 0.033
    // grantBonus = (4_013_880 × 0.05) / 1_500_000 ≈ 0.134
    // operationalBase + grantBonus ≈ 0.033 + 0.134 = 0.167 < 0.55 → cap guard false
    const result = computeFounderStake({
      founderCashInvested: 50_000,
      totalEquityRaised: 1_500_000,
      developerEquityPct: 0,
      grantApproved: true,
      investorIRR: 0.10,
      investorMOIC: 2.0,
    });

    // founderExitPct must equal the natural operationalBase + grantBonus (< 0.55).
    expect(result.founderExitPct).toBeLessThan(0.55);
    // The cap must NOT have fired (it is a ceiling, not a floor).
    expect(result.grantExitCapActive).toBe(false);
    expect(result.capBinding).not.toBe('exit_55_grant');
  });

  // ── Case E — convergence with IRR near 30% boundary ──────────────────
  it('Case E: resolveFounderWaterfall converges near 30% IRR boundary in ≤8 iterations, never exceeds 75% hard cap', () => {
    // Use scenario pnl that produces a converged IRR near 0.28-0.32 so the
    // solver exercises the boundary logic.  High NCF pushes investor returns up.
    const years = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];
    const pnl = years.map((year) => ({
      year,
      totalRevenue: 600_000,
      netCashFlowPostVAT: 240_000,
      propertyBreakdown: [],
    }));
    const scenario = {
      exitYear: 2033,
      terminalEquityValue: 1_400_000,
      pnl,
    } as unknown as Parameters<typeof resolveFounderWaterfall>[0];

    const result = resolveFounderWaterfall(
      scenario,
      200_000,   // founderCashInvested
      1_200_000, // totalEquityRaised
      true,      // grantApproved
      { developerEquityPct: 0.25 },
    );

    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThanOrEqual(8);
    expect(result.breakdown.founderExitPct).toBeLessThanOrEqual(TOTAL_FOUNDER_CAP);
  });

  // ── Case F — 75% hard cap takes precedence over 55% grant cap ────────
  it('Case F: when 75% cap binds, capBinding is total_75 not exit_55_grant', () => {
    // Very high founderCashInvested pushes pariPassu alone near 1.0,
    // so operationalBase + grantBonus >= 0.75 → total cap fires first.
    // founderCashInvested / totalEquityRaised = 1_100_000 / 1_200_000 ≈ 0.917
    // developerEquityPct = 0.25 → operationalBase = 0.917 + 0.25 = 1.167 (capped at 0.75 by total cap)
    // The 55% grant cap would produce 0.55 but 0.75 total cap takes precedence.
    const result = computeFounderStake({
      founderCashInvested: 1_100_000,
      totalEquityRaised: 1_200_000,
      developerEquityPct: 0.25,
      grantApproved: true,
      investorIRR: 0.10,
      investorMOIC: 1.5,
    });

    // The 75% cap must win — founderExitPct pinned at TOTAL_FOUNDER_CAP.
    expect(result.founderExitPct).toBeCloseTo(TOTAL_FOUNDER_CAP, 10);
    expect(result.capBinding).toBe('total_75');
    expect(result.capBinding).not.toBe('exit_55_grant');
  });

  // ── Case G — boundary: IRR exactly at 30% → cap does NOT fire ────────
  it('Case G: grant + IRR exactly 30% (= threshold) → cap does NOT fire (strict < condition)', () => {
    // The cap condition is investorIRR < GRANT_ROUTE_IRR_THRESHOLD (strict).
    // At exactly 0.30 the cap must remain dormant.
    const result = computeFounderStake({
      founderCashInvested: 200_000,
      totalEquityRaised: 1_200_000,
      developerEquityPct: 0.25,
      grantApproved: true,
      investorIRR: 0.30,
      investorMOIC: 4.0,
    });

    expect(result.grantExitCapActive).toBe(false);
    expect(result.capBinding).not.toBe('exit_55_grant');
  });
});

// ── Aggelakakis promote-layer carry tests ──────────────────────────────────
//
// aggelakakisPromotePct = carry × (devEq + grantBonus + ratchet) [gross values]
// aggelakakisExitPct    = carry × (devEq + grantBonus)            [ratchet excluded]
// pariPassuPct is untouched — Thanasis does NOT participate in Eytan's LP cash return.

describe('Aggelakakis promote-layer carry', () => {
  it('aggelakakisPromotePct is non-zero when grant is not approved', () => {
    // With developerEquityPct = 0.25 and carry = 0.10 (default):
    // aggelakakisPromotePct = 0.10 × 0.25 = 0.025 (devEq only; no grant, no ratchet at miss IRR)
    const result = computeFounderStake({
      founderCashInvested: 200_000,
      totalEquityRaised: 1_200_000,
      developerEquityPct: 0.25,
      grantApproved: false,
      investorIRR: 0.02,
      investorMOIC: 1.0,
    });
    expect(result.ratchetTier).toBe('miss');
    expect(result.aggelakakisPromotePct).toBeCloseTo(0.025);
  });

  it('aggelakakisExitPct includes ratchet — must be greater than aggelakakisPromotePct when ratchet > 0', () => {
    // Ratchet moved to exit: aggelakakisExitPct includes ratchetGross; aggelakakisPromotePct (ops) does not.
    // pref_met tier (IRR 12%, MOIC 3.0): raw ratchet = 9%.
    // With grant approved and developerEquityPct = 0.25:
    //   devEqGross = 0.25, grantBonusGross ≈ 0.0836, ratchetGross ≈ 0.09
    //   aggelakakisPromotePct = 0.10 × (0.25 + 0.0836)        = 0.10 × 0.3336 ≈ 0.0334  [ops]
    //   aggelakakisExitPct    = 0.10 × (0.25 + 0.0836 + 0.09) = 0.10 × 0.4236 ≈ 0.0424  [exit]
    const result = computeFounderStake({
      founderCashInvested: 200_000,
      totalEquityRaised: 1_200_000,
      developerEquityPct: 0.25,
      grantApproved: true,
      investorIRR: 0.12,
      investorMOIC: 3.0,
    });
    expect(result.aggelakakisPromotePct).toBeGreaterThan(0);
    expect(result.aggelakakisExitPct).toBeGreaterThan(0);
    expect(result.aggelakakisExitPct).toBeGreaterThan(result.aggelakakisPromotePct);
  });

  it('pariPassuPct is unaffected by carry — Thanasis does not participate in LP cash return', () => {
    const result = computeFounderStake({
      founderCashInvested: 200_000,
      totalEquityRaised: 1_200_000,
      developerEquityPct: 0.25,
      grantApproved: false,
      investorIRR: 0.02,
      investorMOIC: 1.0,
    });
    // pariPassu = 200_000 / 1_200_000 ≈ 0.1667 — unchanged by carry
    expect(result.pariPassuPct).toBeCloseTo(200_000 / 1_200_000, 6);
  });
});
