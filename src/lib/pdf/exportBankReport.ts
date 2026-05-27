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

function sectionHeader(doc: DocLike, label: string, y: number, margin: number, fontFam = 'helvetica') {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...HEADER_GREY);
  doc.rect(margin, y - 4, W - 2 * margin, 8, 'F');
  doc.setFont(fontFam, 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND);
  doc.text(label.toUpperCase(), margin + 2, y + 0.5);
  return y + 8;
}

type PdfStrings = {
  subtitle: string;
  confidential: string;
  pathCommercial: string;
  pathGrant: string;
  pathRRF: string;
  pathTepix: string;
  kpi_totalInvestment: string;
  kpi_loanAmount: string;
  kpi_equityRequired: string;
  kpi_ltv: string;
  kpi_assetCoverage: string;
  kpi_stabilisedRevenue: string;
  kpi_stabilisedEBITDA: string;
  kpi_ebitdaMargin: string;
  kpi_stabilisedDSCR: string;
  kpi_annualDS: string;
  sec_capitalStructure: string;
  row_portfolio: string;
  row_totalCapex: string;
  row_loanDrawn: string;
  row_equityRequired: string;
  row_ltv: string;
  row_assetCoverage: string;
  sec_capexBreakdown: string;
  sec_capexTotal: string;
  page2_title: string;
  row_revenue: string;
  row_events: string;
  row_ancillary: string;
  row_totalOpex: string;
  row_ebitda: string;
  row_ebitdaMargin: string;
  row_mainLoanInterest: string;
  row_mainLoanPrincipal: string;
  row_totalDS: string;
  row_ncf: string;
  row_loanBalance: string;
  row_dscrRealistic: string;
  row_lineItem: string;
  dscrNote: string;
  page3_title: string;
  sec_scenarioComparison: string;
  sec_dsSchedule: string;
  ds_year: string;
  ds_loanBalance: string;
  ds_interest: string;
  ds_principal: string;
  ds_totalDS: string;
  ds_dscr: string;
  page4_title: string;
  sec_collateral: string;
  col_scenario: string;
  col_valuationPerM2: string;
  col_portfolioValue: string;
  col_ltv: string;
  col_coverage: string;
  row_stress: string;
  row_market: string;
  row_optimistic: string;
  sec_returns: string;
  ret_projectIRR: string;
  ret_equityIRR: string;
  ret_moic: string;
  ret_payback: string;
  ret_exitMultiple: string;
  ret_terminalAsset: string;
  ret_terminalEquity: string;
  sec_assumptions: string;
  ass_financingPath: string;
  ass_portfolio: string;
  ass_villaADR: string;
  ass_suiteStdADR: string;
  ass_suiteDblADR: string;
  ass_villaBaseNights: string;
  ass_suiteBaseNights: string;
  ass_y1Ramp: string;
  ass_y2Ramp: string;
  ass_interestRate: string;
  ass_coverageRate: string;
  ass_repaymentTerm: string;
  ass_gracePeriod: string;
  ass_cit: string;
  ass_exitMultiple: string;
  ass_dscrCovenant: string;
  footer: string;
  generated: string;
  years: string;
  projectionOnly: string;
};

