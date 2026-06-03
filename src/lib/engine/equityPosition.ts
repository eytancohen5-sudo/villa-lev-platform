// ============================================================
// Equity position helper — display layer only (ADR-0029 context)
// ============================================================
//
// Computes the sponsor's cumulative capital account for the
// "Net equity position (cumulative)" P&L row.
//
// Sign convention:
//   NEGATIVE = equity still deployed / at risk (cash going out).
//   ZERO     = all deployed capital has been recovered by operating NCF.
//   The value trends from 0 down to ~-(equityRequired + graceInterestCarry) at peak
//   construction, then recovers toward zero as operations accumulate positive NCF.
//   At peak the value ≈ -(totalShareholder cash out-of-pocket).
//
// Formula:
//   equityPosition = -cumulativeEquityDeployed(year) + cumulativeNCF
//
// where cumulativeNCF is NEGATIVE during construction (IO outflows) and
// turns positive once operating cashflow exceeds debt service.
//
// cumulativeEquityDeployed is mode-specific:
//
//   standard / two-phase:
//     y < plotsStartYear              → 0
//     y === plotsStartYear            → phase1Equity
//     y >= constructionStartYear      → equityRequired  (full equity deployed)
//
//   rolling:
//     Same phase1 / constructionStart logic, but the remaining equity
//     is split 50/50 across the two construction years:
//     y < plotsStartYear              → 0
//     y === plotsStartYear            → phase1Equity
//     constructionStartYear <= y < constructionStartYear+1 → phase1Equity + remainingEquity/2
//     y >= constructionStartYear+1    → equityRequired
//
//   rolling-cohort:
//     Equity spreads evenly across all construction years from
//     constructionStartYear through openingYear-1:
//     y < plotsStartYear              → 0
//     y === plotsStartYear            → phase1Equity
//     constructionStartYear <= y < openingYear:
//       constructionYearsElapsed = y - constructionStartYear + 1
//       numConstructionYears     = openingYear - constructionStartYear
//       phase1Equity + (constructionYearsElapsed / numConstructionYears) × remainingEquity
//     y >= openingYear                → equityRequired  (fully deployed)

export function computeEquityPosition(params: {
  year: number;
  cumulativeNCF: number;
  graceMode: 'standard' | 'two-phase' | 'rolling' | 'rolling-cohort' | undefined;
  equityRequired: number;
  phase1Equity: number;
  plotsStartYear: number;
  constructionStartYear: number;
  openingYear: number;
}): number {
  const {
    year,
    cumulativeNCF,
    graceMode,
    equityRequired,
    phase1Equity,
    plotsStartYear,
    constructionStartYear,
    openingYear,
  } = params;

  const remainingEquity = equityRequired - phase1Equity;

  let deployed: number;

  if (graceMode === 'rolling-cohort') {
    if (year < plotsStartYear) {
      deployed = 0;
    } else if (year === plotsStartYear) {
      deployed = phase1Equity;
    } else if (year >= openingYear) {
      deployed = equityRequired;
    } else {
      // constructionStartYear <= year < openingYear
      const numConstructionYears = openingYear - constructionStartYear;
      if (numConstructionYears <= 0) {
        deployed = equityRequired;
      } else {
        const constructionYearsElapsed = year - constructionStartYear + 1;
        const fraction = Math.min(1, constructionYearsElapsed / numConstructionYears);
        deployed = phase1Equity + fraction * remainingEquity;
      }
    }
  } else if (graceMode === 'rolling') {
    if (year < plotsStartYear) {
      deployed = 0;
    } else if (year === plotsStartYear) {
      deployed = phase1Equity;
    } else if (year < constructionStartYear) {
      deployed = phase1Equity;
    } else if (year < constructionStartYear + 1) {
      deployed = phase1Equity + remainingEquity / 2;
    } else {
      deployed = equityRequired;
    }
  } else {
    // 'standard' | 'two-phase' | undefined (falls back to standard behaviour)
    if (year < plotsStartYear) {
      deployed = 0;
    } else if (year === plotsStartYear) {
      deployed = phase1Equity;
    } else if (year >= constructionStartYear) {
      deployed = equityRequired;
    } else {
      // plotsStartYear < year < constructionStartYear
      deployed = phase1Equity;
    }
  }

  return -deployed + cumulativeNCF;
}
