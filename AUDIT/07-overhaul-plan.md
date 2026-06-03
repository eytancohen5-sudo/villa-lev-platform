# Villa Lev Finance Platform — Overhaul Plan
Generated: 2026-06-03  
Principal architect synthesis of six specialist audits (00–06).  
This document is the single executable reference. Specialists' individual files are evidence; this file is the plan.

---

## 1. Executive Summary

Eight moves ordered by urgency. The first three are existential for a TEPIX III bank submission.

### 1. Admin password is in the JavaScript bundle — fix before the next bank meeting (BE-01)
The password `"villa2026"` is hardcoded into the compiled static JavaScript that every visitor's browser downloads before touching the site. Any person who opens DevTools on the deployed URL reads it in under 30 seconds. This means every banker who visits `/bank` also has the admin password. Fix: move the password check server-side via a Firebase Custom Token (a single Cloud Function). Until that fix lands, rotate the password immediately and do not send the admin URL to anyone outside Eytan's control.

### 2. Any bank visitor can delete or overwrite any scenario — fix before the next bank meeting (BE-19, BE-03)
A banker who passes the name gate gets a Firebase anonymous user token. That token satisfies the only guard on scenario delete and update operations. They can erase the reference scenario mid-meeting. Two-line Firestore rules fix: add ownership check to delete, add a `lockedForEdit` flag to the reference scenario.

### 3. The presence system is silently broken — fix it (BE-05)
The Firestore rule for creating a presence document expects exactly 8 fields; the app sends 9 (includes an `actions` array). Every presence write fails silently. The `/admin/connections` board shows no banker presence data. One-line rules fix: change `size() == 8` to `size() == 9`.

### 4. Three missing bank metrics will trigger due-diligence questions (FI-15, FI-16, HO-03, HO-04, HO-15)
LLCR and PLCR are computed but shown only in the admin view, not the bank view. The stress-test strip shows the stabilised (best-year) DSCR instead of the minimum DSCR over the loan life — the number a credit committee focuses on. RevPAR by unit type and an explicit EBITDA margin vs industry benchmark are missing entirely. LTV covenant pass/fail is absent. All five are low-effort additions because the data is already in the model.

### 5. The distribution gate is wired to the wrong variable — fix it (FI-03)
The engine sets `distributionThresholdCrossed = true` when `dscr >= 1.0`. The ADR-0014 definition uses a Net Cash Flow threshold (€400K). The bank badge correctly uses the NCF definition; the engine uses DSCR. They are inconsistent. Two-line engine fix.

### 6. The DSCR chart labels a line "Conservative" when it is the realistic scenario (UI-02, UI-13)
A credit analyst who checks the chart tooltip will see "Conservative" labelled on the median scenario. This is discovered in under one minute of due diligence. 30-minute fix.

### 7. The WC facility default (€560K) is structurally below the computed minimum (€750K) — flag it (FI-19, FI-27)
The engine computes a €750K minimum facility but the default assumption is €560K. The adequacy check is silently hidden. Surface it as a warning badge in the bank view.

### 8. Dead DOCX presentation files inflate the bundle and create maintenance confusion (00-feature-map §4)
Two superseded investor presentation DOCX generators (`_v2_capital_discipline`, `_v3_aegean_story`) have zero imports and should be deleted.

---

## 2. Conflict Resolution

### 2.1 UX proposes merging Break-Even into Sensitivity. Finance is silent; the recommendation stands.
Call: **Proceed.** Break-Even (`/admin/breakeven`) is a nights/ADR matrix — it is one axis of a multi-axis sensitivity page. Merging it as a sub-tab reduces the sidebar count by one without losing any information. No financial-correctness objection.

### 2.2 UX proposes retiring `/bank/optima` as a separate URL and promoting it to a 4th tab on `/bank`.
The Frontend audit file (05) was not produced. The only constraint is from the feature map: `bank/optima/page.tsx` has its own page file with a local `MetricCell` duplicate. The UX argument (eliminating split-URL confusion, complete findability failure) is strong. The engineering cost is real: the Optima-specific components (`TabSide A/B`, Euribor rate display, two-sub-project CAPEX split) are currently isolated in `bank/optima/page.tsx`.  
Call: **Phase 2 — do not merge in Phase 1.** The merge requires component consolidation and a new route redirect. It is not safe to rush. Phase 1 interim: add a visible cross-link from `/bank` to `/bank/optima` (UX-22 minimum fix) so bankers are not stranded.

### 2.3 UX proposes adding Optima as a path-pill-gated tab. Backend notes the bank/admin Firestore boundary is UI-only.
No conflict. The Optima tab merge (when it lands in Phase 2) does not worsen the security posture — the Firestore rules are the same regardless of tab vs URL routing.

### 2.4 UX proposes merging `AssumptionsMemoButton` back into the sidebar or removing it. UI confirms it is commented out.
Call: **Phase 1 remove.** The route `/assumptions-memo` remains live but is unreachable from the UI. The button is commented out and the import is dead weight. Remove the component file and the commented import. Decision on whether to surface the route in the sidebar is Phase 2 (requires Eytan to confirm whether the memo is still needed).

### 2.5 Hospitality proposes adding features (operator profile, STR/GNTO classification, F&B model, seasonality curve) that would increase Assumptions UI complexity. UX notes the Assumptions page is already at cognitive-load capacity with 9 tabs.
Call: **New features are Phase 3.** No new assumptions fields are added in Phase 1 or 2. The UX restructure (Phase 2) must land first so there is a clean place to add them. Exception: the three display-only bank view additions that require no new assumption fields (HO-03 RevPAR, HO-04 EBITDA margin, HO-05 FF&E reserve line) are Phase 1 quick wins because they are rendering changes only.

### 2.6 Hospitality proposes HO-07 (operator name field) and HO-08 (regulatory classification). Backend notes that adding fields to ModelAssumptions increases the Firestore scenario document size.
Call: **Phase 3 only.** Neither is required for the immediate bank submission. Both involve new schema fields with migration implications.

### 2.7 Finance proposes FI-21 (model snapshot lock). Backend concurs (BE-15 model hash). UX does not address it.
Call: **Phase 2.** The snapshot lock is a trust-critical feature before formal credit committee submission, but it is High effort (new Firestore collection, version URL scheme, locked rendering path). It does not belong in Phase 1. It must land before a formal credit committee meeting — flag this dependency explicitly in Phase 2.

### 2.8 Finance FI-05 (RRF grace interest uses commercial scalars) vs no backend objection.
Call: **Proceed in Phase 2.** The RRF path uses the commercial interest scalars during grace years, overstating RRF grace interest. This is a correctness issue but affects a non-default financing path. Requires a dedicated ADR and golden-snapshot update — Phase 2.

---

## 3. Consolidated Findings Table

De-duplicated. Sorted: Impact HIGH → LOW, then Effort LOW → HIGH within each impact tier.  
`[QW]` = Quick Win (High or Med impact, Low effort). `[SEC]` = Security issue.

