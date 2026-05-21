# Perf audit — villa-lev-platform — 2026-05-21

## 1. Stack baseline

- Next **16.2.2**, React **19.2.4**, Tailwind **4**, TypeScript **5**, Zustand **5.0.12**.
- `next.config.ts`: `output: "export"`, `images.unoptimized: true`. **No** `experimental.optimizePackageImports`, no `modularizeImports`, no bundle analyzer wired.
- `package.json` heavy deps: `recharts ^3.8.1` (~150KB gz), `exceljs ^4.4.0` (~250KB gz), `jspdf ^4.2.1` + `jspdf-autotable ^5.0.7` (~120KB gz), `firebase ^12.13.0` (~110KB gz for Firestore alone).
- Three Google fonts loaded in `app/layout.tsx`: DM Serif Display + Inter (latin + greek + latin-ext subsets) + JetBrains Mono.
- Static export → no SSR, no RSC server-component perf wins available, no edge runtime, no `revalidate`.

## 2. Suspect hotspots

**H1. Recharts in 4 main pages, eagerly imported.** `dashboard/page.tsx`, `breakeven/page.tsx`, `investor/page.tsx`, `pitch/page.tsx` all `import { AreaChart, … } from "recharts"` at module top. Recharts has no tree-shake-friendly subpath entry points by default; barrel re-exports drag in the entire library. First-render JS for the dashboard route likely carries ~150KB gz of recharts even before the user looks at a chart.

**H2. Sensitivity page recomputes the model ~24 times per render.** `src/app/admin/sensitivity/page.tsx` calls `computeModel(...)` at lines 46, 130, 131, 215, 238, 260, 284, 307 (some inside `.map`). Each `computeModel` runs the full engine (`src/lib/engine/model.ts`, 1,106 lines). The page does wrap with `useMemo` (line 8), but its dep is `assumptions` which the unselected `useModelStore()` returns by reference. Verify the memo actually short-circuits across unrelated state mutations.

**H3. `useModelStore()` called with no selector everywhere.** Every page (`dashboard:146`, `pnl:32`, `pitch:155`, `cap-table:72`, `opco-split:115`, `assumptions:212/696/899/1584`, `admin/layout:177`) calls `useModelStore()` and destructures. With Zustand 5, that subscribes to the whole store — any mutation (including unrelated ones like `nameModalOpen` toggling, save-modal counters, history pushes) rerenders every page in the tree. Audit logs show `bumpEditCounter` writes to history on every keystroke; in the assumptions page that's a global rerender per character.

**H4. The assumptions page is one 1,692-line client component.** `src/app/admin/assumptions/page.tsx` is `"use client"`, holds the full templates + projects + history + cap-table editing surface, and reuses the same `useModelStore()` non-selector pattern in 9 nested components (lines 115, 143, 212, 573, 591, 612, 653, 696, 817, 899, 1455, 1584). Edit one field → rerender all 9.

**H5. All 4 locale dictionaries shipped to every visitor.** `src/lib/i18n/index.ts` statically imports `en`, `fr`, `el`, `he`. Each i18n file is ~400 string keys. Only one locale is in use at any moment.

**H6. `model.ts` `JSON.parse(JSON.stringify(...))` cloning.** Sensitivity uses `clone<T>(x) = JSON.parse(JSON.stringify(x))` (line 41) before every `computeModel` call. `modelStore.saveConfig` / `updateConfig` / `loadConfig` also use it. Cheap on small objects, but called per-variation per-render in sensitivity. Worth profiling.

**H7. Three Google fonts, three subsets.** `app/layout.tsx` loads DM Serif Display + Inter (`["latin", "greek"]`) + JetBrains Mono. Display: swap is good, but four font files + variants on every cold load is meaningful for Mobile-3G first paint.

**H8. exceljs static import inside `lib/excel/exportBP.ts`.** Callers (`investor/page.tsx:40`, `dashboard/page.tsx:391`) lazy-import the module — correct. But verify no other file pulls `exportBP` statically; if so the entire exceljs blob lands in the main bundle.

## 3. Measurement gaps

