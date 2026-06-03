# Villa Lev Platform — Feature Map (Session A Audit)
Generated: 2026-06-02
Router type: Next.js App Router (src/app/)

---

## 1. Tech Stack & Architecture

### Framework & Build
- **Next.js 16.2.2** — static export (`output: "export"` in `next.config.ts`). No SSR runtime.
- **React 19.2.4**
- **TypeScript 5**
- **Tailwind CSS 4** (via `@tailwindcss/postcss`)
- **Bundle analyser**: `@next/bundle-analyzer` — triggered by `ANALYZE=true next build --webpack`
- Config file: `/Users/esmacbookprom2/Desktop/Villa Project Saint George Claude/villa-lev-platform/next.config.ts`

### State Management
- **Zustand 5.0.12** — single store at:
  `/Users/esmacbookprom2/Desktop/Villa Project Saint George Claude/villa-lev-platform/src/lib/store/modelStore.ts`
- Store shape: `assumptions` (ModelAssumptions), `model` (ModelOutput | null), `projects` (ProjectAllocation[]), `templates` (PropertyTemplate[]), `capTable`, `waterfall`, `history` (ChangeEntry[200]), `activeScenario`, `savedConfigs`, `capexUpliftEur`, `capexAbsorption`, `financingPathOverride`, plus a suite of modals/prompts.
- localStorage write-through for all persistent slices (12 storage keys, constants in modelStore.ts lines 231–243).
- Firestore `scenarios` collection for cross-browser scenario sharing.

### Auth Model
- **Current (active)**: Shared-password gate — `src/components/AuthGate.tsx`.
  - Password stored in `localStorage` key `vl-admin-pass`.
  - Name stored in `localStorage` key `vl-admin-name`.
  - Google sign-in bypass for admin email (`NEXT_PUBLIC_ADMIN_EMAIL`).
  - Anonymous Firebase Auth created on pass-gate success for Firestore write uid.
- **Bank view gate**: `src/components/BankGate.tsx` — name-prompt only, stored in `sessionStorage` key `vl-bank-name`. Anonymous Firebase Auth created on submit.
- **Saved for re-implementation (RBAC)**: `src/.rbac-saved/` — full invite/role/approval RBAC system (see §10).
- **RBAC hook (still wired, not gating routes)**: `src/lib/data/useAuth.ts` — full role resolution (admin/editor/viewer) from `users/{uid}` Firestore doc, plus `claimInvite` / `selfRegister` flows. This hook is imported by `src/.rbac-saved/AuthGate.tsx` but NOT by the live `src/components/AuthGate.tsx`.
- **Effective auth / impersonation**: `src/lib/data/useEffectiveAuth.ts` — reads `localStorage` key `villa-lev-viewAs`; allows an admin to impersonate a banker role for preview.

### Hosting
- Firebase Hosting, project `villa-lev-admin`.
- Staging site ID: `villa-lev-finance-staging` → `https://villa-lev-finance-staging.web.app`
- Production site ID: `villa-lev-finance` → `https://villa-lev-finance.web.app`
- Config: `/Users/esmacbookprom2/Desktop/Villa Project Saint George Claude/villa-lev-platform/firebase.json`
- Firebase project: `/Users/esmacbookprom2/Desktop/Villa Project Saint George Claude/villa-lev-platform/.firebaserc`
- Deploy script: `villa-lev-platform/scripts/deploy-staging.sh`

### Firebase (Firestore)
- Project: `villa-lev-admin`
- Client init: `src/lib/firebase.ts`
- Collections used:
  - `scenarios` — saved financial scenario documents (public read via `published:true`, write requires auth)
  - `users` — RBAC user profiles (role, status, invitedBy)
  - `invites` — pending email invites
  - `mail` — (collection name declared, possibly for invite email flow)
  - `presence` (runtime — see usePresence.ts)
  - `connectionLog` / `connectionHistory` (runtime — see useConnectionsLog.ts, useConnectionHistory.ts)
  - `seasonSnapshots/latest` — live ops data from sibling `villa-lev-admin` app

### i18n
- Custom i18n (no next-intl). Provider: `src/lib/i18n/I18nProvider.tsx`
- Locales: `en`, `el` (Greek), `he` (Hebrew/RTL)
- `fr` file exists (`src/lib/i18n/fr.ts`) but is NOT in the `Locale` union type and is not exported from `src/lib/i18n/index.ts` — forward-compat stub only.
- Dictionary type: `src/lib/i18n/types.ts` (TranslationDictionary, ~2278 lines)
- Locale config: `LOCALE_CONFIG` in `src/lib/i18n/types.ts` — includes `dir: 'rtl'` for Hebrew.
- URL-based locale switching: `?lang=en|el|he` query param parsed by I18nProvider.
- Index: `src/lib/i18n/index.ts`

### Test Runner
- **Vitest 3.2.4** (not Jest)
- Pure-TS engine tests: `npm run test:run` — config `vitest.config.ts`, environment `node`, includes `src/**/*.test.ts`
- DOM component tests: `npm run test:dom` — config `vitest.dom.config.ts`, environment `jsdom`, includes `src/**/*.test.tsx`
- Setup file for DOM tests: `src/test-setup.dom.ts`
- Both configs at:
  - `/Users/esmacbookprom2/Desktop/Villa Project Saint George Claude/villa-lev-platform/vitest.config.ts`
  - `/Users/esmacbookprom2/Desktop/Villa Project Saint George Claude/villa-lev-platform/vitest.dom.config.ts`

