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
  buildHoldScenario,
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

// ── Hold Period Panel ─────────────────────────────────────────────────────────

interface HoldColumn {
  exitYear: number;
  holdYears: number;
  labelKey: 'inv.sens.holdPanel.col5' | 'inv.sens.holdPanel.col7' | 'inv.sens.holdPanel.col11';
  irr: number;
  moic: number;
  isBase: boolean;
  loanActive: boolean;
}

interface HoldPeriodPanelProps {
  columns: HoldColumn[];
  t: (key: string) => string;
}

function HoldPeriodPanel({ columns, t }: HoldPeriodPanelProps) {
  return (
    <div className="bg-white rounded-xl border border-surface-tertiary p-5">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary mb-1">
        {t('inv.sens.holdPanel.heading')}
      </h3>
      <p className="text-xs text-text-secondary mb-4">{t('inv.sens.holdPanel.subheading')}</p>
      <div className="grid grid-cols-3 gap-3">
        {columns.map((col) => (
          <div
            key={col.exitYear}
            className={
              col.isBase
                ? "ring-2 ring-brand-400 rounded-xl bg-brand-50/40 p-4"
                : "bg-surface-secondary/30 rounded-xl p-4"
            }
          >
            {/* Column header */}
            <div className="mb-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className="text-sm font-bold text-text-primary">{t(col.labelKey)}</span>
                {col.isBase && (
                  <span className="bg-brand-50 text-brand-700 text-[9px] font-semibold rounded px-1.5 py-0.5">
                    {t('inv.sens.holdPanel.baseLabel')}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-text-tertiary">{col.exitYear}</p>
              {col.loanActive && (
                <p className="text-[10px] text-amber-600 mt-0.5">{t('inv.sens.holdPanel.tepixNote')}</p>
              )}
            </div>

            {/* IRR row */}
            <div className="mb-2">
              <p className="text-[10px] text-text-tertiary mb-0.5">{t('inv.sens.holdPanel.irrRow')}</p>
              <p className={`text-xl font-mono font-semibold tabular-nums ${irrColor(col.irr)}`}>
                {col.irr > 0 ? formatPercent(col.irr, 1) : '—'}
              </p>
            </div>

            {/* MOIC row */}
            <div>
              <p className="text-[10px] text-text-tertiary mb-0.5">{t('inv.sens.holdPanel.moicRow')}</p>
              <p className={`text-xl font-mono font-semibold tabular-nums ${moicColor(col.moic)}`}>
                {col.moic > 0 ? formatMultiple(col.moic) : '—'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hold column definitions (defined outside component — no re-creation per render) ──

const HOLD_COLUMNS = [
  { exitYear: 2031, holdYears: 2031 - 2029, labelKey: 'inv.sens.holdPanel.col5' as const },
  { exitYear: 2033, holdYears: 2033 - 2029, labelKey: 'inv.sens.holdPanel.col7' as const },
  { exitYear: 2037, holdYears: 2037 - 2029, labelKey: 'inv.sens.holdPanel.col11' as const, isBase: true as const },
] as const;

// ── Main component ────────────────────────────────────────────────────────────

export default function InvestorSensitivityTab() {
  const { t, locale } = useTranslation();
  const { assumptions, activeScenario } = useModelStore();

  const [sliders, setSliders] = useState<SliderValues>(() =>
    readBaseValues(assumptions)
  );

  function resetToBase() {
    setSliders(readBaseValues(assumptions));
  }

  const result = useMemo(() => {
    const modified = applySliders(assumptions, sliders);
    return computeModel(modified);
  }, [assumptions, sliders, activeScenario]);

  // Hold period comparison: both [assumptions, sliders] because operating
  // assumptions (occupancy, ADR) flow through, but each column's exitYear
  // is forced by buildHoldScenario regardless of sliders.exitYear.
  const holdComparisons = useMemo(() =>
    HOLD_COLUMNS.map(col => ({
      ...col,
      ...buildHoldScenario(assumptions, sliders, col.exitYear, activeScenario),
      isBase: ('isBase' in col && (col as { isBase?: boolean }).isBase) === true,
      loanActive: col.exitYear < 2037, // TEPIX III loan runs to HORIZON_END_YEAR (2037)
    })),
  [assumptions, sliders, activeScenario]);

  const realistic = result.scenarios[activeScenario];

  const equityIRR = realistic.equityIRR;
  const totalMOIC = realistic.totalMOIC;
  const yieldStabilised = realistic.yieldStabilised;
  const equityPaybackYears = realistic.equityPaybackYears;
  const terminalUnderwater = realistic.terminalUnderwater;

  const breakEvenNights = result.keyMetrics.breakEvenNights;
  const bufferToBreakEven = result.keyMetrics.bufferToBreakEven;

  const baseValues = readBaseValues(assumptions);

  const formatNights = (v: number) => String(Math.round(v));
  const formatADR = (v: number) => formatCurrency(v, false, locale);
  const formatExitYear = (v: number) => String(Math.round(v));
  const formatMultipleStr = (v: number) => `${v.toFixed(1)}×`;
  const formatPerM2 = (v: number) => formatCurrency(v, false, locale);

  // Buffer traffic-light thresholds
  const bufferDotClass =
    bufferToBreakEven >= 0.20 ? 'bg-positive' :
    bufferToBreakEven > 0.08  ? 'bg-warning' :
    bufferToBreakEven > 0     ? 'bg-negative' :
    'bg-text-tertiary/40';

  const bufferValueClass =
    bufferToBreakEven >= 0.20 ? 'text-positive' :
    bufferToBreakEven > 0.08  ? 'text-warning' :
    bufferToBreakEven > 0     ? 'text-negative' :
    'text-text-tertiary';

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
        <div className="lg:w-3/5 flex flex-col gap-4">
          {/* Main KPI card */}
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

          {/* ── Break-even card ─────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-surface-tertiary p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary mb-4">
              {t("inv.sens.breakEvenLabel")}
            </h3>

            <KpiRow
              label={t("inv.sens.breakEvenLabel")}
              subLabel={t("inv.sens.breakEvenSub")}
              value={breakEvenNights > 0 ? `${breakEvenNights} ${t("inv.sens.breakEvenUnit")}` : "—"}
              valueClass="text-text-primary"
              dotClass="bg-text-tertiary/40"
            />

            <KpiRow
              label={t("inv.sens.bufferLabel")}
              subLabel={t("inv.sens.bufferSub")}
              value={bufferToBreakEven > 0 ? formatPercent(bufferToBreakEven, 1) : "—"}
              valueClass={bufferValueClass}
              dotClass={bufferDotClass}
            />

            <p className="text-[10px] text-text-tertiary mt-3">
              {t("inv.sens.breakEvenBaseNote")}
            </p>
          </div>
        </div>

      </div>

      {/* ── Hold Period Comparison — full width below flex row ─────── */}
      <div className="mt-6">
        <HoldPeriodPanel
          columns={holdComparisons as HoldColumn[]}
          t={t as (key: string) => string}
        />
      </div>
    </div>
  );
}
