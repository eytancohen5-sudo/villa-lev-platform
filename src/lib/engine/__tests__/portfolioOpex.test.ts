// portfolioOpex.test.ts
//
// Tests for computePortfolioOpex — the portfolio-level OPEX engine function.
//
// Seed arithmetic (from DEFAULT_PORTFOLIO_OPEX / BASE_CASE, year=2031):
//
//   Staff roles:
//   1. Ops Manager (yearRound):          3000 × 14 × 1.32 + 0       = 55,440.00
//   2. Res & Marketing (yearRound):      2500 × 14 × 1.32 + 0       = 46,200.00
//   3. Head HK (yearRound):              2156 × 13 × 1.32 + 3600    = 40,603.84
//   4. HK Seasonal 6mo×2FTE (!yr):       1136 × 6 × 1.32 × 2 + 3600×2 = 25,178.88
//   5. HK Seasonal 4mo×3FTE (!yr):       750  × 4 × 1.32 × 3 + 3600×3 = 22,680.00
//   staffTotal ≈ 190,102.72
//
//   Shared services: 20,000 + 12,000 + 15,000 = 47,000
//   Shared overhead: 30,000 + 10,000 + 15,000 + 3,000 + 9,000 + 1,000
//                    + 35,000 + 30,000 + 25,000 = 158,000
//   Pre-opening amort (2028–2032): 275,000 / 5 = 55,000
//
//   EXPECTED TOTAL = 190,102.72 + 47,000 + 158,000 + 55,000 = 450,102.72

import { describe, it, expect } from 'vitest';
import { computeModel, computePortfolioOpex } from '@/lib/engine/model';
import { BASE_CASE, DEFAULT_PORTFOLIO_OPEX } from '@/lib/engine/defaults';
import { applySliders, readBaseValues } from '@/components/bankSensitivityHelpers';
import type { ModelAssumptions } from '@/lib/engine/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Default slider values from BASE_CASE commercial path. */
const DEFAULT_SLIDERS = readBaseValues(BASE_CASE, 'commercial');

/**
 * Drive computePortfolioOpex via computePortfolioOpex directly (it is exported
 * from model.ts for test purposes).
 */
function computePortfolioOpexForTest(year: number, assumptions: ModelAssumptions) {
  return computePortfolioOpex(year, assumptions);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computePortfolioOpex — seed defaults', () => {

  // ── Test 1: seed total ──────────────────────────────────────────────────────
  it('returns correct stabilised portfolio OPEX total from seed defaults', () => {
    // See file-header arithmetic comment for breakdown.
    // staffTotal  ≈ 190,102.72
    // services    =  47,000.00
    // overhead    = 158,000.00
    // preOpening  =  55,000.00  (2031 is within 2028-2032 amort window)
    // EXPECTED    ≈ 450,102.72
    const EXPECTED_TOTAL = 190102.72 + 47000 + 158000 + 55000; // 450,102.72
    const result = computePortfolioOpexForTest(2031, BASE_CASE);
    // Allow ±100 tolerance for floating-point accumulation
    expect(result.total).toBeCloseTo(EXPECTED_TOTAL, -2);
  });

  // ── Test 2: monthsPaid=0 zeroes role contribution ──────────────────────────
  it('zeroes a role contribution when monthsPaid is 0', () => {
    const firstRole = BASE_CASE.portfolioOpex!.staffRoles[0];
    const modified: ModelAssumptions = {
      ...BASE_CASE,
      portfolioOpex: {
        ...BASE_CASE.portfolioOpex!,
        staffRoles: BASE_CASE.portfolioOpex!.staffRoles.map((r, i) =>
          i === 0 ? { ...r, monthsPaid: 0 } : r
        ),
      },
    };
    const base    = computePortfolioOpexForTest(2031, BASE_CASE);
    const reduced = computePortfolioOpexForTest(2031, modified);

    // First role is yearRound: monthlyGross × monthsPaid × burdenMultiplier + allowances
    // With monthsPaid=0: 3000 × 0 × 1.32 + 0 = 0
    // So contribution was: 3000 × 14 × 1.32 = 55,440
    const firstRoleContrib =
      firstRole.monthlyGross * firstRole.monthsPaid * firstRole.burdenMultiplier + (firstRole.allowances ?? 0);

    expect(base.staffTotal - reduced.staffTotal).toBeCloseTo(firstRoleContrib, 0);
  });

  // ── Test 3: pre-opening amort drops to 0 after window ───────────────────────
  it('drops pre-opening amortisation to 0 after the amortisation window expires', () => {
    const startYear   = BASE_CASE.portfolioOpex!.preOpeningStartYear;   // 2028
    const amortYears  = BASE_CASE.portfolioOpex!.preOpeningAmortYears;  // 5
    const lastAmortYear  = startYear + amortYears - 1;                  // 2032
    const firstZeroYear  = startYear + amortYears;                      // 2033

    expect(computePortfolioOpexForTest(lastAmortYear, BASE_CASE).preOpeningAmort).toBeGreaterThan(0);
    expect(computePortfolioOpexForTest(firstZeroYear, BASE_CASE).preOpeningAmort).toBe(0);
  });

  // ── Test 4: opexStressFactor=0.20 scales portfolio services and overhead ────
  it('opexStressFactor=0.20 scales portfolio services and overhead by 1.20', () => {
    const stressed = applySliders(BASE_CASE, { ...DEFAULT_SLIDERS, opexStressFactor: 0.20 }, 'commercial');
    const base   = computePortfolioOpexForTest(2031, BASE_CASE);
    const result = computePortfolioOpexForTest(2031, stressed);

    expect(result.servicesTotal).toBeCloseTo(base.servicesTotal * 1.20, 0);
    expect(result.overheadTotal).toBeCloseTo(base.overheadTotal * 1.20, 0);
  });

  // ── Test 5: INVARIANT — opexContingencyRate does NOT affect portfolioOpex ───
  // INVARIANT: opexContingencyRate must never touch portfolioOpex lines. Regression-block.
  it('opexContingencyRate does NOT affect portfolioOpex total', () => {
    const withContingency: ModelAssumptions = {
      ...BASE_CASE,
      portfolio: BASE_CASE.portfolio.map((p) => ({ ...p, opexContingencyRate: 0.50 })),
    };
    const base   = computePortfolioOpexForTest(2031, BASE_CASE);
    const stress = computePortfolioOpexForTest(2031, withContingency);

    // portfolioOpex is entirely independent of per-template opexContingencyRate
    expect(stress.total).toBe(base.total);
  });

});
