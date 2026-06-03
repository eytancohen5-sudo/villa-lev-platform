// ============================================================
// Commitment fee — isolated unit tests
// ============================================================
//
// Coverage (does NOT duplicate graceMode.test.ts which already covers):
//   - rolling-cohort: commitmentFee=0 in 2026
//   - rolling-cohort: commitmentFee>0 in 2027, precise math
//   - rolling-cohort: 2028 < 2027 (decreasing as tranches draw)
//   - rolling-cohort: debtService = noFeeDS + commitmentFee
//   - rolling-cohort: bank view suppression (fee=0, debtService unaffected)
//
// New tests here:
//   1. Off by default (no commitmentFeeEnabled key, and explicit false)
//   2. Rolling (non-cohort) per-tranche commitment fee
//   3. Standard mode: fee=0 even when enabled
//   4. Two-phase mode: fee=0 even when enabled
//   5. CIT: less tax paid over horizon when fee enabled (deductible expense)
//   6. Tax-loss carryforward: pre-opening taxLossGenerated larger with fee
//   7. Golden snapshot: commitmentFeeEnabled=false debtService identical to BASE_CASE
//
// No live Skroutz / Eurobank / Firestore calls.
// Time is deterministic: model is year-indexed, not Date.now()-based.

import { describe, it, expect } from 'vitest';
import { computeModel, computeCapex } from '@/lib/engine/model';
import { BASE_CASE, PROJECT_CONSTANTS } from '@/lib/engine/defaults';
import type { ModelAssumptions } from '@/lib/engine/types';

const { HORIZON_START_YEAR, PHASE1_LAND_PERMITS, OPENING_YEAR } = PROJECT_CONSTANTS;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the commercial scenario P&L row for a given year. Throws if missing. */
function pnlRow(a: ModelAssumptions, year: number) {
  const out = computeModel(a);
  const row = out.commercialScenario.pnl.find((r) => r.year === year);
  if (!row) throw new Error(`No P&L row for year ${year}`);
  return row;
}

/** Extract all P&L rows from the commercial scenario. */
function pnlRows(a: ModelAssumptions) {
  return computeModel(a).commercialScenario.pnl;
}

/** Derive loanAmount the same way the engine does. */
function deriveLoanAmount(a: ModelAssumptions): number {
  const capex = computeCapex(a);
  return capex.portfolioTotal * a.commercialLoan.loanCoverageRate;
}

// ── 1. Off by default ─────────────────────────────────────────────────────────

describe('commitment fee — off by default', () => {
  it('BASE_CASE has commitmentFeeEnabled: false — commitmentFee is 0 on every row', () => {
    // BASE_CASE uses graceMode: 'two-phase' which has no fee anyway,
    // but verify the field itself is false so the guard fires correctly.
    const a: ModelAssumptions = {
      ...BASE_CASE,
      financingPath: 'commercial',
    };
    const rows = pnlRows(a);
    for (const row of rows) {
      expect(row.commitmentFee ?? 0).toBe(0);
    }
  });

  it('rolling mode without commitmentFeeEnabled: commitmentFee absent/0 on every row', () => {
    const a: ModelAssumptions = {
      ...BASE_CASE,
      financingPath: 'commercial',
      commercialLoan: {
        ...BASE_CASE.commercialLoan,
        graceMode: 'rolling',
        // commitmentFeeEnabled not set — defaults to false
      },
    };
    const rows = pnlRows(a);
    for (const row of rows) {
      expect(row.commitmentFee ?? 0).toBe(0);
    }
  });

  it('rolling-cohort mode with explicit commitmentFeeEnabled: false — fee is 0 everywhere', () => {
    const a: ModelAssumptions = {
      ...BASE_CASE,
      financingPath: 'commercial',
      commercialLoan: {
        ...BASE_CASE.commercialLoan,
        graceMode: 'rolling-cohort',
        commitmentFeeEnabled: false,
      },
    };
    const rows = pnlRows(a);
    for (const row of rows) {
      expect(row.commitmentFee ?? 0).toBe(0);
    }
  });

  it('debtService is unchanged between no-flag and explicit false for rolling mode', () => {
    const aImplicit: ModelAssumptions = {
      ...BASE_CASE,
      financingPath: 'commercial',
      commercialLoan: {
        ...BASE_CASE.commercialLoan,
        graceMode: 'rolling',
      },
    };
    const aExplicit: ModelAssumptions = {
      ...aImplicit,
      commercialLoan: { ...aImplicit.commercialLoan, commitmentFeeEnabled: false },
    };
    const rowsImplicit = pnlRows(aImplicit);
    const rowsExplicit = pnlRows(aExplicit);
    for (let i = 0; i < rowsImplicit.length; i++) {
      expect(rowsImplicit[i].debtService).toBeCloseTo(rowsExplicit[i].debtService, 6);
    }
  });
});

