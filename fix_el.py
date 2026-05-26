# -*- coding: utf-8 -*-
with open('src/lib/i18n/el.ts', 'r', encoding='utf-8') as f:
    content = f.read()

count = 0

def rep(old, new):
    global content, count
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
    else:
        print(f'NOT FOUND: {old[:80]}')

# ── DSRA assumptions ──
rep("'as.dsraEnabled': 'DSRA enabled'",
    "'as.dsraEnabled': 'Ενεργοποιημένο DSRA'")

rep("'as.dsraSweepPct': '2028 pre-opening NCF sweep (%)'",
    "'as.dsraSweepPct': 'Σκούπισμα NCF προ-έναρξης 2028 (%)'")

rep("'as.dsraSweepNote': '2028 is the pre-opening season — the first year cash is available before full hotel operations. This one-time sweep seeds the reserve; subsequent years replenish from post-coverage surplus.'",
    "'as.dsraSweepNote': '2028 είναι η προ-έναρξης σεζόν — το πρώτο έτος που διατίθεται ταμειακή ροή πριν από την πλήρη ξενοδοχειακή λειτουργία. Αυτό το εφάπαξ σκούπισμα χρηματοδοτεί το αποθεματικό· τα επόμενα έτη αναπληρώνονται από πλεόνασμα μετά κάλυψης.'")

rep("'as.dsraRepayThreshold': 'Consecutive stable years before partner repayment'",
    "'as.dsraRepayThreshold': 'Συνεχόμενα σταθερά έτη πριν την αποπληρωμή εταίρου'")

rep("'as.wcDsraNote': 'Locks DSRA share, reduces flex'",
    "'as.wcDsraNote': 'Κλειδώνει μερίδιο DSRA, μειώνει ευελιξία'")

rep("'dsra.target': 'DSRA Target'",
    "'dsra.target': 'Στόχος DSRA'")

rep("'dsra.sweep': '2028 Surplus Sweep'",
    "'dsra.sweep': 'Σκούπισμα Πλεονάσματος 2028'")

rep("'dsra.partnerAdvance': 'Partner Advance'",
    "'dsra.partnerAdvance': 'Προκαταβολή Εταίρου'")

rep("'dsra.dealTermSub': 'sweep + partner advance'",
    "'dsra.dealTermSub': 'σκούπισμα + προκαταβολή εταίρου'")

rep("'dsra.dashKpiLabel': 'DSRA Reserve'",
    "'dsra.dashKpiLabel': 'Αποθεματικό DSRA'")

rep("'dsra.dashKpiSub': 'partner advance'",
    "'dsra.dashKpiSub': 'προκαταβολή εταίρου'")

# ── Portfolio OPEX tooltips ──
rep("'as.portfolioOpex.bankingTooltip': '≈ Revenue × direct-booking mix × blended card processing rate. Default: €1.9M × 50% × 3.2% ≈ €30K.'",
    "'as.portfolioOpex.bankingTooltip': '≈ Έσοδα × μερίδιο άμεσης κράτησης × μεικτό επιτόκιο επεξεργασίας καρτών. Προεπιλογή: €1,9M × 50% × 3,2% ≈ €30K.'")

rep("'as.portfolioOpex.insuranceTooltip': 'D&O, BI, key-person, cyber, events liability — one portfolio-wide policy distinct from per-property building cover.'",
    "'as.portfolioOpex.insuranceTooltip': 'D&O, ΔΕ, key-person, cyber, ευθύνη εκδηλώσεων — ένα ενιαίο ασφαλιστήριο χαρτοφυλακίου ξεχωριστό από την κάλυψη κτιρίου ανά ακίνητο.'")

rep("'as.portfolioOpex.colNetMonthlyTooltip': 'Estimated employee take-home: gross minus EFKA (13.87%) and simplified Greek income-tax brackets. Not a payroll calculation.'",
    "'as.portfolioOpex.colNetMonthlyTooltip': 'Εκτιμώμενες καθαρές αποδοχές εργαζομένου: μεικτός μισθός μείον ΕΦΚΑ (13,87%) και απλοποιημένες ελληνικές κλίμακες φόρου εισοδήματος. Δεν αποτελεί υπολογισμό μισθοδοσίας.'")

