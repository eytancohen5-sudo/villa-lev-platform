// Unit tests for exportInvestorPresentation.
//
// The function does a dynamic `import('docx')` and calls `Packer.toBlob`.
// We intercept the module with vi.mock so no real docx document is built —
// only the orchestration logic (Blob return type, empty-stakeholders safety,
// all financing paths, propertyExitDominates flag) is exercised here.

import { describe, it, expect, vi } from 'vitest';

// ─── Mock 'docx' before any import that might pull it in ─────────────────────
//
// Vitest hoists vi.mock calls to the top of the file at transform time,
// so it is safe to reference `vi` before the imports appear in source order.

const DOCX_BLOB = new Blob(['test'], {
  type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});

vi.mock('docx', () => ({
  Document:          vi.fn().mockImplementation(() => ({})),
  Paragraph:         vi.fn().mockImplementation(() => ({})),
  Table:             vi.fn().mockImplementation(() => ({})),
  TableRow:          vi.fn().mockImplementation(() => ({})),
  TableCell:         vi.fn().mockImplementation(() => ({})),
  TextRun:           vi.fn().mockImplementation(() => ({})),
  ExternalHyperlink: vi.fn().mockImplementation(() => ({})),
  HeadingLevel:  { TITLE: 'TITLE', HEADING_1: 'h1', HEADING_2: 'h2', HEADING_3: 'h3' },
  AlignmentType: { CENTER: 'center', RIGHT: 'right', LEFT: 'left' },
  WidthType:     { PERCENTAGE: 'pct' },
  BorderStyle:   { SINGLE: 'single' },
  Packer: {
    toBlob: vi.fn().mockResolvedValue(DOCX_BLOB),
  },
}));

// Import the function under test AFTER the mock is registered.
import { exportInvestorPresentation } from '@/lib/docx/exportInvestorPresentation';
import type { CapTableResult, StakeholderResult } from '@/lib/engine/capTable';
import type { ModelAssumptions, ModelOutput, AnnualPnL } from '@/lib/engine/types';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

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
    dscr: 1.5,
    wcAvgBalance: 0,
    wcPeakBalance: 0,
    wcTroughBalance: 0,
    wcInterestExpense: 0,
    wcNetContribution: 0,
    wcSelfLiquidatingViolation: false,
    dscrLoaded: 1.5,
    grossRevenue: 1000,
    otaCommissions: 0,
  };
}

function makeScenarioOutput(propertyExitDominates = false) {
  const stabilised = makeAnnualPnL(2031);
  return {
    name: 'realistic',
    pnl: [makeAnnualPnL(2028), makeAnnualPnL(2029)],
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
    propertyExitDominates,
  };
}

function makeStakeholderResult(id: string, isPromoter = false): StakeholderResult {
  return {
    stakeholder: {
      id,
      name: `Stakeholder ${id}`,
      cashIn: 100000,
      isPromoter,
    },
    ppFraction: isPromoter ? 0 : 1,
    economicStake: 0.5,
    yearly: [
      {
        year: 2028,
        pariPassuShare: 0,
        developerEquityShare: 0,
        grantBonusShare: 0,
        performanceRatchetShare: 0,
        investorDistribution: 50000,
        totalCashFlow: 50000,
      },
    ],
    totalReceived: 50000,
    netProfit: -50000,
    moic: 0.5,
    irr: 0,
    paybackYear: null,
  };
}

function makeCapTableResult(stakeholders: StakeholderResult[] = []): CapTableResult {
  return {
    founderBreakdown: {
      pariPassuPct: 0.25,
      developerEquityPct: 0.25,
      grantBonusPct: 0,
      performanceRatchetPct: 0,
      earnedPct: 0,
      founderOperatingPct: 0.5,
      founderExitPct: 0.5,
      grantExitCapActive: false,
      founderTotalPct: 0.5,
      investorTotalPct: 0.5,
      capBinding: 'none' as const,
      ratchetTier: 'miss' as const,
      ratchetTierLabel: 'Miss',
      moicFloorReduction: false,
      consultantCashPayment: 0,
      founderNetGrantCash: 0,
      postGrantEquityValue: 0,
      bucket1B_deferredAdvisoryFee: 0,
      bucket1B_annualPayment: 0,
      bucket1B_paymentStartYear: 0,
      aggelakakisCash: 0,
      aggelakakisEquityAtExit: 0,
      aggelakakisEquityPct: 0,
      aggelakakisPromotePct: 0,
      aggelakakisExitPct: 0,
      eytan1BCash: 0,
      grantSuccessFeePaymentYear: 2030,
    },
    iterations: 1,
    converged: true,
    stakeholders,
    totalProjectDistributable: 100000,
    totalDistributed: 100000,
    reconciliationError: 0,
    investorIRR: 0.1,
    investorMOIC: 1.5,
    totalNonFounderCash: 100000,
    totalEquityRaised: 200000,
    totalEquityCommitted: 200000,
    founderCashInvested: 100000,
    grantApproved: false,
    totalFounderManCoFee: 0,
    totalDeferredAdvisoryFee: 0,
  };
}

