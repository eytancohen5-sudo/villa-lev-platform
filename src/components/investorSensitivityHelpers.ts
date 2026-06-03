// Pure helper functions extracted from InvestorSensitivityTab.tsx so that
// unit tests can import them without pulling in the React / Zustand graph.
// The component re-exports nothing from here — it imports and uses these
// directly. Tests import from this module.

import { computeModel } from "@/lib/engine/model";
import type { ModelAssumptions } from "@/lib/engine/types";
import type { ScenarioName } from "@/lib/store/modelStore";

// ── Slider state ──────────────────────────────────────────────────────────────

export interface SliderValues {
  villaBaseNights: number;
  villaADR: number;
  suiteADR: number;
  exitYear: number;
  exitEbitdaMultiple: number;
  exitValuationPerM2: number;
}

export function cloneAssumptions(a: ModelAssumptions): ModelAssumptions {
  return JSON.parse(JSON.stringify(a));
}

export function readBaseValues(assumptions: ModelAssumptions): SliderValues {
  return {
    villaBaseNights: assumptions.revenueRealistic.villaBaseNights,
    villaADR: assumptions.revenueRealistic.villaADR,
    suiteADR: assumptions.revenueRealistic.suiteStandardADR,
    exitYear: Math.min(2040, Math.max(2029, assumptions.exitYear)),
    exitEbitdaMultiple: assumptions.exitEbitdaMultiple,
    exitValuationPerM2: assumptions.exitValuationPerM2 ?? 9000,
  };
}

export function applySliders(
  base: ModelAssumptions,
  sliders: SliderValues
): ModelAssumptions {
  const clone = cloneAssumptions(base);

  clone.viewMode = "internal";

  clone.revenueRealistic = {
    ...clone.revenueRealistic,
    villaBaseNights: sliders.villaBaseNights,
    suiteBaseNights: sliders.villaBaseNights,
    villaADR: sliders.villaADR,
    suiteStandardADR: sliders.suiteADR,
    suiteDoubleADR: sliders.suiteADR,
  };

  clone.exitYear = sliders.exitYear;
  clone.exitEbitdaMultiple = sliders.exitEbitdaMultiple;
  clone.exitValuationPerM2 = sliders.exitValuationPerM2;

  return clone;
}

// ── Traffic-light helpers ─────────────────────────────────────────────────────

export function irrColor(v: number): string {
  if (v >= 0.15) return "text-positive";
  if (v >= 0.08) return "text-warning";
  return "text-negative";
}

export function irrDot(v: number): string {
  if (v >= 0.15) return "bg-positive";
  if (v >= 0.08) return "bg-warning";
  return "bg-negative";
}

export function moicColor(v: number): string {
  if (v >= 2.0) return "text-positive";
  if (v >= 1.0) return "text-warning";
  return "text-negative";
}

export function moicDot(v: number): string {
  if (v >= 2.0) return "bg-positive";
  if (v >= 1.0) return "bg-warning";
  return "bg-negative";
}

export function yieldColor(v: number): string {
  if (v >= 0.12) return "text-positive";
  if (v >= 0.06) return "text-warning";
  return "text-negative";
}

export function yieldDot(v: number): string {
  if (v >= 0.12) return "bg-positive";
  if (v >= 0.06) return "bg-warning";
  return "bg-negative";
}

// ── Hold period comparison helper ─────────────────────────────────────────────
// Applies sliders then overrides exitYear with a forced value.
// The explicit clone.exitYear = forcedExitYear assignment AFTER applySliders is
// critical: applySliders sets exitYear from sliders.exitYear, so without the
// override the 2037 column would track the slider instead of staying fixed.

export function buildHoldScenario(
  base: ModelAssumptions,
  sliders: SliderValues,
  forcedExitYear: number,
  activeScenario: ScenarioName = 'realistic'
): { irr: number; moic: number } {
  const clone = cloneAssumptions(applySliders(base, sliders));
  clone.exitYear = forcedExitYear; // ALWAYS force — even for 2037
  const result = computeModel(clone);
  const r = result.scenarios[activeScenario];
  return {
    irr:  isFinite(r.equityIRR) ? r.equityIRR : 0,
    moic: isFinite(r.totalMOIC) ? r.totalMOIC : 0,
  };
}
