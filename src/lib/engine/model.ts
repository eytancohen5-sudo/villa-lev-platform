// ============================================================
// VILLA LEV GROUP — Financial Computation Engine
// ============================================================

import {
  ModelAssumptions,
  ModelOutput,
  CapexBreakdown,
  CapexPropertyLine,
  AnnualPnL,
  PropertyPnLLine,
  PortfolioOpexOutput,
  ScenarioOutput,
  RevenueAssumptions,
  FinancingComparison,
  FinancingPath,
  PropertyConfig,
  OptimaLoanParams,
  getPropertyDisplayType,
  computeTotalArea,
} from './types';
import { DOWNSIDE_FACTORS, DEFAULT_ROOM_AREAS, DEFAULT_EXIT_EBITDA_MULTIPLE, DEFAULT_PORTFOLIO_OPEX, PROJECT_CONSTANTS } from './defaults';
import { computeWorkingCapital } from './workingCapital';
import { optimaCapexView } from './optimaView';

const {
  HORIZON_START_YEAR,
  OPENING_YEAR,
  FIRST_OPERATIONAL_YEAR,
  STABILISED_YEAR,
  HORIZON_END_YEAR,
  MIN_EXIT_YEAR,
  NIGHTS_GROWTH_BASE_YEAR,
  TEPIX_LOAN_CAP_EUR,
  COLLATERAL_TIERS,
  PHASE1_LAND_PERMITS,
} = PROJECT_CONSTANTS;

// ────────────────────────────────────────────
// Numeric helpers — IRR / NPV / amortisation
// ────────────────────────────────────────────

function npv(rate: number, cashFlows: number[]): number {
  let total = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    total += cashFlows[t] / Math.pow(1 + rate, t);
  }
  return total;
}

// Newton-Raphson IRR. Returns NaN if the series has no sign change or fails to
// converge — caller should null-coalesce for display.
function irr(cashFlows: number[], guess = 0.1): number {
  const hasNeg = cashFlows.some((cf) => cf < 0);
  const hasPos = cashFlows.some((cf) => cf > 0);
  if (!hasNeg || !hasPos) return NaN;

  let r = guess;
  for (let i = 0; i < 200; i++) {
    const f = npv(r, cashFlows);
    const dr = 1e-6;
    const fPrime = (npv(r + dr, cashFlows) - f) / dr;
    if (Math.abs(fPrime) < 1e-14) break;
    const newR = r - f / fPrime;
    if (!isFinite(newR)) break;
    if (Math.abs(newR - r) < 1e-9) return newR;
    r = newR;
  }
  // Fallback: bisection between -0.99 and 5.0
  let lo = -0.99;
  let hi = 5.0;
  let fLo = npv(lo, cashFlows);
  let fHi = npv(hi, cashFlows);
  if (fLo * fHi > 0) return NaN;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, cashFlows);
    if (Math.abs(fMid) < 1e-6) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

// Amortisation schedule for a term loan with grace period. During grace years,
// interest-only via getDS(year). After grace, opening×rate is interest, the
// remainder of annualDS is principal.
interface AmortYear {
  opening: number;
  interest: number;
  principal: number;
  closing: number;
}

function buildAmortSchedule(
  loanAmount: number,
  rate: number,
  annualDS: number,
  getDS: (year: number) => number,
  startYear: number,
  endYear: number,
  graceEndYear: number,
  drawnBalanceFn?: (year: number) => number
): Map<number, AmortYear> {
  const map = new Map<number, AmortYear>();
  let balance = loanAmount;
  for (let year = startYear; year <= endYear; year++) {
    // During grace years, override balance to drawn amount (not full committed facility).
    // IMPORTANT: override balance before computing opening so the carry-forward is correct.
    if (year <= graceEndYear && drawnBalanceFn) {
      balance = drawnBalanceFn(year);
    }
    const opening = balance;
    let interest = 0;
    let principal = 0;
    if (loanAmount > 0) {
      if (year <= graceEndYear) {
        interest = Math.max(0, getDS(year));
        principal = 0;
      } else {
        interest = opening * rate;
        principal = Math.max(0, Math.min(opening, annualDS - interest));
      }
    }
    const closing = Math.max(0, opening - principal);
    map.set(year, { opening, interest, principal, closing });
    balance = closing;
  }
  return map;
}

// ── Rolling amortisation schedule ──────────────────────────────────────────
// Computes a per-tranche amortisation schedule for rolling-mode paths.
// Each tranche has its own IO period (from disbYear to amortStart - 1) and
// then amortises independently. This prevents the global-graceEndYear problem
// where early tranches' balance stays flat until the last tranche's grace ends.

interface RollingTranche {
  loan: number;
  disbYear: number;
  disbQ: 1 | 2 | 3 | 4;
  amortStart: number;
}

function buildRollingAmortSchedule(
  tranches: RollingTranche[],
  rate: number,
  repaymentTermYears: number,
  startYear: number,
  endYear: number
): Map<number, AmortYear> {
  const map = new Map<number, AmortYear>();
  for (let year = startYear; year <= endYear; year++) {
    let totalOpening = 0;
    let totalInterest = 0;
    let totalPrincipal = 0;
    for (const tr of tranches) {
      if (year < tr.disbYear) continue; // not yet drawn
      const trPmt = pmt(rate, repaymentTermYears, tr.loan);
      if (year < tr.amortStart) {
        // IO period
        totalOpening += tr.loan;
        const interest =
          year === tr.disbYear
            ? tr.loan * rate * (5 - tr.disbQ) / 4  // partial year
            : tr.loan * rate;                        // full year IO
        totalInterest += interest;
        // principal = 0 (grace/IO)
      } else {
        // Amortising period
        const yearsAmortized = year - tr.amortStart; // payments made BEFORE this year
        const openingTr =
          yearsAmortized === 0
            ? tr.loan  // first amort year opens at full tranche loan
            : (() => {
                // PV of remaining payments: PMT × (1 - (1+r)^(-remainingYears)) / r
                const remainingYears = repaymentTermYears - yearsAmortized;
                if (remainingYears <= 0) return 0;
                return trPmt * (1 - Math.pow(1 + rate, -remainingYears)) / rate;
              })();
        const interest = openingTr * rate;
        const principal = Math.max(0, Math.min(openingTr, trPmt - interest));
        totalOpening += openingTr;
        totalInterest += interest;
        totalPrincipal += principal;
      }
    }
    const closing = Math.max(0, totalOpening - totalPrincipal);
    map.set(year, {
      opening: totalOpening,
      interest: totalInterest,
      principal: totalPrincipal,
      closing,
    });
  }
  return map;
}

function areaOf(prop: PropertyConfig): number {
  const rooms = prop.roomAreas ?? DEFAULT_ROOM_AREAS;
  return computeTotalArea(rooms, {
    villaUnits: prop.villaUnits,
    standardSuites: prop.standardSuites,
    doubleSuites: prop.doubleSuites,
  });
}

// ────────────────────────────────────────────
// CAPEX
// ────────────────────────────────────────────

function computeCapexPerUnit(
  prop: PropertyConfig,
  a: ModelAssumptions,
  /** When true, acquisition legal is kept at portfolio level — do NOT fold it into perUnit. */
  useLegacyAcqLegal: boolean
): number {
  const area = areaOf(prop);
  const construction = area * prop.constructionCostPerM2;

  // Pool / wellness
  let poolCost = 0;
  if (prop.wellnessFlatCost != null) {
    poolCost = prop.wellnessFlatCost;
  } else if (prop.poolSlots && prop.poolSlots.length > 0) {
    const ratePerM2 = a.poolConstructionCostPerM2 ?? 1_000;
    poolCost = prop.poolSlots.reduce(
      (s, slot) => s + slot.qty * slot.widthM * slot.lengthM * ratePerM2,
      0
    );
  }

  const landscaping = prop.landscapingCost ?? 0;
  const softCosts =
    prop.licensesPermitsCost != null
      ? prop.licensesPermitsCost
      : (prop.legalFees ?? 0) + (prop.architectFees ?? 0) + (prop.civilEngineerFees ?? 0);
  const constructionDirector = prop.constructionDirectorCost ?? 0;
  const contingency = (construction + prop.ffeCost) * prop.contingencyRate;

  // Acquisition legal per unit: rate × landCost (new), or zero when legacy
  // portfolio-level accounting is active (old portfolios without acquisitionLegalRate).
  const acqLegalPerUnit = useLegacyAcqLegal
    ? 0
    : prop.landCost * (prop.acquisitionLegalRate ?? 0);

  return (
    prop.landCost +
    construction +
    landscaping +
    poolCost +
    prop.ffeCost +
    softCosts +
    constructionDirector +
    contingency +
    acqLegalPerUnit
  );
}

export function computeCapex(a: ModelAssumptions): CapexBreakdown {
  const totalPlots = a.portfolio.reduce((sum, p) => sum + p.count, 0);

  // Acquisition legal accounting mode:
  // - New portfolios: every property has acquisitionLegalRate → fold into perUnit (useLegacyAcqLegal = false)
  // - Old/legacy portfolios: no property has acquisitionLegalRate → keep flat per-plot at portfolio level
  const useLegacyAcqLegal = a.portfolio.every((p) => p.acquisitionLegalRate == null);
  const acqLegal = useLegacyAcqLegal ? a.acquisitionLegalPerPlot * totalPlots : 0;

  const properties: CapexPropertyLine[] = a.portfolio.map((prop) => {
    const perUnit = computeCapexPerUnit(prop, a, useLegacyAcqLegal);
    return {
      id: prop.id,
      name: prop.name,
      count: prop.count,
      perUnit,
      total: perUnit * prop.count,
    };
  });
  const devMgmtFee = (a.developerConstructionFeePerYear ?? 0) * 2;
  const extraCapexTotal = a.portfolio.reduce(
    (sum, p) => sum + (p.extraCapexLines ?? []).reduce((s, l) => s + (l.cost || 0), 0) * p.count,
    0
  );
  // custom capex lines increase portfolioTotal and therefore tepixLoan; confirm with operator before adding lines to live scenario pre-M02
  const portfolioTotal =
    properties.reduce((sum, p) => sum + p.total, 0) + acqLegal + devMgmtFee + extraCapexTotal;

  // Depreciation rates per category — Greek Law 4172/2013 Art. 24 (straight-line).
  // Land and non-depreciable intangibles get 0. Custom extra capex lines default to 0.
  const categoryDefs: { name: string; depreciationRate: number; getPerUnit: (p: PropertyConfig) => number }[] = [
    { name: 'Land acquisition',             depreciationRate: 0,    getPerUnit: (p: PropertyConfig) => p.landCost },
    { name: 'Building & excavation',        depreciationRate: 0.05, getPerUnit: (p: PropertyConfig) => areaOf(p) * p.constructionCostPerM2 },
    { name: 'Landscaping / stone fence',    depreciationRate: 0.05, getPerUnit: (p: PropertyConfig) => p.landscapingCost ?? 0 },
    {
      name: 'Pools / wellness',
      depreciationRate: 0.05, // 20-year life — same as building
      getPerUnit: (p: PropertyConfig) => {
        if (p.wellnessFlatCost != null) return p.wellnessFlatCost;
        if (p.poolSlots && p.poolSlots.length > 0) {
          const rate = a.poolConstructionCostPerM2 ?? 1_000;
          return p.poolSlots.reduce((s, slot) => s + slot.qty * slot.widthM * slot.lengthM * rate, 0);
        }
        return 0;
      },
    },
    { name: 'FF&E',                         depreciationRate: 0.10, getPerUnit: (p: PropertyConfig) => p.ffeCost },
    {
      name: 'Licenses & permits',
      depreciationRate: 0.20,
      getPerUnit: (p: PropertyConfig) =>
        p.licensesPermitsCost != null
          ? p.licensesPermitsCost
          : (p.legalFees ?? 0) + (p.architectFees ?? 0) + (p.civilEngineerFees ?? 0),
    },
    { name: 'Construction director salary', depreciationRate: 0.05, getPerUnit: (p: PropertyConfig) => p.constructionDirectorCost ?? 0 },
    {
      name: 'Contingency (10% of building + FF&E)',
      depreciationRate: 0.05, // same rate as building (20-year life)
      getPerUnit: (p: PropertyConfig) =>
        (areaOf(p) * p.constructionCostPerM2 + p.ffeCost) * p.contingencyRate,
    },
    {
      name: 'Acquisition legal & DD',
      depreciationRate: 0, // non-depreciable transaction cost
      getPerUnit: (p: PropertyConfig) =>
        p.acquisitionLegalRate != null
          ? p.landCost * p.acquisitionLegalRate
          : (useLegacyAcqLegal ? (a.acquisitionLegalPerPlot ?? 0) : 0),
    },
    {
      name: 'Construction director',
      depreciationRate: 0, // non-depreciable service cost
      getPerUnit: () => totalPlots > 0 ? devMgmtFee / totalPlots : 0,
    },
  ];

  // Custom CAPEX lines: one categoryDef entry per unique (property, line) pair,
  // keyed by `${prop.id}::${line.id}` so the Excel export can look them up without
  // relying on name-matching (which is collision-prone).
  for (const p of a.portfolio) {
    for (const line of p.extraCapexLines ?? []) {
      const key = `${p.id}::${line.id}`;
      categoryDefs.push({
        name: key,
        depreciationRate: 0, // custom lines: no depreciation rate assigned
        getPerUnit: (prop: PropertyConfig) => (prop.id === p.id ? line.cost || 0 : 0),
      });
    }
  }

  const categories = categoryDefs.map((cat) => {
    const perProperty = a.portfolio.map((prop) => {
      const perUnit = cat.getPerUnit(prop);
      return { id: prop.id, perUnit, total: perUnit * prop.count };
    });
    const grandTotal = perProperty.reduce((sum, p) => sum + p.total, 0);
    return { name: cat.name, depreciationRate: cat.depreciationRate, perProperty, grandTotal };
  });

  // Annual straight-line depreciation total (Art. 24, Law 4172/2013).
  // Starts at OPENING_YEAR (asset commissioning). Land and non-depreciable
  // items have depreciationRate = 0 and contribute nothing.
  const annualDepreciationTotal = categories.reduce(
    (sum, cat) => sum + cat.grandTotal * cat.depreciationRate,
    0,
  );
  const depreciationByCategory: Record<string, number> = {};
  for (const cat of categories) {
    depreciationByCategory[cat.name] = cat.grandTotal * cat.depreciationRate;
  }

  // ── Construction VAT cashflow (ADR-0015) ────────────────────────────────
  // VAT-liable categories at 24% Greek rate (Art. 93, Law 2859/2000).
  // Exempt: Land acquisition, Licenses & permits, Construction director.
  // Pools/wellness and Acquisition legal & DD are VAT-liable (construction services).
  // Custom extra-capex lines (name contains '::') are excluded — VAT treatment unknown.
  const VAT_EXEMPT_CATEGORIES = new Set([
    'Land acquisition',
    'Licenses & permits',
    'Construction director',
  ]);
  const VAT_RATE = 0.24;
  // All 4 construction tranches fall within 2029 (mobilization + 3 milestones, March–July 2029).
  const VAT_DRAW_SCHEDULE: Record<number, number> = { 2029: 1.0 };
  const REFUND_YEAR = 2030; // conservative: pool the full refund in 2030 (~4-month lag after 2029 completion)

  const vatLiableTotal = categories
    .filter(cat => !VAT_EXEMPT_CATEGORIES.has(cat.name) && !cat.name.includes('::'))
    .reduce((sum, cat) => sum + cat.grandTotal, 0);

  const constructionVatByYear: Record<number, number> = {};
  let totalVatOutflow = 0;
  for (const [yearStr, drawPct] of Object.entries(VAT_DRAW_SCHEDULE)) {
    const year = Number(yearStr);
    const vatOutflow = -(drawPct * vatLiableTotal * VAT_RATE);
    constructionVatByYear[year] = vatOutflow;
    totalVatOutflow += vatOutflow;
  }
  // Refund in 2030: positive inflow equal to the sum of all prior outflows
  constructionVatByYear[REFUND_YEAR] = -totalVatOutflow;

  return {
    properties,
    acquisitionLegal: acqLegal,
    portfolioTotal,
    totalPlots,
    categories,
    annualDepreciationTotal,
    depreciationByCategory,
    constructionVatByYear,
  };
}

// ────────────────────────────────────────────
// PMT calculation (matching Excel PMT)
// ────────────────────────────────────────────

function pmt(rate: number, nper: number, pv: number): number {
  if (nper === 0) return 0;
  if (rate === 0) return -pv / nper;
  const r = rate;
  return (r * pv) / (1 - Math.pow(1 + r, -nper));
}

// ────────────────────────────────────────────
// DEBT SERVICE for each financing path
// ────────────────────────────────────────────

