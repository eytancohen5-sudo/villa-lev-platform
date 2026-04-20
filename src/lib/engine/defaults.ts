// ============================================================
// VILLA LEV GROUP — Default Assumptions (from Excel BP v4)
// ============================================================

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
  standardSuiteArea: 0,
  doubleSuiteArea: 0,
  kitchen: 40,
  livingRoom: 60,
  utilityRoom: 15,
  staffRoom: 10,
  corridors: 25,
  outdoor: 120,
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
  outdoor: 47,
};

const LUXURY_VILLA_ROOMS: RoomAreaBreakdown = {
  villaUnitArea: 120,
  standardSuiteArea: 0,
  doubleSuiteArea: 0,
  kitchen: 60,
  livingRoom: 90,
  utilityRoom: 20,
  staffRoom: 15,
  corridors: 35,
  outdoor: 160,
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
  outdoor: 30,
};

const MIXED_RESORT_ROOMS: RoomAreaBreakdown = {
  villaUnitArea: 80,
  standardSuiteArea: 30,
  doubleSuiteArea: 40,
  kitchen: 45,
  livingRoom: 55,
  utilityRoom: 15,
  staffRoom: 10,
  corridors: 25,
  outdoor: 90,
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
  outdoor: 50,
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
    villaBaseNights: 95,
    suiteStandardADR: 650,
    suiteDoubleADR: 920,
    suiteBaseNights: 100,
    eventsPerYear: 10,
    netProfitPerEvent: 6000,
    ancillaryBaseProfit: 75000,
    ancillaryGrowthRate: 0.10,
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
  },

  portfolio: [
    { ...DEFAULT_VILLA, roomAreas: { ...DEFAULT_VILLA.roomAreas } },
    { ...DEFAULT_SUITE, roomAreas: { ...DEFAULT_SUITE.roomAreas } },
  ],

  commercialLoan: {
    loanCoverageRate: 0.75,
    interestRate: 0.05,
    gracePeriodYears: 2,
    repaymentTermYears: 13,
    workingCapitalFacility: 400000,
    interest2026: 50625,
    interest2027: 110544,
    interest2028: 216402,
  },

  grant: {
    enabled: false,
    grantRate: 0.60,
    interest2026: 50625,
    interest2027: 110544,
    interest2028: 114109,
  },

  rrf: {
    enabled: false,
    rrfShareOfLoan: 0.80,
    rrfInterestRate: 0.0035,
    commercialShareRate: 0.20,
    commercialInterestRate: 0.05,
    gracePeriodYears: 2,
    repaymentTermYears: 13,
    totalLoanDrawn: 4939200,
    equityRequired: 1234800,
    annualDS: 439700,
  },

  tepixLoan: {
    enabled: false,
    coverageRate: 0.90,
    hdbShareOfLoan: 0.40,
    bankShareOfLoan: 0.60,
    bankInterestRate: 0.05,
    interestSubsidy: 0.02,
    subsidyDurationYears: 2,
    totalTermYears: 14,
    gracePeriodYears: 2,
    landCapOnFundContribution: 0.10,
  },

  tax: {
    corporateIncomeTaxRate: 0.22,
    netVATRate: 0.07,
  },

  acquisitionLegalPerPlot: 50000,
  financingPath: 'commercial',
};

export const DOWNSIDE_FACTORS = {
  occupancyReduction: 0.10,
  adrReduction: 0.05,
  eventsPerYear: 4,
};
