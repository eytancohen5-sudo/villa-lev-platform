import type { TourConfig } from "./types";

// ── Dashboard ───────────────────────────────────────────────
// Refreshed 2026-05-25 — full 7-step tour covering all visible sections in
// DOM top-to-bottom order. Fixed: step 4 previously targeted #section-conservatism
// but described LiveTrackRecord (wrong section). Now uses a no-target centered card
// for LiveTrackRecord and adds steps for #section-three-scenario and
// #section-exit-analysis which were previously uncovered.
// TODO: add section-dscr-summary tour step (inserted before section-exit-analysis)
export const DASHBOARD_TOUR: TourConfig = {
  storageKey: "villaLev.dashboardTour.seen.v4",
  showLanguagePicker: true,
  steps: [
    {
      title: {
        en: "Welcome to Villa Lev",
        el: "Καλώς ήρθατε στο Villa Lev",
        he: "ברוכים הבאים ל-Villa Lev",
      },
      body: {
        en: "This dashboard is the admin's home — the same numbers a banker sees on /bank, plus the levers and proof-of-conservatism that drive them. Seven stops: control bar → headline KPIs → live track record → three-scenario returns → exit analysis → founder waterfall.",
        el: "Ο πίνακας αυτός είναι το home του admin — τα ίδια νούμερα που βλέπει ένας τραπεζίτης στο /bank, μαζί με τους μοχλούς και την απόδειξη συντηρητικότητας πίσω τους. Επτά στάσεις: μπάρα ελέγχου → KPIs → ζωντανό track record → τρία σενάρια → ανάλυση εξόδου → καταρράκτης ιδρυτή.",
        he: "לוח המחוונים הוא הבית של ה-admin — אותם מספרים שבנקאי רואה ב-/bank, פלוס המנופים והוכחת השמרנות. שבע תחנות: סרגל בקרה → KPIs עיקריים → track record חי → שלושה תרחישים → ניתוח יציאה → מפל יזם.",
      },
    },
    {
      target: "#control-bar",
      title: {
        en: "Control bar",
        el: "Μπάρα ελέγχου",
        he: "סרגל בקרה",
      },
      body: {
        en: "Pinned to the top: switch financing path (Commercial / RRF / Grant / TEPIX), scenario (Realistic / Upside / Downside / Break-Even), exit year × EBITDA multiple, and tune rate + loan coverage via the Adjust popover. The View-As control in the sidebar lets you preview the model as an editor, viewer, or banker.",
        el: "Καρφιτσωμένη στην κορυφή: αλλάξτε διαδρομή χρηματοδότησης, σενάριο, έτος εξόδου × πολλαπλάσιο EBITDA, και ρυθμίστε επιτόκιο + κάλυψη μέσω του popover Adjust. Το View-As στο sidebar δείχνει την προβολή ως editor / viewer / banker.",
        he: "מוצמד למעלה: החליפו מסלול מימון, תרחיש, שנת יציאה × כפולת EBITDA, וכווננו ריבית + כיסוי בפופאובר Adjust. ה-View-As מציג את המודל כ-editor / viewer / banker.",
      },
    },
    {
      target: "#section-deal-snapshot",
      title: {
        en: "Headline KPIs",
        el: "Κύρια KPIs",
        he: "KPIs עיקריים",
      },
      body: {
        en: "Total Investment, Equity Required, Total MOIC (with terminal value), and Equity IRR — the four underwriting figures a banker reads after reviewing the deal terms. All respond to the active path and scenario.",
        el: "Συνολική Επένδυση, Ίδια Κεφάλαια, MOIC (με τερματική αξία) και IRR Ιδίων — τα τέσσερα βασικά νούμερα ανάλυσης. Αντιδρούν στην ενεργή διαδρομή και σενάριο.",
        he: "השקעה כוללת, הון נדרש, MOIC כולל (עם ערך טרמינלי) ו-IRR הון — ארבעת הנתונים שבנקאי קורא. מגיבים למסלול ולתרחיש הפעיל.",
      },
    },
    {
      // No target — LiveTrackRecord sits in a flex row above the KPI grid with no
      // standalone id anchor. Described as a centered card so the tour explains it
      // without trying to scroll-highlight a specific element.
      title: {
        en: "Live track record",
        el: "Ζωντανό Track Record",
        he: "Track Record חי",
      },
      body: {
        en: "Just above the KPI grid: the live operating villa's real-time performance — ADR, occupancy, YTD revenue — pulled from the PMS dashboard via Firestore. Every per-villa assumption in the model is at or below what this single live villa already delivers today. The model is a floor, not a forecast.",
        el: "Ακριβώς πάνω από το grid KPIs: η ζωντανή απόδοση του λειτουργικού villa — ADR, πληρότητα, YTD έσοδα — από το PMS μέσω Firestore. Κάθε ανά-villa υπόθεση είναι ίση ή μικρότερη από αυτό που ήδη πετυχαίνει η villa. Το μοντέλο είναι floor, όχι forecast.",
        he: "מעל רשת ה-KPI: ביצועי הוילה הפעילה בזמן אמת — ADR, תפוסה, הכנסות YTD — דרך Firestore. כל הנחה לוילה במודל שווה או נמוכה ממה שהוילה כבר משיגה. המודל הוא רצפה, לא תחזית.",
      },
    },
    {
      target: "#section-three-scenario",
      title: {
        en: "Three-scenario returns",
        el: "Αποδόσεις τριών σεναρίων",
        he: "תשואות שלושה תרחישים",
      },
      body: {
        en: "Three scenarios at a glance — Upside, Base, Downside — showing Equity IRR, Cash Yield, and Total MOIC. The Base row (highlighted gold) is the underwriting anchor. Drill into /admin/returns for the full IRR waterfall and both exit paths.",
        el: "Τρία σενάρια με μια ματιά — Upside, Base, Downside — δείχνοντας Equity IRR, Cash Yield και Total MOIC. Η γραμμή Base (χρυσή) είναι η βάση ανάληψης. Εμβαθύνετε στο /admin/returns για τον πλήρη καταρράκτη IRR και τις δύο διαδρομές εξόδου.",
        he: "שלושה תרחישים במבט אחד — Upside, Base, Downside — עם Equity IRR, Cash Yield ו-Total MOIC. שורת ה-Base (מודגשת בזהב) היא עוגן ההחתמה. כנסו ל-/admin/returns לפירוט מפל ה-IRR ושני מסלולי היציאה.",
      },
    },
    {
      target: "#section-exit-analysis",
      title: {
        en: "Exit analysis",
        el: "Ανάλυση εξόδου",
        he: "ניתוח יציאה",
      },
      body: {
        en: "The preferred exit path is shown here — hotel sale (EBITDA × multiple) or property sale (built surface × €/m²), whichever yields more. Exit year and multiple are set in the control bar. Full year-by-year cash flow at /admin/returns.",
        el: "Η προτιμώμενη διαδρομή εξόδου εμφανίζεται εδώ — πώληση ξενοδοχείου (EBITDA × πολλαπλάσιο) ή ακινήτου (built surface × €/m²), όποια αποδίδει περισσότερο. Έτος εξόδου και πολλαπλάσιο στη μπάρα ελέγχου. Πλήρης ανάλυση ταμειακών ροών στο /admin/returns.",
        he: "מסלול היציאה המועדף מוצג כאן — מכירת מלון (EBITDA × כפולה) או מכירת נכס (שטח בנוי × €/m²), הגבוה מביניהם. שנת יציאה וכפולה נקבעות בסרגל הבקרה. תזרים שנתי מלא ב-/admin/returns.",
      },
    },
    {
      target: "#section-founder",
      title: {
        en: "Founder waterfall",
        el: "Καταρράκτης ιδρυτή",
        he: "מפל יזם",
      },
      body: {
        en: "Three layers: pari-passu (founder's equity in), grant bonus (10% gross fee net of consultant), performance ratchet (additional carry by MOIC tier). Investors' floor is protected at 25%; cap status shows when the founder's total has hit a binding limit.",
        el: "Τρία επίπεδα: pari-passu, bonus επιχορήγησης, performance ratchet (επιπλέον carry ανά MOIC tier). Το floor επενδυτών προστατεύεται στο 25%.",
        he: "שלוש שכבות: pari-passu, בונוס מענק, רצ'ט ביצועים. רצפת המשקיעים מוגנת ב-25%; ה-cap status מראה כשמגיעים לגבול.",
      },
    },
  ],
};

