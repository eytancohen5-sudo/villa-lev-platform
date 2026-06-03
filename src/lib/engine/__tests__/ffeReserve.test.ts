// ffeReserve.test.ts
//
// Asserts the year-by-year ffeReservePerUnit schedule after the engine
// guard was shifted from OPENING_YEAR (2029) to FIRST_OPERATIONAL_YEAR (2030).
//
// Key invariants under test:
//   year 2029 (OPENING_YEAR)          → ffeReservePerUnit === 0
//                                        even when ffeReserveFloor > 0
//   year 2030 (FIRST_OPERATIONAL_YEAR) → max(ffeReserveFloor, 0.02 × revenuePerUnit)
//   year 2031                           → max(ffeReserveFloor, 0.03 × revenuePerUnit)
//   year 2032+                          → max(ffeReserveFloor, 0.04 × revenuePerUnit)
//
// Approach: drive computeModel with a controlled single-property portfolio built
// from the Twin Villa template; read `ffeReservePerUnit` directly from
// propertyBreakdown[0] — the field is already exposed on the row type.
// No live Firestore / Skroutz / Eurobank calls; deterministic fixture only.

import { describe, expect, it } from "vitest";

import { computeModel } from "@/lib/engine/model";
import {
  BASE_CASE,
  BUILT_IN_TEMPLATES,
  resolvePortfolio,
  PROJECT_CONSTANTS,
} from "@/lib/engine/defaults";
import type { ModelAssumptions, PropertyConfig, PropertyTemplate } from "@/lib/engine/types";

const {
  OPENING_YEAR,           // 2029
  FIRST_OPERATIONAL_YEAR, // 2030
  STABILISED_YEAR,        // 2032
} = PROJECT_CONSTANTS;

// ── Fixture helpers ────────────────────────────────────────────────────────

function twinVillaTemplate(): PropertyTemplate {
  const tpl = BUILT_IN_TEMPLATES.find((t) => t.id === "tpl-twin-villa");
  if (!tpl) throw new Error("tpl-twin-villa not found in BUILT_IN_TEMPLATES");
  return { ...tpl, opex: { ...tpl.opex } };
}

/** Resolve a template to a single PropertyConfig, optionally overriding ffeReserveFloor. */
function resolveToConfig(tpl: PropertyTemplate, ffeReserveFloor?: number): PropertyConfig {
  const tplWithFloor: PropertyTemplate = {
    ...tpl,
    opex: {
      ...tpl.opex,
      ...(ffeReserveFloor !== undefined ? { ffeReserveFloor } : {}),
    },
  };
  const projects = [{ id: "proj-ffe-test", templateId: tplWithFloor.id, name: tplWithFloor.name, count: 1 }];
  const configs = resolvePortfolio([tplWithFloor], projects);
  if (configs.length === 0) throw new Error("resolvePortfolio returned empty array");
  return configs[0];
}

function buildAssumptions(prop: PropertyConfig, overrides: Partial<ModelAssumptions> = {}): ModelAssumptions {
  return { ...BASE_CASE, portfolio: [prop], ...overrides };
}

/** Extract ffeReservePerUnit and revenuePerUnit from the realistic P&L for a given year. */
function getFFERow(a: ModelAssumptions, year: number): { ffeReservePerUnit: number; revenuePerUnit: number } {
  const out = computeModel(a);
  const yearRow = out.scenarios.realistic.pnl.find((p) => p.year === year);
  if (!yearRow) throw new Error(`Year ${year} not found in realistic P&L`);
  const propRow = yearRow.propertyBreakdown[0];
  if (!propRow) throw new Error("No propertyBreakdown[0] for year " + year);
  return {
    ffeReservePerUnit: propRow.ffeReservePerUnit,
    revenuePerUnit: propRow.revenuePerUnit,
  };
}

// Use a clearly non-zero floor so the guard test is unambiguous.
const TEST_FFE_FLOOR = 25_000; // EUR/year — higher than the template default

// ── Suite 1: OPENING_YEAR (2029) produces zero regardless of ffeReserveFloor ─

describe("ffeReservePerUnit — opening year (2029) is always zero", () => {
  it("returns 0 for year 2029 when ffeReserveFloor is 0", () => {
    const prop = resolveToConfig(twinVillaTemplate(), 0);
    const { ffeReservePerUnit } = getFFERow(buildAssumptions(prop), OPENING_YEAR);
    expect(ffeReservePerUnit).toBe(0);
  });

  it("returns 0 for year 2029 even when ffeReserveFloor > 0", () => {
    // This is the critical regression guard: the floor must NOT fire in 2029.
    const prop = resolveToConfig(twinVillaTemplate(), TEST_FFE_FLOOR);
    const { ffeReservePerUnit } = getFFERow(buildAssumptions(prop), OPENING_YEAR);
    expect(ffeReservePerUnit).toBe(0);
  });

  it("confirms 2029 revenuePerUnit > 0 (revenue exists — engine silence is deliberate)", () => {
    // Revenue is non-zero in 2029 (partial-season ramp). The zero ffeReservePerUnit
    // is a deliberate design choice, not a side-effect of zero revenue.
    const prop = resolveToConfig(twinVillaTemplate(), TEST_FFE_FLOOR);
    const { revenuePerUnit } = getFFERow(buildAssumptions(prop), OPENING_YEAR);
    expect(revenuePerUnit).toBeGreaterThan(0);
  });
});