rep("'as.portfolioOpex.colHeadcountTooltip': 'Number of workers in this role. Multiplies gross salary, burden, and allowances.'",
    "'as.portfolioOpex.colHeadcountTooltip': 'Αριθμός εργαζομένων σε αυτόν τον ρόλο. Πολλαπλασιάζει τον μεικτό μισθό, τις βαρύνσεις και τα επιδόματα.'")

# ── pageIntro keys ──
rep("'sc.pageIntro': 'Four scenarios and four financing paths side-by-side at the stabilised year — the banker\\'s stress-test view.'",
    "'sc.pageIntro': 'Τέσσερα σενάρια και τέσσερις δομές χρηματοδότησης παράλληλα στο σταθεροποιημένο έτος — η άποψη stress-test του τραπεζίτη.'")

rep("'opco.pageIntro': 'How the PropCo / OpCo two-entity structure separates property ownership from operations — and what it means for the bank\\'s DSCR.'",
    "'opco.pageIntro': 'Πώς η δομή δύο οντοτήτων PropCo / OpCo διαχωρίζει την κυριότητα ακινήτων από τη λειτουργία — και τι σημαίνει αυτό για το ΔΚΕΧ της τράπεζας.'")

rep("'ct.pageIntro': 'Equity distribution at the active exit year — three-layer founder waterfall, investor stakes, MOIC, and IRR per stakeholder.'",
    "'ct.pageIntro': 'Κατανομή equity στο ενεργό έτος εξόδου — τριεπίπεδος καταρράκτης ιδρυτή, μερίδια επενδυτών, MOIC και IRR ανά μέτοχο.'")

rep("'lex.pageIntro': 'Every formula the model runs — CAPEX, revenue, EBITDA, PMT, DSCR, break-even, collateral, and all four financing paths.'",
    "'lex.pageIntro': 'Κάθε τύπος που τρέχει το μοντέλο — CAPEX, έσοδα, EBITDA, PMT, ΔΚΕΧ, νεκρό σημείο, εξασφαλίσεις και όλες οι τέσσερις δομές χρηματοδότησης.'")

rep("'as.pageIntro': 'The model\\'s cockpit: edit any blue value across six tabs and every chart, KPI, and table recalculates instantly.'",
    "'as.pageIntro': 'Το πιλοτήριο του μοντέλου: επεξεργαστείτε οποιαδήποτε μπλε τιμή σε έξι καρτέλες και κάθε γράφημα, KPI και πίνακας επανυπολογίζεται άμεσα.'")

# ── Presentation strings ──
rep("'presentation.s11.grantStrategy': 'Under the Development Law (Grant) financing path a non-repayable state grant covers 60% of eligible non-land construction costs. The grant reduces the loan quantum, annual debt service, and expands DSCR headroom above the 1.25× covenant floor — without any change to the underlying business plan assumptions.'",
    "'presentation.s11.grantStrategy': 'Στο πλαίσιο χρηματοδότησης μέσω Αναπτυξιακού Νόμου (Επιδότηση), μη επιστρεπτέα κρατική επιδότηση καλύπτει το 60% των επιλέξιμων μη χερσαίων κατασκευαστικών δαπανών. Η επιδότηση μειώνει το ύψος του δανείου, την ετήσια εξυπηρέτηση χρέους και διευρύνει το περιθώριο ΔΚΕΧ άνω του κατώτατου ορίου συμφώνου 1,25× — χωρίς καμία αλλαγή στις υποκείμενες παραδοχές επιχειρηματικού σχεδίου.'")

rep("'presentation.s2.intro': 'Villa Lev is an 8-bedroom luxury property on Antiparos that has been in operation since 2022. The table below presents verified annual results sourced from the platform\\'s live Firestore dashboard.'",
    "'presentation.s2.intro': 'Η Villa Lev είναι ένα πολυτελές ακίνητο 8 υπνοδωματίων στην Αντίπαρο που λειτουργεί από το 2022. Ο παρακάτω πίνακας παρουσιάζει επαληθευμένα ετήσια αποτελέσματα από το ζωντανό Firestore dashboard της πλατφόρμας.'")

rep("'presentation.s4.propA.desc': 'Two twin villas (3-bedroom + 4-bedroom), each with own entrance, private pool, and sea views. Target ADR €3,500/night net.'",
    "'presentation.s4.propA.desc': 'Δύο ταυτόσημες βίλες (3 + 4 υπνοδωμάτια), κάθε μία με ιδιαίτερη είσοδο, ιδιωτική πισίνα και θέα στη θάλασσα. Στόχος ΜΗΤ €3.500/βράδυ καθαρό.'")

