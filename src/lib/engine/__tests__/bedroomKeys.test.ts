// Unit tests for bedroomKeys.ts — covers all four exported pure functions.
//
// Topology quick-reference:
//   keysForPlot    = standardSuites + doubleSuites + villaUnits × (1 + lockableSubUnits??3)
//   bedroomsForPlot = standardSuites×(bedroomsPerStandard??1)
//                   + doubleSuites×(bedroomsPerDouble??2)
//                   + villaUnits×((bedroomsInMain??4) + (lockableSubUnits??3)×(bedroomsPerSubUnit??1))
//
// Both aggregate functions multiply per-plot values by p.count before summing.

import { describe, expect, it } from 'vitest';
import {
  bedroomsForPlot,
  keysForPlot,
  computeTotalBedrooms,
  computeTotalKeysMaxSplit,
} from '@/lib/engine/bedroomKeys';
import type { PropertyConfig } from '@/lib/engine/types';

// ── Fixture factory ──────────────────────────────────────────────────────────
// Provides safe defaults for every required field. Override only the fields
// under test in each case.

function makeConfig(overrides: Partial<PropertyConfig> = {}): PropertyConfig {
  return {
    id: 'test-plot',
    name: 'Test Plot',
    villaUnits: 0,
    standardSuites: 0,
    doubleSuites: 0,
    count: 1,
    roomAreas: {
      villaUnitArea: 0,
      standardSuiteArea: 0,
      doubleSuiteArea: 0,
      kitchen: 0,
      livingRoom: 0,
      utilityRoom: 0,
      staffRoom: 0,
      corridors: 0,
    },
    landCost: 0,
    constructionArea: 0,
    constructionCostPerM2: 0,
    ffeCost: 0,
    legalFees: 0,
    architectFees: 0,
    civilEngineerFees: 0,
    contingencyRate: 0,
    opex: {
      housekeeping: 0,
      utilities: 0,
      insurance: 0,
      propertyTax: 0,
      marketing: 0,
      consumables: 0,
      accounting: 0,
    },
    ...overrides,
  };
}

// ── keysForPlot ──────────────────────────────────────────────────────────────

describe('keysForPlot', () => {
  it('pure suite plot: 7 standard + 4 double, 0 villas → 11', () => {
    const p = makeConfig({ standardSuites: 7, doubleSuites: 4, villaUnits: 0 });
    expect(keysForPlot(p)).toBe(11);
  });

  it('pure villa plot with lockableSubUnits=3 → 4 (1 main + 3 sub)', () => {
    const p = makeConfig({
      villaUnits: 1,
      lockableSubUnits: 3,
      standardSuites: 0,
      doubleSuites: 0,
    });
    expect(keysForPlot(p)).toBe(4);
  });

  it('lockableSubUnits=0 (non-lockable villa) → 1 (main villa door only)', () => {
    const p = makeConfig({
      villaUnits: 1,
      lockableSubUnits: 0,
      standardSuites: 0,
      doubleSuites: 0,
    });
    expect(keysForPlot(p)).toBe(1);
  });

  it('lockableSubUnits absent (undefined) → defaults to 3 sub-units → 4 keys', () => {
    const p = makeConfig({
      villaUnits: 1,
      standardSuites: 0,
      doubleSuites: 0,
      // lockableSubUnits intentionally omitted — defaults path
    });
    expect(keysForPlot(p)).toBe(4);
  });
});

// ── bedroomsForPlot ──────────────────────────────────────────────────────────

describe('bedroomsForPlot', () => {
  it('pure suite with explicit bedroom fields: 2 standard×1 + 2 double×2 → 6', () => {
    const p = makeConfig({
      standardSuites: 2,
      doubleSuites: 2,
      villaUnits: 0,
      bedroomsPerStandard: 1,
      bedroomsPerDouble: 2,
    });
    expect(bedroomsForPlot(p)).toBe(6);
  });

  it('pure villa with explicit bedroom fields: 1 villa, main=4, 3 sub×1 → 7', () => {
    const p = makeConfig({
      villaUnits: 1,
      standardSuites: 0,
      doubleSuites: 0,
      bedroomsInMain: 4,
      lockableSubUnits: 3,
      bedroomsPerSubUnit: 1,
    });
    expect(bedroomsForPlot(p)).toBe(7);
  });

  it('villa with all bedroom fields absent → defaults (4 main + 3 sub × 1) → 7', () => {
    const p = makeConfig({
      villaUnits: 1,
      standardSuites: 0,
      doubleSuites: 0,
      // bedroomsInMain, lockableSubUnits, bedroomsPerSubUnit all absent
    });
    expect(bedroomsForPlot(p)).toBe(7);
  });

  it('suite with bedroomsPerDouble=1 edge case: 2 standard×1 + 2 double×1 → 4', () => {
    const p = makeConfig({
      standardSuites: 2,
      doubleSuites: 2,
      villaUnits: 0,
      bedroomsPerStandard: 1,
      bedroomsPerDouble: 1,
    });
    expect(bedroomsForPlot(p)).toBe(4);
  });
});

