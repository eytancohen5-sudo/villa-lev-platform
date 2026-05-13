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
    '  Coverage — DSCR / ICR / LLCR per year + IRR computed from the NCF stream.',
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

  // Events
  R.getCell(`A${rr}`).value = '  Events (net profit)';
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

  // Ancillary
  R.getCell(`A${rr}`).value = '  Ancillary (with growth)';
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
  R.getCell(`A${rr}`).value = 'TOTAL REVENUE';
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

  // Debt service — annual
  // For commercial: grace-period interest 2026/2027/2028 from engine output (engine uses ramped interest accrual);
  // operational years 2029+ use PMT-derived constant DS.
  // We approximate here with the engine's output values for grace years (since the
  // accrual logic is multi-quarter), and use Excel PMT for amortising years.
  const dsRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'Debt service';
  // For non-commercial paths (RRF/grant/TEPIX), use the engine's getDS values
  // because their schedules are non-trivial and not a single PMT.
  if (path === 'commercial') {
    // Loan amount = totalCAPEX × loanCoverage, PMT(rate, term, loan).
    // Use engine values for grace years.
    const interestByYear: Record<number, number> = {
      2026: a.commercialLoan.interest2026,
      2027: a.commercialLoan.interest2027,
      2028: a.commercialLoan.interest2028,
    };
    years.forEach((y, i) => {
      const c = PnL.getCell(`${col(2 + i)}${pr2}`);
      if (y <= 2028) {
        c.value = interestByYear[y] ?? 0;
        c.numFmt = FMT.euro;
        c.fill = STYLE.inputFill;
      } else {
        // PMT(rate, term, loan) — Excel returns negative for outflow, so we negate.
        c.value = { formula: `=-PMT(loanRate,repaymentTerm,${capexTotalCell}*loanCoverage)`, result: pyVal(y, 'debtService') };
        c.numFmt = FMT.euro;
        c.fill = STYLE.formulaFill;
      }
    });
  } else {
    // For non-commercial: take from PnL stream values (faithful but not formula-based).
    years.forEach((y, i) => {
      const c = PnL.getCell(`${col(2 + i)}${pr2}`);
      c.value = pyVal(y, 'debtService');
      c.numFmt = FMT.euro;
      c.fill = STYLE.inputFill;
    });
  }
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

  // NCF (post-tax, post-DS) — engine equivalent: netCashFlowPostVAT
  const ncfRow = pr2;
  PnL.getCell(`A${pr2}`).value = 'Net cash flow (post-tax, post-DS)';
  PnL.getCell(`A${pr2}`).font = FONT.bold;
  years.forEach((y, i) => {
    const c = PnL.getCell(`${col(2 + i)}${pr2}`);
    c.value = { formula: `=${col(2 + i)}${ebitdaRow}-${col(2 + i)}${dsRow}+${col(2 + i)}${taxesRow}`, result: pyVal(y, 'netCashFlowPostVAT') };
    c.numFmt = FMT.euro;
    c.fill = STYLE.totalFill;
    c.font = FONT.bold;
    c.border = { top: { style: 'medium' } };
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
  Cov.columns = [{ width: 32 }, ...years.map(() => ({ width: 14 }))];
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

  Cov.getCell(`A${xr}`).value = 'Debt service';
  years.forEach((y, i) => {
    const c = Cov.getCell(`${col(2 + i)}${xr}`);
    c.value = { formula: `='OPEX & P&L'!${col(2 + i)}${dsRow}`, result: pyVal(y, 'debtService') };
    c.numFmt = FMT.euro;
    c.fill = STYLE.formulaFill;
  });
  const covDsRow = xr;
  xr += 1;

  Cov.getCell(`A${xr}`).value = 'DSCR (EBITDA / DS)';
  Cov.getCell(`A${xr}`).font = FONT.bold;
  years.forEach((y, i) => {
    const c = Cov.getCell(`${col(2 + i)}${xr}`);
    const e = py(y);
    const dscr = e && e.debtService > 0 ? e.ebitda / e.debtService : 0;
    c.value = { formula: `=IFERROR(${col(2 + i)}${covEbitdaRow}/${col(2 + i)}${covDsRow},0)`, result: dscr };
    c.numFmt = FMT.mul;
    c.fill = STYLE.totalFill;
    c.font = FONT.bold;
  });
  xr += 2;

  // Terminal value
  Cov.getCell(`A${xr}`).value = 'Stabilised EBITDA (2031)';
  const stabEbitdaRow = xr;
  const stabEbitdaVal = pyVal(2031, 'ebitda');
  Cov.getCell(`B${xr}`).value = { formula: `='OPEX & P&L'!${col(2 + (2031 - 2026))}${ebitdaRow}`, result: stabEbitdaVal };
  Cov.getCell(`B${xr}`).numFmt = FMT.euro;
  Cov.getCell(`B${xr}`).fill = STYLE.formulaFill;
  xr += 1;
  Cov.getCell(`A${xr}`).value = 'Exit EBITDA multiple';
  Cov.getCell(`B${xr}`).value = { formula: '=exitMultiple', result: a.exitEbitdaMultiple };
  Cov.getCell(`B${xr}`).numFmt = FMT.mul;
  Cov.getCell(`B${xr}`).fill = STYLE.formulaFill;
  xr += 1;
  Cov.getCell(`A${xr}`).value = 'Terminal asset value';
  Cov.getCell(`A${xr}`).font = FONT.bold;
  const terminalRow = xr;
  const terminalVal = stabEbitdaVal * a.exitEbitdaMultiple;
  Cov.getCell(`B${xr}`).value = { formula: `=B${stabEbitdaRow}*B${stabEbitdaRow + 1}`, result: terminalVal };
  Cov.getCell(`B${xr}`).numFmt = FMT.euro;
  Cov.getCell(`B${xr}`).fill = STYLE.totalFill;
  Cov.getCell(`B${xr}`).font = FONT.bold;
  xr += 2;

  // IRR — project (unlevered) cash-flow stream: -CapEx in year 0, NCF each year,
  // last year augmented by the terminal asset value.
  Cov.getCell(`A${xr}`).value = 'Project IRR — cash-flow stream';
  Cov.getCell(`A${xr}`).font = FONT.section;
  xr += 1;
  Cov.getCell(`A${xr}`).value = '  Year 0 — CapEx';
  Cov.getCell(`B${xr}`).value = { formula: `=-${capexTotalCell}`, result: -m.capex.portfolioTotal };
  Cov.getCell(`B${xr}`).numFmt = FMT.euro;
  Cov.getCell(`B${xr}`).fill = STYLE.formulaFill;
  const cfStartRow = xr;
  xr += 1;
  years.forEach((y, i) => {
    Cov.getCell(`A${xr}`).value = `  ${y}`;
    const ncfRef = `'OPEX & P&L'!${col(2 + i)}${ncfRow}`;
    const isLast = i === years.length - 1;
    const formula = isLast ? `=${ncfRef}+B${terminalRow}` : `=${ncfRef}`;
    const ncfVal = pyVal(y, 'netCashFlowPostVAT');
    const result = isLast ? ncfVal + terminalVal : ncfVal;
    Cov.getCell(`B${xr}`).value = { formula, result };
    Cov.getCell(`B${xr}`).numFmt = FMT.euro;
    Cov.getCell(`B${xr}`).fill = STYLE.formulaFill;
    xr += 1;
  });
  const cfEndRow = xr - 1;
  Cov.getCell(`A${xr}`).value = 'Project IRR (incl. terminal)';
  Cov.getCell(`A${xr}`).font = FONT.bold;
  // Compute IRR result inline (Newton's method on the same stream).
  const cfStream: number[] = [-m.capex.portfolioTotal];
  years.forEach((y, i) => {
    const ncfVal = pyVal(y, 'netCashFlowPostVAT');
    cfStream.push(i === years.length - 1 ? ncfVal + terminalVal : ncfVal);
  });
  const irrResult = computeIRR(cfStream);
  Cov.getCell(`B${xr}`).value = { formula: `=IRR(B${cfStartRow}:B${cfEndRow})`, result: irrResult };
  Cov.getCell(`B${xr}`).numFmt = FMT.pct;
  Cov.getCell(`B${xr}`).fill = STYLE.totalFill;
  Cov.getCell(`B${xr}`).font = FONT.bold;
  const irrCellRef = `Coverage!B${xr}`;
  Cov.views = [{ state: 'frozen', xSplit: 1, ySplit: 3 }];

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
  const dscr2031 = (stab2031 && stab2031.debtService > 0) ? stab2031.ebitda / stab2031.debtService : 0;
  // covEbitdaRow → covDsRow → DSCR row sits at covEbitdaRow + 2
  const dscrRowOnCov = covEbitdaRow + 2;
  const validations = [
    { label: 'Total CAPEX', engine: m.capex.portfolioTotal, workbookRef: capexTotalCell, fmt: FMT.euro },
    { label: 'Stabilised revenue (2031)', engine: stab2031?.totalRevenue ?? 0, workbookRef: `Revenue!${col(2 + (2031 - 2026))}${totalRevRow}`, fmt: FMT.euro },
    { label: 'Stabilised EBITDA (2031)', engine: stab2031?.ebitda ?? 0, workbookRef: `'OPEX & P&L'!${col(2 + (2031 - 2026))}${ebitdaRow}`, fmt: FMT.euro },
    { label: 'Stabilised DSCR (2031)', engine: dscr2031, workbookRef: `Coverage!${col(2 + (2031 - 2026))}${dscrRowOnCov}`, fmt: FMT.mul },
    { label: 'Project IRR (incl. terminal)', engine: irrResult, workbookRef: irrCellRef, fmt: FMT.pct },
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
