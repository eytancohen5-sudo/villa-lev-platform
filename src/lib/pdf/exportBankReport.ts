// Bank credit-application PDF.
//
// Generates a multi-page A4 portrait report containing:
//   Page 1 — Cover + headline KPIs + capital structure
//   Page 2 — Full P&L table (2026-2036): Revenue, EBITDA, Debt Service, NCF, DSCR
//   Page 3 — Scenario comparison (Downside / Realistic / Upside) + Debt service schedule
//   Page 4 — Collateral analysis + Assumptions used
//
// jsPDF + autoTable are dynamically imported so they don't inflate the initial bundle.

import type { ModelOutput, ModelAssumptions } from '@/lib/engine/types';

const BRAND: [number, number, number] = [139, 105, 20];
const TEXT: [number, number, number] = [33, 33, 33];
const MUTED: [number, number, number] = [120, 120, 120];
const GREEN: [number, number, number] = [46, 125, 50];
const RED: [number, number, number] = [198, 40, 40];
const LIGHT_GREY: [number, number, number] = [245, 245, 245];
const HEADER_GREY: [number, number, number] = [238, 238, 238];

const eur = (n: number) => {
  if (!Number.isFinite(n)) return '€0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}€${Math.round(abs / 1_000)}K`;
  return `${sign}€${Math.round(abs)}`;
};
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const mul = (n: number) => `${n.toFixed(2)}×`;

type DocLike = {
  setFillColor: (r: number, g: number, b: number) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  setFont: (font: string, style: string) => void;
  setFontSize: (size: number) => void;
  rect: (x: number, y: number, w: number, h: number, style: string) => void;
  text: (text: string, x: number, y: number, opts?: object) => void;
  internal: { pageSize: { getWidth(): number; getHeight(): number } };
};

function sectionHeader(doc: DocLike, label: string, y: number, margin: number) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...HEADER_GREY);
  doc.rect(margin, y - 4, W - 2 * margin, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND);
  doc.text(label.toUpperCase(), margin + 2, y + 0.5);
  return y + 8;
}

