# Villa Lev Platform — Financial & Banking Audit

**Date:** 2026-06-03
**Auditor:** Senior project-finance / credit analyst (read-only pass)
**Scope:** Engine correctness, lender completeness, bank presentation quality, trust & integrity
**Files reviewed:** `model.ts`, `types.ts`, `defaults.ts`, `financeUtils.ts`, `capTable.ts`, `founderWaterfall.ts`, `workingCapital.ts`, `BankPnLSection.tsx`, `BankStressTest.tsx`, `SourcesUsesPanel.tsx`, `bank/page.tsx`, `AUDIT/00-feature-map.md`

---

## Executive Summary

The engine is architecturally sound for a dynamic hospitality development model. The core DSCR formula, CFADS computation, grace-period waterfall, tax-loss carryforward, and OpCo subordination mechanics are correctly implemented. The bank-view viewMode divergence is clean and provably correct. Four formula-level issues warrant attention before the model is submitted to a credit committee; none are arithmetic errors in the core DSCR — the issues are in supporting metrics (ICR computation, DSRA trigger logic, distribution-gate definition, and a minor LTV metric selection). The more significant gaps are on the lender-completeness side: there is no static covenant-breach tracker, no drawdown schedule tied to milestones, no construction cost overrun reserve line, no LTV-at-exit table, and no model-snapshot lock mechanism. These are standard credit-committee prerequisites and should be addressed before the bank submission meeting.

---

## Findings Table

