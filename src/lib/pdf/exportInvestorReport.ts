// Per-stakeholder investor report — single-page PDF.
//
// Generates a clean A4 portrait report containing:
//   - Header (project name, investor name, generation date)
//   - Deal context strip (path / scenario / exit year × multiple)
//   - Headline KPIs (cash in, total received, MOIC, IRR, payback)
//   - Year-by-year cash-flow table (operating yields + exit lump)
//   - Aggregated "Other investors" row when redacted (privacy-preserving)
//   - Footer with disclaimer
//
// jsPDF + autoTable are dynamically imported by the caller so they don't
// inflate the initial page bundle.

import type jsPDF from 'jspdf';
import type { CapTableResult, StakeholderResult } from '@/lib/engine/capTable';

const BRAND_COLOR: [number, number, number] = [139, 105, 20];   // #8B6914 — villa-lev gold
const TEXT_PRIMARY: [number, number, number] = [33, 33, 33];
const TEXT_TERTIARY: [number, number, number] = [136, 136, 136];

interface ReportContext {
  pathLabel: string;
  scenarioLabel: string;
  exitYear: number;
  exitMultiple: number;
  redacted: boolean;             // when true, other-investor names redacted
}

const eur = (n: number, locale = 'en-IE'): string => {
  if (!Number.isFinite(n) || n === 0) return '€0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}€${Math.round(abs / 1_000)}K`;
  return `${sign}€${new Intl.NumberFormat(locale).format(Math.round(abs))}`;
};
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const mul = (n: number) => `${n.toFixed(2)}×`;

