// ============================================================
// VILLA LEV GROUP — Financial Computation Engine
// ============================================================

import {
  ModelAssumptions,
  ModelOutput,
  CapexBreakdown,
  AnnualPnL,
  ScenarioOutput,
  RevenueAssumptions,
  FinancingComparison,
  FinancingPath,
} from './types';
import { DOWNSIDE_FACTORS } from './defaults';

// ────────────────────────────────────────────
// CAPEX
// ────────────────────────────────────────────

function computeCapex(a: ModelAssumptions): CapexBreakdown {
  const propA = a.properties.propertyA;
  const propB = a.properties.propertyB;

  const constructionA = propA.constructionArea * propA.constructionCostPerM2;
  const constructionB = propB.constructionArea * propB.constructionCostPerM2;
  const contingencyA = (constructionA + propA.ffeCost) * propA.contingencyRate;
  const contingencyB = (constructionB + propB.ffeCost) * propB.contingencyRate;

  const perUnitA =
    propA.landCost +
    constructionA +
    propA.ffeCost +
    propA.legalFees +
    propA.architectFees +
    propA.civilEngineerFees +
    contingencyA;

  const totalB =
    propB.landCost +
    constructionB +
    propB.ffeCost +
    propB.legalFees +
    propB.architectFees +
    propB.civilEngineerFees +
    contingencyB;

  const acqLegal = a.acquisitionLegalPerPlot * 3;
  const totalA = perUnitA * a.numberOfPropertyA;
  const portfolio = totalA + totalB + acqLegal;

  const categories = [
    {
      name: 'Land acquisition',
      propAPerUnit: propA.landCost,
      propATotal: propA.landCost * a.numberOfPropertyA,
      propB: propB.landCost,
      total:
        propA.landCost * a.numberOfPropertyA + propB.landCost,
    },
    {
      name: `Construction (${propA.constructionArea}m² / ${propB.constructionArea}m² × €${propA.constructionCostPerM2}/m²)`,
      propAPerUnit: constructionA,
      propATotal: constructionA * a.numberOfPropertyA,
      propB: constructionB,
      total:
        constructionA * a.numberOfPropertyA + constructionB,
    },
    {
      name: 'FF&E',
      propAPerUnit: propA.ffeCost,
      propATotal: propA.ffeCost * a.numberOfPropertyA,
      propB: propB.ffeCost,
      total: propA.ffeCost * a.numberOfPropertyA + propB.ffeCost,
    },
    {
      name: 'Legal & notary',
      propAPerUnit: propA.legalFees,
      propATotal: propA.legalFees * a.numberOfPropertyA,
      propB: propB.legalFees,
      total: propA.legalFees * a.numberOfPropertyA + propB.legalFees,
    },
    {
      name: 'Architect + interior design',
      propAPerUnit: propA.architectFees,
      propATotal: propA.architectFees * a.numberOfPropertyA,
      propB: propB.architectFees,
      total: propA.architectFees * a.numberOfPropertyA + propB.architectFees,
    },
    {
      name: 'Civil engineer',
      propAPerUnit: propA.civilEngineerFees,
      propATotal: propA.civilEngineerFees * a.numberOfPropertyA,
      propB: propB.civilEngineerFees,
      total:
        propA.civilEngineerFees * a.numberOfPropertyA + propB.civilEngineerFees,
    },
    {
      name: 'Contingency (10% of construction + FF&E)',
      propAPerUnit: contingencyA,
      propATotal: contingencyA * a.numberOfPropertyA,
      propB: contingencyB,
      total: contingencyA * a.numberOfPropertyA + contingencyB,
    },
    {
      name: 'Acquisition legal & due diligence (×3 plots)',
      propAPerUnit: a.acquisitionLegalPerPlot,
      propATotal: acqLegal,
      propB: 0,
      total: acqLegal,
    },
  ];

  return {
    propertyAPerUnit: perUnitA,
    propertyATotal: totalA,
    propertyBTotal: totalB,
    acquisitionLegal: acqLegal,
    portfolioTotal: portfolio,
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
}

function computeDebtService(
  a: ModelAssumptions,
  capex: CapexBreakdown,
  path: FinancingPath
): DebtServiceResult {
  const totalCost = capex.portfolioTotal;

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
      getDS: (year: number) => {
        if (year === 2026) return a.commercialLoan.interest2026;
        if (year === 2027) return a.commercialLoan.interest2027;
        if (year === 2028) return a.commercialLoan.interest2028;
        if (year >= 2029) return annualDS;
        return 0;
      },
    };
  }

  if (path === 'grant') {
    // Non-plot eligible costs = total CAPEX - land (3 plots) - acquisition legal
    const totalLand =
      a.properties.propertyA.landCost * a.numberOfPropertyA +
      a.properties.propertyB.landCost;
    const acqLegal = a.acquisitionLegalPerPlot * 3;
    const nonPlotEligible = totalCost - totalLand - acqLegal;
    const grantAmt = nonPlotEligible * a.grant.grantRate;

    // Phase 1 = plots + permits = €1,350,000
    const phase1 = 1350000;
    const phase1Loan = phase1 * a.commercialLoan.loanCoverageRate;
    const phase1Equity = phase1 - phase1Loan;

    // Phase 2 after grant
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
      getDS: (year: number) => {
        if (year === 2026) return a.grant.interest2026 ?? 50625;
        if (year === 2027) return a.grant.interest2027 ?? 110544;
        if (year === 2028) return a.grant.interest2028 ?? 114109;
        if (year >= 2029) return annualDS;
        return 0;
      },
    };
  }

  // RRF Path — 80/20 structure
  if (path === 'rrf') {
    const totalLoan = a.rrf.totalLoanDrawn;
    const equity = a.rrf.equityRequired;
    const annualDS = a.rrf.annualDS;

    // Calculate RRF DS properly: 80% at 0.35%, 20% at 5%
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

    return {
      annualDS: computedDS || annualDS,
      loanAmount: totalLoan,
      equityRequired: equity,
      grantAmount: 0,
      getDS: (year: number) => {
        if (year === 2026) return a.commercialLoan.interest2026;
        if (year === 2027) return a.commercialLoan.interest2027;
        if (year === 2028) return a.commercialLoan.interest2028;
        if (year >= 2029) return computedDS || annualDS;
        return 0;
      },
    };
  }

  // TEPIX Loan Fund — 40% HDB interest-free + 60% bank
  if (path === 'tepix-loan') {
    const tp = a.tepixLoan;
    const loanAmount = totalCost * tp.coverageRate;
    const equity = totalCost - loanAmount;
    const amortYears = tp.totalTermYears - tp.gracePeriodYears; // 10
    const hdbPortion = loanAmount * tp.hdbShareOfLoan;
    const bankPortion = loanAmount * tp.bankShareOfLoan;
    // HDB portion is interest-free, amortized over amortYears
    const hdbAnnual = hdbPortion / amortYears;
    // Bank portion at bankInterestRate, amortized over amortYears
    const bankAnnual = pmt(tp.bankInterestRate, amortYears, bankPortion);
    const annualDS = hdbAnnual + bankAnnual;

    return {
      annualDS,
      loanAmount,
      equityRequired: equity,
      grantAmount: 0,
      getDS: (year: number) => {
        // Grace years: interest only on bank portion (subsidised in Y1-Y2)
        if (year === 2026 || year === 2027) {
          const subsidisedRate = Math.max(0, tp.bankInterestRate - tp.interestSubsidy);
          return bankPortion * subsidisedRate;
        }
        if (year === 2028) {
          // Grace year 3 if applicable, or first amortization year
          // Grace is 2 years (2026-2027), so 2028 = first amortization year
          return annualDS;
        }
        if (year >= 2029) return annualDS;
        return 0;
      },
    };
  }

  // TEPIX Guarantee Fund — full bank loan, 70% guarantee
  if (path === 'tepix-guarantee') {
    const tg = a.tepixGuarantee;
    const loanAmount = totalCost * tg.coverageRate;
    const equity = totalCost - loanAmount;
    const amortYears = tg.totalTermYears - tg.gracePeriodYears; // 10
    // Full loan at bank interest rate
    const annualDS = pmt(tg.bankInterestRate, amortYears, loanAmount);

    return {
      annualDS,
      loanAmount,
      equityRequired: equity,
      grantAmount: 0,
      getDS: (year: number) => {
        // Grace years: interest only (subsidised in Y1-Y2)
        if (year === 2026 || year === 2027) {
          const subsidisedRate = Math.max(0, tg.bankInterestRate - tg.interestSubsidy);
          return loanAmount * subsidisedRate;
        }
        if (year === 2028) return annualDS;
        if (year >= 2029) return annualDS;
        return 0;
      },
    };
  }

  // fallback
  return {
    annualDS: 0,
    loanAmount: 0,
    equityRequired: 0,
    grantAmount: 0,
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
  if (year <= 2027) return 0;
  if (year <= 2029) return baseNights;
  return Math.min(cap, baseNights + Math.max(0, year - 2030) * growthPerYear);
}