| ID | Lens | Area | Evidence | Finding | Recommendation | Impact | Effort | Confidence |
|---|---|---|---|---|---|---|---|---|
| FI-01 | Correctness | Engine — ICR | `model.ts:2094` | `interestCoverageRatio = ebitdaPreOpCo / termLoanInterest`. **Numerator is correct** (pre-OpCo EBITDA) but the denominator uses term-loan interest only; it omits WC facility interest. The ICR displayed on the bank view therefore overstates the true interest coverage in years 2029–2031 when WC draws are active. The gap equals `wcInterestExpense / termLoanInterest` — small but non-zero. | Add WC interest to the ICR denominator: `(ebitdaPreOpCo) / (termLoanInterest + wcInterestExpense)`. This matches the `dscrLoaded` formula pattern already in the engine. | Med | Low | Fact |
| FI-02 | Correctness | Engine — DSRA trigger | `model.ts:2283–2288` | DSRA shortfall is computed for `year >= FIRST_OPERATIONAL_YEAR` (2030) but **excludes OPENING_YEAR (2029)**. The first partial-season year is precisely the highest-risk year for a covenant breach; the reserve target is therefore underestimated. Cross-check: `operationalRows = pnl.filter(row => row.year >= FIRST_OPERATIONAL_YEAR)` — 2029 is excluded. | Change the DSRA filter to `year >= OPENING_YEAR` so the 2029 ramp year is included in the worst-year shortfall calculation. | Med | Low | Fact |
| FI-03 | Correctness | Engine — distribution gate | `model.ts:2096–2099` | `distributionThresholdCrossed = true` when `dscr >= 1.0`. The constant `PROJECT_CONSTANTS.DISTRIBUTION_RESERVE_THRESHOLD` (€400K annual NCF) is defined in `defaults.ts:73` specifically for the ADR-0014 distribution gate, but the engine uses `dscr >= 1.0` instead. These are materially different: a DSCR of 1.0 means the project barely covers debt service from EBITDA but may still have negative post-tax NCF (VAT, WC interest). The gate should use the NCF threshold, not DSCR. The gate **is** correctly applied using `DISTRIBUTION_RESERVE_THRESHOLD` in `bank/page.tsx:100` for the UI badge — creating an inconsistency between engine and UI logic. | Unify the engine's `distributionThresholdCrossed` logic to match the ADR-0014 definition: `netCashFlowPostVAT >= DISTRIBUTION_RESERVE_THRESHOLD` (once crossed, latches). This ensures `distributionGated` on every `AnnualPnL` row is consistent with the badge. | High | Low | Fact |
| FI-04 | Correctness | Engine — LTC / LTV metric | `model.ts:2973` | `keyMetrics.ltv = collateral.market.ltv`, which is `loan / (builtSurface × market_€/m²)`. This is a **construction LTV against notional completed value** — not a loan-to-cost ratio. It is labelled `ltv` but structurally it is a forward completion-value LTV, which a lender will not accept as the primary LTC metric during construction. The LTC ratio (loan / total project cost) is the standard construction-phase metric and is not surfaced in `keyMetrics`. | Add `loanToProjectCost` to `keyMetrics`: `loanAmount / totalCapex`. Rename or retag `ltv` as `collateralLTV` for clarity in the bank view. Both should be visible to the lender. | High | Low | Fact |
| FI-05 | Correctness | Engine — RRF grace interest | `model.ts:1031` | The RRF path's `rrfGetDS` for the grace years reuses `commercialLoan.interest2026/2027/2028` scalars rather than deriving IO from `rrfBlendedRate × drawn balance`. The RRF blended rate (0.35% × 80% EU + 5% × 20% commercial ≈ 1.3%) is materially lower than the commercial rate (4%). Using the commercial scalars overstates grace-period interest on the RRF path. | Either derive RRF grace interest from the blended rate (consistent with how Optima and TEPIX paths work), or add dedicated `rrf.interest2026/2027/2028` fields analogous to `grant.interest2026/2027/2028`. | Med | Med | Fact |
| FI-06 | Correctness | Engine — TEPIX grace overlap | `model.ts:1132–1148` | In the `tepix-loan` path `tepixGetDS`, years covered by `subsidyDurationYears` take priority over the `tepixGraceEndYear` branch. If `subsidyDurationYears = 2` and `gracePeriodYears = 2` (defaults: both 2), then `tepixGraceEndYear = 2028` is also `HORIZON_START_YEAR + 1 = 2027` — wait, `HORIZON_START_YEAR + subsidyDurationYears - 1 = 2027` and `tepixGraceEndYear = 2028`. The 2028 year hits the `tepixGraceEndYear` branch correctly. However if `subsidyDurationYears > gracePeriodYears`, the subsidy branch would return IO beyond the grace end, skipping the full-DS transition. This is a latent edge-case risk for configurations that differ from defaults. | Add a guard: subsidy branch should only fire for `year <= tepixGraceEndYear`. Document the assumption that `subsidyDurationYears <= gracePeriodYears`. | Low | Low | Hypothesis |
| FI-07 | Correctness | Engine — MOIC denominator | `model.ts:2449–2455` | `totalMOIC` denominator is `totalEquityAtClose = equityRequired + graceInterestCarry`. The `preOpeningEquityBuffer` (1 month portfolioOpex, ~€10–15K) is NOT included in the denominator even though it is described as equity-funded day-one capital. This creates a very minor overstatement of MOIC. | Add `preOpeningEquityBuffer` to `totalEquityAtClose` in the MOIC and IRR denominator computation. | Low | Low | Fact |
| FI-08 | Completeness | Bank view — covenant tracker | `/bank/page.tsx`, `BankPnLSection.tsx` | No per-year covenant pass/fail column is displayed in the bank view. The `dscrCovenantThreshold` (1.25) is defined as an assumption and used in headroom calculation, but there is no visual covenant breach/pass table showing Year × Scenario × Pass/Fail. This is a standard credit-committee output. | Add a DSCR covenant table to the bank view (or as a section in `BankPnLSection`): columns = years 2029–2037; rows = Realistic/Downside/Break-Even; cells = DSCR with green/amber/red against 1.25 floor. Already partially available in data (`dscrByYear`, `dscrCovenantHeadroom`) — rendering only. | High | Med | Hypothesis |
| FI-09 | Completeness | Bank view — drawdown schedule | `/bank/page.tsx`, `SourcesUsesPanel.tsx` | No milestone-linked drawdown schedule is shown. The bank sees total loan drawn and `graceInterestCarry` but cannot verify that tranches are tied to construction milestones. The two-phase draw (T1 land + T2-T5 construction) is modeled in the engine but not rendered in a drawdown table. | Add a construction drawdown table to the bank view: columns = year + Q, rows = tranche (T1 land, T2–T5 construction), amounts, cumulative drawn, milestone trigger. Derive from `debtResult.rollingTranches` or the `plotsStartYear/constructionStartYear` parameters already in the model. | High | Med | Hypothesis |
| FI-10 | Completeness | Bank view — cost overrun reserve | `/bank/page.tsx`, engine | No construction cost overrun reserve or contingency coverage ratio is surfaced to the lender. `contingencyRate = 10%` is built into CAPEX but the bank view does not communicate this as explicit overrun protection. | Add a "Cost overrun headroom" metric to the bank deal overview: contingency amount (€), contingency as % of hard costs, and the implied cost overrun % the project can absorb before equity is exhausted. Computable from `capex.categories` (Contingency line) and `keyMetrics.equityRequired`. | Med | Low | Hypothesis |
| FI-11 | Completeness | Bank view — LTV at exit | `/bank/page.tsx`, engine | No LTV-at-exit table is shown. The collateral panel shows LTV at construction cost (forward value), but a credit committee needs to see projected LTV at each repayment year as the loan amortises and the asset appreciates. | Add a "LTV progression" table: years 2029–2037, columns = loan balance, assumed asset value (at market €/m² for collateral conservatism), LTV ratio. Data is available (`amortSchedule` closing balances + collateral tiers). | High | Med | Hypothesis |
| FI-12 | Completeness | Sources & Uses — equity priority | `SourcesUsesPanel.tsx` | The Sources & Uses panel does not convey that equity is injected BEFORE debt draws (equity-in-first convention). A lender reviewing the panel cannot confirm the draw order. The panel shows totals only. | Add a footnote or sequential draw waterfall note explicitly stating: "Equity (€X) deployed first — land acquisition 2026; debt drawn in tranches from 2026 Q1 (land) and 2027 Q1 (construction)." | Med | Low | Hypothesis |
| FI-13 | Completeness | Bank view — repayment waterfall | `/bank/page.tsx` | No loan repayment waterfall or amortisation schedule table is shown to the lender. `termLoanBalance` and `termLoanPrincipal` appear in `BankPnLSection` but only when the Finance section is expanded — easy to miss. There is no top-level repayment summary. | Add a compact loan amortisation summary card above or alongside the P&L: columns = year, opening balance, interest, principal, closing balance. Five rows (2029–2033) is sufficient to demonstrate the repayment profile. | High | Low | Hypothesis |
| FI-14 | Completeness | Bank view — assumption audit trail | `bank/page.tsx`, `modelStore.ts` | The `history: ChangeEntry[200]` audit trail in `modelStore` is admin-only. The bank view does not show when assumptions were last changed or by whom. A lender receiving a link to the bank view has no way to verify model integrity. | Surface a "Last updated" timestamp and scenario name on the bank view header. Derive from `savedConfig.savedAt` (Firestore scenario timestamp). This does not expose internal history — just the publication date of the current scenario. | High | Low | Hypothesis |
| FI-15 | Completeness | Bank view — LLCR/PLCR | `/bank/page.tsx:116–118` | `llcr` and `plcr` are computed and available on `activeScenarioOutput` but are NOT rendered on the main bank Overview tab. They only appear in the admin `/admin/debt-coverage` page. LLCR/PLCR are standard bank underwriting metrics (NPV of future CFADS / opening debt). | Add LLCR and PLCR to the bank view coverage metrics panel alongside DSCR. Values are immediately available from `model.scenarios[activeScenario].llcr` and `.plcr`. | High | Low | Fact |
| FI-16 | Bank presentation | Bank view — stress-test output strip | `BankStressTest.tsx:277–301` | The stress-test output strip shows only three metrics: DSCR (stabilised), EBITDA (stabilised), LTV. Missing: minimum DSCR over loan life, year of minimum DSCR, and NCF/interest cover. The stabilised DSCR is the most optimistic single-year figure — a credit committee will focus on the worst-year DSCR. | Add `minDSCRLoanLife` (and the year it occurs) to the stress-test output strip. Already computed on `activeScenarioOutput.minDSCRLoanLife` and surfaced on `bank/page.tsx:112–113`. | High | Low | Fact |
| FI-17 | Bank presentation | Bank view — EBITDA label ambiguity | `BankPnLSection.tsx:238–248` | The P&L shows two EBITDA rows in close proximity: `ebitdaPreOpCo` (labelled "GOP Pre-Mgmt") and `ebitda` (labelled "EBITDA net of mgmt fees"). The DSCR numerator uses `ebitdaPreOpCo` in bank view, but the label "DSCR — Base Case" in the coverage section does not cross-reference which EBITDA line it uses. A banker reading the table may not realise the DSCR numerator differs from the EBITDA shown in the EBITDA row. | Add a tooltip or footnote to the DSCR row: "Numerator: GOP pre-management fees (bank-view: management fees are subordinated to debt service per ADR-0028)." This is factually correct and reinforces the bank-view contract. | Med | Low | Hypothesis |
| FI-18 | Bank presentation | Bank view — grace-period interest reserve visibility | `BankPnLSection.tsx:326–336` | The equity section shows `graceInterestCarry` as a separate line in the equity waterfall, but it is collapsed by default (inside the `equityCf` section). A banker reviewing the deal overview may not notice the €322K interest reserve. This amount significantly affects day-one equity requirements. | Move the `graceInterestCarry` line to the uncollapsed equity summary or to the deal overview KPI grid so it is visible without user interaction. | Med | Low | Hypothesis |
| FI-19 | Bank presentation | Bank view — WC facility adequacy | `/bank/page.tsx`, `SourcesUsesPanel.tsx` | The WC facility (€560K) is shown as a memo line in SourcesUsesPanel but its adequacy relative to the peak VAT-bridge need (€728K per `workingCapital.ts:86–88`) is not highlighted. The computed `wcMinimumFacility` (€750K per `workingCapital.ts:219`) actually exceeds the facility size. This is a potential covenant breach risk that a lender should see explicitly. | Add a "WC facility adequacy" indicator: if `wcMinimumFacility > facilitySize`, show a warning badge. Already computed; just needs rendering. Per ADR-0015 notes the peak float is €728K and minimum facility is €750K — the current default of €560K is therefore structurally short. | High | Low | Fact |
| FI-20 | Bank presentation | Bank view — no exit analysis | `/bank/page.tsx` | The bank view has no exit analysis section showing: terminal asset value, remaining debt at exit, LTV at exit, and implied equity IRR. The lender's exit risk (whether they are repaid in full at exit) is not visible. | Add a compact exit analysis row to the bank view: exit year, terminal asset value (EBITDA × multiple), loan balance at exit, terminal LTV. All data is available from `activeScenarioOutput` (`terminalAssetValue`, `terminalEquityValue`, `terminalUnderwater`). | High | Low | Fact |
| FI-21 | Trust & Integrity | Model snapshot — no lock mechanism | All | There is no mechanism to lock a submitted model snapshot. The Firestore `scenarios` collection stores `savedAt` but assumptions can be changed after publication without the bank being notified. The `viewMode` field is not persisted in Firestore (by design per ADR section 6). A banker who bookmarked the `/bank` URL will see live updates to the model — including mid-meeting assumption changes. | Implement a "Submit to bank" action that creates a read-only Firestore document (with `locked: true` flag) and generates a version-specific URL (`/bank?snap={id}`). The locked snapshot renders from the frozen document, not the live store. | High | High | Hypothesis |
| FI-22 | Trust & Integrity | IRR — duplicate implementation | `model.ts:43–88`, `financeUtils.ts:12–46` | Two separate Newton-Raphson IRR implementations exist: one private in `model.ts` (called `irr`), one exported from `financeUtils.ts` (called `irrNewton`). `capTable.ts` and `founderWaterfall.ts` import from `financeUtils.ts`; the main engine uses its own private copy. The two implementations have one difference: the private `model.ts` version returns `NaN` on no sign-change; `irrNewton` returns `0`. This is a behavioural divergence that could surface as a rendering difference (NaN vs 0 display) in edge cases. | Consolidate to the `financeUtils.ts` exported version. Remove the private copy from `model.ts`. Update call sites. Ensure the NaN/0 divergence is resolved consistently (prefer NaN for upstream null-coalescing). | Low | Med | Fact |
| FI-23 | Trust & Integrity | NPV — duplicate implementation | `model.ts:43–49`, `financeUtils.ts:4–9` | Same issue as FI-22: `npv()` is defined identically in both files. No behavioural divergence but creates maintenance risk (a future bug fix applied to one copy will not propagate to the other). | Consolidate to `financeUtils.ts`. Remove `model.ts` private copy. | Low | Low | Fact |
| FI-24 | Trust & Integrity | gracePeriodYears — inert UI field | `types.ts:287`, ADR-0009 | `gracePeriodYears` in `CommercialLoanParams`, `RRFParams`, `TepixLoanFundParams`, `GrantParams` is stored and editable in the assumptions UI but is NOT read by the engine `getDS` closures for `standard` graceMode. The engine uses `HORIZON_START_YEAR + gracePeriodYears` only for `rolling-cohort` mode; standard mode hard-reads `interest2026/2027/2028` scalars. A user who changes `gracePeriodYears` in the UI expecting to extend the grace period will see no effect. | Either: (a) wire `gracePeriodYears` into the `standard` grace boundary (ADR-0009 deferred work), or (b) grey out / disable the `gracePeriodYears` field in the UI for standard mode with a tooltip "Grace period is controlled by the interest scalar fields". Option (b) is lower risk. | High | Med | Fact |
| FI-25 | Correctness | Engine — break-even formula | `model.ts:2699–2731` | The break-even scenario applies the same `breakevenFactor` to **both** occupancy and ADR simultaneously: `beOccFactor = 1 - breakevenFactor`, `beAdrFactor = 1 - breakevenFactor`. This double-deflation understates the true revenue floor because both price and volume are stressed simultaneously at the same rate. The actual break-even (revenue = DS + OPEX) would be reached at a higher individual factor if only one lever is stressed. The break-even scenario as currently computed is more conservative than labelled — it is a combined stress, not a single-axis break-even. | Document in the bank view that the break-even scenario represents a simultaneous ADR + occupancy stress (both reduced by the same factor). Alternatively, rename the scenario "Combined stress" and add a separate single-axis break-even sensitivity. Credit committees expect single-axis break-even analysis. | Med | Low | Hypothesis |
| FI-26 | Completeness | Tax — depreciation deductibility | `model.ts:1953–1954`, `types.ts:718–719` | Annual depreciation (`annualDepreciationTotal`) correctly flows into the CIT base from `OPENING_YEAR` onward per Greek Law 4172/2013 Art. 24. However, the bank view P&L does not show a "Tax shield from depreciation" line to help the lender understand why CIT is low in early years. Without this, a banker may question why the tax line looks understated. | Add a "Depreciation tax shield" line (= annualDepreciation × taxRate) to the collapsed EBIT or tax section of the bank P&L. Informational only; values are already computed. | Low | Low | Hypothesis |
| FI-27 | Completeness | Working capital — VAT bridge gap | `workingCapital.ts:82–88`, `defaults.ts:857` | The `VAT_BRIDGE_CLOSING` schedule in `workingCapital.ts` hard-codes peak exposure at €728,554 (Q2-Q4 2029). The `ensurePortfolioOpex` function in `defaults.ts:857` resets `facilitySize` to €560K for stale saves (under €400K). The minimum facility computed by the engine is €750K (next €50K above the peak). The default live `facilitySize = 560K` is therefore **structurally below the computed minimum facility** of €750K. The engine does not block draws above the effective facility — it just tracks a violation flag. | Alert the operator that the WC facility size must be at least €750K to cover the VAT bridge peak. This finding surfaces in `wcMinimumFacility` but is not shown to the banker. Cross-reference FI-19. | High | Low | Fact |

