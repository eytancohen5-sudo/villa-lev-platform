# Founder/OpCo fee cleanup simulation — 2026-05-22

Side-by-side comparison: **Baseline** (BASE_CASE as-is) vs **Option A** (opCoFee.brandFeeRate=0, opCoFee.ownerPriorityReturnRate=0, founder Layer B grant bonus pathway zeroed by setting founderFeePct = consultantSharePct = 5%).

**Important context:** `BASE_CASE.opCoFee.enabled === false`. The OpCo brand fee and owner priority return are *defined but not applied* in the engine today (`model.ts:516-518`). Zeroing them therefore has no effect on `computeModel`-derived metrics. The Layer B grant-bonus change does affect `computeCapTable` outputs (founder take, founder %), and only on the `grant` financing path (other paths have `grantApproved = false`).

## Realistic-scenario summary (one row per path)

| Path | stabDSCR Δ | equityIRR Δ | projectIRR Δ | founder cash Δ | investor cash Δ | founder % Δ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| commercial | 0.000 | 0.00pp | 0.00pp | €0 | €0 | 0.00pp |
| tepix-loan | 0.000 | 0.00pp | 0.00pp | €0 | €0 | 0.00pp |
| grant | 0.000 | 0.00pp | 0.00pp | -€374,673 | +€374,673 | -3.13pp |
| rrf | 0.000 | 0.00pp | 0.00pp | €0 | €0 | 0.00pp |

Script: `scripts/simulate-fee-cleanup.ts` — re-run via `npx tsx scripts/simulate-fee-cleanup.ts`.

No NaN / unexpected-negative values surfaced.

## Scenario: realistic

### stabDSCR

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 2.097 | 2.097 | 0.000 |
| tepix-loan | 1.645 | 1.645 | 0.000 |
| grant | 3.717 | 3.717 | 0.000 |
| rrf | 1.977 | 1.977 | 0.000 |

### minDSCR (loan life)

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 1.736 | 1.736 | 0.000 |
| tepix-loan | 1.370 | 1.370 | 0.000 |
| grant | 3.075 | 3.075 | 0.000 |
| rrf | 1.640 | 1.640 | 0.000 |

### Stabilised NCF (post-VAT)

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | €205,440 | €205,440 | €0 |
| tepix-loan | €91,526 | €91,526 | €0 |
| grant | €364,182 | €364,182 | €0 |
| rrf | €162,795 | €162,795 | €0 |

### Equity IRR

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 26.25% | 26.25% | 0.00pp |
| tepix-loan | 30.16% | 30.16% | 0.00pp |
| grant | 39.84% | 39.84% | 0.00pp |
| rrf | 22.26% | 22.26% | 0.00pp |

### Project IRR

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 13.79% | 13.79% | 0.00pp |
| tepix-loan | 13.86% | 13.86% | 0.00pp |
| grant | 13.66% | 13.66% | 0.00pp |
| rrf | 10.75% | 10.75% | 0.00pp |

### LLCR

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 1.760 | 1.760 | 0.000 |
| tepix-loan | 1.339 | 1.339 | 0.000 |
| grant | 3.063 | 3.063 | 0.000 |
| rrf | 1.631 | 1.631 | 0.000 |

### Founder cumulative cash

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | €4,109,063 | €4,109,063 | €0 |
| tepix-loan | €3,929,590 | €3,929,590 | €0 |
| grant | €6,560,078 | €6,185,405 | -€374,673 |
| rrf | €3,881,185 | €3,881,185 | €0 |

### Investor cumulative cash

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | €5,768,760 | €5,768,760 | €0 |
| tepix-loan | €5,516,796 | €5,516,796 | €0 |
| grant | €5,427,404 | €5,802,077 | +€374,673 |
| rrf | €5,448,840 | €5,448,840 | €0 |

### Founder total %

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 41.60% | 41.60% | 0.00pp |
| tepix-loan | 41.60% | 41.60% | 0.00pp |
| grant | 54.72% | 51.60% | -3.13pp |
| rrf | 41.60% | 41.60% | 0.00pp |

## Scenario: upside

### stabDSCR

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 2.847 | 2.847 | 0.000 |
| tepix-loan | 2.246 | 2.246 | 0.000 |
| grant | 5.040 | 5.040 | 0.000 |
| rrf | 2.689 | 2.689 | 0.000 |

### minDSCR (loan life)

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 2.414 | 2.414 | 0.000 |
| tepix-loan | 1.902 | 1.902 | 0.000 |
| grant | 4.272 | 4.272 | 0.000 |
| rrf | 2.279 | 2.279 | 0.000 |

