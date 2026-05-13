import type { TourConfig } from "./types";

// ── Dashboard ───────────────────────────────────────────────
export const DASHBOARD_TOUR: TourConfig = {
  storageKey: "villaLev.dashboardTour.seen.v1",
  showLanguagePicker: true,
  steps: [
    {
      title: {
        en: "Welcome to Villa Lev",
        el: "Καλώς ήρθατε στο Villa Lev",
        fr: "Bienvenue sur Villa Lev",
        he: "ברוכים הבאים ל-Villa Lev",
      },
      body: {
        en: "This dashboard turns the Villa Lev financial model into a credit-ready view that works for both bankers and the sponsor. Let me walk you through what to look at first.",
        el: "Ο πίνακας αυτός μετατρέπει το χρηματοοικονομικό μοντέλο Villa Lev σε προβολή έτοιμη για τράπεζες και επενδυτές. Ας περιηγηθούμε στα κύρια στοιχεία.",
        fr: "Ce tableau de bord transforme le modèle financier Villa Lev en une vue prête pour les banques et les investisseurs. Laissez-moi vous montrer l'essentiel.",
        he: "לוח המחוונים הופך את מודל Villa Lev לתצוגה מוכנה עבור בנקאים ובעלי הון. נעבור על הנקודות העיקריות.",
      },
    },
    {
      target: "#control-bar",
      title: {
        en: "Control bar",
        el: "Μπάρα ελέγχου",
        fr: "Barre de contrôle",
        he: "סרגל בקרה",
      },
      body: {
        en: "Always visible at the top: pick the financing path (Commercial, RRF, Grant, TEPIX), switch scenarios (Realistic / Upside / Downside / Break-Even), and tune rate and loan coverage live. Every chart, KPI, and table below reacts instantly. Live DS / DSCR / NCF readouts on the right show the current numbers — and Δ versus Realistic when you switch scenarios.",
        el: "Πάντα ορατή στην κορυφή: επιλέξτε διαδρομή χρηματοδότησης (Commercial, RRF, Grant, TEPIX), αλλάξτε σενάρια, και ρυθμίστε επιτόκιο και κάλυψη δανείου ζωντανά. Όλα τα γραφήματα και KPI παρακάτω αντιδρούν άμεσα. Οι ζωντανοί δείκτες DS / DSCR / NCF δεξιά εμφανίζουν τα τρέχοντα νούμερα και Δ έναντι Realistic.",
        fr: "Toujours visible en haut : choisissez la voie de financement, changez de scénario, et ajustez taux et couverture en direct. Tous les graphiques et KPI réagissent instantanément. Les indicateurs DS / DSCR / FTN à droite affichent les chiffres courants et Δ vs Realistic.",
        he: "תמיד גלוי בראש: בחרו מסלול מימון, החליפו תרחישים, והתאימו ריבית וכיסוי בזמן אמת. כל התרשימים וה-KPI למטה מגיבים מיידית. נתוני DS / DSCR / NCF בצד מציגים את המספרים העדכניים ו-Δ מול Realistic.",
      },
    },
    {
      target: "#section-deal-snapshot",
      title: {
        en: "Deal Snapshot",
        el: "Σύνοψη συμφωνίας",
        fr: "Aperçu de l'opération",
        he: "תקציר עסקה",
      },
      body: {
        en: "Your headline figures — total CapEx, loan, equity, annual debt service, the active financing path, and the stabilised DSCR. This strip is always at the top.",
        el: "Τα κύρια νούμερα: σύνολο CapEx, δάνειο, ίδια κεφάλαια, ετήσια εξυπηρέτηση χρέους, ενεργή διαδρομή και σταθεροποιημένο DSCR.",
        fr: "Vos chiffres clés — CapEx total, prêt, fonds propres, service de la dette, voie active et DSCR stabilisé.",
        he: "הנתונים העיקריים: סך CapEx, הלוואה, הון, שירות חוב שנתי, מסלול פעיל ו-DSCR מיוצב.",
      },
    },
    {
      target: "#section-dscr-hero",
      title: {
        en: "DSCR Trajectory",
        el: "Τροχιά DSCR",
        fr: "Trajectoire DSCR",
        he: "מסלול DSCR",
      },
      body: {
        en: "Year-by-year debt service coverage across financing paths and the downside scenario, with covenant lines at 1.25× and 1.50×. The minimum DSCR over loan life and grace-period interest are annotated above the chart.",
        el: "Ετήσιος δείκτης κάλυψης χρέους ανά διαδρομή και σενάριο downside, με γραμμές covenant στο 1.25× και 1.50×.",
        fr: "Couverture du service de la dette année par année, avec covenants à 1.25× et 1.50×.",
        he: "יחס כיסוי שירות חוב שנתי לפי מסלולים ותרחיש שלילי, עם קווי קובננט ב-1.25× ו-1.50×.",
      },
    },
    {
      target: "#section-coverage",
      title: {
        en: "Coverage Ratios",
        el: "Δείκτες κάλυψης",
        fr: "Ratios de couverture",
        he: "יחסי כיסוי",
      },
      body: {
        en: "What credit committees underwrite against: minimum DSCR over loan life, interest coverage (ICR), LLCR (loan-life coverage), PLCR (project-life coverage), and headroom against the 1.25× covenant.",
        el: "Τι ελέγχουν οι πιστωτικές επιτροπές: ελάχιστο DSCR, κάλυψη τόκων, LLCR, PLCR και περιθώριο έναντι covenant 1.25×.",
        fr: "Ce que les comités de crédit examinent : DSCR minimum, ICR, LLCR, PLCR et marge vs covenant 1.25×.",
        he: "מה שוועדות אשראי בוחנות: DSCR מינימום, ICR, LLCR, PLCR ומרווח מול קובננט 1.25×.",
      },
    },
    {
      target: "#section-returns",
      title: {
        en: "Returns to Sponsor",
        el: "Αποδόσεις χορηγού",
        fr: "Rendements pour l'investisseur",
        he: "תשואות לבעל ההון",
      },
      body: {
        en: "The sponsor side: equity yield at stabilised year, cumulative yield (multiple of equity returned), payback years, levered Equity IRR, and unlevered Project IRR — all using a 7% terminal cap rate.",
        el: "Πλευρά επενδυτή: απόδοση κεφαλαίων στο σταθεροποιημένο έτος, σωρευτική απόδοση, έτη αποπληρωμής, IRR ιδίων κεφαλαίων και IRR έργου με 7% τελικό cap rate.",
        fr: "Côté sponsor : rendement des fonds propres en année stabilisée, rendement cumulé, années de remboursement, TRI fonds propres et TRI projet — avec cap rate terminal de 7%.",
        he: "צד המשקיע: תשואת הון בשנה מיוצבת, תשואה מצטברת, שנות החזר, IRR הון, IRR פרויקט — עם cap rate טרמינלי 7%.",
      },
    },
    {
      target: "#section-capital",
      title: {
        en: "Capital Structure",
        el: "Κεφαλαιακή δομή",
        fr: "Structure du capital",
        he: "מבנה ההון",
      },
      body: {
        en: "Grace-period interest burden during construction, net leverage (loan / EBITDA), peak debt outstanding (term loan + WC peak), and stabilised ROIC.",
        el: "Τόκοι περιόδου χάριτος, καθαρή μόχλευση, μέγιστη οφειλή και σταθεροποιημένο ROIC.",
        fr: "Intérêts de la période de grâce, levier net, dette maximale et ROIC stabilisé.",
        he: "ריבית תקופת חסד, מינוף נטו, שיא חוב ו-ROIC מיוצב.",
      },
    },
    {
      target: "#section-pnl-summary",
      title: {
        en: "P&L Summary",
        el: "Σύνοψη P&L",
        fr: "Aperçu P&L",
        he: "תקציר P&L",
      },
      body: {
        en: "Year-by-year flow: Revenue → EBITDA → Debt Service → NCF post-tax → DSCR → ICR → Yield to equity → Cumulative yield. Two reads in one table — bank read on top, sponsor read on bottom.",
        el: "Ετήσια ροή: Έσοδα → EBITDA → Εξυπηρέτηση χρέους → NCF μετά φόρων → DSCR → ICR → Απόδοση κεφαλαίων → Σωρευτική απόδοση.",
        fr: "Flux annuel : Revenus → EBITDA → Service dette → FTN post-impôts → DSCR → ICR → Rendement → Rendement cumulé.",
        he: "זרימה שנתית: הכנסות → EBITDA → שירות חוב → NCF לאחר מס → DSCR → ICR → תשואה → תשואה מצטברת.",
      },
    },
  ],
};