// ── P&L Timeline ────────────────────────────────────────────
export const PNL_TOUR: TourConfig = {
  storageKey: "villaLev.pnlTour.seen.v2",
  steps: [
    {
      title: {
        en: "P&L Timeline",
        el: "Χρονοδιάγραμμα P&L",
        he: "ציר זמן P&L",
      },
      body: {
        en: "An 11-year operational projection (2026 → 2036) covering acquisition, construction, opening ramp, and stabilised operations. Every row reflects the active scenario AND the active financing path — switch them in the control bar to flex the entire table.",
        el: "Πρόβλεψη 11 ετών (2026-2036): απόκτηση, κατασκευή, ramp, σταθεροποίηση. Κάθε γραμμή αντικατοπτρίζει ενεργό σενάριο ΚΑΙ ενεργή διαδρομή.",
        he: "תחזית 11 שנים (2026-2036): רכישה, בנייה, ראמפ-אפ, ייצוב. כל שורה משקפת תרחיש פעיל ומסלול מימון פעיל.",
      },
    },
    {
      target: "#pnl-table",
      title: {
        en: "Phase + nights row",
        el: "Φάση + βραδιές",
        he: "שלב + לילות",
      },
      body: {
        en: "Header rows show project phase and the underlying nights driver per villa / suite. These drive every revenue line below. Grace period 2026-2028 is interest-only on the term loan; principal repayment kicks in 2029.",
        el: "Οι γραμμές κεφαλίδας δείχνουν τη φάση και τον οδηγό βραδιών ανά villa / suite. Η χάριτος 2026-2028 είναι μόνο τόκοι· κεφάλαιο από 2029.",
        he: "שורות הכותרת מציגות שלב פרויקט ומחולל לילות לכל וילה / חדר. תקופת חסד 2026-2028 ריבית בלבד; קרן מ-2029.",
      },
    },
    {
      target: "#pnl-row-totalRevenue",
      title: {
        en: "Revenue → EBITDA",
        el: "Έσοδα → EBITDA",
        he: "הכנסות → EBITDA",
      },
      body: {
        en: "Per-property revenue, events, ancillary services (capped/uncapped split visible), then OPEX, working-capital interest, and OpCo fees if the split is on. Total Revenue and EBITDA are bold section totals.",
        el: "Έσοδα ανά ακίνητο, εκδηλώσεις, βοηθητικές (capped/uncapped), OPEX, τόκοι ΚΕΚ και αμοιβές OpCo (αν ενεργοποιημένες). Total Revenue και EBITDA είναι σύνολα.",
        he: "הכנסות לפי נכס, אירועים, שירותים נלווים (capped/uncapped), OPEX, ריבית הון חוזר ועמלות OpCo (אם פעיל). סך הכנסות ו-EBITDA הם סיכומים.",
      },
    },
    {
      target: "#pnl-row-debtService",
      title: {
        en: "Debt service breakdown",
        el: "Εξυπηρέτηση χρέους",
        he: "שירות חוב",
      },
      body: {
        en: "Below Debt Service: term loan interest, principal, and closing balance for each year. For TEPIX, you also see the HDB portion (interest-free) and the bank tranche separated.",
        el: "Κάτω από Εξυπηρέτηση Χρέους: τόκοι, κεφάλαιο, υπόλοιπο. Για TEPIX, εμφανίζεται ξεχωριστά η μερίδα ΕΑΤ (άτοκη) και η τραπεζική.",
        he: "מתחת לשירות חוב: ריבית, קרן, יתרה. ל-TEPIX, חלק HDB (ללא ריבית) ומנת הבנק מוצגים בנפרד.",
      },
    },
    {
      target: "#pnl-row-dscr",
      title: {
        en: "Coverage ratios",
        el: "Δείκτες κάλυψης",
        he: "יחסי כיסוי",
      },
      body: {
        en: "DSCR (EBITDA ÷ debt service), DSCR-loaded (includes WC interest in the denominator — the stricter read), and ICR (EBITDA ÷ interest only). All three need to clear the bank's 1.25× covenant.",
        el: "DSCR, DSCR-loaded (συμπ. τόκων ΚΕΚ — αυστηρότερο), και ICR. Όλοι ξεπερνούν το covenant 1.25×.",
        he: "DSCR, DSCR-loaded (כולל ריבית הון חוזר — קריאה מחמירה), ו-ICR. שלושתם עוברים את הקובננט 1.25×.",
      },
    },
    {
      target: "#pnl-row-yieldOnEquity",
      title: {
        en: "Yield to equity",
        el: "Απόδοση ιδίων κεφαλαίων",
        he: "תשואת הון עצמי",
      },
      body: {
        en: "Annual yield = NCF post-tax / initial equity. Total yield (cumulative) is the running multiple returned. Final-year value is total cash-on-cash returned over 11 years (excluding terminal — see Total MOIC on the dashboard for that).",
        el: "Ετήσια απόδοση = NCF μετά φόρων / αρχικά ίδια κεφάλαια. Σωρευτική απόδοση = πολλαπλάσιο που επιστρέφεται. Η τιμή τελικού έτους είναι το συνολικό cash-on-cash για 11 χρόνια (εκτός terminal — δες Total MOIC στο dashboard).",
        he: "תשואה שנתית = NCF לאחר מס / הון התחלתי. תשואה מצטברת = כפולה מוחזרת. ערך שנה אחרונה = סך cash-on-cash ל-11 שנים (ללא טרמינל — ראו MOIC כולל בלוח המחוונים).",
      },
    },
  ],
};

// ── Scenarios ───────────────────────────────────────────────
export const SCENARIOS_TOUR: TourConfig = {
  storageKey: "villaLev.scenariosTour.seen.v2",
  steps: [
    {
      title: {
        en: "Scenario comparison",
        el: "Σύγκριση σεναρίων",
        he: "השוואת תרחישים",
      },
      body: {
        en: "Four scenarios side-by-side at the stabilised year (2031): Realistic, Upside, Downside, and the Grant financing path. Use this view to argue stress-resilience to a credit committee — the headline DSCR + NCF survive Downside.",
        el: "Τέσσερα σενάρια στο σταθεροποιημένο έτος (2031): Realistic, Upside, Downside, διαδρομή Grant. Χρήσιμο για ανθεκτικότητα σε πιστωτική επιτροπή.",
        he: "ארבעה תרחישים בשנה המיוצבת (2031): Realistic, Upside, Downside, מסלול Grant. שימושי להוכחת עמידות לוועדת אשראי.",
      },
    },
    {
      target: "#sc-stabilised",
      title: {
        en: "Stabilised metrics",
        el: "Μετρικές σταθεροποίησης",
        he: "מדדים מיוצבים",
      },
      body: {
        en: "Revenue, OPEX, EBITDA, DSCR, NCF post-tax by scenario. Bold rows are the lines a banker checks first. Colour coding: gold = Realistic, green = Upside, red = Downside, blue = Grant.",
        el: "Έσοδα, OPEX, EBITDA, DSCR, NCF μετά φόρων ανά σενάριο. Έντονες γραμμές = πρώτος έλεγχος τραπεζίτη. Χρώματα: χρυσό = Realistic, πράσινο = Upside, κόκκινο = Downside, μπλε = Grant.",
        he: "הכנסות, OPEX, EBITDA, DSCR, NCF לאחר מס לפי תרחיש. שורות מודגשות = הבדיקה הראשונה של בנקאי. צבעים: זהב = Realistic, ירוק = Upside, אדום = Downside, כחול = Grant.",
      },
    },
    {
      target: "#sc-dscrByYear",
      title: {
        en: "DSCR by year",
        el: "DSCR ανά έτος",
        he: "DSCR לפי שנה",
      },
      body: {
        en: "Year-by-year DSCR per scenario / financing path. Green ≥ 1.25× (covenant), amber > 0 (sub-covenant), grey = pre-operations. Look for the worst single year — that's what banks size to.",
        el: "DSCR ανά έτος για κάθε σενάριο. Πράσινο ≥ 1.25×, πορτοκαλί υπό-covenant, γκρι προ-λειτουργίας.",
        he: "DSCR לפי שנה לכל תרחיש. ירוק ≥ 1.25×, כתום מתחת לקובננט, אפור טרום-תפעול.",
      },
    },
    {
      target: "#sc-collateral",
      title: {
        en: "Collateral tiers",
        el: "Επίπεδα εξασφάλισης",
        he: "רמות בטחונות",
      },
      body: {
        en: "Portfolio value, LTV, asset coverage at three valuation tiers: Stress (conservative), Market (base), Positive. Banks underwrite to Stress; sponsor narrates with Market.",
        el: "Αξία χαρτοφυλακίου, LTV, κάλυψη ενεργητικού σε τρία επίπεδα: Stress, Market, Positive.",
        he: "שווי תיק, LTV וכיסוי נכסים בשלוש רמות: Stress, שוק, חיובי.",
      },
    },
  ],
};

