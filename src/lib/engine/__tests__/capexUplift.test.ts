// ============================================================
// VILLA LEV GROUP — applyCapexUplift unit tests
// ============================================================
//
// Tests cover every documented behaviour of the pure function:
//   - identity / no-op guards (zero, negative uplift, zero total,
//     missing construction category)
//   - structural invariants after uplift (portfolioTotal = Σ grandTotals,
//     only construction grows, VAT scaling, depreciation recomputation)
//   - purity (original object not mutated)
//   - known-value end-to-end case
//
// No live engine calls. All fixtures are constructed inline from the
// CapexBreakdown interface.

import { describe, it, expect } from 'vitest';
import { applyCapexUplift, CONSTRUCTION_CATEGORY_NAME } from '@/lib/engine/capexUplift';
import type { CapexBreakdown } from '@/lib/engine/types';

// ── Fixture factory ──────────────────────────────────────────────────────────

/**
 * Build a minimal CapexBreakdown sufficient for all tests.
 *
 * Two categories:
 *   - 'Building & excavation'  grandTotal = constructionTotal  depRate = 0.05
 *   - 'Land'                   grandTotal = landTotal          depRate = 0.00
 *
 * portfolioTotal = constructionTotal + landTotal
 *
 * constructionVatByYear uses realistic keys (2026–2029) scaled to the
 * construction amount so VAT-scaling tests have non-trivial data.
 */
