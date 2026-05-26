// opexContingency.test.ts
//
// Tests for the `opexContingencyRate` field on PropertyConfig / PropertyTemplate.
//
// Design: computeOpexForProperty is not exported from model.ts, so these tests
// drive it via computeModel with a controlled single-property portfolio, then
// read `propertyBreakdown[0].opexPerUnit` from the relevant P&L year — the
// exact value that computeOpexForProperty returned. This is the smallest
// observable surface without requiring a production-code export change.
//
// Year references:
//   OPENING_YEAR           = 2028  (FF&E Reserve begins, floor only — ffeReserveFloor)
//   FIRST_OPERATIONAL_YEAR = 2029  (ffeReserveRatePct = 0.02)
//   FIRST_OPERATIONAL_YEAR+1 = 2030 (ffeReserveRatePct = 0.03)
//   STABILISED_YEAR        = 2031  (ffeReserveRatePct = 0.04) ← anchor for most tests
//
// Twin Villa controllable opex (baseOpexNoMaintenance after OpEx restructure 2026-05-25):
//   housekeeping:  15,000
//   utilities:     12,000
//   insurance:      2,500
//   propertyTax:    4,000
//   marketing:      4,000
//   managementFee:      0  (deprecated; accounted for in OpCo, not property OpEx)
//   consumables:    5,000
//   accounting:     7,000
//   extraOpexLines: 0 (none)
//   total:         49,500 EUR
//
// FF&E Reserve is revenue-based (not construction-cost-derived):
//   ffeReservePerUnit = max(ffeReserveFloor, ffeReserveRatePct × revenuePerUnit)
//   Twin Villa ffeReserveFloor = 20,000
//   At STABILISED_YEAR (rate=0.04), FFE Reserve = max(20000, 0.04 × revenuePerUnit)
//
// Note: prop.opex.maintenance (21,000 on the template) is a legacy field; the
// engine no longer reads it for computation.

import { describe, expect, it } from "vitest";

import { computeModel } from "@/lib/engine/model";
import {
  BASE_CASE,
  BUILT_IN_TEMPLATES,
  resolvePortfolio,
  DEFAULT_PROJECTS,
} from "@/lib/engine/defaults";
import { PROJECT_CONSTANTS } from "@/lib/engine/defaults";
import type { ModelAssumptions, PropertyConfig, PropertyTemplate } from "@/lib/engine/types";

const { STABILISED_YEAR } = PROJECT_CONSTANTS;

// ── Constants derived from Twin Villa template ──────────────────────────────

// Twin Villa controllable opex (post-OpEx-restructure 2026-05-25):
// managementFee is now 0 — accounted for in OpCo, not property OpEx.
const TWIN_VILLA_CONTROLLABLE_OPEX = 15000 + 12000 + 2500 + 4000 + 4000 + 0 + 5000 + 7000; // 49,500

// ffeReserveFloor for Twin Villa = 20,000 EUR/year (from defaults.ts)
const TWIN_VILLA_FFE_RESERVE_FLOOR = 20000;

// ── Helper: build a minimal single-property ModelAssumptions ────────────────

function singlePropertyAssumptions(
  prop: PropertyConfig,
  overrides: Partial<ModelAssumptions> = {}
): ModelAssumptions {
  return {
    ...BASE_CASE,
    portfolio: [prop],
    ...overrides,
  };
}

// Clone the Twin Villa template from BUILT_IN_TEMPLATES
function twinVillaTemplate(): PropertyTemplate {
  const tpl = BUILT_IN_TEMPLATES.find((t) => t.id === "tpl-twin-villa");
  if (!tpl) throw new Error("tpl-twin-villa not found in BUILT_IN_TEMPLATES");
  return { ...tpl, opex: { ...tpl.opex } };
}

// Resolve a template into a single PropertyConfig (count=1, one project)
function resolveToConfig(tpl: PropertyTemplate, opexContingencyRate?: number): PropertyConfig {
  const template: PropertyTemplate = {
    ...tpl,
    opexContingencyRate: opexContingencyRate ?? (tpl.opexContingencyRate ?? 0),
  };
  const projects = [{ id: "proj-test", templateId: template.id, name: template.name, count: 1 }];
  const configs = resolvePortfolio([template], projects);
  if (configs.length === 0) throw new Error("resolvePortfolio returned empty array");
  return configs[0];
}

// Extract opexPerUnit for a given year from a single-property scenario
function getOpexPerUnit(a: ModelAssumptions, year: number): number {
  const out = computeModel(a);
  const yearRow = out.scenarios.realistic.pnl.find((p) => p.year === year);
  if (!yearRow) throw new Error(`Year ${year} not found in P&L`);
  const propRow = yearRow.propertyBreakdown[0];
  if (!propRow) throw new Error("No propertyBreakdown[0]");
  return propRow.opexPerUnit;
}

// ── Test: 1 — Zero contingency (regression guard) ──────────────────────────

