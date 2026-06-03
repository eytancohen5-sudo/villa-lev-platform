// opCoSeniorDefer2029 engine tests
//
// When assumptions.opCoSeniorDefer2029 === true:
//   - Year 2029 senior OpCo floor obligation = €0 (no payment attempted, no accrual)
//   - The currentYearFloor is added to floorAccrualBalance by the caller (deferredFloor field)
//   - This means in 2030: floorAccrualIn includes BOTH the normal 2029 accrual pathway
//     AND the deferred 2029 floor. The total obligation is doubled.
//
// Model reality (commercial path, BASE_CASE):
//   - 2029: ebitdaPreOpCo ≈ €132K, DS ≈ €210K → residualAfterDS = 0
//     Both flag=true and flag=false produce opCoSeniorPaid = 0 in 2029.
//     Difference: flag=false accrues the floor (floorAccrual = 150K);
//                 flag=true  does NOT accrue it (floorAccrual = 0, deferredFloor = 150K).
//   - 2030: ebitdaPreOpCo ≈ €226K, DS ≈ €363K → residualAfterDS = 0
//     Neither can pay the obligation. But the obligation carried INTO 2030 differs:
//     flag=false: 2030 floorAccrualIn = 150K (accrued from 2029)
//     flag=true:  2030 floorAccrualIn = 300K (150K normal 2030 + 150K deferred 2029 injected into floorAccrualBalance)
//
// All tests operate on the commercial financing path.
// No live external calls — model runs entirely in-memory.

import { describe, it, expect } from 'vitest';
import { computeModel } from '@/lib/engine/model';
import { BASE_CASE, PROJECT_CONSTANTS } from '@/lib/engine/defaults';
import type { ModelAssumptions } from '@/lib/engine/types';

const { OPENING_YEAR } = PROJECT_CONSTANTS;
const NEXT_YEAR = OPENING_YEAR + 1; // 2030

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build assumptions for the opCoSeniorDefer2029 feature.
 * opCoFloor = 50K (total obligation per year = 50K × 3 villas = 150K).
 * In 2029/2030 (ramp years), residualAfterDS ≈ 0 on commercial path,
 * so the floor is never fully paid — but the accrual/defer mechanics differ
 * between flag=true and flag=false.
 */
function makeAssumptions(flag: boolean): ModelAssumptions {
  return {
    ...BASE_CASE,
    financingPath: 'commercial',
    opCoFee: {
      ...BASE_CASE.opCoFee,
      enabled: true,
    },
    opCoFloor: 50_000,
    opCoSeniorDefer2029: flag,
  };
}

/**
 * Variant with a payable floor: opCoFloor = 1000 (€1K/villa → €3K total),
 * and loanCoverageRate = 0 (zero debt → zero DS → residualAfterDS = ebitdaPreOpCo ≈ 132K).
 * This guarantees residualAfterDS >> opCoFloor * villaCount in 2029 and 2030,
 * so opCoSeniorPaid is non-zero and the conservation test is meaningful.
 *
 * Note: commercialScenario always uses commercialDebt regardless of financingPath,
 * so we zero out the debt by setting loanCoverageRate = 0.
 */
function makeAssumptionsPayable(flag: boolean): ModelAssumptions {
  return {
    ...BASE_CASE,
    financingPath: 'commercial',
    opCoFee: {
      ...BASE_CASE.opCoFee,
      enabled: true,
    },
    opCoFloor: 1_000,
    opCoSeniorDefer2029: flag,
    commercialLoan: {
      ...BASE_CASE.commercialLoan,
      loanCoverageRate: 0, // zero loan → zero DS → full residual available
    },
  };
}

/** Extract the commercial scenario P&L rows. */
function pnl(a: ModelAssumptions) {
  return computeModel(a).commercialScenario.pnl;
}

/** Get a P&L row for a specific year. */
function rowFor(a: ModelAssumptions, year: number) {
  const rows = pnl(a);
  const row = rows.find((r) => r.year === year);
  if (!row) throw new Error(`No P&L row for year ${year}`);
  return row;
}

