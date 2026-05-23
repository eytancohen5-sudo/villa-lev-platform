import type { TourConfig } from "./types";

// ── Dashboard ───────────────────────────────────────────────
// Refreshed 2026-05-22 — reflects RBAC + impersonation + bank view + OpCo
// subordination + the new section order (Term sheet first, Conservatism
// Check after Returns) + the 14-sheet Excel export + new sections (founder
// waterfall, OpCo / PropCo on the sidebar). Steps that referenced
// pre-shipped UI have been dropped.
export const DASHBOARD_TOUR: TourConfig = {
  storageKey: "villaLev.dashboardTour.seen.v2",
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
        en: "This dashboard is the admin's home — the same numbers a banker sees on /bank, plus the levers and proof-of-conservatism that drive them. I'll walk you through what to look at, in the order a credit committee actually reads.",
        el: "Ο πίνακας αυτός είναι το home του admin — τα ίδια νούμερα που βλέπει ένας τραπεζίτης στο /bank, μαζί με τους μοχλούς και την απόδειξη συντηρητικότητας πίσω τους. Θα σας ξεναγήσω με τη σειρά που διαβάζει πραγματικά μια πιστωτική επιτροπή.",
        fr: "Ce tableau de bord est l'écran d'accueil de l'admin — les mêmes chiffres que voit un banquier sur /bank, plus les leviers et les preuves de conservatisme qui les sous-tendent. Je vous guide dans l'ordre dans lequel un comité de crédit lit réellement.",
        he: "לוח המחוונים הוא הבית של ה-admin — אותם מספרים שבנקאי רואה ב-/bank, פלוס המנופים והוכחת השמרנות שמאחוריהם. אעבור אתכם בסדר שבו ועדת אשראי באמת קוראת.",
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
        en: "Pinned to the top: switch financing path (Commercial / RRF / Grant / TEPIX), scenario (Realistic / Upside / Downside / Break-Even), exit year × EBITDA multiple, and tune rate + loan coverage via the Adjust popover. The View-As control in the sidebar lets you preview the model as an editor, viewer, or banker. Bank-View toggle pins OpCo-subordinated cash flows so what you see equals what's on /bank.",
        el: "Καρφιτσωμένη στην κορυφή: αλλάξτε διαδρομή χρηματοδότησης, σενάριο, έτος εξόδου × πολλαπλάσιο EBITDA, και ρυθμίστε επιτόκιο + κάλυψη μέσω του popover Adjust. Το View-As στο sidebar δείχνει την προβολή ως editor / viewer / banker. Το Bank-View καρφιτσώνει OpCo-subordinated ταμειακές ροές ώστε το /admin να συμπίπτει με το /bank.",
        fr: "Épinglée en haut : changer la voie de financement, le scénario, l'année de sortie × multiple EBITDA, et ajuster taux + couverture via le popover Adjust. Le View-As de la barre latérale permet de prévisualiser le modèle en tant qu'éditeur / lecteur / banquier. Bank-View épingle les flux subordonnés OpCo pour que /admin reflète /bank.",
        he: "מוצמד למעלה: החליפו מסלול מימון, תרחיש, שנת יציאה × כפולת EBITDA, וכווננו ריבית + כיסוי בפופאובר Adjust. ה-View-As בסרגל הצדדי מציג את המודל כ-editor / viewer / banker. ה-Bank-View נועל זרימות מזומנים בכפיפות OpCo כך ש-/admin תואם ל-/bank.",
      },
    },
    {
      target: "#section-termsheet",
      title: {
        en: "Term sheet at a glance",
        el: "Term sheet με μια ματιά",
        fr: "Term sheet en un coup d'œil",
        he: "Term sheet במבט מהיר",
      },
      body: {
        en: "Loan, term × grace, rate, annual DS, DSCR covenant + pass/fail, and equity required. The first six cells a credit committee scans. Every cell reacts to the path / scenario you picked above.",
        el: "Δάνειο, διάρκεια × χάριτος, επιτόκιο, ετήσια εξυπηρέτηση, covenant DSCR + pass/fail, και απαιτούμενα ίδια κεφάλαια. Τα έξι πρώτα κελιά που σκανάρει μια πιστωτική επιτροπή.",
        fr: "Prêt, durée × grâce, taux, DS annuel, covenant DSCR + pass/fail, et fonds propres requis. Les six premières cases que scanne un comité de crédit.",
        he: "הלוואה, תקופה × חסד, ריבית, DS שנתי, קובננט DSCR + pass/fail, והון נדרש. שישה התאים הראשונים שוועדת אשראי סורקת.",
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
        en: "Headline figures — total CapEx, loan, equity, annual debt service, the active financing path (with grant amount in green when applicable), and the stabilised DSCR.",
        el: "Κύρια νούμερα — σύνολο CapEx, δάνειο, ίδια κεφάλαια, ετήσια εξυπηρέτηση, ενεργή διαδρομή χρηματοδότησης, σταθεροποιημένο DSCR.",
        fr: "Chiffres clés — CapEx total, prêt, fonds propres, DS annuel, voie de financement active, DSCR stabilisé.",
        he: "נתונים עיקריים — סך CapEx, הלוואה, הון, DS שנתי, מסלול מימון פעיל, DSCR מיוצב.",
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
        en: "Year-by-year DSCR across financing paths and the downside scenario, with covenant lines at 1.25× and 1.50×. The annotation shows minimum DSCR over loan life and total grace-period interest.",
        el: "Ετήσιο DSCR ανά διαδρομή και downside σενάριο, με γραμμές covenant 1.25× / 1.50×. Πάνω αναγράφεται ελάχιστο DSCR και σύνολο τόκων χάριτος.",
        fr: "DSCR année par année par voie et scénario adverse, avec covenants 1.25× / 1.50×. L'annotation indique DSCR minimum et intérêts de grâce.",
        he: "DSCR שנתי לפי מסלולים ותרחיש שלילי, עם קווי קובננט 1.25× / 1.50×. הסימון מציג DSCR מינימום וריבית תקופת חסד.",
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
        en: "What credit committees underwrite against: min DSCR over loan life, ICR (interest coverage), LLCR (loan-life), PLCR (project-life), and headroom against the 1.25× covenant.",
        el: "Τι ελέγχουν οι πιστωτικές επιτροπές: ελάχιστο DSCR, ICR, LLCR, PLCR, και περιθώριο covenant 1.25×.",
        fr: "Ce que les comités examinent : DSCR minimum, ICR, LLCR, PLCR, marge vs covenant 1.25×.",
        he: "מה שוועדות אשראי בוחנות: DSCR מינימום, ICR, LLCR, PLCR, מרווח מול קובננט 1.25×.",
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
        en: "Sponsor side: equity yield at stabilised year, cumulative yield + Total MOIC (with terminal value), equity payback, levered Equity IRR, unlevered Project IRR — using the active exit year × EBITDA multiple.",
        el: "Πλευρά επενδυτή: απόδοση ιδίων κεφαλαίων στο σταθεροποιημένο έτος, σωρευτική απόδοση + Total MOIC (με τερματική αξία), έτη αποπληρωμής, IRR ιδίων κεφαλαίων, IRR έργου — με βάση το ενεργό έτος εξόδου × πολλαπλάσιο EBITDA.",
        fr: "Côté sponsor : rendement fonds propres en année stabilisée, rendement cumulé + MOIC total (avec valeur terminale), payback, TRI fonds propres, TRI projet — selon l'année de sortie × multiple EBITDA actifs.",
        he: "צד המשקיע: תשואת הון בשנה מיוצבת, תשואה מצטברת + MOIC כולל (עם ערך טרמינלי), החזר הון, IRR הון, IRR פרויקט — לפי שנת היציאה × כפולת EBITDA הפעילות.",
      },
    },
    {
      target: "#section-conservatism",
      title: {
        en: "Live Track Record",
        el: "Ζωντανό Track Record",
        fr: "Track record en direct",
        he: "Track Record חי",
      },
      body: {
        en: "This is what makes the deal credible: every per-villa BP assumption is at or below what the existing operating villa already delivers today. Live ADR, occupancy and YTD revenue come from the Antiparos ops dashboard via Firestore — the bank sees the same numbers on /bank.",
        el: "Αυτό κάνει τη συμφωνία πιστευτή: κάθε ανά-villa υπόθεση του BP είναι ίση ή χαμηλότερη από αυτό που ήδη πετυχαίνει σήμερα η ζωντανή villa. Ζωντανά ADR, πληρότητα και έσοδα έτους μέχρι σήμερα έρχονται από το ops dashboard της Αντιπάρου μέσω Firestore.",
        fr: "C'est ce qui rend l'opération crédible : chaque hypothèse par villa du BP est inférieure ou égale à ce que la villa en exploitation réalise déjà. ADR, occupation et CA YTD viennent en direct du tableau de bord ops d'Antiparos via Firestore.",
        he: "זה מה שהופך את העסקה לאמינה: כל הנחה בתוכנית העסקית לוילה שווה או נמוכה ממה שהוילה הפעילה כבר מספקת היום. ADR, תפוסה והכנסות YTD חיים מהפעלת אנטיפרוס דרך Firestore.",
      },
    },
    {
      target: "#section-founder",
      title: {
        en: "Founder waterfall",
        el: "Καταρράκτης ιδρυτή",
        fr: "Cascade fondateur",
        he: "מפל יזם",
      },
      body: {
        en: "Three layers: pari-passu (founder's equity in), grant bonus (10% gross fee net of consultant), performance ratchet (additional carry by MOIC tier). Investors' floor is protected at 25%; cap status shows when the founder's total has hit a binding limit.",
        el: "Τρία επίπεδα: pari-passu, bonus επιχορήγησης, performance ratchet (επιπλέον carry ανά MOIC tier). Το floor επενδυτών προστατεύεται στο 25%· το cap status δείχνει πότε έχει αγγίξει όριο.",
        fr: "Trois couches : pari-passu, bonus subvention, ratchet de performance (carry additionnel par tier MOIC). Le plancher investisseurs est protégé à 25% ; le cap status indique si une limite est active.",
        he: "שלוש שכבות: pari-passu, בונוס מענק, רצ'ט ביצועים (carry נוסף לפי שכבת MOIC). רצפת המשקיעים מוגנת ב-25%; ה-cap status מראה כשמגיעים לגבול.",
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
        en: "Grace-period interest burden during construction, net leverage (loan / EBITDA), peak debt outstanding (term loan + WC peak), stabilised ROIC, and terminal asset value.",
        el: "Τόκοι περιόδου χάριτος, καθαρή μόχλευση, μέγιστη οφειλή (δάνειο + αιχμή ΚΕΚ), σταθεροποιημένο ROIC, τερματική αξία ενεργητικού.",
        fr: "Intérêts de grâce, levier net, dette maximale (prêt + pic BFR), ROIC stabilisé, valeur terminale.",
        he: "ריבית תקופת חסד, מינוף נטו, שיא חוב (הלוואה + שיא הון חוזר), ROIC מיוצב, ערך טרמינלי.",
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
        en: "Year-by-year flow: Revenue → EBITDA → Debt Service → NCF post-tax → DSCR / DSCR-loaded / ICR → Yield to equity → Cumulative yield. The full 14-sheet Excel export is one click away in the page header — bankers can take the model offline.",
        el: "Ετήσια ροή: Έσοδα → EBITDA → Εξυπηρέτηση χρέους → NCF μετά φόρων → DSCR / loaded / ICR → Απόδοση κεφαλαίων → Σωρευτική απόδοση. Πλήρες Excel 14 φύλλων διαθέσιμο από την κεφαλίδα.",
        fr: "Flux annuel : Revenus → EBITDA → Service dette → FTN post-impôts → DSCR / loaded / ICR → Rendement → Rendement cumulé. Export Excel 14 onglets disponible dans l'en-tête.",
        he: "זרימה שנתית: הכנסות → EBITDA → שירות חוב → NCF לאחר מס → DSCR / loaded / ICR → תשואה → תשואה מצטברת. ייצוא Excel ב-14 גליונות זמין בכותרת.",
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
        fr: "Chronologie P&L",
        he: "ציר זמן P&L",
      },
      body: {
        en: "An 11-year operational projection (2026 → 2036) covering acquisition, construction, opening ramp, and stabilised operations. Every row reflects the active scenario AND the active financing path — switch them in the control bar to flex the entire table.",
        el: "Πρόβλεψη 11 ετών (2026-2036): απόκτηση, κατασκευή, ramp, σταθεροποίηση. Κάθε γραμμή αντικατοπτρίζει ενεργό σενάριο ΚΑΙ ενεργή διαδρομή.",
        fr: "Projection sur 11 ans (2026 → 2036) : acquisition, construction, montée en puissance, stabilisation. Chaque ligne reflète le scénario ET la voie de financement actifs.",
        he: "תחזית 11 שנים (2026-2036): רכישה, בנייה, ראמפ-אפ, ייצוב. כל שורה משקפת תרחיש פעיל ומסלול מימון פעיל.",
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
        en: "Header rows show project phase and the underlying nights driver per villa / suite. These drive every revenue line below. Grace period 2026-2028 is interest-only on the term loan; principal repayment kicks in 2029.",
        el: "Οι γραμμές κεφαλίδας δείχνουν τη φάση και τον οδηγό βραδιών ανά villa / suite. Η χάριτος 2026-2028 είναι μόνο τόκοι· κεφάλαιο από 2029.",
        fr: "Les en-têtes montrent la phase du projet et le moteur nuitées par villa / suite. Grâce 2026-2028 = intérêts seuls ; principal dès 2029.",
        he: "שורות הכותרת מציגות שלב פרויקט ומחולל לילות לכל וילה / חדר. תקופת חסד 2026-2028 ריבית בלבד; קרן מ-2029.",
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
        en: "Per-property revenue, events, ancillary services (capped/uncapped split visible), then OPEX, working-capital interest, and OpCo fees if the split is on. Total Revenue and EBITDA are bold section totals.",
        el: "Έσοδα ανά ακίνητο, εκδηλώσεις, βοηθητικές (capped/uncapped), OPEX, τόκοι ΚΕΚ και αμοιβές OpCo (αν ενεργοποιημένες). Total Revenue και EBITDA είναι σύνολα.",
        fr: "Revenus par propriété, événements, services annexes (capped/uncapped), OPEX, intérêts BFR et frais OpCo (si actifs). Total Revenus et EBITDA sont des totaux.",
        he: "הכנסות לפי נכס, אירועים, שירותים נלווים (capped/uncapped), OPEX, ריבית הון חוזר ועמלות OpCo (אם פעיל). סך הכנסות ו-EBITDA הם סיכומים.",
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
        en: "Below Debt Service: term loan interest, principal, and closing balance for each year. For TEPIX, you also see the HDB portion (interest-free) and the bank tranche separated.",
        el: "Κάτω από Εξυπηρέτηση Χρέους: τόκοι, κεφάλαιο, υπόλοιπο. Για TEPIX, εμφανίζεται ξεχωριστά η μερίδα ΕΑΤ (άτοκη) και η τραπεζική.",
        fr: "Sous Service dette : intérêts, principal, solde. Pour TEPIX, la part HDB (sans intérêts) et la tranche bancaire sont séparées.",
        he: "מתחת לשירות חוב: ריבית, קרן, יתרה. ל-TEPIX, חלק HDB (ללא ריבית) ומנת הבנק מוצגים בנפרד.",
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
        en: "DSCR (EBITDA ÷ debt service), DSCR-loaded (includes WC interest in the denominator — the stricter read), and ICR (EBITDA ÷ interest only). All three need to clear the bank's 1.25× covenant.",
        el: "DSCR, DSCR-loaded (συμπ. τόκων ΚΕΚ — αυστηρότερο), και ICR. Όλοι ξεπερνούν το covenant 1.25×.",
        fr: "DSCR, DSCR-loaded (avec intérêts BFR — lecture stricte), et ICR. Tous trois dépassent le covenant 1.25×.",
        he: "DSCR, DSCR-loaded (כולל ריבית הון חוזר — קריאה מחמירה), ו-ICR. שלושתם עוברים את הקובננט 1.25×.",
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
        en: "Annual yield = NCF post-tax / initial equity. Total yield (cumulative) is the running multiple returned. Final-year value is total cash-on-cash returned over 11 years (excluding terminal — see Total MOIC on the dashboard for that).",
        el: "Ετήσια απόδοση = NCF μετά φόρων / αρχικά ίδια κεφάλαια. Σωρευτική απόδοση = πολλαπλάσιο που επιστρέφεται. Η τιμή τελικού έτους είναι το συνολικό cash-on-cash για 11 χρόνια (εκτός terminal — δες Total MOIC στο dashboard).",
        fr: "Rendement annuel = FTN post-impôts / fonds propres initiaux. Rendement cumulé = multiple restitué. Valeur finale = cash-on-cash total sur 11 ans (hors terminal — voir MOIC total sur le dashboard).",
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
        fr: "Comparaison de scénarios",
        he: "השוואת תרחישים",
      },
      body: {
        en: "Four scenarios side-by-side at the stabilised year (2031): Realistic, Upside, Downside, and the Grant financing path. Use this view to argue stress-resilience to a credit committee — the headline DSCR + NCF survive Downside.",
        el: "Τέσσερα σενάρια στο σταθεροποιημένο έτος (2031): Realistic, Upside, Downside, διαδρομή Grant. Χρήσιμο για ανθεκτικότητα σε πιστωτική επιτροπή.",
        fr: "Quatre scénarios en année stabilisée (2031) : Realistic, Upside, Downside, voie Grant. Utile pour démontrer la résilience en comité de crédit.",
        he: "ארבעה תרחישים בשנה המיוצבת (2031): Realistic, Upside, Downside, מסלול Grant. שימושי להוכחת עמידות לוועדת אשראי.",
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
        en: "Revenue, OPEX, EBITDA, DSCR, NCF post-tax by scenario. Bold rows are the lines a banker checks first. Colour coding: gold = Realistic, green = Upside, red = Downside, blue = Grant.",
        el: "Έσοδα, OPEX, EBITDA, DSCR, NCF μετά φόρων ανά σενάριο. Έντονες γραμμές = πρώτος έλεγχος τραπεζίτη. Χρώματα: χρυσό = Realistic, πράσινο = Upside, κόκκινο = Downside, μπλε = Grant.",
        fr: "Revenus, OPEX, EBITDA, DSCR, FTN post-impôts par scénario. Lignes en gras = ce qu'un banquier vérifie en premier. Couleurs : or = Realistic, vert = Upside, rouge = Downside, bleu = Grant.",
        he: "הכנסות, OPEX, EBITDA, DSCR, NCF לאחר מס לפי תרחיש. שורות מודגשות = הבדיקה הראשונה של בנקאי. צבעים: זהב = Realistic, ירוק = Upside, אדום = Downside, כחול = Grant.",
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
        en: "Year-by-year DSCR per scenario / financing path. Green ≥ 1.25× (covenant), amber > 0 (sub-covenant), grey = pre-operations. Look for the worst single year — that's what banks size to.",
        el: "DSCR ανά έτος για κάθε σενάριο. Πράσινο ≥ 1.25×, πορτοκαλί υπό-covenant, γκρι προ-λειτουργίας.",
        fr: "DSCR par année par scénario. Vert ≥ 1.25×, ambre sous-covenant, gris pré-opérations.",
        he: "DSCR לפי שנה לכל תרחיש. ירוק ≥ 1.25×, כתום מתחת לקובננט, אפור טרום-תפעול.",
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
        en: "Portfolio value, LTV, asset coverage at three valuation tiers: Stress (conservative), Market (base), Positive. Banks underwrite to Stress; sponsor narrates with Market.",
        el: "Αξία χαρτοφυλακίου, LTV, κάλυψη ενεργητικού σε τρία επίπεδα: Stress, Market, Positive.",
        fr: "Valeur du portefeuille, LTV, couverture actifs à trois niveaux : Stress, Marché, Positif.",
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
        fr: "Analyse Break-Even",
        he: "ניתוח Break-Even",
      },
      body: {
        en: "How far can occupancy and ADR fall before debt service is at risk? This page tells the bank where the trip-wire is — and how far we sit above it today.",
        el: "Πόσο μπορεί να πέσει πληρότητα και ADR πριν κινδυνεύσει η εξυπηρέτηση χρέους;",
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
        en: "Break-even nights, buffer to break-even, and the implied occupancy / ADR cushion. Bigger numbers = more comfort. The buffer is the % revenue decline the deal absorbs before DSCR falls below 1.0×.",
        el: "Βραδιές break-even, περιθώριο, και cushion πληρότητας / ADR. Μεγαλύτερα νούμερα = περισσότερη άνεση.",
        fr: "Nuitées break-even, marge, coussin occupation / ADR. Plus grand = plus confortable.",
        he: "לילות break-even, מרווח, וכרית תפוסה / ADR. גדול יותר = יותר נוחות.",
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
        en: "Each cell is the DSCR at that occupancy × ADR combination. Green = above 1.25× covenant, amber = sub-covenant, red = breach. Trace the contour where DSCR crosses 1.25× — that's the bank's red line in 2-D.",
        el: "Κάθε κελί είναι το DSCR σε αυτόν τον συνδυασμό. Πράσινο > 1.25×, πορτοκαλί υπό-covenant, κόκκινο παραβίαση.",
        fr: "Chaque cellule = DSCR à cette combinaison. Vert > 1.25×, ambre sous-covenant, rouge brèche.",
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
        fr: "Analyse CAPEX",
        he: "פירוק CAPEX",
      },
      body: {
        en: "Total project cost decomposed by category and by property — land, construction, FF&E, fees, contingency, and acquisition legal. Click any blue value to edit; the whole model recomputes.",
        el: "Συνολικό κόστος ανά κατηγορία και ακίνητο — γη, κατασκευή, FF&E, αμοιβές, contingency, νομικά. Πατήστε σε μπλε τιμή για επεξεργασία· όλο το μοντέλο ξανα-υπολογίζεται.",
        fr: "Coût total par catégorie et par propriété — terrain, construction, FF&E, honoraires, aléas, juridique. Cliquez sur une valeur bleue pour éditer ; le modèle se recalcule.",
        he: "עלות הפרויקט לפי קטגוריה ונכס — קרקע, בנייה, FF&E, אגרות, contingency, משפטיים. לחיצה על ערך כחול לעריכה; כל המודל מחושב מחדש.",
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
        el: "Κάθε γραμμή είναι μία κατηγορία με κόστος ανά μονάδα και σύνολο. Γη + κατασκευή κυριαρχούν.",
        fr: "Chaque ligne est une catégorie avec coût par unité et total. Terrain + construction dominent.",
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
        fr: "Analyse de sensibilité",
        he: "ניתוח רגישות",
      },
      body: {
        en: "How much do DSCR and NCF move when you flex one assumption at a time? Each chart isolates a single driver — interest rate, occupancy, ADR, working-capital facility size.",
        el: "Πόσο κινούνται DSCR και NCF όταν αλλάζετε μία υπόθεση τη φορά;",
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
        en: "DSCR vs interest rate. Slope tells you how fragile coverage is to rate hikes — flatter is safer. Useful for stressing against ECB hiking cycles.",
        el: "DSCR vs επιτόκιο. Η κλίση δείχνει την ευθραυστότητα σε αυξήσεις επιτοκίου.",
        fr: "DSCR vs taux. La pente montre la fragilité aux hausses de taux.",
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
        en: "DSCR / NCF vs occupancy. Where does the line cross 1.25×? That's your operational red line — and the Live Track Record on the dashboard shows where the existing villa already sits in this curve.",
        el: "DSCR / NCF vs πληρότητα. Πού τέμνει το 1.25×;",
        fr: "DSCR / FTN vs occupation. Où la ligne croise-t-elle 1.25× ?",
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
        fr: "Séparation OpCo / PropCo",
        he: "פיצול OpCo / PropCo",
      },
      body: {
        en: "Two legal entities: PropCo holds the real estate and the bank loan; OpCo manages day-to-day operations and earns three fee streams in exchange. The toggle in the top-right enables the structure across the whole model — everything you see below reacts.",
        el: "Δύο νομικές οντότητες: PropCo κατέχει το real estate και το δάνειο· OpCo διαχειρίζεται και χρεώνει τρία streams αμοιβών. Το toggle στα πάνω δεξιά ενεργοποιεί τη δομή σε όλο το μοντέλο.",
        fr: "Deux entités juridiques : PropCo détient l'immobilier et le prêt ; OpCo gère et facture trois flux d'honoraires. Le toggle en haut à droite active la structure dans tout le modèle.",
        he: "שתי ישויות משפטיות: PropCo מחזיקה בנדל\"ן ובהלוואה; OpCo מנהלת וגובה שלושה זרמי עמלות. ה-toggle בפינה הימנית העליונה מפעיל את המבנה בכל המודל.",
      },
    },
    {
      title: {
        en: "Why the split matters to a banker",
        el: "Γιατί ενδιαφέρει τον τραπεζίτη",
        fr: "Pourquoi cela compte pour le banquier",
        he: "למה זה חשוב לבנקאי",
      },
      body: {
        en: "OpCo fees are subordinated to debt service. PropCo pays the loan FIRST, then pays OpCo whatever's left. This means DSCR on /bank reflects cash flow before founder compensation — the bank gets paid before the operator. Bank View toggle and /bank page pin this view.",
        el: "Οι αμοιβές OpCo είναι κατώτερες της εξυπηρέτησης χρέους. Η PropCo πληρώνει ΠΡΩΤΑ το δάνειο, μετά την OpCo. Το DSCR στο /bank αντικατοπτρίζει ταμειακή ροή ΠΡΙΝ την αμοιβή ιδρυτή.",
        fr: "Les frais OpCo sont subordonnés au service de la dette. PropCo paie d'ABORD le prêt, puis OpCo. Le DSCR sur /bank reflète le cash flow AVANT compensation du fondateur.",
        he: "עמלות OpCo כפופות לשירות החוב. PropCo משלמת קודם את ההלוואה, אחר כך את OpCo. ה-DSCR ב-/bank משקף תזרים לפני שכר היזם.",
      },
    },
    {
      title: {
        en: "The three fee streams",
        el: "Τα τρία streams αμοιβών",
        fr: "Les trois flux d'honoraires",
        he: "שלושת זרמי העמלות",
      },
      body: {
        en: "1) Base fee — % of total revenue (covers OpCo overhead). 2) Brand / marketing fee — % of room revenue (covers brand + acquisition). 3) Incentive fee — % of GOP above the owner's priority return on equity. The table below shows the live stabilised values for the active scenario.",
        el: "1) Base fee — % συνολικών εσόδων. 2) Brand / marketing fee — % εσόδων δωματίων. 3) Incentive fee — % GOP πάνω από το priority return ιδιοκτήτη.",
        fr: "1) Base fee — % du revenu total. 2) Brand / marketing — % revenu chambre. 3) Incentive — % du GOP au-dessus du priority return du propriétaire.",
        he: "1) Base fee — % מסך ההכנסות. 2) Brand / marketing — % הכנסות חדרים. 3) Incentive — % מ-GOP מעל priority return של הבעלים.",
      },
    },
    {
      title: {
        en: "The enablement flag",
        el: "Η σημαία ενεργοποίησης",
        fr: "L'indicateur d'activation",
        he: "דגל ההפעלה",
      },
      body: {
        en: "The Split ON/OFF toggle in the page header is sticky across all pages. When ON, every metric on Dashboard / P&L / Scenarios reflects PropCo's post-fee cash flow. The /bank route pins it ON regardless — bankers always see the subordinated view.",
        el: "Το toggle Split ON/OFF διατηρείται σε όλες τις σελίδες. Όταν ON, κάθε μετρική σε Dashboard / P&L / Scenarios αντικατοπτρίζει ταμειακή ροή PropCo μετά αμοιβές. Το /bank είναι πάντα ON.",
        fr: "Le toggle Split ON/OFF persiste sur toutes les pages. Activé, chaque indicateur sur Dashboard / P&L / Scénarios reflète le cash post-frais de PropCo. La route /bank le force toujours sur ON.",
        he: "ה-toggle Split ON/OFF נשמר בכל הדפים. כאשר ON, כל מדד ב-Dashboard / P&L / Scenarios משקף תזרים PropCo לאחר עמלות. /bank תמיד ON.",
      },
    },
    {
      title: {
        en: "IRR cost of split",
        el: "Κόστος IRR διαχωρισμού",
        fr: "Coût IRR du split",
        he: "עלות IRR של הפיצול",
      },
      body: {
        en: "The headline KPI below quantifies the trade-off: pre-split (owner takes 100% of GOP) vs post-split (owner = PropCo, after OpCo fees). The delta is what the founder gives up in PropCo equity IRR in exchange for the OpCo cash flow on top.",
        el: "Το KPI κάτω ποσοτικοποιεί την αντισταθμιστική σχέση: pre-split vs post-split. Το delta είναι ό,τι ο ιδρυτής παραιτείται σε IRR ιδίων κεφαλαίων PropCo.",
        fr: "Le KPI ci-dessous quantifie le compromis : pre-split vs post-split. Le delta est ce que le fondateur cède en TRI fonds propres PropCo.",
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
        fr: "Équipe & contrôle d'accès",
        he: "צוות ובקרת גישה",
      },
      body: {
        en: "This page is the admin's home for who can see the model and what they can do. Two tools: send invites (top form) and review who has already claimed an invite (bottom list).",
        el: "Η σελίδα αυτή είναι το home του admin για το ποιος βλέπει το μοντέλο και τι μπορεί να κάνει. Δύο εργαλεία: αποστολή invites και λίστα όσων έχουν εγγραφεί.",
        fr: "Cette page est le hub admin pour gérer qui voit le modèle et ce qu'ils peuvent faire. Deux outils : envoyer des invitations et lister les comptes existants.",
        he: "דף זה הוא הבית של ה-admin עבור מי רואה את המודל ומה הוא יכול לעשות. שני כלים: שליחת הזמנות ורשימת המשתמשים הקיימים.",
      },
    },
    {
      target: "#invite-email",
      title: {
        en: "Send an invite",
        el: "Αποστολή πρόσκλησης",
        fr: "Envoyer une invitation",
        he: "שליחת הזמנה",
      },
      body: {
        en: "Type the email, pick a role, optionally add a note (e.g. \"banker at NBG\"). The invite is written to Firestore at invites/{email}; when that user signs in with Google for the first time the role is granted automatically.",
        el: "Πληκτρολογήστε email, επιλέξτε ρόλο, προσθέστε προαιρετικά σημείωση. Το invite γράφεται στο Firestore· όταν ο χρήστης συνδεθεί πρώτη φορά με Google, ο ρόλος αποδίδεται αυτόματα.",
        fr: "Saisissez l'email, choisissez un rôle, ajoutez optionnellement une note. L'invitation est écrite dans Firestore ; lors de la première connexion Google de l'utilisateur, le rôle est attribué automatiquement.",
        he: "הקלידו אימייל, בחרו תפקיד, הוסיפו הערה אופציונלית. ההזמנה נכתבת ל-Firestore; כשהמשתמש מתחבר לראשונה עם Google, התפקיד מוקצה אוטומטית.",
      },
    },
    {
      target: "#invite-role",
      title: {
        en: "Three roles",
        el: "Τρεις ρόλοι",
        fr: "Trois rôles",
        he: "שלושה תפקידים",
      },
      body: {
        en: "Admin — full access, including this page. Editor — can save/edit scenarios and tune assumptions but cannot manage the team. Viewer — read-only; the right choice for a banker who just needs to browse the model. Firestore rules enforce all three server-side.",
        el: "Admin — πλήρης πρόσβαση. Editor — μπορεί να αλλάξει σενάρια/παραδοχές αλλά όχι την ομάδα. Viewer — μόνο ανάγνωση· σωστή επιλογή για τραπεζίτη.",
        fr: "Admin — accès complet. Editor — peut éditer scénarios/hypothèses mais pas gérer l'équipe. Viewer — lecture seule ; idéal pour un banquier.",
        he: "Admin — גישה מלאה. Editor — יכול לערוך תרחישים/הנחות אך לא לנהל צוות. Viewer — קריאה בלבד; הבחירה הנכונה לבנקאי.",
      },
    },
    {
      title: {
        en: "Impersonation (View-As)",
        el: "Προσποίηση (View-As)",
        fr: "Usurpation (View-As)",
        he: "התחזות (View-As)",
      },
      body: {
        en: "From any page, the View-As dropdown in the sidebar lets an admin preview the model as an editor, viewer, or banker — so you can verify what each role sees BEFORE you send the invite. Impersonation as a banker takes you to the bank-facing view.",
        el: "Από οποιαδήποτε σελίδα, το View-As στο sidebar δείχνει την προβολή ως editor / viewer / banker — επιβεβαιώνετε τι βλέπει κάθε ρόλος ΠΡΙΝ στείλετε το invite.",
        fr: "Depuis n'importe quelle page, le View-As de la barre latérale permet de prévisualiser le modèle en tant qu'éditeur / lecteur / banquier — vérifiez avant d'envoyer l'invitation.",
        he: "מכל דף, ה-View-As בסרגל הצדדי מאפשר לראות את המודל כ-editor / viewer / banker — אמתו לפני שליחת ההזמנה.",
      },
    },
  ],
};

