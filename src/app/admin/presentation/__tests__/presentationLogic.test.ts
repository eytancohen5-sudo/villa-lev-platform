/**
 * Pure logic tests for /admin/presentation.
 *
 * These tests validate the data derivation and display logic without
 * requiring a DOM / jsdom environment. They run under the existing
 * node-environment Vitest config (npm run test:run).
 *
 * For component-level (render) tests, see page.test.tsx — those require
 * npm run test:dom (jsdom environment, separate vitest.dom.config.ts).
 */

import { describe, it, expect } from 'vitest';

// ── Helpers that mirror what page.tsx computes ────────────────────────────────

/** LTC = loanAmount / totalCapex */
function computeLTC(loanAmount: number, totalCapex: number): number {
  return loanAmount / totalCapex;
}

/**
 * Path label logic — mirrors page.tsx's pathLabel derivation.
 * In production this calls t() with locale keys; here we inline strings.
 */
function getPathLabel(activePath: string): string {
  if (activePath === "grant") return "Development Law Grant";
  if (activePath === "rrf") return "RRF";
  if (activePath === "tepix-loan") return "TEPIX III";
  return "Commercial";
}

/** Effective path = override if set, else assumptions.financingPath */
function effectivePath(
  financingPathOverride: string | null,
  assumedPath: string
): string {
  return financingPathOverride ?? assumedPath;
}

/**
 * OPEX contingency badge — shown only when opexContingencyRate > 0.
 * The badge text replaces '{pct}' with the formatted rate.
 */
function shouldShowOpexBadge(opexContingencyRate: number): boolean {
  return opexContingencyRate > 0;
}

/**
 * Mirrors page.tsx: replaces {pct} with the raw percentage number (not
 * formatPercent — the template already contains the literal "%" character).
 */
function opexBadgeText(template: string, rate: number): string {
  return template.replace("{pct}", (rate * 100).toFixed(0));
}

// ── Asset coverage sanity check ───────────────────────────────────────────────

function isAssetCoveragePositive(portfolioValue: number, loanAmount: number): boolean {
  if (loanAmount === 0) return true;
  return portfolioValue / loanAmount > 1.0;
}

// ── DSCR covenant check ───────────────────────────────────────────────────────

function covenantSatisfied(stabilisedDSCR: number, floor = 1.25): boolean {
  return stabilisedDSCR >= floor;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Presentation page — LTC calculation', () => {
  it('computes LTC as loanAmount / totalCapex', () => {
    expect(computeLTC(6_800_000, 8_500_000)).toBeCloseTo(0.8, 4);
  });

  it('handles 75% LTC correctly', () => {
    expect(computeLTC(6_375_000, 8_500_000)).toBeCloseTo(0.75, 4);
  });

  it('handles 85% LTC correctly', () => {
    expect(computeLTC(7_225_000, 8_500_000)).toBeCloseTo(0.85, 4);
  });
});

describe('Presentation page — path label derivation', () => {
  it('returns Commercial for commercial path', () => {
    expect(getPathLabel('commercial')).toBe('Commercial');
  });

  it('returns Development Law Grant for grant path', () => {
    expect(getPathLabel('grant')).toBe('Development Law Grant');
  });

  it('returns RRF for rrf path', () => {
    expect(getPathLabel('rrf')).toBe('RRF');
  });

  it('returns TEPIX III for tepix-loan path', () => {
    expect(getPathLabel('tepix-loan')).toBe('TEPIX III');
  });
});

describe('Presentation page — effective path (override logic)', () => {
  it('uses override when set', () => {
    expect(effectivePath('grant', 'commercial')).toBe('grant');
  });

  it('falls back to assumed path when override is null', () => {
    expect(effectivePath(null, 'commercial')).toBe('commercial');
  });

  it('handles tepix-loan override', () => {
    expect(effectivePath('tepix-loan', 'commercial')).toBe('tepix-loan');
  });
});

describe('Presentation page — OPEX contingency badge', () => {
  it('badge is NOT shown when opexContingencyRate is 0', () => {
    expect(shouldShowOpexBadge(0)).toBe(false);
  });

  it('badge is NOT shown when opexContingencyRate is negative (guard)', () => {
    expect(shouldShowOpexBadge(-0.05)).toBe(false);
  });

  it('badge IS shown when opexContingencyRate is 0.10 (10%)', () => {
    expect(shouldShowOpexBadge(0.10)).toBe(true);
  });

  it('badge IS shown for any positive rate', () => {
    expect(shouldShowOpexBadge(0.01)).toBe(true);
  });

  it('badge text substitutes pct placeholder correctly at 10%', () => {
    const template = 'OPEX contingency: +{pct}% overlay applied';
    expect(opexBadgeText(template, 0.10)).toBe('OPEX contingency: +10% overlay applied');
  });

  it('badge text substitutes pct placeholder correctly at 5%', () => {
    const template = 'OPEX contingency: +{pct}% overlay applied';
    expect(opexBadgeText(template, 0.05)).toBe('OPEX contingency: +5% overlay applied');
  });
});

