// Unit tests for exportBankPresentation.
//
// The function does a dynamic `import('docx')` and calls `Packer.toBlob`.
// We intercept the module with vi.mock so no real docx document is built —
// only the orchestration logic (Blob return type, empty-array safety, all
// financing paths) is exercised here.

import { describe, it, expect, vi } from 'vitest';

// ─── Mock 'docx' before any import that might pull it in ─────────────────────
const DOCX_BLOB = new Blob(['test'], {
  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});

vi.mock('docx', () => ({
  Document:      vi.fn().mockImplementation(() => ({})),
  Paragraph:     vi.fn().mockImplementation(() => ({})),
  Table:         vi.fn().mockImplementation(() => ({})),
  TableRow:      vi.fn().mockImplementation(() => ({})),
  TableCell:     vi.fn().mockImplementation(() => ({})),
  TextRun:       vi.fn().mockImplementation(() => ({})),
  HeadingLevel:  { HEADING_1: 'HEADING_1', HEADING_2: 'HEADING_2', HEADING_3: 'HEADING_3', TITLE: 'TITLE' },
  AlignmentType: { LEFT: 'LEFT', RIGHT: 'RIGHT', CENTER: 'CENTER' },
  WidthType:     { PERCENTAGE: 'PERCENTAGE' },
  BorderStyle:   { SINGLE: 'SINGLE' },
  Packer: {
    toBlob: vi.fn().mockResolvedValue(DOCX_BLOB),
  },
}));

import { exportBankPresentation } from '@/lib/docx/exportBankPresentation';
import type { ModelAssumptions, ModelOutput, AnnualPnL } from '@/lib/engine/types';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

/** Minimal AnnualPnL row — all numeric fields at sensible values. */
function makeAnnualPnL(year: number): AnnualPnL {
  return {
    year,
    phase: 'operational',
    villaNights: 0,
    suiteNights: 0,
    propertyBreakdown: [],
    revenueEvents: 0,
    revenueAncillary: 0,
    revenueAncillaryCapped: false,
    totalRevenue: 1000,
    totalOpex: 400,
    ebitdaPreOpCo: 600,
    opCoBaseFee: 0,
    opCoBrandFee: 0,
    opCoIncentiveFee: 0,
    opCoTotalFee: 0,
    opCoSeniorPaid: 0,
    opCoJuniorPaid: 0,
    ebitda: 600,
    ebitdaMargin: 0.6,
    debtService: 200,
    netCashFlow: 400,
    cumulativeNCF: 400,
    vatPayable: 50,
    citPayable: 0,
    profitAfterTax: 400,
    netCashFlowPostVAT: 350,
    yieldOnInitialEquity: 0.05,
    cumulativeYieldOnInitialEquity: 0.1,
    termLoanInterest: 100,
    termLoanPrincipal: 100,
    termLoanBalance: 900,
    interestCoverageRatio: 6,
    cfads: 600,
    dscr: 3,
    wcAvgBalance: 0,
    wcPeakBalance: 0,
    wcTroughBalance: 0,
    wcInterestExpense: 0,
    wcNetContribution: 0,
    wcSelfLiquidatingViolation: false,
    dscrLoaded: 3,
    grossRevenue: 1000,
    otaCommissions: 0,
    floorAccrual: 0,
  };
}

/** Minimal ScenarioOutput. */
function makeScenarioOutput(dscr = 1.5) {
  const stabilised: AnnualPnL = {
    ...makeAnnualPnL(2031),
    dscr,
    ebitdaMargin: 0.5,
  };
  return {
    name: 'realistic',
    pnl: [
      makeAnnualPnL(2028),
      makeAnnualPnL(2029),
      makeAnnualPnL(2030),
      stabilised,
    ],
    stabilisedYear: stabilised,
    wcQuarters: [],
    wcEffectiveFacility: 0,
    wcMinimumFacility: 0,
    wcRate: 0,
    llcr: 1.8,
    plcr: 2.0,
    icrStabilised: 3.0,
    minDSCRLoanLife: 1.2,
    avgDSCRLoanLife: 1.6,
    dscrCovenantHeadroom: 0.28,
    peakDebtOutstanding: 0,
    gracePeriodInterestTotal: 0,
    netLeverage: 0,
    yieldStabilised: 0.08,
    cumulativeYieldFinal: 0.5,
    totalMOIC: 2.2,
    equityPaybackYears: 7 as number | null,
    equityIRR: 0.18,
    equityIRRPreOpCo: 0.18,
    opCoStabilisedFee: 0,
    projectIRR: 0.14,
    roic: 0.12,
    terminalAssetValue: 5000000,
    terminalEquityValue: 3000000,
    terminalUnderwater: false,
    exitEbitdaMultiple: 10,
    exitYear: 2033,
    exitValuationPerM2: 9000,
    terminalAssetValuePropertySale: 4500000,
    terminalEquityValuePropertySale: 2500000,
    equityIRRPropertySale: 0.15,
    projectIRRPropertySale: 0.12,
    totalMOICPropertySale: 2.0,
    propertyExitDominates: false,
  };
}

