"use client";

import { useState, useCallback } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { BASE_CASE } from "@/lib/engine/defaults";

type InputDef = {
  label: string;
  path: string;
  historyLabel: string;
  type: "euro" | "percent" | "integer" | "multiple";
  min?: number;
  max?: number;
  step?: number;
};

const INPUTS: InputDef[] = [
  { label: "Villa ADR (€/night)", path: "revenueRealistic.villaADR", historyLabel: "Villa ADR", type: "euro", min: 100, max: 5000, step: 50 },
  { label: "Suite Standard ADR (€/night)", path: "revenueRealistic.suiteStandardADR", historyLabel: "Suite Standard ADR", type: "euro", min: 50, max: 3000, step: 25 },
  { label: "Suite Double ADR (€/night)", path: "revenueRealistic.suiteDoubleADR", historyLabel: "Suite Double ADR", type: "euro", min: 50, max: 3000, step: 25 },
  { label: "Villa base nights/year", path: "revenueRealistic.villaBaseNights", historyLabel: "Villa base nights", type: "integer", min: 60, max: 365, step: 5 },
  { label: "Suite base nights/year", path: "revenueRealistic.suiteBaseNights", historyLabel: "Suite base nights", type: "integer", min: 60, max: 365, step: 5 },
  { label: "Interest rate (%)", path: "commercialLoan.interestRate", historyLabel: "Loan interest rate", type: "percent", min: 0.01, max: 0.15, step: 0.0025 },
  { label: "Loan coverage rate (%)", path: "commercialLoan.loanCoverageRate", historyLabel: "Loan coverage rate", type: "percent", min: 0.30, max: 0.90, step: 0.01 },
  { label: "Exit EBITDA multiple (×)", path: "exitEbitdaMultiple", historyLabel: "Exit EBITDA multiple", type: "multiple", min: 4, max: 20, step: 0.5 },
];

function readNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function formatDisplay(val: number, type: InputDef["type"]): string {
  if (type === "percent") return `${(val * 100).toFixed(2)}%`;
  if (type === "euro") return `€${val.toLocaleString()}`;
  if (type === "multiple") return `${val.toFixed(1)}×`;
  return String(val);
}

export function BankStressTest() {
  const { t } = useTranslation();
  const { assumptions, setAssumption } = useModelStore();
  const [open, setOpen] = useState(true);
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  // Check if any assumption differs from BASE_CASE defaults
  const hasOverrides = INPUTS.some((inp) => {
    const current = readNestedValue(assumptions as unknown as Record<string, unknown>, inp.path);
    const base = readNestedValue(BASE_CASE as unknown as Record<string, unknown>, inp.path);
    return current !== base;
  });

  const getValue = useCallback((inp: InputDef): number => {
    const val = readNestedValue(assumptions as unknown as Record<string, unknown>, inp.path);
    return typeof val === "number" ? val : 0;
  }, [assumptions]);

  const handleBlur = useCallback((inp: InputDef, raw: string) => {
    const parsed = parseFloat(raw.replace(/[^0-9.-]/g, ""));
    if (!isFinite(parsed)) return;
    const actual = inp.type === "percent" ? parsed / 100 : parsed;
    const clamped = Math.min(
      Math.max(actual, inp.min ?? -Infinity),
      inp.max ?? Infinity,
    );
    setAssumption(inp.path, clamped, inp.historyLabel);
    setLocalValues((prev) => {
      const next = { ...prev };
      delete next[inp.path];
      return next;
    });
  }, [setAssumption]);

  const displayValue = (inp: InputDef): string => {
    if (inp.path in localValues) return localValues[inp.path];
    const v = getValue(inp);
    if (inp.type === "percent") return (v * 100).toFixed(2);
    if (inp.type === "multiple") return v.toFixed(1);
    return String(Math.round(v));
  };

  const baseValue = (inp: InputDef): string => {
    const v = readNestedValue(BASE_CASE as unknown as Record<string, unknown>, inp.path);
    return typeof v === "number" ? formatDisplay(v as number, inp.type) : "—";
  };

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/30 overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-brand-50/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">⚙️</span>
          <div>
            <div className="text-sm font-semibold text-text-primary flex items-center gap-2">
              {t('bank.stress.title')}
              {hasOverrides && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning/20 text-warning border border-warning/30">
                  Modified
                </span>
              )}
            </div>
            <div className="text-xs text-text-tertiary mt-0.5">
              {t('bank.stress.description')}
            </div>
          </div>
        </div>
        <span className={`text-text-tertiary transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-brand-200/60">
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {INPUTS.map((inp) => {
              const current = getValue(inp);
              const base = readNestedValue(BASE_CASE as unknown as Record<string, unknown>, inp.path);
              const changed = current !== base;
              return (
                <div key={inp.path} className={`rounded-xl border p-3 ${changed ? "border-warning/50 bg-warning/5" : "border-surface-tertiary bg-white"}`}>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    {inp.label}
                    {changed && (
                      <span className="ml-1.5 text-warning text-xs">✎</span>
                    )}
                  </label>
                  <input
                    type="number"
                    min={inp.type === "percent" ? (inp.min ?? 0) * 100 : inp.min}
                    max={inp.type === "percent" ? (inp.max ?? 1) * 100 : inp.max}
                    step={inp.type === "percent" ? (inp.step ?? 0.0025) * 100 : inp.step}
                    value={displayValue(inp)}
                    onChange={(e) =>
                      setLocalValues((prev) => ({ ...prev, [inp.path]: e.target.value }))
                    }
                    onBlur={(e) => handleBlur(inp, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-full rounded-lg border border-surface-tertiary px-3 py-1.5 text-sm font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                  />
                  <div className="text-xs text-text-tertiary mt-1 flex justify-between">
                    <span>Base: {baseValue(inp)}</span>
                    <span className="font-medium text-text-primary">
                      {formatDisplay(current, inp.type)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {hasOverrides && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => {
                  setLocalValues({});
                  INPUTS.forEach((inp) => {
                    const v = readNestedValue(BASE_CASE as unknown as Record<string, unknown>, inp.path);
                    if (typeof v === "number") setAssumption(inp.path, v, inp.historyLabel);
                  });
                }}
                className="px-4 py-2 rounded-xl border border-negative/40 text-negative text-sm font-medium hover:bg-negative/5 transition-colors"
              >
                Reset all to defaults
              </button>
              <p className="text-xs text-text-tertiary">
                Changes are applied to the live model above and included in the Excel export.
              </p>
            </div>
          )}

          {!hasOverrides && (
            <p className="mt-4 text-xs text-text-tertiary">
              All values are at their base-case defaults. Edit any field above and press Enter or Tab to apply.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
