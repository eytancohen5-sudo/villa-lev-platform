// landArea.test.ts
//
// Tests for the optional `landArea` field on PropertyTemplate / PropertyConfig
// (added 2026-06-10 — structural support for the "Land / plot" column in the
// About-the-project inventory table; values are entered per-plot later).
//
// Covers:
//   1. resolvePortfolio passes template landArea through to PropertyConfig.
//   2. landArea stays undefined when unset (built-in templates carry no value),
//      so the column-visibility predicate is false — table unchanged today.
//   3. Column-visibility predicate + count-weighted total mirror the totalGIA
//      pattern used at the three render points (admin/dashboard, bank, optima).

import { describe, expect, it } from "vitest";

import {
  BUILT_IN_TEMPLATES,
  DEFAULT_PROJECTS,
  resolvePortfolio,
} from "@/lib/engine/defaults";
import type { PropertyConfig, PropertyTemplate } from "@/lib/engine/types";

// Clone a built-in template as a base for landArea overrides
function templateWithLandArea(landArea?: number): PropertyTemplate {
  const tpl = BUILT_IN_TEMPLATES[0];
  return { ...tpl, opex: { ...tpl.opex }, landArea };
}

// Mirrors the render-point logic (hasLandArea / totalLandArea)
function hasLandArea(portfolio: PropertyConfig[]): boolean {
  return portfolio.some((p) => (p.landArea ?? 0) > 0);
}
function totalLandArea(portfolio: PropertyConfig[]): number {
  return portfolio.reduce((s, p) => s + p.count * (p.landArea ?? 0), 0);
}

describe("resolvePortfolio — landArea passthrough", () => {
  it("passes landArea from template to resolved PropertyConfig", () => {
    const tpl = templateWithLandArea(4000);
    const projects = [{ id: "proj-1", templateId: tpl.id, name: "Plot 1", count: 1 }];
    const configs = resolvePortfolio([tpl], projects);
    expect(configs).toHaveLength(1);
    expect(configs[0].landArea).toBe(4000);
  });

  it("leaves landArea undefined when the template has no value", () => {
    const configs = resolvePortfolio(BUILT_IN_TEMPLATES, DEFAULT_PROJECTS);
    expect(configs.length).toBeGreaterThan(0);
    for (const c of configs) {
      expect(c.landArea).toBeUndefined();
    }
  });
});

describe("Land / plot column logic (render-point mirror)", () => {
  it("column hidden when no plot has a land area (current live state)", () => {
    const configs = resolvePortfolio(BUILT_IN_TEMPLATES, DEFAULT_PROJECTS);
    expect(hasLandArea(configs)).toBe(false);
    expect(totalLandArea(configs)).toBe(0);
  });

  it("column shows when at least one plot has a land area; total is count-weighted", () => {
    const withArea = templateWithLandArea(4000);
    const withoutArea: PropertyTemplate = {
      ...templateWithLandArea(undefined),
      id: "tpl-no-land",
      name: "No land area",
    };
    const projects = [
      { id: "proj-a", templateId: withArea.id, name: "Plot A", count: 2 },
      { id: "proj-b", templateId: withoutArea.id, name: "Plot B", count: 1 },
    ];
    const configs = resolvePortfolio([withArea, withoutArea], projects);
    expect(configs).toHaveLength(2);
    expect(hasLandArea(configs)).toBe(true);
    // count=2 × 4,000 m² + count=1 × (unset → 0)
    expect(totalLandArea(configs)).toBe(8000);
  });
});
