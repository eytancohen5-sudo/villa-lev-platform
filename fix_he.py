# -*- coding: utf-8 -*-
with open('src/lib/i18n/he.ts', 'r', encoding='utf-8') as f:
    content = f.read()

count = 0
not_found = []

def rep(old, new):
    global content, count
    if old in content:
        content = content.replace(old, new, 1)
        count += 1
    else:
        not_found.append(old[:80])

# ── Bar chrome ──
rep("'bar.preparing': 'Preparing…'",       "'bar.preparing': 'מכין…'")
rep("'bar.exportExcel': 'Export Model'",   "'bar.exportExcel': 'ייצוא מודל'")
rep("'bar.exportExcelShort': 'Export'",    "'bar.exportExcelShort': 'ייצוא'")
rep("'bar.toAdmin': '← Admin'",            "'bar.toAdmin': 'ניהול ←'")
rep("'admin.bar.adjust': 'Adjust'",            "'admin.bar.adjust': 'כוונון'")
rep("'admin.bar.loanParams': 'Loan parameters'","'admin.bar.loanParams': 'פרמטרי הלוואה'")
rep("'admin.bar.exitYear': 'Exit'",             "'admin.bar.exitYear': 'יציאה'")
rep("'admin.bar.stubAtMaturity': 'stub at maturity'","'admin.bar.stubAtMaturity': 'תשלום בפירעון'")
rep("'admin.bar.viewPresentation': 'View Presentation ↗'","'admin.bar.viewPresentation': 'צפייה בפרזנטציה ↗'")
rep("'admin.bar.bankerView': 'Banker view'","'admin.bar.bankerView': 'תצוגת בנקאי'")
rep("'admin.banner.stalePart1': 'Showing static snapshot from'","'admin.banner.stalePart1': 'מציג תצלום סטטי מ-'")
rep("'admin.banner.stalePart2': '— live feed not connected.'","'admin.banner.stalePart2': '— עדכון חי לא מחובר.'")

# ── DSRA assumptions ──
rep("'as.dsra': 'Debt Service Reserve'",   "'as.dsra': 'רזרבת שירות חוב'")
rep("'as.dsraEnabled': 'DSRA enabled'",    "'as.dsraEnabled': 'DSRA מופעל'")
rep("'as.dsraEnabledNote': 'Auto-sizes a reserve to bridge DSCR shortfalls'",
    "'as.dsraEnabledNote': 'קובע גודל אוטומטי של רזרבה לגישור על חסרי DSCR'")
rep("'as.dsraTargetDSCR': 'Target DSCR for sizing (×)'",
    "'as.dsraTargetDSCR': 'DSCR יעד לקביעת גודל (×)'")
rep("'as.dsraSweepPct': '2028 pre-opening NCF sweep (%)'",
    "'as.dsraSweepPct': 'סחיפת NCF טרום פתיחה 2028 (%)'")
rep("'as.dsraSweepNote': '2028 is the pre-opening season — the first year cash is available before full hotel operations. This one-time sweep seeds the reserve; subsequent years replenish from post-coverage surplus.'",
    "'as.dsraSweepNote': '2028 היא עונת טרום הפתיחה — השנה הראשונה שבה תזרים מזומנים זמין לפני פעילות מלון מלאה. סחיפה חד-פעמית זו זורעת את הרזרבה; שנים עוקבות מתחדשות מעודף לאחר כיסוי.'")
rep("'as.dsraReplenishPriority': 'Replenishment priority (% of post-DS surplus)'",
    "'as.dsraReplenishPriority': 'עדיפות חידוש (% מהעודף לאחר DS)'")
rep("'as.dsraRepayThreshold': 'Consecutive stable years before partner repayment'",
    "'as.dsraRepayThreshold': 'שנות יציבות רצופות לפני פירעון שותף'")
rep("'as.dsraRepayThresholdNote': 'The subordinated partner advance begins repayment only once the reserve is fully topped up AND the hotel has cleared the target DSCR for this many consecutive years.'",
    "'as.dsraRepayThresholdNote': 'ההלוואה הנדחית של השותף מתחילה להיפרע רק לאחר מילוי הרזרבה במלואה ואחרי שהמלון עבר את יעד ה-DSCR במספר שנים רצופות כה.'")
rep("'as.wcDsraNote': 'Locks DSRA share, reduces flex'",
    "'as.wcDsraNote': 'נועל נתח DSRA, מפחית גמישות'")

# ── Portfolio OPEX P&L rows ──
rep("'pnl.portfolioStaff': 'Portfolio Staff'",     "'pnl.portfolioStaff': 'צוות תיק הנכסים'")
rep("'pnl.portfolioServices': 'Portfolio Services'","'pnl.portfolioServices': 'שירותי תיק הנכסים'")
rep("'pnl.portfolioOverhead': 'Portfolio Overhead'","'pnl.portfolioOverhead': 'הוצאות כלליות של תיק הנכסים'")
rep("'pnl.portfolioPreOpening': 'Pre-opening amort.'","'pnl.portfolioPreOpening': 'פחת טרום פתיחה'")

# ── DSRA P&L rows ──
rep("'pnl.dsraDraw': 'DSRA Draw'",                    "'pnl.dsraDraw': 'משיכת DSRA'")
rep("'pnl.dsraBalance': 'DSRA Balance (EoP)'",        "'pnl.dsraBalance': 'יתרת DSRA (ס\"פ)'")
rep("'pnl.effectiveDSCR': 'Effective DSCR (incl. DSRA)'","'pnl.effectiveDSCR': 'DSCR אפקטיבי (כולל DSRA)'")
rep("'pnl.partnerRepayment': 'Partner Advance Repayment'","'pnl.partnerRepayment': 'פירעון מקדמת שותף'")

# ── DSRA tile ──
rep("'dsra.sectionTitle': 'Debt Service Reserve Account'",
    "'dsra.sectionTitle': 'חשבון רזרבת שירות חוב'")
rep("'dsra.sectionSub': 'Activates automatically when any projected year falls short of the target coverage ratio'",
    "'dsra.sectionSub': 'מופעל אוטומטית כאשר שנה חזויה מפגרת אחר יעד הכיסוי'")
