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
  getPropertyDisplayType,
  computeTotalArea,
} from './types';
import { DOWNSIDE_FACTORS, DEFAULT_ROOM_AREAS, DEFAULT_EXIT_EBITDA_MULTIPLE, DEFAULT_PORTFOLIO_OPEX, PROJECT_CONSTANTS } from './defaults';
import { computeWorkingCapital } from './workingCapital';

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
  graceEndYear: number
): Map<number, AmortYear> {
  const map = new Map<number, AmortYear>();
  let balance = loanAmount;
  for (let year = startYear; year <= endYear; year++) {
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

function computeCapexPerUnit(prop: PropertyConfig): number {
  const area = areaOf(prop);
  const construction = area * prop.constructionCostPerM2;
  const contingency = (construction + prop.ffeCost) * prop.contingencyRate;
  return (
    prop.landCost +
    construction +
    prop.ffeCost +
    prop.legalFees +
    prop.architectFees +
    prop.civilEngineerFees +
    contingency
  );
}

function computeCapex(a: ModelAssumptions): CapexBreakdown {
  const totalPlots = a.portfolio.reduce((sum, p) => sum + p.count, 0);

  const properties: CapexPropertyLine[] = a.portfolio.map((prop) => {
    const perUnit = computeCapexPerUnit(prop);
    return {
      id: prop.id,
      name: prop.name,
      count: prop.count,
      perUnit,
      total: perUnit * prop.count,
    };
  });

  const acqLegal = a.acquisitionLegalPerPlot * totalPlots;
  const devMgmtFee = (a.developerConstructionFeePerYear ?? 0) * 2;
  const extraCapexTotal = a.portfolio.reduce(
    (sum, p) => sum + (p.extraCapexLines ?? []).reduce((s, l) => s + (l.cost || 0), 0) * p.count,
    0
  );
  // custom capex lines increase portfolioTotal and therefore tepixLoan; confirm with operator before adding lines to live scenario pre-M02
  const portfolioTotal =
    properties.reduce((sum, p) => sum + p.total, 0) + acqLegal + devMgmtFee + extraCapexTotal;

  const categoryDefs = [
    {
      name: 'Land acquisition',
      getPerUnit: (p: PropertyConfig) => p.landCost,
    },
    {
      name: 'Construction',
      getPerUnit: (p: PropertyConfig) =>
        areaOf(p) * p.constructionCostPerM2,
    },
    {
      name: 'FF&E',
      getPerUnit: (p: PropertyConfig) => p.ffeCost,
    },
    {
      name: 'Legal & notary',
      getPerUnit: (p: PropertyConfig) => p.legalFees,
    },
    {
      name: 'Architect + interior design',
      getPerUnit: (p: PropertyConfig) => p.architectFees,
    },
    {
      name: 'Civil engineer',
      getPerUnit: (p: PropertyConfig) => p.civilEngineerFees,
    },
    {
      name: 'Contingency (10% of construction + FF&E)',
      getPerUnit: (p: PropertyConfig) =>
        (areaOf(p) * p.constructionCostPerM2 + p.ffeCost) *
        p.contingencyRate,
    },
    {
      name: `Acquisition legal & due diligence (x${totalPlots} plots)`,
      getPerUnit: () => a.acquisitionLegalPerPlot,
    },
    {
      name: 'Developer management fee (construction, 2 yrs)',
      getPerUnit: () => (totalPlots > 0 ? devMgmtFee / totalPlots : 0),
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
    return { name: cat.name, perProperty, grandTotal };
  });

  return {
    properties,
    acquisitionLegal: acqLegal,
    portfolioTotal,
    totalPlots,
    categories,
  };
}

// ────────────────────────────────────────────
// PMT calculation (matching Excel PMT)
// ────────────────────────────────────────────

function pmt(rate: number, nper: number, pv: number): number {
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
    const annualDS = pmt(
      a.commercialLoan.interestRate,
      a.commercialLoan.repaymentTermYears,
      loanAmount
    );

    return {
      annualDS,
      loanAmount,
      equityRequired: equity,
      grantAmount: 0,
      effectiveInterestRate: a.commercialLoan.interestRate,
      repaymentTermYears: a.commercialLoan.repaymentTermYears,
      getDS: (year: number) => {
        const graceEnd = HORIZON_START_YEAR + (a.commercialLoan.gracePeriodYears ?? 2);
        if (year === HORIZON_START_YEAR) return a.commercialLoan.interest2026;
        if (year === HORIZON_START_YEAR + 1) return a.commercialLoan.interest2027;
        if (year === graceEnd) return a.commercialLoan.interest2028;
        if (year >= FIRST_OPERATIONAL_YEAR) return annualDS;
        return 0;
      },
    };
  }

  if (path === 'grant') {
    const totalLand = computeTotalLand(a);
    const acqLegal = a.acquisitionLegalPerPlot * totalPlots;
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

    return {
      annualDS,
      loanAmount: remainingLoan,
      equityRequired: equity,
      grantAmount: grantAmt,
      effectiveInterestRate: a.commercialLoan.interestRate,
      repaymentTermYears: a.commercialLoan.repaymentTermYears,
      getDS: (year: number) => {
        const graceEnd = HORIZON_START_YEAR + (a.commercialLoan.gracePeriodYears ?? 2);
        if (year === HORIZON_START_YEAR) return a.grant.interest2026 ?? 50625;
        if (year === HORIZON_START_YEAR + 1) return a.grant.interest2027 ?? 110544;
        if (year === graceEnd) return a.grant.interest2028 ?? 114109;
        if (year >= FIRST_OPERATIONAL_YEAR) return annualDS;
        return 0;
      },
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
    return {
      annualDS: computedDS || annualDS,
      loanAmount: totalLoan,
      equityRequired: equity,
      grantAmount: 0,
      effectiveInterestRate: rrfBlendedRate,
      repaymentTermYears: a.rrf.repaymentTermYears,
      getDS: (year: number) => {
        const graceEnd = HORIZON_START_YEAR + (a.rrf?.gracePeriodYears ?? 2);
        if (year === HORIZON_START_YEAR) return a.commercialLoan.interest2026;
        if (year === HORIZON_START_YEAR + 1) return a.commercialLoan.interest2027;
        if (year === graceEnd) return a.commercialLoan.interest2028;
        if (year >= FIRST_OPERATIONAL_YEAR) return computedDS || annualDS;
        return 0;
      },
    };
  }

  if (path === 'tepix-loan') {
    const tp = a.tepixLoan;
    const landCapRatio = tp.landCapOnFundContribution;

    const totalLand = computeTotalLand(a);
    const acqLegal = a.acquisitionLegalPerPlot * totalPlots;
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
      getDS: (year: number) => {
        if (year <= HORIZON_START_YEAR + (tp.subsidyDurationYears ?? 2) - 1) {
          const subsidisedRate = Math.max(0, tp.bankInterestRate - tp.interestSubsidy);
          const tepixInterest = bankPortion * subsidisedRate;
          const suppInterest = suppLoanAmount * a.commercialLoan.interestRate;
          return tepixInterest + suppInterest;
        }
        const tepixGraceEnd = HORIZON_START_YEAR + (tp.gracePeriodYears ?? 2);
        if (year === tepixGraceEnd) {
          // Opening/grace year. Primary TEPIX tranche starts full
          // amortisation (program-defined), but the supplementary commercial
          // loan follows the commercial-path convention: interest-only in the
          // grace year, full amortisation from the following year (Finding J).
          const suppInterest = suppLoanAmount * a.commercialLoan.interestRate;
          return primaryAnnualDS + suppInterest;
        }
        if (year > tepixGraceEnd) return combinedDS;
        return 0;
      },
    };
  }

  return {
    annualDS: 0,
    loanAmount: 0,
    equityRequired: 0,
    grantAmount: 0,
    effectiveInterestRate: a.commercialLoan.interestRate,
    repaymentTermYears: a.commercialLoan.repaymentTermYears,
    getDS: () => 0,
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
  if (year <= HORIZON_START_YEAR + 1) return 0;

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
    preOpeningAmort: 0, total: 0, yearRoundFixed: 0, variable: 0,
  };
  // No portfolio OPEX during pre-construction years
  if (year <= HORIZON_START_YEAR + 1) return ZERO;

  // TODO: apply inflationHook escalator when activated
  const po = assumptions.portfolioOpex ?? DEFAULT_PORTFOLIO_OPEX;

  const staffTotal = po.staffRoles.reduce((sum, role) => {
    if (role.yearRound) {
      return sum + role.monthlyGross * role.monthsPaid * role.burdenMultiplier + role.allowances;
    }
    const months = role.seasonalMonths ?? 0;
    const count = role.headcount ?? 1;
    return sum + role.monthlyGross * months * role.burdenMultiplier * count + role.allowances * count;
  }, 0);

  // Pool R&M is driven by poolCount × poolCostPerUnit; the annualCost on the line
  // is overridden at compute time so the stored value never drifts from the inputs.
  const poolRMCost = (po.poolCount ?? 17) * (po.poolCostPerUnit ?? 1500);
  const servicesTotal = po.sharedServices.reduce((sum, s) =>
    sum + (s.name === 'Pool R&M' ? poolRMCost : s.annualCost), 0);
  const overheadTotal = po.sharedOverhead.reduce((sum, s) => sum + s.annualCost, 0);

  const preOpeningAmort =
    year >= po.preOpeningStartYear && year < po.preOpeningStartYear + po.preOpeningAmortYears
      ? po.preOpeningTotal / po.preOpeningAmortYears
      : 0;

  const total = staffTotal + servicesTotal + overheadTotal + preOpeningAmort;
  return {
    staffTotal,
    servicesTotal,
    overheadTotal,
    preOpeningAmort,
    total,
    yearRoundFixed: staffTotal + overheadTotal,
    variable: servicesTotal,
  };
}

function getPhaseLabel(year: number): string {
  if (year === HORIZON_START_YEAR) return 'Acquisition';
  if (year === HORIZON_START_YEAR + 1) return 'Construction';
  if (year === OPENING_YEAR) return 'Opening 75%';
  if (year === FIRST_OPERATIONAL_YEAR) return 'Y2 88%';
  return 'Stabilised';
}

function computeScenario(
  name: string,
  a: ModelAssumptions,
  rev: RevenueAssumptions,
  debtResult: DebtServiceResult,
  downside?: { occupancyFactor: number; adrFactor: number; events: number }
): ScenarioOutput {
  const years = Array.from({ length: HORIZON_END_YEAR - HORIZON_START_YEAR + 1 }, (_, i) => HORIZON_START_YEAR + i);

  // Per-year P&L compute, parameterised by the year's WC interest expense.
  // Run twice: once with zero WC interest to derive cumulative cash for the
  // WC drawdown decisions, then again with the resulting WC schedule applied.
  // The interest delta between passes is small (~€5K/yr at most) so the
  // single-iteration approximation is well within rounding noise.
  const opCo = a.opCoFee;
  const opCoEnabled = !!opCo?.enabled;

  const graceEndYear = HORIZON_START_YEAR + (a.commercialLoan.gracePeriodYears ?? 2);
  const preAmortSchedule = buildAmortSchedule(
    debtResult.loanAmount,
    debtResult.effectiveInterestRate,
    debtResult.annualDS,
    debtResult.getDS,
    HORIZON_START_YEAR,
    HORIZON_END_YEAR,
    graceEndYear
  );

  const computePnLYear = (year: number, wcInterestExpense: number): Omit<AnnualPnL,
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
      // Opening year (2028): floor only (rate=0). Pre-opening: zero.
      const ffeReserveFloor = prop.opex.ffeReserveFloor ?? 0;
      const ffe = a.ffeSchedule;
      const ffeReserveRatePct =
        year < OPENING_YEAR ? 0 :
        year === OPENING_YEAR ? 0 :
        year === FIRST_OPERATIONAL_YEAR ? (ffe?.rate2029 ?? 0.02) :
        year === FIRST_OPERATIONAL_YEAR + 1 ? (ffe?.rate2030 ?? 0.03) :
        (ffe?.rateStabilised ?? 0.04);
      // Floor fires in any operational year (>= OPENING_YEAR); zero before.
      const ffeReservePerUnit = year < OPENING_YEAR
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
        totalOpex: year <= HORIZON_START_YEAR + 1 ? 0 : opexPerUnit * prop.count,
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

    const otaRate = a.tax.otaCommissionRate ?? 0;
    const grossRevenue = otaRate > 0 && year > HORIZON_START_YEAR + 1
      ? totalRevenue / (1 - otaRate)
      : totalRevenue;
    const otaCommissions = grossRevenue - totalRevenue; // positive number (will be negated in output)

    const propertyOpexAll = propertyBreakdown.reduce(
      (sum, p) => sum + p.totalOpex,
      0
    );

    // Bank view restructures the management-fee line:
    //   internal view: per-villa `managementFee` lives inside propertyOpex
    //                  (sum across portfolio ≈ €100K @ BASE_CASE).
    //   bank view:     strip per-villa managementFee from OpEx; replace it
    //                  with a single `opCoSeniorFloor` (€24K @ BASE_CASE)
    //                  paid SENIOR to debt service. Anything OpCo bills
    //                  above that floor is JUNIOR (paid out of residual
    //                  cash after DS — see waterfall block below).
    // Per-villa managementFee aggregated across the portfolio. Always 0 in the
    // current model (managementFee is deprecated and set to 0 in all templates).
    // Retained for the OpEx swap logic below; safe to sum because managementFee
    // is now optional and defaults to 0.
    const perVillaMgmtFeeTotal =
      year <= HORIZON_START_YEAR + 1
        ? 0
        : a.portfolio.reduce(
            (sum, prop) => sum + (prop.opex.managementFee ?? 0) * prop.count,
            0,
          );

    // Senior management fee paid inside OpEx (bank view only; zero pre-ops).
    // The floor is PER PROJECT (plot): €25K × number of projects = €75K total
    // at 3 plots. Mirrors the construction-phase minimum (€75K/yr CAPEX) so
    // Eytan's minimum compensation is consistent across both phases.
    const totalVillaCount = a.portfolio.reduce((sum, prop) => sum + prop.count, 0);
    const seniorMgmtFee =
      year > HORIZON_START_YEAR + 1 ? (a.opCoSeniorFloor ?? 0) * totalVillaCount : 0;

    // OpEx that flows into EBITDA pre-OpCo.
    //   internal: legacy — keep per-villa managementFee in propertyOpex.
    //   bank:     remove per-villa managementFee, add the senior floor.
    const propertyOpex = propertyOpexAll - perVillaMgmtFeeTotal + seniorMgmtFee;

    // Portfolio OPEX (undistributed shared overhead — staff, services, overhead, pre-opening amort).
    // NOTE: opexContingencyRate does NOT apply to portfolio OPEX — separate code path.
    const portfolioOpexResult = computePortfolioOpex(year, a);

    // WC interest is a real cash cost but must NOT reduce ebitdaPreOpCo, which
    // is the DSCR numerator. It is excluded from totalOpex here and instead
    // deducted explicitly from ncf and cfads downstream (Finding A fix).
    const totalOpex = propertyOpex + portfolioOpexResult.total;

    // EBITDA pre-OpCo (= GOP) before any *junior* management-company fees
    // are taken. In bank view, EBITDA pre-OpCo is already net of the senior
    // floor — that's the point: the floor crosses DSCR; the overage does not.
    // WC interest is NOT in ebitdaPreOpCo — it belongs in the DSCR denominator
    // only (via dscrLoaded) and is deducted below when computing ncf/cfads.
    const ebitdaPreOpCo = totalRevenue - totalOpex;

    const ds = debtResult.getDS(year);

    // ── Unified tiered junior formula ─────────────────────────────────────
    // Legacy params (baseMgmtFeeRate, incentiveFeeRate, opcoAnnualFeeCap,
    // shareholderMinResidualShare) are inert — kept on OpCoFeeParams for
    // Firestore backward-compat only.
    const tier1Rate  = opCo.juniorTier1Rate        ?? 0.10;
    const tier2Rate  = opCo.juniorTier2Rate        ?? 0.15;
    const threshold  = opCo.juniorResidualThreshold ?? 500_000;
    const residualAfterDS = Math.max(0, ebitdaPreOpCo - ds);
    const tier1Amount     = opCoEnabled ? tier1Rate * Math.min(residualAfterDS, threshold)     : 0;
    const tier2Amount     = opCoEnabled ? tier2Rate * Math.max(0, residualAfterDS - threshold) : 0;
    const opCoJuniorPaid  = tier1Amount + tier2Amount;

    // Legacy AnnualPnL fields repurposed for new semantics (field names unchanged
    // so existing consumers keep working without type changes):
    //   opCoBaseFee      ← senior floor (was "base management fee")
    //   opCoBrandFee     ← 0, retired
    //   opCoIncentiveFee ← junior paid (was "incentive fee")
    //   opCoTotalFeeRaw  ← juniorPaid ONLY — this is the IRR add-back basis.
    //                      Senior floor is in OpEx and must NOT be added back.
    //   opCoTotalFee     ← seniorFloor + juniorPaid (total OpCo cost)
    const opCoBaseFee      = seniorMgmtFee;
    const opCoBrandFee     = 0;
    const opCoIncentiveFee = opCoJuniorPaid;
    const opCoTotalFeeRaw  = opCoJuniorPaid;
    const opCoTotalFee     = seniorMgmtFee + opCoJuniorPaid;

    const amortYear = preAmortSchedule.get(year);
    const termLoanInterestForTax = amortYear?.interest ?? 0;
    const vat = year <= HORIZON_START_YEAR + 1 ? 0 : -(grossRevenue * a.tax.netVATRate);

    // ── Unified waterfall (both views) ────────────────────────────────────
    // Senior floor is already in OpEx (seniorMgmtFee → propertyOpex → totalOpex
    // → ebitdaPreOpCo). Junior fee is subordinated to DS and paid only from
    // post-DS residual. DSCR uses ebitdaPreOpCo / DS in both views — junior
    // is never in the DSCR numerator.
    //
    // NOTE (Finding A): wcInterestExpense is excluded from totalOpex / ebitdaPreOpCo
    // so it does NOT affect the DSCR numerator. It is a real cash cost and is
    // deducted explicitly from ncf, taxableProfit, and cfads below.
    // dscrLoaded carries it in the denominator: ebitdaPreOpCo / (ds + wcInterest).
    //
    // CIT: OpCo fees to a related entity are deductible at the PropCo level
    // under Greek CIT. Senior floor is implicit in ebitdaPreOpCo; only the
    // junior tranche is subtracted from the taxable base here.
    //
    // Junior shortfall is forfeit for the year (no accrual / carryover).

    // ── Unified waterfall (both views) ────────────────────────────────────
    const opCoSeniorPaid   = seniorMgmtFee;
    const ebitda           = ebitdaPreOpCo - opCoJuniorPaid;
    const ncf              = ebitdaPreOpCo - ds - opCoJuniorPaid - wcInterestExpense;
    const dscr             = ds > 0 ? ebitdaPreOpCo / ds : 0;
    const dscrLoaded       = ds + wcInterestExpense > 0
      ? ebitdaPreOpCo / (ds + wcInterestExpense) : 0;
    const taxableProfit    = Math.max(
      0,
      ebitdaPreOpCo - opCoJuniorPaid - wcInterestExpense - termLoanInterestForTax,
    );

    const ebitdaMargin = totalRevenue > 0 ? ebitda / totalRevenue : 0;

    const cit = year <= HORIZON_START_YEAR + 1 ? 0 : -(taxableProfit * a.tax.corporateIncomeTaxRate);
    // CFADS for LLCR/PLCR + project IRR. CIT stored negative; adding it
    // subtracts the tax bill. Uses pre-junior-fee EBITDA so CFADS represents
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
      opCoBaseFee,
      opCoBrandFee,
      opCoIncentiveFee,
      opCoTotalFee,
      opCoTotalFeeRaw,
      opCoSeniorPaid,
      opCoJuniorPaid,
      ebitda,
      ebitdaMargin,
      debtService: ds,
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
    };
  };

  // Pass 1: baseline P&L without WC interest. Build cumulative-cash map for
  // gating the seasonal draw decisions.
  const baselineCumByYear = new Map<number, number>();
  {
    let cum = 0;
    for (const year of years) {
      const baseline = computePnLYear(year, 0);
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
  let cumulativeNCF = 0;
  let cumulativeYieldOnInitialEquity = 0;
  const pnl: AnnualPnL[] = years.map((year) => {
    const wcAnnual = wcSchedule.annual.get(year);
    const wcInterestExpense = wcAnnual?.interestExpense ?? 0;
    const yearPnL = computePnLYear(year, wcInterestExpense);
    cumulativeNCF += yearPnL.netCashFlowPostVAT;
    cumulativeYieldOnInitialEquity += yearPnL.yieldOnInitialEquity;
    const amort = amortSchedule.get(year);
    const termLoanInterest = amort?.interest ?? 0;
    const termLoanPrincipal = amort?.principal ?? 0;
    const termLoanBalance = amort?.closing ?? 0;
    const interestCoverageRatio =
      termLoanInterest > 0 ? yearPnL.ebitda / termLoanInterest : 0;
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
    };
  });

  // ── Pass 3: DSRA ──────────────────────────────────────────────────────────
  // Always runs — no user toggle. When every year's CFADS ≥ target×DS,
  // dsraTarget = 0 and all reserve fields are naturally zero (no-op).
  const dsraParams = a.dsra;
  const targetDSCR = dsraParams?.targetDSCR ?? 1.25;
  const sweep2028Pct = dsraParams?.sweep2028Pct ?? 1.0;
  const replenishmentPriority = dsraParams?.replenishmentPriority ?? 1.0;
  const partnerRepaymentThreshold = dsraParams?.partnerRepaymentThreshold ?? 2;

  // Step 3.2 — Worst-year shortfall → DSRA target size
  const operationalRows = pnl.filter(row => row.year >= FIRST_OPERATIONAL_YEAR);
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

  // Step 3.5 — Pre-operational rows: zeros, effectiveDSCR = dscr
  for (const row of pnl.filter(r => r.year < FIRST_OPERATIONAL_YEAR)) {
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

  const gracePeriodInterestTotal =
    debtResult.getDS(HORIZON_START_YEAR) + debtResult.getDS(HORIZON_START_YEAR + 1) + debtResult.getDS(graceEndYear);

  const dscrWindowStart = graceEndYear + 1;
  const operationalDscrs = pnl
    .filter((p) => p.year >= dscrWindowStart && p.dscr > 0)
    .map((p) => p.dscr);
  const minDSCRLoanLife = operationalDscrs.length
    ? Math.min(...operationalDscrs)
    : 0;
  const avgDSCRLoanLife = operationalDscrs.length
    ? operationalDscrs.reduce((s, v) => s + v, 0) / operationalDscrs.length
    : 0;
  const covenantThreshold = a.dscrCovenantThreshold || 1.25;
  // Covenant tested against average (not minimum) — ramp years skew min unduly
  const dscrCovenantHeadroom =
    avgDSCRLoanLife > 0
      ? (avgDSCRLoanLife - covenantThreshold) / covenantThreshold
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

  // Equity IRR: -equity at t=0, NCF post-tax stream, terminal equity at exit.
  const equityCFs: number[] = [-debtResult.equityRequired];
  truncatedPnL.forEach((p, i) => {
    const cf =
      i === truncatedPnL.length - 1
        ? p.netCashFlowPostVAT + terminalEquityValue
        : p.netCashFlowPostVAT;
    equityCFs.push(cf);
  });
  const equityIRRRaw = irr(equityCFs);
  const equityIRR = isFinite(equityIRRRaw) ? equityIRRRaw : 0;

  // Total MOIC including exit lump sum. Distinct from cumulativeYieldFinal,
  // which only sums operating distributions (= the "Operating Yield" widget).
  // Numerator includes terminalEquityValue at exit; denominator is initial
  // equity required. Returns 0 if equity is zero (avoid divide-by-zero).
  const operatingDistributions = truncatedPnL.reduce(
    (sum, p) => sum + p.netCashFlowPostVAT,
    0,
  );
  const totalMOIC =
    debtResult.equityRequired > 0
      ? (operatingDistributions + terminalEquityValue) / debtResult.equityRequired
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
  const equityCFsPreOpCo: number[] = [-debtResult.equityRequired];
  truncatedPnL.forEach((p, i) => {
    const addBack = p.opCoTotalFeeRaw ?? p.opCoTotalFee;
    const cf =
      i === truncatedPnL.length - 1
        ? p.netCashFlowPostVAT + addBack + terminalEquityValuePreOpCo
        : p.netCashFlowPostVAT + addBack;
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

  // Equity IRR under the property-sale exit. Identical operating-year cash
  // flows; only the terminal value differs.
  const equityCFsPropertySale: number[] = [-debtResult.equityRequired];
  truncatedPnL.forEach((p, i) => {
    const cf =
      i === truncatedPnL.length - 1
        ? p.netCashFlowPostVAT + terminalEquityValuePropertySale
        : p.netCashFlowPostVAT;
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
  // the property-sale terminal equity substituted in.
  const totalMOICPropertySale =
    debtResult.equityRequired > 0
      ? (operatingDistributions + terminalEquityValuePropertySale) /
        debtResult.equityRequired
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

  const yieldStabilised = stab?.yieldOnInitialEquity ?? 0;
  const cumulativeYieldFinal = finalYear?.cumulativeYieldOnInitialEquity ?? 0;

  return {
    name,
    pnl,
    stabilisedYear,
    wcQuarters: wcSchedule.quarters,
    wcEffectiveFacility: wcSchedule.effectiveFacility,
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
  };
}

// ────────────────────────────────────────────
// MAIN COMPUTE
// ────────────────────────────────────────────

export function computeModel(a: ModelAssumptions): ModelOutput {
  const startTime = performance.now();

  const capex = computeCapex(a);

  const commercialDebt = computeDebtService(a, capex, 'commercial');
  const grantDebt = computeDebtService(a, capex, 'grant');
  const rrfDebt = computeDebtService(a, capex, 'rrf');
  const tepixLoanDebt = computeDebtService(a, capex, 'tepix-loan');

  const activeDebt =
    a.financingPath === 'grant'
      ? grantDebt
      : a.financingPath === 'rrf'
        ? rrfDebt
        : a.financingPath === 'tepix-loan'
          ? tepixLoanDebt
          : commercialDebt;

  const realistic = computeScenario(
    'Realistic',
    a,
    a.revenueRealistic,
    activeDebt
  );
  const upside = computeScenario('Upside', a, a.revenueUpside, activeDebt);
  const downside = computeScenario(
    'Downside',
    a,
    a.revenueRealistic,
    activeDebt,
    {
      occupancyFactor: DOWNSIDE_FACTORS.occupancyReduction,
      adrFactor: DOWNSIDE_FACTORS.adrReduction,
      events: DOWNSIDE_FACTORS.eventsPerYear,
    }
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
    }
  );

  const grantScenario = computeScenario(
    'Grant Path',
    a,
    a.revenueRealistic,
    grantDebt
  );

  // DSCR by year
  const commercialRealistic = computeScenario(
    'comm',
    a,
    a.revenueRealistic,
    commercialDebt
  );
  const rrfRealistic = computeScenario(
    'rrf',
    a,
    a.revenueRealistic,
    rrfDebt
  );
  const commercialUpside = computeScenario(
    'commUp',
    a,
    a.revenueUpside,
    commercialDebt
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
    }
  );

  const tepixLoanRealistic = computeScenario(
    'tepixLoan',
    a,
    a.revenueRealistic,
    tepixLoanDebt
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
    },
    {
      key: 'grantReceived',
      metric: 'Grant received',
      commercial: 0,
      rrf: 0,
      grant: grantDebt.grantAmount,
      tepixLoan: 0,
    },
    {
      key: 'equityRequired',
      metric: 'Equity required',
      commercial: commercialDebt.equityRequired,
      rrf: rrfDebt.equityRequired,
      grant: grantDebt.equityRequired,
      tepixLoan: tepixLoanDebt.equityRequired,
    },
    {
      key: 'annualDebtService',
      metric: 'Annual debt service',
      commercial: commercialDebt.annualDS,
      rrf: rrfDebt.annualDS,
      grant: grantDebt.annualDS,
      tepixLoan: tepixLoanDebt.annualDS,
    },
    {
      key: 'stabilisedDSCR',
      metric: `DSCR — Realistic (${STABILISED_YEAR})`,
      commercial: commercialRealistic.stabilisedYear?.dscr ?? 0,
      rrf: rrfRealistic.stabilisedYear?.dscr ?? 0,
      grant: grantScenario.stabilisedYear?.dscr ?? 0,
      tepixLoan: tepixLoanRealistic.stabilisedYear?.dscr ?? 0,
    },
    {
      key: 'supplementaryLoan',
      metric: 'Supplementary commercial loan',
      commercial: '—',
      rrf: '—',
      grant: '—',
      tepixLoan: tepixLoanDebt.supplementaryLoan ?? 0,
    },
    {
      key: 'equitySavingVsCommercial',
      metric: 'Equity saving vs. commercial',
      commercial: '—',
      rrf: commercialDebt.equityRequired - rrfDebt.equityRequired,
      grant: commercialDebt.equityRequired - grantDebt.equityRequired,
      tepixLoan:
        commercialDebt.equityRequired - tepixLoanDebt.equityRequired,
    },
    // DSRA rows — appended when at least one path needs a reserve
    ...([commercialRealistic, rrfRealistic, grantScenario, tepixLoanRealistic].some(
      s => (s.dsraTarget ?? 0) > 0
    ) ? [
      {
        key: 'dsraTarget' as const,
        metric: 'DSRA reserve (total)',
        commercial: commercialRealistic.dsraTarget ?? 0,
        rrf: rrfRealistic.dsraTarget ?? 0,
        grant: grantScenario.dsraTarget ?? 0,
        tepixLoan: tepixLoanRealistic.dsraTarget ?? 0,
      },
      {
        key: 'effectiveDSCRStabilised' as const,
        metric: `Effective DSCR — incl. DSRA (${STABILISED_YEAR})`,
        commercial: commercialRealistic.stabilisedYear?.effectiveDSCR ?? commercialRealistic.stabilisedYear?.dscr ?? 0,
        rrf: rrfRealistic.stabilisedYear?.effectiveDSCR ?? rrfRealistic.stabilisedYear?.dscr ?? 0,
        grant: grantScenario.stabilisedYear?.effectiveDSCR ?? grantScenario.stabilisedYear?.dscr ?? 0,
        tepixLoan: tepixLoanRealistic.stabilisedYear?.effectiveDSCR ?? tepixLoanRealistic.stabilisedYear?.dscr ?? 0,
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
  };

  const computeTimeMs = performance.now() - startTime;

  return {
    capex,
    scenarios: { realistic, upside, downside, breakeven },
    grantScenario,
    rrfScenario: rrfRealistic,
    commercialScenario: commercialRealistic,
    tepixLoanScenario: tepixLoanRealistic,
    financingComparison,
    keyMetrics,
    dscrByYear,
    collateral,
    activeFinancingPath: a.financingPath,
    computeTimeMs,
  };
}
