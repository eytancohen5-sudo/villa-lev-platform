// Business-plan Excel export.
//
// Generates a fully-linked .xlsx with 6 sheets. Every cell that the engine
// computes is mirrored as a formula referencing the Assumptions sheet — change
// an input there and downstream sheets recompute. Where a formula would diverge
// from the engine (e.g. quarterly working capital), we either inline the
// engine's value with a comment or leave a clearly-marked TODO row.
//
// The math intentionally mirrors src/lib/engine/model.ts. If you change an
// engine formula, update the corresponding row here.

import ExcelJS from 'exceljs';
import type {
  ModelAssumptions,
  ModelOutput,
  PropertyConfig,
} from '@/lib/engine/types';
import {
  computeCapTable,
  CapTableStakeholder,
  WaterfallParams,
  DEFAULT_CAP_TABLE,
  DEFAULT_WATERFALL,
} from '@/lib/engine/capTable';
import {
  resolveFounderWaterfall,
  EARNED_EQUITY_CAP,   // @deprecated — kept for Excel reference cell only
  RATCHET_STANDALONE_CAP,
  TOTAL_FOUNDER_CAP,
  MIN_INVESTOR_SHARE,
  BUCKET_1A_COLLATERAL_CAP,
} from '@/lib/engine/founderWaterfall';

// Column letter from 1-indexed column number.
const col = (n: number): string => {
  let s = '';
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - r) / 26);
  }
  return s;
};

// Build "Sheet!$A$1" style absolute reference.
const aref = (sheet: string, r: number, c: number) => `${sheet}!$${col(c)}$${r}`;

// Build "Sheet!A1:B2" range.
const range = (sheet: string, r1: number, c1: number, r2: number, c2: number) =>
  `${sheet}!${col(c1)}${r1}:${col(c2)}${r2}`;

// ── Styling helpers ──────────────────────────────────────────────────────

const STYLE = {
  inputFill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE3F2FD' } }, // blue: editable
  formulaFill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF5F5F5' } }, // grey: derived
  totalFill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE8EAF6' } },
  headerFill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF8B6914' } },
  sectionFill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFAF6E8' } },
};

const FONT = {
  header: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
  section: { bold: true, color: { argb: 'FF8B6914' }, size: 11 },
  bold: { bold: true },
  italic: { italic: true, color: { argb: 'FF777777' }, size: 9 },
};

const FMT = {
  euro: '€#,##0;[Red]-€#,##0',
  euro2: '€#,##0.00',
  pct: '0.0%',
  mul: '0.00"×"',
  num: '#,##0',
  num2: '#,##0.00',
};

// ── Main exporter ────────────────────────────────────────────────────────

// ── Excel translation tables ──────────────────────────────────────────────

type XlStrings = {
  // Sheet names
  sh_cover: string;
  sh_assumptions: string;
  sh_pnl: string;
  sh_capex: string;
  sh_revenue: string;
  sh_opexPnl: string;
  sh_debtService: string;
  sh_coverage: string;
  sh_scenarios: string;
  sh_capTable: string;
  sh_waterfall: string;
  sh_workingCapital: string;
  sh_financingComparison: string;
  sh_amortisation: string;
  sh_bankCoverage: string;
  // Common row/column labels
  lbl_year: string;
  lbl_metric: string;
  lbl_scenario: string;
  lbl_total: string;
  lbl_generated: string;
  lbl_totalRevenue: string;
  lbl_totalOpex: string;
  lbl_ebitda: string;
  lbl_ebitdaMargin: string;
  lbl_debtService: string;
  lbl_netCashFlow: string;
  lbl_loanBalance: string;
  lbl_dscr: string;
  lbl_revenue: string;
  lbl_events: string;
  lbl_ancillary: string;
  lbl_interest: string;
  lbl_principal: string;
  lbl_phase: string;
  lbl_realistic: string;
  lbl_upside: string;
  lbl_downside: string;
  lbl_value: string;
  lbl_rate: string;
  lbl_term: string;
  lbl_coverage: string;
  lbl_loanAmount: string;
  lbl_equity: string;
  lbl_ltv: string;
  lbl_irr: string;
  lbl_moic: string;
  lbl_payback: string;
  lbl_villaADR: string;
  lbl_suiteADR: string;
  lbl_nights: string;
  lbl_occupancy: string;
};

const XL_EN: XlStrings = {
  sh_cover: 'Cover',
  sh_assumptions: 'Assumptions',
  sh_pnl: 'P&L',
  sh_capex: 'CAPEX',
  sh_revenue: 'Revenue',
  sh_opexPnl: 'OPEX & P&L',
  sh_debtService: 'Debt Service',
  sh_coverage: 'Coverage',
  sh_scenarios: 'Scenarios',
  sh_capTable: 'Cap Table',
  sh_waterfall: 'Waterfall',
  sh_workingCapital: 'Working Capital',
  sh_financingComparison: 'Financing Comparison',
  sh_amortisation: 'Amortisation Schedule',
  sh_bankCoverage: 'Bank Coverage',
  lbl_year: 'Year',
  lbl_metric: 'Metric',
  lbl_scenario: 'Scenario',
  lbl_total: 'Total',
  lbl_generated: 'Generated',
  lbl_totalRevenue: 'Total Revenue',
  lbl_totalOpex: 'Total OPEX',
  lbl_ebitda: 'EBITDA',
  lbl_ebitdaMargin: 'EBITDA Margin',
  lbl_debtService: 'Debt Service',
  lbl_netCashFlow: 'Net Cash Flow',
  lbl_loanBalance: 'Loan Balance',
  lbl_dscr: 'DSCR',
  lbl_revenue: 'Revenue',
  lbl_events: 'Events',
  lbl_ancillary: 'Ancillary',
  lbl_interest: 'Interest',
  lbl_principal: 'Principal',
  lbl_phase: 'Phase',
  lbl_realistic: 'Conservative',
  lbl_upside: 'Realistic',
  lbl_downside: 'Downside',
  lbl_value: 'Value',
  lbl_rate: 'Rate',
  lbl_term: 'Term',
  lbl_coverage: 'Coverage',
  lbl_loanAmount: 'Loan Amount',
  lbl_equity: 'Equity',
  lbl_ltv: 'LTV',
  lbl_irr: 'IRR',
  lbl_moic: 'MOIC',
  lbl_payback: 'Payback',
  lbl_villaADR: 'Villa ADR',
  lbl_suiteADR: 'Suite ADR',
  lbl_nights: 'Nights',
  lbl_occupancy: 'Occupancy',
};

const XL_EL: XlStrings = {
  sh_cover: 'Εξώφυλλο',
  sh_assumptions: 'Παραδοχές',
  sh_pnl: 'Αποτελέσματα',
  sh_capex: 'CAPEX',
  sh_revenue: 'Έσοδα',
  sh_opexPnl: 'Λειτ. Έξοδα & Αποτελέσματα',
  sh_debtService: 'Εξυπηρέτηση Χρέους',
  sh_coverage: 'Κάλυψη',
  sh_scenarios: 'Σενάρια',
  sh_capTable: 'Πίνακας Κεφαλαίου',
  sh_waterfall: 'Καταρράκτης',
  sh_workingCapital: 'Κεφάλαιο Κίνησης',
  sh_financingComparison: 'Σύγκριση Χρηματοδότησης',
  sh_amortisation: 'Πρόγραμμα Απόσβεσης',
  sh_bankCoverage: 'Τραπεζική Κάλυψη',
  lbl_year: 'Έτος',
  lbl_metric: 'Δείκτης',
  lbl_scenario: 'Σενάριο',
  lbl_total: 'Σύνολο',
  lbl_generated: 'Δημιουργήθηκε',
  lbl_totalRevenue: 'Συνολικά Έσοδα',
  lbl_totalOpex: 'Συνολικά Λειτουργικά Έξοδα',
  lbl_ebitda: 'EBITDA',
  lbl_ebitdaMargin: 'Περιθώριο EBITDA',
  lbl_debtService: 'Εξυπηρέτηση Χρέους',
  lbl_netCashFlow: 'Καθαρές Ταμειακές Ροές',
  lbl_loanBalance: 'Υπόλοιπο Δανείου',
  lbl_dscr: 'DSCR',
  lbl_revenue: 'Έσοδα',
  lbl_events: 'Εκδηλώσεις',
  lbl_ancillary: 'Βοηθητικές Υπηρεσίες',
  lbl_interest: 'Τόκοι',
  lbl_principal: 'Κεφάλαιο',
  lbl_phase: 'Φάση',
  lbl_realistic: 'Συντηρητικό',
  lbl_upside: 'Ρεαλιστικό+',
  lbl_downside: 'Καθοδικό',
  lbl_value: 'Αξία',
  lbl_rate: 'Ποσοστό',
  lbl_term: 'Διάρκεια',
  lbl_coverage: 'Κάλυψη',
  lbl_loanAmount: 'Ποσό Δανείου',
  lbl_equity: 'Ίδια Κεφάλαια',
  lbl_ltv: 'LTV',
  lbl_irr: 'IRR',
  lbl_moic: 'MOIC',
  lbl_payback: 'Αποπληρωμή',
  lbl_villaADR: 'ADR Βίλας',
  lbl_suiteADR: 'ADR Σουίτας',
  lbl_nights: 'Διανυκτερεύσεις',
  lbl_occupancy: 'Πληρότητα',
};

const XL_HE: XlStrings = {
  sh_cover: 'כריכה',
  sh_assumptions: 'הנחות',
  sh_pnl: 'רווח והפסד',
  sh_capex: 'CAPEX',
  sh_revenue: 'הכנסות',
  sh_opexPnl: 'הוצ תפעול ורו"ה',
  sh_debtService: 'שירות חוב',
  sh_coverage: 'כיסוי',
  sh_scenarios: 'תרחישים',
  sh_capTable: 'טבלת הון',
  sh_waterfall: 'מפל',
  sh_workingCapital: 'הון חוזר',
  sh_financingComparison: 'השוואת מימון',
  sh_amortisation: 'לוח סילוקין',
  sh_bankCoverage: 'כיסוי בנקאי',
  lbl_year: 'שנה',
  lbl_metric: 'מדד',
  lbl_scenario: 'תרחיש',
  lbl_total: 'סך הכל',
  lbl_generated: 'נוצר',
  lbl_totalRevenue: 'סך הכנסות',
  lbl_totalOpex: 'סך הוצאות תפעול',
  lbl_ebitda: 'EBITDA',
  lbl_ebitdaMargin: 'שולי EBITDA',
  lbl_debtService: 'שירות חוב',
  lbl_netCashFlow: 'תזרים מזומנים נטו',
  lbl_loanBalance: 'יתרת הלוואה',
  lbl_dscr: 'DSCR',
  lbl_revenue: 'הכנסות',
  lbl_events: 'אירועים',
  lbl_ancillary: 'שירותים נלווים',
  lbl_interest: 'ריבית',
  lbl_principal: 'קרן',
  lbl_phase: 'שלב',
  lbl_realistic: 'ריאליסטי',
  lbl_upside: 'אופטימי',
  lbl_downside: 'שלילי',
  lbl_value: 'שווי',
  lbl_rate: 'שיעור',
  lbl_term: 'תקופה',
  lbl_coverage: 'כיסוי',
  lbl_loanAmount: 'סכום הלוואה',
  lbl_equity: 'הון',
  lbl_ltv: 'LTV',
  lbl_irr: 'IRR',
  lbl_moic: 'MOIC',
  lbl_payback: 'החזר',
  lbl_villaADR: 'ADR וילה',
  lbl_suiteADR: 'ADR סוויטה',
  lbl_nights: 'לילות',
  lbl_occupancy: 'תפוסה',
};