| ID | Source IDs | Area | Finding | Impact | Effort | Phase |
|----|-----------|------|---------|--------|--------|-------|
| [SEC] PASS-BUNDLE | BE-01 | Auth | Admin password readable in JS bundle | High | Med | P2 |
| [SEC] SCENARIO-DELETE | BE-19 | Firestore rules | Any anon user can delete any scenario | High | Low | P1 |
| [SEC] SCENARIO-UPDATE | BE-03 | Firestore rules | Any anon user can overwrite any scenario | High | Low | P1 |
| [SEC] PASS-STORAGE | BE-08 | Auth | Admin password stored as plaintext in localStorage | Med | Low | P1 |
| [SEC] FULL-ASSUMPTIONS-EXPOSED | BE-02 | Firestore / data model | Published scenario docs expose full admin assumptions to bank users | High | High | P2 |
| [SEC] RBAC-GATE | BE-06 | Auth | RBAC hook live but not gating any route | High | High | P3 |
| [QW] PRESENCE-SCHEMA | BE-05 | Firestore rules | Presence create writes 9 fields, rule expects 8; all writes silently fail | Med | Low | P1 |
| [QW] DISTRIB-GATE | FI-03 | Engine — correctness | Distribution gate uses DSCR >= 1.0 instead of NCF threshold (ADR-0014) | High | Low | P1 |
| [QW] LTC-METRIC | FI-04 | Engine — completeness | LTC ratio (loan/total capex) absent from keyMetrics; current LTV is a forward-completion LTV | High | Low | P1 |
| [QW] LLCR-PLCR-BANK | FI-15 | Bank view — completeness | LLCR and PLCR computed but only shown on admin debt-coverage page, not bank view | High | Low | P1 |
| [QW] MIN-DSCR-STRIP | FI-16 | Bank view — presentation | Stress-test strip shows stabilised (best-year) DSCR, not minimum DSCR over loan life | High | Low | P1 |
| [QW] EXIT-ANALYSIS-BANK | FI-20 | Bank view — completeness | No exit analysis section in bank view (terminal asset value, remaining debt, terminal LTV) | High | Low | P1 |
| [QW] WC-ADEQUACY | FI-19, FI-27 | Bank view / engine | WC default facility €560K is below computed minimum €750K; not shown to banker | High | Low | P1 |
| [QW] DSCR-CHART-LABELS | UI-02, UI-13 | UI — bank charts | DSCR chart data key "Conservative" maps to realistic scenario; tooltip mislabels | High | Low | P1 |
| [QW] ICR-DENOMINATOR | FI-01 | Engine — correctness | ICR denominator omits WC facility interest; overstates interest coverage | Med | Low | P1 |
| [QW] DSRA-YEAR-RANGE | FI-02 | Engine — correctness | DSRA shortfall window excludes 2029 (opening year); highest-risk year omitted | Med | Low | P1 |
| [QW] REVPAR-BANK | HO-03 | Bank view | No RevPAR-per-unit-type metric in bank view; hospitality underwriting anchor | High | Low | P1 |
| [QW] EBITDA-MARGIN-BANK | HO-04 | Bank view | EBITDA margin % vs industry benchmark (40–55%) absent from bank P&L | High | Low | P1 |
| [QW] FFE-RESERVE-LINE | HO-05 | Bank view | FF&E reserve is modelled but not displayed as a named line in bank P&L | High | Low | P1 |
| [QW] LTV-COVENANT | HO-15 | Bank view | No LTV covenant pass/fail badge (bank requires LTV ≤ 70%); LTV computed, not surfaced | High | Low | P1 |
| [QW] PRE-OPENING-TILE | HO-06 | Bank view | Pre-opening budget not surfaced as a standalone tile in bank deal overview | Med | Low | P1 |
| [QW] MGMT-FEE-KPI | HO-16 | Bank view | Management fee as % of revenue not surfaced as a KPI in bank view | Med | Low | P1 |
| [QW] ASSUMPTIONS-MEMO-BUTTON | UX-10, UX-20, UI-15 | Admin layout | AssumptionsMemoButton is dead — commented out in layout, file unused | Low | Low | P1 |
| [QW] DEAD-DOCX-V2-V3 | 00-feature-map §4 | Dead code | exportInvestorPresentation_v2 and _v3 files: zero imports, dead code | Low | Low | P1 |
| [QW] MAIL-COLLECTION | BE-10 | Dead code | MAIL_COLLECTION constant exported but zero write sites in entire codebase | Low | Low | P1 |
| [QW] METRIC-CELL-EXTRACT | UI-10 | Components | MetricCell defined identically in bank/page.tsx and bank/optima/page.tsx | Low | Low | P1 |
| [QW] I18N-CONNECTIONS | 00-feature-map §7, UI-09 | i18n | ACTION_LABELS and formatRelative() strings in connections page are bare English | Low | Low | P1 |
| [QW] I18N-AUTHGATE | 00-feature-map §7 | i18n | "Finance Platform" at AuthGate:151 and "Last saved" at AssumptionPrompts:151 not using t() | Low | Low | P1 |
| [QW] BANK-FOCUS-VISIBLE | UI-14 | Accessibility | BankControlBar path/scenario pills have no focus-visible ring | Med | Low | P1 |
| [QW] CHART-ARIA | UI-06 | Accessibility | All Recharts charts lack role="img" and aria-label | Med | Low | P1 |
| [QW] TABLE-CAPTION | UI-18 | Accessibility | Five financial tables in bank view lack caption or aria-labelledby | Med | Low | P1 |
| [QW] HEADING-HIERARCHY | UI-20, UI-21 | Accessibility | Bank page skips h2 (h1→h3); no main landmark in bank layout | Med | Low | P1 |
| [QW] DSCR-CHART-SLATE | UI-03 | UI tokens | Bank tab strip uses slate-* palette, not semantic tokens | Low | Low | P1 |
| [QW] KPICARD-TOKENS | UI-04 | UI tokens | KPICard hardcodes hex wash instead of positive/warning tokens | Low | Low | P1 |
| [QW] PRESENCE-DOT | UI-08 | UI tokens | Active viewer presence dot uses bg-green-500 not bg-positive | Low | Low | P1 |
| [QW] ADMIN-VIEWER-I18N | UI-09 | i18n | "Connected viewers", "No active viewers.", "anon" not using t() in bank page admin section | Low | Low | P1 |
| [QW] PRINT-HIDDEN-ADMIN | UI-25 | Bank view | Admin viewer section lacks print:hidden; would print on bank PDF | Low | Low | P1 |
| [QW] DATA-CELL-CONSISTENCY | UI-16 | Typography | Financial tables mix data-cell and font-mono text-sm — inconsistent | Low | Low | P1 |
| [QW] DSRA-KPI-FONT | UI-26 | Typography | DSRA KPI strip uses font-display text-xl instead of kpi-value-compact | Low | Low | P1 |
| [QW] BANK-PRESENTATION-SIDEBAR | UX-03, UX-17 | Admin navigation | /admin/presentation not in sidebar; unreachable in < 3 clicks from non-dashboard pages | High | Low | P1 |
| [QW] VAT-CASHFLOW-TAB | UX-13, UX-21 | Bank navigation | ConstructionVatCashflow buried at section 14 of 16; needs own tab | High | Low | P1 |
| [QW] IN-PAGE-ANCHORS | UX-07, UX-25 | Navigation | Dashboard and bank Overview lack sticky in-page anchor bars; both pages have id anchors already | High | Low | P1 |
| [QW] BANK-TAB-RENAME | UX-11 | Bank navigation | "Sensitivity" tab label leaks internal terminology; rename to "Credit Analysis" | High | Low | P1 |
| [QW] SCENARIOS-PROMOTE | UX-04, UX-18 | Admin navigation | Scenarios is 3rd item in Inputs; should be 1st (most-used item in that group) | Med | Low | P1 |
| [QW] BREAK-EVEN-MERGE | UX-01 | Admin navigation | Break-Even is a sub-case of Sensitivity; merge as a sub-tab | High | Low | P1 |
| [QW] OPTIMA-CROSSLINK | UX-22 | Bank navigation | No link between /bank and /bank/optima in either page; complete findability failure | High | Low | P1 |
| [QW] ASSUMPTIONS-TAB-ORDER | UX-05 | Admin assumptions | Tab order buries Financing (tab 4) and Revenue (tab 6) behind rarely-changed Portfolio/Templates/Optima | High | Low | P1 |
| [QW] OPTIMA-TAB-CONDITIONAL | UX-23 | Admin assumptions | Optima assumptions tab shown regardless of active financing path | Med | Low | P1 |
| [QW] FINANCING-PATHS-MOVE | UX-02 | Admin navigation | Financing Paths in Analyse group; better placed as first item in Structure group | Med | Low | P1 |
| COVENANT-TABLE | FI-08 | Bank view — completeness | No per-year DSCR covenant pass/fail table (year × scenario × pass/fail) | High | Med | P2 |
| DRAWDOWN-SCHEDULE | FI-09, HO-09 | Bank view — completeness | No milestone-linked construction drawdown schedule | High | Med | P2 |
| LTV-PROGRESSION | FI-11 | Bank view — completeness | No LTV-at-exit / LTV progression table (loan balance vs asset value by year) | High | Med | P2 |
| SNAPSHOT-LOCK | FI-21 | Trust & Integrity | No model snapshot lock; banker URL shows live mutations after link is shared | High | High | P2 |
| RRF-GRACE-INTEREST | FI-05 | Engine — correctness | RRF grace interest uses commercial rate scalars instead of blended RRF rate | Med | Med | P2 |
| GRACE-PERIOD-WIRE | FI-24, BE-12 | Engine / UX | gracePeriodYears is editable in UI but inert in engine (standard graceMode); silent non-effect | High | Med | P2 |
| AMORTISATION-SUMMARY | FI-13 | Bank view | Loan amortisation summary buried in collapsed section; needs promotion | High | Low | P2 |
| EQUITY-DRAW-ORDER | FI-12 | Bank view | Sources & Uses panel does not confirm equity-in-first convention | Med | Low | P2 |
| DSCR-NUMERATOR-FOOTNOTE | FI-17 | Bank view | DSCR numerator footnote absent; banker may not realise it uses pre-OpCo EBITDA | Med | Low | P2 |
| GRACE-INTEREST-PROMINENCE | FI-18 | Bank view | graceInterestCarry (€322K) collapsed by default; banker may miss day-one equity impact | Med | Low | P2 |
| BREAK-EVEN-LABEL | FI-25 | Engine / UX | Break-even scenario is dual-axis stress (ADR + occupancy), not single-axis; mislabelled | Med | Low | P2 |
| OPTIMA-RATE-TIMESTAMP | BE-13 | Bank view | Euribor fallback rate shown without timestamp of when it was set | Low | Low | P2 |
| SNAPSHOT-DATE-BANNER | FI-14 | Bank view | No "last updated" / scenario publication date visible to banker | High | Low | P2 |
| OVERRUN-RESERVE | FI-10 | Bank view | 10% contingency reserve not surfaced as explicit headline | Med | Low | P2 |
| CAPEX-SAVE-CAPTABLE | BE-09 | Data model | capTable/waterfall never serialized in saveConfig despite SavedConfiguration type declaring them optional | Med | Low | P2 |
| OPTIMA-MERGE-TAB | UX-12 | Bank navigation | /bank/optima as separate URL; merge into /bank 4th tab | High | High | P2 |
| STRESS-MOVE-TAB | UX-14 | Bank navigation | Stress Analysis at end of Overview; move to Credit Analysis tab | High | Low | P2 |
| FINANCING-PATHS-STRUCT | UX-02 | Admin navigation | Financing Paths moved to Structure group (confirmed this is safe, low effort) | Med | Low | P2 |
| ADR-GROWTH | HO-10 | Engine — revenue | ADR flat across 12-year horizon; no nominal ADR growth rate assumption | Med | Low | P3 |
| SEASONALITY-CURVE | HO-02 | Engine — revenue | Revenue model has no within-year seasonality distribution; flat nights × ADR | High | Med | P3 |
| OCCUPANCY-SPLIT | HO-01 | Engine — revenue | Single baseNights shared across all suite types; no per-unit occupancy curve | Med | Med | P3 |
| OPEX-VARIABLE-FIXED | HO-11 | Engine — OPEX | No split between fixed OPEX (insurance, tax) and variable OPEX (housekeeping, utilities) | Med | Med | P3 |
| SHOCK-SCENARIO | HO-18 | Bank stress | Stress test has no 40–50% revenue shock scenario (pandemic-style) | High | Med | P3 |
| STR-GNTO-DISCLOSURE | HO-08 | Bank view | No GNTO/STR regulatory classification disclosed in bank view | High | Low | P3 |
| CONSTRUCTION-MILESTONES | HO-09 | Bank view | No construction milestone schedule linked to drawdown in bank view | High | Med | P3 |
| OPERATOR-PROFILE | HO-07 | Engine / UX | No operator identity or management contract type field | Med | Med | P3 |
| FB-MODEL | HO-21 | Engine | No F&B revenue/cost model; ancillary revenue is a single net line | Med | Med | P3 |
| SNAPSHOT-LIVE-DATA | HO-19 | Data | currentVillaActuals.ts is static; 2026 season in progress and will become stale | Med | Med | P3 |
| IRR-NPV-DEDUP | FI-22, FI-23 | Engine | IRR and NPV have two implementations (model.ts private + financeUtils.ts exported); one NaN/0 divergence | Low | Med | P3 |
| DEPRECIATION-SHIELD-LINE | FI-26 | Bank view | Depreciation tax shield line absent from bank P&L; early-year CIT looks understated | Low | Low | P3 |
| TEPIX-GRACE-GUARD | FI-06 | Engine | TEPIX subsidy/grace overlap edge case if subsidyDurationYears > gracePeriodYears | Low | Low | P3 |
| MOIC-DENOMINATOR | FI-07 | Engine | preOpeningEquityBuffer not in MOIC denominator; very minor MOIC overstatement | Low | Low | P3 |
| CHART-PALETTE | UI-01 | UI tokens | All Recharts chart colors are hardcoded hex, not CSS token references | Med | Med | P3 |
| STEPPER-INPUT-EXTRACT | UI-11 | Components | RateLoanPopover, OptimaRatePopover, PercentInput are three near-duplicate stepper patterns | Med | Med | P3 |
| FONT-MICRO-SCALE | UI-12 | Typography | Six sub-12px sizes (9/10/11px) are bespoke arbitrary values; name them as utilities | Med | Med | P3 |
| AMBER-PALETTE | UI-07 | UI tokens | 11 amber-* usages in bank view; should coalesce to warning token or surface-warm | Low | Med | P3 |
| DSCR-CHART-DEDUP | UI-04 audit note | Components | DSCR line chart appears in both bank/page.tsx and admin/dashboard/page.tsx; could share DSCRLineChart | Low | Med | P3 |
| FLIP-CARD-REMOVE | UI-19 | Bank polish | 3D hover flip card for "Coming Soon" is the only consumer-startup gesture on an institutional page | Med | Med | P3 |
| OPCO-SPONSOR-GUARD | HO-13 | Admin / bank | EytanReturnBreakdown visible when ViewAs banker is active; sponsor promote should be admin-only | High | Low | P2 |
| PITCH-GATE | HO-12 | Auth | /pitch route has no gate at all; 12-slide deck with IRR/MOIC/exit valuations publicly accessible | Med | Low | P2 |
| BE-11-DEPRECATED-FIELDS | BE-11 | Data model | Six @deprecated fields written in every Firestore save; wasted bandwidth | Low | Med | P3 |
| BE-17-CONST-DEDUP | BE-17 | Dead code | USERS_COLLECTION / INVITES_COLLECTION duplicated across firebase.ts and userProfile.ts | Low | Low | P1 |
| OUTPUT-WATERMARK | BE-07, BE-15 | Trust | No model hash or watermark in bank DOCX/PDF exports | Med | Low | P2 |
| KPI-ASSET-COVERAGE-DUPE | UI-22 | Bank view | assetCoverage shown twice in bank KPI strip | Med | Low | P1 |
| ADMIN-VIEWER-IMPERSONATION | BE-20 | Auth | ViewAs impersonation broken under shared-password gate (actualRole always null) | Low | Low | P2 |

