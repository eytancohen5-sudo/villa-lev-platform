// ============================================================
// VILLA LEV GROUP — Optima Bank CAPEX view transformer
// ============================================================
//
// Per Optima Bank 2026-05-28 meeting: professional service fees
// (architects, civil engineers, lawyers, construction directors,
// licenses & permits) and contingency are not eligible costs for
// the Optima Bank construction loan. Optima's explicit workaround
// is to absorb those ineligible lines into the construction line
// for bank-facing output. This function performs that absorption
// without mutating the original CapexBreakdown.
//
// This file must NOT import from model.ts to avoid circular deps.

import type { CapexBreakdown, OptimaLoanParams } from './types';

/** Category-name keywords that identify "service provider" costs to absorb.
 *  Matched case-insensitively as substrings. Covers the actual names used
 *  in model.ts computeCapex categoryDefs:
 *    'Licenses & permits'      → matches 'licenses'
 *    'Construction director'   → matches 'construction director'  (now maps to developerConstructionFeePerYear×2)
 *    'Acquisition legal & DD'  → matches 'legal'
 *  Note: 'Land acquisition' does NOT match 'legal' — no false positive.
 *  Note: 'Building & excavation' does NOT match any of these — safe.
 */
export const SERVICE_PROVIDER_KEYWORDS = [
  'architect',
  'civil engineer',
  'legal',
  'construction director',
  'licenses',
];

/** Category-name keywords that identify contingency costs to absorb. */
export const CONTINGENCY_KEYWORDS = ['contingency'];

/** Category-name keywords that identify the construction line (destination). */
export const CONSTRUCTION_KEYWORDS = ['building', 'excavation', 'construction'];

function matchesAny(name: string, keywords: string[]): boolean {
  const lower = name.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/**
 * Transforms the real CAPEX breakdown into Optima Bank's required presentation.
 *
 * Per Optima Bank's 2026-05-28 meeting: service providers and contingency are
 * ineligible costs. Optima's own workaround is to absorb them into the
 * construction line. This function performs that absorption without mutating
 * the original.
 *
 * Invariant: result.portfolioTotal === input.portfolioTotal (within €1).
 *
 * @param capex   The real CAPEX breakdown produced by computeCapex().
 * @param absorb  Which cost classes to absorb into construction.
 * @returns       A new CapexBreakdown where construction's grandTotal is
 *                inflated by the absorbed amounts and the absorbed categories
 *                are removed. All other fields pass through unchanged.
 */
export function optimaCapexView(
  capex: CapexBreakdown,
  absorb: OptimaLoanParams['absorb'],
): CapexBreakdown {
  const { categories } = capex;

  // Determine which category names are absorbed.
  // lineOverrides take precedence over the bulk serviceProviders/contingency flags.
  const isAbsorbed = (name: string): boolean => {
    const overrides = absorb.lineOverrides;
    if (overrides && name in overrides) return overrides[name];
    if (absorb.serviceProviders && matchesAny(name, SERVICE_PROVIDER_KEYWORDS)) return true;
    if (absorb.contingency && matchesAny(name, CONTINGENCY_KEYWORDS)) return true;
    return false;
  };

  // Identify construction destination category (first match wins).
  const constructionCat = categories.find((c) =>
    matchesAny(c.name, CONSTRUCTION_KEYWORDS)
  );

  if (!constructionCat) {
    // No construction category found — return a spread copy (preserves pure-function guarantee).
    return { ...capex };
  }

  // Sum absorbed totals.
  const absorbedTotal = categories
    .filter((c) => isAbsorbed(c.name))
    .reduce((sum, c) => sum + c.grandTotal, 0);

  // Build the new categories array: remove absorbed, inflate construction.
  const newCategories = categories
    .filter((c) => !isAbsorbed(c.name))
    .map((c) => {
      if (c.name !== constructionCat.name) return c;
      // Inflate construction grandTotal; perProperty sums stay per-property —
      // we distribute the absorbed total evenly across perProperty entries to
      // preserve the property-level breakdown shape.
      const totalPerPropertySum = c.perProperty.reduce((s, pp) => s + pp.total, 0);
      const newPerProperty = c.perProperty.map((pp) => {
        const share = totalPerPropertySum > 0
          ? pp.total / totalPerPropertySum
          : 1 / Math.max(1, c.perProperty.length);
        const addedTotal = absorbedTotal * share;
        const addedPerUnit = pp.perUnit + (pp.total > 0
          ? (pp.total / pp.total) * addedTotal / (pp.total / pp.perUnit)
          : 0);
        // Simpler: keep perUnit proportional to original, inflate total.
        const newTotal = pp.total + absorbedTotal * share;
        const newPerUnit = newTotal > 0 && pp.total > 0
          ? pp.perUnit * (newTotal / pp.total)
          : pp.perUnit;
        void addedTotal; void addedPerUnit; // suppress unused warnings
        return { ...pp, perUnit: newPerUnit, total: newTotal };
      });
      return {
        ...c,
        perProperty: newPerProperty,
        grandTotal: c.grandTotal + absorbedTotal,
      };
    });

  const newPortfolioTotal = newCategories.reduce((s, c) => s + c.grandTotal, 0);

  // Invariant check: absorbed categories are removed, so the sum of all
  // remaining categories should still equal portfolioTotal because the
  // absorbed amounts moved into construction rather than disappearing.
  if (Math.abs(newPortfolioTotal - capex.portfolioTotal) > 1) {
    throw new Error(
      `optimaCapexView invariant violation: newTotal=${newPortfolioTotal.toFixed(2)} ` +
      `portfolioTotal=${capex.portfolioTotal.toFixed(2)} ` +
      `diff=${Math.abs(newPortfolioTotal - capex.portfolioTotal).toFixed(2)}`,
    );
  }

  return {
    ...capex,
    categories: newCategories,
    // portfolioTotal is unchanged — the sum moved within the breakdown.
    // annualDepreciationTotal, depreciationByCategory, constructionVatByYear
    // all pass through unchanged per the plan.
  };
}
