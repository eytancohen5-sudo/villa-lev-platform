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

  it("opCoFee disabled: the two modes collapse to identical headline metrics", () => {
    // Sanity floor — when opCoTotalFee is zero, neither waterfall takes
    // anything from EBITDA, so DSCR / NCF / cfads must match exactly.
    const opCoOff: ModelAssumptions = {
      ...BASE_CASE,
      opCoFee: { ...BASE_CASE.opCoFee, enabled: false },
    };
    const internal = computeModel({ ...opCoOff, viewMode: "internal" });
    const bank = computeModel({ ...opCoOff, viewMode: "bank" });
    expect(internal.keyMetrics.stabilisedDSCR).toBeCloseTo(
      bank.keyMetrics.stabilisedDSCR,
      8,
    );
    expect(internal.keyMetrics.stabilisedEBITDA).toBeCloseTo(
      bank.keyMetrics.stabilisedEBITDA,
      5,
    );
    expect(internal.keyMetrics.stabilisedNCF).toBeCloseTo(
      bank.keyMetrics.stabilisedNCF,
      5,
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
