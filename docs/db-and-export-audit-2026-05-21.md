# DB persistence & Excel-export audit — 2026-05-21

Scope: `villa-lev-platform/` only. Read-only audit, no code edits.

Sources: `src/lib/store/modelStore.ts`, `src/lib/hooks/useModel.ts`, `src/lib/firebase.ts`, `src/lib/data/useSeasonSnapshot.ts`, `src/lib/excel/exportBP.ts`, `src/lib/engine/types.ts`, both `firestore.rules` files (this app and `~/Desktop/Villa Lev Claude/villa-lev-admin/firestore.rules`), `src/app/investor/page.tsx`, `src/app/admin/dashboard/page.tsx`.

This is a Next 16 static-export app. No server runtime — `firestore.rules` is the sole authorisation layer between an anonymous browser and the database.

---

## Part A — DB persistence audit

### A.1 State-slice inventory

| State slice | Current location | Should-be location | Security / data-loss gap | Effort |
|---|---|---|---|---|
| `savedConfigs` (named scenarios) | localStorage **+ Firestore `scenarios/*`** (write-through) | Both, as today | Firestore rule allows anonymous overwrite of any scenario by ID (A.2 #1) | n/a |
| `lastSavedConfigId/Name`, `currentUser`, `activeScenario`, `savePromptDisabled` | localStorage | localStorage — fine (UI prefs) | None | n/a |
| `templates` (custom + modified built-ins) | localStorage only | **Firestore** | Lost on cache clear unless rolled into a saved scenario | S |
| `projects` (current project list) | localStorage only | **Firestore** | Lost on cache clear | S |
| `assumptions` (rates, ramps, tax, financing path, exit multiple, DSCR covenant…) | localStorage only | **Firestore** | Live working model is single-browser; cleared cache = full reset | M |
| `history` (change audit trail, attributed) | localStorage only, cap 200 | **Firestore** | The audit trail itself is local-only and silently trims | M |
| `capTable` stakeholders | localStorage only | **Firestore** | Two operators see two cap tables; edits drive investor distributions in the xlsx | S |
| `waterfall` params | localStorage only | **Firestore** | Same as cap table | S |
| `seasonSnapshots/latest` (read) | **Firestore** subscribed, static fallback | Firestore | Public read (A.2 #2) | n/a |

`init()` (modelStore.ts:1102) **does** background-merge `scenarios` from Firestore and pushes local-only entries up — so the saved-scenarios slice already qualifies as "Firestore is the state of record". Everything else above is local-only. To meet Eytan's "works through a DB" bar, the bolded slices need the same write-through-to-Firestore treatment.

### A.2 Top Firestore-rule gaps

Two `firestore.rules` files coexist on the shared `villa-lev-admin` project: `villa-lev-platform/firestore.rules` (this app, governs `scenarios`) and `villa-lev-admin/firestore.rules` (ops app, governs everything else). Whichever app deployed last wins on the project.

1. **`scenarios/{scenarioId}` write is fully public, no auth.** `setDoc` is create-or-replace. Anyone reaching the deployed URL can enumerate every saved scenario (read=true) **and overwrite any of them by ID**. Shape validation (`id is string`, `name is string`, `savedAt is number`, `size() <= 50`) is paper-thin; `assumptions/templates/projects` are opaque maps. The only mitigation is `allow delete: if false`, which closes the prior wipe vulnerability. **Impact: a banker walking through a share link sees a model that anyone on the internet can mutate underneath them.** This is the single most important DB risk. The file's own header comment flags Firebase Auth as a known follow-up; fix is to add Google sign-in restricted to Eytan's email (mirror the ops app's `isAdmin()`), then restrict `update` to the doc's `createdBy`.

2. **`seasonSnapshots/{snapshotId}` read is fully public.** Holds booking pipeline + occupancy + ADR for the live villa. This is intentional (the investor dashboard runs unauthenticated), but worth Eytan confirming: anyone with the Firebase project ID can read live operating metrics. Write is correctly admin-only in the ops-app ruleset.

3. **Rule-deploy race between the two apps.** Redeploying rules from `villa-lev-platform` would erase the ops app's rules on `bookings`, `invoices`, `bank_transactions`, etc. The files are not synchronized. Worth an ADR + a single canonical ruleset.

---

## Part B — Excel export coverage

`exportBusinessPlan(assumptions, model, scenario, capTable, waterfall)` is invoked identically from `/investor` and `/admin/dashboard` — one Excel, not several. Output is 9 sheets: Cover, Assumptions, CAPEX, Revenue, OPEX & P&L, Debt Service, Coverage, Scenarios, Cap Table, Waterfall.

Formatting is genuinely good: every numeric cell carries `numFmt` (`€#,##0;[Red]-€#,##0`, `0.0%`, `0.00"×"`); blue=editable / grey=derived styling is consistent; defined names (`villaADR`, `loanRate`, …) let a banker write `=villaADR`; `fullCalcOnLoad=true` so Excel recomputes on open; a Cover-sheet validation block compares engine values against embedded formula results. Not a raw dump.

### B.1 Engine ↔ export gaps

| Engine produces | Export covers? | Gap | Effort |
|---|---|---|---|
| CAPEX (per-prop, per-category) | Yes | — | — |
| Revenue per property, events, ancillary, ramp | Yes | — | — |
| EBITDA, P&L, margins | Yes | — | — |
| Term loan interest / principal / **balance** | Partial — balance only at exit year | **Year-by-year amortisation schedule missing**. Debt Service sheet collapses to 5 rows | M |
| `cfads`, `dscr`, `dscrLoaded`, **`interestCoverageRatio`** | DSCR yes; **ICR row absent** | ICR is a standard bank covenant | S |
| `vatPayable`, `citPayable` | Bundled into one row | Split CIT vs VAT (pass-through) | S |
| `wcAvgBalance/wcPeakBalance/wcTroughBalance/wcNetContribution/wcSelfLiquidatingViolation` | Only `wcInterestExpense` | **Whole working-capital block missing.** Peak balance + self-liquidating-violation flag are bank covenants | M |
| `WorkingCapitalQuarter[]` (quarterly draws/repayments) | No | Cover even acknowledges "annual aggregate; in-app runs quarterly" | M |
| `profitAfterTax`, `cumulativeYieldOnInitialEquity` | Partial — no cumulative yield | — | S |
| `opCoBaseFee/Brand/Incentive/Total`, `ebitdaPreOpCo`, `equityIRRPreOpCo` | No | **Whole OpCo/PropCo split invisible** despite `/admin/opco-split` UI | M |
| `llcr`, `plcr`, `peakDebtOutstanding`, `gracePeriodInterestTotal`, `netLeverage`, `dscrCovenantHeadroom` | No | **None of the senior-debt underwriting metrics make it in.** First-question items in a bank meeting | S |
| `terminalUnderwater` flag | No | Underwater exits silently produce zero equity IRR without a warning | S |
| `totalMOIC` per scenario | MOIC on Coverage is locally recomputed (not pulled from engine); per-scenario MOIC absent on Scenarios sheet | Risk of drift if engine formula changes | S |
| `financingComparison` (commercial vs RRF vs grant vs TEPIX) | No | **Eytan's whole financing-path comparison missing.** Debt Service shows the active path only | M |
| `dscrByYear` per path | DSCR per scenario yes; per-path no | — | S |
| `collateral` (stress/market/optimistic valuations, LTV, coverage) | No | Lender collateral coverage absent | M |
| `breakEvenNights`, `bufferToBreakEven` | No | Break-even sensitivity (also `/admin/breakeven`) absent | S |
| `keyMetrics.ltv`, `assetCoverage`, `portfolioValue`, `supplementaryLoan`, `landFundedByTepix`, `landFundedByCommercial` | Partial | LTV, asset coverage, TEPIX land-split absent | S |
| `seasonSnapshot` (live ops actuals — occupancy, ADR, RevPAR, last season) | **No** | **"What we actually achieved" baseline never lands in the BP xlsx.** Reader gets no historical context | M |
| Saved-scenario list / change-history audit | No | Useful for an investor diligence pack | M |
| Greek translations | No | EN-only despite the bilingual app | M |

### B.2 Formatting issues

- Numeric formatting solid throughout.
- WC interest, taxes, and remaining-debt-at-exit cells are hardcoded engine values with **blue "editable" fill** instead of grey/locked. A banker editing those would silently desync from EBITDA. Should be greyed or annotated.
- Equity-payback row writes the string `'beyond projection'` into a numeric column when payback exceeds the horizon — breaks conditional formatting.
- Cover date is `en-GB` only; no Greek-locale variant for a Greek banker.

### B.3 Recommended export-completeness checklist

Cover + validation, Assumptions, CAPEX, Revenue, OPEX & P&L (CIT vs VAT split), **full debt amortisation table**, **working-capital sheet (annual + quarterly + peak/trough/violation)**, Coverage (DSCR + **ICR + LLCR + PLCR** + covenant Pass/Fail), **Financing-path comparison**, **OpCo/PropCo split + pre/post-split equity IRR**, Scenarios, **Collateral coverage**, **Break-even nights + buffer**, **Historical actuals from seasonSnapshot**, Cap Table, Waterfall. Bolded items are missing today.

---

## Top 5 actions, ranked

1. **Lock `scenarios` writes behind Firebase Auth (Eytan's email only).** The current rule allows anonymous overwrite of any saved scenario by ID — already flagged as a known follow-up in the file header. Mirror the ops app's `isAdmin()` pattern; restrict `update/delete` to `createdBy`. Effort: S.
2. **Reconcile the two `firestore.rules` files into one canonical ruleset** and deploy from one app. Today the last `firebase deploy` wins. ADR-worthy. Effort: M.
3. **Add the missing financing/debt sheets to the export:** year-by-year amortisation schedule, financing-path comparison, working-capital block (quarterly + peak/trough/violation), LLCR/PLCR/ICR. All already exist in `ModelOutput`. Effort: M.
4. **Migrate `assumptions`, `templates`, `projects`, `capTable`, `waterfall`, `history` to Firestore write-through** — the pattern `savedConfigs` already uses. Resolves Eytan's "works locally, not in a DB" complaint. Auth from #1 makes each operator's working model their own. Effort: M.
5. **Add OpCo split, collateral, break-even, and seasonSnapshot-backed historical-actuals sheets to the xlsx.** Engine + UI both have these; the export is the only place they're missing. Effort: M.