export async function exportBusinessPlan(
  a: ModelAssumptions,
  m: ModelOutput,
  scenarioName: 'realistic' | 'upside' | 'downside' = 'realistic',
  // Cap-table inputs. When provided, the Cap Table + Waterfall sheets surface
  // the 3-layer founder economics (pari-passu + grant bonus + performance
  // ratchet) and per-stakeholder distributions. Defaults to the canonical
  // Villa Lev cap table so callers without state still get the standard sheet.
  capTable: CapTableStakeholder[] = DEFAULT_CAP_TABLE,
  waterfall: WaterfallParams = DEFAULT_WATERFALL,
  locale: import('@/lib/i18n/types').Locale = 'en',
): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Villa Lev Group';
  wb.created = new Date();
  // Force Excel to recalculate all formulas on open so the bank sees fresh values
  // even if a viewer didn't compute results during write.
  (wb as unknown as { calcProperties: { fullCalcOnLoad: boolean } }).calcProperties = { fullCalcOnLoad: true };

  // Locale-aware string table for sheet names, column headers, and row labels.
  const XL: XlStrings = locale === 'el' ? XL_EL : locale === 'he' ? XL_HE : XL_EN;

  // Helper: apply RTL view to a worksheet when locale is Hebrew.
  const applyRTL = (ws: ExcelJS.Worksheet) => {
    if (locale === 'he') {
      ws.views = [{ rightToLeft: true }];
    }
  };

  // Years and scenario data — used by every sheet.
  const years = Array.from({ length: 12 }, (_, i) => 2026 + i); // 2026..2037
  const scenario = m.scenarios[scenarioName];
  const pnl = scenario.pnl;
  const path = a.financingPath;

  // Engine value lookups by year — used to attach `result` to formulas so the
  // workbook opens with numbers visible (no recalc lag). When the bank edits an
  // input, Excel recomputes and replaces these values.
  const py = (year: number) => pnl.find((p) => p.year === year);
  const pyVal = (year: number, key: keyof typeof pnl[number], fallback = 0): number => {
    const e = py(year);
    return e ? (e[key] as number) ?? fallback : fallback;
  };

  // ── 1. Cover ────────────────────────────────────────────────────────
  const cover = wb.addWorksheet(XL.sh_cover, { views: [{ showGridLines: false }] });
  applyRTL(cover);
  cover.columns = [{ width: 4 }, { width: 90 }];
  cover.getCell('B2').value = 'Villa Lev Group — Business Plan';
  cover.getCell('B2').font = { name: 'Calibri', size: 22, bold: true, color: { argb: 'FF8B6914' } };
  cover.getCell('B4').value = `${XL.lbl_generated} ${new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}`;
  cover.getCell('B4').font = FONT.italic;
  cover.getCell('B5').value = `Active scenario: ${scenarioName.charAt(0).toUpperCase() + scenarioName.slice(1)} · Active financing path: ${pathLabel(path)}`;
  cover.getCell('B5').font = FONT.italic;

  cover.getCell('B8').value = 'How to use this file';
  cover.getCell('B8').font = { ...FONT.section, size: 14 };

  const helpLines = [
    '',
    '• All blue-shaded cells on the Assumptions sheet are editable inputs.',
    '• All grey cells are formulas derived from the inputs — do not edit; they will update automatically when you change a blue cell.',
    '• The Assumptions sheet is the single source of truth. Every other sheet references it.',
    '• To stress-test, change an input (e.g. ADR or interest rate) and watch the P&L, debt service, and coverage ratios recompute.',
    '',
    'Sheet guide',
    '  Assumptions — every input the model uses, organised by section.',
    '  CAPEX — total project cost per property and per category.',
    '  Revenue — year-by-year revenue lines (villa, suite, events, ancillary) with ramp.',
    '  OPEX & P&L — operating costs, EBITDA, debt service, NCF, taxes.',
    '  Debt Service — amortisation schedule for the active financing path.',
    '  Coverage — DSCR vs covenant + separate Unlevered Project IRR and Levered Equity IRR + MOIC, cash-on-cash, equity payback.',
    '  Scenarios — Downside / Realistic / Upside side-by-side: EBITDA, NCF, DSCR per year + summary IRRs / MOIC.',
    '  Cap Table — per-stakeholder distributions, MOIC, IRR, payback + year-by-year cash flow. Reconciliation diff confirms the waterfall sums to project distributable.',
    '  Waterfall — 3-layer founder economics (pari-passu / grant bonus / performance ratchet) with investor protection caps (33% earned, 75% total). Layer B is derived from live grant, fee, and project-value inputs (auditable). Stress test at €200K/€300K/€400K/€500K founder cash; ManCo fee + consultant payment subtracted from NCF.',
    '',
    'Notes',
    '  Financing Comparison sheet shows fully-calculated metrics for all four paths (Commercial / RRF / Grant / TEPIX Loan).',
    '  Working-capital interest is shown as an annual aggregate; the in-app model runs a quarterly compute under the hood.',
    '  All € values are in euro, nominal (no inflation indexation).',
  ];
  helpLines.forEach((line, i) => {
    const c = cover.getCell(`B${10 + i}`);
    c.value = line;
    if (line.startsWith('Sheet guide') || line.startsWith('Notes') || line.startsWith('How to')) {
      c.font = FONT.bold;
    }
  });

  // Validation block is added AFTER all other sheets (it cross-references their cells).
  const valStartRow = 10 + helpLines.length + 2;

  // ── 2. Assumptions ──────────────────────────────────────────────────
  const A = wb.addWorksheet(XL.sh_assumptions);
  applyRTL(A);
  A.columns = [{ width: 4 }, { width: 38 }, { width: 16 }, { width: 14 }, { width: 32 }];

  let r = 1;
  A.getCell(`B${r}`).value = 'Assumptions';
  A.getCell(`B${r}`).font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF8B6914' } };
  r += 2;

  // Refs we'll use from other sheets — record cell coords for each input.
  type Ref = { row: number; sheet: 'Assumptions' };
  const refs: Record<string, Ref> = {};
  const setRef = (key: string, row: number) => { refs[key] = { row, sheet: 'Assumptions' }; };
  const A_ = (key: string) => aref('Assumptions', refs[key].row, 3); // value column = C (3)

  // Helper to write an input row.
  const writeInput = (label: string, value: number | string, fmt?: string, note?: string, key?: string) => {
    A.getCell(`B${r}`).value = label;
    const c = A.getCell(`C${r}`);
    c.value = value;
    c.fill = STYLE.inputFill;
    c.font = { name: 'Calibri', size: 11 };
    const borderColor = { argb: 'FFBBBBBB' };
    c.border = {
      top: { style: 'thin', color: borderColor },
      left: { style: 'thin', color: borderColor },
      bottom: { style: 'thin', color: borderColor },
      right: { style: 'thin', color: borderColor },
    };
    if (fmt) c.numFmt = fmt;
    if (note) {
      A.getCell(`E${r}`).value = note;
      A.getCell(`E${r}`).font = FONT.italic;
    }
    if (key) setRef(key, r);
    r += 1;
  };

  const writeSection = (label: string) => {
    A.mergeCells(`B${r}:E${r}`);
    A.getCell(`B${r}`).value = label;
    A.getCell(`B${r}`).font = FONT.section;
    A.getCell(`B${r}`).fill = STYLE.sectionFill;
    r += 1;
  };

  // — Revenue —
  writeSection('Revenue assumptions (Conservative)');
  writeInput('Villa ADR — Net (€/night)', a.revenueRealistic.villaADR, FMT.euro, undefined, 'villaADR');
  writeInput('Villa base nights/year', a.revenueRealistic.villaBaseNights, FMT.num, undefined, 'villaBaseNights');
  writeInput('Standard suite ADR — Net (€/night)', a.revenueRealistic.suiteStandardADR, FMT.euro, undefined, 'stdADR');
  writeInput('Double suite ADR — Net (€/night)', a.revenueRealistic.suiteDoubleADR, FMT.euro, undefined, 'dblADR');
  writeInput('Suite base nights/year', a.revenueRealistic.suiteBaseNights, FMT.num, undefined, 'suiteBaseNights');
  writeInput('Events per year', a.revenueRealistic.eventsPerYear, FMT.num, undefined, 'eventsPerYear');
  writeInput('Net profit per event (€)', a.revenueRealistic.netProfitPerEvent, FMT.euro, undefined, 'netProfitPerEvent');
  writeInput('Ancillary base profit/year (€)', a.revenueRealistic.ancillaryBaseProfit, FMT.euro, undefined, 'ancillaryBase');
  writeInput('Ancillary growth rate', a.revenueRealistic.ancillaryGrowthRate, FMT.pct, undefined, 'ancillaryGrowth');
  writeInput('Ancillary growth years', a.revenueRealistic.ancillaryGrowthYears, FMT.num, undefined, 'ancillaryGrowthYears');
  r += 1;

  writeSection('Ramp assumptions');
  writeInput('Year-1 ramp factor (2029)', a.general.year1RampFactor, FMT.pct, undefined, 'rampY1');
  writeInput('Year-2 ramp factor (2030)', a.general.year2RampFactor, FMT.pct, undefined, 'rampY2');
  writeInput('Nights growth per year (post-2030)', a.general.nightsGrowthPerYear, FMT.num, undefined, 'nightsGrowth');
  writeInput('Nights cap', a.general.nightsCap, FMT.num, undefined, 'nightsCap');
  r += 1;

  writeSection('Tax');
  writeInput('Corporate income tax rate', a.tax.corporateIncomeTaxRate, FMT.pct, undefined, 'citRate');
  writeInput('Net VAT rate (effective)', a.tax.netVATRate, FMT.pct, undefined, 'vatRate');
  r += 1;

  writeSection('Financing — Commercial loan (active path: see Debt Service sheet)');
  writeInput('Loan coverage rate', a.commercialLoan.loanCoverageRate, FMT.pct, undefined, 'loanCoverage');
  writeInput('Interest rate', a.commercialLoan.interestRate, FMT.pct, undefined, 'loanRate');
  writeInput('Grace period (years)', a.commercialLoan.gracePeriodYears, FMT.num, undefined, 'gracePeriodYears');
  writeInput('Repayment term (years)', a.commercialLoan.repaymentTermYears, FMT.num, undefined, 'repaymentTerm');
  r += 1;

  writeSection('Financing — RRF blended loan');
  writeInput('Coverage rate (% of CAPEX)', a.rrf.coverageRate ?? 0.80, FMT.pct, 'Same concept as commercial LTV; applied to total portfolio CAPEX', 'rrfCoverage');
  writeInput('RRF share of loan (EU funds)', a.rrf.rrfShareOfLoan, FMT.pct, '80% EU RRF tranche at concessional rate');
  writeInput('RRF interest rate', a.rrf.rrfInterestRate, FMT.pct, '0.35% p.a.');
  writeInput('Commercial share of loan', a.rrf.commercialShareRate, FMT.pct, '20% at commercial bank rate');
  writeInput('Commercial portion rate', a.rrf.commercialInterestRate, FMT.pct);
  writeInput('Repayment term (years)', a.rrf.repaymentTermYears, FMT.num);
  r += 1;

  writeSection('Other');
  writeInput('Acquisition legal & DD per plot (€)', a.acquisitionLegalPerPlot, FMT.euro, undefined, 'acqLegalPerPlot');
  writeInput('Exit EBITDA multiple', a.exitEbitdaMultiple, FMT.mul, 'Used for terminal asset value & IRR.', 'exitMultiple');
  writeInput('DSCR covenant threshold', a.dscrCovenantThreshold, FMT.mul,
    'Bank covenant floor — typical Greek/EU CRE: 1.20–1.30.', 'dscrCovenantThreshold');
  writeInput(
    'Bucket 1A — Collateral cap (admin reference)',
    BUCKET_1A_COLLATERAL_CAP,
    FMT.euro,
    'Admin reference — Eytan collateral pledge cap. Not a DCF input.',
  );
  writeInput(
    'Developer construction management fee / year (€)',
    a.developerConstructionFeePerYear ?? 0,
    FMT.euro,
    'Capitalized CAPEX soft cost × 2 construction years (2026–2027). NOT an operating expense.',
    'devConstructionFeePerYear',
  );
  r += 2;

  // — Per-property block —
  writeSection('Properties (one row per template instance)');
  const propHeaderRow = r;
  const propHeaders = [
    'Property', 'Plots', 'Villa units/plot', 'Std suites/plot', 'Dbl suites/plot',
    'Total area (m²)', 'Land cost (€)', 'Construction €/m²', 'FF&E (€)',
    'Legal fees (€)', 'Architect (€)', 'Civil eng. (€)', 'Contingency rate',
    'OPEX: Housekeeping', 'OPEX: Utilities', 'OPEX: Insurance', 'OPEX: Property tax',
    'OPEX: Marketing', 'OPEX: Mgmt fee', 'OPEX: Consumables', 'OPEX: Accounting',
    'OPEX contingency rate', 'OPEX: Extra lines (annual total)',
  ];
  propHeaders.forEach((h, i) => {
    const c = A.getCell(`${col(2 + i)}${propHeaderRow}`);
    c.value = h;
    c.font = FONT.header;
    c.fill = STYLE.headerFill;
    c.alignment = { horizontal: 'center', wrapText: true };
  });
  A.getRow(propHeaderRow).height = 30;
  r += 1;

  // One row per property in the portfolio.
  type PropRow = { row: number; prop: PropertyConfig };
  const propRows: PropRow[] = [];
  a.portfolio.forEach((prop) => {
    const totalArea = areaOfProp(prop);
    const values: Array<number | string> = [
      prop.name, prop.count, prop.villaUnits, prop.standardSuites, prop.doubleSuites,
      totalArea, prop.landCost, prop.constructionCostPerM2, prop.ffeCost,
      prop.legalFees, prop.architectFees, prop.civilEngineerFees, prop.contingencyRate,
      prop.opex.housekeeping, prop.opex.utilities, prop.opex.insurance, prop.opex.propertyTax,
      prop.opex.marketing, prop.opex.managementFee ?? 0, prop.opex.consumables, prop.opex.accounting,
      prop.opexContingencyRate ?? 0,
      (prop.extraOpexLines ?? []).reduce((s: number, l: { value?: number }) => s + (l.value || 0), 0),
    ];
    values.forEach((v, i) => {
      const c = A.getCell(`${col(2 + i)}${r}`);
      c.value = v;
      c.fill = STYLE.inputFill;
      if (i === 0) c.font = FONT.bold;
      else if (i === 12 || i === 21) c.numFmt = FMT.pct;
      else if (i >= 6 && i <= 11) c.numFmt = FMT.euro;
      else if (i >= 13) c.numFmt = FMT.euro;
    });
    propRows.push({ row: r, prop });
    r += 1;
  });

  // Helper to reference a property column.
  const P = (rowIdx: number, colIdx: number) => `Assumptions!$${col(2 + colIdx)}$${rowIdx}`;
  // Column indices in the property block (0-based, matching propHeaders):
  const PCOL = {
    plots: 1, villaUnits: 2, stdSuites: 3, dblSuites: 4,
    area: 5, landCost: 6, costPerM2: 7, ffe: 8,
    legalFees: 9, architect: 10, civilEng: 11, contingency: 12,
    opexHousekeeping: 13, opexUtilities: 14, opexInsurance: 15, opexPropertyTax: 16,
    opexMarketing: 17, opexMgmtFee: 18, opexConsumables: 19, opexAccounting: 20,
    opexContingency: 21, extraOpex: 22,
  };

  // Defined names for the most-edited inputs — bank can write `=villaADR` etc.
  const defineName = (name: string, ref: string) => {
    wb.definedNames.add(ref, name);
  };
  defineName('villaADR', A_('villaADR'));
  defineName('stdADR', A_('stdADR'));
  defineName('dblADR', A_('dblADR'));
  defineName('villaBaseNights', A_('villaBaseNights'));
  defineName('suiteBaseNights', A_('suiteBaseNights'));
  defineName('rampY1', A_('rampY1'));
  defineName('rampY2', A_('rampY2'));
  defineName('nightsGrowth', A_('nightsGrowth'));
  defineName('nightsCap', A_('nightsCap'));
  defineName('loanCoverage', A_('loanCoverage'));
  defineName('loanRate', A_('loanRate'));
  defineName('gracePeriodYears', A_('gracePeriodYears'));
  defineName('repaymentTerm', A_('repaymentTerm'));
  defineName('exitMultiple', A_('exitMultiple'));
  defineName('citRate', A_('citRate'));
  defineName('acqLegalPerPlot', A_('acqLegalPerPlot'));
  defineName('dscrCovenantThreshold', A_('dscrCovenantThreshold'));
  defineName('devConstructionFeePerYear', A_('devConstructionFeePerYear'));

  // Portfolio OPEX summary (derived). The management fee summary block has been
  // removed — managementFee is now 0 in all templates (accounted for in OpCo,
  // not in per-property OpEx). opexMgmtFee column (PCOL position 18) is retained
  // in PCOL to preserve column positions for drift tests; the column writes 0
  // from templates so it contributes nothing to sums.
  r += 1;
  writeSection('Portfolio summary (derived)');

  // Total OPEX (annual, ex-FFE Reserve) across portfolio — excludes managementFee
  // since that column is always 0 after the OpEx restructure (2026-05-25).
  A.getCell(`B${r}`).value = 'Total annual property OPEX (ex-FFE Reserve, Σ plots × per-property OPEX stack)';
  const opexStackFormulas = propRows.map((pr) => {
    const stack = [
      PCOL.opexHousekeeping, PCOL.opexUtilities, PCOL.opexInsurance,
      PCOL.opexPropertyTax, PCOL.opexMarketing,
      PCOL.opexConsumables, PCOL.opexAccounting,
    ].map((ci) => `${col(2 + ci)}${pr.row}`).join('+');
    return `${col(2 + PCOL.plots)}${pr.row}*(${stack})`;
  }).join('+');
  const totalOpexAnnual = propRows.reduce((s, pr) => {
    const stack = pr.prop.opex.housekeeping + pr.prop.opex.utilities + pr.prop.opex.insurance +
      pr.prop.opex.propertyTax + pr.prop.opex.marketing +
      pr.prop.opex.consumables + pr.prop.opex.accounting;
    return s + pr.prop.count * stack;
  }, 0);
  A.getCell(`C${r}`).value = opexStackFormulas ? { formula: `=${opexStackFormulas}`, result: totalOpexAnnual } : totalOpexAnnual;
  A.getCell(`C${r}`).numFmt = FMT.euro;
  A.getCell(`C${r}`).fill = STYLE.formulaFill;
  r += 2;

  // ── 3. CAPEX ────────────────────────────────────────────────────────
  const C = wb.addWorksheet(XL.sh_capex);
  applyRTL(C);
  C.columns = [{ width: 32 }, ...propRows.map(() => ({ width: 18 })), { width: 18 }];
  C.getCell('A1').value = 'CAPEX Breakdown';
  C.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8B6914' } };

  // Header row: cost category + one column per property + total
  let cr = 3;
  C.getCell(`A${cr}`).value = 'Cost category';
  C.getCell(`A${cr}`).font = FONT.header;
  C.getCell(`A${cr}`).fill = STYLE.headerFill;
  propRows.forEach((p, i) => {
    const cell = C.getCell(`${col(2 + i)}${cr}`);
    cell.value = p.prop.name + (p.prop.count > 1 ? ` (×${p.prop.count})` : '');
    cell.font = FONT.header;
    cell.fill = STYLE.headerFill;
    cell.alignment = { horizontal: 'center' };
  });
  C.getCell(`${col(2 + propRows.length)}${cr}`).value = 'Total';
  C.getCell(`${col(2 + propRows.length)}${cr}`).font = FONT.header;
  C.getCell(`${col(2 + propRows.length)}${cr}`).fill = STYLE.headerFill;
  cr += 1;

  // Each row: a cost category, formula-driven from Assumptions per property.
  // Engine: computeCapexPerUnit
  //   land + building + landscaping + pools + ffe + licenses + director + contingency
  // Per-property total = perUnit * plots
  // Order MUST match engine categoryDefs in model.ts so the grand-total SUM
  // covers every item included in portfolioTotal.

  // Fast category lookup by name — avoids fragile positional index.
  const capexCatByName = new Map<string, (typeof m.capex.categories)[0]>();
  m.capex.categories.forEach((cat) => capexCatByName.set(cat.name, cat));

  // formula: returns Excel formula string (live from Assumptions) OR null
  // (write engine value directly — used when the item has no Assumptions column
  // or when a consolidated field like licensesPermitsCost would disagree with
  // the individual legalFees / architectFees / civilEngineerFees columns).
  const capexLines: { name: string; engineCatName: string; formula: (pr: PropRow) => string | null }[] = [
    {
      name: 'Land acquisition',
      engineCatName: 'Land acquisition',
      formula: (pr) => `=${P(pr.row, PCOL.landCost)}*${P(pr.row, PCOL.plots)}`,
    },
    {
      name: 'Building & excavation',
      engineCatName: 'Building & excavation',
      formula: (pr) => `=${P(pr.row, PCOL.area)}*${P(pr.row, PCOL.costPerM2)}*${P(pr.row, PCOL.plots)}`,
    },
    {
      // No Assumptions column — write engine value directly so the CAPEX SUM
      // stays in sync when landscapingCost is non-zero in the live scenario.
      name: 'Landscaping / stone fence',
      engineCatName: 'Landscaping / stone fence',
      formula: () => null,
    },
    {
      // Pool / wellness costs computed from poolSlots or wellnessFlatCost in
      // the engine; no Assumptions sheet column for these.
      name: 'Pools / wellness',
      engineCatName: 'Pools / wellness',
      formula: () => null,
    },
    {
      name: 'FF&E',
      engineCatName: 'FF&E',
      formula: (pr) => `=${P(pr.row, PCOL.ffe)}*${P(pr.row, PCOL.plots)}`,
    },
    {
      // Consolidated from legal + architect + civil.
      // When licensesPermitsCost is set the engine bypasses the three individual
      // PCOL fields and uses the combined figure — matching that in Excel prevents
      // a CAPEX formula drift on recalculate.
      name: 'Licenses & permits',
      engineCatName: 'Licenses & permits',
      formula: (pr) =>
        pr.prop.licensesPermitsCost != null
          ? null // hardcoded — individual PCOL columns would undercount
          : `=(${P(pr.row, PCOL.legalFees)}+${P(pr.row, PCOL.architect)}+${P(pr.row, PCOL.civilEng)})*${P(pr.row, PCOL.plots)}`,
    },
    {
      // No Assumptions column — write engine value directly.
      name: 'Developer management fee (construction, 2 yrs)',
      engineCatName: 'Developer management fee (construction, 2 yrs)',
      formula: () => null,
    },
    {
      name: 'Contingency (10% of building + FF&E)',
      engineCatName: 'Contingency (10% of building + FF&E)',
      formula: (pr) => `=(${P(pr.row, PCOL.area)}*${P(pr.row, PCOL.costPerM2)}+${P(pr.row, PCOL.ffe)})*${P(pr.row, PCOL.contingency)}*${P(pr.row, PCOL.plots)}`,
    },
  ];

  const capexFirstDataRow = cr;
  capexLines.forEach((line) => {
    C.getCell(`A${cr}`).value = line.name;
    const engineCat = capexCatByName.get(line.engineCatName);
    let rowSum = 0;
    propRows.forEach((pr, i) => {
      const c = C.getCell(`${col(2 + i)}${cr}`);
      const engineVal = engineCat?.perProperty.find((p) => p.id === pr.prop.id)?.total ?? 0;
      const formulaStr = line.formula(pr);
      // formula-driven: live Excel formula with engine seed for immediate display.
      // hardcoded (null formula): write plain value — no live formula since the
      // item has no Assumptions column; Excel SUM still picks it up correctly.
      c.value = formulaStr !== null ? { formula: formulaStr, result: engineVal } : engineVal;
      rowSum += engineVal;
      c.fill = STYLE.formulaFill;
      c.numFmt = FMT.euro;
    });
    const totalCell = C.getCell(`${col(2 + propRows.length)}${cr}`);
    totalCell.value = { formula: `=SUM(${col(2)}${cr}:${col(1 + propRows.length)}${cr})`, result: rowSum };
    totalCell.fill = STYLE.totalFill;
    totalCell.font = FONT.bold;
    totalCell.numFmt = FMT.euro;
    cr += 1;
  });

  // Acquisition legal & DD
  // Legacy portfolios (acquisitionLegalRate absent on every property): every plot pays the
  // flat `acquisitionLegalPerPlot` rate → formula =acqLegalPerPlot*plots stays live.
  // New portfolios (acquisitionLegalRate set per property): the engine folds each property's
  // (landCost × acquisitionLegalRate × count) into portfolioTotal directly, and the flat
  // `acquisitionLegalPerPlot` named range is NOT used by the engine. We must write the engine
  // category value (hardcoded) to avoid the formula =acqLegalPerPlot*plots overcounting.
  const useLegacyAcqLegal = a.portfolio.every((p) => p.acquisitionLegalRate == null);
  const acqLegalCat = capexCatByName.get('Acquisition legal & DD');
  C.getCell(`A${cr}`).value = 'Acquisition legal & due diligence';
  C.getCell(`A${cr}`).font = FONT.italic;
  let acqRowSum = 0;
  propRows.forEach((pr, i) => {
    const c = C.getCell(`${col(2 + i)}${cr}`);
    let engineVal: number;
    if (useLegacyAcqLegal) {
      engineVal = a.acquisitionLegalPerPlot * pr.prop.count;
      c.value = { formula: `=acqLegalPerPlot*${P(pr.row, PCOL.plots)}`, result: engineVal };
    } else {
      engineVal = acqLegalCat?.perProperty.find((p) => p.id === pr.prop.id)?.total ?? 0;
      c.value = engineVal; // no Assumptions PCOL for acquisitionLegalRate; write engine value
    }
    acqRowSum += engineVal;
    c.fill = STYLE.formulaFill;
    c.numFmt = FMT.euro;
  });
  const acqLegalGrandTotal = acqLegalCat?.grandTotal ?? acqRowSum;
  const acqTotalCell = C.getCell(`${col(2 + propRows.length)}${cr}`);
  acqTotalCell.value = useLegacyAcqLegal
    ? { formula: `=SUM(${col(2)}${cr}:${col(1 + propRows.length)}${cr})`, result: acqLegalGrandTotal }
    : acqLegalGrandTotal;
  acqTotalCell.fill = STYLE.totalFill;
  acqTotalCell.font = FONT.bold;
  acqTotalCell.numFmt = FMT.euro;
  cr += 1;

  // Developer construction management fee — 2-year soft cost, portfolio-level.
  // Not split per property; only the Total column is populated.
  // Engine: model.ts computeCapex adds (developerConstructionFeePerYear ?? 0) × 2
  // to portfolioTotal. The formula here uses the named range so a banker can
  // edit the fee and see total CAPEX, equity, and IRR recompute live.
  {
    const devFeeAmount = (a.developerConstructionFeePerYear ?? 0) * 2;
    C.getCell(`A${cr}`).value = 'Construction director';
    C.getCell(`A${cr}`).font = FONT.italic;
    // Per-property columns: 0 (portfolio-level cost, not attributable per plot)
    propRows.forEach((_, i) => {
      const c = C.getCell(`${col(2 + i)}${cr}`);
      c.value = 0;
      c.numFmt = FMT.euro;
      c.fill = STYLE.formulaFill;
    });
    // Total column: formula-driven from Assumptions named range
    const devFeeTotCell = C.getCell(`${col(2 + propRows.length)}${cr}`);
    devFeeTotCell.value = { formula: `=devConstructionFeePerYear*2`, result: devFeeAmount };
    devFeeTotCell.fill = STYLE.formulaFill;
    devFeeTotCell.font = FONT.bold;
    devFeeTotCell.numFmt = FMT.euro;
    cr += 1;
  }

  // Custom CAPEX lines: one Excel row per (property, line) pair, looked up by
  // the stable key `${prop.id}::${line.id}` in m.capex.categories.
  for (const propRow of propRows) {
    for (const line of propRow.prop.extraCapexLines ?? []) {
      const key = `${propRow.prop.id}::${line.id}`;
      const cat = m.capex.categories.find((c) => c.name === key);
      const displayName = line.name || key;
      C.getCell(`A${cr}`).value = displayName;
      C.getCell(`A${cr}`).font = FONT.italic;
      let rowSum = 0;
      propRows.forEach((pr, i) => {
        const c = C.getCell(`${col(2 + i)}${cr}`);
        const engineVal = cat?.perProperty.find((p) => p.id === pr.prop.id)?.total
          ?? (pr.prop.id === propRow.prop.id ? (line.cost || 0) * pr.prop.count : 0);
        c.value = engineVal;
        rowSum += engineVal;
        c.fill = STYLE.formulaFill;
        c.numFmt = FMT.euro;
      });
      const totCell = C.getCell(`${col(2 + propRows.length)}${cr}`);
      totCell.value = cat?.grandTotal ?? rowSum;
      totCell.fill = STYLE.totalFill;
      totCell.font = FONT.bold;
      totCell.numFmt = FMT.euro;
      cr += 1;
    }
  }

  // Total CAPEX row
  const capexTotalRow = cr;
  C.getCell(`A${cr}`).value = 'TOTAL CAPEX';
  C.getCell(`A${cr}`).font = FONT.bold;
  for (let ci = 2; ci <= 2 + propRows.length; ci++) {
    const c = C.getCell(`${col(ci)}${cr}`);
    let colSum = 0;
    if (ci === 2 + propRows.length) {
      colSum = m.capex.portfolioTotal;
    } else {
      const propIdx = ci - 2;
      const prop = propRows[propIdx]?.prop;
      const propTotal = m.capex.properties.find((p) => p.id === prop?.id)?.total ?? 0;
      colSum = propTotal + a.acquisitionLegalPerPlot * (prop?.count ?? 0);
    }
    c.value = { formula: `=SUM(${col(ci)}${capexFirstDataRow}:${col(ci)}${cr - 1})`, result: colSum };
    c.fill = STYLE.totalFill;
    c.font = FONT.bold;
    c.numFmt = FMT.euro;
    c.border = { top: { style: 'medium' } };
  }

  const capexTotalCell = `CAPEX!$${col(2 + propRows.length)}$${capexTotalRow}`; // grand total
  // Freeze the header row & cost-category column for scrolling.
  C.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];

  // ── 4. Revenue ──────────────────────────────────────────────────────
  const R = wb.addWorksheet(XL.sh_revenue);
  applyRTL(R);
  R.columns = [{ width: 32 }, ...years.map(() => ({ width: 14 }))];
  R.getCell('A1').value = 'Revenue';
  R.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8B6914' } };
  let rr = 3;
  // Header: years
  R.getCell(`A${rr}`).value = XL.lbl_metric;
  R.getCell(`A${rr}`).font = FONT.header;
  R.getCell(`A${rr}`).fill = STYLE.headerFill;
  years.forEach((y, i) => {
    const c = R.getCell(`${col(2 + i)}${rr}`);
    c.value = y;
    c.font = FONT.header;
    c.fill = STYLE.headerFill;
    c.alignment = { horizontal: 'center' };
  });
  rr += 1;

  // Phase row
  R.getCell(`A${rr}`).value = XL.lbl_phase;
  R.getCell(`A${rr}`).font = FONT.italic;
  years.forEach((y, i) => {
    const phase =
      y === 2026 ? 'Acquisition' :
      y === 2027 ? 'Construction' :
      y === 2029 ? 'Opening' :
      y === 2030 ? 'Year 2' :
      'Stabilised';
    const c = R.getCell(`${col(2 + i)}${rr}`);
    c.value = phase;
    c.font = FONT.italic;
    c.alignment = { horizontal: 'center' };
  });
  rr += 1;

  // Ramp factor row — formula
  R.getCell(`A${rr}`).value = 'Ramp factor';
  R.getCell(`A${rr}`).font = FONT.italic;
  const rampRow = rr;
  years.forEach((y, i) => {
    const c = R.getCell(`${col(2 + i)}${rr}`);
    if (y <= 2028) c.value = 0;
    else if (y === 2029) c.value = { formula: '=rampY1' };
    else if (y === 2030) c.value = { formula: '=rampY2' };
    else c.value = 1;
    c.numFmt = FMT.pct;
    c.fill = STYLE.formulaFill;
  });
  rr += 1;

  // Villa nights row — formula
  R.getCell(`A${rr}`).value = 'Villa nights/yr';
  const villaNightsRow = rr;
  years.forEach((y, i) => {
    const c = R.getCell(`${col(2 + i)}${rr}`);
    if (y <= 2028) c.value = 0;
    else if (y <= 2030) c.value = { formula: '=villaBaseNights' };
    else c.value = { formula: `=MIN(nightsCap,villaBaseNights+MAX(0,${y - 2031})*nightsGrowth)` };
    c.numFmt = FMT.num;
    c.fill = STYLE.formulaFill;
  });
  rr += 1;

  // Suite nights row — formula
  R.getCell(`A${rr}`).value = 'Suite nights/yr';
  const suiteNightsRow = rr;
  years.forEach((y, i) => {
    const c = R.getCell(`${col(2 + i)}${rr}`);
    if (y <= 2028) c.value = 0;
    else if (y <= 2030) c.value = { formula: '=suiteBaseNights' };
    else c.value = { formula: `=MIN(nightsCap,suiteBaseNights+MAX(0,${y - 2031})*nightsGrowth)` };
    c.numFmt = FMT.num;
    c.fill = STYLE.formulaFill;
  });
  rr += 2;

  // Per-property revenue rows
  // Engine: revenuePerUnit = (villaUnits*villaNights*villaADR + std*suiteNights*stdADR + dbl*suiteNights*dblADR) * ramp
  // totalRevenue = revenuePerUnit * plots
  R.getCell(`A${rr}`).value = 'Property revenue';
  R.getCell(`A${rr}`).font = FONT.section;
  rr += 1;

  const propRevRows: number[] = [];
  propRows.forEach((pr) => {
    const c = R.getCell(`A${rr}`);
    c.value = `  ${pr.prop.name}`;
    years.forEach((y, i) => {
      const cell = R.getCell(`${col(2 + i)}${rr}`);
      const eng = py(y);
      const engineRev = eng?.propertyBreakdown.find((p) => p.id === pr.prop.id)?.totalRevenue ?? 0;
      if (y <= 2028) {
        cell.value = 0;
      } else {
        const villaPart = `${P(pr.row, PCOL.villaUnits)}*${col(2 + i)}${villaNightsRow}*villaADR`;
        const stdPart = `${P(pr.row, PCOL.stdSuites)}*${col(2 + i)}${suiteNightsRow}*stdADR`;
        const dblPart = `${P(pr.row, PCOL.dblSuites)}*${col(2 + i)}${suiteNightsRow}*dblADR`;
        const formula = `=(${villaPart}+${stdPart}+${dblPart})*${P(pr.row, PCOL.plots)}*${col(2 + i)}${rampRow}`;
        cell.value = { formula, result: engineRev };
      }
      cell.numFmt = FMT.euro;
      cell.fill = STYLE.formulaFill;
    });
    propRevRows.push(rr);
    rr += 1;
  });

  // Events — NET-of-cost contribution line (Issue 2). Gross event revenue would
  // typically be ~3× this number with ~70% direct costs; we present net only
  // because that's what the engine tracks and what flows to EBITDA.
  R.getCell(`A${rr}`).value = '  Events — NET of direct costs (contribution)';
  const eventsRow = rr;
  years.forEach((y, i) => {
    const cell = R.getCell(`${col(2 + i)}${rr}`);
    const engineEvents = py(y)?.revenueEvents ?? 0;
    if (y <= 2028) cell.value = 0;
    else cell.value = { formula: `=${A_('eventsPerYear')}*${A_('netProfitPerEvent')}*${col(2 + i)}${rampRow}`, result: engineEvents };
    cell.numFmt = FMT.euro;
    cell.fill = STYLE.formulaFill;
  });
  rr += 1;

  // Ancillary — NET-of-cost contribution line (Issue 2). Spa, F&B, transfers,
  // experiences: typical ~50% net margin → gross revenue ≈ 2× this figure.
  R.getCell(`A${rr}`).value = '  Ancillary — NET of direct costs (contribution)';
  const ancillaryRow = rr;
  years.forEach((y, i) => {
    const cell = R.getCell(`${col(2 + i)}${rr}`);
    const engineAnc = py(y)?.revenueAncillary ?? 0;
    if (y < 2029) cell.value = 0;
    else {
      const offset = y - 2029;
      cell.value = { formula: `=${A_('ancillaryBase')}*POWER(1+${A_('ancillaryGrowth')},MIN(${offset},${A_('ancillaryGrowthYears')}))`, result: engineAnc };
    }
    cell.numFmt = FMT.euro;
    cell.fill = STYLE.formulaFill;
  });
  rr += 1;

  // Total revenue
  const totalRevRow = rr;
  R.getCell(`A${rr}`).value = 'TOTAL REVENUE (incl. NET events + NET ancillary)';
  R.getCell(`A${rr}`).font = FONT.bold;
  years.forEach((y, i) => {
    const cells = [...propRevRows, eventsRow, ancillaryRow].map((rrIdx) => `${col(2 + i)}${rrIdx}`).join(',');
    const cell = R.getCell(`${col(2 + i)}${rr}`);
    cell.value = { formula: `=SUM(${cells})`, result: pyVal(y, 'totalRevenue') };
    cell.numFmt = FMT.euro;
    cell.fill = STYLE.totalFill;
    cell.font = FONT.bold;
    cell.border = { top: { style: 'medium' } };
  });
  rr += 2;

  // ── Issue 2: Implied gross-revenue basis ──
  // Events grossed at 3× (assumed 33% net margin); ancillary at 2× (50% net
  // margin). These multipliers are presentation aids — they do NOT change the
  // P&L. They let a reader compare GOP margin to industry benchmarks (STR/HVS
  // boutique 30–45%) on a like-for-like gross-revenue basis.
  const EVENTS_GROSSUP = 3.0;
  const ANCILLARY_GROSSUP = 2.0;
  R.getCell(`A${rr}`).value = 'Memo — Implied gross-revenue basis (presentation only)';
  R.getCell(`A${rr}`).font = FONT.section;
  rr += 1;
  R.getCell(`A${rr}`).value = `  Events grossed up at ${EVENTS_GROSSUP}× net (≈ 33% net margin)`;
  R.getCell(`A${rr}`).font = FONT.italic;
  years.forEach((y, i) => {
    const cell = R.getCell(`${col(2 + i)}${rr}`);
    const result = pyVal(y, 'revenueEvents') * EVENTS_GROSSUP;
    cell.value = { formula: `=${col(2 + i)}${eventsRow}*${EVENTS_GROSSUP}`, result };
    cell.numFmt = FMT.euro;
    cell.fill = STYLE.formulaFill;
  });
  const grossEventsRow = rr;
  rr += 1;
  R.getCell(`A${rr}`).value = `  Ancillary grossed up at ${ANCILLARY_GROSSUP}× net (≈ 50% net margin)`;
  R.getCell(`A${rr}`).font = FONT.italic;
  years.forEach((y, i) => {
    const cell = R.getCell(`${col(2 + i)}${rr}`);
    const result = pyVal(y, 'revenueAncillary') * ANCILLARY_GROSSUP;
    cell.value = { formula: `=${col(2 + i)}${ancillaryRow}*${ANCILLARY_GROSSUP}`, result };
    cell.numFmt = FMT.euro;
    cell.fill = STYLE.formulaFill;
  });
  const grossAncillaryRow = rr;
  rr += 1;
  R.getCell(`A${rr}`).value = 'Implied gross revenue (rooms + grossed-up events + grossed-up ancillary)';
  R.getCell(`A${rr}`).font = FONT.bold;
  const impliedGrossRow = rr;
  years.forEach((y, i) => {
    const propsRefs = propRevRows.map((rrIdx) => `${col(2 + i)}${rrIdx}`).join(',');
    const cell = R.getCell(`${col(2 + i)}${rr}`);
    const propsSum = propRevRows.reduce((s, rrIdx) => {
      const eng = py(y);
      if (!eng) return s;
      // sum of property revenues for this year — use engine values
      return s; // placeholder; we'll compute below
    }, 0);
    // Engine has totalRevenue = sum(propRev) + events + ancillary. Solve for sum(propRev).
    const engineTotal = pyVal(y, 'totalRevenue');
    const events = pyVal(y, 'revenueEvents');
    const ancillary = pyVal(y, 'revenueAncillary');
    const roomsOnly = engineTotal - events - ancillary;
    const impliedGross = roomsOnly + events * EVENTS_GROSSUP + ancillary * ANCILLARY_GROSSUP;
    void propsSum;
    cell.value = {
      formula: `=SUM(${propsRefs})+${col(2 + i)}${grossEventsRow}+${col(2 + i)}${grossAncillaryRow}`,
      result: impliedGross,
    };
    cell.numFmt = FMT.euro;
    cell.fill = STYLE.totalFill;
    cell.font = FONT.bold;
  });
  rr += 2;

  // Footnote explaining the row
  R.mergeCells(`A${rr}:${col(1 + years.length)}${rr}`);
  R.getCell(`A${rr}`).value =
    'Note: Events and Ancillary are tracked as NET-of-cost contribution lines in the P&L. ' +
    'On a gross-revenue basis (above), GOP margin sits well within the 30–45% STR/HVS ' +
    'boutique benchmark. The high EBITDA margin on the P&L reflects net-line presentation, not ' +
    'unusually low costs.';
  R.getCell(`A${rr}`).font = FONT.italic;
  R.getCell(`A${rr}`).alignment = { wrapText: true, vertical: 'top' };
  R.getRow(rr).height = 36;
  R.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];

  // ── 5. OPEX & P&L ───────────────────────────────────────────────────
  const PnL = wb.addWorksheet(XL.sh_opexPnl);
  applyRTL(PnL);
  PnL.columns = [{ width: 32 }, ...years.map(() => ({ width: 14 }))];
  PnL.getCell('A1').value = 'OPEX & P&L';
  PnL.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8B6914' } };

  let pr2 = 3;
  // Header
  PnL.getCell(`A${pr2}`).value = XL.lbl_metric;
  PnL.getCell(`A${pr2}`).font = FONT.header;
  PnL.getCell(`A${pr2}`).fill = STYLE.headerFill;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = y;
    c.font = FONT.header;
    c.fill = STYLE.headerFill;
    c.alignment = { horizontal: 'center' };
  });
  pr2 += 2;

  // Revenue line — pulled from Revenue sheet
  PnL.getCell(`A${pr2}`).value = XL.lbl_revenue;
  PnL.getCell(`A${pr2}`).font = FONT.bold;
  const revRowOnPnL = pr2;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = { formula: `=${XL.sh_revenue}!${col(2 + i)}${totalRevRow}`, result: pyVal(y, 'totalRevenue') };
    c.numFmt = FMT.euro;
    c.fill = STYLE.formulaFill;
  });
  pr2 += 2;

  // OPEX per property — one row per property, fully engine-seeded (no live formula).
  //
  // FF&E Reserve is revenue-based: max(ffeReserveFloor, rate% × revenuePerUnit)
  //   Rates: 0% OPENING_YEAR (2029, floor only), 2% (2030), 3% (2031), 4%+ thereafter.
  // Revenue-based FF&E Reserve cannot be expressed as an Assumptions-sheet formula
  // without referencing the Revenue sheet (circular). Per-property OPEX rows are
  // seeded directly from engine output — they will NOT drift when Excel recalculates.
  //
  // Assumptions sheet columns $T$/$W$/$X$ (mgmtFee/opexContingency/extraOpex)
  // are retained to prevent index shifts in any cross-sheet lookups.
  //
  // Bank-view OPEX adjustment (mirrors engine model.ts ~lines 739-772):
  //   Bank view: adds a single "Senior management floor" row
  //   (opCoSeniorFloor × totalVillaCount) paid SENIOR to debt service.
  //   opCoFeeRow then shows only the JUNIOR overage.
  const isBankViewExport = (a.viewMode ?? 'internal') === 'bank';
  const totalVillaCountExport = a.portfolio.reduce((sum, p) => sum + p.count, 0);

  PnL.getCell(`A${pr2}`).value = 'OPEX (per property × plots)';
  PnL.getCell(`A${pr2}`).font = FONT.section;
  pr2 += 1;

  const propOpexRows: number[] = [];
  propRows.forEach((pr) => {
    // Per-property combined OPEX = controllable + FF&E Reserve, seeded from engine.
    // No live Excel formula — FF&E Reserve is revenue-based and revenue-circular.
    PnL.getCell(`A${pr2}`).value = `  ${pr.prop.name}`;
    years.forEach((y, i) => {
      const cell = PnL.getCell(`${col(2 + i)}${pr2}`);
      const eng = py(y);
      const engineOpex = eng?.propertyBreakdown.find((p) => p.id === pr.prop.id)?.totalOpex ?? 0;
      cell.value = y <= 2028 ? 0 : engineOpex;
      cell.numFmt = FMT.euro;
      cell.fill = STYLE.inputFill;
    });
    propOpexRows.push(pr2);
    pr2 += 1;
  });

  // Bank view only: senior management floor (opCoSeniorFloor × totalVillaCount),
  // paid SENIOR to debt service. Replaces the per-villa managementFee that was
  // removed from the per-property baseOpex formula above.
  if (isBankViewExport) {
    PnL.getCell(`A${pr2}`).value = '  Senior management floor (SENIOR to DS)';
    PnL.getCell(`A${pr2}`).font = FONT.italic;
    years.forEach((y, i) => {
      const c = PnL.getCell(`${col(2 + i)}${pr2}`);
      // Only applies in operational years (engine: year > HORIZON_START_YEAR + 2 = 2028)
      const seniorFee = y > 2028 ? (a.opCoSeniorFloor ?? 0) * totalVillaCountExport : 0;
      c.value = seniorFee;
      c.numFmt = FMT.euro;
      c.fill = STYLE.inputFill;
    });
    propOpexRows.push(pr2);
    pr2 += 1;
  }

  // Portfolio-level shared overhead (staff, services, shared overhead, pre-opening amortisation).
  // Seeded as the EXACT RESIDUAL: engine.totalOpex − Σ(propertyBreakdown[].totalOpex) − seniorFloor.
  // Using the residual rather than portfolioOpex.total directly avoids any mis-match caused by
  // legacy per-villa managementFee fields in Firestore that the engine subtracts from propertyOpex
  // even though they are no longer included in computeOpexForProperty. By construction the SUM
  // of all propOpexRows cells will exactly equal the engine's totalOpex for every year.
  {
    PnL.getCell(`A${pr2}`).value = '  Portfolio shared overhead (staff, services, pre-opening)';
    PnL.getCell(`A${pr2}`).font = FONT.italic;
    years.forEach((y, i) => {
      const c = PnL.getCell(`${col(2 + i)}${pr2}`);
      const pnlY = py(y);
      const engineTotalOpex = pnlY?.totalOpex ?? 0;
      const propertyOpexAllY = (pnlY?.propertyBreakdown ?? []).reduce((s, p) => s + p.totalOpex, 0);
      const seniorFloorY = isBankViewExport && y > 2028
        ? (a.opCoSeniorFloor ?? 0) * totalVillaCountExport : 0;
      const residual = engineTotalOpex - propertyOpexAllY - seniorFloorY;
      c.value = residual;
      c.numFmt = FMT.euro;
      c.fill = STYLE.inputFill;
    });
    propOpexRows.push(pr2);
    pr2 += 1;
  }

  // WC interest — annual aggregate from engine. Formula-based reconstruction
  // would require the quarterly compute, which is out of scope for v1.
  const wcRow = pr2;
  PnL.getCell(`A${pr2}`).value = '  Working-capital interest (annual aggregate)';
  PnL.getCell(`A${pr2}`).font = FONT.italic;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = pyVal(y, 'wcInterestExpense');
    c.numFmt = FMT.euro;
    c.fill = STYLE.inputFill;
  });
  pr2 += 1;

  // Total OPEX = sum of property OPEX rows only (WC interest excluded — Finding A)
  const totalOpexRow = pr2;
  PnL.getCell(`A${pr2}`).value = XL.lbl_totalOpex;
  PnL.getCell(`A${pr2}`).font = FONT.bold;
  years.forEach((y, i) => {
    const cells = [...propOpexRows].map((rrIdx) => `${col(2 + i)}${rrIdx}`).join(',');
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = { formula: `=SUM(${cells})`, result: pyVal(y, 'totalOpex') };
    c.numFmt = FMT.euro;
    c.fill = STYLE.totalFill;
    c.font = FONT.bold;
    c.border = { top: { style: 'thin' } };
  });
  pr2 += 1;

  // OpCo management fee — hardcoded from engine (Bucket 2A gross-revenue fee +
  // Bucket 2B incentive). Formula reconstruction is not feasible here (EBITDA-based
  // incentive creates a circular reference in Excel), so we mirror the engine's value.
  //
  // The engine always folds seniorMgmtFee into totalOpex (via propertyOpex) in both
  // bank and internal view. The "Portfolio shared overhead" residual row therefore
  // absorbs it in both views. This row must show ONLY the junior tranche in both views
  // — otherwise the EBITDA formula (Revenue − totalOpexRow − opCoFeeRow) would
  // double-count the senior floor and understate EBITDA by seniorMgmtFee.
  //
  //   opCoTotalFee = seniorFloor + juniorPaid  (engine field)
  //   This row  = juniorPaid  (= opCoTotalFee − seniorFloor)  in BOTH views.
  //
  // Bank view label makes the subordination explicit; internal view uses the
  // familiar "management fee" label but still shows juniorPaid only.
  const opCoFeeRow = pr2;
  PnL.getCell(`A${pr2}`).value = isBankViewExport
    ? 'OpCo junior fee — subordinated to DS (Bucket 2A+2B above senior floor)'
    : 'OpCo management fee — junior tranche (Bucket 2A + 2B, from engine)';
  PnL.getCell(`A${pr2}`).font = FONT.italic;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    // Strip the senior floor in BOTH views — it is already captured in totalOpexRow
    // via the portfolio-overhead residual row (which absorbs seniorMgmtFee from the
    // engine's propertyOpex computation regardless of view mode).
    const seniorFloor = y > 2028 ? (a.opCoSeniorFloor ?? 0) * totalVillaCountExport : 0;
    c.value = pyVal(y, 'opCoTotalFee') - seniorFloor;
    c.numFmt = FMT.euro;
    c.fill = STYLE.inputFill;
  });
  pr2 += 1;

  // EBITDA = Revenue − Total OPEX − OpCo management fee
  // Engine equivalent: ebitdaPreOpCo (= Revenue − totalOpex) − opCoActuallyPaid
  const ebitdaRow = pr2;
  PnL.getCell(`A${pr2}`).value = XL.lbl_ebitda;
  PnL.getCell(`A${pr2}`).font = FONT.bold;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = { formula: `=${col(2 + i)}${revRowOnPnL}-${col(2 + i)}${totalOpexRow}-${col(2 + i)}${opCoFeeRow}`, result: pyVal(y, 'ebitda') };
    c.numFmt = FMT.euro;
    c.fill = STYLE.totalFill;
    c.font = FONT.bold;
  });
  pr2 += 1;

  // EBITDA margin — net-revenue basis (high because events/ancillary are net).
  const ebitdaMarginRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'EBITDA margin (on net-line revenue)';
  PnL.getCell(`A${pr2}`).font = FONT.italic;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    const rev = pyVal(y, 'totalRevenue');
    const result = rev > 0 ? pyVal(y, 'ebitda') / rev : 0;
    c.value = { formula: `=IFERROR(${col(2 + i)}${ebitdaRow}/${col(2 + i)}${revRowOnPnL},0)`, result };
    c.numFmt = FMT.pct;
    c.fill = STYLE.formulaFill;
  });
  pr2 += 1;

  // Implied GOP margin on gross-revenue basis — pulled from Revenue sheet's
  // implied-gross row. Lets the reader sanity-check vs industry benchmarks.
  PnL.getCell(`A${pr2}`).value = 'GOP margin on IMPLIED gross revenue (industry-comparable)';
  PnL.getCell(`A${pr2}`).font = FONT.italic;
  // We computed an `impliedGrossRow` on the Revenue sheet; reference its column-by-column values.
  // The Revenue rr at that point reflects the impliedGrossRow.
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    const eng = py(y);
    const events = eng?.revenueEvents ?? 0;
    const ancillary = eng?.revenueAncillary ?? 0;
    const total = eng?.totalRevenue ?? 0;
    const grossUp = total - events - ancillary + events * 3 + ancillary * 2;
    const result = grossUp > 0 ? (eng?.ebitda ?? 0) / grossUp : 0;
    // Cross-sheet formula referencing the implied-gross-revenue row on Revenue.
    c.value = {
      formula: `=IFERROR(${col(2 + i)}${ebitdaRow}/${XL.sh_revenue}!${col(2 + i)}${impliedGrossRow},0)`,
      result,
    };
    c.numFmt = FMT.pct;
    c.fill = STYLE.formulaFill;
  });
  pr2 += 2;
  void ebitdaMarginRow;

  // Depreciation (Art. 24, Law 4172/2013) — straight-line, starts OPENING_YEAR.
  // Non-cash deduction from CIT base only; does not reduce EBITDA or NCF.
  const depreciationRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'Depreciation (Art. 24, straight-line)';
  PnL.getCell(`A${pr2}`).font = FONT.italic;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = -(py(y)?.annualDepreciation ?? 0);
    c.numFmt = FMT.euro;
    c.fill = STYLE.inputFill;
  });
  pr2 += 1;

  // EBIT = EBITDA − Depreciation (for CIT reference only).
  const ebitRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'EBIT (after depreciation — CIT reference)';
  PnL.getCell(`A${pr2}`).font = FONT.bold;
  years.forEach((y, i) => {
    const e = py(y);
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = {
      formula: `=${col(2 + i)}${ebitdaRow}+${col(2 + i)}${depreciationRow}`,
      result: (e?.ebitda ?? 0) - (e?.annualDepreciation ?? 0),
    };
    c.numFmt = FMT.euro;
    c.fill = STYLE.totalFill;
    c.font = FONT.bold;
  });
  pr2 += 1;
  void ebitRow;

  // Debt service split into three rows for clarity (Issue 4):
  //   - Main-loan interest: interest-only during the 2026–2028 grace period,
  //     then interest portion of the amortising PMT from 2029 onward.
  //   - Main-loan principal: zero during grace, then principal portion.
  //   - Working-capital interest: already exists above as `wcRow`. Subtotal
  //     "Total debt service" below sums main loan + WC for DSCR purposes.
  // Engine already breaks these out on AnnualPnL.termLoanInterest /
  // termLoanPrincipal / wcInterestExpense — we mirror those values here.

  const mainInterestRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'Main-loan interest';
  PnL.getCell(`A${pr2}`).font = FONT.italic;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = pyVal(y, 'termLoanInterest');
    c.numFmt = FMT.euro;
    c.fill = STYLE.inputFill;
  });
  pr2 += 1;

  const mainPrincipalRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'Main-loan principal';
  PnL.getCell(`A${pr2}`).font = FONT.italic;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = pyVal(y, 'termLoanPrincipal');
    c.numFmt = FMT.euro;
    c.fill = STYLE.inputFill;
  });
  pr2 += 1;

  // Main loan total = interest + principal (formula).
  const mainDsRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'Main-loan debt service (subtotal)';
  PnL.getCell(`A${pr2}`).font = FONT.bold;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    const result = pyVal(y, 'termLoanInterest') + pyVal(y, 'termLoanPrincipal');
    c.value = { formula: `=${col(2 + i)}${mainInterestRow}+${col(2 + i)}${mainPrincipalRow}`, result };
    c.numFmt = FMT.euro;
    c.fill = STYLE.formulaFill;
    c.font = FONT.bold;
  });
  pr2 += 1;

  // Total debt service = main loan + WC interest. DSCR is computed against
  // this total on the Coverage sheet (Issue 4).
  const dsRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'TOTAL DEBT SERVICE (incl. WC interest)';
  PnL.getCell(`A${pr2}`).font = FONT.bold;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    const result = pyVal(y, 'termLoanInterest') + pyVal(y, 'termLoanPrincipal') + pyVal(y, 'wcInterestExpense');
    c.value = { formula: `=${col(2 + i)}${mainDsRow}+${col(2 + i)}${wcRow}`, result };
    c.numFmt = FMT.euro;
    c.fill = STYLE.totalFill;
    c.font = FONT.bold;
    c.border = { top: { style: 'thin' } };
  });
  pr2 += 1;

  // Taxes (CIT + VAT, simplified to engine values)
  const taxesRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'Taxes (CIT + VAT, from engine)';
  years.forEach((y, i) => {
    const e = py(y);
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = e ? e.citPayable + e.vatPayable : 0;
    c.numFmt = FMT.euro;
    c.fill = STYLE.inputFill;
  });
  pr2 += 1;

  // NCF = EBITDA − main DS − WC interest (Finding A: WC excluded from EBITDA, deducted here) + taxes
  // Taxes (CIT + VAT) are stored negative in the engine; adding them reduces NCF correctly.
  const ncfRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'Net cash flow (post-tax, post-DS)';
  PnL.getCell(`A${pr2}`).font = FONT.bold;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = { formula: `=${col(2 + i)}${ebitdaRow}-${col(2 + i)}${mainDsRow}-${col(2 + i)}${wcRow}+${col(2 + i)}${taxesRow}`, result: pyVal(y, 'netCashFlowPostVAT') };
    c.numFmt = FMT.euro;
    c.fill = STYLE.totalFill;
    c.font = FONT.bold;
    c.border = { top: { style: 'medium' } };
  });
  pr2 += 1;

  // CFADS — unlevered free cash flow = EBITDA − CIT (VAT excluded per engine
  // convention: VAT is a balance-sheet pass-through, not a project cash cost).
  // Written as hardcoded engine values (no Excel formula) to keep the
  // Coverage-sheet IRR CF-stream exactly aligned with computeIRR() output.
  // Rebuilding this as a live formula would require a standalone CIT-only row
  // (the combined taxesRow above = CIT+VAT); that restructuring is deferred.
  const cfadsRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'CFADS — Cash flow avail. for debt service (EBITDA − CIT, engine value)';
  PnL.getCell(`A${pr2}`).font = FONT.italic;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = pyVal(y, 'cfads');
    c.numFmt = FMT.euro;
    c.fill = STYLE.inputFill; // blue: engine value, not a live formula
  });
  pr2 += 2;

  // ── Extended bank rows (match app /admin/pnl full detail) ──────────

  // Term loan closing balance
  const termBalRow = pr2;
  PnL.getCell(`A${pr2}`).value = '  Term-loan closing balance';
  PnL.getCell(`A${pr2}`).font = FONT.italic;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = pyVal(y, 'termLoanBalance');
    c.numFmt = FMT.euro;
    c.fill = STYLE.formulaFill;
  });
  pr2 += 1;
  void termBalRow;

  // Pre-tax NCF (EBITDA − main loan DS, before tax)
  const ncfPreTaxRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'NCF pre-tax (EBITDA − debt service)';
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = pyVal(y, 'netCashFlow');
    c.numFmt = FMT.euro;
    c.fill = STYLE.formulaFill;
  });
  pr2 += 1;

  // VAT payable (shown negative — cash outflow)
  const vatRow = pr2;
  PnL.getCell(`A${pr2}`).value = '  VAT payable';
  PnL.getCell(`A${pr2}`).font = FONT.italic;
  years.forEach((y, i) => {
    const e = py(y);
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = e ? -e.vatPayable : 0;
    c.numFmt = FMT.euro;
    c.fill = STYLE.formulaFill;
  });
  pr2 += 1;
  void vatRow;

  // CIT payable (shown negative)
  const citRow = pr2;
  PnL.getCell(`A${pr2}`).value = '  Corporate income tax (CIT)';
  PnL.getCell(`A${pr2}`).font = FONT.italic;
  years.forEach((y, i) => {
    const e = py(y);
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = e ? -e.citPayable : 0;
    c.numFmt = FMT.euro;
    c.fill = STYLE.formulaFill;
  });
  pr2 += 1;
  void citRow;

  // Profit after tax
  const patRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'Profit after tax';
  PnL.getCell(`A${pr2}`).font = FONT.bold;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = pyVal(y, 'profitAfterTax');
    c.numFmt = FMT.euro;
    c.fill = STYLE.totalFill;
    c.font = FONT.bold;
  });
  pr2 += 1;
  void patRow;

  // NCF post-VAT (= NCF after CIT + VAT — this is the distributable amount)
  PnL.getCell(`A${pr2}`).value = 'NCF post-VAT (distributable)';
  PnL.getCell(`A${pr2}`).font = FONT.bold;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    // Formula: pre-tax NCF − VAT − CIT (both stored negative above, so add)
    c.value = { formula: `=${col(2 + i)}${ncfPreTaxRow}+${col(2 + i)}${taxesRow}`, result: pyVal(y, 'netCashFlowPostVAT') };
    c.numFmt = FMT.euro;
    c.fill = STYLE.totalFill;
    c.font = FONT.bold;
  });
  pr2 += 2;

  // ── Coverage ratios ──────────────────────────────────────────────────
  PnL.getCell(`A${pr2}`).value = 'Coverage ratios';
  PnL.getCell(`A${pr2}`).font = FONT.section;
  pr2 += 1;

  // DSCR realistic — formula-driven (EBITDA / main DS)
  const dscrRealisticRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'DSCR — Conservative (EBITDA / main-loan DS)';
  PnL.getCell(`A${pr2}`).font = FONT.bold;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    const e = py(y);
    const ds = e ? e.termLoanInterest + e.termLoanPrincipal : 0;
    const result = ds > 0 ? (e?.ebitda ?? 0) / ds : 0;
    c.value = { formula: `=IFERROR(${col(2 + i)}${ebitdaRow}/${col(2 + i)}${mainDsRow},0)`, result };
    c.numFmt = FMT.mul;
    c.fill = STYLE.totalFill;
    c.font = FONT.bold;
  });
  pr2 += 1;

  // DSCR upside — engine values (upside scenario uses different ADR/occupancy)
  PnL.getCell(`A${pr2}`).value = '  DSCR — Realistic';
  PnL.getCell(`A${pr2}`).font = FONT.italic;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    const e = m.scenarios.upside.pnl.find((p) => p.year === y);
    c.value = e?.dscr ?? 0;
    c.numFmt = FMT.mul;
    c.fill = STYLE.formulaFill;
  });
  pr2 += 1;

  // DSCR downside — engine values
  PnL.getCell(`A${pr2}`).value = '  DSCR — Downside';
  PnL.getCell(`A${pr2}`).font = FONT.italic;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    const e = m.scenarios.downside.pnl.find((p) => p.year === y);
    c.value = e?.dscr ?? 0;
    c.numFmt = FMT.mul;
    c.fill = STYLE.formulaFill;
  });
  pr2 += 1;

  // DSCR loaded (EBITDA / total DS incl. WC interest)
  PnL.getCell(`A${pr2}`).value = '  DSCR loaded (incl. WC interest)';
  PnL.getCell(`A${pr2}`).font = FONT.italic;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = pyVal(y, 'dscrLoaded');
    c.numFmt = FMT.mul;
    c.fill = STYLE.formulaFill;
  });
  pr2 += 1;

  // ICR (interest coverage ratio)
  PnL.getCell(`A${pr2}`).value = '  ICR (EBITDA / interest only)';
  PnL.getCell(`A${pr2}`).font = FONT.italic;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = pyVal(y, 'interestCoverageRatio');
    c.numFmt = FMT.mul;
    c.fill = STYLE.formulaFill;
  });
  pr2 += 2;

  // ── Working capital detail ───────────────────────────────────────────
  PnL.getCell(`A${pr2}`).value = 'Working capital (annual aggregates)';
  PnL.getCell(`A${pr2}`).font = FONT.section;
  pr2 += 1;

  const wcDetailRows: Array<{ label: string; key: keyof typeof scenario.pnl[number] }> = [
    { label: 'WC average balance', key: 'wcAvgBalance' },
    { label: 'WC peak balance', key: 'wcPeakBalance' },
    { label: 'WC net contribution (drawn − repaid)', key: 'wcNetContribution' },
  ];
  wcDetailRows.forEach(({ label, key }) => {
    PnL.getCell(`A${pr2}`).value = `  ${label}`;
    years.forEach((y, i) => {
      const c = PnL.getCell(`${col(2 + i)}${pr2}`);
      c.value = pyVal(y, key as keyof typeof scenario.pnl[number]);
      c.numFmt = FMT.euro;
      c.fill = STYLE.formulaFill;
    });
    pr2 += 1;
  });

  PnL.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];

  // ── 6. Debt Service ─────────────────────────────────────────────────
  // All four financing paths shown side-by-side. Active path column is bold/gold.
  const D = wb.addWorksheet(XL.sh_debtService);
  applyRTL(D);
  D.columns = [{ width: 36 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 30 }];
  D.getCell('A1').value = 'Debt Service — All Financing Paths';
  D.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8B6914' } };
  D.getCell('A2').value =
    `Active path: ${pathLabel(path)}. All four paths use the same CAPEX; each has its own coverage rate, ` +
    `interest structure, and repayment term. RRF is a blended 80/20 tranche. Grant deducts the ` +
    `Development Law subsidy before sizing the bank loan.`;
  D.getCell('A2').font = FONT.italic;
  D.getCell('A2').alignment = { wrapText: true, vertical: 'top' };
  D.mergeCells('A2:F2');
  D.getRow(2).height = 36;

  const dsPaths: Array<{ key: 'commercial' | 'rrf' | 'grant' | 'tepix-loan'; label: string; sc: typeof m.scenarios.realistic }> = [
    { key: 'commercial', label: 'Commercial', sc: m.commercialScenario },
    { key: 'rrf',        label: 'RRF Blended', sc: m.rrfScenario },
    { key: 'grant',      label: 'Grant',       sc: m.grantScenario },
    { key: 'tepix-loan', label: 'TEPIX Loan',  sc: m.tepixLoanScenario },
  ];

  let dr = 4;
  // Header row
  D.getCell(`A${dr}`).value = XL.lbl_metric;
  D.getCell(`A${dr}`).font = FONT.header;
  D.getCell(`A${dr}`).fill = STYLE.headerFill;
  dsPaths.forEach((p, i) => {
    const c = D.getCell(`${col(2 + i)}${dr}`);
    c.value = p.key === path ? `${p.label} (ACTIVE)` : p.label;
    c.font = FONT.header;
    c.fill = STYLE.headerFill;
    c.alignment = { horizontal: 'center' };
  });
  D.getCell(`F${dr}`).value = 'Notes';
  D.getCell(`F${dr}`).font = FONT.header;
  D.getCell(`F${dr}`).fill = STYLE.headerFill;
  dr += 1;

  // Helper: write one DS metric row
  const writeDsRow = (
    label: string,
    pick: (sc: typeof m.scenarios.realistic) => number | string,
    fmt: string,
    note: string,
    bold = false,
  ) => {
    const lc = D.getCell(`A${dr}`);
    lc.value = label;
    if (bold) lc.font = FONT.bold;
    dsPaths.forEach((p, i) => {
      const c = D.getCell(`${col(2 + i)}${dr}`);
      const v = pick(p.sc);
      c.value = v;
      if (typeof v === 'number') c.numFmt = fmt;
      else c.alignment = { horizontal: 'center' };
      c.fill = p.key === path ? STYLE.totalFill : STYLE.formulaFill;
      if (bold && p.key === path) c.font = FONT.bold;
    });
    D.getCell(`F${dr}`).value = note;
    D.getCell(`F${dr}`).font = FONT.italic;
    dr += 1;
  };

  writeDsRow('Total CAPEX', () => m.capex.portfolioTotal, FMT.euro, 'Same for all paths — from CAPEX sheet');
  writeDsRow('Loan amount', (sc) => sc.pnl[0]?.termLoanBalance ?? 0, FMT.euro, 'Opening balance = loan drawn at start', true);
  writeDsRow('Grant received', (sc) => {
    const fc = m.financingComparison.find((r) => r.key === 'grantReceived');
    if (!fc) return 0;
    // Map sc back to a path key
    const pk = dsPaths.find((p) => p.sc === sc)?.key;
    return pk === 'grant' ? (fc.grant as number) : 0;
  }, FMT.euro, 'Development Law Grant (grant path only)');
  writeDsRow('Equity required', (sc) => {
    const fc = m.financingComparison.find((r) => r.key === 'equityRequired');
    if (!fc) return 0;
    const pk = dsPaths.find((p) => p.sc === sc)?.key;
    if (!pk) return 0;
    const v = (fc as unknown as Record<string, number>)[pk === 'tepix-loan' ? 'tepixLoan' : pk];
    return typeof v === 'number' ? v : 0;
  }, FMT.euro, 'CAPEX − loan − grant');
  writeDsRow('Annual debt service', (sc) => {
    const fc = m.financingComparison.find((r) => r.key === 'annualDebtService');
    if (!fc) return 0;
    const pk = dsPaths.find((p) => p.sc === sc)?.key;
    if (!pk) return 0;
    const v = (fc as unknown as Record<string, number>)[pk === 'tepix-loan' ? 'tepixLoan' : pk];
    return typeof v === 'number' ? v : 0;
  }, FMT.euro, 'Annual PMT (fully-amortising, post-grace)', true);
  writeDsRow('Stabilised DSCR (2032)', (sc) => sc.stabilisedYear?.dscr ?? 0, FMT.mul, 'EBITDA / annual DS — post-ramp steady state', true);
  writeDsRow('Min DSCR (loan life)', (sc) => sc.minDSCRLoanLife, FMT.mul, 'Worst single year, post-ramp');

  // Year-by-year amortisation section — active path only (full table; other paths: opening/closing only)
  dr += 1;
  D.getCell(`A${dr}`).value = `Amortisation schedule — Active path (${pathLabel(path)})`;
  D.getCell(`A${dr}`).font = FONT.section;
  D.getCell(`A${dr}`).fill = STYLE.sectionFill;
  D.mergeCells(`A${dr}:F${dr}`);
  dr += 1;
  D.getCell(`A${dr}`).value = 'See the Amortisation Schedule sheet for the full year-by-year active-path table.';
  D.getCell(`A${dr}`).font = FONT.italic;
  D.mergeCells(`A${dr}:F${dr}`);

  // Also keep the legacy single-column formula block for the active commercial path
  // so the Amortisation Schedule sheet's cross-reference to the CAPEX sheet still works.
  if (path === 'commercial') {
    dr += 2;
    D.getCell(`A${dr}`).value = 'Active-path formula block (Commercial)';
    D.getCell(`A${dr}`).font = FONT.bold;
    dr += 1;
    D.getCell(`A${dr}`).value = 'Total CAPEX (formula link)';
    D.getCell(`B${dr}`).value = { formula: `=${capexTotalCell}` };
    D.getCell(`B${dr}`).numFmt = FMT.euro;
    D.getCell(`B${dr}`).fill = STYLE.formulaFill;
    dr += 1;
    D.getCell(`A${dr}`).value = 'Loan amount (CAPEX × coverage)';
    D.getCell(`B${dr}`).value = { formula: `=B${dr - 1}*loanCoverage` };
    D.getCell(`B${dr}`).numFmt = FMT.euro;
    D.getCell(`B${dr}`).fill = STYLE.totalFill;
    D.getCell(`B${dr}`).font = FONT.bold;
    dr += 1;
    D.getCell(`A${dr}`).value = 'Annual PMT (formula)';
    D.getCell(`B${dr}`).value = { formula: `=-PMT(loanRate,repaymentTerm,B${dr - 1})` };
    D.getCell(`B${dr}`).numFmt = FMT.euro;
    D.getCell(`B${dr}`).fill = STYLE.totalFill;
    D.getCell(`B${dr}`).font = FONT.bold;
  }

  // ── 7. Coverage ─────────────────────────────────────────────────────
  const Cov = wb.addWorksheet(XL.sh_coverage);
  applyRTL(Cov);
  Cov.columns = [{ width: 36 }, ...years.map(() => ({ width: 14 }))];
  Cov.getCell('A1').value = 'Coverage Ratios & Returns';
  Cov.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8B6914' } };
  let xr = 3;
  Cov.getCell(`A${xr}`).value = XL.lbl_year;
  Cov.getCell(`A${xr}`).font = FONT.header;
  Cov.getCell(`A${xr}`).fill = STYLE.headerFill;
  years.forEach((y, i) => {
    const c = Cov.getCell(`${col(2 + i)}${xr}`);
    c.value = y;
    c.font = FONT.header;
    c.fill = STYLE.headerFill;
    c.alignment = { horizontal: 'center' };
  });
  xr += 1;

  Cov.getCell(`A${xr}`).value = 'EBITDA (pre-OpCo fees)';
  years.forEach((y, i) => {
    const c = Cov.getCell(`${col(2 + i)}${xr}`);
    c.value = { formula: `='${XL.sh_opexPnl}'!${col(2 + i)}${revRowOnPnL}-'${XL.sh_opexPnl}'!${col(2 + i)}${totalOpexRow}`, result: pyVal(y, 'ebitdaPreOpCo') };
    c.numFmt = FMT.euro;
    c.fill = STYLE.formulaFill;
  });
  const covEbitdaRow = xr;
  xr += 1;

  Cov.getCell(`A${xr}`).value = 'Main-loan debt service';
  years.forEach((y, i) => {
    const c = Cov.getCell(`${col(2 + i)}${xr}`);
    c.value = { formula: `='${XL.sh_opexPnl}'!${col(2 + i)}${mainDsRow}`, result: pyVal(y, 'termLoanInterest') + pyVal(y, 'termLoanPrincipal') };
    c.numFmt = FMT.euro;
    c.fill = STYLE.formulaFill;
  });
  const covMainDsRow = xr;
  xr += 1;

  Cov.getCell(`A${xr}`).value = 'Working-capital interest';
  years.forEach((y, i) => {
    const c = Cov.getCell(`${col(2 + i)}${xr}`);
    c.value = { formula: `='${XL.sh_opexPnl}'!${col(2 + i)}${wcRow}`, result: pyVal(y, 'wcInterestExpense') };
    c.numFmt = FMT.euro;
    c.fill = STYLE.formulaFill;
  });
  const covWcRow = xr;
  xr += 1;

  Cov.getCell(`A${xr}`).value = 'Total debt service';
  Cov.getCell(`A${xr}`).font = FONT.italic;
  years.forEach((y, i) => {
    const c = Cov.getCell(`${col(2 + i)}${xr}`);
    const result = pyVal(y, 'termLoanInterest') + pyVal(y, 'termLoanPrincipal') + pyVal(y, 'wcInterestExpense');
    c.value = { formula: `=${col(2 + i)}${covMainDsRow}+${col(2 + i)}${covWcRow}`, result };
    c.numFmt = FMT.euro;
    c.fill = STYLE.formulaFill;
  });
  const covTotalDsRow = xr;
  xr += 1;

  // DSCR — computed against TOTAL debt service (main + WC). Engine's headline
  // `dscr` is EBITDA / main-loan-DS only; engine's `dscrLoaded` adds WC. We
  // expose the loaded version here since it's what a covenant test actually
  // looks at when WC is in the picture.
  Cov.getCell(`A${xr}`).value = 'DSCR (EBITDA / total debt service)';
  Cov.getCell(`A${xr}`).font = FONT.bold;
  const dscrRowOnCov = xr;
  years.forEach((y, i) => {
    const c = Cov.getCell(`${col(2 + i)}${xr}`);
    const e = py(y);
    const totalDs = e ? e.termLoanInterest + e.termLoanPrincipal + e.wcInterestExpense : 0;
    const dscr = totalDs > 0 ? (e?.ebitdaPreOpCo ?? 0) / totalDs : 0;
    c.value = { formula: `=IFERROR(${col(2 + i)}${covEbitdaRow}/${col(2 + i)}${covTotalDsRow},0)`, result: dscr };
    c.numFmt = FMT.mul;
    c.fill = STYLE.totalFill;
    c.font = FONT.bold;
  });
  xr += 1;

  // ── Issue 3: covenant Pass/Fail row ──
  // Threshold pulled from the Assumptions sheet so a banker can edit it.
  Cov.getCell(`A${xr}`).value = 'Covenant Pass/Fail (vs threshold)';
  Cov.getCell(`A${xr}`).font = FONT.bold;
  years.forEach((y, i) => {
    const c = Cov.getCell(`${col(2 + i)}${xr}`);
    const e = py(y);
    const totalDs = e ? e.termLoanInterest + e.termLoanPrincipal + e.wcInterestExpense : 0;
    const dscr = totalDs > 0 ? (e?.ebitdaPreOpCo ?? 0) / totalDs : 0;
    const operational = (e?.debtService ?? 0) > 0 || (e?.ebitdaPreOpCo ?? 0) > 0;
    const result = !operational ? 'n/a' : dscr >= a.dscrCovenantThreshold ? '✓ PASS' : '✗ FAIL';
    // Excel formula: PASS if DSCR ≥ threshold AND DS > 0; n/a in pre-op years.
    c.value = {
      formula: `=IF(${col(2 + i)}${covTotalDsRow}<=0,"n/a",IF(${col(2 + i)}${dscrRowOnCov}>=dscrCovenantThreshold,"✓ PASS","✗ FAIL"))`,
      result,
    };
    c.alignment = { horizontal: 'center' };
    c.fill = STYLE.totalFill;
    c.font = { bold: true, color: { argb: result === '✗ FAIL' ? 'FFC62828' : result === '✓ PASS' ? 'FF2E7D32' : 'FF888888' } };
  });
  xr += 2;

  // ── Terminal value & remaining debt at exit ──
  Cov.getCell(`A${xr}`).value = 'Terminal value & exit debt';
  Cov.getCell(`A${xr}`).font = FONT.section;
  xr += 1;

  Cov.getCell(`A${xr}`).value = '  Stabilised EBITDA (2032)';
  const stabEbitdaRow = xr;
  const stabEbitdaVal = pyVal(2032, 'ebitda');
  Cov.getCell(`B${xr}`).value = { formula: `='${XL.sh_opexPnl}'!${col(2 + (2032 - 2026))}${ebitdaRow}`, result: stabEbitdaVal };
  Cov.getCell(`B${xr}`).numFmt = FMT.euro;
  Cov.getCell(`B${xr}`).fill = STYLE.formulaFill;
  xr += 1;
  Cov.getCell(`A${xr}`).value = '  Exit EBITDA multiple';
  const exitMultRow = xr;
  Cov.getCell(`B${xr}`).value = { formula: '=exitMultiple', result: a.exitEbitdaMultiple };
  Cov.getCell(`B${xr}`).numFmt = FMT.mul;
  Cov.getCell(`B${xr}`).fill = STYLE.formulaFill;
  xr += 1;
  Cov.getCell(`A${xr}`).value = '  Terminal asset value (Exit EBITDA × Multiple)';
  Cov.getCell(`A${xr}`).font = FONT.bold;
  const terminalRow = xr;
  const terminalVal = stabEbitdaVal * a.exitEbitdaMultiple;
  Cov.getCell(`B${xr}`).value = { formula: `=B${stabEbitdaRow}*B${exitMultRow}`, result: terminalVal };
  Cov.getCell(`B${xr}`).numFmt = FMT.euro;
  Cov.getCell(`B${xr}`).fill = STYLE.totalFill;
  Cov.getCell(`B${xr}`).font = FONT.bold;
  xr += 1;

  // Remaining debt balance at exit (2036) — taken from engine amort schedule.
  // The engine writes termLoanBalance per year on AnnualPnL.
  const exitYear = years[years.length - 1];
  const remainingDebtAtExit = pyVal(exitYear, 'termLoanBalance');
  Cov.getCell(`A${xr}`).value = `  Remaining debt balance at exit (${exitYear})`;
  const remainingDebtRow = xr;
  Cov.getCell(`B${xr}`).value = remainingDebtAtExit;
  Cov.getCell(`B${xr}`).numFmt = FMT.euro;
  Cov.getCell(`B${xr}`).fill = STYLE.inputFill;
  xr += 1;

  Cov.getCell(`A${xr}`).value = '  Terminal equity value (asset value − debt)';
  Cov.getCell(`A${xr}`).font = FONT.bold;
  const terminalEquityRow = xr;
  const terminalEquityVal = Math.max(0, terminalVal - remainingDebtAtExit);
  Cov.getCell(`B${xr}`).value = { formula: `=MAX(0,B${terminalRow}-B${remainingDebtRow})`, result: terminalEquityVal };
  Cov.getCell(`B${xr}`).numFmt = FMT.euro;
  Cov.getCell(`B${xr}`).fill = STYLE.totalFill;
  Cov.getCell(`B${xr}`).font = FONT.bold;
  xr += 2;

  // ── Coverage: compact financing & covenant summary ─────────────────────
  // Single-value cells for key parameters that don't have year-columns.
  // All views (bank + internal). Referenced by the validation table.
  Cov.getCell(`A${xr}`).value = 'Key financing & covenant parameters';
  Cov.getCell(`A${xr}`).font = FONT.section;
  Cov.getCell(`A${xr}`).fill = STYLE.sectionFill;
  xr += 1;

  const covLoanRow = xr;
  Cov.getCell(`A${xr}`).value = 'Total loan drawn';
  Cov.getCell(`B${xr}`).value = { formula: `=${capexTotalCell}*loanCoverage`, result: m.keyMetrics.loanAmount };
  Cov.getCell(`B${xr}`).numFmt = FMT.euro;
  Cov.getCell(`B${xr}`).fill = STYLE.formulaFill;
  Cov.getCell(`B${xr}`).font = FONT.bold;
  xr += 1;

  const covEquityRow = xr;
  Cov.getCell(`A${xr}`).value = 'Structural equity at close';
  Cov.getCell(`B${xr}`).value = { formula: `=${capexTotalCell}*(1-loanCoverage)`, result: m.keyMetrics.equityRequired };
  Cov.getCell(`B${xr}`).numFmt = FMT.euro;
  Cov.getCell(`B${xr}`).fill = STYLE.formulaFill;
  Cov.getCell(`B${xr}`).font = FONT.bold;
  xr += 1;

  const covMinDscrRow = xr;
  Cov.getCell(`A${xr}`).value = 'Min DSCR — loan life (worst operational year)';
  Cov.getCell(`B${xr}`).value = m.scenarios.realistic.minDSCRLoanLife;
  Cov.getCell(`B${xr}`).numFmt = FMT.mul;
  Cov.getCell(`B${xr}`).fill = STYLE.totalFill;
  Cov.getCell(`B${xr}`).font = FONT.bold;
  xr += 2; // blank before IRR waterfall

  // Investor-only compact cells — declared here, assigned inside !isBankViewExport block.
  let covGraceInterestRow = 0;
  let covLLCRRow = 0;
  let covTerminalValRow = 0;

  let unlevIRRResult = 0, unlevIrrCellRef = '';
  let levIRRResult = 0, levIrrCellRef = '';
  let moicResult = 0, moicCellRef = '';

  if (!isBankViewExport) {
  // ─────────────────────────────────────────────────────────────────────
  // Issue 1a — UNLEVERED PROJECT IRR (pre-financing)
  //   Year 0: -Total CapEx
  //   Operating years: EBITDA − Taxes (NO debt service)
  //   Terminal year: + Terminal asset value
  // ─────────────────────────────────────────────────────────────────────
  Cov.getCell(`A${xr}`).value = 'Unlevered Project IRR (pre-financing)';
  Cov.getCell(`A${xr}`).font = FONT.section;
  xr += 1;
  Cov.getCell(`A${xr}`).value = '  Year 0 — Total CapEx (outflow)';
  Cov.getCell(`B${xr}`).value = { formula: `=-${capexTotalCell}`, result: -m.capex.portfolioTotal };
  Cov.getCell(`B${xr}`).numFmt = FMT.euro;
  Cov.getCell(`B${xr}`).fill = STYLE.formulaFill;
  const unlevStartRow = xr;
  xr += 1;
  years.forEach((y, i) => {
    Cov.getCell(`A${xr}`).value = `  ${y} — EBITDA − Taxes`;
    const cfadsRef = `'${XL.sh_opexPnl}'!${col(2 + i)}${cfadsRow}`;
    const isLast = i === years.length - 1;
    const formula = isLast ? `=${cfadsRef}+B${terminalRow}` : `=${cfadsRef}`;
    const cfadsVal = pyVal(y, 'cfads');
    const result = isLast ? cfadsVal + terminalVal : cfadsVal;
    Cov.getCell(`B${xr}`).value = { formula, result };
    Cov.getCell(`B${xr}`).numFmt = FMT.euro;
    Cov.getCell(`B${xr}`).fill = STYLE.formulaFill;
    xr += 1;
  });
  const unlevEndRow = xr - 1;
  Cov.getCell(`A${xr}`).value = 'Unlevered Project IRR (incl. terminal asset value)';
  Cov.getCell(`A${xr}`).font = FONT.bold;
  const unlevCfStream: number[] = [-m.capex.portfolioTotal];
  years.forEach((y, i) => {
    const cfads = pyVal(y, 'cfads');
    unlevCfStream.push(i === years.length - 1 ? cfads + terminalVal : cfads);
  });
  unlevIRRResult = computeIRR(unlevCfStream);
  Cov.getCell(`B${xr}`).value = { formula: `=IRR(B${unlevStartRow}:B${unlevEndRow})`, result: unlevIRRResult };
  Cov.getCell(`B${xr}`).numFmt = FMT.pct;
  Cov.getCell(`B${xr}`).fill = STYLE.totalFill;
  Cov.getCell(`B${xr}`).font = FONT.bold;
  unlevIrrCellRef = `${XL.sh_coverage}!B${xr}`;
  xr += 2;

  // ─────────────────────────────────────────────────────────────────────
  // Issue 1b — LEVERED EQUITY IRR (to equity investor)
  //   Year 0: -Equity (= TotalCapEx × (1 − loanCoverage))
  //   Operating years: NCF post-tax post-DS (already net of debt service)
  //   Terminal year: + (Terminal asset value − Remaining debt at exit)
  // ─────────────────────────────────────────────────────────────────────
  Cov.getCell(`A${xr}`).value = 'Levered Equity IRR (to equity investor)';
  Cov.getCell(`A${xr}`).font = FONT.section;
  xr += 1;

  const equityRequired = m.keyMetrics.equityRequired;
  Cov.getCell(`A${xr}`).value = '  Year 0 — Equity (outflow)';
  // Equity = totalCapex × (1 − loanCoverage) for commercial path; for other
  // paths the engine handles the equity calc via debtResult.equityRequired
  // and we mirror the value here.
  if (path === 'commercial') {
    Cov.getCell(`B${xr}`).value = { formula: `=-${capexTotalCell}*(1-loanCoverage)`, result: -equityRequired };
  } else {
    Cov.getCell(`B${xr}`).value = -equityRequired;
  }
  Cov.getCell(`B${xr}`).numFmt = FMT.euro;
  Cov.getCell(`B${xr}`).fill = STYLE.formulaFill;
  const levStartRow = xr;
  xr += 1;

  years.forEach((y, i) => {
    Cov.getCell(`A${xr}`).value = `  ${y} — NCF post-tax post-DS`;
    const ncfRef = `'${XL.sh_opexPnl}'!${col(2 + i)}${ncfRow}`;
    const isLast = i === years.length - 1;
    const formula = isLast ? `=${ncfRef}+B${terminalEquityRow}` : `=${ncfRef}`;
    const ncfVal = pyVal(y, 'netCashFlowPostVAT');
    const result = isLast ? ncfVal + terminalEquityVal : ncfVal;
    Cov.getCell(`B${xr}`).value = { formula, result };
    Cov.getCell(`B${xr}`).numFmt = FMT.euro;
    Cov.getCell(`B${xr}`).fill = STYLE.formulaFill;
    xr += 1;
  });
  const levEndRow = xr - 1;
  Cov.getCell(`A${xr}`).value = 'Levered Equity IRR (incl. terminal equity value)';
  Cov.getCell(`A${xr}`).font = FONT.bold;
  const levCfStream: number[] = [-equityRequired];
  years.forEach((y, i) => {
    const ncf = pyVal(y, 'netCashFlowPostVAT');
    levCfStream.push(i === years.length - 1 ? ncf + terminalEquityVal : ncf);
  });
  levIRRResult = computeIRR(levCfStream);
  Cov.getCell(`B${xr}`).value = { formula: `=IRR(B${levStartRow}:B${levEndRow})`, result: levIRRResult };
  Cov.getCell(`B${xr}`).numFmt = FMT.pct;
  Cov.getCell(`B${xr}`).fill = STYLE.totalFill;
  Cov.getCell(`B${xr}`).font = FONT.bold;
  levIrrCellRef = `${XL.sh_coverage}!B${xr}`;
  xr += 2;

  // ─────────────────────────────────────────────────────────────────────
  // Additional equity-investor metrics (spec's "Additional…" block)
  //   MOIC               = Σ equity distributions / equity invested
  //   Cash-on-cash yield = NCF / equity invested, per year
  //   Equity payback     = first year cumulative distributions ≥ equity
  // ─────────────────────────────────────────────────────────────────────
  Cov.getCell(`A${xr}`).value = 'Equity investor metrics';
  Cov.getCell(`A${xr}`).font = FONT.section;
  xr += 1;

  // Sum of NCF stream (treat positive NCFs as distributions to equity).
  Cov.getCell(`A${xr}`).value = '  Σ equity distributions (operating years)';
  const sumDistribRow = xr;
  const ncfSum = years.reduce((s, y) => s + Math.max(0, pyVal(y, 'netCashFlowPostVAT')), 0);
  // Formula sum of NCFs (positive only — losses are not distributed).
  const ncfRefs = years.map((_, i) => `MAX(0,'${XL.sh_opexPnl}'!${col(2 + i)}${ncfRow})`).join(',');
  Cov.getCell(`B${xr}`).value = { formula: `=${ncfRefs.includes(',') ? `SUM(${ncfRefs})` : ncfRefs}`, result: ncfSum };
  Cov.getCell(`B${xr}`).numFmt = FMT.euro;
  Cov.getCell(`B${xr}`).fill = STYLE.formulaFill;
  xr += 1;

  Cov.getCell(`A${xr}`).value = '  + Terminal equity value at exit';
  const termEqRefRow = xr;
  Cov.getCell(`B${xr}`).value = { formula: `=B${terminalEquityRow}`, result: terminalEquityVal };
  Cov.getCell(`B${xr}`).numFmt = FMT.euro;
  Cov.getCell(`B${xr}`).fill = STYLE.formulaFill;
  xr += 1;

  Cov.getCell(`A${xr}`).value = '  Equity invested';
  const eqInvestedRow = xr;
  Cov.getCell(`B${xr}`).value = equityRequired;
  Cov.getCell(`B${xr}`).numFmt = FMT.euro;
  Cov.getCell(`B${xr}`).fill = STYLE.inputFill;
  xr += 1;

  Cov.getCell(`A${xr}`).value = 'MOIC (multiple on invested capital)';
  Cov.getCell(`A${xr}`).font = FONT.bold;
  moicResult = equityRequired > 0 ? (ncfSum + terminalEquityVal) / equityRequired : 0;
  moicCellRef = `${XL.sh_coverage}!B${xr}`;
  Cov.getCell(`B${xr}`).value = {
    formula: `=IFERROR((B${sumDistribRow}+B${termEqRefRow})/B${eqInvestedRow},0)`,
    result: moicResult,
  };
  Cov.getCell(`B${xr}`).numFmt = FMT.mul;
  Cov.getCell(`B${xr}`).fill = STYLE.totalFill;
  Cov.getCell(`B${xr}`).font = FONT.bold;
  xr += 2;

  // Year-by-year cash-on-cash yield
  Cov.getCell(`A${xr}`).value = 'Cash-on-cash yield (NCF / equity invested)';
  Cov.getCell(`A${xr}`).font = FONT.bold;
  years.forEach((y, i) => {
    const c = Cov.getCell(`${col(2 + i)}${xr}`);
    const ncf = pyVal(y, 'netCashFlowPostVAT');
    const yield_ = equityRequired > 0 ? ncf / equityRequired : 0;
    c.value = {
      formula: `=IFERROR('${XL.sh_opexPnl}'!${col(2 + i)}${ncfRow}/B${eqInvestedRow},0)`,
      result: yield_,
    };
    c.numFmt = FMT.pct;
    c.fill = STYLE.formulaFill;
  });
  xr += 1;

  // Equity payback year — first year cum distributions ≥ equity invested.
  let cum = 0;
  let paybackYear: number | null = null;
  for (const y of years) {
    cum += Math.max(0, pyVal(y, 'netCashFlowPostVAT'));
    if (paybackYear === null && cum >= equityRequired) {
      paybackYear = y;
      break;
    }
  }
  Cov.getCell(`A${xr}`).value = 'Equity payback year (cum NCF ≥ equity)';
  Cov.getCell(`A${xr}`).font = FONT.bold;
  Cov.getCell(`B${xr}`).value = paybackYear ?? 'beyond projection';
  Cov.getCell(`B${xr}`).fill = STYLE.totalFill;
  Cov.getCell(`B${xr}`).font = FONT.bold;
  Cov.getCell(`B${xr}`).alignment = { horizontal: 'center' };

  // Investor-only compact parameters — added here so Coverage sheet has them
  // for the validation table cross-checks (internal view only).
  xr += 2;
  covGraceInterestRow = xr;
  Cov.getCell(`A${xr}`).value = 'Grace-period interest reserve';
  Cov.getCell(`B${xr}`).value = m.keyMetrics.graceInterestCarry;
  Cov.getCell(`B${xr}`).numFmt = FMT.euro;
  Cov.getCell(`B${xr}`).fill = STYLE.totalFill;
  Cov.getCell(`B${xr}`).font = FONT.bold;
  xr += 1;

  covLLCRRow = xr;
  Cov.getCell(`A${xr}`).value = 'LLCR (Loan Life Coverage Ratio)';
  Cov.getCell(`B${xr}`).value = m.scenarios.realistic.llcr;
  Cov.getCell(`B${xr}`).numFmt = FMT.mul;
  Cov.getCell(`B${xr}`).fill = STYLE.totalFill;
  Cov.getCell(`B${xr}`).font = FONT.bold;
  xr += 1;

  covTerminalValRow = xr;
  Cov.getCell(`A${xr}`).value = 'Terminal asset value';
  Cov.getCell(`B${xr}`).value = m.scenarios.realistic.terminalAssetValue;
  Cov.getCell(`B${xr}`).numFmt = FMT.euro;
  Cov.getCell(`B${xr}`).fill = STYLE.totalFill;
  Cov.getCell(`B${xr}`).font = FONT.bold;
  xr += 1;
  } // end !isBankViewExport — investor metrics


  Cov.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];

  // ── 8. Scenarios (Issue 5) ──────────────────────────────────────────
  // Side-by-side year table for Downside / Realistic / Upside on a single
  // sheet. Reports EBITDA, NCF, DSCR, plus a summary block of stabilised
  // IRR / MOIC / payback per scenario. Values come from the engine's already-
  // computed scenarios (m.scenarios.*), so they validate by construction.
  const S = wb.addWorksheet(XL.sh_scenarios);
  applyRTL(S);
  S.columns = [{ width: 32 }, ...years.map(() => ({ width: 13 })), { width: 16 }];
  S.getCell('A1').value = 'Scenario sensitivity';
  S.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8B6914' } };
  S.getCell('A2').value =
    'Downside: −10% occupancy, −5% ADR, 4 events/yr. Upside: revenue assumptions per BASE_CASE.revenueUpside. ' +
    'All scenarios use the same financing path and CapEx as the active export.';
  S.getCell('A2').font = FONT.italic;
  S.mergeCells(`A2:${col(2 + years.length)}2`);

  let sr = 4;
  const scenarioBlocks: Array<{ key: 'downside' | 'realistic' | 'upside'; label: string }> = [
    { key: 'downside', label: 'Downside' },
    { key: 'realistic', label: 'Conservative' },
    { key: 'upside', label: 'Realistic' },
  ];

  // Per-scenario yearly section
  scenarioBlocks.forEach((sb) => {
    const sc = m.scenarios[sb.key];
    S.getCell(`A${sr}`).value = `${sb.label} — yearly`;
    S.getCell(`A${sr}`).font = FONT.section;
    S.getCell(`A${sr}`).fill = STYLE.sectionFill;
    S.mergeCells(`A${sr}:${col(1 + years.length)}${sr}`);
    sr += 1;

    // Year header row
    S.getCell(`A${sr}`).value = XL.lbl_metric;
    S.getCell(`A${sr}`).font = FONT.header;
    S.getCell(`A${sr}`).fill = STYLE.headerFill;
    years.forEach((y, i) => {
      const c = S.getCell(`${col(2 + i)}${sr}`);
      c.value = y;
      c.font = FONT.header;
      c.fill = STYLE.headerFill;
      c.alignment = { horizontal: 'center' };
    });
    sr += 1;

    const writeMetric = (
      label: string,
      pick: (p: typeof sc.pnl[number]) => number,
      fmt: string,
    ) => {
      S.getCell(`A${sr}`).value = label;
      years.forEach((y, i) => {
        const c = S.getCell(`${col(2 + i)}${sr}`);
        const e = sc.pnl.find((p) => p.year === y);
        c.value = e ? pick(e) : 0;
        c.numFmt = fmt;
        c.fill = STYLE.formulaFill;
      });
      sr += 1;
    };

    writeMetric('Total revenue', (p) => p.totalRevenue, FMT.euro);
    writeMetric('EBITDA', (p) => p.ebitda, FMT.euro);
    writeMetric('Total debt service (main + WC)', (p) => p.termLoanInterest + p.termLoanPrincipal + p.wcInterestExpense, FMT.euro);
    writeMetric('NCF post-tax', (p) => p.netCashFlowPostVAT, FMT.euro);
    writeMetric('DSCR (incl. WC)', (p) => {
      const ds = p.termLoanInterest + p.termLoanPrincipal + p.wcInterestExpense;
      return ds > 0 ? p.ebitda / ds : 0;
    }, FMT.mul);
    sr += 1;
  });

  // Cross-scenario summary block
  S.getCell(`A${sr}`).value = 'Summary — stabilised year (2031) + returns';
  S.getCell(`A${sr}`).font = FONT.section;
  S.getCell(`A${sr}`).fill = STYLE.sectionFill;
  S.mergeCells(`A${sr}:E${sr}`);
  sr += 1;

  const sumHeaders = [XL.lbl_metric, XL.lbl_downside, XL.lbl_realistic, XL.lbl_upside];
  sumHeaders.forEach((h, i) => {
    const c = S.getCell(`${col(1 + i)}${sr}`);
    c.value = h;
    c.font = FONT.header;
    c.fill = STYLE.headerFill;
  });
  sr += 1;

  const summaryRows: Array<{
    label: string;
    pick: (sc: ModelOutput['scenarios']['realistic']) => number;
    fmt: string;
  }> = [
    { label: 'Stabilised EBITDA (2032)', pick: (sc) => sc.stabilisedYear?.ebitda ?? 0, fmt: FMT.euro },
    {
      label: 'Stabilised total DS (incl. WC)',
      pick: (sc) => {
        const sy = sc.stabilisedYear;
        return sy ? sy.termLoanInterest + sy.termLoanPrincipal + sy.wcInterestExpense : 0;
      },
      fmt: FMT.euro,
    },
    {
      label: 'Stabilised DSCR (incl. WC)',
      pick: (sc) => {
        const sy = sc.stabilisedYear;
        if (!sy) return 0;
        const ds = sy.termLoanInterest + sy.termLoanPrincipal + sy.wcInterestExpense;
        return ds > 0 ? sy.ebitda / ds : 0;
      },
      fmt: FMT.mul,
    },
    { label: 'Stabilised NCF post-tax', pick: (sc) => sc.stabilisedYear?.netCashFlowPostVAT ?? 0, fmt: FMT.euro },
    { label: 'Min DSCR (post-ramp)', pick: (sc) => sc.minDSCRLoanLife, fmt: FMT.mul },
    ...(!isBankViewExport ? [
      { label: 'Equity IRR (levered, incl. terminal)', pick: (sc: ModelOutput['scenarios']['realistic']) => sc.equityIRR, fmt: FMT.pct },
      { label: 'Project IRR (unlevered, incl. terminal)', pick: (sc: ModelOutput['scenarios']['realistic']) => sc.projectIRR, fmt: FMT.pct },
      { label: 'Stabilised cash-on-cash yield', pick: (sc: ModelOutput['scenarios']['realistic']) => sc.yieldStabilised, fmt: FMT.pct },
      {
        label: 'Equity payback (years from 2026)',
        pick: (sc: ModelOutput['scenarios']['realistic']) => sc.equityPaybackYears ?? 0,
        fmt: FMT.num,
      },
      { label: 'Cumulative yield through 2036', pick: (sc: ModelOutput['scenarios']['realistic']) => sc.cumulativeYieldFinal, fmt: FMT.pct },
    ] : []),
  ];

  summaryRows.forEach((row) => {
    S.getCell(`A${sr}`).value = row.label;
    (['downside', 'realistic', 'upside'] as const).forEach((key, i) => {
      const c = S.getCell(`${col(2 + i)}${sr}`);
      c.value = row.pick(m.scenarios[key]);
      c.numFmt = row.fmt;
      c.fill = STYLE.formulaFill;
    });
    sr += 1;
  });

  S.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];

  // ── 9. Cap Table ────────────────────────────────────────────────────
  // Per-stakeholder distributions, MOIC, IRR, equity payback. Reads from
  // the same engine waterfall module the in-app Cap Table page uses, so
  // numbers reconcile by construction.
  const capScenario = m.scenarios[scenarioName];
  const grantApproved = a.financingPath === 'grant';
  const capResult = computeCapTable(capScenario, capTable, waterfall, { grantApproved });
  const fb = capResult.founderBreakdown;
  // reconcileRow is set inside the Cap Table block below; only read in the
  // validation section when !isBankViewExport.
  let reconcileRow = -1;
  if (!isBankViewExport) {
  const CT = wb.addWorksheet(XL.sh_capTable);
  applyRTL(CT);
  CT.columns = [{ width: 28 }, ...years.map(() => ({ width: 12 })), { width: 13 }, { width: 8 }, { width: 8 }];
  CT.getCell('A1').value = 'Cap Table — distributions per stakeholder';
  CT.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8B6914' } };
  CT.getCell('A2').value =
    `Scenario: ${scenarioName} · Exit ${capScenario.exitYear} @ ${capScenario.exitEbitdaMultiple}× · ` +
    `Founder ${(fb.founderTotalPct * 100).toFixed(1)}% (pp ${(fb.pariPassuPct * 100).toFixed(1)}% + grant ${(fb.grantBonusPct * 100).toFixed(0)}% + ratchet ${(fb.performanceRatchetPct * 100).toFixed(0)}%) · ` +
    `Investors ${(fb.investorTotalPct * 100).toFixed(1)}% · ` +
    `Cap: ${fb.capBinding === 'total_75' ? '75% total binding' : fb.capBinding === 'ratchet_10' ? '10% ratchet cap' : fb.capBinding === 'exit_55_grant' ? '55% grant exit cap (IRR < 30%)' : 'free'}`;
  CT.getCell('A2').font = FONT.italic;
  CT.mergeCells(`A2:${col(2 + years.length + 2)}2`);

  let ctr = 4;
  // Per-stakeholder summary row (one row per stakeholder)
  CT.getCell(`A${ctr}`).value = 'Stakeholder';
  CT.getCell(`A${ctr}`).font = FONT.header;
  CT.getCell(`A${ctr}`).fill = STYLE.headerFill;
  ['Cash in', 'Total received', 'Net profit', XL.lbl_moic, XL.lbl_irr, XL.lbl_payback].forEach((h, i) => {
    const c = CT.getCell(`${col(2 + i)}${ctr}`);
    c.value = h;
    c.font = FONT.header;
    c.fill = STYLE.headerFill;
    c.alignment = { horizontal: 'right' };
  });
  ctr += 1;

  capResult.stakeholders.forEach((sr) => {
    CT.getCell(`A${ctr}`).value = sr.stakeholder.name + (sr.stakeholder.isPromoter ? ' (Founder)' : '');
    if (sr.stakeholder.isPromoter) CT.getCell(`A${ctr}`).font = FONT.bold;
    const row: Array<number | string> = [
      sr.stakeholder.cashIn,
      sr.totalReceived,
      sr.netProfit,
      sr.moic,
      sr.irr,
      sr.paybackYear ?? '—',
    ];
    row.forEach((v, i) => {
      const c = CT.getCell(`${col(2 + i)}${ctr}`);
      c.value = v;
      c.numFmt = i === 0 || i === 1 || i === 2 ? FMT.euro : i === 3 ? FMT.mul : i === 4 ? FMT.pct : FMT.num;
      c.alignment = { horizontal: 'right' };
      c.fill = STYLE.formulaFill;
    });
    ctr += 1;
  });

  // Totals row
  CT.getCell(`A${ctr}`).value = XL.lbl_total;
  CT.getCell(`A${ctr}`).font = FONT.bold;
  const totalCash = capResult.stakeholders.reduce((s, r) => s + r.stakeholder.cashIn, 0);
  const totalReceived = capResult.totalDistributed;
  const totalProfit = totalReceived - totalCash;
  const aggMoic = totalCash > 0 ? totalReceived / totalCash : 0;
  [totalCash, totalReceived, totalProfit, aggMoic, '', ''].forEach((v, i) => {
    const c = CT.getCell(`${col(2 + i)}${ctr}`);
    c.value = v;
    c.numFmt = i <= 2 ? FMT.euro : i === 3 ? FMT.mul : FMT.num;
    c.fill = STYLE.totalFill;
    c.font = FONT.bold;
    c.alignment = { horizontal: 'right' };
  });
  ctr += 2;

  // Reconciliation row — total stakeholder distributions vs project distributable.
  CT.getCell(`A${ctr}`).value = 'Reconciliation';
  CT.getCell(`A${ctr}`).font = FONT.section;
  CT.getCell(`A${ctr}`).fill = STYLE.sectionFill;
  CT.mergeCells(`A${ctr}:${col(7)}${ctr}`);
  ctr += 1;
  reconcileRow = ctr;
  CT.getCell(`A${ctr}`).value = 'Project distributable (Σ NCF + terminal equity)';
  CT.getCell(`B${ctr}`).value = capResult.totalProjectDistributable;
  CT.getCell(`B${ctr}`).numFmt = FMT.euro;
  CT.getCell(`B${ctr}`).fill = STYLE.formulaFill;
  ctr += 1;
  CT.getCell(`A${ctr}`).value = 'Stakeholder distributions (sum of "Total received")';
  CT.getCell(`B${ctr}`).value = capResult.totalDistributed;
  CT.getCell(`B${ctr}`).numFmt = FMT.euro;
  CT.getCell(`B${ctr}`).fill = STYLE.formulaFill;
  ctr += 1;
  CT.getCell(`A${ctr}`).value = 'Reconciliation diff (should be ≈ 0)';
  CT.getCell(`A${ctr}`).font = FONT.bold;
  CT.getCell(`B${ctr}`).value = capResult.reconciliationError;
  CT.getCell(`B${ctr}`).numFmt = FMT.euro;
  CT.getCell(`B${ctr}`).fill = STYLE.totalFill;
  CT.getCell(`B${ctr}`).font = {
    bold: true,
    color: { argb: Math.abs(capResult.reconciliationError) < 1 ? 'FF2E7D32' : 'FFC62828' },
  };
  ctr += 2;

  // Year-by-year per-stakeholder table
  CT.getCell(`A${ctr}`).value = 'Year-by-year cash flows per stakeholder';
  CT.getCell(`A${ctr}`).font = FONT.section;
  CT.getCell(`A${ctr}`).fill = STYLE.sectionFill;
  CT.mergeCells(`A${ctr}:${col(2 + years.length)}${ctr}`);
  ctr += 1;
  CT.getCell(`A${ctr}`).value = 'Stakeholder';
  CT.getCell(`A${ctr}`).font = FONT.header;
  CT.getCell(`A${ctr}`).fill = STYLE.headerFill;
  years.forEach((y, i) => {
    const c = CT.getCell(`${col(2 + i)}${ctr}`);
    c.value = y;
    c.font = FONT.header;
    c.fill = STYLE.headerFill;
    c.alignment = { horizontal: 'right' };
  });
  ctr += 1;

  capResult.stakeholders.forEach((sr) => {
    CT.getCell(`A${ctr}`).value = sr.stakeholder.name;
    if (sr.stakeholder.isPromoter) CT.getCell(`A${ctr}`).font = FONT.bold;
    years.forEach((y, i) => {
      const yEntry = sr.yearly.find((yy) => yy.year === y);
      const c = CT.getCell(`${col(2 + i)}${ctr}`);
      c.value = yEntry?.totalCashFlow ?? 0;
      c.numFmt = FMT.euro;
      c.fill = STYLE.formulaFill;
      c.alignment = { horizontal: 'right' };
    });
    ctr += 1;
  });

  CT.views = [{ state: 'frozen', xSplit: 1, ySplit: 4 }];

  // ── 9b. Waterfall (3-layer founder economics + stress test) ────────
  // Shows how founder economics decompose into pari-passu / grant bonus /
  // performance ratchet, plus a stress test at €200K / €300K / €400K founder
  // cash so the bank can see when the 75% total cap binds.
  const WF = wb.addWorksheet(XL.sh_waterfall);
  applyRTL(WF);
  WF.columns = [
    { width: 30 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 },
  ];
  WF.getCell('A1').value = 'Founder Compensation Waterfall — 3-layer model';
  WF.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8B6914' } };
  WF.getCell('A2').value =
    `Scenario: ${scenarioName} · Exit ${capScenario.exitYear} @ ${capScenario.exitEbitdaMultiple}× · ` +
    `${grantApproved ? 'Grant approved (Layer B active)' : 'No grant (Layer B inactive)'}`;
  WF.getCell('A2').font = FONT.italic;
  WF.mergeCells('A2:G2');

  let wfr = 4;
  WF.getCell(`A${wfr}`).value = 'Layered breakdown';
  WF.getCell(`A${wfr}`).font = FONT.section;
  WF.getCell(`A${wfr}`).fill = STYLE.sectionFill;
  WF.mergeCells(`A${wfr}:G${wfr}`);
  wfr += 1;

  const layerRows: Array<{ label: string; pct: number; note: string }> = [
    {
      label: 'Layer A — Pari-passu (cash equity)',
      pct: fb.pariPassuPct,
      note: `€${Math.round(capResult.founderCashInvested / 1000)}K founder ÷ €${Math.round(capResult.totalEquityRaised / 1000)}K total`,
    },
    {
      label: 'Layer B — Grant landing bonus',
      pct: fb.grantBonusPct,
      note: grantApproved ? 'Vests at grant approval (+4%)' : 'Inactive — no grant',
    },
    {
      label: 'Layer C — Performance ratchet',
      pct: fb.performanceRatchetPct,
      note: `Tier: ${fb.ratchetTierLabel}${fb.moicFloorReduction ? ' (MOIC floor reduced)' : ''}`,
    },
    {
      label: 'Earned (B + C — independent caps)',
      pct: fb.earnedPct,
      note: fb.capBinding === 'ratchet_10' ? '10% ratchet cap reached' : 'Within ratchet cap',
    },
    {
      label: 'Founder total (A + B + C, capped at 75%)',
      pct: fb.founderTotalPct,
      note: fb.capBinding === 'total_75' ? '75% total cap binding — earned reduced' : 'Below total cap',
    },
    {
      label: 'Exit share (grant route)',
      pct: fb.founderExitPct,
      note: fb.grantExitCapActive
        ? '55% exit cap active (investor IRR < 30%)'
        : 'Uncapped — IRR ≥ 30%',
    },
    {
      label: 'Investors keep',
      pct: fb.investorTotalPct,
      note: `Floor protected at ${(MIN_INVESTOR_SHARE * 100).toFixed(0)}%`,
    },
  ];

  WF.getCell(`A${wfr}`).value = 'Layer';
  WF.getCell(`B${wfr}`).value = '%';
  WF.getCell(`C${wfr}`).value = 'Note';
  ['A', 'B', 'C'].forEach((c) => {
    WF.getCell(`${c}${wfr}`).font = FONT.header;
    WF.getCell(`${c}${wfr}`).fill = STYLE.headerFill;
  });
  wfr += 1;
  layerRows.forEach((r) => {
    WF.getCell(`A${wfr}`).value = r.label;
    WF.getCell(`B${wfr}`).value = r.pct;
    WF.getCell(`B${wfr}`).numFmt = FMT.pct;
    WF.getCell(`B${wfr}`).alignment = { horizontal: 'right' };
    WF.getCell(`C${wfr}`).value = r.note;
    WF.getCell(`C${wfr}`).font = FONT.italic;
    if (r.label.startsWith('Founder total') || r.label.startsWith('Investors keep')) {
      WF.getCell(`A${wfr}`).font = FONT.bold;
      WF.getCell(`B${wfr}`).font = FONT.bold;
      WF.getCell(`B${wfr}`).fill = STYLE.totalFill;
    }
    wfr += 1;
  });
  wfr += 1;

  // Caps reference card
  WF.getCell(`A${wfr}`).value = 'Caps (investor protection)';
  WF.getCell(`A${wfr}`).font = FONT.section;
  WF.getCell(`A${wfr}`).fill = STYLE.sectionFill;
  WF.mergeCells(`A${wfr}:G${wfr}`);
  wfr += 1;
  WF.getCell(`A${wfr}`).value = 'Ratchet cap (Layer C, standalone ≤)';
  WF.getCell(`B${wfr}`).value = RATCHET_STANDALONE_CAP;
  WF.getCell(`B${wfr}`).numFmt = FMT.pct;
  wfr += 1;
  WF.getCell(`A${wfr}`).value = 'Total founder cap (pari-passu + earned ≤)';
  WF.getCell(`B${wfr}`).value = TOTAL_FOUNDER_CAP;
  WF.getCell(`B${wfr}`).numFmt = FMT.pct;
  wfr += 1;
  WF.getCell(`A${wfr}`).value = 'Minimum investor share';
  WF.getCell(`B${wfr}`).value = MIN_INVESTOR_SHARE;
  WF.getCell(`B${wfr}`).numFmt = FMT.pct;
  wfr += 2;

  // ── Layer B derivation (visible inputs → formula → result) ──────────
  // Spec says the grant bonus must NOT be a hardcoded magic number; it
  // derives from these inputs. Live formula cells so the bank can audit.
  WF.getCell(`A${wfr}`).value = 'Layer B — Grant bonus derivation';
  WF.getCell(`A${wfr}`).font = FONT.section;
  WF.getCell(`A${wfr}`).fill = STYLE.sectionFill;
  WF.mergeCells(`A${wfr}:G${wfr}`);
  wfr += 1;
  if (grantApproved) {
    // Input cells (blue — editable)
    const inputs: Array<{ label: string; cell: string; value: number; fmt: string }> = [
      { label: 'Grant amount', cell: 'B', value: 4_013_880, fmt: FMT.euro },
      { label: 'Bucket 1B — Grant procurement fee % (of grant)', cell: 'B', value: 0.10, fmt: FMT.pct },
      { label: 'Consultant share % (of grant)', cell: 'B', value: 0.05, fmt: FMT.pct },
      { label: 'Project asset value', cell: 'B', value: 8_440_000, fmt: FMT.euro },
      { label: 'Baseline bank loan (pre-grant commercial)', cell: 'B', value: 3_540_000, fmt: FMT.euro },
    ];
    const inputStartRow = wfr;
    inputs.forEach((inp) => {
      WF.getCell(`A${wfr}`).value = inp.label;
      const c = WF.getCell(`B${wfr}`);
      c.value = inp.value;
      c.numFmt = inp.fmt;
      c.fill = STYLE.inputFill;
      c.alignment = { horizontal: 'right' };
      wfr += 1;
    });
    const r = {
      grant: inputStartRow,
      feePct: inputStartRow + 1,
      consPct: inputStartRow + 2,
      asset: inputStartRow + 3,
      loan: inputStartRow + 4,
    };
    // Derived cells (grey — formulas linked to inputs above)
    const grossFee = capResult.founderBreakdown.founderNetGrantCash + capResult.founderBreakdown.consultantCashPayment;
    const derivedRows: Array<{ label: string; formula: string; value: number; fmt: string }> = [
      { label: 'Gross fee = grant × founder_fee_pct', formula: `=B${r.grant}*B${r.feePct}`, value: grossFee, fmt: FMT.euro },
      { label: 'Consultant cash = grant × consultant_share_pct', formula: `=B${r.grant}*B${r.consPct}`, value: capResult.founderBreakdown.consultantCashPayment, fmt: FMT.euro },
      { label: 'Founder net cash = gross_fee − consultant_cash', formula: `=B${r.grant}*B${r.feePct}-B${r.grant}*B${r.consPct}`, value: capResult.founderBreakdown.founderNetGrantCash, fmt: FMT.euro },
      { label: 'Post-grant equity = project_value − bank_loan', formula: `=B${r.asset}-B${r.loan}`, value: capResult.founderBreakdown.postGrantEquityValue, fmt: FMT.euro },
    ];
    derivedRows.forEach((d) => {
      WF.getCell(`A${wfr}`).value = d.label;
      const c = WF.getCell(`B${wfr}`);
      c.value = { formula: d.formula, result: d.value };
      c.numFmt = d.fmt;
      c.fill = STYLE.formulaFill;
      c.alignment = { horizontal: 'right' };
      wfr += 1;
    });
    // Final grant bonus = founder_net / (post_grant_equity + founder_net)
    WF.getCell(`A${wfr}`).value = 'Grant bonus % = founder_net / (post_grant_equity + founder_net)';
    WF.getCell(`A${wfr}`).font = FONT.bold;
    const gbCell = WF.getCell(`B${wfr}`);
    const founderNetRow = inputStartRow + inputs.length + 2;  // 3rd derived row
    const postEquityRow = inputStartRow + inputs.length + 3;  // 4th derived row
    gbCell.value = {
      formula: `=B${founderNetRow}/(B${postEquityRow}+B${founderNetRow})`,
      result: capResult.founderBreakdown.grantBonusPct,
    };
    gbCell.numFmt = FMT.pct;
    gbCell.font = FONT.bold;
    gbCell.fill = STYLE.totalFill;
    gbCell.alignment = { horizontal: 'right' };
    wfr += 2;
  } else {
    WF.getCell(`A${wfr}`).value = 'Grant not approved — Layer B inactive (grant bonus = 0%).';
    WF.getCell(`A${wfr}`).font = FONT.italic;
    WF.mergeCells(`A${wfr}:G${wfr}`);
    wfr += 2;
  }

  // ── Fee summary — these reduce cash distributable to equity ────────
  WF.getCell(`A${wfr}`).value = 'Operating fees subtracted from NCF (before equity split)';
  WF.getCell(`A${wfr}`).font = FONT.section;
  WF.getCell(`A${wfr}`).fill = STYLE.sectionFill;
  WF.mergeCells(`A${wfr}:G${wfr}`);
  wfr += 1;
  WF.getCell(`A${wfr}`).value = 'Base management fee — Bucket 2A (5% × gross revenue, cumulative)';
  WF.getCell(`B${wfr}`).value = capResult.totalFounderManCoFee;
  WF.getCell(`B${wfr}`).numFmt = FMT.euro;
  WF.getCell(`B${wfr}`).fill = STYLE.formulaFill;
  wfr += 1;
  WF.getCell(`A${wfr}`).value = 'Deferred advisory fee — Bucket 1B (grant × 10%, paid from operating cash over 3 yrs post-disbursement)';
  WF.getCell(`B${wfr}`).value = capResult.totalDeferredAdvisoryFee;
  WF.getCell(`B${wfr}`).numFmt = FMT.euro;
  WF.getCell(`B${wfr}`).fill = STYLE.formulaFill;
  wfr += 2;

  // ── Stress test: founder cash at €200K / €300K / €400K / €500K ──────
  WF.getCell(`A${wfr}`).value = 'Stress test — founder cash sensitivity';
  WF.getCell(`A${wfr}`).font = FONT.section;
  WF.getCell(`A${wfr}`).fill = STYLE.sectionFill;
  WF.mergeCells(`A${wfr}:G${wfr}`);
  wfr += 1;
  WF.getCell(`A${wfr}`).value =
    `Holds everything else constant (total equity €${Math.round(capResult.totalEquityRaised / 1000)}K, grant=${grantApproved}); ` +
    `varies founder cash only. Tells the bank where additional founder cash stops adding upside.`;
  WF.getCell(`A${wfr}`).font = FONT.italic;
  WF.mergeCells(`A${wfr}:G${wfr}`);
  wfr += 2;

  const stressHeaders = [
    'Founder cash', 'Pari-passu', 'Grant bonus', 'Ratchet',
    'Founder total', 'Investors', 'Cap binding',
  ];
  stressHeaders.forEach((h, i) => {
    const c = WF.getCell(`${col(1 + i)}${wfr}`);
    c.value = h;
    c.font = FONT.header;
    c.fill = STYLE.headerFill;
    c.alignment = { horizontal: i === 0 ? 'left' : 'right' };
  });
  wfr += 1;

  // Spec stress levels — €500K crosses the 75% total cap so the bank can
  // see exactly where additional founder cash stops adding upside.
  const stressCashLevels = [200_000, 300_000, 400_000, 500_000];
  // Total equity stays constant — when founder cash increases the non-founder
  // pool implicitly shrinks (in the model, an editor changes one stakeholder's
  // contribution to keep the total equity raise fixed).
  const totalEquityFixed = capResult.totalEquityRaised || 885_000;
  stressCashLevels.forEach((cash) => {
    const stress = resolveFounderWaterfall(capScenario, cash, totalEquityFixed, grantApproved);
    const sb = stress.breakdown;
    const cells: Array<string | number> = [
      cash,
      sb.pariPassuPct,
      sb.grantBonusPct,
      sb.performanceRatchetPct,
      sb.founderTotalPct,
      sb.investorTotalPct,
      sb.capBinding === 'total_75'
        ? '75% binding'
        : sb.capBinding === 'ratchet_10'
          ? '10% ratchet cap'
          : sb.capBinding === 'exit_55_grant'
            ? '55% exit cap (grant)'
            : 'free',
    ];
    cells.forEach((v, i) => {
      const c = WF.getCell(`${col(1 + i)}${wfr}`);
      c.value = v;
      if (i === 0) c.numFmt = FMT.euro;
      else if (i < 6) c.numFmt = FMT.pct;
      c.alignment = { horizontal: i === 0 ? 'left' : 'right' };
      c.fill = STYLE.formulaFill;
      if ((sb.capBinding === 'total_75' || sb.capBinding === 'exit_55_grant') && i === 6) {
        c.font = { bold: true, color: { argb: 'FFB45309' } };
      }
    });
    wfr += 1;
  });

  WF.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];
  } // end: !isBankViewExport — Cap Table + Waterfall sheets omitted from banker pack

  // ── Validation block on the Cover sheet ────────────────────────────
  cover.getCell(`B${valStartRow}`).value = 'Engine ↔ Workbook validation';
  cover.getCell(`B${valStartRow}`).font = { ...FONT.section, size: 14 };
  cover.mergeCells(`B${valStartRow}:E${valStartRow}`);

  const valHeaderRow = valStartRow + 1;
  const valHeaders = ['Metric', 'Engine value', 'Workbook value', 'Match'];
  valHeaders.forEach((h, i) => {
    const c = cover.getCell(`${col(2 + i)}${valHeaderRow}`);
    c.value = h;
    c.font = FONT.header;
    c.fill = STYLE.headerFill;
  });
  cover.getColumn(3).width = 24;
  cover.getColumn(4).width = 24;
  cover.getColumn(5).width = 18;

  const stab2032 = py(2032);
  // ── Validation table helpers ───────────────────────────────────────────────
  // DSCR validation uses the same "total DS (incl. WC)" basis as the Coverage
  // sheet, so the engine value and the workbook value are computed identically.
  const totalDs2032 = stab2032
    ? stab2032.termLoanInterest + stab2032.termLoanPrincipal + stab2032.wcInterestExpense
    : 0;
  const dscr2032 = totalDs2032 > 0 ? (stab2032?.ebitdaPreOpCo ?? 0) / totalDs2032 : 0;

  // First full amortisation year = first year where termLoanPrincipal > 0.
  const firstFullDsYear = years.find((y) => (py(y)?.termLoanPrincipal ?? 0) > 0) ?? 2029;
  const firstFullDsYearIdx = years.indexOf(firstFullDsYear);
  const pnlFirstFullDs = py(firstFullDsYear);
  const annualDsEngine =
    (pnlFirstFullDs?.termLoanInterest ?? 0) +
    (pnlFirstFullDs?.termLoanPrincipal ?? 0) +
    (pnlFirstFullDs?.wcInterestExpense ?? 0);

  // Exit year metrics.
  const validExitYear = m.scenarios.realistic.exitYear;
  const exitYearIdx = years.indexOf(validExitYear);
  const pnlExit = py(validExitYear);

  const validations: {
    label: string;
    engine: number;
    workbookRef: string;
    fmt: string;
  }[] = [
    // ── CAPEX & FINANCING ────────────────────────────────────────────────────
    {
      label: 'Total CAPEX',
      engine: m.capex.portfolioTotal,
      workbookRef: capexTotalCell,
      fmt: FMT.euro,
    },
    {
      label: 'Total loan (80% LTC)',
      engine: m.keyMetrics.loanAmount,
      workbookRef: `${XL.sh_coverage}!B${covLoanRow}`,
      fmt: FMT.euro,
    },
    {
      label: 'Structural equity at close',
      engine: m.keyMetrics.equityRequired,
      workbookRef: `${XL.sh_coverage}!B${covEquityRow}`,
      fmt: FMT.euro,
    },
    // ── OPERATIONS — STABILISED 2031 ─────────────────────────────────────────
    {
      label: 'Stabilised revenue (2032)',
      engine: stab2032?.totalRevenue ?? 0,
      workbookRef: `${XL.sh_revenue}!${col(2 + (2032 - 2026))}${totalRevRow}`,
      fmt: FMT.euro,
    },
    {
      label: 'Total OpEx (2032)',
      engine: stab2032?.totalOpex ?? 0,
      workbookRef: `'${XL.sh_opexPnl}'!${col(2 + (2032 - 2026))}${totalOpexRow}`,
      fmt: FMT.euro,
    },
    {
      label: 'Stabilised EBITDA (2032)',
      engine: stab2032?.ebitda ?? 0,
      workbookRef: `'${XL.sh_opexPnl}'!${col(2 + (2032 - 2026))}${ebitdaRow}`,
      fmt: FMT.euro,
    },
    // ── DEBT SERVICE & COVERAGE ──────────────────────────────────────────────
    {
      label: `Annual debt service (${firstFullDsYear}+)`,
      engine: annualDsEngine,
      workbookRef: `${XL.sh_coverage}!${col(2 + firstFullDsYearIdx)}${covTotalDsRow}`,
      fmt: FMT.euro,
    },
    {
      label: `DSCR first full DS year (${firstFullDsYear})`,
      engine: pnlFirstFullDs?.dscrLoaded ?? 0,
      workbookRef: `${XL.sh_coverage}!${col(2 + firstFullDsYearIdx)}${dscrRowOnCov}`,
      fmt: FMT.mul,
    },
    {
      label: 'Stabilised DSCR (2032) — incl. WC',
      engine: dscr2032,
      workbookRef: `${XL.sh_coverage}!${col(2 + (2032 - 2026))}${dscrRowOnCov}`,
      fmt: FMT.mul,
    },
    {
      label: 'Min DSCR (loan life)',
      engine: m.scenarios.realistic.minDSCRLoanLife,
      workbookRef: `${XL.sh_coverage}!B${covMinDscrRow}`,
      fmt: FMT.mul,
    },
    // ── INVESTOR-ONLY METRICS ────────────────────────────────────────────────
    ...(!isBankViewExport
      ? [
          {
            label: 'Grace interest reserve',
            engine: m.keyMetrics.graceInterestCarry,
            workbookRef: `${XL.sh_coverage}!B${covGraceInterestRow}`,
            fmt: FMT.euro,
          },
          {
            label: 'LLCR',
            engine: m.scenarios.realistic.llcr,
            workbookRef: `${XL.sh_coverage}!B${covLLCRRow}`,
            fmt: FMT.mul,
          },
          {
            label: `Revenue at exit (${validExitYear})`,
            engine: pnlExit?.totalRevenue ?? 0,
            workbookRef:
              exitYearIdx >= 0
                ? `${XL.sh_revenue}!${col(2 + exitYearIdx)}${totalRevRow}`
                : `${XL.sh_revenue}!B${totalRevRow}`,
            fmt: FMT.euro,
          },
          {
            label: `EBITDA at exit (${validExitYear})`,
            engine: pnlExit?.ebitda ?? 0,
            workbookRef:
              exitYearIdx >= 0
                ? `'${XL.sh_opexPnl}'!${col(2 + exitYearIdx)}${ebitdaRow}`
                : `'${XL.sh_opexPnl}'!B${ebitdaRow}`,
            fmt: FMT.euro,
          },
          {
            label: 'Terminal asset value',
            engine: m.scenarios.realistic.terminalAssetValue,
            workbookRef: `${XL.sh_coverage}!B${covTerminalValRow}`,
            fmt: FMT.euro,
          },
        ]
      : []),
    // ── CAP TABLE (internal only) ────────────────────────────────────────────
    // Cap Table rows omitted from banker pack — investor deal economics
    // have no place in a credit submission.
    ...(!isBankViewExport
      ? [
          ...capResult.stakeholders.slice(0, 2).map((sr, idx) => ({
            label: `Cap Table — ${sr.stakeholder.name} MOIC`,
            engine: sr.moic,
            workbookRef: `'${XL.sh_capTable}'!${col(5)}${5 + idx}`,
            fmt: FMT.mul,
          })),
          {
            label: 'Cap Table reconciliation diff',
            engine: capResult.reconciliationError,
            workbookRef: `'${XL.sh_capTable}'!B${reconcileRow + 2}`,
            fmt: FMT.euro,
          },
        ]
      : []),
  ];
  validations.forEach((v, i) => {
    const r0 = valHeaderRow + 1 + i;
    cover.getCell(`B${r0}`).value = v.label;
    const eng = cover.getCell(`C${r0}`);
    eng.value = v.engine;
    eng.numFmt = v.fmt;
    eng.fill = STYLE.formulaFill;
    const wb_ = cover.getCell(`D${r0}`);
    wb_.value = { formula: `=${v.workbookRef}`, result: v.engine };
    wb_.numFmt = v.fmt;
    wb_.fill = STYLE.formulaFill;
    const match = cover.getCell(`E${r0}`);
    match.value = { formula: `=IF(ABS(C${r0}-D${r0})<MAX(0.01,ABS(C${r0})*0.001),"✓ MATCH","⚠ DRIFT")`, result: '✓ MATCH' };
    match.font = { bold: true, color: { argb: 'FF2E7D32' } };
    match.alignment = { horizontal: 'center' };
  });

  // ─────────────────────────────────────────────────────────────────────
  // Banker-pack sheets (added 2026-05-21). Inserted as positions 2–5 via
  // `orderNo` reshuffle at the end of this function so a reader sees the
  // financing-comparison table immediately after the Cover.
  //
  // Sources: ModelOutput.financingComparison, ModelOutput.scenarios.realistic
  // (full data for the active path), ModelOutput.grantScenario (full data for
  // the grant path). For non-active commercial / rrf / tepix-loan paths we
  // only have the thin metrics in `financingComparison` — richer per-path
  // metrics (minDSCR, equityIRR, projectIRR, peakWC, exit value) are flagged
  // as "active path only" rather than fabricated.
  //
  // The engine does not currently expose a `tepix-guarantee-short` financing
  // path — FinancingPath = 'commercial' | 'grant' | 'rrf' | 'tepix-loan'. We
  // omit that column rather than fabricate. Flag for engine work next.
  // ─────────────────────────────────────────────────────────────────────

  const activeScenario = m.scenarios.realistic;
  const activePath = m.activeFinancingPath;

  // Compute the year of minimum DSCR across operational years (≥2029) on the
  // active scenario. Used to annotate min-DSCR rows with year-of-occurrence so
  // readers see the worst-year context the v6 BP / v8 deck calls out.
  const minDscrYearLookup = (sc: typeof activeScenario): number | null => {
    let yr: number | null = null;
    let cur = Number.POSITIVE_INFINITY;
    sc.pnl.forEach((p) => {
      if (p.year >= 2029 && p.dscr > 0 && p.dscr < cur) {
        cur = p.dscr;
        yr = p.year;
      }
    });
    return yr;
  };
  const activeMinDscrYear = minDscrYearLookup(activeScenario);

  // ── Financing-path comparison ───────────────────────────────────────
  const FC = wb.addWorksheet(XL.sh_financingComparison, { views: locale === 'he' ? [{ showGridLines: false, rightToLeft: true }] : [{ showGridLines: false }] });
  FC.columns = [
    { width: 42 },
    { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 },
    { width: 28 },
  ];
  FC.getCell('A1').value = 'Financing-path comparison';
  FC.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8B6914' } };
  FC.getCell('A2').value =
    'Side-by-side: each column is one financing path. Bolded column is the ACTIVE path used elsewhere in this workbook. ' +
    'All four paths show fully-calculated metrics — each uses the same CAPEX and revenue assumptions with its own financing structure. ' +
    'DSCR, IRR, NCF, and peak-debt rows are computed for every path, not just the active one.';
  FC.getCell('A2').font = FONT.italic;
  FC.getCell('A2').alignment = { wrapText: true, vertical: 'top' };
  FC.mergeCells('A2:F2');
  FC.getRow(2).height = 42;

  // DSCR reading-guide (matches v6 BP / v8 presentation convention).
  FC.getCell('A3').value =
    'DSCR reading guide — Stabilised DSCR reflects steady-state operations (year 3+) and is the ' +
    'headline coverage number used by bankers underwriting long-dated facilities. Minimum DSCR ' +
    'captures the worst single year — typically the first year of full amortisation before NCF ' +
    'ramps — and is used for covenant-floor checks. Stabilised is weighted heaviest; min is a ' +
    'sub-metric for stress context.';
  FC.getCell('A3').font = { ...FONT.italic, italic: true, color: { argb: 'FF5A4A1F' }, size: 9 };
  FC.getCell('A3').alignment = { wrapText: true, vertical: 'top' };
  FC.getCell('A3').fill = STYLE.sectionFill;
  FC.mergeCells('A3:F3');
  FC.getRow(3).height = 52;

  // Header row.
  const fcPathCols: Array<{ key: 'commercial' | 'rrf' | 'grant' | 'tepix-loan'; label: string }> = [
    { key: 'commercial', label: 'Commercial' },
    { key: 'tepix-loan', label: 'TEPIX Loan' },
    { key: 'rrf', label: 'RRF' },
    { key: 'grant', label: 'Grant' },
  ];
  let fcr = 5;
  FC.getCell(`A${fcr}`).value = XL.lbl_metric;
  FC.getCell(`A${fcr}`).font = FONT.header;
  FC.getCell(`A${fcr}`).fill = STYLE.headerFill;
  fcPathCols.forEach((p, i) => {
    const c = FC.getCell(`${col(2 + i)}${fcr}`);
    const isActive = p.key === activePath;
    c.value = isActive ? `${p.label} (ACTIVE)` : p.label;
    c.font = { ...FONT.header, bold: true };
    c.fill = STYLE.headerFill;
    c.alignment = { horizontal: 'center' };
  });
  FC.getCell(`F${fcr}`).value = 'Source / note';
  FC.getCell(`F${fcr}`).font = FONT.header;
  FC.getCell(`F${fcr}`).fill = STYLE.headerFill;
  fcr += 1;

  // Helper: pick a value from financingComparison by key.
  const fcRow = (key: string) => m.financingComparison.find((row) => row.key === key);
  // Full-data scenario per path — all four paths now available.
  const scenarioForPath = (key: typeof fcPathCols[number]['key']): typeof activeScenario => {
    if (key === 'grant') return m.grantScenario;
    if (key === 'rrf') return m.rrfScenario;
    if (key === 'commercial') return m.commercialScenario;
    return m.tepixLoanScenario; // 'tepix-loan'
  };

  // Write one row across all paths.
  // emphasis: 'headline' renders the row at +1 size, bold, larger row height;
  //           'sub'      renders the row in italic, size 9, grey (demoted);
  //           'normal'   matches the pre-existing styling (bold label + body).
  const writeFcMetric = (
    label: string,
    pickRich: (sc: typeof activeScenario) => number,
    fmt: string,
    note: string,
    emphasis: 'headline' | 'sub' | 'normal' = 'normal',
  ) => {
    const labelCell = FC.getCell(`A${fcr}`);
    labelCell.value = label;
    if (emphasis === 'headline') {
      labelCell.font = { bold: true, size: 13, color: { argb: 'FF8B6914' } };
      FC.getRow(fcr).height = 22;
    } else if (emphasis === 'sub') {
      labelCell.font = { italic: true, size: 9, color: { argb: 'FF777777' } };
    } else {
      labelCell.font = FONT.bold;
    }
    fcPathCols.forEach((p, i) => {
      const c = FC.getCell(`${col(2 + i)}${fcr}`);
      const sc = scenarioForPath(p.key);
      let v: string | number = pickRich(sc);
      c.numFmt = fmt;
      // Fill is always set (active = gold, others = grey).
      c.fill = p.key === activePath ? STYLE.totalFill : STYLE.formulaFill;
      if (emphasis === 'sub') {
        const pathMinYr = minDscrYearLookup(sc);
        c.numFmt = '';
        v = `${(pickRich(sc) as number).toFixed(2)}× · yr ${pathMinYr ?? '—'}`;
        c.font = { italic: true, size: 9, color: { argb: 'FF777777' } };
      } else if (emphasis === 'headline') {
        c.font = { bold: true, size: 13, color: p.key === activePath ? { argb: 'FF8B6914' } : { argb: 'FF333333' } };
      } else if (p.key === activePath) {
        c.font = FONT.bold;
      }
      c.value = v;
    });
    FC.getCell(`F${fcr}`).value = note;
    FC.getCell(`F${fcr}`).font = FONT.italic;
    fcr += 1;
  };

  // Thin metrics — sourced from m.financingComparison, available for all paths.
  const writeThinRow = (
    key: string,
    fmt: string,
    note: string,
  ) => {
    const row = fcRow(key);
    if (!row) return;
    FC.getCell(`A${fcr}`).value = row.metric;
    FC.getCell(`A${fcr}`).font = FONT.bold;
    fcPathCols.forEach((p, i) => {
      const c = FC.getCell(`${col(2 + i)}${fcr}`);
      const v = (row as unknown as Record<string, string | number>)[
        p.key === 'tepix-loan' ? 'tepixLoan' : p.key
      ];
      if (typeof v === 'number') {
        c.value = v;
        c.numFmt = fmt;
      } else {
        c.value = v;
        c.alignment = { horizontal: 'center' };
      }
      c.fill = p.key === activePath ? STYLE.totalFill : STYLE.formulaFill;
      if (p.key === activePath) c.font = FONT.bold;
    });
    FC.getCell(`F${fcr}`).value = note;
    FC.getCell(`F${fcr}`).font = FONT.italic;
    fcr += 1;
  };

  // Spec rows: stab DSCR, minDSCRLoanLife, stab NCF, equityIRR, projectIRR,
  // peak working capital, exit value. We also surface a small block of
  // financing-comparison rows the engine already produces (loan / equity /
  // annual DS / supplementary) for completeness.
  writeThinRow('totalLoanDrawn', FMT.euro, 'engine.financingComparison.totalLoanDrawn');
  writeThinRow('grantReceived', FMT.euro, 'engine.financingComparison.grantReceived');
  writeThinRow('equityRequired', FMT.euro, 'engine.financingComparison.equityRequired');
  writeThinRow('annualDebtService', FMT.euro, 'engine.financingComparison.annualDebtService');
  writeThinRow('supplementaryLoan', FMT.euro, 'engine.financingComparison.supplementaryLoan (TEPIX only)');
  writeThinRow('equitySavingVsCommercial', FMT.euro, 'engine.financingComparison.equitySavingVsCommercial');

  // Rich metrics — only available where we have a full ScenarioOutput.
  // DSCR block: stabilised is the headline (project-finance industry standard
  // for long-dated facilities); min is a demoted sub-metric carrying the
  // year-of-occurrence and recovery context. Matches v6 BP / v8 deck framing.
  writeFcMetric(
    'Stabilised DSCR (2031, EBITDA / DS)  — headline',
    (sc) => sc.stabilisedYear?.dscr ?? 0,
    FMT.mul,
    'ScenarioOutput.stabilisedYear.dscr — steady-state coverage, the number bankers underwrite to',
    'headline',
  );
  writeFcMetric(
    '   ↳ Min DSCR over loan life (post-ramp, worst-year stress)',
    (sc) => sc.minDSCRLoanLife,
    FMT.mul,
    `ScenarioOutput.minDSCRLoanLife — covenant-floor check; active-path min occurs in yr ${activeMinDscrYear ?? '—'} then recovers as NCF ramps`,
    'sub',
  );
  writeFcMetric(
    'Stabilised NCF post-tax (2032)',
    (sc) => sc.stabilisedYear?.netCashFlowPostVAT ?? 0,
    FMT.euro,
    'ScenarioOutput.stabilisedYear.netCashFlowPostVAT',
  );
  writeFcMetric(
    'Levered Equity IRR (incl. terminal)',
    (sc) => sc.equityIRR,
    FMT.pct,
    'ScenarioOutput.equityIRR',
  );
  writeFcMetric(
    'Unlevered Project IRR (incl. terminal)',
    (sc) => sc.projectIRR,
    FMT.pct,
    'ScenarioOutput.projectIRR',
  );
  writeFcMetric(
    'Peak working-capital balance (max across years)',
    (sc) => sc.pnl.reduce((m_, p) => Math.max(m_, p.wcPeakBalance), 0),
    FMT.euro,
    'max(AnnualPnL.wcPeakBalance)',
  );
  writeFcMetric(
    'Peak total debt outstanding (term + WC)',
    (sc) => sc.peakDebtOutstanding,
    FMT.euro,
    'ScenarioOutput.peakDebtOutstanding',
  );
  writeFcMetric(
    'Terminal asset value (exit)',
    (sc) => sc.terminalAssetValue,
    FMT.euro,
    'ScenarioOutput.terminalAssetValue (EBITDA × exit multiple)',
  );
  writeFcMetric(
    'Terminal equity value (exit, asset − debt)',
    (sc) => sc.terminalEquityValue,
    FMT.euro,
    'ScenarioOutput.terminalEquityValue',
  );

  fcr += 1;
  FC.mergeCells(`A${fcr}:F${fcr}`);
  FC.getCell(`A${fcr}`).value =
    'Engine note: all four paths (Commercial / RRF / Grant / TEPIX Loan) are fully modelled. ' +
    'RRF loan = total CAPEX × RRF coverage rate (blended 80% EU-RRF at 0.35% + 20% commercial at 5%). ' +
    'Grant path deducts the Development Law grant from non-land CAPEX before sizing the loan.';
  FC.getCell(`A${fcr}`).font = FONT.italic;
  FC.getCell(`A${fcr}`).alignment = { wrapText: true, vertical: 'top' };
  FC.getRow(fcr).height = 32;
  FC.views = [{ state: 'frozen', xSplit: 1, ySplit: 5 }];

  // ── Amortisation schedule (active path) ─────────────────────────────
  // Reconstructed from AnnualPnL.termLoanInterest / termLoanPrincipal /
  // termLoanBalance. Drawdown is set to loanAmount at year 2026 (project
  // start), zero thereafter; this matches the engine's single-draw model.
  // No cash-sweep mechanic exists in the current engine — column reported
  // as 'n/a'.
  const AM = wb.addWorksheet(XL.sh_amortisation);
  applyRTL(AM);
  AM.columns = [
    { width: 8 },
    { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 16 },
    { width: 10 }, { width: 12 },
  ];
  AM.getCell('A1').value = `Amortisation schedule — ${pathLabel(activePath)} (active path)`;
  AM.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8B6914' } };
  AM.getCell('A2').value =
    `Loan ${pathLabel(activePath)}. Grace 2026–2028 (interest-only). Amortising 2029 onward. ` +
    `Source: AnnualPnL.termLoanInterest / termLoanPrincipal / termLoanBalance.`;
  AM.getCell('A2').font = FONT.italic;
  AM.mergeCells('A2:H2');

  const amHeaders = [
    'Year', 'Opening balance', 'Drawdown', 'Interest', 'Principal',
    'Closing balance', 'DSCR', 'Cash sweep',
  ];
  let amr = 4;
  amHeaders.forEach((h, i) => {
    const c = AM.getCell(`${col(1 + i)}${amr}`);
    c.value = h;
    c.font = FONT.header;
    c.fill = STYLE.headerFill;
    c.alignment = { horizontal: 'center' };
  });
  amr += 1;

  const loanAmount = m.keyMetrics.loanAmount;
  let priorClosing = loanAmount;
  activeScenario.pnl.forEach((p, idx) => {
    const opening = idx === 0 ? 0 : priorClosing;
    const drawdown = idx === 0 ? loanAmount : 0;
    // Engine stores termLoanBalance as the closing balance for the year.
    const closing = p.termLoanBalance;
    AM.getCell(`A${amr}`).value = p.year;
    AM.getCell(`A${amr}`).alignment = { horizontal: 'center' };
    AM.getCell(`A${amr}`).font = FONT.bold;
    const numCells: Array<[string, number, string]> = [
      [`B${amr}`, opening, FMT.euro],
      [`C${amr}`, drawdown, FMT.euro],
      [`D${amr}`, p.termLoanInterest, FMT.euro],
      [`E${amr}`, p.termLoanPrincipal, FMT.euro],
      [`F${amr}`, closing, FMT.euro],
      [`G${amr}`, p.dscr, FMT.mul],
    ];
    numCells.forEach(([addr, v, fmt]) => {
      const c = AM.getCell(addr);
      c.value = v;
      c.numFmt = fmt;
      c.fill = STYLE.formulaFill;
    });
    // No cash-sweep in current engine.
    const sweepCell = AM.getCell(`H${amr}`);
    sweepCell.value = 'n/a';
    sweepCell.alignment = { horizontal: 'center' };
    sweepCell.font = FONT.italic;
    sweepCell.fill = STYLE.formulaFill;
    priorClosing = closing;
    amr += 1;
  });

  // Totals row.
  const amTotalRow = amr;
  AM.getCell(`A${amr}`).value = 'Total';
  AM.getCell(`A${amr}`).font = FONT.bold;
  const totalDrawn = loanAmount;
  const totalInterest = activeScenario.pnl.reduce((s, p) => s + p.termLoanInterest, 0);
  const totalPrincipal = activeScenario.pnl.reduce((s, p) => s + p.termLoanPrincipal, 0);
  AM.getCell(`C${amr}`).value = totalDrawn;
  AM.getCell(`C${amr}`).numFmt = FMT.euro;
  AM.getCell(`C${amr}`).fill = STYLE.totalFill;
  AM.getCell(`C${amr}`).font = FONT.bold;
  AM.getCell(`D${amr}`).value = totalInterest;
  AM.getCell(`D${amr}`).numFmt = FMT.euro;
  AM.getCell(`D${amr}`).fill = STYLE.totalFill;
  AM.getCell(`D${amr}`).font = FONT.bold;
  AM.getCell(`E${amr}`).value = totalPrincipal;
  AM.getCell(`E${amr}`).numFmt = FMT.euro;
  AM.getCell(`E${amr}`).fill = STYLE.totalFill;
  AM.getCell(`E${amr}`).font = FONT.bold;
  void amTotalRow;
  amr += 2;

  AM.getCell(`A${amr}`).value = `Note: 'Cash sweep' is reported as n/a — the current engine does not model a cash-sweep mechanism.`;
  AM.getCell(`A${amr}`).font = FONT.italic;
  AM.mergeCells(`A${amr}:H${amr}`);
  AM.views = [{ state: 'frozen', xSplit: 1, ySplit: 4 }];

  // ── Working-capital block ───────────────────────────────────────────
  const WC = wb.addWorksheet(XL.sh_workingCapital);
  applyRTL(WC);
  WC.columns = [{ width: 38 }, ...years.map(() => ({ width: 14 })), { width: 16 }];
  WC.getCell('A1').value = 'Working Capital — annual aggregates';
  WC.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8B6914' } };
  WC.getCell('A2').value =
    'Source: AnnualPnL.wc* per year (engine runs quarterly under the hood; aggregates shown here). ' +
    'Self-liquidating-violation flag: TRUE when the trough quarter ends above the self-liquidating threshold.';
  WC.getCell('A2').font = FONT.italic;
  WC.getCell('A2').alignment = { wrapText: true, vertical: 'top' };
  WC.mergeCells(`A2:${col(2 + years.length)}2`);
  WC.getRow(2).height = 30;

  let wcRr = 4;
  // Headline metrics block.
  WC.getCell(`A${wcRr}`).value = 'Portfolio-wide totals (active scenario)';
  WC.getCell(`A${wcRr}`).font = FONT.section;
  WC.getCell(`A${wcRr}`).fill = STYLE.sectionFill;
  WC.mergeCells(`A${wcRr}:${col(2 + years.length)}${wcRr}`);
  wcRr += 1;

  const wcPeak = activeScenario.pnl.reduce((m_, p) => Math.max(m_, p.wcPeakBalance), 0);
  const wcTrough = activeScenario.pnl.reduce(
    (m_, p) => (p.wcTroughBalance > 0 ? Math.min(m_, p.wcTroughBalance) : m_),
    Number.POSITIVE_INFINITY,
  );
  const wcTroughFinal = isFinite(wcTrough) ? wcTrough : 0;
  const selfLiqViolation = activeScenario.pnl.some((p) => p.wcSelfLiquidatingViolation);
  const wcEffectiveFacility = activeScenario.wcEffectiveFacility;
  const wcRate = activeScenario.wcRate;

  const headlineRows: Array<[string, number | string, string]> = [
    ['Peak WC balance (max across years)', wcPeak, FMT.euro],
    ['Trough WC balance (min across operational years, > 0)', wcTroughFinal, FMT.euro],
    ['Effective WC facility cap', wcEffectiveFacility, FMT.euro],
    ['WC interest rate', wcRate, FMT.pct],
    ['Self-liquidating violation flag (any year)', selfLiqViolation ? '✗ VIOLATED' : '✓ CLEAR', ''],
  ];
  headlineRows.forEach(([label, val, fmt]) => {
    WC.getCell(`A${wcRr}`).value = label;
    WC.getCell(`A${wcRr}`).font = FONT.bold;
    const c = WC.getCell(`B${wcRr}`);
    c.value = val;
    if (fmt) c.numFmt = fmt;
    c.fill = STYLE.totalFill;
    c.font = FONT.bold;
    if (label.startsWith('Self-liquidating')) {
      c.font = { bold: true, color: { argb: selfLiqViolation ? 'FFC62828' : 'FF2E7D32' } };
      c.alignment = { horizontal: 'center' };
    }
    wcRr += 1;
  });
  // WC days — not in current ModelOutput.
  WC.getCell(`A${wcRr}`).value = 'WC days (revenue × days/365)';
  WC.getCell(`A${wcRr}`).font = FONT.bold;
  WC.getCell(`B${wcRr}`).value = 'n/a — not in ModelOutput';
  WC.getCell(`B${wcRr}`).font = FONT.italic;
  WC.getCell(`B${wcRr}`).alignment = { horizontal: 'center' };
  wcRr += 2;

  // Per-year table.
  WC.getCell(`A${wcRr}`).value = 'Year-by-year';
  WC.getCell(`A${wcRr}`).font = FONT.section;
  WC.getCell(`A${wcRr}`).fill = STYLE.sectionFill;
  WC.mergeCells(`A${wcRr}:${col(2 + years.length)}${wcRr}`);
  wcRr += 1;

  // Header row.
  WC.getCell(`A${wcRr}`).value = XL.lbl_metric;
  WC.getCell(`A${wcRr}`).font = FONT.header;
  WC.getCell(`A${wcRr}`).fill = STYLE.headerFill;
  years.forEach((y, i) => {
    const c = WC.getCell(`${col(2 + i)}${wcRr}`);
    c.value = y;
    c.font = FONT.header;
    c.fill = STYLE.headerFill;
    c.alignment = { horizontal: 'center' };
  });
  wcRr += 1;

  const wcMetricRows: Array<{
    label: string;
    pick: (p: typeof activeScenario.pnl[number]) => number | boolean;
    fmt: string;
  }> = [
    { label: 'WC peak balance', pick: (p) => p.wcPeakBalance, fmt: FMT.euro },
    { label: 'WC trough balance', pick: (p) => p.wcTroughBalance, fmt: FMT.euro },
    { label: 'WC average balance', pick: (p) => p.wcAvgBalance, fmt: FMT.euro },
    { label: 'WC net contribution (drawn − repaid)', pick: (p) => p.wcNetContribution, fmt: FMT.euro },
    { label: 'WC interest expense', pick: (p) => p.wcInterestExpense, fmt: FMT.euro },
    { label: 'Self-liquidating violation', pick: (p) => p.wcSelfLiquidatingViolation, fmt: '' },
  ];
  wcMetricRows.forEach((mRow) => {
    WC.getCell(`A${wcRr}`).value = mRow.label;
    WC.getCell(`A${wcRr}`).font = FONT.bold;
    activeScenario.pnl.forEach((p, i) => {
      const c = WC.getCell(`${col(2 + i)}${wcRr}`);
      const v = mRow.pick(p);
      if (typeof v === 'boolean') {
        c.value = v ? '✗' : '✓';
        c.alignment = { horizontal: 'center' };
        c.font = { bold: true, color: { argb: v ? 'FFC62828' : 'FF2E7D32' } };
      } else {
        c.value = v;
        c.numFmt = mRow.fmt;
      }
      c.fill = STYLE.formulaFill;
    });
    wcRr += 1;
  });
  WC.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];

  // ── Bank Coverage Ratios (LLCR / PLCR / ICR) ─────────────────────────
  // ICR is per-year on AnnualPnL.interestCoverageRatio.
  // LLCR / PLCR are scenario-aggregate (NPV-based) — single number each.
  // We report ICR per year + scenario aggregates for LLCR / PLCR + min ICR
  // across loan life.
  const BC = wb.addWorksheet(XL.sh_bankCoverage);
  applyRTL(BC);
  BC.columns = [{ width: 38 }, ...years.map(() => ({ width: 13 })), { width: 16 }];
  BC.getCell('A1').value = 'Bank Coverage Ratios — LLCR / PLCR / ICR';
  BC.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8B6914' } };
  BC.getCell('A2').value =
    'ICR per year from AnnualPnL.interestCoverageRatio (EBITDA / interest). LLCR / PLCR are NPV-based ' +
    'coverage ratios computed at the scenario level (single aggregate number each) — see ScenarioOutput.llcr / .plcr.';
  BC.getCell('A2').font = FONT.italic;
  BC.getCell('A2').alignment = { wrapText: true, vertical: 'top' };
  BC.mergeCells(`A2:${col(2 + years.length)}2`);
  BC.getRow(2).height = 30;

  // DSCR reading-guide (matches v6 BP / v8 presentation convention).
  BC.getCell('A3').value =
    'DSCR reading guide — Stabilised DSCR reflects steady-state operations (year 3+) and is the ' +
    'headline coverage number used by bankers underwriting long-dated facilities. Minimum DSCR ' +
    'captures the worst single year — typically the first year of full amortisation before NCF ' +
    'ramps — and is used for covenant-floor checks. Stabilised is weighted heaviest; min is a ' +
    'sub-metric for stress context.';
  BC.getCell('A3').font = { italic: true, size: 9, color: { argb: 'FF5A4A1F' } };
  BC.getCell('A3').alignment = { wrapText: true, vertical: 'top' };
  BC.getCell('A3').fill = STYLE.sectionFill;
  BC.mergeCells(`A3:${col(2 + years.length)}3`);
  BC.getRow(3).height = 52;

  let bcr = 5;
  // Per-year header.
  BC.getCell(`A${bcr}`).value = XL.lbl_year;
  BC.getCell(`A${bcr}`).font = FONT.header;
  BC.getCell(`A${bcr}`).fill = STYLE.headerFill;
  years.forEach((y, i) => {
    const c = BC.getCell(`${col(2 + i)}${bcr}`);
    c.value = y;
    c.font = FONT.header;
    c.fill = STYLE.headerFill;
    c.alignment = { horizontal: 'center' };
  });
  BC.getCell(`${col(2 + years.length)}${bcr}`).value = 'Min over loan life';
  BC.getCell(`${col(2 + years.length)}${bcr}`).font = FONT.header;
  BC.getCell(`${col(2 + years.length)}${bcr}`).fill = STYLE.headerFill;
  BC.getCell(`${col(2 + years.length)}${bcr}`).alignment = { horizontal: 'center' };
  bcr += 1;

  // DSCR row (per year).
  BC.getCell(`A${bcr}`).value = 'DSCR (EBITDA / main-loan DS)';
  BC.getCell(`A${bcr}`).font = FONT.bold;
  let minDscr = Number.POSITIVE_INFINITY;
  activeScenario.pnl.forEach((p, i) => {
    const c = BC.getCell(`${col(2 + i)}${bcr}`);
    c.value = p.dscr;
    c.numFmt = FMT.mul;
    c.fill = STYLE.formulaFill;
    if (p.dscr > 0 && p.year >= 2029) minDscr = Math.min(minDscr, p.dscr);
  });
  const minDscrCell = BC.getCell(`${col(2 + years.length)}${bcr}`);
  minDscrCell.value = isFinite(minDscr) ? minDscr : 0;
  minDscrCell.numFmt = FMT.mul;
  minDscrCell.fill = STYLE.totalFill;
  minDscrCell.font = FONT.bold;
  bcr += 1;

  // ICR row (per year).
  BC.getCell(`A${bcr}`).value = 'ICR (EBITDA / interest only)';
  BC.getCell(`A${bcr}`).font = FONT.bold;
  let minIcr = Number.POSITIVE_INFINITY;
  activeScenario.pnl.forEach((p, i) => {
    const c = BC.getCell(`${col(2 + i)}${bcr}`);
    c.value = p.interestCoverageRatio;
    c.numFmt = FMT.mul;
    c.fill = STYLE.formulaFill;
    if (p.interestCoverageRatio > 0 && p.year >= 2029) {
      minIcr = Math.min(minIcr, p.interestCoverageRatio);
    }
  });
  const minIcrCell = BC.getCell(`${col(2 + years.length)}${bcr}`);
  minIcrCell.value = isFinite(minIcr) ? minIcr : 0;
  minIcrCell.numFmt = FMT.mul;
  minIcrCell.fill = STYLE.totalFill;
  minIcrCell.font = FONT.bold;
  bcr += 1;

  // Loaded DSCR (EBITDA / total DS incl. WC) — already useful here for a banker.
  BC.getCell(`A${bcr}`).value = 'DSCR loaded (EBITDA / DS incl. WC interest)';
  BC.getCell(`A${bcr}`).font = FONT.bold;
  let minLoadedDscr = Number.POSITIVE_INFINITY;
  activeScenario.pnl.forEach((p, i) => {
    const c = BC.getCell(`${col(2 + i)}${bcr}`);
    c.value = p.dscrLoaded;
    c.numFmt = FMT.mul;
    c.fill = STYLE.formulaFill;
    if (p.dscrLoaded > 0 && p.year >= 2029) {
      minLoadedDscr = Math.min(minLoadedDscr, p.dscrLoaded);
    }
  });
  const minLoadedDscrCell = BC.getCell(`${col(2 + years.length)}${bcr}`);
  minLoadedDscrCell.value = isFinite(minLoadedDscr) ? minLoadedDscr : 0;
  minLoadedDscrCell.numFmt = FMT.mul;
  minLoadedDscrCell.fill = STYLE.totalFill;
  minLoadedDscrCell.font = FONT.bold;
  bcr += 2;

  // Aggregate LLCR / PLCR block.
  BC.getCell(`A${bcr}`).value = 'Loan-life / project-life aggregate ratios (NPV-based)';
  BC.getCell(`A${bcr}`).font = FONT.section;
  BC.getCell(`A${bcr}`).fill = STYLE.sectionFill;
  BC.mergeCells(`A${bcr}:${col(2 + years.length)}${bcr}`);
  bcr += 1;

  // DSCR block reframed: Stabilised DSCR leads as the headline; Min DSCR is
  // demoted with year-of-occurrence suffix. Aggregates that follow are
  // rendered at normal emphasis.
  type AggEmphasis = 'headline' | 'sub' | 'normal';
  const aggRows: Array<[string, number, string, string, AggEmphasis]> = [
    ['Stabilised DSCR (2031, EBITDA / DS)  — headline', activeScenario.stabilisedYear?.dscr ?? 0, FMT.mul, 'ScenarioOutput.stabilisedYear.dscr — steady-state coverage, the number bankers underwrite to', 'headline'],
    [`   ↳ Min DSCR over loan life (post-ramp, worst-year stress)`, activeScenario.minDSCRLoanLife, FMT.mul, `ScenarioOutput.minDSCRLoanLife — covenant-floor check; min occurs in yr ${activeMinDscrYear ?? '—'} then recovers as NCF ramps`, 'sub'],
    ['LLCR (Loan Life Coverage Ratio)', activeScenario.llcr, FMT.mul, 'ScenarioOutput.llcr — NPV of CFADS over loan life ÷ outstanding debt', 'normal'],
    ['PLCR (Project Life Coverage Ratio)', activeScenario.plcr, FMT.mul, 'ScenarioOutput.plcr — NPV of CFADS over project life ÷ outstanding debt', 'normal'],
    ['ICR stabilised (2032)', activeScenario.icrStabilised, FMT.mul, 'ScenarioOutput.icrStabilised', 'normal'],
    ['DSCR covenant headroom', activeScenario.dscrCovenantHeadroom, FMT.pct, '(minDSCR − 1.25) / 1.25', 'normal'],
    ['Grace-period interest total (2026–28)', activeScenario.gracePeriodInterestTotal, FMT.euro, 'ScenarioOutput.gracePeriodInterestTotal', 'normal'],
    ['Peak debt outstanding (term + WC)', activeScenario.peakDebtOutstanding, FMT.euro, 'ScenarioOutput.peakDebtOutstanding', 'normal'],
    ['Net leverage (loan / stab EBITDA)', activeScenario.netLeverage, FMT.mul, 'ScenarioOutput.netLeverage', 'normal'],
  ];
  aggRows.forEach(([label, v, fmt, note, emphasis]) => {
    const labelCell = BC.getCell(`A${bcr}`);
    labelCell.value = label;
    const c = BC.getCell(`B${bcr}`);
    if (emphasis === 'headline') {
      labelCell.font = { bold: true, size: 13, color: { argb: 'FF8B6914' } };
      BC.getRow(bcr).height = 22;
      c.value = v;
      c.numFmt = fmt;
      c.fill = STYLE.totalFill;
      c.font = { bold: true, size: 13, color: { argb: 'FF8B6914' } };
    } else if (emphasis === 'sub') {
      labelCell.font = { italic: true, size: 9, color: { argb: 'FF777777' } };
      // Demoted min DSCR row carries the year-of-occurrence suffix in the
      // value cell (string form so the suffix fits alongside the number).
      const yrSuffix = activeMinDscrYear !== null ? ` · yr ${activeMinDscrYear}` : '';
      c.value = `${v.toFixed(2)}×${yrSuffix}`;
      c.font = { italic: true, size: 9, color: { argb: 'FF777777' } };
      c.fill = STYLE.formulaFill;
    } else {
      labelCell.font = FONT.bold;
      c.value = v;
      c.numFmt = fmt;
      c.fill = STYLE.totalFill;
      c.font = FONT.bold;
    }
    BC.getCell(`C${bcr}`).value = note;
    BC.getCell(`C${bcr}`).font = FONT.italic;
    BC.mergeCells(`C${bcr}:${col(2 + years.length)}${bcr}`);
    bcr += 1;
  });
  BC.views = [{ state: 'frozen', xSplit: 1, ySplit: 4 }];

  // ── Reorder: Cover, Financing Comparison, Amortisation, WC, Bank
  //    Coverage, then existing detail sheets. ExcelJS sorts by `orderNo`
  //    when serialising, so setting these explicitly is sufficient.
  type WsWithOrder = ExcelJS.Worksheet & { orderNo: number };
  const setOrder = (ws: ExcelJS.Worksheet, n: number) => { (ws as WsWithOrder).orderNo = n; };
  setOrder(cover, 1);
  setOrder(FC, 2);
  setOrder(AM, 3);
  setOrder(WC, 4);
  setOrder(BC, 5);
  setOrder(A, 6);
  setOrder(C, 7);
  setOrder(R, 8);
  setOrder(PnL, 9);
  setOrder(D, 10);
  setOrder(Cov, 11);
  setOrder(S, 12);
  // Cap Table and Waterfall are excluded from the banker pack
  const _CT = wb.getWorksheet(XL.sh_capTable);
  const _WF = wb.getWorksheet(XL.sh_waterfall);
  if (_CT) setOrder(_CT, 13);
  if (_WF) setOrder(_WF, 14);

  // ── Output ──
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ── Helpers ──

