// ============================================================
// VILLA LEV GROUP — Default Assumptions (from Excel BP v4)
// ============================================================

// Default EBITDA multiple for terminal-value calc in equity / project IRR.
// Editable via assumptions. 10× ≈ 10% implied cap rate.
export const DEFAULT_EXIT_EBITDA_MULTIPLE = 10;

import {
  ModelAssumptions,
  PropertyConfig,
  PropertyTemplate,
  ProjectAllocation,
  RoomAreaBreakdown,
  computeTotalArea,
} from './types';

// ── Default Room Area Breakdowns (m²) ──

const TWIN_VILLA_ROOMS: RoomAreaBreakdown = {
  villaUnitArea: 80,
  villaRooms: [
    { id: 'vr-twin-bed', name: 'Bedroom', count: 2, area: 22 },
    { id: 'vr-twin-bath', name: 'Bathroom', count: 2, area: 8 },
    { id: 'vr-twin-master', name: 'Master suite', count: 1, area: 20 },
  ],
  standardSuiteArea: 0,
  doubleSuiteArea: 0,
  kitchen: 40,
  livingRoom: 60,
  utilityRoom: 15,
  staffRoom: 10,
  corridors: 25,
};

const BOUTIQUE_SUITE_ROOMS: RoomAreaBreakdown = {
  villaUnitArea: 0,
  standardSuiteArea: 25,
  doubleSuiteArea: 35,
  kitchen: 15,
  livingRoom: 30,
  utilityRoom: 10,
  staffRoom: 8,
  corridors: 20,
};

const LUXURY_VILLA_ROOMS: RoomAreaBreakdown = {
  villaUnitArea: 120,
  villaRooms: [
    { id: 'vr-lux-bed', name: 'Bedroom', count: 3, area: 25 },
    { id: 'vr-lux-bath', name: 'Bathroom', count: 3, area: 10 },
    { id: 'vr-lux-dressing', name: 'Walk-in / dressing', count: 1, area: 15 },
  ],
  standardSuiteArea: 0,
  doubleSuiteArea: 0,
  kitchen: 60,
  livingRoom: 90,
  utilityRoom: 20,
  staffRoom: 15,
  corridors: 35,
};

const COMPACT_STUDIO_ROOMS: RoomAreaBreakdown = {
  villaUnitArea: 0,
  standardSuiteArea: 30,
  doubleSuiteArea: 0,
  kitchen: 15,
  livingRoom: 20,
  utilityRoom: 8,
  staffRoom: 5,
  corridors: 12,
};

const MIXED_RESORT_ROOMS: RoomAreaBreakdown = {
  villaUnitArea: 80,
  villaRooms: [
    { id: 'vr-mix-bed', name: 'Bedroom', count: 2, area: 22 },
    { id: 'vr-mix-bath', name: 'Bathroom', count: 2, area: 8 },
    { id: 'vr-mix-master', name: 'Master suite', count: 1, area: 20 },
  ],
  standardSuiteArea: 30,
  doubleSuiteArea: 40,
  kitchen: 45,
  livingRoom: 55,
  utilityRoom: 15,
  staffRoom: 10,
  corridors: 25,
};

// Sensible fallback for migrations / custom templates missing roomAreas
export const DEFAULT_ROOM_AREAS: RoomAreaBreakdown = {
  villaUnitArea: 80,
  standardSuiteArea: 30,
  doubleSuiteArea: 40,
  kitchen: 30,
  livingRoom: 40,
  utilityRoom: 10,
  staffRoom: 8,
  corridors: 20,
};

// ── Built-in Property Templates ──