function computeRampFactor(year: number, a: ModelAssumptions): number {
  if (year === 2028) return a.general.year1RampFactor;
  if (year === 2029) return a.general.year2RampFactor;
  if (year >= 2030) return 1;
  return 0;
}

function computeOpexForYear(
  year: number,
  a: ModelAssumptions,
  propType: 'A' | 'B'
): number {
  if (year <= 2027) return 0;

  const constructionCost =
    propType === 'A'
      ? a.properties.propertyA.constructionArea *
        a.properties.propertyA.constructionCostPerM2
      : a.properties.propertyB.constructionArea *
        a.properties.propertyB.constructionCostPerM2;

  // Maintenance phasing: Y1-2 (2028-2029) = 0.5%, Y3 (2030) = 1.0%, Y4+ (2031+) = 1.5%
  let maintenanceRate: number;
  if (year <= 2029) maintenanceRate = 0.005;
  else if (year === 2030) maintenanceRate = 0.01;
  else maintenanceRate = 0.015;

  const maintenance = constructionCost * maintenanceRate;

  const opex = propType === 'A' ? a.opex.propertyA : a.opex.propertyB;
  const baseOpexNoMaintenance =
    opex.housekeeping +
    opex.utilities +
    opex.insurance +
    opex.propertyTax +
    opex.marketing +
    opex.managementFee +
    opex.consumables +
    opex.accounting;

  return baseOpexNoMaintenance + maintenance;
}