describe("opexContingencyRate — zero contingency regression guard", () => {
  it("opexContingencyRate: 0 produces identical stabilised totalOpex as BASE_CASE", () => {
    // BASE_CASE portfolio has opexContingencyRate: 0 on both properties.
    // Explicitly setting it to 0 on all portfolio items must yield the same
    // stabilised totalOpex — confirming the field is inert when zero.
    const baseOut = computeModel(BASE_CASE);
    const baseTotalOpex = baseOut.scenarios.realistic.stabilisedYear?.totalOpex;
    if (baseTotalOpex === undefined) throw new Error("BASE_CASE has no stabilisedYear");

    // Reconstruct with all opexContingencyRate fields explicitly 0
    const explicitZero: ModelAssumptions = {
      ...BASE_CASE,
      portfolio: BASE_CASE.portfolio.map((p) => ({
        ...p,
        opexContingencyRate: 0,
      })),
    };
    const explicitOut = computeModel(explicitZero);
    const explicitTotalOpex = explicitOut.scenarios.realistic.stabilisedYear?.totalOpex;
    if (explicitTotalOpex === undefined) throw new Error("explicit zero has no stabilisedYear");

    expect(explicitTotalOpex).toBeCloseTo(baseTotalOpex, 0); // within 1 EUR
  });

  it("opexContingencyRate: undefined defaults to 0 (nullish coalesce)", () => {
    // A config without opexContingencyRate should behave identically to rate=0
    const tpl = twinVillaTemplate();
    const withUndefined = resolveToConfig({ ...tpl, opexContingencyRate: undefined });
    const withZero = resolveToConfig({ ...tpl, opexContingencyRate: 0 });

    const opexUndefined = getOpexPerUnit(singlePropertyAssumptions(withUndefined), STABILISED_YEAR);
    const opexZero = getOpexPerUnit(singlePropertyAssumptions(withZero), STABILISED_YEAR);

    expect(opexUndefined).toBeCloseTo(opexZero, 0);
  });
});

// ── Test: 2 — Non-zero contingency applied to controllable opex ─────────────

describe("opexContingencyRate — non-zero contingency (10%)", () => {
  it("stabilised opexPerUnit equals controllableOpex×1.10 + maintenance", () => {
    const tpl = twinVillaTemplate();
    const prop = resolveToConfig(tpl, 0.10);
    const a = singlePropertyAssumptions(prop);

    // Extract revenuePerUnit from engine to compute expected maintenance
    const out = computeModel(a);
    const stabYear = out.scenarios.realistic.pnl.find((p) => p.year === STABILISED_YEAR);
    if (!stabYear) throw new Error("no stabilised year");
    const revPerUnit = stabYear.propertyBreakdown[0]?.revenuePerUnit ?? 0;
    const expectedMaint = Math.max(TWIN_VILLA_FFE_RESERVE_FLOOR, 0.04 * revPerUnit);

    const expectedControllable = TWIN_VILLA_CONTROLLABLE_OPEX * 1.10; // 54,450
    const expectedTotal = expectedControllable + expectedMaint;

    const actual = stabYear.propertyBreakdown[0]?.opexPerUnit ?? 0;

    // Allow ±1 EUR for floating-point rounding
    expect(actual).toBeCloseTo(expectedTotal, 0);
  });

  it("zero-contingency baseline differs from 10% contingency by exactly the buffer amount", () => {
    const tpl = twinVillaTemplate();
    const propZero = resolveToConfig(tpl, 0);
    const propTen = resolveToConfig(tpl, 0.10);

    const opexZero = getOpexPerUnit(singlePropertyAssumptions(propZero), STABILISED_YEAR);
    const opexTen = getOpexPerUnit(singlePropertyAssumptions(propTen), STABILISED_YEAR);

    // Maintenance is the same in both (only contingency multiplier differs)
    const expectedDelta = TWIN_VILLA_CONTROLLABLE_OPEX * 0.10; // 4,950
    expect(opexTen - opexZero).toBeCloseTo(expectedDelta, 0);
  });
});

// ── Test: 3 — Maintenance is excluded from the contingency multiplier ────────

