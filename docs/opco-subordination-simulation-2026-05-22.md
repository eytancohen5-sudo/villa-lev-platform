# OpCo subordination simulation (Option 1) — 2026-05-22

Comparison of the financial-engine cash waterfall before and after Option 1: OpCo subordinated to bank debt service. Per Eytan's decision today, bankers reject the legacy model where OpCo fees are deducted from EBITDA before DSCR. The fix: bank gets paid first, OpCo paid out of residual cash, DSCR numerator is `ebitdaPreOpCo`.

## Cash waterfall change

**Before (Eng v current pre-2026-05-21):**
```
totalRevenue → totalOpex → ebitdaPreOpCo → opCoFees → ebitda → debtService → ncf
                                                     ↑
                                           DSCR = ebitda / ds
```

**After (Eng v current 2026-05-22, this commit):**
```
totalRevenue → totalOpex → ebitdaPreOpCo → debtService → residual → opCoActuallyPaid → ncf
                                          ↑
                            DSCR = ebitdaPreOpCo / ds
```

Where `opCoActuallyPaid = min(opCoTotalFeeCalculated, max(0, ebitdaPreOpCo − debtService))`. If residual cash is less than the calculated OpCo fee, only the residual is paid this year. **No accrual/carryover** for unpaid OpCo — the shortfall is forfeit (TODO marked in `model.ts` for proper deferral tracking later).

## Sanity check: OpCo disabled

**PASS** — `opCoFee.enabled === false` (the default in `BASE_CASE`): legacy and new outputs are identical on every metric (stabDSCR, NCF, EBITDA, CFADS, OpCo paid, founder take, investor take, equity IRR), across all 4 financing paths × 3 scenarios.

This confirms the change is a structural no-op when OpCo is disabled — which is why the golden snapshot at `src/lib/engine/__tests__/model.golden.test.snap` did not need regeneration (vitest run: 45/45 pass, no snapshot drift).

## OpCo-enabled comparison — Realistic scenario

OpCo fees configured per `BASE_CASE.opCoFee` (baseFeeRate=3%, brandFeeRate=2%, incentiveFeeRate=10%, ownerPriorityReturn=8%), with `enabled = true` overlaid for this simulation.

### Stabilised DSCR (2031)

| Path | Legacy (ebitda/ds) | New (ebitdaPreOpCo/ds) | Δ |
| --- | ---: | ---: | ---: |
| commercial | 1.783 | 2.087 | +0.304 |
| tepix-loan | 1.398 | 1.645 | +0.247 |
| grant | 3.161 | 3.717 | +0.556 |
| rrf | 1.687 | 1.970 | +0.282 |

### Min DSCR (loan life, 2029-2036)

| Path | Legacy | New | Δ |
| --- | ---: | ---: | ---: |
| commercial | 1.484 | 1.736 | +0.252 |
| tepix-loan | 1.164 | 1.370 | +0.205 |
| grant | 2.612 | 3.073 | +0.461 |
| rrf | 1.407 | 1.640 | +0.233 |

### Stabilised NCF post-VAT (2031, what equity receives that year)

| Path | Legacy | New | Δ |
| --- | ---: | ---: | ---: |
| commercial | €108,880 | €108,880 | €0 |
| tepix-loan | -€4,411 | -€4,411 | €0 |
| grant | €267,807 | €267,807 | €0 |
| rrf | €68,537 | €68,537 | €0 |

### Equity IRR (post-subordination, to exit year)

| Path | Legacy | New | Δ |
| --- | ---: | ---: | ---: |
| commercial | 22.01% | 22.01% | 0.00pp |
| tepix-loan | 24.63% | 24.88% | +0.25pp |
| grant | 35.20% | 35.20% | 0.00pp |
| rrf | 18.21% | 18.21% | 0.00pp |

### Founder cumulative cash take (cap-table-derived)

| Path | Legacy | New | Δ |
| --- | ---: | ---: | ---: |
| commercial | €3,154,690 | €3,154,690 | €0 |
| tepix-loan | €3,060,594 | €3,060,594 | €0 |
| grant | €4,304,909 | €4,304,909 | €0 |
| rrf | €2,957,477 | €2,957,477 | €0 |

### OpCo cumulative paid (2028-2036)

| Path | Legacy (gross, no cap) | New (post subordination cap) | Δ |
| --- | ---: | ---: | ---: |
| commercial | €1,093,241 | €1,093,241 | €0 |
| tepix-loan | €1,121,374 | €1,093,793 | -€27,581 |
| grant | €1,124,858 | €1,124,858 | €0 |
| rrf | €1,074,459 | €1,074,459 | €0 |

## Per-year drill — Realistic / tepix-loan

