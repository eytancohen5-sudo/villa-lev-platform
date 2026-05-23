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
  DEFAULT_GRANT_AMOUNT,
  DEFAULT_GRANT_PROCUREMENT_FEE_PCT,
  DEFAULT_GRANT_APPROVAL_YEAR,
} from '@/lib/engine/founderWaterfall';
import type { ScenarioOutput } from '@/lib/engine/types';

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

  it('returns +9% ratchet for IRR 8–22% (pref_met tier)', () => {
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.12,
      investorMOIC: 3.0,
    });
    expect(result.ratchetTier).toBe('pref_met');
    expect(result.performanceRatchetPct).toBeCloseTo(0.09);
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

  it('returns +29% ratchet for IRR ≥ 22% with grant approved', () => {
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.25,
      investorMOIC: 7.0,
    });
    expect(result.ratchetTier).toBe('excellent');
    expect(result.performanceRatchetPct).toBeCloseTo(0.29);
  });

  it('returns +29% ratchet for IRR ≥ 22% WITHOUT grant (no-grant differential removed)', () => {
    // The old structure had ratchetNoGrant = 0.33 for the top tier.
    // After restructure both grant and no-grant are 0.29.
    const noGrantCase = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: false,
      investorIRR: 0.25,
      investorMOIC: 7.0,
    });
    expect(noGrantCase.ratchetTier).toBe('excellent');
    expect(noGrantCase.performanceRatchetPct).toBeCloseTo(0.29);
  });

  it('grant and no-grant excellent-tier ratchet are equal (differential removed)', () => {
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
    expect(grantCase.performanceRatchetPct).toBeCloseTo(noGrantCase.performanceRatchetPct);
  });

  it('pref_met tier boundary: IRR exactly at 22% still in pref_met (exclusive upper bound)', () => {
    // irrMax for pref_met = 0.22 (exclusive), so 0.2199 is pref_met
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.2199,
      investorMOIC: 3.0,
    });
    expect(result.ratchetTier).toBe('pref_met');
    expect(result.performanceRatchetPct).toBeCloseTo(0.09);
  });

  it('excellent tier boundary: IRR at exactly 22% flips to excellent', () => {
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.22,
      investorMOIC: 7.0,
    });
    expect(result.ratchetTier).toBe('excellent');
    expect(result.performanceRatchetPct).toBeCloseTo(0.29);
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

// ── Bucket 1B: deferred advisory fee (restructured 2026-05-23) ─────────────
//
// The grant procurement fee (grant × 10%) is now paid from operating cash
// over 3 years starting from loanDisbursementYear (default: grantYear + 1),
// NOT deducted from grant proceeds in the grant approval year.
// This removes EU GBER eligibility risk.

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
  const expectedAnnual = expectedTotal / 3;
  const startYear = DEFAULT_GRANT_APPROVAL_YEAR + 1; // 2028
  const paymentYears = [startYear, startYear + 1, startYear + 2]; // [2028, 2029, 2030]

  it('computeFounderStake: bucket1B_deferredAdvisoryFee equals grant × 10% when grant approved', () => {
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.12,
      investorMOIC: 3.0,
    });
    expect(result.bucket1B_deferredAdvisoryFee).toBeCloseTo(expectedTotal, 0);
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

  it('computeFounderStake: bucket1B_annualPayment equals total / 3 when grant approved', () => {
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.12,
      investorMOIC: 3.0,
    });
    expect(result.bucket1B_annualPayment).toBeCloseTo(expectedAnnual, 0);
  });

  it('computeFounderStake: bucket1B_paymentStartYear defaults to grantApprovalYear + 1', () => {
    const result = computeFounderStake({
      ...BASE_INPUT,
      grantApproved: true,
      investorIRR: 0.12,
      investorMOIC: 3.0,
    });
    expect(result.bucket1B_paymentStartYear).toBe(startYear);
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

  it('buildDistributionStream: annual deduction in each of the 3 payment years', () => {
    const scenario = makeScenario();
    const stream = buildDistributionStream(scenario, {
      deferredAdvisoryFee: expectedTotal,
      loanDisbursementYear: startYear,
    });
    for (const yr of paymentYears) {
      const row = stream.find((y) => y.year === yr);
      expect(row).toBeDefined();
      expect(row!.deferredAdvisoryFeePayment).toBeCloseTo(expectedAnnual, 0);
    }
  });

  it('buildDistributionStream: no deduction outside the 3 payment years', () => {
    const scenario = makeScenario();
    const stream = buildDistributionStream(scenario, {
      deferredAdvisoryFee: expectedTotal,
      loanDisbursementYear: startYear,
    });
    const nonPaymentRows = stream.filter((y) => !paymentYears.includes(y.year));
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
    // 3 years × (expectedTotal / 3) = expectedTotal
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
