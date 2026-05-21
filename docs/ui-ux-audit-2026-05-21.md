# UI/UX audit — Villa Lev platform — 2026-05-21

Heuristic, read-only review of `villa-lev-platform/src/app/`. No code run, reasoning is from source. Findings tagged **critical** (banker would notice, trust risk), **important** (blocks daily admin use), **polish** (rough but non-blocking).

---

## 1. `investor/page.tsx` — banker-facing

Single-column scroll: hero KPIs → capital structure + stabilised → revenue/EBITDA → DSCR → financing-path table → all-paths DSCR → collateral → footer.

- **critical** — *No DSCR/IRR in the hero.* First viewport answers "how big is the loan" but not "does it pay". Stabilised DSCR — the single most important credit-committee number — is buried 2 scrolls down inside the right-column metric list. Add it as a 5th hero tile.
- **critical** — *Hero KPI duplication.* The LTV tile uses `formatMultiple(km.assetCoverage)` as its sublabel; the very next tile, Asset Coverage, *uses the same value* as its headline. A credit officer reads `x.xx×` twice in adjacent tiles with no visible reason.
- **important** — *Print path is opaque.* `window.print()` with only ad-hoc `print:hidden` classes; no print-specific layout for recharts SVGs. If a banker prints to PDF and gets clipped charts, trust is gone. Untested.
- **important** — *Color advocacy in financing-path table.* Grant column is `text-positive` (green) and TEPIX column is purple (`#7B5EA7`) via inline style. Reads as bias toward TEPIX/Grant before the reader has decided. Either drop the colors or wrap in a legend "highlighted = active path".
- **important** — *Emoji button glyphs.* `⬇` and `🖨` on CTAs — render inconsistently on Windows GDI used at Greek banks. Replace with inline SVG.
- **polish** — DSCR covenant line is hardcoded `1.25` (line 282); should pull from `assumptions.dscrCovenantThreshold`.

---

## 2. `pitch/page.tsx` — investor pitch

11 snap slides + sticky control bar.

- **critical** — *Hardcoded historical revenue.* `VILLA_LEV_HISTORY = [116, 165, 185, 298, 500]` (lines 29-35) is a literal in the page. 2026 is marked projected at €500K. Everywhere else (dashboard, conservatism check) sources current-year revenue from `useSeasonSnapshot()`. A banker who cross-checks will find the pitch and the dashboard disagreeing. **Biggest banker-trust risk on the platform.**
- **important** — *Scenario toggle exposed to investor.* Sticky bar lets the reader flip Realistic → Upside mid-pitch. No persistent "You're viewing: Realistic" indicator beyond a small pill. Banker can read Upside numbers as the base case. Default-lock to Realistic on the investor URL; require explicit toggle.
- **important** — *Heatmap blended-ADR baseline is hardcoded €3,500* (line 207). If model ADR drifts to €3,400 or €3,800 the heatmap's directional scaling silently misaligns. Compute from `stab`.
- **important** — *Brand-logo link goes to `/`.* Click the "Villa Lev Group" name 7 slides deep and you're on the marketing root with no confirmation. Should scroll-to-top.
- **polish** — Market hero (`4.6×`, `+12.5%`, `37,000`, `171,500`, `−2.7%`, `+3.6%`) all hardcoded JSX. Hoist to `marketData.ts`.
- **polish** — RTL Hebrew flip of the heatmap (line 743, `inline-block` rows) not visually verified.

---

## 3. `admin/dashboard/page.tsx` — Eytan's landing (1458 lines)

Term sheet → Conservatism Check → Deal Snapshot → DSCR hero → Coverage → Operating → Returns → Founder Waterfall → Capital → Working Capital → Collateral → P&L Summary → Sensitivity.

- **critical** — *Section ordering buries the credit narrative.* Conservatism Check sits in slot 2, ahead of the KPI headline. Reads as defensive ("look, we're not lying") instead of as supporting evidence. Move Conservatism after Returns. Then it lands as proof, not pre-emptive defence.
- **important** — *12+ sections, no jump-nav.* Every section has `id="section-..."` + `scroll-mt-24` (intent for anchors) but no UI exposes them. Add a floating ToC or sticky chip-row.
- **important** — *Hardcoded English in waterfall + term-sheet sections.* Term sheet labels (`Loan`, `Term · grace`, `Rate`, `Annual DS`, `DSCR covenant`, `Equity required` — lines 437-468), founder-waterfall section (lines 928-1003: `Pari-passu`, `Grant bonus`, `Performance ratchet`, `Founder ManCo fee`, `Consultant payment at grant approval`). Greek/French/Hebrew users see English mid-page.
- **important** — *Tone overflow.* When the model is healthy, 4/5 Coverage tiles are green; when stressed, multiple flip warning simultaneously. Hard to triage worst issue. Add a single section-header status chip (Pass/Caution/Fail) with per-tile color only for the worst violation.
- **polish** — Drift alert (line 354) has no positive counterpart — asymmetric.

---

## 4. `admin/assumptions/page.tsx` — model editor (1785 lines)

- **important** — *`EditableCell` uses `bg-blue-50` / `border-blue-300`* (lines 49, 78). Off-palette — everywhere else is warm earth (gold, olive, terracotta). Reads as "internal tool", not "platform". Replace with brand tints.
- **important** — *No commit feedback.* Setting an assumption fires `setAssumption()` on blur; engine recomputes (`computeTimeMs` updates in sidebar) but the cell itself gives no acknowledgement. Add a checkmark or border-pulse on commit.
- **important** — *Hardcoded English:* `Remove`, `Built-in`, `Custom`, `Template`, `Units`, `Mixed`, `Villa`, `Suite`, `Used in N projects`.
- **polish** — `animate-pulse` ring on highlighted templates (line 248) — should flash + fade, not persist.
- **polish** — `bg-emerald-50/40` on room-name input — off-palette.

