import { describe, it, expect } from "vitest";
import { computeModel } from "@/lib/engine/model";
import { BASE_CASE, PROJECT_CONSTANTS } from "@/lib/engine/defaults";
import type { ModelAssumptions } from "@/lib/engine/types";

const { FIRST_OPERATIONAL_YEAR, OPENING_YEAR } = PROJECT_CONSTANTS;

function withOta(overrides: Partial<ModelAssumptions["tax"]>): ModelAssumptions {
  return {
    ...BASE_CASE,
    tax: { ...BASE_CASE.tax, ...overrides },
  };
}

function pnlRow(a: ModelAssumptions, year: number) {
  const out = computeModel(a);
  const row = out.scenarios.realistic.pnl.find((r) => r.year === year);
  if (!row) throw new Error(`No P&L row for year ${year}`);
  return row;
}

describe("OTA Distribution engine", () => {
  it("backward compat: defaults produce grossRevenue = totalRevenue / (1 - 0.175)", () => {
    // BASE_CASE: otaCommissionRate=0.175, otaShare=1.0, otaShareDeclinePerYear=0
    // effectiveRate = 0.175 × 1.0 = 0.175 for all years
    const row = pnlRow(BASE_CASE, FIRST_OPERATIONAL_YEAR);
    expect(row.grossRevenue).toBeCloseTo(row.totalRevenue / (1 - 0.175), 2);
    expect(row.otaCommissions).toBeLessThan(0); // stored as negative cost
    expect(row.otaCommissions).toBeCloseTo(row.totalRevenue - row.grossRevenue, 2);
  });

  it("pre-operational year: no gross-up regardless of OTA rate", () => {
    const PRE_OP_YEAR = 2027;
    const row = pnlRow(BASE_CASE, PRE_OP_YEAR);
    expect(row.grossRevenue).toBeCloseTo(row.totalRevenue, 2);
    expect(row.otaCommissions).toBeCloseTo(0, 2);
  });

  it("otaShareDeclinePerYear: OTA share reduces each year automatically", () => {
    // Start at 100% OTA, decline 10%/yr → year 2 = 90%, year 3 = 80%
    const a = withOta({ otaShare: 1.0, otaShareDeclinePerYear: 0.10 });
    const YEAR_2028 = OPENING_YEAR;           // yearsSince=0 → otaShare=1.0
    const YEAR_2029 = OPENING_YEAR + 1;       // yearsSince=1 → otaShare=0.9
    const YEAR_2030 = OPENING_YEAR + 2;       // yearsSince=2 → otaShare=0.8

    const row2028 = pnlRow(a, YEAR_2028);
    const row2029 = pnlRow(a, YEAR_2029);
    const row2030 = pnlRow(a, YEAR_2030);

    expect(row2028.grossRevenue).toBeCloseTo(row2028.totalRevenue / (1 - 0.175 * 1.0), 2);
    expect(row2029.grossRevenue).toBeCloseTo(row2029.totalRevenue / (1 - 0.175 * 0.9), 2);
    expect(row2030.grossRevenue).toBeCloseTo(row2030.totalRevenue / (1 - 0.175 * 0.8), 2);
    // The gross-up RATIO decreases each year (revenue grows but OTA share shrinks)
    const ratio2028 = row2028.grossRevenue / row2028.totalRevenue;
    const ratio2029 = row2029.grossRevenue / row2029.totalRevenue;
    const ratio2030 = row2030.grossRevenue / row2030.totalRevenue;
    expect(ratio2029).toBeLessThan(ratio2028); // smaller effective rate → smaller gross-up
    expect(ratio2030).toBeLessThan(ratio2029);
  });

  it("otaShare floor: never goes below 0 even with aggressive decline", () => {
    // Start at 50% OTA, decline 20%/yr → floors at 0 after year 2.5
    const a = withOta({ otaShare: 0.50, otaShareDeclinePerYear: 0.20 });
    const YEAR_2031 = OPENING_YEAR + 3; // yearsSince=3, raw=0.50-0.60=-0.10 → floored to 0
    const row = pnlRow(a, YEAR_2031);
    expect(row.grossRevenue).toBeCloseTo(row.totalRevenue, 2);
    expect(row.otaCommissions).toBeCloseTo(0, 2);
  });

  it("otaShare=0 (all direct from day 1): no gross-up in any year", () => {
    const a = withOta({ otaShare: 0 });
    const row = pnlRow(a, FIRST_OPERATIONAL_YEAR);
    expect(row.grossRevenue).toBeCloseTo(row.totalRevenue, 2);
    expect(row.otaCommissions).toBeCloseTo(0, 2);
  });

  it("zero decline: all years use the same fixed OTA share", () => {
    const a = withOta({ otaShare: 0.70, otaShareDeclinePerYear: 0 });
    // effectiveRate = 0.175 × 0.70 = 0.1225 for all operational years
    for (const year of [OPENING_YEAR, FIRST_OPERATIONAL_YEAR, FIRST_OPERATIONAL_YEAR + 3]) {
      const row = pnlRow(a, year);
      if (year <= 2027) continue; // pre-op guard
      expect(row.grossRevenue).toBeCloseTo(row.totalRevenue / (1 - 0.175 * 0.70), 2);
    }
  });

  it("VAT shrinks when OTA share is reduced (grossRevenue smaller)", () => {
    const base = pnlRow(BASE_CASE, FIRST_OPERATIONAL_YEAR); // 100% OTA
    const withDecline = pnlRow(withOta({ otaShareDeclinePerYear: 0.10 }), FIRST_OPERATIONAL_YEAR + 2);
    // FIRST_OPERATIONAL_YEAR+2 = 2031, yearsSince=3, otaShare=0.70
    // effectiveRate = 0.175 × 0.70 = 0.1225 < 0.175 → smaller grossRevenue
    expect(withDecline.grossRevenue).toBeLessThan(base.grossRevenue / base.totalRevenue * withDecline.totalRevenue);
  });
});