// ── Break-Even ──────────────────────────────────────────────
export const BREAKEVEN_TOUR: TourConfig = {
  storageKey: "villaLev.breakevenTour.seen.v2",
  steps: [
    {
      title: {
        en: "Break-even analysis",
        el: "Ανάλυση Break-Even",
        he: "ניתוח Break-Even",
      },
      body: {
        en: "How far can occupancy and ADR fall before debt service is at risk? This page tells the bank where the trip-wire is — and how far we sit above it today.",
        el: "Πόσο μπορεί να πέσει πληρότητα και ADR πριν κινδυνεύσει η εξυπηρέτηση χρέους;",
        he: "עד כמה התפוסה ו-ADR יכולים לרדת לפני ששירות החוב בסיכון?",
      },
    },
    {
      target: "#be-buffer",
      title: {
        en: "Headroom KPIs",
        el: "Περιθώρια",
        he: "מרווחי ביטחון",
      },
      body: {
        en: "Break-even nights, buffer to break-even, and the implied occupancy / ADR cushion. Bigger numbers = more comfort. The buffer is the % revenue decline the deal absorbs before DSCR falls below 1.0×.",
        el: "Βραδιές break-even, περιθώριο, και cushion πληρότητας / ADR. Μεγαλύτερα νούμερα = περισσότερη άνεση.",
        he: "לילות break-even, מרווח, וכרית תפוסה / ADR. גדול יותר = יותר נוחות.",
      },
    },
    {
      target: "#be-matrix",
      title: {
        en: "DSCR sensitivity matrix",
        el: "Πίνακας ευαισθησίας DSCR",
        he: "מטריצת רגישות DSCR",
      },
      body: {
        en: "Each cell is the DSCR at that occupancy × ADR combination. Green = above 1.25× covenant, amber = sub-covenant, red = breach. Trace the contour where DSCR crosses 1.25× — that's the bank's red line in 2-D.",
        el: "Κάθε κελί είναι το DSCR σε αυτόν τον συνδυασμό. Πράσινο > 1.25×, πορτοκαλί υπό-covenant, κόκκινο παραβίαση.",
        he: "כל תא = DSCR בשילוב הזה. ירוק > 1.25×, כתום מתחת לקובננט, אדום הפרה.",
      },
    },
  ],
};

// ── CAPEX ───────────────────────────────────────────────────
export const CAPEX_TOUR: TourConfig = {
  storageKey: "villaLev.capexTour.seen.v2",
  steps: [
    {
      title: {
        en: "CAPEX breakdown",
        el: "Ανάλυση CAPEX",
        he: "פירוק CAPEX",
      },
      body: {
        en: "Total project cost decomposed by category and by property — land, construction, FF&E, fees, contingency, and acquisition legal. Click any blue value to edit; the whole model recomputes.",
        el: "Συνολικό κόστος ανά κατηγορία και ακίνητο — γη, κατασκευή, FF&E, αμοιβές, contingency, νομικά. Πατήστε σε μπλε τιμή για επεξεργασία· όλο το μοντέλο ξανα-υπολογίζεται.",
        he: "עלות הפרויקט לפי קטגוריה ונכס — קרקע, בנייה, FF&E, אגרות, contingency, משפטיים. לחיצה על ערך כחול לעריכה; כל המודל מחושב מחדש.",
      },
    },
    {
      target: "#capex-table",
      title: {
        en: "Per-category lines",
        el: "Γραμμές ανά κατηγορία",
        he: "שורות לפי קטגוריה",
      },
      body: {
        en: "Each row is one cost category showing per-unit and total cost across the portfolio. Land + construction usually dominates; contingency is sized off construction + FF&E.",
        el: "Κάθε γραμμή είναι μία κατηγορία με κόστος ανά μονάδα και σύνολο. Γη + κατασκευή κυριαρχούν.",
        he: "כל שורה היא קטגוריית עלות עם עלות ליחידה ולסך. קרקע + בנייה דומיננטיים.",
      },
    },
  ],
};

// ── Sensitivity ─────────────────────────────────────────────
export const SENSITIVITY_TOUR: TourConfig = {
  storageKey: "villaLev.sensitivityTour.seen.v2",
  steps: [
    {
      title: {
        en: "Sensitivity analysis",
        el: "Ανάλυση ευαισθησίας",
        he: "ניתוח רגישות",
      },
      body: {
        en: "How much do DSCR and NCF move when you flex one assumption at a time? Each chart isolates a single driver — interest rate, occupancy, ADR, working-capital facility size.",
        el: "Πόσο κινούνται DSCR και NCF όταν αλλάζετε μία υπόθεση τη φορά;",
        he: "כמה DSCR ו-NCF זזים כשמשנים הנחה אחת בכל פעם?",
      },
    },
    {
      target: "#sens-rate",
      title: {
        en: "Interest rate sensitivity",
        el: "Ευαισθησία επιτοκίου",
        he: "רגישות ריבית",
      },
      body: {
        en: "DSCR vs interest rate. Slope tells you how fragile coverage is to rate hikes — flatter is safer. Useful for stressing against ECB hiking cycles.",
        el: "DSCR vs επιτόκιο. Η κλίση δείχνει την ευθραυστότητα σε αυξήσεις επιτοκίου.",
        he: "DSCR מול ריבית. השיפוע מראה את שבריריות הכיסוי לעליות ריבית.",
      },
    },
    {
      target: "#sens-occupancy",
      title: {
        en: "Occupancy sensitivity",
        el: "Ευαισθησία πληρότητας",
        he: "רגישות תפוסה",
      },
      body: {
        en: "DSCR / NCF vs occupancy. Where does the line cross 1.25×? That's your operational red line — and the Live Track Record on the dashboard shows where the existing villa already sits in this curve.",
        el: "DSCR / NCF vs πληρότητα. Πού τέμνει το 1.25×;",
        he: "DSCR / NCF מול תפוסה. איפה הקו חוצה את 1.25×?",
      },
    },
  ],
};

// ── OpCo / PropCo split (new — page didn't have a tour) ─────
export const OPCO_SPLIT_TOUR: TourConfig = {
  storageKey: "villaLev.opcoSplitTour.seen.v1",
  steps: [
    {
      title: {
        en: "OpCo / PropCo split",
        el: "Διαχωρισμός OpCo / PropCo",
        he: "פיצול OpCo / PropCo",
      },
      body: {
        en: "Two legal entities: PropCo holds the real estate and the bank loan; OpCo manages day-to-day operations and earns three fee streams in exchange. The toggle in the top-right enables the structure across the whole model — everything you see below reacts.",
        el: "Δύο νομικές οντότητες: PropCo κατέχει το real estate και το δάνειο· OpCo διαχειρίζεται και χρεώνει τρία streams αμοιβών. Το toggle στα πάνω δεξιά ενεργοποιεί τη δομή σε όλο το μοντέλο.",
        he: "שתי ישויות משפטיות: PropCo מחזיקה בנדל\"ן ובהלוואה; OpCo מנהלת וגובה שלושה זרמי עמלות. ה-toggle בפינה הימנית העליונה מפעיל את המבנה בכל המודל.",
      },
    },
    {
      title: {
        en: "Why the split matters to a banker",
        el: "Γιατί ενδιαφέρει τον τραπεζίτη",
        he: "למה זה חשוב לבנקאי",
      },
      body: {
        en: "OpCo fees are subordinated to debt service. PropCo pays the loan FIRST, then pays OpCo whatever's left. This means DSCR on /bank reflects cash flow before founder compensation — the bank gets paid before the operator. Bank View toggle and /bank page pin this view.",
        el: "Οι αμοιβές OpCo είναι κατώτερες της εξυπηρέτησης χρέους. Η PropCo πληρώνει ΠΡΩΤΑ το δάνειο, μετά την OpCo. Το DSCR στο /bank αντικατοπτρίζει ταμειακή ροή ΠΡΙΝ την αμοιβή ιδρυτή.",
        he: "עמלות OpCo כפופות לשירות החוב. PropCo משלמת קודם את ההלוואה, אחר כך את OpCo. ה-DSCR ב-/bank משקף תזרים לפני שכר היזם.",
      },
    },
    {
      title: {
        en: "The three fee streams",
        el: "Τα τρία streams αμοιβών",
        he: "שלושת זרמי העמלות",
      },
      body: {
        en: "1) Base fee — % of total revenue (covers OpCo overhead). 2) Brand / marketing fee — % of room revenue (covers brand + acquisition). 3) Incentive fee — % of GOP above the owner's priority return on equity. The table below shows the live stabilised values for the active scenario.",
        el: "1) Base fee — % συνολικών εσόδων. 2) Brand / marketing fee — % εσόδων δωματίων. 3) Incentive fee — % GOP πάνω από το priority return ιδιοκτήτη.",
        he: "1) Base fee — % מסך ההכנסות. 2) Brand / marketing — % הכנסות חדרים. 3) Incentive — % מ-GOP מעל priority return של הבעלים.",
      },
    },
    {
      title: {
        en: "The enablement flag",
        el: "Η σημαία ενεργοποίησης",
        he: "דגל ההפעלה",
      },
      body: {
        en: "The Split ON/OFF toggle in the page header is sticky across all pages. When ON, every metric on Dashboard / P&L / Scenarios reflects PropCo's post-fee cash flow. The /bank route pins it ON regardless — bankers always see the subordinated view.",
        el: "Το toggle Split ON/OFF διατηρείται σε όλες τις σελίδες. Όταν ON, κάθε μετρική σε Dashboard / P&L / Scenarios αντικατοπτρίζει ταμειακή ροή PropCo μετά αμοιβές. Το /bank είναι πάντα ON.",
        he: "ה-toggle Split ON/OFF נשמר בכל הדפים. כאשר ON, כל מדד ב-Dashboard / P&L / Scenarios משקף תזרים PropCo לאחר עמלות. /bank תמיד ON.",
      },
    },
    {
      title: {
        en: "IRR cost of split",
        el: "Κόστος IRR διαχωρισμού",
        he: "עלות IRR של הפיצול",
      },
      body: {
        en: "The headline KPI below quantifies the trade-off: pre-split (owner takes 100% of GOP) vs post-split (owner = PropCo, after OpCo fees). The delta is what the founder gives up in PropCo equity IRR in exchange for the OpCo cash flow on top.",
        el: "Το KPI κάτω ποσοτικοποιεί την αντισταθμιστική σχέση: pre-split vs post-split. Το delta είναι ό,τι ο ιδρυτής παραιτείται σε IRR ιδίων κεφαλαίων PropCo.",
        he: "ה-KPI למטה מכמת את ה-trade-off: לפני פיצול לעומת אחרי. ה-delta הוא מה שהיזם מוותר ב-IRR הון של PropCo.",
      },
    },
  ],
};

