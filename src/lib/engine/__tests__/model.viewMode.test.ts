// Engine viewMode test — verifies the unified cash-waterfall formula.
//
// Post-floor-move (2026-06-01): the floor is no longer in OpEx; it is paid
// junior to debt service from the post-DS residual and accrues when unpaid.
// Key invariants:
//   - ebitdaPreOpCo = totalRevenue − totalOpex (no floor in OpEx)
//   - DSCR = ebitdaPreOpCo / DS in BOTH views (floor and junior never in numerator)
//   - ebitda = ebitdaPreOpCo − opCoFloorActuallyPaid − opCoJuniorPaid in both views
//   - viewMode no longer bifurcates the P&L computation
//
// The old "internal vs bank must differ when OpCo is enabled" invariant is gone.
// Both views now produce identical numbers — the viewMode field is inert in the
// engine (kept for Firestore backward-compat on existing saved scenarios).

import { describe, expect, it } from "vitest";

import { computeModel } from "@/lib/engine/model";
import { BASE_CASE } from "@/lib/engine/defaults";
import type { ModelAssumptions } from "@/lib/engine/types";

function withOpCoEnabled(base: ModelAssumptions): ModelAssumptions {
  return {
    ...base,
    opCoFee: {
      ...base.opCoFee,
      enabled: true,
    },
  };
}

describe("computeModel — viewMode branching", () => {
  it("unified formula: bank and internal produce identical stabilised DSCR", () => {
    // Post-unification: viewMode is inert. Both views use ebitdaPreOpCo / DS.
    const internal = computeModel({ ...withOpCoEnabled(BASE_CASE), viewMode: "internal" });
    const bank = computeModel({ ...withOpCoEnabled(BASE_CASE), viewMode: "bank" });

    const dscrInternal = internal.keyMetrics.stabilisedDSCR;
    const dscrBank = bank.keyMetrics.stabilisedDSCR;

    expect(Number.isFinite(dscrInternal)).toBe(true);
    expect(Number.isFinite(dscrBank)).toBe(true);
    expect(dscrInternal).toBeGreaterThan(0);
    // Both views produce the same DSCR under the unified formula.
    expect(dscrBank).toBeCloseTo(dscrInternal, 8);
  });

  it("unified: ebitda equals ebitdaPreOpCo − opCoSeniorPaid − opCoJuniorPaid on the stabilised year", () => {
    const out = computeModel({ ...withOpCoEnabled(BASE_CASE), viewMode: "internal" });
    const stab = out.scenarios.realistic.stabilisedYear;
    expect(stab).not.toBeNull();
    if (!stab) return;
    // Under the post-floor-move formula (floor is post-DS, not in OpEx):
    //   ebitda = ebitdaPreOpCo − opCoSeniorPaid − opCoJuniorPaid
    expect(stab.ebitda + stab.opCoSeniorPaid + stab.opCoJuniorPaid).toBeCloseTo(stab.ebitdaPreOpCo, 5);
  });

  it("unified: DSCR uses ebitdaPreOpCo / DS in the numerator (both views)", () => {
    for (const mode of ["internal", "bank"] as const) {
      const out = computeModel({ ...withOpCoEnabled(BASE_CASE), viewMode: mode });
      const stab = out.scenarios.realistic.stabilisedYear;
      expect(stab).not.toBeNull();
      if (!stab) return;
      // dscr === ebitdaPreOpCo / debtService in both views
      expect(stab.dscr).toBeCloseTo(stab.ebitdaPreOpCo / stab.debtService, 5);
    }
  });

  it("unified: viewMode does not change EBITDA when OpCo is disabled", () => {
    const opCoOff: ModelAssumptions = {
      ...BASE_CASE,
      opCoFee: { ...BASE_CASE.opCoFee, enabled: false },
    };
    const internal = computeModel({ ...opCoOff, viewMode: "internal" });
    const bank = computeModel({ ...opCoOff, viewMode: "bank" });

    // Under unified formula, both views share the same seniorFloor accounting.
    // viewMode is inert — EBITDA must be identical regardless of mode.
    expect(bank.keyMetrics.stabilisedEBITDA).toBeCloseTo(
      internal.keyMetrics.stabilisedEBITDA,
      3,
    );
  });

  it("floor post-DS: ebitdaPreOpCo is NOT reduced by the floor (floor is post-DS)", () => {
    // Floor is now paid from post-DS residual — it does NOT reduce ebitdaPreOpCo.
    // DSCR = ebitdaPreOpCo / DS is therefore higher than it was when the floor was in OpEx.
    // Verify: ebitdaPreOpCo = totalRevenue − totalOpex (no floor baked in).
    const out = computeModel({ ...withOpCoEnabled(BASE_CASE), viewMode: "bank" });
    const stab = out.scenarios.realistic.stabilisedYear;
    expect(stab).not.toBeNull();
    if (!stab) return;
    // DSCR = ebitdaPreOpCo / DS — floor never reduces this.
    expect(stab.dscr).toBeCloseTo(stab.ebitdaPreOpCo / stab.debtService, 5);
    expect(stab.dscr).toBeGreaterThan(0);
    // ebitdaPreOpCo = totalRevenue − totalOpex (floor not in totalOpex).
    expect(stab.ebitdaPreOpCo).toBeCloseTo(stab.totalRevenue - stab.totalOpex, 5);
    // Floor is deducted below the DSCR line (in ebitda).
    expect(stab.ebitda).toBeLessThan(stab.ebitdaPreOpCo);
  });

  it("default (omitted viewMode) matches explicit 'internal'", () => {
    // Defends against accidental flip of the default — if BASE_CASE drops
    // viewMode, the engine must still produce 'internal' (legacy) numbers.
    const onWithOpCo = withOpCoEnabled(BASE_CASE);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { viewMode: _drop, ...sansViewMode } = onWithOpCo as ModelAssumptions & {
      viewMode?: "internal" | "bank";
    };
    const defaulted = computeModel(sansViewMode as ModelAssumptions);
    const internal = computeModel({ ...onWithOpCo, viewMode: "internal" });
    expect(defaulted.keyMetrics.stabilisedDSCR).toBeCloseTo(
      internal.keyMetrics.stabilisedDSCR,
      8,
    );
  });
});