interface DebtServiceResult {
  annualDS: number;
  loanAmount: number;
  equityRequired: number;
  getDS: (year: number) => number;
  grantAmount: number;
  // Effective amortising interest rate for the path. Used by the amortisation
  // schedule and as the discount rate for LLCR/PLCR.
  effectiveInterestRate: number;
  // Amortising term length post-grace (years).
  repaymentTermYears: number;
  primaryLoan?: number;
  supplementaryLoan?: number;
  supplementaryAnnualDS?: number;
  landFundedByTepix?: number;
  landFundedByCommercial?: number;
  // ── TEPIX III program cap (€8M / business) ──
  // Gross amount by which the unconstrained TEPIX primary loan exceeded the
  // €8M program ceiling, clamped down to 8M. 0 when the cap does not bind.
  // The excess flows downstream into commercial supplementary debt + sponsor
  // equity via the existing landGap / nonLandCost residual logic — see the
  // tepix-loan branch of computeDebtService for the mechanism. Only set on
  // the tepix-loan path; undefined on commercial / grant / rrf.
  tepixCapBindingBy?: number;
  // The cap value applied (constant; surfaced for UI tooltips). Only set on
  // the tepix-loan path.
  tepixLoanCap?: number;
  // ── Grace-period interest reserve ──
  // Sum of getDS() for each grace year. Ring-fenced equity injected at
  // financial close to pre-fund all pre-operational interest — NOT structural
  // equity (equityRequired stays CapEx × (1−LTV)). Used as IRR denominator
  // add-on only. 0 when gracePeriodYears === 0.
  graceInterestCarry: number;
  // Calendar year in which the grace period ends (HORIZON_START_YEAR + gracePeriodYears).
  graceEndYear: number;
  // First year in which ANY tranche starts amortising. Drives dscrWindowStart.
  // For multi-tranche rolling mode this is earlier than graceEndYear + 1 (the
  // first tranche amortises before the last one does). Defaults to graceEndYear + 1.
  firstAmortYear?: number;
  // ── Drawn-balance override for amortisation schedule ──
  // When provided, buildAmortSchedule uses this function to override the
  // running balance during grace years so opening/closing reflects the
  // actually-drawn balance rather than the full committed facility.
  // Only set on paths where tranches are drawn in stages (two-phase, rolling;
  // grant two-phase and rolling). NOT set on standard, optima, rrf, tepix-loan.
  drawnBalanceFn?: (year: number) => number;
  // ── Per-tranche rolling schedule ──
  // When set, computeScenario uses buildRollingAmortSchedule instead of
  // buildAmortSchedule so each tranche amortises independently from its own
  // amortStart — not from the global graceEndYear of the last tranche.
  // Only set on rolling commercial and rolling grant paths.
  rollingTranches?: RollingTranche[];
  // ── Commitment fee on undrawn construction tranches ──
  // Annual fee by year for T2–T5 (construction tranches, not plots/T1).
  // Set only on rolling and rolling-cohort commercial/grant paths when
  // commitmentFeeEnabled is true. Zero/absent otherwise.
  commitmentFeeByYear?: Record<number, number>;
}

function computeTotalLand(a: ModelAssumptions): number {
  return a.portfolio.reduce((sum, p) => sum + p.landCost * p.count, 0);
}