// ── Team / RBAC (new — page didn't have a tour) ─────────────
export const TEAM_TOUR: TourConfig = {
  storageKey: "villaLev.teamTour.seen.v1",
  steps: [
    {
      title: {
        en: "Team & access control",
        el: "Ομάδα & έλεγχος πρόσβασης",
        he: "צוות ובקרת גישה",
      },
      body: {
        en: "This page is the admin's home for who can see the model and what they can do. Two tools: send invites (top form) and review who has already claimed an invite (bottom list).",
        el: "Η σελίδα αυτή είναι το home του admin για το ποιος βλέπει το μοντέλο και τι μπορεί να κάνει. Δύο εργαλεία: αποστολή invites και λίστα όσων έχουν εγγραφεί.",
        he: "דף זה הוא הבית של ה-admin עבור מי רואה את המודל ומה הוא יכול לעשות. שני כלים: שליחת הזמנות ורשימת המשתמשים הקיימים.",
      },
    },
    {
      target: "#invite-email",
      title: {
        en: "Send an invite",
        el: "Αποστολή πρόσκλησης",
        he: "שליחת הזמנה",
      },
      body: {
        en: "Type the email, pick a role, optionally add a note (e.g. \"banker at NBG\"). The invite is written to Firestore at invites/{email}; when that user signs in with Google for the first time the role is granted automatically.",
        el: "Πληκτρολογήστε email, επιλέξτε ρόλο, προσθέστε προαιρετικά σημείωση. Το invite γράφεται στο Firestore· όταν ο χρήστης συνδεθεί πρώτη φορά με Google, ο ρόλος αποδίδεται αυτόματα.",
        he: "הקלידו אימייל, בחרו תפקיד, הוסיפו הערה אופציונלית. ההזמנה נכתבת ל-Firestore; כשהמשתמש מתחבר לראשונה עם Google, התפקיד מוקצה אוטומטית.",
      },
    },
    {
      target: "#invite-role",
      title: {
        en: "Three roles",
        el: "Τρεις ρόλοι",
        he: "שלושה תפקידים",
      },
      body: {
        en: "Admin — full access, including this page. Editor — can save/edit scenarios and tune assumptions but cannot manage the team. Viewer — read-only; the right choice for a banker who just needs to browse the model. Firestore rules enforce all three server-side.",
        el: "Admin — πλήρης πρόσβαση. Editor — μπορεί να αλλάξει σενάρια/παραδοχές αλλά όχι την ομάδα. Viewer — μόνο ανάγνωση· σωστή επιλογή για τραπεζίτη.",
        he: "Admin — גישה מלאה. Editor — יכול לערוך תרחישים/הנחות אך לא לנהל צוות. Viewer — קריאה בלבד; הבחירה הנכונה לבנקאי.",
      },
    },
    {
      title: {
        en: "Impersonation (View-As)",
        el: "Προσποίηση (View-As)",
        he: "התחזות (View-As)",
      },
      body: {
        en: "From any page, the View-As dropdown in the sidebar lets an admin preview the model as an editor, viewer, or banker — so you can verify what each role sees BEFORE you send the invite. Impersonation as a banker takes you to the bank-facing view.",
        el: "Από οποιαδήποτε σελίδα, το View-As στο sidebar δείχνει την προβολή ως editor / viewer / banker — επιβεβαιώνετε τι βλέπει κάθε ρόλος ΠΡΙΝ στείλετε το invite.",
        he: "מכל דף, ה-View-As בסרגל הצדדי מאפשר לראות את המודל כ-editor / viewer / banker — אמתו לפני שליחת ההזמנה.",
      },
    },
  ],
};

