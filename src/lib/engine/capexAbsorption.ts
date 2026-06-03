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
// The underlying mechanism reuses applyCapexUplift: we compute
// the EUR sum of the toggled categories and add it to the
// "Building & excavation" line.  The absorbed categories are
// NOT zeroed in the resulting breakdown so the admin CapEx page
// still shows the full breakdown; only the construction line is
// inflated for the financing calculation.

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
 * Internally delegates to applyCapexUplift which adds the absorbed
 * amount to "Building & excavation" and keeps all invariants consistent
 * (portfolioTotal, depreciation, VAT schedule).
 *
 * Returns the same reference when no absorption is active.
 */
export function applyCapexAbsorption(
  capex: CapexBreakdown,
  config: CapexAbsorptionConfig,
): CapexBreakdown {
  const { total } = computeAbsorptionAmounts(capex, config);
  if (total <= 0) return capex;
  return applyCapexUplift(capex, total);
}

/** True when at least one absorption toggle is ON. */
export function isAbsorptionActive(config: CapexAbsorptionConfig): boolean {
  return config.serviceProviders || config.contingency;
}