---

## 4. Remove List, Tiered by Safety

### Tier A — Dead code: safe to delete immediately (zero import references, code-proven)

| File | Confirmed by | Why safe |
|------|-------------|---------|
| `src/lib/docx/exportInvestorPresentation_v2_capital_discipline.ts` | 00-feature-map §4 | Zero imports in src/; exports only the dead function |
| `src/lib/docx/exportInvestorPresentation_v3_aegean_story.ts` | 00-feature-map §4 | Zero imports in src/; exports only the dead function |
| `src/components/AssumptionsMemoButton.tsx` | 00-feature-map §4, UI-15, UX-20 | Commented out at all render sites; import in layout is dead |
| `src/lib/i18n/fr.ts` | 00-feature-map §7 | `fr` not in Locale union type; cast through `unknown` in index.ts; not surfaced in LanguageToggle |

Remove the dead import line from `src/app/admin/layout.tsx` (`AssumptionsMemoButton` import).  
Remove the dead export from `src/lib/firebase.ts` (`MAIL_COLLECTION`).

**RULE: Do not touch `.rbac-saved/` — it is a named preservation directory, not dead code.**

### Tier B — Redundant features: safe after Eytan's confirmation

| Feature | File | Reason for caution |
|---------|------|-------------------|
| `/assumptions-memo` route | `src/app/assumptions-memo/page.tsx` | Route is live and has a full page implementation. Only the nav entry point was removed (button commented out). Eytan may want to restore it in the sidebar. Confirm intent before deleting the page. |
| `src/lib/pdf/exportInvestorReport.ts` | `src/lib/pdf/exportInvestorReport.ts` | Flagged as possibly dead (superseded by DOCX), but not confirmed with an import scan in this audit session. Confirm zero imports before deleting. |
| `src/lib/pdf/exportBankReport.ts` | `src/lib/pdf/exportBankReport.ts` | Same as above — possibly superseded by exportBankPresentation.ts (DOCX). Confirm zero imports before deleting. |

