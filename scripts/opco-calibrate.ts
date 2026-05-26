/**
 * Tiered OpCo junior formula — 10% on residual up to threshold, 15% above.
 *
 *   opCoJunior = 10% × min(residual, threshold)
 *              + 15% × max(0, residual − threshold)
 *   opCoTotal  = €96K floor  +  opCoJunior
 *   YOU KEEP   = residual − opCoJunior
 */

import { computeModel } from '../src/lib/engine/model';

const LIVE_ASSUMPTIONS = {"dsra":{"enabled":false,"partnerRepaymentThreshold":2,"replenishmentPriority":1,"sweep2028Pct":1,"targetDSCR":1.25},"exitYear":2032,"viewMode":"internal","opCoSeniorFloor":24000,"opCoFee":{"incentiveFeeRate":0.1,"opcoAnnualFeeCap":180000,"shareholderMinResidualShare":0.5,"baseMgmtFeeRate":0.05,"brandFeeRate":0.02,"ownerPriorityReturnRate":0.08,"baseFeeRate":0.03,"enabled":true},"acquisitionLegalPerPlot":50000,"developerConstructionFeePerYear":75000,"revenueUpside":{"villaBaseNights":100,"netProfitPerEvent":6000,"ancillaryGrowthRate":0.1,"villaADR":3800,"suiteBaseNights":100,"ancillaryGrowthYears":5,"ancillaryBaseProfit":75000,"eventsPerYear":12,"suiteDoubleADR":1100,"suiteStandardADR":800},"grant":{"enabled":false,"grantRate":0.6,"interest2026":50625,"interest2027":110544,"interest2028":114109},"exitEbitdaMultiple":10,"financingPath":"commercial","dscrCovenantThreshold":1.25,"revenueRealistic":{"ancillaryGrowthYears":5,"eventsPerYear":6,"ancillaryBaseProfit":75000,"suiteDoubleADR":950,"suiteStandardADR":700,"villaBaseNights":90,"netProfitPerEvent":6000,"villaADR":3500,"ancillaryGrowthRate":0.1,"suiteBaseNights":90},"tepixLoan":{"bankInterestRate":0.05,"bankShareOfLoan":0.6,"totalTermYears":14,"landCapOnFundContribution":0.1,"interestSubsidy":0.02,"enabled":false,"subsidyDurationYears":2,"coverageRate":0.9,"hdbShareOfLoan":0.4,"gracePeriodYears":2},"tax":{"netVATRate":0.07,"corporateIncomeTaxRate":0.22},"workingCapital":{"facilitySize":400000,"spreadOverTermRate":0.01,"active":true,"selfLiquidating":true,"seasonalDrawPerCycle":150000,"preOpeningTotalDraw":200000,"dsraLockAmount":124000,"dsraConversionEnabled":false,"internalCashBuffer":100000,"y2RampBufferTopup":100000},"rrf":{"equityRequired":1234800,"annualDS":439700,"totalLoanDrawn":4939200,"rrfInterestRate":0.0035,"commercialInterestRate":0.05,"enabled":false,"rrfShareOfLoan":0.8,"repaymentTermYears":13,"gracePeriodYears":2,"commercialShareRate":0.2,"coverageRate":0.8},"portfolio":[{"legalFees":15000,"civilEngineerFees":35000,"extraOpexLines":[],"count":1,"bedroomsPerSubUnit":1,"extraCapexLines":[],"bedroomsPerDouble":2,"standardSuites":7,"landCost":800000,"bedroomsPerStandard":1,"doubleSuites":4,"opexContingencyRate":0.1,"opex":{"marketing":10000,"managementFee":30000,"utilities":25000,"insurance":4000,"consumables":10000,"propertyTax":6000,"housekeeping":20000,"maintenance":25000,"accounting":10000,"ffeReserveFloor":0},"constructionArea":650,"constructionCostPerM2":4000,"contingencyRate":0.1,"bedroomsInMain":4,"ffeCost":227500,"name":"11 Room Suites","id":"proj-1778167111356-31","villaUnits":0,"architectFees":50000,"roomAreas":{"utilityRoom":10,"kitchen":25,"livingRoom":90,"staffRoom":60,"standardSuiteArea":35,"villaUnitArea":0,"doubleSuiteArea":50,"outdoor":0,"corridors":20},"lockableSubUnits":3},{"constructionArea":351,"constructionCostPerM2":4000,"contingencyRate":0.1,"bedroomsInMain":4,"ffeCost":122850,"name":"Luxury Villa","id":"proj-1778216427189-23","villaUnits":1,"architectFees":40000,"roomAreas":{"utilityRoom":15,"villaRooms":[{"id":"vr-legacy-tpl-luxury-villa","name":"Villa interior","area":33,"count":7}],"kitchen":25,"staffRoom":15,"livingRoom":55,"standardSuiteArea":0,"villaUnitArea":120,"doubleSuiteArea":0,"corridors":10,"outdoor":160},"lockableSubUnits":3,"legalFees":25000,"count":2,"extraOpexLines":[],"civilEngineerFees":30000,"bedroomsPerSubUnit":1,"bedroomsPerDouble":2,"extraCapexLines":[],"standardSuites":0,"landCost":385000,"opexContingencyRate":0.1,"opex":{"accounting":10000,"maintenance":37500,"ffeReserveFloor":20000,"insurance":4000,"consumables":8000,"housekeeping":22000,"propertyTax":6000,"marketing":6000,"utilities":18000,"managementFee":30000},"doubleSuites":0,"bedroomsPerStandard":1},{"standardSuites":2,"opex":{"accounting":7000,"maintenance":15000,"ffeReserveFloor":30000,"marketing":4000,"managementFee":20000,"utilities":12000,"consumables":5000,"insurance":2500,"propertyTax":4000,"housekeeping":13000},"bedroomsPerStandard":1,"doubleSuites":2,"opexContingencyRate":0.1,"landCost":380000,"civilEngineerFees":25000,"count":1,"extraOpexLines":[],"legalFees":15000,"extraCapexLines":[],"bedroomsPerDouble":2,"bedroomsPerSubUnit":1,"roomAreas":{"kitchen":15,"doubleSuiteArea":35,"utilityRoom":10,"villaUnitArea":0,"staffRoom":8,"corridors":20,"livingRoom":30,"standardSuiteArea":25},"architectFees":32000,"lockableSubUnits":3,"constructionCostPerM2":4000,"constructionArea":203,"bedroomsInMain":4,"contingencyRate":0.1,"villaUnits":0,"name":"Boutique Suites","ffeCost":71050,"id":"proj-1779361434584-17"}],"commercialLoan":{"workingCapitalFacility":400000,"interest2026":50625,"gracePeriodYears":2,"interest2027":110544,"interestRate":0.044,"loanCoverageRate":0.8,"repaymentTermYears":13,"interest2028":216402},"ffeSchedule":{"rateStabilised":0.04,"rate2029":0.02,"rate2030":0.03},"general":{"nightsCap":110,"year2RampFactor":0.85,"year1RampFactor":0.6,"nightsGrowthPerYear":3}} as any;