rep("'dsra.target': 'DSRA Target'",                "'dsra.target': 'יעד DSRA'")
rep("'dsra.targetSub': 'Worst-year shortfall vs. target DSCR'","'dsra.targetSub': 'חוסר השנה הגרועה מול יעד DSCR'")
rep("'dsra.sweep': '2028 Surplus Sweep'",          "'dsra.sweep': 'סחיפת עודף 2028'")
rep("'dsra.sweepSub': '% of 2028 post-tax NCF swept to DSRA'","'dsra.sweepSub': '% NCF לאחר מס 2028 המועבר ל-DSRA'")
rep("'dsra.partnerAdvance': 'Partner Advance'",    "'dsra.partnerAdvance': 'מקדמת שותף'")
rep("'dsra.partnerAdvanceSub': 'Subordinated shareholder loan at financial close'",
    "'dsra.partnerAdvanceSub': 'הלוואת בעל מניות נדחית בסגירה הפיננסית'")
rep("'dsra.dealTermSub': 'sweep + partner advance'","'dsra.dealTermSub': 'סחיפה + מקדמת שותף'")
rep("'dsra.dashKpiLabel': 'DSRA Reserve'",         "'dsra.dashKpiLabel': 'רזרבת DSRA'")
rep("'dsra.dashKpiSub': 'partner advance'",        "'dsra.dashKpiSub': 'מקדמת שותף'")
rep("'dsra.assumptionsCaption': 'The reserve activates automatically whenever any projected year falls short of target DSCR × debt service. The four parameters above control how it is sized, funded, replenished, and when the partner advance is repaid.'",
    "'dsra.assumptionsCaption': 'הרזרבה מופעלת אוטומטית כאשר שנה חזויה מפגרת אחר DSCR יעד × שירות חוב. ארבעה פרמטרים שולטים באיך היא מגדירה גודל, ממומנת, מתחדשת ומתי נפרעת מקדמת השותף.'")
rep("'dsra.debtCoverageCaption': 'When CFADS falls short, the engine draws from this reserve to supplement coverage — visible as Effective DSCR in the P&L. The balance is replenished from post-coverage surplus in stable years.'",
    "'dsra.debtCoverageCaption': 'כאשר CFADS מפגרים, המנוע שואב מרזרבה זו לכיסוי משלים — מוצג כ-DSCR אפקטיבי בדוחות. היתרה מתחדשת מעודף לאחר כיסוי בשנות יציבות.'")
rep("'dsra.financingCaption': 'Activated when CFADS falls short of target DSCR × debt service in any projected year. Sized to the worst-year gap: funded first from a 2028 post-tax surplus sweep, with a subordinated partner advance covering any residual.'",
    "'dsra.financingCaption': 'מופעל כאשר CFADS מפגרים אחר DSCR יעד × שירות חוב בשנה חזויה כלשהי. מגדיר גודל לחוסר השנה הגרועה: ממומן תחילה מסחיפת עודף NCF לאחר מס 2028, עם מקדמת שותף נדחית לכל יתרה.'")
rep("'dsra.pnlCaption': 'DSRA Draw supplements CFADS in shortfall years only — it does not affect EBITDA, NCF, or equity IRR. Partner Advance Repayment triggers once the reserve is fully replenished and N consecutive years have cleared the target ratio.'",
    "'dsra.pnlCaption': 'משיכת DSRA משלימה את CFADS רק בשנות חוסר — אינה משפיעה על EBITDA, NCF או IRR equity. פירעון מקדמת שותף מופעל ברגע שהרזרבה מחודשת במלואה ו-N שנות יציבות רצופות חצו את היעד.'")

# ── Portfolio OPEX tab ──
rep("'as.portfolioOpexTab': 'Portfolio OPEX'",     "'as.portfolioOpexTab': 'OPEX תיק הנכסים'")
rep("'as.portfolioOpex.tabIntro': 'Undistributed overhead shared across all properties.'",
    "'as.portfolioOpex.tabIntro': 'הוצאות כלליות בלתי מחולקות משותפות לכל הנכסים.'")
rep("'as.portfolioOpex.totalBadge': 'Total Portfolio OPEX'","'as.portfolioOpex.totalBadge': 'סה\"כ OPEX תיק הנכסים'")
rep("'as.portfolioOpex.yearRoundFixed': 'Year-round fixed'","'as.portfolioOpex.yearRoundFixed': 'קבוע כל השנה'")
rep("'as.portfolioOpex.variable': 'Variable'",     "'as.portfolioOpex.variable': 'משתנה'")
rep("'as.portfolioOpex.staffSection': 'Shared Staff'","'as.portfolioOpex.staffSection': 'צוות משותף'")
rep("'as.portfolioOpex.servicesSection': 'Shared Services & R&M'","'as.portfolioOpex.servicesSection': 'שירותים משותפים ותחזוקה'")
rep("'as.portfolioOpex.overheadSection': 'Shared Overhead'","'as.portfolioOpex.overheadSection': 'הוצאות כלליות משותפות'")
rep("'as.portfolioOpex.preOpeningSection': 'Pre-opening Amortisation'","'as.portfolioOpex.preOpeningSection': 'פחת טרום פתיחה'")
rep("'as.portfolioOpex.addRole': 'Add role'",      "'as.portfolioOpex.addRole': 'הוספת תפקיד'")
rep("'as.portfolioOpex.addService': 'Add service'","'as.portfolioOpex.addService': 'הוספת שירות'")
rep("'as.portfolioOpex.addOverhead': 'Add overhead'","'as.portfolioOpex.addOverhead': 'הוספת הוצאה כללית'")
rep("'as.portfolioOpex.roleYearRound': 'Year-round'","'as.portfolioOpex.roleYearRound': 'כל השנה'")
rep("'as.portfolioOpex.roleSeasonal': 'Seasonal'", "'as.portfolioOpex.roleSeasonal': 'עונתי'")
rep("'as.portfolioOpex.preOpeningTotal': 'Pre-opening total (€)'","'as.portfolioOpex.preOpeningTotal': 'סה\"כ טרום פתיחה (€)'")
rep("'as.portfolioOpex.preOpeningAmortYears': 'Amortisation years'","'as.portfolioOpex.preOpeningAmortYears': 'שנות פחת'")
rep("'as.portfolioOpex.preOpeningStartYear': 'Start year'","'as.portfolioOpex.preOpeningStartYear': 'שנת התחלה'")
rep("'as.portfolioOpex.annualAmort': 'Annual amortisation'","'as.portfolioOpex.annualAmort': 'פחת שנתי'")
rep("'as.portfolioOpex.migrationBanner': 'Migration v1→v2: Housekeeping moved from per-template to Portfolio OPEX.'",
    "'as.portfolioOpex.migrationBanner': 'מעבר v1→v2: משק בית הועבר מלפי-תבנית ל-OPEX תיק הנכסים.'")