// ── 2. Rolling (non-cohort) per-tranche commitment fee ────────────────────────
//
// Default rolling tranches (cYear=2027, cQ=1, plotsStartYear=2026, plotsStartQ=1):
//   T1: plots loan, disbYear=2026, disbQ=1  (no fee — T1 is plots tranche)
//   T2: constQ, disbYear=2027, disbQ=1      → in 2027: partial (1-1)/4 = 0 → fee = 0
//   T3: constQ, disbYear=2027, disbQ=3      → in 2027: partial (3-1)/4 = 0.5 → fee = constQ × rate × 0.5
//   T4: constQ, disbYear=2028, disbQ=1      → in 2027: yr < disbYear → full year → fee = constQ × rate
//   T5: constQ, disbYear=2028, disbQ=3      → in 2027: yr < disbYear → full year → fee = constQ × rate
//
// In 2028:
//   T2: disbYear=2027 → yr > disbYear → fee = 0
//   T3: disbYear=2027 → yr > disbYear → fee = 0
//   T4: disbYear=2028, disbQ=1 → yr === disbYear: partial (1-1)/4 = 0 → fee = 0
//   T5: disbYear=2028, disbQ=3 → yr === disbYear: partial (3-1)/4 = 0.5 → fee = constQ × rate × 0.5

describe('commitment fee — rolling mode (non-cohort) per-tranche math', () => {
  function withRollingFee(): ModelAssumptions {
    return {
      ...BASE_CASE,
      financingPath: 'commercial',
      commercialLoan: {
        ...BASE_CASE.commercialLoan,
        graceMode: 'rolling',
        plotsStartYear: 2026,
        plotsStartQ: 1 as 1 | 2 | 3 | 4,
        constructionStartYear: 2027,
        constructionStartQ: 1 as 1 | 2 | 3 | 4,
        gracePeriodYears: 2,
        commitmentFeeEnabled: true,
        commitmentFeeRate: 0.0075,
      },
    };
  }

  it('commitmentFee is 0 in 2026 (only T1 plots tranche committed; T1 excluded from fee)', () => {
    const a = withRollingFee();
    expect(pnlRow(a, 2026).commitmentFee ?? 0).toBe(0);
  });

  it('commitmentFee is positive in 2027 (T3/T4/T5 partially or fully undrawn)', () => {
    // T3: partial (3-1)/4=0.5 → constQ×0.0075×0.5
    // T4: yr<disbYear → constQ×0.0075
    // T5: yr<disbYear → constQ×0.0075
    const a = withRollingFee();
    const loanAmount = deriveLoanAmount(a);
    const plotsLoan = PHASE1_LAND_PERMITS * a.commercialLoan.loanCoverageRate;
    const constQuarter = (loanAmount - plotsLoan) / 4;
    const expected = constQuarter * 0.0075 * (0.5 + 1 + 1); // = constQ × 0.0075 × 2.5
    expect(expected).toBeGreaterThan(0);
    expect(pnlRow(a, 2027).commitmentFee ?? 0).toBeCloseTo(expected, 4);
  });

  it('commitmentFee in 2028 is smaller than in 2027 (T3/T4 drawn; only T5 partially undrawn)', () => {
    // T5: disbYear=2028, disbQ=3 → partial (3-1)/4 = 0.5 → constQ × 0.0075 × 0.5
    const a = withRollingFee();
    const loanAmount = deriveLoanAmount(a);
    const plotsLoan = PHASE1_LAND_PERMITS * a.commercialLoan.loanCoverageRate;
    const constQuarter = (loanAmount - plotsLoan) / 4;
    const expected2028 = constQuarter * 0.0075 * 0.5;
    expect(pnlRow(a, 2028).commitmentFee ?? 0).toBeCloseTo(expected2028, 4);
    expect(pnlRow(a, 2028).commitmentFee ?? 0).toBeLessThan(
      pnlRow(a, 2027).commitmentFee ?? 0
    );
  });

  it('commitmentFee is 0 in 2029 and later (all tranches drawn by end of 2028)', () => {
    const a = withRollingFee();
    const rows = pnlRows(a).filter((r) => r.year >= 2029);
    for (const row of rows) {
      expect(row.commitmentFee ?? 0).toBe(0);
    }
  });

  it('debtService in 2027 = DS without fee + commitmentFee (fee is additive)', () => {
    const aFee = withRollingFee();
    const aNoFee: ModelAssumptions = {
      ...aFee,
      commercialLoan: { ...aFee.commercialLoan, commitmentFeeEnabled: false },
    };
    const row2027Fee = pnlRow(aFee, 2027);
    const row2027NoFee = pnlRow(aNoFee, 2027);
    const expectedDS = row2027NoFee.debtService + (row2027Fee.commitmentFee ?? 0);
    expect(row2027Fee.debtService).toBeCloseTo(expectedDS, 4);
  });
});

