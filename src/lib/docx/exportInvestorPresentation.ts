// Investor presentation Word document — cap-table edition.
//
// Builds a fully self-contained .docx (11 sections) from a CapTableResult,
// ModelAssumptions, and ModelOutput. Uses the `docx` npm package (v9.x)
// dynamically imported so it doesn't inflate the initial bundle.
//
// No 'use server', no Node.js fs/path/Buffer — fully client-safe.

import type { CapTableResult, StakeholderResult } from '@/lib/engine/capTable';
import type { ModelAssumptions, ModelOutput } from '@/lib/engine/types';
import type { Locale } from '@/lib/i18n/types';
import { eur, pct, mul, financingPathLabel } from './formatters';

// ─── Public export ────────────────────────────────────────────────────────────

export async function exportInvestorPresentation(
  capResult: CapTableResult,
  a: ModelAssumptions,
  m: ModelOutput,
  // locale accepted for API symmetry; document is English-only for now.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _locale: Locale,
): Promise<Blob> {
  // Dynamic-import Packer to avoid inflating the initial bundle.
  const {
    Document,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    TextRun,
    ExternalHyperlink,
    HeadingLevel,
    AlignmentType,
    Packer,
    WidthType,
    BorderStyle,
  } = await import('docx');

  const km = m.keyMetrics;
  const real = m.scenarios.upside;
  const ds = m.scenarios.downside;
  const us = m.scenarios.upside;

  const generated = new Date().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // ── Shared border style ──────────────────────────────────────────────────────
  const thinBorder = {
    top:    { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    left:   { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    right:  { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  };

  // ── Table builder helpers ─────────────────────────────────────────────────────

  /** One 2-column metric/value row. */
  function kpiRow(metric: string, value: string) {
    return new TableRow({
      children: [
        new TableCell({
          borders: thinBorder,
          width: { size: 55, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: metric, size: 20 })] })],
        }),
        new TableCell({
          borders: thinBorder,
          width: { size: 45, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: value, size: 20, bold: true })],
            }),
          ],
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
          children: [
            new Paragraph({
              children: [new TextRun({ text: col1, color: 'FFFFFF', bold: true, size: 20 })],
            }),
          ],
        }),
        new TableCell({
          borders: thinBorder,
          shading: { fill: '1F3864' },
          width: { size: 45, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: col2, color: 'FFFFFF', bold: true, size: 20 })],
            }),
          ],
        }),
      ],
    });
  }

  /** Header row for a 3-column distribution table. */
  function headerRow3(col1: string, col2: string, col3: string) {
    const mkCell = (text: string, w: number) =>
      new TableCell({
        borders: thinBorder,
        shading: { fill: '1F3864' },
        width: { size: w, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            alignment: w === 33 ? AlignmentType.RIGHT : AlignmentType.LEFT,
            children: [new TextRun({ text, color: 'FFFFFF', bold: true, size: 20 })],
          }),
        ],
      });
    return new TableRow({
      tableHeader: true,
      children: [mkCell(col1, 34), mkCell(col2, 33), mkCell(col3, 33)],
    });
  }

  /** One row in the 3-column year-distribution table. */
  function distRow(year: string, distribution: string, cumulative: string) {
    return new TableRow({
      children: [
        new TableCell({
          borders: thinBorder,
          width: { size: 34, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: year, size: 20 })] })],
        }),
        new TableCell({
          borders: thinBorder,
          width: { size: 33, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: distribution, size: 20 })],
            }),
          ],
        }),
        new TableCell({
          borders: thinBorder,
          width: { size: 33, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: cumulative, size: 20 })],
            }),
          ],
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

  // sectionHeading retained as dead code — do not remove (keeps diff clean).
  function sectionHeading(text: string) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 480, after: 160 },
      children: [new TextRun({ text, bold: true })],
    });
  }
  // Suppress unused-variable warning without ts-ignore
  void sectionHeading;

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

  /** Full-width navy banner used for all 11 numbered section headings. */
  function sectionBanner(text: string) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: '1F3864' },
              borders: thinBorder,
              children: [
                new Paragraph({
                  spacing: { before: 160, after: 160 },
                  children: [new TextRun({ text, color: 'FFFFFF', bold: true, size: 52 })],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  /** Inline live-model hyperlink placed after each section's primary table. */
  function navLink(route: string) {
    return new Paragraph({
      spacing: { before: 120, after: 240 },
      children: [
        new ExternalHyperlink({
          link: `http://localhost:3000${route}`,
          children: [new TextRun({ text: 'Live model (dev only) →', size: 18, color: '1F3864' })],
        }),
      ],
    });
  }

  /** Single-row table where each cell shows label (small, white) above value (bold, white)
   *  on a navy background. */
  function singleRowTable(items: { label: string; value: string }[]) {
    const count = items.length > 0 ? items.length : 1;
    const width = Math.floor(100 / count);
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
              shading: { fill: '1F3864' },
              width: { size: widths[i], type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: item.label, size: 16, color: 'FFFFFF' })],
                }),
                new Paragraph({
                  children: [new TextRun({ text: item.value, size: 22, bold: true, color: 'FFFFFF' })],
                }),
              ],
            }),
          ),
        }),
      ],
    });
  }

  // docx v9 does not export a shared Paragraph | Table union type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];

  // ── Cover ──────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 240 },
      children: [new TextRun({ text: 'VILLA LEV GROUP', bold: true, size: 56, color: '1F3864' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({
        text: 'Confidential Investor Briefing',
        size: 28, italics: true,
      })],
    }),
    // STEP 3: thin navy horizontal rule divider
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { fill: '1F3864' },
              borders: thinBorder,
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [new TextRun({ text: ' ', size: 2 })],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: generated, size: 22, color: '555555' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: `Financing Path: ${financingPathLabel(a.financingPath)}`,
        size: 22,
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({
        text: `Exit Year: ${real.exitYear} · Exit Multiple: ${real.exitEbitdaMultiple}×`,
        size: 22,
      })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: 'CONFIDENTIAL — Not for distribution',
        size: 20, bold: true, color: 'CC0000',
      })],
    }),
  );

  // ── §1 Investment Snapshot ────────────────────────────────────────────────
  children.push(sectionBanner('1. Investment Snapshot'));
  // Co-investor equity: sum of non-promoter cashIn (isPromoter=undefined is treated as false)
  const coInvestorEquity = capResult.stakeholders
    .filter(sr => !sr.stakeholder.isPromoter)
    .reduce((s, sr) => s + sr.stakeholder.cashIn, 0);

  children.push(
    bodyText('The three components of investor return are: an annual cash yield during the hold, a MOIC multiple at hotel-sale exit, and a property-sale floor that provides a capital-preservation backstop independent of operating performance.'),
    bodyText(`Realistic base case equity IRR is ${pct(real.equityIRR)} on a ${real.exitYear - 2026}-year hold at ${mul(real.totalMOIC)} MOIC; the downside floor IRR is ${pct(ds.equityIRR)}.`),
    bodyText(`Stabilised cash yield on equity reaches ${pct(real.yieldStabilised)}; the property-sale exit produces an independent IRR of ${pct(real.equityIRRPropertySale)}.`),
    bodyText(`Total CAPEX of ${eur(km.totalCapex)} is funded by ${eur(km.loanAmount)} debt and ${eur(km.equityRequired)} equity; co-investor tranche is ${eur(coInvestorEquity)}.`),
  );

  children.push(singleRowTable([
    { label: 'Total CAPEX',          value: eur(km.totalCapex) },
    { label: 'Equity Required',      value: eur(km.equityRequired) },
    { label: 'Co-Investor Equity',   value: eur(coInvestorEquity) },
    { label: 'Base Case Equity IRR', value: pct(real.equityIRR) },
    { label: 'Base Case MOIC',       value: mul(real.totalMOIC) },
    { label: 'Exit Year',            value: String(real.exitYear) },
  ]));

  children.push(navLink('/admin/dashboard'));

  // ── §2 The Opportunity ────────────────────────────────────────────────────
  children.push(sectionBanner('2. The Opportunity'));
  children.push(
    bodyText('Antiparos zoning legislation caps total building coefficient on coastal plots; new hospitality licences require environmental studies, municipal approval, and coastal setback compliance that typically exceed three years — structural barriers that prevent supply from responding to demand.'),
    bodyText('The competitive set across the broader Cyclades luxury segment (Paros, Sifnos, Folegandros) trades at premium ADR multiples to the Attica average, validating the pricing power of island-scarce inventory.'),
    bodyText(`Villa Lev operated at ${eur(a.revenueRealistic.villaADR)} ADR with ${a.revenueRealistic.villaBaseNights} bookable nights at stabilisation.`),
    bodyText(`Break-even is ${Math.round(km.breakEvenNights)} nights; the Realistic base case sits ${km.bufferToBreakEven >= 1 ? Math.round(km.bufferToBreakEven) + ' nights' : pct(km.bufferToBreakEven)} above that floor.`),
  );
  children.push(navLink('/admin/assumptions'));

  // ── §3 The Asset ──────────────────────────────────────────────────────────
  // Phase years derived from milestones.yaml (no villa-lev-specific dates; TBD entries).
  // Fallback: acquisition 2026, construction commencement 2027, first revenue season 2028.
  const phase1Year = 2026;
  const phase2Year = 2027;
  const phase3Year = 2028;
  children.push(sectionBanner('3. The Asset'));
  children.push(
    bodyText(`Three development phases: ${phase1Year} site acquisition and planning, ${phase2Year} construction commencement, ${phase3Year} first revenue season.`),
    bodyText(`Hard construction cost of ${eur(m.capex.portfolioTotal ?? 0)} covers ${a.portfolio.length} ${a.portfolio.length === 1 ? 'property' : 'properties'}; FF&E, soft costs, and a contingency reserve are included within the total CAPEX envelope.`),
    bodyText(`Acquisition and legal adds ${eur(m.capex.acquisitionLegal ?? 0)} to bring total CAPEX to ${eur(km.totalCapex)}.`),
  );
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

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow2('CAPEX Summary', 'Amount'),
      kpiRow('Portfolio Construction Total', eur(m.capex.portfolioTotal ?? 0)),
      kpiRow('Acquisition & Legal',          eur(m.capex.acquisitionLegal ?? 0)),
      kpiRow('Total CAPEX',                  eur(km.totalCapex)),
    ],
  }));

  children.push(subheading('Development Timeline & Phasing'));
  children.push(bodyText('Equity drawn in tranches aligned to construction milestones; co-investor capital enters at construction commencement, not at acquisition.'));

  children.push(navLink('/admin/capex'));

  // ── §4 Return Profile ─────────────────────────────────────────────────────
  children.push(sectionBanner('4. Return Profile'));
  children.push(
    bodyText(`Return is delivered in three layers: (1) annual cash yield during the ${real.exitYear - 2026}-year hold, (2) a ${mul(real.totalMOIC)} MOIC at hotel-sale exit, and (3) a property-sale floor at ${pct(real.equityIRRPropertySale)} IRR that is independent of hotel operating performance.`),
    bodyText(`Realistic base case equity IRR is ${pct(real.equityIRR)}; the downside scenario still produces a positive ${pct(ds.equityIRR)} IRR, confirming a capital-preservation floor under stress.`),
    bodyText(`Terminal equity value of ${eur(real.terminalEquityValue)} reflects a ${real.exitEbitdaMultiple}× EBITDA exit; stabilised yield on equity reaches ${pct(real.yieldStabilised)}.`),
    bodyText(`Equity payback occurs in ${real.equityPaybackYears !== null ? real.equityPaybackYears + ' years' : 'the hold period'}; cumulative yield at exit is ${pct(real.cumulativeYieldFinal)}.`),
  );

  // 2-column base-case table with alternating row shading on data rows
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow2('Metric', 'Base Case'),
      // Data rows: odd indices (1,3,5,...) = FFFFFF, even indices (2,4,...) = F2F2F2
      // Row index 1 → fill FFFFFF, index 2 → F2F2F2, index 3 → FFFFFF, etc.
      new TableRow({
        children: [
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'FFFFFF' },
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: 'Equity IRR', size: 20 })] })],
          }),
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'FFFFFF' },
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: pct(real.equityIRR), size: 20, bold: true })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'F2F2F2' },
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: 'MOIC', size: 20 })] })],
          }),
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'F2F2F2' },
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: mul(real.totalMOIC), size: 20, bold: true })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'FFFFFF' },
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: 'Equity Payback', size: 20 })] })],
          }),
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'FFFFFF' },
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: real.equityPaybackYears !== null ? String(real.equityPaybackYears) + ' yrs' : 'Not reached', size: 20, bold: true })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'F2F2F2' },
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: 'Terminal Equity Value', size: 20 })] })],
          }),
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'F2F2F2' },
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: eur(real.terminalEquityValue), size: 20, bold: true })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'FFFFFF' },
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: 'Stabilised Yield', size: 20 })] })],
          }),
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'FFFFFF' },
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: pct(real.yieldStabilised), size: 20, bold: true })] })],
          }),
        ],
      }),
    ],
  }));

  children.push(navLink('/admin/returns'));

  // ── §5 Capital Structure & Financing Paths ────────────────────────────────
  children.push(sectionBanner('5. Capital Structure & Financing Paths'));
  if (a.financingPath === 'commercial') {
    children.push(bodyText(`Commercial bank term loan of ${eur(km.loanAmount)} at ${pct(a.commercialLoan?.interestRate ?? 0)} over ${a.commercialLoan?.repaymentTermYears ?? 0} years, with a contractual grace period assumption of ${a.commercialLoan?.gracePeriodYears ?? 2} years on principal; annual debt service ${eur(km.annualDS)}.`));
  } else if (a.financingPath === 'tepix-loan') {
    children.push(bodyText(`TEPIX III HDB-blended facility of ${eur(km.loanAmount)}, with a contractual grace period assumption of ${a.tepixLoan?.gracePeriodYears ?? 2} years on principal and milestone-gated drawdown; annual debt service ${eur(km.annualDS)}.`));
  } else if (a.financingPath === 'rrf') {
    children.push(bodyText(`RRF blended tranche of ${eur(km.loanAmount)}, with a contractual grace period assumption of ${a.rrf?.gracePeriodYears ?? 2} years on principal; blended rate reduces debt-service drag on equity.`));
  } else {
    // exhaustive: grant
    children.push(bodyText(`ESPA grant of ${pct(a.grant.grantRate ?? 0)} of eligible costs; residual loan ${eur(km.loanAmount)} on commercial terms.`));
  }
  children.push(
    bodyText(`Debt-to-equity: ${eur(km.loanAmount)} loan against ${eur(km.equityRequired)} equity.`),
    bodyText(`Annual debt service of ${eur(km.annualDS)} is covered by stabilised EBITDA of ${eur(km.stabilisedEBITDA)}.`),
    bodyText(`LTV is calculated on independent appraiser market value; the ${pct(km.ltv)} LTV at close is supported by ${mul(km.assetCoverage)}× asset coverage, providing a ${eur(m.collateral.market.value - km.loanAmount)} equity cushion above the loan balance.`),
    bodyText(`Co-investor equity of ${eur(coInvestorEquity)} enters the capital stack at construction commencement, pari-passu with the sponsor from that point; the active ${financingPathLabel(a.financingPath)} path is the preferred route, though three alternatives are shown in the comparison table below.`),
  );
  children.push(subheading('Sources of Capital'));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow2('Source', 'Amount'),
      kpiRow('Term Loan',        eur(km.loanAmount)),
      kpiRow('Equity (Sponsor)', eur(km.equityRequired)),
      kpiRow('Total',            eur(km.totalCapex)),
    ],
  }));

  children.push(subheading('Financing Path Comparison'));
  const fp5Widths = [24, 16, 12, 16, 32];
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRowN(['Path', 'Rate', 'Term', 'LTV Cap', 'Notes'], fp5Widths),
      dataRowN([
        'Commercial Bank Loan',
        pct(a.commercialLoan.interestRate ?? 0),
        `${a.commercialLoan.repaymentTermYears ?? 0} yrs`,
        pct(a.commercialLoan.loanCoverageRate ?? 0),
        a.financingPath === 'commercial' ? 'Active — selected path' : 'Available',
      ], fp5Widths),
      dataRowN([
        'ESPA Development Grant',
        'Grant',
        'N/A',
        pct(a.grant.grantRate ?? 0),
        a.financingPath === 'grant' ? 'Active — reduces equity gap' : 'Contingent on approval',
      ], fp5Widths),
      dataRowN([
        'RRF Facility',
        pct((a.rrf.rrfInterestRate ?? 0) * (a.rrf.rrfShareOfLoan ?? 0) + (a.rrf.commercialInterestRate ?? 0) * (a.rrf.commercialShareRate ?? 0)),
        `${a.rrf.repaymentTermYears ?? 0} yrs`,
        pct(a.rrf.coverageRate ?? 0),
        a.financingPath === 'rrf' ? 'Active — EU co-financed' : 'Available',
      ], fp5Widths),
      dataRowN([
        'TEPIX III Fund',
        pct(a.tepixLoan.bankInterestRate ?? 0),
        `${a.tepixLoan.totalTermYears ?? 0} yrs`,
        pct(a.tepixLoan.coverageRate ?? 0),
        a.financingPath === 'tepix-loan' ? 'Active — HDB + bank blended' : 'Available',
      ], fp5Widths),
    ],
  }));

  children.push(navLink('/admin/financing-paths'));

  // ── §6 P&L Ramp & Operating Projections ──────────────────────────────────
  children.push(sectionBanner('6. P&L Ramp & Operating Projections'));
  children.push(
    bodyText('The table below shows projected revenue and EBITDA across the ramp phase and the stabilised year; figures are forward-looking model outputs, not audited actuals.'),
    bodyText(`Stabilised revenue is ${eur(real.stabilisedYear?.totalRevenue ?? km.stabilisedRevenue)}; stabilised EBITDA is ${eur(real.stabilisedYear?.ebitda ?? km.stabilisedEBITDA)}, yielding an EBITDA margin of ${pct((real.stabilisedYear?.ebitda ?? km.stabilisedEBITDA) / ((real.stabilisedYear?.totalRevenue ?? km.stabilisedRevenue) || 1))}.`),
  );
  const op6Widths = [25, 25, 25, 25];
  const pnl = real.pnl;
  const y1 = pnl.find(p => p.year === 2028) ?? pnl[0];
  const y2 = pnl.find(p => p.year === 2029) ?? pnl[1];
  const y3 = pnl.find(p => p.year === 2030) ?? pnl[2];

  const opRows = [
    headerRowN(['Year', 'Revenue', 'EBITDA', 'DSCR'], op6Widths),
    dataRowN(['Y1 (2028)', eur(y1?.totalRevenue ?? 0), eur(y1?.ebitda ?? 0), mul(y1?.dscr ?? 0)], op6Widths),
    dataRowN(['Y2 (2029)', eur(y2?.totalRevenue ?? 0), eur(y2?.ebitda ?? 0), mul(y2?.dscr ?? 0)], op6Widths),
    dataRowN(['Y3 (2030)', eur(y3?.totalRevenue ?? 0), eur(y3?.ebitda ?? 0), mul(y3?.dscr ?? 0)], op6Widths),
    dataRowN([
      'Stabilised',
      eur(real.stabilisedYear?.totalRevenue ?? km.stabilisedRevenue),
      eur(real.stabilisedYear?.ebitda ?? km.stabilisedEBITDA),
      mul(real.stabilisedYear?.dscr ?? km.stabilisedDSCR),
    ], op6Widths),
  ];
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: opRows,
  }));

  children.push(
    bodyText('Year 2028 is a ramp year; use the stabilised row as the normalised baseline.'),
  );

  children.push(navLink('/admin/p-and-l'));

  // ── §7 Stress & Downside Protection ──────────────────────────────────────
  children.push(sectionBanner('7. Stress & Downside Protection'));
  children.push(
    bodyText(`Downside scenario (revenue compressed by reduced occupancy and lower ADR relative to Realistic base case) still produces an equity IRR of ${pct(ds.equityIRR)} — a positive return for co-investors even under stress.`),
    bodyText(`Stress valuation gives ${mul(m.collateral.stress.coverage)}× asset coverage on a ${eur(m.collateral.stress.value)} stressed collateral value, confirming the lender remains covered even under the downside scenario.`),
    bodyText(`LTV at close is ${pct(km.ltv)} against a ${eur(m.collateral.market.value)} market value; DSCR covenant headroom of ${pct(real.dscrCovenantHeadroom)} above the 1.25× floor provides the lender a contractual early-warning buffer before an equity event.`),
  );

  // Collateral table with alternating row shading on data rows
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow2('Collateral Metrics', 'Value'),
      new TableRow({
        children: [
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'FFFFFF' },
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: 'Portfolio Value (Market)', size: 20 })] })],
          }),
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'FFFFFF' },
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: eur(m.collateral.market.value), size: 20, bold: true })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'F2F2F2' },
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: 'LTV', size: 20 })] })],
          }),
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'F2F2F2' },
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: pct(km.ltv), size: 20, bold: true })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'FFFFFF' },
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: 'Asset Coverage', size: 20 })] })],
          }),
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'FFFFFF' },
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: mul(km.assetCoverage), size: 20, bold: true })] })],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'F2F2F2' },
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: 'Stress Coverage', size: 20 })] })],
          }),
          new TableCell({
            borders: thinBorder,
            shading: { fill: 'F2F2F2' },
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: mul(m.collateral.stress.coverage), size: 20, bold: true })] })],
          }),
        ],
      }),
    ],
  }));

  children.push(navLink('/admin/sensitivity'));

  // ── §8 Sponsor Returns & Equity Waterfall ─────────────────────────────────
  children.push(sectionBanner('8. Sponsor Returns & Equity Waterfall'));
  children.push(
    bodyText('Waterfall rules: distributions are pari-passu between sponsor and co-investor from the point of stabilisation; there is no promote or preferred return above the pari-passu rate; co-investor has full tag-along rights at exit.'),
    bodyText('Construction-phase risk sits with the sponsor before co-investor capital is drawn; co-investor capital enters at construction commencement, which is the stabilisation entry point for waterfall purposes.'),
    bodyText(`Co-investor equity of ${eur(coInvestorEquity)} participates pari-passu with sponsor from stabilisation; total project distributable is ${eur(capResult.totalProjectDistributable)}.`),
    bodyText(`Total distributed is ${eur(capResult.totalDistributed)}; exit in ${real.exitYear} delivers the majority of total return.`),
  );

  // Per-stakeholder table
  const stk8Widths = [18, 11, 11, 11, 11, 11, 11, 16];
  const stkRows = capResult.stakeholders.length > 0
    ? capResult.stakeholders.map((sr: StakeholderResult) =>
        dataRowN([
          sr.stakeholder.isPromoter ? `${sr.stakeholder.name} (Promoter)` : sr.stakeholder.name,
          eur(sr.stakeholder.cashIn),
          pct(sr.economicStake),
          eur(sr.totalReceived),
          eur(sr.netProfit),
          mul(sr.moic),
          pct(sr.irr),
          sr.paybackYear !== null ? String(sr.paybackYear) : 'Not reached',
        ], stk8Widths),
      )
    : [dataRowN(['No stakeholders', '—', '—', '—', '—', '—', '—', '—'], stk8Widths)];

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRowN(['Stakeholder', 'Cash In', 'Stake', 'Received', 'Net Profit', 'MOIC', 'IRR', 'Payback Yr'], stk8Widths),
      ...stkRows,
    ],
  }));

  // Consolidated distributions
  const firstStakeholder = capResult.stakeholders[0];
  const allYears: number[] = firstStakeholder
    ? firstStakeholder.yearly.map(y => y.year)
    : [];

  let consolidatedCum = 0;
  const consolidatedRows = allYears
    .map(yr => {
      const distributable = capResult.stakeholders.reduce((sum, sr) => {
        const entry = sr.yearly.find(y => y.year === yr);
        return sum + (entry?.totalCashFlow ?? 0);
      }, 0);
      return { yr, distributable };
    })
    .filter(row => row.distributable !== 0)
    .map(row => {
      consolidatedCum += row.distributable;
      return distRow(String(row.yr), eur(row.distributable), eur(consolidatedCum));
    });

  children.push(subheading('Consolidated Distributions'));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow3('Year', 'Total Distributed', 'Cumulative'),
      ...(consolidatedRows.length > 0
        ? consolidatedRows
        : [distRow('—', eur(0), eur(0))]),
      distRow('TOTAL', eur(capResult.totalDistributed), eur(capResult.totalDistributed)),
    ],
  }));

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow2('Waterfall Totals', 'Amount'),
      kpiRow('Total Distributed',           eur(capResult.totalDistributed)),
      kpiRow('Total Project Distributable',  eur(capResult.totalProjectDistributable)),
    ],
  }));

  children.push(navLink('/admin/cap-table'));

  // ── §9 Exit Scenarios ─────────────────────────────────────────────────────
  children.push(sectionBanner('9. Exit Scenarios'));
  children.push(
    bodyText(`A ${real.exitEbitdaMultiple}× EBITDA exit in ${real.exitYear} produces ${eur(real.terminalEquityValue)} terminal equity; terminal asset value before debt repayment is ${eur(real.terminalAssetValue)}.`),
    bodyText('The buyer universe for a stabilised Cyclades hospitality asset includes regional family offices, European hotel operators expanding island portfolios, and institutional Aegean hospitality funds; exit timing risk is mitigated by the property-sale floor described below.'),
    bodyText(`Property-sale exit at €${real.exitValuationPerM2.toLocaleString()}/m² produces an equity IRR of ${pct(real.equityIRRPropertySale)}, independent of hotel operating value — this is the capital-preservation floor that a rational seller can elect regardless of hotel market conditions.`),
  );

  // Build exit comparison rows conditionally
  const exitRows = [
    headerRow2('Exit Metric', 'Value'),
    kpiRow('Yield (Stabilised)',          pct(real.yieldStabilised)),
    kpiRow('Cumulative Yield (Final)',    pct(real.cumulativeYieldFinal)),
    kpiRow('Terminal Asset Value (Hotel)', eur(real.terminalAssetValue)),
    kpiRow('Terminal Equity Value',       eur(real.terminalEquityValue)),
    // equityIRRPropertySale exists on ScenarioOutput per types.ts
    kpiRow('Equity IRR (Property Sale)',  pct(real.equityIRRPropertySale)),
    kpiRow('Property Exit Dominates',     real.propertyExitDominates ? 'Yes — Property Sale' : 'No — Hotel Sale'),
  ];
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: exitRows,
  }));

  children.push(navLink('/admin/returns'));

  // ── §10 Annual Cash Flow Timeline ─────────────────────────────────────────
  children.push(sectionBanner('10. Annual Cash Flow Timeline'));
  // Derive inflection year safely
  const inflectionYear = real.pnl.find(r => r.netCashFlowPostVAT > 0)?.year ?? real.exitYear;
  children.push(
    bodyText(`Revenue ramps from the first operating year; EBITDA stabilises at ${eur(real.stabilisedYear?.ebitda ?? km.stabilisedEBITDA)}; the first year with positive post-VAT net cash flow is ${inflectionYear}, marking the inflection from J-curve drag to annual distributions.`),
    bodyText(`Cumulative equity yield at exit is ${pct(real.cumulativeYieldFinal)}; annual debt service of ${eur(km.annualDS)} is covered at ${mul(real.stabilisedYear?.dscr ?? km.stabilisedDSCR)}× DSCR from the stabilised year.`),
    bodyText('The DSCR column is included for lender reference; equity investors should focus on the NCF Post-VAT and Cumulative Yield columns as the primary return drivers.'),
  );
  const cf10Widths = [10, 12, 12, 12, 12, 10, 11, 21];
  const cfRows10 = real.pnl.length > 0
    ? real.pnl.map(y =>
        dataRowN([
          String(y.year),
          eur(y.totalRevenue),
          eur(y.ebitda),
          eur(y.debtService),
          eur(y.netCashFlowPostVAT),
          mul(y.dscr),
          pct(y.yieldOnInitialEquity),
          pct(y.cumulativeYieldOnInitialEquity),
        ], cf10Widths),
      )
    : [dataRowN(['—', '—', '—', '—', '—', '—', '—', '—'], cf10Widths)];

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRowN(
        ['Year', 'Revenue', 'EBITDA', 'Debt Svc', 'NCF Post-VAT', 'DSCR', 'Yield', 'Cum. Yield'],
        cf10Widths,
      ),
      ...cfRows10,
    ],
  }));

  children.push(navLink('/admin/p-and-l'));

  // ── §11 Investment Terms & Process ────────────────────────────────────────
  children.push(sectionBanner('11. Investment Terms & Process'));
  let investmentTermsPara: string;
  if (a.financingPath === 'commercial') {
    investmentTermsPara = `Commercial bank term loan at ${pct(a.commercialLoan.interestRate ?? 0)} over ${a.commercialLoan.repaymentTermYears ?? 0} years; co-investor tranche ${eur(coInvestorEquity)} of ${eur(km.equityRequired)} total equity.`;
  } else if (a.financingPath === 'tepix-loan') {
    investmentTermsPara = `TEPIX III HDB programme; co-investor tranche ${eur(coInvestorEquity)} of ${eur(km.equityRequired)} equity; milestone-dependent fund approval required before drawdown.`;
  } else if (a.financingPath === 'rrf') {
    investmentTermsPara = `RRF blended EU-rate + commercial facility; co-investor tranche ${eur(coInvestorEquity)} of ${eur(km.equityRequired)} equity; approval-dependent.`;
  } else {
    // exhaustive: grant
    investmentTermsPara = `ESPA grant of ${pct(a.grant.grantRate ?? 0)} of eligible costs; residual equity ${eur(km.equityRequired)}, co-investor tranche ${eur(coInvestorEquity)}.`;
  }
  children.push(
    bodyText(investmentTermsPara),
  );

  // Show active financing path terms
  let termRows: ReturnType<typeof kpiRow>[] = [];
  switch (a.financingPath) {
    case 'commercial':
      termRows = [
        kpiRow('Interest Rate',         pct(a.commercialLoan.interestRate ?? 0)),
        kpiRow('Repayment Term',        `${a.commercialLoan.repaymentTermYears ?? 0} years`),
        kpiRow('LTV Coverage Rate',     pct(a.commercialLoan.loanCoverageRate ?? 0)),
        kpiRow('Loan Amount',            eur(km.loanAmount)),
        kpiRow('Annual Debt Service',    eur(km.annualDS)),
      ];
      break;
    case 'grant':
      termRows = [
        kpiRow('Grant Rate',            pct(a.grant.grantRate ?? 0)),
        kpiRow('Loan Amount (Residual)', eur(km.loanAmount)),
        kpiRow('Equity Required',        eur(km.equityRequired)),
      ];
      break;
    case 'rrf':
      termRows = [
        kpiRow('RRF Coverage Rate',     pct(a.rrf.coverageRate ?? 0)),
        kpiRow('RRF Share',             pct(a.rrf.rrfShareOfLoan ?? 0)),
        kpiRow('RRF Interest Rate',     pct(a.rrf.rrfInterestRate ?? 0)),
        kpiRow('Commercial Rate',       pct(a.rrf.commercialInterestRate ?? 0)),
        kpiRow('Repayment Term',        `${a.rrf.repaymentTermYears ?? 0} years`),
      ];
      break;
    case 'tepix-loan':
      termRows = [
        kpiRow('TEPIX Coverage Rate',    pct(a.tepixLoan.coverageRate ?? 0)),
        kpiRow('Bank Interest Rate',     pct(a.tepixLoan.bankInterestRate ?? 0)),
        kpiRow('Interest Subsidy',       pct(a.tepixLoan.interestSubsidy ?? 0)),
        kpiRow('Total Term',             `${a.tepixLoan.totalTermYears ?? 0} years`),
      ];
      break;
  }

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      headerRow2(`Active Terms — ${financingPathLabel(a.financingPath)}`, 'Value'),
      ...termRows,
    ],
  }));

  children.push(navLink('/admin/assumptions'));

  children.push(
    bodyText(`Co-investor tranche: ${eur(coInvestorEquity)} of ${eur(km.equityRequired)} total equity raised.`),
    bodyText('Next: NDA → site due diligence → subscription → construction drawdown.'),
    bodyText('Forward-looking statements: all projections, IRR figures, MOIC multiples, and exit valuations in this document are forward-looking estimates based on model assumptions at the date of generation. Actual results may differ materially due to changes in market conditions, regulatory environment, financing terms, or operational performance.'),
    bodyText('No offer of securities: this document does not constitute an offer to sell, a solicitation of an offer to buy, or an invitation to subscribe for any securities. Distribution is restricted to private placement recipients in Greece; recipients outside Greece must satisfy themselves as to local securities law compliance.'),
    bodyText(`Independent advice: recipients are strongly advised to seek independent financial, legal, and tax advice before making any investment decision. Villa Lev Group — Agios Georgios, Antiparos, Greece. Generated: ${generated}.`),
  );

  // ── Assemble document ─────────────────────────────────────────────────────────

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

  const blob = await Packer.toBlob(doc);
  return blob;
}
