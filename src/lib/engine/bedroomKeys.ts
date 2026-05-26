import type { PropertyConfig } from './types';

/** Bedrooms for one plot/building (no count multiplier). */
export function bedroomsForPlot(p: PropertyConfig): number {
  const suiteBeds = p.standardSuites * (p.bedroomsPerStandard ?? 1)
                  + p.doubleSuites   * (p.bedroomsPerDouble   ?? 2);
  const villaBeds = p.villaUnits * (
    (p.bedroomsInMain     ?? 4)
    + (p.lockableSubUnits ?? 3) * (p.bedroomsPerSubUnit ?? 1)
  );
  return suiteBeds + villaBeds;
}

/** Max-split keys for one plot/building (no count multiplier). */
export function keysForPlot(p: PropertyConfig): number {
  const suiteKeys = p.standardSuites + p.doubleSuites;
  const villaKeys = p.villaUnits * (1 + (p.lockableSubUnits ?? 3));
  return suiteKeys + villaKeys;
}

/** Portfolio total bedrooms. */
export function computeTotalBedrooms(portfolio: PropertyConfig[]): number {
  return portfolio.reduce((sum, p) => sum + bedroomsForPlot(p) * p.count, 0);
}

/** Portfolio total keys at max split. */
export function computeTotalKeysMaxSplit(portfolio: PropertyConfig[]): number {
  return portfolio.reduce((sum, p) => sum + keysForPlot(p) * p.count, 0);
}
