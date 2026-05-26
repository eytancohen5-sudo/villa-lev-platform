// Unit tests for the pure helpers extracted from InvestorSensitivityTab.
//
// Import exclusively from the sidecar module (investorSensitivityHelpers.ts),
// not from the component itself, to avoid pulling in the React / Zustand graph
// which is incompatible with Vitest's node environment.
//
// Fixture: BASE_CASE from engine defaults — cold-start values. For slider /
// readBaseValues tests we only need the shape, not live Firestore state.

import { describe, expect, it } from "vitest";
import { BASE_CASE } from "@/lib/engine/defaults";
import type { ModelAssumptions } from "@/lib/engine/types";

import {
  irrColor,
  moicColor,
  yieldColor,
  applySliders,
  readBaseValues,
  type SliderValues,
} from "@/components/investorSensitivityHelpers";

// ── Minimal fixture helpers ───────────────────────────────────────────────────

/** Clone BASE_CASE with specific top-level overrides for a test. */
function makeAssumptions(overrides: Partial<ModelAssumptions> = {}): ModelAssumptions {
  return { ...BASE_CASE, ...overrides };
}

/** Build a SliderValues object seeded from BASE_CASE with optional field overrides. */
function makeSliders(overrides: Partial<SliderValues> = {}): SliderValues {
  const base = readBaseValues(BASE_CASE);
  return { ...base, ...overrides };
}

// ── 1. irrColor thresholds ────────────────────────────────────────────────────

describe("irrColor", () => {
  it("returns text-positive for 0.20 (above upper threshold)", () => {
    expect(irrColor(0.20)).toBe("text-positive");
  });

  it("returns text-positive at exact upper boundary 0.15", () => {
    expect(irrColor(0.15)).toBe("text-positive");
  });

  it("returns text-warning for 0.14 (just below upper boundary)", () => {
    expect(irrColor(0.14)).toBe("text-warning");
  });

  it("returns text-warning at exact lower boundary 0.08", () => {
    expect(irrColor(0.08)).toBe("text-warning");
  });

  it("returns text-negative for 0.07 (just below lower boundary)", () => {
    expect(irrColor(0.07)).toBe("text-negative");
  });

  it("returns text-negative for 0 (zero)", () => {
    expect(irrColor(0)).toBe("text-negative");
  });
});

// ── 2. moicColor thresholds ───────────────────────────────────────────────────

describe("moicColor", () => {
  it("returns text-positive for 2.5 (above upper threshold)", () => {
    expect(moicColor(2.5)).toBe("text-positive");
  });

  it("returns text-positive at exact upper boundary 2.0", () => {
    expect(moicColor(2.0)).toBe("text-positive");
  });

  it("returns text-warning for 1.5 (between boundaries)", () => {
    expect(moicColor(1.5)).toBe("text-warning");
  });

  it("returns text-warning at exact lower boundary 1.0", () => {
    expect(moicColor(1.0)).toBe("text-warning");
  });

  it("returns text-negative for 0.8 (below lower boundary)", () => {
    expect(moicColor(0.8)).toBe("text-negative");
  });
});

// ── 3. yieldColor thresholds ──────────────────────────────────────────────────

describe("yieldColor", () => {
  it("returns text-positive for 0.15 (above upper threshold)", () => {
    expect(yieldColor(0.15)).toBe("text-positive");
  });

  it("returns text-positive at exact upper boundary 0.12", () => {
    expect(yieldColor(0.12)).toBe("text-positive");
  });

  it("returns text-warning for 0.09 (between boundaries)", () => {
    expect(yieldColor(0.09)).toBe("text-warning");
  });

  it("returns text-warning at exact lower boundary 0.06", () => {
    expect(yieldColor(0.06)).toBe("text-warning");
  });

  it("returns text-negative for 0.04 (below lower boundary)", () => {
    expect(yieldColor(0.04)).toBe("text-negative");
  });
});