function makeModelOutput(propertyExitDominates = false): ModelOutput {
  const scenario = makeScenarioOutput(propertyExitDominates);
  return {
    capex: {
      properties: [],
      acquisitionLegal: 5000,
      portfolioTotal: 100000,
      totalPlots: 1,
      categories: [],
    },
    scenarios: {
      realistic: scenario,
      upside:    scenario,
      downside:  scenario,
      breakeven: scenario,
    },
    grantScenario:    scenario,
    rrfScenario:      scenario,
    commercialScenario: scenario,
    tepixLoanScenario:  scenario,
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
    general: { year1RampFactor: 0.5, year2RampFactor: 0.75, nightsGrowthPerYear: 5, nightsCap: 180 },
    revenueRealistic: {
      villaADR: 500, villaBaseNights: 100, suiteStandardADR: 200, suiteDoubleADR: 300,
      suiteBaseNights: 80, eventsPerYear: 10, netProfitPerEvent: 1000,
      ancillaryBaseProfit: 5000, ancillaryGrowthRate: 0.05, ancillaryGrowthYears: 5,
    },
    revenueUpside: {
      villaADR: 600, villaBaseNights: 120, suiteStandardADR: 250, suiteDoubleADR: 350,
      suiteBaseNights: 100, eventsPerYear: 15, netProfitPerEvent: 1200,
      ancillaryBaseProfit: 6000, ancillaryGrowthRate: 0.06, ancillaryGrowthYears: 5,
    },
    portfolio: [{
      id: 'p1', name: 'Property A', villaUnits: 2, standardSuites: 0, doubleSuites: 0,
      count: 1, roomAreas, landCost: 50000, constructionArea: 200,
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
      enabled: false, coverageRate: 0.8, rrfShareOfLoan: 0.8, rrfInterestRate: 0.03,
      commercialShareRate: 0.2, commercialInterestRate: 0.06,
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
      enabled: false, baseMgmtFeeRate: 0.05, incentiveFeeRate: 0.1,
      ownerPriorityReturnRate: 0.08,
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

describe('exportInvestorPresentation', () => {
  it('smoke: resolves to a Blob with the correct Word MIME type', async () => {
    const capResult = makeCapTableResult([
      makeStakeholderResult('founder', true),
      makeStakeholderResult('inv-a'),
    ]);
    const a = makeAssumptions();
    const m = makeModelOutput();

    const result = await exportInvestorPresentation(capResult, a, m, 'en');

    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });

  it('handles empty stakeholders array without throwing', async () => {
    const capResult = makeCapTableResult([]); // zero stakeholders
    const a = makeAssumptions();
    const m = makeModelOutput();

    await expect(
      exportInvestorPresentation(capResult, a, m, 'en'),
    ).resolves.toBeInstanceOf(Blob);
  });

  it('all 4 financing paths work without throwing', async () => {
    const paths: ModelAssumptions['financingPath'][] = ['commercial', 'grant', 'rrf', 'tepix-loan'];
    const capResult = makeCapTableResult([
      makeStakeholderResult('founder', true),
      makeStakeholderResult('inv-a'),
    ]);
    for (const path of paths) {
      const a = makeAssumptions(path);
      const m = makeModelOutput();
      await expect(
        exportInvestorPresentation(capResult, a, m, 'en'),
        `path ${path} should not throw`,
      ).resolves.toBeInstanceOf(Blob);
    }
  });

  it('propertyExitDominates=true does not throw', async () => {
    const capResult = makeCapTableResult([makeStakeholderResult('founder', true)]);
    const a = makeAssumptions();
    const m = makeModelOutput(true); // propertyExitDominates = true

    await expect(
      exportInvestorPresentation(capResult, a, m, 'en'),
    ).resolves.toBeInstanceOf(Blob);
  });

  it('propertyExitDominates=false does not throw', async () => {
    const capResult = makeCapTableResult([makeStakeholderResult('founder', true)]);
    const a = makeAssumptions();
    const m = makeModelOutput(false); // propertyExitDominates = false

    await expect(
      exportInvestorPresentation(capResult, a, m, 'en'),
    ).resolves.toBeInstanceOf(Blob);
  });
});