const EN: PdfStrings = {
  subtitle: 'Bank Credit Application — Project Finance Summary',
  confidential: 'CONFIDENTIAL',
  pathCommercial: 'Commercial Bank Loan',
  pathGrant: 'ESPA Development Grant',
  pathRRF: 'Recovery & Resilience Facility',
  pathTepix: 'TEPIX III Entrepreneurship Fund',
  kpi_totalInvestment: 'Total Investment',
  kpi_loanAmount: 'Loan Amount',
  kpi_equityRequired: 'Equity Required',
  kpi_ltv: 'LTV at Completion',
  kpi_assetCoverage: 'Asset Coverage',
  kpi_stabilisedRevenue: 'Stabilised Revenue',
  kpi_stabilisedEBITDA: 'Stabilised EBITDA',
  kpi_ebitdaMargin: 'EBITDA Margin',
  kpi_stabilisedDSCR: 'Stabilised DSCR',
  kpi_annualDS: 'Annual Debt Service',
  sec_capitalStructure: 'Capital Structure',
  row_portfolio: 'Portfolio',
  row_totalCapex: 'Total CAPEX',
  row_loanDrawn: 'Loan drawn',
  row_equityRequired: 'Equity required',
  row_ltv: 'LTV at completion',
  row_assetCoverage: 'Asset coverage (market)',
  sec_capexBreakdown: 'CAPEX Breakdown',
  sec_capexTotal: 'TOTAL',
  page2_title: 'P&L Summary — Conservative Scenario (€)',
  row_revenue: 'Revenue',
  row_events: '  Events (net)',
  row_ancillary: '  Ancillary (net)',
  row_totalOpex: 'Total OPEX',
  row_ebitda: 'EBITDA',
  row_ebitdaMargin: '  EBITDA Margin',
  row_mainLoanInterest: 'Main Loan Interest',
  row_mainLoanPrincipal: 'Main Loan Principal',
  row_totalDS: 'Total Debt Service',
  row_ncf: 'Net Cash Flow (post-tax)',
  row_loanBalance: 'Loan Balance (year-end)',
  row_dscrRealistic: 'DSCR (realistic)',
  row_lineItem: 'Line Item',
  dscrNote: `DSCR covenant floor: {val} — green = pass, red = fail`,
  page3_title: 'Scenario Comparison & Debt Service Schedule',
  sec_scenarioComparison: 'Downside / Conservative / Realistic — EBITDA, NCF, DSCR',
  sec_dsSchedule: 'Debt Service Schedule',
  ds_year: 'Year',
  ds_loanBalance: 'Loan Balance',
  ds_interest: 'Interest',
  ds_principal: 'Principal',
  ds_totalDS: 'Total DS',
  ds_dscr: 'DSCR',
  page4_title: 'Collateral Analysis, Returns & Assumptions',
  sec_collateral: 'Collateral Coverage Analysis',
  col_scenario: 'Scenario',
  col_valuationPerM2: 'Valuation €/m²',
  col_portfolioValue: 'Portfolio Value',
  col_ltv: 'LTV',
  col_coverage: 'Coverage',
  row_stress: 'Stress (−30%)',
  row_market: 'Market (base case)',
  row_optimistic: 'Optimistic (+20%)',
  sec_returns: 'Project Returns (Conservative Scenario)',
  ret_projectIRR: 'Unlevered Project IRR',
  ret_equityIRR: 'Levered Equity IRR',
  ret_moic: 'Total MOIC (incl. exit)',
  ret_payback: 'Equity Payback (years)',
  ret_exitMultiple: 'Exit EBITDA Multiple',
  ret_terminalAsset: 'Terminal Asset Value',
  ret_terminalEquity: 'Terminal Equity Value',
  sec_assumptions: 'Assumptions Used in This Report',
  ass_financingPath: 'Financing path',
  ass_portfolio: 'Portfolio',
  ass_villaADR: 'Villa ADR',
  ass_suiteStdADR: 'Suite standard ADR',
  ass_suiteDblADR: 'Suite double ADR',
  ass_villaBaseNights: 'Villa base nights/year',
  ass_suiteBaseNights: 'Suite base nights/year',
  ass_y1Ramp: 'Y1 ramp factor (2028)',
  ass_y2Ramp: 'Y2 ramp factor (2029)',
  ass_interestRate: 'Loan interest rate',
  ass_coverageRate: 'Loan coverage rate',
  ass_repaymentTerm: 'Repayment term',
  ass_gracePeriod: 'Grace period',
  ass_cit: 'Corporate income tax',
  ass_exitMultiple: 'Exit EBITDA multiple',
  ass_dscrCovenant: 'DSCR covenant floor',
  footer: 'Forward-looking projections only. Not investment advice. Villa Lev Group — Agios Georgios, Antiparos, Greece.',
  generated: 'Generated',
  years: 'years',
  projectionOnly: 'Forward-looking projections only. Not investment advice.',
};

