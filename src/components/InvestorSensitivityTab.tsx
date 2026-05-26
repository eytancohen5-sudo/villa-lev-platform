// TODO: add SENSITIVITY_TOUR step for InvestorSensitivityTab (bump storageKey to v3)
"use client";

import { useState, useMemo } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { computeModel } from "@/lib/engine/model";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import {
  type SliderValues,
  readBaseValues,
  applySliders,
  irrColor,
  irrDot,
  moicColor,
  moicDot,
  yieldColor,
  yieldDot,
} from "@/components/investorSensitivityHelpers";

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

export default function InvestorSensitivityTab() {
  const { t, locale } = useTranslation();
  const { assumptions } = useModelStore();

  const [sliders, setSliders] = useState<SliderValues>(() =>
    readBaseValues(assumptions)
  );

  function resetToBase() {
    setSliders(readBaseValues(assumptions));
  }

  const result = useMemo(() => {
    const modified = applySliders(assumptions, sliders);
    return computeModel(modified);
  }, [assumptions, sliders]);

  const realistic = result.scenarios.realistic;

  const equityIRR = realistic.equityIRR;
  const totalMOIC = realistic.totalMOIC;
  const yieldStabilised = realistic.yieldStabilised;
  const equityPaybackYears = realistic.equityPaybackYears;
  const terminalUnderwater = realistic.terminalUnderwater;

  const baseValues = readBaseValues(assumptions);

  const formatNights = (v: number) => String(Math.round(v));
  const formatADR = (v: number) => formatCurrency(v, false, locale);
  const formatExitYear = (v: number) => String(Math.round(v));
  const formatMultipleStr = (v: number) => `${v.toFixed(1)}×`;
  const formatPerM2 = (v: number) => formatCurrency(v, false, locale);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="font-display text-2xl text-text-primary mb-1">{t("inv.sens.title")}</h2>
        <p className="text-sm text-text-secondary">{t("inv.sens.subtitle")}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">

        {/* ── Left: Sliders ─────────────────────────────────────────── */}
        <div className="lg:w-2/5">
          <div className="bg-white rounded-xl border border-surface-tertiary p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary mb-4">
              {t("inv.sens.slidersHeading")}
            </h3>

            <SliderRow
              label={t("inv.sens.occupancy")}
              subLabel={t("inv.sens.occupancySub")}
              min={60}
              max={150}
              step={5}
              value={sliders.villaBaseNights}
              baseValue={baseValues.villaBaseNights}
              format={formatNights}
              onChange={(v) => setSliders((s) => ({ ...s, villaBaseNights: v }))}
              baseLabel={t("inv.sens.baseValue")}
            />

            <SliderRow
              label={t("inv.sens.adr")}
              subLabel={t("inv.sens.adrSub")}
              min={1500}
              max={6000}
              step={50}
              value={sliders.villaADR}
              baseValue={baseValues.villaADR}
              format={formatADR}
              onChange={(v) => setSliders((s) => ({ ...s, villaADR: v }))}
              baseLabel={t("inv.sens.baseValue")}
            />

            <SliderRow
              label={t("inv.sens.suiteAdr")}
              subLabel={t("inv.sens.suiteAdrSub")}
              min={1000}
              max={5000}
              step={50}
              value={sliders.suiteADR}
              baseValue={baseValues.suiteADR}
              format={formatADR}
              onChange={(v) => setSliders((s) => ({ ...s, suiteADR: v }))}
              baseLabel={t("inv.sens.baseValue")}
            />

            <SliderRow
              label={t("inv.sens.exitYear")}
              subLabel={t("inv.sens.exitYearSub")}
              min={2029}
              max={2040}
              step={1}
              value={sliders.exitYear}
              baseValue={baseValues.exitYear}
              format={formatExitYear}
              onChange={(v) => setSliders((s) => ({ ...s, exitYear: v }))}
              baseLabel={t("inv.sens.baseValue")}
            />

            <SliderRow
              label={t("inv.sens.exitMultiple")}
              subLabel={t("inv.sens.exitMultipleSub")}
              min={4}
              max={20}
              step={0.5}
              value={sliders.exitEbitdaMultiple}
              baseValue={baseValues.exitEbitdaMultiple}
              format={formatMultipleStr}
              onChange={(v) => setSliders((s) => ({ ...s, exitEbitdaMultiple: v }))}
              baseLabel={t("inv.sens.baseValue")}
            />

            <SliderRow
              label={t("inv.sens.perM2")}
              subLabel={t("inv.sens.perM2Sub")}
              min={5000}
              max={15000}
              step={500}
              value={sliders.exitValuationPerM2}
              baseValue={baseValues.exitValuationPerM2}
              format={formatPerM2}
              onChange={(v) => setSliders((s) => ({ ...s, exitValuationPerM2: v }))}
              baseLabel={t("inv.sens.baseValue")}
            />

            <div className="mt-4 pt-4 border-t border-surface-tertiary/50">
              <button
                onClick={resetToBase}
                className="w-full px-4 py-2 text-sm font-medium text-text-secondary border border-surface-tertiary rounded-lg hover:bg-surface-secondary/50 hover:text-text-primary transition-colors"
              >
                {t("inv.sens.resetAll")}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: KPI table ──────────────────────────────────────── */}
        <div className="lg:w-3/5">
          <div className="bg-white rounded-xl border border-surface-tertiary p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary mb-4">
              {t("inv.sens.kpiHeading")}
            </h3>

            <KpiRow
              label={t("inv.sens.irrLabel")}
              subLabel={t("inv.sens.irrSub")}
              value={equityIRR > 0 ? formatPercent(equityIRR, 1) : "—"}
              valueClass={irrColor(equityIRR)}
              dotClass={irrDot(equityIRR)}
            />

            <KpiRow
              label={t("inv.sens.moicLabel")}
              subLabel={t("inv.sens.moicSub")}
              value={totalMOIC > 0 ? formatMultiple(totalMOIC) : "—"}
              valueClass={moicColor(totalMOIC)}
              dotClass={moicDot(totalMOIC)}
            />

            <KpiRow
              label={t("inv.sens.yieldLabel")}
              subLabel={t("inv.sens.yieldSub")}
              value={yieldStabilised > 0 ? formatPercent(yieldStabilised, 1) : "—"}
              valueClass={yieldColor(yieldStabilised)}
              dotClass={yieldDot(yieldStabilised)}
            />

            <KpiRow
              label={t("inv.sens.paybackLabel")}
              subLabel={t("inv.sens.paybackSub")}
              value={equityPaybackYears != null ? `${equityPaybackYears} ${t("inv.sens.paybackUnit")}` : "—"}
              valueClass="text-text-primary"
              dotClass="bg-text-tertiary/40"
            />

            <KpiRow
              label={t("inv.sens.underwaterLabel")}
              subLabel={t("inv.sens.underwaterSub")}
              value={terminalUnderwater ? t("inv.sens.underwaterYes") : t("inv.sens.underwaterNo")}
              valueClass={terminalUnderwater ? "text-warning" : "text-positive"}
              dotClass={terminalUnderwater ? "bg-warning" : "bg-positive"}
            />

            {/* Traffic-light legend */}
            <div className="mt-4 pt-4 border-t border-surface-tertiary/50 flex flex-wrap gap-x-5 gap-y-1.5">
              {[
                { dot: "bg-positive", label: t("inv.sens.covenantLegend") },
              ].map(({ dot, label }) => (
                <div key={dot} className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
                  <span className={`w-2 h-2 rounded-full ${dot}`} />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