// ── Bank ────────────────────────────────────────────────────
// Different audience from the admin tours. Less hand-holding on UX, more
// "here's why these numbers are credible."
// v5 2026-05-25: 11-step tour in strict DOM top-to-bottom order. Added steps
// for #bank-term-sheet (The Ask), #bank-capex (Use of Proceeds),
// #bank-capital-structure (Capital Structure + Stabilised Ops), and
// #bank-dscr-chart (DSCR by Scenario). #bank-revenue-chart, #bank-dscr-summary,
// and #bank-allpaths-dscr are tagged with ids for future use but intentionally
// omitted from the tour to keep it under 5 minutes.
export const BANK_TOUR: TourConfig = {
  storageKey: "villaLev.bankTour.seen.v5",
  showLanguagePicker: true,
  steps: [
    // Step order mirrors strict DOM top-to-bottom order so the scroll-sync
    // never jumps backward.
    {
      title: {
        en: "Villa Lev Group — bank review",
        el: "Villa Lev Group — προβολή τράπεζας",
        he: "Villa Lev Group — מצב בנקאי",
      },
      body: {
        en: "This is the live financial model for the Villa Lev Group multi-villa expansion in Antiparos, Greece. Three plots, two villas + one boutique suites property, financed against an existing operating villa with a four-year track record. Tour takes ~3 minutes.",
        el: "Αυτό είναι το ζωντανό χρηματοοικονομικό μοντέλο για την επέκταση Villa Lev Group στην Αντίπαρο. Τρία οικόπεδα, δύο villas + ένα boutique suites property, χρηματοδοτούμενα έναντι ενός λειτουργικού villa με τετραετές track record. Ξενάγηση ~3 λεπτά.",
        he: "זה המודל הפיננסי החי של הרחבת Villa Lev Group באנטיפרוס, יוון. שלושה מגרשים, שתי וילות + נכס סוויטות בוטיק, ממומנים מול וילה פעילה עם track record של ארבע שנים. סיור ~3 דקות.",
      },
    },
    {
      // DOM: Term Sheet renders before #live-track-record
      target: "#bank-term-sheet",
      title: {
        en: "The ask",
        el: "Η πρόταση χρηματοδότησης",
        he: "הבקשה",
      },
      body: {
        en: "The term sheet is the single-page summary a credit committee reads first: loan amount, loan term × grace period, interest rate, annual debt service, and DSCR covenant pass/fail at stabilisation. Equity required and security package follow. Every cell reacts to the financing path selected in the control bar.",
        el: "Η term sheet είναι η σελίδα που διαβάζει πρώτα μια πιστωτική επιτροπή: ποσό δανείου, διάρκεια × χάρη, επιτόκιο, ετήσια εξυπηρέτηση, DSCR pass/fail. Ίδια κεφάλαια και εξασφαλίσεις ακολουθούν. Κάθε κελί αντιδρά στη διαδρομή χρηματοδότησης.",
        he: "טופס התנאים הוא הדף שוועדת האשראי קוראת ראשון: סכום הלוואה, תקופה × חסד, ריבית, שירות חוב שנתי, DSCR pass/fail בייצוב. הון נדרש ובטחונות בהמשך. כל תא מגיב למסלול המימון שנבחר בסרגל הבקרה.",
      },
    },
    {
      // DOM: after #bank-term-sheet
      target: "#live-track-record",
      title: {
        en: "These aren't projections",
        el: "Αυτά δεν είναι προβλέψεις",
        he: "אלו לא תחזיות",
      },
      body: {
        en: "The numbers above are the current operating villa's live performance — ADR, occupancy, YTD revenue — pulled from the PMS dashboard via Firestore. Every per-villa assumption in the model below is at or below what this single live villa already delivers today. The model is a floor, not a forecast.",
        el: "Τα νούμερα παραπάνω είναι η ζωντανή απόδοση του λειτουργικού villa — ADR, πληρότητα, έσοδα έτους — από το PMS μέσω Firestore. Κάθε ανά-villa υπόθεση είναι ίση ή μικρότερη από αυτό που ήδη πετυχαίνει σήμερα. Το μοντέλο είναι floor, όχι forecast.",
        he: "המספרים למעלה הם הביצועים החיים של הוילה הפעילה — ADR, תפוסה, הכנסות YTD — דרך Firestore. כל הנחה לוילה במודל שווה או נמוכה ממה שהוילה כבר משיגה. המודל הוא רצפה, לא תחזית.",
      },
    },
    {
      // DOM: collateral and loan metrics are side-by-side in the same grid row.
      // Using #bank-kpi-strip as the single spotlight; collateral coverage
      // is described in the body to avoid scroll-sync oscillation.
      target: "#bank-kpi-strip",
      title: {
        en: "Collateral & headline metrics",
        el: "Εξασφαλίσεις & κύρια μετρικά",
        he: "בטחונות ומדדים עיקריים",
      },
      body: {
        en: "Two cards side-by-side. Left — collateral: asset coverage at Stress (€7,000/m²), Market, and Positive tiers; LTV at completion. Banks underwrite to the Stress tier. Right — five headline KPIs: total investment, loan amount, LTV, asset coverage, and stabilised DSCR. The 1.25× covenant is cleared from year 3 in every scenario.",
        el: "Δύο κάρτες δίπλα-δίπλα. Αριστερά — εξασφαλίσεις: κάλυψη στα επίπεδα Stress, Market, Positive· LTV ολοκλήρωσης. Δεξιά — πέντε κύρια KPIs: επένδυση, δάνειο, LTV, κάλυψη, DSCR. Το 1.25× ξεπερνιέται από το έτος 3.",
        he: "שתי כרטיסיות זו לצד זו. שמאל — בטחונות: כיסוי ברמות Stress, שוק, חיובי; LTV בסיום. ימין — חמישה KPIs: השקעה, הלוואה, LTV, כיסוי, DSCR. הקובננט 1.25× נחצה משנה 3.",
      },
    },
    {
      // DOM: after #bank-kpi-strip
      target: "#bank-capex",
      title: {
        en: "Use of proceeds",
        el: "Χρήση αντληθέντων κεφαλαίων",
        he: "שימוש בתמורות",
      },
      body: {
        en: "Where the money goes: land, construction, FF&E, professional fees, contingency, and acquisition legal — broken out by category across all plots. The footer shows how loan, equity, and any grant together cover the total. LTV is sized against this figure at completion.",
        el: "Πού πάνε τα χρήματα: γη, κατασκευή, FF&E, επαγγελματικές αμοιβές, contingency, νομικά — ανά κατηγορία για όλα τα οικόπεδα. Το υποσέλιδο δείχνει πώς δάνειο, ίδια κεφάλαια και επιχορήγηση καλύπτουν το σύνολο. Το LTV μετριέται με βάση αυτό το νούμερο.",
        he: "לאן הכסף הולך: קרקע, בנייה, FF&E, שכר מקצועי, contingency, משפטיים — לפי קטגוריה על כל המגרשים. הכותרת התחתונה מציגה כיצד הלוואה, הון ומענק מכסים את הסך. ה-LTV מחושב מול נתון זה בסיום.",
      },
    },
    {
      // DOM: after #bank-capex
      target: "#bank-capital-structure",
      title: {
        en: "Capital structure & stabilised ops",
        el: "Κεφαλαιακή δομή & σταθεροποιημένη λειτουργία",
        he: "מבנה הון ותפעול מיוצב",
      },
      body: {
        en: "Left card: the loan/equity/grant donut with net leverage (Debt/EBITDA) and peak drawn balance. Right card: the stabilised year's headline P&L — Revenue, EBITDA, annual debt service, DSCR, and NCF post-VAT. These are the post-ramp figures the bank underwrites to.",
        el: "Αριστερή κάρτα: το donut δανείου/ιδίων/επιχορήγησης με net leverage (Debt/EBITDA) και peak υπόλοιπο. Δεξιά κάρτα: τα κύρια P&L του σταθεροποιημένου έτους — Έσοδα, EBITDA, ετήσια εξυπηρέτηση, DSCR, NCF. Αυτά είναι τα μετά-ramp νούμερα που χρησιμοποιεί η τράπεζα.",
        he: "כרטיסיה שמאל: עוגת הלוואה/הון/מענק עם מינוף נטו (חוב/EBITDA) ויתרת שיא. כרטיסיה ימין: P&L מרכזי של שנת הייצוב — הכנסות, EBITDA, שירות חוב שנתי, DSCR, NCF לאחר מע\"מ. אלו נתוני הפוסט-ראמפ שהבנק מחתם.",
      },
    },
    {
      // No target — centered card explaining PropCo/OpCo structure
      title: {
        en: "OpCo subordination",
        el: "Υποταγή OpCo",
        he: "כפיפות OpCo",
      },
      body: {
        en: "The structure separates real estate (PropCo) from operations (OpCo). All DSCR and NCF figures on this page are PropCo's — AFTER debt service but BEFORE operator fees. The bank gets paid first. Operator compensation is structurally subordinated.",
        el: "Η δομή διαχωρίζει το real estate (PropCo) από τη λειτουργία (OpCo). Όλα τα DSCR και NCF εδώ είναι της PropCo — ΜΕΤΑ την εξυπηρέτηση χρέους και ΠΡΙΝ τις αμοιβές operator. Η τράπεζα πληρώνεται πρώτη.",
        he: "המבנה מפריד נדל\"ן (PropCo) מתפעול (OpCo). כל ה-DSCR וה-NCF כאן הם של PropCo — אחרי שירות החוב ולפני עמלות המפעיל. הבנק משולם ראשון.",
      },
    },
    {
      // DOM: above #bank-dscr-summary and #bank-stress-test
      target: "#bank-dscr-chart",
      title: {
        en: "DSCR by scenario",
        el: "DSCR ανά σενάριο",
        he: "DSCR לפי תרחיש",
      },
      body: {
        en: "Three scenarios plotted year-by-year: Conservative (Base), Realistic, and Downside. The red dashed line is the 1.25× covenant; the gold dashed line marks the first full amortisation year (2029). Confirm the worst-case scenario clears the covenant by year 3 — that is the bank's primary sizing test.",
        el: "Τρία σενάρια ανά έτος: Conservative (Base), Realistic, Downside. Η κόκκινη διακεκομμένη γραμμή είναι το covenant 1.25×· η χρυσή σηματοδοτεί το πρώτο πλήρες έτος αποπληρωμής (2029). Επιβεβαιώστε ότι το χειρότερο σενάριο ξεπερνά το covenant από το έτος 3.",
        he: "שלושה תרחישים לפי שנה: Conservative (Base), Realistic, Downside. הקו האדום המקווקו הוא קובננט 1.25×; הקו הזהב מסמן את שנת הפירעון המלאה הראשונה (2029). וודאו שהתרחיש הגרוע עובר את הקובננט בשנה 3 — זהו מבחן הגודל העיקרי של הבנק.",
      },
    },
    {
      // DOM: stress test comes after the DSCR chart
      target: "#bank-stress-test",
      title: {
        en: "Stress test",
        el: "Stress test",
        he: "מבחן עמידות",
      },
      body: {
        en: "Interactive downside stress: what happens to DSCR when occupancy and ADR drop simultaneously? Dial both inputs and see coverage in real time — confirming the 1.25× covenant survives plausible adverse scenarios.",
        el: "Διαδραστικό stress test: τι συμβαίνει στο DSCR όταν πέσουν ταυτόχρονα πληρότητα και ADR; Ρυθμίστε και δείτε κάλυψη σε πραγματικό χρόνο.",
        he: "מבחן עמידות אינטראקטיבי: מה קורה ל-DSCR כשתפוסה ו-ADR יורדים יחד? כווננו בזמן אמת לאימות הקובננט 1.25×.",
      },
    },
    {
      // DOM: financing comparison is below stress test
      target: "#bank-financing-comparison",
      title: {
        en: "Financing path comparison",
        el: "Σύγκριση διαδρομών",
        he: "השוואת מסלולים",
      },
      body: {
        en: "Four financing paths side-by-side: Commercial, RRF, Greek Development Law Grant, and TEPIX III. Rows show loan size, equity required, annual debt service, stabilised DSCR, and equity IRR. The highlighted path is the sponsor's primary application.",
        el: "Τέσσερις διαδρομές χρηματοδότησης: Commercial, ΤΑΑ, Επιχορήγηση, ΤΕΠΙΧ ΙΙΙ. Γραμμές: δάνειο, ίδια κεφάλαια, εξυπηρέτηση, DSCR, IRR.",
        he: "ארבעה מסלולים: Commercial, RRF, מענק, TEPIX III. שורות: הלוואה, הון, DS, DSCR, IRR.",
      },
    },
    {
      // DOM: P&L is the last major section
      target: "#bank-pnl",
      title: {
        en: "Full P&L + download",
        el: "Πλήρες P&L + λήψη",
        he: "P&L מלא + הורדה",
      },
      body: {
        en: "The full 11-year P&L table: Revenue, EBITDA, Debt Service, NCF post-tax, DSCR, and yield to equity year by year. Use Export Model (.xlsx) in the top bar to take the full 14-sheet workbook offline — all formulas remain linked and editable.",
        el: "Πλήρης πίνακας P&L 11 ετών: έσοδα, EBITDA, εξυπηρέτηση, NCF, DSCR, απόδοση. Χρησιμοποιήστε Export Model (.xlsx) για το Excel των 14 φύλλων.",
        he: "טבלת P&L מלאה ל-11 שנים. השתמשו ב-Export Model (.xlsx) בסרגל העליון להורדת חוברת 14 גליונות.",
      },
    },
  ],
};