// ── P&L Timeline ────────────────────────────────────────────
export const PNL_TOUR: TourConfig = {
  storageKey: "villaLev.pnlTour.seen.v1",
  steps: [
    {
      title: {
        en: "P&L Timeline",
        el: "Χρονοδιάγραμμα P&L",
        fr: "Chronologie P&L",
        he: "ציר זמן P&L",
      },
      body: {
        en: "An 11-year operational projection (2026 → 2036) covering acquisition, construction, opening ramp, and stabilised operations. Every row reflects the active scenario.",
        el: "Πρόβλεψη 11 ετών (2026-2036) που καλύπτει απόκτηση, κατασκευή, ramp και σταθεροποιημένη λειτουργία. Κάθε γραμμή αντικατοπτρίζει το ενεργό σενάριο.",
        fr: "Projection sur 11 ans (2026 → 2036) couvrant acquisition, construction, montée en puissance et exploitation stabilisée.",
        he: "תחזית 11 שנים (2026-2036) הכוללת רכישה, בנייה, ראמפ-אפ והפעלה מיוצבת.",
      },
    },
    {
      target: "#pnl-table",
      title: {
        en: "Phase + nights row",
        el: "Φάση + βραδιές",
        fr: "Phase + nuitées",
        he: "שלב + לילות",
      },
      body: {
        en: "The two header rows show project phase and the underlying nights driver per villa / suite. These drive every revenue line below.",
        el: "Οι δύο γραμμές κεφαλίδας δείχνουν τη φάση του έργου και τον οδηγό βραδιών ανά villa / suite που τροφοδοτεί κάθε γραμμή εσόδων παρακάτω.",
        fr: "Les deux lignes d'en-tête montrent la phase du projet et le moteur nuitées par villa / suite — ils pilotent toutes les lignes de revenus.",
        he: "שתי שורות הכותרת מציגות את שלב הפרויקט ומחולל הלילות לכל וילה / חדר — מניעי הכנסות.",
      },
    },
    {
      target: "#pnl-row-totalRevenue",
      title: {
        en: "Revenue → EBITDA",
        el: "Έσοδα → EBITDA",
        fr: "Revenus → EBITDA",
        he: "הכנסות → EBITDA",
      },
      body: {
        en: "Per-property revenue, events, ancillary services, then OPEX and working-capital interest. Total Revenue and EBITDA rows are bolded section totals.",
        el: "Έσοδα ανά ακίνητο, εκδηλώσεις, βοηθητικές υπηρεσίες, OPEX και τόκοι ΚΕΚ. Οι γραμμές Συνολικά Έσοδα και EBITDA είναι έντονα σύνολα.",
        fr: "Revenus par propriété, événements, services annexes, OPEX et intérêts BFR. Total Revenus et EBITDA sont des totaux en gras.",
        he: "הכנסות לכל נכס, אירועים, שירותים נלווים, OPEX וריבית הון חוזר. שורות סך הכנסות ו-EBITDA הן סיכומים.",
      },
    },
    {
      target: "#pnl-row-debtService",
      title: {
        en: "Debt service breakdown",
        el: "Εξυπηρέτηση χρέους",
        fr: "Service de la dette",
        he: "שירות חוב",
      },
      body: {
        en: "Below Debt Service: term loan interest, principal, and closing balance for each year. Grace period 2026-2028 is interest-only; principal starts 2029.",
        el: "Κάτω από Εξυπηρέτηση Χρέους: τόκοι, κεφάλαιο και υπόλοιπο δανείου ανά έτος. 2026-2028 μόνο τόκοι, κεφάλαιο από 2029.",
        fr: "Sous Service de la dette : intérêts, principal et solde du prêt par an. Grâce 2026-2028 = intérêts seuls, principal dès 2029.",
        he: "מתחת לשירות חוב: ריבית, קרן ויתרת הלוואה לכל שנה. תקופת חסד 2026-2028 ריבית בלבד, קרן מ-2029.",
      },
    },
    {
      target: "#pnl-row-dscr",
      title: {
        en: "Coverage ratios",
        el: "Δείκτες κάλυψης",
        fr: "Ratios de couverture",
        he: "יחסי כיסוי",
      },
      body: {
        en: "DSCR (EBITDA ÷ debt service), DSCR-loaded (incl. WC interest in the denominator), and ICR (EBITDA ÷ interest only). All three need to clear the bank's covenant.",
        el: "DSCR, DSCR-loaded (συμπ. τόκων ΚΕΚ), και ICR. Όλοι πρέπει να ξεπερνούν τον covenant της τράπεζας.",
        fr: "DSCR, DSCR-loaded (avec intérêts BFR), et ICR. Les trois doivent dépasser le covenant bancaire.",
        he: "DSCR, DSCR-loaded (כולל ריבית הון חוזר), ו-ICR. שלושתם חייבים לעבור את קובננט הבנק.",
      },
    },
    {
      target: "#pnl-row-yieldOnEquity",
      title: {
        en: "Yield to equity",
        el: "Απόδοση ιδίων κεφαλαίων",
        fr: "Rendement fonds propres",
        he: "תשואת הון עצמי",
      },
      body: {
        en: "Annual yield = NCF post-tax / initial equity. Total yield (cumulative) is the running multiple of equity returned. The final-year value tells you total cash on cash returned over 11 years.",
        el: "Ετήσια απόδοση = NCF μετά φόρων / αρχικά ίδια κεφάλαια. Η σωρευτική απόδοση είναι το πολλαπλάσιο του κεφαλαίου που επιστρέφεται.",
        fr: "Rendement annuel = FTN post-impôts / fonds propres initiaux. Le rendement cumulé est le multiple des fonds propres restitués.",
        he: "תשואה שנתית = NCF לאחר מס / הון התחלתי. תשואה מצטברת = כפולת ההון המוחזרת.",
      },
    },
  ],
};

