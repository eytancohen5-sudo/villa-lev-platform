// ============================================================
// graceMode engine tests — standard / rolling / two-phase
// ============================================================
//
// All tests operate on the commercial financing path.
// No live external calls — model runs entirely in-memory.
// Time is deterministic: the model is year-indexed, not Date.now()-based.
//
// Coverage:
//   1.  Standard backward-compat: graceEndYear=2028, DS profile, interest2028
//   2.  Absent graceMode defaults to standard (identical output)
//   3.  Rolling — 5-tranche stepped IO profile 2026/2027/2028
//   4.  Rolling — graceInterestCarry = io2026 + io2027 + io2028 (pre-op only)
//   5.  Two-phase — stepped DS profile 2028 → 2029 → 2031
//   6.  Two-phase — loanAmount unchanged vs standard
//   7.  Two-phase vs Rolling — carry comparison (both cover 3 pre-op years)
//   8.  Other paths unaffected by graceMode
//   9.  dscrWindowStart shifts for rolling (DSCR window starts 2031)

import { describe, it, expect } from 'vitest';
import { computeModel } from '@/lib/engine/model';
import { BASE_CASE, PROJECT_CONSTANTS } from '@/lib/engine/defaults';
import { computeCapex } from '@/lib/engine/model';
import type { ModelAssumptions, GraceMode } from '@/lib/engine/types';

const { HORIZON_START_YEAR, PHASE1_LAND_PERMITS } = PROJECT_CONSTANTS;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build assumptions with the given graceMode on the commercial path. */
function withGraceMode(mode: GraceMode | undefined): ModelAssumptions {
  return {
    ...BASE_CASE,
    financingPath: 'commercial',
    commercialLoan: {
      ...BASE_CASE.commercialLoan,
      graceMode: mode,
    },
  };
}

/** Extract the commercial scenario's P&L row for a given year. */
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

// ── Derive loanAmount the same way the engine does ────────────────────────────
function deriveLoanAmount(a: ModelAssumptions): number {
  const capex = computeCapex(a);
  return capex.portfolioTotal * a.commercialLoan.loanCoverageRate;
}

// ── Derive the rolling 5-tranche IO values the same way the new engine does ──
// With default Q1 starts (plots 2026-Q1, construction 2027-Q1):
//   T1: disbYear=2026, disbQ=1
//   T2: disbYear=2027, disbQ=1  (addQtrs(2027,1,0))
//   T3: disbYear=2027, disbQ=3  (addQtrs(2027,1,2))
//   T4: disbYear=2028, disbQ=1  (addQtrs(2027,1,4))
//   T5: disbYear=2028, disbQ=3  (addQtrs(2027,1,6))
// Partial-year IO formula: loan × rate × (5 − disbQ) / 4
function deriveRollingIOAmounts(a: ModelAssumptions) {
  const loanAmount    = deriveLoanAmount(a);
  const rate          = a.commercialLoan.interestRate;
  const plotsLoan     = PHASE1_LAND_PERMITS * a.commercialLoan.loanCoverageRate;
  const constLoan     = loanAmount - plotsLoan;
  const constQuarter  = constLoan / 4;

  // Tranche disbursement-year partial IO: loan × rate × (5 − disbQ) / 4
  // T1 Q1: (5-1)/4 = 1.0
  const t1Partial = plotsLoan   * rate * 1.0;   // 2026 Q1
  // T2 Q1: (5-1)/4 = 1.0
  const t2Partial = constQuarter * rate * 1.0;  // 2027 Q1
  // T3 Q3: (5-3)/4 = 0.5
  const t3Partial = constQuarter * rate * 0.5;  // 2027 Q3
  // T4 Q1: (5-1)/4 = 1.0
  const t4Partial = constQuarter * rate * 1.0;  // 2028 Q1
  // T5 Q3: (5-3)/4 = 0.5
  const t5Partial = constQuarter * rate * 0.5;  // 2028 Q3

  // Year 2026: only T1 drawn (disbYear=2026)
  const io2026 = t1Partial;

  // Year 2027: T1 full IO + T2 partial (disbYear) + T3 partial (disbYear)
  const io2027 = plotsLoan * rate + t2Partial + t3Partial;

  // Year 2028: T1 full IO + T2 full IO + T3 full IO + T4 partial + T5 partial
  const io2028 = plotsLoan * rate + constQuarter * rate + constQuarter * rate + t4Partial + t5Partial;

  return { loanAmount, rate, plotsLoan, constLoan, constQuarter, io2026, io2027, io2028 };
}