// ── Assumptions ──────────────────────────────────────────────
export const ASSUMPTIONS_TOUR: TourConfig = {
  storageKey: "villaLev.assumptionsTour.seen.v1",
  steps: [
    {
      title: {
        en: "Assumptions — the model's cockpit",
        el: "Παραδοχές — το πιλοτήριο του μοντέλου",
        he: "הנחות — תא הטייס של המודל",
      },
      body: {
        en: "Every number in the Dashboard, P&L, and Scenarios is derived from the inputs on this page. Change a value here and the entire model recomputes in milliseconds. Six tabs cover the full input surface — Portfolio, Templates, Financing, General, Revenue, and OPEX.",
        el: "Κάθε νούμερο στο Dashboard, P&L και Σενάρια προέρχεται από τις εισόδους αυτής της σελίδας. Αλλάξτε μια τιμή και όλο το μοντέλο επανυπολογίζεται. Έξι tabs καλύπτουν όλες τις εισόδους.",
        he: "כל מספר ב-Dashboard, P&L ותרחישים נגזר מהקלטים בדף זה. שנו ערך וכל המודל מחושב מחדש. שישה לשוניות מכסות את כל משטח הקלט.",
      },
    },
    {
      target: "#assumptions-portfolio-overview",
      title: {
        en: "Portfolio overview",
        el: "Επισκόπηση χαρτοφυλακίου",
        he: "סקירת תיק נכסים",
      },
      body: {
        en: "Live snapshot: number of projects, total units, total built surface, and total CapEx. These four cells update the moment you add, remove, or resize a project in the Portfolio tab below.",
        el: "Ζωντανό στιγμιότυπο: αριθμός projects, συνολικές μονάδες, built surface, συνολικό CapEx. Ενημερώνεται αμέσως με κάθε αλλαγή project.",
        he: "תמונת מצב חיה: פרויקטים, יחידות כולל, שטח בנוי, CapEx כולל. מתעדכן מיד עם כל שינוי בפרויקט.",
      },
    },
    {
      target: "#assumptions-tabs",
      title: {
        en: "Six tabs, full control",
        el: "Έξι tabs, πλήρης έλεγχος",
        he: "שש לשוניות, שליטה מלאה",
      },
      body: {
        en: "Portfolio — add/remove plots and set unit counts. Templates — define per-property CAPEX and OPEX. Financing — select path and tune loan terms. General — ramp factors and tax rates. Revenue — ADR, nights, events, ancillary by scenario. OPEX — operating cost overrides per template.",
        el: "Portfolio — plots και μονάδες. Templates — CAPEX/OPEX ανά property. Financing — διαδρομή και όροι δανείου. General — ramp και φόροι. Revenue — ADR, βραδιές, events ανά σενάριο. OPEX — λειτουργικά κόστη.",
        he: "Portfolio — מגרשים ויחידות. Templates — CAPEX/OPEX לנכס. Financing — מסלול ותנאי הלוואה. General — ramp ומסים. Revenue — ADR, לילות, אירועים. OPEX — עלויות תפעול.",
      },
    },
    {
      title: {
        en: "Blue cells are editable",
        el: "Τα μπλε κελιά είναι επεξεργάσιμα",
        he: "תאים כחולים ניתנים לעריכה",
      },
      body: {
        en: "Any value shown on a blue background is a live input — click it to edit in place. Numeric fields accept raw numbers (enter 0.05 or 5 for 5% depending on format). Press Enter or Tab to commit; Escape to cancel. The model recomputes as you leave each field.",
        el: "Κάθε τιμή σε μπλε φόντο είναι ενεργή είσοδος — πατήστε για επεξεργασία. Enter / Tab για αποθήκευση, Escape για ακύρωση. Το μοντέλο επανυπολογίζεται αμέσως.",
        he: "כל ערך על רקע כחול הוא קלט פעיל — לחצו לעריכה. Enter / Tab לאישור, Escape לביטול. המודל מחושב מחדש מיד.",
      },
    },
  ],
};

// ── Cap Table ────────────────────────────────────────────────
export const CAP_TABLE_TOUR: TourConfig = {
  storageKey: "villaLev.capTableTour.seen.v1",
  steps: [
    {
      title: {
        en: "Cap table — who gets what at exit",
        el: "Cap Table — ποιος παίρνει τι στην έξοδο",
        he: "Cap Table — מי מקבל מה ביציאה",
      },
      body: {
        en: "This page shows the equity distribution at the active exit year. The model runs a three-layer founder waterfall — pari-passu, grant bonus (if applicable), and performance ratchet — then splits the remainder among investors pro-rata. Change cash contributions to see the waterfall recompute in real time.",
        el: "Αυτή η σελίδα δείχνει τη διανομή ιδίων κεφαλαίων στο ενεργό έτος εξόδου. Τρία επίπεδα ιδρυτή: pari-passu, bonus επιχορήγησης, performance ratchet — ο υπόλοιπος μοιράζεται ανά-λόγια στους επενδυτές.",
        he: "דף זה מציג את חלוקת ההון בשנת היציאה הפעילה. שלוש שכבות יזם — pari-passu, בונוס מענק, רצ'ט — אחר כך השאר למשקיעים לפי יחס.",
      },
    },
    {
      target: "#captable-founder-waterfall",
      title: {
        en: "Founder waterfall",
        el: "Καταρράκτης ιδρυτή",
        he: "מפל יזם",
      },
      body: {
        en: "Layer A (pari-passu): founder's cash-in as a fraction of total equity. Layer B (grant bonus): additional carried interest derived from the 10% grant success fee net of consultant cost — vests only if the development-law application is approved. Layer C (performance ratchet): additional carry by MOIC tier. Investors are guaranteed at least 25% of distributions.",
        el: "Layer A: μερίδιο ιδρυτή pari-passu. Layer B: bonus επιχορήγησης (10% grant αμοιβή μείον σύμβουλο). Layer C: performance ratchet ανά MOIC tier. Οι επενδυτές εγγυώνται ≥25% διανομών.",
        he: "שכבה A: חלק pari-passu. שכבה B: בונוס מענק (10% עמלה נטו מייעוץ). שכבה C: רצ'ט ביצועים לפי שכבת MOIC. משקיעים מובטחים ≥25% מהחלוקות.",
      },
    },
    {
      target: "#captable-stakeholders",
      title: {
        en: "Stakeholder table",
        el: "Πίνακας συμμετόχων",
        he: "טבלת בעלי עניין",
      },
      body: {
        en: "One row per investor: cash in, pool share, economic stake (post-waterfall), total received at exit, MOIC, IRR, and payback year. Click any row to expand year-by-year distributions. Edit a cash contribution directly in the table — the waterfall recomputes instantly. Add investors with the button below.",
        el: "Μία γραμμή ανά επενδυτή: cash in, μερίδιο, οικονομικό stake, σύνολο, MOIC, IRR, payback. Κλικ για ετήσια ανάλυση. Επεξεργαστείτε cash contribution άμεσα.",
        he: "שורה לכל משקיע: cash, חלק בבריכה, stake כלכלי, סך שהתקבל, MOIC, IRR, שנת החזר. לחצו לפירוט שנתי. ערכו תרומות ישירות.",
      },
    },
    {
      title: {
        en: "Investor reports",
        el: "Εκθέσεις επενδυτών",
        he: "דוחות למשקיעים",
      },
      body: {
        en: "The 'Generate investor report' toggle switches to a redacted view: full detail for one named investor, all others shown as aggregated 'Other investors'. Download a personalised PDF per investor from the ↓ PDF link in their row — the report includes their specific cash flows, MOIC, and IRR.",
        el: "Το 'Generate investor report' εμφανίζει πλήρη ανάλυση για έναν επενδυτή και συγκεντρωτικά τους υπόλοιπους. Κατεβάστε PDF ανά επενδυτή από τον σύνδεσμο ↓ PDF.",
        he: "ה-toggle 'Generate investor report' מציג פירוט מלא למשקיע אחד וסיכום לשאר. הורידו PDF מותאם אישית דרך קישור ↓ PDF.",
      },
    },
  ],
};