### Stabilised NCF (post-VAT)

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | €415,077 | €415,077 | €0 |
| tepix-loan | €304,795 | €304,795 | €0 |
| grant | €573,064 | €573,064 | €0 |
| rrf | €373,500 | €373,500 | €0 |

### Equity IRR

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 32.55% | 32.55% | 0.00pp |
| tepix-loan | 38.45% | 38.45% | 0.00pp |
| grant | 47.48% | 47.48% | 0.00pp |
| rrf | 28.10% | 28.10% | 0.00pp |

### Project IRR

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 16.64% | 16.64% | 0.00pp |
| tepix-loan | 16.72% | 16.72% | 0.00pp |
| grant | 16.51% | 16.51% | 0.00pp |
| rrf | 13.40% | 13.40% | 0.00pp |

### LLCR

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 2.283 | 2.283 | 0.000 |
| tepix-loan | 1.730 | 1.730 | 0.000 |
| grant | 3.986 | 3.986 | 0.000 |
| rrf | 2.128 | 2.128 | 0.000 |

### Founder cumulative cash

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | €7,168,913 | €7,168,913 | €0 |
| tepix-loan | €6,880,834 | €6,880,834 | €0 |
| grant | €8,209,071 | €7,740,218 | -€468,854 |
| rrf | €6,865,056 | €6,865,056 | €0 |

### Investor cumulative cash

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | €5,725,077 | €5,725,077 | €0 |
| tepix-loan | €5,495,019 | €5,495,019 | €0 |
| grant | €6,791,679 | €7,260,533 | +€468,854 |
| rrf | €5,482,418 | €5,482,418 | €0 |

### Founder total %

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 55.60% | 55.60% | 0.00pp |
| tepix-loan | 55.60% | 55.60% | 0.00pp |
| grant | 54.72% | 51.60% | -3.13pp |
| rrf | 55.60% | 55.60% | 0.00pp |

## Scenario: downside

### stabDSCR

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 1.638 | 1.638 | 0.000 |
| tepix-loan | 1.292 | 1.292 | 0.000 |
| grant | 2.931 | 2.931 | 0.000 |
| rrf | 1.547 | 1.547 | 0.000 |

### minDSCR (loan life)

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 1.352 | 1.352 | 0.000 |
| tepix-loan | 1.067 | 1.067 | 0.000 |
| grant | 2.393 | 2.393 | 0.000 |
| rrf | 1.277 | 1.277 | 0.000 |

### Stabilised NCF (post-VAT)

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | €76,194 | €76,194 | €0 |
| tepix-loan | -€34,106 | -€34,106 | €0 |
| grant | €239,676 | €239,676 | €0 |
| rrf | €34,600 | €34,600 | €0 |

### Equity IRR

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 20.46% | 20.46% | 0.00pp |
| tepix-loan | 22.64% | 22.64% | 0.00pp |
| grant | 33.75% | 33.75% | 0.00pp |
| rrf | 16.59% | 16.59% | 0.00pp |

### Project IRR

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 11.02% | 11.02% | 0.00pp |
| tepix-loan | 10.94% | 10.94% | 0.00pp |
| grant | 10.90% | 10.90% | 0.00pp |
| rrf | 8.07% | 8.07% | 0.00pp |

### LLCR

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 1.404 | 1.404 | 0.000 |
| tepix-loan | 1.066 | 1.066 | 0.000 |
| grant | 2.448 | 2.448 | 0.000 |
| rrf | 1.290 | 1.290 | 0.000 |

### Founder cumulative cash

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | €2,898,736 | €2,898,736 | €0 |
| tepix-loan | €2,840,768 | €2,840,768 | €0 |
| grant | €4,054,933 | €3,771,557 | -€283,376 |
| rrf | €2,689,628 | €2,689,628 | €0 |

### Investor cumulative cash

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | €4,069,569 | €4,069,569 | €0 |
| tepix-loan | €3,988,186 | €3,988,186 | €0 |
| grant | €5,011,556 | €5,294,932 | +€283,376 |
| rrf | €3,775,999 | €3,775,999 | €0 |

### Founder total %

| Path | Baseline | Option A | Δ |
| --- | ---: | ---: | ---: |
| commercial | 41.60% | 41.60% | 0.00pp |
| tepix-loan | 41.60% | 41.60% | 0.00pp |
| grant | 44.72% | 41.60% | -3.13pp |
| rrf | 41.60% | 41.60% | 0.00pp |
