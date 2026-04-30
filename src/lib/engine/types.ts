// ============================================================
// VILLA LEV GROUP — Financial Engine Types
// ============================================================

// ── Property Configuration (dynamic portfolio) ──

export interface PropertyOpex {
  housekeeping: number;
  maintenance: number;
  utilities: number;
  insurance: number;
  propertyTax: number;
  marketing: number;
  managementFee: number;
  consumables: number;
  accounting: number;
}

// Per-room-type area breakdown (m²)
export interface RoomAreaBreakdown {
  // Accommodation rooms (multiplied by unit count)
  villaUnitArea: number;       // m² per villa unit (bedroom + ensuite)
  standardSuiteArea: number;   // m² per standard suite
  doubleSuiteArea: number;     // m² per double/premium suite
  // Common/shared spaces (fixed per property, not multiplied)
  kitchen: number;             // m² kitchen
  livingRoom: number;          // m² living / lounge area
  utilityRoom: number;         // m² laundry, storage, mechanical
  staffRoom: number;           // m² staff quarters / back-of-house
  corridors: number;           // m² hallways, lobby, circulation
  outdoor: number;             // m² terrace, pool deck, covered outdoor
}

// Compute total construction area from room breakdown + unit counts
export function computeTotalArea(rooms: RoomAreaBreakdown, units: { villaUnits: number; standardSuites: number; doubleSuites: number }): number {
  const accommodationArea =
    units.villaUnits * rooms.villaUnitArea +
    units.standardSuites * rooms.standardSuiteArea +
    units.doubleSuites * rooms.doubleSuiteArea;
  const commonArea =
    rooms.kitchen +
    rooms.livingRoom +
    rooms.utilityRoom +
    rooms.staffRoom +
    rooms.corridors +
    rooms.outdoor;
  return accommodationArea + commonArea;
}

// Unit mix: each property can combine villas + hotel rooms
export interface PropertyConfig {
  id: string;
  name: string;
  // Unit mix (per property plot)
  villaUnits: number;      // villa-type accommodation units
  standardSuites: number;  // standard hotel rooms
  doubleSuites: number;    // double/premium hotel rooms
  count: number;           // how many plots of this type
  // Room areas (m²)
  roomAreas: RoomAreaBreakdown;
  // CAPEX parameters
  landCost: number;
  constructionArea: number; // m² — computed from roomAreas, kept for backward compat
  constructionCostPerM2: number;
  ffeCost: number;
  legalFees: number;
  architectFees: number;
  civilEngineerFees: number;
  contingencyRate: number; // % of construction + FF&E
  // OPEX parameters
  opex: PropertyOpex;
}

// Helper: derive display type from unit mix
export type PropertyDisplayType = 'villa' | 'suite' | 'mixed';

export function getPropertyDisplayType(p: { villaUnits: number; standardSuites: number; doubleSuites: number }): PropertyDisplayType {
  const hasVilla = p.villaUnits > 0;
  const hasSuite = (p.standardSuites + p.doubleSuites) > 0;
  if (hasVilla && hasSuite) return 'mixed';
  if (hasVilla) return 'villa';
  return 'suite';
}

// ── Templates & Projects (UI layer) ──

export interface PropertyTemplate {
  id: string;
  name: string;
  builtIn?: boolean;
  // Unit mix
  villaUnits: number;
  standardSuites: number;
  doubleSuites: number;
  // Room areas (m²)
  roomAreas: RoomAreaBreakdown;
  // CAPEX parameters
  landCost: number;
  constructionArea: number; // computed from roomAreas — kept for display
  constructionCostPerM2: number;
  ffeCost: number;
  legalFees: number;
  architectFees: number;
  civilEngineerFees: number;
  contingencyRate: number;
  // OPEX parameters
  opex: PropertyOpex;
}

export interface ProjectAllocation {
  id: string;
  templateId: string;
  name: string;
  count: number;
}

// ── Revenue & Ramp ──

export interface RevenueAssumptions {
  villaADR: number;
  villaBaseNights: number;
  suiteStandardADR: number;
  suiteDoubleADR: number;
  suiteBaseNights: number;
  eventsPerYear: number;
  netProfitPerEvent: number;
  ancillaryBaseProfit: number;
  ancillaryGrowthRate: number;
  // Number of years from 2028 over which ancillaryGrowthRate compounds.
  // After 2028 + ancillaryGrowthYears, ancillary revenue stays flat at the
  // capped value. 0 disables compounding entirely; a large value (>=10)
  // restores the original "grow forever" behavior across the projection.
  ancillaryGrowthYears: number;
}

export interface RampAssumptions {
  year1RampFactor: number;
  year2RampFactor: number;
  nightsGrowthPerYear: number;
  nightsCap: number;
}

// ── Working Capital ──
// Revolving facility sized to cover pre-opening costs and seasonal cash gaps.
// Modeled at quarterly granularity inside the engine; surfaced as annual peak /
// trough / average / interest expense on AnnualPnL.

export interface WorkingCapitalParams {
  active: boolean;
  facilitySize: number;
  // Spread above the term-loan rate, in decimal (0.01 = 100 bps).
  spreadOverTermRate: number;
  // Pre-opening total drawn over Q3-2027 → Q2-2028 (4 equal quarterly slugs).
  preOpeningTotalDraw: number;
  // Drawn each Q4 of an operational year, repaid the following Q3.
  seasonalDrawPerCycle: number;
  // Additional one-shot top-up drawn alongside the Q4-2028 seasonal cycle.
  y2RampBufferTopup: number;
  // True: each Q3 (peak-season end) repays the outstanding balance.
  selfLiquidating: boolean;
  // If true, lock `dsraLockAmount` of the facility as a formal DSRA escrow,
  // reducing the effective revolver headroom.
  dsraConversionEnabled: boolean;
  dsraLockAmount: number;
}

