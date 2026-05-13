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
export interface CustomSpace {
  id: string;
  name: string;
  area: number;
}

// One room inside a single villa (e.g. 4 bedrooms × 20m²). The combined
// per-villa area is then multiplied by the template's villaUnits count.
export interface VillaRoom {
  id: string;
  name: string;
  count: number;
  area: number;
}

export interface RoomAreaBreakdown {
  // Accommodation rooms (multiplied by unit count)
  villaUnitArea: number;       // m² per villa unit — used when villaRooms is absent/empty
  standardSuiteArea: number;   // m² per standard suite
  doubleSuiteArea: number;     // m² per double/premium suite
  // Per-villa room breakdown — when present (non-empty), drives villa area
  // instead of villaUnitArea. Total per villa = Σ(count × area).
  villaRooms?: VillaRoom[];
  // Common/shared spaces (fixed per property, not multiplied)
  kitchen: number;             // m² kitchen
  livingRoom: number;          // m² living / lounge area
  utilityRoom: number;         // m² laundry, storage, mechanical
  staffRoom: number;           // m² staff quarters / back-of-house
  corridors: number;           // m² hallways, lobby, circulation
  // User-defined common spaces (counted once per plot)
  customSpaces?: CustomSpace[];
}

// Per-villa interior area: sum of villaRooms when defined, else legacy bulk.
export function computeVillaUnitArea(rooms: RoomAreaBreakdown): number {
  if (rooms.villaRooms && rooms.villaRooms.length > 0) {
    return rooms.villaRooms.reduce((s, r) => s + (r.count || 0) * (r.area || 0), 0);
  }
  return rooms.villaUnitArea || 0;
}