const totalVillaCount    = LIVE_ASSUMPTIONS.portfolio.reduce((s: number, p: any) => s + (p.count ?? 1), 0);
const totalSeniorFloor   = (LIVE_ASSUMPTIONS.opCoSeniorFloor ?? 0) * totalVillaCount; // €96K

const bank = computeModel({ ...LIVE_ASSUMPTIONS, viewMode: 'bank' });
const rows = bank.scenarios.realistic.pnl;

function tieredJunior(residual: number, threshold: number): number {
  return 0.10 * Math.min(residual, threshold)
       + 0.15 * Math.max(0, residual - threshold);
}

const fmt  = (n: number) => `€${Math.round(n / 1000)}K`.padStart(8);
const fmtR = (n: number) => Math.round(n / 1000);

// ─── Main table: show at threshold = €500K ───────────────────────────────────
const THRESHOLD = 500_000;

console.log('\n═══════════════════════════════════════════════════════════════════════════════════════');
console.log(' Realistic Scenario — tiered OpCo: 10% up to €500K residual, 15% above');
console.log('═══════════════════════════════════════════════════════════════════════════════════════');
console.log(`  Floor:  €96K/yr (senior, paid before DS)   Tier-1: 10%  |  Tier-2: 15% above €500K`);
console.log('');
console.log(
  'Year  '.padEnd(6) +
  'Revenue'.padStart(9) +
  'EBITDA'.padStart(8) +
  'DS'.padStart(9) +
  'Residual'.padStart(10) +
  'OpCo Jr'.padStart(9) +
  'OpCo Tot'.padStart(10) +
  'YOU KEEP'.padStart(10) +
  'Eff.Rate'.padStart(10) +
  'DSCR'.padStart(7)
);
console.log('─'.repeat(102));