function computeDebtService(
  a: ModelAssumptions,
  capex: CapexBreakdown,
  path: FinancingPath
): DebtServiceResult {
  const totalCost = capex.portfolioTotal;
  const totalPlots = capex.totalPlots;

  if (path === 'commercial') {
    const loanAmount = totalCost * a.commercialLoan.loanCoverageRate;
    const equity = totalCost - loanAmount;
    const rate = a.commercialLoan.interestRate;
    const repaymentTermYears = a.commercialLoan.repaymentTermYears;
    const annualDS = pmt(rate, repaymentTermYears, loanAmount);
    const graceMode = a.commercialLoan.graceMode ?? 'standard';

    if (graceMode === 'rolling') {
      // Rolling: per-tranche grace from disbursement quarter.
      // T1 = plots (single tranche); T2-T5 = construction (4 × 25%, one per semester).
      // Disbursement start quarters are configurable; defaults: plots Q1-2026, constr Q1-2027.
      const plotsLoan    = PHASE1_LAND_PERMITS * a.commercialLoan.loanCoverageRate;
      const constLoan    = loanAmount - plotsLoan;
      const constQuarter = constLoan / 4;

      const pYear = a.commercialLoan.plotsStartYear        ?? HORIZON_START_YEAR;
      const pQ    = a.commercialLoan.plotsStartQ           ?? 1;
      const cYear = a.commercialLoan.constructionStartYear  ?? HORIZON_START_YEAR + 1;
      const cQ    = a.commercialLoan.constructionStartQ     ?? 1;

      // Quarter arithmetic: add N quarters to (baseYear, baseQ), wrapping correctly.
      function addQtrs(baseYear: number, baseQ: number, n: number) {
        const total = (baseQ - 1) + n;
        return { year: baseYear + Math.floor(total / 4), q: (total % 4) + 1 };
      }

      const t2 = addQtrs(cYear, cQ, 0); // T2: construction start
      const t3 = addQtrs(cYear, cQ, 2); // T3: +1 semester
      const t4 = addQtrs(cYear, cQ, 4); // T4: +2 semesters
      const t5 = addQtrs(cYear, cQ, 6); // T5: +3 semesters

      // Each tranche: amortStartYear = disbYear + 3 (consistent with standard model:
      // loan drawn 2026 → amortises from 2029 = +3).
      const tranches: RollingTranche[] = [
        { loan: plotsLoan,    disbYear: pYear,    disbQ: pQ as 1|2|3|4,   amortStart: pYear    + 3 },
        { loan: constQuarter, disbYear: t2.year,  disbQ: t2.q as 1|2|3|4, amortStart: t2.year  + 3 },
        { loan: constQuarter, disbYear: t3.year,  disbQ: t3.q as 1|2|3|4, amortStart: t3.year  + 3 },
        { loan: constQuarter, disbYear: t4.year,  disbQ: t4.q as 1|2|3|4, amortStart: t4.year  + 3 },
        { loan: constQuarter, disbYear: t5.year,  disbQ: t5.q as 1|2|3|4, amortStart: t5.year  + 3 },
      ];

      // Debt service for one tranche in a given year:
      //   disbYear: partial-year IO scaled by quarter (Q1=100%, Q2=75%, Q3=50%, Q4=25%)
      //   grace years: full-year IO
      //   amortising: PMT annuity
      function trancheDS(tr: typeof tranches[0], year: number): number {
        if (year < tr.disbYear) return 0;
        if (year === tr.disbYear) return tr.loan * rate * (5 - tr.disbQ) / 4;
        if (year < tr.amortStart) return tr.loan * rate;
        return pmt(rate, repaymentTermYears, tr.loan);
      }

      const rollingGetDS = (year: number): number =>
        tranches.reduce((sum, tr) => sum + trancheDS(tr, year), 0);

      // graceEndYear = max(amortStart − 1) across all tranches
      // = last year any tranche is still in IO
      const commGraceEndYear = Math.max(...tranches.map(tr => tr.amortStart - 1));

      // graceInterestCarry = DS for each pre-operational year
      // (from first disbYear up to but NOT including OPENING_YEAR = 2029)
      const firstDisbYear = Math.min(...tranches.map(tr => tr.disbYear));
      let rollingGraceInterestCarry = 0;
      for (let yr = firstDisbYear; yr < OPENING_YEAR; yr++) {
        rollingGraceInterestCarry += rollingGetDS(yr);
      }

      // firstAmortYear = the earliest year any tranche starts amortising.
      // This drives dscrWindowStart so 2029-2030 are included in DSCR measurement
      // even though the last tranche (T5) is still IO until 2031.
      const firstAmortYear = Math.min(...tranches.map(t => t.amortStart));

      const rollingDrawnBalance = (year: number): number =>
        tranches.filter(tr => tr.disbYear <= year).reduce((s, tr) => s + tr.loan, 0);

      // Commitment fee: applies only to construction tranches (T2–T5), not plots (T1)
      const rollingCommitmentFeeByYear: Record<number, number> = {};
      const rollingCommitFeeEnabled = a.commercialLoan.commitmentFeeEnabled ?? false;
      const rollingCommitFeeRate = a.commercialLoan.commitmentFeeRate ?? 0.0075;
      if (rollingCommitFeeEnabled) {
        const constructionTranches = tranches.slice(1); // T2–T5, skip T1 (plots)
        for (let yr = cYear; yr <= HORIZON_END_YEAR; yr++) {
          let fee = 0;
          for (const tr of constructionTranches) {
            if (yr < tr.disbYear) {
              fee += tr.loan * rollingCommitFeeRate;
            } else if (yr === tr.disbYear) {
              fee += tr.loan * rollingCommitFeeRate * (tr.disbQ - 1) / 4;
            }
          }
          if (fee > 0) rollingCommitmentFeeByYear[yr] = fee;
        }
      }

      return {
        annualDS,
        loanAmount,
        equityRequired: equity,
        grantAmount: 0,
        effectiveInterestRate: rate,
        repaymentTermYears,
        graceEndYear: commGraceEndYear,
        graceInterestCarry: rollingGraceInterestCarry,
        firstAmortYear,
        getDS: rollingGetDS,
        drawnBalanceFn: rollingDrawnBalance,
        rollingTranches: tranches,
        commitmentFeeByYear: rollingCommitmentFeeByYear,
      };
    }

    if (graceMode === 'two-phase') {
      // Option A: two blocks — Phase 1 (plots) and Phase 2 (full construction),
      // each drawn at its own configurable start quarter with its own 2-year grace.
      // amortStart = disbYear + 3 (consistent with standard convention).
      const p1Year = a.commercialLoan.plotsStartYear        ?? HORIZON_START_YEAR;
      const p1Q    = a.commercialLoan.plotsStartQ           ?? 1;
      const p2Year = a.commercialLoan.constructionStartYear  ?? HORIZON_START_YEAR + 1;
      const p2Q    = a.commercialLoan.constructionStartQ     ?? 1;

      const phase1Loan = PHASE1_LAND_PERMITS * a.commercialLoan.loanCoverageRate;
      const phase2Loan = loanAmount - phase1Loan;

      const phase1AmortStart = p1Year + 3;
      const phase2AmortStart = p2Year + 3;

      const phase1AnnualDS = pmt(rate, repaymentTermYears, phase1Loan);
      const phase2AnnualDS = pmt(rate, repaymentTermYears, phase2Loan);
      const combinedDS = phase1AnnualDS + phase2AnnualDS; // = annualDS by PMT linearity

      // IO in disbursement year: partial-year factor (5-Q)/4
      function blockIO(loan: number, disbYear: number, disbQ: number, year: number, amortStart: number): number {
        if (year < disbYear) return 0;
        if (year === disbYear) return loan * rate * (5 - disbQ) / 4; // partial year
        if (year < amortStart) return loan * rate;                    // full-year IO
        return 0;
      }
      function blockAmort(loan: number, amortStart: number, year: number): number {
        return year >= amortStart ? pmt(rate, repaymentTermYears, loan) : 0;
      }

      const twoPhaseGetDS = (year: number): number =>
        blockIO(phase1Loan, p1Year, p1Q, year, phase1AmortStart) +
        blockAmort(phase1Loan, phase1AmortStart, year) +
        blockIO(phase2Loan, p2Year, p2Q, year, phase2AmortStart) +
        blockAmort(phase2Loan, phase2AmortStart, year);

      // graceEndYear = last IO year for the later phase
      const tp2GraceEnd = Math.max(phase1AmortStart, phase2AmortStart) - 1;

      // graceInterestCarry = pre-operational IO (before OPENING_YEAR)
      let tpGraceCarry = 0;
      const tpFirstYear = Math.min(p1Year, p2Year);
      for (let yr = tpFirstYear; yr < OPENING_YEAR; yr++) {
        tpGraceCarry += twoPhaseGetDS(yr);
      }

      const twoPhaseDrawnBalance = (year: number): number => {
        if (year < p1Year) return 0;
        if (year < p2Year) return phase1Loan;
        return loanAmount;
      };

      return {
        annualDS: combinedDS,
        loanAmount,
        equityRequired: equity,
        grantAmount: 0,
        effectiveInterestRate: rate,
        repaymentTermYears,
        graceEndYear: tp2GraceEnd,
        graceInterestCarry: tpGraceCarry,
        firstAmortYear: Math.min(phase1AmortStart, phase2AmortStart),
        getDS: twoPhaseGetDS,
        drawnBalanceFn: twoPhaseDrawnBalance,
      };
    }

    if (graceMode === 'rolling-cohort') {
      // Same 5-tranche drawdown as rolling mode:
      // T1 = plots; T2-T5 = construction (4 × 25%, one per semester).
      // BUT: all tranches share a SINGLE cohort grace end date =
      //   firstDisbYear + gracePeriodYears (i.e. pYear + gracePeriodYears).
      // Changing gracePeriodYears in the UI moves the single grace end date.
      const plotsLoan   = PHASE1_LAND_PERMITS * a.commercialLoan.loanCoverageRate;
      const constLoan   = loanAmount - plotsLoan;
      const constQuarter = constLoan / 4;

      const pYear = a.commercialLoan.plotsStartYear        ?? HORIZON_START_YEAR;
      const pQ    = a.commercialLoan.plotsStartQ           ?? 1;
      const cYear = a.commercialLoan.constructionStartYear  ?? HORIZON_START_YEAR + 1;
      const cQ    = a.commercialLoan.constructionStartQ     ?? 1;

      function addQtrs(baseYear: number, baseQ: number, n: number) {
        const total = (baseQ - 1) + n;
        return { year: baseYear + Math.floor(total / 4), q: (total % 4) + 1 };
      }

      const t2 = addQtrs(cYear, cQ, 0);
      const t3 = addQtrs(cYear, cQ, 2);
      const t4 = addQtrs(cYear, cQ, 4);
      const t5 = addQtrs(cYear, cQ, 6);

      const tranches = [
        { loan: plotsLoan,    disbYear: pYear,    disbQ: pQ   },
        { loan: constQuarter, disbYear: t2.year,  disbQ: t2.q },
        { loan: constQuarter, disbYear: t3.year,  disbQ: t3.q },
        { loan: constQuarter, disbYear: t4.year,  disbQ: t4.q },
        { loan: constQuarter, disbYear: t5.year,  disbQ: t5.q },
      ];

      // COHORT: all tranches amortise from the same year = firstDisbYear + gracePeriodYears + 1
      const gracePeriodYears = a.commercialLoan.gracePeriodYears ?? 2;
      const cohortGraceEndYear = pYear + gracePeriodYears; // e.g. 2026+2 = 2028

      // IO for year = sum of drawn-tranche IO payments
      function trancheIO(tr: { loan: number; disbYear: number; disbQ: number }, year: number): number {
        if (year < tr.disbYear) return 0;
        if (year === tr.disbYear) return tr.loan * rate * (5 - tr.disbQ) / 4;
        return tr.loan * rate; // full year IO
      }

      const cohortGetDS = (year: number): number => {
        if (year <= cohortGraceEndYear) {
          return tranches.reduce((sum, tr) => sum + trancheIO(tr, year), 0);
        }
        return annualDS;
      };

      // graceInterestCarry = pre-operational IO (years before OPENING_YEAR)
      const firstDisbYear = pYear;
      let cohortGraceCarry = 0;
      for (let yr = firstDisbYear; yr < OPENING_YEAR; yr++) {
        cohortGraceCarry += cohortGetDS(yr);
      }

      // drawnBalanceFn: balance = sum of loans for tranches drawn by year
      const cohortDrawnBalance = (year: number): number =>
        tranches.reduce((sum, tr) => year >= tr.disbYear ? sum + tr.loan : sum, 0);

      // Commitment fee: applies only to construction tranches (T2–T5), not plots (T1)
      // Fee = undrawn tranche × commitmentFeeRate, for the fraction of year before draw
      const cohortCommitmentFeeByYear: Record<number, number> = {};
      const commitFeeEnabled = a.commercialLoan.commitmentFeeEnabled ?? false;
      const commitFeeRate = a.commercialLoan.commitmentFeeRate ?? 0.0075;
      if (commitFeeEnabled) {
        const constructionTranches = tranches.slice(1); // T2–T5, skip T1 (plots)
        for (let yr = cYear; yr <= HORIZON_END_YEAR; yr++) {
          let fee = 0;
          for (const tr of constructionTranches) {
            if (yr < tr.disbYear) {
              fee += tr.loan * commitFeeRate;               // full year undrawn
            } else if (yr === tr.disbYear) {
              fee += tr.loan * commitFeeRate * (tr.disbQ - 1) / 4;  // partial before draw
            }
            // yr > tr.disbYear: fee += 0 (drawn)
          }
          if (fee > 0) cohortCommitmentFeeByYear[yr] = fee;
        }
      }

      return {
        annualDS,
        loanAmount,
        equityRequired: equity,
        grantAmount: 0,
        effectiveInterestRate: rate,
        repaymentTermYears,
        graceEndYear: cohortGraceEndYear,
        graceInterestCarry: cohortGraceCarry,
        firstAmortYear: cohortGraceEndYear + 1,
        getDS: cohortGetDS,
        drawnBalanceFn: cohortDrawnBalance,
        commitmentFeeByYear: cohortCommitmentFeeByYear,
        // rollingTranches intentionally NOT set — rolling-cohort uses buildAmortSchedule
        // (with drawnBalanceFn), not buildRollingAmortSchedule, because all tranches
        // amortise from the same cohort grace end year.
      };
    }

    // 'standard' (default) — uses scenario-specific calibrated scalars.
    // Existing Firestore scenarios have manually-calibrated interest2026/2027/2028
    // values that must be honoured. Per-tranche IO formulae would override these.
    const commGracePeriodYears = a.commercialLoan.gracePeriodYears ?? 2;
    const commGraceEndYear = HORIZON_START_YEAR + commGracePeriodYears;
    const commGetDS = (year: number) => {
      if (year === HORIZON_START_YEAR) return a.commercialLoan.interest2026;
      if (year === HORIZON_START_YEAR + 1) return a.commercialLoan.interest2027;
      // FIX: extend interest2028 to ALL intermediate grace years (not just commGraceEndYear)
      // This prevents years between 2027 and commGraceEndYear from returning 0 when gracePeriodYears > 2
      if (year > HORIZON_START_YEAR + 1 && year <= commGraceEndYear) return a.commercialLoan.interest2028;
      if (year > commGraceEndYear) return annualDS;
      return 0;
    };

    // graceInterestCarry = sum of IO for all pre-operational years.
    let commGraceInterestCarry = 0;
    for (let yr = HORIZON_START_YEAR; yr < OPENING_YEAR; yr++) {
      commGraceInterestCarry += commGetDS(yr);
    }

    // NOTE: no drawnBalanceFn for standard path — draw schedule is manually
    // calibrated via interest scalars and cannot be reliably inferred from
    // constructionStartYear. The amort schedule uses full loanAmount from the start.
    return {
      annualDS,
      loanAmount,
      equityRequired: equity,
      grantAmount: 0,
      effectiveInterestRate: rate,
      repaymentTermYears,
      graceEndYear: commGraceEndYear,
      graceInterestCarry: commGraceInterestCarry,
      getDS: commGetDS,
    };
  }

  if (path === 'grant') {
    const totalLand = computeTotalLand(a);
    const useLegacyAcqLegalGrant = a.portfolio.every((p) => p.acquisitionLegalRate == null);
    const acqLegal = useLegacyAcqLegalGrant
      ? a.acquisitionLegalPerPlot * totalPlots
      : a.portfolio.reduce((sum, p) => sum + (p.landCost * (p.acquisitionLegalRate ?? 0)) * p.count, 0);
    const nonPlotEligible = totalCost - totalLand - acqLegal;
    const grantAmt = nonPlotEligible * a.grant.grantRate;

    const phase1 = PHASE1_LAND_PERMITS;
    const phase1Loan = phase1 * a.commercialLoan.loanCoverageRate;
    const phase1Equity = phase1 - phase1Loan;

    const phase2Total = totalCost - phase1;
    const phase2AfterGrant = Math.max(0, phase2Total - grantAmt);
    const phase2Loan = phase2AfterGrant * a.commercialLoan.loanCoverageRate;
    const phase2Equity = phase2AfterGrant - phase2Loan;

    const remainingLoan = phase1Loan + phase2Loan;
    const equity = phase1Equity + phase2Equity;
    const annualDS = pmt(
      a.commercialLoan.interestRate,
      a.commercialLoan.repaymentTermYears,
      remainingLoan
    );
    const graceMode = a.commercialLoan.graceMode ?? 'standard';
    const rate = a.commercialLoan.interestRate;
    const repaymentTermYears = a.commercialLoan.repaymentTermYears;

    if (graceMode === 'rolling') {
      // Staged draw: plots tranche (phase1Loan) + 4 construction tranches (phase2Loan/4 each).
      // Same timing and amortStart convention as commercial rolling, grant-adjusted principal.
      const constQuarter = phase2Loan / 4;
      const pYear = a.commercialLoan.plotsStartYear        ?? HORIZON_START_YEAR;
      const pQ    = a.commercialLoan.plotsStartQ           ?? 1;
      const cYear = a.commercialLoan.constructionStartYear  ?? HORIZON_START_YEAR + 1;
      const cQ    = a.commercialLoan.constructionStartQ     ?? 1;
      function gAddQtrs(baseYear: number, baseQ: number, n: number) {
        const total = (baseQ - 1) + n;
        return { year: baseYear + Math.floor(total / 4), q: (total % 4) + 1 };
      }
      const t2 = gAddQtrs(cYear, cQ, 0);
      const t3 = gAddQtrs(cYear, cQ, 2);
      const t4 = gAddQtrs(cYear, cQ, 4);
      const t5 = gAddQtrs(cYear, cQ, 6);
      const gTranches = [
        { loan: phase1Loan,   disbYear: pYear,    disbQ: pQ,   amortStart: pYear    + 3 },
        { loan: constQuarter, disbYear: t2.year,  disbQ: t2.q, amortStart: t2.year  + 3 },
        { loan: constQuarter, disbYear: t3.year,  disbQ: t3.q, amortStart: t3.year  + 3 },
        { loan: constQuarter, disbYear: t4.year,  disbQ: t4.q, amortStart: t4.year  + 3 },
        { loan: constQuarter, disbYear: t5.year,  disbQ: t5.q, amortStart: t5.year  + 3 },
      ];
      function gTrDS(tr: typeof gTranches[0], year: number): number {
        if (year < tr.disbYear) return 0;
        if (year === tr.disbYear) return tr.loan * rate * (5 - tr.disbQ) / 4;
        if (year < tr.amortStart) return tr.loan * rate;
        return pmt(rate, repaymentTermYears, tr.loan);
      }
      const gRollingGetDS = (year: number): number =>
        gTranches.reduce((sum, tr) => sum + gTrDS(tr, year), 0);
      const gGraceEndYear = Math.max(...gTranches.map(tr => tr.amortStart - 1));
      const gFirstDisbYear = Math.min(...gTranches.map(tr => tr.disbYear));
      let gRollingCarry = 0;
      for (let yr = gFirstDisbYear; yr < OPENING_YEAR; yr++) gRollingCarry += gRollingGetDS(yr);
      const gRollingDrawnBalance = (year: number): number =>
        gTranches.filter(tr => tr.disbYear <= year).reduce((s, tr) => s + tr.loan, 0);

      // Commitment fee: applies only to construction tranches (T2–T5), not plots (T1)
      const gRollingCommitmentFeeByYear: Record<number, number> = {};
      const gRollingCommitFeeEnabled = a.commercialLoan.commitmentFeeEnabled ?? false;
      const gRollingCommitFeeRate = a.commercialLoan.commitmentFeeRate ?? 0.0075;
      if (gRollingCommitFeeEnabled) {
        const gConstructionTranches = gTranches.slice(1); // T2–T5, skip T1 (plots)
        for (let yr = cYear; yr <= HORIZON_END_YEAR; yr++) {
          let fee = 0;
          for (const tr of gConstructionTranches) {
            if (yr < tr.disbYear) {
              fee += tr.loan * gRollingCommitFeeRate;
            } else if (yr === tr.disbYear) {
              fee += tr.loan * gRollingCommitFeeRate * (tr.disbQ - 1) / 4;
            }
          }
          if (fee > 0) gRollingCommitmentFeeByYear[yr] = fee;
        }
      }

      return {
        annualDS,
        loanAmount: remainingLoan,
        equityRequired: equity,
        grantAmount: grantAmt,
        effectiveInterestRate: rate,
        repaymentTermYears,
        graceEndYear: gGraceEndYear,
        graceInterestCarry: gRollingCarry,
        firstAmortYear: Math.min(...gTranches.map(t => t.amortStart)),
        getDS: gRollingGetDS,
        drawnBalanceFn: gRollingDrawnBalance,
        rollingTranches: gTranches.map(tr => ({
          loan: tr.loan,
          disbYear: tr.disbYear,
          disbQ: tr.disbQ as 1 | 2 | 3 | 4,
          amortStart: tr.amortStart,
        })),
        commitmentFeeByYear: gRollingCommitmentFeeByYear,
      };
    }

    if (graceMode === 'two-phase') {
      // Block draw: phase1Loan (plots) and phase2Loan (construction after grant) drawn as two blocks.
      const p1Year = a.commercialLoan.plotsStartYear        ?? HORIZON_START_YEAR;
      const p1Q    = a.commercialLoan.plotsStartQ           ?? 1;
      const p2Year = a.commercialLoan.constructionStartYear  ?? HORIZON_START_YEAR + 1;
      const p2Q    = a.commercialLoan.constructionStartQ     ?? 1;
      const p1AmortStart = p1Year + 3;
      const p2AmortStart = p2Year + 3;
      const p1AnnualDS = pmt(rate, repaymentTermYears, phase1Loan);
      const p2AnnualDS = pmt(rate, repaymentTermYears, phase2Loan);
      function gBlockIO(loan: number, dYear: number, dQ: number, year: number, amortStart: number): number {
        if (year < dYear) return 0;
        if (year === dYear) return loan * rate * (5 - dQ) / 4;
        if (year < amortStart) return loan * rate;
        return 0;
      }
      const gTwoPhaseGetDS = (year: number): number =>
        gBlockIO(phase1Loan, p1Year, p1Q, year, p1AmortStart) +
        (year >= p1AmortStart ? p1AnnualDS : 0) +
        gBlockIO(phase2Loan, p2Year, p2Q, year, p2AmortStart) +
        (year >= p2AmortStart ? p2AnnualDS : 0);
      const gTpGraceEnd = Math.max(p1AmortStart, p2AmortStart) - 1;
      const gTpFirstYear = Math.min(p1Year, p2Year);
      let gTpCarry = 0;
      for (let yr = gTpFirstYear; yr < OPENING_YEAR; yr++) gTpCarry += gTwoPhaseGetDS(yr);
      const gTwoPhaseDrawnBalance = (year: number): number => {
        if (year < p1Year) return 0;
        if (year < p2Year) return phase1Loan;
        return remainingLoan;
      };
      return {
        annualDS: p1AnnualDS + p2AnnualDS,
        loanAmount: remainingLoan,
        equityRequired: equity,
        grantAmount: grantAmt,
        effectiveInterestRate: rate,
        repaymentTermYears,
        graceEndYear: gTpGraceEnd,
        graceInterestCarry: gTpCarry,
        firstAmortYear: Math.min(p1AmortStart, p2AmortStart),
        getDS: gTwoPhaseGetDS,
        drawnBalanceFn: gTwoPhaseDrawnBalance,
      };
    }

    // standard: use configured interest values for backward compatibility.
    const grantGracePeriodYears =
      a.grant.gracePeriodYears ?? a.commercialLoan.gracePeriodYears ?? 2;
    const grantGraceEndYear = HORIZON_START_YEAR + grantGracePeriodYears;
    const grantGetDS = (year: number) => {
      if (year === HORIZON_START_YEAR) return a.grant.interest2026 ?? 50625;
      if (year === HORIZON_START_YEAR + 1) return a.grant.interest2027 ?? 110544;
      if (year === grantGraceEndYear) return a.grant.interest2028 ?? 114109;
      if (year > grantGraceEndYear) return annualDS;
      return 0;
    };
    const grantGraceInterestCarry =
      grantGracePeriodYears === 0
        ? 0
        : grantGetDS(HORIZON_START_YEAR) +
          grantGetDS(HORIZON_START_YEAR + 1) +
          grantGetDS(grantGraceEndYear);
    return {
      annualDS,
      loanAmount: remainingLoan,
      equityRequired: equity,
      grantAmount: grantAmt,
      effectiveInterestRate: rate,
      repaymentTermYears,
      graceEndYear: grantGraceEndYear,
      graceInterestCarry: grantGraceInterestCarry,
      getDS: grantGetDS,
    };
  }

  if (path === 'rrf') {
    const totalLoan = totalCost * a.rrf.coverageRate;
    const equity = totalCost - totalLoan;
    const annualDS = 0; // fallback unused — computedDS below is always non-zero

    const rrfPortion = totalLoan * a.rrf.rrfShareOfLoan;
    const commPortion = totalLoan * a.rrf.commercialShareRate;
    const rrfAnnualDS = pmt(
      a.rrf.rrfInterestRate,
      a.rrf.repaymentTermYears,
      rrfPortion
    );
    const commAnnualDS = pmt(
      a.rrf.commercialInterestRate,
      a.rrf.repaymentTermYears,
      commPortion
    );
    const computedDS = rrfAnnualDS + commAnnualDS;

    const rrfBlendedRate =
      a.rrf.rrfShareOfLoan * a.rrf.rrfInterestRate +
      a.rrf.commercialShareRate * a.rrf.commercialInterestRate;
    const rrfGracePeriodYears = a.rrf?.gracePeriodYears ?? 2;
    const rrfGraceEndYear = HORIZON_START_YEAR + rrfGracePeriodYears;
    const rrfGetDS = (year: number) => {
      if (year === HORIZON_START_YEAR) return a.commercialLoan.interest2026;
      if (year === HORIZON_START_YEAR + 1) return a.commercialLoan.interest2027;
      if (year === rrfGraceEndYear) return a.commercialLoan.interest2028;
      if (year > rrfGraceEndYear) return computedDS || annualDS;
      return 0;
    };
    const rrfGraceInterestCarry =
      rrfGracePeriodYears === 0
        ? 0
        : rrfGetDS(HORIZON_START_YEAR) +
          rrfGetDS(HORIZON_START_YEAR + 1) +
          rrfGetDS(rrfGraceEndYear);
    return {
      annualDS: computedDS || annualDS,
      loanAmount: totalLoan,
      equityRequired: equity,
      grantAmount: 0,
      effectiveInterestRate: rrfBlendedRate,
      repaymentTermYears: a.rrf.repaymentTermYears,
      graceEndYear: rrfGraceEndYear,
      graceInterestCarry: rrfGraceInterestCarry,
      getDS: rrfGetDS,
    };
  }

  if (path === 'tepix-loan') {
    const tp = a.tepixLoan;
    const landCapRatio = tp.landCapOnFundContribution;

    const totalLand = computeTotalLand(a);
    // When properties carry acquisitionLegalRate, acq legal is folded into portfolioTotal as perUnit.
    // Compute the effective acqLegal total consistently with computeCapex.
    const useLegacyAcqLegalDS = a.portfolio.every((p) => p.acquisitionLegalRate == null);
    const acqLegal = useLegacyAcqLegalDS
      ? a.acquisitionLegalPerPlot * totalPlots
      : a.portfolio.reduce((sum, p) => sum + (p.landCost * (p.acquisitionLegalRate ?? 0)) * p.count, 0);
    const nonLandCost = totalCost - totalLand - acqLegal;

    // ── Unconstrained sizing (what TEPIX would lend if no program ceiling) ──
    const uncappedNonLandLoan = nonLandCost * tp.coverageRate;
    const uncappedLandFundedByTepix =
      (landCapRatio * uncappedNonLandLoan) / (1 - landCapRatio);
    const uncappedPrimaryLoan =
      uncappedNonLandLoan + uncappedLandFundedByTepix;

    // ── €8M TEPIX III program cap (per business, per HDB program rules) ──
    // Source: tepix/milestones.yaml meta.program.loan_amount_range_eur.max.
    // If the uncapped sizing exceeds 8M, clamp the primary loan and let the
    // shortfall flow through the existing landGap + nonLandCost residual
    // logic — extra land funding becomes commercial supplementary debt, and
    // extra non-land cost becomes sponsor equity. Surface tepixCapBindingBy
    // so the dashboard / investor page can call out the equity gap created
    // by the cap rather than silently understating financing capacity.
    const tepixCapBindingBy = Math.max(0, uncappedPrimaryLoan - TEPIX_LOAN_CAP_EUR);
    const primaryLoan = Math.min(uncappedPrimaryLoan, TEPIX_LOAN_CAP_EUR);

    // When the cap binds, preserve the program's land-cap ratio (HDB
    // requires a fixed fraction of the loan to fund land vs. non-land).
    // Both subcomponents shrink in lockstep so the 40/60 HDB/bank split
    // and the land/non-land split remain program-compliant.
    const nonLandLoan =
      tepixCapBindingBy > 0
        ? primaryLoan * (1 - landCapRatio)
        : uncappedNonLandLoan;
    const landFundedByTepix =
      tepixCapBindingBy > 0
        ? primaryLoan * landCapRatio
        : uncappedLandFundedByTepix;

    const landGap = Math.max(0, totalLand + acqLegal - landFundedByTepix);
    const suppLoanAmount = landGap * a.commercialLoan.loanCoverageRate;
    const suppEquity = landGap - suppLoanAmount;
    const suppAnnualDS = pmt(
      a.commercialLoan.interestRate,
      a.commercialLoan.repaymentTermYears,
      suppLoanAmount
    );

    const amortYears = tp.totalTermYears - tp.gracePeriodYears;
    const hdbPortion = primaryLoan * tp.hdbShareOfLoan;
    const bankPortion = primaryLoan * tp.bankShareOfLoan;
    const hdbAnnual = hdbPortion / amortYears;
    const bankAnnual = pmt(tp.bankInterestRate, amortYears, bankPortion);
    const primaryAnnualDS = hdbAnnual + bankAnnual;

    const primaryEquity = nonLandCost - nonLandLoan;
    const totalEquity = primaryEquity + suppEquity;
    const totalLoanDrawn = primaryLoan + suppLoanAmount;
    const combinedDS = primaryAnnualDS + suppAnnualDS;

    // Blended rate across HDB (0%) + bank portion of primary, weighted by the
    // overall loan share each portion represents (primary + supplementary).
    const tepixBlendedRate =
      totalLoanDrawn > 0
        ? (bankPortion * tp.bankInterestRate +
            suppLoanAmount * a.commercialLoan.interestRate) /
          totalLoanDrawn
        : 0;
    const tepixGracePeriodYears = tp.gracePeriodYears ?? 2;
    const tepixGraceEndYear = HORIZON_START_YEAR + tepixGracePeriodYears;
    const tepixGetDS = (year: number) => {
      if (year <= HORIZON_START_YEAR + (tp.subsidyDurationYears ?? 2) - 1) {
        const subsidisedRate = Math.max(0, tp.bankInterestRate - tp.interestSubsidy);
        const tepixInterest = bankPortion * subsidisedRate;
        const suppInterest = suppLoanAmount * a.commercialLoan.interestRate;
        return tepixInterest + suppInterest;
      }
      if (year === tepixGraceEndYear) {
        // Opening/grace year. Primary TEPIX tranche starts full
        // amortisation (program-defined), but the supplementary commercial
        // loan follows the commercial-path convention: interest-only in the
        // grace year, full amortisation from the following year (Finding J).
        const suppInterest = suppLoanAmount * a.commercialLoan.interestRate;
        return primaryAnnualDS + suppInterest;
      }
      if (year > tepixGraceEndYear) return combinedDS;
      return 0;
    };
    const tepixGraceInterestCarry =
      tepixGracePeriodYears === 0
        ? 0
        : tepixGetDS(HORIZON_START_YEAR) +
          tepixGetDS(HORIZON_START_YEAR + 1) +
          tepixGetDS(tepixGraceEndYear);
    return {
      annualDS: combinedDS,
      loanAmount: totalLoanDrawn,
      equityRequired: totalEquity,
      grantAmount: 0,
      effectiveInterestRate: tepixBlendedRate,
      repaymentTermYears: amortYears,
      primaryLoan,
      supplementaryLoan: suppLoanAmount,
      supplementaryAnnualDS: suppAnnualDS,
      landFundedByTepix,
      landFundedByCommercial: landGap,
      tepixCapBindingBy,
      tepixLoanCap: TEPIX_LOAN_CAP_EUR,
      graceEndYear: tepixGraceEndYear,
      graceInterestCarry: tepixGraceInterestCarry,
      getDS: tepixGetDS,
    };
  }

  if (path === 'optima') {
    const op = a.optimaLoan;

    // If OptimaLoanParams is absent (old scenario without the field), fall back
    // to a zero debt service result so no existing scenario is broken.
    if (!op) {
      return {
        annualDS: 0,
        loanAmount: 0,
        equityRequired: totalCost,
        grantAmount: 0,
        effectiveInterestRate: 0,
        repaymentTermYears: 10,
        graceEndYear: HORIZON_START_YEAR + 2,
        graceInterestCarry: 0,
        getDS: () => 0,
      };
    }

    const effectiveRate = op.euriborRate + op.spreadBps / 10_000;

    // Translate the CAPEX: absorb ineligible soft costs into construction.
    const translatedCapex = optimaCapexView(capex, op.absorb);

    // Loan = coverage rate × total project CAPEX (70% LTC per Optima Bank terms).
    // The old construction-cap approach (maxConstructionRatio) is informational only —
    // it no longer drives the loan amount.
    const loanCoverage = op.loanCoverageRate ?? 0.70;
    const totalLoan = translatedCapex.portfolioTotal * loanCoverage;

    // Split total loan into two sub-projects proportional to each sub-project's
    // share of total CAPEX. Falls back to 50/50 when no allocation is set.
    let rawSubA: number;
    let rawSubB: number;

    if (op.subProjectAllocation && Object.keys(op.subProjectAllocation).length > 0) {
      // Sum CAPEX (all categories) per sub-project using per-unit allocation.
      const propCountMap = Object.fromEntries(translatedCapex.properties.map(p => [p.id, p.count]));
      const perPropTotal: Record<string, number> = {};
      for (const cat of translatedCapex.categories) {
        for (const pp of cat.perProperty) {
          perPropTotal[pp.id] = (perPropTotal[pp.id] ?? 0) + pp.total;
        }
      }
      let capexA = 0;
      let capexB = 0;
      for (const [propId, total] of Object.entries(perPropTotal)) {
        const count = propCountMap[propId] ?? 1;
        const { a, b } = countUnitsBySide(op.subProjectAllocation, propId, count);
        capexA += total * (a / count);
        capexB += total * (b / count);
      }
      const capexTotal = capexA + capexB;
      rawSubA = capexTotal > 0 ? totalLoan * (capexA / capexTotal) : totalLoan / 2;
      rawSubB = totalLoan - rawSubA;
    } else {
      rawSubA = totalLoan / 2;
      rawSubB = totalLoan / 2;
    }

    const subA = Math.min(rawSubA, op.splitThresholdEur);
    const subB = rawSubB;

    const annualDS_A = pmt(effectiveRate, op.repaymentYears, subA);
    const annualDS_B = pmt(effectiveRate, op.repaymentYears, subB);
    const annualDS = annualDS_A + annualDS_B;

    const loanAmount = subA + subB; // = translatedConstructionCost
    const equityRequired = capex.portfolioTotal - loanAmount;

    const optimaGraceEndYear = HORIZON_START_YEAR + op.gracePeriodYears;
    const graceInterestPerYear = loanAmount * effectiveRate;
    const graceMode = a.commercialLoan.graceMode ?? 'standard';

    // ── Staged draw (rolling): subA drawn at signing + subB in 4 tranches, each
    //    with its own grace period. Later tranches start amortising in 2030-2031,
    //    producing a stepped DS profile and higher DSCR in early operational years.
    if (graceMode === 'rolling') {
      const oRepayYears = op.repaymentYears;
      const cYear = a.commercialLoan.constructionStartYear ?? HORIZON_START_YEAR + 1;
      const cQ    = a.commercialLoan.constructionStartQ    ?? 1;
      function oAddQtrs(baseYear: number, baseQ: number, n: number) {
        const total = (baseQ - 1) + n;
        return { year: baseYear + Math.floor(total / 4), q: (total % 4) + 1 };
      }
      const ot2 = oAddQtrs(cYear, cQ, 0);
      const ot3 = oAddQtrs(cYear, cQ, 2);
      const ot4 = oAddQtrs(cYear, cQ, 4);
      const ot5 = oAddQtrs(cYear, cQ, 6);
      const subBQuarter = subB / 4;
      const oTranches = [
        { loan: subA,         disbYear: HORIZON_START_YEAR, disbQ: 1,     amortStart: HORIZON_START_YEAR + op.gracePeriodYears + 1 },
        { loan: subBQuarter,  disbYear: ot2.year,           disbQ: ot2.q, amortStart: ot2.year + op.gracePeriodYears + 1 },
        { loan: subBQuarter,  disbYear: ot3.year,           disbQ: ot3.q, amortStart: ot3.year + op.gracePeriodYears + 1 },
        { loan: subBQuarter,  disbYear: ot4.year,           disbQ: ot4.q, amortStart: ot4.year + op.gracePeriodYears + 1 },
        { loan: subBQuarter,  disbYear: ot5.year,           disbQ: ot5.q, amortStart: ot5.year + op.gracePeriodYears + 1 },
      ];
      function oTrDS(tr: typeof oTranches[0], year: number): number {
        if (year < tr.disbYear) return 0;
        if (year === tr.disbYear) return tr.loan * effectiveRate * (5 - tr.disbQ) / 4;
        if (year < tr.amortStart) return tr.loan * effectiveRate;
        return pmt(effectiveRate, oRepayYears, tr.loan);
      }
      const oRollingGetDS = (year: number): number =>
        oTranches.reduce((sum, tr) => sum + oTrDS(tr, year), 0);
      const oGraceEndYear = Math.max(...oTranches.map(tr => tr.amortStart - 1));
      const oFirstDisb = Math.min(...oTranches.map(tr => tr.disbYear));
      let oRollingCarry = 0;
      for (let yr = oFirstDisb; yr < OPENING_YEAR; yr++) oRollingCarry += oRollingGetDS(yr);
      return {
        annualDS,
        loanAmount,
        equityRequired,
        grantAmount: 0,
        effectiveInterestRate: effectiveRate,
        repaymentTermYears: op.repaymentYears,
        graceEndYear: oGraceEndYear,
        graceInterestCarry: oRollingCarry,
        firstAmortYear: Math.min(...oTranches.map(t => t.amortStart)),
        getDS: oRollingGetDS,
      };
    }

    // ── Block draw (two-phase): full loan committed from construction start,
    //    interest on full amount throughout grace period (no ramp).
    if (graceMode === 'two-phase') {
      const oBlockGetDS = (year: number): number => {
        if (year >= HORIZON_START_YEAR && year <= optimaGraceEndYear) return graceInterestPerYear;
        if (year > optimaGraceEndYear) return annualDS;
        return 0;
      };
      const oBlockCarry = op.gracePeriodYears === 0
        ? 0
        : oBlockGetDS(HORIZON_START_YEAR) +
          oBlockGetDS(HORIZON_START_YEAR + 1) +
          oBlockGetDS(optimaGraceEndYear);
      return {
        annualDS,
        loanAmount,
        equityRequired,
        grantAmount: 0,
        effectiveInterestRate: effectiveRate,
        repaymentTermYears: op.repaymentYears,
        graceEndYear: optimaGraceEndYear,
        graceInterestCarry: oBlockCarry,
        getDS: oBlockGetDS,
      };
    }

    // ── Standard (default): ramp draw 20 % → 60 % → 100 % of grace interest.
    const optimaGetDS = (year: number): number => {
      if (year >= HORIZON_START_YEAR && year <= optimaGraceEndYear) {
        if (year === HORIZON_START_YEAR) return graceInterestPerYear * 0.20;
        if (year === HORIZON_START_YEAR + 1) return graceInterestPerYear * 0.60;
        if (year === optimaGraceEndYear) return graceInterestPerYear;
        return graceInterestPerYear;
      }
      if (year > optimaGraceEndYear) return annualDS;
      return 0;
    };

    const graceInterestCarry =
      op.gracePeriodYears === 0
        ? 0
        : optimaGetDS(HORIZON_START_YEAR) +
          optimaGetDS(HORIZON_START_YEAR + 1) +
          optimaGetDS(optimaGraceEndYear);

    return {
      annualDS,
      loanAmount,
      equityRequired,
      grantAmount: 0,
      effectiveInterestRate: effectiveRate,
      repaymentTermYears: op.repaymentYears,
      graceEndYear: optimaGraceEndYear,
      graceInterestCarry,
      getDS: optimaGetDS,
    };
  }

  // Exhaustiveness guard: every FinancingPath must have a branch above.
  throw new Error(`Unhandled financing path: ${path as string}`);
}