// ── Scenarios ───────────────────────────────────────────────
export const SCENARIOS_TOUR: TourConfig = {
  storageKey: "villaLev.scenariosTour.seen.v1",
  steps: [
    {
      title: {
        en: "Scenario comparison",
        el: "Σύγκριση σεναρίων",
        fr: "Comparaison de scénarios",
        he: "השוואת תרחישים",
      },
      body: {
        en: "Four scenarios side-by-side at the stabilised year (2031): Realistic, Upside, Downside, and the Grant financing path. Use this to argue stress-resilience to a credit committee.",
        el: "Τέσσερα σενάρια δίπλα-δίπλα στο σταθεροποιημένο έτος (2031): Realistic, Upside, Downside και διαδρομή Grant. Χρήσιμο για επιχειρήματα ανθεκτικότητας σε πιστωτική επιτροπή.",
        fr: "Quatre scénarios côte à côte en année stabilisée (2031). Utile pour démontrer la résilience à un comité de crédit.",
        he: "ארבעה תרחישים זה לצד זה בשנה המיוצבת (2031). שימושי להוכחת עמידות בפני ועדת אשראי.",
      },
    },
    {
      target: "#sc-stabilised",
      title: {
        en: "Stabilised metrics",
        el: "Μετρικές σταθεροποίησης",
        fr: "Indicateurs stabilisés",
        he: "מדדים מיוצבים",
      },
      body: {
        en: "Revenue, OPEX, EBITDA, DSCR, NCF post-tax — by scenario. Bold rows are the lines a banker checks first. Color coding: gold = realistic, green = upside, red = downside, blue = grant.",
        el: "Έσοδα, OPEX, EBITDA, DSCR, NCF μετά φόρων — ανά σενάριο. Έντονες γραμμές είναι οι γραμμές που ελέγχει πρώτα ένας τραπεζίτης.",
        fr: "Revenus, OPEX, EBITDA, DSCR, FTN post-impôts — par scénario. Les lignes en gras sont celles qu'un banquier examine en premier.",
        he: "הכנסות, OPEX, EBITDA, DSCR, NCF לאחר מס — לפי תרחיש. שורות מודגשות הן השורות שבנקאי בודק קודם.",
      },
    },
    {
      target: "#sc-dscrByYear",
      title: {
        en: "DSCR by year",
        el: "DSCR ανά έτος",
        fr: "DSCR par année",
        he: "DSCR לפי שנה",
      },
      body: {
        en: "Year-by-year DSCR for each scenario / financing path. Colors: green ≥ 1.25× (covenant), amber > 0 (sub-covenant), grey = pre-operations. Look for the worst single year — that's what banks size to.",
        el: "DSCR ανά έτος για κάθε σενάριο / διαδρομή. Πράσινο ≥ 1.25×, πορτοκαλί υπό-covenant, γκρι προ-λειτουργίας.",
        fr: "DSCR année par année par scénario / voie. Vert ≥ 1.25×, ambre sous covenant, gris pré-opérations.",
        he: "DSCR לפי שנה לכל תרחיש / מסלול. ירוק ≥ 1.25×, כתום מתחת לקובננט, אפור טרום-תפעול.",
      },
    },
    {
      target: "#sc-collateral",
      title: {
        en: "Collateral tiers",
        el: "Επίπεδα εξασφάλισης",
        fr: "Niveaux de garantie",
        he: "רמות בטחונות",
      },
      body: {
        en: "Portfolio value, LTV, and asset coverage at three valuation tiers: Stress (most conservative), Market (base case), Positive. Banks underwrite to Stress; sponsor narrates with Market.",
        el: "Αξία χαρτοφυλακίου, LTV και κάλυψη ενεργητικού σε τρία επίπεδα αποτίμησης: Stress, Αγορά, Θετικό.",
        fr: "Valeur du portefeuille, LTV et couverture actifs à trois niveaux : Stress, Marché, Positif.",
        he: "שווי תיק, LTV וכיסוי נכסים בשלוש רמות הערכה: Stress, שוק, חיובי.",
      },
    },
  ],
};

