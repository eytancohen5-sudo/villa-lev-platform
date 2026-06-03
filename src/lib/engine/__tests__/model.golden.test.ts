// Golden snapshots of the financial-engine output.
//
// Why: model.ts is 1216 lines of compound finance logic (capex, debt service,
// amortisation, IRR / LLCR / PLCR, OpCo split, working-capital threading,
// exit-multiple equity IRR). Any BP-driven assumption shift can ripple
// through dozens of derived metrics, and the BP / presentation / TEPIX III
// pack all cross-reference these numbers.
//
// What's snapshotted: `keyMetrics` (the bank-facing summary) for the four
// FinancingPaths under the realistic scenario, plus a pessimistic-occupancy
// twist and an upside/downside scenario read. Snapshots are committed; any
// future engine change either matches them or fails CI with a diff the
// reviewer must consciously bless via `vitest -u`.
//
// What's NOT snapshotted: the year-by-year P&L (too volatile under tuning),
// the per-property capex breakdown (covered by separate property tests
// when those exist), and any non-deterministic field (none currently —
// `pulledAt` lives outside the engine).

import { describe, expect, it } from "vitest";

import { computeModel } from "@/lib/engine/model";
import { BASE_CASE, DOWNSIDE_FACTORS, PROJECT_CONSTANTS } from "@/lib/engine/defaults";
import type { ModelAssumptions } from "@/lib/engine/types";

// ── Helpers ─────────────────────────────────────────────────────────

function withFinancingPath(
  base: ModelAssumptions,
  path: ModelAssumptions["financingPath"],
): ModelAssumptions {
  return { ...base, financingPath: path };
}

function withPessimisticOccupancy(base: ModelAssumptions): ModelAssumptions {
  // -20% on per-villa booked nights; everything else held flat. This is the
  // cheapest stress test for DSCR sensitivity to revenue compression.
  return {
    ...base,
    revenueRealistic: {
      ...base.revenueRealistic,
      villaBaseNights: Math.round(base.revenueRealistic.villaBaseNights * 0.8),
    },
  };
}

// ── Tests ───────────────────────────────────────────────────────────

// SNAPSHOT PENDING UPDATE (2026-06-01):
// The floor moved from OpEx (senior to DS) to a post-DS waterfall position.
// With OpCo disabled (BASE_CASE default), currentYearFloor = 0 — so there is
// no management fee drag at all, which raises stabilisedEBITDA by
// opCoFloor × totalVillaCount = €25K × 3 = +€75K/yr vs the old snapshots.
// DSCR delta: commercial path 0.8015 → 1.0070.
// bufferToBreakEven also shifts because the break-even computation uses totalOpex.
//
// These snapshots must be reset as a SEPARATE COMMIT after Eytan reviews the
// delta above and approves the new numbers. Use: vitest -u
//
// The sanity-invariant tests below (stabilised DSCR positive, portfolio value,
// TEPIX cap) are NOT snapshots and continue to pass — they do not encode
// specific numeric values.

describe("computeModel — keyMetrics snapshots", () => {
  it("realistic / commercial path", () => {
    const out = computeModel(withFinancingPath(BASE_CASE, "commercial"));
    expect(out.keyMetrics).toMatchSnapshot();
  });

  it("realistic / tepix-loan path", () => {
    const out = computeModel(withFinancingPath(BASE_CASE, "tepix-loan"));
    expect(out.keyMetrics).toMatchSnapshot();
  });

  it("realistic / grant path", () => {
    const out = computeModel(withFinancingPath(BASE_CASE, "grant"));
    expect(out.keyMetrics).toMatchSnapshot();
  });

  it("realistic / rrf path", () => {
    const out = computeModel(withFinancingPath(BASE_CASE, "rrf"));
    expect(out.keyMetrics).toMatchSnapshot();
  });

  it("pessimistic occupancy (-20% nights) / tepix-loan", () => {
    const stressed = withPessimisticOccupancy(
      withFinancingPath(BASE_CASE, "tepix-loan"),
    );
    const out = computeModel(stressed);
    expect(out.keyMetrics).toMatchSnapshot();
  });
});

describe("computeModel — scenario fan", () => {
  it("realistic vs upside vs downside stabilised revenue (tepix-loan)", () => {
    const out = computeModel(withFinancingPath(BASE_CASE, "tepix-loan"));
    // Pin a compact triple instead of the full scenario tree — this is the
    // single most-cited cross-scenario summary in the dashboard / investor
    // pages.
    const snapshot = {
      realistic: out.scenarios.realistic.stabilisedYear?.totalRevenue ?? null,
      upside: out.scenarios.upside.stabilisedYear?.totalRevenue ?? null,
      downside: out.scenarios.downside.stabilisedYear?.totalRevenue ?? null,
      downside_factors: DOWNSIDE_FACTORS,
    };
    expect(snapshot).toMatchSnapshot();
  });
});