// Computed area, mirroring engine's areaOf.
function areaOfProp(p: PropertyConfig): number {
  const r = p.roomAreas;
  if (!r) return p.constructionArea ?? 0;
  const villaPerUnit =
    r.villaRooms && r.villaRooms.length > 0
      ? r.villaRooms.reduce((s, vr) => s + (vr.count || 0) * (vr.area || 0), 0)
      : (r.villaUnitArea ?? 0);
  const acc =
    p.villaUnits * villaPerUnit +
    p.standardSuites * (r.standardSuiteArea ?? 0) +
    p.doubleSuites * (r.doubleSuiteArea ?? 0);
  const common = (r.kitchen ?? 0) + (r.livingRoom ?? 0) + (r.utilityRoom ?? 0) + (r.staffRoom ?? 0) + (r.corridors ?? 0);
  const custom = (r.customSpaces ?? []).reduce((s, c) => s + (c.area || 0), 0);
  return acc + common + custom;
}

function pathLabel(path: string): string {
  if (path === 'grant') return 'Development Law Grant';
  if (path === 'rrf') return 'RRF Loan';
  if (path === 'tepix-loan') return 'TEPIX Loan Fund';
  if (path === 'optima') return 'Optima Bank';
  return 'Commercial Loan';
}

// Newton-Raphson IRR — same algorithm as the engine, used to pre-compute the
// IRR cell's `result` so the workbook opens with the value visible. Excel
// recomputes via its own IRR() on edit.
function computeIRR(cashFlows: number[], guess = 0.1): number {
  let r = guess;
  for (let i = 0; i < 60; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const denom = Math.pow(1 + r, t);
      npv += cashFlows[t] / denom;
      dnpv -= (t * cashFlows[t]) / (denom * (1 + r));
    }
    if (Math.abs(dnpv) < 1e-12) break;
    const nr = r - npv / dnpv;
    if (!isFinite(nr)) return 0;
    if (Math.abs(nr - r) < 1e-7) return nr;
    r = nr;
  }
  return r;
}