/** Minimal ModelOutput. */
function makeModelOutput(): ModelOutput {
  const realistic = makeScenarioOutput(1.5);
  const upside    = makeScenarioOutput(2.0);
  const downside  = makeScenarioOutput(1.1);
  const breakeven = makeScenarioOutput(1.0);

  return {
    capex: {
      properties: [
        { id: 'p1', name: 'Property A', count: 2, perUnit: 50000, total: 100000 },
      ],
      acquisitionLegal: 5000,
      portfolioTotal: 100000,
      totalPlots: 1,
      categories: [
        {
          name: 'Land Acquisition',
          perProperty: [],
          grandTotal: 60000,
        },
        {
          name: 'Construction',
          perProperty: [],
          grandTotal: 30000,
        },
      ],
    },
    scenarios: { realistic, upside, downside, breakeven },
    grantScenario:    makeScenarioOutput(),
    rrfScenario:      makeScenarioOutput(),
    commercialScenario: makeScenarioOutput(),
    tepixLoanScenario:  makeScenarioOutput(),
    financingComparison: [],
    keyMetrics: {
      stabilisedRevenue:     1000,
      stabilisedEBITDA:       600,
      stabilisedEBITDAMargin: 0.6,
      stabilisedDSCR:         1.5,
      stabilisedNCF:          400,
      totalCapex:          200000,
      loanAmount:          150000,
      equityRequired:       50000,
      annualDS:               200,
      ltv:                    0.6,
      assetCoverage:          1.5,
      portfolioValue:      250000,
      breakEvenNights:         50,
      bufferToBreakEven:      0.3,
      primaryLoan:         150000,
      supplementaryLoan:        0,
      landFundedByTepix:        0,
      landFundedByCommercial:   0,
      tepixCapBindingBy:        0,
      tepixLoanCap:             0,
      grantAmount:              0,
      graceInterestCarry:       0,
      graceInterestHoldYears:   0,
    },
    dscrByYear: [],
    collateral: {
      builtSurface: 500,
      stress:    { valuationPerM2: 7650,  value: 3825000, ltv: 0.4,  coverage: 2.5 },
      market:    { valuationPerM2: 9000,  value: 4500000, ltv: 0.33, coverage: 3.0 },
      optimistic:{ valuationPerM2: 11000, value: 5500000, ltv: 0.27, coverage: 3.7 },
    },
    activeFinancingPath: 'commercial',
    computeTimeMs: 1,
  };
}