rep("'presentation.s4.propB.desc': 'Four boutique suites — 2 Standard (40m²) and 2 Double (65m²) — plus hamam/sauna/gym and indoor/outdoor events space.'",
    "'presentation.s4.propB.desc': 'Τέσσερις boutique σουίτες — 2 Τυπικές (40m²) και 2 Διπλές (65m²) — συν hamam/σάουνα/γυμναστήριο και εσωτερικό/εξωτερικό χώρο εκδηλώσεων.'")

rep("'presentation.s4.events.note': 'Events and retreats income is not modelled in the Conservative case — it is unmodelled upside with proven demand.'",
    "'presentation.s4.events.note': 'Τα έσοδα από εκδηλώσεις και retreats δεν προβλέπονται στο Συντηρητικό σενάριο — αποτελούν μη μοντελοποιημένη ανοδική δυνατότητα με αποδεδειγμένη ζήτηση.'")

rep("'presentation.s5.intro': 'All projections use static assumptions with no compounding. The villa ADR in the model (€3,500) is below Villa Lev\\'s 2025 live rate (€3,584).'",
    "'presentation.s5.intro': 'Όλες οι προβλέψεις χρησιμοποιούν στατικές παραδοχές χωρίς σύνθεση. Το ΜΗΤ βίλας στο μοντέλο (€3.500) είναι κατώτερο του ζωντανού ρυθμού Villa Lev 2025 (€3.584).'")

rep("'presentation.s6.dsraNote': 'Liquidity & DSRA: A €470,000 revolving working capital facility is held in escrow throughout the ramp period. It is self-liquidating by end of each peak season.'",
    "'presentation.s6.dsraNote': 'Ρευστότητα & DSRA: Ανακυκλούμενη πιστωτική γραμμή €470.000 διατηρείται σε escrow καθ\\' όλη τη διάρκεια της περιόδου ανόδου. Είναι αυτο-εκκαθαριζόμενη στο τέλος κάθε κορυφαίας σεζόν.'")

rep("'presentation.s7.dsNote': 'Annual debt service is fully amortising from 2029. No balloon. Loan balance zero at maturity.'",
    "'presentation.s7.dsNote': 'Η ετήσια εξυπηρέτηση χρέους είναι πλήρως αποσβεστέα από το 2029. Χωρίς τελική δόση. Υπόλοιπο δανείου μηδέν στη λήξη.'")

rep("'presentation.s8.eytan.bio': 'Eytan is a multi-sector entrepreneur who has led ventures across Europe, Africa, India, Israel and the U.S., building companies from inception to 8-figure revenues. Over 25 years, he has operated primarily in the tech industry, founding firms that grew to millions of users and managing a publicly listed telecom provider valued at €200 million. In recent years, he expanded into boutique hospitality, developing Villa Lev — an 8-bedroom luxury property on Antiparos — which within two years became the #1 ranked rental property on the island and entered the global top 5% of all Airbnb listings. Villa Lev Group is the direct extension of that proven model.'",
    "'presentation.s8.eytan.bio': 'Ο Eytan είναι επιχειρηματίας πολλαπλών κλάδων που έχει ηγηθεί εγχειρημάτων σε Ευρώπη, Αφρική, Ινδία, Ισραήλ και ΗΠΑ, χτίζοντας εταιρείες από μηδενική βάση σε έσοδα 8 ψηφίων. Σε 25+ χρόνια, έδρασε κυρίως στον κλάδο της τεχνολογίας, ιδρύοντας επιχειρήσεις που μεγάλωσαν σε εκατομμύρια χρήστες και διαχειρίστηκε εισηγμένη εταιρεία τηλεπικοινωνιών αξίας €200 εκατ. Τα τελευταία χρόνια επεκτάθηκε στο boutique hospitality, αναπτύσσοντας την Villa Lev — ένα πολυτελές ακίνητο 8 υπνοδωματίων στην Αντίπαρο — η οποία εντός δύο ετών έγινε η #1 κατατασσόμενη ενοικιαζόμενη κατοικία στο νησί και εισήλθε στο παγκόσμιο top 5% όλων των καταχωρίσεων Airbnb. Η Villa Lev Group είναι η άμεση επέκταση αυτού του αποδεδειγμένου μοντέλου.'")

