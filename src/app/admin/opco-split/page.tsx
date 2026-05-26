"use client";

import React from "react";
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
import type { ModelAssumptions, ModelOutput, ScenarioOutput } from "@/lib/engine/types";
import {
  DEFAULT_GRANT_AMOUNT,
  DEFAULT_GRANT_PROCUREMENT_FEE_PCT,
} from "@/lib/engine/founderWaterfall";
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

// ── Inline translation object ─────────────────────────────────────────
// Used by subcomponents that don't have access to the useTranslation hook.
const T: Record<Locale, Record<string, string>> = {
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
    chartBarBase: 'Base management fee (Bucket 2A)',
    chartBarIncentive: 'Incentive fee (Bucket 2B)',
    tipText: 'Tip: change the financing path or scenario from the top bar to see how the same fee schedule plays out under different revenue assumptions. Use ROIC and DSCR delta on the Dashboard to judge whether bank covenants still pass after the split.',
    explainerHeading1: 'How the split works.',
    explainerBody1: 'When enabled, OpCo earns a guaranteed senior floor (in OpEx, senior to debt service) plus a tiered junior fee on the post-DS residual: Tier 1 rate up to the breakpoint, Tier 2 rate above it. DSCR is computed on ebitdaPreOpCo / DS in all views — junior is never in the numerator.',
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
    opcoReceives: 'Receives: 4 fee buckets from PropCo (see below)',
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
    bucket1ATitle: 'Bucket 1A — Developer equity',
    bucket1ASub: 'Sourcing · construction mgmt · €1M bank collateral',
    bucket1ARate: '25% promote (equity)',
    bucket1AAmount: '— (equity only)',
    bucket1AWhen: 'Inception · no PropCo cash outflow',
    bucket1BTitle: 'Bucket 1B — Grant advisory fee',
    bucket1BRateNote: '10% of grant · 50% cash / 50% equity',
    bucket1BWhen: 'At grant approval · cash spread over 3 yr',
    bucket1BGrantOnly: 'Active on Grant path only',
    bucket2ATitle: 'Bucket 2A — Base management fee',
    bucket2ASub: 'Brand + operational management combined',
    bucket2ARate: '5% of gross revenue',
    bucket2AWhen: 'Annual · 2028 → exit',
    bucket2BTitle: 'Bucket 2B — Incentive fee',
    bucket2BSub: '10% of GOP above 8% hurdle · junior to DS · max 50% of residual NCF',
    bucket2BRate: '% of GOP above hurdle, capped at 50% residual',
    bucket2BWhen: 'Annual · 2028 → exit',
    // WaterfallMechanicsBox
    wStep1Label: 'Bank gets paid',
    wStep1Detail: 'Annual debt service — interest + amortisation — senior and first',
    wStep2Label: 'OpCo fees deducted (Buckets 2A + 2B)',
    wStep2Detail: 'Base management fee + incentive fee subtracted from NCF before splitting',
    wStep3Label: 'Bucket 1B advisory fee (Grant path only)',
    wStep3Detail: 'Deferred cash advisory fee spread over 3 years post-disbursement',
    wStep4Label: 'Tax paid',
    wStep4Detail: 'Corporate income tax on taxable income',
    wStep5Label: 'Distributable pool split pari-passu (investors + founder together)',
    wStep5Detail: 'All equity holders — investors and Eytan\'s co-invest — receive their pro-rata cash share simultaneously from the same pool. No party is paid first.',
    wStep6Label: 'Developer promote (Bucket 1A) and ratchet sit on top — not in front',
    wStep6Detail: 'Eytan holds a 25% promote (free carry, granted at inception) and a performance ratchet. These increase his overall slice of the same pool but do not create a priority over investors. The ratchet only vests once investors have achieved an 8% IRR.',
    wStep7Label: 'At exit — ratchet excluded from sale proceeds',
    wStep7Detail: 'Exit proceeds are split pari-passu + developer equity + grant bonus. The performance ratchet (Layer C) does not apply to the terminal sale — only to annual operating distributions.',
    // CapStructureSummary
    csFounderEquity: 'Founder promoter equity',
    csFounderEquitySub: "Eytan's free carry — no cash required",
    csCoinvest: 'Co-invest (pari-passu)',
    csCoinvestSub: "Eytan's cash — pari-passu with investors until exit",
    csOtherInvestors: 'Other investors (pari-passu)',
    csOtherInvestorsSub: '8% pref · 70/30 above',
    csBankLoan: 'Bank loan',
    csGrant: 'Grant',
    csGrantInactive: 'Not in current path',
    csTotalCapex: 'Total CapEx',
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
    chartBarBase: 'Βασική αμοιβή διαχείρισης (Κάδος 2Α)',
    chartBarIncentive: 'Αμοιβή κινήτρου (Κάδος 2Β)',
    tipText: 'Αλλάξτε τη διαδρομή χρηματοδότησης ή σενάριο για να δείτε τον αντίκτυπο. Χρησιμοποιήστε ROIC και DSCR delta στο Dashboard.',
    deferToggleLabel: 'Αναβολή senior αμοιβής 2029',
    deferToggleSub: 'Μηδενισμός του senior ορίου στο 2029 (πρώτο έτος DS) και προσθήκη στο 2030. Επηρεάζει ΛΑΧ, ΔΚΕΧ και LLCR. Μόνο σε προβολή διαχειριστή.',
    explainerHeading1: 'Πώς λειτουργεί ο διαχωρισμός.',
    explainerBody1: 'Όταν είναι ενεργός, η OpCo κερδίζει εγγυημένο senior floor (στα OpEx, ανώτερο της εξυπηρέτησης χρέους) και κλιμακωτή junior αμοιβή επί του υπολοίπου μετά DS. DSCR υπολογίζεται ως ebitdaPreOpCo / DS και στις δύο προβολές.',
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
    opcoReceives: 'Λαμβάνει: 4 κάδους αμοιβών από PropCo',
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
    bucket1ATitle: 'Κάδος 1Α — Μετοχές προγραμματιστή',
    bucket1ASub: 'Απόκτηση · διαχείριση κατασκευής · €1Μ εγγύηση τράπεζας',
    bucket1ARate: '25% promote (μετοχές)',
    bucket1AAmount: '— (μόνο μετοχές)',
    bucket1AWhen: 'Έναρξη · χωρίς εκροή μετρητών PropCo',
    bucket1BTitle: 'Κάδος 1Β — Αμοιβή συμβουλευτικής επιχορήγησης',
    bucket1BRateNote: '10% επιχορήγησης · 50% μετρητά / 50% μετοχές',
    bucket1BWhen: 'Κατά έγκριση · μετρητά σε 3 έτη',
    bucket1BGrantOnly: 'Ενεργό μόνο στο μονοπάτι επιχορήγησης',
    bucket2ATitle: 'Κάδος 2Α — Βασική αμοιβή διαχείρισης',
    bucket2ASub: 'Brand + λειτουργική διαχείριση συνδυασμένα',
    bucket2ARate: '5% ακαθάριστων εσόδων',
    bucket2AWhen: 'Ετήσιο · 2028 → έξοδος',
    bucket2BTitle: 'Κάδος 2Β — Αμοιβή κινήτρου',
    bucket2BSub: '10% GOP πάνω από 8% όριο · junior έναντι DS · μέγιστο 50% υπολειπόμενου NCF',
    bucket2BRate: '% GOP πάνω από όριο, ανώτατο 50% υπολειπόμενου',
    bucket2BWhen: 'Ετήσιο · 2028 → έξοδος',
    wStep1Label: 'Πληρώνεται η τράπεζα',
    wStep1Detail: 'Ετήσια εξυπηρέτηση χρέους — τόκοι + απόσβεση — πρώτα και πρωτοβάθμια',
    wStep2Label: 'Αφαιρούνται αμοιβές OpCo (Κάδοι 2Α + 2Β)',
    wStep2Detail: 'Βασική αμοιβή + αμοιβή κινήτρου αφαιρούνται από NCF πριν διανομή',
    wStep3Label: 'Αμοιβή συμβουλευτικής Κάδου 1Β (μόνο μονοπάτι επιχορήγησης)',
    wStep3Detail: 'Αναβληθείσα αμοιβή μετρητών σε 3 χρόνια μετά εκταμίευση',
    wStep4Label: 'Πληρώνεται φόρος',
    wStep4Detail: 'Φόρος εισοδήματος νομικών προσώπων επί φορολογητέου εισοδήματος',
    wStep5Label: 'Διανομή ταμείου pari-passu (επενδυτές + ιδρυτής ταυτόχρονα)',
    wStep5Detail: 'Όλοι οι μέτοχοι — επενδυτές και η προσωπική συμμετοχή του Eytan — λαμβάνουν ταυτόχρονα αναλογικά από το ίδιο ταμείο. Κανείς δεν πληρώνεται πρώτος.',
    wStep6Label: 'Promote προγραμματιστή (Κάδος 1Α) και ratchet πάνω — όχι πριν',
    wStep6Detail: 'Ο Eytan κατέχει 25% promote (ελεύθερη συμμετοχή) και ratchet απόδοσης. Αυτά αυξάνουν το μερίδιό του από το κοινό ταμείο, χωρίς να δίνουν προτεραιότητα έναντι των επενδυτών. Το ratchet αποκτάται μόνο μετά την επίτευξη 8% IRR από τους επενδυτές.',
    wStep7Label: 'Κατά την έξοδο — ratchet εξαιρείται από τα έσοδα πώλησης',
    wStep7Detail: 'Έσοδα εξόδου κατανέμονται βάσει pari-passu + developer equity + grant bonus μόνο. Το ratchet (Στρώμα Γ) δεν εφαρμόζεται στην τερματική πώληση.',
    csFounderEquity: 'Μετοχές promote ιδρυτή',
    csFounderEquitySub: 'Ελεύθερη συμμετοχή Eytan — δεν απαιτείται μετρητά',
    csCoinvest: 'Συν-επένδυση (pari-passu)',
    csCoinvestSub: 'Μετρητά Eytan — pari-passu με επενδυτές',
    csOtherInvestors: 'Άλλοι επενδυτές (pari-passu)',
    csOtherInvestorsSub: '8% προτεραιότητα · 70/30 πάνω',
    csBankLoan: 'Τραπεζικό δάνειο',
    csGrant: 'Επιχορήγηση',
    csGrantInactive: 'Μη ενεργό στο τρέχον μονοπάτι',
    csTotalCapex: 'Συνολικό CapEx',
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
    chartBarBase: 'דמי ניהול בסיסיים (דלי 2A)',
    chartBarIncentive: 'עמלת תמריץ (דלי 2B)',
    tipText: 'טיפ: שנו מסלול מימון או תרחיש לראות השפעה. השתמשו ב-ROIC ו-DSCR delta בלוח המחוונים.',
    deferToggleLabel: 'דחיית עמלת הסיניור לשנת 2029',
    deferToggleSub: 'מאפס את רצפת הסיניור ב-2029 (שנת DS ראשונה) ומוסיף אותה ל-2030. זורם דרך P&L,‏ DSCR ו-LLCR. רק בתצוגת מנהל.',
    explainerHeading1: 'כיצד הפיצול עובד.',
    explainerBody1: 'כאשר מופעל, OpCo מרוויחה רצפה בכירה מובטחת (ב-OpEx, בכירה לשירות חוב) ועמלה זוטרה מדורגת על היתרה לאחר DS. DSCR מחושב כ-ebitdaPreOpCo / DS בשתי הצפיות.',
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
    opcoReceives: 'מקבלת: 4 דליי עמלות מ-PropCo',
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
    bucket1ATitle: 'דלי 1A — הון מפתח',
    bucket1ASub: 'רכישה · ניהול בנייה · €1M בטוחה לבנק',
    bucket1ARate: '25% promote (הון)',
    bucket1AAmount: '— (הון בלבד)',
    bucket1AWhen: 'הקמה · ללא יציאת מזומן מ-PropCo',
    bucket1BTitle: 'דלי 1B — עמלת ייעוץ מענק',
    bucket1BRateNote: '10% מהמענק · 50% מזומן / 50% הון',
    bucket1BWhen: 'עם אישור מענק · מזומן ב-3 שנים',
    bucket1BGrantOnly: 'פעיל רק במסלול מענק',
    bucket2ATitle: 'דלי 2A — דמי ניהול בסיסיים',
    bucket2ASub: 'Brand + ניהול תפעולי משולב',
    bucket2ARate: '5% הכנסות ברוטו',
    bucket2AWhen: 'שנתי · 2028 ← יציאה',
    bucket2BTitle: 'דלי 2B — עמלת תמריץ',
    bucket2BSub: '10% GOP מעל רף 8% · junior לשירות חוב · מקסימום 50% NCF שיורי',
    bucket2BRate: '% GOP מעל רף, מוגבל ל-50% שיורי',
    bucket2BWhen: 'שנתי · 2028 ← יציאה',
    wStep1Label: 'הבנק מקבל תשלום',
    wStep1Detail: 'שירות חוב שנתי — ריבית + פירעון — בכיר וראשון',
    wStep2Label: 'עמלות OpCo מנוכות (דליים 2A + 2B)',
    wStep2Detail: 'דמי ניהול + עמלת תמריץ מנוכים מ-NCF לפני חלוקה',
    wStep3Label: 'עמלת ייעוץ דלי 1B (מסלול מענק בלבד)',
    wStep3Detail: 'עמלת מזומן נדחית ב-3 שנים לאחר ניצול',
    wStep4Label: 'מס משולם',
    wStep4Detail: 'מס הכנסה חברות על הכנסה חייבת',
    wStep5Label: 'חלוקת הקרן pari-passu (משקיעים + יזם יחד בו זמנית)',
    wStep5Detail: 'כל בעלי ההון — משקיעים ושותפות Eytan — מקבלים את חלקם היחסי מאותה קרן בו זמנית. אף צד אינו מקבל תשלום ראשון.',
    wStep6Label: 'Promote מפתח (דלי 1A) ו-ratchet מעל — לא לפני',
    wStep6Detail: 'Eytan מחזיק 25% promote (carry חינמי שהוענק בתחילה) ו-ratchet ביצועים. אלה מגדילים את חלקו מאותה קרן משותפת, אך אינם יוצרים עדיפות על פני המשקיעים. ה-ratchet מתממש רק לאחר שהמשקיעים הגיעו ל-8% IRR.',
    wStep7Label: 'ביציאה — ratchet מוחרג מתמורת המכירה',
    wStep7Detail: 'תמורת יציאה מחולקת על בסיס pari-passu + developer equity + grant bonus בלבד. ה-ratchet (שכבה C) אינו חל על המכירה הטרמינלית.',
    csFounderEquity: 'הון promote של יזם',
    csFounderEquitySub: 'carry חינמי של Eytan — לא נדרש מזומן',
    csCoinvest: 'השקעה משותפת (pari-passu)',
    csCoinvestSub: 'מזומן Eytan — pari-passu עם משקיעים',
    csOtherInvestors: 'משקיעים אחרים (pari-passu)',
    csOtherInvestorsSub: '8% עדיפות · 70/30 מעל',
    csBankLoan: 'הלוואת בנק',
    csGrant: 'מענק',
    csGrantInactive: 'לא פעיל במסלול הנוכחי',
    csTotalCapex: 'סה״כ CapEx',
  },
};

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
  const { locale, t } = useTranslation();
  const { model, assumptions, activeScenario, setAssumption, capTable } = useModelStore();
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(OPCO_SPLIT_TOUR.storageKey);

  if (!model) return <PageSkeleton variant="grid" />;

  const founderCashInvested = capTable.find((sh) => sh.isPromoter)?.cashIn ?? 0;

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
        assumptions={assumptions}
        stab={stab}
        opCoStabilisedFee={opCoStabilisedFee}
        scenario={scenario}
        locale={locale}
      />

      {/* Waterfall mechanics */}
      <SectionHeader title={t('opco.waterfallMechanics')} />
      <WaterfallMechanicsBox locale={locale} />

      {/* Cap structure block — moved up from previous design */}
      <SectionHeader title={t('opco.capStructure')} />
      <CapStructureSummary
        assumptions={assumptions}
        keyMetrics={model.keyMetrics}
        locale={locale}
        founderCashInvested={founderCashInvested}
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
  assumptions,
  stab,
  opCoStabilisedFee,
  locale,
}: {
  assumptions: ModelAssumptions;
  stab: ScenarioOutput["stabilisedYear"];
  opCoStabilisedFee: number;
  scenario: ScenarioOutput;
  locale: Locale;
}) {
  const isGrant = assumptions.financingPath === "grant";
  // Bucket 1B — Grant advisory fee: 10% of grant (DEFAULT_GRANT_AMOUNT used by engine)
  const grantAmount = isGrant ? DEFAULT_GRANT_AMOUNT : 0;
  const grantAdvisoryGross = grantAmount * DEFAULT_GRANT_PROCUREMENT_FEE_PCT; // 10%
  const grantAdvisoryCash = grantAdvisoryGross * 0.5; // 50% cash deferred to PropCo
  // Bucket 2A — Senior floor at stabilisation (repurposed alias)
  const baseMgmtFee = stab?.opCoBaseFee ?? 0;
  // Bucket 2B — Incentive fee at stabilisation
  const incentiveFee = opCoStabilisedFee;

  return (
    <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-secondary/40">
            <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{T[locale].feeColFee}</th>
            <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{T[locale].feeColRate}</th>
            <th className="text-right py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{T[locale].feeColAmount}</th>
            <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{T[locale].feeColWhen}</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {/* Bucket 1A */}
          <tr className="border-t border-surface-secondary/40">
            <td className="py-2.5 px-4 font-medium">
              {T[locale].bucket1ATitle}
              <div className="text-[11px] text-text-tertiary font-normal mt-0.5">{T[locale].bucket1ASub}</div>
            </td>
            <td className="py-2 px-4 text-xs text-text-tertiary">{T[locale].bucket1ARate}</td>
            <td className="py-2 px-4 text-right font-mono text-text-tertiary">{T[locale].bucket1AAmount}</td>
            <td className="py-2 px-4 text-xs text-text-tertiary">{T[locale].bucket1AWhen}</td>
          </tr>
          {/* Bucket 1B */}
          <tr className={`border-t border-surface-secondary/40 ${isGrant ? "" : "opacity-40"}`}>
            <td className="py-2.5 px-4 font-medium">
              {T[locale].bucket1BTitle}
              <div className="text-[11px] text-text-tertiary font-normal mt-0.5">
                {isGrant
                  ? `50% cash (${formatCurrency(grantAdvisoryCash, true, locale)} deferred 3 yr) + 50% equity → Layer B`
                  : T[locale].bucket1BGrantOnly}
              </div>
            </td>
            <td className="py-2 px-4 text-xs text-text-tertiary">{T[locale].bucket1BRateNote}</td>
            <td className="py-2 px-4 text-right font-mono">
              {isGrant ? formatCurrency(grantAdvisoryCash, true, locale) : "—"}
            </td>
            <td className="py-2 px-4 text-xs text-text-tertiary">{T[locale].bucket1BWhen}</td>
          </tr>
          {/* Bucket 2A */}
          <tr className="border-t border-surface-secondary/40">
            <td className="py-2.5 px-4 font-medium">
              {T[locale].bucket2ATitle}
              <div className="text-[11px] text-text-tertiary font-normal mt-0.5">{T[locale].bucket2ASub}</div>
            </td>
            <td className="py-2 px-4 text-xs text-text-tertiary">{T[locale].bucket2ARate}</td>
            <td className="py-2 px-4 text-right font-mono">
              {baseMgmtFee > 0 ? <>{formatCurrency(baseMgmtFee, true, locale)}/yr</> : "—"}
            </td>
            <td className="py-2 px-4 text-xs text-text-tertiary">{T[locale].bucket2AWhen}</td>
          </tr>
          {/* Bucket 2B */}
          <tr className="border-t border-surface-secondary/40">
            <td className="py-2.5 px-4 font-medium">
              {T[locale].bucket2BTitle}
              <div className="text-[11px] text-text-tertiary font-normal mt-0.5">{T[locale].bucket2BSub}</div>
            </td>
            <td className="py-2 px-4 text-xs text-text-tertiary">{T[locale].bucket2BRate}</td>
            <td className="py-2 px-4 text-right font-mono">
              {incentiveFee > 0 ? <>{formatCurrency(incentiveFee, true, locale)}/yr</> : "—"}
            </td>
            <td className="py-2 px-4 text-xs text-text-tertiary">{T[locale].bucket2BWhen}</td>
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
  const floor = assumptions.opCoSeniorFloor ?? 0;
  const villaCount = assumptions.portfolio.reduce((s, p) => s + p.count, 0);
  const tier1Rate = opCo.juniorTier1Rate ?? 0.10;
  const tier2Rate = opCo.juniorTier2Rate ?? 0.15;
  const threshold = opCo.juniorResidualThreshold ?? 500_000;

  const rules = [
    {
      label: T[locale].rulesSeniorFloor,
      detail: (
        <>
          {`€${floor.toLocaleString()}/plot × ${villaCount} plots = €${((floor * villaCount) / 1000).toFixed(0)}K/yr`}
          {' — paid SENIOR to debt service. Guaranteed regardless of performance.'}
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
      detail: 'ebitdaPreOpCo ÷ DS — OpCo junior is subordinated to debt service in both views',
    },
    {
      label: T[locale].rulesNoCarryForward,
      detail: 'Junior shortfall is forfeit for the year — no accrual or rollover',
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

function WaterfallMechanicsBox({ locale }: { locale: Locale }) {
  const steps = [
    { i: 1, label: T[locale].wStep1Label, detail: T[locale].wStep1Detail },
    { i: 2, label: T[locale].wStep2Label, detail: T[locale].wStep2Detail },
    { i: 3, label: T[locale].wStep3Label, detail: T[locale].wStep3Detail },
    { i: 4, label: T[locale].wStep4Label, detail: T[locale].wStep4Detail },
    { i: 5, label: T[locale].wStep5Label, detail: T[locale].wStep5Detail },
    { i: 6, label: T[locale].wStep6Label, detail: T[locale].wStep6Detail },
    { i: 7, label: T[locale].wStep7Label, detail: T[locale].wStep7Detail },
  ];
  return (
    <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden">
      <ol className="divide-y divide-surface-secondary/40">
        {steps.map((s) => (
          <li key={s.i} className="px-4 py-3 flex items-start gap-3">
            <span className="font-display text-lg text-brand-700 w-6 text-center flex-shrink-0">{s.i}</span>
            <div>
              <div className="font-medium text-sm">{s.label}</div>
              <div className="text-xs text-text-tertiary mt-0.5">{s.detail}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CapStructureSummary({
  assumptions,
  keyMetrics,
  locale,
  founderCashInvested,
}: {
  assumptions: ModelAssumptions;
  keyMetrics: ModelOutput["keyMetrics"];
  locale: Locale;
  founderCashInvested: number;
}) {
  const grantRate = assumptions.grant?.grantRate ?? 0;
  const isGrant = assumptions.financingPath === "grant";
  const grantAmount = keyMetrics.grantAmount;
  const totalPlots = assumptions.portfolio.reduce((s, p) => s + p.count, 0);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <div className="rounded-xl border border-surface-tertiary bg-white p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">{T[locale].csFounderEquity}</div>
        <div className="font-display text-2xl mt-1">25%</div>
        <div className="text-xs text-text-tertiary mt-1">{T[locale].csFounderEquitySub}</div>
      </div>
      <div className="rounded-xl border border-surface-tertiary bg-white p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">{T[locale].csCoinvest}</div>
        <div className="font-display text-2xl mt-1">{formatCurrency(founderCashInvested, true, locale)}</div>
        <div className="text-xs text-text-tertiary mt-1">{T[locale].csCoinvestSub}</div>
      </div>
      <div className="rounded-xl border border-surface-tertiary bg-white p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">{T[locale].csOtherInvestors}</div>
        <div className="font-display text-2xl mt-1">{formatCurrency(Math.max(0, keyMetrics.equityRequired - founderCashInvested), true, locale)}</div>
        <div className="text-xs text-text-tertiary mt-1">{T[locale].csOtherInvestorsSub}</div>
      </div>
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-warning">{T[locale].csBankLoan}</div>
        <div className="font-display text-2xl mt-1">{formatCurrency(keyMetrics.loanAmount, true, locale)}</div>
        <div className="text-xs text-text-tertiary mt-1">@ {formatPercent(assumptions.commercialLoan.interestRate)} · {assumptions.commercialLoan.repaymentTermYears}y amort post-grace</div>
      </div>
      <div className="rounded-xl border border-positive/30 bg-positive/5 p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-positive">{T[locale].csGrant}</div>
        <div className="font-display text-2xl mt-1">
          {isGrant ? formatCurrency(grantAmount, true, locale) : "—"}
        </div>
        <div className="text-xs text-text-tertiary mt-1">
          {isGrant ? `${formatPercent(grantRate)} of eligible CapEx` : T[locale].csGrantInactive}
        </div>
      </div>
      <div className="rounded-xl border border-surface-tertiary bg-white p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">{T[locale].csTotalCapex}</div>
        <div className="font-display text-2xl mt-1">{formatCurrency(keyMetrics.totalCapex, true, locale)}</div>
        <div className="text-xs text-text-tertiary mt-1">{totalPlots} {totalPlots === 1 ? T[locale].propcoPlot : T[locale].propcoPlots} + construction + FF&amp;E + soft costs</div>
      </div>
    </div>
  );
}