// Compute total construction area from room breakdown + unit counts
export function computeTotalArea(rooms: RoomAreaBreakdown, units: { villaUnits: number; standardSuites: number; doubleSuites: number }): number {
  const accommodationArea =
    units.villaUnits * computeVillaUnitArea(rooms) +
    units.standardSuites * rooms.standardSuiteArea +
    units.doubleSuites * rooms.doubleSuiteArea;
  const commonArea =
    rooms.kitchen +
    rooms.livingRoom +
    rooms.utilityRoom +
    rooms.staffRoom +
    rooms.corridors;
  const customArea = (rooms.customSpaces ?? []).reduce((s, c) => s + (c.area || 0), 0);
  return accommodationArea + commonArea + customArea;
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
  // Cash kept on hand before WC draws are offset by internal funds. When
  // prior-year cumulative cash exceeds this buffer, the surplus replaces the
  // seasonal draw 1-for-1 (a fully-cashed company stops drawing the revolver).
  internalCashBuffer: number;
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

// ── OpCo / PropCo Split ──
// Optional management company structure. When enabled, OpCo fees are
// deducted from EBITDA so all downstream PropCo metrics (NCF, DSCR, IRR)
// reflect the post-fee return to the asset owner.
//
//   baseFee       = baseFeeRate × Total Revenue
//   brandFee      = brandFeeRate × Room Revenue (property revenue, no events/ancillary)
//   incentiveFee  = incentiveFeeRate × max(0, GOP − baseFee − brandFee − priorityReturn)
//   priorityReturn = ownerPriorityReturnRate × initial equity
//
// GOP for this model ≈ EBITDA before OpCo fees.
export interface OpCoFeeParams {
  enabled: boolean;
  baseFeeRate: number;
  brandFeeRate: number;
  incentiveFeeRate: number;
  ownerPriorityReturnRate: number;
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
  opCoFee: OpCoFeeParams;
  workingCapital: WorkingCapitalParams;
  // Multiple applied to EBITDA at the exit year to produce a terminal asset
  // value for IRR calculations. e.g. 10 means terminal value = 10 × exit EBITDA.
  exitEbitdaMultiple: number;
  // Year the asset is sold. IRR / MOIC / equity payback all truncate to this
  // year; terminal asset value uses the year's EBITDA × exitEbitdaMultiple.
  // Allowed range 2029–2040 (must be ≥ stabilised year and ≤ last modeled year).
  exitYear: number;
  // DSCR threshold below which a year fails the lender's covenant test.
  // Greek/EU commercial real estate loans typically carry 1.20–1.30. Surfaced
  // on the Coverage sheet of the BP export with a Pass/Fail row.
  dscrCovenantThreshold: number;
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
  // EBITDA before OpCo management fees — i.e. GOP available to be split
  // between owner and manager. Equals `ebitda` when OpCo fees are disabled.
  ebitdaPreOpCo: number;
  // OpCo fee breakdown for the year. All zero when OpCo split is disabled.
  opCoBaseFee: number;
  opCoBrandFee: number;
  opCoIncentiveFee: number;
  opCoTotalFee: number;
  // PropCo EBITDA — net of OpCo fees. All downstream PropCo metrics
  // (DSCR, ICR, NCF, IRR, yield) flow from this.
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
  // Annual cash-on-cash yield: netCashFlowPostVAT / initial equity required for
  // the active financing path. Zero before operations and when equity is zero.
  yieldOnInitialEquity: number;
  // Running sum of yieldOnInitialEquity through this year. Final-year value is
  // the projection-wide cumulative yield (multiple of initial equity returned).
  cumulativeYieldOnInitialEquity: number;
  // Term-loan amortisation breakdown for the active financing path. Interest-
  // only during the grace period; full amortisation thereafter.
  termLoanInterest: number;
  termLoanPrincipal: number;
  termLoanBalance: number;       // closing balance for the year
  // EBITDA / interest-only term loan service. Zero before interest accrues.
  interestCoverageRatio: number;
  // Cash flow available for debt service. CFADS ≈ EBITDA + CIT (CIT stored
  // negative). Used as numerator in LLCR/PLCR and as unlevered FCF for
  // project IRR.
  cfads: number;
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
  // Aggregated bank-underwriting metrics for the active path under this scenario
  llcr: number;                       // Loan Life Coverage Ratio
  plcr: number;                       // Project Life Coverage Ratio
  icrStabilised: number;              // EBITDA / interest, stabilised year
  minDSCRLoanLife: number;            // min DSCR across operational years (≥2029)
  dscrCovenantHeadroom: number;       // (minDSCR - 1.25) / 1.25
  peakDebtOutstanding: number;        // max(termLoanBalance + wcPeakBalance)
  gracePeriodInterestTotal: number;   // sum of interest paid 2026+2027+2028
  netLeverage: number;                // loan / stabilised EBITDA
  // Returns
  yieldStabilised: number;            // yieldOnInitialEquity at stabilised year
  cumulativeYieldFinal: number;       // cumulative yield at end of projection
  // Total MOIC INCLUDING the exit lump sum:
  //   numerator = Σ NCF post-tax post-DS over the truncated window + terminalEquityValue
  //   denominator = initial equity required
  // Distinct from cumulativeYieldFinal which is operating distributions only.
  totalMOIC: number;
  equityPaybackYears: number | null;  // first year cum yield ≥ 100%, else null
  equityIRR: number;                  // levered IRR with terminal equity value
  // Pre-split equity IRR — ignores OpCo fees. Equals `equityIRR` when OpCo
  // split is disabled. Lets the dashboard show the cost of splitting.
  equityIRRPreOpCo: number;
  // Total OpCo earnings in the stabilised year (base + brand + incentive).
  opCoStabilisedFee: number;
  projectIRR: number;                 // unlevered IRR with terminal asset value
  roic: number;                       // (EBITDA + CIT) / total CapEx, stabilised
  terminalAssetValue: number;         // EBITDA at exit year × exit multiple
  terminalEquityValue: number;        // terminal asset value − loan balance at exit
  exitEbitdaMultiple: number;         // multiple applied to EBITDA at exit
  exitYear: number;                   // year used as the exit (truncates IRR window)
}

// Stable identifier for each comparison row, locale-independent. Add cases
// here when new rows land in computeFinancingComparison.
export type FinancingMetricKey =
  | 'totalLoanDrawn'
  | 'grantReceived'
  | 'equityRequired'
  | 'annualDebtService'
  | 'stabilisedDSCR'
  | 'supplementaryLoan'
  | 'equitySavingVsCommercial';

export interface FinancingComparison {
  // Locale-independent identifier — use this for any conditional logic.
  key: FinancingMetricKey;
  // Localised, human-readable label for the row.
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