function getPhaseLabel(year: number): string {
  if (year === 2026) return 'Acquisition';
  if (year === 2027) return 'Construction';
  if (year === 2028) return 'Opening 75%';
  if (year === 2029) return 'Y2 88%';
  return 'Stabilised';
}

function computeScenario(
  name: string,
  a: ModelAssumptions,
  rev: RevenueAssumptions,
  debtResult: DebtServiceResult,
  downside?: { occupancyFactor: number; adrFactor: number; events: number }
): ScenarioOutput {
  const years = Array.from({ length: 11 }, (_, i) => 2026 + i);
  let cumulativeNCF = 0;

  const pnl: AnnualPnL[] = years.map((year) => {
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

    // Apply downside adjustments
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

    // Revenue per property
    const revenueA = year <= 2027 ? 0 : effVillaNights * effVillaADR * ramp;
    const revenueB =
      year <= 2027
        ? 0
        : (2 * effSuiteNights * effStdADR +
            2 * effSuiteNights * effDblADR) *
          ramp;
    const revenueEvents =
      year <= 2027 ? 0 : effEvents * rev.netProfitPerEvent * ramp;
    const revenueAncillary =
      year < 2028
        ? 0
        : rev.ancillaryBaseProfit *
          Math.pow(1 + rev.ancillaryGrowthRate, year - 2028);

    const totalRevenue =
      revenueA * a.numberOfPropertyA + revenueB + revenueEvents + revenueAncillary;

    // OPEX per property
    const opexA = computeOpexForYear(year, a, 'A');
    const opexB = computeOpexForYear(year, a, 'B');
    const totalOpex =
      year <= 2027 ? 0 : opexA * a.numberOfPropertyA + opexB;

    const ebitda = totalRevenue - totalOpex;
    const ebitdaMargin = totalRevenue > 0 ? ebitda / totalRevenue : 0;

    // Debt service
    const ds = debtResult.getDS(year);
    const ncf = ebitda - ds;
    cumulativeNCF += ncf;

    // VAT
    const vat = year <= 2027 ? 0 : -(totalRevenue * a.tax.netVATRate);
    const ncfPostVAT = ncf + vat;

    // DSCR
    const dscr = ds > 0 ? ebitda / ds : 0;

    return {
      year,
      phase: getPhaseLabel(year),
      villaNightsPerProject: Math.round(
        downside ? effVillaNights : villaNights
      ),
      suiteNightsPerSuite: Math.round(downside ? effSuiteNights : suiteNights),
      revenueA1: revenueA,
      revenueA2: revenueA,
      revenueB,
      revenueEvents,
      revenueAncillary,
      totalRevenue,
      opexA1: opexA,
      opexA2: opexA,
      opexB,
      totalOpex,
      ebitda,
      ebitdaMargin,
      debtService: ds,
      netCashFlow: ncf,
      cumulativeNCF,
      vatPayable: vat,
      netCashFlowPostVAT: ncfPostVAT,
      dscr,
    };
  });

  const stabilisedYear = pnl.find((p) => p.year === 2031) ?? null;

  return { name, pnl, stabilisedYear };
}

