// ============================================================
// Optima Bank financing path — unit + integration tests
// ============================================================
//
// Group 1: optimaCapexView() pure-function tests
//   Tests use a fabricated CapexBreakdown to stay independent of
//   computeCapex so a CAPEX engine change doesn't break these.
//
// Group 2: Optima branch of computeDebtService — driven via computeModel
//   because computeDebtService is not exported. We use BASE_CASE with
//   financingPath: 'optima' and read optimaScenario / optimaDebt proxies.

import { describe, expect, it } from 'vitest';

import { optimaCapexView } from '@/lib/engine/optimaView';
import { computeModel } from '@/lib/engine/model';
import { BASE_CASE } from '@/lib/engine/defaults';
import type { CapexBreakdown, ModelAssumptions } from '@/lib/engine/types';

// ── Fixture helpers ─────────────────────────────────────────────────────────

/**
 * Build a minimal but realistic CapexBreakdown for optimaCapexView tests.
 *
 * Category names deliberately match the keywords used inside optimaView.ts:
 *  - 'Building & excavation'  → matches 'building' / 'excavation'  → construction destination
 *  - 'Licenses & permits'     → matches 'licenses'                 → service-provider
 *  - 'Construction director'  → matches 'construction director'    → service-provider
 *  - 'Contingency'            → matches 'contingency'              → contingency
 *
 * perProperty shape: [{ id, perUnit, total }]
 */
function makeCapex(opts: {
  constructionTotal: number;
  serviceProviderTotal: number;
  contingencyTotal: number;
}): CapexBreakdown {
  const { constructionTotal, serviceProviderTotal, contingencyTotal } = opts;
  const portfolioTotal = constructionTotal + serviceProviderTotal + contingencyTotal;

  return {
    properties: [],
    acquisitionLegal: 0,
    portfolioTotal,
    totalPlots: 1,
    categories: [
      {
        name: 'Building & excavation',
        depreciationRate: 0.04,
        perProperty: [{ id: 'prop-a', perUnit: constructionTotal, total: constructionTotal }],
        grandTotal: constructionTotal,
      },
      {
        name: 'Licenses & permits',
        depreciationRate: 0.20,
        perProperty: [{ id: 'prop-a', perUnit: serviceProviderTotal, total: serviceProviderTotal }],
        grandTotal: serviceProviderTotal,
      },
      {
        name: 'Contingency',
        depreciationRate: 0.04,
        perProperty: [{ id: 'prop-a', perUnit: contingencyTotal, total: contingencyTotal }],
        grandTotal: contingencyTotal,
      },
    ],
    annualDepreciationTotal: 0,
    depreciationByCategory: {},
    constructionVatByYear: { 2026: -10000, 2027: -25000, 2028: -15000, 2029: 50000 },
  };
}

function withOptima(base: ModelAssumptions): ModelAssumptions {
  return { ...base, financingPath: 'optima' };
}

// ── Group 1: optimaCapexView unit tests ──────────────────────────────────────

describe('optimaCapexView', () => {
  const CONSTRUCTION = 5_000_000;
  const SERVICE_PROVIDER = 400_000;
  const CONTINGENCY = 200_000;
  const absorbBoth = { serviceProviders: true, contingency: true };
  const absorbNone = { serviceProviders: false, contingency: false };

  it('portfolioTotal invariant — sum unchanged when both absorbed', () => {
    const capex = makeCapex({
      constructionTotal: CONSTRUCTION,
      serviceProviderTotal: SERVICE_PROVIDER,
      contingencyTotal: CONTINGENCY,
    });
    const result = optimaCapexView(capex, absorbBoth);

    expect(Math.abs(result.portfolioTotal - capex.portfolioTotal)).toBeLessThanOrEqual(1);
  });

  it('construction line increases after absorption', () => {
    const capex = makeCapex({
      constructionTotal: CONSTRUCTION,
      serviceProviderTotal: SERVICE_PROVIDER,
      contingencyTotal: CONTINGENCY,
    });
    const inputConstructionTotal = capex.categories.find((c) =>
      c.name === 'Building & excavation',
    )!.grandTotal;

    const result = optimaCapexView(capex, absorbBoth);
    const outputConstructionTotal = result.categories.find((c) =>
      c.name === 'Building & excavation',
    )!.grandTotal;

    expect(outputConstructionTotal).toBeGreaterThan(inputConstructionTotal);
  });

  it('absorbed categories are removed from result.categories', () => {
    const capex = makeCapex({
      constructionTotal: CONSTRUCTION,
      serviceProviderTotal: SERVICE_PROVIDER,
      contingencyTotal: CONTINGENCY,
    });
    const result = optimaCapexView(capex, absorbBoth);

    const names = result.categories.map((c) => c.name);
    expect(names).not.toContain('Licenses & permits');
    expect(names).not.toContain('Contingency');
    // Construction line must survive
    expect(names).toContain('Building & excavation');
  });

  it('no-op when absorb is false — portfolioTotal unchanged and category count identical', () => {
    const capex = makeCapex({
      constructionTotal: CONSTRUCTION,
      serviceProviderTotal: SERVICE_PROVIDER,
      contingencyTotal: CONTINGENCY,
    });
    const result = optimaCapexView(capex, absorbNone);

    expect(result.portfolioTotal).toBe(capex.portfolioTotal);
    expect(result.categories.length).toBe(capex.categories.length);
  });

  it('constructionVatByYear passes through unchanged (deep equal)', () => {
    const capex = makeCapex({
      constructionTotal: CONSTRUCTION,
      serviceProviderTotal: SERVICE_PROVIDER,
      contingencyTotal: CONTINGENCY,
    });
    const result = optimaCapexView(capex, absorbBoth);

    expect(result.constructionVatByYear).toEqual(capex.constructionVatByYear);
  });
});

