"use client";

import { useState, useMemo } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { computeModel, computeCapex } from "@/lib/engine/model";
import { applyCapexUplift } from "@/lib/engine/capexUplift";
import { PROJECT_CONSTANTS } from "@/lib/engine/defaults";
import { formatCurrency, formatPercent } from "@/lib/hooks/useModel";
import { dscrColor } from "@/components/bankSensitivityHelpers";
import type { ModelAssumptions, FinancingPath } from "@/lib/engine/types";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDscr(v: number): string {
  return v.toFixed(2) + "x";
}

function fmtIrr(v: number): string {
  if (v == null || !isFinite(v)) return "—";
  // equityIRR is a decimal (e.g. 0.182 = 18.2%)
  return (v * 100).toFixed(1) + "%";
}

function fmtMoic(v: number): string {
  if (v == null || !isFinite(v)) return "—";
  return v.toFixed(2) + "×";
}

// ── component ─────────────────────────────────────────────────────────────────

export default function AdminCapexComparison() {
  const { t, locale } = useTranslation();

  // ── store reads ──
  const assumptions               = useModelStore((s) => s.assumptions);
  const viewModeOverride          = useModelStore((s) => s.viewModeOverride);
  const financingPathOverride     = useModelStore((s) => s.financingPathOverride);
  const stressTestOverrides       = useModelStore((s) => s.stressTestOverrides);
  // ── local state — uplift input is NEVER seeded from store (constraint §1) ──
  const [upliftRaw, setUpliftRaw] = useState<string>("");
  const [mode, setMode] = useState<"abs" | "pct">("pct");

  // ── derived ──────────────────────────────────────────────────────────────────

  // Raw baseCapex (from raw assumptions) is used only to compute the uplift € amount.
  // The comparison useMemo recomputes capex from effectiveAssumptions internally.
  const rawBaseCapex = useMemo(() => computeCapex(assumptions), [assumptions]);

  const upliftEur = useMemo(() => {
    const v = parseFloat(upliftRaw);
    if (!upliftRaw || isNaN(v) || v <= 0) return 0;
    if (mode === "abs") return v * 1_000;
    return (v / 100) * rawBaseCapex.portfolioTotal;
  }, [upliftRaw, mode, rawBaseCapex.portfolioTotal]);

  const comparison = useMemo(() => {
    // ── 1. Build effectiveAssumptions — mirror recompute() exactly ──
    let effectiveAssumptions: ModelAssumptions = { ...assumptions };

    if (financingPathOverride !== null) {
      effectiveAssumptions = {
        ...effectiveAssumptions,
        financingPath: financingPathOverride as FinancingPath,
      };
    }

    if (stressTestOverrides !== null) {
      for (const [path, value] of Object.entries(stressTestOverrides)) {
        // setNestedValue is a private store helper — inline the same logic here
        const keys = path.split(".");
        const apply = (
          obj: Record<string, unknown>,
          keys: string[],
          value: unknown
        ): Record<string, unknown> => {
          const result = { ...obj };
          let current: Record<string, unknown> = result;
          for (let i = 0; i < keys.length - 1; i++) {
            current[keys[i]] = { ...(current[keys[i]] as Record<string, unknown>) };
            current = current[keys[i]] as Record<string, unknown>;
          }
          current[keys[keys.length - 1]] = value;
          return result;
        };
        effectiveAssumptions = apply(
          effectiveAssumptions as unknown as Record<string, unknown>,
          keys,
          value
        ) as unknown as ModelAssumptions;
      }
    }

    // ── 2. Build effectiveCapex — this component's uplift only; absorption never applied here ──
    const baseCapex = computeCapex(effectiveAssumptions);

    const statedCapex =
      upliftEur > 0 ? applyCapexUplift(baseCapex, upliftEur) : baseCapex;

    // ── 3. Apply viewModeOverride for computeModel calls ──
    const effectiveAssumptionsWithView: ModelAssumptions = viewModeOverride
      ? { ...effectiveAssumptions, viewMode: viewModeOverride }
      : effectiveAssumptions;

    const trueModel = computeModel(effectiveAssumptionsWithView, baseCapex);
    const statedModel =
      upliftEur > 0
        ? computeModel(effectiveAssumptionsWithView, statedCapex)
        : trueModel;

    // Real outcome model: true CAPEX spent, but loan sized to match the stated (bank-approved) amount.
    // Cap at 1.0 to prevent negative equity / IRR solver failure when statedLoan > baseCapex.
    const adjustedLoanCoverageRate = Math.min(
      statedModel.keyMetrics.loanAmount / baseCapex.portfolioTotal,
      1.0
    );

    const realModel = computeModel(
      {
        ...effectiveAssumptionsWithView,
        commercialLoan: {
          ...effectiveAssumptionsWithView.commercialLoan,
          loanCoverageRate: adjustedLoanCoverageRate,
        },
      },
      baseCapex, // ← true CAPEX (no uplift), not statedCapex
    );

    // constraint §3: equityRequired from keyMetrics (not derived manually)
    return {
      trueCapex: baseCapex.portfolioTotal,
      statedCapex: statedCapex.portfolioTotal,

      trueEquity: trueModel.keyMetrics.equityRequired,
      statedEquity: statedModel.keyMetrics.equityRequired,

      // loanAmount is the correct keyMetrics field (totalLoanDrawn does not exist there)
      trueLoan: trueModel.keyMetrics.loanAmount,
      statedLoan: statedModel.keyMetrics.loanAmount,

      // annualDepreciationTotal is on CapexBreakdown
      trueDepr: baseCapex.annualDepreciationTotal,
      statedDepr: statedCapex.annualDepreciationTotal,

      // stabilisedEBITDA — note capital EBITDA in the field name
      trueEbitda: trueModel.keyMetrics.stabilisedEBITDA,
      statedEbitda: statedModel.keyMetrics.stabilisedEBITDA,

      // stabilisedDSCR — note capital DSCR in the field name
      trueDscr: trueModel.keyMetrics.stabilisedDSCR,
      statedDscr: statedModel.keyMetrics.stabilisedDSCR,

      // equityIRR lives on ScenarioOutput, not on keyMetrics
      trueIrr: trueModel.scenarios.realistic.equityIRR,
      statedIrr: statedModel.scenarios.realistic.equityIRR,

      // totalMOIC lives on ScenarioOutput alongside equityIRR
      trueMoic: trueModel.scenarios.realistic.totalMOIC,
      statedMoic: statedModel.scenarios.realistic.totalMOIC,

      // minDSCRLoanLife — minimum annual DSCR over loan life
      trueMinDscr: trueModel.scenarios.realistic.minDSCRLoanLife,
      statedMinDscr: statedModel.scenarios.realistic.minDSCRLoanLife,
      trueMinDscrYear: (() => {
        const valid = trueModel.scenarios.realistic.pnl.filter((p) => (p.dscr ?? 0) > 0);
        return valid.length ? valid.reduce((a, b) => (b.dscr ?? 0) < (a.dscr ?? 0) ? b : a).year : null;
      })(),
      statedMinDscrYear: (() => {
        const valid = statedModel.scenarios.realistic.pnl.filter((p) => (p.dscr ?? 0) > 0);
        return valid.length ? valid.reduce((a, b) => (b.dscr ?? 0) < (a.dscr ?? 0) ? b : a).year : null;
      })(),

      // ── Real outcome columns — all from realModel (engine-native, no manual derivation) ──
      // Real: Eytan takes the stated (larger) loan but spends only true CAPEX.
      // realModel is computed against baseCapex with loanCoverageRate adjusted to reproduce the stated loan.
      realLoan:   realModel.keyMetrics.loanAmount,           // sanity: should equal statedLoan
      realEquity: realModel.keyMetrics.equityRequired,        // replaces manual subtraction
      realDepr:   baseCapex.annualDepreciationTotal,           // based on what is actually built
      // EBITDA is pre-depreciation operating profit — pinned to trueModel so all three
      // columns reflect the same operating performance regardless of financing path.
      realEbitda: trueModel.keyMetrics.stabilisedEBITDA,
      realDscr:   realModel.keyMetrics.stabilisedDSCR,        // replaces manual formula
      realIrr:    realModel.scenarios.realistic.equityIRR,    // actual Real IRR from engine
      realMoic:   realModel.scenarios.realistic.totalMOIC,    // actual Real MOIC from engine
      realMinDscr: realModel.scenarios.realistic.minDSCRLoanLife,
      realMinDscrYear: (() => {
        const valid = realModel.scenarios.realistic.pnl.filter((p) => (p.dscr ?? 0) > 0);
        return valid.length ? valid.reduce((a, b) => (b.dscr ?? 0) < (a.dscr ?? 0) ? b : a).year : null;
      })(),
    };
  }, [assumptions, viewModeOverride, financingPathOverride, stressTestOverrides, upliftEur]);

  // ── helpers ───────────────────────────────────────────────────────────────

  function handleModeSwitch(next: "abs" | "pct") {
    setMode(next);
    setUpliftRaw("");
  }

  const active = upliftEur > 0;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start gap-3 mb-3 flex-wrap">
        <h1 className="font-display text-2xl text-text-primary border-l-[3px] border-brand-400 pl-3">
          {t("admin.capexComparison.title")}
        </h1>
        <span className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
          {t("admin.capexComparison.disclaimer")}
        </span>
      </div>

      <p className="text-sm text-text-secondary mb-6">
        {t("admin.capexComparison.pageIntro")}
      </p>

      {/* Input strip */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <span className="text-sm text-text-secondary font-medium">
          {t("admin.capexComparison.inputLabel")}
        </span>

        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-surface-tertiary text-sm">
          <button
            onClick={() => handleModeSwitch("pct")}
            className={[
              "px-3 py-1.5 transition-colors",
              mode === "pct"
                ? "bg-brand-600 text-white font-semibold"
                : "bg-white text-text-secondary hover:bg-surface-secondary",
            ].join(" ")}
          >
            {t("admin.capexComparison.modePct")}
          </button>
          <button
            onClick={() => handleModeSwitch("abs")}
            className={[
              "px-3 py-1.5 transition-colors border-l border-surface-tertiary",
              mode === "abs"
                ? "bg-brand-600 text-white font-semibold"
                : "bg-white text-text-secondary hover:bg-surface-secondary",
            ].join(" ")}
          >
            {t("admin.capexComparison.modeAbs")}
          </button>
        </div>

        {/* Number input */}
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min="0"
            step={mode === "pct" ? "0.1" : "1"}
            value={upliftRaw}
            onChange={(e) => setUpliftRaw(e.target.value)}
            placeholder={mode === "pct" ? "e.g. 10" : "e.g. 200"}
            className="w-32 px-3 py-1.5 text-sm border border-surface-tertiary rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 font-mono"
          />
          <span className="text-sm text-text-tertiary">
            {mode === "pct" ? "%" : "k€"}
          </span>
        </div>

        {active && (
          <span className="text-xs text-text-tertiary">
            = {formatCurrency(upliftEur, false, locale)} uplift
          </span>
        )}
      </div>

      {/* Comparison table */}
      <div className="rounded-xl border border-surface-tertiary shadow-sm overflow-hidden bg-white">
        {!active ? (
          <div className="py-16 text-center text-text-tertiary text-sm">
            {t("admin.capexComparison.inactiveHint")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-tertiary">
                  <th className="text-left py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium w-48">
                    {/* row label column — no header */}
                  </th>
                  {/* Stated CAPEX column — Col 1 */}
                  <th className="text-right py-3 px-5 font-medium bg-amber-50">
                    <div className="text-xs uppercase tracking-wider text-amber-800">
                      {t("admin.capexComparison.colStated")}
                    </div>
                    <div className="text-[10px] font-normal text-amber-600 mt-0.5">
                      {t("admin.capexComparison.colBankNote")}
                    </div>
                  </th>
                  {/* True CAPEX column — Col 2 */}
                  <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium bg-surface-secondary/30">
                    {t("admin.capexComparison.colTrue")}
                  </th>
                  {/* Real outcome column — Col 3 */}
                  <th className="text-right py-3 px-5 font-medium bg-emerald-50">
                    <div className="text-xs uppercase tracking-wider text-emerald-800">
                      {t("admin.capexComparison.colReal")}
                    </div>
                    <div className="text-[10px] font-normal text-emerald-600 mt-0.5">
                      {t("admin.capexComparison.colRealNote")}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* ── Total CAPEX ── */}
                <tr className="border-b border-surface-secondary/60">
                  <td className="py-3 px-5 text-text-secondary font-medium">
                    {t("admin.capexComparison.rowCapexTotal")}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-amber-50 font-semibold text-amber-900">
                    {formatCurrency(comparison.statedCapex, false, locale)}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-surface-secondary/10">
                    {formatCurrency(comparison.trueCapex, false, locale)}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-emerald-50">
                    {/* Real CAPEX = true CAPEX — that is what actually gets built */}
                    {formatCurrency(comparison.trueCapex, false, locale)}
                  </td>
                </tr>

                {/* ── Equity required ── */}
                <tr className="border-b border-surface-secondary/60">
                  <td className="py-3 px-5 text-text-secondary font-medium">
                    {t("admin.capexComparison.rowEquityRequired")}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-amber-50 font-semibold text-amber-900">
                    {formatCurrency(comparison.statedEquity, false, locale)}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-surface-secondary/10">
                    {formatCurrency(comparison.trueEquity, false, locale)}
                  </td>
                  <td
                    className={[
                      "text-right py-3 px-5 font-mono bg-emerald-50 font-bold",
                      comparison.realEquity < 0 ? "text-negative" : "",
                    ].join(" ")}
                  >
                    {formatCurrency(comparison.realEquity, false, locale)}
                  </td>
                </tr>

                {/* ── Total loan drawn ── */}
                <tr className="border-b border-surface-secondary/60">
                  <td className="py-3 px-5 text-text-secondary font-medium">
                    {t("admin.capexComparison.rowLoan")}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-amber-50 font-semibold text-amber-900">
                    {formatCurrency(comparison.statedLoan, false, locale)}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-surface-secondary/10">
                    {formatCurrency(comparison.trueLoan, false, locale)}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-emerald-50 font-bold text-emerald-700">
                    {formatCurrency(comparison.realLoan, false, locale)}
                  </td>
                </tr>

                {/* ── Annual depreciation ── */}
                <tr className="border-b border-surface-secondary/60">
                  <td className="py-3 px-5 text-text-secondary font-medium">
                    {t("admin.capexComparison.rowDepreciation")}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-amber-50 font-semibold text-amber-900">
                    {formatCurrency(comparison.statedDepr, false, locale)}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-surface-secondary/10">
                    {formatCurrency(comparison.trueDepr, false, locale)}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-emerald-50">
                    {formatCurrency(comparison.realDepr, false, locale)}
                  </td>
                </tr>

                {/* ── Stabilised EBITDA (unaffected by uplift) ── */}
                <tr className="border-b border-surface-secondary/60">
                  <td className="py-3 px-5 text-text-secondary font-medium">
                    <span>{t("admin.capexComparison.rowEbitda")}</span>
                    <span className="ml-1.5 text-xs text-text-tertiary italic">
                      {t("admin.capexComparison.rowEbitdaNote")}
                    </span>
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-amber-50 font-semibold text-amber-900">
                    {formatCurrency(comparison.statedEbitda, false, locale)}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-surface-secondary/10">
                    {formatCurrency(comparison.trueEbitda, false, locale)}
                  </td>
                  {/* Real EBITDA = true EBITDA — actual operations, unaffected by CAPEX uplift */}
                  <td
                    className="text-right py-3 px-5 font-mono bg-emerald-50"
                    title="CAPEX uplift does not flow through to EBITDA — EBITDA is pre-depreciation operating profit"
                  >
                    {formatCurrency(comparison.realEbitda, false, locale)}
                  </td>
                </tr>

                {/* ── Stabilised DSCR ── */}
                <tr className="border-b border-surface-secondary/60">
                  <td className="py-3 px-5 text-text-secondary font-medium">
                    <span>{t("admin.capexComparison.rowDscr")}</span>
                    <span className="ml-1.5 text-xs text-text-tertiary italic">
                      (Year {PROJECT_CONSTANTS.STABILISED_YEAR})
                    </span>
                  </td>
                  <td
                    className={[
                      "text-right py-3 px-5 font-mono bg-amber-50 font-semibold",
                      dscrColor(comparison.statedDscr),
                    ].join(" ")}
                  >
                    {fmtDscr(comparison.statedDscr)}
                  </td>
                  <td
                    className={[
                      "text-right py-3 px-5 font-mono bg-surface-secondary/10 font-semibold",
                      dscrColor(comparison.trueDscr),
                    ].join(" ")}
                  >
                    {fmtDscr(comparison.trueDscr)}
                  </td>
                  <td
                    className={[
                      "text-right py-3 px-5 font-mono bg-emerald-50 font-semibold",
                      dscrColor(comparison.realDscr),
                    ].join(" ")}
                  >
                    {fmtDscr(comparison.realDscr)}
                  </td>
                </tr>

                {/* ── Min DSCR ── */}
                <tr className="border-b border-surface-secondary/60">
                  <td className="py-3 px-5 text-text-secondary font-medium">
                    {t("admin.capexComparison.rowMinDscr")}
                  </td>
                  <td
                    className={[
                      "text-right py-3 px-5 font-mono bg-amber-50 font-semibold",
                      dscrColor(comparison.statedMinDscr),
                    ].join(" ")}
                  >
                    <div>{fmtDscr(comparison.statedMinDscr)}</div>
                    {comparison.statedMinDscrYear && (
                      <div className="text-[10px] font-normal text-amber-600 mt-0.5">
                        ({comparison.statedMinDscrYear})
                      </div>
                    )}
                  </td>
                  <td
                    className={[
                      "text-right py-3 px-5 font-mono bg-surface-secondary/10 font-semibold",
                      dscrColor(comparison.trueMinDscr),
                    ].join(" ")}
                  >
                    <div>{fmtDscr(comparison.trueMinDscr)}</div>
                    {comparison.trueMinDscrYear && (
                      <div className="text-[10px] font-normal text-text-tertiary mt-0.5">
                        ({comparison.trueMinDscrYear})
                      </div>
                    )}
                  </td>
                  <td
                    className={[
                      "text-right py-3 px-5 font-mono bg-emerald-50 font-semibold",
                      dscrColor(comparison.realMinDscr),
                    ].join(" ")}
                  >
                    <div>{fmtDscr(comparison.realMinDscr)}</div>
                    {comparison.realMinDscrYear && (
                      <div className="text-[10px] font-normal text-emerald-600 mt-0.5">
                        ({comparison.realMinDscrYear})
                      </div>
                    )}
                  </td>
                </tr>

                {/* ── Equity IRR ── */}
                <tr>
                  <td className="py-3 px-5 text-text-secondary font-medium">
                    {t("admin.capexComparison.rowIrr")}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-amber-50 font-semibold text-amber-900">
                    <div>{fmtIrr(comparison.statedIrr)}</div>
                    <div className="text-xs text-amber-600 font-normal mt-0.5">{fmtMoic(comparison.statedMoic)} MoM</div>
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-surface-secondary/10">
                    <div>{fmtIrr(comparison.trueIrr)}</div>
                    <div className="text-xs text-text-tertiary mt-0.5">{fmtMoic(comparison.trueMoic)} MoM</div>
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-emerald-50 font-semibold text-emerald-700">
                    <div>{fmtIrr(comparison.realIrr)}</div>
                    <div className="text-xs text-emerald-600 font-normal mt-0.5">{fmtMoic(comparison.realMoic)} MoM</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