---

## Lens Summaries

### Correctness

Core formulas are correct:
- **CFADS:** `ebitdaPreOpCo - wcInterestExpense + citPayable` — correctly excludes WC interest from the DSCR numerator and adds CIT (which is negative) to reflect real after-tax cash. This is a non-standard but defensible CFADS definition consistent with the bank-view OpCo subordination contract (ADR-0028).
- **DSCR:** `ebitdaPreOpCo / totalDS` in bank view — correct per ADR-0028. The numerator is pre-OpCo EBITDA; OpCo fees are junior to DS.
- **LTC sizing:** `loanAmount = totalCost × loanCoverageRate` — straightforward; no formula error found.
- **PMT formula:** `pmt(rate, nper, pv) = rate × pv / (1 − (1+rate)^−nper)` — matches Excel PMT convention.
- **IRR:** Newton-Raphson with bisection fallback; correct construction-spend negative cash flows at t=0.
- **Tax loss carryforward:** FIFO vintage pool, 5-year expiry, correctly applied per Greek Law 4172/2013 Art. 27.
- **DSRA:** Correctly computed as NPV shortfall, funded by sweep + partner advance, drawn to supplement CFADS below target DSCR.
- **Grace-period IRR add-back:** Grace-year debt service is correctly added back to NCF for IRR computation (pre-funded reserve, no double-counting).