rep("'presentation.s9.intro': 'The commercial loan is the base case presented throughout this document. Two grant/subsidy instruments exist that materially improve the financing structure.'",
    "'presentation.s9.intro': 'Το εμπορικό δάνειο είναι η βασική περίπτωση που παρουσιάζεται σε αυτό το έγγραφο. Υπάρχουν δύο εργαλεία επιχορήγησης/ενίσχυσης που βελτιώνουν ουσιαστικά τη δομή χρηματοδότησης.'")

rep("'presentation.s9.pathNote': 'The highlighted column reflects the currently selected financing path.'",
    "'presentation.s9.pathNote': 'Η επισημασμένη στήλη αντικατοπτρίζει την τρέχουσα επιλεγμένη δομή χρηματοδότησης.'")

rep("'presentation.s10.closingLine': 'Villa Lev Group is ready to receive and deploy capital. The operator has a live track record, the sites are identified, and the model is running.'",
    "'presentation.s10.closingLine': 'Η Villa Lev Group είναι έτοιμη να λάβει και να αναπτύξει κεφάλαιο. Ο φορέας εκμετάλλευσης διαθέτει ζωντανό ιστορικό, τα οικόπεδα έχουν εντοπιστεί και το μοντέλο λειτουργεί.'")

rep("'presentation.s4.plotIntro': 'Three plots in the Agios Georgios neighbourhood of Antiparos — the same neighbourhood as Villa Lev. All three sit within the official village building limits (οικισμός) under Government Gazette (FEK) designation. Buildability is not a matter of interpretation: it is a direct consequence of the FEK. Permit risk is structurally mitigated through phased financing and conditional Phase 2 drawdown following permit issuance. All plots have panoramic sea views and are within walking distance of the beach. Negotiations are at an advanced stage on all three.'",
    "'presentation.s4.plotIntro': 'Τρία οικόπεδα στη γειτονιά Άγιος Γεώργιος της Αντιπάρου — η ίδια γειτονιά με την Villa Lev. Και τα τρία εντάσσονται στα επίσημα όρια οικοδόμησης οικισμού (οικισμός) σύμφωνα με τον Κανονισμό Κυβερνητικής Εφημερίδας (ΦΕΚ). Η δυνατότητα δόμησης δεν αποτελεί θέμα ερμηνείας: είναι άμεση συνέπεια του ΦΕΚ. Ο κίνδυνος αδειοδότησης μετριάζεται δομικά μέσω σταδιακής χρηματοδότησης και υπό αίρεση εκταμίευσης Φάσης 2 μετά την έκδοση αδειών. Και τα τρία οικόπεδα έχουν πανοραμική θέα θάλασσας και βρίσκονται σε απόσταση βάδην από την παραλία. Οι διαπραγματεύσεις είναι σε προχωρημένο στάδιο και για τα τρία.'")

rep("'presentation.s5.realisticTable.header': 'Realistic Scenario — Stabilised Year (2031)'",
    "'presentation.s5.realisticTable.header': 'Ρεαλιστικό Σενάριο — Σταθεροποιημένο Έτος (2031)'")

rep("'presentation.s5.upsideTable.header': 'Upside Scenario — Stabilised Year (2031)'",
    "'presentation.s5.upsideTable.header': 'Ανοδικό Σενάριο — Σταθεροποιημένο Έτος (2031)'")

rep("'presentation.s5.downsideTable.header': 'Downside Stress Scenario'",
    "'presentation.s5.downsideTable.header': 'Σενάριο Ακραίας Πίεσης'")

rep("'presentation.s9.instruments.header': 'Financing Instruments — At a Glance'",
    "'presentation.s9.instruments.header': 'Χρηματοδοτικά Εργαλεία — Με μία Ματιά'")

# ── VAT Cashflow ──
rep("'bank.vatCashflow.title': 'Construction VAT Cashflow'",
    "'bank.vatCashflow.title': 'Ταμειακές Ροές ΦΠΑ Κατασκευής'")

rep("'bank.vatCashflow.sub': 'VAT paid on construction invoices · 2-quarter refund lag · Revolving covenant €470K'",
    "'bank.vatCashflow.sub': 'ΦΠΑ που καταβλήθηκε σε τιμολόγια κατασκευής · Υστέρηση επιστροφής 2 τριμήνων · Ανακυκλούμενο σύμφωνο €470K'")