// ────────────────────────────────────────────
// OPTIMA HELPERS
// ────────────────────────────────────────────

/**
 * Resolve the sub-project side for a single unit of a property.
 * Checks the per-unit key `{propId}__u{unitIndex}` first, then falls back
 * to the legacy per-property key `{propId}`, then defaults to 'B'.
 * This lets multi-unit projects split individual units across sub-projects.
 */
function resolveUnitSide(
  allocation: Record<string, 'A' | 'B'>,
  propId: string,
  unitIndex: number
): 'A' | 'B' {
  return allocation[`${propId}__u${unitIndex}`] ?? allocation[propId] ?? 'B';
}

/**
 * Count how many units of a property are allocated to each sub-project.
 * Falls back gracefully for count=1 properties and legacy (non-per-unit) keys.
 */
function countUnitsBySide(
  allocation: Record<string, 'A' | 'B'>,
  propId: string,
  count: number
): { a: number; b: number } {
  let a = 0, b = 0;
  for (let i = 0; i < count; i++) {
    if (resolveUnitSide(allocation, propId, i) === 'A') a++; else b++;
  }
  return { a, b };
}

// ────────────────────────────────────────────
// OPTIMA CAP RESULT HELPER
// ────────────────────────────────────────────

export interface OptimaCapResult {
  applied: boolean;
  /** Construction cost / portfolio total — after cap applied */
  ratio: number;
  /** Raw construction / portfolio total — before cap */
  rawConstructionRatio: number;
  maxRatio: number;
  reductionEur: number;   // 0 when cap not applied
  /** Total CAPEX (all categories) per sub-project — for display as "Total Investment" */
  subProjectTotalsPreCap: { A: number; B: number };
  /** Construction CAPEX per sub-project — for loan proportioning */
  subProjectConstructionPreCap: { A: number; B: number };
  /** Capped loan per sub-project (respects splitThresholdEur per project) */
  subProjectLoans: { A: number; B: number };
  /** Total capped construction = total Optima loan */
  cappedConstruction: number;
  rawConstruction: number;
}

export function computeOptimaCapResult(
  capex: CapexBreakdown,
  op: OptimaLoanParams,
): OptimaCapResult {
  const translated = optimaCapexView(capex, op.absorb);
  const CONST_KW = ['building', 'excavation', 'construction'];

  // Raw construction total (for admin ratio indicator only — does NOT drive loan).
  const rawConstruction = translated.categories
    .filter((c) => CONST_KW.some((kw) => c.name.toLowerCase().includes(kw)))
    .reduce((sum, c) => sum + c.grandTotal, 0);
  const maxRatio = op.maxConstructionRatio ?? 0.60;

  // Total CAPEX per sub-project (all categories, by per-unit allocation).
  const propCountMap = Object.fromEntries(capex.properties.map(p => [p.id, p.count]));
  let sumA = 0;
  let sumB = 0;
  if (op.subProjectAllocation && Object.keys(op.subProjectAllocation).length > 0) {
    const perPropTotal: Record<string, number> = {};
    for (const cat of translated.categories) {
      for (const pp of (cat as { name: string; grandTotal: number; perProperty: { id: string; perUnit: number; total: number }[] }).perProperty ?? []) {
        perPropTotal[pp.id] = (perPropTotal[pp.id] ?? 0) + pp.total;
      }
    }
    for (const [propId, total] of Object.entries(perPropTotal)) {
      const count = propCountMap[propId] ?? 1;
      const { a, b } = countUnitsBySide(op.subProjectAllocation, propId, count);
      sumA += total * (a / count);
      sumB += total * (b / count);
    }
  } else {
    sumA = translated.portfolioTotal / 2;
    sumB = translated.portfolioTotal / 2;
  }

  // Construction CAPEX per sub-project (retained for subProjectConstructionPreCap).
  let constrA = 0;
  let constrB = 0;
  if (op.subProjectAllocation && Object.keys(op.subProjectAllocation).length > 0) {
    for (const cat of translated.categories) {
      if (!CONST_KW.some((kw) => cat.name.toLowerCase().includes(kw))) continue;
      for (const pp of (cat as { name: string; grandTotal: number; perProperty: { id: string; perUnit: number; total: number }[] }).perProperty ?? []) {
        const count = propCountMap[pp.id] ?? 1;
        const { a, b } = countUnitsBySide(op.subProjectAllocation, pp.id, count);
        constrA += pp.perUnit * a;
        constrB += pp.perUnit * b;
      }
    }
  } else {
    constrA = rawConstruction / 2;
    constrB = rawConstruction / 2;
  }

  // Loan = loanCoverageRate × portfolioTotal, split proportionally by sub-project CAPEX.
  const loanCoverage = op.loanCoverageRate ?? 0.70;
  const totalLoan = translated.portfolioTotal * loanCoverage;
  const capexTotal = sumA + sumB;
  const rawLoanA = capexTotal > 0 ? totalLoan * (sumA / capexTotal) : totalLoan / 2;
  const rawLoanB = totalLoan - rawLoanA;
  const splitThresh = op.splitThresholdEur ?? 6_000_000;
  const loanA = Math.min(rawLoanA, splitThresh);
  const loanB = rawLoanB;

  return {
    applied: false,  // construction cap no longer drives loan — always false
    ratio: loanCoverage,
    rawConstructionRatio: translated.portfolioTotal > 0 ? rawConstruction / translated.portfolioTotal : 0,
    maxRatio,
    reductionEur: 0,
    subProjectTotalsPreCap: { A: sumA, B: sumB },
    subProjectConstructionPreCap: { A: constrA, B: constrB },
    subProjectLoans: { A: loanA, B: loanB },
    cappedConstruction: rawConstruction,
    rawConstruction,
  };
}

// ────────────────────────────────────────────
// P&L TIMELINE COMPUTATION
// ────────────────────────────────────────────

function computeNights(
  year: number,
  baseNights: number,
  growthPerYear: number,
  cap: number
): number {
  if (year <= HORIZON_START_YEAR + 1) return 0;
  if (year <= FIRST_OPERATIONAL_YEAR) return baseNights;
  return Math.min(cap, baseNights + Math.max(0, year - NIGHTS_GROWTH_BASE_YEAR) * growthPerYear);
}

function computeRampFactor(year: number, a: ModelAssumptions): number {
  if (year === OPENING_YEAR) return a.general.year1RampFactor;
  if (year === FIRST_OPERATIONAL_YEAR) return a.general.year2RampFactor;
  if (year >= MIN_EXIT_YEAR) return 1;
  return 0;
}

// Returns controllable OpEx only (housekeeping, utilities, insurance, property tax,
// marketing, consumables, accounting, extra lines) with the opexContingencyRate
// multiplier applied. FF&E Reserve is excluded — it is computed separately in the
// propertyBreakdown map as max(ffeReserveFloor, rate% × revenuePerUnit).
// managementFee is intentionally excluded: it is accounted for in OpCo and must
// not appear twice (deprecated field; always 0 in current templates).
function computeOpexForProperty(
  year: number,
  prop: PropertyConfig
): number {
  if (year < OPENING_YEAR) return 0;

  const controllableOpex =
    prop.opex.housekeeping +
    prop.opex.utilities +
    prop.opex.insurance +
    prop.opex.propertyTax +
    prop.opex.marketing +
    prop.opex.consumables +
    prop.opex.accounting +
    (prop.extraOpexLines ?? []).reduce((s, l) => s + (l.value || 0), 0);

  // Contingency applies only to controllable OPEX
  return controllableOpex * (1 + (prop.opexContingencyRate ?? 0));
}