export const BUILT_IN_TEMPLATES: PropertyTemplate[] = [
  {
    id: 'tpl-twin-villa',
    name: 'Twin Villas',
    builtIn: true,
    villaUnits: 1,
    standardSuites: 0,
    doubleSuites: 0,
    roomAreas: TWIN_VILLA_ROOMS,
    landCost: 400000,
    constructionArea: computeTotalArea(TWIN_VILLA_ROOMS, { villaUnits: 1, standardSuites: 0, doubleSuites: 0 }),
    constructionCostPerM2: 4000,
    ffeCost: 120000,
    legalFees: 20000,
    architectFees: 44000,
    civilEngineerFees: 35000,
    contingencyRate: 0.10,
    opex: {
      housekeeping: 15000,
      maintenance: 21000,
      utilities: 12000,
      insurance: 2500,
      propertyTax: 4000,
      marketing: 4000,
      managementFee: 20000,
      consumables: 5000,
      accounting: 7000,
    },
  },
  {
    id: 'tpl-boutique-suite',
    name: 'Boutique Suites',
    builtIn: true,
    villaUnits: 0,
    standardSuites: 2,
    doubleSuites: 2,
    roomAreas: BOUTIQUE_SUITE_ROOMS,
    landCost: 400000,
    constructionArea: computeTotalArea(BOUTIQUE_SUITE_ROOMS, { villaUnits: 0, standardSuites: 2, doubleSuites: 2 }),
    constructionCostPerM2: 4000,
    ffeCost: 100000,
    legalFees: 15000,
    architectFees: 32000,
    civilEngineerFees: 25000,
    contingencyRate: 0.10,
    opex: {
      housekeeping: 13000,
      maintenance: 15000,
      utilities: 12000,
      insurance: 2500,
      propertyTax: 4000,
      marketing: 4000,
      managementFee: 20000,
      consumables: 5000,
      accounting: 7000,
    },
  },
  {
    id: 'tpl-luxury-villa',
    name: 'Luxury Villa',
    builtIn: true,
    villaUnits: 1,
    standardSuites: 0,
    doubleSuites: 0,
    roomAreas: LUXURY_VILLA_ROOMS,
    landCost: 600000,
    constructionArea: computeTotalArea(LUXURY_VILLA_ROOMS, { villaUnits: 1, standardSuites: 0, doubleSuites: 0 }),
    constructionCostPerM2: 5000,
    ffeCost: 200000,
    legalFees: 25000,
    architectFees: 65000,
    civilEngineerFees: 45000,
    contingencyRate: 0.10,
    opex: {
      housekeeping: 22000,
      maintenance: 37500,
      utilities: 18000,
      insurance: 4000,
      propertyTax: 6000,
      marketing: 6000,
      managementFee: 30000,
      consumables: 8000,
      accounting: 10000,
    },
  },
  {
    id: 'tpl-compact-studio',
    name: 'Compact Studio',
    builtIn: true,
    villaUnits: 0,
    standardSuites: 2,
    doubleSuites: 0,
    roomAreas: COMPACT_STUDIO_ROOMS,
    landCost: 250000,
    constructionArea: computeTotalArea(COMPACT_STUDIO_ROOMS, { villaUnits: 0, standardSuites: 2, doubleSuites: 0 }),
    constructionCostPerM2: 3500,
    ffeCost: 60000,
    legalFees: 12000,
    architectFees: 20000,
    civilEngineerFees: 18000,
    contingencyRate: 0.10,
    opex: {
      housekeeping: 8000,
      maintenance: 7875,
      utilities: 8000,
      insurance: 1500,
      propertyTax: 2500,
      marketing: 3000,
      managementFee: 12000,
      consumables: 3000,
      accounting: 5000,
    },
  },
  {
    id: 'tpl-mixed-resort',
    name: 'Villa + Hotel Rooms',
    builtIn: true,
    villaUnits: 1,
    standardSuites: 2,
    doubleSuites: 1,
    roomAreas: MIXED_RESORT_ROOMS,
    landCost: 500000,
    constructionArea: computeTotalArea(MIXED_RESORT_ROOMS, { villaUnits: 1, standardSuites: 2, doubleSuites: 1 }),
    constructionCostPerM2: 4200,
    ffeCost: 160000,
    legalFees: 22000,
    architectFees: 52000,
    civilEngineerFees: 38000,
    contingencyRate: 0.10,
    opex: {
      housekeeping: 20000,
      maintenance: 26460,
      utilities: 16000,
      insurance: 3500,
      propertyTax: 5000,
      marketing: 5000,
      managementFee: 25000,
      consumables: 7000,
      accounting: 9000,
    },
  },
];

// ── Default Project Allocations ──

export const DEFAULT_PROJECTS: ProjectAllocation[] = [
  { id: 'proj-1', templateId: 'tpl-twin-villa', name: 'Twin Villas', count: 2 },
  { id: 'proj-2', templateId: 'tpl-boutique-suite', name: 'Boutique Suites', count: 1 },
];

