// Tests for PROJECT_CONSTANTS relational invariants (defaults.ts).
// These pin the internal consistency of the 11-year horizon constants so
// that a careless edit to one field without updating its related fields
// is caught immediately.

import { describe, expect, it } from 'vitest';
import { PROJECT_CONSTANTS } from '@/lib/engine/defaults';

const {
  HORIZON_START_YEAR,
  GRACE_END_YEAR,
  OPENING_YEAR,
  FIRST_OPERATIONAL_YEAR,
  STABILISED_YEAR,
  HORIZON_END_YEAR,
  MIN_EXIT_YEAR,
  NIGHTS_GROWTH_BASE_YEAR,
  TEPIX_LOAN_CAP_EUR,
  COLLATERAL_TIERS,
  PHASE1_LAND_PERMITS,
} = PROJECT_CONSTANTS;

describe('PROJECT_CONSTANTS — relational invariants', () => {
  it('GRACE_END_YEAR === HORIZON_START_YEAR + 2 (documents gracePeriodYears relationship)', () => {
    expect(GRACE_END_YEAR).toBe(HORIZON_START_YEAR + 2);
  });

  it('OPENING_YEAR === GRACE_END_YEAR (construction finishes end of 2028, villa opens)', () => {
    expect(OPENING_YEAR).toBe(GRACE_END_YEAR);
  });

  it('FIRST_OPERATIONAL_YEAR === GRACE_END_YEAR + 1', () => {
    expect(FIRST_OPERATIONAL_YEAR).toBe(GRACE_END_YEAR + 1);
  });

  it('STABILISED_YEAR >= FIRST_OPERATIONAL_YEAR + 1', () => {
    expect(STABILISED_YEAR).toBeGreaterThanOrEqual(FIRST_OPERATIONAL_YEAR + 1);
  });

  it('MIN_EXIT_YEAR >= FIRST_OPERATIONAL_YEAR', () => {
    expect(MIN_EXIT_YEAR).toBeGreaterThanOrEqual(FIRST_OPERATIONAL_YEAR);
  });

  it('NIGHTS_GROWTH_BASE_YEAR === MIN_EXIT_YEAR (same value today — different concepts)', () => {
    expect(NIGHTS_GROWTH_BASE_YEAR).toBe(MIN_EXIT_YEAR);
  });

  it('HORIZON_END_YEAR > MIN_EXIT_YEAR', () => {
    expect(HORIZON_END_YEAR).toBeGreaterThan(MIN_EXIT_YEAR);
  });

  it('TEPIX_LOAN_CAP_EUR === 8_000_000 (pins the TEPIX III program rule)', () => {
    expect(TEPIX_LOAN_CAP_EUR).toBe(8_000_000);
  });

  it('COLLATERAL_TIERS.stress < COLLATERAL_TIERS.market (ordering invariant)', () => {
    expect(COLLATERAL_TIERS.stress).toBeLessThan(COLLATERAL_TIERS.market);
  });

  it('COLLATERAL_TIERS.market < COLLATERAL_TIERS.optimistic', () => {
    expect(COLLATERAL_TIERS.market).toBeLessThan(COLLATERAL_TIERS.optimistic);
  });

  it('PHASE1_LAND_PERMITS > 0 (sanity)', () => {
    expect(PHASE1_LAND_PERMITS).toBeGreaterThan(0);
  });

  it('horizon array length: HORIZON_END_YEAR - HORIZON_START_YEAR + 1 === 11', () => {
    expect(HORIZON_END_YEAR - HORIZON_START_YEAR + 1).toBe(11);
  });
});