rep("'bank.vatCashflow.colQuarter': 'Quarter'",
    "'bank.vatCashflow.colQuarter': 'Τρίμηνο'")

rep("'bank.vatCashflow.colVatPaid': 'VAT Paid'",
    "'bank.vatCashflow.colVatPaid': 'ΦΠΑ Καταβληθέν'")

rep("'bank.vatCashflow.colVatRefund': 'VAT Refund'",
    "'bank.vatCashflow.colVatRefund': 'Επιστροφή ΦΠΑ'")

rep("'bank.vatCashflow.colNetFloat': 'Net Float'",
    "'bank.vatCashflow.colNetFloat': 'Καθαρή Επίπτωση'")

rep("'bank.vatCashflow.covenantBreach': 'BREACH'",
    "'bank.vatCashflow.covenantBreach': 'ΠΑΡΑΒΑΣΗ'")

rep("'bank.vatCashflow.withinCovenant': 'All quarters within the €470K revolving covenant'",
    "'bank.vatCashflow.withinCovenant': 'Όλα τα τρίμηνα εντός ανακυκλούμενου συμφώνου €470K'")

rep("'bank.vatCashflow.lagNote': 'VAT-liable CapEx €7,589,108 @ 24% · Draw schedule 20/50/30% · 2-quarter refund lag'",
    "'bank.vatCashflow.lagNote': 'ΦΠΑ-επιλέξιμο CAPEX €7.589.108 @ 24% · Πρόγραμμα εκταμίευσης 20/50/30% · Υστέρηση επιστροφής 2 τριμήνων'")

rep("'bank.vatCashflow.postRefundNote': 'Post-construction refund €273,208 expected Q1-Q2 2029 — improves opening-year cash'",
    "'bank.vatCashflow.postRefundNote': 'Επιστροφή μετά κατασκευή €273.208 αναμενόμενη Q1-Q2 2029 — βελτιώνει ταμειακή ροή έτους ανοίγματος'")

rep("'bank.stressLink': 'Full sensitivity analysis →'",
    "'bank.stressLink': 'Πλήρης ανάλυση ευαισθησίας →'")

# ── Admin about ──
rep("'admin.about.colCount':             'Count'",
    "'admin.about.colCount':             'Αριθμός'")

rep("'admin.about.luxuryVilla':          'Luxury villa'",
    "'admin.about.luxuryVilla':          'Πολυτελής βίλα'")

rep("'admin.about.hotelRooms':           'Hotel rooms'",
    "'admin.about.hotelRooms':           'Δωμάτια ξενοδοχείου'")

rep("'admin.about.stdDbl':               'standard · double'",
    "'admin.about.stdDbl':               'τυπ. · διπλ.'")

# ── Dash ──
rep("'dash.activateGrantPath':           '★ Activate Grant path →'",
    "'dash.activateGrantPath':           '★ Ενεργοποίηση μονοπατιού επιδότησης →'")

rep("'dash.colScenario':                 'Scenario'",
    "'dash.colScenario':                 'Σενάριο'")

rep("'dash.colCashYield':                'Cash Yield'",
    "'dash.colCashYield':                'Μερισματική Απόδοση'")

rep("'dash.fullReturnsLink':             'Full returns analysis →'",
    "'dash.fullReturnsLink':             'Πλήρης ανάλυση αποδόσεων →'")

rep("'dash.section.exitAnalysis':        'Exit Analysis'",
    "'dash.section.exitAnalysis':        'Ανάλυση Εξόδου'")

rep("'dash.exit.preferredExit':          'Preferred Exit'",
    "'dash.exit.preferredExit':          'Προτιμώμενη Έξοδος'")

rep("'dash.exit.exitValue':              'Exit Value'",
    "'dash.exit.exitValue':              'Αξία Εξόδου'")

rep("'dash.exit.exitIRR':                'Exit IRR'",
    "'dash.exit.exitIRR':                'IRR Εξόδου'")

rep("'dash.exit.propertySale':           'Property Sale'",
    "'dash.exit.propertySale':           'Πώληση Ακινήτου'")

rep("'dash.exit.hotelSale':              'Hotel Sale'",
    "'dash.exit.hotelSale':              'Πώληση Ξενοδοχείου'")

rep("'dash.exit.deepDive':               'Deep dive →'",
    "'dash.exit.deepDive':               'Αναλυτικά →'")

