export type Locale = 'en' | 'fr' | 'el' | 'he';
export type Direction = 'ltr' | 'rtl';

export const LOCALE_CONFIG: Record<Locale, { name: string; nativeName: string; dir: Direction; intl: string }> = {
  en: { name: 'English', nativeName: 'English', dir: 'ltr', intl: 'en-IE' },
  fr: { name: 'French', nativeName: 'Français', dir: 'ltr', intl: 'fr-FR' },
  el: { name: 'Greek', nativeName: 'Ελληνικά', dir: 'ltr', intl: 'el-GR' },
  he: { name: 'Hebrew', nativeName: 'עברית', dir: 'rtl', intl: 'he-IL' },
};

// All translatable keys in the app
export interface TranslationDictionary {
  // ── App ──
  'app.title': string;
  'app.subtitle': string;
  'app.platform': string;
  'app.confidential': string;
  'app.loanApp': string;

  // ── Nav ──
  'nav.dashboard': string;
  'nav.pnl': string;
  'nav.breakeven': string;
  'nav.capex': string;
  'nav.scenarios': string;
  'nav.assumptions': string;
  'nav.sensitivity': string;
  'nav.switchAdmin': string;
  'nav.switchInvestor': string;

  // ── Top bar ──
  'bar.path': string;
  'bar.scenario': string;
  'bar.ds': string;
  'bar.dscr': string;
  'bar.ncf': string;
  'bar.equity': string;
  'bar.engine': string;

  // ── Financing paths ──
  'path.commercial': string;
  'path.commercialShort': string;
  'path.commercialDesc': string;
  'path.rrf': string;
  'path.rrfShort': string;
  'path.rrfDesc': string;
  'path.grant': string;
  'path.grantShort': string;
  'path.grantDesc': string;

  // ── Scenarios ──
  'scenario.realistic': string;
  'scenario.upside': string;
  'scenario.downside': string;
  'scenario.breakeven': string;
  'scenario.grantPath': string;

  // ── Financial terms ──
  'term.ebitda': string;
  'term.ebitdaMargin': string;
  'term.dscr': string;
  'term.dscrFull': string;
  'term.opex': string;
  'term.capex': string;
  'term.ltv': string;
  'term.ltvFull': string;
  'term.ncf': string;
  'term.ncfFull': string;
  'term.vat': string;
  'term.vatPayable': string;
  'term.adr': string;
  'term.adrFull': string;
  'term.ds': string;
  'term.dsFull': string;
  'term.ffe': string;
  'term.irr': string;

  // ── Dashboard KPIs ──
  'kpi.totalInvestment': string;
  'kpi.totalInvestmentSub': string;
  'kpi.stabilisedRevenue': string;
  'kpi.stabilisedRevenueSub': string;
  'kpi.debtServiceCoverage': string;
  'kpi.loanAmount': string;
  'kpi.equityRequired': string;
  'kpi.annualDS': string;
  'kpi.annualDSSub': string;
  'kpi.netCashFlow': string;
  'kpi.netCashFlowSub': string;
  'kpi.portfolioValue': string;
  'kpi.portfolioValueSub': string;
  'kpi.ltvAtCompletion': string;
  'kpi.assetCoverage': string;
  'kpi.assetCoverageSub': string;
  'kpi.bufferBreakEven': string;
  'kpi.bufferBreakEvenSub': string;
  'kpi.ofTotal': string;
  'kpi.margin': string;

  // ── Dashboard ──
  'dash.title': string;
  'dash.stabilisedYear': string;
  'dash.revenueEbitda': string;
  'dash.dscrByScenario': string;
  'dash.pnlSummary': string;
  'dash.financingComparison': string;

  // ── P&L ──
  'pnl.title': string;
  'pnl.subtitle': string;
  'pnl.item': string;
  'pnl.phase': string;
  'pnl.villaNights': string;
  'pnl.suiteNights': string;
  'pnl.propA1': string;
  'pnl.propA2': string;
  'pnl.propB': string;
  'pnl.events': string;
  'pnl.ancillary': string;
  'pnl.totalRevenue': string;
  'pnl.opexA1': string;
  'pnl.opexA2': string;
  'pnl.opexB': string;
  'pnl.totalOpex': string;
  'pnl.debtService': string;
  'pnl.cumulativeNCF': string;
  'pnl.ncfPostVAT': string;

  // ── Phases ──
  'phase.acquisition': string;
  'phase.construction': string;
  'phase.opening75': string;
  'phase.y2_88': string;
  'phase.stabilised': string;