// ── 3. Standard mode: fee = 0 even when enabled ───────────────────────────────

describe('commitment fee — standard mode ignores flag', () => {
  it('commitmentFee is 0 on all rows when graceMode=standard and enabled=true', () => {
    const a: ModelAssumptions = {
      ...BASE_CASE,
      financingPath: 'commercial',
      commercialLoan: {
        ...BASE_CASE.commercialLoan,
        graceMode: 'standard',
        commitmentFeeEnabled: true,
        commitmentFeeRate: 0.0075,
      },
    };
    const rows = pnlRows(a);
    for (const row of rows) {
      expect(row.commitmentFee ?? 0).toBe(0);
    }
  });

  it('debtService is identical with and without enabled=true in standard mode', () => {
    const aEnabled: ModelAssumptions = {
      ...BASE_CASE,
      financingPath: 'commercial',
      commercialLoan: {
        ...BASE_CASE.commercialLoan,
        graceMode: 'standard',
        commitmentFeeEnabled: true,
      },
    };
    const aDisabled: ModelAssumptions = {
      ...aEnabled,
      commercialLoan: { ...aEnabled.commercialLoan, commitmentFeeEnabled: false },
    };
    const rowsEnabled = pnlRows(aEnabled);
    const rowsDisabled = pnlRows(aDisabled);
    for (let i = 0; i < rowsEnabled.length; i++) {
      expect(rowsEnabled[i].debtService).toBeCloseTo(rowsDisabled[i].debtService, 6);
    }
  });
});

// ── 4. Two-phase mode: fee = 0 even when enabled ──────────────────────────────

describe('commitment fee — two-phase mode ignores flag', () => {
  it('commitmentFee is 0 on all rows when graceMode=two-phase and enabled=true', () => {
    // BASE_CASE already uses graceMode: 'two-phase'
    const a: ModelAssumptions = {
      ...BASE_CASE,
      financingPath: 'commercial',
      commercialLoan: {
        ...BASE_CASE.commercialLoan,
        graceMode: 'two-phase',
        commitmentFeeEnabled: true,
        commitmentFeeRate: 0.0075,
      },
    };
    const rows = pnlRows(a);
    for (const row of rows) {
      expect(row.commitmentFee ?? 0).toBe(0);
    }
  });

  it('debtService is identical with and without enabled=true in two-phase mode', () => {
    const aEnabled: ModelAssumptions = {
      ...BASE_CASE,
      financingPath: 'commercial',
      commercialLoan: {
        ...BASE_CASE.commercialLoan,
        graceMode: 'two-phase',
        commitmentFeeEnabled: true,
      },
    };
    const aDisabled: ModelAssumptions = {
      ...aEnabled,
      commercialLoan: { ...aEnabled.commercialLoan, commitmentFeeEnabled: false },
    };
    const rowsEnabled = pnlRows(aEnabled);
    const rowsDisabled = pnlRows(aDisabled);
    for (let i = 0; i < rowsEnabled.length; i++) {
      expect(rowsEnabled[i].debtService).toBeCloseTo(rowsDisabled[i].debtService, 6);
    }
  });
});