| Year | ebitdaPreOpCo | DS | Legacy ebitda | Legacy DSCR | Legacy NCF | New ebitda | New DSCR | New NCF | OpCo gross | OpCo paid |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026 | €0 | €31,804 | €0 | 0.000 | -€31,804 | €0 | 0.000 | -€31,804 | €0 | €0 |
| 2027 | -€1,250 | €31,804 | -€1,250 | -0.039 | -€33,054 | -€1,250 | -0.039 | -€33,054 | €0 | €0 |
| 2028 | €555,313 | €498,788 | €471,207 | 0.945 | -€27,581 | €498,788 | 1.113 | €0 | €84,106 | €56,525 |
| 2029 | €683,108 | €498,788 | €580,649 | 1.164 | €81,862 | €580,649 | 1.370 | €81,862 | €102,459 | €102,459 |
| 2030 | €794,285 | €498,788 | €675,527 | 1.354 | €176,740 | €675,527 | 1.592 | €176,740 | €118,758 | €118,758 |
| 2031 | €820,520 | €498,788 | €697,525 | 1.398 | €198,737 | €697,525 | 1.645 | €198,737 | €122,995 | €122,995 |
| 2032 | €860,923 | €498,788 | €732,249 | 1.468 | €233,461 | €732,249 | 1.726 | €233,461 | €128,674 | €128,674 |
| 2033 | €902,323 | €498,788 | €767,844 | 1.539 | €269,056 | €767,844 | 1.809 | €269,056 | €134,479 | €134,479 |
| 2034 | €932,743 | €498,788 | €793,853 | 1.592 | €295,065 | €793,853 | 1.870 | €295,065 | €138,890 | €138,890 |
| 2035 | €963,163 | €498,788 | €819,862 | 1.644 | €321,075 | €819,862 | 1.931 | €321,075 | €143,301 | €143,301 |
| 2036 | €993,583 | €498,788 | €845,871 | 1.696 | €347,084 | €845,871 | 1.992 | €347,084 | €147,712 | €147,712 |

## Per-year drill — Realistic / commercial

| Year | ebitdaPreOpCo | DS | Legacy ebitda | Legacy DSCR | Legacy NCF | New ebitda | New DSCR | New NCF | OpCo gross | OpCo paid |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026 | €0 | €43,200 | €0 | 0.000 | -€43,200 | €0 | 0.000 | -€43,200 | €0 | €0 |
| 2027 | -€1,250 | €94,300 | -€1,250 | -0.013 | -€95,550 | -€1,250 | -0.013 | -€95,550 | €0 | €0 |
| 2028 | €555,313 | €184,600 | €474,626 | 2.571 | €290,026 | €474,626 | 3.008 | €290,026 | €80,687 | €80,687 |
| 2029 | €683,108 | €393,461 | €584,068 | 1.484 | €190,607 | €584,068 | 1.736 | €190,607 | €99,040 | €99,040 |
| 2030 | €794,285 | €393,461 | €678,946 | 1.726 | €285,485 | €678,946 | 2.019 | €285,485 | €115,339 | €115,339 |
| 2031 | €821,007 | €393,461 | €701,382 | 1.783 | €307,921 | €701,382 | 2.087 | €307,921 | €119,625 | €119,625 |
| 2032 | €864,294 | €393,461 | €738,702 | 1.877 | €345,241 | €738,702 | 2.197 | €345,241 | €125,592 | €125,592 |
| 2033 | €907,948 | €393,461 | €776,325 | 1.973 | €382,865 | €776,325 | 2.308 | €382,865 | €131,623 | €131,623 |
| 2034 | €938,368 | €393,461 | €802,334 | 2.039 | €408,874 | €802,334 | 2.385 | €408,874 | €136,034 | €136,034 |
| 2035 | €968,788 | €393,461 | €828,343 | 2.105 | €434,883 | €828,343 | 2.462 | €434,883 | €140,445 | €140,445 |
| 2036 | €999,208 | €393,461 | €854,353 | 2.171 | €460,892 | €854,353 | 2.540 | €460,892 | €144,856 | €144,856 |

## OpCo-enabled comparison — Downside scenario (stress)

Downside applies `-10% occupancy, -5% ADR, events=4`. This is where the subordination cap matters most — residual after DS shrinks, so OpCo paid drops below the gross calculated fee.

### Stabilised DSCR — Downside

| Path | Legacy | New | Δ |
| --- | ---: | ---: | ---: |
| commercial | 1.396 | 1.638 | +0.242 |
| tepix-loan | 1.094 | 1.292 | +0.197 |
| grant | 2.466 | 2.910 | +0.444 |
| rrf | 1.323 | 1.547 | +0.223 |

### Stabilised NCF post-VAT — Downside

| Path | Legacy | New | Δ |
| --- | ---: | ---: | ---: |
| commercial | €2,051 | €2,051 | €0 |
| tepix-loan | -€110,898 | -€110,898 | €0 |
| grant | €159,154 | €159,154 | €0 |
| rrf | -€37,950 | -€37,950 | €0 |

### OpCo paid cumulative — Downside (shows subordination clip)

| Path | Legacy (gross) | New (capped) | Δ |
| --- | ---: | ---: | ---: |
| commercial | €871,394 | €871,394 | €0 |
| tepix-loan | €902,129 | €787,316 | -€114,813 |
| grant | €908,415 | €908,415 | €0 |
| rrf | €853,176 | €853,176 | €0 |

## Downstream consumers touched

- `model.ts:629-707` — cash-waterfall block rewritten (see commit). `ebitda`, `ncf`, `cit`, `cfads`, `dscr`, `dscrLoaded` all re-anchored to `ebitdaPreOpCo`. `opCoTotalFee` reported in AnnualPnL switched to `opCoActuallyPaid` (post-cap) so `equityIRRPreOpCo`'s add-back stays correct.
- No UI-side consumer of `ebitda` or `cfads` was touched. The `ebitda` field still represents "post-fee EBITDA the company keeps" (choice 4a in the plan) — downstream dashboards (`/admin/dashboard`, `/admin/sensitivity`, `/pitch`) consume it as before with no semantic change.
- `founderWaterfall.ts` already reads `netCashFlowPostVAT` (not `ebitda` directly), so no patch needed — it now sees the new NCF naturally.

## Status

- `npx tsc --noEmit`: clean.
- `npx vitest run`: 45/45 pass, snapshot unchanged (no-op when OpCo disabled).
- `npx tsx scripts/simulate-fee-cleanup.ts`: identical numbers to pre-change (sanity check passed).
- `npx tsx scripts/simulate-opco-subordination.ts`: this report.

**Ready for Eytan to review.**