rep("'as.portfolioOpex.migrationDismiss': 'Dismiss'","'as.portfolioOpex.migrationDismiss': 'סגור'")
rep("'as.portfolioOpex.sizingBasis': 'Sizing basis'","'as.portfolioOpex.sizingBasis': 'בסיס קביעת גודל'")
rep("'as.portfolioOpex.bankingTooltip': '≈ Revenue × direct-booking mix × blended card processing rate. Default: €1.9M × 50% × 3.2% ≈ €30K.'",
    "'as.portfolioOpex.bankingTooltip': '≈ הכנסות × תמהיל הזמנה ישירה × שיעור עיבוד כרטיס ממוצע. ברירת מחדל: €1.9M × 50% × 3.2% ≈ €30K.'")
rep("'as.portfolioOpex.insuranceTooltip': 'D&O, BI, key-person, cyber, events liability — one portfolio-wide policy distinct from per-property building cover.'",
    "'as.portfolioOpex.insuranceTooltip': 'D&O, BI, אדם מפתח, סייבר, חבות אירועים — פוליסה אחת ברמת תיק הנכסים נפרדת מכיסוי בניין לכל נכס.'")
rep("'as.portfolioOpex.colRole': 'Role'",          "'as.portfolioOpex.colRole': 'תפקיד'")
rep("'as.portfolioOpex.colMonthlyGross': 'Monthly gross'","'as.portfolioOpex.colMonthlyGross': 'ברוטו חודשי'")
rep("'as.portfolioOpex.colMonths': 'Months/yr'",   "'as.portfolioOpex.colMonths': 'חודשים/שנה'")
rep("'as.portfolioOpex.colBurden': 'Burden ×'",    "'as.portfolioOpex.colBurden': 'נטל ×'")
rep("'as.portfolioOpex.colAllowances': 'Allowances'","'as.portfolioOpex.colAllowances': 'תוספות'")
rep("'as.portfolioOpex.colNetMonthly': 'Net/mo (approx)'","'as.portfolioOpex.colNetMonthly': 'נטו/חודש (מוערך)'")
rep("'as.portfolioOpex.colNetMonthlyTooltip': 'Estimated employee take-home: gross minus EFKA (13.87%) and simplified Greek income-tax brackets. Not a payroll calculation.'",
    "'as.portfolioOpex.colNetMonthlyTooltip': 'שכר עובד נטו מוערך: ברוטו פחות ביטוח לאומי (13.87%) ומדרגות מס הכנסה יווניות מפושטות. אינו חישוב שכר.'")
rep("'as.portfolioOpex.colHeadcount': 'FTE'",      "'as.portfolioOpex.colHeadcount': 'עובדים'")
rep("'as.portfolioOpex.colHeadcountTooltip': 'Number of workers in this role. Multiplies gross salary, burden, and allowances.'",
    "'as.portfolioOpex.colHeadcountTooltip': 'מספר עובדים בתפקיד זה. מכפיל שכר ברוטו, נטל ותוספות.'")
rep("'as.portfolioOpex.poolCount': 'Pools'",       "'as.portfolioOpex.poolCount': 'בריכות'")
rep("'as.portfolioOpex.poolsAt': 'pools ×'",       "'as.portfolioOpex.poolsAt': 'בריכות ×'")
rep("'as.portfolioOpex.poolCostPerUnit': '€/pool/yr'","'as.portfolioOpex.poolCostPerUnit': '€/בריכה/שנה'")
rep("'as.portfolioOpex.poolPerPoolYear': '(materials + service)'","'as.portfolioOpex.poolPerPoolYear': '(חומרים + שירות)'")
rep("'as.portfolioOpex.colAnnual': 'Annual (burdened)'","'as.portfolioOpex.colAnnual': 'שנתי (עם נטל)'")

# ── OTA Distribution ──
rep("'as.otaDistribution': 'OTA Distribution'",   "'as.otaDistribution': 'פיזור OTA'")
rep("'as.otaDistribution.note': 'Effective rate = commission × OTA share. OTA share 1 = 100% via OTA; 0 = 100% direct.'",
    "'as.otaDistribution.note': 'שיעור אפקטיבי = עמלה × נתח OTA. נתח OTA 1 = 100% דרך OTA; 0 = 100% ישיר.'")
rep("'as.otaDistribution.yearHeader': 'Year'",     "'as.otaDistribution.yearHeader': 'שנה'")
rep("'as.otaDistribution.commissionHeader': 'OTA Commission'","'as.otaDistribution.commissionHeader': 'עמלת OTA'")
rep("'as.otaDistribution.otaShareHeader': 'OTA Share'","'as.otaDistribution.otaShareHeader': 'נתח OTA'")
rep("'as.otaDistribution.effectiveHeader': 'Effective Rate'","'as.otaDistribution.effectiveHeader': 'שיעור אפקטיבי'")
rep("'field.otaCommissionRate': 'OTA platform commission (scalar fallback)'",
    "'field.otaCommissionRate': 'עמלת פלטפורמת OTA (ערך ברירת מחדל)'")
rep("'field.otaShare': 'OTA share — opening year'","'field.otaShare': 'נתח OTA — שנת פתיחה'")
rep("'field.otaShareDecline': 'Direct channel growth (per year)'","'field.otaShareDecline': 'צמיחת ערוץ ישיר (לשנה)'")

# ── bank.about types ──
rep("'bank.about.typeLuxuryVilla':    'Luxury villa'","'bank.about.typeLuxuryVilla':    'וילת יוקרה'")
rep("'bank.about.typeHotelRooms':     'Hotel rooms'", "'bank.about.typeHotelRooms':     'חדרי מלון'")

# ── VAT Cashflow ──
rep("'bank.vatCashflow.title': 'Construction VAT Cashflow'","'bank.vatCashflow.title': 'תזרים ΦΠΑ הבנייה'")
rep("'bank.vatCashflow.sub': 'VAT paid on construction invoices · 2-quarter refund lag · Revolving covenant €470K'",
    "'bank.vatCashflow.sub': 'מע\"מ ששולם על חשבוניות בנייה · עיכוב החזר 2 רבעונים · קובנאנט מתחדש €470K'")
