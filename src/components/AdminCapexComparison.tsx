"use client";

import { useState, useMemo } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { computeModel, computeCapex } from "@/lib/engine/model";
import { applyCapexUplift } from "@/lib/engine/capexUplift";
import { PROJECT_CONSTANTS } from "@/lib/engine/defaults";
import { formatCurrency, formatPercent } from "@/lib/hooks/useModel";
import { dscrColor } from "@/components/bankSensitivityHelpers";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDscr(v: number): string {
  return v.toFixed(2) + "x";
}

function fmtIrr(v: number): string {
  // equityIRR is a decimal (e.g. 0.182 = 18.2%)
  return (v * 100).toFixed(1) + "%";
}

function fmtMoic(v: number): string {
  return v.toFixed(2) + "x";
}

function fmtDelta(v: number, prefix = "+"): string {
  if (v === 0) return "—";
  const sign = v > 0 ? prefix : "";
  return sign + formatCurrency(v, false);
}

// ── component ─────────────────────────────────────────────────────────────────

export default function AdminCapexComparison() {
  const { t, locale } = useTranslation();

  // ── store reads (ONLY assumptions — constraint §2) ──
  const assumptions = useModelStore((s) => s.assumptions);

  // ── local state — uplift input is NEVER seeded from store (constraint §1) ──
  const [upliftRaw, setUpliftRaw] = useState<string>("");
  const [mode, setMode] = useState<"abs" | "pct">("pct");

  // ── derived ──────────────────────────────────────────────────────────────────

  const baseCapex = useMemo(() => computeCapex(assumptions), [assumptions]);

  const upliftEur = useMemo(() => {
    const v = parseFloat(upliftRaw);
    if (!upliftRaw || isNaN(v) || v <= 0) return 0;
    if (mode === "abs") return v * 1_000;
    return (v / 100) * baseCapex.portfolioTotal;
  }, [upliftRaw, mode, baseCapex.portfolioTotal]);

  const comparison = useMemo(() => {
    const statedCapex =
      upliftEur > 0 ? applyCapexUplift(baseCapex, upliftEur) : baseCapex;

    // constraint §2: all model output from local computeModel calls only
    const trueModel = computeModel(assumptions, baseCapex);
    const statedModel =
      upliftEur > 0 ? computeModel(assumptions, statedCapex) : trueModel;

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
    };
  }, [assumptions, baseCapex, upliftEur]);

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
                  {/* True CAPEX column */}
                  <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium bg-surface-secondary/30">
                    {t("admin.capexComparison.colTrue")}
                  </th>
                  {/* Stated CAPEX column */}
                  <th className="text-right py-3 px-5 font-medium bg-amber-50">
                    <div className="text-xs uppercase tracking-wider text-amber-800">
                      {t("admin.capexComparison.colStated")}
                    </div>
                    <div className="text-[10px] font-normal text-amber-600 mt-0.5">
                      {t("admin.capexComparison.colBankNote")}
                    </div>
                  </th>
                  {/* Delta column */}
                  <th className="text-right py-3 px-5 text-xs uppercase tracking-wider text-text-tertiary font-medium">
                    {t("admin.capexComparison.colDelta")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* ── Total CAPEX ── */}
                <tr className="border-b border-surface-secondary/60">
                  <td className="py-3 px-5 text-text-secondary font-medium">
                    {t("admin.capexComparison.rowCapexTotal")}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-surface-secondary/10">
                    {formatCurrency(comparison.trueCapex, false, locale)}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-amber-50 font-semibold text-amber-900">
                    {formatCurrency(comparison.statedCapex, false, locale)}
                  </td>
                  <td className="text-right py-3 px-5 font-mono text-text-tertiary">
                    {fmtDelta(comparison.statedCapex - comparison.trueCapex)}
                  </td>
                </tr>

                {/* ── Equity required ── */}
                <tr className="border-b border-surface-secondary/60">
                  <td className="py-3 px-5 text-text-secondary font-medium">
                    {t("admin.capexComparison.rowEquityRequired")}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-surface-secondary/10">
                    {formatCurrency(comparison.trueEquity, false, locale)}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-amber-50 font-semibold text-amber-900">
                    {formatCurrency(comparison.statedEquity, false, locale)}
                  </td>
                  <td
                    className={[
                      "text-right py-3 px-5 font-mono font-semibold",
                      comparison.statedEquity > comparison.trueEquity
                        ? "text-negative"
                        : "text-text-tertiary",
                    ].join(" ")}
                  >
                    {fmtDelta(comparison.statedEquity - comparison.trueEquity)}
                  </td>
                </tr>

                {/* ── Total loan drawn ── */}
                <tr className="border-b border-surface-secondary/60">
                  <td className="py-3 px-5 text-text-secondary font-medium">
                    {t("admin.capexComparison.rowLoan")}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-surface-secondary/10">
                    {formatCurrency(comparison.trueLoan, false, locale)}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-amber-50 font-semibold text-amber-900">
                    {formatCurrency(comparison.statedLoan, false, locale)}
                  </td>
                  <td className="text-right py-3 px-5 font-mono text-text-tertiary">
                    {fmtDelta(comparison.statedLoan - comparison.trueLoan)}
                  </td>
                </tr>

                {/* ── Annual depreciation ── */}
                <tr className="border-b border-surface-secondary/60">
                  <td className="py-3 px-5 text-text-secondary font-medium">
                    {t("admin.capexComparison.rowDepreciation")}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-surface-secondary/10">
                    {formatCurrency(comparison.trueDepr, false, locale)}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-amber-50 font-semibold text-amber-900">
                    {formatCurrency(comparison.statedDepr, false, locale)}
                  </td>
                  <td className="text-right py-3 px-5 font-mono text-text-tertiary">
                    {fmtDelta(comparison.statedDepr - comparison.trueDepr)}
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
                  <td className="text-right py-3 px-5 font-mono bg-surface-secondary/10">
                    {formatCurrency(comparison.trueEbitda, false, locale)}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-amber-50 font-semibold text-amber-900">
                    {formatCurrency(comparison.statedEbitda, false, locale)}
                  </td>
                  {/* EBITDA is pre-depreciation and unaffected — show grayed dash */}
                  <td
                    className="text-right py-3 px-5 font-mono text-text-tertiary"
                    title="CAPEX uplift does not flow through to EBITDA — EBITDA is pre-depreciation operating profit"
                  >
                    —
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
                      "text-right py-3 px-5 font-mono bg-surface-secondary/10 font-semibold",
                      dscrColor(comparison.trueDscr),
                    ].join(" ")}
                  >
                    {fmtDscr(comparison.trueDscr)}
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
                      "text-right py-3 px-5 font-mono font-semibold",
                      comparison.statedDscr < comparison.trueDscr
                        ? "text-negative"
                        : "text-text-tertiary",
                    ].join(" ")}
                  >
                    {comparison.statedDscr === comparison.trueDscr
                      ? "—"
                      : (comparison.statedDscr - comparison.trueDscr > 0
                          ? "+"
                          : "") +
                        (comparison.statedDscr - comparison.trueDscr).toFixed(
                          2
                        ) +
                        "x"}
                  </td>
                </tr>

                {/* ── Min DSCR ── */}
                <tr className="border-b border-surface-secondary/60">
                  <td className="py-3 px-5 text-text-secondary font-medium">
                    <span>{t("admin.capexComparison.rowMinDscr")}</span>
                    {comparison.trueMinDscrYear && (
                      <span className="ml-1.5 text-xs text-text-tertiary italic">
                        ({comparison.trueMinDscrYear})
                      </span>
                    )}
                  </td>
                  <td
                    className={[
                      "text-right py-3 px-5 font-mono bg-surface-secondary/10 font-semibold",
                      dscrColor(comparison.trueMinDscr),
                    ].join(" ")}
                  >
                    {fmtDscr(comparison.trueMinDscr)}
                  </td>
                  <td
                    className={[
                      "text-right py-3 px-5 font-mono bg-amber-50 font-semibold",
                      dscrColor(comparison.statedMinDscr),
                    ].join(" ")}
                  >
                    {fmtDscr(comparison.statedMinDscr)}
                  </td>
                  <td
                    className={[
                      "text-right py-3 px-5 font-mono font-semibold",
                      comparison.statedMinDscr < comparison.trueMinDscr
                        ? "text-negative"
                        : "text-text-tertiary",
                    ].join(" ")}
                  >
                    {comparison.statedMinDscr === comparison.trueMinDscr
                      ? "—"
                      : (comparison.statedMinDscr - comparison.trueMinDscr > 0
                          ? "+"
                          : "") +
                        (comparison.statedMinDscr - comparison.trueMinDscr).toFixed(2) +
                        "x"}
                  </td>
                </tr>

                {/* ── Equity IRR ── */}
                <tr>
                  <td className="py-3 px-5 text-text-secondary font-medium">
                    {t("admin.capexComparison.rowIrr")}
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-surface-secondary/10">
                    <div>{fmtIrr(comparison.trueIrr)}</div>
                    <div className="text-xs text-text-tertiary mt-0.5">{fmtMoic(comparison.trueMoic)} MoM</div>
                  </td>
                  <td className="text-right py-3 px-5 font-mono bg-amber-50 font-semibold text-amber-900">
                    <div>{fmtIrr(comparison.statedIrr)}</div>
                    <div className="text-xs text-amber-600 font-normal mt-0.5">{fmtMoic(comparison.statedMoic)} MoM</div>
                  </td>
                  <td
                    className={[
                      "text-right py-3 px-5 font-mono font-semibold",
                      comparison.statedIrr > comparison.trueIrr
                        ? "text-positive"
                        : comparison.statedIrr < comparison.trueIrr
                          ? "text-negative"
                          : "text-text-tertiary",
                    ].join(" ")}
                  >
                    {comparison.statedIrr === comparison.trueIrr
                      ? "—"
                      : (comparison.statedIrr - comparison.trueIrr > 0
                          ? "+"
                          : "") +
                        (
                          (comparison.statedIrr - comparison.trueIrr) *
                          100
                        ).toFixed(1) +
                        "pp"}
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