// ── Returns ─────────────────────────────────────────────────
export const RETURNS_TOUR: TourConfig = {
  storageKey: "villaLev.returnsTour.seen.v1",
  steps: [
    {
      title: {
        en: "Returns Analysis",
        el: "Returns Analysis",
        he: "Returns Analysis",
      },
      body: {
        en: "Sponsor-side economics at the active exit year and financing path. This page shows how your equity investment compounds — from annual yield through to full IRR at exit. Two exit methods are compared side-by-side: hotel sale (EBITDA × multiple) and property sale (built surface × €/m²).",
        el: "Sponsor-side economics at the active exit year and financing path. This page shows how your equity investment compounds — from annual yield through to full IRR at exit. Two exit methods are compared side-by-side: hotel sale (EBITDA × multiple) and property sale (built surface × €/m²).",
        he: "Sponsor-side economics at the active exit year and financing path. This page shows how your equity investment compounds — from annual yield through to full IRR at exit. Two exit methods are compared side-by-side: hotel sale (EBITDA × multiple) and property sale (built surface × €/m²).",
      },
    },
    {
      target: "#returns-exit-valuations",
      title: {
        en: "Two exit valuation methods",
        el: "Two exit valuation methods",
        he: "Two exit valuation methods",
      },
      body: {
        en: "Hotel sale: EBITDA at the active exit year multiplied by the EBITDA multiple set in the control bar. Property sale: total built surface valued at €/m² (set in the control bar Adjust popover). The preferred exit is whichever yields the higher net equity value after repaying the loan.",
        el: "Hotel sale: EBITDA at the active exit year multiplied by the EBITDA multiple set in the control bar. Property sale: total built surface valued at €/m² (set in the control bar Adjust popover). The preferred exit is whichever yields the higher net equity value after repaying the loan.",
        he: "Hotel sale: EBITDA at the active exit year multiplied by the EBITDA multiple set in the control bar. Property sale: total built surface valued at €/m² (set in the control bar Adjust popover). The preferred exit is whichever yields the higher net equity value after repaying the loan.",
      },
    },
    {
      target: "#returns-kpi-grid",
      title: {
        en: "Equity KPI cards",
        el: "Equity KPI cards",
        he: "Equity KPI cards",
      },
      body: {
        en: "Six cards: annual equity yield (NCF / equity at the stabilised year), operating yield multiple (cumulative cash-on-cash), Total MOIC (including terminal value), payback period, levered Equity IRR, and unlevered Project IRR. All update live when you switch path or scenario.",
        el: "Six cards: annual equity yield (NCF / equity at the stabilised year), operating yield multiple (cumulative cash-on-cash), Total MOIC (including terminal value), payback period, levered Equity IRR, and unlevered Project IRR. All update live when you switch path or scenario.",
        he: "Six cards: annual equity yield (NCF / equity at the stabilised year), operating yield multiple (cumulative cash-on-cash), Total MOIC (including terminal value), payback period, levered Equity IRR, and unlevered Project IRR. All update live when you switch path or scenario.",
      },
    },
    {
      title: {
        en: "Exit year and multiple",
        el: "Exit year and multiple",
        he: "Exit year and multiple",
      },
      body: {
        en: "The exit year and EBITDA multiple are set in the control bar at the top of every admin page. Changing them instantly re-prices both exit paths and all IRR figures on this page. Use the Adjust popover to also change the €/m² property valuation.",
        el: "The exit year and EBITDA multiple are set in the control bar at the top of every admin page. Changing them instantly re-prices both exit paths and all IRR figures on this page. Use the Adjust popover to also change the €/m² property valuation.",
        he: "The exit year and EBITDA multiple are set in the control bar at the top of every admin page. Changing them instantly re-prices both exit paths and all IRR figures on this page. Use the Adjust popover to also change the €/m² property valuation.",
      },
    },
    {
      title: {
        en: "Stress-test these numbers",
        el: "Stress-test these numbers",
        he: "Stress-test these numbers",
      },
      body: {
        en: "Returns respond to every assumption in the model. To stress-test ADR, occupancy, interest rate, and working capital simultaneously, head to the Sensitivity page — it isolates each driver one at a time and shows how DSCR and IRR move.",
        el: "Returns respond to every assumption in the model. To stress-test ADR, occupancy, interest rate, and working capital simultaneously, head to the Sensitivity page — it isolates each driver one at a time and shows how DSCR and IRR move.",
        he: "Returns respond to every assumption in the model. To stress-test ADR, occupancy, interest rate, and working capital simultaneously, head to the Sensitivity page — it isolates each driver one at a time and shows how DSCR and IRR move.",
      },
    },
  ],
};