Issues found: FI-01 (ICR denominator), FI-02 (DSRA year range), FI-03 (distribution gate definition mismatch), FI-04 (LTC vs LTV metric labelling), FI-05 (RRF grace interest), FI-25 (break-even axis ambiguity).

### Completeness for a Lender

Items a credit committee will request that are currently absent or under-surfaced:

| Requirement | Status |
|---|---|
| DSCR floor covenant tracker (annual Pass/Fail table) | Missing (FI-08) |
| Drawdown schedule tied to milestones | Missing (FI-09) |
| Construction cost overrun reserve headline | Missing (FI-10) |
| LTV at exit / LTV progression table | Missing (FI-11) |
| Equity-in-first draw order confirmation | Missing (FI-12) |
| Loan repayment waterfall (amortisation summary) | Buried in collapsed section (FI-13) |
| Assumption change audit trail visible to banker | Missing (FI-14) |
| LLCR / PLCR on bank overview | Missing — admin-only (FI-15) |
| Exit analysis (terminal LTV, underwater flag) | Missing (FI-20) |
| WC facility adequacy vs VAT-bridge peak | Hidden — not rendered (FI-19/27) |

### Bank Presentation

The bank view tells a coherent collateral and revenue story. `LiveTrackRecord`, `ConservatismTriangle`, and the market comparables drawer are strong differentiators. The section order (deal overview → P&L → stress test → collateral → VAT cashflow → market) is logical for a lender reading sequentially.

