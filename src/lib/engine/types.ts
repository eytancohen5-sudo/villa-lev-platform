// ============================================================
// VILLA LEV GROUP — Financial Engine Types
// ============================================================

export interface PropertyAssumptions {
  name: string;
  landCost: number;
  constructionArea: number; // m²
  constructionCostPerM2: number;
  ffeCost: number;
  legalFees: number;
  architectFees: number;
  civilEngineerFees: number;
  contingencyRate: number; // % of construction + FF&E
}

export interface RevenueAssumptions {
  villaADR: number; // Blended net ADR per night
  villaBaseNights: number; // Mature year nights
  suiteStandardADR: number;
  suiteDoubleADR: number;
  suiteBaseNights: number;
  eventsPerYear: number;
  netProfitPerEvent: number;
  ancillaryBaseProfit: number;
  ancillaryGrowthRate: number; // Annual growth %
}

export interface RampAssumptions {
  year1RampFactor: number; // 2028 — % of mature revenue
  year2RampFactor: number; // 2029 — % of mature revenue
  nightsGrowthPerYear: number;
  nightsCap: number;
}

export interface OpexAssumptions {
  propertyA: {
    housekeeping: number;
    maintenance: number; // Y4+ rate (1.5% of construction)
    utilities: number;
    insurance: number;
    propertyTax: number;
    marketing: number;
    managementFee: number;
    consumables: number;
    accounting: number;
  };
  propertyB: {
    housekeeping: number;
    maintenance: number;
    utilities: number;
    insurance: number;
    propertyTax: number;
    marketing: number;
    managementFee: number;
    consumables: number;
    accounting: number;
  };
}

export interface CommercialLoanParams {
  loanCoverageRate: number; // 75%
  interestRate: number; // 5%
  gracePeriodYears: number; // 2
  repaymentTermYears: number; // 13
  workingCapitalFacility: number; // €400,000
  // Progressive interest during grace
  interest2026: number;
  interest2027: number;
  interest2028: number;
}

export interface GrantParams {
  enabled: boolean;
  grantRate: number; // 60% of non-plot eligible costs
  // Calculated:
  nonPlotEligibleCosts?: number;
  grantAmount?: number;
  remainingLoan?: number;
  equityRequired?: number;
  annualDS?: number;
  interest2026?: number;
  interest2027?: number;
  interest2028?: number;
}

export interface RRFParams {
  enabled: boolean;
  rrfShareOfLoan: number; // 80% of total loan is RRF
  rrfInterestRate: number; // 0.35%
  commercialShareRate: number; // 20% of loan at commercial rate
  commercialInterestRate: number; // 5%
  gracePeriodYears: number; // 2
  repaymentTermYears: number; // 13
  totalLoanDrawn: number; // €4,939,200
  equityRequired: number; // €1,234,800
  annualDS: number; // €439,700
}

export interface TepixLoanFundParams {
  enabled: boolean;
  coverageRate: number;        // 90% — 10% equity
  hdbShareOfLoan: number;      // 40% interest-free from HDB
  bankShareOfLoan: number;     // 60% from partner bank
  bankInterestRate: number;    // 5% indicative
  interestSubsidy: number;     // 2pp — South Aegean verified against HDB
  subsidyDurationYears: number;// 2 — first 2 years from disbursement
  totalTermYears: number;      // 12 total (grace inside)
  gracePeriodYears: number;    // 2 within the 12
}

export interface TepixGuaranteeFundParams {
  enabled: boolean;
  coverageRate: number;        // 90%
  guaranteeRate: number;       // 70% — General Entrepreneurship
  bankInterestRate: number;    // 5%
  interestSubsidy: number;     // 2pp
  subsidyDurationYears: number;// 2
  totalTermYears: number;      // 12
  gracePeriodYears: number;    // 2
  collateralCapRate: number;   // 30% of loan principal (statutory)
}

export type FinancingPath = 'commercial' | 'grant' | 'rrf' | 'tepix-loan' | 'tepix-guarantee';

export interface TaxAssumptions {
  corporateIncomeTaxRate: number; // 22%
  netVATRate: number; // 7% effective
}

export interface ModelAssumptions {
  general: RampAssumptions;
  revenueRealistic: RevenueAssumptions;
  revenueUpside: RevenueAssumptions;
  properties: {
    propertyA: PropertyAssumptions;
    propertyB: PropertyAssumptions;
  };
  opex: OpexAssumptions;
  commercialLoan: CommercialLoanParams;
  grant: GrantParams;
  rrf: RRFParams;
  tepixLoan: TepixLoanFundParams;
  tepixGuarantee: TepixGuaranteeFundParams;
  tax: TaxAssumptions;
  acquisitionLegalPerPlot: number; // €50,000 × 3
  numberOfPropertyA: number; // 2
  financingPath: FinancingPath;
}

// ============================================================
// OUTPUT TYPES
// ============================================================

export interface CapexBreakdown {
  propertyAPerUnit: number;
  propertyATotal: number;
  propertyBTotal: number;
  acquisitionLegal: number;
  portfolioTotal: number;
  categories: {
    name: string;
    propAPerUnit: number;
    propATotal: number;
    propB: number;
    total: number;
  }[];
}

export interface AnnualPnL {
  year: number;
  phase: string;
  villaNightsPerProject: number;
  suiteNightsPerSuite: number;
  revenueA1: number;
  revenueA2: number;
  revenueB: number;
  revenueEvents: number;
  revenueAncillary: number;
  totalRevenue: number;
  opexA1: number;
  opexA2: number;
  opexB: number;
  totalOpex: number;
  ebitda: number;
  ebitdaMargin: number;
  debtService: number;
  netCashFlow: number;
  cumulativeNCF: number;
  vatPayable: number;
  netCashFlowPostVAT: number;
  dscr: number;
}

export interface ScenarioOutput {
  name: string;
  pnl: AnnualPnL[];
  stabilisedYear: AnnualPnL | null;
}

export interface FinancingComparison {
  metric: string;
  commercial: string | number;
  rrf: string | number;
  grant: string | number;
  tepixLoan: string | number;
  tepixGuarantee: string | number;
}

export interface ModelOutput {
  capex: CapexBreakdown;
  scenarios: {
    realistic: ScenarioOutput;
    upside: ScenarioOutput;
    downside: ScenarioOutput;
    breakeven: ScenarioOutput;
  };
  grantScenario: ScenarioOutput; // Same revenue as realistic, different DS
  financingComparison: FinancingComparison[];
  keyMetrics: {
    stabilisedRevenue: number;
    stabilisedEBITDA: number;
    stabilisedEBITDAMargin: number;
    stabilisedDSCR: number;
    stabilisedNCF: number;
    totalCapex: number;
    loanAmount: number;
    equityRequired: number;
    annualDS: number;
    ltv: number;
    assetCoverage: number;
    portfolioValue: number;
    breakEvenNights: number;
    bufferToBreakEven: number;
  };
  dscrByYear: {
    year: number;
    realistic: number;
    upside: number;
    downside: number;
    grant: number;
    tepixLoan: number;
    tepixGuarantee: number;
  }[];
  collateral: {
    builtSurface: number;
    stress: { valuationPerM2: number; value: number; ltv: number; coverage: number };
    market: { valuationPerM2: number; value: number; ltv: number; coverage: number };
    optimistic: { valuationPerM2: number; value: number; ltv: number; coverage: number };
  };
  activeFinancingPath: FinancingPath;
  computeTimeMs: number;
}