### Tier C — Suspected unused by real users: BLOCKED pending analytics data

| Feature | Hypothesis | Data needed before acting |
|---------|-----------|--------------------------|
| `/admin/lexicon` page | No user has navigated to this page during a real meeting; it is a reference tool buried in Inputs | Analytics event log showing page views over the past 30 days |
| `PageTour` for bank view | The onboarding tour may never be triggered by bankers who go directly to the data | Tour-seen localStorage key analysis across actual bank sessions |
| `InvestorSensitivityTab` on `/pitch` | The pitch deck is public-facing and ungated; unclear if anyone uses the sensitivity sliders | Analytics on slider interaction events |

---

## 5. Proposed Target Architecture & Navigation

### Admin View (proposed)

Sidebar item count stays at 14. Grouping improves.

```
ANALYSE (5 items)
  Dashboard           /admin/dashboard
  Returns             /admin/returns
  P&L Timeline        /admin/pnl
  Debt Coverage       /admin/debt-coverage
  Sensitivity         /admin/sensitivity  ← absorbs Break-Even as a sub-tab

STRUCTURE (3 items)
  Financing Paths     /admin/financing    ← moved from Analyse; first in group
  OpCo / PropCo       /admin/opco-split
  Cap Table           /admin/cap-table

INPUTS (6 items)
  Scenarios           /admin/scenarios    ← promoted to first
  Assumptions         /admin/assumptions
  CAPEX               /admin/capex
  Presentation        /admin/presentation ← added to sidebar
  Lexicon             /admin/lexicon
  Team                /admin/team
  Connections         /admin/connections
```

Assumptions internal tabs (8, with Optima conditional):

```
1. Portfolio          (project count, template assignment)
2. Financing Paths    (all 5 path param sets) ← promoted from tab 4
3. Revenue            (ADR, nights, ramp)     ← promoted from tab 6
4. OPEX               (FF&E rate, contingency)
5. Portfolio OPEX     (staff roles, shared services, allocation)
6. General            (Tax + Working Capital + DSRA + OTA) ← merged from separate tabs
7. Templates          (per-property CAPEX + OPEX cards)
8. Optima             ← only rendered when activePath === 'optima'
```

The `AssumptionsMemoButton` sidebar item is removed (Tier B pending confirmation). `/admin/presentation` is NOT accessible from the minimal presentation layout sidebar — it gets a "Back to admin" link only.

Engineering constraint from the feature map: the Break-Even sub-tab absorbs `src/app/admin/breakeven/page.tsx` content into `src/app/admin/sensitivity/page.tsx`. The old route `/admin/breakeven` should redirect to `/admin/sensitivity` (or to the break-even sub-tab anchor) to avoid 404s from any bookmarks.

### Bank View (proposed)

```
/bank  (name-gate)
│
├── STICKY BANK CONTROL BAR
│   Path: Commercial | RRF | Grant | TEPIX | [Optima — advanced]
│   Scenario: Realistic | Upside | Downside | Break-Even
│   Language toggle
│
├── TAB BAR (4 tabs)
│   Overview
│   Credit Analysis    ← renamed from Sensitivity; absorbs Stress Analysis sections
│   VAT Cashflow       ← promoted from section 14 of Overview
│   Optima             ← Phase 2 merge of /bank/optima; Phase 1 interim: cross-link only
│
└── OVERVIEW TAB (12 sections after Phase 2 moves)
    1. Hero + Quick Access
    2. Term Sheet KPI strip
    3. Deal Overview / Portfolio Table
    4. Operating Track Record
    5. Capital Structure + Stabilised Ops
    6. Loan Metrics (LTC + LTV + LLCR + PLCR added in P1)
    7. Coverage Ratios (DSCR covenant + LTV covenant badge added in P1)
    8. CAPEX Breakdown + Sources & Uses
    9. DSCR Trajectory + Payment Capacity charts
    10. P&L Timeline (BankPnLSection)
    11. Exit Analysis (added in P1)
    12. DSRA (conditional)
    [Stress Analysis moved to Credit Analysis tab in P2]
    [ConstructionVatCashflow moved to VAT Cashflow tab in P1]
```

The `/bank/optima` URL is not retired in Phase 1. It receives a back-link to `/bank` and an explanatory header. In Phase 2, the Optima tab merge retires the separate URL via a redirect.

---

## 6. Phased Roadmap

---

### Phase 1 — Quick wins + dead-code removal
**Safe to implement immediately. No financial engine structural changes. No navigation restructuring.**

Each item has: files to change, type of change, rollback note.

---

#### P1-01: Remove dead DOCX files and AssumptionsMemoButton
**Files to delete:**
- `src/lib/docx/exportInvestorPresentation_v2_capital_discipline.ts`
- `src/lib/docx/exportInvestorPresentation_v3_aegean_story.ts`
- `src/components/AssumptionsMemoButton.tsx`
- `src/lib/i18n/fr.ts`

**Files to edit:**
- `src/app/admin/layout.tsx` — remove commented-out `{/* <AssumptionsMemoButton /> */}` and its import line
- `src/lib/firebase.ts` — remove `MAIL_COLLECTION` export
- `src/lib/firebase.ts` — pick one canonical home for `USERS_COLLECTION` / `INVITES_COLLECTION`; remove duplicates from the other file

**Type:** Dead code removal  
**Dependencies:** None  
**Rollback:** Git revert. The deleted files have no import consumers; restoring them requires no other changes.

---

#### P1-02: Fix three Firestore security rules (SEC)
**File to edit:** `~/Desktop/Villa Lev Claude/villa-lev-admin/firestore.rules` (sibling repo — the deployed rules source)

Changes:
1. **BE-05 presence schema:** change `size() == 8` to `size() == 9` in the presence create rule.
2. **BE-19 scenario delete:** change `allow delete: if request.auth != null` to `allow delete: if request.auth != null && resource.data.userId == request.auth.uid`.
3. **BE-03 reference scenario lock:** add `lockedForEdit` guard on scenario update rule: `allow update: if request.auth != null && (!resource.data.lockedForEdit == true || resource.data.userId == request.auth.uid)`.

**Deploy:** `firebase deploy --only firestore:rules` from the `villa-lev-admin` repo.  
**Dependencies:** Requires access to the sibling `villa-lev-admin` repo. Finance platform code unchanged.  
**Rollback:** `git revert` the rules change + redeploy. Only affects Firestore write behavior; no client code changes.