// ── computeTotalKeysMaxSplit ──────────────────────────────────────────────────

describe('computeTotalKeysMaxSplit', () => {
  it('empty portfolio → 0', () => {
    expect(computeTotalKeysMaxSplit([])).toBe(0);
  });

  it('base-case portfolio: Plot A×1 (11) + Plot B×2 (4 each) + Plot C×1 (4) → 23', () => {
    // Plot A — 11 Suite-Villas (7 standard + 4 double, no villas), count=1
    const plotA = makeConfig({
      id: 'plot-a',
      name: 'Suite-Villa Block',
      standardSuites: 7,
      doubleSuites: 4,
      villaUnits: 0,
      count: 1,
    });
    // Plot B — Luxury Villa ×2: 1 villa per plot, 3 lockable sub-units, count=2
    const plotB = makeConfig({
      id: 'plot-b',
      name: 'Luxury Villa',
      villaUnits: 1,
      lockableSubUnits: 3,
      bedroomsInMain: 4,
      bedroomsPerSubUnit: 1,
      standardSuites: 0,
      doubleSuites: 0,
      count: 2,
    });
    // Plot C — Boutique & Wellness: 2 standard + 2 double, count=1
    const plotC = makeConfig({
      id: 'plot-c',
      name: 'Boutique & Wellness',
      standardSuites: 2,
      doubleSuites: 2,
      villaUnits: 0,
      bedroomsPerStandard: 1,
      bedroomsPerDouble: 2,
      count: 1,
    });

    // Plot A: keysForPlot=11 × count=1 = 11
    // Plot B: keysForPlot=4  × count=2 = 8
    // Plot C: keysForPlot=4  × count=1 = 4
    // Total = 23
    expect(computeTotalKeysMaxSplit([plotA, plotB, plotC])).toBe(23);
  });
});

// ── computeTotalBedrooms ──────────────────────────────────────────────────────

describe('computeTotalBedrooms', () => {
  it('empty portfolio → 0', () => {
    expect(computeTotalBedrooms([])).toBe(0);
  });

  it('base-case portfolio: Plot A×1 (15) + Plot B×2 (7 each) + Plot C×1 (6) → 35', () => {
    // Plot A — Suite block: 7 standard×1 + 4 double×2 = 15 bedrooms, count=1
    const plotA = makeConfig({
      id: 'plot-a',
      name: 'Suite-Villa Block',
      standardSuites: 7,
      doubleSuites: 4,
      villaUnits: 0,
      // bedroomsPerStandard defaults to 1, bedroomsPerDouble defaults to 2
      count: 1,
    });
    // Plot B — Luxury Villa: 4 main + 3 sub×1 = 7 bedrooms per villa, count=2
    const plotB = makeConfig({
      id: 'plot-b',
      name: 'Luxury Villa',
      villaUnits: 1,
      lockableSubUnits: 3,
      bedroomsInMain: 4,
      bedroomsPerSubUnit: 1,
      standardSuites: 0,
      doubleSuites: 0,
      count: 2,
    });
    // Plot C — Boutique: 2 standard×1 + 2 double×2 = 6 bedrooms, count=1
    const plotC = makeConfig({
      id: 'plot-c',
      name: 'Boutique & Wellness',
      standardSuites: 2,
      doubleSuites: 2,
      villaUnits: 0,
      bedroomsPerStandard: 1,
      bedroomsPerDouble: 2,
      count: 1,
    });

    // Plot A: bedroomsForPlot=15 × count=1 = 15
    // Plot B: bedroomsForPlot=7  × count=2 = 14
    // Plot C: bedroomsForPlot=6  × count=1 = 6
    // Total = 35
    expect(computeTotalBedrooms([plotA, plotB, plotC])).toBe(35);
  });
});