### Notable Dependencies
- `recharts 3.8.1` — all charts
- `exceljs 4.4.0` — Excel BP export
- `docx 9.6.1` — Word document exports (investor/bank presentations)
- `jspdf 4.2.1` + `jspdf-autotable` — PDF export
- `firebase 12.13.0` — Firestore + Auth client SDK
- `firebase-admin 13.10.0` — devDependency (used by scripts or build-time tooling only — no server runtime)

---

## 2. Route / Navigation Map

App Router (`src/app/`). All pages are `"use client"` — static export has no server components rendering dynamic data.

```
/                         → src/app/page.tsx
                            Redirect to /admin/dashboard (useEffect, ref guard)

/admin/                   → src/app/admin/layout.tsx
                            AuthGate wrapper + AuthenticatedShell (sidebar + control bar)
                            Audience: authenticated users (admin password gate)

  /admin/login            → src/app/admin/login/page.tsx
                            Login page — bypasses AuthGate rendering

  /admin/dashboard        → src/app/admin/dashboard/page.tsx
                            Main operator/investor dashboard

  /admin/returns          → src/app/admin/returns/page.tsx
                            Full exit analysis & IRR breakdown

  /admin/pnl              → src/app/admin/pnl/page.tsx
                            P&L timeline (year-by-year table)

  /admin/breakeven        → src/app/admin/breakeven/page.tsx
                            Break-even analysis (nights/ADR sensitivity)

  /admin/sensitivity      → src/app/admin/sensitivity/page.tsx
                            ADR / occupancy / interest sensitivity

  /admin/debt-coverage    → src/app/admin/debt-coverage/page.tsx
                            DSCR, LLCR, PLCR, DSRA detail

  /admin/financing        → src/app/admin/financing/page.tsx
                            Financing path comparison table

  /admin/opco-split       → src/app/admin/opco-split/page.tsx
                            OpCo/PropCo waterfall detail

  /admin/cap-table        → src/app/admin/cap-table/page.tsx
                            Cap table + founder waterfall + stakeholder IRR

  /admin/assumptions      → src/app/admin/assumptions/page.tsx
                            Full assumptions editor (tabbed: Financing / Revenue / Ramp /
                            OPEX / Portfolio OPEX / CAPEX / Tax / Working Capital / DSRA /
                            OTA Distribution)

  /admin/capex            → src/app/admin/capex/page.tsx
                            CAPEX breakdown editor

  /admin/scenarios        → src/app/admin/scenarios/page.tsx
                            Scenario save/load/share/delete/rename

  /admin/lexicon          → src/app/admin/lexicon/page.tsx
                            Glossary of financial terms

  /admin/team             → src/app/admin/team/page.tsx
                            Invite management + user approval (RBAC scaffolding)

  /admin/connections      → src/app/admin/connections/page.tsx
                            Live presence board + session history (admin-only)

  /admin/presentation/    → src/app/admin/presentation/layout.tsx
                            Minimal shell (no sidebar)
    /admin/presentation   → src/app/admin/presentation/page.tsx
                            10-section investor/bank presentation (live-wired to model)

/bank/                    → src/app/bank/layout.tsx
                            BankGate wrapper (name-prompt only)
                            Audience: bankers (unauthenticated, name-only gate)

  /bank                   → src/app/bank/page.tsx
                            Full banker view (BankControlBar, BankPnLSection,
                            SourcesUsesPanel, BankStressTest, ConstructionVatCashflow,
                            VillaMarketDrawer, LiveTrackRecord)
                            Sub-tabs: Overview / Sensitivity / VAT Cashflow

  /bank/optima            → src/app/bank/optima/page.tsx
                            Optima Bank-specific view (sub-project A/B tabs,
                            two-sub-project CAPEX breakdown, Euribor-linked rate)

/pitch/                   → src/app/pitch/layout.tsx
                            Minimal pitch layout
  /pitch                  → src/app/pitch/page.tsx
                            Full-page investor pitch deck (12 slides)

/presentation             → src/app/presentation/page.tsx
                            PDF viewer/download wrapper for the static presentation PDF

/assumptions-memo         → src/app/assumptions-memo/page.tsx
                            Conservative assumptions memo (10 sections, collapsible)
```

### Control Bar (admin layout, sticky)
The admin layout's `AuthenticatedShell` renders a sticky `#control-bar` with:
- Financing path pills: Commercial | RRF | Grant | TEPIX Loan | Optima
- Scenario pills: Conservative | Realistic | Downside | Break-Even
- Exit year numeric input
- EBITDA multiple input
- €/m² property-sale exit input
- Rate/Loan popover (conditional on active path)

### Sidebar (admin layout)
Three nav groups:
- **Analyse**: Dashboard, Returns, P&L Timeline, Break-Even, Sensitivity, Debt Coverage, Financing Paths
- **Inputs**: Assumptions, CAPEX, Scenarios, Lexicon, Team, Connections
- **Structure**: OpCo/PropCo, Cap Table

---

## 3. Feature Inventory