const EL: PdfStrings = {
  subtitle: 'Αίτηση Τραπεζικής Χρηματοδότησης — Σύνοψη Χρηματοδότησης Έργου',
  confidential: 'ΕΜΠΙΣΤΕΥΤΙΚΟ',
  pathCommercial: 'Εμπορικό Τραπεζικό Δάνειο',
  pathGrant: 'Επιχορήγηση ΕΣΠΑ',
  pathRRF: 'Ταμείο Ανάκαμψης και Ανθεκτικότητας',
  pathTepix: 'ΤΕΠΙΞ ΙΙΙ — Ταμείο Επιχειρηματικότητας',
  kpi_totalInvestment: 'Συνολική Επένδυση',
  kpi_loanAmount: 'Ποσό Δανείου',
  kpi_equityRequired: 'Απαιτούμενα Ίδια Κεφάλαια',
  kpi_ltv: 'LTV κατά την Ολοκλήρωση',
  kpi_assetCoverage: 'Κάλυψη Ενεργητικού',
  kpi_stabilisedRevenue: 'Σταθεροποιημένα Έσοδα',
  kpi_stabilisedEBITDA: 'Σταθεροποιημένο EBITDA',
  kpi_ebitdaMargin: 'Περιθώριο EBITDA',
  kpi_stabilisedDSCR: 'Σταθεροποιημένο DSCR',
  kpi_annualDS: 'Ετήσια Εξυπηρέτηση Χρέους',
  sec_capitalStructure: 'Κεφαλαιακή Διάρθρωση',
  row_portfolio: 'Χαρτοφυλάκιο',
  row_totalCapex: 'Συνολικές Επενδύσεις',
  row_loanDrawn: 'Ποσό Δανείου',
  row_equityRequired: 'Απαιτούμενα Ίδια Κεφάλαια',
  row_ltv: 'LTV κατά την Ολοκλήρωση',
  row_assetCoverage: 'Κάλυψη Ενεργητικού (αγορά)',
  sec_capexBreakdown: 'Ανάλυση Επενδύσεων',
  sec_capexTotal: 'ΣΥΝΟΛΟ',
  page2_title: 'Σύνοψη Αποτελεσμάτων — Συντηρητικό Σενάριο (€)',
  row_revenue: 'Έσοδα',
  row_events: '  Εκδηλώσεις (καθαρό)',
  row_ancillary: '  Βοηθητικές Υπηρεσίες (καθαρό)',
  row_totalOpex: 'Συνολικά Λειτουργικά Έξοδα',
  row_ebitda: 'EBITDA',
  row_ebitdaMargin: '  Περιθώριο EBITDA',
  row_mainLoanInterest: 'Τόκοι Κύριου Δανείου',
  row_mainLoanPrincipal: 'Κεφάλαιο Κύριου Δανείου',
  row_totalDS: 'Συνολική Εξυπηρέτηση Χρέους',
  row_ncf: 'Καθαρές Ταμειακές Ροές (μετά φόρο)',
  row_loanBalance: 'Υπόλοιπο Δανείου (τέλος έτους)',
  row_dscrRealistic: 'DSCR (συντηρητικό)',
  row_lineItem: 'Γραμμή',
  dscrNote: `Κατώφλι DSCR: {val} — πράσινο = πάσσει, κόκκινο = αποτυγχάνει`,
  page3_title: 'Σύγκριση Σεναρίων & Πρόγραμμα Εξυπηρέτησης Χρέους',
  sec_scenarioComparison: 'Καθοδικό / Συντηρητικό / Ρεαλιστικό+ — EBITDA, NCF, DSCR',
  sec_dsSchedule: 'Πρόγραμμα Εξυπηρέτησης Χρέους',
  ds_year: 'Έτος',
  ds_loanBalance: 'Υπόλοιπο Δανείου',
  ds_interest: 'Τόκοι',
  ds_principal: 'Κεφάλαιο',
  ds_totalDS: 'Σύνολο DS',
  ds_dscr: 'DSCR',
  page4_title: 'Ανάλυση Εξασφαλίσεων, Αποδόσεις & Παραδοχές',
  sec_collateral: 'Ανάλυση Κάλυψης Εξασφαλίσεων',
  col_scenario: 'Σενάριο',
  col_valuationPerM2: 'Αποτίμηση €/m²',
  col_portfolioValue: 'Αξία Χαρτοφυλακίου',
  col_ltv: 'LTV',
  col_coverage: 'Κάλυψη',
  row_stress: 'Stress (−30%)',
  row_market: 'Αγορά (βασικό σενάριο)',
  row_optimistic: 'Αισιόδοξο (+20%)',
  sec_returns: 'Αποδόσεις Έργου (Συντηρητικό Σενάριο)',
  ret_projectIRR: 'IRR Έργου (χωρίς μόχλευση)',
  ret_equityIRR: 'IRR Ιδίων Κεφαλαίων (με μόχλευση)',
  ret_moic: 'Συνολικό MOIC (με έξοδο)',
  ret_payback: 'Αποπληρωμή Ιδίων Κεφαλαίων (έτη)',
  ret_exitMultiple: 'Πολλαπλάσιο Εξόδου EBITDA',
  ret_terminalAsset: 'Τερματική Αξία Ενεργητικού',
  ret_terminalEquity: 'Τερματική Αξία Ιδίων Κεφαλαίων',
  sec_assumptions: 'Παραδοχές που Χρησιμοποιήθηκαν',
  ass_financingPath: 'Διαδρομή χρηματοδότησης',
  ass_portfolio: 'Χαρτοφυλάκιο',
  ass_villaADR: 'ADR Βίλας',
  ass_suiteStdADR: 'ADR Σουίτας Standard',
  ass_suiteDblADR: 'ADR Σουίτας Double',
  ass_villaBaseNights: 'Βασικές διανυκτερεύσεις Βίλας/έτος',
  ass_suiteBaseNights: 'Βασικές διανυκτερεύσεις Σουίτας/έτος',
  ass_y1Ramp: 'Συντελεστής Y1 (2028)',
  ass_y2Ramp: 'Συντελεστής Y2 (2029)',
  ass_interestRate: 'Επιτόκιο Δανείου',
  ass_coverageRate: 'Ποσοστό Κάλυψης Δανείου',
  ass_repaymentTerm: 'Διάρκεια Αποπληρωμής',
  ass_gracePeriod: 'Περίοδος Χάριτος',
  ass_cit: 'Φόρος Εισοδήματος Εταιρείας',
  ass_exitMultiple: 'Πολλαπλάσιο Εξόδου EBITDA',
  ass_dscrCovenant: 'Κατώφλι DSCR',
  footer: 'Μόνο προβλέψεις. Δεν αποτελεί επενδυτική συμβουλή. Villa Lev Group — Άγιος Γεώργιος, Αντίπαρος, Ελλάδα.',
  generated: 'Δημιουργήθηκε',
  years: 'έτη',
  projectionOnly: 'Μόνο προβλέψεις. Δεν αποτελεί επενδυτική συμβουλή.',
};