// Helper: resolve projects → portfolio (PropertyConfig[])
export function resolvePortfolio(
  templates: PropertyTemplate[],
  projects: ProjectAllocation[]
): PropertyConfig[] {
  return projects
    .map((proj) => {
      const tpl = templates.find((t) => t.id === proj.templateId);
      if (!tpl) return null;
      const roomAreas: RoomAreaBreakdown = tpl.roomAreas
        ? { ...tpl.roomAreas }
        : { ...DEFAULT_ROOM_AREAS };
      const constructionArea = computeTotalArea(roomAreas, {
        villaUnits: tpl.villaUnits,
        standardSuites: tpl.standardSuites,
        doubleSuites: tpl.doubleSuites,
      });
      return {
        id: proj.id,
        name: proj.name,
        villaUnits: tpl.villaUnits,
        standardSuites: tpl.standardSuites,
        doubleSuites: tpl.doubleSuites,
        count: proj.count,
        roomAreas,
        landCost: tpl.landCost,
        constructionArea,
        constructionCostPerM2: tpl.constructionCostPerM2,
        ffeCost: tpl.ffeCost,
        legalFees: tpl.legalFees,
        architectFees: tpl.architectFees,
        civilEngineerFees: tpl.civilEngineerFees,
        contingencyRate: tpl.contingencyRate,
        opex: { ...tpl.opex },
      } as PropertyConfig;
    })
    .filter((p): p is PropertyConfig => p !== null);
}

// Legacy exports for backward compatibility
export const DEFAULT_VILLA: PropertyConfig = {
  id: 'prop-a',
  name: 'Twin Villas',
  villaUnits: 1,
  standardSuites: 0,
  doubleSuites: 0,
  count: 2,
  roomAreas: TWIN_VILLA_ROOMS,
  landCost: 400000,
  constructionArea: computeTotalArea(TWIN_VILLA_ROOMS, { villaUnits: 1, standardSuites: 0, doubleSuites: 0 }),
  constructionCostPerM2: 4000,
  ffeCost: 120000,
  legalFees: 20000,
  architectFees: 44000,
  civilEngineerFees: 35000,
  contingencyRate: 0.10,
  opex: {
    housekeeping: 15000,
    maintenance: 21000,
    utilities: 12000,
    insurance: 2500,
    propertyTax: 4000,
    marketing: 4000,
    managementFee: 20000,
    consumables: 5000,
    accounting: 7000,
  },
};

export const DEFAULT_SUITE: PropertyConfig = {
  id: 'prop-b',
  name: 'Boutique Suites',
  villaUnits: 0,
  standardSuites: 2,
  doubleSuites: 2,
  count: 1,
  roomAreas: BOUTIQUE_SUITE_ROOMS,
  landCost: 400000,
  constructionArea: computeTotalArea(BOUTIQUE_SUITE_ROOMS, { villaUnits: 0, standardSuites: 2, doubleSuites: 2 }),
  constructionCostPerM2: 4000,
  ffeCost: 100000,
  legalFees: 15000,
  architectFees: 32000,
  civilEngineerFees: 25000,
  contingencyRate: 0.10,
  opex: {
    housekeeping: 13000,
    maintenance: 15000,
    utilities: 12000,
    insurance: 2500,
    propertyTax: 4000,
    marketing: 4000,
    managementFee: 20000,
    consumables: 5000,
    accounting: 7000,
  },
};

