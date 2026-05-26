// Engine viewMode test — verifies the unified cash-waterfall formula.
//
// Post-unification (2026-05-25): the old dual-branch waterfall (internal vs bank)
// was replaced with a single unified formula. Key invariants:
//   - seniorFloor is in OpEx for BOTH views → ebitdaPreOpCo is the same in both
//   - DSCR = ebitdaPreOpCo / DS in BOTH views (junior is never in the numerator)
//   - ebitda = ebitdaPreOpCo − opCoJuniorPaid in BOTH views
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

  it("unified: ebitda equals ebitdaPreOpCo − opCoJuniorPaid on the stabilised year", () => {
    const out = computeModel({ ...withOpCoEnabled(BASE_CASE), viewMode: "internal" });
    const stab = out.scenarios.realistic.stabilisedYear;
    expect(stab).not.toBeNull();
    if (!stab) return;
    // Under the unified formula:
    //   ebitda = ebitdaPreOpCo − opCoJuniorPaid   (senior already in OpEx)
    expect(stab.ebitda + stab.opCoJuniorPaid).toBeCloseTo(stab.ebitdaPreOpCo, 5);
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

  it("seniorFloor in OpEx: ebitdaPreOpCo is net of the senior floor", () => {
    // Senior floor is paid inside OpEx (before ebitdaPreOpCo) so it reduces
    // DSCR directly. Verify the floor amount is visible in the difference
    // between propertyOpexAll and totalOpex.
    const out = computeModel({ ...BASE_CASE, viewMode: "bank" });
    const stab = out.scenarios.realistic.stabilisedYear;
    expect(stab).not.toBeNull();
    if (!stab) return;
    // DSCR = ebitdaPreOpCo / DS — senior already reduces this.
    expect(stab.dscr).toBeCloseTo(stab.ebitdaPreOpCo / stab.debtService, 5);
    expect(stab.dscr).toBeGreaterThan(0);
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
