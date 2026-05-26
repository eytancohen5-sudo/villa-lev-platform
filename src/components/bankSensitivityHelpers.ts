// Pure helper functions extracted from BankSensitivityTab.tsx so that
// unit tests can import them without pulling in the React / Zustand graph.
// The component re-exports nothing from here — it imports and uses these
// directly. Tests import from this module.

import type { ModelAssumptions, PropertyConfig } from "@/lib/engine/types";

// ── Slider state ──────────────────────────────────────────────────────────────

export interface SliderValues {
  villaBaseNights: number;
  villaADR: number;
  interestRate: number;
  tenorYears: number;
  loanCoverageRate: number;
  opexContingencyRate: number;
  opexStressFactor: number;
}

function cloneAssumptions(a: ModelAssumptions): ModelAssumptions {
  return JSON.parse(JSON.stringify(a));
}

export function readBaseValues(assumptions: ModelAssumptions, activePath: string): SliderValues {
  const interestRate =
    activePath === "tepix-loan"
      ? assumptions.tepixLoan.bankInterestRate
      : activePath === "rrf"
        ? assumptions.rrf.commercialInterestRate
        : assumptions.commercialLoan.interestRate;

  const tenorYears =
    activePath === "tepix-loan"
      ? assumptions.tepixLoan.totalTermYears
      : activePath === "rrf"
        ? assumptions.rrf.repaymentTermYears
        : assumptions.commercialLoan.repaymentTermYears;

  const loanCoverageRate =
    activePath === "tepix-loan"
      ? assumptions.tepixLoan.coverageRate
      : activePath === "rrf"
        ? assumptions.rrf.coverageRate
        : assumptions.commercialLoan.loanCoverageRate;

  // Use the first portfolio entry's opexContingencyRate as representative base
  const opexContingencyRate = assumptions.portfolio[0]?.opexContingencyRate ?? 0;

  return {
    villaBaseNights: assumptions.revenueRealistic.villaBaseNights,
    villaADR: assumptions.revenueRealistic.villaADR,
    interestRate,
    tenorYears,
    loanCoverageRate,
    opexContingencyRate,
    opexStressFactor: 0,
  };
}