rep("'bank.vatCashflow.colQuarter': 'Quarter'",    "'bank.vatCashflow.colQuarter': 'רבעון'")
rep("'bank.vatCashflow.colVatPaid': 'VAT Paid'",   "'bank.vatCashflow.colVatPaid': 'מע\"מ ששולם'")
rep("'bank.vatCashflow.colVatRefund': 'VAT Refund'","'bank.vatCashflow.colVatRefund': 'החזר מע\"מ'")
rep("'bank.vatCashflow.colNetFloat': 'Net Float'", "'bank.vatCashflow.colNetFloat': 'השפעה נטו'")
rep("'bank.vatCashflow.covenantBreach': 'BREACH'", "'bank.vatCashflow.covenantBreach': 'הפרה'")
rep("'bank.vatCashflow.withinCovenant': 'All quarters within the €470K revolving covenant'",
    "'bank.vatCashflow.withinCovenant': 'כל הרבעונים בתוך קובנאנט מתחדש €470K'")
rep("'bank.vatCashflow.lagNote': 'VAT-liable CapEx €7,589,108 @ 24% · Draw schedule 20/50/30% · 2-quarter refund lag'",
    "'bank.vatCashflow.lagNote': 'CAPEX חייב מע\"מ €7,589,108 @ 24% · לוח משיכה 20/50/30% · עיכוב החזר 2 רבעונים'")
rep("'bank.vatCashflow.postRefundNote': 'Post-construction refund €273,208 expected Q1-Q2 2029 — improves opening-year cash'",
    "'bank.vatCashflow.postRefundNote': 'החזר לאחר בנייה €273,208 צפוי Q1-Q2 2029 — משפר תזרים שנת פתיחה'")

# ── Page intros ──
rep("'dash.pageIntro': 'Track the deal from every angle: term sheet, DSCR, returns, and live operating proof — all in one view.'",
    "'dash.pageIntro': 'עקוב אחר העסקה מכל זווית: דף תנאים, DSCR, תשואות והוכחת פעילות חיה — הכל בתצוגה אחת.'")
rep("'pnl.pageIntro': 'An 11-year Revenue → EBITDA → Debt Service → NCF table, updated live for every path and scenario.'",
    "'pnl.pageIntro': 'טבלת 11 שנים הכנסות → EBITDA → שירות חוב → NCF, מתעדכנת בזמן אמת לכל מסלול ותרחיש.'")
rep("'sc.pageIntro': 'Four scenarios and four financing paths side-by-side at the stabilised year — the banker\\'s stress-test view.'",
    "'sc.pageIntro': 'ארבעה תרחישים וארבעה מסלולי מימון זה לצד זה בשנת היציבות — תצוגת מבחן לחץ של הבנקאי.'")
rep("'capex.pageIntro': 'Total project cost by category and property — edit any blue value and the whole model recomputes.'",
    "'capex.pageIntro': 'עלות כוללת לפרויקט לפי קטגוריה ונכס — ערוך ערך כחול כלשהו וכל המודל מחשב מחדש.'")
rep("'sens.pageIntro': 'Flex one driver at a time — interest rate, occupancy, ADR, working capital — and see DSCR and IRR respond.'",
    "'sens.pageIntro': 'שנה גורם אחד בכל פעם — ריבית, תפוסה, ADR, הון חוזר — וראה DSCR ו-IRR מגיבים.'")
rep("'opco.pageIntro': 'How the PropCo / OpCo two-entity structure separates property ownership from operations — and what it means for the bank\\'s DSCR.'",
    "'opco.pageIntro': 'כיצד מבנה שתי הישויות PropCo / OpCo מפריד בין בעלות על נכסים לבין פעילות — ומה זה אומר עבור DSCR של הבנק.'")
rep("'team.pageIntro': 'Invite collaborators by email, assign roles, and see who has already accessed the model.'",
    "'team.pageIntro': 'הזמן שותפי עבודה באמצעות אימייל, הקצה תפקידים וראה מי כבר ניגש למודל.'")
rep("'returns.pageIntro': 'Equity yield, MOIC, payback years, and IRR — sponsor-side economics at the active exit year and financing path.'",
    "'returns.pageIntro': 'תשואת הון, MOIC, שנות החזר ו-IRR — כלכלת ספונסר בשנת היציאה הפעילה ומסלול המימון.'")
rep("'dc.pageIntro': 'Year-by-year DSCR trajectory and all coverage ratios a credit committee underwrites against.'",
    "'dc.pageIntro': 'מסלול DSCR שנה אחר שנה וכל יחסי הכיסוי שוועדת אשראי מעריכה מולם.'")
rep("'financing.pageIntro': 'All four financing structures compared side-by-side.'",
    "'financing.pageIntro': 'כל ארבע מבני המימון מושווים זה לצד זה.'")
rep("'ct.pageIntro': 'Equity distribution at the active exit year — three-layer founder waterfall, investor stakes, MOIC, and IRR per stakeholder.'",
    "'ct.pageIntro': 'פיזור הון בשנת היציאה הפעילה — מפל מייסדים בשלוש שכבות, נתחי משקיעים, MOIC ו-IRR לכל בעל מניות.'")
rep("'lex.pageIntro': 'Every formula the model runs — CAPEX, revenue, EBITDA, PMT, DSCR, break-even, collateral, and all four financing paths.'",
    "'lex.pageIntro': 'כל נוסחה שהמודל מריץ — CAPEX, הכנסות, EBITDA, PMT, DSCR, נקודת איזון, בטחונות וכל ארבעת מסלולי המימון.'")
rep("'as.pageIntro': 'The model\\'s cockpit: edit any blue value across six tabs and every chart, KPI, and table recalculates instantly.'",
    "'as.pageIntro': 'לוח הבקרה של המודל: ערוך ערך כחול כלשהו בשש כרטיסיות וכל גרף, KPI וטבלה מחשבים מחדש באופן מיידי.'")

# ── Presentation keys ──
rep("'presentation.s11.grantStrategy': 'Under the Development Law (Grant) financing path a non-repayable state grant covers 60% of eligible non-land construction costs. The grant reduces the loan quantum, annual debt service, and expands DSCR headroom above the 1.25× covenant floor — without any change to the underlying business plan assumptions.'",
    "'presentation.s11.grantStrategy': 'במסלול מימון חוק הפיתוח (מענק) מענק ממשלתי שאינו ניתן להחזר מכסה 60% מעלויות הבנייה הכשירות שאינן קרקע. המענק מקטין את גובה ההלוואה, שירות החוב השנתי ומרחיב את מרחב DSCR מעל רצפת הקובנאנט 1.25× — ללא כל שינוי בהנחות תכנית העסקים הבסיסיות.'")