// ── Break-Even ──────────────────────────────────────────────
export const BREAKEVEN_TOUR: TourConfig = {
  storageKey: "villaLev.breakevenTour.seen.v1",
  steps: [
    {
      title: {
        en: "Break-even analysis",
        el: "Ανάλυση Break-Even",
        fr: "Analyse Break-Even",
        he: "ניתוח Break-Even",
      },
      body: {
        en: "How far can occupancy and ADR fall before debt service is at risk? This page tells the bank where the trip-wire is.",
        el: "Πόσο μπορεί να πέσει η πληρότητα και το ADR πριν κινδυνεύσει η εξυπηρέτηση χρέους;",
        fr: "Jusqu'où l'occupation et l'ADR peuvent-ils chuter avant de mettre la dette en risque ?",
        he: "עד כמה התפוסה ו-ADR יכולים לרדת לפני ששירות החוב בסיכון?",
      },
    },
    {
      target: "#be-buffer",
      title: {
        en: "Headroom KPIs",
        el: "Περιθώρια",
        fr: "Marges de sécurité",
        he: "מרווחי ביטחון",
      },
      body: {
        en: "Break-even nights, buffer to break-even, and the implied occupancy / ADR cushion. Bigger numbers = more comfort.",
        el: "Βραδιές break-even, περιθώριο και υπονοούμενο cushion πληρότητας / ADR.",
        fr: "Nuitées break-even, marge et coussin implicite occupation / ADR.",
        he: "לילות break-even, מרווח, וכרית תפוסה / ADR משתמעת.",
      },
    },
    {
      target: "#be-matrix",
      title: {
        en: "DSCR sensitivity matrix",
        el: "Πίνακας ευαισθησίας DSCR",
        fr: "Matrice sensibilité DSCR",
        he: "מטריצת רגישות DSCR",
      },
      body: {
        en: "Each cell is the DSCR at that occupancy × ADR combination. Green = above 1.25× covenant, amber = sub-covenant, red = breach. Trace the contour where DSCR crosses 1.25×.",
        el: "Κάθε κελί είναι το DSCR σε αυτόν τον συνδυασμό πληρότητας × ADR. Πράσινο > 1.25×, πορτοκαλί υπό-covenant, κόκκινο παραβίαση.",
        fr: "Chaque cellule = DSCR à cette combinaison occupation × ADR. Vert > 1.25×, ambre sous-covenant, rouge brèche.",
        he: "כל תא = DSCR בשילוב תפוסה × ADR. ירוק > 1.25×, כתום מתחת לקובננט, אדום הפרה.",
      },
    },
  ],
};