rep("'dash.exit.description':            'Full returns analysis — both exit paths, scenario grid, IRR waterfall'",
    "'dash.exit.description':            'Πλήρης ανάλυση αποδόσεων — και τα δύο μονοπάτια εξόδου, πλέγμα σεναρίων, καταρράκτης IRR'")

rep("'dash.section.stressMargin':        'Stress & Margin Analysis'",
    "'dash.section.stressMargin':        'Ανάλυση Πίεσης & Περιθωρίου'")

rep("'dash.stressMarginSub':             'Per-villa BP assumptions vs the live single villa we already run today'",
    "'dash.stressMarginSub':             'Παραδοχές BP ανά βίλα έναντι της ζωντανής μεμονωμένης βίλας που διαχειριζόμαστε σήμερα'")

rep("'dash.stress.colBpConservative':    'BP Conservative'",
    "'dash.stress.colBpConservative':    'BP Συντηρητικό'")

rep("'dash.stress.colBpRealistic':       'BP Realistic+'",
    "'dash.stress.colBpRealistic':       'BP Ρεαλιστικό+'")

rep("'dash.stress.colVerdict':           'Verdict'",
    "'dash.stress.colVerdict':           'Αξιολόγηση'")

rep("'dash.stress.row.nights':           'Peak-season nights'",
    "'dash.stress.row.nights':           'Νύχτες κορυφαίας σεζόν'")

rep("'dash.stress.row.nightsSub':        '120 available · 15 May – 15 Sept'",
    "'dash.stress.row.nightsSub':        '120 διαθέσιμα · 15 Μαΐ – 15 Σεπτ'")

rep("'dash.stress.row.adrSub':           '€ per night'",
    "'dash.stress.row.adrSub':           '€ ανά διανυκτέρευση'")

rep("'dash.stress.row.accommodation':    'Accommodation'",
    "'dash.stress.row.accommodation':    'Διαμονή'")

rep("'dash.stress.row.ancillary':        'Ancillary profit'",
    "'dash.stress.row.ancillary':        'Παρεπόμενο κέρδος'")

rep("'dash.stress.row.events':           'Events'",
    "'dash.stress.row.events':           'Εκδηλώσεις'")

rep("'dash.stress.row.eventsSub':        'portfolio profit'",
    "'dash.stress.row.eventsSub':        'κέρδος χαρτοφυλακίου'")

# ── finComp ──
rep("'finComp.grantReceived':            'Grant received'",
    "'finComp.grantReceived':            'Επιδότηση ληφθείσα'")

rep("'finComp.equityRequired':           'Equity required'",
    "'finComp.equityRequired':           'Απαιτούμενα ίδια κεφάλαια'")

rep("'finComp.stabilisedDSCR':           'DSCR — Stabilised'",
    "'finComp.stabilisedDSCR':           'DSCR — Σταθεροποιημένο'")

rep("'finComp.supplementaryLoan':        'Supplementary commercial loan'",
    "'finComp.supplementaryLoan':        'Συμπληρωματικό εμπορικό δάνειο'")

rep("'finComp.equitySavingVsCommercial': 'Equity saving vs. commercial'",
    "'finComp.equitySavingVsCommercial': 'Εξοικονόμηση ιδίων κεφαλαίων έναντι εμπορικού'")

# ── Fields ──
rep("'field.landscapingCost':         'Landscaping / stone fence'",
    "'field.landscapingCost':         'Διαμόρφωση / πέτρινος φράκτης'")

rep("'field.licensesPermits':         'Licenses & permits'",
    "'field.licensesPermits':         'Άδειες & εγκρίσεις'")

rep("'field.constructionDirector':    'Construction director'",
    "'field.constructionDirector':    'Διευθυντής κατασκευής'")

rep("'field.poolCostPerM2':           'Pool construction cost (€/m²)'",
    "'field.poolCostPerM2':           'Κόστος κατασκευής πισίνας (€/m²)'")

rep("'field.poolSlotWidth':           'Width (m)'",
    "'field.poolSlotWidth':           'Πλάτος (m)'")

rep("'field.poolSlotLength':          'Length (m)'",
    "'field.poolSlotLength':          'Μήκος (m)'")

rep("'field.switchToFlat':            'Use flat amount'",
    "'field.switchToFlat':            'Χρήση ενιαίου ποσού'")

print(f'el.ts: {count} replacements made')

with open('src/lib/i18n/el.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('el.ts written.')