const HE: PdfStrings = {
  subtitle: 'בקשת אשראי בנקאי — סיכום מימון פרויקט',
  confidential: 'סודי',
  pathCommercial: 'הלוואת בנק מסחרי',
  pathGrant: 'מענק פיתוח ESPA',
  pathRRF: 'קרן ההתאוששות והחוסן',
  pathTepix: 'קרן יזמות TEPIX III',
  kpi_totalInvestment: 'השקעה כוללת',
  kpi_loanAmount: 'סכום הלוואה',
  kpi_equityRequired: 'הון עצמי נדרש',
  kpi_ltv: 'LTV עם השלמה',
  kpi_assetCoverage: 'כיסוי נכסים',
  kpi_stabilisedRevenue: 'הכנסות מיוצבות',
  kpi_stabilisedEBITDA: 'EBITDA מיוצב',
  kpi_ebitdaMargin: 'שולי EBITDA',
  kpi_stabilisedDSCR: 'DSCR מיוצב',
  kpi_annualDS: 'שירות חוב שנתי',
  sec_capitalStructure: 'מבנה הון',
  row_portfolio: 'תיק השקעות',
  row_totalCapex: 'סך השקעות הון',
  row_loanDrawn: 'הלוואה שנמשכה',
  row_equityRequired: 'הון עצמי נדרש',
  row_ltv: 'LTV עם השלמה',
  row_assetCoverage: 'כיסוי נכסים (שוק)',
  sec_capexBreakdown: 'פירוט השקעות הון',
  sec_capexTotal: 'סך הכל',
  page2_title: 'סיכום רווח והפסד — תרחיש שמרני (€)',
  row_revenue: 'הכנסות',
  row_events: '  אירועים (נטו)',
  row_ancillary: '  שירותים נלווים (נטו)',
  row_totalOpex: 'סך הוצאות תפעול',
  row_ebitda: 'EBITDA',
  row_ebitdaMargin: '  שולי EBITDA',
  row_mainLoanInterest: 'ריבית הלוואה ראשית',
  row_mainLoanPrincipal: 'קרן הלוואה ראשית',
  row_totalDS: 'סך שירות חוב',
  row_ncf: 'תזרים מזומנים נטו (לאחר מס)',
  row_loanBalance: 'יתרת הלוואה (סוף שנה)',
  row_dscrRealistic: 'DSCR (שמרני)',
  row_lineItem: 'שורה',
  dscrNote: 'רצפת קובננט DSCR: {val} — ירוק = עובר, אדום = נכשל',
  page3_title: 'השוואת תרחישים ולוח שירות חוב',
  sec_scenarioComparison: 'שלילי / שמרני / ריאליסטי+ — EBITDA, NCF, DSCR',
  sec_dsSchedule: 'לוח שירות חוב',
  ds_year: 'שנה',
  ds_loanBalance: 'יתרת הלוואה',
  ds_interest: 'ריבית',
  ds_principal: 'קרן',
  ds_totalDS: 'סך DS',
  ds_dscr: 'DSCR',
  page4_title: 'ניתוח ביטחונות, תשואות ונחות',
  sec_collateral: 'ניתוח כיסוי ביטחונות',
  col_scenario: 'תרחיש',
  col_valuationPerM2: 'שווי €/m²',
  col_portfolioValue: 'שווי תיק',
  col_ltv: 'LTV',
  col_coverage: 'כיסוי',
  row_stress: 'לחץ (−30%)',
  row_market: 'שוק (בסיס)',
  row_optimistic: 'אופטימי (+20%)',
  sec_returns: 'תשואות פרויקט (תרחיש שמרני)',
  ret_projectIRR: 'IRR פרויקט (ללא מינוף)',
  ret_equityIRR: 'IRR הון עצמי (עם מינוף)',
  ret_moic: 'MOIC כולל (כולל יציאה)',
  ret_payback: 'החזר הון עצמי (שנים)',
  ret_exitMultiple: 'כפולת יציאה EBITDA',
  ret_terminalAsset: 'שווי נכס סופי',
  ret_terminalEquity: 'שווי הון עצמי סופי',
  sec_assumptions: 'הנחות שימשו בדוח זה',
  ass_financingPath: 'מסלול מימון',
  ass_portfolio: 'תיק השקעות',
  ass_villaADR: 'ADR וילה',
  ass_suiteStdADR: 'ADR סוויטה סטנדרטית',
  ass_suiteDblADR: 'ADR סוויטה כפולה',
  ass_villaBaseNights: 'לילות בסיס וילה/שנה',
  ass_suiteBaseNights: 'לילות בסיס סוויטה/שנה',
  ass_y1Ramp: 'מקדם שנה 1 (2028)',
  ass_y2Ramp: 'מקדם שנה 2 (2029)',
  ass_interestRate: 'ריבית הלוואה',
  ass_coverageRate: 'שיעור כיסוי הלוואה',
  ass_repaymentTerm: 'תקופת פירעון',
  ass_gracePeriod: 'תקופת חסד',
  ass_cit: 'מס הכנסה חברות',
  ass_exitMultiple: 'כפולת יציאה EBITDA',
  ass_dscrCovenant: 'רצפת קובננט DSCR',
  footer: 'תחזיות בלבד. אינו ייעוץ השקעות. Villa Lev Group — אגיוס גיאורגיוס, אנטיפרוס, יוון.',
  generated: 'נוצר',
  years: 'שנים',
  projectionOnly: 'תחזיות בלבד. אינו ייעוץ השקעות.',
};