describe("opexContingencyRate — maintenance excluded from multiplier", () => {
  it("stripping maintenance from the 10% result leaves exactly controllableOpex×1.10", () => {
    const tpl = twinVillaTemplate();
    const prop = resolveToConfig(tpl, 0.10);
    const a = singlePropertyAssumptions(prop);

    // Derive expected maintenance from engine at stabilised year
    const out = computeModel(a);
    const stabYear = out.scenarios.realistic.pnl.find((p) => p.year === STABILISED_YEAR);
    if (!stabYear) throw new Error("no stabilised year");
    const revPerUnit = stabYear.propertyBreakdown[0]?.revenuePerUnit ?? 0;
    const expectedMaint = Math.max(TWIN_VILLA_FFE_RESERVE_FLOOR, 0.04 * revPerUnit);

    const actualTotal = stabYear.propertyBreakdown[0]?.opexPerUnit ?? 0;
    const controllableOnly = actualTotal - expectedMaint;

    // Should be exactly controllableOpex × 1.10, not more
    expect(controllableOnly).toBeCloseTo(TWIN_VILLA_CONTROLLABLE_OPEX * 1.10, 0);
  });

  it("maintenance component does not compound with contingency rate", () => {
    // If maintenance were mistakenly included in the contingency base, the
    // result would be (controllableOpex + maintenance) × 1.10 — i.e. larger
    // by 10% of maintenance. Assert the actual result is smaller than that.
    const tpl = twinVillaTemplate();
    const prop = resolveToConfig(tpl, 0.10);
    const a = singlePropertyAssumptions(prop);

    const out = computeModel(a);
    const stabYear = out.scenarios.realistic.pnl.find((p) => p.year === STABILISED_YEAR);
    if (!stabYear) throw new Error("no stabilised year");
    const revPerUnit = stabYear.propertyBreakdown[0]?.revenuePerUnit ?? 0;
    const expectedMaint = Math.max(TWIN_VILLA_FFE_RESERVE_FLOOR, 0.04 * revPerUnit);

    const actualTotal = stabYear.propertyBreakdown[0]?.opexPerUnit ?? 0;
    const wrongTotal = (TWIN_VILLA_CONTROLLABLE_OPEX + expectedMaint) * 1.10;

    expect(actualTotal).toBeLessThan(wrongTotal);
  });

  it("different maintenance rates across years do not interact with contingency rate", () => {
    // The revenue-based maintenance schedule:
    //   year 2029 (FIRST_OPERATIONAL_YEAR): rate = 0.02
    //   year 2030 (FIRST_OPERATIONAL_YEAR+1): rate = 0.03
    //   year 2031 (STABILISED_YEAR):         rate = 0.04
    // The contingency multiplier on controllable opex must be constant (1.10)
    // regardless of which maintenance rate applies. Verify by checking the
    // controllable-opex component (after subtracting the year's maintenance).
    const tpl = twinVillaTemplate();
    const prop = resolveToConfig(tpl, 0.10);
    const a = singlePropertyAssumptions(prop);

    const FIRST_OP = PROJECT_CONSTANTS.FIRST_OPERATIONAL_YEAR; // 2029

    const out = computeModel(a);

    const maintRatePcts: Record<number, number> = {
      [FIRST_OP]: 0.02,
      [FIRST_OP + 1]: 0.03,
      [STABILISED_YEAR]: 0.04,
    };

    for (const [yearStr, ratePct] of Object.entries(maintRatePcts)) {
      const year = Number(yearStr);
      const yearRow = out.scenarios.realistic.pnl.find((p) => p.year === year);
      if (!yearRow) throw new Error(`year ${year} not found`);
      const revPerUnit = yearRow.propertyBreakdown[0]?.revenuePerUnit ?? 0;
      const expectedMaint = Math.max(TWIN_VILLA_FFE_RESERVE_FLOOR, ratePct * revPerUnit);
      const actualTotal = yearRow.propertyBreakdown[0]?.opexPerUnit ?? 0;
      const controllableActual = actualTotal - expectedMaint;
      expect(controllableActual).toBeCloseTo(TWIN_VILLA_CONTROLLABLE_OPEX * 1.10, 0);
    }
  });
});

// ── Test: 4 — resolvePortfolio passthrough ───────────────────────────────────

describe("resolvePortfolio — opexContingencyRate passthrough", () => {
  it("passes opexContingencyRate: 0.07 from template to resolved PropertyConfig", () => {
    const tpl = { ...twinVillaTemplate(), opexContingencyRate: 0.07 };
    const config = resolveToConfig(tpl, 0.07);
    expect(config.opexContingencyRate).toBe(0.07);
  });

  it("passes opexContingencyRate: 0.00 from template explicitly", () => {
    const tpl = { ...twinVillaTemplate(), opexContingencyRate: 0.00 };
    const config = resolveToConfig(tpl, 0.00);
    expect(config.opexContingencyRate).toBe(0);
  });

  it("defaults opexContingencyRate to 0 when template field is undefined", () => {
    // Simulates a legacy template that predates the field
    const tpl: PropertyTemplate = { ...twinVillaTemplate(), opexContingencyRate: undefined };
    const projects = [{ id: "proj-legacy", templateId: tpl.id, name: tpl.name, count: 1 }];
    const configs = resolvePortfolio([tpl], projects);
    expect(configs.length).toBe(1);
    expect(configs[0].opexContingencyRate).toBe(0);
  });

  it("DEFAULT_PROJECTS resolved via BUILT_IN_TEMPLATES carry opexContingencyRate: 0", () => {
    // Confirm the canonical BASE_CASE portfolio round-trips correctly
    const configs = resolvePortfolio(BUILT_IN_TEMPLATES, DEFAULT_PROJECTS);
    for (const config of configs) {
      expect(config.opexContingencyRate).toBe(0);
    }
  });
});