  // ── Break-Even ──
  'be.title': string;
  'be.subtitle': string;
  'be.nights': string;
  'be.nightsSub': string;
  'be.buffer': string;
  'be.bufferSub': string;
  'be.adr': string;
  'be.adrSub': string;
  'be.adrBuffer': string;
  'be.adrBufferSub': string;
  'be.scenarioTitle': string;
  'be.scenarioSubtitle': string;
  'be.current': string;
  'be.nightsDrop': string;
  'be.adrDrop': string;
  'be.bothDrop': string;
  'be.metric': string;
  'be.nightsPerYear': string;
  'be.villaADR': string;
  'be.stdSuiteADR': string;
  'be.dblSuiteADR': string;
  'be.villaRevenue': string;
  'be.suiteRevenue': string;
  'be.eventsAncillary': string;
  'be.byFinancingPath': string;
  'be.annualDS': string;
  'be.beRevenue': string;
  'be.beNights': string;
  'be.nightsBuffer': string;
  'be.beADR': string;
  'be.dscrByOccupancy': string;
  'be.dscrByADR': string;
  'be.dscrMatrix': string;
  'be.dscrMatrixDesc': string;
  'be.nightsDown': string;
  'be.adrDown': string;
  'be.context': string;

  // ── CAPEX ──
  'capex.title': string;
  'capex.subtitle': string;
  'capex.costCategory': string;
  'capex.propAPer': string;
  'capex.propAx2': string;
  'capex.propB': string;
  'capex.total': string;
  'capex.totalCapex': string;
  'capex.totalProjectCost': string;
  'capex.propAEach': string;

  // ── Scenarios ──
  'sc.title': string;
  'sc.subtitle': string;
  'sc.dscrByYear': string;
  'sc.collateral': string;
  'sc.builtSurface': string;
  'sc.loanOutstanding': string;
  'sc.portfolioValue': string;
  'sc.stress': string;
  'sc.market': string;
  'sc.optimistic': string;

  // ── Assumptions ──
  'as.title': string;
  'as.subtitle': string;
  'as.resetDefaults': string;
  'as.financingPaths': string;
  'as.general': string;
  'as.revenue': string;
  'as.opexTab': string;
  'as.capexTab': string;
  'as.selectPath': string;
  'as.activeParams': string;
  'as.rampUp': string;
  'as.tax': string;
  'as.realisticScenario': string;
  'as.upsideScenario': string;
  'as.propAOpex': string;
  'as.propBOpex': string;
  'as.propATwinVillas': string;
  'as.propBSuites': string;
  'as.other': string;

  // ── Assumptions field labels ──
  'field.loanCoverage': string;
  'field.interestRate': string;
  'field.gracePeriod': string;
  'field.repaymentTerm': string;
  'field.workingCapital': string;
  'field.rrfShare': string;
  'field.rrfRate': string;
  'field.commShare': string;
  'field.commRate': string;
  'field.totalLoanDrawn': string;
  'field.equityRequired': string;
  'field.grantRate': string;
  'field.nonPlotEligible': string;
  'field.grantAmount': string;
  'field.y1Ramp': string;
  'field.y2Ramp': string;
  'field.nightsGrowth': string;
  'field.nightsCap': string;
  'field.citRate': string;
  'field.vatRate': string;
  'field.villaADR': string;
  'field.villaNights': string;
  'field.stdSuiteADR': string;
  'field.dblSuiteADR': string;
  'field.suiteNights': string;
  'field.eventsPerYear': string;
  'field.profitPerEvent': string;
  'field.ancillaryProfit': string;
  'field.ancillaryGrowth': string;
  'field.landCost': string;
  'field.constructionArea': string;
  'field.costPerM2': string;
  'field.legalNotary': string;
  'field.architectDesign': string;
  'field.civilEngineer': string;
  'field.contingencyRate': string;
  'field.acqLegalPerPlot': string;
  'field.numPropA': string;

  // ── Sensitivity ──
  'sens.title': string;
  'sens.subtitle': string;
  'sens.adrSensitivity': string;
  'sens.occupancySensitivity': string;
  'sens.interestSensitivity': string;
  'sens.change': string;
  'sens.base': string;

  // ── Investor ──
  'inv.portfolioExpansion': string;
  'inv.capitalStructure': string;
  'inv.stabilisedOps': string;
  'inv.annualRevenue': string;
  'inv.revenueEbitda': string;
  'inv.collateralAsset': string;
  'inv.loan': string;

  // ── Common ──
  'common.year': string;
  'common.notes': string;
  'common.path': string;
  'common.metric': string;
  'common.loading': string;
}