Items to **remove or simplify**: none are obviously misleading or harmful; the `AssumptionsMemoButton` is already commented out.

Items to **reorder**: the stress-test output strip (FI-16) should show minimum DSCR before stabilised DSCR — lenders focus on the worst year, not the best year.

Items to **add**: exit analysis card (FI-20), covenant pass/fail table (FI-08), LLCR/PLCR headline (FI-15), drawdown schedule (FI-09).

Items to **clarify**: DSCR numerator footnote (FI-17), grace-interest reserve prominence (FI-18), break-even scenario label (FI-25).

### Trust & Integrity

Numbers can be traced from inputs (assumptions editor) to outputs (P&L rows) — the Zustand store is the single source of truth, `computeModel` is deterministic, and the audit trail (`history`) captures every assumption change. The `viewMode` is correctly isolated from Firestore persistence so bank snapshots always reflect the internal view.

Critical gap: no model-snapshot lock (FI-21). The current architecture allows the live model to be modified after a banker has been given the URL. This is a trust issue for any formal submission. The `scenarios` collection has `savedAt` timestamps but no read-only version URL. This is the single highest-impact improvement before a credit committee meeting.

Secondary gap: gracePeriodYears inert field (FI-24) is a UI trust issue — the operator can change a field that has no effect and believe they have extended the grace period.