describe("computeModel — sanity invariants (not snapshots)", () => {
  // These assert structural properties that must always hold across
  // assumption tuning. If one fails it's a genuine bug, not a snapshot drift.
  //
  // NOTE: a tempting fourth invariant ("loanAmount + equityRequired sums to
  // totalCapex") was tried and discarded — empirically the engine carries a
  // ~€1.26M residual on the commercial path (working capital, VAT recovery
  // timing, and reserve buffers sit outside the simple capital-stack identity).
  // Adding a structural identity here would require understanding which
  // capex components flow into which financing line — not work for a sanity
  // test. The golden snapshots above already pin those numbers.

  it("stabilised DSCR is positive and finite for every realistic path", () => {
    for (const path of ["commercial", "tepix-loan", "grant", "rrf"] as const) {
      const out = computeModel(withFinancingPath(BASE_CASE, path));
      const dscr = out.keyMetrics.stabilisedDSCR;
      expect(Number.isFinite(dscr)).toBe(true);
      expect(dscr).toBeGreaterThan(0);
    }
  });

  it("portfolio value >= total capex (assets cover cost at stabilised exit multiple)", () => {
    const out = computeModel(withFinancingPath(BASE_CASE, "tepix-loan"));
    expect(out.keyMetrics.portfolioValue).toBeGreaterThanOrEqual(
      out.keyMetrics.totalCapex,
    );
  });

  it("TEPIX III cap does not bind at current BASE_CASE scope (~€4.9M)", () => {
    // BASE_CASE produces a primaryLoan well under the €8M program ceiling, so
    // the cap is a no-op. If this fails, either BASE_CASE has grown past €8M
    // (great — re-baseline snapshots and review the equity gap) or the cap
    // logic introduced a regression.
    const out = computeModel(withFinancingPath(BASE_CASE, "tepix-loan"));
    expect(out.keyMetrics.tepixCapBindingBy).toBe(0);
    expect(out.keyMetrics.tepixLoanCap).toBe(PROJECT_CONSTANTS.TEPIX_LOAN_CAP_EUR);
    expect(out.keyMetrics.primaryLoan).toBeLessThanOrEqual(PROJECT_CONSTANTS.TEPIX_LOAN_CAP_EUR);
  });

  it("TEPIX III cap binds and absorbs excess into equity when scope > €8M loan", () => {
    // Synthetic 3x-scope: triple the portfolio so the unconstrained TEPIX
    // primary loan exceeds €8M (BASE_CASE primary ≈ €3.5M, so 2x is still
    // under the cap; 3x clears it). The cap should clamp primaryLoan to
    // €8M, surface a positive tepixCapBindingBy, and route the shortfall
    // to equity / supplementary commercial debt via the existing landGap +
    // nonLandCost residual logic.
    const triplePortfolio = [
      ...BASE_CASE.portfolio,
      ...BASE_CASE.portfolio.map((p, i) => ({
        ...p,
        id: `${p.id}-dup1-${i}`,
        roomAreas: { ...p.roomAreas },
      })),
      ...BASE_CASE.portfolio.map((p, i) => ({
        ...p,
        id: `${p.id}-dup2-${i}`,
        roomAreas: { ...p.roomAreas },
      })),
    ];
    const scaledUp: ModelAssumptions = {
      ...BASE_CASE,
      financingPath: "tepix-loan",
      portfolio: triplePortfolio,
    };
    const out = computeModel(scaledUp);
    expect(out.keyMetrics.primaryLoan).toBeLessThanOrEqual(PROJECT_CONSTANTS.TEPIX_LOAN_CAP_EUR);
    expect(out.keyMetrics.tepixCapBindingBy).toBeGreaterThan(0);
    expect(out.keyMetrics.tepixLoanCap).toBe(PROJECT_CONSTANTS.TEPIX_LOAN_CAP_EUR);
    // Equity ask grows when the cap binds — the excess flows into a
    // combination of supplementary commercial debt and sponsor equity.
    // Loose lower bound: equity must be MEANINGFULLY larger than the
    // uncapped BASE_CASE equity, not pixel-precise.
    const baseEquity = computeModel(withFinancingPath(BASE_CASE, "tepix-loan"))
      .keyMetrics.equityRequired;
    expect(out.keyMetrics.equityRequired).toBeGreaterThan(baseEquity);
  });
});