// ── CAPEX ───────────────────────────────────────────────────
export const CAPEX_TOUR: TourConfig = {
  storageKey: "villaLev.capexTour.seen.v1",
  steps: [
    {
      title: {
        en: "CAPEX breakdown",
        el: "Ανάλυση CAPEX",
        fr: "Analyse CAPEX",
        he: "פירוק CAPEX",
      },
      body: {
        en: "Total project cost decomposed by category and by property — land, construction, FF&E, fees, contingency, and acquisition legal.",
        el: "Συνολικό κόστος έργου ανά κατηγορία και ακίνητο — γη, κατασκευή, FF&E, αμοιβές, contingency και νομικά.",
        fr: "Coût total du projet décomposé par catégorie et par propriété — terrain, construction, FF&E, honoraires, aléas et frais juridiques.",
        he: "עלות הפרויקט הכוללת לפי קטגוריה ונכס — קרקע, בנייה, FF&E, אגרות, contingency ומשפטיים.",
      },
    },
    {
      target: "#capex-table",
      title: {
        en: "Per-category lines",
        el: "Γραμμές ανά κατηγορία",
        fr: "Lignes par catégorie",
        he: "שורות לפי קטגוריה",
      },
      body: {
        en: "Each row is one cost category showing per-unit and total cost across the portfolio. Land + construction usually dominates; contingency is sized off construction + FF&E.",
        el: "Κάθε γραμμή είναι μία κατηγορία κόστους με κόστος ανά μονάδα και σύνολο. Γη + κατασκευή κυριαρχούν συνήθως.",
        fr: "Chaque ligne est une catégorie avec coût par unité et total. Terrain + construction dominent en général.",
        he: "כל שורה היא קטגוריית עלות עם עלות ליחידה ולסך. קרקע + בנייה בדרך כלל דומיננטיים.",
      },
    },
  ],
};