rep("'presentation.s2.p5': '5. A zero-inflation assumption is applied throughout: no nominal revenue uplift from HICP, no cost deflation. Every projected euro of revenue is valued at 2026 purchasing power for the full 13-year horizon.'",
    "'presentation.s2.p5': '5. הנחת אפס אינפלציה מוחלת לאורך כל התקופה: אין עלייה נומינלית בהכנסות מ-HICP, אין דפלציה בעלויות. כל יורו הכנסות חזוי מוערך בכוח קנייה של 2026 לאורך כל אופק 13 שנה.'")

rep("'presentation.kpi.ownerEquity': 'Owner Equity'","'presentation.kpi.ownerEquity': 'הון בעלים'")

rep("'presentation.cover.tagline': 'An expansion of a proven operation — same operator, same neighbourhood, same model.'",
    "'presentation.cover.tagline': 'הרחבה של פעולה מוכחת — אותו מפעיל, אותה שכונה, אותו מודל.'")

rep("'presentation.s1.loanRequestCol': 'The Loan Request'","'presentation.s1.loanRequestCol': 'בקשת ההלוואה'")
rep("'presentation.s1.collateralCol': 'The Collateral Case'","'presentation.s1.collateralCol': 'מקרה הביטחונות'")
rep("'presentation.s1.phaseTable.header': 'Phased Drawdown Structure'","'presentation.s1.phaseTable.header': 'מבנה משיכה שלבית'")
rep("'presentation.s1.phaseTable.phase1': 'Phase 1 — Land & Permits'","'presentation.s1.phaseTable.phase1': 'שלב 1 — קרקע והיתרים'")
rep("'presentation.s1.phaseTable.phase2': 'Phase 2 — Construction & FF&E'","'presentation.s1.phaseTable.phase2': 'שלב 2 — בנייה וציוד'")
rep("'presentation.s1.phaseTable.wc': 'Working Capital Revolving Facility'","'presentation.s1.phaseTable.wc': 'מסגרת אשראי הון חוזר מתחדשת'")
rep("'presentation.s1.operationalTarget': 'Operational target: Summer 2028 opening. First full-year debt service 2029.'",
    "'presentation.s1.operationalTarget': 'יעד תפעולי: פתיחה קיץ 2028. שירות חוב שנתי מלא ראשון 2029.'")

rep("'presentation.s2.intro': 'Villa Lev is an 8-bedroom luxury property on Antiparos that has been in operation since 2022. The table below presents verified annual results sourced from the platform\\'s live Firestore dashboard.'",
    "'presentation.s2.intro': 'Villa Lev היא נכס יוקרה בן 8 חדרי שינה באנטיפרוס שפועל מאז 2022. הטבלה הבאה מציגה תוצאות שנתיות מאומתות ממרכז ה-Firestore החי של הפלטפורמה.'")

rep("'presentation.s2.resultsTable.header': 'Operational Results — Villa Lev (Verified)'",
    "'presentation.s2.resultsTable.header': 'תוצאות תפעוליות — Villa Lev (מאומת)'")
rep("'presentation.s2.season2026.header': '2026 Season In Progress'","'presentation.s2.season2026.header': 'עונת 2026 בעיצומה'")
rep("'presentation.s2.conservative.header': 'Why Projections Are Conservative'","'presentation.s2.conservative.header': 'מדוע התחזיות שמרניות'")
rep("'presentation.s2.marketRankings.header': 'Market Rankings'","'presentation.s2.marketRankings.header': 'דירוגי שוק'")
rep("'presentation.s3.airportTable.header': 'Airport Arrivals — Paros vs Cyclades Peers'",
    "'presentation.s3.airportTable.header': 'נחיתות שדה תעופה — פארוס לעומת עמיתי קיקלאדים'")
rep("'presentation.s3.tailwinds.header': 'Three Structural Tailwinds'","'presentation.s3.tailwinds.header': 'שלושה גורמי רוח גבית מבניים'")
rep("'presentation.s3.hotelAdr.header': 'Hotel ADR Benchmarks — Paros / Cyclades'",
    "'presentation.s3.hotelAdr.header': 'ספסולי ADR מלון — פארוס / קיקלאדים'")
rep("'presentation.s3.airdna.header': 'AirDNA Villa Landscape — Paros / Antiparos'",
    "'presentation.s3.airdna.header': 'נוף וילות AirDNA — פארוס / אנטיפרוס'")

rep("'presentation.s4.propA.desc': 'Two twin villas (3-bedroom + 4-bedroom), each with own entrance, private pool, and sea views. Target ADR €3,500/night net.'",
    "'presentation.s4.propA.desc': 'שתי וילות תאומות (3 + 4 חדרי שינה), כל אחת עם כניסה נפרדת, בריכה פרטית ונוף ים. ADR יעד €3,500/לילה נטו.'")

rep("'presentation.s4.propB.desc': 'Four boutique suites — 2 Standard (40m²) and 2 Double (65m²) — plus hamam/sauna/gym and indoor/outdoor events space.'",
    "'presentation.s4.propB.desc': 'ארבע סוויטות בוטיק — 2 סטנדרטיות (40מ\"ר) ו-2 כפולות (65מ\"ר) — בתוספת חמאם/סאונה/חדר כושר ושטח אירועים פנים/חוץ.'")

rep("'presentation.s4.suiteTable.header': 'Suite Pricing'","'presentation.s4.suiteTable.header': 'תמחור סוויטות'")

rep("'presentation.s4.events.note': 'Events and retreats income is not modelled in the Conservative case — it is unmodelled upside with proven demand.'",
    "'presentation.s4.events.note': 'הכנסות מאירועים וריטריטים אינן ממודלות בתרחיש השמרני — פוטנציאל עלייה שאינו ממודל עם ביקוש מוכח.'")

rep("'presentation.s5.intro': 'All projections use static assumptions with no compounding. The villa ADR in the model (€3,500) is below Villa Lev\\'s 2025 live rate (€3,584).'",
    "'presentation.s5.intro': 'כל התחזיות משתמשות בהנחות סטטיות ללא הרכבה. ה-ADR של הוילה במודל (€3,500) נמוך ממחיר החי של Villa Lev 2025 (€3,584).'")

rep("'presentation.s5.rampTable.header': 'Ramp-Up Profile — Realistic Scenario (Live Model)'",
    "'presentation.s5.rampTable.header': 'פרופיל עלייה הדרגתית — תרחיש ריאלי (מודל חי)'")