/** Minimal ModelAssumptions for a given financing path. */
function makeAssumptions(
  financingPath: ModelAssumptions['financingPath'] = 'commercial',
): ModelAssumptions {
  const opex = {
    housekeeping: 0, maintenance: 0, utilities: 0, insurance: 0,
    propertyTax: 0, marketing: 0, managementFee: 0, consumables: 0, accounting: 0,
  };
  const roomAreas = {
    villaUnitArea: 80, standardSuiteArea: 0, doubleSuiteArea: 0,
    kitchen: 10, livingRoom: 10, utilityRoom: 5, staffRoom: 5, corridors: 5,
  };
  return {
    general: {
      year1RampFactor: 0.5, year2RampFactor: 0.75,
      nightsGrowthPerYear: 5, nightsCap: 180,
    },
    revenueRealistic: {
      villaADR: 500, villaBaseNights: 100,
      suiteStandardADR: 200, suiteDoubleADR: 300,
      suiteBaseNights: 80, eventsPerYear: 10, netProfitPerEvent: 1000,
      ancillaryBaseProfit: 5000, ancillaryGrowthRate: 0.05, ancillaryGrowthYears: 5,
    },
    revenueUpside: {
      villaADR: 600, villaBaseNights: 120,
      suiteStandardADR: 250, suiteDoubleADR: 350,
      suiteBaseNights: 100, eventsPerYear: 15, netProfitPerEvent: 1200,
      ancillaryBaseProfit: 6000, ancillaryGrowthRate: 0.06, ancillaryGrowthYears: 5,
    },
    portfolio: [{
      id: 'p1', name: 'Property A',
      villaUnits: 2, standardSuites: 0, doubleSuites: 0, count: 2,
      roomAreas, landCost: 50000, constructionArea: 200,
      constructionCostPerM2: 1000, ffeCost: 5000, legalFees: 1000,
      architectFees: 1000, civilEngineerFees: 500, contingencyRate: 0.05, opex,
    }],
    commercialLoan: {
      loanCoverageRate: 0.75, interestRate: 0.06, gracePeriodYears: 2,
      repaymentTermYears: 15, workingCapitalFacility: 50000,
      interest2026: 0, interest2027: 0, interest2028: 0,
    },
    grant: { enabled: false, grantRate: 0.4, gracePeriodYears: 0 },
    rrf: {
      enabled: false, coverageRate: 0.8, rrfShareOfLoan: 0.8,
      rrfInterestRate: 0.03, commercialShareRate: 0.2, commercialInterestRate: 0.06,
      gracePeriodYears: 2, repaymentTermYears: 15,
    },
    tepixLoan: {
      enabled: false, coverageRate: 0.8, hdbShareOfLoan: 0.5, bankShareOfLoan: 0.5,
      bankInterestRate: 0.055, interestSubsidy: 0.02, subsidyDurationYears: 5,
      totalTermYears: 15, gracePeriodYears: 2, landCapOnFundContribution: 0,
    },
    tax: { corporateIncomeTaxRate: 0.22, netVATRate: 0.13, otaCommissionRate: 0.08 },
    acquisitionLegalPerPlot: 2000,
    financingPath,
    opCoFee: {
      enabled: false, baseMgmtFeeRate: 0.05,
      incentiveFeeRate: 0.1, ownerPriorityReturnRate: 0.08,
    },
    opCoSeniorFloor: 0,
    workingCapital: {
      active: false, facilitySize: 50000, spreadOverTermRate: 0.01,
      preOpeningTotalDraw: 0, seasonalDrawPerCycle: 0, y2RampBufferTopup: 0,
      selfLiquidating: true, dsraConversionEnabled: false,
      dsraLockAmount: 20000, internalCashBuffer: 0,
    },
    exitEbitdaMultiple: 10,
    exitYear: 2033,
    dscrCovenantThreshold: 1.25,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('exportBankPresentation', () => {
  it('smoke: resolves to a Blob with the correct Word MIME type', async () => {
    const a = makeAssumptions('commercial');
    const m = makeModelOutput();

    const result = await exportBankPresentation(a, m, 'en');

    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });

  it('empty pnl[] and null stabilisedYear does not throw', async () => {
    const a = makeAssumptions('commercial');
    const m = makeModelOutput();
    // Force all scenarios to have empty pnl and null stabilisedYear
    const emptyScenario = {
      ...makeScenarioOutput(),
      pnl: [] as AnnualPnL[],
      stabilisedYear: null,
    };
    m.scenarios.realistic = emptyScenario;
    m.scenarios.upside    = emptyScenario;
    m.scenarios.downside  = emptyScenario;
    m.scenarios.breakeven = emptyScenario;

    await expect(exportBankPresentation(a, m, 'en')).resolves.toBeInstanceOf(Blob);
  });

  it('empty portfolio does not throw', async () => {
    const a = makeAssumptions('commercial');
    a.portfolio = [];
    const m = makeModelOutput();
    m.capex.properties = [];

    await expect(exportBankPresentation(a, m, 'en')).resolves.toBeInstanceOf(Blob);
  });

  it('all 4 financing paths work without throwing', async () => {
    const paths: ModelAssumptions['financingPath'][] = ['commercial', 'grant', 'rrf', 'tepix-loan'];
    for (const path of paths) {
      const a = makeAssumptions(path);
      const m = makeModelOutput();
      await expect(
        exportBankPresentation(a, m, 'en'),
        `path ${path} should not throw`,
      ).resolves.toBeInstanceOf(Blob);
    }
  });
});
