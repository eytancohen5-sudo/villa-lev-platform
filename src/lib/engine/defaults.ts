// ============================================================
// VILLA LEV GROUP — Default Assumptions (from Excel BP v4)
// ============================================================

import { ModelAssumptions } from './types';

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

  properties: {
    propertyA: {
      name: 'Property A — Twin Villas',
      landCost: 400000,
      constructionArea: 350,
      constructionCostPerM2: 4000,
      ffeCost: 120000,
      legalFees: 20000,
      architectFees: 44000,
      civilEngineerFees: 35000,
      contingencyRate: 0.10,
    },
    propertyB: {
      name: 'Property B — Boutique Suites',
      landCost: 400000,
      constructionArea: 250,
      constructionCostPerM2: 4000,
      ffeCost: 100000,
      legalFees: 15000,
      architectFees: 32000,
      civilEngineerFees: 25000,
      contingencyRate: 0.10,
    },
  },

  opex: {
    propertyA: {
      housekeeping: 15000,
      maintenance: 21000,  // Y4+ at 1.5% of construction
      utilities: 12000,
      insurance: 2500,
      propertyTax: 4000,
      marketing: 4000,
      managementFee: 20000,
      consumables: 5000,
      accounting: 7000,
    },
    propertyB: {
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

  tax: {
    corporateIncomeTaxRate: 0.22,
    netVATRate: 0.07,
  },

  acquisitionLegalPerPlot: 50000,
  numberOfPropertyA: 2,
  financingPath: 'commercial',
};

// Downside stress factors
export const DOWNSIDE_FACTORS = {
  occupancyReduction: 0.10,  // -10% nights
  adrReduction: 0.05,        // -5% ADR
  eventsPerYear: 4,          // vs 10 in realistic
};
