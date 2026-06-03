"use client";

import React, { useEffect } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import {
  formatCurrency,
  formatPercent,
  formatMultiple,
} from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { Locale } from "@/lib/i18n/types";
import { PageSkeleton } from "@/components/Skeleton";
import { PageTour, TourButton, usePageTour } from "@/components/PageTour";
import { OPCO_SPLIT_TOUR } from "@/lib/tours/configs";
import { SectionHeader } from "@/components/AdminUI";
import type { ModelAssumptions, ScenarioOutput } from "@/lib/engine/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTrackFeature } from "@/lib/hooks/useTrackFeature";

// ── Inline translation object ─────────────────────────────────────────
// Used by subcomponents that don't have access to the useTranslation hook.
// fr falls back to en — this page has not been localised to French yet.
const _T = ({
  en: {
    pageTitle: 'OpCo / PropCo Split',
    pageSubtitleTemplate: '{scenario} · Compare an owner-only structure to one where a separate management company (OpCo) operates the assets and the asset owner (PropCo) holds the real estate.',
    juniorTier1RateLabel: 'Tier 1 junior rate',
    juniorTier1RateSub: '% of post-DS residual up to threshold',
    juniorTier2RateLabel: 'Tier 2 junior rate',
    juniorTier2RateSub: '% of post-DS residual above threshold',
    juniorThresholdLabel: 'Tier breakpoint',
    juniorThresholdSub: '€ residual threshold between Tier 1 and Tier 2',
    seniorFloorLabel: 'Senior floor',
    juniorFeeLabel: 'Junior fee (tiered)',
    chartBarSenior: 'Senior floor',
    chartBarJunior: 'Junior fee (tiered)',
    rulesSummaryTitle: 'Fee rules',
    rulesSeniorFloor: 'Senior floor',
    rulesTier1: 'Tier 1 junior',
    rulesTier2: 'Tier 2 junior',
    rulesDscrBasis: 'DSCR basis',
    rulesNoCarryForward: 'No carry-forward',
    splitOffNote: 'The split is currently OFF. All other pages (Dashboard, P&L, Scenarios) show owner-only numbers. Toggle on above to apply the OpCo fee waterfall and see the impact on PropCo\'s return.',
    kpiOpcoFee: 'OpCo fee — stabilised',
    kpiPropcoEbitda: 'PropCo EBITDA',
    kpiPropcoIRR: 'PropCo equity IRR',
    kpiIRRCost: 'IRR cost of split',
    kpiIRRCostSublabelOn: 'Pre-split:',
    kpiIRRCostSublabelOff: 'Owner takes 100% of GOP',
    kpiLevered: 'Levered, with terminal value',
    kpiToggleOn: 'Toggle split ON',
    kpiOfRevenue: 'of revenue',
    kpiPreSplit: 'vs {val} pre-split',
    compTableTitle: 'Owner-only vs. PropCo / OpCo — stabilised 2031',
    compColMetric: 'Metric',
    compColOwner: 'Owner-only (pre-split)',
    compColPropco: 'PropCo (post OpCo fees)',
    compColDelta: 'Delta',
    compRowRevenue: 'Total revenue (stabilised)',
    compRowEbitda: 'EBITDA',
    compRowEbitdaMargin: 'EBITDA margin',
    compRowDSCR: 'Stabilised DSCR',
    compRowIRR: 'Equity IRR',
    stabWaterfallTitle: 'Stabilised 2031 fee waterfall',
    watRevenue: 'Total revenue',
    watEbitdaPreFee: 'EBITDA (= GOP) before OpCo fees',
    watOpcoEarns: 'OpCo earns',
    watPropcoRetains: 'PropCo retains (EBITDA)',
    yearByYearTitle: 'OpCo fees by year',
    colItem: 'Item',
    yearRowBase: 'Senior floor',
    yearRowIncentive: 'Junior fee (tiered)',
    yearRowTotal: 'OpCo total',
    yearRowEbitdaPre: 'EBITDA pre-fees',
    yearRowPropcoEbitda: 'PropCo EBITDA',
    chartTitle: 'OpCo fee composition by year',
    chartBarBase: 'Base management fee',
    chartBarIncentive: 'Incentive fee',
    tipText: 'Tip: change the financing path or scenario from the top bar to see how the same fee schedule plays out under different revenue assumptions. Use ROIC and DSCR delta on the Dashboard to judge whether bank covenants still pass after the split.',
    explainerHeading1: 'How the split works.',
    explainerBody1: 'When enabled, OpCo earns a guaranteed floor (paid junior to debt service — accrues when cash insufficient) plus a tiered junior fee on the post-DS residual: Tier 1 rate up to the breakpoint, Tier 2 rate above it. DS is unambiguously senior to all OpCo fees. DSCR = ebitdaPreOpCo / DS — floor and junior are never in the numerator.',
    explainerHeading2: 'All metrics below are PropCo\'s',
    explainerBody2: '— DSCR, NCF, equity IRR all reflect the cash flow that survives to the asset owner after OpCo fees are paid. The IRR cost of split card quantifies how much equity return moves from PropCo to OpCo.',
    // EntityDiagram
    propcoTitle: 'PropCo (Greek SPV)',
    propcoDesc: 'Holds real estate',
    propcoOwns: 'Owns:',
    propcoPlots: 'plots',
    propcoPlot: 'plot',
    propcoCapex: 'CapEx:',
    propcoOwes: 'Owes bank:',
    propcoEquity: 'Equity:',
    propcoReceives: 'Receives: NCF · grant (if approved) · equity contributions',
    opcoTitle: 'OpCo / ManCo',
    opcoDesc: 'Villa Lev Group',
    opcoOwns: 'Owns:',
    opcoOwnsBrand: 'Brand IP + operational know-how',
    opcoProvides: 'Provides:',
    opcoProvidesMgmt: 'Mgmt services · brand · dev supervision',
    opcoReceives: 'Receives: 3 fee buckets from PropCo (see below)',
    investorsTitle: 'Investors',
    investorsDesc: 'Cap-table holders',
    investorsHold: 'Hold:',
    investorsHoldDesc: 'Equity claims on PropCo',
    investorsReceive: 'Receive: distributions per 3-layer waterfall (pari-passu · dev equity · ratchet)',
    bankTitle: 'Bank',
    bankDesc: 'Senior secured lender',
    bankHolds: 'Holds:',
    bankHoldsDesc: 'Senior debt on PropCo',
    bankReceives: 'Receives:',
    bankReceivesDesc: 'Annual debt service + residual principal at exit',
    // FeeStreamsTable
    feeColFee: 'Fee',
    feeColRate: 'Rate',
    feeColAmount: 'Amount',
    feeColWhen: 'When',
    bucketBuildingTitle: 'Development management fee',
    bucketBuildingSub: 'OpCo manages site sourcing, permitting, contractor oversight, and construction delivery on behalf of PropCo · absorbed into project CapEx',
    bucketBuildingRate: '€5K/month',
    bucketBuildingWhen: 'Construction phase · 2026 → 2028',
    bucketBaseTitle: 'Base management fee',
    bucketBaseSub: 'Brand + operational management combined',
    bucketBaseRate: '5% of gross revenue',
    bucketBaseWhen: 'Annual · 2029 → exit',
    bucketIncentiveTitle: 'Incentive fee',
    bucketIncentiveSub: '10% of GOP above 8% hurdle · junior to DS · max 50% of residual NCF',
    bucketIncentiveRate: '% of GOP above hurdle, capped at 50% residual',
    bucketIncentiveWhen: 'Annual · 2029 → exit',
    deferToggleLabel: 'Defer 2029 opening-year floor to 2030',
    deferToggleSub: '2029 senior floor = €0; carries flat to 2030 (no interest). Admin view only.',
    rulesDefer2029Carry: '1-year carry: 2029 floor deferred flat to 2030',
  },
  el: {
    pageTitle: 'Διαχωρισμός OpCo / PropCo',
    pageSubtitleTemplate: '{scenario} · Σύγκριση δομής μόνο-ιδιοκτήτη με δομή όπου εταιρεία διαχείρισης (OpCo) λειτουργεί τα ακίνητα.',
    juniorTier1RateLabel: 'Επιτόκιο junior Tier 1',
    juniorTier1RateSub: '% υπολοίπου μετά DS έως το όριο',
    juniorTier2RateLabel: 'Επιτόκιο junior Tier 2',
    juniorTier2RateSub: '% υπολοίπου μετά DS πάνω από το όριο',
    juniorThresholdLabel: 'Σημείο κατωφλίου',
    juniorThresholdSub: '€ κατώφλι υπολοίπου μεταξύ Tier 1 και Tier 2',
    seniorFloorLabel: 'Senior floor',
    juniorFeeLabel: 'Junior αμοιβή (κλιμακωτή)',
    chartBarSenior: 'Senior floor',
    chartBarJunior: 'Junior αμοιβή (κλιμακωτή)',
    rulesSummaryTitle: 'Κανόνες αμοιβών',
    rulesSeniorFloor: 'Senior floor',
    rulesTier1: 'Junior Tier 1',
    rulesTier2: 'Junior Tier 2',
    rulesDscrBasis: 'Βάση DSCR',
    rulesNoCarryForward: 'Χωρίς μεταφορά',
    splitOffNote: 'Ο διαχωρισμός είναι ΑΠΕΝΕΡΓΟΣ. Όλες οι άλλες σελίδες εμφανίζουν αριθμούς μόνο-ιδιοκτήτη. Ενεργοποιήστε παραπάνω για εφαρμογή του waterfall αμοιβών OpCo.',
    kpiOpcoFee: 'Αμοιβή OpCo — σταθεροποιημένο',
    kpiPropcoEbitda: 'EBITDA PropCo',
    kpiPropcoIRR: 'IRR ιδίων κεφαλαίων PropCo',
    kpiIRRCost: 'Κόστος IRR διαχωρισμού',
    kpiIRRCostSublabelOn: 'Πριν διαχωρισμό:',
    kpiIRRCostSublabelOff: 'Ιδιοκτήτης λαμβάνει 100% GOP',
    kpiLevered: 'Μοχλευμένο, με τερματική αξία',
    kpiToggleOn: 'Ενεργοποίηση διαχωρισμού',
    kpiOfRevenue: 'εσόδων',
    kpiPreSplit: 'έναντι {val} πριν διαχωρισμό',
    compTableTitle: 'Μόνο-ιδιοκτήτης vs. PropCo / OpCo — σταθεροποιημένο 2031',
    compColMetric: 'Δείκτης',
    compColOwner: 'Μόνο-ιδιοκτήτης (πριν)',
    compColPropco: 'PropCo (μετά αμοιβές OpCo)',
    compColDelta: 'Διαφορά',
    compRowRevenue: 'Σύνολο εσόδων (σταθεροποιημένο)',
    compRowEbitda: 'EBITDA',
    compRowEbitdaMargin: 'Περιθώριο EBITDA',
    compRowDSCR: 'DSCR σταθεροποίησης',
    compRowIRR: 'IRR ιδίων κεφαλαίων',
    stabWaterfallTitle: 'Waterfall αμοιβών 2031',
    watRevenue: 'Σύνολο εσόδων',
    watEbitdaPreFee: 'EBITDA (= GOP) πριν αμοιβές OpCo',
    watOpcoEarns: 'OpCo κερδίζει',
    watPropcoRetains: 'PropCo διατηρεί (EBITDA)',
    yearByYearTitle: 'Αμοιβές OpCo ανά έτος',
    colItem: 'Στοιχείο',
    yearRowBase: 'Senior floor',
    yearRowIncentive: 'Junior αμοιβή (κλιμακωτή)',
    yearRowTotal: 'Σύνολο OpCo',
    yearRowEbitdaPre: 'EBITDA πριν αμοιβές',
    yearRowPropcoEbitda: 'EBITDA PropCo',
    chartTitle: 'Σύνθεση αμοιβών OpCo ανά έτος',
    chartBarBase: 'Βασική αμοιβή διαχείρισης',
    chartBarIncentive: 'Αμοιβή κινήτρου',
    tipText: 'Αλλάξτε τη διαδρομή χρηματοδότησης ή σενάριο για να δείτε τον αντίκτυπο. Χρησιμοποιήστε ROIC και DSCR delta στο Dashboard.',
    deferToggleLabel: 'Αναβολή senior αμοιβής 2029',
    deferToggleSub: 'Μηδενισμός του senior ορίου στο 2029 (πρώτο έτος DS) και προσθήκη στο 2030. Επηρεάζει ΛΑΧ, ΔΚΕΧ και LLCR. Μόνο σε προβολή διαχειριστή.',
    rulesDefer2029Carry: '1-year carry: 2029 floor αναβολή flat στο 2030',
    explainerHeading1: 'Πώς λειτουργεί ο διαχωρισμός.',
    explainerBody1: 'Όταν είναι ενεργός, η OpCo κερδίζει εγγυημένο floor (junior έναντι DS — συσσωρεύεται όταν το ταμείο δεν επαρκεί) και κλιμακωτή junior αμοιβή επί του υπολοίπου μετά DS. Η DS είναι αδιαμφισβήτητα ανώτερη όλων των αμοιβών OpCo. DSCR = ebitdaPreOpCo / DS.',
    explainerHeading2: 'Όλοι οι δείκτες αφορούν την PropCo',
    explainerBody2: '— DSCR, NCF, IRR ιδίων κεφαλαίων αντικατοπτρίζουν τις ταμειακές ροές που απομένουν στον ιδιοκτήτη μετά τις αμοιβές OpCo. Το κόστος IRR διαχωρισμού ποσοτικοποιεί πόση απόδοση μεταφέρεται από την PropCo στην OpCo.',
    propcoTitle: 'PropCo (Ελληνική ΑΕ)',
    propcoDesc: 'Κατέχει ακίνητα',
    propcoOwns: 'Ιδιοκτησία:',
    propcoPlots: 'οικόπεδα',
    propcoPlot: 'οικόπεδο',
    propcoCapex: 'CapEx:',
    propcoOwes: 'Οφείλει σε τράπεζα:',
    propcoEquity: 'Ίδια κεφάλαια:',
    propcoReceives: 'Λαμβάνει: NCF · επιχορήγηση · εισφορές κεφαλαίου',
    opcoTitle: 'OpCo / ManCo',
    opcoDesc: 'Villa Lev Group',
    opcoOwns: 'Ιδιοκτησία:',
    opcoOwnsBrand: 'Brand IP + λειτουργική εμπειρία',
    opcoProvides: 'Παρέχει:',
    opcoProvidesMgmt: 'Υπηρεσίες διαχείρισης · brand · εποπτεία',
    opcoReceives: 'Λαμβάνει: 3 κάδους αμοιβών από PropCo',
    investorsTitle: 'Επενδυτές',
    investorsDesc: 'Κάτοχοι cap-table',
    investorsHold: 'Κατέχουν:',
    investorsHoldDesc: 'Μετοχικές αξιώσεις στη PropCo',
    investorsReceive: 'Λαμβάνουν: διανομές ανά 3-επίπεδο waterfall',
    bankTitle: 'Τράπεζα',
    bankDesc: 'Πρωτοβάθμιος εξασφαλισμένος δανειστής',
    bankHolds: 'Κατέχει:',
    bankHoldsDesc: 'Πρωτοβάθμιο χρέος στη PropCo',
    bankReceives: 'Λαμβάνει:',
    bankReceivesDesc: 'Ετήσια εξυπηρέτηση χρέους + υπόλοιπο κεφάλαιο κατά την έξοδο',
    feeColFee: 'Αμοιβή',
    feeColRate: 'Επιτόκιο',
    feeColAmount: 'Ποσό',
    feeColWhen: 'Πότε',
    bucketBuildingTitle: 'Αμοιβή διαχείρισης ανάπτυξης',
    bucketBuildingSub: 'Η OpCo διαχειρίζεται εύρεση χώρου, αδειοδότηση, εποπτεία εργολάβων και παράδοση κατασκευής για λογαριασμό της PropCo · απορροφάται στο CapEx έργου',
    bucketBuildingRate: '€5K/μήνα',
    bucketBuildingWhen: 'Φάση κατασκευής · 2026 → 2028',
    bucketBaseTitle: 'Βασική αμοιβή διαχείρισης',
    bucketBaseSub: 'Brand + λειτουργική διαχείριση συνδυασμένα',
    bucketBaseRate: '5% ακαθάριστων εσόδων',
    bucketBaseWhen: 'Ετήσιο · 2029 → έξοδος',
    bucketIncentiveTitle: 'Αμοιβή κινήτρου',
    bucketIncentiveSub: '10% GOP πάνω από 8% όριο · junior έναντι DS · μέγιστο 50% υπολειπόμενου NCF',
    bucketIncentiveRate: '% GOP πάνω από όριο, ανώτατο 50% υπολειπόμενου',
    bucketIncentiveWhen: 'Ετήσιο · 2029 → έξοδος',
  },
  he: {
    pageTitle: 'פיצול OpCo / PropCo',
    pageSubtitleTemplate: '{scenario} · השוואת מבנה בעלים בלבד לעומת מבנה עם חברת ניהול נפרדת (OpCo).',
    juniorTier1RateLabel: 'שיעור Tier 1 זוטר',
    juniorTier1RateSub: '% מהיתרה לאחר DS עד לסף',
    juniorTier2RateLabel: 'שיעור Tier 2 זוטר',
    juniorTier2RateSub: '% מהיתרה לאחר DS מעל הסף',
    juniorThresholdLabel: 'נקודת מעבר',
    juniorThresholdSub: '€ סף יתרה בין Tier 1 ל-Tier 2',
    seniorFloorLabel: 'רצפה בכירה',
    juniorFeeLabel: 'עמלה זוטרה (מדורגת)',
    chartBarSenior: 'רצפה בכירה',
    chartBarJunior: 'עמלה זוטרה (מדורגת)',
    rulesSummaryTitle: 'כללי עמלות',
    rulesSeniorFloor: 'רצפה בכירה',
    rulesTier1: 'Tier 1 זוטר',
    rulesTier2: 'Tier 2 זוטר',
    rulesDscrBasis: 'בסיס DSCR',
    rulesNoCarryForward: 'ללא גלגול',
    splitOffNote: 'הפיצול כבוי. כל שאר הדפים מציגים מספרי בעלים בלבד. הפעילו למעלה ליישום מפל עמלות OpCo.',
    kpiOpcoFee: 'עמלת OpCo — מיוצב',
    kpiPropcoEbitda: 'EBITDA של PropCo',
    kpiPropcoIRR: 'IRR הון של PropCo',
    kpiIRRCost: 'עלות IRR של פיצול',
    kpiIRRCostSublabelOn: 'לפני פיצול:',
    kpiIRRCostSublabelOff: 'בעלים מקבל 100% GOP',
    kpiLevered: 'ממונף, עם ערך טרמינלי',
    kpiToggleOn: 'הפעל פיצול',
    kpiOfRevenue: 'מהכנסות',
    kpiPreSplit: 'לעומת {val} לפני פיצול',
    compTableTitle: 'בעלים בלבד לעומת PropCo / OpCo — מיוצב 2031',
    compColMetric: 'מדד',
    compColOwner: 'בעלים בלבד (לפני)',
    compColPropco: 'PropCo (אחרי עמלות OpCo)',
    compColDelta: 'הפרש',
    compRowRevenue: 'סה״כ הכנסות (מיוצב)',
    compRowEbitda: 'EBITDA',
    compRowEbitdaMargin: 'מרווח EBITDA',
    compRowDSCR: 'DSCR מיוצב',
    compRowIRR: 'IRR הון',
    stabWaterfallTitle: 'מפל עמלות 2031 מיוצב',
    watRevenue: 'סה״כ הכנסות',
    watEbitdaPreFee: 'EBITDA (= GOP) לפני עמלות OpCo',
    watOpcoEarns: 'OpCo מרוויחה',
    watPropcoRetains: 'PropCo שומרת (EBITDA)',
    yearByYearTitle: 'עמלות OpCo לפי שנה',
    colItem: 'פריט',
    yearRowBase: 'רצפה בכירה',
    yearRowIncentive: 'עמלה זוטרה (מדורגת)',
    yearRowTotal: 'סה״כ OpCo',
    yearRowEbitdaPre: 'EBITDA לפני עמלות',
    yearRowPropcoEbitda: 'EBITDA של PropCo',
    chartTitle: 'הרכב עמלות OpCo לפי שנה',
    chartBarBase: 'דמי ניהול בסיסיים',
    chartBarIncentive: 'עמלת תמריץ',
    tipText: 'טיפ: שנו מסלול מימון או תרחיש לראות השפעה. השתמשו ב-ROIC ו-DSCR delta בלוח המחוונים.',
    deferToggleLabel: 'דחיית עמלת הסיניור לשנת 2029',
    deferToggleSub: 'מאפס את רצפת הסיניור ב-2029 (שנת DS ראשונה) ומוסיף אותה ל-2030. זורם דרך P&L,‏ DSCR ו-LLCR. רק בתצוגת מנהל.',
    rulesDefer2029Carry: 'גלגול שנה אחת: רצפת 2029 נדחית flat ל-2030',
    explainerHeading1: 'כיצד הפיצול עובד.',
    explainerBody1: 'כאשר מופעל, OpCo מרוויחה רצפה מובטחת (זוטרה לשירות חוב — נצברת כשהמזומנים אינם מספיקים) ועמלה זוטרה מדורגת על היתרה לאחר DS. DS בכירה ללא עוררין לכל עמלות OpCo. DSCR = ebitdaPreOpCo / DS.',
    explainerHeading2: 'כל המדדים הם של PropCo',
    explainerBody2: '— DSCR, NCF, IRR הון משקפים את תזרים המזומנים שנותר לבעלים לאחר עמלות OpCo. כרטיס עלות IRR של פיצול מכמת כמה תשואה עוברת מ-PropCo ל-OpCo.',
    propcoTitle: 'PropCo (SPV יוונית)',
    propcoDesc: 'מחזיקה נדל״ן',
    propcoOwns: 'בעלות:',
    propcoPlots: 'מגרשים',
    propcoPlot: 'מגרש',
    propcoCapex: 'CapEx:',
    propcoOwes: 'חייבת לבנק:',
    propcoEquity: 'הון:',
    propcoReceives: 'מקבלת: NCF · מענק (אם מאושר) · השקעות הון',
    opcoTitle: 'OpCo / ManCo',
    opcoDesc: 'Villa Lev Group',
    opcoOwns: 'בעלות:',
    opcoOwnsBrand: 'Brand IP + ידע תפעולי',
    opcoProvides: 'מספקת:',
    opcoProvidesMgmt: 'שירותי ניהול · brand · פיקוח',
    opcoReceives: 'מקבלת: 3 דליי עמלות מ-PropCo',
    investorsTitle: 'משקיעים',
    investorsDesc: 'מחזיקי cap-table',
    investorsHold: 'מחזיקים:',
    investorsHoldDesc: 'תביעות הון ב-PropCo',
    investorsReceive: 'מקבלים: חלוקות לפי מפל 3 שכבות',
    bankTitle: 'בנק',
    bankDesc: 'מלווה בכיר מובטח',
    bankHolds: 'מחזיק:',
    bankHoldsDesc: 'חוב בכיר ב-PropCo',
    bankReceives: 'מקבל:',
    bankReceivesDesc: 'שירות חוב שנתי + יתרת קרן ביציאה',
    feeColFee: 'עמלה',
    feeColRate: 'שיעור',
    feeColAmount: 'סכום',
    feeColWhen: 'מתי',
    bucketBuildingTitle: 'דמי ניהול פיתוח',
    bucketBuildingSub: 'OpCo מנהלת איתור אתר, רישוי, פיקוח על קבלנים ומסירת הבנייה עבור PropCo · נספגת ב-CapEx של הפרויקט',
    bucketBuildingRate: '€5K לחודש',
    bucketBuildingWhen: 'שלב בנייה · 2026 → 2028',
    bucketBaseTitle: 'דמי ניהול בסיסיים',
    bucketBaseSub: 'Brand + ניהול תפעולי משולב',
    bucketBaseRate: '5% הכנסות ברוטו',
    bucketBaseWhen: 'שנתי · 2029 ← יציאה',
    bucketIncentiveTitle: 'עמלת תמריץ',
    bucketIncentiveSub: '10% GOP מעל רף 8% · junior לשירות חוב · מקסימום 50% NCF שיורי',
    bucketIncentiveRate: '% GOP מעל רף, מוגבל ל-50% שיורי',
    bucketIncentiveWhen: 'שנתי · 2029 ← יציאה',
  },
});
// fr falls back to en. Using unknown intermediate because the object
// is only defined for three locales at declaration time.
const T: Record<Locale, Record<string, string>> =
  { ..._T, fr: _T.en } as unknown as Record<Locale, Record<string, string>>;

function StatusChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${
        ok ? "bg-positive/15 text-positive" : "bg-warning/15 text-warning"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-positive" : "bg-warning"}`} />
      {label}
    </span>
  );
}

function KPICard({
  label,
  value,
  sublabel,
  tone,
  accent = false,
  chip,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "positive" | "warning" | "neutral";
  accent?: boolean;
  chip?: { label: string; ok: boolean };
}) {
  const valueColor =
    tone === "positive"
      ? "text-positive"
      : tone === "warning"
        ? "text-warning"
        : "text-text-primary";
  return (
    <div
      className={`relative rounded-xl border p-5 ${
        accent ? "bg-brand-50 border-brand-200" : "bg-white border-surface-tertiary"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
          {label}
        </div>
        {chip && <StatusChip label={chip.label} ok={chip.ok} />}
      </div>
      <div className={`kpi-value ${valueColor}`}>{value}</div>
      {sublabel && <div className="text-xs text-text-tertiary mt-1">{sublabel}</div>}
    </div>
  );
}

function RateInput({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block rounded-xl border border-surface-tertiary bg-white p-4">
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        {label}
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <input
          type="number"
          step="0.5"
          min={0}
          max={100}
          value={Number((value * 100).toFixed(2))}
          onChange={(e) => {
            const pct = parseFloat(e.target.value);
            if (!Number.isFinite(pct)) return;
            onChange(Math.max(0, Math.min(100, pct)) / 100);
          }}
          className="w-24 text-3xl font-display tabular-nums bg-transparent focus:outline-none border-b border-surface-tertiary focus:border-brand-500"
        />
        <span className="text-lg text-text-secondary">%</span>
      </div>
      <div className="text-[11px] text-text-tertiary mt-1">{sub}</div>
    </label>
  );
}

function CurrencyInput({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block rounded-xl border border-surface-tertiary bg-white p-4">
      <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        {label}
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-lg text-text-secondary">€</span>
        <input
          type="number"
          step={1}
          min={0}
          value={Math.round(value / 1000)}
          onChange={(e) => {
            const k = parseFloat(e.target.value);
            if (!Number.isFinite(k)) return;
            onChange(Math.max(0, k) * 1000);
          }}
          className="w-24 text-3xl font-display tabular-nums bg-transparent focus:outline-none border-b border-surface-tertiary focus:border-brand-500"
        />
        <span className="text-lg text-text-secondary">K</span>
      </div>
      <div className="text-[11px] text-text-tertiary mt-1">{sub}</div>
    </label>
  );
}

export default function OpCoSplitPage() {
  const { track } = useTrackFeature();
  useEffect(() => { track("admin-opco-split"); }, [track]);
  const { locale, t } = useTranslation();
  const { model, assumptions, activeScenario, setAssumption, capTable } = useModelStore();
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(OPCO_SPLIT_TOUR.storageKey);

  if (!model) return <PageSkeleton variant="grid" />;

  const opCo = assumptions.opCoFee;
  const opCoOn = !!opCo?.enabled;

  const scenario = model.scenarios[activeScenario];
  const stab = scenario.stabilisedYear;
  const stabRevenue = stab?.totalRevenue ?? 0;
  const stabEbitdaPreFee = stab?.ebitdaPreOpCo ?? 0;
  const stabEbitdaPostFee = stab?.ebitda ?? 0;

  const opCoStabilisedFee = scenario.opCoStabilisedFee;
  const equityIRR = scenario.equityIRR;
  const equityIRRPreOpCo = scenario.equityIRRPreOpCo;
  const irrCost = equityIRRPreOpCo - equityIRR;

  const scenarioLabel =
    activeScenario === 'upside' ? t('scenario.upside') :
    activeScenario === 'downside' ? t('scenario.downside') :
    activeScenario === 'breakeven' ? t('scenario.breakeven') :
    t('scenario.realistic');

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-text-primary border-l-[3px] border-brand-400 pl-3">
            {T[locale].pageTitle}
          </h1>
          <p className="text-sm text-text-secondary mt-1">{t('opco.pageIntro')}</p>
          <p className="text-sm text-text-secondary mt-1">
            {T[locale].pageSubtitleTemplate.replace('{scenario}', scenarioLabel)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TourButton onClick={() => setTourOpen(true)} pulsing={!!neverSeen} />
          <button
            type="button"
            onClick={() => setAssumption("opCoFee.enabled", !opCoOn, "OpCo split")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              opCoOn
                ? "bg-positive/15 text-positive border-positive/30"
                : "bg-surface-secondary text-text-secondary border-surface-tertiary hover:bg-surface-tertiary"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${opCoOn ? "bg-positive" : "bg-text-tertiary"}`} />
            {opCoOn ? t('opco.splitOn') : t('opco.splitOff')}
          </button>
        </div>
      </div>

      {/* Explainer */}
      <div className="rounded-xl border border-surface-tertiary bg-surface-secondary/40 p-4 mb-6 text-sm text-text-secondary leading-relaxed">
        <p className="mb-2">
          <strong className="text-text-primary">{T[locale].explainerHeading1}</strong>{" "}
          {T[locale].explainerBody1}
        </p>
        <p className="mb-0">
          <strong className="text-text-primary">{T[locale].explainerHeading2}</strong>
          {T[locale].explainerBody2}
        </p>
      </div>

      {/* Entity diagram */}
      <SectionHeader title={t('opco.entityStructure')} />
      <EntityDiagram
        propCoLoan={model.keyMetrics.loanAmount}
        propCoEquity={model.keyMetrics.equityRequired}
        propCoCapex={model.keyMetrics.totalCapex}
        totalPlots={assumptions.portfolio.reduce((s, p) => s + p.count, 0)}
        locale={locale}
      />

      {/* Expanded fee streams */}
      <SectionHeader title={t('opco.feeStreams')} />
      <FeeStreamsTable
        stab={stab}
        buildingPhaseFee={assumptions.developerConstructionFeePerYear ?? 0}
        opCoFloor={assumptions.opCoFloor ?? assumptions.opCoSeniorFloor ?? 0}
        totalPlots={assumptions.portfolio.reduce((s, p) => s + p.count, 0)}
        locale={locale}
      />

      {/* Fee rates */}
      <SectionHeader title={t('opco.feeStructure')} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <RateInput
          label={T[locale].juniorTier1RateLabel}
          sub={T[locale].juniorTier1RateSub}
          value={opCo.juniorTier1Rate ?? 0.10}
          onChange={(v) => setAssumption('opCoFee.juniorTier1Rate', v)}
        />
        <RateInput
          label={T[locale].juniorTier2RateLabel}
          sub={T[locale].juniorTier2RateSub}
          value={opCo.juniorTier2Rate ?? 0.15}
          onChange={(v) => setAssumption('opCoFee.juniorTier2Rate', v)}
        />
        <CurrencyInput
          label={T[locale].juniorThresholdLabel}
          sub={T[locale].juniorThresholdSub}
          value={opCo.juniorResidualThreshold ?? 500_000}
          onChange={(v) => setAssumption('opCoFee.juniorResidualThreshold', v)}
        />
      </div>

      {/* Defer 2029 opening-year floor toggle — admin only */}
      {opCoOn && (
        <div className="rounded-xl border border-surface-tertiary bg-white p-4 mb-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 rounded border-surface-tertiary accent-brand-600 cursor-pointer"
              checked={assumptions.opCoSeniorDefer2029 ?? false}
              onChange={() =>
                setAssumption(
                  'opCoSeniorDefer2029',
                  !(assumptions.opCoSeniorDefer2029 ?? false),
                  'OpCo defer 2029'
                )
              }
            />
            <div>
              <div className="text-sm font-medium text-text-primary">
                {T[locale].deferToggleLabel}
              </div>
              <div className="text-xs text-text-tertiary mt-0.5">
                {T[locale].deferToggleSub}
              </div>
            </div>
          </label>
        </div>
      )}

      {/* Rules summary */}
      <RulesSummaryBox assumptions={assumptions} locale={locale} />

      {!opCoOn && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 mb-6 text-sm text-text-secondary">
          {T[locale].splitOffNote}
        </div>
      )}

      {/* PropCo headline KPIs (always shown — when OFF, PropCo == full owner) */}
      <SectionHeader title={t('opco.stabilisedOutcome')} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPICard
          label={T[locale].kpiOpcoFee}
          value={opCoOn ? formatCurrency(opCoStabilisedFee, true, locale) : "—"}
          sublabel={
            opCoOn
              ? `${formatPercent(opCoStabilisedFee / (stabRevenue || 1))} ${T[locale].kpiOfRevenue}`
              : T[locale].kpiToggleOn
          }
          tone={opCoOn ? "warning" : undefined}
        />
        <KPICard
          label={T[locale].kpiPropcoEbitda}
          value={formatCurrency(stabEbitdaPostFee, true, locale)}
          sublabel={
            opCoOn
              ? T[locale].kpiPreSplit.replace('{val}', formatCurrency(stabEbitdaPreFee, true, locale))
              : `${formatPercent(stab?.ebitdaMargin ?? 0)} margin`
          }
          accent={opCoOn}
        />
        <KPICard
          label={T[locale].kpiPropcoIRR}
          value={equityIRR > 0 ? formatPercent(equityIRR) : "—"}
          sublabel={T[locale].kpiLevered}
          tone={
            equityIRR >= 0.15 ? "positive" : equityIRR > 0 ? undefined : "warning"
          }
        />
        <KPICard
          label={T[locale].kpiIRRCost}
          value={
            !opCoOn
              ? "—"
              : irrCost > 0.0005
                ? `−${formatPercent(irrCost)}`
                : irrCost < -0.0005
                  ? `+${formatPercent(-irrCost)}`
                  : "0%"
          }
          sublabel={
            opCoOn
              ? `${T[locale].kpiIRRCostSublabelOn} ${formatPercent(equityIRRPreOpCo)}`
              : T[locale].kpiIRRCostSublabelOff
          }
          tone={
            !opCoOn
              ? undefined
              : irrCost <= 0.03
                ? "positive"
                : irrCost <= 0.06
                  ? undefined
                  : "warning"
          }
        />
      </div>

      {/* Side-by-side comparison */}
      <SectionHeader title={T[locale].compTableTitle} />
      <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-secondary/40">
              <th className="text-left py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                {T[locale].compColMetric}
              </th>
              <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                {T[locale].compColOwner}
              </th>
              <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                {T[locale].compColPropco}
              </th>
              <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                {T[locale].compColDelta}
              </th>
            </tr>
          </thead>
          <tbody className="font-mono">
            <ComparisonRow
              label={T[locale].compRowRevenue}
              left={stabRevenue}
              right={stabRevenue}
              format="currency"
              locale={locale}
            />
            <ComparisonRow
              label={T[locale].compRowEbitda}
              left={stabEbitdaPreFee}
              right={stabEbitdaPostFee}
              format="currency"
              locale={locale}
            />
            <ComparisonRow
              label={T[locale].compRowEbitdaMargin}
              left={stabRevenue > 0 ? stabEbitdaPreFee / stabRevenue : 0}
              right={stabRevenue > 0 ? stabEbitdaPostFee / stabRevenue : 0}
              format="percent"
              locale={locale}
            />
            <ComparisonRow
              label={T[locale].compRowDSCR}
              left={
                stabRevenue > 0 && model.keyMetrics.annualDS > 0
                  ? stabEbitdaPreFee / model.keyMetrics.annualDS
                  : 0
              }
              right={stab?.dscr ?? 0}
              format="multiple"
              locale={locale}
              good="higher"
              threshold={1.25}
            />
            <ComparisonRow
              label={T[locale].compRowIRR}
              left={equityIRRPreOpCo}
              right={equityIRR}
              format="percent"
              locale={locale}
              good="higher"
              threshold={0.15}
            />
          </tbody>
        </table>
      </div>

      {/* Fee waterfall — stabilised year */}
      {opCoOn && stab && (
        <>
          <SectionHeader title={T[locale].stabWaterfallTitle} />
          <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden mb-6">
            <table className="w-full text-sm font-mono">
              <tbody>
                <WaterfallRow
                  label={T[locale].watRevenue}
                  value={stabRevenue}
                  locale={locale}
                />
                <WaterfallRow
                  label={T[locale].watEbitdaPreFee}
                  value={stabEbitdaPreFee}
                  locale={locale}
                  bold
                />
                <WaterfallRow
                  label={`Debt service`}
                  value={-(stab.debtService ?? 0)}
                  locale={locale}
                  tone="negative"
                />
                <WaterfallRow
                  label={`Residual after DS`}
                  value={Math.max(0, stabEbitdaPreFee - (stab.debtService ?? 0))}
                  locale={locale}
                />
                <WaterfallRow
                  label={`Junior fee (tiered)`}
                  value={-(stab.opCoJuniorPaid ?? 0)}
                  locale={locale}
                  tone="negative"
                />
                <WaterfallRow
                  label={T[locale].watOpcoEarns}
                  value={stab.opCoTotalFee}
                  locale={locale}
                  bold
                  tone="warning"
                />
                <WaterfallRow
                  label={T[locale].watPropcoRetains}
                  value={stabEbitdaPostFee}
                  locale={locale}
                  bold
                  tone="positive"
                />
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Year-by-year fee table */}
      {opCoOn && (
        <>
          <SectionHeader title={`${T[locale].yearByYearTitle} (${scenarioLabel})`} />
          <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="bg-surface-secondary/40">
                    <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium sticky left-0 bg-surface-secondary/40">
                      {T[locale].colItem}
                    </th>
                    {scenario.pnl.map((p) => (
                      <th
                        key={p.year}
                        className="text-right py-2.5 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium min-w-[80px]"
                      >
                        {p.year}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <YearRow
                    label={T[locale].seniorFloorLabel}
                    pnl={scenario.pnl}
                    pick={(p) => p.opCoBaseFee}
                    locale={locale}
                  />
                  <YearRow
                    label={T[locale].juniorFeeLabel}
                    pnl={scenario.pnl}
                    pick={(p) => p.opCoIncentiveFee}
                    locale={locale}
                  />
                  <YearRow
                    label={T[locale].yearRowTotal}
                    pnl={scenario.pnl}
                    pick={(p) => p.opCoTotalFee}
                    locale={locale}
                    bold
                  />
                  <YearRow
                    label={T[locale].yearRowEbitdaPre}
                    pnl={scenario.pnl}
                    pick={(p) => p.ebitdaPreOpCo}
                    locale={locale}
                  />
                  <YearRow
                    label={T[locale].yearRowPropcoEbitda}
                    pnl={scenario.pnl}
                    pick={(p) => p.ebitda}
                    locale={locale}
                    bold
                  />
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-surface-tertiary p-5 mb-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-4">
              {T[locale].chartTitle} ({scenarioLabel})
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={scenario.pnl.map((p) => ({
                  year: p.year,
                  Senior: p.opCoBaseFee,
                  Junior: p.opCoIncentiveFee,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), false, locale)}
                  contentStyle={{ borderRadius: 8, border: "1px solid #EDE6D5", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Senior" stackId="opco" name={T[locale].chartBarSenior} fill="#C4A55E" />
                <Bar dataKey="Junior" stackId="opco" name={T[locale].chartBarJunior} fill="#6B7A3D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-xs text-text-tertiary">
            {T[locale].tipText}
          </div>
        </>
      )}

      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={OPCO_SPLIT_TOUR} />
    </div>
  );
}

function ComparisonRow({
  label,
  left,
  right,
  format,
  locale,
  good,
  threshold,
}: {
  label: string;
  left: number;
  right: number;
  format: "currency" | "percent" | "multiple";
  locale: Locale;
  good?: "higher" | "lower";
  threshold?: number;
}) {
  const fmt = (v: number) =>
    format === "currency"
      ? formatCurrency(v, true, locale)
      : format === "percent"
        ? formatPercent(v)
        : formatMultiple(v);

  const delta = right - left;
  const deltaSign = delta > 0 ? "+" : "";
  const deltaDisplay =
    Math.abs(delta) < 1e-6
      ? "—"
      : format === "currency"
        ? `${deltaSign}${formatCurrency(delta, true, locale)}`
        : format === "percent"
          ? `${deltaSign}${formatPercent(delta)}`
          : `${deltaSign}${formatMultiple(delta)}`;

  const deltaIsBad =
    good && Math.abs(delta) > 1e-6
      ? (good === "higher" && delta < 0) || (good === "lower" && delta > 0)
      : false;
  const deltaColor =
    Math.abs(delta) < 1e-6
      ? "text-text-tertiary"
      : deltaIsBad
        ? "text-warning"
        : "text-positive";

  const rightTone =
    threshold !== undefined && format === "multiple"
      ? right >= threshold
        ? "text-positive"
        : "text-warning"
      : "";

  return (
    <tr className="border-t border-surface-secondary/40">
      <td className="py-2.5 px-5 text-text-secondary font-sans">{label}</td>
      <td className="text-right py-2.5 px-5">{fmt(left)}</td>
      <td className={`text-right py-2.5 px-5 ${rightTone}`}>{fmt(right)}</td>
      <td className={`text-right py-2.5 px-5 ${deltaColor}`}>{deltaDisplay}</td>
    </tr>
  );
}

function WaterfallRow({
  label,
  value,
  locale,
  bold,
  indent,
  tone,
  ghost,
}: {
  label: React.ReactNode;
  value: number;
  locale: Locale;
  bold?: boolean;
  indent?: boolean;
  tone?: "negative" | "positive" | "warning";
  ghost?: boolean;
}) {
  const valueColor =
    tone === "negative"
      ? "text-negative"
      : tone === "positive"
        ? "text-positive"
        : tone === "warning"
          ? "text-warning"
          : "text-text-primary";
  return (
    <tr
      className={`border-t border-surface-secondary/40 ${bold ? "bg-surface-secondary/30 font-semibold" : ""} ${ghost ? "opacity-60" : ""}`}
    >
      <td
        className={`py-2.5 px-5 ${indent ? "pl-10" : ""} ${bold ? "text-text-primary" : "text-text-secondary"} font-sans`}
      >
        {label}
      </td>
      <td className={`text-right py-2.5 px-5 ${valueColor}`}>
        {value === 0 ? "—" : formatCurrency(value, true, locale)}
      </td>
    </tr>
  );
}

interface AnnualPnLForRow {
  year: number;
  opCoBaseFee: number;
  opCoBrandFee: number;
  opCoIncentiveFee: number;
  opCoTotalFee: number;
  opCoJuniorPaid: number;
  opCoSeniorPaid: number;
  debtService: number;
  ebitdaPreOpCo: number;
  ebitda: number;
}

function YearRow({
  label,
  pnl,
  pick,
  locale,
  bold,
}: {
  label: string;
  pnl: AnnualPnLForRow[];
  pick: (p: AnnualPnLForRow) => number;
  locale: Locale;
  bold?: boolean;
}) {
  return (
    <tr
      className={`border-t border-surface-secondary/40 ${bold ? "bg-surface-secondary/30 font-semibold" : ""}`}
    >
      <td
        className={`py-2 px-4 sticky left-0 ${bold ? "bg-surface-secondary/30 text-text-primary" : "bg-white text-text-secondary"} font-sans`}
      >
        {label}
      </td>
      {pnl.map((p) => {
        const v = pick(p);
        return (
          <td key={p.year} className="text-right py-2 px-3">
            {v === 0 ? "—" : formatCurrency(v, true, locale)}
          </td>
        );
      })}
    </tr>
  );
}

// ── New visualization components (Feature 2 refresh) ──────────────────

function EntityDiagram({
  propCoLoan,
  propCoEquity,
  propCoCapex,
  totalPlots,
  locale,
}: {
  propCoLoan: number;
  propCoEquity: number;
  propCoCapex: number;
  totalPlots: number;
  locale: Locale;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="rounded-xl border-2 border-brand-200 bg-brand-50 p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-brand-700 mb-1">{T[locale].propcoTitle}</div>
        <div className="font-display text-base mb-2">{T[locale].propcoDesc}</div>
        <div className="text-xs space-y-1">
          <div><span className="text-text-tertiary">{T[locale].propcoOwns}</span> {totalPlots} {totalPlots === 1 ? T[locale].propcoPlot : T[locale].propcoPlots} + buildings + FF&amp;E</div>
          <div><span className="text-text-tertiary">{T[locale].propcoCapex}</span> {formatCurrency(propCoCapex, true, locale)}</div>
          <div><span className="text-text-tertiary">{T[locale].propcoOwes}</span> {formatCurrency(propCoLoan, true, locale)}</div>
          <div><span className="text-text-tertiary">{T[locale].propcoEquity}</span> {formatCurrency(propCoEquity, true, locale)}</div>
          <div className="text-text-tertiary pt-1 border-t border-brand-200/60">
            {T[locale].propcoReceives}
          </div>
        </div>
      </div>
      <div className="rounded-xl border-2 border-positive/30 bg-positive/5 p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-positive mb-1">{T[locale].opcoTitle}</div>
        <div className="font-display text-base mb-2">{T[locale].opcoDesc}</div>
        <div className="text-xs space-y-1">
          <div><span className="text-text-tertiary">{T[locale].opcoOwns}</span> {T[locale].opcoOwnsBrand}</div>
          <div><span className="text-text-tertiary">{T[locale].opcoProvides}</span> {T[locale].opcoProvidesMgmt}</div>
          <div className="text-text-tertiary pt-1 border-t border-positive/20">
            {T[locale].opcoReceives}
          </div>
        </div>
      </div>
      <div className="rounded-xl border-2 border-surface-tertiary bg-white p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-1">{T[locale].investorsTitle}</div>
        <div className="font-display text-base mb-2">{T[locale].investorsDesc}</div>
        <div className="text-xs space-y-1">
          <div><span className="text-text-tertiary">{T[locale].investorsHold}</span> {T[locale].investorsHoldDesc}</div>
          <div className="text-text-tertiary pt-1 border-t border-surface-tertiary">
            {T[locale].investorsReceive}
          </div>
        </div>
      </div>
      <div className="rounded-xl border-2 border-warning/30 bg-warning/5 p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-warning mb-1">{T[locale].bankTitle}</div>
        <div className="font-display text-base mb-2">{T[locale].bankDesc}</div>
        <div className="text-xs space-y-1">
          <div><span className="text-text-tertiary">{T[locale].bankHolds}</span> {T[locale].bankHoldsDesc}</div>
          <div><span className="text-text-tertiary">{T[locale].bankReceives}</span> {T[locale].bankReceivesDesc}</div>
        </div>
      </div>
    </div>
  );
}

function FeeStreamsTable({
  stab,
  buildingPhaseFee,
  opCoFloor,
  totalPlots,
  locale,
}: {
  stab: ScenarioOutput["stabilisedYear"];
  buildingPhaseFee: number;
  opCoFloor: number;
  totalPlots: number;
  locale: Locale;
}) {
  const baseMgmtFee = stab?.opCoBaseFee ?? 0;
  const incentiveFee = stab?.opCoIncentiveFee ?? 0;

  return (
    <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-secondary/40">
            <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{T[locale].feeColFee}</th>
            <th className="text-right py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{T[locale].feeColAmount}</th>
            <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{T[locale].feeColRate}</th>
            <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{T[locale].feeColWhen}</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {/* Building phase — development management fee */}
          <tr className="border-t border-surface-secondary/40">
            <td className="py-3 px-4 font-medium">
              {T[locale].bucketBuildingTitle}
              <div className="text-[11px] text-text-tertiary font-normal mt-0.5">{T[locale].bucketBuildingSub}</div>
            </td>
            <td className="py-3 px-4 text-right">
              <span className="font-mono font-semibold text-base text-text-primary">
                {buildingPhaseFee > 0 ? <>{formatCurrency(buildingPhaseFee, true, locale)}/yr</> : "—"}
              </span>
            </td>
            <td className="py-3 px-4 text-xs text-text-tertiary">
              {buildingPhaseFee > 0 ? `€${Number((buildingPhaseFee / 12 / 1000).toFixed(1))}K/month` : "—"}
            </td>
            <td className="py-3 px-4 text-xs text-text-tertiary">{T[locale].bucketBuildingWhen}</td>
          </tr>
          {/* Base management fee */}
          <tr className="border-t border-surface-secondary/40">
            <td className="py-3 px-4 font-medium">
              {T[locale].bucketBaseTitle}
              <div className="text-[11px] text-text-tertiary font-normal mt-0.5">{T[locale].bucketBaseSub}</div>
            </td>
            <td className="py-3 px-4 text-right">
              <span className="font-mono font-semibold text-base text-text-primary">
                {baseMgmtFee > 0 ? <>{formatCurrency(baseMgmtFee, true, locale)}/yr</> : "—"}
              </span>
            </td>
            <td className="py-3 px-4 text-xs text-text-tertiary">
              {totalPlots > 0 ? `€${Math.round(opCoFloor / 1000)}K/plot × ${totalPlots} plots` : "—"}
            </td>
            <td className="py-3 px-4 text-xs text-text-tertiary">{T[locale].bucketBaseWhen}</td>
          </tr>
          {/* Incentive fee */}
          <tr className="border-t border-surface-secondary/40">
            <td className="py-3 px-4 font-medium">
              {T[locale].bucketIncentiveTitle}
              <div className="text-[11px] text-text-tertiary font-normal mt-0.5">{T[locale].bucketIncentiveSub}</div>
            </td>
            <td className="py-3 px-4 text-right">
              <span className="font-mono font-semibold text-base text-text-primary">
                {incentiveFee > 0 ? <>{formatCurrency(incentiveFee, true, locale)}/yr</> : "—"}
              </span>
            </td>
            <td className="py-3 px-4 text-xs text-text-tertiary">{T[locale].bucketIncentiveRate}</td>
            <td className="py-3 px-4 text-xs text-text-tertiary">{T[locale].bucketIncentiveWhen}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function RulesSummaryBox({
  assumptions,
  locale,
}: {
  assumptions: ModelAssumptions;
  locale: Locale;
}) {
  const opCo = assumptions.opCoFee;
  const floor = assumptions.opCoFloor ?? assumptions.opCoSeniorFloor ?? 0;
  const villaCount = assumptions.portfolio.reduce((s, p) => s + p.count, 0);
  const tier1Rate = opCo.juniorTier1Rate ?? 0.10;
  const tier2Rate = opCo.juniorTier2Rate ?? 0.15;
  const threshold = opCo.juniorResidualThreshold ?? 500_000;
  const deferOn = assumptions.opCoSeniorDefer2029 ?? false;

  const rules = [
    {
      label: T[locale].rulesSeniorFloor,
      detail: (
        <>
          {`€${floor.toLocaleString()}/plot × ${villaCount} plots = €${((floor * villaCount) / 1000).toFixed(0)}K/yr`}
          {' — paid junior to debt service (after DS, accrues when cash insufficient).'}
        </>
      ),
    },
    {
      label: T[locale].rulesTier1,
      detail: `${(tier1Rate * 100).toFixed(0)}% of post-DS residual up to €${(threshold / 1000).toFixed(0)}K`,
    },
    {
      label: T[locale].rulesTier2,
      detail: `${(tier2Rate * 100).toFixed(0)}% of post-DS residual above €${(threshold / 1000).toFixed(0)}K`,
    },
    {
      label: T[locale].rulesDscrBasis,
      detail: 'ebitdaPreOpCo ÷ DS — DS is senior to all OpCo fees; floor and junior never in DSCR numerator',
    },
    {
      label: deferOn ? T[locale].rulesDefer2029Carry : T[locale].rulesNoCarryForward,
      detail: deferOn
        ? 'Opening-year (2029) floor = €0; amount carries flat (no interest) into 2030. Junior shortfall is forfeit — no rollover.'
        : 'Floor shortfall accrues to next year. Junior shortfall is forfeit — no rollover.',
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-surface-secondary/40">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
          {T[locale].rulesSummaryTitle}
        </h3>
      </div>
      <ol className="divide-y divide-surface-secondary/40">
        {rules.map((rule, i) => (
          <li key={i} className="px-4 py-3 flex items-start gap-3">
            <span className="font-display text-lg text-brand-700 w-6 text-center flex-shrink-0">{i + 1}</span>
            <div>
              <div className="font-medium text-sm">{rule.label}</div>
              <div className="text-xs text-text-tertiary mt-0.5">{rule.detail}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