export async function exportBankReport(
  a: ModelAssumptions,
  m: ModelOutput,
): Promise<Blob> {
  const { default: JsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable: (doc: object, opts: object) => void =
    (autoTableModule as { default?: (doc: object, opts: object) => void }).default ??
    (autoTableModule as unknown as (doc: object, opts: object) => void);

  const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();   // 210mm
  const H = doc.internal.pageSize.getHeight();  // 297mm
  const margin = 14;

  const pathLabel =
    a.financingPath === 'commercial' ? 'Commercial Bank Loan'
    : a.financingPath === 'grant' ? 'ESPA Development Grant'
    : a.financingPath === 'rrf' ? 'Recovery & Resilience Facility'
    : 'TEPIX III Entrepreneurship Fund';

  const generated = new Date().toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const km = m.keyMetrics;
  const realistic = m.scenarios.realistic;
  const upside = m.scenarios.upside;
  const downside = m.scenarios.downside;
  const pnl = realistic.pnl;

  const footerText = (doc: InstanceType<typeof JsPDF>, pageNum: number, totalPages: number) => {
    const fy = H - 8;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, fy - 3, W - margin, fy - 3);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(
      'Forward-looking projections only. Not investment advice. Villa Lev Group — Agios Georgios, Antiparos, Greece.',
      margin, fy,
    );
    doc.text(`${pageNum} / ${totalPages}`, W - margin, fy, { align: 'right' });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGE 1 — Cover + KPIs
  // ─────────────────────────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Villa Lev Group', margin, 14);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Bank Credit Application — Project Finance Summary', margin, 22);
  doc.setFontSize(8);
  doc.setTextColor(220, 220, 220);
  doc.text(`${pathLabel} · Generated ${generated}`, margin, 30);
  doc.text('CONFIDENTIAL', W - margin, 30, { align: 'right' });

  let y = 50;

  // — Headline KPIs — 2 rows × 5 cols
  const kpiRows: Array<Array<[string, string, boolean?]>> = [
    [
      ['Total Investment', eur(km.totalCapex)],
      ['Loan Amount', eur(km.loanAmount)],
      ['Equity Required', eur(km.equityRequired)],
      ['LTV at Completion', pct(km.ltv)],
      ['Asset Coverage', mul(km.assetCoverage)],
    ],
    [
      ['Stabilised Revenue', eur(km.stabilisedRevenue)],
      ['Stabilised EBITDA', eur(km.stabilisedEBITDA)],
      ['EBITDA Margin', pct(km.stabilisedEBITDAMargin)],
      ['Stabilised DSCR', mul(km.stabilisedDSCR), km.stabilisedDSCR >= 1.25],
      ['Annual Debt Service', eur(km.annualDS)],
    ],
  ];
  const cellW = (W - 2 * margin) / 5;
  kpiRows.forEach((row) => {
    row.forEach(([label, value, good], i) => {
      const x = margin + i * cellW;
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(250, 248, 242);
      doc.rect(x, y, cellW, 18, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      doc.text(label.toUpperCase(), x + 2, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(good === true ? GREEN[0] : good === false ? RED[0] : TEXT[0],
                       good === true ? GREEN[1] : good === false ? RED[1] : TEXT[1],
                       good === true ? GREEN[2] : good === false ? RED[2] : TEXT[2]);
      doc.text(value, x + 2, y + 13);
    });
    y += 20;
  });
  y += 4;

  // — Capital structure summary —
  y = sectionHeader(doc as DocLike, 'Capital Structure', y, margin);
  y += 2;
  const capRows = [
    ['Total CAPEX', eur(km.totalCapex)],
    ['Loan drawn', eur(km.loanAmount)],
    ['Equity required', eur(km.equityRequired)],
    ['LTV at completion', pct(km.ltv)],
    ['Asset coverage (market)', mul(km.assetCoverage)],
  ];
  doc.setFontSize(8.5);
  capRows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(label, margin + 2, y);
    doc.setTextColor(...TEXT);
    doc.setFont('helvetica', 'bold');
    doc.text(val, W / 2, y, { align: 'right' });
    y += 5.5;
  });
  y += 4;

  // — CAPEX breakdown by property —
  y = sectionHeader(doc as DocLike, 'CAPEX Breakdown', y, margin);
  y += 2;
  const capexHead = [['Property', ...m.capex.properties.map((p) => p.name), 'Total']];
  const capexBody = [
    ['Land', ...m.capex.properties.map(() => ''), eur(m.capex.categories.find((c) => c.name === 'Land acquisition')?.grandTotal ?? 0)],
    ...m.capex.categories.map((cat) => [
      cat.name,
      ...m.capex.properties.map((p) => {
        const pp = cat.perProperty.find((x) => x.id === p.id);
        return pp ? eur(pp.total) : '—';
      }),
      eur(cat.grandTotal),
    ]),
    ['TOTAL', ...m.capex.properties.map((p) => eur(p.total)), eur(km.totalCapex)],
  ];
  autoTable(doc, {
    startY: y,
    head: capexHead,
    body: capexBody,
    theme: 'grid',
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontSize: 7.5, halign: 'right' },
    bodyStyles: { fontSize: 7.5, halign: 'right', textColor: TEXT },
    columnStyles: { 0: { halign: 'left' } },
    didParseCell: (data: { row: { index: number }; cell: { styles: { fontStyle: string; fillColor: number[] } } }) => {
      if (data.row.index === capexBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = LIGHT_GREY;
      }
    },
    margin: { left: margin, right: margin },
  });

  footerText(doc, 1, 4);

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGE 2 — P&L Table
  // ─────────────────────────────────────────────────────────────────────────────
  doc.addPage();
  y = margin;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('P&L Summary — Realistic Scenario (€)', margin, 8);
  y = 18;

  const opYears = pnl.filter((p) => p.year >= 2028);
  const allYears = pnl;
  const yrLabels = allYears.map((p) => String(p.year));

  const pnlRows: Array<[string, (p: typeof pnl[0]) => string, boolean?]> = [
    ['Revenue', (p) => eur(p.totalRevenue)],
    ['  Events (net)', (p) => (p.revenueEvents > 0 ? eur(p.revenueEvents) : '—')],
    ['  Ancillary (net)', (p) => (p.revenueAncillary > 0 ? eur(p.revenueAncillary) : '—')],
    ['Total OPEX', (p) => eur(p.totalOpex)],
    ['EBITDA', (p) => eur(p.ebitda), true],
    ['  EBITDA Margin', (p) => (p.ebitda > 0 && p.totalRevenue > 0 ? pct(p.ebitda / p.totalRevenue) : '—')],
    ['Main Loan Interest', (p) => (p.termLoanInterest > 0 ? eur(p.termLoanInterest) : '—')],
    ['Main Loan Principal', (p) => (p.termLoanPrincipal > 0 ? eur(p.termLoanPrincipal) : '—')],
    ['Total Debt Service', (p) => (p.debtService > 0 ? eur(p.debtService) : '—')],
    ['Net Cash Flow (post-tax)', (p) => eur(p.netCashFlowPostVAT), true],
    ['Loan Balance (year-end)', (p) => (p.termLoanBalance > 0 ? eur(p.termLoanBalance) : '—')],
    ['DSCR (realistic)', (p) => (p.dscr > 0 ? mul(p.dscr) : '—'), true],
  ];

  const pnlBody = pnlRows.map(([label, fn]) => [label, ...allYears.map(fn)]);
  autoTable(doc, {
    startY: y,
    head: [['Line Item', ...yrLabels]],
    body: pnlBody,
    theme: 'grid',
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontSize: 7, halign: 'right' },
    bodyStyles: { fontSize: 7, halign: 'right', textColor: TEXT },
    columnStyles: { 0: { halign: 'left', cellWidth: 40 } },
    didParseCell: (data: {
      row: { index: number };
      cell: { styles: { fontStyle: string; fillColor: number[]; textColor: number[] } };
      column: { index: number };
    }) => {
      const bold = pnlRows[data.row.index]?.[2];
      if (bold) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = LIGHT_GREY;
      }
      // DSCR row: colour cells green/red
      if (data.row.index === pnlRows.length - 1 && data.column.index > 0) {
        const yr = allYears[data.column.index - 1];
        if (yr && yr.dscr > 0) {
          data.cell.styles.textColor = yr.dscr >= 1.25 ? GREEN : RED;
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  // Get the Y after the table
  const pnlFinalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? (y + 100);
  y = pnlFinalY + 6;

  // DSCR covenant note
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...MUTED);
  doc.text(`DSCR covenant floor: ${mul(a.dscrCovenantThreshold)} — green = pass, red = fail`, margin, y);

  footerText(doc, 2, 4);

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGE 3 — Scenario Comparison + Debt Service Schedule
  // ─────────────────────────────────────────────────────────────────────────────
  doc.addPage();
  y = margin;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('Scenario Comparison & Debt Service Schedule', margin, 8);
  y = 18;

  // — Scenario comparison (EBITDA + NCF + DSCR for Downside / Realistic / Upside) —
  y = sectionHeader(doc as DocLike, 'Downside / Realistic / Upside — EBITDA, NCF, DSCR', y, margin);
  y += 2;

  const scenYears = opYears.map((p) => p.year);
  const scenHead = [['Year', ...scenYears.map((yr) => String(yr))]];

  const scenMetrics: Array<[string, (yr: number) => string, boolean?]> = [
    ['EBITDA — Downside', (yr) => {
      const p = downside.pnl.find((x) => x.year === yr);
      return p ? eur(p.ebitda) : '—';
    }],
    ['EBITDA — Realistic', (yr) => {
      const p = realistic.pnl.find((x) => x.year === yr);
      return p ? eur(p.ebitda) : '—';
    }, true],
    ['EBITDA — Upside', (yr) => {
      const p = upside.pnl.find((x) => x.year === yr);
      return p ? eur(p.ebitda) : '—';
    }],
    ['NCF post-tax — Downside', (yr) => {
      const p = downside.pnl.find((x) => x.year === yr);
      return p ? eur(p.netCashFlowPostVAT) : '—';
    }],
    ['NCF post-tax — Realistic', (yr) => {
      const p = realistic.pnl.find((x) => x.year === yr);
      return p ? eur(p.netCashFlowPostVAT) : '—';
    }, true],
    ['DSCR — Downside', (yr) => {
      const p = downside.pnl.find((x) => x.year === yr);
      return p && p.dscr > 0 ? mul(p.dscr) : '—';
    }],
    ['DSCR — Realistic', (yr) => {
      const p = realistic.pnl.find((x) => x.year === yr);
      return p && p.dscr > 0 ? mul(p.dscr) : '—';
    }, true],
    ['DSCR — Upside', (yr) => {
      const p = upside.pnl.find((x) => x.year === yr);
      return p && p.dscr > 0 ? mul(p.dscr) : '—';
    }],
  ];

  const scenBody = scenMetrics.map(([label, fn]) => [label, ...scenYears.map(fn)]);
  autoTable(doc, {
    startY: y,
    head: scenHead,
    body: scenBody,
    theme: 'grid',
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontSize: 7, halign: 'right' },
    bodyStyles: { fontSize: 7, halign: 'right', textColor: TEXT },
    columnStyles: { 0: { halign: 'left', cellWidth: 44 } },
    didParseCell: (data: {
      row: { index: number };
      cell: { styles: { fontStyle: string; fillColor: number[]; textColor: number[] } };
      column: { index: number };
    }) => {
      if (scenMetrics[data.row.index]?.[2]) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = LIGHT_GREY;
      }
      // DSCR colour coding
      if ((data.row.index === 5 || data.row.index === 6 || data.row.index === 7) && data.column.index > 0) {
        const yr = scenYears[data.column.index - 1];
        const scenario = data.row.index === 5 ? downside : data.row.index === 6 ? realistic : upside;
        const p = scenario.pnl.find((x) => x.year === yr);
        if (p && p.dscr > 0) {
          data.cell.styles.textColor = p.dscr >= a.dscrCovenantThreshold ? GREEN : RED;
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  const scenFinalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? (y + 80);
  y = scenFinalY + 8;

  // — Debt service schedule —
  y = sectionHeader(doc as DocLike, 'Debt Service Schedule', y, margin);
  y += 2;

  const dsHead = [['Year', 'Loan Balance', 'Interest', 'Principal', 'Total DS', 'DSCR']];
  const dsBody = allYears.map((p) => [
    String(p.year),
    p.termLoanBalance > 0 ? eur(p.termLoanBalance) : '—',
    p.termLoanInterest > 0 ? eur(p.termLoanInterest) : '—',
    p.termLoanPrincipal > 0 ? eur(p.termLoanPrincipal) : '—',
    p.debtService > 0 ? eur(p.debtService) : '—',
    p.dscr > 0 ? mul(p.dscr) : '—',
  ]);

  autoTable(doc, {
    startY: y,
    head: dsHead,
    body: dsBody,
    theme: 'grid',
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontSize: 7.5, halign: 'right' },
    bodyStyles: { fontSize: 7.5, halign: 'right', textColor: TEXT },
    columnStyles: { 0: { halign: 'left' } },
    didParseCell: (data: {
      column: { index: number };
      row: { index: number };
      cell: { styles: { textColor: number[] } };
    }) => {
      // DSCR column
      if (data.column.index === 5 && data.row.index >= 0) {
        const yr = allYears[data.row.index];
        if (yr && yr.dscr > 0) {
          data.cell.styles.textColor = yr.dscr >= a.dscrCovenantThreshold ? GREEN : RED;
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  footerText(doc, 3, 4);

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGE 4 — Collateral + Returns + Assumptions
  // ─────────────────────────────────────────────────────────────────────────────
  doc.addPage();
  y = margin;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('Collateral Analysis, Returns & Assumptions', margin, 8);
  y = 18;

  // — Collateral —
  y = sectionHeader(doc as DocLike, 'Collateral Coverage Analysis', y, margin);
  y += 2;
  const col = m.collateral;
  const colHead = [['Scenario', 'Valuation €/m²', 'Portfolio Value', 'LTV', 'Coverage']];
  const colBody = [
    ['Stress (−30%)', eur(col.stress.valuationPerM2), eur(col.stress.value), pct(col.stress.ltv), mul(col.stress.coverage)],
    ['Market (base case)', eur(col.market.valuationPerM2), eur(col.market.value), pct(col.market.ltv), mul(col.market.coverage)],
    ['Optimistic (+20%)', eur(col.optimistic.valuationPerM2), eur(col.optimistic.value), pct(col.optimistic.ltv), mul(col.optimistic.coverage)],
  ];
  autoTable(doc, {
    startY: y,
    head: colHead,
    body: colBody,
    theme: 'grid',
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255], fontSize: 8, halign: 'right' },
    bodyStyles: { fontSize: 8, halign: 'right', textColor: TEXT },
    columnStyles: { 0: { halign: 'left' } },
    margin: { left: margin, right: margin },
  });

  const colFinalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? (y + 30);
  y = colFinalY + 8;

  // — IRR & Returns summary —
  y = sectionHeader(doc as DocLike, 'Project Returns (Realistic Scenario)', y, margin);
  y += 2;
  const retRows = [
    ['Unlevered Project IRR', pct(realistic.projectIRR)],
    ['Levered Equity IRR', pct(realistic.equityIRR)],
    ['Total MOIC (incl. exit)', mul(realistic.totalMOIC)],
    ['Equity Payback (years)', realistic.equityPaybackYears != null ? String(realistic.equityPaybackYears) : '> projection'],
    ['Exit EBITDA Multiple', mul(realistic.exitEbitdaMultiple)],
    ['Terminal Asset Value', eur(realistic.terminalAssetValue)],
    ['Terminal Equity Value', eur(realistic.terminalEquityValue)],
  ];
  const col1W = 80;
  doc.setFontSize(8.5);
  retRows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(label, margin + 2, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT);
    doc.text(val, margin + col1W, y, { align: 'right' });
    y += 5.5;
  });
  y += 6;

  // — Key Assumptions —
  y = sectionHeader(doc as DocLike, 'Assumptions Used in This Report', y, margin);
  y += 2;
  const assumpRows: Array<[string, string]> = [
    ['Financing path', pathLabel],
    ['Villa ADR', eur(a.revenueRealistic.villaADR)],
    ['Suite standard ADR', eur(a.revenueRealistic.suiteStandardADR)],
    ['Suite double ADR', eur(a.revenueRealistic.suiteDoubleADR)],
    ['Villa base nights/year', String(a.revenueRealistic.villaBaseNights)],
    ['Suite base nights/year', String(a.revenueRealistic.suiteBaseNights)],
    ['Y1 ramp factor (2028)', pct(a.general.year1RampFactor)],
    ['Y2 ramp factor (2029)', pct(a.general.year2RampFactor)],
    ['Loan interest rate', pct(a.commercialLoan.interestRate)],
    ['Loan coverage rate', pct(a.commercialLoan.loanCoverageRate)],
    ['Repayment term', `${a.commercialLoan.repaymentTermYears} years`],
    ['Grace period', `${a.commercialLoan.gracePeriodYears} years`],
    ['Corporate income tax', pct(a.tax.corporateIncomeTaxRate)],
    ['Exit EBITDA multiple', mul(a.exitEbitdaMultiple)],
    ['DSCR covenant floor', mul(a.dscrCovenantThreshold)],
  ];

  const halfW = (W - 2 * margin - 8) / 2;
  let col2Start = false;
  let col1Y = y;
  let col2Y = y;
  assumpRows.forEach(([label, val], i) => {
    const inCol2 = i >= Math.ceil(assumpRows.length / 2);
    const cx = inCol2 ? margin + halfW + 8 : margin;
    const cy = inCol2 ? col2Y : col1Y;
    if (!col2Start && inCol2) col2Start = true;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label, cx + 2, cy);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT);
    doc.text(val, cx + halfW - 2, cy, { align: 'right' });
    if (inCol2) col2Y += 5.5;
    else col1Y += 5.5;
  });

  footerText(doc, 4, 4);

  return doc.output('blob');
}