// ────────────────────────────────────────────
// MAIN COMPUTE
// ────────────────────────────────────────────

export function computeModel(a: ModelAssumptions): ModelOutput {
  const startTime = performance.now();

  const capex = computeCapex(a);

  // Compute debt for each path
  const commercialDebt = computeDebtService(a, capex, 'commercial');
  const grantDebt = computeDebtService(a, capex, 'grant');
  const rrfDebt = computeDebtService(a, capex, 'rrf');
  const tepixLoanDebt = computeDebtService(a, capex, 'tepix-loan');
  const tepixGuaranteeDebt = computeDebtService(a, capex, 'tepix-guarantee');

  // Active debt based on selected path
  const activeDebt =
    a.financingPath === 'grant'
      ? grantDebt
      : a.financingPath === 'rrf'
        ? rrfDebt
        : a.financingPath === 'tepix-loan'
          ? tepixLoanDebt
          : a.financingPath === 'tepix-guarantee'
            ? tepixGuaranteeDebt
            : commercialDebt;

  // Compute all scenarios with active financing
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

  // Break-even scenario: scale both occupancy and ADR so DSCR = 1.0 in stabilised year
  // We need: EBITDA = DS → Revenue - OPEX = DS → Revenue = DS + OPEX
  // First compute realistic stabilised to get the factor
  const realisticStab = realistic.stabilisedYear;
  let breakevenFactor = 1;
  if (realisticStab && realisticStab.ebitda > 0) {
    // occupancy-linked revenue at stabilised year = totalRevenue - ancillary
    const ancillary2031 = a.revenueRealistic.ancillaryBaseProfit *
      Math.pow(1 + a.revenueRealistic.ancillaryGrowthRate, 3);
    const occLinkedRev = realisticStab.totalRevenue - ancillary2031;
    const targetOccLinkedRev = activeDebt.annualDS + realisticStab.totalOpex - ancillary2031;
    // factor² × occLinkedRev + ancillary = DS + OPEX → factor = sqrt(targetOccLinked / occLinked)
    if (occLinkedRev > 0 && targetOccLinkedRev > 0) {
      breakevenFactor = Math.sqrt(targetOccLinkedRev / occLinkedRev);
    }
  }
  const beOccFactor = 1 - breakevenFactor; // how much occupancy drops
  const beAdrFactor = 1 - breakevenFactor; // how much ADR drops
  const breakeven = computeScenario(
    'Break-Even',
    a,
    a.revenueRealistic,
    activeDebt,
    {
      occupancyFactor: beOccFactor,
      adrFactor: beAdrFactor,
      events: Math.round(a.revenueRealistic.eventsPerYear * breakevenFactor),
    }
  );

  // Grant scenario always uses grant debt + realistic revenue
  const grantScenario = computeScenario(
    'Grant Path',
    a,
    a.revenueRealistic,
    grantDebt
  );

  // DSCR by year (all financing paths × realistic revenue)
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

  // TEPIX realistic scenarios for DSCR tracking
  const tepixLoanRealistic = computeScenario(
    'tepixLoan',
    a,
    a.revenueRealistic,
    tepixLoanDebt
  );
  const tepixGuaranteeRealistic = computeScenario(
    'tepixGuarantee',
    a,
    a.revenueRealistic,
    tepixGuaranteeDebt
  );

  const dscrByYear = realistic.pnl.map((p, i) => ({
    year: p.year,
    realistic: commercialRealistic.pnl[i].dscr,
    upside: commercialUpside.pnl[i].dscr,
    downside: commercialDownside.pnl[i].dscr,
    grant: grantScenario.pnl[i].dscr,
    tepixLoan: tepixLoanRealistic.pnl[i].dscr,
    tepixGuarantee: tepixGuaranteeRealistic.pnl[i].dscr,
  }));

  // Financing comparison table
  const financingComparison: FinancingComparison[] = [
    {
      metric: 'Total loan drawn (€)',
      commercial: commercialDebt.loanAmount,
      rrf: rrfDebt.loanAmount,
      grant: grantDebt.loanAmount,
      tepixLoan: tepixLoanDebt.loanAmount,
      tepixGuarantee: tepixGuaranteeDebt.loanAmount,
    },
    {
      metric: 'Grant received (€)',
      commercial: 0,
      rrf: 0,
      grant: grantDebt.grantAmount,
      tepixLoan: 0,
      tepixGuarantee: 0,
    },
    {
      metric: 'Equity required (€)',
      commercial: commercialDebt.equityRequired,
      rrf: rrfDebt.equityRequired,
      grant: grantDebt.equityRequired,
      tepixLoan: tepixLoanDebt.equityRequired,
      tepixGuarantee: tepixGuaranteeDebt.equityRequired,
    },
    {
      metric: 'Annual debt service (€)',
      commercial: commercialDebt.annualDS,
      rrf: rrfDebt.annualDS,
      grant: grantDebt.annualDS,
      tepixLoan: tepixLoanDebt.annualDS,
      tepixGuarantee: tepixGuaranteeDebt.annualDS,
    },
    {
      metric: 'DSCR — Realistic (2031)',
      commercial:
        commercialRealistic.stabilisedYear?.dscr ?? 0,
      rrf: rrfRealistic.stabilisedYear?.dscr ?? 0,
      grant: grantScenario.stabilisedYear?.dscr ?? 0,
      tepixLoan: tepixLoanRealistic.stabilisedYear?.dscr ?? 0,
      tepixGuarantee: tepixGuaranteeRealistic.stabilisedYear?.dscr ?? 0,
    },
    {
      metric: 'Equity saving vs. commercial',
      commercial: '—',
      rrf:
        commercialDebt.equityRequired - rrfDebt.equityRequired,
      grant:
        commercialDebt.equityRequired - grantDebt.equityRequired,
      tepixLoan:
        commercialDebt.equityRequired - tepixLoanDebt.equityRequired,
      tepixGuarantee:
        commercialDebt.equityRequired - tepixGuaranteeDebt.equityRequired,
    },
  ];

  // Collateral
  const builtSurface = 950; // m²
  const loan = activeDebt.loanAmount;
  const collateral = {
    builtSurface,
    stress: {
      valuationPerM2: 7650,
      value: builtSurface * 7650,
      ltv: loan / (builtSurface * 7650),
      coverage: (builtSurface * 7650) / loan,
    },
    market: {
      valuationPerM2: 9000,
      value: builtSurface * 9000,
      ltv: loan / (builtSurface * 9000),
      coverage: (builtSurface * 9000) / loan,
    },
    optimistic: {
      valuationPerM2: 11000,
      value: builtSurface * 11000,
      ltv: loan / (builtSurface * 11000),
      coverage: (builtSurface * 11000) / loan,
    },
  };

  // Key Metrics (from active path + realistic scenario)
  const stab = realistic.stabilisedYear;
  const breakEvenDS = activeDebt.annualDS;
  // Break-even: how many villa nights to cover DS with zero other revenue
  // Simplified: DS / (ADR * numProperties) gives approximate nights
  const breakEvenNights = Math.round(
    breakEvenDS /
      (a.revenueRealistic.villaADR * a.numberOfPropertyA +
        (2 * a.revenueRealistic.suiteStandardADR +
          2 * a.revenueRealistic.suiteDoubleADR))
  );
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
  };

  const computeTimeMs = performance.now() - startTime;

  return {
    capex,
    scenarios: { realistic, upside, downside, breakeven },
    grantScenario,
    financingComparison,
    keyMetrics,
    dscrByYear,
    collateral,
    activeFinancingPath: a.financingPath,
    computeTimeMs,
  };
}