export function applySliders(
  base: ModelAssumptions,
  sliders: SliderValues,
  activePath: string
): ModelAssumptions {
  const clone = cloneAssumptions(base);

  // viewMode — always bank for this tab
  clone.viewMode = "bank";

  // Occupancy — both villa and suite move in lockstep
  clone.revenueRealistic = {
    ...clone.revenueRealistic,
    villaBaseNights: sliders.villaBaseNights,
    suiteBaseNights: sliders.villaBaseNights,
  };
  // nightsCap must be at least as high as the set nights, otherwise the engine caps it down.
  clone.general = { ...clone.general, nightsCap: Math.max(clone.general.nightsCap, sliders.villaBaseNights) };

  // ADR
  clone.revenueRealistic = {
    ...clone.revenueRealistic,
    villaADR: sliders.villaADR,
  };

  // Interest rate — path dispatch
  if (activePath === "tepix-loan") {
    clone.tepixLoan = { ...clone.tepixLoan, bankInterestRate: sliders.interestRate };
  } else if (activePath === "rrf") {
    clone.rrf = { ...clone.rrf, commercialInterestRate: sliders.interestRate };
  } else {
    // commercial, grant, tepix-guarantee-short
    clone.commercialLoan = { ...clone.commercialLoan, interestRate: sliders.interestRate };
  }

  // Tenor — path dispatch
  if (activePath === "tepix-loan") {
    clone.tepixLoan = { ...clone.tepixLoan, totalTermYears: sliders.tenorYears };
  } else if (activePath === "rrf") {
    clone.rrf = { ...clone.rrf, repaymentTermYears: sliders.tenorYears };
  } else {
    // commercial, grant
    clone.commercialLoan = { ...clone.commercialLoan, repaymentTermYears: sliders.tenorYears };
  }

  // LTV (loan coverage rate) — path dispatch
  if (activePath === "tepix-loan") {
    clone.tepixLoan = { ...clone.tepixLoan, coverageRate: sliders.loanCoverageRate };
  } else if (activePath === "rrf") {
    clone.rrf = { ...clone.rrf, coverageRate: sliders.loanCoverageRate };
  } else {
    clone.commercialLoan = { ...clone.commercialLoan, loanCoverageRate: sliders.loanCoverageRate };
  }

  // OpEx contingency — iterate portfolio
  clone.portfolio.forEach((p: PropertyConfig) => {
    p.opexContingencyRate = sliders.opexContingencyRate;
  });

  // OpEx stress factor — scales controllable line items only.
  // extraOpexLines are absolute user values — do NOT double-count.
  // ffeReserveFloor and opexContingencyRate are planning parameters — do NOT touch.
  if (sliders.opexStressFactor !== 0) {
    const multiplier = 1 + sliders.opexStressFactor;
    clone.portfolio.forEach((prop: PropertyConfig) => {
      prop.opex = {
        ...prop.opex,
        housekeeping: (prop.opex.housekeeping ?? 0) * multiplier,
        utilities: (prop.opex.utilities ?? 0) * multiplier,
        insurance: (prop.opex.insurance ?? 0) * multiplier,
        propertyTax: (prop.opex.propertyTax ?? 0) * multiplier,
        marketing: (prop.opex.marketing ?? 0) * multiplier,
        consumables: (prop.opex.consumables ?? 0) * multiplier,
        accounting: (prop.opex.accounting ?? 0) * multiplier,
      };
    });
  }

  // Portfolio OPEX stress — scales all portfolio lines by the same opexStressFactor.
  // TODO v2: split portfolio vs template OPEX stress
  // NOTE: opexContingencyRate does NOT apply to portfolio OPEX — these are separate code paths.
  if (sliders.opexStressFactor !== 0 && clone.portfolioOpex) {
    const m = 1 + sliders.opexStressFactor;
    clone.portfolioOpex = {
      ...clone.portfolioOpex,
      // Pool R&M is driven by poolCostPerUnit in the engine (not annualCost), so stress both.
      poolCostPerUnit: (clone.portfolioOpex.poolCostPerUnit ?? 1500) * m,
      sharedServices: clone.portfolioOpex.sharedServices.map((s) => ({ ...s, annualCost: s.annualCost * m })),
      sharedOverhead:  clone.portfolioOpex.sharedOverhead.map((s)  => ({ ...s, annualCost: s.annualCost * m })),
      staffRoles:      clone.portfolioOpex.staffRoles.map((r)      => ({ ...r, monthlyGross: r.monthlyGross * m, allowances: r.allowances * m })),
    };
  }

  return clone;
}

// ── Traffic-light helpers ─────────────────────────────────────────────────────

export function dscrColor(v: number): string {
  if (v >= 1.25) return "text-positive";
  if (v >= 1.0) return "text-warning";
  return "text-negative";
}

export function ltvColor(v: number): string {
  if (v <= 0.6) return "text-positive";
  if (v <= 0.75) return "text-warning";
  return "text-negative";
}

export function icrColor(v: number): string {
  if (v >= 2.0) return "text-positive";
  if (v >= 1.5) return "text-warning";
  return "text-negative";
}

export function dscrDot(v: number): string {
  if (v >= 1.25) return "bg-positive";
  if (v >= 1.0) return "bg-warning";
  return "bg-negative";
}

export function ltvDot(v: number): string {
  if (v <= 0.6) return "bg-positive";
  if (v <= 0.75) return "bg-warning";
  return "bg-negative";
}

export function icrDot(v: number): string {
  if (v >= 2.0) return "bg-positive";
  if (v >= 1.5) return "bg-warning";
  return "bg-negative";
}