---

#### P1-03: Hash admin password in localStorage (SEC)
**File to edit:** `src/components/AuthGate.tsx`

Change: instead of storing `enteredPass` verbatim and comparing against `NEXT_PUBLIC_ADMIN_PASS`, compute `sha256(enteredPass)` on entry and store the hash. Compare hashes. Use the Web Crypto API (`crypto.subtle.digest`).

**Note:** This does NOT fix BE-01 (password in bundle) — the plaintext password is still in the JS bundle. It only prevents a localStorage read from being a one-shot secret. BE-01 requires a Cloud Function and is Phase 2.

**Type:** Security hardening — auth gate  
**Dependencies:** Web Crypto API (available in all modern browsers, no new dependency)  
**Rollback:** Revert. Existing sessions have the old hash in localStorage and will need to re-enter the password once.

---

#### P1-04: Fix engine distribution gate (FI-03)
**File to edit:** `src/lib/engine/model.ts` (around line 2096)

Change: replace `distributionThresholdCrossed = dscr >= 1.0` with `distributionThresholdCrossed = netCashFlowPostVAT >= PROJECT_CONSTANTS.DISTRIBUTION_RESERVE_THRESHOLD`.

**Update golden snapshot:** run `npm run test:run` — the golden snapshot will diff. Update it with the corrected values.

**Type:** Engine correctness fix  
**Dependencies:** `PROJECT_CONSTANTS.DISTRIBUTION_RESERVE_THRESHOLD` already exists. Update test snapshot.  
**Rollback:** Revert the one-line change + snapshot revert.

---

#### P1-05: Fix ICR denominator and DSRA year range (FI-01, FI-02)
**File to edit:** `src/lib/engine/model.ts`

Changes:
1. **FI-01 ICR:** Add `wcInterestExpense` to the ICR denominator: `interestCoverageRatio = ebitdaPreOpCo / (termLoanInterest + wcInterestExpense)`.
2. **FI-02 DSRA:** Change `row.year >= FIRST_OPERATIONAL_YEAR` to `row.year >= OPENING_YEAR` in the DSRA shortfall filter.

**Update golden snapshot** after both changes.

**Type:** Engine correctness fixes  
**Dependencies:** Both constants (`FIRST_OPERATIONAL_YEAR`, `OPENING_YEAR`) already defined. Update test snapshot.  
**Rollback:** Revert two line changes + snapshot revert.

---

#### P1-06: Add LTC metric to keyMetrics (FI-04)
**Files to edit:**
- `src/lib/engine/model.ts` — add `loanToProjectCost: loanAmount / totalCapex` to `keyMetrics`
- `src/lib/engine/types.ts` — add `loanToProjectCost: number` to `KeyMetrics`
- `src/app/bank/page.tsx` — render `loanToProjectCost` in the Loan Metrics KPI strip alongside LTV

**Type:** Engine completeness + bank view display  
**Dependencies:** `loanAmount` and `totalCapex` already in scope at keyMetrics computation site.  
**Rollback:** Remove the new field from types and rendering; revert.

---

#### P1-07: Add LLCR / PLCR to bank view + surface minimum DSCR in stress strip (FI-15, FI-16)
**File to edit:** `src/app/bank/page.tsx`

Changes:
1. **FI-15:** Add LLCR and PLCR `MetricCell`s to the coverage ratios panel. Values from `activeScenarioOutput.llcr` and `.plcr`.
2. **FI-16:** Replace the stabilised DSCR in BankStressTest display with `minDSCRLoanLife` (and the year it occurs). The value is already on `activeScenarioOutput.minDSCRLoanLife`. Add the stabilised DSCR as a secondary line below.

**Type:** Bank view display additions  
**Dependencies:** Values already computed on model output. No engine changes.  
**Rollback:** Remove the new render blocks.

---

#### P1-08: Add exit analysis card to bank view (FI-20)
**File to edit:** `src/app/bank/page.tsx`

Add a compact exit analysis row after section 10 (P&L Timeline): exit year, terminal asset value (EBITDA × multiple), loan balance at exit, terminal LTV. All available from `activeScenarioOutput` (`terminalAssetValue`, `terminalEquityValue`, `terminalUnderwater`).

**Type:** Bank view display addition  
**Dependencies:** No engine changes. Values on activeScenarioOutput.  
**Rollback:** Remove the render block.

---

#### P1-09: Surface WC facility adequacy warning (FI-19, FI-27)
**File to edit:** `src/app/bank/page.tsx` and/or `src/components/SourcesUsesPanel.tsx`

Add a warning indicator: if `wcMinimumFacility > facilitySize` (i.e. €750K > €560K default), show a warning badge near the WC facility display. The operator must increase the WC facility to cover the VAT bridge peak. Show current facility, computed minimum, and the shortfall amount.

**Type:** Bank view warning display  
**Dependencies:** `wcMinimumFacility` already computed on model output.  
**Rollback:** Remove the conditional badge.

---

#### P1-10: Add RevPAR, EBITDA margin, FF&E reserve line, LTV covenant, pre-opening tile, mgmt fee KPI to bank view (HO-03, HO-04, HO-05, HO-15, HO-06, HO-16)
**Files to edit:** `src/app/bank/page.tsx`, `src/components/BankPnLSection.tsx`

These are all display-only changes — the data is already computed:
1. **HO-03 RevPAR:** Add RevPAR (villa and suite) to the Term Sheet KPI strip. `revpar = adr × (nights / totalNightsAvailable)`. Computable from existing AnnualPnL fields.
2. **HO-04 EBITDA margin:** Add a "Stabilised EBITDA Margin" metric row in BankPnLSection with a footnote citing 40–55% industry range. `ebitdaMargin` is already in `AnnualPnL`.
3. **HO-05 FF&E reserve:** Surface FF&E reserve as a named line in BankPnLSection below EBITDA. Already computed — it is currently folded into opex.
4. **HO-15 LTV covenant:** Add an LTV Covenant tile mirroring the DSCR covenant badge pattern. Show `currentLTV` vs threshold 70% with a pass/fail badge. LTV data is on `ModelOutput.collateral`.
5. **HO-06 pre-opening budget tile:** Add a tile to the bank deal overview showing `portfolioOpex.preOpeningTotal`, amortisation years, and annual amortisation.
6. **HO-16 management fee KPI:** Add "Mgmt Fee (% revenue)" tile from `opCoFee.baseMgmtFeeRate` + `incentiveFeeRate`.

**Type:** Bank view display additions (rendering only)  
**Dependencies:** All data already on model output. No engine changes.  
**Rollback:** Remove the render blocks.

---

#### P1-11: Fix DSCR chart data key labels (UI-02, UI-13)
**File to edit:** `src/app/bank/page.tsx` (around lines 260–267, 912–915)

Rename data keys to match what they display: `Realistic`, `Upside`, `Downside`. Update `dataKey` props on `<Line>` elements. The `name` props already have correct translations — the data key fix resolves the tooltip inconsistency.

**Type:** UI label correction  
**Dependencies:** None  
**Rollback:** Revert the key name changes.

---

#### P1-12: Admin navigation changes (UX-01, UX-02, UX-03, UX-04, UX-05, UX-23)
**File to edit:** `src/app/admin/layout.tsx`

Changes:
1. **UX-03:** Add Presentation to the Inputs nav group as a link to `/admin/presentation`.
2. **UX-04:** Move Scenarios to first position in Inputs group.
3. **UX-02:** Move Financing Paths from Analyse to Structure group (first item).
4. **UX-01:** Remove Break-Even from the sidebar. Add a redirect from `/admin/breakeven` to `/admin/sensitivity` (via Next.js redirect in next.config.ts or a client-side redirect in the break-even page).

**File to edit:** `src/app/admin/assumptions/page.tsx`