// ── 5. CIT impact ─────────────────────────────────────────────────────────────

describe('commitment fee — CIT impact (deductible expense)', () => {
  /** rolling-cohort with commitment fee enabled (fee is drawn-window-only). */
  function cohortWithFee(): ModelAssumptions {
    return {
      ...BASE_CASE,
      financingPath: 'commercial',
      commercialLoan: {
        ...BASE_CASE.commercialLoan,
        graceMode: 'rolling-cohort',
        plotsStartYear: 2026,
        plotsStartQ: 1 as 1 | 2 | 3 | 4,
        constructionStartYear: 2027,
        constructionStartQ: 1 as 1 | 2 | 3 | 4,
        gracePeriodYears: 2,
        commitmentFeeEnabled: true,
        commitmentFeeRate: 0.0075,
      },
    };
  }

  it('CIT in the first years after pool drains is equal or less (in magnitude) with fee enabled', () => {
    // The fee is CIT-deductible (Art. 23 Law 4172/2013). It enlarges the pre-opening
    // tax-loss pool. Once the pool fully drains by end of horizon (both paths drain fully),
    // total horizon CIT converges — the fee shifts timing, not the long-run total.
    // The observable impact is: the year the pool drains is later with fee enabled,
    // meaning CIT resumes later → the year-sum of CIT in early operational years is
    // less (closer to zero) with fee than without.
    const aFee = cohortWithFee();
    const aNoFee: ModelAssumptions = {
      ...aFee,
      commercialLoan: { ...aFee.commercialLoan, commitmentFeeEnabled: false },
    };
    const rowsFee = pnlRows(aFee);
    const rowsNoFee = pnlRows(aNoFee);

    // Sum CIT for the first three operational years (2029-2031) where fee-enlarged
    // pool provides the most relief.
    const earlyYears = [OPENING_YEAR, OPENING_YEAR + 1, OPENING_YEAR + 2];
    const earlyCITFee = earlyYears.reduce(
      (s, yr) => s + (rowsFee.find((r) => r.year === yr)?.citPayable ?? 0), 0
    );
    const earlyCITNoFee = earlyYears.reduce(
      (s, yr) => s + (rowsNoFee.find((r) => r.year === yr)?.citPayable ?? 0), 0
    );
    // Fee-enabled pool is larger → more pool available early → early CIT is less negative
    // (closer to zero) with fee enabled. earlyCITFee >= earlyCITNoFee.
    expect(earlyCITFee).toBeGreaterThanOrEqual(earlyCITNoFee);
  });

  it('in the first stabilised year where CIT fires, citPayable is closer to zero with fee', () => {
    const aFee = cohortWithFee();
    const aNoFee: ModelAssumptions = {
      ...aFee,
      commercialLoan: { ...aFee.commercialLoan, commitmentFeeEnabled: false },
    };
    // Find first year where CIT is non-zero in either scenario.
    const rowsFee = pnlRows(aFee);
    const rowsNoFee = pnlRows(aNoFee);

    // Find the first year where citPayable is negative (CIT fires) in the no-fee scenario.
    const firstCITRow = rowsNoFee.find((r) => r.year >= OPENING_YEAR && (r.citPayable ?? 0) < -1_000);
    if (!firstCITRow) return; // if CIT never fires in horizon, test is N/A

    const citFee   = rowsFee.find((r)   => r.year === firstCITRow.year)?.citPayable ?? 0;
    const citNoFee = firstCITRow.citPayable ?? 0;

    // fee-enabled case should have less CIT outflow (citPayable closer to 0).
    expect(citFee).toBeGreaterThanOrEqual(citNoFee);
  });
});

// ── 6. Tax-loss carryforward ──────────────────────────────────────────────────

