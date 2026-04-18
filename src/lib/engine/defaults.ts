// ============================================================
// VILLA LEV GROUP — Default Assumptions (from Excel BP v4)
// ============================================================

import { ModelAssumptions, PropertyConfig } from './types';

// Default property templates
const DEFAULT_VILLA: PropertyConfig = {
  id: 'prop-a',
  name: 'Twin Villas',
  type: 'villa',
  count: 2,
  landCost: 400000,
  constructionArea: 350,
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

const DEFAULT_SUITE: PropertyConfig = {
  id: 'prop-b',
  name: 'Boutique Suites',
  type: 'suite',
  count: 1,
  landCost: 400000,
  constructionArea: 250,
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

export { DEFAULT_VILLA, DEFAULT_SUITE };

export const BASE_CASE: ModelAssumptions = {
  general: {
    year1RampFactor: 0.75,  // 2028 partial season
    year2RampFactor: 0.88,  // 2029
    nightsGrowthPerYear: 3, // +3 nights/year from 2030
    nightsCap: 110,         // Max nights per year
  },

  revenueRealistic: {
    villaADR: 3500,          // Net blended ADR
    villaBaseNights: 95,     // Mature year
    suiteStandardADR: 650,   // ×2 suites
    suiteDoubleADR: 920,     // ×2 suites
    suiteBaseNights: 100,    // All 4 suites same occupancy
    eventsPerYear: 10,
    netProfitPerEvent: 6000,
    ancillaryBaseProfit: 75000,
    ancillaryGrowthRate: 0.10, // +10%/yr from 2028
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
    { ...DEFAULT_VILLA },
    { ...DEFAULT_SUITE },
  ],

  commercialLoan: {
    loanCoverageRate: 0.75,
    interestRate: 0.05,
    gracePeriodYears: 2,
    repaymentTermYears: 13,
    workingCapitalFacility: 400000,
    interest2026: 50625,    // Phase 1 loan only
    interest2027: 110544,   // Progressive build drawdown
    interest2028: 216402,   // Full loan drawn H2
  },

  grant: {
    enabled: false,
    grantRate: 0.60, // 60% of non-plot eligible costs
    interest2026: 50625,
    interest2027: 110544,
    interest2028: 114109,
  },

  rrf: {
    enabled: false,
    rrfShareOfLoan: 0.80,       // 80% of total financing is RRF
    rrfInterestRate: 0.0035,    // 0.35%
    commercialShareRate: 0.20,  // 20% at commercial rate
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

  tepixGuarantee: {
    enabled: false,
    coverageRate: 0.90,
    guaranteeRate: 0.70,
    bankInterestRate: 0.05,
    interestSubsidy: 0.02,
    subsidyDurationYears: 2,
    totalTermYears: 14,
    gracePeriodYears: 2,
    collateralCapRate: 0.30,
    landCapOnFundContribution: 0.10,
  },

  tax: {
    corporateIncomeTaxRate: 0.22,
    netVATRate: 0.07,
  },

  acquisitionLegalPerPlot: 50000,
  financingPath: 'commercial',
};

// Downside stress factors
export const DOWNSIDE_FACTORS = {
  occupancyReduction: 0.10,  // -10% nights
  adrReduction: 0.05,        // -5% ADR
  eventsPerYear: 4,          // vs 10 in realistic
};