---

## 5. `admin/opco-split/page.tsx` — new chart today (1023 lines)

- **important** — *Zero `t(...)` calls in the page.* `useTranslation()` is consumed for `locale` only. Every label is hardcoded English. Worst-localized page.
- **important** — *Toggle gates ~60% of the page.* When Split OFF the fee waterfall, year-by-year, and chart disappear (line 270 onward). First-time visitor sees ~400 lines and may not realize the meat is hidden. Render greyed-out "Preview" state instead of empty.
- **important** — *New stacked-bar chart palette collision.* Base fee `#C4A55E` and Brand fee `#8B6914` are both golds, visually close. On a stack the brand layer reads as darker continuation, not separate. Use olive / terracotta / dark gold or rotate brand to steel-blue.
- **important** — *`Stabilised year 2031` hardcoded* in multiple section headers (lines 280, 341, 413). If engine ramp shifts, strings drift.
- **polish** — Closing "Tip" paragraph (line 578) is the only `text-xs` body copy on the page; tonal break with the rest.

---

## 6. `admin/sensitivity/page.tsx` — tornado + sweeps

- **important** — *Tornado bars use `max(${pct}%, 2px)` minimum.* For inputs with near-zero swing on one side, the 2px stub visually exaggerates "this matters a tiny bit". Truly-zero should show no bar.
- **polish** — Variation labels (`−10%`, `−100bp`, `−5pp`, `−2y`) are inline strings; not i18n-able.

---

## 7. `admin/breakeven/page.tsx`

- **important** — *Break-even cells round via `Math.ceil`.* By construction the "BE" cells display `1.01×` rather than `1.00×` (comment at line 192 acknowledges). Banker spotting "1.01×" in a column labeled "break-even" will ask why. Round half-up, or relabel.
- **polish** — Heatmap legend bands may differ from the pitch-page heatmap. Cross-check.

---

## 8. `admin/pnl/page.tsx`

- **important** — *Table is 11 years wide.* On a 13" MacBook (1280px) with 224px sidebar it horizontally scrolls. Sticky-left first column is implemented, but a banker viewing on a small laptop sees scroll-fatigue.
- **polish** — `Founder ManCo fee`, `Consultant payment (Layer B, grant approval)`, `Distributable to equity` — hardcoded English in a banker-readable page (lines 123-145).
- **polish** — Phase-band color on year headers (`border-earth-terracotta/60` etc.) only on the top edge. A column tint would reinforce phase grouping.

---

## 9. `admin/cap-table/page.tsx`

- **important** — *Entire page is hardcoded English.* `useTranslation()` is called for `locale` only — `t` never used. Stakeholder rows, layer labels, cap labels all in English.
- **polish** — `Redacted view ON` / `Generate investor report` is one button (line 186) that flips its label by state. Confusing affordance — split into toggle + download.
- **polish** — Reconciliation health row uses `font-mono` for a status string; mono is the platform's "numeric value" signal.

---

## Top 5 fixes worth doing this week

1. **Replace hardcoded `VILLA_LEV_HISTORY` in `pitch/page.tsx` with `useSeasonSnapshot()` / `currentVillaActuals.ts`.** Highest banker-trust risk. ~2 hrs.
2. **Add Stabilised DSCR to the investor-page hero.** Lifts the credit-committee headline above the fold. ~30 min.
3. **Reorder dashboard: move Conservatism Check after Returns.** Strongest credibility move lands as proof, not pre-emptive defence. ~1 hr.
4. **Translate opco-split, cap-table, dashboard term-sheet + waterfall, and assumptions chrome.** Greek/Hebrew users today see English mid-page. ~4-6 hrs, mechanical.
5. **Default-lock investor pages to Realistic + add persistent "Realistic" badge to pitch sticky bar.** Stops a banker accidentally reading Upside as base. ~1 hr.

## Patterns to standardize

- **KPI tile.** Today: `KPICard` (3 variants across dashboard/pnl/opco), `HeroKPI`, `HeroStat`, `Stat`. Hoist one `<KPITile size="hero|default|compact">` to `src/components/`.
- **Chart palette.** Pull all recharts fills from named tokens — today 8+ unique hex colors are inline. Define `--brand-gold` `#8B6914`, `--olive` `#6B7A3D`, `--steel-blue` `#4A6A8B`, `--positive` `#4A7C3F`, `--warning` `#9E3B3B`, `--neutral` `#C4A55E`.
- **DSCR covenant.** Read from `assumptions.dscrCovenantThreshold`, never literal `1.25` (currently hardcoded in investor, pitch ×3, dashboard hero, breakeven heatmap).
- **CTA buttons.** No emoji glyphs. Inline SVG icons or unicode arrows.
- **Editable cell.** One component, brand-tinted, with on-commit feedback. Today: blue-tinted in assumptions, unbordered in control-bar, `RateInput` is a third style on opco-split.
- **Section header.** One `<SectionHeader>` component (dashboard's version is the strongest; opco-split inline `<h2>` and assumptions own version diverge).
- **i18n discipline.** Lint rule: JSX string literals >1 word with a letter must be `t(...)`. The convention exists but has eroded on the newer pages (opco-split, cap-table, dashboard waterfall).