let cumEquity500 = 0, cumOpCo500 = 0;

rows.forEach(row => {
  const residual   = Math.max(0, row.ebitdaPreOpCo - row.debtService);
  const opCoJunior = tieredJunior(residual, THRESHOLD);
  const opCoSenior = row.year <= 2027 ? 0 : totalSeniorFloor;
  const opCoTotal  = opCoSenior + opCoJunior;
  const equityNCF  = residual - opCoJunior;
  const effRate    = residual > 0 ? opCoJunior / residual : 0;
  const dscr       = row.debtService > 0 ? row.ebitdaPreOpCo / row.debtService : 0;

  if (row.year >= 2028) { cumEquity500 += equityNCF; cumOpCo500 += opCoTotal; }

  const tier = residual > THRESHOLD ? ' ▲' : '  ';
  console.log(
    String(row.year).padEnd(6) +
    fmt(row.totalRevenue) +
    fmt(row.ebitdaPreOpCo) +
    fmt(row.debtService) +
    fmt(residual) +
    fmt(opCoJunior) +
    fmt(opCoTotal) +
    fmt(equityNCF) +
    `${(effRate * 100).toFixed(1)}%`.padStart(10) +
    dscr.toFixed(2).padStart(7) +
    tier
  );
});

console.log('─'.repeat(102));
console.log('  ▲ = upper tier active (residual > €500K)');

// ─── Sensitivity: three threshold options ────────────────────────────────────
console.log('');
console.log('═══════════════════════════════════════════════════════════════════════════════════════');
console.log(' THRESHOLD SENSITIVITY — stabilised year (2031) & projection totals');
console.log('═══════════════════════════════════════════════════════════════════════════════════════');
console.log('');
console.log(
  'Threshold'.padEnd(14) +
  '2031 OpCo Jr'.padStart(14) +
  '2031 You Keep'.padStart(15) +
  '2031 Eff Rate'.padStart(15) +
  'Total Equity'.padStart(14) +
  'Total OpCo'.padStart(12)
);
console.log('─'.repeat(84));

for (const thresh of [400_000, 500_000, 600_000, 700_000]) {
  let cumEq = 0, cumOp = 0;
  let stab2031Junior = 0, stab2031Equity = 0, stab2031Residual = 0;

  rows.forEach(row => {
    const residual   = Math.max(0, row.ebitdaPreOpCo - row.debtService);
    const junior     = tieredJunior(residual, thresh);
    const opCoSenior = row.year <= 2027 ? 0 : totalSeniorFloor;
    const opCoTotal  = opCoSenior + junior;
    const equityNCF  = residual - junior;
    if (row.year >= 2028) { cumEq += equityNCF; cumOp += opCoTotal; }
    if (row.year === 2031) { stab2031Junior = junior; stab2031Equity = equityNCF; stab2031Residual = residual; }
  });

  const effRate = stab2031Residual > 0 ? stab2031Junior / stab2031Residual : 0;
  console.log(
    `€${(thresh / 1000).toFixed(0)}K`.padEnd(14) +
    `€${fmtR(stab2031Junior)}K`.padStart(14) +
    `€${fmtR(stab2031Equity)}K`.padStart(15) +
    `${(effRate * 100).toFixed(1)}%`.padStart(15) +
    `€${fmtR(cumEq)}K`.padStart(14) +
    `€${fmtR(cumOp)}K`.padStart(12)
  );
}

console.log('─'.repeat(84));
console.log('');
console.log(' WHAT EACH THRESHOLD MEANS:');
console.log('   €400K  — upper tier kicks in from 2030 onward (residual ≥ €619K). Aggressive.');
console.log('   €500K  — upper tier from 2030. OpCo earns 15% on the growth portion. Balanced.');
console.log('   €600K  — upper tier from 2031. OpCo only hits 15% at stabilised ops. Conservative.');
console.log('   €700K  — upper tier barely reached; effectively close to flat 10%. Very conservative.');
console.log('═══════════════════════════════════════════════════════════════════════════════════════');
