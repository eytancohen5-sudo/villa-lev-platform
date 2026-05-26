// Bank presentation Word document — fully programmatic, 12 sections.
// Uses docx v9 (dynamic import). No template file, no docx-templates.
// Client-safe: no fs/path/Buffer.

import type { ModelAssumptions, ModelOutput, AnnualPnL } from '@/lib/engine/types';
import type { Locale } from '@/lib/i18n/types';
import { eur, pct, mul, financingPathLabel } from './formatters';

export async function exportBankPresentation(
  a: ModelAssumptions,
  m: ModelOutput,
  // Locale accepted for API symmetry; document is English-only.
  // NOTE: callers should compute ModelOutput with viewMode:'bank'.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _locale: Locale,
): Promise<Blob> {
  const {
    Document, Paragraph, Table, TableRow, TableCell,
    TextRun, HeadingLevel, AlignmentType, Packer, WidthType, BorderStyle,
  } = await import('docx');

  const km = m.keyMetrics;
  const stab: AnnualPnL | null = m.scenarios.realistic.stabilisedYear;
  const real = m.scenarios.realistic;

  // ── Shared helpers ────────────────────────────────────────────────────────
  const thinBorder = {
    top:    { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    left:   { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    right:  { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  };

  /** One 2-column metric/value row. */
  function kpiRow(metric: string, value: string) {
    return new TableRow({
      children: [
        new TableCell({
          borders: thinBorder,
          width: { size: 55, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            children: [new TextRun({ text: metric, size: 20, bold: true })],
          })],
        }),
        new TableCell({
          borders: thinBorder,
          width: { size: 45, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: value, size: 20, bold: true })],
          })],
        }),
      ],
    });
  }

  /** Header row for a 2-column table. */
  function headerRow2(col1: string, col2: string) {
    return new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          borders: thinBorder,
          shading: { fill: '1F3864' },
          width: { size: 55, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            children: [new TextRun({ text: col1, color: 'FFFFFF', bold: true, size: 20 })],
          })],
        }),
        new TableCell({
          borders: thinBorder,
          shading: { fill: '1F3864' },
          width: { size: 45, type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: col2, color: 'FFFFFF', bold: true, size: 20 })],
          })],
        }),
      ],
    });
  }

  /** N-column header row. widths[] must sum to 100. */
  function headerRowN(cols: string[], widths: number[]) {
    return new TableRow({
      tableHeader: true,
      children: cols.map((text, i) =>
        new TableCell({
          borders: thinBorder,
          shading: { fill: '1F3864' },
          width: { size: widths[i], type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text, color: 'FFFFFF', bold: true, size: 20 })],
          })],
        }),
      ),
    });
  }

  /** N-column data row. First cell left-aligned, others right-aligned. */
  function dataRowN(cells: string[], widths: number[]) {
    return new TableRow({
      children: cells.map((text, i) =>
        new TableCell({
          borders: thinBorder,
          width: { size: widths[i], type: WidthType.PERCENTAGE },
          children: [new Paragraph({
            alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
            children: [new TextRun({ text, size: 20 })],
          })],
        }),
      ),
    });
  }

  function sectionHeading(text: string) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 480, after: 160 },
      children: [new TextRun({ text, bold: true })],
    });
  }

  function subheading(text: string) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text })],
    });
  }

  function bodyText(text: string) {
    return new Paragraph({
      children: [new TextRun({ text, size: 20 })],
    });
  }

  /** Single-row table where each cell shows label (small, grey) above value (bold). */
  function singleRowTable(items: { label: string; value: string }[]) {
    const width = items.length > 0 ? Math.floor(100 / items.length) : 100;
    const widths = items.map((_, i) =>
      i === items.length - 1 ? 100 - width * (items.length - 1) : width,
    );
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: items.map((item, i) =>
            new TableCell({
              borders: thinBorder,
              width: { size: widths[i], type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: item.label, size: 16, color: '888888' })],
                }),
                new Paragraph({
                  children: [new TextRun({ text: item.value, size: 22, bold: true })],
                }),
              ],
            }),
          ),
        }),
      ],
    });
  }

  const generated = new Date().toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // docx v9 does not export a shared Paragraph | Table union type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];

  // ── Cover ──────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'VILLA LEV GROUP', bold: true, size: 56 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({
        text: 'Bank Credit Presentation',
        size: 28, italics: true,
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: generated, size: 22, color: '555555' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({
        text: `Financing Path: ${financingPathLabel(a.financingPath)}`,
        size: 22,
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: 'STRICTLY CONFIDENTIAL — For bank credit committee use only',
        size: 20, bold: true, color: 'CC0000',
      })],
    }),
  );

  // ── §1 Facility Summary ───────────────────────────────────────────────────
  children.push(sectionHeading('1. Facility Summary'));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow2('Metric', 'Value'),
      kpiRow('Loan Amount',          eur(km.loanAmount)),
      kpiRow('LTV',                  pct(km.ltv)),
      kpiRow('Annual Debt Service',  eur(km.annualDS)),
      kpiRow('Asset Coverage',       mul(km.assetCoverage)),
      kpiRow('Stabilised DSCR',      mul(km.stabilisedDSCR)),
      kpiRow('Equity Required',      eur(km.equityRequired)),
      kpiRow('Financing Path',       financingPathLabel(a.financingPath)),
    ],
  }));

  // ── §2 Project Overview ──────────────────────────────────────────────────
  children.push(sectionHeading('2. Project Overview'));
  // Portfolio table
  const portWidths = [30, 14, 14, 14, 14, 14];
  const portItems = a.portfolio.length > 0
    ? a.portfolio.map(p =>
        dataRowN([
          p.name,
          String(p.villaUnits),
          String(p.standardSuites),
          String(p.doubleSuites),
          String(p.count),
          `${p.constructionArea.toLocaleString()} m²`,
        ], portWidths),
      )
    : [dataRowN(['No properties configured', '—', '—', '—', '—', '—'], portWidths)];

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRowN(['Property', 'Villa Units', 'Std Suites', 'Dbl Suites', 'Plots', 'Build Area'], portWidths),
      ...portItems,
    ],
  }));
  children.push(
    bodyText('Phase 1 (2026): Land acquisition and legal completion across all portfolio properties.'),
    bodyText('Phase 2 (2027): Construction and fitout. All properties delivered to shell stage by Q3 2027.'),
    bodyText('Phase 3 (2028 onwards): Operations commence. Revenue ramp over 2 years to stabilised levels.'),
  );

  // ── §3 Sources & Uses ────────────────────────────────────────────────────
  children.push(sectionHeading('3. Sources & Uses'));
  children.push(subheading('Sources'));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow2('Source', 'Amount'),
      kpiRow('Term Loan',          eur(km.loanAmount)),
      kpiRow('Equity (Sponsor)',    eur(km.equityRequired)),
      kpiRow('Total',               eur(km.totalCapex)),
    ],
  }));

  children.push(subheading('Uses'));
  // NOTE: String-matching on category names is brittle — if category names change
  // in the engine this will silently produce €0 rows. Consider using stable IDs.
  const landCategory = m.capex.categories.find(c =>
    c.name.toLowerCase().includes('land'),
  );
  const constructionCategory = m.capex.categories.find(c =>
    c.name.toLowerCase().includes('construction'),
  );
  const ffeCategory = m.capex.categories.find(c =>
    c.name.toLowerCase().includes('f&e') || c.name.toLowerCase().includes('ffe') || c.name.toLowerCase().includes('furniture'),
  );
  const softCategory = m.capex.categories.find(c =>
    c.name.toLowerCase().includes('soft') || c.name.toLowerCase().includes('professional'),
  );
  const usesRows = [
    headerRow2('Use of Funds', 'Amount'),
    kpiRow('Land Acquisition', eur(landCategory?.grandTotal ?? 0)),
    kpiRow('Construction',     eur(constructionCategory?.grandTotal ?? 0)),
    kpiRow('FF&E',             eur(ffeCategory?.grandTotal ?? 0)),
    kpiRow('Soft Costs',       eur(softCategory?.grandTotal ?? 0)),
    kpiRow('Legal & Acq Fees', eur(m.capex.acquisitionLegal ?? 0)),
    kpiRow('Total CAPEX',      eur(km.totalCapex)),
  ];
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: usesRows,
  }));

  // ── §4 CAPEX Breakdown ───────────────────────────────────────────────────
  children.push(sectionHeading('4. CAPEX Breakdown'));
  // By category
  const catRows = m.capex.categories.length > 0
    ? m.capex.categories.map(cat => kpiRow(cat.name, eur(cat.grandTotal)))
    : [kpiRow('No categories', eur(0))];
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow2('Category', 'Grand Total'), ...catRows],
  }));

  // Per-property table
  if (m.capex.properties.length > 0) {
    children.push(subheading('Per-Property CAPEX'));
    const propCapexWidths = [40, 20, 20, 20];
    const propCapexRows = m.capex.properties.length > 0
      ? m.capex.properties.map(p =>
          dataRowN([p.name, String(p.count), eur(p.perUnit), eur(p.total)], propCapexWidths),
        )
      : [dataRowN(['—', '—', '—', '—'], propCapexWidths)];
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        headerRowN(['Property', 'Plots', 'Per Unit', 'Total'], propCapexWidths),
        ...propCapexRows,
      ],
    }));
  }

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow2('CAPEX Summary', 'Amount'),
      kpiRow('Portfolio Construction Total', eur(m.capex.portfolioTotal ?? 0)),
      kpiRow('Acquisition & Legal',          eur(m.capex.acquisitionLegal ?? 0)),
      kpiRow('Total CAPEX',                  eur(km.totalCapex)),
    ],
  }));

  // ── §5 Collateral & Security Package ────────────────────────────────────
  children.push(sectionHeading('5. Collateral & Security Package'));
  const col5Widths = [25, 19, 19, 19, 18];
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRowN(['Scenario', 'Val/m²', 'Total Value', 'LTV', 'Coverage'], col5Widths),
      dataRowN([
        'Stress',
        `€${m.collateral.stress.valuationPerM2.toLocaleString()}/m²`,
        eur(m.collateral.stress.value),
        pct(m.collateral.stress.ltv),
        mul(m.collateral.stress.coverage),
      ], col5Widths),
      dataRowN([
        'Market',
        `€${m.collateral.market.valuationPerM2.toLocaleString()}/m²`,
        eur(m.collateral.market.value),
        pct(m.collateral.market.ltv),
        mul(m.collateral.market.coverage),
      ], col5Widths),
      dataRowN([
        'Optimistic',
        `€${m.collateral.optimistic.valuationPerM2.toLocaleString()}/m²`,
        eur(m.collateral.optimistic.value),
        pct(m.collateral.optimistic.ltv),
        mul(m.collateral.optimistic.coverage),
      ], col5Widths),
    ],
  }));
  children.push(singleRowTable([
    { label: 'Portfolio Value (Market)', value: eur(m.collateral.market.value) },
    { label: 'LTV (Market)',             value: pct(km.ltv) },
    { label: 'Asset Coverage',           value: mul(km.assetCoverage) },
  ]));

  // ── §6 Operator Track Record ─────────────────────────────────────────────
  children.push(sectionHeading('6. Operator Track Record'));
  const op6Widths = [40, 30, 30];
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRowN(['Metric', 'Model Assumption', 'Benchmark'], op6Widths),
      dataRowN(['Villa ADR (net)',         eur(a.revenueRealistic.villaADR),        '€350–€600 (Greek luxury villas)'], op6Widths),
      dataRowN(['Villa Nights/Year', String(a.revenueRealistic.villaBaseNights), '90–120 (Mediterranean high season)'], op6Widths),
      dataRowN(['Suite Std ADR (net)',     eur(a.revenueRealistic.suiteStandardADR), '€150–€300 (boutique hotel suites)'], op6Widths),
      dataRowN(['Suite Nights/Year', String(a.revenueRealistic.suiteBaseNights), '80–110 (island hotel occupancy)'], op6Widths),
      dataRowN(['Stabilised Revenue', eur(km.stabilisedRevenue), 'Portfolio projection'], op6Widths),
    ],
  }));
  children.push(bodyText(
    'The model adopts conservative ADR assumptions anchored to publicly reported performance ' +
    'of comparable luxury villa and boutique hotel assets in the Aegean and Cyclades region. ' +
    'Ramp assumptions of 50% (Y1) and 75% (Y2) reflect standard operational ramp patterns ' +
    'for newly opened hospitality assets.',
  ));

  // ── §7 DSCR Time Series ──────────────────────────────────────────────────
  children.push(sectionHeading('7. DSCR Time Series'));
  const ts7Widths = [14, 14, 14, 15, 14, 15, 14];
  const pnlRows7 = real.pnl.length > 0
    ? real.pnl.map(y =>
        dataRowN([
          String(y.year),
          eur(y.totalRevenue),
          eur(y.ebitda),
          eur(y.debtService),
          mul(y.dscr),
          eur(y.netCashFlowPostVAT),
          pct(y.ebitdaMargin),
        ], ts7Widths),
      )
    : [dataRowN(['—', '—', '—', '—', '—', '—', '—'], ts7Widths)];

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRowN(['Year', 'Revenue', 'EBITDA', 'Debt Service', 'DSCR', 'NCF Post-VAT', 'EBITDA%'], ts7Widths),
      ...pnlRows7,
    ],
  }));

  children.push(singleRowTable([
    { label: 'Min DSCR (Loan Life)',  value: mul(real.minDSCRLoanLife) },
    { label: 'Avg DSCR (Loan Life)',  value: mul(real.avgDSCRLoanLife) },
    { label: 'LLCR',                  value: mul(real.llcr) },
    { label: 'PLCR',                  value: mul(real.plcr) },
    { label: 'ICR (Stabilised)',       value: mul(real.icrStabilised) },
    { label: 'DSCR Covenant Headroom', value: pct(real.dscrCovenantHeadroom) },
  ]));

  // ── §8 Stress Test ───────────────────────────────────────────────────────
  children.push(sectionHeading('8. Stress Test'));
  const stress8Widths = [28, 24, 24, 24];
  const ds = m.scenarios.downside;
  const rs = m.scenarios.realistic;
  const us = m.scenarios.upside;
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRowN(['Metric', 'Downside', 'Realistic', 'Upside'], stress8Widths),
      dataRowN([
        'Stabilised Revenue',
        eur(ds.stabilisedYear?.totalRevenue ?? 0),
        eur(rs.stabilisedYear?.totalRevenue ?? 0),
        eur(us.stabilisedYear?.totalRevenue ?? 0),
      ], stress8Widths),
      dataRowN([
        'Stabilised EBITDA',
        eur(ds.stabilisedYear?.ebitda ?? 0),
        eur(rs.stabilisedYear?.ebitda ?? 0),
        eur(us.stabilisedYear?.ebitda ?? 0),
      ], stress8Widths),
      dataRowN([
        'DSCR (Stabilised)',
        mul(ds.stabilisedYear?.dscr ?? 0),
        mul(rs.stabilisedYear?.dscr ?? 0),
        mul(us.stabilisedYear?.dscr ?? 0),
      ], stress8Widths),
    ],
  }));

  // Break-even analysis
  const downside_buffer_pct: number = (() => {
    if (km.bufferToBreakEven > 0 && km.bufferToBreakEven < 1) return km.bufferToBreakEven;
    const stabRev = stab?.totalRevenue ?? km.stabilisedRevenue;
    if (stabRev > 0) return (stabRev - km.annualDS) / stabRev;
    return 0;
  })();

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow2('Break-even Analysis', 'Value'),
      kpiRow('Break-even Nights (Annual)', String(Math.round(km.breakEvenNights))),
      kpiRow('Revenue Buffer to Break-even', pct(downside_buffer_pct)),
    ],
  }));

  // Collateral stress
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow2('Collateral Stress', 'Value'),
      kpiRow('Stress Valuation/m²',    `€${m.collateral.stress.valuationPerM2.toLocaleString()}/m²`),
      kpiRow('Stress Portfolio Value',  eur(m.collateral.stress.value)),
      kpiRow('Stress LTV',              pct(m.collateral.stress.ltv)),
      kpiRow('Stress Coverage',         mul(m.collateral.stress.coverage)),
      kpiRow('Loan vs. Stress Value',   eur(m.collateral.stress.value - km.loanAmount)),
    ],
  }));

  // ── §9 P&L Statement ─────────────────────────────────────────────────────
  children.push(sectionHeading('9. P&L Statement'));
  const pl9Widths = [12, 13, 13, 13, 12, 13, 12, 12];
  const pnlRows9 = real.pnl.length > 0
    ? real.pnl.map(y =>
        dataRowN([
          String(y.year),
          eur(y.totalRevenue),
          eur(y.totalOpex),
          eur(y.ebitda),
          pct(y.ebitdaMargin),
          eur(y.debtService),
          eur(y.netCashFlowPostVAT),
          mul(y.dscr),
        ], pl9Widths),
      )
    : [dataRowN(['—', '—', '—', '—', '—', '—', '—', '—'], pl9Widths)];

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRowN(['Year', 'Revenue', 'Opex', 'EBITDA', 'EBITDA%', 'Debt Svc', 'NCF', 'DSCR'], pl9Widths),
      ...pnlRows9,
    ],
  }));

  // ── §10 Financing Path Comparison ────────────────────────────────────────
  children.push(sectionHeading('10. Financing Path Comparison'));
  const fp10Widths = [22, 16, 12, 16, 34];
  const activePath = a.financingPath;

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRowN(['Path', 'Rate', 'Term', 'LTV Cap', 'Status'], fp10Widths),
      dataRowN([
        'Commercial Bank Loan',
        pct(a.commercialLoan.interestRate ?? 0),
        `${a.commercialLoan.repaymentTermYears ?? 0} yrs`,
        pct(a.commercialLoan.loanCoverageRate ?? 0),
        activePath === 'commercial' ? 'ACTIVE' : 'Available',
      ], fp10Widths),
      dataRowN([
        'ESPA Development Grant',
        pct(0),
        'N/A',
        pct(a.grant.grantRate ?? 0),
        activePath === 'grant' ? 'ACTIVE' : 'Available',
      ], fp10Widths),
      dataRowN([
        'RRF Facility',
        pct((a.rrf.rrfInterestRate ?? 0) * (a.rrf.rrfShareOfLoan ?? 0) + (a.rrf.commercialInterestRate ?? 0) * (a.rrf.commercialShareRate ?? 0)),
        `${a.rrf.repaymentTermYears ?? 0} yrs`,
        pct(a.rrf.coverageRate ?? 0),
        activePath === 'rrf' ? 'ACTIVE' : 'Available',
      ], fp10Widths),
      dataRowN([
        'TEPIX III Fund',
        pct(a.tepixLoan.bankInterestRate ?? 0),
        `${a.tepixLoan.totalTermYears ?? 0} yrs`,
        pct(a.tepixLoan.coverageRate ?? 0),
        activePath === 'tepix-loan' ? 'ACTIVE' : 'Available',
      ], fp10Widths),
    ],
  }));

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow2('Active Path Metrics', 'Value'),
      kpiRow('Annual Debt Service', eur(km.annualDS)),
      kpiRow('Loan Amount',          eur(km.loanAmount)),
    ],
  }));

  // ── §11 Stabilised Operations Summary ────────────────────────────────────
  children.push(sectionHeading('11. Stabilised Operations Summary'));
  const stabEBITDAMargin = km.stabilisedEBITDAMargin > 0
    ? km.stabilisedEBITDAMargin
    : (km.stabilisedEBITDA > 0 && km.stabilisedRevenue > 0
        ? km.stabilisedEBITDA / km.stabilisedRevenue
        : 0);

  children.push(singleRowTable([
    { label: 'Stabilised Revenue',     value: eur(km.stabilisedRevenue) },
    { label: 'Stabilised EBITDA',      value: eur(km.stabilisedEBITDA) },
    { label: 'EBITDA Margin',          value: pct(stabEBITDAMargin) },
    { label: 'Annual Debt Service',    value: eur(km.annualDS) },
    { label: 'Stabilised DSCR',        value: mul(km.stabilisedDSCR) },
    { label: 'NCF Post-VAT',           value: eur(stab?.netCashFlowPostVAT ?? 0) },
  ]));

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow2('Exit Analysis', 'Value'),
      kpiRow('Exit Year',                       String(real.exitYear)),
      kpiRow('Exit EBITDA Multiple',             mul(real.exitEbitdaMultiple)),
      kpiRow('Terminal Asset Value (Hotel)',     eur(real.terminalAssetValue)),
      kpiRow('Terminal Equity Value',            eur(real.terminalEquityValue)),
    ],
  }));

  // ── §12 Disclaimer ───────────────────────────────────────────────────────
  children.push(sectionHeading('12. Disclaimer'));
  children.push(
    bodyText(`Generated: ${generated}`),
    bodyText(`Financing Path: ${financingPathLabel(a.financingPath)}`),
    bodyText(
      'This document contains forward-looking financial projections prepared exclusively for bank ' +
      'credit assessment purposes. All figures are model outputs and may differ materially from ' +
      'actual results. This document is strictly confidential and may not be reproduced or ' +
      'distributed without the express written consent of Villa Lev Group. ' +
      'Villa Lev Group — Agios Georgios, Antiparos, Greece.',
    ),
  );

  // ── Assemble document ─────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
    },
    sections: [{ children }],
  });

  return Packer.toBlob(doc);
}