| Name | File (path) | Route | Audience | What it does | Data read/written |
|------|-------------|-------|----------|--------------|-------------------|
| Root redirect | `src/app/page.tsx` | `/` | All | Instant redirect to /admin/dashboard | — |
| Admin shell + sidebar | `src/app/admin/layout.tsx` | `/admin/*` | Authenticated | Sidebar nav, sticky control bar, financing/scenario/exit controls, stale-snapshot banner | modelStore assumptions, activeScenario, useSeasonSnapshot, useEffectiveAuth |
| Login page | `src/app/admin/login/page.tsx` | `/admin/login` | Unauthenticated | Password/Google sign-in gate | localStorage (vl-admin-pass, vl-admin-name) |
| Dashboard | `src/app/admin/dashboard/page.tsx` | `/admin/dashboard` | Admin | Portfolio summary, KPI grid, 3-scenario return table, DSCR chart, DSRA chart, conservatism check, founder waterfall card, exit analysis card, CAPEX uplift control, Excel export | modelStore (model, assumptions, capTable, waterfall), useSeasonSnapshot, computeCapTable |
| Returns page | `src/app/admin/returns/page.tsx` | `/admin/returns` | Admin | Full exit analysis — hotel-sale vs property-sale IRR, two-exit table, yield table, MOIC | modelStore (model, assumptions) |
| P&L Timeline | `src/app/admin/pnl/page.tsx` | `/admin/pnl` | Admin | Year-by-year P&L table with expand/collapse rows | modelStore (model, assumptions, activeScenario) |
| Break-Even | `src/app/admin/breakeven/page.tsx` | `/admin/breakeven` | Admin | Break-even analysis — nights/ADR matrix, DSCR by occupancy/ADR | modelStore |
| Sensitivity | `src/app/admin/sensitivity/page.tsx` | `/admin/sensitivity` | Admin | ADR sensitivity, occupancy sensitivity, interest sensitivity, WC sensitivity, CAPEX sensitivity | modelStore |
| Debt Coverage | `src/app/admin/debt-coverage/page.tsx` | `/admin/debt-coverage` | Admin | DSCR/LLCR/PLCR detail, DSRA tile, covenant headroom | modelStore |
| Financing Paths | `src/app/admin/financing/page.tsx` | `/admin/financing` | Admin | Financing path comparison table (commercial/RRF/grant/TEPIX/Optima) | modelStore |
| OpCo/PropCo Split | `src/app/admin/opco-split/page.tsx` | `/admin/opco-split` | Admin | OpCo waterfall mechanics, fee streams, PropCo EBITDA | modelStore |
| Cap Table | `src/app/admin/cap-table/page.tsx` | `/admin/cap-table` | Admin | Stakeholder cap table, founder waterfall breakdown, per-stakeholder IRR/MOIC/payback, DOCX export | modelStore (capTable, waterfall), computeCapTable, exportInvestorPresentation |
| Assumptions editor | `src/app/admin/assumptions/page.tsx` | `/admin/assumptions` | Admin | Full tabbed assumptions editor: all financing params, revenue, ramp, OPEX, portfolio OPEX, CAPEX, tax, working capital, DSRA, OTA distribution | modelStore (setAssumption, setTemplate, setProject, setPortfolioOpex) |
| CAPEX editor | `src/app/admin/capex/page.tsx` | `/admin/capex` | Admin | Per-property CAPEX breakdown, pool configuration, extra CAPEX lines | modelStore |
| Scenarios | `src/app/admin/scenarios/page.tsx` | `/admin/scenarios` | Admin | Save/load/share/delete/rename scenarios; Firestore sync; reference scenario designation | modelStore (savedConfigs), Firestore `scenarios` |
| Lexicon | `src/app/admin/lexicon/page.tsx` | `/admin/lexicon` | Admin | Glossary of financial terms (CAPEX, revenue, OPEX, EBITDA, DSCR, etc.) | static |
| Team | `src/app/admin/team/page.tsx` | `/admin/team` | Admin | Invite by email, user list, pending approval table, approve/revoke | Firestore `users`, `invites` |
| Connections | `src/app/admin/connections/page.tsx` | `/admin/connections` | Admin | Live presence board (who is viewing now), session history (actions), stale-doc cleanup | Firestore `presence`, `connectionLog`, `connectionHistory` |
| Admin presentation | `src/app/admin/presentation/page.tsx` | `/admin/presentation` | Admin | 10-section live-wired investor/bank presentation; path/scenario selector; DOCX export | modelStore, exportBankPresentation |
| Bank view | `src/app/bank/page.tsx` | `/bank` | Banker | Full banker-facing view: deal overview, P&L, collateral, stress test, VAT cashflow, market data; sub-tabs: Overview / Sensitivity / VAT | modelStore (bank viewMode), BankControlBar, useConnectionsLog |
| Optima Bank view | `src/app/bank/optima/page.tsx` | `/bank/optima` | Banker | Optima-specific bank view: sub-project A/B tabs, Euribor rate display, two-sub-project CAPEX, P&L section, stress test, VAT cashflow | modelStore, optimaView, useEuribor |
| Pitch deck | `src/app/pitch/page.tsx` | `/pitch` | Investor/public | 12-slide investor pitch deck (cover, track record, market, project, capital, DSCR, events, resilience, collateral, optionality, close) | modelStore, useSeasonSnapshot |
| Presentation PDF viewer | `src/app/presentation/page.tsx` | `/presentation` | Banker/Investor | PDF iframe viewer + download for static presentation PDF | presentationMeta.ts |
| Assumptions memo | `src/app/assumptions-memo/page.tsx` | `/assumptions-memo` | Admin | Conservative assumptions memo (10 collapsible sections) | modelStore, useTranslation |
| AuthGate | `src/components/AuthGate.tsx` | wraps /admin/* | Admin | Shared-password gate + Google sign-in; anon Firebase Auth on success | localStorage, Firebase Auth |
| BankGate | `src/components/BankGate.tsx` | wraps /bank/* | Banker | Name-prompt gate; anon Firebase Auth | sessionStorage |
| BankControlBar | `src/components/BankControlBar.tsx` | /bank, /bank/optima | Banker | Sticky path/scenario selector for bank view; Optima Euribor/spread inputs; Excel/DOCX export buttons | modelStore (financingPathOverride, setAssumption) |
| BankPnLSection | `src/components/BankPnLSection.tsx` | /bank, /bank/optima, /admin/presentation | Banker/Admin | Bank-view P&L table (EBITDA pre/post-OpCo, DS, CFADS, DSCR all three scenarios) | modelStore (bank viewMode) |
| BankSensitivityTab | `src/components/BankSensitivityTab.tsx` | /bank (Sensitivity tab) | Banker | Sliders: villa ADR, suite ADR, occupancy, interest rate; outputs: DSCR/IRR/MOIC | modelStore |
| BankStressTest | `src/components/BankStressTest.tsx` | /bank, /bank/optima, /admin/presentation | Banker | Stress-scenario output strip (downside DSCR/IRR/NCF) | modelStore |
| InvestorSensitivityTab | `src/components/InvestorSensitivityTab.tsx` | /pitch (sensitivity section) | Investor | Sliders: occupancy, villa ADR, suite ADR, exit year, exit multiple, €/m²; outputs: IRR, MOIC, yield, payback | modelStore |
| SourcesUsesPanel | `src/components/SourcesUsesPanel.tsx` | /bank, /bank/optima | Banker | Uses-of-proceeds breakdown + capital structure pie | modelStore |
| ConstructionVatCashflow | `src/components/ConstructionVatCashflow.tsx` | /bank, /bank/optima | Banker | Construction VAT cashflow table + chart (ADR-0015) | modelStore (capex.constructionVatByYear) |
| LiveTrackRecord | `src/components/LiveTrackRecord.tsx` | /admin/dashboard, /bank, /bank/optima, /pitch, /admin/presentation | All | Live villa track record (2022–2026 revenue, ADR, bookings, market position strip) | useSeasonSnapshot, villaMarketSales, marketBenchmarks |
| ConservatismTriangle | `src/components/ConservatismTriangle.tsx` | /pitch, /bank | Investor/Banker | BP-vs-market conservatism strip + comparables drawer trigger | villaMarketSales, marketBenchmarks |
| MarketComparablesDrawer | `src/components/MarketComparablesDrawer.tsx` | /pitch, /bank | Investor/Banker | Slide-in drawer with hotel ADR comparables table | marketBenchmarks.ts |
| VillaMarketDrawer | `src/components/VillaMarketDrawer.tsx` | /bank, /bank/optima | Banker | Slide-in drawer with villa sale/rental market data | villaMarketSales.ts |
| CapexUpliftControl | `src/components/CapexUpliftControl.tsx` | /admin/dashboard | Admin | Virtual CAPEX uplift sensitivity slider; shows delta on loan/DSCR without touching model | modelStore (setCapexUpliftEur) |
| CapexAbsorptionControl | `src/components/CapexAbsorptionControl.tsx` | /admin/capex | Admin | CAPEX absorption (soft-cost reclassification) toggle | modelStore |
| AllocationEditor | `src/components/AllocationEditor.tsx` | /admin/assumptions (portfolio OPEX tab) | Admin | Per-project allocation fraction editor for staff roles and shared services | modelStore |
| EytanReturnBreakdown | `src/components/EytanReturnBreakdown.tsx` | /admin/cap-table | Admin | Three-role sponsor return display (co-invest / developer promote / ratchet) | capTable compute results |
| DistributionCovenantBadge | `src/components/DistributionCovenantBadge.tsx` | /bank | Banker | Badge showing whether distribution gate is open/closed (ADR-0014) | modelStore |
| AssumptionPrompts | `src/components/AssumptionPrompts.tsx` | /admin/* | Admin | Auto-saves prompt modal (fires after 3 edits), name modal (first edit), save modal | modelStore |
| AssumptionsMemoButton | `src/components/AssumptionsMemoButton.tsx` | /admin layout (commented out) | Admin | Button to navigate to /assumptions-memo | router |
| PageTour | `src/components/PageTour.tsx` | /admin/dashboard, /bank | Admin/Banker | Onboarding tour overlay (step-by-step highlight + tooltip) | localStorage (tour seen flags) |
| LanguageToggle | `src/components/LanguageToggle.tsx` | admin sidebar, bank layout | All | EN/EL/HE locale switcher | I18nProvider |
| ViewAsControl | `src/components/ViewAsControl.tsx` | admin layout | Admin | Impersonation toggle (admin pretends to be banker) | localStorage (villa-lev-viewAs) |
| ImpersonationBanner | `src/components/ImpersonationBanner.tsx` | root layout | Admin | Sticky banner when impersonating banker role | useEffectiveAuth |
| BankViewToggle / BankViewBadge | `src/components/BankViewToggle.tsx` | admin layout | Admin | Toggle/badge for bank-view impersonation | useEffectiveAuth |
| Skeleton | `src/components/Skeleton.tsx` | all pages (while model loading) | All | Loading skeleton variants (grid, list, table) | — |
| AdminUI | `src/components/AdminUI.tsx` | /admin/* | Admin | Shared UI atoms: SectionHeader, KPICard, StatusChip | — |
| Chevron icon | `src/components/icons/Chevron.tsx` | various | All | SVG chevron icon | — |

---

## 4. Dead-Code Candidates

### Dead code (code-proven)
| File | Reason |
|------|--------|
| `src/lib/docx/exportInvestorPresentation_v2_capital_discipline.ts` | Exports `exportInvestorPresentationV2CapitalDiscipline` — zero imports found in `src/` outside the file itself. |
| `src/lib/docx/exportInvestorPresentation_v3_aegean_story.ts` | Exports `exportInvestorPresentationV3AegeanStory` — zero imports found in `src/` outside the file itself. |
| `src/components/AssumptionsMemoButton.tsx` | Rendered in admin layout but commented out (`{/* <AssumptionsMemoButton /> */}`). The component file remains. |
| `src/lib/i18n/fr.ts` | French locale file exists but `Locale` type (`src/lib/i18n/types.ts`) only includes `en | el | he`. `fr` is cast through `unknown` in `index.ts` and not surfaced in the `LanguageToggle`. Effectively dead. |

### Possibly orphaned (needs confirmation)
| File | Reason |
|------|--------|
| `src/lib/pdf/exportInvestorReport.ts` | Exports a PDF investor report function. Check whether any page imports it — could have been superseded by the DOCX presentation. |
| `src/lib/pdf/exportBankReport.ts` | Exports a PDF bank report function. Same concern — may be superseded by `exportBankPresentation.ts` (DOCX). |
| `src/components/ViewAsControl.tsx` | Imported in admin layout — verify it is actually rendered and not commented out. |

### .rbac-saved/ contents (DO NOT DELETE — saved for future re-implementation)
Located in `src/.rbac-saved/`:
| File | Purpose |
|------|---------|
| `src/.rbac-saved/AuthGate.tsx` | Full RBAC gate (role-gated routing, pending/missing profile screens) |
| `src/.rbac-saved/login.page.tsx` | Full login page with Google + email/password sign-in, error i18n mapping |
| `src/.rbac-saved/useAuth.ts` | Auth hook wired to the RBAC AuthGate |
| `src/.rbac-saved/useEffectiveAuth.ts` | RBAC-aware effective-auth hook |
| `src/.rbac-saved/userProfile.ts` | RBAC user profile helpers |

Note: The currently-live `src/lib/data/useAuth.ts` IS the full RBAC hook — it was preserved in its full form. The `.rbac-saved/` copies are older snapshots for the gate wiring only.

---

## 5. Duplication Map

### Near-duplicate components
| Item | Locations | Notes |
|------|-----------|-------|
| `MetricCell` local component | `src/app/bank/page.tsx` AND `src/app/bank/optima/page.tsx` | Identical inline component defined twice. Should be extracted to a shared component. |
| `PercentInput` and `RateLoanPopover` | Defined inline in `src/app/admin/layout.tsx` | Could be extracted to shared UI components. |
| `formatRelative()` | Inline in `src/app/admin/connections/page.tsx` | Utility function not in a shared util file. |
| `ACTION_LABELS` map with bare strings | `src/app/admin/connections/page.tsx` | Hardcoded English strings not run through `t()`. |

### Duplicate export presentation files
Three versions of the investor DOCX export:
- `src/lib/docx/exportInvestorPresentation.ts` — canonical (v1, active)
- `src/lib/docx/exportInvestorPresentation_v2_capital_discipline.ts` — v2, dead code (zero imports)
- `src/lib/docx/exportInvestorPresentation_v3_aegean_story.ts` — v3, dead code (zero imports)

### Duplicated engine logic candidates
- `npv()` and `irr()` defined in `src/lib/engine/model.ts` (private); exported as `npv` and `irrNewton` from `src/lib/engine/financeUtils.ts`; imported by `src/lib/engine/capTable.ts`. Verify whether `model.ts` uses its own private copies or imports from `financeUtils.ts`.
- DSCR covenant threshold appears as both a runtime assumption (`dscrCovenantThreshold` in ModelAssumptions) and a hardcoded `1.25` default in several UI places.

### Duplicate data type definitions
`PropertyConfig` and `PropertyTemplate` in `src/lib/engine/types.ts` share ~85% of fields. They exist separately because templates are blueprints and configs are resolved instances, but structural duplication is high.

---

## 6. Data Model Summary

### Firestore Collections
| Collection | Doc ID | Key fields | Who writes |
|------------|--------|------------|------------|
| `scenarios` | UUID (generated) | `id`, `name`, `assumptions`, `templates`, `projects`, `capTable`, `waterfall`, `published`, `userId`, `savedAt` | modelStore (authenticated users) |
| `users` | Firebase UID | `uid`, `email`, `displayName`, `role` (admin/editor/viewer), `status` (pending/approved), `createdAt`, `invitedBy`, `lastSignInAt` | `userProfile.ts` (claimInvite, selfRegister) |
| `invites` | lowercased email | `email`, `role`, `note`, `invitedBy`, `createdAt` | Team page |
| `mail` | (auto-id) | email payload | (invite flow — possibly not wired) |
| `presence` | visitor-id | `name`, `lastSeen`, `path`, `actions` | `usePresence.ts` |
| `connectionLog` | (auto-id) | session log entries | `useConnectionsLog.ts` |
| `connectionHistory` | (auto-id) | historical session entries | `useConnectionHistory.ts` |
| `seasonSnapshots/latest` | `latest` | `currentSeason`, `lastCompletedSeason` — occupancy, ADR, RevPAR | sibling `villa-lev-admin` app |

### Financial Engine Core Types
Defined in `src/lib/engine/types.ts`:
- `ModelAssumptions` — all inputs (revenue, OPEX, CAPEX, financing params for all 5 paths, tax, working capital, DSRA, OpCo split, portfolio OPEX)
- `ModelOutput` — computed result with 4 scenario outputs + path-specific scenarios + keyMetrics + financingComparison + DSCR by year + collateral
- `ScenarioOutput` — per-scenario: `pnl[]` (AnnualPnL), stabilisedYear, wcQuarters, LLCR, PLCR, IRR, MOIC, DSCR stats, exit valuations, DSRA summary
- `AnnualPnL` — per-year: all P&L lines, debt service, CFADS, DSCR, WC aggregates, DSRA flows, tax flows, OpCo fees, commitment fee, taxableProfit, loss carryforward fields
- `CapexBreakdown` — CAPEX totals + per-category detail + depreciation + construction VAT by year
- `FinancingPath` = `'commercial' | 'grant' | 'rrf' | 'tepix-loan' | 'optima'`
- `GraceMode` = `'standard' | 'rolling' | 'two-phase' | 'rolling-cohort'`

### modelStore Shape (Zustand)
Primary fields in `src/lib/store/modelStore.ts`:
```
assumptions: ModelAssumptions      — full model inputs (live)
model: ModelOutput | null          — computed output (recomputed on assumption change)
projects: ProjectAllocation[]      — which templates are deployed, how many plots
templates: PropertyTemplate[]      — property blueprint definitions
capTable: CapTableStakeholder[]    — investor list
waterfall: WaterfallParams         — founder waterfall config
activeScenario: ScenarioName       — 'realistic' | 'upside' | 'downside' | 'breakeven'
savedConfigs: SavedConfiguration[] — loaded from Firestore + localStorage
history: ChangeEntry[200]          — change audit trail (localStorage)
currentUser: string                — name from gate
capexUpliftEur: number | null      — ephemeral CAPEX uplift (virtual, no model mutation)
capexUpliftBaselineLoans: Record<path, number>  — baseline loans before uplift
capexAbsorption: CapexAbsorptionConfig | null   — soft-cost absorption toggle
financingPathOverride: FinancingPath | null      — ephemeral path override (CapexUplift)
```
Modal/UI state: `nameModalOpen`, `saveModalOpen`, `savePromptDismissed`, `savePromptDisabled`, `editsSinceLastSave`, `userHasSetName`, `lastSavedConfig`.

### Admin vs Bank View Data Model Divergence
- **Admin view** (`viewMode: 'internal'`): OpCo fees are SENIOR to debt service — EBITDA/DSCR/NCF include the full OpCo deduction.
- **Bank view** (`viewMode: 'bank'`): OpCo fees are SUBORDINATED to debt service — DSCR numerator uses `ebitdaPreOpCo`; CFADS/NCF are computed before OpCo extraction.
- The `viewMode` field on `ModelAssumptions` is not persisted in Firestore — it is set at call sites in bank pages, ensuring Firestore snapshots always reflect the internal/admin view.

---

## 7. i18n Coverage Gaps

### Correctly using t()
All production UI components in `src/components/` and `src/app/` consistently call `useTranslation()` and use `t('key')` for user-visible strings. The i18n system is comprehensive — `TranslationDictionary` in `src/lib/i18n/types.ts` defines ~700+ keys.

### Known bare JSX string literals (translation bugs)
| File | Bare string | Notes |
|------|-------------|-------|
| `src/components/AuthGate.tsx:150` | `"Villa Lev"` | Brand name — exempt per project rules |
| `src/components/AuthGate.tsx:151` | `"Finance Platform"` | Should use `t('app.platform')` — translation bug |
| `src/components/BankControlBar.tsx:256` | `"Villa Lev Group"` | Brand name — exempt |
| `src/components/VillaMarketDrawer.tsx:262` | `"Villa Lev — BP ADR"` | Brand name component — possibly exempt |
| `src/components/AssumptionPrompts.tsx:151` | `"Last saved"` | Translation bug — not using t() |
| `src/app/admin/connections/page.tsx:17–20` | `ACTION_LABELS` map values ("Excel ↓", "Presentation", "Tour") | Translation bugs — not using t() |
| `src/app/admin/connections/page.tsx:26` | `"just now"` in `formatRelative()` | Translation bug |
| `src/app/admin/connections/page.tsx:27–31` | `"s ago"`, `"m ago"`, `"h ago"` | Translation bugs |

### Hebrew (he) locale partial coverage
`src/lib/i18n/he.ts` contains 30+ keys with value `"TODO"` — these are untranslated stubs:
- All `ct.roles.*` keys (15 keys)
- `ct.dealHeadline`, `ct.dealHeadlineSub`, `ct.investorPoolSize`, `ct.investorPoolSizeSub`
- `ct.auditToggle`, `ct.dealParams`, `ct.sponsorAlignment`, `ct.waterfallDetail` and their sub-keys
- Several `opco.wStep*Detail` keys

---

## 8. Test Coverage Map

### Test files and what they cover
| Test file | Source module(s) covered |
|-----------|-------------------------|
| `src/lib/engine/__tests__/model.golden.test.ts` | `src/lib/engine/model.ts` — golden snapshot of full model output |
| `src/lib/engine/__tests__/model.viewMode.test.ts` | `src/lib/engine/model.ts` — bank vs internal viewMode divergence |
| `src/lib/engine/__tests__/graceMode.test.ts` | `src/lib/engine/model.ts` — grace mode variants |
| `src/lib/engine/__tests__/capexUplift.test.ts` | `src/lib/engine/capexUplift.ts` |
| `src/lib/engine/__tests__/dsra.test.ts` | `src/lib/engine/model.ts` (DSRA flow) |
| `src/lib/engine/__tests__/taxLossCarryforward.test.ts` | `src/lib/engine/model.ts` (LCF logic) |
| `src/lib/engine/__tests__/portfolioOpex.test.ts` | `src/lib/engine/model.ts` (portfolio OPEX) |
| `src/lib/engine/__tests__/ffeReserve.test.ts` | `src/lib/engine/model.ts` (FF&E reserve) |
| `src/lib/engine/__tests__/optima.test.ts` | `src/lib/engine/optimaView.ts`, model.ts (Optima path) |
| `src/lib/engine/__tests__/bedroomKeys.test.ts` | `src/lib/engine/bedroomKeys.ts` |
| `src/lib/engine/__tests__/opexContingency.test.ts` | `src/lib/engine/model.ts` (OPEX contingency) |
| `src/lib/engine/__tests__/otaDistribution.test.ts` | `src/lib/engine/model.ts` (OTA channel mix) |
| `src/lib/engine/__tests__/projectConstants.test.ts` | `src/lib/engine/defaults.ts` (PROJECT_CONSTANTS) |
| `src/lib/engine/__tests__/founderWaterfall.ratchet.test.ts` | `src/lib/engine/founderWaterfall.ts` |
| `src/lib/engine/__tests__/commitmentFee.test.ts` | `src/lib/engine/model.ts` (commitment fee) |
| `src/lib/store/__tests__/scenario-sharing.test.ts` | `src/lib/store/modelStore.ts` (scenario share/publish) |
| `src/lib/store/__tests__/reference-autoload-guard.test.ts` | `src/lib/hooks/useReferenceScenarioAutoLoad.ts` |
| `src/lib/data/__tests__/userProfile.test.ts` | `src/lib/data/userProfile.ts` |
| `src/lib/data/__tests__/useEffectiveAuth.test.ts` | `src/lib/data/useEffectiveAuth.ts` |
| `src/lib/data/__tests__/rbac-rules.test.ts` | Firestore RBAC rules logic |
| `src/lib/data/__tests__/marketBenchmarks.test.ts` | `src/lib/data/marketBenchmarks.ts` |
| `src/lib/data/__tests__/useConnectionsLog.test.ts` | `src/lib/data/useConnectionsLog.ts` |
| `src/lib/docx/__tests__/exportInvestorPresentation.test.ts` | `src/lib/docx/exportInvestorPresentation.ts` |
| `src/lib/docx/__tests__/exportBankPresentation.test.ts` | `src/lib/docx/exportBankPresentation.ts` |
| `src/lib/excel/__tests__/exportBP.drift.test.ts` | `src/lib/excel/exportBP.ts` (drift detection) |
| `src/lib/tours/__tests__/configs.test.ts` | `src/lib/tours/configs.ts` |
| `src/app/admin/presentation/__tests__/page.test.tsx` | `src/app/admin/presentation/page.tsx` |
| `src/app/admin/presentation/__tests__/presentationLogic.test.ts` | Presentation logic |
| `src/components/__tests__/BankSensitivityTab.test.ts` | `src/components/BankSensitivityTab.tsx` |
| `src/components/__tests__/InvestorSensitivityTab.test.ts` | `src/components/InvestorSensitivityTab.tsx` |

### Untested modules (no dedicated test file)
- `src/lib/engine/workingCapital.ts`
- `src/lib/engine/capTable.ts`
- `src/lib/engine/financeUtils.ts`
- `src/lib/engine/capexAbsorption.ts`
- `src/lib/data/useSeasonSnapshot.ts`
- `src/lib/data/usePresence.ts`
- `src/lib/data/useConnectionHistory.ts`
- `src/lib/data/currentVillaActuals.ts`
- `src/lib/data/villaMarketSales.ts`
- All page-level components except `src/app/admin/presentation/page.tsx`
- `src/components/BankGate.tsx`, `src/components/AuthGate.tsx`
- `src/lib/pdf/exportInvestorReport.ts`, `src/lib/pdf/exportBankReport.ts`

---

## 9. ADR Cross-Reference

| ADR | Affects | Implementation status |
|-----|---------|----------------------|
| 0001 — Sunset villa-lev-tepix | `villa-lev-tepix/` (SUNSET.md only) | Implemented |
| 0002 — Market benchmark conservatism column | `src/lib/data/marketBenchmarks.ts`, `src/components/LiveTrackRecord.tsx` | Implemented |
| 0003 — Champ as routing planner | `.claude/agents/champ.md` | Agent architecture only |
| 0004 — Revert market strip to 2025-only | `src/components/LiveTrackRecord.tsx` | Implemented |
| 0005 — Scenarios cross-user sharing | `src/lib/store/modelStore.ts`, Firestore `scenarios` | Implemented |
| 0006 — Market position headline | `src/components/ConservatismTriangle.tsx`, `LiveTrackRecord.tsx` | Implemented |
| 0007 — BP P&L to NCF restructure | `src/lib/engine/model.ts`, `types.ts` (AnnualPnL) | Implemented |
| 0008 — Hardcoded value elimination | `src/lib/engine/defaults.ts` (PROJECT_CONSTANTS, DealTermsConfig) | Implemented |
| 0009 — gracePeriodYears engine wiring | `src/lib/engine/model.ts`, `types.ts` | **Partial** — `gracePeriodYears` fields inert; engine uses `GRACE_END_YEAR` constant |
| 0010 — Presentation generation architecture | `src/lib/docx/exportBankPresentation.ts`, `exportInvestorPresentation.ts` | Implemented |
| 0011 — Conditional grant exit equity cap | `src/lib/engine/founderWaterfall.ts` | Implemented |
| 0012 — Portfolio OPEX schema | `src/lib/engine/types.ts`, `defaults.ts` | Implemented |
| 0013 — Unified OPEX stress slider | `src/components/BankSensitivityTab.tsx` | Implemented |
| 0014 — Cash reserve covenant before distribution | `src/lib/engine/model.ts`, `src/components/DistributionCovenantBadge.tsx` | Implemented |
| 0015 — Construction VAT cashflow tab | `src/lib/engine/types.ts`, `src/components/ConstructionVatCashflow.tsx` | Implemented |
| 0016a — Grace interest carry | `src/lib/engine/model.ts` (graceInterestCarry), `types.ts` | Implemented |
| 0016b — Tax loss carryforward | `src/lib/engine/model.ts` (LCF re-pass), `types.ts` | Implemented |
| 0017 — Depreciation tax shield | `src/lib/engine/model.ts`, `types.ts`, `capTable.ts` | Implemented |
| 0018 — Suppress grace interest carry from bank view | `src/lib/engine/model.ts` (bank viewMode suppression) | Implemented |
| 0019 — Three-role sponsor return display | `src/components/EytanReturnBreakdown.tsx`, `/admin/cap-table` | Implemented |
| 0020 — Standalone ratchet cap | `src/lib/engine/founderWaterfall.ts` | Implemented |
| 0021 — Optima Bank translation layer | `src/lib/engine/optimaView.ts`, `types.ts` (OptimaLoanParams) | Implemented |
| 0022 — Optima Euribor ratio allocation | `src/lib/engine/model.ts` (optimaScenario), `src/lib/hooks/useEuribor.ts` | Implemented |
| 0023 — Optima two-tab bank view | `src/app/bank/optima/page.tsx` (TabSide A/B) | Implemented |
| 0024 — Virtual CAPEX uplift sensitivity | `src/lib/engine/capexUplift.ts`, `src/components/CapexUpliftControl.tsx` | Implemented |
| 0025 — Bank view sub-project isolation | `/bank/` path isolation via BankControlBar financingPathOverride | Implemented |
| 0026 — Opening year delay 2029 | `src/lib/engine/defaults.ts` (OPENING_YEAR: 2029) | Implemented |
| 0027 — GraceMode construction loan toggle | `types.ts` (GraceMode: 'rolling-cohort'), `model.ts` | Implemented |
| 0028 — OpCo floor subordinated to debt service | `src/lib/engine/model.ts` (opCoFloor applied junior to DS in bank view) | Implemented |
| 0029 — Exit waterfall OpCo fee removal | `src/lib/engine/founderWaterfall.ts` | Implemented |

**ADR-0009 open debt**: Multiple financing params structs still carry `gracePeriodYears` fields marked "Currently inert in engine getDS closures." The engine uses `PROJECT_CONSTANTS.GRACE_END_YEAR` (2028) as the actual grace boundary for all paths except `OptimaLoanParams`. Changing `gracePeriodYears` in the UI has no effect on the model.

---

## 10. Known Debt Register

### .rbac-saved/ — DO NOT DELETE
See §4 above. Full RBAC re-implementation plan in memory file `project_rbac_reimplement_plan.md`.

### TODO / FIXME in source
| Location | Content |
|----------|---------|
| `src/lib/store/modelStore.ts:2681` | `TODO: extend copy-on-load branch with capex sensitivity fields once isForeign can be true` |
| `src/components/InvestorSensitivityTab.tsx:1` | `TODO: add SENSITIVITY_TOUR step for InvestorSensitivityTab (bump storageKey to v3)` |
| `src/lib/excel/exportBP.ts:7` | Note to leave clearly-marked TODO rows when overriding engine values in Excel |
| `src/lib/i18n/he.ts:1658` | `// TODO translate` on a Hebrew string |
| `src/lib/i18n/he.ts:1930–2133` | 30+ keys with value `"TODO"` — untranslated Hebrew strings |