// ── Suite 2: FIRST_OPERATIONAL_YEAR (2030) — 2% rate ──────────────────────

describe("ffeReservePerUnit — first operational year (2030) uses 2% rate", () => {
  it("equals max(ffeReserveFloor, 0.02 × revenuePerUnit) when floor dominates", () => {
    // Set floor very high so it always wins regardless of revenue level.
    const highFloor = 999_999;
    const prop = resolveToConfig(twinVillaTemplate(), highFloor);
    const { ffeReservePerUnit } = getFFERow(buildAssumptions(prop), FIRST_OPERATIONAL_YEAR);
    expect(ffeReservePerUnit).toBe(highFloor);
  });

  it("equals max(ffeReserveFloor, 0.02 × revenuePerUnit) — formula shape", () => {
    const prop = resolveToConfig(twinVillaTemplate(), TEST_FFE_FLOOR);
    const { ffeReservePerUnit, revenuePerUnit } = getFFERow(buildAssumptions(prop), FIRST_OPERATIONAL_YEAR);
    const expected = Math.max(TEST_FFE_FLOOR, 0.02 * revenuePerUnit);
    expect(ffeReservePerUnit).toBeCloseTo(expected, 0);
  });

  it("equals max(ffeReserveFloor, 0.02 × revenuePerUnit) — rate wins when floor is 0", () => {
    const prop = resolveToConfig(twinVillaTemplate(), 0);
    const { ffeReservePerUnit, revenuePerUnit } = getFFERow(buildAssumptions(prop), FIRST_OPERATIONAL_YEAR);
    const expected = Math.max(0, 0.02 * revenuePerUnit);
    expect(ffeReservePerUnit).toBeCloseTo(expected, 0);
  });
});

// ── Suite 3: year 2031 — 3% rate ──────────────────────────────────────────

describe("ffeReservePerUnit — year 2031 uses 3% rate", () => {
  it("equals max(ffeReserveFloor, 0.03 × revenuePerUnit) when floor dominates", () => {
    const highFloor = 999_999;
    const prop = resolveToConfig(twinVillaTemplate(), highFloor);
    const { ffeReservePerUnit } = getFFERow(buildAssumptions(prop), FIRST_OPERATIONAL_YEAR + 1);
    expect(ffeReservePerUnit).toBe(highFloor);
  });

  it("equals max(ffeReserveFloor, 0.03 × revenuePerUnit) — formula shape", () => {
    const prop = resolveToConfig(twinVillaTemplate(), TEST_FFE_FLOOR);
    const { ffeReservePerUnit, revenuePerUnit } = getFFERow(buildAssumptions(prop), FIRST_OPERATIONAL_YEAR + 1);
    const expected = Math.max(TEST_FFE_FLOOR, 0.03 * revenuePerUnit);
    expect(ffeReservePerUnit).toBeCloseTo(expected, 0);
  });

  it("equals max(ffeReserveFloor, 0.03 × revenuePerUnit) — rate wins when floor is 0", () => {
    const prop = resolveToConfig(twinVillaTemplate(), 0);
    const { ffeReservePerUnit, revenuePerUnit } = getFFERow(buildAssumptions(prop), FIRST_OPERATIONAL_YEAR + 1);
    const expected = Math.max(0, 0.03 * revenuePerUnit);
    expect(ffeReservePerUnit).toBeCloseTo(expected, 0);
  });
});

// ── Suite 4: year 2032+ (STABILISED_YEAR) — 4% rate ───────────────────────

