export type Locale = 'en' | 'el' | 'he';
export type Direction = 'ltr' | 'rtl';

export const LOCALE_CONFIG: Record<Locale, { name: string; nativeName: string; dir: Direction; intl: string }> = {
  en: { name: 'English', nativeName: 'English', dir: 'ltr', intl: 'en-IE' },
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
  'nav.returns': string;
  'nav.pnl': string;
  'nav.breakeven': string;
  'nav.capex': string;
  'nav.scenarios': string;
  'nav.assumptions': string;
  'nav.sensitivity': string;
  'nav.debtCoverage': string;
  'nav.financingPaths': string;
  'nav.opcoSplit': string;
  'nav.capTable': string;
  'nav.switchAdmin': string;
  'nav.groupAnalyse': string;
  'nav.groupStructure': string;
  'nav.groupInputs': string;
  'nav.presentation': string;

  // ── Top bar ──
  'bar.path': string;
  'bar.scenario': string;
  'bar.ds': string;
  'bar.dscr': string;
  'bar.ncf': string;
  'bar.equity': string;
  'bar.engine': string;
  'bar.exitMultipleLabel': string;
  'bar.exitMultiple.tipNormal': string;
  'bar.exitMultiple.tipLow': string;
  'bar.exitMultiple.tipHigh': string;

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
  'path.tepixLoan': string;
  'path.tepixLoanShort': string;
  'path.tepixLoanDesc': string;

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
  'term.dscrLoaded': string;
  'term.opex': string;
  'term.capex': string;
  'term.ltv': string;
  'term.ltvFull': string;
  'term.ncf': string;
  'term.ncfFull': string;
  'term.vat': string;
  'term.vatPayable': string;
  'term.cit': string;
  'term.citPayable': string;
  'term.adr': string;
  'term.adrFull': string;
  'term.ds': string;
  'term.dsFull': string;
  'term.ffe': string;
  'term.irr': string;

  // ── Dashboard KPIs ──
  'kpi.totalInvestment': string;
  'kpi.plots': string;
  'kpi.plotsSingular': string;
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
  'kpi.wcFacility': string;
  'kpi.wcFacilitySub': string;
  'kpi.wcY2Peak': string;
  'kpi.wcY2PeakSub': string;
  'kpi.wcInterest': string;
  'kpi.wcInterestSub': string;
  'kpi.wcSelfLiq': string;
  'kpi.wcSelfLiqOk': string;
  'kpi.wcSelfLiqFail': string;
  'kpi.wcSelfLiqSub': string;
  'kpi.grantAmount': string;
  'kpi.grantAmountSub': string;

  // ── Dashboard ──
  'dash.title': string;
  'dash.stabilisedYear': string;
  'dash.revenueEbitda': string;
  'dash.dscrByScenario': string;
  'dash.pnlSummary': string;
  'dash.financingComparison': string;
  'dash.section.threeScenario': string;
  'dash.threeScenarioSub': string;

  // ── P&L ──
  'pnl.title': string;
  'pnl.subtitle': string;
  'pnl.item': string;
  'pnl.phase': string;
  'pnl.villaNights': string;
  'pnl.suiteNights': string;
  'pnl.propA': string;
  'pnl.propB': string;
  'pnl.events': string;
  'pnl.ancillary': string;
  'pnl.ancillaryCapped': string;
  'pnl.profitAfterTax': string;
  'pnl.wcInterest': string;
  'pnl.wcAvg': string;
  'pnl.wcPeak': string;
  'pnl.wcNetContribution': string;
  'pnl.wcSection': string;
  'pnl.totalRevenue': string;
  'pnl.opexA': string;
  'pnl.opexB': string;
  'pnl.totalOpex': string;
  'pnl.debtService': string;
  'pnl.cumulativeNCF': string;
  'pnl.ncfPostVAT': string;
  'pnl.yieldOnEquity': string;
  'pnl.totalYieldOnEquity': string;
  'pnl.termLoanInterest': string;
  'pnl.termLoanPrincipal': string;
  'pnl.termLoanBalance': string;
  'pnl.icr': string;
  'pnl.dscrLoaded': string;
  'pnl.cit': string;
  'pnl.ebitdaMargin': string;
  'pnl.cfads': string;

  // Dashboard — bank metrics
  'dash.section.dealSnapshot': string;
  'dash.section.coverage': string;
  'dash.section.returns': string;
  'dash.section.sensitivity': string;
  'kpi.activePath': string;
  'kpi.activeScenario': string;
  'kpi.minDSCR': string;
  'kpi.minDSCRSub': string;
  'kpi.stabilisedDSCRDownside': string;
  'kpi.stabilisedDSCRDownsideSub': string;
  'kpi.minOverLoanLife': string;
  'kpi.dscrPostRamp': string;
  'kpi.dscrPostRampSub': string;
  'kpi.icr': string;
  'kpi.icrSub': string;
  'kpi.llcr': string;
  'kpi.llcrSub': string;
  'kpi.plcr': string;
  'kpi.plcrSub': string;
  'kpi.covHeadroom': string;
  'kpi.covHeadroomSub': string;
  'kpi.equityYield': string;
  'kpi.equityYieldSub': string;
  'kpi.cumYield': string;
  'kpi.cumYieldSub': string;
  'kpi.operatingYield': string;
  'kpi.operatingYieldSub': string;
  'kpi.operatingYieldNote': string;
  'kpi.totalMOIC': string;
  'kpi.totalMOICSub': string;
  'kpi.totalMOICUnderwaterNote': string;
  'kpi.equityPayback': string;
  'kpi.equityPaybackSub': string;
  'kpi.equityPaybackNote': string;
  'kpi.ebitdaMarginNote': string;
  'kpi.equityIRR': string;
  'kpi.equityIRRSub': string;
  'kpi.projectIRR': string;
  'kpi.projectIRRSub': string;
  'kpi.roic': string;
  'kpi.roicSub': string;
  'kpi.gracePeriodInterest': string;
  'kpi.gracePeriodInterestSub': string;
  'kpi.netLeverage': string;
  'kpi.netLeverageSub': string;
  'kpi.peakDebt': string;
  'kpi.peakDebtSub': string;
  'kpi.terminalValue': string;
  'kpi.terminalValueSub': string;
  'dash.dealSnapshotSub': string;
  'dash.coverageSub': string;
  'dash.returnsSub': string;
  'dash.collateralTiers': string;
  'dash.minDscr': string;
  'dash.never': string;
  'dash.years': string;
  'dash.section.headline': string;
  'dash.headlineSub': string;
  'dash.section.marketPosition': string;
  'dash.marketPositionSub': string;
  'market.bp': string;
  'market.market': string;
  'market.belowMarket': string;
  'market.aboveMarket': string;
  'market.atMarket': string;
  'market.standardRoom': string;
  'market.doubleSuite': string;
  'market.tierStandard': string;
  'market.tierDouble': string;
  'market.coverage': string;
  'market.awaitingCapture': string;
  'market.sourceNote': string;
  'market.openInNewTab': string;
  // Extended for /pitch + admin/dashboard with 2025 backstop fallback
  'market.villa': string;
  'market.tierVilla': string;
  'market.statusFresh': string;
  'market.statusBackstop': string;
  'market.backstopFootnote': string;
  'pitch.market.bpVsHeading': string;
  'pitch.market.bpVsSub': string;

  // ── Conservatism Triangle (Market Position hero strip + drawer) ──
  // Hero strip
  'triangle.stripTitle': string;
  'triangle.stripSub': string;
  'triangle.barBP': string;
  'triangle.barMarket': string;
  'triangle.tierStandard': string;
  'triangle.tierPremium': string;
  'triangle.deltaVsMarket': string;      // template — uses {pct}
  'triangle.defenceCopy': string;
  'triangle.seeComparables': string;     // template — uses {n}
  'triangle.bpFloor': string;            // small caption: "BP is the floor"
  // Drawer
  'drawer.title': string;
  'drawer.close': string;
  'drawer.filterGreek': string;
  'drawer.filterInternational': string;
  'drawer.filterAll': string;
  'drawer.tierBasic': string;
  'drawer.tierPremium': string;
  'drawer.tierLuxury': string;
  'drawer.tierVilla': string;
  'drawer.showVilla': string;
  'drawer.colHotel': string;
  'drawer.colLocation': string;
  'drawer.colStars': string;
  'drawer.colRooms': string;
  'drawer.colHighEur': string;
  'drawer.colMedEur': string;
  'drawer.colAnnual': string;
  'drawer.colTier': string;
  'drawer.sourceFootnote': string;
  'drawer.empty': string;
  'drawer.countLabel': string;           // template — uses {n}

  'dash.drillDown': string;
  'dash.founderDrillDown': string;
  'dash.pnlDrillDown': string;

  // ── Onboarding tour ──
  'tour.takeTour': string;
  'tour.stepOf': string;
  'tour.next': string;
  'tour.back': string;
  'tour.skip': string;
  'tour.done': string;
  'tour.welcome.title': string;
  'tour.welcome.body': string;
  'tour.welcome.langPrompt': string;
  'tour.welcome.start': string;
  'tour.controlBar.title': string;
  'tour.controlBar.body': string;
  'tour.snapshot.title': string;
  'tour.snapshot.body': string;
  'tour.dscr.title': string;
  'tour.dscr.body': string;
  'tour.coverage.title': string;
  'tour.coverage.body': string;
  'tour.returns.title': string;
  'tour.returns.body': string;
  'tour.capital.title': string;
  'tour.capital.body': string;
  'tour.pnl.title': string;
  'tour.pnl.body': string;

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
  'capex.pctTotal': string;
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
  'as.workingCapital': string;
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
  'field.nights': string;
  'field.rate': string;
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
  'field.ancillaryGrowthYears': string;
  'field.wcActive': string;
  'field.wcFacility': string;
  'field.wcSpread': string;
  'field.wcPreOpening': string;
  'field.wcSeasonal': string;
  'field.wcY2Buffer': string;
  'field.wcSelfLiquidating': string;
  'field.wcDsra': string;
  'field.wcDsraLock': string;
  'field.wcInternalBuffer': string;
  'field.landCost': string;
  'field.constructionArea': string;
  'field.costPerM2': string;
  'field.legalNotary': string;
  'field.architectDesign': string;
  'field.civilEngineer': string;
  'field.contingencyRate': string;
  'field.opexContingencyRate': string;
  'field.acqLegalPerPlot': string;
  'field.numPropA': string;
  'field.tepixCoverage': string;
  'field.tepixHdbShare': string;
  'field.tepixBankShare': string;
  'field.tepixBankRate': string;
  'field.tepixSubsidy': string;
  'field.tepixSubsidyDuration': string;
  'field.tepixTotalTerm': string;
  'field.tepixGrace': string;
  'field.tepixLandCap': string;
  'field.tepixLandCapNote': string;
  'field.tepixPrimaryLoan': string;
  'field.tepixSuppLoan': string;
  'field.tepixLandFundedByTepix': string;
  'field.tepixLandGap': string;
  'field.tepixCombinedDS': string;
  'field.tepixCombinedStructure': string;
  'comp.suppCommercialLoan': string;

  // ── Dashboard extras ──
  'dash.section.exitPath': string;
  'dash.driftAlert': string;
  'dash.driftAlertTuneIn': string;
  'dash.capitalStructureChart': string;
  'dash.annualDSChart': string;
  'dash.stabilisedDSCRChart': string;
  'dash.dscrTrajectory': string;
  'dash.heroDscr': string;
  'dash.heroDscrSub': string;
  'dash.section.operating': string;
  'dash.section.capital': string;
  'dash.section.workingCapital': string;
  'dash.section.collateral': string;
  'dash.wcPanelSub': string;
  'dash.wcSparkLabel': string;
  'dash.wcQuarterly': string;
  'dash.wcPeak': string;
  'dash.wcAvg': string;
  'dash.wcTrough': string;
  'dash.wcInterestAnnual': string;
  'dash.kpi.dscrThreshold': string;
  'dash.kpi.ltvThreshold': string;
  'dash.kpi.acThreshold': string;
  'bar.deltaR': string;

  // ── Sensitivity ──
  'sens.title': string;
  'sens.subtitle': string;
  'sens.adrSensitivity': string;
  'sens.occupancySensitivity': string;
  'sens.interestSensitivity': string;
  'sens.change': string;
  'sens.base': string;
  'sens.wcSensitivity': string;
  'sens.facility': string;
  'sens.wcY2Trough': string;

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

  // ── Config management ──
  'config.title': string;
  'config.save': string;
  'config.load': string;
  'config.delete': string;
  'config.rename': string;
  'config.savedConfigs': string;
  'config.nameLabel': string;
  'config.noSaved': string;
  'config.unsaved': string;
  'config.active': string;

  // ── Scenario sharing (REVISIONS-based extension) ──
  // Templates use {name} / {date} placeholders — substitution happens at
  // the render site (no helper baked into I18nProvider yet).
  'scenarios.shareWithTeam': string;
  'scenarios.savedBy': string;
  'scenarios.copiedFrom': string;
  'scenarios.yourScenarios': string;
  'scenarios.sharedScenarios': string;
  'scenarios.readOnlyShared': string;
  'scenarios.signInToSave': string;

  // ── Reference scenario (admin-designated default) ──
  'ref.setAsReference': string;
  'ref.referenceBadge': string;
  'ref.viewingReference': string;
  'ref.dismiss': string;

  // ── Property count ──
  'field.numPropB': string;

  // ── Lexicon ──
  'nav.lexicon': string;
  'lex.exit': string;
  'lex.title': string;
  'lex.subtitle': string;
  'lex.capex': string;
  'lex.revenue': string;
  'lex.opex': string;
  'lex.ebitda': string;
  'lex.pmt': string;
  'lex.dscr': string;
  'lex.breakeven': string;
  'lex.collateral': string;
  'lex.paths': string;

  // ── Pitch ──
  'pitch.loading': string;
  'pitch.bar.path': string;
  'pitch.bar.case': string;
  'pitch.bar.commercial': string;
  'pitch.bar.rrf': string;
  'pitch.bar.grant': string;
  'pitch.bar.tepix': string;
  'pitch.bar.realistic': string;
  'pitch.bar.upside': string;
  'pitch.bar.downside': string;
  'pitch.pathLabel.commercial': string;
  'pitch.pathLabel.rrf': string;
  'pitch.pathLabel.grant': string;
  'pitch.pathLabel.tepix': string;
  // Cover
  'pitch.cover.eyebrow': string;
  'pitch.cover.titleLine1': string;
  'pitch.cover.titleLine2': string;
  'pitch.cover.lede': string;
  'pitch.cover.totalInvestment': string;
  'pitch.cover.loanRequested': string;
  'pitch.cover.ofCapex': string;
  'pitch.cover.ltvAtCompletion': string;
  'pitch.cover.assetCoverage': string;
  'pitch.cover.liveModel': string;
  'pitch.cover.path': string;
  'pitch.cover.case': string;
  // Track record
  'pitch.track.eyebrow': string;
  'pitch.track.titleLine1': string;
  'pitch.track.titleLine2': string;
  'pitch.track.ledePart1': string;
  'pitch.track.ledePart2': string;
  'pitch.track.ledePart3': string;
  'pitch.track.revenueLegend': string;
  'pitch.track.stat1Value': string;
  'pitch.track.stat1Label': string;
  'pitch.track.stat2Value': string;
  'pitch.track.stat2Label': string;
  'pitch.track.stat3Value': string;
  'pitch.track.stat3Label': string;
  'pitch.track.quote': string;
  // Market
  'pitch.market.eyebrow': string;
  'pitch.market.title': string;
  'pitch.market.bodyPart1': string;
  'pitch.market.bodyPart2': string;
  'pitch.market.bodyPart3': string;
  'pitch.market.bodyPart4': string;
  'pitch.market.tailwindsIntro': string;
  'pitch.market.tailwind1Term': string;
  'pitch.market.tailwind1Body': string;
  'pitch.market.tailwind2Term': string;
  'pitch.market.tailwind2Body': string;
  'pitch.market.tailwind3Term': string;
  'pitch.market.tailwind3Body': string;
  'pitch.market.heroLabel': string;
  'pitch.market.yoyLabel': string;
  // Project
  'pitch.project.eyebrow': string;
  'pitch.project.title': string;
  'pitch.project.lede': string;
  'pitch.project.twinIName': string;
  'pitch.project.twinIIName': string;
  'pitch.project.suitesName': string;
  'pitch.project.twinType': string;
  'pitch.project.suitesType': string;
  'pitch.project.twinIDetail': string;
  'pitch.project.twinIIDetail': string;
  'pitch.project.suitesDetail': string;
  // Capital
  'pitch.capital.eyebrow': string;
  'pitch.capital.title': string;
  'pitch.capital.lede': string;
  'pitch.capital.phasedDrawdown': string;
  'pitch.capital.permitGated': string;
  'pitch.capital.phase1': string;
  'pitch.capital.phase2': string;
  'pitch.capital.permitGate': string;
  'pitch.capital.phase1Title': string;
  'pitch.capital.phase1Body': string;
  'pitch.capital.phase2Title': string;
  'pitch.capital.phase2Body': string;
  'pitch.capital.fundedBy': string;
  'pitch.capital.bankLoan': string;
  'pitch.capital.equity': string;
  'pitch.capital.grant': string;
  'pitch.capital.kvStabilisedRevenue': string;
  'pitch.capital.kvStabilisedEbitda': string;
  'pitch.capital.kvEbitdaMargin': string;
  'pitch.capital.kvAnnualDS': string;
  'pitch.capital.kvStabilisedDscr': string;
  'pitch.capital.kvNetCashFlow': string;
  // Ramp
  'pitch.ramp.eyebrowPrefix': string;
  'pitch.ramp.eyebrowSuffix': string;
  'pitch.ramp.title': string;
  'pitch.ramp.lede': string;
  'pitch.ramp.totalRevenue': string;
  'pitch.ramp.ebitda': string;
  'pitch.ramp.netCashFlow': string;
  // DSCR
  'pitch.dscr.eyebrowPrefix': string;
  'pitch.dscr.eyebrowSuffix': string;
  'pitch.dscr.titleLine1': string;
  'pitch.dscr.titleLine2Prefix': string;
  'pitch.dscr.lede': string;
  'pitch.dscr.covenantLabel': string;
  'pitch.dscr.realisticLegend': string;
  'pitch.dscr.upsideLegend': string;
  'pitch.dscr.downsideLegend': string;
  'pitch.dscr.footnote': string;
  // Events
  'pitch.events.eyebrow': string;
  'pitch.events.titleLine1': string;
  'pitch.events.titleLine2': string;
  'pitch.events.ledePart1': string;
  'pitch.events.ledePart2': string;
  'pitch.events.ledePart3': string;
  'pitch.events.card1Value': string;
  'pitch.events.card1Label': string;
  'pitch.events.card1Body': string;
  'pitch.events.card2Value': string;
  'pitch.events.card2Label': string;
  'pitch.events.card2Body': string;
  'pitch.events.card3Value': string;
  'pitch.events.card3Label': string;
  'pitch.events.card3Body': string;
  'pitch.events.quote': string;
  // Resilience
  'pitch.resilience.eyebrow': string;
  'pitch.resilience.title': string;
  'pitch.resilience.lede': string;
  'pitch.resilience.dscrLabel': string;
  'pitch.resilience.legendBelow110': string;
  'pitch.resilience.legend110_125': string;
  'pitch.resilience.legend125_150': string;
  'pitch.resilience.legend150_175': string;
  'pitch.resilience.legendAbove175': string;
  'pitch.resilience.nightsUnit': string;
  'pitch.resilience.statBeNightsLabel': string;
  'pitch.resilience.statBeNightsSub': string;
  'pitch.resilience.statRevolverLabel': string;
  'pitch.resilience.statRevolverSub': string;
  'pitch.resilience.statBufferLabel': string;
  'pitch.resilience.statBufferSub': string;
  // Collateral
  'pitch.collateral.eyebrow': string;
  'pitch.collateral.titlePart1': string;
  'pitch.collateral.titlePart2': string;
  'pitch.collateral.ledePart1': string;
  'pitch.collateral.ledePart2': string;
  'pitch.collateral.tierStress': string;
  'pitch.collateral.tierMarket': string;
  'pitch.collateral.tierPositive': string;
  'pitch.collateral.cardCoverageLabel': string;
  'pitch.collateral.cardLtv': string;
  'pitch.collateral.cardPriceM2': string;
  'pitch.collateral.cardValue': string;
  // Optionality
  'pitch.optionality.eyebrow': string;
  'pitch.optionality.title': string;
  'pitch.optionality.ledePart1': string;
  'pitch.optionality.ledePart2': string;
  'pitch.optionality.ledePart3': string;
  'pitch.optionality.tableMetric': string;
  'pitch.optionality.tableCommercial': string;
  'pitch.optionality.tableRrf': string;
  'pitch.optionality.tableGrant': string;
  'pitch.optionality.tableTepix': string;
  // Close
  'pitch.close.eyebrow': string;
  'pitch.close.title': string;
  'pitch.close.lede': string;
  'pitch.close.operatorLabel': string;
  'pitch.close.operatorName': string;
  'pitch.close.operatorBody': string;
  'pitch.close.timelineLabel': string;
  'pitch.close.timeline1Date': string;
  'pitch.close.timeline1Body': string;
  'pitch.close.timeline2Date': string;
  'pitch.close.timeline2Body': string;
  'pitch.close.timeline3Date': string;
  'pitch.close.timeline3Body': string;
  'pitch.close.timeline4Date': string;
  'pitch.close.timeline4Body': string;
  'pitch.close.askLabel': string;
  'pitch.close.footer': string;

  // ── Dashboard term sheet (audit 2026-05-21 fix #4) ──
  'dash.termsheet.title': string;
  'dash.termsheet.loan': string;
  'dash.termsheet.loanSub': string;
  'dash.termsheet.term': string;
  'dash.termsheet.termSub': string;
  'dash.termsheet.rate': string;
  'dash.termsheet.annualDS': string;
  'dash.termsheet.dscrCovenant': string;
  'dash.termsheet.equityRequired': string;
  'dash.termsheet.security': string;
  'dash.termsheet.pass': string;
  'dash.termsheet.fail': string;
  'dash.termsheet.min': string;

  // ── Dashboard founder waterfall (audit 2026-05-21 fix #4) ──
  'dash.founder.section': string;
  'dash.founder.sectionSub': string;
  'dash.founder.pariPassu': string;
  'dash.founder.grantBonus': string;
  'dash.founder.grantBonusInactive': string;
  'dash.founder.performanceRatchet': string;
  'dash.founder.ratchetTier': string;
  'dash.founder.moicFloor': string;
  'dash.founder.founderTotal': string;
  'dash.founder.investorsKeep': string;
  'dash.founder.floorProtected': string;
  'dash.founder.capStatus': string;
  'dash.founder.capBinding75': string;
  'dash.founder.capEarned33': string;
  'dash.founder.capFree': string;
  'dash.founder.capExit55Grant': string;
  'dash.founder.earned': string;
  'dash.founder.manCoFee': string;
  'dash.founder.cumulative': string;
  'dash.founder.deferredAdvisoryFee': string;
  'dash.founder.feesNote': string;

  // ── OpCo / PropCo split chrome (audit 2026-05-21 fix #4) ──
  'opco.splitOn': string;
  'opco.splitOff': string;
  'opco.entityStructure': string;
  'opco.feeStreams': string;
  'opco.waterfallMechanics': string;
  'opco.capStructure': string;
  'opco.feeStructure': string;
  'opco.stabilisedOutcome': string;

  // ── Bank page contextual subtitles (2026-05-23) ──
  'bank.dscrChartSub': string;
  'bank.allPathsChartSub': string;
  'bank.revenueEbitdaSub': string;
  'bank.stabilisedOpsSub': string;
  'bank.heroKpiDscrSub': string;
  'bank.pnlFooterNote': string;

  // ── Bar chrome ──
  'bar.preparing': string;
  // ── Export button ──
  'bar.exportExcel': string;
  'bar.exportExcelShort': string;
  'bar.exportBankDocx': string;
  'bar.toAdmin': string;
  'admin.bar.adjust': string;
  'admin.bar.loanParams': string;
  'admin.bar.exitYear': string;
  'admin.bar.exitX': string;
  'admin.bar.perM2': string;
  'admin.bar.stubAtMaturity': string;
  'admin.bar.viewPresentation': string;
  'admin.bar.bankerView': string;
  'admin.bar.bankerViewArrow': string;
  'admin.banner.stalePart1': string;
  'admin.banner.stalePart2': string;

  // ── BankControlBar (2026-05-23) ──
  'bank.bar.commercial': string;
  'bank.bar.rrf': string;
  'bank.bar.grant': string;
  'bank.bar.tepix': string;
  'bank.bar.realistic': string;
  'bank.bar.upside': string;
  'bank.bar.downside': string;
  'bank.bar.breakeven': string;

  // ── bank/page.tsx hero & section headings (2026-05-23) ──
  'bank.hero.eyebrow': string;
  'bank.section.repaymentCapacity': string;
  'bank.section.projectedRevenue': string;
  'bank.section.collateral': string;

  // ── BankStressTest (2026-05-23) ──
  'bank.stress.title': string;
  'bank.stress.description': string;

  // ── Bank page full i18n (2026-05-23) ──
  'bank.about.title': string;
  'bank.about.intro': string;
  'bank.about.plotsIn': string;
  'bank.about.luxuryVilla': string;
  'bank.about.luxuryVillas': string;
  'bank.about.and': string;
  'bank.about.boutiqueHotelSuite': string;
  'bank.about.boutiqueHotelSuites': string;
  'bank.about.singleConcept': string;
  'bank.about.anchorText': string;
  'bank.about.colPlot': string;
  'bank.about.colCount': string;
  'bank.about.colType': string;
  'bank.about.colUnitsPerPlot': string;
  'bank.about.colGiaPerPlot': string;
  'bank.about.typeLuxuryVilla': string;
  'bank.about.typeHotelRooms': string;
  'bank.about.totalRow': string;
  'bank.about.villa': string;
  'bank.about.villas': string;
  'bank.about.stdDblSuites': string;
  'bank.about.fullPresentation': string;
  'bank.about.presentationFile': string;
  'bank.section.termsheet': string;
  'bank.termsheet.securityValue': string;
  'bank.termsheet.securitySub': string;
  'bank.wc.title': string;
  'bank.wc.revolving': string;
  'bank.wc.bpsSpread': string;
  'bank.wc.selfLiquidating': string;
  'bank.wc.notIncluded': string;
  'bank.collateral.sub': string;
  'bank.section.loanMetrics': string;
  'bank.kpi.ofCapex': string;
  'bank.kpi.appraisedValue': string;
  'bank.kpi.postRamp2030': string;
  'bank.capex.useOfProceeds': string;
  'bank.capex.footerLoan': string;
  'bank.capex.footerEquity': string;
  'bank.capex.footerGrant': string;
  'bank.capex.footerTotal': string;
  'bank.capitalStructure.netLeverage': string;
  'bank.capitalStructure.xEbitda': string;
  'bank.capitalStructure.peakDebt': string;
  'bank.coverage.icrStabilised': string;
  'bank.coverage.llcr': string;
  'bank.coverage.plcr': string;
  'bank.coverage.icrSub': string;
  'bank.coverage.llcrSub': string;
  'bank.coverage.plcrSub': string;
  'bank.chart.covenantLabel': string;
  'bank.chart.firstFullDS': string;
  'bank.chart.belowStab': string;
  'bank.chart.year1Label': string;
  'bank.chart.year2Label': string;
  'bank.section.dscrSummary': string;
  'bank.dscrTable.scenario': string;
  'bank.dscrTable.stabilised': string;
  'bank.dscrTable.avgLoanLife': string;
  'bank.dscrTable.covenant': string;
  'bank.dscrSummary.footnote': string;
  'bank.dscrSummary.footnoteRamp': string;
  'bank.dscrSummary.footnoteSee': string;
  'bank.financing.sub': string;
  'bank.exit.hotelIRR': string;
  'bank.exit.propertyIRR': string;
  'bank.exit.preferred': string;
  'bank.exit.hotelSub': string;
  'bank.exit.propertySub': string;
  'bank.ramp.discountTitle': string;
  'bank.ramp.discountBody': string;

  // ── BankPnLSection full i18n (2026-05-23) ──
  'pnl.revenue': string;
  'pnl.gopPreMgmt': string;
  'pnl.opcoFeeBreakdown': string;
  'pnl.opcoBaseFee': string;
  'pnl.opcoBrandFee': string;
  'pnl.opcoIncentiveFee': string;
  'pnl.opcoTotalFees': string;
  'pnl.netOfMgmtFees': string;
  'pnl.cfadsBridge': string;
  'pnl.corporateTax': string;
  'pnl.cfadsDscrNumerator': string;
  'pnl.debtServiceSection': string;
  'pnl.loanBalanceClosing': string;
  'pnl.coverageSection': string;
  'pnl.dscrBaseCase': string;
  'pnl.dscrUpside': string;
  'pnl.dscrDownside': string;
  'pnl.dscrLoadedLabel': string;
  'pnl.icrInterestCoverage': string;
  'pnl.equityReturnSection': string;
  'pnl.ncfToEquity': string;
  'pnl.yearByYear': string;
  'pnl.expandHint': string;
  'pnl.expandAll': string;
  'pnl.collapseAll': string;
  'pnl.lineHeader': string;
  'pnl.phaseDev': string;
  'pnl.phaseRampGrace': string;
  'pnl.phaseRampDS': string;
  'pnl.phaseStab': string;
  'pnl.cfadsNote': string;

  // ── Common additions (2026-05-23) ──
  'common.collapse': string;
  'common.expand': string;
  'common.total': string;

  // ── BankStressTest inputs full i18n (2026-05-23) ──
  'stress.villaAdr': string;
  'stress.suiteStdAdr': string;
  'stress.suiteDblAdr': string;
  'stress.villaBaseNights': string;
  'stress.suiteBaseNights': string;
  'stress.interestRate': string;
  'stress.loanCoverageRate': string;
  'stress.exitMultiple': string;
  'stress.modified': string;
  'stress.baseLabel': string;
  'stress.resetAll': string;
  'stress.changesNote': string;
  'stress.baseDefaults': string;

  // ── Returns page ──
  'returns.title': string;
  'returns.exitSub': string;
  'returns.hotelSaleValue': string;
  'returns.ebitdaExitMultiple': string;
  'returns.hotelSaleIRR': string;
  'returns.equityIRRHotel': string;
  'returns.propertySaleValue': string;
  'returns.propertySaleIRR': string;
  'returns.equityIRRProperty': string;
  'returns.hotelNetEquity': string;
  'returns.assetMinusLoan': string;
  'returns.hotelProjectIRR': string;
  'returns.unleveredHotel': string;
  'returns.propertyNetEquity': string;
  'returns.propertyMinusLoan': string;
  'returns.propertyProjectIRR': string;
  'returns.unleveredProperty': string;
  'returns.preferredExit': string;
  'returns.underwater': string;
  'returns.sensitivityNote': string;
  'returns.sensitivityLink': string;

  // ── Financing page ──
  'financing.securityNote': string;
  'financing.stabilisedDSCR': string;
  'financing.activePathNote': string;

  // ── Debt Coverage page ──
  'dc.title': string;
  'dc.covenantLabel': string;
  'dc.comfortLabel': string;

  // ── Cap Table page ──
  'ct.title': string;
  'ct.subtitle': string;
  'ct.exitAt': string;
  'ct.redactedOn': string;
  'ct.generateReport': string;
  'ct.reset': string;
  'ct.equityCoverage': string;
  'ct.founderComp': string;
  'ct.stakeholders': string;
  'ct.devEquity': string;
  'ct.layerA': string;
  'ct.layerB': string;
  'ct.layerC': string;
  'ct.founderOps': string;
  'ct.investorsKeep': string;
  'ct.colStakeholder': string;
  'ct.colCashIn': string;
  'ct.colPoolPct': string;
  'ct.colEconomicStake': string;
  'ct.colTotalReceived': string;
  'ct.colMOIC': string;
  'ct.colIRR': string;
  'ct.colPayback': string;
  'ct.colNotes': string;
  'ct.addInvestor': string;
  'ct.collapse': string;
  'ct.totalReceived': string;
  'ct.netProfit': string;
  'ct.founderTag': string;
  'ct.autoTag': string;
  'ct.footnoteWaterfall': string;
  'ct.footnoteFees': string;
  'ct.footnoteTip': string;
  'ct.exportDocx': string;

  // ── Page intros ──
  'dash.pageIntro': string;
  'pnl.pageIntro': string;
  'sc.pageIntro': string;
  'capex.pageIntro': string;
  'sens.pageIntro': string;
  'opco.pageIntro': string;
  'team.pageIntro': string;
  'returns.pageIntro': string;
  'dc.pageIntro': string;
  'financing.pageIntro': string;
  'ct.pageIntro': string;
  'lex.pageIntro': string;
  'as.pageIntro': string;
  'bank.pageIntro': string;

  // ── Auth Gate / Login ──
  'auth.gate.loading': string;
  'auth.pending.title': string;
  'auth.pending.body': string;
  'auth.pending.signOut': string;
  'auth.notFound.title': string;
  'auth.notFound.body': string;
  'auth.login.googleBtn': string;
  'auth.login.orDivider': string;
  'auth.login.emailPlaceholder': string;
  'auth.login.passwordPlaceholder': string;
  'auth.login.signInBtn': string;
  'auth.login.signUpBtn': string;
  'auth.login.toggleToSignUp': string;
  'auth.login.toggleToSignIn': string;
  'auth.login.displayNamePlaceholder': string;
  'auth.login.confirmPasswordPlaceholder': string;
  'auth.login.passwordMismatch': string;
  'auth.error.invalidCredentials': string;
  'auth.error.emailInUse': string;
  'auth.error.tooManyRequests': string;
  'auth.error.cancelled': string;
  'auth.error.unknown': string;

  // ── Team page ──
  'team.title': string;
  'team.subtitle': string;
  'team.sendInvite': string;
  'team.emailLabel': string;
  'team.emailNote': string;
  'team.roleLabel': string;
  'team.roleNote': string;
  'team.noteLabel': string;
  'team.noteOptional': string;
  'team.sendBtn': string;
  'team.sending': string;
  'team.inviteCreated': string;
  'team.peopleWithAccess': string;
  'team.loadingUsers': string;
  'team.noUsers': string;
  'team.colEmail': string;
  'team.colRole': string;
  'team.colJoined': string;
  'team.colLastSignIn': string;
  'team.consoleNote': string;
  'team.signInPrompt': string;
  'team.restricted': string;
  'team.notInvited': string;
  'team.loading': string;
  // ── Team page — approval ──
  'team.pendingApprovals': string;
  'team.noPendingUsers': string;
  'team.approveBtn': string;
  'team.revokeBtn': string;
  'team.denyBtn': string;
  'team.statusPending': string;
  'team.statusApproved': string;
  'team.colStatus': string;

  // ── Conservative Assumptions Memo ──
  'memo.buttonLabel': string;
  'memo.back': string;
  'memo.pageTitle': string;
  'memo.subtitle': string;
  'memo.execSummary': string;
  'memo.whatThisMeans': string;
  'memo.compTableTitle': string;
  'memo.compTableSubtitle': string;
  'memo.compTableNote': string;
  'memo.confidential': string;
  'memo.s1': string;
  'memo.s2': string;
  'memo.s3': string;
  'memo.s4': string;
  'memo.s5': string;
  'memo.s6': string;
  'memo.s7': string;
  'memo.s8': string;
  'memo.s9': string;
  'memo.s10': string;
  'memo.execBody': string;
  'memo.s1b1': string; 'memo.s1b1r': string;
  'memo.s1b2': string; 'memo.s1b2r': string;
  'memo.s1b3': string; 'memo.s1b3r': string;
  'memo.s2b1': string; 'memo.s2b1r': string;
  'memo.s2b2': string; 'memo.s2b2r': string;
  'memo.s2b3': string; 'memo.s2b3r': string;
  'memo.s3b1': string; 'memo.s3b1r': string;
  'memo.s3b2': string; 'memo.s3b2r': string;
  'memo.s3b3': string; 'memo.s3b3r': string;
  'memo.s4b1': string; 'memo.s4b1r': string;
  'memo.s4b2': string; 'memo.s4b2r': string;
  'memo.s5b1': string; 'memo.s5b1r': string;
  'memo.s6b1': string; 'memo.s6b1r': string;
  'memo.s6b2': string; 'memo.s6b2r': string;
  'memo.s7b1': string; 'memo.s7b1r': string;
  'memo.s7b2': string; 'memo.s7b2r': string;
  'memo.s7b3': string; 'memo.s7b3r': string;
  'memo.s8b1': string; 'memo.s8b1r': string;
  'memo.s8b2': string; 'memo.s8b2r': string;
  'memo.s9b1': string; 'memo.s9b1r': string;
  'memo.s9b2': string; 'memo.s9b2r': string;
  'memo.s9b3': string; 'memo.s9b3r': string;
  'memo.s9b4': string; 'memo.s9b4r': string;
  'memo.tCol1': string; 'memo.tCol2': string; 'memo.tCol3': string; 'memo.tCol4': string; 'memo.tCol5': string;
  'memo.tRow1': string; 'memo.tRow2': string; 'memo.tRow3': string; 'memo.tRow4': string;
  'memo.tRow5': string; 'memo.tRow6': string; 'memo.tRow7': string; 'memo.tRow8': string;
  'memo.conc1': string;
  'memo.conc2': string;
  'memo.conc3': string;
  // ── Custom OPEX / CAPEX lines on property templates ──
  'tpl.addOpexLine': string;
  'tpl.removeOpexLine': string;
  'tpl.addCapexLine': string;
  'tpl.removeCapexLine': string;
  'tpl.opexLineName': string;
  'tpl.capexLineName': string;

  // ── /admin/presentation ──
  'presentation.exportDocx': string;
  'presentation.print': string;
  'presentation.confidential': string;
  'presentation.loading': string;
  // Section headings
  'presentation.s0.title': string;
  'presentation.s0.subtitle': string;
  'presentation.s1.title': string;
  'presentation.s1.eyebrow': string;
  'presentation.s2.title': string;
  'presentation.s2.eyebrow': string;
  'presentation.s3.title': string;
  'presentation.s3.eyebrow': string;
  'presentation.s4.title': string;
  'presentation.s4.eyebrow': string;
  'presentation.s5.title': string;
  'presentation.s5.eyebrow': string;
  'presentation.s6.title': string;
  'presentation.s6.eyebrow': string;
  'presentation.s7.title': string;
  'presentation.s7.eyebrow': string;
  'presentation.s8.title': string;
  'presentation.s8.eyebrow': string;
  'presentation.s9.title': string;
  'presentation.s9.eyebrow': string;
  'presentation.s10.title': string;
  'presentation.s10.eyebrow': string;
  'presentation.s11.title': string;
  'presentation.s11.eyebrow': string;
  // Cover KPI tile labels
  'presentation.kpi.totalCapex': string;
  'presentation.kpi.loanRequested': string;
  'presentation.kpi.ltc': string;
  'presentation.kpi.equityIRR': string;
  'presentation.kpi.totalMoic': string;
  'presentation.kpi.stabilisedDscr': string;
  'presentation.kpi.assetCoverage': string;
  // Exec summary prose keys
  'presentation.s1.theProject': string;
  'presentation.s1.whatWeBuilt': string;
  'presentation.s1.whyNow': string;
  'presentation.s1.financingRequested': string;
  // Stress-test discipline keys
  'presentation.s2.p1': string;
  'presentation.s2.p2': string;
  'presentation.s2.p3': string;
  'presentation.s2.p4': string;
  'presentation.s2.callout': string;
  // Conclusion
  'presentation.s11.closingProse': string;
  'presentation.s11.callout': string;
  // OPEX overlay badge
  'presentation.opexContingencyBadge': string;
}