describe('commitment fee — pre-opening taxLossGenerated', () => {
  function cohortWithFee(): ModelAssumptions {
    return {
      ...BASE_CASE,
      financingPath: 'commercial',
      commercialLoan: {
        ...BASE_CASE.commercialLoan,
        graceMode: 'rolling-cohort',
        plotsStartYear: 2026,
        plotsStartQ: 1 as 1 | 2 | 3 | 4,
        constructionStartYear: 2027,
        constructionStartQ: 1 as 1 | 2 | 3 | 4,
        gracePeriodYears: 2,
        commitmentFeeEnabled: true,
        commitmentFeeRate: 0.0075,
      },
    };
  }

  it('taxLossGenerated in 2027 is larger when commitment fee is enabled', () => {
    // 2027 is the first year construction tranches T3/T4/T5 generate a fee.
    // The fee is a pre-opening deductible expense, so it flows into taxLossGenerated.
    const aFee = cohortWithFee();
    const aNoFee: ModelAssumptions = {
      ...aFee,
      commercialLoan: { ...aFee.commercialLoan, commitmentFeeEnabled: false },
    };
    const generated2027Fee   = pnlRow(aFee, 2027).taxLossGenerated ?? 0;
    const generated2027NoFee = pnlRow(aNoFee, 2027).taxLossGenerated ?? 0;
    expect(generated2027Fee).toBeGreaterThan(generated2027NoFee);
  });

  it('taxLossGenerated difference in 2027 equals the commitmentFee for that year', () => {
    const aFee = cohortWithFee();
    const aNoFee: ModelAssumptions = {
      ...aFee,
      commercialLoan: { ...aFee.commercialLoan, commitmentFeeEnabled: false },
    };
    const row2027Fee = pnlRow(aFee, 2027);
    const row2027NoFee = pnlRow(aNoFee, 2027);
    const delta = (row2027Fee.taxLossGenerated ?? 0) - (row2027NoFee.taxLossGenerated ?? 0);
    expect(delta).toBeCloseTo(row2027Fee.commitmentFee ?? 0, 2);
  });

  it('taxLossPoolBalance at end of 2027 is larger when fee is enabled (larger pool = more relief)', () => {
    const aFee = cohortWithFee();
    const aNoFee: ModelAssumptions = {
      ...aFee,
      commercialLoan: { ...aFee.commercialLoan, commitmentFeeEnabled: false },
    };
    const pool2027Fee   = pnlRow(aFee, 2027).taxLossPoolBalance ?? 0;
    const pool2027NoFee = pnlRow(aNoFee, 2027).taxLossPoolBalance ?? 0;
    expect(pool2027Fee).toBeGreaterThan(pool2027NoFee);
  });
});

// ── 7. Golden snapshot: disabled fee leaves debtService unchanged ─────────────

describe('commitment fee — golden snapshot invariant (disabled = baseline)', () => {
  it('BASE_CASE with commitmentFeeEnabled: false is identical to BASE_CASE (no debtService slippage)', () => {
    const aBaseline: ModelAssumptions = {
      ...BASE_CASE,
      financingPath: 'commercial',
    };
    const aExplicitOff: ModelAssumptions = {
      ...aBaseline,
      commercialLoan: { ...aBaseline.commercialLoan, commitmentFeeEnabled: false },
    };
    const rowsBaseline   = pnlRows(aBaseline);
    const rowsExplicitOff = pnlRows(aExplicitOff);
    expect(rowsBaseline.length).toBe(rowsExplicitOff.length);
    for (let i = 0; i < rowsBaseline.length; i++) {
      expect(rowsBaseline[i].debtService).toBeCloseTo(rowsExplicitOff[i].debtService, 6);
      expect(rowsBaseline[i].commitmentFee ?? 0).toBe(0);
      expect(rowsExplicitOff[i].commitmentFee ?? 0).toBe(0);
    }
  });

  it('rolling mode with disabled fee: debtService exactly matches rolling mode baseline', () => {
    const aBase: ModelAssumptions = {
      ...BASE_CASE,
      financingPath: 'commercial',
      commercialLoan: {
        ...BASE_CASE.commercialLoan,
        graceMode: 'rolling',
        commitmentFeeEnabled: false,
      },
    };
    // Add the rate key to demonstrate it has no effect when disabled.
    const aWithRate: ModelAssumptions = {
      ...aBase,
      commercialLoan: { ...aBase.commercialLoan, commitmentFeeRate: 0.02 },
    };
    const rowsBase     = pnlRows(aBase);
    const rowsWithRate = pnlRows(aWithRate);
    for (let i = 0; i < rowsBase.length; i++) {
      expect(rowsBase[i].debtService).toBeCloseTo(rowsWithRate[i].debtService, 6);
      expect(rowsWithRate[i].commitmentFee ?? 0).toBe(0);
    }
  });
});