describe("ffeReservePerUnit — stabilised year (2032+) uses 4% rate", () => {
  it("equals max(ffeReserveFloor, 0.04 × revenuePerUnit) at STABILISED_YEAR (2032)", () => {
    const prop = resolveToConfig(twinVillaTemplate(), TEST_FFE_FLOOR);
    const { ffeReservePerUnit, revenuePerUnit } = getFFERow(buildAssumptions(prop), STABILISED_YEAR);
    const expected = Math.max(TEST_FFE_FLOOR, 0.04 * revenuePerUnit);
    expect(ffeReservePerUnit).toBeCloseTo(expected, 0);
  });

  it("equals max(ffeReserveFloor, 0.04 × revenuePerUnit) at STABILISED_YEAR — rate wins when floor is 0", () => {
    const prop = resolveToConfig(twinVillaTemplate(), 0);
    const { ffeReservePerUnit, revenuePerUnit } = getFFERow(buildAssumptions(prop), STABILISED_YEAR);
    const expected = Math.max(0, 0.04 * revenuePerUnit);
    expect(ffeReservePerUnit).toBeCloseTo(expected, 0);
  });

  it("equals max(ffeReserveFloor, 0.04 × revenuePerUnit) one year beyond STABILISED_YEAR (2033)", () => {
    const prop = resolveToConfig(twinVillaTemplate(), TEST_FFE_FLOOR);
    const { ffeReservePerUnit, revenuePerUnit } = getFFERow(buildAssumptions(prop), STABILISED_YEAR + 1);
    const expected = Math.max(TEST_FFE_FLOOR, 0.04 * revenuePerUnit);
    expect(ffeReservePerUnit).toBeCloseTo(expected, 0);
  });
});

// ── Suite 5: rate schedule monotonicity (cross-year sanity) ───────────────

describe("ffeReservePerUnit — rate increases year over year (floor=0)", () => {
  it("ffeReservePerUnit is monotonically non-decreasing from 2030 through 2032", () => {
    const prop = resolveToConfig(twinVillaTemplate(), 0);
    const a = buildAssumptions(prop);

    const ffe2030 = getFFERow(a, FIRST_OPERATIONAL_YEAR).ffeReservePerUnit;
    const ffe2031 = getFFERow(a, FIRST_OPERATIONAL_YEAR + 1).ffeReservePerUnit;
    const ffe2032 = getFFERow(a, STABILISED_YEAR).ffeReservePerUnit;

    expect(ffe2030).toBeLessThanOrEqual(ffe2031);
    expect(ffe2031).toBeLessThanOrEqual(ffe2032);
  });

  it("ffeReservePerUnit jumps from zero (2029) to positive (2030) when ffeReserveFloor > 0", () => {
    const prop = resolveToConfig(twinVillaTemplate(), TEST_FFE_FLOOR);
    const a = buildAssumptions(prop);

    const ffe2029 = getFFERow(a, OPENING_YEAR).ffeReservePerUnit;
    const ffe2030 = getFFERow(a, FIRST_OPERATIONAL_YEAR).ffeReservePerUnit;

    expect(ffe2029).toBe(0);
    expect(ffe2030).toBeGreaterThan(0);
  });
});

// ── Suite 6: ffeSchedule override ─────────────────────────────────────────
//
// When a.ffeSchedule is provided, the custom rates override the 2/3/4% defaults.
// 2029 must still produce zero even with custom rates set.

describe("ffeReservePerUnit — ffeSchedule custom rates respected", () => {
  const customSchedule = { rate2029: 0.05, rate2030: 0.06, rateStabilised: 0.07 };

  it("custom schedule: 2029 still returns 0", () => {
    const prop = resolveToConfig(twinVillaTemplate(), TEST_FFE_FLOOR);
    const a = buildAssumptions(prop, { ffeSchedule: customSchedule });
    const { ffeReservePerUnit } = getFFERow(a, OPENING_YEAR);
    expect(ffeReservePerUnit).toBe(0);
  });

  it("custom schedule: 2030 uses rate2029 (0.05)", () => {
    const prop = resolveToConfig(twinVillaTemplate(), 0);
    const a = buildAssumptions(prop, { ffeSchedule: customSchedule });
    const { ffeReservePerUnit, revenuePerUnit } = getFFERow(a, FIRST_OPERATIONAL_YEAR);
    expect(ffeReservePerUnit).toBeCloseTo(0.05 * revenuePerUnit, 0);
  });

  it("custom schedule: 2031 uses rate2030 (0.06)", () => {
    const prop = resolveToConfig(twinVillaTemplate(), 0);
    const a = buildAssumptions(prop, { ffeSchedule: customSchedule });
    const { ffeReservePerUnit, revenuePerUnit } = getFFERow(a, FIRST_OPERATIONAL_YEAR + 1);
    expect(ffeReservePerUnit).toBeCloseTo(0.06 * revenuePerUnit, 0);
  });

  it("custom schedule: 2032 uses rateStabilised (0.07)", () => {
    const prop = resolveToConfig(twinVillaTemplate(), 0);
    const a = buildAssumptions(prop, { ffeSchedule: customSchedule });
    const { ffeReservePerUnit, revenuePerUnit } = getFFERow(a, STABILISED_YEAR);
    expect(ffeReservePerUnit).toBeCloseTo(0.07 * revenuePerUnit, 0);
  });
});
