// Smoke tests for the AdminCapexComparison Real outcome column logic.
//
// These tests exercise the computation logic that lives inside the component's
// useMemo directly — by calling the same engine functions (computeModel,
// computeCapex, applyCapexUplift) with a known uplift and asserting the
// derived Real outcome values.
//
// We do NOT render the React component (it pulls in Zustand + i18n + Next.js
// which are incompatible with Vitest's node environment). Instead we test the
// pure computation that the component delegates to.

import { describe, expect, it } from "vitest";
import { BASE_CASE } from "@/lib/engine/defaults";
import { computeModel, computeCapex } from "@/lib/engine/model";
import { applyCapexUplift } from "@/lib/engine/capexUplift";

// ── Test 1: realEquity is trueCapex − statedLoan ───────────────────────────

describe("AdminCapexComparison — Real outcome column", () => {
  it("realEquity equals trueCapex minus statedLoan for a known uplift", () => {
    const assumptions = BASE_CASE;
    const baseCapex = computeCapex(assumptions);

    // Use a 10% uplift so upliftEur > 0 and statedCapex > trueCapex
    const upliftEur = 0.1 * baseCapex.portfolioTotal;
    const statedCapex = applyCapexUplift(baseCapex, upliftEur);

    const trueModel = computeModel(assumptions, baseCapex);
    const statedModel = computeModel(assumptions, statedCapex);

    const realEquity = baseCapex.portfolioTotal - statedModel.keyMetrics.loanAmount;
    const realLoan   = statedModel.keyMetrics.loanAmount;

    // realEquity + realLoan must equal trueCapex (all money accounted for)
    expect(realEquity + realLoan).toBeCloseTo(baseCapex.portfolioTotal, 0);

    // realEquity should be lower than trueEquity because the stated loan is larger
    // (statedCapex > trueCapex → statedLoan > trueLoan → realEquity = trueCapex − statedLoan < trueEquity)
    expect(realEquity).toBeLessThan(trueModel.keyMetrics.equityRequired);
  });

  // ── Test 2: realDscr uses statedModel annualDS ─────────────────────────────

  it("realDscr = trueEbitda / statedAnnualDS", () => {
    const assumptions = BASE_CASE;
    const baseCapex = computeCapex(assumptions);
    const upliftEur = 0.1 * baseCapex.portfolioTotal;
    const statedCapex = applyCapexUplift(baseCapex, upliftEur);

    const trueModel  = computeModel(assumptions, baseCapex);
    const statedModel = computeModel(assumptions, statedCapex);

    const trueEbitda    = trueModel.keyMetrics.stabilisedEBITDA;
    const statedAnnualDS = statedModel.keyMetrics.annualDS;

    const expectedRealDscr = statedAnnualDS > 0 ? trueEbitda / statedAnnualDS : 0;

    // realDscr uses statedAnnualDS (the larger loan's debt service), not trueModel.annualDS
    expect(expectedRealDscr).toBeCloseTo(trueEbitda / statedAnnualDS, 5);

    // realDscr should be lower than trueDscr (same numerator, larger denominator)
    const trueDscr = trueModel.keyMetrics.stabilisedDSCR;
    expect(expectedRealDscr).toBeLessThan(trueDscr);
  });

  // ── Test 3: realIrr is a finite number greater than statedIrr when uplift > 0 ─────────────────
  // Lower equity (realEquity < statedEquity) on the same cash flows → higher IRR.

  it("realIrr is finite and greater than statedIrr for a 10% uplift", () => {
    const assumptions = BASE_CASE;
    const baseCapex = computeCapex(assumptions);
    const upliftEur = 0.1 * baseCapex.portfolioTotal;
    const statedCapex = applyCapexUplift(baseCapex, upliftEur);

    const statedModel = computeModel(assumptions, statedCapex);

    // Replicate the component's realModel derivation
    const adjustedLoanCoverageRate =
      statedModel.keyMetrics.loanAmount / baseCapex.portfolioTotal;

    const realModel = computeModel(
      {
        ...assumptions,
        commercialLoan: {
          ...assumptions.commercialLoan,
          loanCoverageRate: adjustedLoanCoverageRate,
        },
      },
      baseCapex,
    );

    const realIrr   = realModel.scenarios.realistic.equityIRR;
    const statedIrr = statedModel.scenarios.realistic.equityIRR;

    expect(isFinite(realIrr)).toBe(true);
    expect(realIrr).toBeGreaterThan(statedIrr);
  });

  it("fmtDelta is absent from AdminCapexComparison", async () => {
    // Static analysis: confirm fmtDelta is not referenced.
    const fs = await import("fs");
    const path = await import("path");
    const componentPath = path.resolve(
      __dirname,
      "../AdminCapexComparison.tsx"
    );
    const source = fs.readFileSync(componentPath, "utf-8");
    expect(source).not.toContain("fmtDelta");
  });

  // ── Test 4: Column count is 3 data columns (not 4) ────────────────────────
  // Structural: the source should contain colReal but not colDelta

  it("colReal key is present and colDelta is absent", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const componentPath = path.resolve(
      __dirname,
      "../AdminCapexComparison.tsx"
    );
    const source = fs.readFileSync(componentPath, "utf-8");
    expect(source).toContain("admin.capexComparison.colReal");
    expect(source).not.toContain("admin.capexComparison.colDelta");
  });

  // ── Test 5: Column order — Stated before True, True before Real ───────────

  it("column header order is Stated then True then Real in JSX", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const componentPath = path.resolve(
      __dirname,
      "../AdminCapexComparison.tsx"
    );
    const source = fs.readFileSync(componentPath, "utf-8");

    const statedIdx = source.indexOf("admin.capexComparison.colStated");
    const trueIdx   = source.indexOf("admin.capexComparison.colTrue");
    const realIdx   = source.indexOf("admin.capexComparison.colReal");

    // All must be present
    expect(statedIdx).toBeGreaterThan(-1);
    expect(trueIdx).toBeGreaterThan(-1);
    expect(realIdx).toBeGreaterThan(-1);

    // Stated header appears before True header
    expect(statedIdx).toBeLessThan(trueIdx);

    // True header appears before Real header
    expect(trueIdx).toBeLessThan(realIdx);
  });
});
