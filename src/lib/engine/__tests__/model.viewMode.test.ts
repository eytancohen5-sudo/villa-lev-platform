// Engine viewMode test — verifies the two cash-waterfall structures
// produce the expected DSCR / EBITDA / CFADS / taxableProfit relationships
// when OpCo fees are enabled.
//
// Why this matters: when OpCo is disabled (`opCoFee.enabled=false`) the two
// modes collapse to identical numbers (opCoTotalFee is zero), so the only
// meaningful regression surface is OpCo-enabled. We construct a single
// realistic scenario with OpCo on, then assert the two branches differ in
// the right direction and converge in the right limit.

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
  it("internal vs bank: stabilised DSCR differs when OpCo is enabled", () => {
    const internal = computeModel({ ...withOpCoEnabled(BASE_CASE), viewMode: "internal" });
    const bank = computeModel({ ...withOpCoEnabled(BASE_CASE), viewMode: "bank" });

    const dscrInternal = internal.keyMetrics.stabilisedDSCR;
    const dscrBank = bank.keyMetrics.stabilisedDSCR;

    // Internal: DSCR uses (ebitdaPreOpCo - opCoTotalFee) / ds
    // Bank:     DSCR uses  ebitdaPreOpCo                  / ds
    // ⇒ bank DSCR > internal DSCR whenever opCoTotalFee > 0.
    expect(dscrBank).toBeGreaterThan(dscrInternal);
    expect(Number.isFinite(dscrInternal)).toBe(true);
    expect(Number.isFinite(dscrBank)).toBe(true);
    expect(dscrInternal).toBeGreaterThan(0);
  });

  it("internal mode: ebitda equals ebitdaPreOpCo − opCoTotalFee on the stabilised year", () => {
    const out = computeModel({ ...withOpCoEnabled(BASE_CASE), viewMode: "internal" });
    const stab = out.scenarios.realistic.stabilisedYear;
    expect(stab).not.toBeNull();
    if (!stab) return;
    // opCoTotalFee is reported as the actually-paid amount; in 'internal'
    // mode the actually-paid IS the full opCoTotalFee (no cap), so:
    //   stab.ebitda + stab.opCoTotalFee === stab.ebitdaPreOpCo
    expect(stab.ebitda + stab.opCoTotalFee).toBeCloseTo(stab.ebitdaPreOpCo, 5);
  });

  it("bank mode: DSCR uses pre-OpCo EBITDA in the numerator", () => {
    const out = computeModel({ ...withOpCoEnabled(BASE_CASE), viewMode: "bank" });
    const stab = out.scenarios.realistic.stabilisedYear;
    expect(stab).not.toBeNull();
    if (!stab) return;
    // dscr === ebitdaPreOpCo / debtService
    expect(stab.dscr).toBeCloseTo(stab.ebitdaPreOpCo / stab.debtService, 5);
  });

  it("internal mode: DSCR uses post-OpCo EBITDA in the numerator", () => {
    const out = computeModel({ ...withOpCoEnabled(BASE_CASE), viewMode: "internal" });
    const stab = out.scenarios.realistic.stabilisedYear;
    expect(stab).not.toBeNull();
    if (!stab) return;
    // dscr === ebitda / debtService
    expect(stab.dscr).toBeCloseTo(stab.ebitda / stab.debtService, 5);
  });

  it("opCoFee disabled: bank view applies the per-villa senior floor; internal keeps per-villa fees", () => {
    // Updated 2026-05-22 — bank view replaces the per-villa `managementFee`
    // lines with the structural per-villa floor (opCoSeniorFloor × villaCount).
    // Direction of EBITDA divergence depends on whether the floor exceeds or
    // undercuts the existing per-villa fees in BASE_CASE — we assert the
    // delta MAGNITUDE matches the structural swap, not a fixed direction.
    const opCoOff: ModelAssumptions = {
      ...BASE_CASE,
      opCoFee: { ...BASE_CASE.opCoFee, enabled: false },
    };
    const internal = computeModel({ ...opCoOff, viewMode: "internal" });
    const bank = computeModel({ ...opCoOff, viewMode: "bank" });

    // Sanity: bank and internal MUST differ when floor ≠ per-villa total.
    // (They collapse only when matched — see the next test.)
    expect(bank.keyMetrics.stabilisedEBITDA).not.toBeCloseTo(
      internal.keyMetrics.stabilisedEBITDA,
      3,
    );

    // Magnitude sanity: EBITDA delta is in the ballpark of
    // (Σ per-villa managementFee) − floor. Exact equality fails because the
    // WC schedule reacts to the cash uplift (a few % swing in WC interest),
    // so we assert within ±10%.
    const perVillaTotal = opCoOff.portfolio.reduce(
      (sum, p) => sum + p.opex.managementFee * p.count,
      0,
    );
    // Per-villa floor: bank-view senior = opCoSeniorFloor × totalVillaCount.
    const totalVillaCount = opCoOff.portfolio.reduce((s, p) => s + p.count, 0);
    const bankSeniorTotal = opCoOff.opCoSeniorFloor * totalVillaCount;
    const expectedDelta = perVillaTotal - bankSeniorTotal;
    const actualDelta =
      bank.keyMetrics.stabilisedEBITDA - internal.keyMetrics.stabilisedEBITDA;
    // Sign-aware magnitude check: WC interest reacts to cash changes so we
    // allow ±10% around the expected delta in either direction.
    const tolerance = Math.abs(expectedDelta) * 0.1;
    expect(actualDelta).toBeGreaterThan(expectedDelta - tolerance);
    expect(actualDelta).toBeLessThan(expectedDelta + tolerance);
  });

  it("bank view: zero floor + OpCo disabled collapses back to internal", () => {
    // Sanity floor — with opCoSeniorFloor = 0 AND OpCo disabled, bank view
    // strips per-villa managementFee from OpEx and adds nothing back, so
    // EBITDA lifts by exactly the per-villa total. Setting the floor equal
    // to the aggregate per-villa fee should make the views collide again.
    const perVillaTotal = BASE_CASE.portfolio.reduce(
      (sum, p) => sum + p.opex.managementFee * p.count,
      0,
    );
    // Per-villa floor: to make bank-view senior match the per-villa aggregate,
    // set the floor to perVillaTotal / totalVillaCount.
    const totalVillaCount = BASE_CASE.portfolio.reduce((s, p) => s + p.count, 0);
    const matched: ModelAssumptions = {
      ...BASE_CASE,
      opCoFee: { ...BASE_CASE.opCoFee, enabled: false },
      opCoSeniorFloor: perVillaTotal / totalVillaCount,
    };
    const internal = computeModel({ ...matched, viewMode: "internal" });
    const bank = computeModel({ ...matched, viewMode: "bank" });
    expect(internal.keyMetrics.stabilisedDSCR).toBeCloseTo(
      bank.keyMetrics.stabilisedDSCR,
      8,
    );
    expect(internal.keyMetrics.stabilisedEBITDA).toBeCloseTo(
      bank.keyMetrics.stabilisedEBITDA,
      3,
    );
    expect(internal.keyMetrics.stabilisedNCF).toBeCloseTo(
      bank.keyMetrics.stabilisedNCF,
      3,
    );
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