5. **UX-05:** Reorder assumption tabs: Portfolio → Financing Paths → Revenue → OPEX → Portfolio OPEX → General → Templates → [Optima conditional].
6. **UX-23:** Conditionally render the Optima tab only when `assumptions.financingPath === 'optima'`.

**Type:** Navigation restructure (sidebar reorder + tab reorder)  
**Dependencies:** Break-Even merge into Sensitivity requires the Sensitivity page to receive the break-even sub-tab. Do this change together with the sidebar removal.  
**Rollback:** Revert the layout and assumptions page changes. Restore the redirect.

---

#### P1-13: Bank navigation changes (UX-11, UX-13, UX-22)
**File to edit:** `src/app/bank/page.tsx`

Changes:
1. **UX-11:** Rename the "Sensitivity" tab label to "Credit Analysis". Update the translation key.
2. **UX-13:** Add a "VAT Cashflow" 3rd tab. Move the `ConstructionVatCashflow` component from the Overview section into the new tab.
3. **UX-22:** Add an "Optima view →" cross-link in the BankControlBar or bank page header when the user is on `/bank`. This is the Phase 1 interim before the full Optima tab merge in Phase 2.

**Type:** Bank navigation additions (new tab, rename, cross-link)  
**Dependencies:** The tab bar in `bank/page.tsx` currently has 2 entries. Extending to 3 requires updating the tab state, active tab logic, and render conditions.  
**Rollback:** Remove the new tab; restore the component to the inline section. Revert the tab rename.

---

#### P1-14: In-page anchor bars (UX-07, UX-25)
**Files to edit:** `src/app/admin/dashboard/page.tsx`, `src/app/bank/page.tsx`

Add a sticky in-page anchor bar below the control bar on the Dashboard and below BankControlBar in the bank view. Use the existing `id` anchors already present in both pages.

Dashboard anchors: "Overview · Returns · DSCR · Conservatism · Founder"  
Bank anchors: "Term Sheet · Deal Overview · Metrics · DSCR · Capital · P&L"

**Type:** Navigation UX addition  
**Dependencies:** `id` anchors already exist. No engine changes.  
**Rollback:** Remove the anchor bar component.

---

#### P1-15: Accessibility fixes (UI-06, UI-14, UI-18, UI-20, UI-21)
**Files to edit:** `src/app/bank/page.tsx`, `src/components/BankControlBar.tsx`, `src/components/BankPnLSection.tsx`, `src/app/bank/layout.tsx`

Changes:
1. **UI-06:** Wrap each `<ResponsiveContainer>` in `<figure role="img" aria-label="...">` with translated descriptions.
2. **UI-14:** Add `focus-visible:ring-2 focus-visible:ring-brand-400/40 focus-visible:outline-none` to all pill buttons in BankControlBar.
3. **UI-18:** Add `<caption className="sr-only">` to all five financial tables in bank view.
4. **UI-20:** Promote section headings (Term Sheet, Loan Metrics, etc.) from `<h3>` to `<h2>`.
5. **UI-21:** Add `<main>` landmark wrapper in bank layout.

**Type:** Accessibility fixes (additive, no visual changes except focus rings)  
**Dependencies:** New i18n keys for aria-labels and table captions.  
**Rollback:** Remove the added attributes. No structural changes.

---

#### P1-16: UI token corrections (UI-03, UI-04, UI-08, UI-09, UI-25, UI-16, UI-22, UI-26)
**Files to edit:** `src/app/bank/page.tsx`, `src/components/AdminUI.tsx`

Changes:
1. **UI-03:** Replace `slate-*` in tab strip with `border-surface-tertiary` / `text-text-tertiary`.
2. **UI-04:** Replace `bg-[#EEF7EB] border-[#BCD9B6]` in KPICard with `bg-positive/[0.06] border-positive/30`.
3. **UI-08:** Replace `bg-green-500` presence dot with `bg-positive`.
4. **UI-09/UI-25:** Wrap "Connected viewers", "No active viewers.", "anon" in `t()` calls. Add `print:hidden` to admin viewer section.
5. **UI-16:** Standardise financial table numeric cells to `data-cell` (remove `font-mono text-sm` combos).
6. **UI-22:** Remove the duplicate `assetCoverage` MetricCell from the 2-column KPI strip.
7. **UI-26:** Replace `font-display text-xl` in DSRA KPI strip with `kpi-value-compact`.

**Type:** UI token cleanup (cosmetic, no functional change)  
**Dependencies:** Translation keys for UI-09 strings.  
**Rollback:** Revert class name changes.

---

#### P1-17: i18n fixes (00-feature-map §7, UI-24)
**Files to edit:** `src/components/AuthGate.tsx`, `src/components/AssumptionPrompts.tsx`, `src/app/admin/connections/page.tsx`, `src/app/admin/layout.tsx`

Changes:
1. `AuthGate.tsx:151` — wrap `"Finance Platform"` in `t('app.platform')`.
2. `AssumptionPrompts.tsx:151` — wrap `"Last saved"` in `t('lastSaved')` or equivalent key.
3. `connections/page.tsx:17–31` — wrap `ACTION_LABELS` values and `formatRelative()` output strings in `t()` calls.
4. `admin/layout.tsx:506` — move the exit year `title=` tooltip string to a translation key.

Add corresponding keys to `src/lib/i18n/en.ts`, `src/lib/i18n/el.ts`, `src/lib/i18n/he.ts`.

**Type:** i18n fixes  
**Dependencies:** New translation keys.  
**Rollback:** Revert to bare strings.

---

#### P1-18: Extract MetricCell to shared component (UI-10)
**Files to create/edit:**
- Create `src/components/MetricCell.tsx` (copy the identical implementation from either bank page)
- Edit `src/app/bank/page.tsx` — import from the new shared component
- Edit `src/app/bank/optima/page.tsx` — import from the new shared component

**Type:** Component extraction (no functional change)  
**Dependencies:** None  
**Rollback:** Inline the component back into both pages.

---

#### P1-19: Remove duplicate collection constants (BE-17)
**Files to edit:** `src/lib/firebase.ts` and `src/lib/data/userProfile.ts`

Pick `firebase.ts` as the canonical source. Remove `USERS_COLLECTION` and `INVITES_COLLECTION` from `userProfile.ts`. Update `userProfile.ts` to import from `firebase.ts`.

**Type:** Dead code / deduplication  
**Dependencies:** Verify all import sites use the firebase.ts export path.  
**Rollback:** Restore the local constants in userProfile.ts.

---

### Phase 2 — Restructure / IA
**Requires Eytan's approval before implementation. Some items require ADR updates.**

Listed in recommended implementation order (dependencies cascade downward).

---

#### P2-01: Server-side admin password (BE-01)
Move the password check to a Firebase Custom Token endpoint. The client sends the password to a Cloud Function; the function validates it server-side and returns a signed custom token; the client signs in with `signInWithCustomToken`. The actual password lives in Firebase environment config, not the client bundle.

**Order:** First in Phase 2 — this is the most critical security fix.  
**Dependencies:** Requires a new Cloud Function (`functions/` directory). Requires updating `AuthGate.tsx` to call the function, handle errors, and sign in with the returned token. This is a breaking change to the auth flow — test end-to-end in staging before production.  
**Risks:** Cloud Functions cold-start latency on first sign-in (acceptable — 1–2 seconds). Firebase Blaze plan required for Cloud Functions.  
**Migration:** Existing sessions in localStorage will have stale hashed passwords. The new flow compares plaintext against the server-stored secret — one-time re-login required.

---

#### P2-02: Model snapshot lock (FI-21)
Implement "Submit to bank" action: creates a `bankSnapshots` Firestore collection with `locked: true` and a frozen copy of the model assumptions + a bank-view computed output hash. Generate a version URL `/bank?snap={id}` that renders from the frozen document, not the live store.

