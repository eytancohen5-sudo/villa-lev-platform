// Directed tests for the Bucket 1C ratchet — 3-tier structure.
//
// These tests pin the economics of the restructured RATCHET_TIERS:
//   miss      — IRR < 8%  → 0% ratchet  (merges old failure + below_pref)
//   pref_met  — 8–22% IRR → +9%
//   excellent — ≥ 22% IRR → +29% (no-grant differential removed)

import { describe, expect, it } from 'vitest';
import { computeFounderStake } from '@/lib/engine/founderWaterfall';

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