// Compute portfolio-level (undistributed) OPEX for a given year.
// Returns a zero object for pre-construction years.
// NOTE: opexContingencyRate must NEVER be applied here — that multiplier is
// per-template only. This is a separate code path.
export function computePortfolioOpex(year: number, assumptions: ModelAssumptions): PortfolioOpexOutput {
  const ZERO: PortfolioOpexOutput = {
    staffTotal: 0, servicesTotal: 0, overheadTotal: 0,
    preOpeningAmort: 0, constructionServicesExpense: 0,
    total: 0, yearRoundFixed: 0, variable: 0,
  };
  // TODO: apply inflationHook escalator when activated
  const po = assumptions.portfolioOpex ?? DEFAULT_PORTFOLIO_OPEX;

  // Pre-opening years: staff/services/overhead are zero (not yet operational).
  // Two cost types may apply:
  //   1. preOpeningAmort — if amortisation starts before OPENING_YEAR
  //   2. constructionServicesExpense — professional service fees expensed as incurred
  //      (lawyers for permits/contracts, PM consultants, financial/tax advisors).
  //      Deductible under Article 22, Law 4172/2013; enters the Article 27 loss pool.
  if (year < OPENING_YEAR) {
    const preOpeningAmort =
      year >= po.preOpeningStartYear && year < po.preOpeningStartYear + po.preOpeningAmortYears
        ? po.preOpeningTotal / po.preOpeningAmortYears
        : 0;
    const numConstructionYears = OPENING_YEAR - HORIZON_START_YEAR; // 3 years: 2026–2028
    const constructionServicesExpense =
      numConstructionYears > 0
        ? (po.constructionServicesExpensed ?? 0) / numConstructionYears
        : 0;
    const total = preOpeningAmort + constructionServicesExpense;
    return { ...ZERO, preOpeningAmort, constructionServicesExpense, total };
  }

  const staffTotal = po.staffRoles.reduce((sum, role) => {
    const count = role.headcount ?? 1;
    // baseMonths: calendar months actually worked (12 for year-round, N for seasonal)
    const baseMonths = role.yearRound
      ? role.monthsPaid
      : (role.seasonalMonths ?? role.monthsPaid);
    // Greek statutory holiday bonus: (contractMonths / 12) × 2
    //   Christmas allowance (1 month) + Easter allowance (½) + Annual-leave allowance (½) = 2
    //   All roles — year-round or seasonal — receive this pro-rata by law.
    //   Formula is deterministic from contractMonths; ignores any stored bonusMonths field.
    const bonusM = baseMonths * (2 / 12);
    const effectiveMonths = baseMonths + bonusM; // = baseMonths × (14/12)
    return sum + role.monthlyGross * effectiveMonths * role.burdenMultiplier * count + role.allowances * count;
  }, 0);

  // Pool R&M uses top-level poolCount × poolCostPerUnit (annualCost on the line is ignored).
  // Other service lines: if unitCount + costPerUnit are set, use unitCount × costPerUnit;
  // otherwise fall through to annualCost.
  const poolRMCost = (po.poolCount ?? 17) * (po.poolCostPerUnit ?? 1500);
  const servicesTotal = po.sharedServices.reduce((sum, s) => {
    if (s.name === 'Pool R&M') return sum + poolRMCost;
    if (s.unitCount !== undefined && s.costPerUnit !== undefined) return sum + s.unitCount * s.costPerUnit;
    return sum + s.annualCost;
  }, 0);
  const overheadTotal = po.sharedOverhead.reduce((sum, s) => sum + s.annualCost, 0);

  const preOpeningAmort =
    year >= po.preOpeningStartYear && year < po.preOpeningStartYear + po.preOpeningAmortYears
      ? po.preOpeningTotal / po.preOpeningAmortYears
      : 0;

  const total = staffTotal + servicesTotal + overheadTotal + preOpeningAmort;

  // ── Per-project allocation accumulator ──────────────────────────────────
  // Accumulate resolvedCost × fraction for each line that carries projectAllocations.
  // Pre-opening amort is portfolio-wide (no per-project split).
  const allocAccumulator: Record<string, number> = {};
  let hasAnyAllocation = false;

  // Staff roles
  for (const role of po.staffRoles) {
    if (!role.projectAllocations || Object.keys(role.projectAllocations).length === 0) continue;
    const count = role.headcount ?? 1;
    const baseMonths = role.yearRound
      ? role.monthsPaid
      : (role.seasonalMonths ?? role.monthsPaid);
    const bonusM = baseMonths * (2 / 12);
    const effectiveMonths = baseMonths + bonusM;
    const resolvedCost = role.monthlyGross * effectiveMonths * role.burdenMultiplier * count + role.allowances * count;
    for (const [projId, fraction] of Object.entries(role.projectAllocations)) {
      if (!fraction) continue;
      hasAnyAllocation = true;
      allocAccumulator[projId] = (allocAccumulator[projId] ?? 0) + resolvedCost * fraction;
    }
  }

  // Shared services
  for (const s of po.sharedServices) {
    if (!s.projectAllocations || Object.keys(s.projectAllocations).length === 0) continue;
    let resolvedCost: number;
    if (s.name === 'Pool R&M') {
      resolvedCost = poolRMCost;
    } else if (s.unitCount !== undefined && s.costPerUnit !== undefined) {
      resolvedCost = s.unitCount * s.costPerUnit;
    } else {
      resolvedCost = s.annualCost;
    }
    for (const [projId, fraction] of Object.entries(s.projectAllocations)) {
      if (!fraction) continue;
      hasAnyAllocation = true;
      allocAccumulator[projId] = (allocAccumulator[projId] ?? 0) + resolvedCost * fraction;
    }
  }

  // Shared overhead
  for (const line of po.sharedOverhead) {
    if (!line.projectAllocations || Object.keys(line.projectAllocations).length === 0) continue;
    const resolvedCost = line.annualCost;
    for (const [projId, fraction] of Object.entries(line.projectAllocations)) {
      if (!fraction) continue;
      hasAnyAllocation = true;
      allocAccumulator[projId] = (allocAccumulator[projId] ?? 0) + resolvedCost * fraction;
    }
  }

  const allocatedByProject = hasAnyAllocation ? allocAccumulator : undefined;

  return {
    staffTotal,
    servicesTotal,
    overheadTotal,
    preOpeningAmort,
    constructionServicesExpense: 0, // only non-zero in pre-opening years
    total,
    yearRoundFixed: staffTotal + overheadTotal,
    variable: servicesTotal,
    allocatedByProject,
  };
}

function getPhaseLabel(year: number): string {
  if (year === HORIZON_START_YEAR) return 'Acquisition';
  if (year === HORIZON_START_YEAR + 1) return 'Construction';
  if (year === OPENING_YEAR) return 'Opening';
  if (year === FIRST_OPERATIONAL_YEAR) return 'Year 2';
  return 'Stabilised';
}

