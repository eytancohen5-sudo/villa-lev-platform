// ============================================================
// VILLA LEV GROUP — CapEx Absorption helper
// ============================================================
//
// "Absorption" = specific CapEx category costs moved into the
// construction line for bank-facing presentation. Admin view
// retains the full breakdown; the bank sees a single inflated
// construction figure.
//
// Two toggleable absorptions are supported for now:
//   1. Service providers — Licenses & permits, Construction
//      director salary, Construction director (devMgmtFee)
//   2. Contingency — 10% of building + FF&E
//
// The underlying mechanism:
//   1. Inflate "Building & excavation" by the absorbed total (via applyCapexUplift).
//   2. Zero out the absorbed categories so portfolioTotal stays flat — pure shift,
//      not additive. The admin CapEx page reads model.capex (un-absorbed), so it
//      always shows the full breakdown regardless.

import type { CapexBreakdown } from './types';
import { applyCapexUplift } from './capexUplift';

export interface CapexAbsorptionConfig {
  serviceProviders: boolean;
  contingency: boolean;
}

/** Exact names of categories absorbed under "service providers". */
export const SERVICE_PROVIDER_CATEGORIES: readonly string[] = [
  'Licenses & permits',
  'Construction director salary',
  'Construction director',
];

/** Exact name of the contingency category. */
export const CONTINGENCY_CATEGORY = 'Contingency (10% of building + FF&E)';

/**
 * Compute the EUR amount that each absorption toggle contributes.
 * Returns individual amounts plus the combined total.
 */
export function computeAbsorptionAmounts(
  capex: CapexBreakdown,
  config: CapexAbsorptionConfig,
): { serviceProviders: number; contingency: number; total: number } {
  let serviceProviders = 0;
  let contingency = 0;

  for (const cat of capex.categories) {
    if (config.serviceProviders && (SERVICE_PROVIDER_CATEGORIES as string[]).includes(cat.name)) {
      serviceProviders += cat.grandTotal;
    }
    if (config.contingency && cat.name === CONTINGENCY_CATEGORY) {
      contingency += cat.grandTotal;
    }
  }

  return { serviceProviders, contingency, total: serviceProviders + contingency };
}

/**
 * Apply absorption to a CapexBreakdown.
 *
 * Inflates "Building & excavation" by the absorbed total, then zeros out
 * the absorbed categories so portfolioTotal stays flat (pure shift).
 *
 * Returns the same reference when no absorption is active.
 */
export function applyCapexAbsorption(
  capex: CapexBreakdown,
  config: CapexAbsorptionConfig,
): CapexBreakdown {
  const { total } = computeAbsorptionAmounts(capex, config);
  if (total <= 0) return capex;

  // Step 1: inflate construction (also scales VAT schedule correctly).
  const uplifted = applyCapexUplift(capex, total);

  // Step 2: zero out absorbed categories — they now live inside construction.
  const absorbedNames = new Set<string>();
  if (config.serviceProviders) {
    for (const name of SERVICE_PROVIDER_CATEGORIES) absorbedNames.add(name);
  }
  if (config.contingency) {
    absorbedNames.add(CONTINGENCY_CATEGORY);
  }

  const newCategories = uplifted.categories.map((cat) =>
    absorbedNames.has(cat.name)
      ? { ...cat, grandTotal: 0, perProperty: cat.perProperty.map((pp) => ({ ...pp, total: 0, perUnit: 0 })) }
      : cat,
  );

  const newPortfolioTotal = newCategories.reduce((s, c) => s + c.grandTotal, 0);
  const newAnnualDepreciationTotal = newCategories.reduce(
    (sum, cat) => sum + cat.grandTotal * cat.depreciationRate,
    0,
  );
  const newDepreciationByCategory: Record<string, number> = { ...uplifted.depreciationByCategory };
  for (const name of absorbedNames) {
    newDepreciationByCategory[name] = 0;
  }

  return {
    ...uplifted,
    categories: newCategories,
    portfolioTotal: newPortfolioTotal,
    annualDepreciationTotal: newAnnualDepreciationTotal,
    depreciationByCategory: newDepreciationByCategory,
  };
}

/** True when at least one absorption toggle is ON. */
export function isAbsorptionActive(config: CapexAbsorptionConfig): boolean {
  return config.serviceProviders || config.contingency;
}