---

## Priority Recommendations (by Impact × Effort)

**Do before bank submission (High Impact, Low/Med Effort):**
1. FI-03 — Fix distribution gate to use NCF threshold not DSCR (2 lines of code)
2. FI-04 — Add LTC metric (`loanAmount / totalCapex`) to keyMetrics
3. FI-15 — Render LLCR/PLCR on bank overview tab
4. FI-16 — Add `minDSCRLoanLife` to stress-test output strip
5. FI-20 — Add exit analysis card to bank view
6. FI-19/27 — Surface WC facility adequacy warning (VAT bridge peak > facility size)
7. FI-01 — Fix ICR denominator to include WC interest
8. FI-02 — Fix DSRA shortfall window to include 2029

**Do before formal credit committee submission:**
9. FI-21 — Model snapshot lock (locked Firestore doc + version URL)
10. FI-08 — DSCR covenant pass/fail table
11. FI-09 — Construction drawdown schedule tied to milestones
12. FI-13 — Promote loan amortisation summary out of collapsed section
13. FI-11 — LTV-at-exit / LTV progression table
14. FI-14 — Surface scenario publication date to banker

**Backlog (Low impact or high effort):**
15. FI-22/23 — Consolidate duplicate IRR/NPV implementations
16. FI-05 — Fix RRF grace interest derivation
17. FI-24 — Wire gracePeriodYears into standard mode or grey out the UI field
18. FI-10 — Cost overrun reserve headline
19. FI-17 — DSCR numerator footnote
20. FI-25 — Break-even scenario label / dual-axis analysis
21. FI-26 — Depreciation tax shield line in bank P&L
22. FI-06 — TEPIX subsidy/grace overlap guard
23. FI-07 — Add preOpeningEquityBuffer to MOIC denominator

---

*This audit is read-only. No code was modified. All findings reference specific file paths and line numbers as observed at time of review.*
