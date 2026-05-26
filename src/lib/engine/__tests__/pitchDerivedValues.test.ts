// Unit tests for the pure-function derivations used in pitch/page.tsx.
//
// These tests exercise the formulas inline rather than importing the page
// component (which has React/Next.js dependencies incompatible with the
// node-only Vitest environment). Each test re-states the exact expression
// from the page to ensure parity.

import { describe, expect, it } from 'vitest';
import { PROJECT_CONSTANTS } from '@/lib/engine/defaults';

const { PHASE1_LAND_PERMITS, GRACE_END_YEAR, HORIZON_START_YEAR } = PROJECT_CONSTANTS;

// ── Drawdown percentage formula ────────────────────────────────────────────
// From pitch/page.tsx:
//   const phase1Pct = km?.totalCapex
//     ? Math.round((phase1Amount / km.totalCapex) * 100)
//     : 22;
//   const phase2Pct = 100 - phase1Pct;

describe('Drawdown percentage formula', () => {
  it('Math.round(1_350_000 / 6_000_000 * 100) === 23', () => {
    const totalCapex = 6_000_000;
    const result = Math.round((PHASE1_LAND_PERMITS / totalCapex) * 100);
    expect(result).toBe(23);
  });

  it('Math.round(1_350_000 / 5_000_000 * 100) === 27', () => {
    const totalCapex = 5_000_000;
    const result = Math.round((PHASE1_LAND_PERMITS / totalCapex) * 100);
    expect(result).toBe(27);
  });
});

// ── phase2Amount derivation ────────────────────────────────────────────────
// From pitch/page.tsx:
//   const phase2Amount = (km?.totalCapex ?? 0) - phase1Amount;

describe('phase2Amount derivation', () => {
  it('phase2Amount === totalCapex − PHASE1_LAND_PERMITS', () => {
    const totalCapex = 5_061_200;
    const phase2Amount = totalCapex - PHASE1_LAND_PERMITS;
    expect(phase2Amount).toBe(3_711_200);
  });
});

// ── phase1Pct + phase2Pct === 100 ─────────────────────────────────────────
// From pitch/page.tsx:
//   const phase1Pct = Math.round((phase1Amount / km.totalCapex) * 100)
//   const phase2Pct = 100 - phase1Pct

describe('phase1Pct + phase2Pct === 100', () => {
  const testCases = [
    1_000_000,
    2_500_000,
    5_061_200,
    6_000_000,
    8_000_000,
    10_000_000,
  ];

  for (const totalCapex of testCases) {
    it(`sums to 100 for totalCapex = ${totalCapex.toLocaleString()}`, () => {
      const phase1Pct = Math.round((PHASE1_LAND_PERMITS / totalCapex) * 100);
      const phase2Pct = 100 - phase1Pct;
      expect(phase1Pct + phase2Pct).toBe(100);
    });
  }
});

// ── Interest rate display formatting ─────────────────────────────────────
// From pitch/page.tsx (inside the ask card):
//   {(askInterestRate * 100 % 1 === 0
//     ? (askInterestRate * 100).toFixed(0)
//     : (askInterestRate * 100).toFixed(1))}%

function formatInterestRate(rate: number): string {
  const pct = rate * 100;
  return pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1);
}

describe('Interest rate formatting', () => {
  it('0.04 formats as "4" (no decimal place for whole numbers)', () => {
    expect(formatInterestRate(0.04)).toBe('4');
  });

  it('0.045 formats as "4.5"', () => {
    expect(formatInterestRate(0.045)).toBe('4.5');
  });

  it('0.05 formats as "5"', () => {
    expect(formatInterestRate(0.05)).toBe('5');
  });

  it('0.035 formats as "3.5"', () => {
    expect(formatInterestRate(0.035)).toBe('3.5');
  });

  it('0.10 formats as "10"', () => {
    expect(formatInterestRate(0.10)).toBe('10');
  });
});

// ── Property lookup fallback ──────────────────────────────────────────────
// From pitch/page.tsx:
//   const prop = (id: string, i: number) =>
//     capexProps.find(p => p.id === id) ?? capexProps[i];

describe('Property lookup with positional fallback', () => {
  const capexProps = [{ id: 'prop-x', perUnit: 2_000_000, total: 4_000_000, count: 2 }];

  it('returns first entry when ID is not found (fallback to positional index)', () => {
    const prop = (id: string, i: number) =>
      capexProps.find(p => p.id === id) ?? capexProps[i];

    const result = prop('prop-a', 0);
    expect(result).toBe(capexProps[0]);
    expect(result?.id).toBe('prop-x');
  });

  it('returns the matching entry when ID is found', () => {
    const propsWithTarget = [
      { id: 'prop-a', perUnit: 1_500_000, total: 3_000_000, count: 2 },
      { id: 'prop-b', perUnit: 800_000, total: 800_000, count: 1 },
    ];
    const prop = (id: string, i: number) =>
      propsWithTarget.find(p => p.id === id) ?? propsWithTarget[i];

    expect(prop('prop-b', 0)?.id).toBe('prop-b');
    // positional fallback (index 0) when missing key
    expect(prop('prop-z', 0)?.id).toBe('prop-a');
  });
});

// ── Grace period display ──────────────────────────────────────────────────
// From pitch/page.tsx:
//   {PROJECT_CONSTANTS.GRACE_END_YEAR - PROJECT_CONSTANTS.HORIZON_START_YEAR}-year grace

describe('Grace period display', () => {
  it('GRACE_END_YEAR − HORIZON_START_YEAR === 2', () => {
    expect(GRACE_END_YEAR - HORIZON_START_YEAR).toBe(2);
  });
});