### @deprecated fields still in types.ts (backward-compat retention)
| Field | Status |
|-------|--------|
| `PropertyOpex.maintenance` | @deprecated — replaced by ffeReserveFloor + revenue % schedule |
| `PropertyOpex.managementFee` | @deprecated — removed from OpEx sum; retained for Firestore backward-compat |
| `PropertyConfig.legalFees`, `architectFees`, `civilEngineerFees` | @deprecated — use `licensesPermitsCost` |
| `ModelAssumptions.opCoSeniorFloor` | @deprecated — renamed to `opCoFloor` |
| `OpCoFeeParams.baseFeeRate`, `brandFeeRate` | @deprecated — merged into `baseMgmtFeeRate` |
| `CapTableStakeholder.isCoInvest` | Legacy field, no longer drives engine |

### Inert engine parameter (ADR-0009 debt)
`gracePeriodYears` in `CommercialLoanParams`, `RRFParams`, `TepixLoanFundParams`, `GrantParams` — stored and editable in UI but not read by engine `getDS` closures. Engine uses `PROJECT_CONSTANTS.GRACE_END_YEAR` instead.

---

## 11. Open Questions

1. **gracePeriodYears engine wiring** (ADR-0009 partial): Is the intent to keep `GRACE_END_YEAR` as a permanent shared constant, or should each path's `gracePeriodYears` eventually drive `getDS`?