// ── Sensitivity ─────────────────────────────────────────────
export const SENSITIVITY_TOUR: TourConfig = {
  storageKey: "villaLev.sensitivityTour.seen.v1",
  steps: [
    {
      title: {
        en: "Sensitivity analysis",
        el: "Ανάλυση ευαισθησίας",
        fr: "Analyse de sensibilité",
        he: "ניתוח רגישות",
      },
      body: {
        en: "How much do DSCR and NCF move when you flex one assumption at a time? Each chart isolates a single driver.",
        el: "Πόσο μετακινούνται DSCR και NCF όταν αλλάζετε μία υπόθεση τη φορά;",
        fr: "Combien DSCR et FTN bougent-ils quand vous modifiez une hypothèse à la fois ?",
        he: "כמה DSCR ו-NCF זזים כשמשנים הנחה אחת בכל פעם?",
      },
    },
    {
      target: "#sens-rate",
      title: {
        en: "Interest rate sensitivity",
        el: "Ευαισθησία επιτοκίου",
        fr: "Sensibilité taux",
        he: "רגישות ריבית",
      },
      body: {
        en: "DSCR vs interest rate. Slope tells you how fragile coverage is to rate hikes — flatter is safer.",
        el: "DSCR έναντι επιτοκίου. Η κλίση δείχνει πόσο εύθραυστη είναι η κάλυψη σε αυξήσεις επιτοκίου.",
        fr: "DSCR vs taux. La pente montre la fragilité de la couverture aux hausses de taux.",
        he: "DSCR מול ריבית. השיפוע מראה את שבריריות הכיסוי לעליות ריבית.",
      },
    },
    {
      target: "#sens-occupancy",
      title: {
        en: "Occupancy sensitivity",
        el: "Ευαισθησία πληρότητας",
        fr: "Sensibilité occupation",
        he: "רגישות תפוסה",
      },
      body: {
        en: "DSCR / NCF vs occupancy. Where does the line cross 1.25×? That's your operational red line.",
        el: "DSCR / NCF έναντι πληρότητας. Πού η γραμμή τέμνει το 1.25×;",
        fr: "DSCR / FTN vs occupation. Où la ligne croise-t-elle 1.25× ?",
        he: "DSCR / NCF מול תפוסה. איפה הקו חוצה את 1.25×?",
      },
    },
  ],
};