rep("'presentation.s5.opexTable.header': 'Operating Cost Structure (Annual)'","'presentation.s5.opexTable.header': 'מבנה עלויות תפעוליות (שנתי)'")
rep("'presentation.s6.breakeven.header': 'Break-Even Comparison — By Scenario & Path'",
    "'presentation.s6.breakeven.header': 'השוואת נקודת איזון — לפי תרחיש ומסלול'")
rep("'presentation.s6.risks.header': 'Risk Register & Mitigating Factors'","'presentation.s6.risks.header': 'רשם סיכונים וגורמים מפחיתים'")
rep("'presentation.s6.stressNote': 'All three scenarios clear the 1.25× DSCR covenant from 2030 onward. The 2029 trough is covered 6.1× by the €470K working capital reserve.'",
    "'presentation.s6.stressNote': 'שלושת התרחישים עוברים את קובנאנט DSCR 1.25× מ-2030 ואילך. שפל 2029 מכוסה 6.1× ברזרבת ההון החוזר של €470K.'")

rep("'presentation.s6.dsraNote': 'Liquidity & DSRA: A €470,000 revolving working capital facility is held in escrow throughout the ramp period. It is self-liquidating by end of each peak season.'",
    "'presentation.s6.dsraNote': 'נזילות ו-DSRA: מסגרת הון חוזר מתחדשת בסך €470,000 מוחזקת ב-escrow לאורך כל תקופת העלייה. היא מסלקת עצמה בסוף כל עונת שיא.'")

rep("'presentation.s7.financing.header': 'Per-Property Financing Structure'","'presentation.s7.financing.header': 'מבנה מימון לנכס'")
rep("'presentation.s7.collateral.header': 'Collateral & Asset Coverage'","'presentation.s7.collateral.header': 'ביטחונות וכיסוי נכסים'")

rep("'presentation.s7.dsNote': 'Annual debt service is fully amortising from 2029. No balloon. Loan balance zero at maturity.'",
    "'presentation.s7.dsNote': 'שירות החוב השנתי מוחזר במלואו מ-2029. ללא בלון. יתרת הלוואה אפס בפירעון.'")

rep("'presentation.s7.timeline.header': 'Project Timeline'","'presentation.s7.timeline.header': 'לוח זמנים לפרויקט'")
rep("'presentation.s8.corporate.header': 'Corporate Structure'","'presentation.s8.corporate.header': 'מבנה תאגידי'")

rep("'presentation.s8.eytan.bio': 'Eytan is a multi-sector entrepreneur who has led ventures across Europe, Africa, India, Israel and the U.S., building companies from inception to 8-figure revenues. Over 25 years, he has operated primarily in the tech industry, founding firms that grew to millions of users and managing a publicly listed telecom provider valued at €200 million. In recent years, he expanded into boutique hospitality, developing Villa Lev — an 8-bedroom luxury property on Antiparos — which within two years became the #1 ranked rental property on the island and entered the global top 5% of all Airbnb listings. Villa Lev Group is the direct extension of that proven model.'",
    "'presentation.s8.eytan.bio': 'איתן הוא יזם רב-תחומי שהוביל מיזמים ברחבי אירופה, אפריקה, הודו, ישראל וארה\"ב, בנה חברות מאפס להכנסות של 8 ספרות. ב-25+ שנה, פעל בעיקר בתעשיית הטכנולוגיה, ייסד חברות שגדלו למיליוני משתמשים וניהל ספק תקשורת ציבורי הנסחר בשווי של €200 מיליון. בשנים האחרונות התרחב להכנסת אורחים בוטיק, ופיתח את Villa Lev — נכס יוקרה בן 8 חדרי שינה באנטיפרוס — שבתוך שנתיים הפך לנכס השכרה מדורג #1 באי ונכנס ל-5% העליונים עולמית מכל המלונות ב-Airbnb. Villa Lev Group היא ההרחבה הישירה של מודל מוכח זה.'")

rep("'presentation.s8.team.header': 'Management & Team'","'presentation.s8.team.header': 'הנהלה וצוות'")
rep("'presentation.s8.alignment.header': 'Operator Alignment — Revenue Floors & Performance Ratchet'",
    "'presentation.s8.alignment.header': 'יישור מפעיל — רצפות הכנסה ו-Performance Ratchet'")

rep("'presentation.s9.intro': 'The commercial loan is the base case presented throughout this document. Two grant/subsidy instruments exist that materially improve the financing structure.'",
    "'presentation.s9.intro': 'ההלוואה המסחרית היא מקרה הבסיס המוצג לאורך מסמך זה. קיימים שני מכשירי מענק/סובסידיה המשפרים מהותית את מבנה המימון.'")

rep("'presentation.s9.grantImpact.header': 'Development Law Grant — Impact on Loan Structure'",
    "'presentation.s9.grantImpact.header': 'מענק חוק פיתוח — השפעה על מבנה ההלוואה'")
rep("'presentation.s9.comparison.header': 'Financing Path Comparison'","'presentation.s9.comparison.header': 'השוואת מסלולי מימון'")

rep("'presentation.s9.pathNote': 'The highlighted column reflects the currently selected financing path.'",
    "'presentation.s9.pathNote': 'העמודה המסומנת משקפת את מסלול המימון הפעיל הנבחר כיום.'")

rep("'presentation.s10.keyPoints.header': 'Five Key Points'","'presentation.s10.keyPoints.header': 'חמש נקודות מפתח'")
rep("'presentation.s10.portfolioAtGlance.header': 'Portfolio at a Glance'","'presentation.s10.portfolioAtGlance.header': 'תיק במבט אחד'")

rep("'presentation.s10.closingLine': 'Villa Lev Group is ready to receive and deploy capital. The operator has a live track record, the sites are identified, and the model is running.'",
    "'presentation.s10.closingLine': 'Villa Lev Group מוכנה לקבל ולהפעיל הון. למפעיל יש רקורד חי, האתרים מזוהים, והמודל פועל.'")

rep("'presentation.kpi.portfolioValue': 'Completed Asset Value'","'presentation.kpi.portfolioValue': 'שווי נכסים מושלמים'")
rep("'presentation.kpi.ltvAtCompletion': 'LTV at Completion'","'presentation.kpi.ltvAtCompletion': 'LTV בהשלמה'")