// ── Financing Parameters ──

export interface CommercialLoanParams {
  loanCoverageRate: number;
  interestRate: number;
  gracePeriodYears: number;
  repaymentTermYears: number;
  workingCapitalFacility: number;
  interest2026: number;
  interest2027: number;
  interest2028: number;
}

export interface GrantParams {
  enabled: boolean;
  grantRate: number;
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
  rrfShareOfLoan: number;
  rrfInterestRate: number;
  commercialShareRate: number;
  commercialInterestRate: number;
  gracePeriodYears: number;
  repaymentTermYears: number;
  totalLoanDrawn: number;
  equityRequired: number;
  annualDS: number;
}

export interface TepixLoanFundParams {
  enabled: boolean;
  coverageRate: number;
  hdbShareOfLoan: number;
  bankShareOfLoan: number;
  bankInterestRate: number;
  interestSubsidy: number;
  subsidyDurationYears: number;
  totalTermYears: number;
  gracePeriodYears: number;
  landCapOnFundContribution: number;
}

export type FinancingPath = 'commercial' | 'grant' | 'rrf' | 'tepix-loan';

export interface TaxAssumptions {
  corporateIncomeTaxRate: number;
  netVATRate: number;
}

// ── Model Input ──

export interface ModelAssumptions {
  general: RampAssumptions;
  revenueRealistic: RevenueAssumptions;
  revenueUpside: RevenueAssumptions;
  portfolio: PropertyConfig[];
  commercialLoan: CommercialLoanParams;
  grant: GrantParams;
  rrf: RRFParams;
  tepixLoan: TepixLoanFundParams;
  tax: TaxAssumptions;
  acquisitionLegalPerPlot: number;
  financingPath: FinancingPath;
  workingCapital: WorkingCapitalParams;
}

// ============================================================
// OUTPUT TYPES
// ============================================================

export interface CapexPropertyLine {
  id: string;
  name: string;
  count: number;
  perUnit: number;
  total: number;
}

export interface CapexBreakdown {
  properties: CapexPropertyLine[];
  acquisitionLegal: number;
  portfolioTotal: number;
  totalPlots: number;
  categories: {
    name: string;
    perProperty: { id: string; perUnit: number; total: number }[];
    grandTotal: number;
  }[];
}

export interface PropertyPnLLine {
  id: string;
  name: string;
  displayType: PropertyDisplayType;
  villaUnits: number;
  standardSuites: number;
  doubleSuites: number;
  count: number;
  revenuePerUnit: number;
  totalRevenue: number;
  opexPerUnit: number;
  totalOpex: number;
}

export interface AnnualPnL {
  year: number;
  phase: string;
  villaNights: number;
  suiteNights: number;
  propertyBreakdown: PropertyPnLLine[];
  revenueEvents: number;
  revenueAncillary: number;
  // True for years where the ancillary growth cap has flattened the trajectory
  // (i.e. year - 2028 >= ancillaryGrowthYears, with growth rate > 0).
  revenueAncillaryCapped: boolean;
  totalRevenue: number;
  totalOpex: number;
  ebitda: number;
  ebitdaMargin: number;
  debtService: number;
  netCashFlow: number;
  cumulativeNCF: number;
  vatPayable: number;
  citPayable: number;
  // Profit after corporate income tax: NCF (= EBITDA − Debt Service) + CIT.
  // Excludes VAT, which is a balance-sheet pass-through, not an income expense.
  profitAfterTax: number;
  netCashFlowPostVAT: number;
  dscr: number;
  // ── Working Capital (quarterly compute, annual aggregates) ──
  wcAvgBalance: number;
  wcPeakBalance: number;
  wcTroughBalance: number;
  wcInterestExpense: number;
  // drawsTotal − repaymentsTotal (positive = net cash drawn IN this year).
  wcNetContribution: number;
  // True when the trough quarter ends above the self-liquidating threshold.
  wcSelfLiquidatingViolation: boolean;
  // Fully-loaded DSCR: EBITDA / (term-DS + WC interest). Same numerator as
  // headline DSCR; larger denominator. Equals headline DSCR when WC inactive.
  dscrLoaded: number;
}

export interface WorkingCapitalQuarter {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  openingBalance: number;
  draws: number;
  repayments: number;
  closingBalance: number;
  interestAccrual: number;
}

export interface ScenarioOutput {
  name: string;
  pnl: AnnualPnL[];
  stabilisedYear: AnnualPnL | null;
  wcQuarters: WorkingCapitalQuarter[];
  wcEffectiveFacility: number;
  wcRate: number;
}

export interface FinancingComparison {
  metric: string;
  commercial: string | number;
  rrf: string | number;
  grant: string | number;
  tepixLoan: string | number;
}

export interface ModelOutput {
  capex: CapexBreakdown;
  scenarios: {
    realistic: ScenarioOutput;
    upside: ScenarioOutput;
    downside: ScenarioOutput;
    breakeven: ScenarioOutput;
  };
  grantScenario: ScenarioOutput;
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
    primaryLoan: number;
    supplementaryLoan: number;
    landFundedByTepix: number;
    landFundedByCommercial: number;
  };
  dscrByYear: {
    year: number;
    realistic: number;
    upside: number;
    downside: number;
    grant: number;
    tepixLoan: number;
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
