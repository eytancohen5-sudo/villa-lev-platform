// ============================================================
// VILLA LEV GROUP — Financial Engine Types
// ============================================================

// ── Property Configuration (dynamic portfolio) ──

export interface PropertyOpex {
  housekeeping: number;
  /** @deprecated — engine does not read this field; replaced by ffeReserveFloor + revenue % schedule. */
  maintenance?: number;
  utilities: number;
  insurance: number;
  propertyTax: number;
  marketing: number;
  /** @deprecated — removed from OpEx sum; retained for Firestore backward-compatibility. */
  managementFee?: number;
  consumables: number;
  accounting: number;
  /** FF&E Reserve floor per plot (EUR/year). Engine computes max(ffeReserveFloor, rate% × revenue).
   *  Rates: 0% in Y1 of ops (2028, floor only), 2% (2029), 3% (2030), 4%+ thereafter. */
  ffeReserveFloor?: number;
}

// Per-room-type area breakdown (m²)
export interface CustomSpace {
  id: string;
  name: string;
  area: number;
}

// User-defined extra OPEX line (annual running cost, EUR/yr)
export interface CustomLine {
  id: string;
  name: string;
  value: number;
}

// User-defined extra CAPEX line (one-off capital cost, EUR)
export interface CustomCapexLine {
  id: string;
  name: string;
  cost: number;
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
  opexContingencyRate?: number; // % buffer on controllable OPEX only (0 = no buffer)
  // OPEX parameters
  opex: PropertyOpex;
  // User-defined extra annual OPEX lines (fold into P&L opex)
  extraOpexLines?: CustomLine[];
  // User-defined extra one-off CAPEX lines (fold into capex totals and export)
  extraCapexLines?: CustomCapexLine[];
  // Keys & Bedrooms topology (display layer only — does not affect CAPEX/OPEX/revenue)
  bedroomsPerStandard?: number; // default 1
  bedroomsPerDouble?:   number; // default 2
  bedroomsInMain?:      number; // default 4
  lockableSubUnits?:    number; // default 3
  bedroomsPerSubUnit?:  number; // default 1
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
  opexContingencyRate?: number; // % buffer on controllable OPEX only (0 = no buffer)
  // OPEX parameters
  opex: PropertyOpex;
  // User-defined extra annual OPEX lines (fold into P&L opex)
  extraOpexLines?: CustomLine[];
  // User-defined extra one-off CAPEX lines (fold into capex totals and export)
  extraCapexLines?: CustomCapexLine[];
  // Keys & Bedrooms topology (display layer only — does not affect CAPEX/OPEX/revenue)
  bedroomsPerStandard?: number; // default 1
  bedroomsPerDouble?:   number; // default 2
  bedroomsInMain?:      number; // default 4
  lockableSubUnits?:    number; // default 3
  bedroomsPerSubUnit?:  number; // default 1
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

export interface DSRAParams {
  enabled: boolean;
  targetDSCR: number;          // coverage threshold that triggers drawdown (default 1.25)
  sweep2028Pct: number;        // fraction 0–1 of 2028 post-tax NCF swept (default 1.0)
  replenishmentPriority: number; // fraction 0–1 of post-DS surplus used to replenish (default 1.0)
  partnerRepaymentThreshold: number; // consecutive stable years before partner repayment (default 2)
}

// ── Financing Parameters ──

export interface CommercialLoanParams {
  loanCoverageRate: number;
  interestRate: number;
  // Currently inert in engine getDS closures — actual grace boundary is PROJECT_CONSTANTS.GRACE_END_YEAR
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
  coverageRate: number;         // fraction of total CAPEX financed (e.g. 0.80)
  rrfShareOfLoan: number;       // fraction of that loan from EU RRF funds (e.g. 0.80)
  rrfInterestRate: number;
  commercialShareRate: number;
  commercialInterestRate: number;
  // Currently inert in engine getDS closures — actual grace boundary is PROJECT_CONSTANTS.GRACE_END_YEAR
  gracePeriodYears: number;
  repaymentTermYears: number;
  // Legacy fields kept for backward-compat with stored Firestore data.
  // The engine now derives loan / equity from CAPEX × coverageRate.
  totalLoanDrawn?: number;
  equityRequired?: number;
  annualDS?: number;
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
  // Currently inert in engine getDS closures — actual grace boundary is PROJECT_CONSTANTS.GRACE_END_YEAR
  gracePeriodYears: number;
  landCapOnFundContribution: number;
}

export type FinancingPath = 'commercial' | 'grant' | 'rrf' | 'tepix-loan';

export interface TaxAssumptions {
  corporateIncomeTaxRate: number;
  netVATRate: number;
  otaCommissionRate: number;
}

// ── OpCo / PropCo Split ──
// Optional management company structure. When enabled, OpCo fees are
// deducted from EBITDA so all downstream PropCo metrics (NCF, DSCR, IRR)
// reflect the post-fee return to the asset owner.
//
//   Bucket 2A: baseMgmtFee  = baseMgmtFeeRate × Total Revenue   (5% gross revenue)
//   Bucket 2B: incentiveFee = incentiveFeeRate × max(0, GOP − baseMgmtFee − priorityReturn)
//   priorityReturn          = ownerPriorityReturnRate × initial equity
//
// GOP for this model ≈ EBITDA before OpCo fees.
export interface OpCoFeeParams {
  enabled: boolean;
  /** Bucket 2A: 5% of gross revenue (replaces baseFeeRate + brandFeeRate) */
  baseMgmtFeeRate: number;
  /** @deprecated Merged into baseMgmtFeeRate. Kept for Firestore backward-compat. */
  baseFeeRate?: number;
  /** @deprecated Merged into baseMgmtFeeRate. Kept for Firestore backward-compat. */
  brandFeeRate?: number;
  /** Bucket 2B: 10% of GOP above hurdle */
  incentiveFeeRate: number;
  ownerPriorityReturnRate: number;
  /**
   * Shareholder floor — minimum fraction of residual NCF (after DS) that must
   * remain for equity distributions BEFORE any incentive fee is paid.
   * e.g. 0.50 → incentive fee ≤ 50% of residual; shareholders always keep ≥ 50%.
   * Only applied in bank view when OpCo split is enabled.
   * Default: 0.50.
   */
  shareholderMinResidualShare?: number;
  /**
   * Annual cap on total OpCo fee income (base + incentive combined).
   * This is the fee PropCo pays to OpCo — NOT the founder's personal draw.
   * e.g. 180_000 → PropCo pays OpCo at most €180K/yr regardless of revenue.
   * Optional so old saved scenarios deserialise cleanly (treated as Infinity).
   */
  opcoAnnualFeeCap?: number;
  /** Tiered junior rate applied to post-DS residual up to threshold. Default 0.10. */
  juniorTier1Rate?: number;
  /** Tiered junior rate applied to post-DS residual above threshold. Default 0.15. */
  juniorTier2Rate?: number;
  /** Residual breakpoint (€) between Tier 1 and Tier 2. Default 500_000. */
  juniorResidualThreshold?: number;
}

// Bank-view structural floor for the OpCo management fee. Under the
// OpCo / PropCo split, OpCo bills a portfolio-level minimum that is paid
// SENIOR to debt service (lives inside OpEx, hits DSCR). Any OpCo billing
// above this floor is JUNIOR — paid only out of residual cash after debt
// service, so it cannot starve the bank. Bank view replaces the per-villa
// `managementFee` lines with this single floor + a junior tranche; internal
// view keeps the legacy per-villa fees unchanged.
//
// Internal view = legacy / admin (per-villa managementFee in OpEx).
// Bank view     = floor at the portfolio level + subordinated overage.

// ── Portfolio OPEX (undistributed shared overhead) ──

export interface StaffRole {
  name: string;
  monthlyGross: number;
  monthsPaid: number;       // 14 for year-round (Greek rule); seasonalMonths for seasonal
  burdenMultiplier: number; // default 1.32 (employer EFKA + severance accrual)
  allowances: number;       // annual food/transport allowance €
  yearRound: boolean;
  seasonalMonths?: number;  // used only if yearRound === false
  headcount?: number;       // used only if yearRound === false, default 1
}

export interface SharedServiceLine {
  name: string;
  sizingBasis: string;  // read-only display label
  annualCost: number;
}

export interface PortfolioOpex {
  staffRoles: StaffRole[];
  sharedServices: SharedServiceLine[];
  sharedOverhead: SharedServiceLine[];
  preOpeningTotal: number;
  preOpeningAmortYears: number;
  preOpeningStartYear: number;
  includePreOpeningInStabilised: boolean;
  // Pool configuration — drives Pool R&M annualCost automatically
  poolCount: number;        // default 17; user-editable
  poolCostPerUnit: number;  // €/pool/year materials+service, labour in-house; default 1500
  inflationHook: number;    // 0.0 — engine-inert hook for future escalator
}

export interface PortfolioOpexOutput {
  staffTotal: number;
  servicesTotal: number;
  overheadTotal: number;
  preOpeningAmort: number;
  total: number;
  yearRoundFixed: number; // staffTotal + overheadTotal — bank "fixed cost spine"
  variable: number;       // servicesTotal
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
  /** Annual developer management fee during construction (2026–2027). Capitalized as CAPEX soft cost. */
  developerConstructionFeePerYear?: number;
  financingPath: FinancingPath;
  opCoFee: OpCoFeeParams;
  // Minimum annual management fee paid SENIOR to debt service in bank view
  // (lives inside OpEx, hits DSCR). OpCo billing above this floor is
  // subordinated to debt service. Bank view replaces the per-villa
  // managementFee lines with this floor + the junior overage; internal
  // view ignores it. See cash-waterfall block in `computePnLYear` (model.ts).
  opCoSeniorFloor: number;
  workingCapital: WorkingCapitalParams;
  portfolioOpex?: PortfolioOpex;
  // Multiple applied to EBITDA at the exit year to produce a terminal asset
  // value for IRR calculations. e.g. 10 means terminal value = 10 × exit EBITDA.
  // Floored at 4× in the UI but otherwise uncapped — sponsor can model an
  // aggressive ceiling without the input silently clamping.
  exitEbitdaMultiple: number;
  // Year the asset is sold. IRR / MOIC / equity payback all truncate to this
  // year; terminal asset value uses the year's EBITDA × exitEbitdaMultiple.
  // Allowed range 2029–2040 (must be ≥ stabilised year and ≤ last modeled year).
  exitYear: number;
  // Parallel exit-valuation path: instead of EBITDA × multiple, value the
  // built surface as raw real estate at €/m². Drives `terminalAssetValuePropertySale`
  // / `equityIRRPropertySale` in the keyMetrics so the sponsor can compare
  // "sell the operating hotel" vs "sell the underlying property" side by side.
  // Defaults to 9 000 (matches the `collateral.market` mid tier).
  exitValuationPerM2?: number;
  // DSCR threshold below which a year fails the lender's covenant test.
  // Greek/EU commercial real estate loans typically carry 1.20–1.30. Surfaced
  // on the Coverage sheet of the BP export with a Pass/Fail row.
  dscrCovenantThreshold: number;
  dsra?: DSRAParams;
  /** FF&E Reserve rate schedule. Engine applies max(floor, rate × revenue/unit) per year.
   *  Year 2028 (opening): floor only (rate 0). Years 2029+: ramp by schedule below. */
  ffeSchedule?: {
    rate2029: number;       // first operational year — default 0.02
    rate2030: number;       // second operational year — default 0.03
    rateStabilised: number; // stabilised (2031+) — default 0.04
  };
  // Toggle between two cash-waterfall structures inside `computePnLYear`.
  //  - 'internal' (default): legacy/admin view. OpCo paid in full; DSCR /
  //    NCF / CFADS / taxableProfit reflect EBITDA *after* the full OpCo fee
  //    is subtracted (i.e. OpCo is senior to debt service).
  //  - 'bank': what bankers underwrite. OpCo is subordinated to debt
  //    service — paid only out of residual cash after DS; DSCR uses
  //    ebitdaPreOpCo / DS so management fees can't crowd out lenders.
  // Default is 'internal' to preserve historical numbers on /admin/*.
  // Investor / pitch routes and the View-As-Banker impersonation override
  // this to 'bank' at the call site, not via the global defaults.
  viewMode?: 'internal' | 'bank';
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
  /** FF&E Reserve component within opexPerUnit — max(floor, rate% × revenue/unit). */
  ffeReservePerUnit: number;
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
  // Gross (pre-cap) total fee — populated when opcoAnnualFeeCap is set.
  // Used for IRR add-back so the pre-split IRR correctly adds back the
  // uncapped fee, not the capped amount. Equals opCoTotalFee when no cap binds.
  opCoTotalFeeRaw?: number;
  // Bank view only: senior portion of the OpCo fee paid inside OpEx
  // (= `opCoSeniorFloor`). Junior tranche = opCoTotalFee − opCoSeniorPaid.
  // Zero in internal view (no floor concept there).
  opCoSeniorPaid: number;
  // Junior tranche of OpCo fee paid out of post-DS residual (tiered formula).
  // Zero when OpCo split is disabled or residual is insufficient.
  opCoJuniorPaid: number;
  // PropCo EBITDA — net of OpCo fees. All downstream PropCo metrics
  // (DSCR, ICR, NCF, IRR, yield) flow from this.
  grossRevenue: number;       // totalRevenue / (1 - otaCommissionRate) — guest-facing
  otaCommissions: number;     // grossRevenue × otaCommissionRate (negative — outflow)
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
  // ── Portfolio-level (undistributed) OPEX — optional; zero/absent for pre-operational years ──
  portfolioOpex?: PortfolioOpexOutput;
  // ── DSRA (Debt Service Reserve Account) ──
  dsraDraw?: number;          // amount drawn from DSRA balance this year (≥0)
  dsraReplenishment?: number; // amount replenished into DSRA this year (≥0)
  dsraBalance?: number;       // DSRA end-of-period balance
  effectiveDSCR?: number;     // (CFADS + dsraDraw) / DS — equals dscr when DSRA disabled
  partnerRepayment?: number;  // subordinated partner advance repaid this year (≥0)
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
  avgDSCRLoanLife: number;            // average DSCR across operational years (≥2029)
  dscrCovenantHeadroom: number;       // (avgDSCR - 1.25) / 1.25
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
  // True when the asset value at exit cannot cover the remaining debt
  // balance, i.e. equity holders walk away with €0. Surfaced as a warning
  // badge on the dashboard so an investor doesn't silently see equity IRR
  // crater without context.
  terminalUnderwater: boolean;
  exitEbitdaMultiple: number;         // multiple applied to EBITDA at exit
  exitYear: number;                   // year used as the exit (truncates IRR window)
  // ── Property-sale (real-estate) exit path ──
  // Parallel valuation: builtSurface × exitValuationPerM2. Computed alongside
  // the EBITDA-multiple path so the UI can display two exit-IRR scenarios:
  // "sell the operating hotel" vs "sell the underlying property". The path
  // with the higher terminal asset value drives the actual sale economics —
  // a rational seller picks whichever exit is worth more.
  exitValuationPerM2: number;         // €/m² used in the property-sale path
  terminalAssetValuePropertySale: number;
  terminalEquityValuePropertySale: number;
  equityIRRPropertySale: number;      // IRR with property-sale exit
  projectIRRPropertySale: number;     // unlevered IRR with property-sale exit
  totalMOICPropertySale: number;      // (Σ NCF + terminal equity property) / equity
  // True when property-sale path > hotel-sale path at exit, i.e. the
  // sponsor would rationally elect to sell the real estate rather than the
  // operating hotel. Computed on TERMINAL ASSET value (gross), not equity.
  propertyExitDominates: boolean;
  // ── DSRA scenario-level summary ──
  dsraTarget?: number;         // DSRA_target = max worst-year shortfall
  dsraSweep2028?: number;      // sweep from 2028 NCF
  dsraPartnerAdvance?: number; // partner_advance = max(0, dsraTarget - dsraSweep2028)
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
  | 'equitySavingVsCommercial'
  | 'dsraTarget'
  | 'effectiveDSCRStabilised';

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
  rrfScenario: ScenarioOutput;
  commercialScenario: ScenarioOutput;
  tepixLoanScenario: ScenarioOutput;
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
    // TEPIX III €8M program-cap binding amount. 0 unless the active path
    // is tepix-loan AND the unconstrained primary loan exceeded 8M. When
    // >0, the excess has been routed to commercial supplementary debt +
    // sponsor equity via the engine's landGap + nonLandCost residual
    // logic. Surfaced for the dashboard / investor page so the equity
    // gap created by the cap can be called out explicitly.
    tepixCapBindingBy: number;
    // The cap value used (8_000_000 per HDB program rules). 0 on
    // non-tepix paths. Surfaced for UI tooltips.
    tepixLoanCap: number;
    grantAmount: number;
  };
  dscrByYear: {
    year: number;
    realistic: number;
    upside: number;
    downside: number;
    grant: number;
    tepixLoan: number;
    // Effective DSCR (incl. DSRA drawdown) per path — populated when dsra.enabled
    effectiveRealistic?: number;
    effectiveUpside?: number;
    effectiveDownside?: number;
    effectiveGrant?: number;
    effectiveTepixLoan?: number;
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