rep("'presentation.s4.plotIntro': 'Three plots in the Agios Georgios neighbourhood of Antiparos — the same neighbourhood as Villa Lev. All three sit within the official village building limits (οικισμός) under Government Gazette (FEK) designation. Buildability is not a matter of interpretation: it is a direct consequence of the FEK. Permit risk is structurally mitigated through phased financing and conditional Phase 2 drawdown following permit issuance. All plots have panoramic sea views and are within walking distance of the beach. Negotiations are at an advanced stage on all three.'",
    "'presentation.s4.plotIntro': 'שלושה מגרשים בשכונת Agios Georgios באנטיפרוס — אותה שכונה כמו Villa Lev. כולם נמצאים בתחום גבולות הבנייה הרשמיים של הכפר (οικισμός) לפי ייעוד ה-ΦΕΚ. יכולת הבנייה אינה עניין של פרשנות: היא נגזרת ישירה של ה-ΦΕΚ. סיכון ההיתרים מוקטן מבנית באמצעות מימון שלבי ומשיכת שלב 2 מותנית בהנפקת ההיתר. לכל המגרשים נוף ים פנורמי והם במרחק הליכה מהחוף. משא ומתן בשלב מתקדם בכל שלושת המגרשים.'")

rep("'presentation.s4.capex.header': 'CAPEX — Detailed Cost Breakdown'","'presentation.s4.capex.header': 'CAPEX — פירוט עלויות'")
rep("'presentation.s5.realisticTable.header': 'Realistic Scenario — Stabilised Year (2031)'",
    "'presentation.s5.realisticTable.header': 'תרחיש ריאלי — שנת יציבות (2031)'")
rep("'presentation.s5.upsideTable.header': 'Upside Scenario — Stabilised Year (2031)'",
    "'presentation.s5.upsideTable.header': 'תרחיש עלייה — שנת יציבות (2031)'")
rep("'presentation.s5.downsideTable.header': 'Downside Stress Scenario'","'presentation.s5.downsideTable.header': 'תרחיש לחץ ירידה'")
rep("'presentation.s9.instruments.header': 'Financing Instruments — At a Glance'",
    "'presentation.s9.instruments.header': 'מכשירי מימון — במבט אחד'")

# ── finComp ──
rep("'finComp.totalLoanDrawn':            'Total loan drawn'","'finComp.totalLoanDrawn':            'הלוואה כוללת נלקחה'")
rep("'finComp.grantReceived':             'Grant received'","'finComp.grantReceived':             'מענק שהתקבל'")
rep("'finComp.equityRequired':            'Equity required'","'finComp.equityRequired':            'הון עצמי נדרש'")
rep("'finComp.annualDebtService':         'Annual debt service'","'finComp.annualDebtService':         'שירות חוב שנתי'")
rep("'finComp.stabilisedDSCR':            'DSCR — Stabilised'","'finComp.stabilisedDSCR':            'DSCR — מייצב'")
rep("'finComp.supplementaryLoan':         'Supplementary commercial loan'","'finComp.supplementaryLoan':         'הלוואה מסחרית משלימה'")
rep("'finComp.equitySavingVsCommercial':  'Equity saving vs. commercial'","'finComp.equitySavingVsCommercial':  'חיסכון בהון עצמי לעומת מסחרי'")

# ── Bank fee disclosure ──
rep("'bank.dscr.mgmtFeeNote':      'EBITDA shown post management fee (ManCo: 5% of gross revenue)'",
    "'bank.dscr.mgmtFeeNote':      'EBITDA מוצג לאחר דמי ניהול (ManCo: 5% מהכנסות ברוטו)'")
rep("'bank.termsheet.opCostLabel': 'Operating cost'","'bank.termsheet.opCostLabel': 'עלות תפעולית'")

# ── Stress link ──
rep("'bank.stressLink': 'Full sensitivity analysis →'","'bank.stressLink': 'ניתוח רגישות מלא →'")

# ── Bank coverage group heading ──
rep("'bank.coverage.groupHeading': 'Credit Coverage Ratios'","'bank.coverage.groupHeading': 'יחסי כיסוי אשראי'")

# ── Admin about ──
rep("'admin.about.heading':              'About the project'","'admin.about.heading':              'אודות הפרויקט'")
rep("'admin.about.colPlot':              'Plot'","'admin.about.colPlot':              'מגרש'")
rep("'admin.about.colCount':             'Count'","'admin.about.colCount':             'כמות'")
rep("'admin.about.colType':              'Type'","'admin.about.colType':              'סוג'")
rep("'admin.about.colUnits':             'Units / plot'","'admin.about.colUnits':             'יחידות / מגרש'")
rep("'admin.about.colGia':               'GIA / plot'","'admin.about.colGia':               'GIA / מגרש'")
rep("'admin.about.total':                'Total'","'admin.about.total':                'סה\"כ'")
rep("'admin.about.luxuryVilla':          'Luxury villa'","'admin.about.luxuryVilla':          'וילת יוקרה'")
rep("'admin.about.hotelRooms':           'Hotel rooms'","'admin.about.hotelRooms':           'חדרי מלון'")
rep("'admin.about.villaSuffix':          'villa'","'admin.about.villaSuffix':          'וילה'")
rep("'admin.about.stdDbl':               'standard · double'","'admin.about.stdDbl':               'סטנדרטי · כפול'")

# ── Dash ──
rep("'dash.activateGrantPath':           '★ Activate Grant path →'","'dash.activateGrantPath':           '★ הפעלת מסלול מענק →'")
rep("'dash.colScenario':                 'Scenario'","'dash.colScenario':                 'תרחיש'")
rep("'dash.colCashYield':                'Cash Yield'","'dash.colCashYield':                'תשואה במזומן'")
rep("'dash.fullReturnsLink':             'Full returns analysis →'","'dash.fullReturnsLink':             'ניתוח תשואות מלא →'")
rep("'dash.section.exitAnalysis':        'Exit Analysis'","'dash.section.exitAnalysis':        'ניתוח יציאה'")
rep("'dash.exitAnalysisSub':             'Preferred exit path · drill down for full returns'",
    "'dash.exitAnalysisSub':             'מסלול יציאה מועדף · התעמקות לתשואות מלאות'")