**Order:** Second in Phase 2 — required before formal credit committee meeting.  
**Dependencies:** New Firestore collection. New query param handling in bank layout. Firestore rules for the new collection. Backend audit must review the new rules. This item is a prerequisite for FI-14 (snapshot date display).  
**Risks:** Large Firestore document if full ModelOutput is stored. Consider storing only assumptions + a model hash (not the full output).  
**ADR required:** Yes — this is a significant architecture change to the data model.

---

#### P2-03: Firestore — restrict published scenarios from exposing full assumptions (BE-02)
Two options — choose one:  
Option A (faster): Create a `bankReadyScenarios` collection that stores only bank-safe fields (model output summary, not full assumptions). The current `scenarios` collection is admin-only (unpublished). The bank share link uses a bank-ready snapshot.  
Option B (requires P2-02): The `bankSnapshots` collection from P2-02 is already a bank-safe subset. Use it.

**Order:** After P2-02 if Option B; can be independent if Option A.  
**Dependencies:** If Option A, requires updating modelStore's shareScenario flow.  
**Risks:** Existing shared scenario links (current `/bank` URL with a scenario loaded from Firestore) will break if the published read is removed from the `scenarios` collection. Migration path needed.

---

#### P2-04: Wire gracePeriodYears into the engine or disable the UI field (FI-24, BE-12)
The `gracePeriodYears` field is editable in the assumptions UI but has no effect on the model. This is ADR-0009 deferred debt.

Decision required from Eytan before implementing:  
- If the intent is to keep `GRACE_END_YEAR` as a shared constant: disable (grey out) the `gracePeriodYears` inputs in the UI for all paths in standard graceMode. Add a tooltip explaining the constant. This is low risk.  
- If each path should eventually have its own grace period: wire `gracePeriodYears` into `getDS` closures. This is a model-breaking change requiring a new ADR and full golden-snapshot regeneration.

**Risks (engine-wire option):** Any change to grace period logic changes DSCR, IRR, and all downstream metrics. Must not be done mid-cycle without regression testing.

---

#### P2-05: OpCo sponsor return guard in bank ViewAs (HO-13)
Add explicit `!useEffectiveAuth().isViewingAs` guard to `EytanReturnBreakdown` so the sponsor promote structure does not appear when an admin previews the banker role.

**Order:** Can be done any time in Phase 2.  
**Dependencies:** None — isolated component gate.

---

#### P2-06: Add gate to /pitch route (HO-12)
Add BankGate (name-prompt only) to the pitch layout at `/pitch`. This logs the visitor via presence and requires minimal friction.

**Order:** Can be done any time in Phase 2.  
**Dependencies:** BankGate component already exists.

---

#### P2-07: Bank navigation — Optima merge as 4th tab (UX-12)
Merge `/bank/optima/page.tsx` content into `/bank` as a 4th tab. The Optima-specific display differences (TabSide A/B, Euribor rate, two-sub-project CAPEX) are gated on `activePath === 'optima'`. Retire `/bank/optima` with a redirect to `/bank?tab=optima`.

**Order:** After Phase 1 cross-link (P1-13). The cross-link is the Phase 1 minimum; the full merge is Phase 2.  
**Dependencies:** Requires consolidating `bank/optima/page.tsx` into `bank/page.tsx`. The `MetricCell` extraction (P1-18) must be done first.  
**Risks:** The Optima page has independent component logic (TabSide A/B, `useEuribor`, `optimaScenario` rendering). Careful merge required. Consider extracting an `<OptimaTab>` component first.

---

#### P2-08: Move Stress Analysis to Credit Analysis tab (UX-14)
Move `BankStressTest` and the collateral stress section from the bottom of the Overview tab into the Credit Analysis tab.

**Order:** After P1-13 (VAT Cashflow tab creation establishes the 3-tab structure).  
**Dependencies:** Requires updating the tab render logic in `bank/page.tsx`.  
**Risks:** Low — it is a component move, not a logic change.

---

#### P2-09: Add bank view items that require medium effort (FI-08, FI-09, FI-13, FI-11, FI-14)
These are the remaining lender-completeness items not done in Phase 1:
1. **FI-08 Covenant table:** Per-year DSCR covenant pass/fail table (years 2029–2037 × Realistic/Downside/Break-Even).
2. **FI-09 Drawdown schedule:** Construction drawdown table with milestone triggers. Needs `debtResult.rollingTranches` or equivalent from the engine.
3. **FI-13 Amortisation summary:** Promote the loan amortisation summary card out of the collapsed section.
4. **FI-11 LTV progression:** LTV-at-exit table (year × loan balance × asset value × LTV). Data from `amortSchedule` and collateral tiers.
5. **FI-14 Snapshot date:** Surface `savedConfig.savedAt` as "Last updated" in the bank view header.

**Order:** After P2-02 snapshot lock (FI-14 depends on snapshots having a canonical date).  
**Dependencies:** FI-09 drawdown schedule may require a new engine output field if `rollingTranches` is not already on `ModelOutput`. Check before implementing — if it requires engine changes, separate ADR needed.

---

#### P2-10: Additional engine / presentation fixes (FI-05, FI-12, FI-17, FI-18, FI-25, BE-09, OUTPUT-WATERMARK)
1. **FI-05 RRF grace interest:** Derive from blended rate instead of commercial scalars. Requires a new ADR and golden-snapshot update.
2. **FI-12 Equity draw order:** Add footnote to SourcesUsesPanel confirming equity-in-first.
3. **FI-17 DSCR numerator footnote:** Add tooltip to DSCR row in BankPnLSection.
4. **FI-18 Grace interest prominence:** Move `graceInterestCarry` to uncollapsed equity summary.
5. **FI-25 Break-even label:** Rename scenario or add clarifying note that it is dual-axis.
6. **BE-09 capTable serialisation:** Decide and implement whether capTable/waterfall travel with scenario saves.
7. **OUTPUT-WATERMARK:** Add "Generated by Villa Lev Finance Platform" footer + short model assumptions hash to `exportBankPresentation.ts` and `exportBankReport.ts`.

---

### Phase 3 — New features + design system
**Requires Eytan's approval AND analytics data for items marked with analytics gate.**

---

#### P3-01: ADR growth rate assumption (HO-10)
Add optional `adrGrowthRate` to `RevenueAssumptions` (default 0 for backward compat). Compound from `OPENING_YEAR` in `computePnLYear`. Surface in Assumptions editor under Revenue. Bank view locked at 0 (conservative). Admin view exposes the slider.  
**Analytics gate:** None — this is a model improvement, not a UI feature.  
**ADR required:** Yes (new assumption field, golden-snapshot update).

---

#### P3-02: Seasonality curve (HO-02)
Add a quarterly or monthly revenue distribution profile to `RevenueAssumptions`. Propagate into working capital quarterly model. Required before a serious lender will accept the revenue model.  
**Analytics gate:** None — this is a model improvement.  
**ADR required:** Yes (significant revenue engine change).

---

#### P3-03: Per-unit-type occupancy (HO-01)
Split `suiteBaseNights` into `standardSuiteBaseNights` and `doubleSuiteBaseNights`. Maintain ramp factor on top.  
**Analytics gate:** None.  
**ADR required:** Yes (schema change, golden-snapshot update).

---

#### P3-04: Fixed / variable OPEX split (HO-11)
Classify `PropertyOpex` fields as fixed vs variable. Apply variable portion at `totalRevenue / stabilisedRevenue` ratio.  
**Analytics gate:** None.  
**ADR required:** Yes.

---

#### P3-05: Shock scenario in stress test (HO-18)
Add a -40% revenue shock row to BankStressTest. Compute approximate DSCR derivation without a new full scenario run.  
**Analytics gate:** None — important for bank credibility.  
**ADR required:** Probably yes (new scenario type).

---

#### P3-06: STR/GNTO regulatory classification display (HO-08)
Add a static disclosure field in the bank deal overview stating GNTO status and STR registry status.  
**Analytics gate:** None — decision and text from Eytan.  
**ADR required:** No.

