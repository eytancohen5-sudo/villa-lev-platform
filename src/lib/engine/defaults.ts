// ============================================================
// VILLA LEV GROUP — Default Assumptions (from Excel BP v4)
// ============================================================

// Default EBITDA multiple for terminal-value calc in equity / project IRR.
// Editable via assumptions. 10× ≈ 10% implied cap rate.
export const DEFAULT_EXIT_EBITDA_MULTIPLE = 10;

export const PROJECT_CONSTANTS = {
  /** First year of the modeled horizon. Phase: land acquisition. */
  HORIZON_START_YEAR: 2026,
  /**
   * Deprecated: grace boundary is now computed per path as
   * HORIZON_START_YEAR + gracePeriodYears (ADR-0009). This alias
   * (= HORIZON_START_YEAR + 2) is kept for any residual call sites
   * outside getDS. Do not use for new code.
   */
  GRACE_END_YEAR: 2028,
  /**
   * Opening year — partial season at year1RampFactor.
   * OPENING_YEAR = GRACE_END_YEAR (construction completes end of 2028, villa opens).
   * Used as the base for ancillary growth accumulation.
   */
  OPENING_YEAR: 2028,
  /** First full ramp year (post-opening, year2RampFactor applies). */
  FIRST_OPERATIONAL_YEAR: 2029,
  /** Stabilised year — DSCR, EBITDA, and LCR metrics anchor here. */
  STABILISED_YEAR: 2031,
  /** Last year of the modeled horizon (11-year projection: 2026–2036). */
  HORIZON_END_YEAR: 2036,
  /**
   * Earliest permitted exit year — clamp lower bound for the exit-year slider.
   * NOTE: same numeric value as NIGHTS_GROWTH_BASE_YEAR today but represents a
   * different business concept. Change independently if the exit policy shifts.
   */
  MIN_EXIT_YEAR: 2030,
  /**
   * Base year for nights-growth accumulation in computeNights.
   * Growth compounds from this year forward.
   * NOTE: same numeric value as MIN_EXIT_YEAR today but represents a different
   * concept. Change independently if the construction ramp shifts.
   */
  NIGHTS_GROWTH_BASE_YEAR: 2030,
  /**
   * TEPIX III program ceiling per business (HDB program rules).
   * Source: tepix/milestones.yaml meta.program.loan_amount_range_eur.max
   * Update this constant and milestones.yaml together.
   */
  TEPIX_LOAN_CAP_EUR: 8_000_000,
  /**
   * First-tranche capital deployment: land acquisition + permit prep.
   * Drives the phase-1 loan drawdown in computeDebtService and the drawdown
   * bar in pitch/page.tsx.
   * SYNC: model.ts computeDebtService uses this same value.
   */
  PHASE1_LAND_PERMITS: 1_350_000,
  /**
   * Collateral valuation tiers (€/m²) — three appraisal scenarios.
   * NOTE: en.ts strings embedding '€7,650/m²', '€9,000/m²', '€11,000/m²'
   * mirror these values. Update en.ts whenever these change.
   */
  COLLATERAL_TIERS: {
    stress: 7_650,
    market: 9_000,
    optimistic: 11_000,
  },
  /**
   * Minimum single-year NCF (netCashFlowPostVAT) required before equity
   * distributions are permitted. ADR-0014 condition 1. Once crossed in any
   * year, the distribution gate latches open permanently.
   */
  DISTRIBUTION_RESERVE_THRESHOLD: 400_000,
} as const;