/**
 * jsPDF renders text left-to-right regardless of language.
 * For Hebrew, we reverse the string so that characters appear in the
 * correct visual order when drawn LTR.
 * Strings containing ASCII letters (e.g. "DSCR", "IRR") are NOT reversed
 * because the Latin part must stay readable.
 */
function heDisplay(s: string, locale: import('@/lib/i18n/types').Locale): string {
  if (locale !== 'he') return s;
  // Only reverse purely Hebrew strings (no Latin letters)
  if (/[A-Za-z]/.test(s)) return s;
  return s.split('').reverse().join('');
}

export async function exportBankReport(
  a: ModelAssumptions,
  m: ModelOutput,
  locale: import('@/lib/i18n/types').Locale = 'en',
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

  // Locale-aware string table.
  const T = locale === 'el' ? EL : locale === 'he' ? HE : EN;

  // Embed NotoSans for Greek / NotoSansHebrew for Hebrew to ensure correct character rendering.
  let fontFamily = 'helvetica';

  if (locale === 'el' || locale === 'he') {
    const fontFile = locale === 'el' ? 'NotoSans-Regular.ttf' : 'NotoSansHebrew-Regular.ttf';
    const fontName = locale === 'el' ? 'NotoSans' : 'NotoSansHebrew';
    try {
      const fontResp = await fetch(`/fonts/${fontFile}`);
      if (fontResp.ok) {
        const fontBuffer = await fontResp.arrayBuffer();
        const fontUint8 = new Uint8Array(fontBuffer);
        let binary = '';
        fontUint8.forEach(b => { binary += String.fromCharCode(b); });
        const base64 = btoa(binary);
        doc.addFileToVFS(fontFile, base64);
        doc.addFont(fontFile, fontName, 'normal');
        doc.addFont(fontFile, fontName, 'bold');
        fontFamily = fontName;
      }
    } catch {
      // Fall back to helvetica silently
    }
  }

  const pathLabel =
    a.financingPath === 'commercial' ? T.pathCommercial
    : a.financingPath === 'grant' ? T.pathGrant
    : a.financingPath === 'rrf' ? T.pathRRF
    : T.pathTepix;

  const generated = new Date().toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const km = m.keyMetrics;
  const realistic = m.scenarios.realistic;
  const upside = m.scenarios.upside;
  const downside = m.scenarios.downside;
  const pnl = realistic.pnl;

  // Portfolio summary label, e.g. "2× Villas" or "1× Villa + 4× Suites"
  const totalVillaUnits = a.portfolio.reduce((s, p) => s + p.villaUnits * p.count, 0);
  const totalSuites = a.portfolio.reduce((s, p) => s + (p.standardSuites + p.doubleSuites) * p.count, 0);
  const portfolioLabel = [
    totalVillaUnits > 0 ? `${totalVillaUnits}× Villa${totalVillaUnits !== 1 ? 's' : ''}` : '',
    totalSuites > 0 ? `${totalSuites}× Suite${totalSuites !== 1 ? 's' : ''}` : '',
  ].filter(Boolean).join(' + ');

  const footerFn = (doc: InstanceType<typeof JsPDF>, pageNum: number, totalPages: number, footer: string, fontFam = 'helvetica') => {
    const fy = H - 8;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, fy - 3, W - margin, fy - 3);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.setFont(fontFam, 'normal');
    doc.text(footer, margin, fy);
    doc.text(`${pageNum} / ${totalPages}`, W - margin, fy, { align: 'right' });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGE 1 — Cover + KPIs
  // ─────────────────────────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(18);
  doc.text('Villa Lev Group', margin, 14);
  doc.setFontSize(11);
  doc.setFont(fontFamily, 'normal');
  doc.text(heDisplay(T.subtitle, locale), margin, 22);
  doc.setFontSize(8);
  doc.setTextColor(220, 220, 220);
  doc.text(`${heDisplay(pathLabel, locale)}${portfolioLabel ? ` · ${portfolioLabel}` : ''} · ${heDisplay(T.generated, locale)} ${generated}`, margin, 30);
  doc.text(heDisplay(T.confidential, locale), W - margin, 30, { align: 'right' });

  let y = 50;

  // — Headline KPIs — 2 rows × 5 cols
  const kpiRows: Array<Array<[string, string, boolean?]>> = [
    [
      [heDisplay(T.kpi_totalInvestment, locale), eur(km.totalCapex)],
      [heDisplay(T.kpi_loanAmount, locale), eur(km.loanAmount)],
      [heDisplay(T.kpi_equityRequired, locale), eur(km.equityRequired)],
      [heDisplay(T.kpi_ltv, locale), pct(km.ltv)],
      [heDisplay(T.kpi_assetCoverage, locale), mul(km.assetCoverage)],
    ],
    [
      [heDisplay(T.kpi_stabilisedRevenue, locale), eur(km.stabilisedRevenue)],
      [heDisplay(T.kpi_stabilisedEBITDA, locale), eur(km.stabilisedEBITDA)],
      [heDisplay(T.kpi_ebitdaMargin, locale), pct(km.stabilisedEBITDAMargin)],
      [heDisplay(T.kpi_stabilisedDSCR, locale), mul(km.stabilisedDSCR), km.stabilisedDSCR >= a.dscrCovenantThreshold],
      [heDisplay(T.kpi_annualDS, locale), eur(km.annualDS)],
    ],
  ];
  const cellW = (W - 2 * margin) / 5;
  kpiRows.forEach((row) => {
    row.forEach(([label, value, good], i) => {
      const x = margin + i * cellW;
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(250, 248, 242);
      doc.rect(x, y, cellW, 18, 'FD');
      doc.setFont(fontFamily, 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      doc.text(label.toUpperCase(), x + 2, y + 5);
      doc.setFont(fontFamily, 'bold');
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
  y = sectionHeader(doc as DocLike, heDisplay(T.sec_capitalStructure, locale), y, margin, fontFamily);
  y += 2;
  const capRows = [
    [heDisplay(T.row_portfolio, locale), portfolioLabel || '—'],
    [heDisplay(T.row_totalCapex, locale), eur(km.totalCapex)],
    [heDisplay(T.row_loanDrawn, locale), eur(km.loanAmount)],
    [heDisplay(T.row_equityRequired, locale), eur(km.equityRequired)],
    [heDisplay(T.row_ltv, locale), pct(km.ltv)],
    [heDisplay(T.row_assetCoverage, locale), mul(km.assetCoverage)],
  ];
  doc.setFontSize(8.5);
  capRows.forEach(([label, val]) => {
    doc.setFont(fontFamily, 'normal');
    doc.setTextColor(...MUTED);
    doc.text(label, margin + 2, y);
    doc.setTextColor(...TEXT);
    doc.setFont(fontFamily, 'bold');
    doc.text(val, W / 2, y, { align: 'right' });
    y += 5.5;
  });
  y += 4;

  // — CAPEX breakdown by property —
  y = sectionHeader(doc as DocLike, heDisplay(T.sec_capexBreakdown, locale), y, margin, fontFamily);
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
    [heDisplay(T.sec_capexTotal, locale), ...m.capex.properties.map((p) => eur(p.total)), eur(km.totalCapex)],
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

  footerFn(doc, 1, 4, heDisplay(T.footer, locale), fontFamily);

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGE 2 — P&L Table
  // ─────────────────────────────────────────────────────────────────────────────
  doc.addPage();
  y = margin;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 12, 'F');
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(heDisplay(T.page2_title, locale), margin, 8);
  y = 18;

  const opYears = pnl.filter((p) => p.year >= 2028);
  const allYears = pnl;
  const yrLabels = allYears.map((p) => String(p.year));

  const pnlRows: Array<[string, (p: typeof pnl[0]) => string, boolean?]> = [
    [heDisplay(T.row_revenue, locale), (p) => eur(p.totalRevenue)],
    [heDisplay(T.row_events, locale), (p) => (p.revenueEvents > 0 ? eur(p.revenueEvents) : '—')],
    [heDisplay(T.row_ancillary, locale), (p) => (p.revenueAncillary > 0 ? eur(p.revenueAncillary) : '—')],
    [heDisplay(T.row_totalOpex, locale), (p) => eur(p.totalOpex)],
    [heDisplay(T.row_ebitda, locale), (p) => eur(p.ebitda), true],
    [heDisplay(T.row_ebitdaMargin, locale), (p) => (p.ebitda > 0 && p.totalRevenue > 0 ? pct(p.ebitda / p.totalRevenue) : '—')],
    [heDisplay(T.row_mainLoanInterest, locale), (p) => (p.termLoanInterest > 0 ? eur(p.termLoanInterest) : '—')],
    [heDisplay(T.row_mainLoanPrincipal, locale), (p) => (p.termLoanPrincipal > 0 ? eur(p.termLoanPrincipal) : '—')],
    [heDisplay(T.row_totalDS, locale), (p) => (p.debtService > 0 ? eur(p.debtService) : '—')],
    [heDisplay(T.row_ncf, locale), (p) => eur(p.netCashFlowPostVAT), true],
    [heDisplay(T.row_loanBalance, locale), (p) => (p.termLoanBalance > 0 ? eur(p.termLoanBalance) : '—')],
    [heDisplay(T.row_dscrRealistic, locale), (p) => (p.dscr > 0 ? mul(p.dscr) : '—'), true],
  ];

  const pnlBody = pnlRows.map(([label, fn]) => [label, ...allYears.map(fn)]);
  autoTable(doc, {
    startY: y,
    head: [[heDisplay(T.row_lineItem, locale), ...yrLabels]],
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
          data.cell.styles.textColor = yr.dscr >= a.dscrCovenantThreshold ? GREEN : RED;
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
  doc.setFont(fontFamily, 'normal');
  doc.setTextColor(...MUTED);
  doc.text(heDisplay(T.dscrNote.replace('{val}', mul(a.dscrCovenantThreshold)), locale), margin, y);

  footerFn(doc, 2, 4, heDisplay(T.footer, locale), fontFamily);

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGE 3 — Scenario Comparison + Debt Service Schedule
  // ─────────────────────────────────────────────────────────────────────────────
  doc.addPage();
  y = margin;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 12, 'F');
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(heDisplay(T.page3_title, locale), margin, 8);
  y = 18;

  // — Scenario comparison (EBITDA + NCF + DSCR for Downside / Realistic / Upside) —
  y = sectionHeader(doc as DocLike, heDisplay(T.sec_scenarioComparison, locale), y, margin, fontFamily);
  y += 2;

  const scenYears = opYears.map((p) => p.year);
  const scenHead = [[heDisplay(T.ds_year, locale), ...scenYears.map((yr) => String(yr))]];

  const scenMetrics: Array<[string, (yr: number) => string, boolean?]> = [
    [`EBITDA — Downside`, (yr) => {
      const p = downside.pnl.find((x) => x.year === yr);
      return p ? eur(p.ebitda) : '—';
    }],
    [`EBITDA — Conservative`, (yr) => {
      const p = realistic.pnl.find((x) => x.year === yr);
      return p ? eur(p.ebitda) : '—';
    }, true],
    [`EBITDA — Realistic`, (yr) => {
      const p = upside.pnl.find((x) => x.year === yr);
      return p ? eur(p.ebitda) : '—';
    }],
    [`NCF post-tax — Downside`, (yr) => {
      const p = downside.pnl.find((x) => x.year === yr);
      return p ? eur(p.netCashFlowPostVAT) : '—';
    }],
    [`NCF post-tax — Conservative`, (yr) => {
      const p = realistic.pnl.find((x) => x.year === yr);
      return p ? eur(p.netCashFlowPostVAT) : '—';
    }, true],
    [`DSCR — Downside`, (yr) => {
      const p = downside.pnl.find((x) => x.year === yr);
      return p && p.dscr > 0 ? mul(p.dscr) : '—';
    }],
    [`DSCR — Conservative`, (yr) => {
      const p = realistic.pnl.find((x) => x.year === yr);
      return p && p.dscr > 0 ? mul(p.dscr) : '—';
    }, true],
    [`DSCR — Realistic`, (yr) => {
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
  y = sectionHeader(doc as DocLike, heDisplay(T.sec_dsSchedule, locale), y, margin, fontFamily);
  y += 2;

  const dsHead = [[
    heDisplay(T.ds_year, locale),
    heDisplay(T.ds_loanBalance, locale),
    heDisplay(T.ds_interest, locale),
    heDisplay(T.ds_principal, locale),
    heDisplay(T.ds_totalDS, locale),
    heDisplay(T.ds_dscr, locale),
  ]];
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

  footerFn(doc, 3, 4, heDisplay(T.footer, locale), fontFamily);

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGE 4 — Collateral + Returns + Assumptions
  // ─────────────────────────────────────────────────────────────────────────────
  doc.addPage();
  y = margin;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 12, 'F');
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(heDisplay(T.page4_title, locale), margin, 8);
  y = 18;

  // — Collateral —
  y = sectionHeader(doc as DocLike, heDisplay(T.sec_collateral, locale), y, margin, fontFamily);
  y += 2;
  const col = m.collateral;
  const colHead = [[
    heDisplay(T.col_scenario, locale),
    heDisplay(T.col_valuationPerM2, locale),
    heDisplay(T.col_portfolioValue, locale),
    heDisplay(T.col_ltv, locale),
    heDisplay(T.col_coverage, locale),
  ]];
  const colBody = [
    [heDisplay(T.row_stress, locale), eur(col.stress.valuationPerM2), eur(col.stress.value), pct(col.stress.ltv), mul(col.stress.coverage)],
    [heDisplay(T.row_market, locale), eur(col.market.valuationPerM2), eur(col.market.value), pct(col.market.ltv), mul(col.market.coverage)],
    [heDisplay(T.row_optimistic, locale), eur(col.optimistic.valuationPerM2), eur(col.optimistic.value), pct(col.optimistic.ltv), mul(col.optimistic.coverage)],
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

  // — Key Assumptions —
  y = sectionHeader(doc as DocLike, heDisplay(T.sec_assumptions, locale), y, margin, fontFamily);
  y += 2;
  const assumpRows: Array<[string, string]> = [
    [heDisplay(T.ass_financingPath, locale), heDisplay(pathLabel, locale)],
    [heDisplay(T.ass_portfolio, locale), portfolioLabel || '—'],
    [heDisplay(T.ass_villaADR, locale), eur(a.revenueRealistic.villaADR)],
    [heDisplay(T.ass_suiteStdADR, locale), eur(a.revenueRealistic.suiteStandardADR)],
    [heDisplay(T.ass_suiteDblADR, locale), eur(a.revenueRealistic.suiteDoubleADR)],
    [heDisplay(T.ass_villaBaseNights, locale), String(a.revenueRealistic.villaBaseNights)],
    [heDisplay(T.ass_suiteBaseNights, locale), String(a.revenueRealistic.suiteBaseNights)],
    [heDisplay(T.ass_y1Ramp, locale), pct(a.general.year1RampFactor)],
    [heDisplay(T.ass_y2Ramp, locale), pct(a.general.year2RampFactor)],
    [heDisplay(T.ass_interestRate, locale), pct(a.commercialLoan.interestRate)],
    [heDisplay(T.ass_coverageRate, locale), pct(a.commercialLoan.loanCoverageRate)],
    [heDisplay(T.ass_repaymentTerm, locale), `${a.commercialLoan.repaymentTermYears} ${heDisplay(T.years, locale)}`],
    [heDisplay(T.ass_gracePeriod, locale), `${a.commercialLoan.gracePeriodYears} ${heDisplay(T.years, locale)}`],
    [heDisplay(T.ass_cit, locale), pct(a.tax.corporateIncomeTaxRate)],
    [heDisplay(T.ass_exitMultiple, locale), mul(a.exitEbitdaMultiple)],
    [heDisplay(T.ass_dscrCovenant, locale), mul(a.dscrCovenantThreshold)],
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
    doc.setFont(fontFamily, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label, cx + 2, cy);
    doc.setFont(fontFamily, 'bold');
    doc.setTextColor(...TEXT);
    doc.text(val, cx + halfW - 2, cy, { align: 'right' });
    if (inCol2) col2Y += 5.5;
    else col1Y += 5.5;
  });

  footerFn(doc, 4, 4, heDisplay(T.footer, locale), fontFamily);

  return doc.output('blob');
}
