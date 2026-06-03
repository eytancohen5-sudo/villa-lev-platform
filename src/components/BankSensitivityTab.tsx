"use client";

import { useState, useMemo, useEffect } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { computeModel } from "@/lib/engine/model";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { ModelAssumptions, PropertyConfig } from "@/lib/engine/types";
import { PROJECT_CONSTANTS } from "@/lib/engine/defaults";

// ── Helpers ───────────────────────────────────────────────────────────────────

function cloneAssumptions(a: ModelAssumptions): ModelAssumptions {
  return JSON.parse(JSON.stringify(a));
}

// ── Slider state ──────────────────────────────────────────────────────────────

interface SliderValues {
  villaBaseNights: number;
  villaADR: number;
  interestRate: number;
  tenorYears: number;
  loanCoverageRate: number;
  opexContingencyRate: number;
  opexStressFactor: number;
}

function readBaseValues(assumptions: ModelAssumptions, activePath: string): SliderValues {
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

function applySliders(
  base: ModelAssumptions,
  sliders: SliderValues,
  activePath: string
): ModelAssumptions {
  const clone = cloneAssumptions(base);

  // viewMode — BLOCKER 2: always bank for this tab
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

  // Interest rate — BLOCKER 1: path dispatch
  if (activePath === "tepix-loan") {
    clone.tepixLoan = { ...clone.tepixLoan, bankInterestRate: sliders.interestRate };
  } else if (activePath === "rrf") {
    clone.rrf = { ...clone.rrf, commercialInterestRate: sliders.interestRate };
  } else {
    // commercial, grant, tepix-guarantee-short
    clone.commercialLoan = { ...clone.commercialLoan, interestRate: sliders.interestRate };
  }

  // Tenor — BLOCKER 1: path dispatch
  if (activePath === "tepix-loan") {
    clone.tepixLoan = { ...clone.tepixLoan, totalTermYears: sliders.tenorYears };
  } else if (activePath === "rrf") {
    clone.rrf = { ...clone.rrf, repaymentTermYears: sliders.tenorYears };
  } else {
    // commercial, grant
    clone.commercialLoan = { ...clone.commercialLoan, repaymentTermYears: sliders.tenorYears };
  }

  // LTV (loan coverage rate) — BLOCKER 1: path dispatch
  if (activePath === "tepix-loan") {
    clone.tepixLoan = { ...clone.tepixLoan, coverageRate: sliders.loanCoverageRate };
  } else if (activePath === "rrf") {
    clone.rrf = { ...clone.rrf, coverageRate: sliders.loanCoverageRate };
  } else {
    clone.commercialLoan = { ...clone.commercialLoan, loanCoverageRate: sliders.loanCoverageRate };
  }

  // OpEx contingency — BLOCKER 3: iterate portfolio
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

  return clone;
}

// ── Traffic-light helpers ─────────────────────────────────────────────────────

function dscrColor(v: number): string {
  if (v >= 1.25) return "text-positive";
  if (v >= 1.0) return "text-warning";
  return "text-negative";
}

function ltvColor(v: number): string {
  if (v <= 0.6) return "text-positive";
  if (v <= 0.75) return "text-warning";
  return "text-negative";
}

function icrColor(v: number): string {
  if (v >= 2.0) return "text-positive";
  if (v >= 1.5) return "text-warning";
  return "text-negative";
}

function dscrDot(v: number): string {
  if (v >= 1.25) return "bg-positive";
  if (v >= 1.0) return "bg-warning";
  return "bg-negative";
}

function ltvDot(v: number): string {
  if (v <= 0.6) return "bg-positive";
  if (v <= 0.75) return "bg-warning";
  return "bg-negative";
}

function icrDot(v: number): string {
  if (v >= 2.0) return "bg-positive";
  if (v >= 1.5) return "bg-warning";
  return "bg-negative";
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  subLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  baseValue: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  baseLabel: string;
}

function SliderRow({
  label,
  subLabel,
  min,
  max,
  step,
  value,
  baseValue,
  format,
  onChange,
  baseLabel,
}: SliderRowProps) {
  const changed = Math.abs(value - baseValue) > step * 0.01;
  return (
    <div className="py-3 border-b border-surface-secondary/50 last:border-0">
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <span className="text-sm font-medium text-text-primary">{label}</span>
          <span className="ml-2 text-xs text-text-tertiary">{subLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {changed && (
            <span className="text-[10px] text-text-tertiary font-mono">
              {baseLabel}: {format(baseValue)}
            </span>
          )}
          <span className={`text-sm font-mono font-semibold ${changed ? "text-brand-600" : "text-text-primary"}`}>
            {format(value)}
          </span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-brand-500 bg-surface-tertiary"
      />
      <div className="flex justify-between text-[10px] text-text-tertiary mt-0.5">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

interface KpiRowProps {
  label: string;
  subLabel: string;
  value: string;
  valueClass: string;
  dotClass: string;
}

function KpiRow({ label, subLabel, value, valueClass, dotClass }: KpiRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-secondary/50 last:border-0">
      <div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${dotClass}`} />
          <span className="text-sm font-medium text-text-primary">{label}</span>
        </div>
        <p className="text-xs text-text-tertiary ml-4">{subLabel}</p>
      </div>
      <span className={`text-2xl font-mono font-semibold tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BankSensitivityTab() {
  const { t, locale } = useTranslation();
  const { assumptions, financingPathOverride } = useModelStore();

  const activePath = financingPathOverride ?? assumptions.financingPath;

  // Initialise sliders from live assumptions on mount (lazy init)
  const [sliders, setSliders] = useState<SliderValues>(() =>
    readBaseValues(assumptions, activePath)
  );

  // Re-sync sliders when the active path changes so base values reflect the new path.
  // assumptions is NOT in the dep array: if it were rebuilt on every render (e.g. from
  // a non-memoized selector) this effect would fire on every render, causing an infinite
  // loop. activePath is the only trigger we need — readBaseValues reads from assumptions
  // internally but that is safe because it is a pure function called once per effect fire.
  useEffect(() => {
    setSliders(readBaseValues(assumptions, activePath));
  }, [activePath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Extended-range toggles for occupancy and OPEX stress sliders
  const [extendedNights, setExtendedNights] = useState(false);
  const [extendedOpex, setExtendedOpex] = useState(false);

  // "Reset to base" reads current assumptions (important if a different scenario
  // was loaded after the tab mounted)
  function resetToBase() {
    setSliders(readBaseValues(assumptions, activePath));
  }

  // Recompute on every slider change — useMemo so it only re-runs when sliders change
  const result = useMemo(() => {
    const modified = applySliders(assumptions, sliders, activePath);
    return computeModel(modified);
  }, [assumptions, sliders, activePath]);

  // CAPEX sensitivity — vary construction cost/m² across the portfolio, hold sliders constant
  const capexRows = useMemo(() => {
    const deltas = [-0.20, -0.10, -0.05, 0, 0.05, 0.10, 0.20];
    return deltas.map((delta) => {
      const base = applySliders(cloneAssumptions(assumptions), sliders, activePath);
      base.portfolio = base.portfolio.map((p) => ({
        ...p,
        constructionCostPerM2: p.constructionCostPerM2 * (1 + delta),
      }));
      const r = computeModel(base);
      // Anchor CAPEX sensitivity DSCR/DS/NCF to FIRST_OPERATIONAL_YEAR (2030) — the first
      // post-ramp year, consistent with the DSCR Trajectory chart tooltip which prominently
      // labels 2030. Stabilised year (2032) used to be the anchor but its 1.62× read
      // misled vs the chart's 1.07× at 2030 (same scenario, different year).
      const firstOp = r.scenarios.realistic.pnl.find(
        (p) => p.year === PROJECT_CONSTANTS.FIRST_OPERATIONAL_YEAR
      );
      return {
        label: delta === 0 ? t('sens.base') : `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(0)}%`,
        isBase: delta === 0,
        capex: r.capex.portfolioTotal,
        ds: firstOp?.debtService ?? 0,
        dscr: firstOp?.dscr ?? 0,
        ncf: firstOp?.netCashFlowPostVAT ?? 0,
      };
    });
  }, [assumptions, sliders, activePath, t]);

  const realistic = result.scenarios.realistic;
  const stab = realistic.stabilisedYear;

  const kpis = {
    dscr: stab?.dscr ?? 0,
    ltv: result.keyMetrics.ltv,
    icr: realistic.icrStabilised ?? 0,
    noi: stab?.ebitda ?? 0,
  };

  const pathLabel =
    activePath === "grant"
      ? t("path.grant")
      : activePath === "rrf"
        ? t("path.rrf")
        : activePath === "tepix-loan"
          ? t("path.tepixLoan")
          : activePath === "optima"
            ? "Optima Bank"
            : t("path.commercial");

  const formatNights = (v: number) => `${Math.round(v)}`;
  const formatADR = (v: number) => formatCurrency(v, false, locale);
  const formatRate = (v: number) => `${(v * 100).toFixed(2)}%`;
  const formatYears = (v: number) => `${Math.round(v)}yr`;
  const formatLtv = (v: number) => `${(v * 100).toFixed(0)}%`;
  const formatOpex = (v: number) => `${(v * 100).toFixed(1)}%`;
  const formatOpexStress = (v: number) =>
    v >= 0 ? `+${(v * 100).toFixed(0)}%` : `${(v * 100).toFixed(0)}%`;

  const baseValues = readBaseValues(assumptions, activePath);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-text-primary mb-1">{t("bank.sens.title")}</h2>
        <p className="text-sm text-text-secondary">{t("bank.sens.subtitle")}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Left: Sliders ─────────────────────────────────────────── */}
        <div className="lg:w-2/5">
          <div className="bg-white rounded-xl border border-surface-tertiary p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary mb-4">
              {t("bank.sens.slidersHeading")}
            </h3>

            <SliderRow
              label={t("bank.sens.occupancy")}
              subLabel={t("bank.sens.occupancySub")}
              min={extendedNights ? 50 : 60}
              max={extendedNights ? 150 : 130}
              step={5}
              value={sliders.villaBaseNights}
              baseValue={baseValues.villaBaseNights}
              format={formatNights}
              onChange={(v) => setSliders((s) => ({ ...s, villaBaseNights: v }))}
              baseLabel={t("bank.sens.baseValue")}
            />
            <button
              type="button"
              onClick={() => {
                if (extendedNights) {
                  setSliders((s) => ({
                    ...s,
                    villaBaseNights: Math.min(130, s.villaBaseNights),
                  }));
                }
                setExtendedNights((prev) => !prev);
              }}
              className="mt-1 text-xs text-brand-600 underline underline-offset-2 hover:text-brand-800"
            >
              {t("bank.sens.occupancyExtended")}
            </button>

            <SliderRow
              label={t("bank.sens.adr")}
              subLabel={t("bank.sens.adrSub")}
              min={1500}
              max={6000}
              step={50}
              value={sliders.villaADR}
              baseValue={baseValues.villaADR}
              format={formatADR}
              onChange={(v) => setSliders((s) => ({ ...s, villaADR: v }))}
              baseLabel={t("bank.sens.baseValue")}
            />

            <SliderRow
              label={t("bank.sens.interestRate")}
              subLabel={t("bank.sens.interestRateSub")}
              min={0.01}
              max={0.15}
              step={0.0025}
              value={sliders.interestRate}
              baseValue={baseValues.interestRate}
              format={formatRate}
              onChange={(v) => setSliders((s) => ({ ...s, interestRate: v }))}
              baseLabel={t("bank.sens.baseValue")}
            />

            <SliderRow
              label={t("bank.sens.tenor")}
              subLabel={t("bank.sens.tenorSub")}
              min={5}
              max={25}
              step={1}
              value={sliders.tenorYears}
              baseValue={baseValues.tenorYears}
              format={formatYears}
              onChange={(v) => setSliders((s) => ({ ...s, tenorYears: v }))}
              baseLabel={t("bank.sens.baseValue")}
            />

            <SliderRow
              label={t("bank.sens.ltvOrigin")}
              subLabel={t("bank.sens.ltvOriginSub")}
              min={0.30}
              max={0.90}
              step={0.01}
              value={sliders.loanCoverageRate}
              baseValue={baseValues.loanCoverageRate}
              format={formatLtv}
              onChange={(v) => setSliders((s) => ({ ...s, loanCoverageRate: v }))}
              baseLabel={t("bank.sens.baseValue")}
            />

            <SliderRow
              label={t("bank.sens.opex")}
              subLabel={t("bank.sens.opexSub")}
              min={0}
              max={0.15}
              step={0.005}
              value={sliders.opexContingencyRate}
              baseValue={baseValues.opexContingencyRate}
              format={formatOpex}
              onChange={(v) => setSliders((s) => ({ ...s, opexContingencyRate: v }))}
              baseLabel={t("bank.sens.baseValue")}
            />

            <div title={t("bank.sens.opexStressTooltip")}>
              <SliderRow
                label={t("bank.sens.opexStress")}
                subLabel={t("bank.sens.opexStressSub")}
                min={extendedOpex ? -0.20 : -0.15}
                max={extendedOpex ? 0.50 : 0.30}
                step={0.01}
                value={sliders.opexStressFactor}
                baseValue={0}
                format={formatOpexStress}
                baseLabel={t("bank.sens.baseValue")}
                onChange={(v) => setSliders((s) => ({ ...s, opexStressFactor: v }))}
              />
              <button
                type="button"
                onClick={() => {
                  if (extendedOpex) {
                    // clamping back to standard range
                    setSliders((s) => ({
                      ...s,
                      opexStressFactor: Math.min(0.30, Math.max(-0.15, s.opexStressFactor)),
                    }));
                  }
                  setExtendedOpex((prev) => !prev);
                }}
                className="mt-1 text-xs text-brand-600 underline underline-offset-2 hover:text-brand-800"
              >
                {t("bank.sens.opexStressExtended")}
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-surface-tertiary/50">
              <button
                onClick={resetToBase}
                className="w-full px-4 py-2 text-sm font-medium text-text-secondary border border-surface-tertiary rounded-lg hover:bg-surface-secondary/50 hover:text-text-primary transition-colors"
              >
                {t("bank.sens.resetAll")}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: KPI table ──────────────────────────────────────── */}
        <div className="lg:w-3/5 self-start">
          <div className="bg-[#FEF3E2] rounded-xl border border-surface-tertiary p-5 sticky top-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary mb-4">
              {t("bank.sens.kpiHeading")}
            </h3>

            <KpiRow
              label="DSCR"
              subLabel={t("bank.sens.dscrSub")}
              value={kpis.dscr > 0 ? formatMultiple(kpis.dscr) : "—"}
              valueClass={dscrColor(kpis.dscr)}
              dotClass={dscrDot(kpis.dscr)}
            />

            <KpiRow
              label="LTV"
              subLabel={t("bank.sens.ltvSub")}
              value={kpis.ltv > 0 ? formatPercent(kpis.ltv, 0) : "—"}
              valueClass={ltvColor(kpis.ltv)}
              dotClass={ltvDot(kpis.ltv)}
            />

            <KpiRow
              label="ICR"
              subLabel={t("bank.sens.icrSub")}
              value={kpis.icr > 0 ? formatMultiple(kpis.icr) : "—"}
              valueClass={icrColor(kpis.icr)}
              dotClass={icrDot(kpis.icr)}
            />

            <KpiRow
              label="NOI / EBITDA"
              subLabel={t("bank.sens.noiSub")}
              value={kpis.noi !== 0 ? formatCurrency(kpis.noi, true, locale) : "—"}
              valueClass="text-text-primary"
              dotClass="bg-text-tertiary/40"
            />

            {/* Covenant legend */}
            <div className="mt-4 pt-4 border-t border-surface-tertiary/50 flex flex-wrap gap-x-5 gap-y-1.5">
              {[
                { dot: "bg-positive", label: "DSCR ≥ 1.25×  ·  LTV ≤ 60%  ·  ICR ≥ 2.0×" },
                { dot: "bg-warning", label: "DSCR 1.0–1.25×  ·  LTV 60–75%  ·  ICR 1.5–2.0×" },
                { dot: "bg-negative", label: "DSCR < 1.0×  ·  LTV > 75%  ·  ICR < 1.5×" },
              ].map(({ dot, label }) => (
                <div key={dot} className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
                  <span className={`w-2 h-2 rounded-full ${dot}`} />
                  {label}
                </div>
              ))}
            </div>

            {/* Active path note */}
            <p className="mt-4 text-[11px] text-text-tertiary">
              {t("bank.sens.pathNote")}: <span className="font-medium text-text-secondary">{pathLabel}</span>
            </p>
          </div>
        </div>

      </div>

      {/* CAPEX Sensitivity — construction cost/m² variation, financing-path aware */}
      <div className="bg-white rounded-xl border border-surface-tertiary p-5 mt-6">
      <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-1">
        {t('sens.capexSensitivity')}
      </h3>
      <p className="text-xs text-text-tertiary mb-4">
        {t('bank.sens.pathNote')}: <span className="font-medium text-text-secondary">{pathLabel}</span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-tertiary">
              <th className="text-left py-2 pr-4 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('sens.change')}</th>
              <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('term.capex')}</th>
              <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('kpi.annualDS')}</th>
              <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('sens.dscrStabilised')}</th>
              <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-text-tertiary font-medium">{t('pnl.ncfPostVAT')}</th>
            </tr>
          </thead>
          <tbody>
            {capexRows.map((row) => (
              <tr key={row.label} className={`border-b border-surface-secondary/50 ${row.isBase ? "bg-brand-50/50 font-medium" : ""}`}>
                <td className="py-2 pr-4">{row.label}</td>
                <td className="text-right py-2 px-3 font-mono text-xs">{formatCurrency(row.capex, true, locale)}</td>
                <td className="text-right py-2 px-3 font-mono text-xs">{formatCurrency(row.ds, true, locale)}</td>
                <td className={`text-right py-2 px-3 font-mono text-xs ${row.dscr >= 1.25 ? "text-positive" : row.dscr >= 1.0 ? "text-warning" : "text-negative"}`}>
                  {row.dscr > 0 ? formatMultiple(row.dscr) : "—"}
                </td>
                <td className={`text-right py-2 px-3 font-mono text-xs ${row.ncf >= 0 ? "text-positive" : "text-negative"}`}>
                  {formatCurrency(row.ncf, true, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    </div>
  );
}