function computeScenario(
  name: string,
  a: ModelAssumptions,
  rev: RevenueAssumptions,
  debtResult: DebtServiceResult,
  downside?: { occupancyFactor: number; adrFactor: number; events: number },
  capex?: CapexBreakdown
): ScenarioOutput {
  const years = Array.from({ length: HORIZON_END_YEAR - HORIZON_START_YEAR + 1 }, (_, i) => HORIZON_START_YEAR + i);

  // Per-year P&L compute, parameterised by the year's WC interest expense.
  // Run twice: once with zero WC interest to derive cumulative cash for the
  // WC drawdown decisions, then again with the resulting WC schedule applied.
  // The interest delta between passes is small (~€5K/yr at most) so the
  // single-iteration approximation is well within rounding noise.
  const opCo = a.opCoFee;
  const opCoEnabled = !!opCo?.enabled;

  const graceEndYear = debtResult.graceEndYear;
  const preAmortSchedule = debtResult.rollingTranches
    ? buildRollingAmortSchedule(
        debtResult.rollingTranches,
        debtResult.effectiveInterestRate,
        debtResult.repaymentTermYears,
        HORIZON_START_YEAR,
        HORIZON_END_YEAR
      )
    : buildAmortSchedule(
        debtResult.loanAmount,
        debtResult.effectiveInterestRate,
        debtResult.annualDS,
        debtResult.getDS,
        HORIZON_START_YEAR,
        HORIZON_END_YEAR,
        graceEndYear,
        debtResult.drawnBalanceFn
      );

  // Annual straight-line depreciation deductible for CIT (Art. 24, Law 4172/2013).
  // Available as a closure variable inside computePnLYear.
  // Falls back to zero when capex is not provided (e.g. isolated unit tests).
  const annualDepreciation = capex?.annualDepreciationTotal ?? 0;

  const computePnLYear = (
    year: number,
    wcInterestExpense: number,
    floorAccrualIn: number = 0,
  ): Omit<AnnualPnL,
    'cumulativeNCF' | 'cumulativeYieldOnInitialEquity' |
    'termLoanInterest' | 'termLoanPrincipal' | 'termLoanBalance' |
    'interestCoverageRatio' | 'wcAvgBalance' |
    'wcPeakBalance' | 'wcTroughBalance' | 'wcNetContribution' |
    'wcSelfLiquidatingViolation'
  > => {
    const villaNights = computeNights(
      year,
      rev.villaBaseNights,
      a.general.nightsGrowthPerYear,
      a.general.nightsCap
    );
    const suiteNights = computeNights(
      year,
      rev.suiteBaseNights,
      a.general.nightsGrowthPerYear,
      a.general.nightsCap
    );

    const ramp = computeRampFactor(year, a);

    const effVillaNights = downside
      ? villaNights * (1 - downside.occupancyFactor)
      : villaNights;
    const effSuiteNights = downside
      ? suiteNights * (1 - downside.occupancyFactor)
      : suiteNights;
    const effVillaADR = downside
      ? rev.villaADR * (1 - downside.adrFactor)
      : rev.villaADR;
    const effStdADR = downside
      ? rev.suiteStandardADR * (1 - downside.adrFactor)
      : rev.suiteStandardADR;
    const effDblADR = downside
      ? rev.suiteDoubleADR * (1 - downside.adrFactor)
      : rev.suiteDoubleADR;
    const effEvents = downside ? downside.events : rev.eventsPerYear;

    // Revenue & OPEX per property using unit mix
    const propertyBreakdown: PropertyPnLLine[] = a.portfolio.map((prop) => {
      let revenuePerUnit = 0;
      if (year > HORIZON_START_YEAR + 1) {
        // Villa revenue: villaUnits x nights x ADR
        const villaRev = prop.villaUnits * effVillaNights * effVillaADR;
        // Suite revenue: each room type x nights x ADR
        const suiteRev =
          prop.standardSuites * effSuiteNights * effStdADR +
          prop.doubleSuites * effSuiteNights * effDblADR;
        revenuePerUnit = (villaRev + suiteRev) * ramp;
      }

      // Controllable OpEx (no FF&E Reserve, no managementFee)
      const controllableOpexPerUnit = computeOpexForProperty(year, prop);

      // FF&E Reserve: max(ffeReserveFloor, rate% × revenuePerUnit).
      // Rate schedule driven by a.ffeSchedule (editable); defaults to 2/3/4%.
      // Opening year (2029): zero (reserve not yet accumulating). Pre-opening: zero.
      const ffeReserveFloor = prop.opex.ffeReserveFloor ?? 0;
      const ffe = a.ffeSchedule;
      const ffeReserveRatePct =
        year < OPENING_YEAR ? 0 :
        year === OPENING_YEAR ? 0 :
        year === FIRST_OPERATIONAL_YEAR ? (ffe?.rate2029 ?? 0.02) :
        year === FIRST_OPERATIONAL_YEAR + 1 ? (ffe?.rate2030 ?? 0.03) :
        (ffe?.rateStabilised ?? 0.04);
      // Floor fires in any operational year (>= OPENING_YEAR); zero before.
      const ffeReservePerUnit = year < FIRST_OPERATIONAL_YEAR
        ? 0
        : Math.max(ffeReserveFloor, ffeReserveRatePct * revenuePerUnit);

      const opexPerUnit = controllableOpexPerUnit + ffeReservePerUnit;

      return {
        id: prop.id,
        name: prop.name,
        displayType: getPropertyDisplayType(prop),
        villaUnits: prop.villaUnits,
        standardSuites: prop.standardSuites,
        doubleSuites: prop.doubleSuites,
        count: prop.count,
        revenuePerUnit,
        totalRevenue: revenuePerUnit * prop.count,
        opexPerUnit,
        ffeReservePerUnit,
        totalOpex: year < OPENING_YEAR ? 0 : opexPerUnit * prop.count,
      };
    });

    const revenueEvents =
      year <= HORIZON_START_YEAR + 1 ? 0 : effEvents * rev.netProfitPerEvent * ramp;
    const ancillaryYearOffset = year - OPENING_YEAR;
    const ancillaryGrowthExponent = Math.min(
      Math.max(0, ancillaryYearOffset),
      Math.max(0, rev.ancillaryGrowthYears)
    );
    const revenueAncillary =
      year < OPENING_YEAR
        ? 0
        : rev.ancillaryBaseProfit *
          Math.pow(1 + rev.ancillaryGrowthRate, ancillaryGrowthExponent);
    const revenueAncillaryCapped =
      year >= OPENING_YEAR &&
      rev.ancillaryGrowthRate > 0 &&
      ancillaryYearOffset >= rev.ancillaryGrowthYears;

    const roomRevenue = propertyBreakdown.reduce((sum, p) => sum + p.totalRevenue, 0);
    const totalRevenue = roomRevenue + revenueEvents + revenueAncillary;

    // Effective OTA rate = commissionRate(year) × otaShare(year).
    // otaShare(year) = max(0, otaShare_year1 − yearsSinceOpening × declinePerYear)
    //   — auto-derived from two scalars unless a per-year override exists.
    // Side-effect: grossRevenue feeds into VAT — a lower otaShare shrinks grossRevenue
    // and therefore reduces VAT payable (correct: direct-channel has no OTA gross-up).
    const commissionRate =
      a.tax.otaCommissionRateByYear?.[year] ?? a.tax.otaCommissionRate ?? 0;
    const otaShareBase    = a.tax.otaShare ?? 1.0;
    const otaShareDecline = a.tax.otaShareDeclinePerYear ?? 0;
    const yearsSinceOpening = Math.max(0, year - OPENING_YEAR);
    const directShareGrown = Math.min(1, Math.max(0, (1 - otaShareBase) + yearsSinceOpening * otaShareDecline));
    const directShareCap = a.tax.otaShareCap;
    const directShareCapped = directShareCap !== undefined ? Math.min(directShareCap, directShareGrown) : directShareGrown;
    const otaShareAuto = Math.max(0, 1 - directShareCapped);
    const otaShare = a.tax.otaShareByYear?.[year] ?? otaShareAuto;
    const effectiveOtaRate = commissionRate * otaShare;
    const grossRevenue = effectiveOtaRate > 0 && year > HORIZON_START_YEAR + 1
      ? totalRevenue / (1 - effectiveOtaRate)
      : totalRevenue;
    const otaCommissions = grossRevenue - totalRevenue; // positive number (will be negated in output)

    const propertyOpexAll = propertyBreakdown.reduce(
      (sum, p) => sum + p.totalOpex,
      0
    );

    // Per-villa managementFee aggregated across the portfolio. Always 0 in the
    // current model (managementFee is deprecated and set to 0 in all templates).
    // Retained for backward-compat; safe to sum because managementFee is optional.
    const perVillaMgmtFeeTotal =
      year < OPENING_YEAR
        ? 0
        : a.portfolio.reduce(
            (sum, prop) => sum + (prop.opex.managementFee ?? 0) * prop.count,
            0,
          );

    // OpEx that flows into ebitdaPreOpCo. Strip the deprecated per-villa
    // managementFee (always 0) from propertyOpex. The floor is NO LONGER in
    // OpEx — DS is senior to the floor, floor is paid post-DS from residual.
    const propertyOpex = propertyOpexAll - perVillaMgmtFeeTotal;

    // Portfolio OPEX (undistributed shared overhead — staff, services, overhead, pre-opening amort).
    // NOTE: opexContingencyRate does NOT apply to portfolio OPEX — separate code path.
    const portfolioOpexResult = computePortfolioOpex(year, a);

    // WC interest is a real cash cost but must NOT reduce ebitdaPreOpCo, which
    // is the DSCR numerator. It is excluded from totalOpex here and instead
    // deducted explicitly from ncf and cfads downstream (Finding A fix).
    const totalOpex = propertyOpex + portfolioOpexResult.total;

    // ebitdaPreOpCo = true gross margin before any OpCo cost.
    // The floor is now post-DS, so this is the unencumbered DSCR numerator.
    // WC interest is NOT in ebitdaPreOpCo — it belongs in the DSCR denominator
    // only (via dscrLoaded) and is deducted below when computing ncf/cfads.
    const ebitdaPreOpCo = totalRevenue - totalOpex;

    const ds = debtResult.getDS(year);

    // Commitment fee on undrawn construction tranches (admin-only, suppressed in bank view).
    // Computed before the floor waterfall so residualAfterDS uses the total debt cost.
    const rawCommitmentFee = debtResult.commitmentFeeByYear?.[year] ?? 0;
    const commitmentFee = (a.viewMode !== 'bank') ? rawCommitmentFee : 0;
    const totalDS = ds + commitmentFee;

    // ── DS is senior. Floor obligation (current year + any prior accrual) paid
    // first from post-DS residual. Junior tiers paid from what remains.
    // Unpaid floor accrues.
    //
    // Backward-compat: read opCoFloor ?? opCoSeniorFloor ?? 0 so existing
    // Firestore scenarios that still carry opCoSeniorFloor are not silently broken.
    const totalVillaCount = a.portfolio.reduce((sum, prop) => sum + prop.count, 0);
    const currentYearFloor =
      year >= OPENING_YEAR && opCoEnabled
        ? ((a.opCoFloor ?? a.opCoSeniorFloor ?? 0) * totalVillaCount)
        : 0;
    // opCoSeniorDefer2029: zero the opening-year floor when the flag is active.
    // The deferred amount is added to floorAccrualBalance by the caller after this
    // year's iteration completes — see the loop bodies in Pass 1 and Pass 2.
    const deferOpeningFloor =
      (a.opCoSeniorDefer2029 === true) &&
      (year === OPENING_YEAR) &&
      (a.viewMode !== 'bank');   // bank-mode guard: never defer in bank/Optima output
    const effectiveYearFloor = deferOpeningFloor ? 0 : currentYearFloor;
    const totalFloorObligation = effectiveYearFloor + floorAccrualIn;

    const residualAfterDS = Math.max(0, ebitdaPreOpCo - totalDS);
    const opCoFloorActuallyPaid = Math.min(totalFloorObligation, residualAfterDS);
    const newFloorAccrual = totalFloorObligation - opCoFloorActuallyPaid;

    // Junior tiers from what's left after floor payment.
    const residualAfterFloor = Math.max(0, residualAfterDS - opCoFloorActuallyPaid);
    const tier1Rate  = opCo.juniorTier1Rate        ?? 0.10;
    const tier2Rate  = opCo.juniorTier2Rate        ?? 0.15;
    const threshold  = opCo.juniorResidualThreshold ?? 500_000;
    const tier1Amount     = opCoEnabled ? tier1Rate * Math.min(residualAfterFloor, threshold)     : 0;
    const tier2Amount     = opCoEnabled ? tier2Rate * Math.max(0, residualAfterFloor - threshold) : 0;
    const opCoJuniorPaid  = tier1Amount + tier2Amount;

    // IRR add-back: both floor and junior are now post-DS, so both are added back
    // to reconstruct the pre-split cash flow for equityIRRPreOpCo.
    // opCoTotalFeeRaw = opCoFloorActuallyPaid + opCoJuniorPaid (both tiers).
    //
    // Legacy AnnualPnL fields mapped for backward-compat:
    //   opCoBaseFee      ← floor actually paid this year
    //   opCoBrandFee     ← 0, retired
    //   opCoIncentiveFee ← junior paid
    //   opCoTotalFeeRaw  ← floor + junior (both post-DS — full IRR add-back)
    //   opCoTotalFee     ← floor + junior (total OpCo cost)
    //   opCoSeniorPaid   ← floor actually paid (post-DS; field name kept for compat)
    const opCoBaseFee      = opCoFloorActuallyPaid;
    const opCoBrandFee     = 0;
    const opCoIncentiveFee = opCoJuniorPaid;
    const opCoTotalFeeRaw  = opCoFloorActuallyPaid + opCoJuniorPaid;
    const opCoTotalFee     = opCoFloorActuallyPaid + opCoJuniorPaid;
    const opCoSeniorPaid   = opCoFloorActuallyPaid;

    const amortYear = preAmortSchedule.get(year);
    const termLoanInterestForTax = amortYear?.interest ?? 0;

    const vat = year <= HORIZON_START_YEAR + 1 ? 0 : -(grossRevenue * a.tax.netVATRate);
    // Depreciation deductible from CIT base from OPENING_YEAR onward (asset commissioning).
    // Greek Law 4172/2013 Art. 24 — straight-line. Before commissioning: zero.
    const yearAnnualDepreciation = year >= OPENING_YEAR ? annualDepreciation : 0;

    // ── Post-DS waterfall ─────────────────────────────────────────────────
    // DS is senior. Floor obligation (current year + any prior accrual) paid
    // first from post-DS residual. Junior tiers paid from what remains.
    // Unpaid floor accrues into next year.
    //
    // NOTE (Finding A): wcInterestExpense is excluded from totalOpex / ebitdaPreOpCo
    // so it does NOT affect the DSCR numerator. It is a real cash cost and is
    // deducted explicitly from ncf, taxableProfit, and cfads below.
    // dscrLoaded carries it in the denominator: ebitdaPreOpCo / (ds + wcInterest).
    //
    // CIT: both floor and junior are deductible at the PropCo level (related-entity
    // management fees under Greek CIT). Floor is an explicit deduction below since
    // it no longer reduces ebitdaPreOpCo via OpEx.
    // Depreciation (Art. 24) is deducted from the CIT base but does NOT
    // reduce EBITDA or NCF — it is a non-cash deduction (tax shield only).

    const ebitda     = ebitdaPreOpCo - opCoFloorActuallyPaid - opCoJuniorPaid;
    const ncf        = ebitdaPreOpCo - totalDS - opCoFloorActuallyPaid - opCoJuniorPaid - wcInterestExpense;
    const dscr       = totalDS > 0 ? ebitdaPreOpCo / totalDS : 0;
    const dscrLoaded = totalDS + wcInterestExpense > 0
      ? ebitdaPreOpCo / (totalDS + wcInterestExpense) : 0;
    // Floor is now an explicit deduction from taxable profit (not in OpEx any more).
    // Commitment fee is deductible as a financing cost (bank arrangement fee).
    const taxableProfit = Math.max(
      0,
      ebitdaPreOpCo
        - yearAnnualDepreciation
        - opCoFloorActuallyPaid
        - opCoJuniorPaid
        - wcInterestExpense
        - termLoanInterestForTax
        - commitmentFee,
    );

    const ebitdaMargin = totalRevenue > 0 ? ebitda / totalRevenue : 0;

    const cit = year <= HORIZON_START_YEAR + 1 ? 0 : -(taxableProfit * a.tax.corporateIncomeTaxRate);
    // CFADS for LLCR/PLCR + project IRR. CIT stored negative; adding it
    // subtracts the tax bill. Uses pre-fee ebitdaPreOpCo so CFADS represents
    // the asset's unlevered cash flow before the owner/manager split.
    // WC interest deducted — real cash cost (Finding A).
    // VAT excluded — balance-sheet pass-through, not an income-statement item.
    const cfads = ebitdaPreOpCo - wcInterestExpense + cit;

    const profitAfterTax = ncf + cit;
    const ncfPostVAT = ncf + vat + cit;
    const yieldOnInitialEquity =
      debtResult.equityRequired > 0 && year >= OPENING_YEAR
        ? ncfPostVAT / debtResult.equityRequired
        : 0;

    return {
      year,
      phase: getPhaseLabel(year),
      villaNights: Math.round(downside ? effVillaNights : villaNights),
      suiteNights: Math.round(downside ? effSuiteNights : suiteNights),
      propertyBreakdown,
      revenueEvents,
      revenueAncillary,
      revenueAncillaryCapped,
      grossRevenue,
      otaCommissions: -otaCommissions,  // negative — it's a cost
      totalRevenue,
      totalOpex,
      portfolioOpex: portfolioOpexResult,
      ebitdaPreOpCo,
      annualDepreciation: yearAnnualDepreciation,
      opCoBaseFee,
      opCoBrandFee,
      opCoIncentiveFee,
      opCoTotalFee,
      opCoTotalFeeRaw,
      opCoSeniorPaid,
      floorAccrual: newFloorAccrual,
      deferredFloor: deferOpeningFloor ? currentYearFloor : 0,
      opCoJuniorPaid,
      ebitda,
      ebitdaMargin,
      debtService: totalDS,
      commitmentFee,
      netCashFlow: ncf,
      vatPayable: vat,
      citPayable: cit,
      profitAfterTax,
      netCashFlowPostVAT: ncfPostVAT,
      yieldOnInitialEquity,
      cfads,
      dscr,
      wcInterestExpense,
      dscrLoaded,
      taxableProfit,
    };
  };

  // Pass 1: baseline P&L without WC interest. Build cumulative-cash map for
  // gating the seasonal draw decisions. Thread floorAccrualBalance so the
  // baseline pass correctly propagates any distress accruals across years.
  const baselineCumByYear = new Map<number, number>();
  {
    let cum = 0;
    let floorAccrualBalance = 0;
    for (const year of years) {
      const baseline = computePnLYear(year, 0, floorAccrualBalance);
      floorAccrualBalance = baseline.floorAccrual;
      // Fold deferred 2029 floor into the accrual balance so it carries flat to 2030.
      if (baseline.deferredFloor && baseline.deferredFloor > 0) {
        floorAccrualBalance += baseline.deferredFloor;
      }
      cum += baseline.netCashFlowPostVAT;
      baselineCumByYear.set(year, cum);
    }
  }

  // Compute WC schedule with cash-aware seasonal drawdowns.
  const wcSchedule = computeWorkingCapital(
    a.workingCapital,
    a.commercialLoan.interestRate,
    HORIZON_START_YEAR,
    HORIZON_END_YEAR,
    !!downside,
    baselineCumByYear
  );

  const amortSchedule = preAmortSchedule;

  // Pass 2: final P&L with WC interest threaded into OPEX, amort merged in.
  // floorAccrualBalance carries unpaid floor obligations year-to-year.
  let cumulativeNCF = 0;
  let cumulativeYieldOnInitialEquity = 0;
  let distributionThresholdCrossed = false;
  let floorAccrualBalance = 0;
  const pnl: AnnualPnL[] = years.map((year) => {
    const wcAnnual = wcSchedule.annual.get(year);
    const wcInterestExpense = wcAnnual?.interestExpense ?? 0;
    const yearPnL = computePnLYear(year, wcInterestExpense, floorAccrualBalance);
    floorAccrualBalance = yearPnL.floorAccrual;
    // Fold deferred 2029 floor into the accrual balance so it carries flat to 2030.
    if (yearPnL.deferredFloor && yearPnL.deferredFloor > 0) {
      floorAccrualBalance += yearPnL.deferredFloor;
    }
    cumulativeNCF += yearPnL.netCashFlowPostVAT;
    cumulativeYieldOnInitialEquity += yearPnL.yieldOnInitialEquity;
    const amort = amortSchedule.get(year);
    const termLoanInterest = amort?.interest ?? 0;
    const termLoanPrincipal = amort?.principal ?? 0;
    const termLoanBalance = amort?.closing ?? 0;
    // FI-01: ICR denominator includes WC interest so interest coverage reflects
    // all interest-bearing obligations, not just the term loan.
    const icrDenominator = termLoanInterest + wcInterestExpense;
    const interestCoverageRatio =
      icrDenominator > 0 ? yearPnL.ebitdaPreOpCo / icrDenominator : 0;
    // Distributions unlock when NCF post-VAT first exceeds DISTRIBUTION_RESERVE_THRESHOLD.
    // ADR-0014: gate is NCF-based (≥ threshold), not DSCR-based.
    if (yearPnL.netCashFlowPostVAT >= PROJECT_CONSTANTS.DISTRIBUTION_RESERVE_THRESHOLD) {
      distributionThresholdCrossed = true;
    }
    const distributionGated = !distributionThresholdCrossed;
    return {
      ...yearPnL,
      cumulativeNCF,
      cumulativeYieldOnInitialEquity,
      termLoanInterest,
      termLoanPrincipal,
      termLoanBalance,
      interestCoverageRatio,
      wcAvgBalance: wcAnnual?.avgBalance ?? 0,
      wcPeakBalance: wcAnnual?.peakBalance ?? 0,
      wcTroughBalance: wcAnnual?.troughBalance ?? 0,
      wcNetContribution: wcAnnual?.netContribution ?? 0,
      wcSelfLiquidatingViolation: wcAnnual?.selfLiquidatingViolation ?? false,
      distributionGated,
    };
  });

  // ── Pass 2B: Tax-loss carryforward (Article 27, Law 4172/2013) ───────────
  // Greek law allows corporate income-tax losses to be carried forward for up
  // to 5 years. Pre-opening interest charges (2026–2027) generate a loss pool
  // that is absorbed against taxable profit in the first operational years,
  // reducing CIT payable and improving post-tax NCF. The pool tracks vintages
  // so expired balances are written off conservatively.
  //
  // Operational-year losses: depreciation (Art. 24) may cause EBITDA − interest
  // to go negative in early operational years. Those losses are also pushed into
  // the vintage pool (no cash refund from the state — floor CIT at zero).
  //
  // Kill-switch: if corporateLossCarryForwardYears <= 0, skip entirely and
  // set the three diagnostic fields to 0 on every row.

  const carryForwardYears = a.tax.corporateLossCarryForwardYears ?? 5;
  const corporateIncomeTaxRate = a.tax.corporateIncomeTaxRate;

  if (carryForwardYears <= 0) {
    // Kill-switch: zero all three diagnostic fields, leave CIT untouched.
    for (const row of pnl) {
      row.taxLossGenerated = 0;
      row.taxLossUtilised = 0;
      row.taxLossPoolBalance = 0;
    }
  } else {
    // Vintage pool: each entry tracks a loss that arose in a specific year.
    // Article 27 cap: vintage expires after carryForwardYears years.
    type Vintage = { year: number; remaining: number };
    let vintages: Vintage[] = [];

    // Pre-opening years are those before OPENING_YEAR (construction phase).
    // OPENING_YEAR = 2029 per PROJECT_CONSTANTS.
    for (const row of pnl) {
      // A. Expire vintages outside the carryforward window.
      //    Condition: vintage.year + carryForwardYears < row.year
      //    Conservative write-off: expired balance forfeited.
      for (let i = vintages.length - 1; i >= 0; i--) {
        if (vintages[i].year + carryForwardYears < row.year) {
          vintages.splice(i, 1);
        }
      }

      if (row.year < OPENING_YEAR) {
        // B. Pre-opening years: generate loss from interest charges incurred.
        //    termLoanInterest is the amort schedule interest (= termLoanInterestForTax).
        //    wcInterestExpense is the working-capital facility interest.
        //    commitmentFee is a deductible financing cost on undrawn construction tranches.
        // opexLoss: any pre-opening OPEX that reduced ebitdaPreOpCo below zero
        // (preOpeningAmort if amortisation starts before OPENING_YEAR, plus
        //  constructionServicesExpense — legal/consulting fees expensed under Art. 22).
        const opexLoss = row.ebitdaPreOpCo < 0 ? -row.ebitdaPreOpCo : 0;
        const lossGenerated = opexLoss + (row.termLoanInterest ?? 0) + (row.wcInterestExpense ?? 0) + (row.commitmentFee ?? 0);
        if (lossGenerated > 0) {
          vintages.push({ year: row.year, remaining: lossGenerated });
        }
        row.taxLossGenerated = lossGenerated;
        row.taxLossUtilised = 0;
        row.taxLossPoolBalance = vintages.reduce((s, v) => s + v.remaining, 0);
      } else {
        // C. Operational years: absorb pool against taxable profit, recalculate CIT.
        //    rawTaxableBeforePool can be negative if depreciation + interest > EBITDA.
        //    Greek CIT: no cash refund for operational losses. Floor CIT at zero.
        //    Push operational-year losses into the vintage pool.
        //    Both opCoSeniorPaid (floor) and opCoJuniorPaid are now post-DS deductions;
        //    both are deductible at the PropCo level (related-entity management fees).
        const rawTaxableBeforePool =
          (row.ebitdaPreOpCo ?? 0)
          - (row.annualDepreciation ?? 0)
          - (row.opCoSeniorPaid ?? 0)
          - (row.opCoJuniorPaid ?? 0)
          - (row.wcInterestExpense ?? 0)
          - (row.termLoanInterest ?? 0)
          - (row.commitmentFee ?? 0);

        if (rawTaxableBeforePool < 0) {
          // Depreciation + interest exceeds EBITDA — operational loss this year.
          // No cash refund from the state. Push loss to carryforward pool.
          if (carryForwardYears > 0) {
            vintages.push({ year: row.year, remaining: -rawTaxableBeforePool });
          }
          row.taxLossGenerated = -rawTaxableBeforePool;
          row.taxLossUtilised = 0;
          row.taxLossPoolBalance = vintages.reduce((s, v) => s + v.remaining, 0);
          const newCIT = 0;
          row.citPayable = newCIT;
          row.taxableProfit = 0;
          row.annualDepreciation = row.annualDepreciation ?? 0; // already set, keep it
          row.cfads = (row.ebitdaPreOpCo ?? 0) - (row.wcInterestExpense ?? 0) + newCIT;
          row.profitAfterTax = (row.netCashFlow ?? 0) + newCIT;
          row.netCashFlowPostVAT = (row.netCashFlow ?? 0) + (row.vatPayable ?? 0) + newCIT;
        } else {
          // rawTaxableBeforePool >= 0: drain pool (FIFO).
          let headroom = rawTaxableBeforePool;
          let totalUtilised = 0;
          for (const vintage of vintages) {
            if (vintage.year + carryForwardYears < row.year) continue; // expired
            const absorb = Math.min(vintage.remaining, headroom);
            vintage.remaining -= absorb;
            totalUtilised += absorb;
            headroom -= absorb;
            if (headroom <= 0) break;
          }
          // Remove exhausted and expired vintages.
          vintages = vintages.filter(
            (v) => v.remaining > 0 && v.year + carryForwardYears >= row.year
          );

          const adjustedTaxable = rawTaxableBeforePool - totalUtilised;
          const newCIT = -(adjustedTaxable * corporateIncomeTaxRate);

          row.taxLossGenerated = 0;
          row.taxLossUtilised = totalUtilised;
          row.taxLossPoolBalance = vintages.reduce((s, v) => s + v.remaining, 0);
          row.citPayable = newCIT;
          row.taxableProfit = Math.max(0, adjustedTaxable);
          row.cfads = (row.ebitdaPreOpCo ?? 0) - (row.wcInterestExpense ?? 0) + newCIT;
          row.profitAfterTax = (row.netCashFlow ?? 0) + newCIT;
          row.netCashFlowPostVAT = (row.netCashFlow ?? 0) + (row.vatPayable ?? 0) + newCIT;
        }

        // yieldOnInitialEquity recalculated with updated netCashFlowPostVAT.
        row.yieldOnInitialEquity =
          debtResult.equityRequired > 0 && row.year >= OPENING_YEAR
            ? row.netCashFlowPostVAT / debtResult.equityRequired
            : 0;
      }
    }

    // Reset cumulativeNCF and cumulativeYieldOnInitialEquity after all
    // in-place mutations are complete.
    {
      let cumNCF = 0;
      let cumYield = 0;
      for (const row of pnl) {
        cumNCF += row.netCashFlowPostVAT;
        cumYield += row.yieldOnInitialEquity;
        row.cumulativeNCF = cumNCF;
        row.cumulativeYieldOnInitialEquity = cumYield;
      }
    }

    // Reset the distributionGated gate with the updated netCashFlowPostVAT.
    {
      let thresholdCrossed = false;
      for (const row of pnl) {
        // ADR-0014: distributions unlock when NCF post-VAT ≥ DISTRIBUTION_RESERVE_THRESHOLD.
        if (row.netCashFlowPostVAT >= PROJECT_CONSTANTS.DISTRIBUTION_RESERVE_THRESHOLD) {
          thresholdCrossed = true;
        }
        row.distributionGated = !thresholdCrossed;
      }
    }
  }
  // ── End Pass 2B ───────────────────────────────────────────────────────────

  // ── Pass 3: DSRA ──────────────────────────────────────────────────────────
  // Always runs — no user toggle. When every year's CFADS ≥ target×DS,
  // dsraTarget = 0 and all reserve fields are naturally zero (no-op).
  const dsraParams = a.dsra;
  const targetDSCR = dsraParams?.targetDSCR ?? 1.25;
  const sweep2028Pct = dsraParams?.sweep2028Pct ?? 1.0;
  const replenishmentPriority = dsraParams?.replenishmentPriority ?? 1.0;
  const partnerRepaymentThreshold = dsraParams?.partnerRepaymentThreshold ?? 2;

  // Step 3.2 — Worst-year shortfall → DSRA target size
  // FI-02: include OPENING_YEAR (2029) — the opening year can be the weakest
  // year and excluding it would undersize the DSRA target.
  const operationalRows = pnl.filter(row => row.year >= OPENING_YEAR);
  const shortfalls = operationalRows.map(row => {
    const ds = row.debtService ?? 0;
    const cfads = row.cfads ?? 0;
    return Math.max(0, targetDSCR * ds - cfads);
  });
  const dsraTarget = shortfalls.length > 0 ? Math.max(0, ...shortfalls) : 0;

  // Step 3.3 — 2028 sweep: capped at dsraTarget (excess stays distributable)
  const row2028 = pnl.find(row => row.year === OPENING_YEAR);
  const ncf2028 = row2028?.netCashFlowPostVAT ?? row2028?.netCashFlow ?? 0;
  const dsraSweep2028 = Math.min(sweep2028Pct * Math.max(0, ncf2028), dsraTarget);

  // Step 3.4 — Partner advance fills the gap
  const dsraPartnerAdvance = Math.max(0, dsraTarget - dsraSweep2028);

  // Step 3.5 — Pre-operational rows (before OPENING_YEAR): zeros, effectiveDSCR = dscr
  // FI-02: boundary aligned with operationalRows (year >= OPENING_YEAR).
  for (const row of pnl.filter(r => r.year < OPENING_YEAR)) {
    row.dsraDraw = 0;
    row.dsraReplenishment = 0;
    row.dsraBalance = 0;
    row.effectiveDSCR = row.dscr ?? 0;
    row.partnerRepayment = 0;
  }

  // Step 3.6 — Year-by-year forward pass
  // When dsraTarget = 0, balance = 0 → drawdown = 0 → effectiveDSCR = dscr (no-op).
  let balance = dsraTarget;
  let partnerBalance = dsraPartnerAdvance;
  let consecutiveStableYears = 0;

  for (const row of operationalRows) {
    const ds = row.debtService ?? 0;
    const cfads = row.cfads ?? 0;
    const targetDS = targetDSCR * ds;

    // Drawdown: fills shortfall from reserve (does NOT enter cfads, NCF, or IRR)
    const drawdown = ds > 0
      ? Math.min(balance, Math.max(0, targetDS - cfads))
      : 0;

    // Surplus: cash above target DS
    const surplus = ds > 0 ? Math.max(0, cfads - targetDS) : 0;

    // Replenishment: top up reserve before partner repayment
    const deficitToFill = Math.max(0, dsraTarget - (balance - drawdown));
    const replenishment = Math.min(deficitToFill, replenishmentPriority * surplus);

    balance = balance - drawdown + replenishment;

    // Effective DSCR: drawdown supplements the numerator only
    const effectiveDSCR = ds > 0 ? (cfads + drawdown) / ds : (row.dscr ?? 0);

    if (balance >= dsraTarget && effectiveDSCR >= targetDSCR) {
      consecutiveStableYears += 1;
    } else {
      consecutiveStableYears = 0;
    }

    // Partner repayment: only after DSRA is full AND N consecutive stable years
    let partnerRepayment = 0;
    if (
      partnerBalance > 0 &&
      balance >= dsraTarget &&
      consecutiveStableYears >= partnerRepaymentThreshold
    ) {
      const availableForPartner = Math.max(0, surplus - replenishment);
      partnerRepayment = Math.min(partnerBalance, availableForPartner);
      partnerBalance -= partnerRepayment;
    }

    row.dsraDraw = drawdown;
    row.dsraReplenishment = replenishment;
    row.dsraBalance = balance;
    row.effectiveDSCR = effectiveDSCR;
    row.partnerRepayment = partnerRepayment;
  }
  // ── End Pass 3: DSRA ──────────────────────────────────────────────────────

  const stabilisedYear = pnl.find((p) => p.year === STABILISED_YEAR) ?? null;

  // ── Scenario-level bank metrics ────────────────────────────
  const stab = stabilisedYear;
  const finalYear = pnl[pnl.length - 1] ?? null;
  const totalCapex =
    debtResult.equityRequired +
    debtResult.loanAmount +
    debtResult.grantAmount;

  const gracePeriodInterestTotal = debtResult.graceInterestCarry;

  // For rolling (two-phase) mode, the first tranche starts amortising before
  // the last one does — include those earlier years in the DSCR window so the
  // benefit of staggered amortisation is visible. For all other modes,
  // dscrWindowStart = graceEndYear + 1 (first year after full grace).
  const dscrWindowStart = debtResult.firstAmortYear ?? graceEndYear + 1;
  const operationalDscrs = pnl
    .filter((p) => p.year >= dscrWindowStart && p.dscr > 0)
    .map((p) => p.dscr);
  const minDSCRLoanLife = operationalDscrs.length
    ? Math.round(Math.min(...operationalDscrs) * 100) / 100
    : 0;
  const avgDSCRLoanLife = operationalDscrs.length
    ? Math.round((operationalDscrs.reduce((s, v) => s + v, 0) / operationalDscrs.length) * 100) / 100
    : 0;
  const covenantThreshold = a.dscrCovenantThreshold || 1.25;
  // Covenant tested against minimum (banking standard — minimum annual DSCR over loan life)
  const dscrCovenantHeadroom =
    minDSCRLoanLife > 0
      ? (minDSCRLoanLife - covenantThreshold) / covenantThreshold
      : 0;

  const peakDebtOutstanding = Math.max(
    0,
    ...pnl.map((p) => p.termLoanBalance + p.wcPeakBalance)
  );

  const netLeverage =
    stab && stab.ebitda > 0 ? debtResult.loanAmount / stab.ebitda : 0;

  const icrStabilised = stab?.interestCoverageRatio ?? 0;

  // Terminal values via EBITDA multiple exit on EBITDA AT THE EXIT YEAR.
  // exitYear clamps to [2030, 2036] (modeled horizon). Defaults to 2036.
  const exitMultiple = a.exitEbitdaMultiple ?? DEFAULT_EXIT_EBITDA_MULTIPLE;
  const exitYearRaw = a.exitYear ?? HORIZON_END_YEAR;
  const exitYear = Math.max(MIN_EXIT_YEAR, Math.min(HORIZON_END_YEAR, exitYearRaw));
  const exitPnL = pnl.find((p) => p.year === exitYear) ?? stab ?? finalYear;
  const exitEbitda = exitPnL?.ebitda ?? 0;
  const terminalAssetValue = exitEbitda > 0 ? exitEbitda * exitMultiple : 0;
  const remainingDebt = exitPnL?.termLoanBalance ?? 0;
  const terminalEquityValue = Math.max(0, terminalAssetValue - remainingDebt);
  // Flag underwater exit — terminal equity floored at 0 because debt > asset.
  // Equity holders get nothing from the sale; only operating distributions.
  const terminalUnderwater = terminalAssetValue > 0 && remainingDebt > terminalAssetValue;

  // Truncate cash-flow window to the exit year. Operating years before exit
  // run normally; the exit year itself receives the terminal lump sum. Years
  // after exit are dropped from the IRR series.
  const exitIndex = pnl.findIndex((p) => p.year === exitYear);
  const truncatedPnL = exitIndex >= 0 ? pnl.slice(0, exitIndex + 1) : pnl;

  // Equity IRR: -(equityRequired + graceInterestCarry) at t=0 (total equity
  // at financial close), NCF post-tax stream with grace-year interest added
  // back (it was pre-funded from the reserve — don't double-count it).
  const totalEquityAtClose = debtResult.equityRequired + debtResult.graceInterestCarry;
  const equityCFs: number[] = [-totalEquityAtClose];
  truncatedPnL.forEach((p, i) => {
    const year = HORIZON_START_YEAR + i;
    const isGraceYear = year <= debtResult.graceEndYear;
    const ncfForIRR = isGraceYear
      ? p.netCashFlowPostVAT + p.debtService
      : p.netCashFlowPostVAT;
    const cf =
      i === truncatedPnL.length - 1
        ? ncfForIRR + terminalEquityValue
        : ncfForIRR;
    equityCFs.push(cf);
  });
  const equityIRRRaw = irr(equityCFs);
  const equityIRR = isFinite(equityIRRRaw) ? equityIRRRaw : 0;

  // Total MOIC including exit lump sum. Distinct from cumulativeYieldFinal,
  // which only sums operating distributions (= the "Operating Yield" widget).
  // Numerator includes terminalEquityValue at exit; denominator is total
  // equity at close (structural + grace reserve). Returns 0 if equity is 0.
  const operatingDistributions = truncatedPnL.reduce(
    (sum, p) => sum + p.netCashFlowPostVAT,
    0,
  );
  const totalMOIC =
    totalEquityAtClose > 0
      ? (operatingDistributions + terminalEquityValue) / totalEquityAtClose
      : 0;

  // Pre-split equity IRR: add OpCo fees back into each year's NCF (i.e. value
  // the all-in equity cash flow if the owner were also the manager). Also
  // recompute terminal equity off the pre-OpCo EBITDA at exit so the exit
  // multiple is applied to the un-split GOP. Identical to equityIRR when
  // OpCo split is disabled (all opCoTotalFee + opCoStabilisedFee are zero).
  const opCoStabilisedFee = stab?.opCoTotalFee ?? 0;
  const exitEbitdaPreOpCo = exitPnL?.ebitdaPreOpCo ?? 0;
  const terminalAssetValuePreOpCo =
    exitEbitdaPreOpCo > 0 ? exitEbitdaPreOpCo * exitMultiple : 0;
  const terminalEquityValuePreOpCo = Math.max(
    0,
    terminalAssetValuePreOpCo - remainingDebt
  );
  const equityCFsPreOpCo: number[] = [-totalEquityAtClose];
  truncatedPnL.forEach((p, i) => {
    const year = HORIZON_START_YEAR + i;
    const isGraceYear = year <= debtResult.graceEndYear;
    const addBack = p.opCoTotalFeeRaw ?? p.opCoTotalFee;
    const ncfBase = isGraceYear ? p.netCashFlowPostVAT + p.debtService : p.netCashFlowPostVAT;
    const cf =
      i === truncatedPnL.length - 1
        ? ncfBase + addBack + terminalEquityValuePreOpCo
        : ncfBase + addBack;
    equityCFsPreOpCo.push(cf);
  });
  const equityIRRPreOpCoRaw = irr(equityCFsPreOpCo);
  const equityIRRPreOpCo = isFinite(equityIRRPreOpCoRaw) ? equityIRRPreOpCoRaw : 0;

  // Project IRR: -CapEx at t=0, unlevered CFADS stream, terminal asset value
  // at exit year. Truncated to the exit window.
  const projectCFs: number[] = [-totalCapex];
  truncatedPnL.forEach((p, i) => {
    const cf =
      i === truncatedPnL.length - 1 ? p.cfads + terminalAssetValue : p.cfads;
    projectCFs.push(cf);
  });
  const projectIRRRaw = irr(projectCFs);
  const projectIRR = isFinite(projectIRRRaw) ? projectIRRRaw : 0;

  // ── Parallel exit path: sell the underlying property instead of the
  //    operating hotel. terminalAssetValuePropertySale = builtSurface × €/m².
  //    Computed alongside the EBITDA-multiple path so the sponsor can see
  //    both exits side by side; the higher of the two drives the rational
  //    sale decision. €/m² defaults to 9 000 (matches collateral.market).
  const builtSurfaceScenario = a.portfolio.reduce(
    (sum, p) => sum + areaOf(p) * p.count,
    0,
  );
  const exitValuationPerM2 = a.exitValuationPerM2 ?? COLLATERAL_TIERS.market;
  const terminalAssetValuePropertySale = builtSurfaceScenario * exitValuationPerM2;
  const terminalEquityValuePropertySale = Math.max(
    0,
    terminalAssetValuePropertySale - remainingDebt,
  );

  // Equity IRR under the property-sale exit. Same grace-year add-back
  // as the EBITDA-multiple path; only the terminal value differs.
  const equityCFsPropertySale: number[] = [-totalEquityAtClose];
  truncatedPnL.forEach((p, i) => {
    const year = HORIZON_START_YEAR + i;
    const isGraceYear = year <= debtResult.graceEndYear;
    const ncfForIRR = isGraceYear
      ? p.netCashFlowPostVAT + p.debtService
      : p.netCashFlowPostVAT;
    const cf =
      i === truncatedPnL.length - 1
        ? ncfForIRR + terminalEquityValuePropertySale
        : ncfForIRR;
    equityCFsPropertySale.push(cf);
  });
  const equityIRRPropertySaleRaw = irr(equityCFsPropertySale);
  const equityIRRPropertySale = isFinite(equityIRRPropertySaleRaw)
    ? equityIRRPropertySaleRaw
    : 0;

  // Project IRR under the property-sale exit (unlevered).
  const projectCFsPropertySale: number[] = [-totalCapex];
  truncatedPnL.forEach((p, i) => {
    const cf =
      i === truncatedPnL.length - 1
        ? p.cfads + terminalAssetValuePropertySale
        : p.cfads;
    projectCFsPropertySale.push(cf);
  });
  const projectIRRPropertySaleRaw = irr(projectCFsPropertySale);
  const projectIRRPropertySale = isFinite(projectIRRPropertySaleRaw)
    ? projectIRRPropertySaleRaw
    : 0;

  // Total MOIC under the property-sale exit. Mirrors `totalMOIC` above with
  // the property-sale terminal equity substituted in, using totalEquityAtClose.
  const totalMOICPropertySale =
    totalEquityAtClose > 0
      ? (operatingDistributions + terminalEquityValuePropertySale) /
        totalEquityAtClose
      : 0;

  // True when the property sale would yield a larger terminal asset value
  // than the hotel sale at exit — a rational seller picks the larger.
  // Compared on GROSS asset value, not equity (equity floors at 0 in either
  // path, so the gross comparison is the meaningful one).
  const propertyExitDominates =
    terminalAssetValuePropertySale > terminalAssetValue;

  // ROIC stabilised: NOPAT proxy / total CapEx. EBITDA + CIT ≈ post-tax
  // operating cash; treats D&A as ignored (cash proxy).
  // Unified formula: ebitda is post-junior-fee in both views, which is the
  // appropriate asset-level return basis (senior floor is in OpEx either way).
  const roicEbitda = stab ? stab.ebitda : 0;
  const roic = totalCapex > 0 && stab ? (roicEbitda + stab.citPayable) / totalCapex : 0;

  // LLCR / PLCR — NPV(CFADS) / debt outstanding at financial close (2029).
  const lcrStartYear = FIRST_OPERATIONAL_YEAR;
  const lcrDebt = amortSchedule.get(lcrStartYear)?.opening ?? debtResult.loanAmount;
  const stabilisedCFADS = stab?.cfads ?? 0;
  const computeLCR = (periods: number): number => {
    if (lcrDebt <= 0 || debtResult.effectiveInterestRate <= 0) return 0;
    let total = 0;
    for (let t = 1; t <= periods; t++) {
      const yr = lcrStartYear + t - 1;
      const yearPnL = pnl.find((p) => p.year === yr);
      const cf = yearPnL ? yearPnL.cfads : stabilisedCFADS;
      total += cf / Math.pow(1 + debtResult.effectiveInterestRate, t);
    }
    return total / lcrDebt;
  };
  const llcr = computeLCR(debtResult.repaymentTermYears);
  const plcr = computeLCR(debtResult.repaymentTermYears + 10);

  // Equity payback: first year cumulative yield ≥ 100%; null if never.
  const paybackHit = pnl.find((p) => p.cumulativeYieldOnInitialEquity >= 1);
  const equityPaybackYears = paybackHit ? paybackHit.year - HORIZON_START_YEAR : null;

  // Pre-opening equity buffer: 1 month of opening-year portfolioOpex.
  // Covers the pre-opening cash need (staff + shared costs) without drawing
  // on the WC revolving facility (preOpeningTotalDraw = 0).
  const openingYearRow = pnl.find((r) => r.year === OPENING_YEAR);
  const preOpeningEquityBuffer = Math.round(
    (openingYearRow?.portfolioOpex?.total ?? 0) / 12,
  );

  const yieldStabilised = stab?.yieldOnInitialEquity ?? 0;
  const cumulativeYieldFinal = finalYear?.cumulativeYieldOnInitialEquity ?? 0;

  return {
    name,
    pnl,
    stabilisedYear,
    wcQuarters: wcSchedule.quarters,
    wcEffectiveFacility: wcSchedule.effectiveFacility,
    wcMinimumFacility: wcSchedule.minimumFacility,
    wcRate: wcSchedule.rate,
    llcr,
    plcr,
    icrStabilised,
    minDSCRLoanLife,
    avgDSCRLoanLife,
    dscrCovenantHeadroom,
    peakDebtOutstanding,
    gracePeriodInterestTotal,
    netLeverage,
    yieldStabilised,
    cumulativeYieldFinal,
    totalMOIC,
    equityPaybackYears,
    equityIRR,
    equityIRRPreOpCo,
    opCoStabilisedFee,
    projectIRR,
    roic,
    terminalAssetValue,
    terminalEquityValue,
    terminalUnderwater,
    exitEbitdaMultiple: exitMultiple,
    exitYear,
    // Property-sale exit path (parallel to EBITDA × multiple)
    exitValuationPerM2,
    terminalAssetValuePropertySale,
    terminalEquityValuePropertySale,
    equityIRRPropertySale,
    projectIRRPropertySale,
    totalMOICPropertySale,
    propertyExitDominates,
    // DSRA scenario-level summary
    dsraTarget,
    dsraSweep2028,
    dsraPartnerAdvance,
    preOpeningEquityBuffer,
  };
}

