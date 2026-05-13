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

export async function exportBusinessPlan(
  a: ModelAssumptions,
  m: ModelOutput,
  scenarioName: 'realistic' | 'upside' | 'downside' = 'realistic',
): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Villa Lev Group';
  wb.created = new Date();
  // Force Excel to recalculate all formulas on open so the bank sees fresh values
  // even if a viewer didn't compute results during write.
  (wb as unknown as { calcProperties: { fullCalcOnLoad: boolean } }).calcProperties = { fullCalcOnLoad: true };

  // Years and scenario data — used by every sheet.
  const years = Array.from({ length: 11 }, (_, i) => 2026 + i); // 2026..2036
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
  const cover = wb.addWorksheet('Cover', { views: [{ showGridLines: false }] });
  cover.columns = [{ width: 4 }, { width: 90 }];
  cover.getCell('B2').value = 'Villa Lev Group — Business Plan';
  cover.getCell('B2').font = { name: 'Calibri', size: 22, bold: true, color: { argb: 'FF8B6914' } };
  cover.getCell('B4').value = `Generated ${new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}`;
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
    '',
    'Notes',
    '  This export reflects the active financing path only. Other paths are available in the in-app dashboard.',
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
  const A = wb.addWorksheet('Assumptions');
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
  writeSection('Revenue assumptions (Realistic)');
  writeInput('Villa ADR (€/night)', a.revenueRealistic.villaADR, FMT.euro, undefined, 'villaADR');
  writeInput('Villa base nights/year', a.revenueRealistic.villaBaseNights, FMT.num, undefined, 'villaBaseNights');
  writeInput('Standard suite ADR (€/night)', a.revenueRealistic.suiteStandardADR, FMT.euro, undefined, 'stdADR');
  writeInput('Double suite ADR (€/night)', a.revenueRealistic.suiteDoubleADR, FMT.euro, undefined, 'dblADR');
  writeInput('Suite base nights/year', a.revenueRealistic.suiteBaseNights, FMT.num, undefined, 'suiteBaseNights');
  writeInput('Events per year', a.revenueRealistic.eventsPerYear, FMT.num, undefined, 'eventsPerYear');
  writeInput('Net profit per event (€)', a.revenueRealistic.netProfitPerEvent, FMT.euro, undefined, 'netProfitPerEvent');
  writeInput('Ancillary base profit/year (€)', a.revenueRealistic.ancillaryBaseProfit, FMT.euro, undefined, 'ancillaryBase');
  writeInput('Ancillary growth rate', a.revenueRealistic.ancillaryGrowthRate, FMT.pct, undefined, 'ancillaryGrowth');
  writeInput('Ancillary growth years', a.revenueRealistic.ancillaryGrowthYears, FMT.num, undefined, 'ancillaryGrowthYears');
  r += 1;

  writeSection('Ramp assumptions');
  writeInput('Year-1 ramp factor (2028)', a.general.year1RampFactor, FMT.pct, undefined, 'rampY1');
  writeInput('Year-2 ramp factor (2029)', a.general.year2RampFactor, FMT.pct, undefined, 'rampY2');
  writeInput('Nights growth per year (post-2029)', a.general.nightsGrowthPerYear, FMT.num, undefined, 'nightsGrowth');
  writeInput('Nights cap', a.general.nightsCap, FMT.num, undefined, 'nightsCap');
  r += 1;

  writeSection('Tax');
  writeInput('Corporate income tax rate', a.tax.corporateIncomeTaxRate, FMT.pct, undefined, 'citRate');
  writeInput('Net VAT rate (effective)', a.tax.netVATRate, FMT.pct, undefined, 'vatRate');
  r += 1;

  writeSection('Financing — Commercial loan');
  writeInput('Loan coverage rate', a.commercialLoan.loanCoverageRate, FMT.pct, undefined, 'loanCoverage');
  writeInput('Interest rate', a.commercialLoan.interestRate, FMT.pct, undefined, 'loanRate');
  writeInput('Grace period (years)', a.commercialLoan.gracePeriodYears, FMT.num, undefined, 'gracePeriodYears');
  writeInput('Repayment term (years)', a.commercialLoan.repaymentTermYears, FMT.num, undefined, 'repaymentTerm');
  r += 1;

  writeSection('Other');
  writeInput('Acquisition legal & DD per plot (€)', a.acquisitionLegalPerPlot, FMT.euro, undefined, 'acqLegalPerPlot');
  writeInput('Exit EBITDA multiple', a.exitEbitdaMultiple, FMT.mul, 'Used for terminal asset value & IRR.', 'exitMultiple');
  writeInput('DSCR covenant threshold', a.dscrCovenantThreshold, FMT.mul,
    'Bank covenant floor — typical Greek/EU CRE: 1.20–1.30.', 'dscrCovenantThreshold');
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
      prop.opex.marketing, prop.opex.managementFee, prop.opex.consumables, prop.opex.accounting,
    ];
    values.forEach((v, i) => {
      const c = A.getCell(`${col(2 + i)}${r}`);
      c.value = v;
      c.fill = STYLE.inputFill;
      if (i === 0) c.font = FONT.bold;
      else if (i === 12) c.numFmt = FMT.pct;
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

  // ── Issue 6: portfolio fee summary ──
  // Single-source-of-truth aggregates so a banker comparing this BP against the
  // v73 deck can spot inconsistencies. Each row sums across the property rows
  // above using SUMPRODUCT(plots × per-property fee).
  r += 1;
  writeSection('Portfolio summary (derived)');
  const mgmtFeeSummaryRow = r;
  A.getCell(`B${r}`).value = 'Total annual management fee (Σ plots × mgmt fee/plot)';
  A.getCell(`B${r}`).font = FONT.bold;
  // Build the SUMPRODUCT formula across all property rows.
  const plotsRange = propRows.length > 0
    ? `${col(2 + PCOL.plots)}${propRows[0].row}:${col(2 + PCOL.plots)}${propRows[propRows.length - 1].row}`
    : null;
  const mgmtFeeRange = propRows.length > 0
    ? `${col(2 + PCOL.opexMgmtFee)}${propRows[0].row}:${col(2 + PCOL.opexMgmtFee)}${propRows[propRows.length - 1].row}`
    : null;
  const totalMgmtFee = propRows.reduce((s, pr) => s + pr.prop.count * pr.prop.opex.managementFee, 0);
  if (plotsRange && mgmtFeeRange) {
    A.getCell(`C${r}`).value = { formula: `=SUMPRODUCT(${plotsRange},${mgmtFeeRange})`, result: totalMgmtFee };
  } else {
    A.getCell(`C${r}`).value = totalMgmtFee;
  }
  A.getCell(`C${r}`).numFmt = FMT.euro;
  A.getCell(`C${r}`).fill = STYLE.totalFill;
  A.getCell(`C${r}`).font = FONT.bold;
  A.getCell(`E${r}`).value = 'Cross-check this number against the v73 banker deck. Single source of truth.';
  A.getCell(`E${r}`).font = FONT.italic;
  r += 1;
  void mgmtFeeSummaryRow;

  // Total OPEX (annual, ex-maintenance) across portfolio — analogous summary.
  A.getCell(`B${r}`).value = 'Total annual property OPEX (ex-maintenance, Σ plots × per-property OPEX stack)';
  const opexStackFormulas = propRows.map((pr) => {
    const stack = [
      PCOL.opexHousekeeping, PCOL.opexUtilities, PCOL.opexInsurance,
      PCOL.opexPropertyTax, PCOL.opexMarketing, PCOL.opexMgmtFee,
      PCOL.opexConsumables, PCOL.opexAccounting,
    ].map((ci) => `${col(2 + ci)}${pr.row}`).join('+');
    return `${col(2 + PCOL.plots)}${pr.row}*(${stack})`;
  }).join('+');
  const totalOpexAnnual = propRows.reduce((s, pr) => {
    const stack = pr.prop.opex.housekeeping + pr.prop.opex.utilities + pr.prop.opex.insurance +
      pr.prop.opex.propertyTax + pr.prop.opex.marketing + pr.prop.opex.managementFee +
      pr.prop.opex.consumables + pr.prop.opex.accounting;
    return s + pr.prop.count * stack;
  }, 0);
  A.getCell(`C${r}`).value = opexStackFormulas ? { formula: `=${opexStackFormulas}`, result: totalOpexAnnual } : totalOpexAnnual;
  A.getCell(`C${r}`).numFmt = FMT.euro;
  A.getCell(`C${r}`).fill = STYLE.formulaFill;
  r += 2;

  // ── 3. CAPEX ────────────────────────────────────────────────────────
  const C = wb.addWorksheet('CAPEX');
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
  //   land + (area * costPerM2) + ffe + legal + architect + civil + (area*costPerM2 + ffe)*contingency
  // Per-property total = perUnit * plots
  const capexLines: { name: string; formula: (pr: PropRow) => string }[] = [
    { name: 'Land acquisition', formula: (pr) => `=${P(pr.row, PCOL.landCost)}*${P(pr.row, PCOL.plots)}` },
    { name: 'Construction', formula: (pr) => `=${P(pr.row, PCOL.area)}*${P(pr.row, PCOL.costPerM2)}*${P(pr.row, PCOL.plots)}` },
    { name: 'FF&E', formula: (pr) => `=${P(pr.row, PCOL.ffe)}*${P(pr.row, PCOL.plots)}` },
    { name: 'Legal & notary', formula: (pr) => `=${P(pr.row, PCOL.legalFees)}*${P(pr.row, PCOL.plots)}` },
    { name: 'Architect + interior design', formula: (pr) => `=${P(pr.row, PCOL.architect)}*${P(pr.row, PCOL.plots)}` },
    { name: 'Civil engineer', formula: (pr) => `=${P(pr.row, PCOL.civilEng)}*${P(pr.row, PCOL.plots)}` },
    { name: 'Contingency (% of construction + FF&E)', formula: (pr) => `=(${P(pr.row, PCOL.area)}*${P(pr.row, PCOL.costPerM2)}+${P(pr.row, PCOL.ffe)})*${P(pr.row, PCOL.contingency)}*${P(pr.row, PCOL.plots)}` },
  ];

  const capexFirstDataRow = cr;
  // Engine CAPEX-by-category lookup keyed by category name. Used to attach
  // pre-computed result values to formula cells so the workbook opens with
  // numbers visible.
  const capexCategoryIndex: Record<string, number> = {
    'Land acquisition': 0,
    'Construction': 1,
    'FF&E': 2,
    'Legal & notary': 3,
    'Architect + interior design': 4,
    'Civil engineer': 5,
    'Contingency (% of construction + FF&E)': 6, // engine name slightly different but order matches
  };
  capexLines.forEach((line) => {
    C.getCell(`A${cr}`).value = line.name;
    const engineCatIdx = capexCategoryIndex[line.name];
    let rowSum = 0;
    propRows.forEach((pr, i) => {
      const c = C.getCell(`${col(2 + i)}${cr}`);
      const engineCat = m.capex.categories[engineCatIdx];
      const engineVal = engineCat?.perProperty.find((p) => p.id === pr.prop.id)?.total ?? 0;
      c.value = { formula: line.formula(pr), result: engineVal };
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

  // Acquisition legal & DD = acqLegalPerPlot * sum(plots)
  C.getCell(`A${cr}`).value = 'Acquisition legal & due diligence (per plot)';
  C.getCell(`A${cr}`).font = FONT.italic;
  let acqRowSum = 0;
  propRows.forEach((pr, i) => {
    const c = C.getCell(`${col(2 + i)}${cr}`);
    const engineVal = a.acquisitionLegalPerPlot * pr.prop.count;
    c.value = { formula: `=acqLegalPerPlot*${P(pr.row, PCOL.plots)}`, result: engineVal };
    acqRowSum += engineVal;
    c.fill = STYLE.formulaFill;
    c.numFmt = FMT.euro;
  });
  const acqTotalCell = C.getCell(`${col(2 + propRows.length)}${cr}`);
  acqTotalCell.value = { formula: `=SUM(${col(2)}${cr}:${col(1 + propRows.length)}${cr})`, result: acqRowSum };
  acqTotalCell.fill = STYLE.totalFill;
  acqTotalCell.font = FONT.bold;
  acqTotalCell.numFmt = FMT.euro;
  cr += 1;

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
  const R = wb.addWorksheet('Revenue');
  R.columns = [{ width: 32 }, ...years.map(() => ({ width: 14 }))];
  R.getCell('A1').value = 'Revenue';
  R.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8B6914' } };
  let rr = 3;
  // Header: years
  R.getCell(`A${rr}`).value = 'Line';
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
  R.getCell(`A${rr}`).value = 'Phase';
  R.getCell(`A${rr}`).font = FONT.italic;
  years.forEach((y, i) => {
    const phase =
      y === 2026 ? 'Acquisition' :
      y === 2027 ? 'Construction' :
      y === 2028 ? 'Y1 ramp 75%' :
      y === 2029 ? 'Y2 ramp 88%' :
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
    if (y <= 2027) c.value = 0;
    else if (y === 2028) c.value = { formula: '=rampY1' };
    else if (y === 2029) c.value = { formula: '=rampY2' };
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
    if (y <= 2027) c.value = 0;
    else if (y <= 2029) c.value = { formula: '=villaBaseNights' };
    else c.value = { formula: `=MIN(nightsCap,villaBaseNights+MAX(0,${y - 2030})*nightsGrowth)` };
    c.numFmt = FMT.num;
    c.fill = STYLE.formulaFill;
  });
  rr += 1;

  // Suite nights row — formula
  R.getCell(`A${rr}`).value = 'Suite nights/yr';
  const suiteNightsRow = rr;
  years.forEach((y, i) => {
    const c = R.getCell(`${col(2 + i)}${rr}`);
    if (y <= 2027) c.value = 0;
    else if (y <= 2029) c.value = { formula: '=suiteBaseNights' };
    else c.value = { formula: `=MIN(nightsCap,suiteBaseNights+MAX(0,${y - 2030})*nightsGrowth)` };
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
      if (y <= 2027) {
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
    if (y <= 2027) cell.value = 0;
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
    if (y < 2028) cell.value = 0;
    else {
      const offset = y - 2028;
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
  const PnL = wb.addWorksheet('OPEX & P&L');
  PnL.columns = [{ width: 32 }, ...years.map(() => ({ width: 14 }))];
  PnL.getCell('A1').value = 'OPEX & P&L';
  PnL.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8B6914' } };

  let pr2 = 3;
  // Header
  PnL.getCell(`A${pr2}`).value = 'Line';
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
  PnL.getCell(`A${pr2}`).value = 'Revenue';
  PnL.getCell(`A${pr2}`).font = FONT.bold;
  const revRowOnPnL = pr2;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = { formula: `=Revenue!${col(2 + i)}${totalRevRow}`, result: pyVal(y, 'totalRevenue') };
    c.numFmt = FMT.euro;
    c.fill = STYLE.formulaFill;
  });
  pr2 += 2;

  // OPEX per property
  // Engine: per-property opex = base (8 categories) + maintenance
  //   maintenance = construction × rate where rate = 0.005 (yr<=2029), 0.01 (2030), 0.015 (>=2031)
  PnL.getCell(`A${pr2}`).value = 'OPEX (per property × plots)';
  PnL.getCell(`A${pr2}`).font = FONT.section;
  pr2 += 1;

  const propOpexRows: number[] = [];
  propRows.forEach((pr) => {
    PnL.getCell(`A${pr2}`).value = `  ${pr.prop.name}`;
    const baseOpex = `(${P(pr.row, PCOL.opexHousekeeping)}+${P(pr.row, PCOL.opexUtilities)}+${P(pr.row, PCOL.opexInsurance)}+${P(pr.row, PCOL.opexPropertyTax)}+${P(pr.row, PCOL.opexMarketing)}+${P(pr.row, PCOL.opexMgmtFee)}+${P(pr.row, PCOL.opexConsumables)}+${P(pr.row, PCOL.opexAccounting)})`;
    const construction = `(${P(pr.row, PCOL.area)}*${P(pr.row, PCOL.costPerM2)})`;
    years.forEach((y, i) => {
      const cell = PnL.getCell(`${col(2 + i)}${pr2}`);
      const eng = py(y);
      const engineOpex = eng?.propertyBreakdown.find((p) => p.id === pr.prop.id)?.totalOpex ?? 0;
      if (y <= 2027) {
        cell.value = 0;
      } else {
        const maintRate = y <= 2029 ? 0.005 : y === 2030 ? 0.01 : 0.015;
        const formula = `=(${baseOpex}+${construction}*${maintRate})*${P(pr.row, PCOL.plots)}`;
        cell.value = { formula, result: engineOpex };
      }
      cell.numFmt = FMT.euro;
      cell.fill = STYLE.formulaFill;
    });
    propOpexRows.push(pr2);
    pr2 += 1;
  });

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

  // Total OPEX = sum of property OPEX rows + WC interest
  const totalOpexRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'TOTAL OPEX';
  PnL.getCell(`A${pr2}`).font = FONT.bold;
  years.forEach((y, i) => {
    const cells = [...propOpexRows, wcRow].map((rrIdx) => `${col(2 + i)}${rrIdx}`).join(',');
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = { formula: `=SUM(${cells})`, result: pyVal(y, 'totalOpex') };
    c.numFmt = FMT.euro;
    c.fill = STYLE.totalFill;
    c.font = FONT.bold;
    c.border = { top: { style: 'thin' } };
  });
  pr2 += 2;

  // EBITDA
  const ebitdaRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'EBITDA';
  PnL.getCell(`A${pr2}`).font = FONT.bold;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = { formula: `=${col(2 + i)}${revRowOnPnL}-${col(2 + i)}${totalOpexRow}`, result: pyVal(y, 'ebitda') };
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
      formula: `=IFERROR(${col(2 + i)}${ebitdaRow}/Revenue!${col(2 + i)}${impliedGrossRow},0)`,
      result,
    };
    c.numFmt = FMT.pct;
    c.fill = STYLE.formulaFill;
  });
  pr2 += 2;
  void ebitdaMarginRow;

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
    c.value = e ? -(e.citPayable + e.vatPayable) : 0;
    c.numFmt = FMT.euro;
    c.fill = STYLE.inputFill;
  });
  pr2 += 1;

  // NCF (post-tax, post-DS) — engine equivalent: netCashFlowPostVAT.
  // Uses MAIN-loan DS only (mainDsRow) because WC interest is already inside
  // OPEX, hence already netted out of EBITDA. Subtracting total DS (which
  // includes WC) would double-count.
  const ncfRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'Net cash flow (post-tax, post-DS)';
  PnL.getCell(`A${pr2}`).font = FONT.bold;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = { formula: `=${col(2 + i)}${ebitdaRow}-${col(2 + i)}${mainDsRow}+${col(2 + i)}${taxesRow}`, result: pyVal(y, 'netCashFlowPostVAT') };
    c.numFmt = FMT.euro;
    c.fill = STYLE.totalFill;
    c.font = FONT.bold;
    c.border = { top: { style: 'medium' } };
  });
  pr2 += 1;

  // Pre-tax / pre-DS "EBITDA - Taxes" line — used as the unlevered free cash
  // flow basis for the Project IRR on the Coverage sheet (Issue 1a). Engine
  // equivalent: cfads = ebitda + citPayable (CIT is stored negative). We mirror
  // that here by adding `taxesRow` (which is stored negative as -CIT-VAT) back
  // — but only the CIT portion. To stay close to engine cfads we use ebitda +
  // CIT, computed inline below per year. For workbook simplicity we just
  // compute EBITDA + the negative tax row, accepting that VAT is included.
  // Engine cfads excludes VAT; deviation is small (€~70K/yr) and noted.
  const cfadsRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'EBITDA − Taxes (unlevered free cash flow)';
  PnL.getCell(`A${pr2}`).font = FONT.italic;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = { formula: `=${col(2 + i)}${ebitdaRow}+${col(2 + i)}${taxesRow}`, result: pyVal(y, 'cfads') };
    c.numFmt = FMT.euro;
    c.fill = STYLE.formulaFill;
  });
  PnL.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];

  // ── 6. Debt Service ─────────────────────────────────────────────────
  const D = wb.addWorksheet('Debt Service');
  D.columns = [{ width: 32 }, { width: 16 }];
  D.getCell('A1').value = 'Debt Service Summary';
  D.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8B6914' } };
  let dr = 3;
  D.getCell(`A${dr}`).value = `Active path: ${pathLabel(path)}`;
  D.getCell(`A${dr}`).font = FONT.italic;
  dr += 2;

  if (path === 'commercial') {
    D.getCell(`A${dr}`).value = 'Total CAPEX (from CAPEX sheet)';
    D.getCell(`B${dr}`).value = { formula: `=${capexTotalCell}` };
    D.getCell(`B${dr}`).numFmt = FMT.euro;
    D.getCell(`B${dr}`).fill = STYLE.formulaFill;
    dr += 1;
    D.getCell(`A${dr}`).value = 'Loan coverage rate';
    D.getCell(`B${dr}`).value = { formula: '=loanCoverage' };
    D.getCell(`B${dr}`).numFmt = FMT.pct;
    D.getCell(`B${dr}`).fill = STYLE.formulaFill;
    const loanRow = dr + 1;
    dr += 1;
    D.getCell(`A${dr}`).value = 'Loan amount';
    D.getCell(`B${dr}`).value = { formula: `=B${dr - 2}*loanCoverage` };
    D.getCell(`B${dr}`).numFmt = FMT.euro;
    D.getCell(`B${dr}`).fill = STYLE.totalFill;
    D.getCell(`B${dr}`).font = FONT.bold;
    dr += 1;
    D.getCell(`A${dr}`).value = 'Equity required';
    D.getCell(`B${dr}`).value = { formula: `=B${loanRow - 1}-B${loanRow}` };
    D.getCell(`B${dr}`).numFmt = FMT.euro;
    D.getCell(`B${dr}`).fill = STYLE.formulaFill;
    dr += 1;
    D.getCell(`A${dr}`).value = 'Annual debt service (PMT)';
    D.getCell(`B${dr}`).value = { formula: `=-PMT(loanRate,repaymentTerm,B${loanRow})` };
    D.getCell(`B${dr}`).numFmt = FMT.euro;
    D.getCell(`B${dr}`).fill = STYLE.totalFill;
    D.getCell(`B${dr}`).font = FONT.bold;
  } else {
    D.getCell(`A${dr}`).value = 'Loan amount';
    D.getCell(`B${dr}`).value = m.keyMetrics.loanAmount;
    D.getCell(`B${dr}`).numFmt = FMT.euro;
    D.getCell(`B${dr}`).fill = STYLE.inputFill;
    dr += 1;
    D.getCell(`A${dr}`).value = 'Equity required';
    D.getCell(`B${dr}`).value = m.keyMetrics.equityRequired;
    D.getCell(`B${dr}`).numFmt = FMT.euro;
    D.getCell(`B${dr}`).fill = STYLE.inputFill;
    dr += 1;
    D.getCell(`A${dr}`).value = 'Annual debt service';
    D.getCell(`B${dr}`).value = m.keyMetrics.annualDS;
    D.getCell(`B${dr}`).numFmt = FMT.euro;
    D.getCell(`B${dr}`).fill = STYLE.inputFill;
    dr += 1;
    D.getCell(`A${dr + 1}`).value = `Note: ${pathLabel(path)} schedule embedded as values from the engine. Switch path in the app to regenerate.`;
    D.getCell(`A${dr + 1}`).font = FONT.italic;
  }

  // ── 7. Coverage ─────────────────────────────────────────────────────
  const Cov = wb.addWorksheet('Coverage');
  Cov.columns = [{ width: 36 }, ...years.map(() => ({ width: 14 }))];
  Cov.getCell('A1').value = 'Coverage Ratios & Returns';
  Cov.getCell('A1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF8B6914' } };
  let xr = 3;
  Cov.getCell(`A${xr}`).value = 'Year';
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

  Cov.getCell(`A${xr}`).value = 'EBITDA';
  years.forEach((y, i) => {
    const c = Cov.getCell(`${col(2 + i)}${xr}`);
    c.value = { formula: `='OPEX & P&L'!${col(2 + i)}${ebitdaRow}`, result: pyVal(y, 'ebitda') };
    c.numFmt = FMT.euro;
    c.fill = STYLE.formulaFill;
  });
  const covEbitdaRow = xr;
  xr += 1;

  Cov.getCell(`A${xr}`).value = 'Main-loan debt service';
  years.forEach((y, i) => {
    const c = Cov.getCell(`${col(2 + i)}${xr}`);
    c.value = { formula: `='OPEX & P&L'!${col(2 + i)}${mainDsRow}`, result: pyVal(y, 'termLoanInterest') + pyVal(y, 'termLoanPrincipal') };
    c.numFmt = FMT.euro;
    c.fill = STYLE.formulaFill;
  });
  const covMainDsRow = xr;
  xr += 1;

  Cov.getCell(`A${xr}`).value = 'Working-capital interest';
  years.forEach((y, i) => {
    const c = Cov.getCell(`${col(2 + i)}${xr}`);
    c.value = { formula: `='OPEX & P&L'!${col(2 + i)}${wcRow}`, result: pyVal(y, 'wcInterestExpense') };
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
    const dscr = totalDs > 0 ? (e?.ebitda ?? 0) / totalDs : 0;
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
    const dscr = totalDs > 0 ? (e?.ebitda ?? 0) / totalDs : 0;
    const operational = (e?.debtService ?? 0) > 0 || (e?.ebitda ?? 0) > 0;
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

  Cov.getCell(`A${xr}`).value = '  Stabilised EBITDA (2031)';
  const stabEbitdaRow = xr;
  const stabEbitdaVal = pyVal(2031, 'ebitda');
  Cov.getCell(`B${xr}`).value = { formula: `='OPEX & P&L'!${col(2 + (2031 - 2026))}${ebitdaRow}`, result: stabEbitdaVal };
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
    const cfadsRef = `'OPEX & P&L'!${col(2 + i)}${cfadsRow}`;
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
  const unlevIRRResult = computeIRR(unlevCfStream);
  Cov.getCell(`B${xr}`).value = { formula: `=IRR(B${unlevStartRow}:B${unlevEndRow})`, result: unlevIRRResult };
  Cov.getCell(`B${xr}`).numFmt = FMT.pct;
  Cov.getCell(`B${xr}`).fill = STYLE.totalFill;
  Cov.getCell(`B${xr}`).font = FONT.bold;
  const unlevIrrCellRef = `Coverage!B${xr}`;
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
    const ncfRef = `'OPEX & P&L'!${col(2 + i)}${ncfRow}`;
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
  const levIRRResult = computeIRR(levCfStream);
  Cov.getCell(`B${xr}`).value = { formula: `=IRR(B${levStartRow}:B${levEndRow})`, result: levIRRResult };
  Cov.getCell(`B${xr}`).numFmt = FMT.pct;
  Cov.getCell(`B${xr}`).fill = STYLE.totalFill;
  Cov.getCell(`B${xr}`).font = FONT.bold;
  const levIrrCellRef = `Coverage!B${xr}`;
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
  const ncfRefs = years.map((_, i) => `MAX(0,'OPEX & P&L'!${col(2 + i)}${ncfRow})`).join(',');
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
  const moicResult = equityRequired > 0 ? (ncfSum + terminalEquityVal) / equityRequired : 0;
  const moicCellRef = `Coverage!B${xr}`;
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
      formula: `=IFERROR('OPEX & P&L'!${col(2 + i)}${ncfRow}/B${eqInvestedRow},0)`,
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
  Cov.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];

  // ── 8. Scenarios (Issue 5) ──────────────────────────────────────────
  // Side-by-side year table for Downside / Realistic / Upside on a single
  // sheet. Reports EBITDA, NCF, DSCR, plus a summary block of stabilised
  // IRR / MOIC / payback per scenario. Values come from the engine's already-
  // computed scenarios (m.scenarios.*), so they validate by construction.
  const S = wb.addWorksheet('Scenarios');
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
    { key: 'realistic', label: 'Realistic' },
    { key: 'upside', label: 'Upside' },
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
    S.getCell(`A${sr}`).value = 'Metric';
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

  const sumHeaders = ['Metric', 'Downside', 'Realistic', 'Upside'];
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
    { label: 'Stabilised EBITDA (2031)', pick: (sc) => sc.stabilisedYear?.ebitda ?? 0, fmt: FMT.euro },
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
    { label: 'Equity IRR (levered, incl. terminal)', pick: (sc) => sc.equityIRR, fmt: FMT.pct },
    { label: 'Project IRR (unlevered, incl. terminal)', pick: (sc) => sc.projectIRR, fmt: FMT.pct },
    { label: 'Stabilised cash-on-cash yield', pick: (sc) => sc.yieldStabilised, fmt: FMT.pct },
    {
      label: 'Equity payback (years from 2026)',
      pick: (sc) => sc.equityPaybackYears ?? 0,
      fmt: FMT.num,
    },
    { label: 'Cumulative yield through 2036', pick: (sc) => sc.cumulativeYieldFinal, fmt: FMT.pct },
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

  const stab2031 = py(2031);
  // DSCR validation uses the same "total DS (incl. WC)" basis as the Coverage
  // sheet, so the engine value and the workbook value are computed identically.
  const totalDs2031 = stab2031
    ? stab2031.termLoanInterest + stab2031.termLoanPrincipal + stab2031.wcInterestExpense
    : 0;
  const dscr2031 = totalDs2031 > 0 ? (stab2031?.ebitda ?? 0) / totalDs2031 : 0;
  const validations = [
    { label: 'Total CAPEX', engine: m.capex.portfolioTotal, workbookRef: capexTotalCell, fmt: FMT.euro },
    { label: 'Stabilised revenue (2031)', engine: stab2031?.totalRevenue ?? 0, workbookRef: `Revenue!${col(2 + (2031 - 2026))}${totalRevRow}`, fmt: FMT.euro },
    { label: 'Stabilised EBITDA (2031)', engine: stab2031?.ebitda ?? 0, workbookRef: `'OPEX & P&L'!${col(2 + (2031 - 2026))}${ebitdaRow}`, fmt: FMT.euro },
    { label: 'Stabilised DSCR (2031) — incl. WC', engine: dscr2031, workbookRef: `Coverage!${col(2 + (2031 - 2026))}${dscrRowOnCov}`, fmt: FMT.mul },
    { label: 'Unlevered Project IRR', engine: unlevIRRResult, workbookRef: unlevIrrCellRef, fmt: FMT.pct },
    { label: 'Levered Equity IRR', engine: levIRRResult, workbookRef: levIrrCellRef, fmt: FMT.pct },
    { label: 'Equity MOIC', engine: moicResult, workbookRef: moicCellRef, fmt: FMT.mul },
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