import {
  ModelAssumptions,
  PropertyConfig,
  PropertyTemplate,
  ProjectAllocation,
  RoomAreaBreakdown,
  PortfolioOpex,
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
    landscapingCost: 300_000,
    licensesPermitsCost: 250_000,
    constructionDirectorCost: 60_000,
    acquisitionLegalRate: 0.0734,
    poolSlots: [
      { id: 'ps-a-1', qty: 8, widthM: 3, lengthM: 10 },
      { id: 'ps-a-2', qty: 1, widthM: 5, lengthM: 20 },
    ],
    opexContingencyRate: 0,
    opex: {
      housekeeping: 15000,
      maintenance: 21000,
      utilities: 12000,
      insurance: 2500,
      propertyTax: 4000,
      marketing: 4000,
      managementFee: 0,
      consumables: 5000,
      accounting: 7000,
      ffeReserveFloor: 20000,
    },
    extraOpexLines: [],
    extraCapexLines: [],
    bedroomsInMain: 4, lockableSubUnits: 3, bedroomsPerSubUnit: 1,
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
    landscapingCost: 20_000,
    licensesPermitsCost: 80_000,
    // Shared construction director across the 3 small plots (B1+B2+C) costs
    // €60K total — €20K allocated to each plot.
    constructionDirectorCost: 20_000,
    acquisitionLegalRate: 0.0734,
    wellnessFlatCost: 65_000,
    opexContingencyRate: 0,
    opex: {
      housekeeping: 13000,
      maintenance: 15000,
      utilities: 12000,
      insurance: 2500,
      propertyTax: 4000,
      marketing: 4000,
      managementFee: 0,
      consumables: 5000,
      accounting: 7000,
      ffeReserveFloor: 30000,
    },
    extraOpexLines: [],
    extraCapexLines: [],
    bedroomsPerStandard: 1, bedroomsPerDouble: 2,
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
    landscapingCost: 20_000,
    licensesPermitsCost: 80_000,
    // Shared construction director across the 3 small plots (B1+B2+C) costs
    // €60K total — €20K allocated to each plot.
    constructionDirectorCost: 20_000,
    acquisitionLegalRate: 0.0734,
    poolSlots: [
      { id: 'ps-b-1', qty: 1, widthM: 5, lengthM: 10 },
    ],
    opexContingencyRate: 0,
    opex: {
      housekeeping: 22000,
      maintenance: 37500,
      utilities: 18000,
      insurance: 4000,
      propertyTax: 6000,
      marketing: 6000,
      managementFee: 0,
      consumables: 8000,
      accounting: 10000,
      ffeReserveFloor: 20000,
    },
    extraOpexLines: [],
    extraCapexLines: [],
    bedroomsInMain: 4, lockableSubUnits: 3, bedroomsPerSubUnit: 1,
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
    opexContingencyRate: 0,
    opex: {
      housekeeping: 8000,
      maintenance: 7875,
      utilities: 8000,
      insurance: 1500,
      propertyTax: 2500,
      marketing: 3000,
      managementFee: 0,
      consumables: 3000,
      accounting: 5000,
      ffeReserveFloor: 15000,
    },
    extraOpexLines: [],
    extraCapexLines: [],
    bedroomsPerStandard: 1,
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
    opexContingencyRate: 0,
    opex: {
      housekeeping: 20000,
      maintenance: 26460,
      utilities: 16000,
      insurance: 3500,
      propertyTax: 5000,
      marketing: 5000,
      managementFee: 0,
      consumables: 7000,
      accounting: 9000,
      ffeReserveFloor: 15000,
    },
    extraOpexLines: [],
    extraCapexLines: [],
    bedroomsInMain: 4, lockableSubUnits: 3, bedroomsPerSubUnit: 1, bedroomsPerStandard: 1, bedroomsPerDouble: 2,
  },
];

// ── Default Project Allocations ──

export const DEFAULT_PROJECTS: ProjectAllocation[] = [
  { id: 'proj-1', templateId: 'tpl-twin-villa', name: '11 Suite-Villas', count: 2 },
  { id: 'proj-2', templateId: 'tpl-boutique-suite', name: 'Boutique & Wellness', count: 1 },
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
        opexContingencyRate: tpl.opexContingencyRate ?? 0,
        landscapingCost: tpl.landscapingCost,
        licensesPermitsCost: tpl.licensesPermitsCost,
        constructionDirectorCost: tpl.constructionDirectorCost,
        poolSlots: tpl.poolSlots ? tpl.poolSlots.map((s) => ({ ...s })) : undefined,
        wellnessFlatCost: tpl.wellnessFlatCost,
        acquisitionLegalRate: tpl.acquisitionLegalRate,
        opex: { ...tpl.opex },
        extraOpexLines: tpl.extraOpexLines ?? [],
        extraCapexLines: tpl.extraCapexLines ?? [],
        bedroomsPerStandard: tpl.bedroomsPerStandard,
        bedroomsPerDouble:   tpl.bedroomsPerDouble,
        bedroomsInMain:      tpl.bedroomsInMain,
        lockableSubUnits:    tpl.lockableSubUnits,
        bedroomsPerSubUnit:  tpl.bedroomsPerSubUnit,
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
  opexContingencyRate: 0,
  opex: {
    housekeeping: 15000,
    maintenance: 21000,
    utilities: 12000,
    insurance: 2500,
    propertyTax: 4000,
    marketing: 4000,
    managementFee: 0,
    consumables: 5000,
    accounting: 7000,
    ffeReserveFloor: 20000,
  },
  bedroomsInMain: 4, lockableSubUnits: 3, bedroomsPerSubUnit: 1,
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
  opexContingencyRate: 0,
  opex: {
    housekeeping: 13000,
    maintenance: 15000,
    utilities: 12000,
    insurance: 2500,
    propertyTax: 4000,
    marketing: 4000,
    managementFee: 0,
    consumables: 5000,
    accounting: 7000,
    ffeReserveFloor: 15000,
  },
  bedroomsPerStandard: 1, bedroomsPerDouble: 2,
};