**There is no instrumentation today.** No bundle analyzer, no Lighthouse CI, no `web-vitals`, no Sentry. The engine reports `computeTimeMs` on `ModelOutput` and displays it in the admin sidebar (`admin/layout.tsx:266`) — that's the only perf signal in production.

**Minimum viable setup:**
- Add `@next/bundle-analyzer` (dev-dep, gated behind `ANALYZE=true`). One-time setup; run quarterly.
- Add `web-vitals` (~2KB) → log CLS / LCP / INP to `console` in dev, optionally to Firestore `perfMetrics/` in prod. Static export friendly.
- Skip Sentry until we have a real user complaint — it's overkill for a single-operator app.

## 4. Ranked recommendations

| # | What | Where | Expected impact | Effort | Risk |
|---|------|-------|-----------------|--------|------|
| 1 | Wire `@next/bundle-analyzer`, snapshot route sizes | `next.config.ts` + `package.json` | Visibility — required before any other guess is trusted | S | None |
| 2 | Use Zustand selectors everywhere (`useModelStore(s => s.model)` etc.) + replace `useModel()` passthrough in `hooks/useModel.ts` | All 14 page.tsx + `assumptions/page.tsx` nested components | Fewer rerenders on every keystroke & modal toggle; assumptions page should stop re-rendering during typing | M | Low — mechanical, covered by Vitest |
| 3 | Lazy-load recharts on the 4 chart pages via `next/dynamic` with `{ ssr: false }` (already client-only, so just defers) | `dashboard`, `breakeven`, `investor`, `pitch` pages | ~150KB gz off initial JS for any first-page that isn't a chart page (admin sidebar lands on dashboard, so factor in lazy hydration) | M | Low — charts already hydrate client-side |
| 4 | Memoise sensitivity's tornado + heatmap computations against a deep-equal key, or move them to a Web Worker | `admin/sensitivity/page.tsx` | Sensitivity page snappiness; current ~24 `computeModel` calls per render | M | Worker introduces serialization overhead — measure before committing |
| 5 | Dynamic-import locale dictionaries (`await import('./fr')`) inside `I18nProvider` based on selected locale, ship only `en` in initial bundle | `lib/i18n/I18nProvider.tsx`, `lib/i18n/index.ts` | ~3 of 4 dictionaries off the critical path | S | Low — `t()` becomes async-suspending; need Suspense boundary or pre-warm |

## 5. What NOT to do

- **Do not add `'use server'` files.** Static export strips them at build. They silently no-op.
- **Do not convert pages to Server Components to "skip hydration".** Same reason — no server. Every page must hydrate.
- **Do not enable `next/image` optimization.** `images.unoptimized: true` is required by `output: "export"`. Re-enabling will break the build.
- **Do not move Firestore reads to an edge runtime / route handler.** No runtime exists at deploy. All reads stay in the client SDK; only optimisation is collection scoping in `firestore.rules` and `onSnapshot` deduping (already done in `useSeasonSnapshot.ts`).
- **Do not aggressively `React.memo` everything before measuring.** With Zustand selectors fixed (rec #2), most re-renders disappear without memo overhead.
- **Do not preload all four locale dictionaries "for speed".** That's the bug; rec #5 fixes it.
- **Do not introduce middleware.** Strip-at-build in static export.

## 6. Suggested order of execution

#1 (analyzer) → measure → then #2 (selectors, cheap & broad win) → re-measure → then pick #3 or #4 based on what the numbers say. #5 is opportunistic; do it whenever a locale-dictionary file grows.

## 7. Open questions for Eytan

- **OQ1.** Observed user-facing latency events (you or a banker reviewer hitting "the app feels slow on this page"), or prophylactic? Affects whether `web-vitals` lands in this round or defers.
- **OQ2.** Is Mobile-3G first-paint a real case? If audience is you + bankers on desktop fibre, font work (H7) drops in priority and rec #5 (locales) is mostly aesthetic.
- **OQ3.** Risk on rec #4 — Web Worker for sensitivity adds serialization overhead. Plain memoisation may be enough; we should measure before picking the worker path.