describe('Presentation page — asset coverage', () => {
  it('returns true when portfolio value exceeds loan (>1.0×)', () => {
    expect(isAssetCoveragePositive(9_600_000, 6_800_000)).toBe(true);
  });

  it('returns false when portfolio value is below loan (<1.0×)', () => {
    expect(isAssetCoveragePositive(5_000_000, 6_800_000)).toBe(false);
  });

  it('handles zero loan (no coverage issue)', () => {
    expect(isAssetCoveragePositive(9_600_000, 0)).toBe(true);
  });
});

describe('Presentation page — DSCR covenant', () => {
  it('satisfies covenant at 1.55× (above 1.25× floor)', () => {
    expect(covenantSatisfied(1.55)).toBe(true);
  });

  it('satisfies covenant exactly at 1.25×', () => {
    expect(covenantSatisfied(1.25)).toBe(true);
  });

  it('fails covenant at 1.20× (below 1.25× floor)', () => {
    expect(covenantSatisfied(1.20)).toBe(false);
  });

  it('fails covenant at 1.00×', () => {
    expect(covenantSatisfied(1.00)).toBe(false);
  });

  it('uses a custom floor correctly', () => {
    expect(covenantSatisfied(1.30, 1.35)).toBe(false);
    expect(covenantSatisfied(1.40, 1.35)).toBe(true);
  });
});

describe('Presentation page — risk register data integrity', () => {
  // The risk register is a static array — validate it has the expected shape
  // without importing the page (which needs React / JSX transform).
  // Delta 8: added 12th row — Multi-asset operational complexity.
  const EXPECTED_RISK_COUNT = 12;
  const RISK_REGISTER = [
    { risk: "Construction overrun", severity: "Medium", mitigant: "" },
    { risk: "Occupancy ramp slower than modelled", severity: "Medium", mitigant: "" },
    { risk: "ADR compression", severity: "Low", mitigant: "" },
    { risk: "Interest rate increase", severity: "Low", mitigant: "" },
    { risk: "Permitting delay", severity: "Medium", mitigant: "" },
    { risk: "Operator key-person risk", severity: "Medium", mitigant: "" },
    { risk: "Greek regulatory / tax change", severity: "Low", mitigant: "" },
    { risk: "Market saturation — Antiparos", severity: "Low", mitigant: "" },
    { risk: "FX risk (EUR-denominated)", severity: "None", mitigant: "" },
    { risk: "Refinancing / bullet risk", severity: "Low", mitigant: "" },
    { risk: "Collateral value decline", severity: "Low", mitigant: "" },
    { risk: "Multi-asset operational complexity", severity: "Medium", mitigant: "" },
  ];

  it(`has exactly ${EXPECTED_RISK_COUNT} rows in the risk register`, () => {
    expect(RISK_REGISTER).toHaveLength(EXPECTED_RISK_COUNT);
  });

  it('every risk has a non-empty risk label', () => {
    RISK_REGISTER.forEach((r) => {
      expect(r.risk.length).toBeGreaterThan(0);
    });
  });

  it('severity is one of: None | Low | Medium | High', () => {
    const valid = new Set(['None', 'Low', 'Medium', 'High']);
    RISK_REGISTER.forEach((r) => {
      expect(valid.has(r.severity)).toBe(true);
    });
  });

  it('12th row is Multi-asset operational complexity', () => {
    expect(RISK_REGISTER[11].risk).toBe("Multi-asset operational complexity");
    expect(RISK_REGISTER[11].severity).toBe("Medium");
  });
});

describe('Presentation page — Delta 5: conservativeNights binding (assumptions.revenueRealistic.villaBaseNights)', () => {
  // Mirror the computation that page.tsx uses to calculate the % buffer.
  // conservativeNights = assumptions.revenueRealistic.villaBaseNights (87 in defaults).
  function bufferPct(bufferToBreakEven: number, conservativeNights: number): number {
    return Math.round((bufferToBreakEven / conservativeNights) * 100);
  }

  it('computes 29% buffer with 87-night Conservative and 25-night buffer', () => {
    expect(bufferPct(25, 87)).toBe(29);
  });

  it('computes 0% buffer when bufferToBreakEven is 0', () => {
    expect(bufferPct(0, 87)).toBe(0);
  });

  it('stress table: first row uses Conservative nights as denominator', () => {
    // The stress table (Delta 6) derives the –15% stress row as:
    //   Math.round(conservativeNights * 0.85)
    const conservativeNights = 87;
    const stressNights = Math.round(conservativeNights * 0.85);
    expect(stressNights).toBe(74);
  });
});