// ────────────────────────────────────────────
// MAIN COMPUTE
// ────────────────────────────────────────────

export function computeModel(a: ModelAssumptions, capexOverride?: CapexBreakdown): ModelOutput {
  const startTime = performance.now();

  const capex = capexOverride ?? computeCapex(a);

  const commercialDebt = computeDebtService(a, capex, 'commercial');
  const grantDebt = computeDebtService(a, capex, 'grant');
  const rrfDebt = computeDebtService(a, capex, 'rrf');
  const tepixLoanDebt = computeDebtService(a, capex, 'tepix-loan');
  const optimaDebt = computeDebtService(a, capex, 'optima');

  const activeDebt =
    a.financingPath === 'grant'
      ? grantDebt
      : a.financingPath === 'rrf'
        ? rrfDebt
        : a.financingPath === 'tepix-loan'
          ? tepixLoanDebt
          : a.financingPath === 'optima'
            ? optimaDebt
            : commercialDebt;

  const realistic = computeScenario(
    'Realistic',
    a,
    a.revenueRealistic,
    activeDebt,
    undefined,
    capex
  );
  const upside = computeScenario('Upside', a, a.revenueUpside, activeDebt, undefined, capex);
  const downside = computeScenario(
    'Downside',
    a,
    a.revenueRealistic,
    activeDebt,
    {
      occupancyFactor: DOWNSIDE_FACTORS.occupancyReduction,
      adrFactor: DOWNSIDE_FACTORS.adrReduction,
      events: DOWNSIDE_FACTORS.eventsPerYear,
    },
    capex
  );

  // Break-even scenario
  const realisticStab = realistic.stabilisedYear;
  let breakevenFactor = 1;
  if (realisticStab && realisticStab.ebitda > 0) {
    const ancillary2031Exponent = Math.min(
      STABILISED_YEAR - OPENING_YEAR,
      Math.max(0, a.revenueRealistic.ancillaryGrowthYears)
    );
    const ancillary2031 =
      a.revenueRealistic.ancillaryBaseProfit *
      Math.pow(1 + a.revenueRealistic.ancillaryGrowthRate, ancillary2031Exponent);
    const occLinkedRev = realisticStab.totalRevenue - ancillary2031;
    const targetOccLinkedRev =
      activeDebt.annualDS + realisticStab.totalOpex - ancillary2031;
    if (occLinkedRev > 0 && targetOccLinkedRev > 0) {
      // Linear break-even factor: revenue shortfall / current revenue.
      // Replaced Math.sqrt (non-standard, made break-even appear more optimistic).
      // Higher value = more conservative = correct direction for bank presentations.
      breakevenFactor = targetOccLinkedRev / occLinkedRev;
    }
  }
  const beOccFactor = 1 - breakevenFactor;
  const beAdrFactor = 1 - breakevenFactor;
  const breakeven = computeScenario(
    'Break-Even',
    a,
    a.revenueRealistic,
    activeDebt,
    {
      occupancyFactor: beOccFactor,
      adrFactor: beAdrFactor,
      events: Math.round(
        a.revenueRealistic.eventsPerYear * breakevenFactor
      ),
    },
    capex
  );

  const grantScenario = computeScenario(
    'Grant Path',
    a,
    a.revenueRealistic,
    grantDebt,
    undefined,
    capex
  );

  // DSCR by year
  const commercialRealistic = computeScenario(
    'comm',
    a,
    a.revenueRealistic,
    commercialDebt,
    undefined,
    capex
  );
  const rrfRealistic = computeScenario(
    'rrf',
    a,
    a.revenueRealistic,
    rrfDebt,
    undefined,
    capex
  );
  const commercialUpside = computeScenario(
    'commUp',
    a,
    a.revenueUpside,
    commercialDebt,
    undefined,
    capex
  );
  const commercialDownside = computeScenario(
    'commDn',
    a,
    a.revenueRealistic,
    commercialDebt,
    {
      occupancyFactor: DOWNSIDE_FACTORS.occupancyReduction,
      adrFactor: DOWNSIDE_FACTORS.adrReduction,
      events: DOWNSIDE_FACTORS.eventsPerYear,
    },
    capex
  );

  const tepixLoanRealistic = computeScenario(
    'tepixLoan',
    a,
    a.revenueRealistic,
    tepixLoanDebt,
    undefined,
    capex
  );

  const optimaScenario = computeScenario(
    'Optima Bank',
    a,
    a.revenueRealistic,
    optimaDebt,
    undefined,
    capex
  );

  const dscrByYear = realistic.pnl.map((p, i) => ({
    year: p.year,
    realistic: commercialRealistic.pnl[i].dscr,
    upside: commercialUpside.pnl[i].dscr,
    downside: commercialDownside.pnl[i].dscr,
    grant: grantScenario.pnl[i].dscr,
    tepixLoan: tepixLoanRealistic.pnl[i].dscr,
    // Effective DSCR (incl. DSRA drawdown) — always computed; equals dscr when no reserve needed
    effectiveRealistic: commercialRealistic.pnl[i].effectiveDSCR,
    effectiveUpside: commercialUpside.pnl[i].effectiveDSCR,
    effectiveDownside: commercialDownside.pnl[i].effectiveDSCR,
    effectiveGrant: grantScenario.pnl[i].effectiveDSCR,
    effectiveTepixLoan: tepixLoanRealistic.pnl[i].effectiveDSCR,
  }));

  // Financing comparison
  const financingComparison: FinancingComparison[] = [
    {
      key: 'totalLoanDrawn',
      metric: 'Total loan drawn',
      commercial: commercialDebt.loanAmount,
      rrf: rrfDebt.loanAmount,
      grant: grantDebt.loanAmount,
      tepixLoan: tepixLoanDebt.loanAmount,
      optima: optimaDebt.loanAmount,
    },
    {
      key: 'grantReceived',
      metric: 'Grant received',
      commercial: 0,
      rrf: 0,
      grant: grantDebt.grantAmount,
      tepixLoan: 0,
      optima: 0,
    },
    {
      key: 'equityRequired',
      metric: 'Equity required',
      commercial: commercialDebt.equityRequired,
      rrf: rrfDebt.equityRequired,
      grant: grantDebt.equityRequired,
      tepixLoan: tepixLoanDebt.equityRequired,
      optima: optimaDebt.equityRequired,
    },
    {
      key: 'graceInterestCarry',
      metric: 'Grace-period interest reserve',
      commercial: commercialRealistic.gracePeriodInterestTotal,
      rrf: rrfRealistic.gracePeriodInterestTotal,
      grant: grantScenario.gracePeriodInterestTotal,
      tepixLoan: tepixLoanRealistic.gracePeriodInterestTotal,
      optima: optimaScenario.gracePeriodInterestTotal,
    },
    {
      key: 'annualDebtService',
      metric: 'Annual debt service',
      commercial: commercialDebt.annualDS,
      rrf: rrfDebt.annualDS,
      grant: grantDebt.annualDS,
      tepixLoan: tepixLoanDebt.annualDS,
      optima: optimaDebt.annualDS,
    },
    {
      key: 'stabilisedDSCR',
      metric: `DSCR — Realistic (${STABILISED_YEAR})`,
      commercial: commercialRealistic.stabilisedYear?.dscr ?? 0,
      rrf: rrfRealistic.stabilisedYear?.dscr ?? 0,
      grant: grantScenario.stabilisedYear?.dscr ?? 0,
      tepixLoan: tepixLoanRealistic.stabilisedYear?.dscr ?? 0,
      optima: optimaScenario.stabilisedYear?.dscr ?? 0,
    },
    {
      key: 'supplementaryLoan',
      metric: 'Supplementary commercial loan',
      commercial: '—',
      rrf: '—',
      grant: '—',
      tepixLoan: tepixLoanDebt.supplementaryLoan ?? 0,
      optima: '—',
    },
    {
      key: 'equitySavingVsCommercial',
      metric: 'Equity saving vs. commercial',
      commercial: '—',
      rrf: commercialDebt.equityRequired - rrfDebt.equityRequired,
      grant: commercialDebt.equityRequired - grantDebt.equityRequired,
      tepixLoan: commercialDebt.equityRequired - tepixLoanDebt.equityRequired,
      optima: commercialDebt.equityRequired - optimaDebt.equityRequired,
    },
    // DSRA rows — appended when at least one path needs a reserve
    ...([commercialRealistic, rrfRealistic, grantScenario, tepixLoanRealistic, optimaScenario].some(
      s => (s.dsraTarget ?? 0) > 0
    ) ? [
      {
        key: 'dsraTarget' as const,
        metric: 'DSRA reserve (total)',
        commercial: commercialRealistic.dsraTarget ?? 0,
        rrf: rrfRealistic.dsraTarget ?? 0,
        grant: grantScenario.dsraTarget ?? 0,
        tepixLoan: tepixLoanRealistic.dsraTarget ?? 0,
        optima: optimaScenario.dsraTarget ?? 0,
      },
      {
        key: 'effectiveDSCRStabilised' as const,
        metric: `Effective DSCR — incl. DSRA (${STABILISED_YEAR})`,
        commercial: commercialRealistic.stabilisedYear?.effectiveDSCR ?? commercialRealistic.stabilisedYear?.dscr ?? 0,
        rrf: rrfRealistic.stabilisedYear?.effectiveDSCR ?? rrfRealistic.stabilisedYear?.dscr ?? 0,
        grant: grantScenario.stabilisedYear?.effectiveDSCR ?? grantScenario.stabilisedYear?.dscr ?? 0,
        tepixLoan: tepixLoanRealistic.stabilisedYear?.effectiveDSCR ?? tepixLoanRealistic.stabilisedYear?.dscr ?? 0,
        optima: optimaScenario.stabilisedYear?.effectiveDSCR ?? optimaScenario.stabilisedYear?.dscr ?? 0,
      },
    ] : []),
  ];

  // Collateral
  const builtSurface = a.portfolio.reduce(
    (sum, p) => sum + areaOf(p) * p.count,
    0
  );
  const loan = activeDebt.loanAmount;
  const collateral = {
    builtSurface,
    stress: {
      valuationPerM2: COLLATERAL_TIERS.stress,
      value: builtSurface * COLLATERAL_TIERS.stress,
      ltv: loan / (builtSurface * COLLATERAL_TIERS.stress),
      coverage: (builtSurface * COLLATERAL_TIERS.stress) / loan,
    },
    market: {
      valuationPerM2: COLLATERAL_TIERS.market,
      value: builtSurface * COLLATERAL_TIERS.market,
      ltv: loan / (builtSurface * COLLATERAL_TIERS.market),
      coverage: (builtSurface * COLLATERAL_TIERS.market) / loan,
    },
    optimistic: {
      valuationPerM2: COLLATERAL_TIERS.optimistic,
      value: builtSurface * COLLATERAL_TIERS.optimistic,
      ltv: loan / (builtSurface * COLLATERAL_TIERS.optimistic),
      coverage: (builtSurface * COLLATERAL_TIERS.optimistic) / loan,
    },
  };

  // Key Metrics — use unit mix totals across portfolio
  const stab = realistic.stabilisedYear;

  const totalVillaUnits = a.portfolio.reduce((s, p) => s + p.villaUnits * p.count, 0);
  const totalStdSuites = a.portfolio.reduce((s, p) => s + p.standardSuites * p.count, 0);
  const totalDblSuites = a.portfolio.reduce((s, p) => s + p.doubleSuites * p.count, 0);

  const breakEvenDS = activeDebt.annualDS;
  const revenuePerNight =
    a.revenueRealistic.villaADR * totalVillaUnits +
    a.revenueRealistic.suiteStandardADR * totalStdSuites +
    a.revenueRealistic.suiteDoubleADR * totalDblSuites;
  const breakEvenNights = revenuePerNight > 0
    ? Math.round(breakEvenDS / revenuePerNight)
    : 0;

  const bufferToBreakEven =
    stab && stab.totalRevenue > 0
      ? -((stab.totalRevenue - (breakEvenDS + stab.totalOpex)) /
          stab.totalRevenue)
      : 0;

  const keyMetrics = {
    stabilisedRevenue: stab?.totalRevenue ?? 0,
    stabilisedEBITDA: stab?.ebitda ?? 0,
    stabilisedEBITDAMargin: stab?.ebitdaMargin ?? 0,
    stabilisedDSCR: stab?.dscr ?? 0,
    stabilisedNCF: stab?.netCashFlowPostVAT ?? 0,
    totalCapex: capex.portfolioTotal,
    loanAmount: activeDebt.loanAmount,
    equityRequired: activeDebt.equityRequired,
    annualDS: activeDebt.annualDS,
    ltv: collateral.market.ltv,
    assetCoverage: collateral.market.coverage,
    portfolioValue: collateral.market.value,
    breakEvenNights,
    bufferToBreakEven: Math.abs(bufferToBreakEven),
    primaryLoan: activeDebt.primaryLoan ?? activeDebt.loanAmount,
    supplementaryLoan: activeDebt.supplementaryLoan ?? 0,
    landFundedByTepix: activeDebt.landFundedByTepix ?? 0,
    landFundedByCommercial: activeDebt.landFundedByCommercial ?? 0,
    // TEPIX III €8M program-cap binding amount. 0 when the cap does not
    // apply (non-tepix path) or doesn't bind (uncapped primary loan ≤ 8M).
    tepixCapBindingBy: activeDebt.tepixCapBindingBy ?? 0,
    tepixLoanCap: activeDebt.tepixLoanCap ?? 0,
    grantAmount: activeDebt.grantAmount,
    // Ring-fenced interest reserve injected at close to pre-fund all
    // grace-period interest. NOT structural equity (equityRequired stays
    // CapEx × (1−LTV)). Used as IRR denominator add-on only.
    graceInterestCarry: activeDebt.graceInterestCarry,
    // Number of years the reserve is held (graceEndYear − HORIZON_START_YEAR + 1).
    graceInterestHoldYears: activeDebt.graceEndYear - HORIZON_START_YEAR + 1,
    // 1 month of opening-year portfolioOpex. Equity-funded pre-opening buffer.
    // Total day-one equity = equityRequired + graceInterestCarry + preOpeningEquityBuffer.
    // portfolioOpex is financing-path-independent; use realistic scenario.
    preOpeningEquityBuffer: realistic.preOpeningEquityBuffer,
    // FI-04: Loan-to-Cost — fraction of total project cost financed by debt.
    loanToProjectCost: capex.portfolioTotal > 0
      ? activeDebt.loanAmount / capex.portfolioTotal
      : 0,
  };

  const computeTimeMs = performance.now() - startTime;

  return {
    capex,
    scenarios: { realistic, upside, downside, breakeven },
    grantScenario,
    rrfScenario: rrfRealistic,
    commercialScenario: commercialRealistic,
    tepixLoanScenario: tepixLoanRealistic,
    optimaScenario,
    financingComparison,
    keyMetrics,
    dscrByYear,
    collateral,
    activeFinancingPath: a.financingPath,
    computeTimeMs,
  };
}