rep("'dash.exit.preferredExit':          'Preferred Exit'","'dash.exit.preferredExit':          'יציאה מועדפת'")
rep("'dash.exit.exitValue':              'Exit Value'","'dash.exit.exitValue':              'שווי יציאה'")
rep("'dash.exit.netToEquity':            'Net to Equity'","'dash.exit.netToEquity':            'נטו להון עצמי'")
rep("'dash.exit.exitIRR':                'Exit IRR'","'dash.exit.exitIRR':                'IRR יציאה'")
rep("'dash.exit.propertySale':           'Property Sale'","'dash.exit.propertySale':           'מכירת נכס'")
rep("'dash.exit.hotelSale':              'Hotel Sale'","'dash.exit.hotelSale':              'מכירת מלון'")
rep("'dash.exit.deepDive':               'Deep dive →'","'dash.exit.deepDive':               'התעמקות →'")
rep("'dash.exit.description':            'Full returns analysis — both exit paths, scenario grid, IRR waterfall'",
    "'dash.exit.description':            'ניתוח תשואות מלא — שני מסלולי יציאה, רשת תרחישים, מפל IRR'")
rep("'dash.section.stressMargin':        'Stress & Margin Analysis'","'dash.section.stressMargin':        'ניתוח לחץ ומרווח'")
rep("'dash.stressMarginSub':             'Per-villa BP assumptions vs the live single villa we already run today'",
    "'dash.stressMarginSub':             'הנחות BP לוילה מול הוילה הבודדת החיה שאנו מנהלים כיום'")
rep("'dash.hideDetail':                  'Hide detail'","'dash.hideDetail':                  'הסתר פירוט'")
rep("'dash.showDetail':                  'Show detail'","'dash.showDetail':                  'הצג פירוט'")
rep("'dash.stress.colAssumption':        'Assumption (per villa)'","'dash.stress.colAssumption':        'הנחה (לוילה)'")
rep("'dash.stress.colBpConservative':    'BP Conservative'","'dash.stress.colBpConservative':    'BP שמרני'")
rep("'dash.stress.colBpRealistic':       'BP Realistic+'","'dash.stress.colBpRealistic':       'BP ריאלי+'")
rep("'dash.stress.colVerdict':           'Verdict'","'dash.stress.colVerdict':           'ממצא'")
rep("'dash.stress.verdictPar':           'On par'","'dash.stress.verdictPar':           'בהתאם'")
rep("'dash.stress.row.nights':           'Peak-season nights'","'dash.stress.row.nights':           'לילות עונת שיא'")
rep("'dash.stress.row.nightsSub':        '120 available · 15 May – 15 Sept'","'dash.stress.row.nightsSub':        '120 זמינות · 15 מאי – 15 ספט'")
rep("'dash.stress.row.adrSub':           '€ per night'","'dash.stress.row.adrSub':           '€ ללילה'")
rep("'dash.stress.row.accommodation':    'Accommodation'","'dash.stress.row.accommodation':    'לינה'")
rep("'dash.stress.row.accommodationSub': 'Nights × ADR (per villa, per season)'",
    "'dash.stress.row.accommodationSub': 'לילות × ADR (לוילה, לעונה)'")
rep("'dash.stress.row.ancillary':        'Ancillary profit'","'dash.stress.row.ancillary':        'רווח נלוות'")
rep("'dash.stress.row.ancillarySub':     'Chef · boat · car · quad · concierge · explicit per-villa BP allocation'",
    "'dash.stress.row.ancillarySub':     \"שף · סירה · רכב · quad · קונסיירז' · הקצאת BP מפורשת לוילה\"")
rep("'dash.stress.row.events':           'Events'","'dash.stress.row.events':           'אירועים'")
rep("'dash.stress.row.eventsSub':        'portfolio profit'","'dash.stress.row.eventsSub':        'רווח תיק'")
rep("'dash.stress.row.portfolioTotal':   'Portfolio total'","'dash.stress.row.portfolioTotal':   'סה\"כ תיק'")

# ── CAPEX pool & wellness ──
rep("'capex.poolConfig':              'Pool & Wellness Configuration'","'capex.poolConfig':              'תצורת בריכה ורווחה'")
rep("'capex.poolConfigIntro':         'Pool construction costs — computed from slot dimensions × shared €/m² rate.'",
    "'capex.poolConfigIntro':         'עלויות בניית בריכה — מחושב מממדי חריץ × מחיר €/מ\"ר משותף.'")

# ── Field keys ──
rep("'field.landscapingCost':         'Landscaping / stone fence'","'field.landscapingCost':         'גינון / גדר אבן'")
rep("'field.licensesPermits':         'Licenses & permits'","'field.licensesPermits':         'רישיונות והיתרים'")
rep("'field.constructionDirector':    'Construction director'","'field.constructionDirector':    'מנהל בנייה'")
rep("'field.poolCostPerM2':           'Pool construction cost (€/m²)'","'field.poolCostPerM2':           'עלות בניית בריכה (€/מ\"ר)'")
rep("'field.poolSlotWidth':           'Width (m)'","'field.poolSlotWidth':           'רוחב (מ)'")
rep("'field.poolSlotLength':          'Length (m)'","'field.poolSlotLength':          'אורך (מ)'")
rep("'field.wellnessFlat':            'Wellness flat cost'","'field.wellnessFlat':            'עלות wellness קבועה'")
rep("'field.addPoolSlot':             'Add pool slot'","'field.addPoolSlot':             'הוספת חריץ בריכה'")
rep("'field.switchToSlots':           'Switch to pool slots'","'field.switchToSlots':           'מעבר לחריצי בריכה'")
rep("'field.switchToFlat':            'Use flat amount'","'field.switchToFlat':            'שימוש בסכום קבוע'")

# ── Tax loss & depreciation ──
rep("'term.taxLossGenerated':   'Tax loss generated'","'term.taxLossGenerated':   'הפסד מס שנוצר'")
rep("'term.taxLossUtilised':    'Tax loss utilised'","'term.taxLossUtilised':    'הפסד מס שנוצל'")
rep("'term.taxLossPoolBalance': 'Tax loss pool balance'","'term.taxLossPoolBalance': 'יתרת הפסד מס צבוי'")
rep("'pnl.depreciation':        'Depreciation (Art. 24, straight-line)'",
    "'pnl.depreciation':        'פחת (סעיף 24, קו ישר)'")
rep("'pnl.ebit':                'EBIT (after depreciation)'","'pnl.ebit':                'EBIT (לאחר פחת)'")
rep("'term.annualDepreciation': 'Annual depreciation'","'term.annualDepreciation': 'פחת שנתי'")

if not_found:
    print(f'NOT FOUND ({len(not_found)} items):')
    for x in not_found:
        print(f'  {x}')
print(f'\nhe.ts: {count} replacements made')

with open('src/lib/i18n/he.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('he.ts written.')