export async function exportInvestorReport(
  target: StakeholderResult,
  capResult: CapTableResult,
  ctx: ReportContext,
): Promise<Blob> {
  const { default: JsPDFModule } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable: (doc: jsPDF, opts: object) => void =
    (autoTableModule as { default?: (doc: jsPDF, opts: object) => void }).default ??
    (autoTableModule as unknown as (doc: jsPDF, opts: object) => void);

  const doc = new JsPDFModule({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();   // 210mm
  const margin = 15;
  let y = margin;

  // ── Header ──────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, W, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Villa Lev Group — Investor Report', margin, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const investorLabel = ctx.redacted ? 'Confidential — single-investor view' : target.stakeholder.name;
  doc.text(investorLabel, margin, 22);
  doc.setFontSize(8);
  doc.setTextColor(220, 220, 220);
  const generated = new Date().toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  doc.text(`Generated ${generated}`, W - margin, 22, { align: 'right' });
  y = 40;

  // ── Deal context ────────────────────────────────────────────────────
  doc.setTextColor(...TEXT_TERTIARY);
  doc.setFontSize(8);
  doc.text(
    `${ctx.pathLabel} · ${ctx.scenarioLabel} scenario · Exit ${ctx.exitYear} @ ${ctx.exitMultiple}× EBITDA`,
    margin, y,
  );
  y += 8;

  // ── Stakeholder header ──────────────────────────────────────────────
  doc.setTextColor(...TEXT_PRIMARY);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(target.stakeholder.name, margin, y);
  if (target.stakeholder.isPromoter) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND_COLOR);
    doc.text('  FOUNDER', margin + doc.getTextWidth(target.stakeholder.name) + 2, y - 0.5);
    doc.setTextColor(...TEXT_PRIMARY);
  }
  if (target.stakeholder.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_TERTIARY);
    doc.text(target.stakeholder.notes, margin, y + 4);
  }
  y += 10;

  // ── Headline KPIs (5-cell strip) ────────────────────────────────────
  const kpis: Array<[string, string]> = [
    ['Cash invested', eur(target.stakeholder.cashIn)],
    ['Total received', eur(target.totalReceived)],
    ['MOIC', mul(target.moic)],
    ['IRR', pct(target.irr)],
    ['Payback year', String(target.paybackYear ?? '—')],
  ];
  const cellW = (W - 2 * margin) / kpis.length;
  doc.setDrawColor(220, 220, 220);
  kpis.forEach(([label, value], i) => {
    const x = margin + i * cellW;
    doc.rect(x, y, cellW, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_TERTIARY);
    doc.text(label.toUpperCase(), x + 2, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text(value, x + 2, y + 13);
  });
  y += 22;

  // ── Year-by-year distribution table ─────────────────────────────────
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TEXT_PRIMARY);
  doc.text('Year-by-year distributions', margin, y);
  y += 4;

  // Columns differ for founder vs investor:
  // - Founder: Pari-passu | Grant bonus | Performance ratchet | Total
  // - Investor: Distribution | Total (same number, kept symmetric)
  const isFounder = !!target.stakeholder.isPromoter;
  const tableHead = isFounder
    ? [['Year', 'Pari-passu', 'Grant bonus', 'Performance ratchet', 'Total']]
    : [['Year', 'Distribution', 'Total']];
  const tableBody = target.yearly.map((row) =>
    isFounder
      ? [
          String(row.year),
          eur(row.pariPassuShare),
          eur(row.grantBonusShare),
          eur(row.performanceRatchetShare),
          eur(row.totalCashFlow),
        ]
      : [String(row.year), eur(row.investorDistribution), eur(row.totalCashFlow)],
  );
  tableBody.push(
    isFounder
      ? [
          'TOTAL',
          eur(target.yearly.reduce((s, r) => s + r.pariPassuShare, 0)),
          eur(target.yearly.reduce((s, r) => s + r.grantBonusShare, 0)),
          eur(target.yearly.reduce((s, r) => s + r.performanceRatchetShare, 0)),
          eur(target.totalReceived),
        ]
      : [
          'TOTAL',
          eur(target.yearly.reduce((s, r) => s + r.investorDistribution, 0)),
          eur(target.totalReceived),
        ],
  );

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_COLOR,
      textColor: [255, 255, 255],
      fontSize: 8,
      halign: 'right',
    },
    bodyStyles: { fontSize: 8, halign: 'right', textColor: TEXT_PRIMARY },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    didParseCell: (data: { row: { index: number }; cell: { styles: { fontStyle: string; fillColor: number[] } } }) => {
      // Bold the TOTAL row
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [248, 248, 248];
      }
    },
    margin: { left: margin, right: margin },
  });

  // autoTable mutates doc; pull the new Y from its lastAutoTable
  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? (y + 60);
  y = finalY + 8;

  // ── Reconciliation summary ──────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Project-level reconciliation', margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_TERTIARY);
  const reconLines = [
    `Total project distributable (Σ NCF + terminal equity): ${eur(capResult.totalProjectDistributable)}`,
    `Sum of all stakeholder distributions: ${eur(capResult.totalDistributed)}`,
    `Reconciliation diff: ${eur(capResult.reconciliationError)} ${
      Math.abs(capResult.reconciliationError) < 1 ? '✓' : '⚠'
    }`,
  ];
  reconLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 4;
  });

  // ── Aggregated others (when redacted) ───────────────────────────────
  if (ctx.redacted) {
    const others = capResult.stakeholders.filter((s) => s.stakeholder.id !== target.stakeholder.id);
    const aggCash = others.reduce((s, o) => s + o.stakeholder.cashIn, 0);
    const aggReceived = others.reduce((s, o) => s + o.totalReceived, 0);
    y += 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT_PRIMARY);
    doc.text('Other investors (aggregated)', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_TERTIARY);
    doc.text(`${others.length} additional investor(s) · combined cash in ${eur(aggCash)} · combined received ${eur(aggReceived)}`, margin, y);
    y += 4;
    doc.text('Names and per-investor amounts redacted for confidentiality.', margin, y);
    y += 4;
  }

  // ── Footer ──────────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, footerY - 4, W - margin, footerY - 4);
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_TERTIARY);
  doc.text(
    'Forward-looking projections only. Not investment advice. ' +
    'Numbers reconcile to the live model at https://villa-lev-finance.web.app',
    margin, footerY,
  );
  doc.text(`v${capResult.totalProjectDistributable.toFixed(0)}`, W - margin, footerY, { align: 'right' });

  return doc.output('blob');
}