// ── 4. applySliders sets viewMode = 'internal' ────────────────────────────────

describe("applySliders — viewMode", () => {
  it("always sets viewMode to 'internal' regardless of input viewMode", () => {
    const assumptions = makeAssumptions({ viewMode: "bank" });
    const sliders = makeSliders();
    const result = applySliders(assumptions, sliders);
    expect(result.viewMode).toBe("internal");
  });
});

// ── 5. applySliders sets exitYear ─────────────────────────────────────────────

describe("applySliders — exitYear", () => {
  it("propagates the slider exitYear to the cloned assumptions", () => {
    const assumptions = makeAssumptions({ exitYear: 2032 });
    const sliders = makeSliders({ exitYear: 2035 });
    const result = applySliders(assumptions, sliders);
    expect(result.exitYear).toBe(2035);
  });
});

// ── 6. applySliders lockstep suiteADR ────────────────────────────────────────

describe("applySliders — suiteADR lockstep", () => {
  it("writes suiteADR slider value into both suiteStandardADR and suiteDoubleADR", () => {
    const sliders = makeSliders({ suiteADR: 1800 });
    const result = applySliders(BASE_CASE, sliders);
    expect(result.revenueRealistic.suiteStandardADR).toBe(1800);
    expect(result.revenueRealistic.suiteDoubleADR).toBe(1800);
  });
});

// ── 7. applySliders lockstep occupancy ────────────────────────────────────────

describe("applySliders — occupancy lockstep", () => {
  it("writes villaBaseNights slider value into both villaBaseNights and suiteBaseNights", () => {
    const sliders = makeSliders({ villaBaseNights: 100 });
    const result = applySliders(BASE_CASE, sliders);
    expect(result.revenueRealistic.villaBaseNights).toBe(100);
    expect(result.revenueRealistic.suiteBaseNights).toBe(100);
  });
});

// ── 8. applySliders does not mutate the original ──────────────────────────────

describe("applySliders — immutability", () => {
  it("does not mutate the original assumptions object", () => {
    const originalExitYear = BASE_CASE.exitYear;
    const sliders = makeSliders({ exitYear: 2033 });
    applySliders(BASE_CASE, sliders);
    expect(BASE_CASE.exitYear).toBe(originalExitYear);
  });
});

// ── 9. readBaseValues clamps exitYear to max 2040 ────────────────────────────

describe("readBaseValues — exitYear clamping", () => {
  it("clamps exitYear 2050 down to 2040 (max allowed)", () => {
    const assumptions = makeAssumptions({ exitYear: 2050 });
    const result = readBaseValues(assumptions);
    expect(result.exitYear).toBe(2040);
  });

  it("clamps exitYear 2020 up to 2029 (min allowed)", () => {
    const assumptions = makeAssumptions({ exitYear: 2020 });
    const result = readBaseValues(assumptions);
    expect(result.exitYear).toBe(2029);
  });

  it("passes through exitYear 2035 unchanged (within range)", () => {
    const assumptions = makeAssumptions({ exitYear: 2035 });
    const result = readBaseValues(assumptions);
    expect(result.exitYear).toBe(2035);
  });
});

// ── 10. readBaseValues exitValuationPerM2 fallback ───────────────────────────

describe("readBaseValues — exitValuationPerM2 fallback", () => {
  it("falls back to 9000 when exitValuationPerM2 is undefined", () => {
    // Construct assumptions with exitValuationPerM2 explicitly absent.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { exitValuationPerM2: _omit, ...rest } = BASE_CASE;
    const assumptions = rest as ModelAssumptions;
    const result = readBaseValues(assumptions);
    expect(result.exitValuationPerM2).toBe(9000);
  });

  it("uses the provided exitValuationPerM2 when it is present", () => {
    const assumptions = makeAssumptions({ exitValuationPerM2: 11000 });
    const result = readBaseValues(assumptions);
    expect(result.exitValuationPerM2).toBe(11000);
  });
});