---

#### P3-07: Construction milestone schedule (HO-09, FI-09 if engine changes needed)
Add a milestone-linked construction schedule table to the VAT Cashflow tab. May require a new engine output for milestone-to-tranche mapping.  
**Analytics gate:** None.  
**ADR required:** If new engine output field is needed.

---

#### P3-08: Operator profile field (HO-07)
Add `operatorProfile` to `ModelAssumptions` with `operatorName`, `managementContractType`, `franchiseFeeRate`. Surface name in bank deal overview header.  
**Analytics gate:** None — decision from Eytan on operator selection.  
**ADR required:** Yes (new schema field).

---

#### P3-09: F&B revenue model (HO-21)
Add `fbRevenue` and `fbCost` fields or at minimum an explicit "ancillary is net post-cost" disclosure in the bank view.  
**Analytics gate:** None — clarification from Eytan on whether F&B is planned.

---

#### P3-10: Live data refresh for currentVillaActuals.ts (HO-19)
Wire `useSeasonSnapshot` as the primary source for the current season data in `LiveTrackRecord`. Demote `currentVillaActuals.ts` to emergency static fallback only.  
**Analytics gate:** Confirm the sibling ops app consistently publishes `seasonSnapshots/latest` during season.

---

#### P3-11: Consolidate IRR/NPV implementations (FI-22, FI-23)
Remove private `irr()` and `npv()` from `model.ts`. Import `irrNewton` and `npv` from `financeUtils.ts`. Resolve the NaN/0 divergence (prefer NaN for upstream null-coalescing).  
**Analytics gate:** None.  
**ADR required:** No. Requires golden-snapshot update.

---

#### P3-12: Design system — chart palette tokenisation (UI-01)
Extract a `CHART_PALETTE` constant referencing CSS custom properties. Replace all hardcoded hex values in Recharts components.  
**Analytics gate:** None.

---

#### P3-13: Design system — micro-typography scale (UI-12)
Define `.text-data-label` (11px), `.text-data-sublabel` (10px), `.text-data-footnote` (9px) in `globals.css`. Replace all `text-[Xpx]` arbitrary values.  
**Analytics gate:** None.

---

#### P3-14: Extract StepperInput atom and unify rate popovers (UI-11)
Extract `StepperInput` from `RateLoanPopover`, `OptimaRatePopover`, and `PercentInput`. Reduces per-popover line count by ~60% and eliminates UX divergence between the three stepper patterns.  
**Analytics gate:** None.

---

#### P3-15: Remove or replace 3D flip card (UI-19)
Replace the "Coming Soon" hover flip card with a static "Additional materials available on request" chip or a simple two-button card. Remove the consumer-facing 3D animation from the institutional bank view.  
**Analytics gate:** Confirm download buttons are actually "coming soon" (i.e. the export works) — if so, replace with working export buttons, not a teaser card.

---

#### P3-16: RBAC re-implementation (BE-06)
Re-implement the full RBAC system per `project_rbac_reimplement_plan.md`. This is a multi-session effort that replaces the shared-password gate for the admin view.  
**Analytics gate:** None — but requires scheduling as a dedicated session.

---

## Appendix: Source → Plan Traceability

| Source ID | Plan item |
|-----------|----------|
| BE-01 | P2-01 |
| BE-02 | P2-03 |
| BE-03 | P1-02 |
| BE-04 | P2-01 (partial; full resolution in P3-16 RBAC) |
| BE-05 | P1-02 |
| BE-06 | P3-16 |
| BE-07 | P2-10 OUTPUT-WATERMARK |
| BE-08 | P1-03 |
| BE-09 | P2-10 |
| BE-10 | P1-01 |
| BE-11 | noted in P3; no immediate action |
| BE-12 | P2-04 |
| BE-13 | P2-10 Optima rate timestamp |
| BE-14 | P3-10 |
| BE-15 | P2-02 |
| BE-16 | noted; low risk |
| BE-17 | P1-19 |
| BE-18 | noted; watch-list |
| BE-19 | P1-02 |
| BE-20 | P2-05 (partial); noted as low risk |
| FI-01 | P1-05 |
| FI-02 | P1-05 |
| FI-03 | P1-04 |
| FI-04 | P1-06 |
| FI-05 | P2-10 |
| FI-06 | P3 (low priority) |
| FI-07 | P3 (low priority) |
| FI-08 | P2-09 |
| FI-09 | P2-09 |
| FI-10 | P2-09 |
| FI-11 | P2-09 |
| FI-12 | P2-10 |
| FI-13 | P2-09 |
| FI-14 | P2-09 |
| FI-15 | P1-07 |
| FI-16 | P1-07 |
| FI-17 | P2-10 |
| FI-18 | P2-10 |
| FI-19 | P1-09 |
| FI-20 | P1-08 |
| FI-21 | P2-02 |
| FI-22 | P3-11 |
| FI-23 | P3-11 |
| FI-24 | P2-04 |
| FI-25 | P2-10 |
| FI-26 | P3 |
| FI-27 | P1-09 |
| HO-01 | P3-03 |
| HO-02 | P3-02 |
| HO-03 | P1-10 |
| HO-04 | P1-10 |
| HO-05 | P1-10 |
| HO-06 | P1-10 |
| HO-07 | P3-08 |
| HO-08 | P3-06 |
| HO-09 | P3-07 |
| HO-10 | P3-01 |
| HO-11 | P3-04 |
| HO-12 | P2-06 |
| HO-13 | P2-05 |
| HO-14 | noted (hypothesis); verify route isolation |
| HO-15 | P1-10 |
| HO-16 | P1-10 |
| HO-17 | P3 (high effort; deferred) |
| HO-18 | P3-05 |
| HO-19 | P3-10 |
| HO-20 | addressed by P1-13 cross-link + P2-07 merge |
| HO-21 | P3-09 |
| HO-22 | P3-01 (post-ADR-growth) |
| UI-01 | P3-12 |
| UI-02 | P1-11 |
| UI-03 | P1-16 |
| UI-04 | P1-16 |
| UI-05 | P3 (minor) |
| UI-06 | P1-15 |
| UI-07 | P3 (minor) |
| UI-08 | P1-16 |
| UI-09 | P1-16 |
| UI-10 | P1-18 |
| UI-11 | P3-14 |
| UI-12 | P3-13 |
| UI-13 | P1-11 |
| UI-14 | P1-15 |
| UI-15 | P1-01 |
| UI-16 | P1-16 |
| UI-17 | noted; visual QA |
| UI-18 | P1-15 |
| UI-19 | P3-15 |
| UI-20 | P1-15 |
| UI-21 | P1-15 |
| UI-22 | P1-16 |
| UI-23 | noted; verify in layout.tsx |
| UI-24 | P1-17 |
| UI-25 | P1-16 |
| UI-26 | P1-16 |
| UI-27 | P1-17 |
| UI-28 | P3 (architectural choice; low urgency) |
| UX-01 | P1-12 |
| UX-02 | P1-12 |
| UX-03 | P1-12 |
| UX-04 | P1-12 |
| UX-05 | P1-12 |
| UX-06 | P1-12 (DSRA tab dedup in General merge) |
| UX-07 | P1-14 |
| UX-08 | P3 (analytics gate) |
| UX-09 | P1-12 (Optima sidebar link removal) |
| UX-10 | P1-01 |
| UX-11 | P1-13 |
| UX-12 | P2-07 |
| UX-13 | P1-13 |
| UX-14 | P2-08 |
| UX-15 | P2-07 (path pill simplification) |
| UX-16 | P3 (control bar fine-tune popover) |
| UX-17 | P1-12 |
| UX-18 | P1-12 |
| UX-19 | noted; links confirmed present on re-read |
| UX-20 | P1-01 |
| UX-21 | P1-13 |
| UX-22 | P1-13 |
| UX-23 | P1-12 |
| UX-24 | P3 (analytics gate) |
| UX-25 | P1-14 |
