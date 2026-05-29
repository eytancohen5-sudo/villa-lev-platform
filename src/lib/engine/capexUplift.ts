// ============================================================
// VILLA LEV GROUP — CAPEX uplift sensitivity helper
// ============================================================
//
// Pure function that inflates the construction category of a
// CapexBreakdown by a given EUR amount. Used exclusively by
// the /bank/optima ephemeral CAPEX sensitivity control — never
// persisted, never visible outside that page.
//
// Fix 2 (plan-challenger): exact category name, not substring.
// The name is sourced directly from model.ts categoryDefs to
// guarantee a stable match.

import type { CapexBreakdown } from './types';

/**
 * Exact name of the construction/excavation category as defined in
 * model.ts computeCapex categoryDefs. Used for exact equality matching
 * in applyCapexUplift — never substring/keyword matching.
 */
export const CONSTRUCTION_CATEGORY_NAME = 'Building & excavation';

/**
 * Apply a pure construction-cost uplift to an existing CapexBreakdown.
 *
 * Only the "Building & excavation" category grows; all other categories
 * are returned unchanged (same object references). The function is pure:
 * it never mutates the input.
 *
 * Invariant: result.portfolioTotal = input.portfolioTotal + upliftEur
 *
 * @param capex      The real CapexBreakdown produced by computeCapex().
 * @param upliftEur  Extra construction cost in EUR (must be > 0).
 * @returns          A new CapexBreakdown with inflated construction cost
 *                   and fully consistent derived fields.
 */
export function applyCapexUplift(
  capex: CapexBreakdown,
  upliftEur: number,
): CapexBreakdown {
  // Guard: no-op if uplift is non-positive or base is zero
  if (upliftEur <= 0 || capex.portfolioTotal === 0) return capex;

  const { categories } = capex;

  // Find the construction category by exact name match (Fix 2).
  const constructionIdx = categories.findIndex(
    (c) => c.name === CONSTRUCTION_CATEGORY_NAME,
  );

  if (constructionIdx === -1) {
    // Construction category not found — return unchanged (same reference).
    return capex;
  }

  const construction = categories[constructionIdx];
  const oldConstructionTotal = construction.grandTotal;
  const newConstructionTotal = oldConstructionTotal + upliftEur;

  // Distribute the uplift proportionally across perProperty entries.
  // Proportional share = pp.total / sum(pp.total); if all zeros use equal share.
  const perPropertySum = construction.perProperty.reduce((s, pp) => s + pp.total, 0);

  const newPerProperty = construction.perProperty.map((pp) => {
    const share = perPropertySum > 0
      ? pp.total / perPropertySum
      : 1 / Math.max(1, construction.perProperty.length);
    const newTotal = pp.total + upliftEur * share;
    const newPerUnit = pp.total > 0
      ? pp.perUnit * (newTotal / pp.total)
      : pp.perUnit;
    return { ...pp, total: newTotal, perUnit: newPerUnit };
  });

  const newConstructionCat = {
    ...construction,
    perProperty: newPerProperty,
    grandTotal: newConstructionTotal,
  };

  // Build new categories array — only construction entry changes.
  const newCategories = categories.map((c, i) =>
    i === constructionIdx ? newConstructionCat : c,
  );

  // Recompute portfolioTotal = sum of all category grandTotals (Fix 1).
  const newPortfolioTotal = newCategories.reduce(
    (s, c) => s + c.grandTotal,
    0,
  );

  // Recompute annualDepreciationTotal (Fix 1).
  // Building & excavation has depreciationRate = 0.05 (Greek Law 4172/2013 Art. 24).
  // We use the same rate as the original category rather than a fallback scaling,
  // ensuring a self-consistent result even if other categories change in future.
  const newAnnualDepreciationTotal = newCategories.reduce(
    (sum, cat) => sum + cat.grandTotal * cat.depreciationRate,
    0,
  );

  // Recompute depreciationByCategory for the construction entry only (Fix 1).
  const newDepreciationByCategory: Record<string, number> = {
    ...capex.depreciationByCategory,
    [CONSTRUCTION_CATEGORY_NAME]:
      newConstructionTotal * newConstructionCat.depreciationRate,
  };

  // Recompute constructionVatByYear (Fix 1).
  // Building & excavation is VAT-liable (24% Greek rate). Scale existing
  // entries by the ratio of the new construction total to the old total.
  // The refund year (positive entry) scales in the same direction.
  const vatScaleFactor =
    oldConstructionTotal > 0
      ? newConstructionTotal / oldConstructionTotal
      : 1;

  const newConstructionVatByYear: Record<number, number> = {};
  for (const [yearStr, vatAmt] of Object.entries(capex.constructionVatByYear)) {
    newConstructionVatByYear[Number(yearStr)] = vatAmt * vatScaleFactor;
  }

  return {
    ...capex,
    categories: newCategories,
    portfolioTotal: newPortfolioTotal,
    annualDepreciationTotal: newAnnualDepreciationTotal,
    depreciationByCategory: newDepreciationByCategory,
    constructionVatByYear: newConstructionVatByYear,
  };
}