// ── FALLBACK ONLY ──────────────────────────────────────────────────────────
// BASE_CASE is the cold-start initial state before any Firestore scenario
// or localStorage override is applied. It is NOT the live operating config.
// The modelStore deep-merges localStorage (ASSUMPTIONS_STORAGE_KEY) over
// this object on every page load; published Firestore scenarios supersede it
// entirely. Do NOT report these values as "current assumptions" without first
// checking:
//   1. Firestore `scenarios` collection (project villa-lev-admin)
//   2. localStorage (ASSUMPTIONS_STORAGE_KEY)
//   3. BP xlsx (VillaLevGroup_BP_v6_2026-05-21.xlsx) for document work
// ──────────────────────────────────────────────────────────────────────────
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
    gracePeriodYears: 2,
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
    netVATRate: 0.08,
    otaCommissionRate: 0.175,
    otaShare: 1.0,             // 1.0 = 100% via OTA in opening year (backward-compat default)
    otaShareDeclinePerYear: 0, // 0 = no automatic channel shift. Per-year maps intentionally absent.
  },

  acquisitionLegalPerPlot: 50000,
  poolConstructionCostPerM2: 1_000,
  developerConstructionFeePerYear: 75_000,
  financingPath: 'commercial',
  exitEbitdaMultiple: 10,
  // Default exit at the end of the modeled horizon (2036 = Y10 of operations).
  // Editable; engine clamps to [first stabilised year, last modeled year].
  exitYear: 2036,
  // Standard Greek/EU commercial real-estate covenant. Editable in the BP
  // export; drives the Pass/Fail flag on the Coverage sheet.
  dscrCovenantThreshold: 1.25,
  dsra: {
    enabled: false,
    targetDSCR: 1.25,
    sweep2028Pct: 1.0,
    replenishmentPriority: 1.0,
    partnerRepaymentThreshold: 2,
  },

  // FF&E Reserve rate schedule.
  // Engine computes max(ffeReserveFloor, rate × revenuePerUnit) per year.
  ffeSchedule: {
    rate2029: 0.02,       // 2% of revenue — first operational year
    rate2030: 0.03,       // 3% of revenue — second operational year
    rateStabilised: 0.04, // 4% of revenue — stabilised year (2031+), capped
  },

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
    baseMgmtFeeRate: 0.05,      // Bucket 2A: was baseFeeRate: 0.03 + brandFeeRate: 0.02
    incentiveFeeRate: 0.10,     // Bucket 2B: 10% of GOP above hurdle
    ownerPriorityReturnRate: 0.08,
    // Shareholder floor: incentive fee ≤ 50% of residual NCF after DS.
    // Guarantees equity holders always keep ≥ 50% of distributable cash.
    shareholderMinResidualShare: 0.50,
    // Annual cap on total OpCo fee income (base + incentive combined).
    // PropCo pays OpCo at most €180K/yr regardless of revenue or GOP.
    // Renegotiable with shareholders; does NOT affect founder's personal draw.
    opcoAnnualFeeCap: 180_000,
    juniorTier1Rate: 0.10,
    juniorTier2Rate: 0.15,
    juniorResidualThreshold: 500_000,
  },

  // Minimum annual management fee per project, paid SENIOR to debt service
  // in bank view (lives inside OpEx, hits DSCR). Multiplied by the number of
  // plots in model.ts → €25K × 3 plots = €75K/yr total @ current portfolio.
  // Matches the construction-phase minimum (developerConstructionFeePerYear)
  // so Eytan's floor is consistent across construction and operations.
  // OpCo fees above this floor are subordinated (junior) to debt service.
  opCoSeniorFloor: 25_000,

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
  portfolioOpex: {
    staffRoles: [
      {
        name: 'Operations Manager',
        monthlyGross: 3000,
        monthsPaid: 12,          // 12 calendar months
        bonusMonths: 2,          // Christmas (1) + Easter (½) + holiday (½) = 2 → 14 effective
        burdenMultiplier: 1.32,
        allowances: 0,
        yearRound: true,
        headcount: 1,
      },
      {
        name: 'Reservations & Marketing',
        monthlyGross: 2500,
        monthsPaid: 12,
        bonusMonths: 2,
        burdenMultiplier: 1.32,
        allowances: 0,
        yearRound: true,
        headcount: 1,
      },
      {
        name: 'Head of Housekeeping',
        monthlyGross: 2156,
        monthsPaid: 12,
        bonusMonths: 2,          // Christmas (1) + Easter (½) + holiday (½) = 2 — same entitlement as all year-round staff
        burdenMultiplier: 1.32,
        allowances: 3600,
        yearRound: true,
        headcount: 1,
      },
      {
        name: 'Housekeeping Seasonal 6mo',
        monthlyGross: 1136,
        monthsPaid: 6,
        bonusMonths: 1,          // pro-rata: 6/12 × 2 = 1.0
        burdenMultiplier: 1.32,
        allowances: 3600,
        yearRound: false,
        seasonalMonths: 6,
        headcount: 2,
      },
      {
        name: 'Housekeeping Seasonal 4mo',
        monthlyGross: 750,
        monthsPaid: 4,
        bonusMonths: 0.6667,     // pro-rata: 4/12 × 2 = 0.6667
        burdenMultiplier: 1.32,
        allowances: 3600,
        yearRound: false,
        seasonalMonths: 4,
        headcount: 3,
      },
      {
        name: 'Pool Technician',
        monthlyGross: 2100,
        monthsPaid: 12,
        bonusMonths: 2,
        burdenMultiplier: 1.32,
        allowances: 1200,
        yearRound: true,
        headcount: 1,
      },
    ],
    sharedServices: [
      { name: 'Pool R&M', sizingBasis: '17 pools × €1,500/pool (materials + annual service; labour → Pool Technician hire)', annualCost: 25500 },
      { name: 'Landscape & Gardening', sizingBasis: 'Antiparos local rates', annualCost: 12000 },
      { name: 'Maintenance Contractor Pool', sizingBasis: '17 pools × €882/pool/yr call-out budget', annualCost: 14994, unitCount: 17, costPerUnit: 882 },
    ],
    sharedOverhead: [
      { name: 'Accounting & Bookkeeping', sizingBasis: '1 OpCo + 4 PropCos + HoldCo', annualCost: 30000 },
      { name: 'Audit Fees', sizingBasis: '5 Greek entities', annualCost: 10000 },
      { name: 'Legal & Professional / GDPR DPO Retainer', sizingBasis: 'Recurring counsel', annualCost: 15000 },
      { name: 'ΓΕΜΗ Filings & Corporate Compliance', sizingBasis: '5 entities', annualCost: 3000 },
      { name: 'Hotel Licensing & Permits', sizingBasis: 'EOT, fire, environmental, health certs', annualCost: 9000 },
      { name: 'Hellenic Chamber of Hotels', sizingBasis: 'Annual dues', annualCost: 1000 },
      { name: 'Insurance Umbrella & Liability', sizingBasis: 'D&O, BI, key-person, cyber, events', annualCost: 35000 },
      { name: 'Banking & Payment Processing', sizingBasis: '50% direct × revenue × 3.2% blended', annualCost: 30000 },
      { name: 'IT / PMS / Channel Manager / CRM', sizingBasis: 'Per-key SaaS + portfolio licences', annualCost: 25000 },
    ],
    preOpeningTotal: 275000,
    preOpeningAmortYears: 5,
    preOpeningStartYear: 2028,
    includePreOpeningInStabilised: true,
    poolCount: 17,
    poolCostPerUnit: 1500,
    inflationHook: 0.0,
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

// ── Portfolio OPEX defaults (exported separately for use in engine tests and store) ──
export const DEFAULT_PORTFOLIO_OPEX: PortfolioOpex = BASE_CASE.portfolioOpex!;

// Ensure a ModelAssumptions object has valid portfolioOpex populated.
// Called in both init() and loadConfig() to backfill schema fields added after a save.
export function ensurePortfolioOpex(assumptions: ModelAssumptions): ModelAssumptions {
  const d = DEFAULT_PORTFOLIO_OPEX;
  const po = assumptions.portfolioOpex;
  // Always merge defaults first, then overlay saved arrays so new scalar fields
  // (poolCount, poolCostPerUnit, etc.) are backfilled on every load.
  // Seed any default staff roles that are missing from saved state by name.
  const savedRoles = po?.staffRoles?.length ? po.staffRoles : d.staffRoles;
  // Migrate old hardcoded-FTE names to clean names (headcount field carries the count).
  const renamedRoles = savedRoles.map((r) => {
    if (r.name === 'Housekeeping Seasonal 6mo×2FTE') return { ...r, name: 'Housekeeping Seasonal 6mo' };
    if (r.name === 'Housekeeping Seasonal 4mo×3FTE') return { ...r, name: 'Housekeeping Seasonal 4mo' };
    return r;
  });
  const mergedRoles = renamedRoles.some((r) => r.name === 'Pool Technician')
    ? renamedRoles
    : [...renamedRoles, d.staffRoles.find((r) => r.name === 'Pool Technician')!];

  return {
    ...assumptions,
    portfolioOpex: {
      ...d,
      ...(po ?? {}),
      staffRoles:   mergedRoles,
      sharedServices: po?.sharedServices?.length ? po.sharedServices : d.sharedServices,
      sharedOverhead: po?.sharedOverhead?.length ? po.sharedOverhead : d.sharedOverhead,
      poolCount:      po?.poolCount      ?? d.poolCount,
      poolCostPerUnit: po?.poolCostPerUnit ?? d.poolCostPerUnit,
    },
  };
}