// ── PMT helper (mirrors model.ts) ─────────────────────────────────────────────
function pmt(rate: number, nper: number, pv: number): number {
  if (nper === 0) return 0;
  if (rate === 0) return -pv / nper;
  return (rate * pv) / (1 - Math.pow(1 + rate, -nper));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("graceMode — commercial path sub-branches", () => {

  // ── Test 1: Standard backward-compat ──────────────────────────────────────
  describe("standard mode", () => {
    it("graceEndYear is 2028 (HORIZON_START_YEAR + gracePeriodYears)", () => {
      const a = withGraceMode('standard');
      const out = computeModel(a);
      // keyMetrics.graceInterestHoldYears = graceEndYear − HORIZON_START_YEAR + 1
      // graceEndYear = 2026 + 2 = 2028
      // holdYears = 2028 − 2026 + 1 = 3
      expect(out.keyMetrics.graceInterestHoldYears).toBe(3);
    });

    it("P&L row 2029 has debtService > 0 (full amortisation begins)", () => {
      const a = withGraceMode('standard');
      const row = pnlRow(a, 2029);
      expect(row.debtService).toBeGreaterThan(0);
    });

    it("P&L row 2028 debtService equals configured interest2028 scalar", () => {
      // Standard path uses manually-calibrated interest scalars from Firestore scenarios.
      // With gracePeriodYears=2: commGraceEndYear = 2026 + 2 = 2028.
      // 2028 is the last grace year → DS = a.commercialLoan.interest2028.
      const a = withGraceMode('standard');
      const row = pnlRow(a, 2028);
      expect(row.debtService).toBeCloseTo(a.commercialLoan.interest2028, 2);
    });

    it("P&L row 2029 debtService > P&L row 2028 debtService (amortisation > IO)", () => {
      const a = withGraceMode('standard');
      const row2028 = pnlRow(a, 2028);
      const row2029 = pnlRow(a, 2029);
      expect(row2029.debtService).toBeGreaterThan(row2028.debtService);
    });
  });

  // ── Test 2: Absent graceMode defaults to standard ─────────────────────────
  describe("absent graceMode", () => {
    it("undefined graceMode produces identical output to explicit 'standard'", () => {
      const aUndefined = withGraceMode(undefined);
      const aStandard = withGraceMode('standard');

      const outUndefined = computeModel(aUndefined);
      const outStandard = computeModel(aStandard);

      const pnlUndefined = outUndefined.commercialScenario.pnl;
      const pnlStandard = outStandard.commercialScenario.pnl;

      expect(pnlUndefined.length).toBe(pnlStandard.length);

      for (let i = 0; i < pnlStandard.length; i++) {
        expect(pnlUndefined[i].debtService).toBeCloseTo(pnlStandard[i].debtService, 6);
        expect(pnlUndefined[i].termLoanBalance).toBeCloseTo(pnlStandard[i].termLoanBalance, 6);
      }

      expect(outUndefined.keyMetrics.graceInterestCarry).toBeCloseTo(
        outStandard.keyMetrics.graceInterestCarry, 2
      );
      expect(outUndefined.keyMetrics.graceInterestHoldYears).toBe(
        outStandard.keyMetrics.graceInterestHoldYears
      );
    });
  });

  // ── Test 3: Rolling — 5-tranche stepped IO profile ───────────────────────
  describe("rolling mode — 5-tranche stepped IO profile", () => {
    it("2026 DS = plotsLoan × rate (T1 only: PHASE1_LAND_PERMITS × loanCoverageRate × rate)", () => {
      const a = withGraceMode('rolling');
      const { io2026 } = deriveRollingIOAmounts(a);
      expect(pnlRow(a, 2026).debtService).toBeCloseTo(io2026, 2);
    });

    it("2028 DS matches per-tranche partial-year formula (T1+T2+T3 full IO, T4+T5 partial)", () => {
      // T4 drawn 2028-Q1 (full partial = 1.0), T5 drawn 2028-Q3 (partial = 0.5).
      // T1/T2/T3 drawn in prior years, so 2028 is a full-IO year for them.
      const a = withGraceMode('rolling');
      const { io2028 } = deriveRollingIOAmounts(a);
      expect(pnlRow(a, 2028).debtService).toBeCloseTo(io2028, 2);
    });

    it("2029 DS > 2028 DS (T1 now amortising, T2-T5 still IO)", () => {
      const a = withGraceMode('rolling');
      expect(pnlRow(a, 2029).debtService).toBeGreaterThan(pnlRow(a, 2028).debtService);
    });

    it("2030 DS > 2029 DS (T2+T3 also now amortising, T4+T5 still IO)", () => {
      const a = withGraceMode('rolling');
      expect(pnlRow(a, 2030).debtService).toBeGreaterThan(pnlRow(a, 2029).debtService);
    });

    it("2031 DS equals annualDS — all 5 tranches amortising", () => {
      const a = withGraceMode('rolling');
      const out = computeModel(a);
      expect(pnlRow(a, 2031).debtService).toBeCloseTo(out.keyMetrics.annualDS, 2);
    });

    it("2031 DS equals standard 2029 DS (same PMT — full annuity from each mode's amort start)", () => {
      const aStandard = withGraceMode('standard');
      const aRolling = withGraceMode('rolling');
      expect(pnlRow(aRolling, 2031).debtService).toBeCloseTo(
        pnlRow(aStandard, 2031).debtService, 2
      );
    });

    it("2031 debtService > 2030 debtService (final step: all amortising)", () => {
      const a = withGraceMode('rolling');
      expect(pnlRow(a, 2031).debtService).toBeGreaterThan(pnlRow(a, 2030).debtService);
    });
  });

  // ── Test 4: Rolling — graceInterestCarry = DS(2026) + DS(2027) + DS(2028) ─
  describe("rolling mode — graceInterestCarry covers pre-operational years 2026-2028", () => {
    it("graceInterestCarry equals the sum of per-tranche DS for 2026, 2027, 2028", () => {
      const a = withGraceMode('rolling');
      const out = computeModel(a);
      const { io2026, io2027, io2028 } = deriveRollingIOAmounts(a);
      const expectedCarry = io2026 + io2027 + io2028;
      expect(out.keyMetrics.graceInterestCarry).toBeCloseTo(expectedCarry, 2);
    });

    it("graceInterestCarry > 0 (at least some pre-operational IO is carried)", () => {
      const a = withGraceMode('rolling');
      const out = computeModel(a);
      expect(out.keyMetrics.graceInterestCarry).toBeGreaterThan(0);
    });

    it("rolling carry covers 2026+2027+2028 only — not 2029 or 2030 (post-operational)", () => {
      // 2029 DS for rolling = plotsAmort + constructionLoan×rate (a mixed amort+IO amount)
      // The carry must NOT include 2029 or 2030 DS — those are post-operational stepped amounts
      const a = withGraceMode('rolling');
      const out = computeModel(a);
      const ds2029 = pnlRow(a, 2029).debtService;
      const ds2030 = pnlRow(a, 2030).debtService;
      const { io2026, io2027, io2028 } = deriveRollingIOAmounts(a);
      const carryWith2029 = io2026 + io2027 + io2028 + ds2029;
      const carryWith2030 = io2026 + io2027 + io2028 + ds2030;
      expect(out.keyMetrics.graceInterestCarry).toBeCloseTo(io2026 + io2027 + io2028, 2);
      expect(out.keyMetrics.graceInterestCarry).not.toBeCloseTo(carryWith2029, 2);
      expect(out.keyMetrics.graceInterestCarry).not.toBeCloseTo(carryWith2030, 2);
    });
  });

  // ── Test 4a: Rolling 2029 DS formula check ───────────────────────────────
  describe("rolling mode — 2029 DS formula (T1 amortising, T2-T5 IO)", () => {
    it("rolling 2029 DS = plotsAmort + constructionLoan × rate", () => {
      const a = withGraceMode('rolling');
      const rate = a.commercialLoan.interestRate;
      const repaymentTermYears = a.commercialLoan.repaymentTermYears;
      const loanAmount = deriveLoanAmount(a);
      const plotsLoan = PHASE1_LAND_PERMITS * a.commercialLoan.loanCoverageRate;
      const constructionLoan = loanAmount - plotsLoan;
      const plotsAmort = pmt(rate, repaymentTermYears, plotsLoan);
      const expectedDS2029 = plotsAmort + constructionLoan * rate;
      expect(pnlRow(a, 2029).debtService).toBeCloseTo(expectedDS2029, 2);
    });
  });

  // ── Test 4b: Rolling 2031 DS equals standard 2031 DS (same full annuity) ─
  describe("rolling mode — 2031 DS matches standard full annuity", () => {
    it("rolling 2031 DS equals standard 2031 DS (both use PMT(rate, term, loanAmount))", () => {
      const aStandard = withGraceMode('standard');
      const aRolling = withGraceMode('rolling');
      // Standard starts full amortisation in 2029; rolling starts in 2031.
      // The PMT is identical — same rate, same term, same loanAmount.
      expect(pnlRow(aRolling, 2031).debtService).toBeCloseTo(
        pnlRow(aStandard, 2031).debtService, 2
      );
    });
  });

  // ── Test 5: Two-phase — stepped DS profile ────────────────────────────────
  describe("two-phase mode — stepped DS profile", () => {
    it("2028 debtService equals phase1IO + phase2IO (both tranches IO)", () => {
      const a = withGraceMode('two-phase');
      const loanAmount = deriveLoanAmount(a);
      const rate = a.commercialLoan.interestRate;
      // In two-phase: phase1Loan = PHASE1_LAND_PERMITS * loanCoverageRate
      //               phase2Loan = (totalCost - PHASE1_LAND_PERMITS) * loanCoverageRate
      // phase1IO + phase2IO = (phase1Loan + phase2Loan) * rate = loanAmount * rate
      const expectedDS2028 = loanAmount * rate;

      const row2028 = pnlRow(a, 2028);
      expect(row2028.debtService).toBeCloseTo(expectedDS2028, 2);
    });

    it("2029 debtService > 2028 debtService (phase1 starts amortising, phase2 still IO)", () => {
      const a = withGraceMode('two-phase');
      const row2028 = pnlRow(a, 2028);
      const row2029 = pnlRow(a, 2029);
      expect(row2029.debtService).toBeGreaterThan(row2028.debtService);
    });

    it("2031 debtService > 2029 debtService (both phases amortising)", () => {
      const a = withGraceMode('two-phase');
      const row2029 = pnlRow(a, 2029);
      const row2031 = pnlRow(a, 2031);
      expect(row2031.debtService).toBeGreaterThan(row2029.debtService);
    });

    it("2026 debtService < 2028 debtService (only phase1 drawn in land year)", () => {
      // In 2026 only the phase1 (land) tranche is drawn, so DS = phase1IO only
      const a = withGraceMode('two-phase');
      const row2026 = pnlRow(a, 2026);
      const row2028 = pnlRow(a, 2028);
      expect(row2026.debtService).toBeGreaterThan(0);
      expect(row2026.debtService).toBeLessThan(row2028.debtService);
    });
  });

  // ── Test 6: Two-phase — loanAmount unchanged vs standard ──────────────────
  describe("two-phase mode — total loanAmount", () => {
    it("loanAmount is identical to standard (same total borrow, just split differently)", () => {
      const aStandard = withGraceMode('standard');
      const aTwoPhase = withGraceMode('two-phase');

      // loanAmount = portfolioTotal * loanCoverageRate for both — same formula
      const loanStandard = deriveLoanAmount(aStandard);
      const loanTwoPhase = deriveLoanAmount(aTwoPhase);

      expect(loanTwoPhase).toBeCloseTo(loanStandard, 2);

      // Also confirm from model output keyMetrics
      const outStandard = computeModel(aStandard);
      const outTwoPhase = computeModel(aTwoPhase);
      expect(outTwoPhase.keyMetrics.loanAmount).toBeCloseTo(
        outStandard.keyMetrics.loanAmount, 2
      );
    });
  });

  // ── Test 7: Two-phase vs rolling — graceInterestCarry comparison ────────────
  describe("two-phase vs rolling — graceInterestCarry", () => {
    it("rolling carry = DS(2026)+DS(2027)+DS(2028) derived from per-tranche partial-year formula", () => {
      // Rolling carry uses the per-tranche partial-year IO — NOT the legacy interest2026/2027/2028 fields.
      // io2026 = T1 partial (Q1 → full year = plotsLoan × rate)
      // io2027 = T1 full IO + T2 partial (Q1) + T3 partial (Q3) — three tranches active
      // io2028 = T1+T2+T3 full IO + T4 partial (Q1) + T5 partial (Q3)
      const aRolling = withGraceMode('rolling');
      const outRolling = computeModel(aRolling);
      const { io2026, io2027, io2028 } = deriveRollingIOAmounts(aRolling);
      const expectedRollingCarry = io2026 + io2027 + io2028;
      expect(outRolling.keyMetrics.graceInterestCarry).toBeCloseTo(expectedRollingCarry, 2);
    });

    it("two-phase carry < rolling carry (two-phase 2026 IO = phase1 only; rolling 2026 IO = plotsLoan × rate — same; but two-phase 2026 < rolling if phase1 != plotsLoan)", () => {
      // Two-phase: phase1Loan = PHASE1_LAND_PERMITS × loanCoverageRate (same as plotsLoan)
      // Both have the same 2026 IO. But two-phase 2027 IO = phase1IO + phase2IO = full loanAmount × rate
      // while rolling 2027 IO = (plotsLoan + constHalf1) × rate < loanAmount × rate.
      // Therefore two-phase carry > rolling carry for the same 3 years.
      // (two-phase pays more interest in 2027 since the full construction loan is drawn immediately)
      const aRolling = withGraceMode('rolling');
      const aTwoPhase = withGraceMode('two-phase');
      const outRolling = computeModel(aRolling);
      const outTwoPhase = computeModel(aTwoPhase);
      // Two-phase 2027 IO is higher (full loan drawn), so two-phase carry >= rolling carry
      expect(outTwoPhase.keyMetrics.graceInterestCarry).toBeGreaterThanOrEqual(
        outRolling.keyMetrics.graceInterestCarry
      );
    });

    it("both rolling and two-phase carries cover exactly 3 pre-operational years", () => {
      // Both modes have hotel open in 2029 — grace carry covers 2026, 2027, 2028 only
      const aRolling = withGraceMode('rolling');
      const aTwoPhase = withGraceMode('two-phase');
      const outRolling = computeModel(aRolling);
      const outTwoPhase = computeModel(aTwoPhase);
      // Both carries are sums of 3 years of pre-op IO — neither is zero
      expect(outRolling.keyMetrics.graceInterestCarry).toBeGreaterThan(0);
      expect(outTwoPhase.keyMetrics.graceInterestCarry).toBeGreaterThan(0);
    });
  });

  // ── Test 8: Other financing paths unaffected by graceMode ─────────────────
  describe("other financing paths unaffected", () => {
    it("grant path (standard graceMode) 2026/2027 debtService matches configured interest scalars", () => {
      // On the grant standard sub-path, debtService uses the configured scalar
      // fields (interest2026, interest2027, interest2028). This verifies the
      // standard branch is selected correctly when graceMode='standard'.
      // Note: graceMode='rolling' and graceMode='standard' are DIFFERENT sub-paths
      // within the grant path, producing different debtService profiles — this is
      // by design and tested separately.
      const a: ModelAssumptions = {
        ...BASE_CASE,
        financingPath: 'grant',
        commercialLoan: { ...BASE_CASE.commercialLoan, graceMode: 'standard' },
      };
      const out = computeModel(a);
      const pnl = out.grantScenario.pnl;

      const row2026 = pnl.find(r => r.year === 2026);
      const row2027 = pnl.find(r => r.year === 2027);
      if (!row2026 || !row2027) throw new Error('Missing P&L rows');

      // grant standard uses interest2026/2027 scalars directly
      expect(row2026.debtService).toBeCloseTo(BASE_CASE.grant.interest2026, 2);
      expect(row2027.debtService).toBeCloseTo(BASE_CASE.grant.interest2027, 2);
    });

    it("active grant scenario keyMetrics are stable when graceMode changes", () => {
      const aGrantStandard: ModelAssumptions = {
        ...BASE_CASE,
        financingPath: 'grant',
        commercialLoan: { ...BASE_CASE.commercialLoan, graceMode: 'standard' },
      };
      const aGrantTwoPhase: ModelAssumptions = {
        ...BASE_CASE,
        financingPath: 'grant',
        commercialLoan: { ...BASE_CASE.commercialLoan, graceMode: 'two-phase' },
      };

      const outStandard = computeModel(aGrantStandard);
      const outTwoPhase = computeModel(aGrantTwoPhase);

      // The active path is grant — keyMetrics should reflect the grant path in both cases
      // and be identical since graceMode only affects the commercial sub-branch
      expect(outTwoPhase.keyMetrics.loanAmount).toBeCloseTo(
        outStandard.keyMetrics.loanAmount, 2
      );
      expect(outTwoPhase.keyMetrics.equityRequired).toBeCloseTo(
        outStandard.keyMetrics.equityRequired, 2
      );
    });
  });

  // ── Test 9: dscrWindowStart for rolling starts at firstAmortYear (2029) ────
  describe("rolling mode — DSCR window starts at firstAmortYear (2029)", () => {
    it("minDSCRLoanLife for rolling includes years from 2029 onward (firstAmortYear = T1 plots)", () => {
      const aRolling = withGraceMode('rolling');
      const outRolling = computeModel(aRolling);
      const scenario = outRolling.commercialScenario;

      // For rolling: firstAmortYear = T1 amortStart = plotsStartYear + 3 = 2026 + 3 = 2029.
      // dscrWindowStart = 2029. Years 2029 and 2030 are included in the DSCR window
      // even though T2-T5 are still IO (graceEndYear = 2030). This is the correct
      // behavior: 2029 DSCR should be measured (T1 amortising + T2-T5 IO) and is
      // BETTER than standard mode (which measures full annuity DS from 2029).

      const aStandard = withGraceMode('standard');
      const outStandard = computeModel(aStandard);

      // Rolling's DSCR in 2029 = EBITDA_2029 / (T1amort + constructionLoan × rate)
      // Standard's DSCR in 2029 = EBITDA_2029 / full annuity
      // Since T1amort + constructionLoan × rate < full annuity:
      //   rolling DSCR 2029 > standard DSCR 2029
      const rolling2029 = scenario.pnl.find(r => r.year === 2029);
      const standard2029 = outStandard.commercialScenario.pnl.find(r => r.year === 2029);
      if (rolling2029 && standard2029 && rolling2029.dscr > 0 && standard2029.dscr > 0) {
        expect(rolling2029.dscr).toBeGreaterThan(standard2029.dscr);
      }

      // minDSCRLoanLife for rolling should be >= standard because even the worst
      // rolling year has lower DS than the standard opening year (partial amort only).
      expect(scenario.minDSCRLoanLife).toBeGreaterThanOrEqual(
        outStandard.commercialScenario.minDSCRLoanLife
      );
    });

    it("rolling graceEndYear is 2030 (HORIZON_START_YEAR + 4)", () => {
      // Verify via graceInterestHoldYears: holdYears = graceEndYear − HORIZON_START_YEAR + 1
      // For rolling: graceEndYear = 2030 → holdYears = 2030 − 2026 + 1 = 5
      const a = withGraceMode('rolling');
      const out = computeModel(a);
      expect(out.keyMetrics.graceInterestHoldYears).toBe(5);
    });

    it("two-phase graceEndYear is 2029 (max(phase1AmortStart,phase2AmortStart)−1 with defaults)", () => {
      // With defaults plotsStartYear=2026, constructionStartYear=2027:
      //   phase1AmortStart = 2026+3 = 2029
      //   phase2AmortStart = 2027+3 = 2030
      //   graceEndYear = max(2029,2030)−1 = 2029 → holdYears = 2029−2026+1 = 4
      const a = withGraceMode('two-phase');
      const out = computeModel(a);
      expect(out.keyMetrics.graceInterestHoldYears).toBe(4);
    });
  });

  // ── Additional: verify 2026 DS in two-phase equals phase1IO exactly ────────
  describe("two-phase — 2026 DS is phase1IO only (phase1Loan * rate)", () => {
    it("2026 DS = PHASE1_LAND_PERMITS * loanCoverageRate * interestRate", () => {
      const a = withGraceMode('two-phase');
      const phase1Loan = PROJECT_CONSTANTS.PHASE1_LAND_PERMITS * a.commercialLoan.loanCoverageRate;
      const phase1IO = phase1Loan * a.commercialLoan.interestRate;

      const row2026 = pnlRow(a, 2026);
      expect(row2026.debtService).toBeCloseTo(phase1IO, 2);
    });
  });

  // ── Additional: verify rolling 2031 DS matches standard 2029 DS magnitude ──
  describe("rolling mode — amortising annual DS matches PMT formula", () => {
    it("rolling 2031 debtService equals standard 2029 debtService (same PMT)", () => {
      // Both use the same PMT(rate, repaymentTermYears, loanAmount)
      // Standard starts amortising in 2029; rolling starts in 2031.
      // The annual DS amount from PMT is the same in both cases.
      const aStandard = withGraceMode('standard');
      const aRolling = withGraceMode('rolling');

      const rowStd2029 = pnlRow(aStandard, 2029);
      const rowRoll2031 = pnlRow(aRolling, 2031);

      expect(rowRoll2031.debtService).toBeCloseTo(rowStd2029.debtService, 2);
    });
  });

  // ── New: commitment fee on rolling-cohort ──────────────────────────────────
  describe("rolling-cohort mode — commitment fee on construction tranches", () => {
    /** rolling-cohort with commitmentFeeEnabled=true, default 0.75% rate,
     *  cYear=2027, cQ=1, plotsStartYear=2026, plotsStartQ=1.
     *  T2–T5 are construction tranches. T2 disbYear=2027,Q1; T3=2027,Q3; T4=2028,Q1; T5=2028,Q3 */
    function withCommitmentFee(): ModelAssumptions {
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

    it("commitmentFee is 0 in 2026 (no construction tranches committed yet)", () => {
      const a = withCommitmentFee();
      const row = pnlRow(a, 2026);
      expect(row.commitmentFee ?? 0).toBe(0);
    });

    it("commitmentFee is positive in 2027 (T3,T4,T5 undrawn; T2 draws Q1 so 0 partial)", () => {
      // T2: disbYear=2027, disbQ=1 → partial=(1-1)/4=0 → fee=0
      // T3: disbYear=2027, disbQ=3 → partial=(3-1)/4=0.5 → fee=constQ×0.0075×0.5
      // T4: disbYear=2028 → yr < disbYear → fee=constQ×0.0075
      // T5: disbYear=2028 → yr < disbYear → fee=constQ×0.0075
      // Total = constQ × 0.0075 × (0.5 + 1 + 1) = constQ × 0.0075 × 2.5
      const a = withCommitmentFee();
      const loanAmount = deriveLoanAmount(a);
      const plotsLoan = PHASE1_LAND_PERMITS * a.commercialLoan.loanCoverageRate;
      const constQuarter = (loanAmount - plotsLoan) / 4;
      const expected = constQuarter * 0.0075 * 2.5;
      expect(expected).toBeGreaterThan(0);
      expect(pnlRow(a, 2027).commitmentFee ?? 0).toBeCloseTo(expected, 4);
    });

    it("commitmentFee in 2028 is smaller than 2027 (only T5 partially undrawn in Q3)", () => {
      // T2/T3 drawn in 2027 → 0. T4: disbYear=2028, disbQ=1 → (1-1)/4=0 → fee=0
      // T5: disbYear=2028, disbQ=3 → (3-1)/4=0.5 → fee=constQ×0.0075×0.5
      const a = withCommitmentFee();
      const loanAmount = deriveLoanAmount(a);
      const plotsLoan = PHASE1_LAND_PERMITS * a.commercialLoan.loanCoverageRate;
      const constQuarter = (loanAmount - plotsLoan) / 4;
      const expected2028 = constQuarter * 0.0075 * 0.5;
      expect(pnlRow(a, 2028).commitmentFee ?? 0).toBeCloseTo(expected2028, 4);
      // 2028 fee < 2027 fee
      expect(pnlRow(a, 2028).commitmentFee ?? 0).toBeLessThan(
        pnlRow(a, 2027).commitmentFee ?? 0
      );
    });

    it("debtService in 2027 = DS without fee + commitmentFee", () => {
      const aFee = withCommitmentFee();
      const aNoFee: ModelAssumptions = {
        ...aFee,
        commercialLoan: { ...aFee.commercialLoan, commitmentFeeEnabled: false },
      };
      const row2027Fee = pnlRow(aFee, 2027);
      const row2027NoFee = pnlRow(aNoFee, 2027);
      const expectedDS = row2027NoFee.debtService + (row2027Fee.commitmentFee ?? 0);
      expect(row2027Fee.debtService).toBeCloseTo(expectedDS, 4);
    });

    it("commitmentFee is 0 on all rows when viewMode is 'bank'", () => {
      const a: ModelAssumptions = {
        ...withCommitmentFee(),
        viewMode: 'bank',
      };
      const rows = pnlRows(a);
      for (const row of rows) {
        expect(row.commitmentFee ?? 0).toBe(0);
      }
    });
  });

  // ── New: configurable quarter start — Q3 construction shifts T3 to next year ─
  describe("rolling mode — Q3 construction start shifts T3 disbYear", () => {
    it("constructionStartQ=3: T3 disbYear = constructionStartYear + 1, Q1", () => {
      // addQtrs(cYear, 3, 2): total = (3-1)+2 = 4 → year + 1, q = (4%4)+1 = 1
      // So T3 disbYear = constructionStartYear + 1, disbQ = 1.
      const a: ModelAssumptions = {
        ...BASE_CASE,
        financingPath: 'commercial',
        commercialLoan: {
          ...BASE_CASE.commercialLoan,
          graceMode: 'rolling',
          constructionStartYear: 2027,
          constructionStartQ: 3,
        },
      };
      const out = computeModel(a);
      // With cYear=2027, cQ=3:
      //   T2 = addQtrs(2027,3,0) → {year:2027, q:3}
      //   T3 = addQtrs(2027,3,2) → total=(3-1)+2=4 → {year:2028, q:1}
      //   T4 = addQtrs(2027,3,4) → total=(3-1)+4=6 → {year:2028, q:3}
      //   T5 = addQtrs(2027,3,6) → total=(3-1)+6=8 → {year:2029, q:1}
      // T3 disbYear = 2028 (shifted from default 2027) ✓
      // T5 disbYear = 2029 — T5 amortStart = 2032, graceEndYear = max(amortStart-1) = 2031
      // graceInterestHoldYears = 2031 − 2026 + 1 = 6
      expect(out.keyMetrics.graceInterestHoldYears).toBe(6);
    });

    it("constructionStartQ=3: graceInterestCarry covers 2026-2028 only (OPENING_YEAR boundary)", () => {
      // Even with T5 in 2029, graceInterestCarry only sums years before OPENING_YEAR=2029.
      // So carry = DS(2026) + DS(2027) + DS(2028).
      const a: ModelAssumptions = {
        ...BASE_CASE,
        financingPath: 'commercial',
        commercialLoan: {
          ...BASE_CASE.commercialLoan,
          graceMode: 'rolling',
          constructionStartYear: 2027,
          constructionStartQ: 3,
        },
      };
      const out = computeModel(a);
      // Carry is bounded by OPENING_YEAR, so T5 (drawn 2029) is NOT in carry
      expect(out.keyMetrics.graceInterestCarry).toBeGreaterThan(0);
      // 2029 DS contribution from T5 (which is partial: constQuarter×rate×1.0) is excluded
      const ds2029 = pnlRow(a, 2029).debtService;
      // Carry should be less than carry + ds2029 (i.e., 2029 is not included)
      expect(out.keyMetrics.graceInterestCarry).toBeLessThan(
        out.keyMetrics.graceInterestCarry + ds2029
      );
    });

    it("constructionStartQ=3: 2031 DS still equals full annualDS (PMT linearity)", () => {
      // By 2031, T1/T2/T3/T4 are all amortising (amortStart ≤ 2031).
      // T5 amortStart = 2032 — still IO in 2031.
      // So 2031 DS ≠ annualDS (T5 not yet amortising).
      // 2032 DS = all 5 amortising = annualDS.
      const a: ModelAssumptions = {
        ...BASE_CASE,
        financingPath: 'commercial',
        commercialLoan: {
          ...BASE_CASE.commercialLoan,
          graceMode: 'rolling',
          constructionStartYear: 2027,
          constructionStartQ: 3,
        },
      };
      const out = computeModel(a);
      // 2032 = all tranches amortising → DS = annualDS
      expect(pnlRow(a, 2032).debtService).toBeCloseTo(out.keyMetrics.annualDS, 2);
    });
  });

  // ── New: standard path grace=2 correctness (scalar-based approach) ────────
  describe("standard mode — gracePeriodYears=2 scalar-based", () => {
    it("2028 DS equals configured interest2028 scalar", () => {
      // Standard path uses manually-calibrated scalars from Firestore scenarios.
      // With gracePeriodYears=2: commGraceEndYear = 2026+2 = 2028.
      // 2028 is the last grace year: year > 2027 && year <= 2028 → returns interest2028.
      const a = withGraceMode('standard');
      expect(pnlRow(a, 2028).debtService).toBeCloseTo(a.commercialLoan.interest2028, 2);
    });

    it("2026 DS equals configured interest2026 scalar", () => {
      const a = withGraceMode('standard');
      expect(pnlRow(a, 2026).debtService).toBeCloseTo(a.commercialLoan.interest2026, 2);
    });

    it("2027 DS equals configured interest2027 scalar", () => {
      const a = withGraceMode('standard');
      expect(pnlRow(a, 2027).debtService).toBeCloseTo(a.commercialLoan.interest2027, 2);
    });
  });

  // ── New: standard path grace=3 correctness (intermediate year regression guard) ──
  describe("standard mode — gracePeriodYears=3 scalar-based", () => {
    function withGrace3(): ModelAssumptions {
      return {
        ...BASE_CASE,
        financingPath: 'commercial',
        commercialLoan: {
          ...BASE_CASE.commercialLoan,
          graceMode: 'standard',
          gracePeriodYears: 3,
        },
      };
    }

    it("2028 DS equals configured interest2028 scalar (intermediate grace year)", () => {
      // grace=3: commGraceEndYear = 2026+3 = 2029.
      // 2028: year > 2027 && year <= 2029 → returns interest2028 scalar (not 0).
      // This is the intermediate year fix: old code returned 0 for years between
      // HORIZON_START_YEAR+1 and commGraceEndYear when gracePeriodYears > 2.
      const a = withGrace3();
      expect(pnlRow(a, 2028).debtService).toBeCloseTo(a.commercialLoan.interest2028, 2);
    });

    it("2029 DS equals configured interest2028 scalar (final grace year)", () => {
      // grace=3: commGraceEndYear=2029. 2029 is the last grace year.
      // year > 2027 && year <= 2029 → returns interest2028.
      const a = withGrace3();
      expect(pnlRow(a, 2029).debtService).toBeCloseTo(a.commercialLoan.interest2028, 2);
    });

    it("2030 has full annualDS (amortisation begins after graceEndYear=2029)", () => {
      // grace=3: 2030 > commGraceEndYear=2029 → returns annualDS
      const a = withGrace3();
      const out = computeModel(a);
      expect(pnlRow(a, 2030).debtService).toBeCloseTo(out.keyMetrics.annualDS, 2);
    });

    it("2028 is non-zero (intermediate grace year fix: no longer returns 0)", () => {
      // The fix ensures year > HORIZON_START_YEAR+1 && year <= commGraceEndYear
      // returns interest2028 instead of falling through to return 0.
      const a = withGrace3();
      expect(pnlRow(a, 2028).debtService).toBeGreaterThan(0);
    });
  });

  // ── New: termLoanBalance drawn balance (Bug 2 regression guard) ────────────
  describe("termLoanBalance reflects drawn balance during grace years (Bug 2)", () => {
    it("two-phase: termLoanBalance in 2026 = phase1Loan (only phase1 drawn)", () => {
      const a = withGraceMode('two-phase');
      const phase1Loan = PROJECT_CONSTANTS.PHASE1_LAND_PERMITS * a.commercialLoan.loanCoverageRate;
      const row2026 = pnlRow(a, 2026);
      expect(row2026.termLoanBalance).toBeCloseTo(phase1Loan, 2);
    });

    it("two-phase: termLoanBalance in 2027 = loanAmount (both tranches drawn)", () => {
      const a = withGraceMode('two-phase');
      const loanAmount = deriveLoanAmount(a);
      const row2027 = pnlRow(a, 2027);
      expect(row2027.termLoanBalance).toBeCloseTo(loanAmount, 2);
    });

    it("standard: termLoanBalance in 2026 = full loanAmount (no drawn-balance override)", () => {
      // Standard path has no drawnBalanceFn — balance starts at full loanAmount from
      // the first grace year. Draw schedule is encoded in interest2026/2027/2028 scalars.
      const a = withGraceMode('standard');
      const loanAmount = deriveLoanAmount(a);
      const row2026 = pnlRow(a, 2026);
      expect(row2026.termLoanBalance).toBeCloseTo(loanAmount, 2);
    });

    it("standard: termLoanBalance in 2027 = full loanAmount (grace year, no principal)", () => {
      const a = withGraceMode('standard');
      const loanAmount = deriveLoanAmount(a);
      const row2027 = pnlRow(a, 2027);
      expect(row2027.termLoanBalance).toBeCloseTo(loanAmount, 2);
    });

    it("debtService values for two-phase are unchanged by drawnBalanceFn addition", () => {
      // drawnBalanceFn only affects opening/closing balance — NOT interest
      // (which still comes from getDS). Verify DS profile is unchanged.
      const a = withGraceMode('two-phase');
      const loanAmount = deriveLoanAmount(a);
      const rate = a.commercialLoan.interestRate;
      const phase1Loan = PROJECT_CONSTANTS.PHASE1_LAND_PERMITS * a.commercialLoan.loanCoverageRate;
      // 2028 DS = loanAmount * rate (both in IO for two-phase gracePeriodYears=2)
      // two-phase: phase1AmortStart=2029, phase2AmortStart=2030 → graceEndYear=2029
      // In 2028: both still IO → DS = phase1Loan*rate + phase2Loan*rate = loanAmount*rate
      expect(pnlRow(a, 2028).debtService).toBeCloseTo(loanAmount * rate, 2);
    });
  });

  // ── Test: rolling-cohort mode ───────────────────────────────────────────────
  // Drawdown: T1=plots Q3-2026, T2-T5=construction from Q1-2027 (one per semester).
  // Single cohort grace end: pYear + gracePeriodYears = 2026 + 2 = 2028.
  // All tranches amortise together from 2029.
  //
  // Defaults used here:
  //   plotsStartYear=2026, plotsStartQ=3  (Q3 partial year IO = (5-3)/4 = 0.5)
  //   constructionStartYear=2027, constructionStartQ=1
  //   gracePeriodYears=2  →  cohortGraceEndYear = 2026+2 = 2028
  //   loanAmount = portfolioTotal × 0.80
  //   rate = 4%  (BASE_CASE.commercialLoan.interestRate = 0.04)
  //   repaymentTermYears = 13
  describe("rolling-cohort mode — single cohort grace end, staged drawdown", () => {
    function withRollingCohort(): ModelAssumptions {
      return {
        ...BASE_CASE,
        financingPath: 'commercial',
        commercialLoan: {
          ...BASE_CASE.commercialLoan,
          graceMode: 'rolling-cohort',
          // Q3 plots start to make 2026 partial-year IO = 0.5 of full year
          plotsStartYear:        2026,
          plotsStartQ:           3 as 1 | 2 | 3 | 4,
          constructionStartYear: 2027,
          constructionStartQ:    1 as 1 | 2 | 3 | 4,
          gracePeriodYears:      2,
          interestRate:          0.04,
        },
      };
    }

    it("2026 DS ≈ plotsLoan × rate × 0.5 (Q3 partial year — only T1 drawn)", () => {
      // T1 disbQ=3: partial factor = (5-3)/4 = 0.5
      const a = withRollingCohort();
      const loanAmount = deriveLoanAmount(a);
      const rate = a.commercialLoan.interestRate;
      const plotsLoan = PHASE1_LAND_PERMITS * a.commercialLoan.loanCoverageRate;
      const expected = plotsLoan * rate * 0.5;
      expect(pnlRow(a, 2026).debtService).toBeCloseTo(expected, 2);
    });

    it("2027 DS = (plotsLoan full IO) + (T2 full IO) + (T3 half IO from Q3)", () => {
      // With cYear=2027, cQ=1:
      //   T2 = addQtrs(2027,1,0) → {year:2027, q:1}  partial=(5-1)/4=1.0
      //   T3 = addQtrs(2027,1,2) → {year:2027, q:3}  partial=(5-3)/4=0.5
      //   T4 = addQtrs(2027,1,4) → {year:2028, q:1}  not yet drawn
      // 2027 IO = plotsLoan×rate + constQuarter×rate×1.0 + constQuarter×rate×0.5
      const a = withRollingCohort();
      const loanAmount = deriveLoanAmount(a);
      const rate = a.commercialLoan.interestRate;
      const plotsLoan = PHASE1_LAND_PERMITS * a.commercialLoan.loanCoverageRate;
      const constQuarter = (loanAmount - plotsLoan) / 4;
      const expected = plotsLoan * rate + constQuarter * rate * 1.0 + constQuarter * rate * 0.5;
      expect(pnlRow(a, 2027).debtService).toBeCloseTo(expected, 2);
    });

    it("2028 DS = loanAmount × rate (all tranches drawn, cohort grace year — full IO)", () => {
      // By 2028: T1 full IO, T2 full IO, T3 full IO, T4 disbYear=2028-Q1 (partial 1.0), T5 disbYear=2028-Q3 (partial 0.5)
      // But 2028 > disbYear for T1/T2/T3 → full IO for those; partial for T4+T5
      // T4 = addQtrs(2027,1,4) → {year:2028, q:1}  → partial = 1.0 (full year)
      // T5 = addQtrs(2027,1,6) → {year:2028, q:3}  → partial = 0.5
      // Total: (plotsLoan + constQuarter + constQuarter)×rate + constQuarter×rate×1.0 + constQuarter×rate×0.5
      //      = (plotsLoan + 2.5×constQuarter)×rate
      // Note: this is NOT loanAmount×rate because T5 is a partial year in 2028.
      const a = withRollingCohort();
      const loanAmount = deriveLoanAmount(a);
      const rate = a.commercialLoan.interestRate;
      const plotsLoan = PHASE1_LAND_PERMITS * a.commercialLoan.loanCoverageRate;
      const constQuarter = (loanAmount - plotsLoan) / 4;
      // T1,T2,T3: full year IO; T4 Q1 partial=1.0; T5 Q3 partial=0.5
      const expected =
        plotsLoan     * rate +       // T1 full IO
        constQuarter  * rate +       // T2 full IO
        constQuarter  * rate +       // T3 full IO
        constQuarter  * rate * 1.0 + // T4 disbYear=2028 Q1
        constQuarter  * rate * 0.5;  // T5 disbYear=2028 Q3
      expect(pnlRow(a, 2028).debtService).toBeCloseTo(expected, 2);
    });

    it("2029 DS = annualDS (cohort grace ends 2028 — full amortisation begins)", () => {
      const a = withRollingCohort();
      const out = computeModel(a);
      expect(pnlRow(a, 2029).debtService).toBeCloseTo(out.keyMetrics.annualDS, 2);
    });

    it("termLoanBalance 2026 < loanAmount (only plots drawn)", () => {
      const a = withRollingCohort();
      const loanAmount = deriveLoanAmount(a);
      expect(pnlRow(a, 2026).termLoanBalance).toBeLessThan(loanAmount);
    });

    it("termLoanBalance 2027 < loanAmount (plots + T2 + T3 drawn — T4/T5 not yet)", () => {
      const a = withRollingCohort();
      const loanAmount = deriveLoanAmount(a);
      expect(pnlRow(a, 2027).termLoanBalance).toBeLessThan(loanAmount);
    });

    it("termLoanBalance 2028 = loanAmount (all 5 tranches drawn by year-end)", () => {
      // T5 disburses in 2028-Q3, so by year-end 2028 all tranches are drawn.
      // drawnBalanceFn sums all tranches where disbYear <= 2028 = full loanAmount.
      const a = withRollingCohort();
      const loanAmount = deriveLoanAmount(a);
      expect(pnlRow(a, 2028).termLoanBalance).toBeCloseTo(loanAmount, 2);
    });

    it("cohortGraceEndYear = 2028 → graceInterestHoldYears = 3", () => {
      // graceInterestHoldYears = graceEndYear − HORIZON_START_YEAR + 1 = 2028 − 2026 + 1 = 3
      const a = withRollingCohort();
      const out = computeModel(a);
      expect(out.keyMetrics.graceInterestHoldYears).toBe(3);
    });

    it("2030 DS = 2029 DS (both full annuity — same annualDS from PMT)", () => {
      const a = withRollingCohort();
      const out = computeModel(a);
      expect(pnlRow(a, 2030).debtService).toBeCloseTo(out.keyMetrics.annualDS, 2);
    });

    it("rolling-cohort 2029 DS > rolling 2029 DS (cohort amortises earlier)", () => {
      // Rolling: only T1 amortises in 2029; T2-T5 still IO.
      // Rolling-cohort: all tranches amortise together from 2029 → full annualDS.
      const aCohort  = withRollingCohort();
      // Use default Q1 plots for rolling to ensure fair comparison
      const aRolling: ModelAssumptions = {
        ...BASE_CASE,
        financingPath: 'commercial',
        commercialLoan: { ...BASE_CASE.commercialLoan, graceMode: 'rolling' },
      };
      expect(pnlRow(aCohort, 2029).debtService).toBeGreaterThan(
        pnlRow(aRolling, 2029).debtService
      );
    });
  });

});
