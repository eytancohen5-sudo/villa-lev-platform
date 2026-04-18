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
  ScenarioOutput,
  RevenueAssumptions,
  FinancingComparison,
  FinancingPath,
  PropertyConfig,
  getPropertyDisplayType,
} from './types';
import { DOWNSIDE_FACTORS } from './defaults';

// ────────────────────────────────────────────
// CAPEX
// ────────────────────────────────────────────

function computeCapexPerUnit(prop: PropertyConfig): number {
  const construction = prop.constructionArea * prop.constructionCostPerM2;
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
  const portfolioTotal =
    properties.reduce((sum, p) => sum + p.total, 0) + acqLegal;

  const categoryDefs = [
    {
      name: 'Land acquisition',
      getPerUnit: (p: PropertyConfig) => p.landCost,
    },
    {
      name: 'Construction',
      getPerUnit: (p: PropertyConfig) =>
        p.constructionArea * p.constructionCostPerM2,
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
        (p.constructionArea * p.constructionCostPerM2 + p.ffeCost) *
        p.contingencyRate,
    },
    {
      name: `Acquisition legal & due diligence (x${totalPlots} plots)`,
      getPerUnit: () => a.acquisitionLegalPerPlot,
    },
  ];

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
  primaryLoan?: number;
  supplementaryLoan?: number;
  supplementaryAnnualDS?: number;
  landFundedByTepix?: number;
  landFundedByCommercial?: number;
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
    const totalLand = computeTotalLand(a);
    const acqLegal = a.acquisitionLegalPerPlot * totalPlots;
    const nonPlotEligible = totalCost - totalLand - acqLegal;
    const grantAmt = nonPlotEligible * a.grant.grantRate;

    const phase1 = 1350000;
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
      getDS: (year: number) => {
        if (year === 2026) return a.grant.interest2026 ?? 50625;
        if (year === 2027) return a.grant.interest2027 ?? 110544;
        if (year === 2028) return a.grant.interest2028 ?? 114109;
        if (year >= 2029) return annualDS;
        return 0;
      },
    };
  }

  if (path === 'rrf') {
    const totalLoan = a.rrf.totalLoanDrawn;
    const equity = a.rrf.equityRequired;
    const annualDS = a.rrf.annualDS;

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

  if (path === 'tepix-loan') {
    const tp = a.tepixLoan;
    const cap = tp.landCapOnFundContribution;

    const totalLand = computeTotalLand(a);
    const acqLegal = a.acquisitionLegalPerPlot * totalPlots;
    const nonLandCost = totalCost - totalLand - acqLegal;

    const nonLandLoan = nonLandCost * tp.coverageRate;
    const landFundedByTepix = (cap * nonLandLoan) / (1 - cap);
    const primaryLoan = nonLandLoan + landFundedByTepix;

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

    return {
      annualDS: combinedDS,
      loanAmount: totalLoanDrawn,
      equityRequired: totalEquity,
      grantAmount: 0,
      primaryLoan,
      supplementaryLoan: suppLoanAmount,
      supplementaryAnnualDS: suppAnnualDS,
      landFundedByTepix,
      landFundedByCommercial: landGap,
      getDS: (year: number) => {
        if (year === 2026 || year === 2027) {
          const subsidisedRate = Math.max(0, tp.bankInterestRate - tp.interestSubsidy);
          const tepixInterest = bankPortion * subsidisedRate;
          const suppInterest = suppLoanAmount * a.commercialLoan.interestRate;
          return tepixInterest + suppInterest;
        }
        if (year >= 2028) return combinedDS;
        return 0;
      },
    };
  }

  if (path === 'tepix-guarantee') {
    const tg = a.tepixGuarantee;
    const cap = tg.landCapOnFundContribution;

    const totalLand = computeTotalLand(a);
    const acqLegal = a.acquisitionLegalPerPlot * totalPlots;
    const nonLandCost = totalCost - totalLand - acqLegal;

    const nonLandLoan = nonLandCost * tg.coverageRate;
    const landFundedByTepix = (cap * nonLandLoan) / (1 - cap);
    const primaryLoan = nonLandLoan + landFundedByTepix;

    const landGap = Math.max(0, totalLand + acqLegal - landFundedByTepix);
    const suppLoanAmount = landGap * a.commercialLoan.loanCoverageRate;
    const suppEquity = landGap - suppLoanAmount;
    const suppAnnualDS = pmt(
      a.commercialLoan.interestRate,
      a.commercialLoan.repaymentTermYears,
      suppLoanAmount
    );

    const amortYears = tg.totalTermYears - tg.gracePeriodYears;
    const annualDSTepix = pmt(tg.bankInterestRate, amortYears, primaryLoan);

    const primaryEquity = nonLandCost - nonLandLoan;
    const totalEquity = primaryEquity + suppEquity;
    const totalLoanDrawn = primaryLoan + suppLoanAmount;
    const combinedDS = annualDSTepix + suppAnnualDS;

    return {
      annualDS: combinedDS,
      loanAmount: totalLoanDrawn,
      equityRequired: totalEquity,
      grantAmount: 0,
      primaryLoan,
      supplementaryLoan: suppLoanAmount,
      supplementaryAnnualDS: suppAnnualDS,
      landFundedByTepix,
      landFundedByCommercial: landGap,
      getDS: (year: number) => {
        if (year === 2026 || year === 2027) {
          const subsidisedRate = Math.max(0, tg.bankInterestRate - tg.interestSubsidy);
          const tepixInterest = primaryLoan * subsidisedRate;
          const suppInterest = suppLoanAmount * a.commercialLoan.interestRate;
          return tepixInterest + suppInterest;
        }
        if (year >= 2028) return combinedDS;
        return 0;
      },
    };
  }

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

function computeOpexForProperty(
  year: number,
  prop: PropertyConfig
): number {
  if (year <= 2027) return 0;

  const constructionCost = prop.constructionArea * prop.constructionCostPerM2;

  let maintenanceRate: number;
  if (year <= 2029) maintenanceRate = 0.005;
  else if (year === 2030) maintenanceRate = 0.01;
  else maintenanceRate = 0.015;

  const maintenance = constructionCost * maintenanceRate;

  const baseOpexNoMaintenance =
    prop.opex.housekeeping +
    prop.opex.utilities +
    prop.opex.insurance +
    prop.opex.propertyTax +
    prop.opex.marketing +
    prop.opex.managementFee +
    prop.opex.consumables +
    prop.opex.accounting;

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
      if (year > 2027) {
        // Villa revenue: villaUnits x nights x ADR
        const villaRev = prop.villaUnits * effVillaNights * effVillaADR;
        // Suite revenue: each room type x nights x ADR
        const suiteRev =
          prop.standardSuites * effSuiteNights * effStdADR +
          prop.doubleSuites * effSuiteNights * effDblADR;
        revenuePerUnit = (villaRev + suiteRev) * ramp;
      }

      const opexPerUnit = computeOpexForProperty(year, prop);

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
        totalOpex: year <= 2027 ? 0 : opexPerUnit * prop.count,
      };
    });

    const revenueEvents =
      year <= 2027 ? 0 : effEvents * rev.netProfitPerEvent * ramp;
    const revenueAncillary =
      year < 2028
        ? 0
        : rev.ancillaryBaseProfit *
          Math.pow(1 + rev.ancillaryGrowthRate, year - 2028);

    const totalRevenue =
      propertyBreakdown.reduce((sum, p) => sum + p.totalRevenue, 0) +
      revenueEvents +
      revenueAncillary;

    const totalOpex = propertyBreakdown.reduce(
      (sum, p) => sum + p.totalOpex,
      0
    );

    const ebitda = totalRevenue - totalOpex;
    const ebitdaMargin = totalRevenue > 0 ? ebitda / totalRevenue : 0;

    const ds = debtResult.getDS(year);
    const ncf = ebitda - ds;
    cumulativeNCF += ncf;

    const vat = year <= 2027 ? 0 : -(totalRevenue * a.tax.netVATRate);
    const ncfPostVAT = ncf + vat;
    const dscr = ds > 0 ? ebitda / ds : 0;

    return {
      year,
      phase: getPhaseLabel(year),
      villaNights: Math.round(downside ? effVillaNights : villaNights),
      suiteNights: Math.round(downside ? effSuiteNights : suiteNights),
      propertyBreakdown,
      revenueEvents,
      revenueAncillary,
      totalRevenue,
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

  const commercialDebt = computeDebtService(a, capex, 'commercial');
  const grantDebt = computeDebtService(a, capex, 'grant');
  const rrfDebt = computeDebtService(a, capex, 'rrf');
  const tepixLoanDebt = computeDebtService(a, capex, 'tepix-loan');
  const tepixGuaranteeDebt = computeDebtService(a, capex, 'tepix-guarantee');

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
    const ancillary2031 =
      a.revenueRealistic.ancillaryBaseProfit *
      Math.pow(1 + a.revenueRealistic.ancillaryGrowthRate, 3);
    const occLinkedRev = realisticStab.totalRevenue - ancillary2031;
    const targetOccLinkedRev =
      activeDebt.annualDS + realisticStab.totalOpex - ancillary2031;
    if (occLinkedRev > 0 && targetOccLinkedRev > 0) {
      breakevenFactor = Math.sqrt(targetOccLinkedRev / occLinkedRev);
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

  // Financing comparison
  const financingComparison: FinancingComparison[] = [
    {
      metric: 'Total loan drawn',
      commercial: commercialDebt.loanAmount,
      rrf: rrfDebt.loanAmount,
      grant: grantDebt.loanAmount,
      tepixLoan: tepixLoanDebt.loanAmount,
      tepixGuarantee: tepixGuaranteeDebt.loanAmount,
    },
    {
      metric: 'Grant received',
      commercial: 0,
      rrf: 0,
      grant: grantDebt.grantAmount,
      tepixLoan: 0,
      tepixGuarantee: 0,
    },
    {
      metric: 'Equity required',
      commercial: commercialDebt.equityRequired,
      rrf: rrfDebt.equityRequired,
      grant: grantDebt.equityRequired,
      tepixLoan: tepixLoanDebt.equityRequired,
      tepixGuarantee: tepixGuaranteeDebt.equityRequired,
    },
    {
      metric: 'Annual debt service',
      commercial: commercialDebt.annualDS,
      rrf: rrfDebt.annualDS,
      grant: grantDebt.annualDS,
      tepixLoan: tepixLoanDebt.annualDS,
      tepixGuarantee: tepixGuaranteeDebt.annualDS,
    },
    {
      metric: 'DSCR — Realistic (2031)',
      commercial: commercialRealistic.stabilisedYear?.dscr ?? 0,
      rrf: rrfRealistic.stabilisedYear?.dscr ?? 0,
      grant: grantScenario.stabilisedYear?.dscr ?? 0,
      tepixLoan: tepixLoanRealistic.stabilisedYear?.dscr ?? 0,
      tepixGuarantee: tepixGuaranteeRealistic.stabilisedYear?.dscr ?? 0,
    },
    {
      metric: 'Supplementary commercial loan',
      commercial: '—',
      rrf: '—',
      grant: '—',
      tepixLoan: tepixLoanDebt.supplementaryLoan ?? 0,
      tepixGuarantee: tepixGuaranteeDebt.supplementaryLoan ?? 0,
    },
    {
      metric: 'Equity saving vs. commercial',
      commercial: '—',
      rrf: commercialDebt.equityRequired - rrfDebt.equityRequired,
      grant: commercialDebt.equityRequired - grantDebt.equityRequired,
      tepixLoan:
        commercialDebt.equityRequired - tepixLoanDebt.equityRequired,
      tepixGuarantee:
        commercialDebt.equityRequired -
        tepixGuaranteeDebt.equityRequired,
    },
  ];

  // Collateral
  const builtSurface = a.portfolio.reduce(
    (sum, p) => sum + p.constructionArea * p.count,
    0
  );
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