// ── Debt Coverage ────────────────────────────────────────────
export const DEBT_COVERAGE_TOUR: TourConfig = {
  storageKey: "villaLev.debtCoverageTour.seen.v1",
  steps: [
    {
      title: {
        en: "Debt Coverage — the lender's underwriting lens",
        el: "Debt Coverage — the lender's underwriting lens",
        he: "Debt Coverage — the lender's underwriting lens",
      },
      body: {
        en: "This page shows every metric a credit committee uses to underwrite repayment capacity: DSCR trajectory, coverage ratios (ICR, LLCR, PLCR), working capital behaviour, and collateral position. All numbers respond to the active path and scenario in the control bar.",
        el: "This page shows every metric a credit committee uses to underwrite repayment capacity: DSCR trajectory, coverage ratios (ICR, LLCR, PLCR), working capital behaviour, and collateral position. All numbers respond to the active path and scenario in the control bar.",
        he: "This page shows every metric a credit committee uses to underwrite repayment capacity: DSCR trajectory, coverage ratios (ICR, LLCR, PLCR), working capital behaviour, and collateral position. All numbers respond to the active path and scenario in the control bar.",
      },
    },
    {
      target: "#section-dscr-hero",
      title: {
        en: "DSCR trajectory",
        el: "DSCR trajectory",
        he: "DSCR trajectory",
      },
      body: {
        en: "Year-by-year DSCR across all financing paths and the downside scenario. The covenant line at 1.25× is the bank's hard floor; the comfort line at 1.50× is the preferred operating band. 2028 is the grace period end; 2029 is the first full amortisation year. Look for the minimum DSCR year — that's what the bank sizes to.",
        el: "Year-by-year DSCR across all financing paths and the downside scenario. The covenant line at 1.25× is the bank's hard floor; the comfort line at 1.50× is the preferred operating band. 2028 is the grace period end; 2029 is the first full amortisation year.",
        he: "Year-by-year DSCR across all financing paths and the downside scenario. The covenant line at 1.25× is the bank's hard floor; the comfort line at 1.50× is the preferred operating band. 2028 is the grace period end; 2029 is the first full amortisation year.",
      },
    },
    {
      target: "#section-coverage-ratios",
      title: {
        en: "Coverage ratios panel",
        el: "Coverage ratios panel",
        he: "Coverage ratios panel",
      },
      body: {
        en: "Four ratios a credit committee checks: ICR (EBITDA ÷ interest only — simplest solvency test), LLCR (NPV of CFADS over the loan life ÷ loan balance — the lender's preferred summary metric), PLCR (same but full project life), and covenant headroom (how far above 1.25× the post-ramp DSCR sits).",
        el: "Four ratios a credit committee checks: ICR (EBITDA ÷ interest only — simplest solvency test), LLCR (NPV of CFADS over the loan life ÷ loan balance — the lender's preferred summary metric), PLCR (same but full project life), and covenant headroom.",
        he: "Four ratios a credit committee checks: ICR (EBITDA ÷ interest only — simplest solvency test), LLCR (NPV of CFADS over the loan life ÷ loan balance — the lender's preferred summary metric), PLCR (same but full project life), and covenant headroom.",
      },
    },
    {
      target: "#section-collateral",
      title: {
        en: "Collateral and LTV",
        el: "Collateral and LTV",
        he: "Collateral and LTV",
      },
      body: {
        en: "Asset coverage at three valuation tiers: Stress (conservative, €7,000/m²), Market (base, €9,000/m²), and Positive (premium). LTV and coverage ratio shown for each. Banks underwrite to the Stress tier — the deal remains well-covered even there. LTV at completion is the key covenant tested at drawdown.",
        el: "Asset coverage at three valuation tiers: Stress (conservative, €7,000/m²), Market (base, €9,000/m²), and Positive (premium). LTV and coverage ratio shown for each. Banks underwrite to the Stress tier.",
        he: "Asset coverage at three valuation tiers: Stress (conservative, €7,000/m²), Market (base, €9,000/m²), and Positive (premium). LTV and coverage ratio shown for each. Banks underwrite to the Stress tier.",
      },
    },
    {
      title: {
        en: "How path switching shifts DSCR",
        el: "How path switching shifts DSCR",
        he: "How path switching shifts DSCR",
      },
      body: {
        en: "Each financing path (Commercial, RRF, Grant, TEPIX) has a different loan size, rate, and debt service profile — so every path traces a different DSCR line on the chart above. Switch paths in the control bar to compare. TEPIX III has the lowest annual DS because 40% of its loan is interest-free (HDB tranche).",
        el: "Each financing path has a different loan size, rate, and debt service profile — so every path traces a different DSCR line. Switch paths in the control bar to compare. TEPIX III has the lowest annual DS because 40% is interest-free.",
        he: "Each financing path has a different loan size, rate, and debt service profile — so every path traces a different DSCR line. Switch paths in the control bar to compare. TEPIX III has the lowest annual DS because 40% is interest-free.",
      },
    },
  ],
};

// ── Financing ────────────────────────────────────────────────
export const FINANCING_TOUR: TourConfig = {
  storageKey: "villaLev.financingTour.seen.v1",
  steps: [
    {
      title: {
        en: "Four structures for the same project",
        el: "Four structures for the same project",
        he: "Four structures for the same project",
      },
      body: {
        en: "This page documents all four financing paths available for the Villa Lev Group expansion: Commercial Loan, RRF Co-Financing, Greek Development Law Grant, and TEPIX III. Each produces a different loan size, rate, annual debt service, and DSCR — all shown side-by-side so you can compare at a glance.",
        el: "This page documents all four financing paths available for the Villa Lev Group expansion: Commercial Loan, RRF Co-Financing, Greek Development Law Grant, and TEPIX III. Each produces a different loan size, rate, annual debt service, and DSCR.",
        he: "This page documents all four financing paths available for the Villa Lev Group expansion: Commercial Loan, RRF Co-Financing, Greek Development Law Grant, and TEPIX III. Each produces a different loan size, rate, annual debt service, and DSCR.",
      },
    },
    {
      target: "#section-termsheet-financing",
      title: {
        en: "Active path term sheet",
        el: "Active path term sheet",
        he: "Active path term sheet",
      },
      body: {
        en: "The term sheet strip at the top shows the active path's key deal terms: loan amount, loan term × grace period, interest rate, annual debt service, DSCR covenant status (pass/fail), and equity required. Every cell reacts to the path you select in the control bar.",
        el: "The term sheet strip shows the active path's key deal terms: loan amount, loan term × grace period, interest rate, annual debt service, DSCR covenant status, and equity required. Every cell reacts to the path you select.",
        he: "The term sheet strip shows the active path's key deal terms: loan amount, loan term × grace period, interest rate, annual debt service, DSCR covenant status, and equity required. Every cell reacts to the path you select.",
      },
    },
    {
      target: "#section-financing-comparison",
      title: {
        en: "All four paths compared",
        el: "All four paths compared",
        he: "All four paths compared",
      },
      body: {
        en: "The comparison table shows all four paths side-by-side: loan amount, equity required, annual debt service, stabilised DSCR, LTV, and equity IRR. The active path column is highlighted. This is the table to share with a credit committee when presenting financing optionality.",
        el: "The comparison table shows all four paths side-by-side. The active path column is highlighted. This is the table to share with a credit committee when presenting financing optionality.",
        he: "The comparison table shows all four paths side-by-side. The active path column is highlighted. This is the table to share with a credit committee when presenting financing optionality.",
      },
    },
    {
      title: {
        en: "Switch paths via the control bar",
        el: "Switch paths via the control bar",
        he: "Switch paths via the control bar",
      },
      body: {
        en: "Use the path pills in the control bar at the top of the page to switch the active path. The term sheet and all metrics update instantly. The comparison table always shows all four paths regardless of which is active — the highlight column moves to show the current selection.",
        el: "Use the path pills in the control bar to switch the active path. The term sheet and all metrics update instantly. The comparison table always shows all four paths.",
        he: "Use the path pills in the control bar to switch the active path. The term sheet and all metrics update instantly. The comparison table always shows all four paths.",
      },
    },
    {
      title: {
        en: "TEPIX III specifics",
        el: "TEPIX III specifics",
        he: "TEPIX III specifics",
      },
      body: {
        en: "TEPIX III is a Greek state-backed loan fund (4th cycle, open April 2026). It splits the loan into two tranches: 40% via HDB (interest-free, zero cost) + 60% via the commercial bank at market rate. This hybrid cuts annual debt service significantly vs. a pure commercial loan — improving DSCR by 0.2–0.4× at stabilisation.",
        el: "TEPIX III is a Greek state-backed loan fund (4th cycle, open April 2026). It splits the loan: 40% via HDB (interest-free) + 60% via the commercial bank. This hybrid cuts annual debt service significantly.",
        he: "TEPIX III is a Greek state-backed loan fund (4th cycle, open April 2026). It splits the loan: 40% via HDB (interest-free) + 60% via the commercial bank. This hybrid cuts annual debt service significantly.",
      },
    },
  ],
};

// ── Lexicon ──────────────────────────────────────────────────
export const LEXICON_TOUR: TourConfig = {
  storageKey: "villaLev.lexiconTour.seen.v1",
  steps: [
    {
      title: {
        en: "Lexicon — the formula dictionary",
        el: "Λεξικό — λεξικό τύπων",
        he: "מילון — מילון הנוסחאות",
      },
      body: {
        en: "Every metric in this model has an exact mathematical definition. This page documents them — CAPEX build-up, revenue drivers, EBITDA, PMT, DSCR, break-even methods, collateral tiers, and all four financing paths. If a number somewhere looks wrong, the formula here is the source of truth.",
        el: "Κάθε μετρική έχει ακριβή μαθηματικό ορισμό. Αυτή η σελίδα τους τεκμηριώνει — CAPEX, έσοδα, EBITDA, PMT, DSCR, break-even, εξασφαλίσεις και διαδρομές χρηματοδότησης.",
        he: "לכל מדד הגדרה מתמטית מדויקת. דף זה מתעד אותן — CAPEX, הכנסות, EBITDA, PMT, DSCR, break-even, בטחונות ומסלולי מימון.",
      },
    },
    {
      target: "#lexicon-quicknav",
      title: {
        en: "Quick navigation",
        el: "Γρήγορη πλοήγηση",
        he: "ניווט מהיר",
      },
      body: {
        en: "Each pill jumps directly to that formula section and auto-expands the accordion. Use 'Expand all' to open every section at once for a full-page scan. All sections are collapsible — click the heading to toggle.",
        el: "Κάθε pill μεταφέρει απευθείας στην ενότητα και ανοίγει το accordion. 'Expand all' ανοίγει τα πάντα. Κλικ στον τίτλο για εναλλαγή.",
        he: "כל כדור קופץ ישירות לסעיף ופותח האקורדיון. 'הרחב הכל' פותח הכל. לחצו על כותרת להחלפה.",
      },
    },
  ],
};