// ── Group 2: Optima computeDebtService — driven via computeModel ─────────────
//
// computeDebtService is not exported. We drive these tests through computeModel
// using financingPath: 'optima' and observe:
//   - model.optimaScenario  (the ScenarioOutput for the Optima Bank path)
//   - model.keyMetrics      (when financingPath === 'optima' this path is active)

describe('computeModel — Optima Bank financing path', () => {
  // BASE_CASE already has a sensible optimaLoan definition. Use it directly.
  const op = BASE_CASE.optimaLoan!;

  it('loan does not exceed 2 × splitThresholdEur', () => {
    const out = computeModel(withOptima(BASE_CASE));
    // When financingPath === 'optima', keyMetrics.loanAmount reflects the optima path.
    const loanAmount = out.keyMetrics.loanAmount;
    expect(loanAmount).toBeLessThanOrEqual(op.splitThresholdEur * 2);
  });

  it('both sub-projects ≤ splitThresholdEur — combined loan ≤ splitThresholdEur × 2', () => {
    const out = computeModel(withOptima(BASE_CASE));
    // By the split logic: subA = min(translatedConstruction / 2, threshold)
    //                     subB = translatedConstruction - subA
    // So by construction both subA and subB ≤ threshold when totalConstruction ≤ 2 × threshold.
    // Validate the invariant at the aggregate level (the only observable surface).
    const loanAmount = out.keyMetrics.loanAmount;
    expect(loanAmount).toBeLessThanOrEqual(op.splitThresholdEur * 2);
    expect(loanAmount).toBeGreaterThan(0);
  });

  it('annualDS is positive and finite', () => {
    const out = computeModel(withOptima(BASE_CASE));
    const annualDS = out.keyMetrics.annualDS;
    expect(Number.isFinite(annualDS)).toBe(true);
    expect(annualDS).toBeGreaterThan(0);
  });

  it('PMT cross-check — annualDS ≈ pmt(subA) + pmt(subB) within €10', () => {
    // We must reconstruct the split from the model output.
    // keyMetrics.loanAmount under 'optima' = subA + subB = translatedConstructionCost
    const out = computeModel(withOptima(BASE_CASE));
    const totalLoan = out.keyMetrics.loanAmount;
    const effectiveRate = op.euriborRate + op.spreadBps / 10_000;
    const n = op.repaymentYears; // 10

    // Replicate the split exactly as model.ts does:
    //   subA = min(totalLoan / 2, splitThresholdEur)
    //   subB = totalLoan - subA
    const subA = Math.min(totalLoan / 2, op.splitThresholdEur);
    const subB = totalLoan - subA;

    // PMT formula: rate × PV / (1 − (1 + rate)^−n)
    function pmtFn(rate: number, nper: number, pv: number): number {
      if (rate === 0) return pv / nper;
      return (rate * pv) / (1 - Math.pow(1 + rate, -nper));
    }

    const expectedDS = pmtFn(effectiveRate, n, subA) + pmtFn(effectiveRate, n, subB);
    const reportedDS = out.keyMetrics.annualDS;

    expect(Math.abs(reportedDS - expectedDS)).toBeLessThanOrEqual(10);
  });

  it('DSCR is positive and within sanity bounds in the stabilised year', () => {
    const out = computeModel(withOptima(BASE_CASE));
    const stabilised = out.optimaScenario?.stabilisedYear;

    // optimaScenario must be present
    expect(stabilised).toBeDefined();

    const dscr = stabilised!.dscr;
    expect(Number.isFinite(dscr)).toBe(true);
    expect(dscr).toBeGreaterThan(0);
    expect(dscr).toBeLessThan(10);
  });
});