2. **PDF exports**: `src/lib/pdf/exportInvestorReport.ts` and `src/lib/pdf/exportBankReport.ts` appear possibly dead. Were these superseded by the DOCX exports? Confirm before deleting.

3. **`fr.ts` locale file**: Is French translation planned, or should the forward-compat stub be removed?

4. **`useAuth.ts` wiring**: The RBAC hook in `src/lib/data/useAuth.ts` is live but NOT used by the active `AuthGate.tsx`. Is this intentional until the RBAC re-implementation lands?

5. **`mail` Firestore collection**: `MAIL_COLLECTION = 'mail'` is declared. Is this collection actually written to anywhere? If the email invite flow was never fully implemented, this constant is dead.

6. **Delta 11 grant figure**: Memory notes this as open. Is this a business assumption needing an ADR, or a data entry to propagate into the engine?

7. **`AssumptionsMemoButton` disabled**: Commented out in admin/layout.tsx. Intentional feature disable or oversight? The `/assumptions-memo` route remains live.

8. **`currentVillaActuals.ts` freshness**: When were the historical actuals last updated? Are they truly immutable historical actuals?

9. **`capexAbsorption.ts` test coverage**: No dedicated test file found. Is it covered by the golden snapshot, or untested?

10. **`opCoSeniorDefer2029` toggle**: Described as "UI-only toggle" — verify the engine actually reads and acts on this field.