/** Get the total villa count from the portfolio. */
function totalVillaCount(a: ModelAssumptions) {
  return a.portfolio.reduce((sum, p) => sum + p.count, 0);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('opCoSeniorDefer2029 — engine feature', () => {

  // 1. flag=false: 2029 floorAccrual > 0 (floor obligation accrues because residualAfterDS=0)
  it('flag false: 2029 floorAccrual > 0 — floor obligation accrues when residual insufficient', () => {
    const a = makeAssumptions(false);
    const row2029 = rowFor(a, OPENING_YEAR);
    const expectedFloor = 50_000 * totalVillaCount(a); // 150K
    // With residualAfterDS ≈ 0, opCoSeniorPaid = 0 and floorAccrual = 150K
    expect(row2029.floorAccrual).toBeCloseTo(expectedFloor, 0);
  });

  // 2. flag=true: 2029 opCoSeniorPaid is 0 (floor zeroed — no payment attempted)
  it('flag true: 2029 opCoSeniorPaid is 0', () => {
    const a = makeAssumptions(true);
    const row2029 = rowFor(a, OPENING_YEAR);
    expect(row2029.opCoSeniorPaid).toBe(0);
  });

  // 3. flag=true: 2029 floorAccrual = 0 (no normal accrual — deferred instead)
  // The deferredFloor is folded into floorAccrualBalance by the Pass 1/Pass 2 loops,
  // NOT via newFloorAccrual. So the row's floorAccrual is 0, not 150K.
  it('flag true: 2029 floorAccrual is 0 — obligation deferred via floorAccrualBalance, not accrual', () => {
    const a = makeAssumptions(true);
    const row2029 = rowFor(a, OPENING_YEAR);
    expect(row2029.floorAccrual).toBe(0);
  });

  // 4. flag=true: conservation — sum(2029+2030 opCoSeniorPaid) equals flag=false sum
  //
  // The original BASE_CASE variant of this test was vacuous: both flag=true and
  // flag=false produce opCoSeniorPaid = 0 in both years (residualAfterDS ≈ 0 with
  // full commercial DS ≈ €210K, ebitdaPreOpCo ≈ €132K), so "0 = 0" always passed.
  //
  // This replacement uses makeAssumptionsPayable (loanCoverageRate=0 → DS=0,
  // opCoFloor=€1K → total obligation €3K/yr) so residualAfterDS ≈ ebitdaPreOpCo ≈ €132K
  // and opCoSeniorPaid = €3K each year (fully payable).
  //
  // Conservation property: regardless of when the floor is recognised (2029 for flag=false,
  // deferred to 2030 for flag=true), the cumulative opCoSeniorPaid over the two years must
  // be equal — deferral shifts timing, not total amount.
  //
  // Sanity guard: assert payable_sumOff > 0 to prevent a vacuous pass.
  it('flag true: conservation — sum(2029+2030) equals flag=false sum (payable scenario, non-zero guard)', () => {
    const aOn  = makeAssumptionsPayable(true);
    const aOff = makeAssumptionsPayable(false);
    const row2029On  = rowFor(aOn,  OPENING_YEAR);
    const row2030On  = rowFor(aOn,  NEXT_YEAR);
    const row2029Off = rowFor(aOff, OPENING_YEAR);
    const row2030Off = rowFor(aOff, NEXT_YEAR);

    const sumOn  = row2029On.opCoSeniorPaid  + row2030On.opCoSeniorPaid;
    const sumOff = row2029Off.opCoSeniorPaid + row2030Off.opCoSeniorPaid;

    // Sanity: the flag=false path must have actually paid something — if this
    // fails the test fixture itself is broken (residualAfterDS is still 0).
    expect(sumOff).toBeGreaterThan(0);

    // Conservation: deferral only shifts timing, not total cumulative payment.
    expect(sumOn).toBeCloseTo(sumOff, 0);
  });

  // 5. flag=false: 2030 opCoSeniorPaid unchanged — the flag does not bleed over when off
  it('flag false: 2030 opCoSeniorPaid unchanged — no bleed-over when flag off', () => {
    const aOff = makeAssumptions(false);
    const row2030Off = rowFor(aOff, NEXT_YEAR);
    // With flag=false and residualAfterDS ≈ 0 in 2030, opCoSeniorPaid = 0
    // (the floor obligation is 150K+150K=300K accrual, but residual = 0)
    expect(row2030Off.opCoSeniorPaid).toBe(0);
  });

  // 6. flag=true: 2029 floorAccrual is 0 — no double-count via newFloorAccrual
  // The deferred amount travels via floorAccrualBalance, NOT via newFloorAccrual.
  // With effectiveYearFloor=0, totalFloorObligation=0, so newFloorAccrual = 0 - 0 = 0.
  it('flag true: 2029 floorAccrual is 0 — deferred via floorAccrualBalance, not newFloorAccrual', () => {
    const a = makeAssumptions(true);
    const row2029 = rowFor(a, OPENING_YEAR);
    expect(row2029.floorAccrual).toBe(0);
  });

  // 7. flag=true: 2030 floorAccrual is HIGHER than flag=false 2030 floorAccrual
  // When flag=true, floorAccrualBalance going into 2030 = deferred 2029 (150K).
  // 2030 currentYearFloor = 150K (normal). totalFloorObligation = 150K+150K = 300K.
  // residualAfterDS ≈ 0, so all 300K accrues. flag=false 2030: 300K accrual (150K new + 150K carried from 2029 normal accrual).
  // Both end up with 300K accrued in 2030, but via different paths:
  //   flag=false: 2029 accrues 150K → 2030 carries that + adds 150K new = 300K accrual
  //   flag=true:  2029 deferred 150K folded into balance → 2030 carries that + adds 150K new = 300K accrual
  // The floorAccrual in 2030 should be the same (300K) because both carry the same obligation forward.
  //
  // NOTE on floorAccrualIn in 2029: by design, floorAccrualIn = 0 when year = OPENING_YEAR.
  // The model initialises floorAccrualBalance = 0 at the start of the P&L loop and passes it
  // as the third argument to computePnLYear. Since 2029 is the first operational year there is
  // no prior accrual balance — floorAccrualIn is always 0 going into 2029. This is expected
  // and correct; it does NOT make test 7 vacuous because the test targets 2030, where the
  // deferred/accrued 150K from 2029 is folded into floorAccrualBalance before the 2030 call.
  it('flag true: 2030 total accrual equals 2 × floor (deferred 2029 + normal 2030)', () => {
    const a = makeAssumptions(true);
    const row2030 = rowFor(a, NEXT_YEAR);
    const expectedFloor = 50_000 * totalVillaCount(a); // 150K per year
    // 2030 floorAccrual = 300K (nothing paid, 300K accrues)
    expect(row2030.floorAccrual).toBeCloseTo(expectedFloor * 2, 0);
  });

  // 8. Golden backward-compat: flag absent produces identical stabilised DSCR as flag=false
  // Use stabilisedDSCR (keyMetrics.stabilisedDSCR, not keyMetrics.dscr — that field doesn't exist).
  it('golden backward-compat: flag absent produces identical stabilised DSCR as flag=false', () => {
    const aAbsent: ModelAssumptions = {
      ...BASE_CASE,
      financingPath: 'commercial',
      opCoFee: { ...BASE_CASE.opCoFee, enabled: true },
      opCoFloor: 50_000,
    };
    const aFalse: ModelAssumptions = {
      ...BASE_CASE,
      financingPath: 'commercial',
      opCoFee: { ...BASE_CASE.opCoFee, enabled: true },
      opCoFloor: 50_000,
      opCoSeniorDefer2029: false,
    };
    const dscrAbsent = computeModel(aAbsent).keyMetrics.stabilisedDSCR;
    const dscrFalse  = computeModel(aFalse).keyMetrics.stabilisedDSCR;
    expect(dscrAbsent).toBeCloseTo(dscrFalse, 4);
  });
});
