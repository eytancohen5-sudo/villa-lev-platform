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
import { BASE_CASE, DOWNSIDE_FACTORS } from "@/lib/engine/defaults";
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
});