function makeCapex(opts: {
  constructionTotal: number;
  landTotal: number;
  constructionPerProperty?: { id: string; perUnit: number; total: number }[];
}): CapexBreakdown {
  const { constructionTotal, landTotal } = opts;

  // Default single per-property entry mirroring the construction total
  const constructionPerProperty = opts.constructionPerProperty ?? [
    { id: 'prop-a', perUnit: constructionTotal, total: constructionTotal },
  ];

  const portfolioTotal = constructionTotal + landTotal;

  // VAT = 24% of construction draw schedule (20% / 50% / 30%) + full refund Y4
  const vat2026 = -(constructionTotal * 0.24 * 0.20);
  const vat2027 = -(constructionTotal * 0.24 * 0.50);
  const vat2028 = -(constructionTotal * 0.24 * 0.30);
  const vat2029 = constructionTotal * 0.24; // refund

  const constructionDepRate = 0.05;
  const landDepRate = 0.00;

  return {
    properties: [],
    acquisitionLegal: 0,
    portfolioTotal,
    totalPlots: 1,
    categories: [
      {
        name: CONSTRUCTION_CATEGORY_NAME,
        depreciationRate: constructionDepRate,
        perProperty: constructionPerProperty,
        grandTotal: constructionTotal,
      },
      {
        name: 'Land',
        depreciationRate: landDepRate,
        perProperty: [{ id: 'prop-a', perUnit: landTotal, total: landTotal }],
        grandTotal: landTotal,
      },
    ],
    annualDepreciationTotal: constructionTotal * constructionDepRate + landTotal * landDepRate,
    depreciationByCategory: {
      [CONSTRUCTION_CATEGORY_NAME]: constructionTotal * constructionDepRate,
      Land: landTotal * landDepRate,
    },
    constructionVatByYear: {
      2026: vat2026,
      2027: vat2027,
      2028: vat2028,
      2029: vat2029,
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('applyCapexUplift', () => {

  // 1. Identity: upliftEur = 0
  it('returns the same reference when upliftEur is 0', () => {
    const capex = makeCapex({ constructionTotal: 600_000, landTotal: 400_000 });
    const result = applyCapexUplift(capex, 0);
    expect(result).toBe(capex);
  });

  // 2. Identity: upliftEur negative
  it('returns the same reference when upliftEur is negative', () => {
    const capex = makeCapex({ constructionTotal: 600_000, landTotal: 400_000 });
    const result = applyCapexUplift(capex, -1);
    expect(result).toBe(capex);
  });

  // 3. portfolioTotal grows by exact uplift
  it('increases portfolioTotal by exactly the uplift amount', () => {
    const capex = makeCapex({ constructionTotal: 600_000, landTotal: 400_000 });
    const uplift = 500_000;
    const result = applyCapexUplift(capex, uplift);
    expect(result.portfolioTotal).toBe(capex.portfolioTotal + uplift);
  });

  // 4. Only construction category grows; all others are unchanged
  it('only increases the construction category grandTotal; all other categories are unchanged', () => {
    const capex = makeCapex({ constructionTotal: 600_000, landTotal: 400_000 });
    const uplift = 200_000;
    const result = applyCapexUplift(capex, uplift);

    const originalConstruction = capex.categories.find(c => c.name === CONSTRUCTION_CATEGORY_NAME)!;
    const newConstruction = result.categories.find(c => c.name === CONSTRUCTION_CATEGORY_NAME)!;
    expect(newConstruction.grandTotal).toBe(originalConstruction.grandTotal + uplift);

    // Every non-construction category must be identical
    for (const cat of result.categories) {
      if (cat.name === CONSTRUCTION_CATEGORY_NAME) continue;
      const originalCat = capex.categories.find(c => c.name === cat.name)!;
      expect(cat.grandTotal).toBe(originalCat.grandTotal);
    }
  });

  // 5. portfolioTotal invariant: equals sum of all category grandTotals after uplift
  it('portfolioTotal equals the sum of all category grandTotals after uplift', () => {
    const capex = makeCapex({ constructionTotal: 600_000, landTotal: 400_000 });
    const result = applyCapexUplift(capex, 300_000);

    const sumOfCategories = result.categories.reduce((s, c) => s + c.grandTotal, 0);
    expect(result.portfolioTotal).toBeCloseTo(sumOfCategories, 6);
  });

  // 6. constructionVatByYear scales proportionally
  it('scales all constructionVatByYear entries by (newConstructionTotal / oldConstructionTotal)', () => {
    const constructionTotal = 600_000;
    const capex = makeCapex({ constructionTotal, landTotal: 400_000 });
    const uplift = 120_000; // +20%

    const result = applyCapexUplift(capex, uplift);

    const scaleFactor = (constructionTotal + uplift) / constructionTotal;

    for (const [yearStr, originalVat] of Object.entries(capex.constructionVatByYear)) {
      const year = Number(yearStr);
      expect(result.constructionVatByYear[year]).toBeCloseTo(
        originalVat * scaleFactor,
        6,
      );
    }
  });

  // 7. annualDepreciationTotal changes after uplift (it is recalculated)
  it('changes annualDepreciationTotal after uplift', () => {
    const capex = makeCapex({ constructionTotal: 600_000, landTotal: 400_000 });
    const result = applyCapexUplift(capex, 100_000);
    expect(result.annualDepreciationTotal).not.toBe(capex.annualDepreciationTotal);
  });

  // 7b. annualDepreciationTotal is self-consistent after uplift
  it('sets annualDepreciationTotal equal to sum(grandTotal × depreciationRate) after uplift', () => {
    const capex = makeCapex({ constructionTotal: 600_000, landTotal: 400_000 });
    const result = applyCapexUplift(capex, 100_000);

    const expected = result.categories.reduce(
      (s, c) => s + c.grandTotal * c.depreciationRate,
      0,
    );
    expect(result.annualDepreciationTotal).toBeCloseTo(expected, 6);
  });

  // 8. Pure function: original not mutated
  it('does not mutate the original CapexBreakdown', () => {
    const capex = makeCapex({ constructionTotal: 600_000, landTotal: 400_000 });
    const originalPortfolioTotal = capex.portfolioTotal;
    const originalConstructionGrandTotal = capex.categories.find(
      c => c.name === CONSTRUCTION_CATEGORY_NAME,
    )!.grandTotal;

    applyCapexUplift(capex, 500_000);

    expect(capex.portfolioTotal).toBe(originalPortfolioTotal);
    expect(
      capex.categories.find(c => c.name === CONSTRUCTION_CATEGORY_NAME)!.grandTotal,
    ).toBe(originalConstructionGrandTotal);
  });

  // 9. Zero-total guard: portfolioTotal === 0 → return input unchanged
  it('returns the input unchanged when portfolioTotal is 0', () => {
    // Both categories at 0 → portfolioTotal = 0
    const capex = makeCapex({ constructionTotal: 0, landTotal: 0 });
    // portfolioTotal is 0 but the construction category exists; uplift > 0.
    // The guard in the implementation checks oldConstructionTotal > 0 for VAT scaling,
    // but the explicit portfolioTotal === 0 guard is the spec requirement.
    // Build a capex with portfolioTotal explicitly set to 0 to test that guard.
    const zeroCapex: CapexBreakdown = { ...capex, portfolioTotal: 0 };
    const result = applyCapexUplift(zeroCapex, 100_000);
    expect(result).toBe(zeroCapex);
  });

  // 10. Known values end-to-end
  it('produces correct known values: two categories, uplift=100_000', () => {
    // Building & excavation 600_000, Land 400_000, portfolioTotal 1_000_000
    // Apply uplift 100_000 → portfolioTotal should be 1_100_000
    //                       → construction grandTotal should be 700_000
    //                       → Land grandTotal unchanged at 400_000
    const capex = makeCapex({ constructionTotal: 600_000, landTotal: 400_000 });
    const result = applyCapexUplift(capex, 100_000);

    expect(result.portfolioTotal).toBe(1_100_000);

    const construction = result.categories.find(c => c.name === CONSTRUCTION_CATEGORY_NAME)!;
    const land = result.categories.find(c => c.name === 'Land')!;

    expect(construction.grandTotal).toBe(700_000);
    expect(land.grandTotal).toBe(400_000);
  });

  // Bonus: missing construction category → return unchanged
  it('returns input unchanged when construction category is absent', () => {
    const capex: CapexBreakdown = {
      properties: [],
      acquisitionLegal: 0,
      portfolioTotal: 400_000,
      totalPlots: 1,
      categories: [
        {
          name: 'Land',
          depreciationRate: 0,
          perProperty: [{ id: 'prop-a', perUnit: 400_000, total: 400_000 }],
          grandTotal: 400_000,
        },
      ],
      annualDepreciationTotal: 0,
      depreciationByCategory: { Land: 0 },
      constructionVatByYear: {},
    };

    const result = applyCapexUplift(capex, 50_000);
    expect(result).toBe(capex);
  });

});
