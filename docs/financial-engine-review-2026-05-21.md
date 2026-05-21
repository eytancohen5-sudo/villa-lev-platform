# Financial engine review — villa-lev-platform — 2026-05-21

**Status:** interim findings from a read-only planner pass. Not exhaustive — three concrete defects surfaced; a deeper audit is still to-do.

## Findings

### F1. TEPIX duration drift — engine models a 14y loan, program caps at 12y

- **Where:** [`src/lib/engine/defaults.ts:440`](villa-lev-platform/src/lib/engine/defaults.ts:440) sets `totalTermYears: 14`.
- **Conflict with:** [`tepix/milestones.yaml:43-44`](tepix/milestones.yaml:43) — TEPIX III investment-loan duration is **5–12 years**.
- **Why it matters:** the engine is amortising a TEPIX III loan over a duration that violates the cited program rule. A banker opening the BP will catch this within the first few pages — credibility hit before they get to the strategy section.
- **Decision needed from Eytan:** drop `totalTermYears` to **12** (max allowed) or to a more conservative figure. Re-run the engine and verify DSCR / IRR still clear the threshold under the shorter term.

### F2. CIT double-counts debt service as deductible

- **Where:** [`src/lib/engine/model.ts:642`](villa-lev-platform/src/lib/engine/model.ts:642) — `taxableProfit = max(0, ebitda - ds)` where `ds` is total debt service (interest + principal).
- **The defect:** under Greek (and standard) CIT, **only interest is deductible**, not principal repayment. The engine is treating the full DS as a tax shield, which understates tax expense and overstates after-tax cash.
- **Why it matters:** every cash-on-cash and equity-IRR number in the BP is biased upward. The size of the error scales with how much principal is being repaid each year — meaningful by Year 3+ once grace ends.
- **Decision needed:** confirm the accounting treatment with Eytan's tax advisor, then split `ds` into interest (deductible) vs. principal (not) inside the taxable-profit line.

### F3. DSCR floor measured outside the bank's actual covenant window

- **Where:** [`model.ts:776-781`](villa-lev-platform/src/lib/engine/model.ts:776) — `minDSCRLoanLife` excludes 2029–2030 ("ramp years").
- **Conflict with:** the commercial-loan amortisation schedule begins in **2029** (`buildAmortSchedule`, `graceEndYear=2028`).
- **Why it matters:** bank covenants test DSCR from day-1-of-amortisation, not from when "ramp" subjectively ends. The engine's `minDSCRLoanLife` is currently reporting a flattering minimum that the bank will not honour. If a banker computes their own DSCR they'll get a lower number than the BP shows.
- **Decision needed:** redefine the DSCR-floor window to start at `graceEndYear + 1` (i.e. 2029), not 2031.

## What's NOT in this review yet

This was a first-pass surface scan. The planner explicitly did not cover:

- Engine `ModelOutput` shape mapped against the BP xlsx output cells (drift check).
- Defaults sanity (ADR / occupancy / opex / capex per villa).
- TEPIX financing-path structural verification (40% HDB interest-free, 5% island subsidy, 24m grace) — only the duration was checked.
- Sensitivity-range adequacy and tornado-chart variables that flip DSCR < 1.0.
- Edge cases at occupancy = 0% / 100% / Year 1 ramp / exit-year terminal value.
- NaN / divide-by-zero guards.

A second pass should cover these before the BP is treated as audit-ready.

## Recommended order of action

1. **F1 first** — single-line default change in `defaults.ts`, but every downstream number in v5 BP shifts. Steward needs to re-export.
2. **F2 second** — accounting correction. Needs tax advisor confirmation before changing the formula.
3. **F3 third** — DSCR window redefinition. Safe to change without external confirmation.
4. Then run the second-pass review.