// ── Bank ────────────────────────────────────────────────────
// Different audience from the admin tours. Less hand-holding on UX, more
// "here's why these numbers are credible." Short — bankers won't sit
// through 15 steps.
// v2 2026-05-23: added spotlight anchors for KPI strip, financing table,
// collateral, stress test, and P&L sections.
export const BANK_TOUR: TourConfig = {
  storageKey: "villaLev.bankTour.seen.v2",
  showLanguagePicker: true,
  steps: [
    {
      title: {
        en: "Villa Lev Group — bank review",
        el: "Villa Lev Group — προβολή τράπεζας",
        fr: "Villa Lev Group — vue banque",
        he: "Villa Lev Group — מצב בנקאי",
      },
      body: {
        en: "This is the live financial model for the Villa Lev Group multi-villa expansion in Antiparos, Greece. Three plots, two villas + one boutique suites property, financed against an existing operating villa with a four-year track record. Tour takes ~90 seconds.",
        el: "Αυτό είναι το ζωντανό χρηματοοικονομικό μοντέλο για την επέκταση Villa Lev Group στην Αντίπαρο. Τρία οικόπεδα, δύο villas + ένα boutique suites property, χρηματοδοτούμενα έναντι ενός λειτουργικού villa με τετραετές track record.",
        fr: "Voici le modèle financier en direct pour l'expansion Villa Lev Group à Antiparos, Grèce. Trois parcelles, deux villas + un ensemble de suites, financés contre une villa déjà en exploitation avec quatre ans de track record.",
        he: "זה המודל הפיננסי החי של הרחבת Villa Lev Group באנטיפרוס, יוון. שלושה מגרשים, שתי וילות + נכס סוויטות בוטיק, ממומנים מול וילה פעילה עם track record של ארבע שנים.",
      },
    },
    {
      target: "#live-track-record",
      title: {
        en: "These aren't projections",
        el: "Αυτά δεν είναι προβλέψεις",
        fr: "Ce ne sont pas des projections",
        he: "אלו לא תחזיות",
      },
      body: {
        en: "The numbers above are the current operating villa's live performance — ADR, occupancy, YTD revenue — pulled from the PMS dashboard via Firestore. Every per-villa assumption in the model below is at or below what this single live villa already delivers today. The model is a floor, not a forecast.",
        el: "Τα νούμερα παραπάνω είναι η ζωντανή απόδοση του λειτουργικού villa — ADR, πληρότητα, έσοδα έτους — από το PMS μέσω Firestore. Κάθε ανά-villa υπόθεση είναι ίση ή μικρότερη από αυτό που ήδη πετυχαίνει σήμερα. Το μοντέλο είναι floor, όχι forecast.",
        fr: "Les chiffres ci-dessus sont la performance en direct de la villa en exploitation — ADR, occupation, CA YTD — extraits du PMS via Firestore. Chaque hypothèse par villa du modèle est inférieure ou égale à ce que cette villa réalise déjà. Le modèle est un plancher, pas une prévision.",
        he: "המספרים למעלה הם הביצועים החיים של הוילה הפעילה — ADR, תפוסה, הכנסות YTD — דרך PMS עם Firestore. כל הנחה לוילה במודל שווה או נמוכה ממה שהוילה כבר משיגה. המודל הוא רצפה, לא תחזית.",
      },
    },
    {
      target: "#bank-kpi-strip",
      title: {
        en: "Headline coverage",
        el: "Κύρια κάλυψη",
        fr: "Couverture principale",
        he: "כיסוי עיקרי",
      },
      body: {
        en: "Five headline KPIs: total investment, loan amount, LTV at completion, asset coverage, and stabilised DSCR. The 1.25× DSCR covenant is the standard bank threshold — this deal clears it from year 3 onward in every scenario including Downside.",
        el: "Πέντε κύρια KPIs: συνολική επένδυση, δάνειο, LTV, κάλυψη ενεργητικού, σταθεροποιημένο DSCR. Το covenant 1.25× ξεπερνιέται από το έτος 3 σε κάθε σενάριο.",
        fr: "Cinq KPIs : investissement total, prêt, LTV, couverture d'actif, DSCR stabilisé. Le covenant 1.25× est dépassé dès l'année 3 dans tous les scénarios.",
        he: "חמישה KPIs: השקעה כוללת, הלוואה, LTV, כיסוי נכסים, DSCR מיוצב. הקובננט 1.25× נחצה משנה 3 בכל תרחיש.",
      },
    },
    {
      title: {
        en: "OpCo subordination",
        el: "Υποδομή OpCo",
        fr: "Subordination OpCo",
        he: "כפיפות OpCo",
      },
      body: {
        en: "The structure separates real estate (PropCo) from operations (OpCo). All DSCR and NCF figures on this page are PropCo's — i.e. AFTER debt service but BEFORE operator fees. The bank gets paid first. Operator compensation is structurally subordinated.",
        el: "Η δομή διαχωρίζει το real estate (PropCo) από τη λειτουργία (OpCo). Όλα τα DSCR και NCF εδώ είναι της PropCo — ΜΕΤΑ την εξυπηρέτηση χρέους και ΠΡΙΝ τις αμοιβές operator. Η τράπεζα πληρώνεται πρώτη.",
        fr: "La structure sépare l'immobilier (PropCo) des opérations (OpCo). Tous les DSCR et FTN ici sont ceux de PropCo — APRÈS service de la dette et AVANT honoraires de l'opérateur. La banque est payée en premier.",
        he: "המבנה מפריד נדל\"ן (PropCo) מתפעול (OpCo). כל ה-DSCR וה-NCF כאן הם של PropCo — אחרי שירות החוב ולפני עמלות המפעיל. הבנק משולם ראשון.",
      },
    },
    {
      target: "#bank-financing-comparison",
      title: {
        en: "Financing path comparison",
        el: "Σύγκριση διαδρομών",
        fr: "Comparaison voies",
        he: "השוואת מסלולים",
      },
      body: {
        en: "Four financing paths side-by-side: Commercial, RRF, Greek Development Law Grant, and TEPIX III. Rows show loan size, equity required, annual debt service, stabilised DSCR, and equity IRR for each. The active path is the sponsor's primary application.",
        el: "Τέσσερις διαδρομές χρηματοδότησης: Commercial, ΤΑΑ, Επιχορήγηση, ΤΕΠΙΧ ΙΙΙ. Γραμμές: δάνειο, ίδια κεφάλαια, εξυπηρέτηση, DSCR, IRR.",
        fr: "Quatre voies : Commercial, RRF, Subvention, TEPIX III. Lignes : prêt, fonds propres, DS, DSCR, TRI.",
        he: "ארבעה מסלולים: Commercial, RRF, מענק, TEPIX III. שורות: הלוואה, הון, DS, DSCR, IRR.",
      },
    },
    {
      target: "#bank-collateral",
      title: {
        en: "Collateral position",
        el: "Θέση εξασφάλισης",
        fr: "Position de garantie",
        he: "עמדת בטחונות",
      },
      body: {
        en: "Asset coverage at three valuation tiers: Stress (conservative), Market (base), Positive (premium). LTV and coverage ratio shown for each. Banks underwrite to the Stress tier — note how the deal remains well-covered even there.",
        el: "Κάλυψη ενεργητικού σε τρία επίπεδα: Stress, Market, Positive. LTV και δείκτης κάλυψης ανά επίπεδο. Η τράπεζα ανερεύνει στο Stress.",
        fr: "Couverture à trois niveaux : Stress, Marché, Positif. LTV et ratio de couverture par niveau. Les banques évaluent au niveau Stress.",
        he: "כיסוי בשלוש רמות: Stress, שוק, חיובי. LTV ויחס כיסוי לכל רמה. בנקים מחתמים ברמת Stress.",
      },
    },
    {
      target: "#bank-stress-test",
      title: {
        en: "Stress test",
        el: "Stress test",
        fr: "Test de résistance",
        he: "מבחן עמידות",
      },
      body: {
        en: "Interactive downside stress: what happens to DSCR when occupancy and ADR drop simultaneously? The widget lets you dial both inputs and see coverage in real time — confirming the 1.25× covenant survives plausible adverse scenarios.",
        el: "Διαδραστικό stress test: τι συμβαίνει στο DSCR όταν πέσουν ταυτόχρονα πληρότητα και ADR; Ρυθμίστε και δείτε κάλυψη σε πραγματικό χρόνο.",
        fr: "Stress test interactif : que devient le DSCR quand occupation et ADR chutent simultanément ? Ajustez en temps réel pour vérifier le covenant 1.25×.",
        he: "מבחן עמידות אינטראקטיבי: מה קורה ל-DSCR כשתפוסה ו-ADR יורדים יחד? כווננו בזמן אמת לאימות הקובננט 1.25×.",
      },
    },
    {
      target: "#bank-pnl",
      title: {
        en: "Full P&L + download",
        el: "Πλήρες P&L + λήψη",
        fr: "P&L complet + téléchargement",
        he: "P&L מלא + הורדה",
      },
      body: {
        en: "The full 11-year P&L table is scrollable below — Revenue, EBITDA, Debt Service, NCF post-tax, DSCR, and yield to equity year by year. Use Download model (.xlsx) at the top to take the full 14-sheet Excel offline; all formulas remain linked and editable.",
        el: "Πλήρης πίνακας P&L 11 ετών παρακάτω: έσοδα, EBITDA, εξυπηρέτηση, NCF, DSCR. Χρησιμοποιήστε Download model (.xlsx) για να πάρετε το Excel των 14 φύλλων εκτός σύνδεσης.",
        fr: "Tableau P&L complet sur 11 ans ci-dessous. Utilisez Download model (.xlsx) pour emporter le modèle Excel 14 onglets hors ligne.",
        he: "טבלת P&L מלאה לכל 11 שנה למטה. השתמשו ב-Download model (.xlsx) להורדת Excel 14 גליונות לעבודה לא מקוונת.",
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
        fr: "Hypothèses — le cockpit du modèle",
        he: "הנחות — תא הטייס של המודל",
      },
      body: {
        en: "Every number in the Dashboard, P&L, and Scenarios is derived from the inputs on this page. Change a value here and the entire model recomputes in milliseconds. Six tabs cover the full input surface — Portfolio, Templates, Financing, General, Revenue, and OPEX.",
        el: "Κάθε νούμερο στο Dashboard, P&L και Σενάρια προέρχεται από τις εισόδους αυτής της σελίδας. Αλλάξτε μια τιμή και όλο το μοντέλο επανυπολογίζεται. Έξι tabs καλύπτουν όλες τις εισόδους.",
        fr: "Chaque chiffre du Dashboard, P&L et Scénarios provient des entrées de cette page. Modifiez une valeur et tout le modèle se recalcule. Six onglets couvrent la surface complète.",
        he: "כל מספר ב-Dashboard, P&L ותרחישים נגזר מהקלטים בדף זה. שנו ערך וכל המודל מחושב מחדש. שישה לשוניות מכסות את כל משטח הקלט.",
      },
    },
    {
      target: "#assumptions-portfolio-overview",
      title: {
        en: "Portfolio overview",
        el: "Επισκόπηση χαρτοφυλακίου",
        fr: "Vue d'ensemble du portefeuille",
        he: "סקירת תיק נכסים",
      },
      body: {
        en: "Live snapshot: number of projects, total units, total built surface, and total CapEx. These four cells update the moment you add, remove, or resize a project in the Portfolio tab below.",
        el: "Ζωντανό στιγμιότυπο: αριθμός projects, συνολικές μονάδες, built surface, συνολικό CapEx. Ενημερώνεται αμέσως με κάθε αλλαγή project.",
        fr: "Aperçu en direct : projets, unités totales, surface construite, CapEx total. Se met à jour dès qu'un projet est ajouté, retiré ou redimensionné.",
        he: "תמונת מצב חיה: פרויקטים, יחידות כולל, שטח בנוי, CapEx כולל. מתעדכן מיד עם כל שינוי בפרויקט.",
      },
    },
    {
      target: "#assumptions-tabs",
      title: {
        en: "Six tabs, full control",
        el: "Έξι tabs, πλήρης έλεγχος",
        fr: "Six onglets, contrôle total",
        he: "שש לשוניות, שליטה מלאה",
      },
      body: {
        en: "Portfolio — add/remove plots and set unit counts. Templates — define per-property CAPEX and OPEX. Financing — select path and tune loan terms. General — ramp factors and tax rates. Revenue — ADR, nights, events, ancillary by scenario. OPEX — operating cost overrides per template.",
        el: "Portfolio — plots και μονάδες. Templates — CAPEX/OPEX ανά property. Financing — διαδρομή και όροι δανείου. General — ramp και φόροι. Revenue — ADR, βραδιές, events ανά σενάριο. OPEX — λειτουργικά κόστη.",
        fr: "Portfolio — parcelles et unités. Templates — CAPEX/OPEX par propriété. Financement — voie et conditions du prêt. Général — ramp et taxes. Revenus — ADR, nuitées, événements. OPEX — coûts opérationnels.",
        he: "Portfolio — מגרשים ויחידות. Templates — CAPEX/OPEX לנכס. Financing — מסלול ותנאי הלוואה. General — ramp ומסים. Revenue — ADR, לילות, אירועים. OPEX — עלויות תפעול.",
      },
    },
    {
      title: {
        en: "Blue cells are editable",
        el: "Τα μπλε κελιά είναι επεξεργάσιμα",
        fr: "Les cellules bleues sont éditables",
        he: "תאים כחולים ניתנים לעריכה",
      },
      body: {
        en: "Any value shown on a blue background is a live input — click it to edit in place. Numeric fields accept raw numbers (enter 0.05 or 5 for 5% depending on format). Press Enter or Tab to commit; Escape to cancel. The model recomputes as you leave each field.",
        el: "Κάθε τιμή σε μπλε φόντο είναι ενεργή είσοδος — πατήστε για επεξεργασία. Enter / Tab για αποθήκευση, Escape για ακύρωση. Το μοντέλο επανυπολογίζεται αμέσως.",
        fr: "Toute valeur sur fond bleu est une entrée active — cliquez pour éditer. Entrée / Tab pour valider, Échap pour annuler. Le modèle se recalcule immédiatement.",
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
        fr: "Cap table — qui reçoit quoi à la sortie",
        he: "Cap Table — מי מקבל מה ביציאה",
      },
      body: {
        en: "This page shows the equity distribution at the active exit year. The model runs a three-layer founder waterfall — pari-passu, grant bonus (if applicable), and performance ratchet — then splits the remainder among investors pro-rata. Change cash contributions to see the waterfall recompute in real time.",
        el: "Αυτή η σελίδα δείχνει τη διανομή ιδίων κεφαλαίων στο ενεργό έτος εξόδου. Τρία επίπεδα ιδρυτή: pari-passu, bonus επιχορήγησης, performance ratchet — ο υπόλοιπος μοιράζεται ανά-λόγια στους επενδυτές.",
        fr: "Cette page montre la distribution des fonds propres à l'année de sortie active. Trois couches fondateur — pari-passu, bonus subvention, ratchet — puis le reste aux investisseurs au prorata.",
        he: "דף זה מציג את חלוקת ההון בשנת היציאה הפעילה. שלוש שכבות יזם — pari-passu, בונוס מענק, רצ'ט — אחר כך השאר למשקיעים לפי יחס.",
      },
    },
    {
      target: "#captable-founder-waterfall",
      title: {
        en: "Founder waterfall",
        el: "Καταρράκτης ιδρυτή",
        fr: "Cascade fondateur",
        he: "מפל יזם",
      },
      body: {
        en: "Layer A (pari-passu): founder's cash-in as a fraction of total equity. Layer B (grant bonus): additional carried interest derived from the 10% grant success fee net of consultant cost — vests only if the development-law application is approved. Layer C (performance ratchet): additional carry by MOIC tier. Investors are guaranteed at least 25% of distributions.",
        el: "Layer A: μερίδιο ιδρυτή pari-passu. Layer B: bonus επιχορήγησης (10% grant αμοιβή μείον σύμβουλο). Layer C: performance ratchet ανά MOIC tier. Οι επενδυτές εγγυώνται ≥25% διανομών.",
        fr: "Couche A : part pari-passu. Couche B : bonus subvention (commission 10% nette consultant). Couche C : ratchet de performance par tier MOIC. Investisseurs garantis ≥25% des distributions.",
        he: "שכבה A: חלק pari-passu. שכבה B: בונוס מענק (10% עמלה נטו מייעוץ). שכבה C: רצ'ט ביצועים לפי שכבת MOIC. משקיעים מובטחים ≥25% מהחלוקות.",
      },
    },
    {
      target: "#captable-stakeholders",
      title: {
        en: "Stakeholder table",
        el: "Πίνακας συμμετόχων",
        fr: "Tableau des parties prenantes",
        he: "טבלת בעלי עניין",
      },
      body: {
        en: "One row per investor: cash in, pool share, economic stake (post-waterfall), total received at exit, MOIC, IRR, and payback year. Click any row to expand year-by-year distributions. Edit a cash contribution directly in the table — the waterfall recomputes instantly. Add investors with the button below.",
        el: "Μία γραμμή ανά επενδυτή: cash in, μερίδιο, οικονομικό stake, σύνολο, MOIC, IRR, payback. Κλικ για ετήσια ανάλυση. Επεξεργαστείτε cash contribution άμεσα.",
        fr: "Une ligne par investisseur : cash apporté, part du pool, stake économique, total reçu, MOIC, TRI, remboursement. Cliquez pour le détail annuel. Éditez les contributions directement.",
        he: "שורה לכל משקיע: cash, חלק בבריכה, stake כלכלי, סך שהתקבל, MOIC, IRR, שנת החזר. לחצו לפירוט שנתי. ערכו תרומות ישירות.",
      },
    },
    {
      title: {
        en: "Investor reports",
        el: "Εκθέσεις επενδυτών",
        fr: "Rapports investisseurs",
        he: "דוחות למשקיעים",
      },
      body: {
        en: "The 'Generate investor report' toggle switches to a redacted view: full detail for one named investor, all others shown as aggregated 'Other investors'. Download a personalised PDF per investor from the ↓ PDF link in their row — the report includes their specific cash flows, MOIC, and IRR.",
        el: "Το 'Generate investor report' εμφανίζει πλήρη ανάλυση για έναν επενδυτή και συγκεντρωτικά τους υπόλοιπους. Κατεβάστε PDF ανά επενδυτή από τον σύνδεσμο ↓ PDF.",
        fr: "Le basculement 'Generate investor report' passe en vue épurée : détail complet pour un investisseur, les autres agrégés. Téléchargez un PDF personnalisé via le lien ↓ PDF.",
        he: "ה-toggle 'Generate investor report' מציג פירוט מלא למשקיע אחד וסיכום לשאר. הורידו PDF מותאם אישית דרך קישור ↓ PDF.",
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
        fr: "Lexique — dictionnaire des formules",
        he: "מילון — מילון הנוסחאות",
      },
      body: {
        en: "Every metric in this model has an exact mathematical definition. This page documents them — CAPEX build-up, revenue drivers, EBITDA, PMT, DSCR, break-even methods, collateral tiers, and all four financing paths. If a number somewhere looks wrong, the formula here is the source of truth.",
        el: "Κάθε μετρική έχει ακριβή μαθηματικό ορισμό. Αυτή η σελίδα τους τεκμηριώνει — CAPEX, έσοδα, EBITDA, PMT, DSCR, break-even, εξασφαλίσεις και διαδρομές χρηματοδότησης.",
        fr: "Chaque indicateur a une définition mathématique précise. Cette page les documente — CAPEX, revenus, EBITDA, PMT, DSCR, break-even, garanties et voies de financement.",
        he: "לכל מדד הגדרה מתמטית מדויקת. דף זה מתעד אותן — CAPEX, הכנסות, EBITDA, PMT, DSCR, break-even, בטחונות ומסלולי מימון.",
      },
    },
    {
      target: "#lexicon-quicknav",
      title: {
        en: "Quick navigation",
        el: "Γρήγορη πλοήγηση",
        fr: "Navigation rapide",
        he: "ניווט מהיר",
      },
      body: {
        en: "Each pill jumps directly to that formula section and auto-expands the accordion. Use 'Expand all' to open every section at once for a full-page scan. All sections are collapsible — click the heading to toggle.",
        el: "Κάθε pill μεταφέρει απευθείας στην ενότητα και ανοίγει το accordion. 'Expand all' ανοίγει τα πάντα. Κλικ στον τίτλο για εναλλαγή.",
        fr: "Chaque pastille saute directement à la section et ouvre l'accordéon. 'Tout développer' ouvre toutes les sections. Cliquez sur un titre pour basculer.",
        he: "כל כדור קופץ ישירות לסעיף ופותח האקורדיון. 'הרחב הכל' פותח הכל. לחצו על כותרת להחלפה.",
      },
    },
  ],
};