export const BASE_CASE: ModelAssumptions = {
  general: {
    year1RampFactor: 0.75,
    year2RampFactor: 0.88,
    nightsGrowthPerYear: 3,
    nightsCap: 110,
  },

  revenueRealistic: {
    villaADR: 3500,
    villaBaseNights: 87,
    suiteStandardADR: 650,
    suiteDoubleADR: 920,
    suiteBaseNights: 87,
    eventsPerYear: 10,
    netProfitPerEvent: 6000,
    ancillaryBaseProfit: 75000,
    ancillaryGrowthRate: 0.10,
    ancillaryGrowthYears: 5,
  },

  revenueUpside: {
    villaADR: 3800,
    villaBaseNights: 105,
    suiteStandardADR: 700,
    suiteDoubleADR: 1000,
    suiteBaseNights: 110,
    eventsPerYear: 12,
    netProfitPerEvent: 6000,
    ancillaryBaseProfit: 75000,
    ancillaryGrowthRate: 0.10,
    ancillaryGrowthYears: 5,
  },

  portfolio: [
    { ...DEFAULT_VILLA, roomAreas: { ...DEFAULT_VILLA.roomAreas } },
    { ...DEFAULT_SUITE, roomAreas: { ...DEFAULT_SUITE.roomAreas } },
  ],

  commercialLoan: {
    loanCoverageRate: 0.80,
    interestRate: 0.04,
    gracePeriodYears: 2,
    repaymentTermYears: 13,
    workingCapitalFacility: 400000,
    // Phased grace-period interest scaled from prior 5% × 75% LTC calibration
    // by 0.853 = (4/5) × (4,939,200 / 4,630,500) — preserves drawdown shape.
    interest2026: 43200,
    interest2027: 94300,
    interest2028: 184600,
  },

  grant: {
    enabled: false,
    grantRate: 0.60,
    // Same 0.853 scaling applied to grant-path grace interest for parity.
    interest2026: 43200,
    interest2027: 94300,
    interest2028: 97300,
  },

  rrf: {
    enabled: false,
    coverageRate: 0.80,           // fraction of total CAPEX financed
    rrfShareOfLoan: 0.80,         // 80% EU RRF funds, 20% commercial
    rrfInterestRate: 0.0035,
    commercialShareRate: 0.20,
    commercialInterestRate: 0.05,
    gracePeriodYears: 2,
    repaymentTermYears: 13,
  },

  tepixLoan: {
    enabled: false,
    coverageRate: 0.90,
    hdbShareOfLoan: 0.40,
    bankShareOfLoan: 0.60,
    bankInterestRate: 0.05,
    // 5% island-region rate subsidy (vs 3% standard). Villa Lev is on
    // Antiparos, qualifying for the higher tier per the TEPIX III program
    // brochure (see tepix/milestones.yaml meta.program.interest_subsidy_pct).
    // The subsidy applies to the bank portion only and only for the first
    // `subsidyDurationYears`. Corrected 2026-05-21 — prior value 0.02 did
    // not match either tier and silently understated DSCR in years 1-2.
    interestSubsidy: 0.05,
    subsidyDurationYears: 2,
    totalTermYears: 12,
    gracePeriodYears: 2,
    landCapOnFundContribution: 0.10,
  },

  tax: {
    corporateIncomeTaxRate: 0.22,
    netVATRate: 0.07,
  },

  acquisitionLegalPerPlot: 50000,
  financingPath: 'commercial',
  exitEbitdaMultiple: 10,
  // Default exit at the end of the modeled horizon (2036 = Y10 of operations).
  // Editable; engine clamps to [first stabilised year, last modeled year].
  exitYear: 2036,
  // Standard Greek/EU commercial real-estate covenant. Editable in the BP
  // export; drives the Pass/Fail flag on the Coverage sheet.
  dscrCovenantThreshold: 1.25,

  // Engine view mode. 'internal' = legacy OpCo-senior waterfall (admin
  // sees this by default — today's dashboard numbers). 'bank' = OpCo
  // subordinated to debt service, what bankers underwrite. See the
  // branch block in `computePnLYear` (model.ts) for the cash-waterfall
  // contract. Investor / pitch / View-As-Banker override to 'bank' at
  // the call site; admin's "Bank view" toggle does the same.
  viewMode: 'internal',

  // OpCo / PropCo split disabled by default. Toggle on the dashboard to see
  // how a separated owner-and-manager structure shifts equity returns.
  opCoFee: {
    enabled: false,
    baseMgmtFeeRate: 0.05,   // Bucket 2A: was baseFeeRate: 0.03 + brandFeeRate: 0.02
    incentiveFeeRate: 0.10,
    ownerPriorityReturnRate: 0.08,
  },

  // Minimum annual management fee paid senior (in OpEx, hits DSCR). OpCo
  // fees billed above this floor are subordinated to debt service in bank
  // view. Internal view ignores this and continues to use the per-villa
  // `managementFee` lines. At BASE_CASE 4 villas × ~€25K = ~€100K of per-villa
  // fees in internal view collapses to a single €24K floor in bank view,
  // which lifts EBITDA by ~€76K and DSCR by ~0.09–0.15× depending on year.
  opCoSeniorFloor: 24_000,

  workingCapital: {
    active: true,
    facilitySize: 400000,
    spreadOverTermRate: 0.01,
    preOpeningTotalDraw: 200000,
    seasonalDrawPerCycle: 150000,
    y2RampBufferTopup: 100000,
    selfLiquidating: true,
    dsraConversionEnabled: false,
    dsraLockAmount: 124000,
    internalCashBuffer: 100000,
  },
};

export const DOWNSIDE_FACTORS = {
  occupancyReduction: 0.10,
  adrReduction: 0.05,
  eventsPerYear: 4,
  // Working capital under stress: bigger draws, partial repayments.
  wcSeasonalDrawMultiplier: 1.5,
  wcRepaymentRatio: 0.7,
};

// Self-liquidating threshold: trough quarter must close ≤ this amount or the
// engine flags a violation on AnnualPnL.wcSelfLiquidatingViolation.
export const WC_TROUGH_THRESHOLD = 50000;
