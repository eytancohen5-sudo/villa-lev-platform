# /admin/presentation — Banker-Grade Presentation Route

A full-screen, 12-section banker presentation that reads from the same live data layer
as every other admin dashboard page. When the PATH selector switches from Commercial to
Grant, every figure — KPI tiles, table rows, and prose-embedded numbers — updates in
place. The Word export produces a `.docx` that mirrors the on-screen state at the moment
of export.

---

## Architecture

### Data layer (selectors per section)

All data flows from `useModelStore` (`@/lib/store/modelStore`) — the same Zustand store
that powers `/admin/dashboard`, `/admin/pnl`, `/admin/debt-coverage`, and every other
admin route.

| Section | Selectors used |
|---------|---------------|
| Cover | `model.keyMetrics`, `activeScenarioOutput.equityIRR`, `activeScenarioOutput.totalMOIC` |
| §1 Executive Summary | Same as Cover + `assumptions.commercialLoan.gracePeriodYears / repaymentTermYears` |
| §2 Stress-Test Discipline | Prose only — no live numbers |
| §3 The Project | `resolvePortfolio(templates, projects)` → per-plot GIA, units, CAPEX |
| §4 Track Record | `LiveTrackRecord` component (reads `useSeasonSnapshot` internally) |
| §5 Market Context | Static positioning table — no model numbers |
| §6 Financial Projections | `BankPnLSection` component (reads full model internally) |
| §7 Key Risks | `model.keyMetrics.assetCoverage`, `model.keyMetrics.breakEvenNights`, `model.keyMetrics.stabilisedDSCR` |
| §8 Loan Structure | `model.keyMetrics.loanAmount / totalCapex / equityRequired / primaryLoan / supplementaryLoan / grantAmount / portfolioValue` |
| §9 Facility Structure | `assumptions.commercialLoan.interestRate / gracePeriodYears / repaymentTermYears`, static covenant table |
| §10 Governance | Static bio blocks — update in `page.tsx` if team changes |
| §11 Conclusion / Stress Test | `BankStressTest` component + same Cover KPIs |

### Reused components

These are the **same component instances** used on the corresponding admin pages.
No parallel visualisations. Same visual language as the rest of the app.

| Component | Source | Presentation section |
|-----------|--------|---------------------|
| `KPICard`, `SectionHeader` | `@/components/AdminUI` | All KPI tiles |
| `LiveTrackRecord` | `@/components/LiveTrackRecord` | §4 Track Record |
| `BankPnLSection` | `@/components/BankPnLSection` | §6 Financial Projections |
| `BankStressTest` | `@/components/BankStressTest` | §11 Stress Test |

---

## Layout

The presentation uses a **dedicated layout** (`layout.tsx`) that:

- Has no sidebar or admin chrome — bankers see only the presentation content.
- Calls `setViewModeOverride('bank')` on mount and clears it on unmount — so the
  OpCo-subordinated cash waterfall is active for the full presentation session,
  matching what bankers see on `/bank`.
- Mirrors the init pattern of `/pitch/layout.tsx`.

Print CSS (`globals.css` `@media print`):
- `@page { size: A4; margin: 22mm 22mm 24mm 22mm; }` — A4 portrait.
- `.presentation-section { break-before: page; }` — each section starts a new page.
- `.presentation-kpi-row`, `.presentation-table { break-inside: avoid; }` — no split rows.
- Top selector bar is `print:hidden` — does not appear in print or PDF.

---

## Prose

Prose blocks are committed as i18n keys in all four locale files:

```
src/lib/i18n/en.ts   ← English (authoritative)
src/lib/i18n/el.ts   ← Greek
src/lib/i18n/he.ts   ← Hebrew
src/lib/i18n/fr.ts   ← French
```

Key namespace: `presentation.*`

**To update prose:** Edit the key value in `en.ts` (and the other locale files).
Never edit bare JSX strings in `page.tsx` — that would break translations.

**Numbers embedded in prose** are template-bound:
- The page derives them from the store at render time.
- Changing a model assumption (e.g. LTC from 80% → 75%) will update the KPI tiles
  and any derived labels that read from `model.keyMetrics`.
- Pure narrative prose (stress-test philosophy, risk mitigants, governance bios)
  does not contain live numbers and therefore does not need template binding.

---

## Word export

The "Export to Word" button uses the **same `exportBankPresentation` function** that
powers the export button in `BankControlBar.tsx`. The pattern is:

```ts
const { exportBankPresentation } = await import('@/lib/docx/exportBankPresentation');
const blob = await exportBankPresentation(assumptions, model, locale);
URL.createObjectURL(blob) → anchor.click() → URL.revokeObjectURL(url)
```

Filename: `VillaLevGroup_Presentation_{PATH}_{SCENARIO}_{YYYY-MM-DD}.docx`

The export reads the **current selector state** — if the user has Grant + Downside
active when they click Export, the `.docx` reflects those settings because both the
on-screen render and the export function pull from the same `assumptions` and `model`
objects from the store.

---

## OPEX contingency overlay (Phase 3 — Option B)

When `portfolio[0].opexContingencyRate > 0`, a badge appears in §6 above the P&L table:

> OPEX contingency: +X% overlay applied

This is a **display-only overlay**. The engine's base model is not changed. If Eytan
later chooses to make the contingency engine-active (Option A), the `opexContingencyRate`
field already exists on `PropertyConfig` and is passed through `resolvePortfolio` — only
the engine's OPEX calculation needs to consume it.

---

## Tests

Component (DOM) tests: `src/app/admin/presentation/__tests__/page.test.tsx`

Run with:
```bash
npm run test:dom     # DOM tests (jsdom, .test.tsx files)
npm run test:run     # Engine tests (node, .test.ts files — includes all existing tests)
```

The DOM config (`vitest.dom.config.ts`) uses `@vitejs/plugin-react` and `jsdom` and is
deliberately separate from the engine test config to keep the environments isolated.

---

## Adding a new section

1. Add a `<section className="presentation-section ...">` block in `page.tsx`.
2. Pull data from `model.keyMetrics` or `activeScenarioOutput` — never hardcode numbers.
3. Add prose as i18n keys in all four locale files and in `types.ts`.
4. Wrap tables in `<div className="presentation-table">` for print page-break protection.

---

## Known limitations / deferred

- `gracePeriodYears` labelled "engine-inert" in `memory/project_hardcoded_elimination_may26.md` —
  the value displays correctly but does not change engine DSCR calculations. This is
  pre-existing behaviour and is not introduced by this route.
- Governance bios in §10 are static strings in `page.tsx` (not i18n keys). If the team
  changes, edit the `bios` array in `page.tsx` directly. Adding i18n for bios is
  deferred — the strings are long and change rarely.
- The Word export currently calls `exportBankPresentation` which was built for the
  `/bank` view. A future iteration can extend it with presentation-specific sections
  (risk register table, governance bios, facility structure term sheet).
