"use client";

import { useModelStore } from "@/lib/store/modelStore";
import {
  formatCurrency,
  formatPercent,
  formatMultiple,
} from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { useState, useRef, useEffect, useCallback } from "react";
import { PageTour, TourButton, usePageTour } from "@/components/PageTour";
import { ASSUMPTIONS_TOUR } from "@/lib/tours/configs";
import { FinancingPath, PropertyTemplate, VillaRoom, CustomLine, CustomCapexLine, getPropertyDisplayType, computeTotalArea, computeVillaUnitArea, StaffRole, SharedServiceLine } from "@/lib/engine/types";
import { computeTotalKeysMaxSplit, computeTotalBedrooms } from "@/lib/engine/bedroomKeys";
import { resolvePortfolio } from "@/lib/engine/defaults";
import { computePortfolioOpex } from "@/lib/engine/model";
import { useEffectiveAuth } from "@/lib/data/useEffectiveAuth";
import { getDb } from "@/lib/firebase";
import {
  setReferenceScenarioId,
  subscribeReferenceScenarioId,
} from "@/lib/data/referenceScenario";

// ── Shared Components ──

function EditableCell({
  value,
  onChange,
  format = "number",
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  format?: "number" | "currency" | "percent";
  label?: string;
}) {
  const { locale } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const display =
    format === "currency"
      ? formatCurrency(value, false, locale)
      : format === "percent"
        ? formatPercent(value)
        : value.toLocaleString();

  const beginEditing = useCallback(() => {
    setInputValue(
      format === "percent" ? (value * 100).toString() : value.toString()
    );
    setEditing(true);
  }, [format, value]);

  if (editing) {
    return (
      <input
        type="number"
        aria-label={label ?? "Edit assumption"}
        className="w-full px-2 py-1 text-right data-cell bg-blue-50 border border-blue-300 rounded outline-none"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const parsed = parseFloat(inputValue);
          if (!isNaN(parsed)) {
            onChange(format === "percent" ? parsed / 100 : parsed);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        autoFocus
      />
    );
  }

  // Display state is a real <button> so it's keyboard-focusable (Tab) and
  // activatable via Enter/Space. Visually identical to the prior <div>.
  return (
    <button
      type="button"
      aria-label={
        label
          ? `${label} — current value ${display}. Press Enter or Space to edit.`
          : `Current value ${display}. Press Enter or Space to edit.`
      }
      className="w-full px-2 py-1 text-right data-cell bg-blue-50/50 rounded cursor-pointer hover:bg-blue-100/50 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
      onClick={beginEditing}
      onKeyDown={(e) => {
        // <button> already handles Enter/Space natively; we keep the
        // explicit handler so a future refactor to non-button keeps a11y.
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          beginEditing();
        }
      }}
    >
      {display}
    </button>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="font-display text-lg text-text-primary mt-8 mb-4 pb-2 border-b border-surface-tertiary">
      {title}
    </h3>
  );
}

function AssumptionRow({
  label,
  value,
  path,
  format = "number",
  note,
}: {
  label: string;
  value: number;
  path: string;
  format?: "number" | "currency" | "percent";
  note?: string;
}) {
  const { setAssumption } = useModelStore();
  return (
    <tr className="border-b border-surface-secondary/50">
      <td className="py-2 pr-4 text-sm text-text-secondary">{label}</td>
      <td className="py-2 w-36">
        <EditableCell
          value={value}
          format={format}
          label={label}
          onChange={(v) => setAssumption(path, v, label)}
        />
      </td>
      <td className="py-2 pl-4 text-xs text-text-tertiary">{note}</td>
    </tr>
  );
}

function ToggleRow({
  label,
  value,
  path,
  note,
}: {
  label: string;
  value: boolean;
  path: string;
  note?: string;
}) {
  const { setAssumption } = useModelStore();
  return (
    <tr className="border-b border-surface-secondary/50">
      <td className="py-2 pr-4 text-sm text-text-secondary">{label}</td>
      <td className="py-2 w-36">
        <button
          type="button"
          onClick={() => setAssumption(path, !value, label)}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            value
              ? "bg-positive/10 text-positive hover:bg-positive/20"
              : "bg-surface-tertiary text-text-tertiary hover:bg-surface-tertiary/70"
          }`}
        >
          {value ? "ON" : "OFF"}
        </button>
      </td>
      <td className="py-2 pl-4 text-xs text-text-tertiary">{note}</td>
    </tr>
  );
}

// ── Unit Stepper ──

function UnitStepper({
  label,
  value,
  onChange,
  color = "brand",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color?: "brand" | "blue" | "indigo";
}) {
  const colorMap = {
    brand: "text-brand-600",
    blue: "text-blue-600",
    indigo: "text-indigo-600",
  };
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className={`text-xs font-medium ${colorMap[color]}`}>{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => value > 0 && onChange(value - 1)}
          className="w-7 h-7 rounded-md border border-surface-tertiary bg-white text-text-secondary hover:bg-surface-tertiary flex items-center justify-center text-sm transition-colors"
        >
          &minus;
        </button>
        <div className="w-10 h-7 rounded-md border border-surface-tertiary bg-white flex items-center justify-center font-mono text-sm font-bold">
          {value}
        </div>
        <button
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 rounded-md border border-surface-tertiary bg-white text-text-secondary hover:bg-surface-tertiary flex items-center justify-center text-sm transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ── Template Card ──

// Controllable OPEX keys — the fields the engine actually sums as annual costs.
// Deprecated fields (managementFee, maintenance) and the FF&E reserve floor
// parameter (ffeReserveFloor) are excluded from display and from the OPEX total.
const OPEX_CONTROLLABLE_KEYS = new Set([
  'housekeeping', 'utilities', 'insurance', 'propertyTax',
  'marketing', 'consumables', 'accounting',
]);

function TemplateCard({ tpl, startExpanded = false, highlight = false }: { tpl: PropertyTemplate; startExpanded?: boolean; highlight?: boolean }) {
  const { locale, t } = useTranslation();
  const { updateTemplate, renameTemplate, duplicateTemplate, deleteTemplate, projects, model,
    addOpexLine, removeOpexLine, updateOpexLine,
    addCapexLine, removeCapexLine, updateCapexLine } =
    useModelStore();
  const [expanded, setExpanded] = useState(startExpanded);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(tpl.name);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlight && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlight]);

  const inUse = projects.some((p) => p.templateId === tpl.id);
  const projectCount = projects.filter((p) => p.templateId === tpl.id).length;
  const tplProject = projects.find((p) => p.templateId === tpl.id);

  const totalArea = computeTotalArea(tpl.roomAreas, {
    villaUnits: tpl.villaUnits,
    standardSuites: tpl.standardSuites,
    doubleSuites: tpl.doubleSuites,
  });
  const constructionCost = totalArea * tpl.constructionCostPerM2;
  const contingencyAmount = (constructionCost + tpl.ffeCost) * tpl.contingencyRate;
  const capexPerUnit =
    tpl.landCost +
    constructionCost +
    tpl.ffeCost +
    tpl.legalFees +
    tpl.architectFees +
    tpl.civilEngineerFees +
    contingencyAmount +
    (tpl.extraCapexLines ?? []).reduce((s, l) => s + l.cost, 0);

  const rawOpex = Object.entries(tpl.opex)
    .filter(([k]) => OPEX_CONTROLLABLE_KEYS.has(k))
    .reduce((s, [, v]) => s + (v as number), 0)
    + (tpl.extraOpexLines ?? []).reduce((s, l) => s + l.value, 0);
  const totalOpex = rawOpex * (1 + (tpl.opexContingencyRate ?? 0));

  return (
    <div ref={cardRef} className={`bg-white rounded-xl border overflow-hidden transition-all ${
      tpl.builtIn ? 'border-surface-tertiary' : 'border-brand-300'
    } ${highlight ? 'ring-2 ring-brand-500 ring-offset-2 animate-pulse' : ''}`}>
      {/* Header — clickable to expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 bg-surface-secondary/30 hover:bg-surface-secondary/50 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${getPropertyDisplayType(tpl) === 'villa' ? 'bg-brand-600' : getPropertyDisplayType(tpl) === 'mixed' ? 'bg-purple-500' : 'bg-info'}`} />
          <span className="text-sm font-semibold text-text-primary">
            {tpl.name}
          </span>
          {(() => {
            const dt = getPropertyDisplayType(tpl);
            const label = dt === 'mixed' ? 'Mixed' : dt === 'villa' ? 'Villa' : 'Suite';
            const cls = dt === 'mixed' ? 'bg-purple-100 text-purple-700' : dt === 'villa' ? 'bg-brand-100 text-brand-700' : 'bg-blue-100 text-blue-700';
            return <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
          })()}
          {tpl.builtIn && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface-tertiary text-text-tertiary">
              Built-in
            </span>
          )}
          {!tpl.builtIn && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">
              Custom
            </span>
          )}
          {inUse && (
            <span className="text-xs text-positive bg-positive/10 px-2 py-0.5 rounded-full">
              Used in {projectCount} project{projectCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-tertiary font-mono">
            {formatCurrency(capexPerUnit, true, locale)}/unit
          </span>
          <span className={`text-sm transition-transform ${expanded ? 'rotate-180' : ''}`}>
            &#9660;
          </span>
        </div>
      </button>

      {/* Expanded: Full editable details */}
      {expanded && (
        <div className="border-t border-surface-secondary/50">
          {/* Action bar */}
          <div className="px-5 py-3 bg-surface-secondary/20 flex items-center justify-between border-b border-surface-secondary/30">
            <div className="flex items-center gap-4 text-xs text-text-tertiary">
              <span>{totalArea}m² &middot; {formatCurrency(tpl.constructionCostPerM2, false, locale)}/m²</span>
              <span>Land: {formatCurrency(tpl.landCost, false, locale)}</span>
              <span>Controllable OPEX/yr: {formatCurrency(totalOpex, true, locale)}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Rename */}
              {!tpl.builtIn && (
                editingName ? (
                  <input
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onBlur={() => {
                      setEditingName(false);
                      if (nameValue.trim()) renameTemplate(tpl.id, nameValue.trim());
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') { setEditingName(false); setNameValue(tpl.name); }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="px-2 py-1 rounded border border-brand-500/30 text-xs focus:outline-none w-40"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => { setEditingName(true); setNameValue(tpl.name); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-secondary text-text-secondary hover:bg-surface-tertiary transition-colors"
                  >
                    Rename
                  </button>
                )
              )}
              <button
                onClick={() => duplicateTemplate(tpl.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600/10 text-brand-600 hover:bg-brand-600/20 transition-colors"
              >
                Duplicate as Custom
              </button>
              {!tpl.builtIn && (
                <button
                  onClick={() => {
                    if (inUse) {
                      useModelStore.getState().requestConfirm({
                        title: `Delete ${tpl.name}?`,
                        message: `This template is used by ${projectCount} project${projectCount > 1 ? 's' : ''}. Removing the template will also delete those project${projectCount > 1 ? 's' : ''} from the portfolio. This cannot be undone.`,
                        confirmLabel: 'Delete template & projects',
                        danger: true,
                        onConfirm: () => deleteTemplate(tpl.id),
                      });
                    } else {
                      deleteTemplate(tpl.id);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-negative hover:bg-red-100 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Editable fields */}
          <div className="px-5 py-5">
            <p className="text-xs text-text-tertiary mb-4">
              Click any value to edit it. Changes apply to all projects using this template.
            </p>

            {/* Unit Mix */}
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-brand-50/50 to-blue-50/50 border border-surface-tertiary">
              <h4 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3">Unit Mix (per plot)</h4>
              <div className="grid grid-cols-3 gap-4">
                <UnitStepper
                  label="Villa Units"
                  value={tpl.villaUnits}
                  onChange={(v) => updateTemplate(tpl.id, 'villaUnits', v)}
                  color="brand"
                />
                <UnitStepper
                  label="Standard Suites"
                  value={tpl.standardSuites}
                  onChange={(v) => updateTemplate(tpl.id, 'standardSuites', v)}
                  color="blue"
                />
                <UnitStepper
                  label="Double Suites"
                  value={tpl.doubleSuites}
                  onChange={(v) => updateTemplate(tpl.id, 'doubleSuites', v)}
                  color="indigo"
                />
              </div>
              {/* Bedroom / key topology */}
              <table className="w-full mt-3">
                <tbody>
                  {tpl.standardSuites > 0 && (
                    <TemplateRow label={t('tpl.bedroomsPerStandard')} value={tpl.bedroomsPerStandard ?? 1}
                      tplId={tpl.id} path="bedroomsPerStandard" format="number" />
                  )}
                  {tpl.doubleSuites > 0 && (
                    <TemplateRow label={t('tpl.bedroomsPerDouble')} value={tpl.bedroomsPerDouble ?? 2}
                      tplId={tpl.id} path="bedroomsPerDouble" format="number" />
                  )}
                  {tpl.villaUnits > 0 && (
                    <TemplateRow label={t('tpl.bedroomsInMain')} value={tpl.bedroomsInMain ?? 4}
                      tplId={tpl.id} path="bedroomsInMain" format="number" />
                  )}
                  {tpl.villaUnits > 0 && (
                    <TemplateRow label={t('tpl.lockableSubUnits')} value={tpl.lockableSubUnits ?? 3}
                      tplId={tpl.id} path="lockableSubUnits" format="number" />
                  )}
                  {tpl.villaUnits > 0 && (
                    <TemplateRow label={t('tpl.bedroomsPerSubUnit')} value={tpl.bedroomsPerSubUnit ?? 1}
                      tplId={tpl.id} path="bedroomsPerSubUnit" format="number" />
                  )}
                </tbody>
              </table>
              {(tpl.standardSuites > 0 || tpl.doubleSuites > 0) && (
                <p className="text-[10px] text-text-tertiary mt-1">
                  {t('tpl.totalBedroomsPerPlot')}: {tpl.standardSuites * (tpl.bedroomsPerStandard ?? 1) + tpl.doubleSuites * (tpl.bedroomsPerDouble ?? 2)}
                </p>
              )}
              {tpl.villaUnits > 0 && (
                <p className="text-[10px] text-text-tertiary mt-1">
                  {t('tpl.totalBedroomsPerVilla')}: {(tpl.bedroomsInMain ?? 4) + (tpl.lockableSubUnits ?? 3) * (tpl.bedroomsPerSubUnit ?? 1)}
                  {' · '}{t('tpl.keysAtMaxSplit')}: {1 + (tpl.lockableSubUnits ?? 3)}
                </p>
              )}
              <p className="text-[10px] text-text-tertiary mt-2">
                {t('tpl.totalUnitsPerPlot')}: {tpl.villaUnits + tpl.standardSuites + tpl.doubleSuites}
                {tpl.villaUnits > 0 && tpl.standardSuites + tpl.doubleSuites > 0 && <> ({t('tpl.mixedUse')})</>}
              </p>
            </div>

            {/* Space Distribution */}
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-emerald-50/60 to-teal-50/60 border border-surface-tertiary">
              <h4 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3">Space Distribution (m² per plot)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Accommodation rooms */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 mb-2">Accommodation Rooms</p>
                  {tpl.villaUnits > 0 && (
                    <div className="mb-3">
                      <p className="text-[11px] text-text-tertiary mb-1">Per villa (×{tpl.villaUnits} {tpl.villaUnits > 1 ? 'villas' : 'villa'})</p>
                      <table className="w-full">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wider text-text-tertiary">
                            <th className="text-left font-medium py-1 pr-2">Room</th>
                            <th className="text-right font-medium py-1 w-14">Qty</th>
                            <th className="text-right font-medium py-1 w-24">m² each</th>
                            <th className="w-6"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(tpl.roomAreas.villaRooms ?? []).map((vr) => (
                            <VillaRoomRow key={vr.id} tplId={tpl.id} room={vr} />
                          ))}
                          {(tpl.roomAreas.villaRooms ?? []).length === 0 && (
                            <tr><td colSpan={4} className="py-2 text-xs text-text-tertiary italic">No rooms defined — add one to break the villa down.</td></tr>
                          )}
                        </tbody>
                      </table>
                      <div className="mt-1 flex items-baseline justify-between text-[11px]">
                        <button
                          onClick={() => useModelStore.getState().addVillaRoom(tpl.id)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          + Add room
                        </button>
                        <span className="text-text-tertiary">
                          Per villa: <span className="font-mono font-semibold text-text-primary">{computeVillaUnitArea(tpl.roomAreas).toLocaleString()}m²</span>
                        </span>
                      </div>
                    </div>
                  )}
                  <table className="w-full">
                    <tbody>
                      {tpl.standardSuites > 0 && (
                        <TemplateRow
                          label={`Standard suite (×${tpl.standardSuites})`}
                          value={tpl.roomAreas.standardSuiteArea}
                          tplId={tpl.id}
                          path="roomAreas.standardSuiteArea"
                        />
                      )}
                      {tpl.doubleSuites > 0 && (
                        <TemplateRow
                          label={`Double suite (×${tpl.doubleSuites})`}
                          value={tpl.roomAreas.doubleSuiteArea}
                          tplId={tpl.id}
                          path="roomAreas.doubleSuiteArea"
                        />
                      )}
                      {tpl.villaUnits + tpl.standardSuites + tpl.doubleSuites === 0 && (
                        <tr>
                          <td className="py-2 text-xs text-text-tertiary italic">No accommodation units in this template</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Common spaces */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700 mb-2">Common Spaces</p>
                  <table className="w-full">
                    <tbody>
                      <TemplateRow label="Kitchen" value={tpl.roomAreas.kitchen} tplId={tpl.id} path="roomAreas.kitchen" />
                      <TemplateRow label="Living / lounge" value={tpl.roomAreas.livingRoom} tplId={tpl.id} path="roomAreas.livingRoom" />
                      <TemplateRow label="Utility / storage" value={tpl.roomAreas.utilityRoom} tplId={tpl.id} path="roomAreas.utilityRoom" />
                      <TemplateRow label="Staff quarters" value={tpl.roomAreas.staffRoom} tplId={tpl.id} path="roomAreas.staffRoom" />
                      <TemplateRow label="Corridors / lobby" value={tpl.roomAreas.corridors} tplId={tpl.id} path="roomAreas.corridors" />
                      {(tpl.roomAreas.customSpaces ?? []).map((cs) => (
                        <CustomSpaceRow key={cs.id} tplId={tpl.id} space={cs} />
                      ))}
                    </tbody>
                  </table>
                  <button
                    onClick={() => useModelStore.getState().addCustomSpace(tpl.id)}
                    className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    + Add custom space
                  </button>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-emerald-200/60 flex justify-between items-baseline text-sm">
                <span className="font-medium text-text-secondary">Total built area</span>
                <span className="font-mono font-bold text-emerald-700 text-lg">{totalArea.toLocaleString()}m²</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CAPEX */}
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3">CAPEX Parameters</h4>
                <table className="w-full">
                  <tbody>
                    <TemplateRow label="Land cost" value={tpl.landCost} tplId={tpl.id} path="landCost" format="currency" />
                    <tr className="border-b border-surface-secondary/30">
                      <td className="py-1.5 pr-3 text-xs text-text-secondary">Total area (m²)</td>
                      <td className="py-1.5 w-28 text-right px-2 font-mono text-xs text-text-tertiary">
                        {totalArea.toLocaleString()}
                      </td>
                    </tr>
                    <TemplateRow label="Cost per m²" value={tpl.constructionCostPerM2} tplId={tpl.id} path="constructionCostPerM2" format="currency" />
                    <tr className="border-b border-surface-secondary/30">
                      <td className="py-1.5 pr-3 text-xs text-text-secondary">Construction cost</td>
                      <td className="py-1.5 w-28 text-right px-2 font-mono text-xs text-text-tertiary">
                        {formatCurrency(constructionCost, false, locale)}
                      </td>
                    </tr>
                    <TemplateRow label="FF&E" value={tpl.ffeCost} tplId={tpl.id} path="ffeCost" format="currency" />
                    <FfePerM2Row tpl={tpl} totalArea={totalArea} />
                    <TemplateRow label="Legal & notary" value={tpl.legalFees} tplId={tpl.id} path="legalFees" format="currency" />
                    <TemplateRow label="Architect + design" value={tpl.architectFees} tplId={tpl.id} path="architectFees" format="currency" />
                    <TemplateRow label="Civil engineer" value={tpl.civilEngineerFees} tplId={tpl.id} path="civilEngineerFees" format="currency" />
                    <TemplateRow label="Contingency rate" value={tpl.contingencyRate} tplId={tpl.id} path="contingencyRate" format="percent" />
                    <tr className="border-b border-surface-secondary/30">
                      <td className="py-1.5 pr-3 text-xs text-text-secondary italic">Contingency amount</td>
                      <td className="py-1.5 w-28 text-right px-2 font-mono text-xs text-text-tertiary italic">
                        {formatCurrency(contingencyAmount, false, locale)}
                      </td>
                    </tr>
                    {(tpl.extraCapexLines ?? []).map((line) => (
                      <CustomCapexRow key={line.id} tplId={tpl.id} line={line} />
                    ))}
                  </tbody>
                </table>
                <button
                  onClick={() => addCapexLine(tpl.id)}
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  {t('tpl.addCapexLine')}
                </button>
                <div className="mt-2 pt-2 border-t border-surface-secondary/50 flex justify-between text-xs">
                  <span className="font-medium text-text-secondary">Total CAPEX/unit</span>
                  <span className="font-mono font-semibold text-text-primary">{formatCurrency(capexPerUnit, true, locale)}</span>
                </div>
              </div>

              {/* OPEX */}
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3">Annual OPEX (per unit)</h4>
                <table className="w-full">
                  <tbody>
                    {Object.entries(tpl.opex)
                      .filter(([key]) => OPEX_CONTROLLABLE_KEYS.has(key))
                      .map(([key, val]) => (
                        <TemplateRow
                          key={key}
                          label={key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                          value={val as number}
                          tplId={tpl.id}
                          path={`opex.${key}`}
                          format="currency"
                        />
                      ))}
                    {(tpl.extraOpexLines ?? []).map((line) => (
                      <CustomOpexRow key={line.id} tplId={tpl.id} line={line} />
                    ))}
                  </tbody>
                </table>
                <button
                  onClick={() => addOpexLine(tpl.id)}
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  {t('tpl.addOpexLine')}
                </button>
                <table className="w-full">
                  <tbody>
                    <TemplateRow
                      label={t('field.opexContingencyRate')}
                      value={tpl.opexContingencyRate ?? 0}
                      tplId={tpl.id}
                      path="opexContingencyRate"
                      format="percent"
                    />
                    <tr className="border-b border-surface-secondary/30">
                      <td className="py-1.5 pr-3 text-xs text-text-secondary italic">Contingency amount</td>
                      <td className="py-1.5 w-28 text-right px-2 font-mono text-xs text-text-tertiary italic">
                        {formatCurrency(totalOpex - rawOpex, false, locale)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="mt-2 pt-2 border-t border-surface-secondary/50 flex justify-between text-xs">
                  <span className="font-medium text-text-secondary">Controllable OPEX/yr</span>
                  <span className="font-mono font-semibold text-text-primary">{formatCurrency(totalOpex, true, locale)}</span>
                </div>

                {/* FF&E Reserve floor + combined total */}
                <div className="mt-4 pt-3 border-t border-amber-200/60">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-2">FF&amp;E Reserve (engine-computed)</p>
                  <table className="w-full">
                    <tbody>
                      <TemplateRow
                        label="Reserve floor (€/yr)"
                        value={tpl.opex.ffeReserveFloor ?? 0}
                        tplId={tpl.id}
                        path="opex.ffeReserveFloor"
                        format="currency"
                      />
                    </tbody>
                  </table>
                  <p className="text-[10px] text-text-tertiary mt-1.5 leading-relaxed">
                    Engine computes <span className="font-mono bg-amber-50 px-1 rounded">max(floor, rate × revenue)</span> and adds it on top of controllable OPEX. Edit rates in the <strong>OPEX tab</strong>.
                  </p>

                  {/* Combined total — pulls 2031 stabilised engine value if project exists */}
                  {(() => {
                    const bd2031 = tplProject
                      ? model?.scenarios.realistic.pnl.find((r) => r.year === 2031)?.propertyBreakdown.find((b) => b.id === tplProject.id)
                      : null;
                    const combinedTotal = bd2031
                      ? bd2031.opexPerUnit
                      : totalOpex + (tpl.opex.ffeReserveFloor ?? 0);
                    const label = bd2031 ? 'Total OPEX incl. FF&E (2031, stabilised)' : 'Total OPEX incl. FF&E (floor estimate)';
                    return (
                      <div className="mt-3 pt-2 border-t border-amber-200/60 flex justify-between items-baseline">
                        <span className="text-xs font-semibold text-amber-800">{label}</span>
                        <span className="font-mono font-bold text-amber-900 text-sm">{formatCurrency(combinedTotal, true, locale)}/unit</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateRow({
  label,
  value,
  tplId,
  path,
  format = "number",
}: {
  label: string;
  value: number;
  tplId: string;
  path: string;
  format?: "number" | "currency" | "percent";
}) {
  const { updateTemplate } = useModelStore();
  return (
    <tr className="border-b border-surface-secondary/30">
      <td className="py-1.5 pr-3 text-xs text-text-secondary">{label}</td>
      <td className="py-1.5 w-28">
        <EditableCell
          value={value}
          format={format}
          onChange={(v) => updateTemplate(tplId, path, v, label)}
        />
      </td>
    </tr>
  );
}

// FF&E per m² — derived from ffeCost / totalArea. Editing it back-computes
// ffeCost = perM² × totalArea so the engine still reads a single ffeCost field.
function FfePerM2Row({ tpl, totalArea }: { tpl: PropertyTemplate; totalArea: number }) {
  const { updateTemplate } = useModelStore();
  const perM2 = totalArea > 0 ? tpl.ffeCost / totalArea : 0;
  return (
    <tr className="border-b border-surface-secondary/30">
      <td className="py-1.5 pr-3 text-xs text-text-tertiary italic">FF&E per m²</td>
      <td className="py-1.5 w-28">
        <EditableCell
          value={perM2}
          format="currency"
          onChange={(v) => {
            if (totalArea <= 0) return;
            updateTemplate(tpl.id, 'ffeCost', Math.round(v * totalArea), 'FF&E per m²');
          }}
        />
      </td>
    </tr>
  );
}

// Editable row for one type of room inside a single villa — name + count + m² each + remove button.
function VillaRoomRow({ tplId, room }: { tplId: string; room: VillaRoom }) {
  const { updateVillaRoom, removeVillaRoom } = useModelStore();
  return (
    <tr className="border-b border-surface-secondary/30">
      <td className="py-1.5 pr-2">
        <input
          type="text"
          value={room.name}
          onChange={(e) => updateVillaRoom(tplId, room.id, 'name', e.target.value)}
          className="w-full px-2 py-1 text-xs bg-emerald-50/40 border border-emerald-200/60 rounded focus:outline-none focus:border-emerald-400"
          placeholder="Room name"
        />
      </td>
      <td className="py-1.5 w-14">
        <EditableCell
          value={room.count}
          format="number"
          onChange={(v) => updateVillaRoom(tplId, room.id, 'count', Math.max(0, Math.round(v)))}
        />
      </td>
      <td className="py-1.5 w-24">
        <EditableCell
          value={room.area}
          format="number"
          onChange={(v) => updateVillaRoom(tplId, room.id, 'area', v)}
        />
      </td>
      <td className="py-1.5 pl-2 w-6">
        <button
          onClick={() => removeVillaRoom(tplId, room.id)}
          className="w-6 h-6 rounded text-text-tertiary hover:bg-red-50 hover:text-negative transition-colors text-sm"
          title="Remove room"
        >
          &times;
        </button>
      </td>
    </tr>
  );
}

// Editable row for a user-named common space — name + m² + remove button.
function CustomSpaceRow({ tplId, space }: { tplId: string; space: { id: string; name: string; area: number } }) {
  const { updateCustomSpace, removeCustomSpace } = useModelStore();
  return (
    <tr className="border-b border-surface-secondary/30">
      <td className="py-1.5 pr-3">
        <input
          type="text"
          value={space.name}
          onChange={(e) => updateCustomSpace(tplId, space.id, 'name', e.target.value)}
          className="w-full px-2 py-1 text-xs bg-emerald-50/40 border border-emerald-200/60 rounded focus:outline-none focus:border-emerald-400"
          placeholder="Space name"
        />
      </td>
      <td className="py-1.5 w-28">
        <EditableCell
          value={space.area}
          format="number"
          onChange={(v) => updateCustomSpace(tplId, space.id, 'area', v)}
        />
      </td>
      <td className="py-1.5 pl-2 w-6">
        <button
          onClick={() => removeCustomSpace(tplId, space.id)}
          className="w-6 h-6 rounded text-text-tertiary hover:bg-red-50 hover:text-negative transition-colors text-sm"
          title="Remove space"
        >
          &times;
        </button>
      </td>
    </tr>
  );
}

// Editable row for a custom annual OPEX line — name + value + remove button.
function CustomOpexRow({ tplId, line }: { tplId: string; line: CustomLine }) {
  const { t } = useTranslation();
  const { updateOpexLine, removeOpexLine } = useModelStore();
  return (
    <tr className="border-b border-surface-secondary/30">
      <td className="py-1.5 pr-3">
        <input
          type="text"
          value={line.name}
          onChange={(e) => updateOpexLine(tplId, line.id, 'name', e.target.value)}
          className="w-full px-2 py-1 text-xs bg-blue-50/40 border border-blue-200/60 rounded focus:outline-none focus:border-blue-400"
          placeholder={t('tpl.opexLineName')}
        />
      </td>
      <td className="py-1.5 w-28">
        <EditableCell
          value={line.value}
          format="currency"
          onChange={(v) => updateOpexLine(tplId, line.id, 'value', v)}
        />
      </td>
      <td className="py-1.5 pl-2 w-6">
        <button
          onClick={() => removeOpexLine(tplId, line.id)}
          className="w-6 h-6 rounded text-text-tertiary hover:bg-red-50 hover:text-negative transition-colors text-sm"
          title={t('tpl.removeOpexLine')}
        >
          &times;
        </button>
      </td>
    </tr>
  );
}

// Editable row for a custom one-off CAPEX line — name + cost + remove button.
function CustomCapexRow({ tplId, line }: { tplId: string; line: CustomCapexLine }) {
  const { t } = useTranslation();
  const { updateCapexLine, removeCapexLine } = useModelStore();
  return (
    <tr className="border-b border-surface-secondary/30">
      <td className="py-1.5 pr-3">
        <input
          type="text"
          value={line.name}
          onChange={(e) => updateCapexLine(tplId, line.id, 'name', e.target.value)}
          className="w-full px-2 py-1 text-xs bg-blue-50/40 border border-blue-200/60 rounded focus:outline-none focus:border-blue-400"
          placeholder={t('tpl.capexLineName')}
        />
      </td>
      <td className="py-1.5 w-28">
        <EditableCell
          value={line.cost}
          format="currency"
          onChange={(v) => updateCapexLine(tplId, line.id, 'cost', v)}
        />
      </td>
      <td className="py-1.5 pl-2 w-6">
        <button
          onClick={() => removeCapexLine(tplId, line.id)}
          className="w-6 h-6 rounded text-text-tertiary hover:bg-red-50 hover:text-negative transition-colors text-sm"
          title={t('tpl.removeCapexLine')}
        >
          &times;
        </button>
      </td>
    </tr>
  );
}

// ── Project Card ──

function ProjectCard({ projId }: { projId: string }) {
  const { locale } = useTranslation();
  const {
    projects,
    templates,
    removeProject,
    updateProjectCount,
    changeProjectTemplate,
    renameProject,
  } = useModelStore();
  const proj = projects.find((p) => p.id === projId);
  if (!proj) return null;

  const tpl = templates.find((t) => t.id === proj.templateId);
  const canRemove = projects.length > 1;

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(proj.name);

  const tplArea = tpl
    ? computeTotalArea(tpl.roomAreas, { villaUnits: tpl.villaUnits, standardSuites: tpl.standardSuites, doubleSuites: tpl.doubleSuites })
    : 0;
  const capexPerUnit = tpl
    ? tpl.landCost +
      tplArea * tpl.constructionCostPerM2 +
      tpl.ffeCost +
      tpl.legalFees +
      tpl.architectFees +
      tpl.civilEngineerFees +
      (tplArea * tpl.constructionCostPerM2 + tpl.ffeCost) * tpl.contingencyRate
    : 0;

  return (
    <div className="bg-white rounded-xl border border-surface-tertiary overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${tpl ? (getPropertyDisplayType(tpl) === 'villa' ? 'bg-brand-600' : getPropertyDisplayType(tpl) === 'mixed' ? 'bg-purple-500' : 'bg-info') : 'bg-gray-400'}`} />

          {editingName ? (
            <input
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={() => {
                setEditingName(false);
                if (nameValue.trim()) renameProject(proj.id, nameValue.trim());
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') { setEditingName(false); setNameValue(proj.name); }
              }}
              className="px-2 py-0.5 rounded border border-brand-500/30 text-sm font-medium focus:outline-none"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setEditingName(true); setNameValue(proj.name); }}
              className="text-sm font-semibold text-text-primary hover:text-brand-600 transition-colors"
            >
              {proj.name}
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Template selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-tertiary uppercase tracking-wider">Template</label>
            <select
              value={proj.templateId}
              onChange={(e) => changeProjectTemplate(proj.id, e.target.value)}
              className="text-sm px-3 py-1.5 rounded-lg border border-surface-tertiary bg-surface-secondary/30 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({getPropertyDisplayType(t)})
                </option>
              ))}
            </select>
          </div>

          {/* Count stepper */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-tertiary uppercase tracking-wider mr-1">Units</span>
            <button
              onClick={() => proj.count > 0 && updateProjectCount(proj.id, proj.count - 1)}
              className="w-7 h-7 rounded-md border border-surface-tertiary bg-white text-text-secondary hover:bg-surface-tertiary flex items-center justify-center text-sm transition-colors"
            >
              &minus;
            </button>
            <div className="w-8 h-7 rounded-md border border-surface-tertiary bg-white flex items-center justify-center font-mono text-sm font-semibold">
              {proj.count}
            </div>
            <button
              onClick={() => updateProjectCount(proj.id, proj.count + 1)}
              className="w-7 h-7 rounded-md border border-surface-tertiary bg-white text-text-secondary hover:bg-surface-tertiary flex items-center justify-center text-sm transition-colors"
            >
              +
            </button>
          </div>

          {canRemove && (
            <button
              onClick={() => removeProject(proj.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-negative hover:bg-red-100 transition-colors"
              title="Remove project"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Summary line */}
      {tpl && (
        <div className="px-5 py-2 flex items-center gap-6 text-xs text-text-tertiary border-t border-surface-secondary/30 bg-surface-secondary/20">
          <span>{tplArea}m² &middot; {tpl.villaUnits > 0 ? `${tpl.villaUnits}V` : ''}{tpl.standardSuites > 0 ? `${tpl.villaUnits > 0 ? '+' : ''}${tpl.standardSuites}S` : ''}{tpl.doubleSuites > 0 ? `+${tpl.doubleSuites}D` : ''}</span>
          <span>CAPEX/unit: {formatCurrency(capexPerUnit, true, locale)}</span>
          <span className="font-medium text-text-secondary">
            Total: {formatCurrency(capexPerUnit * proj.count, true, locale)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Add Project Panel ──

function AddProjectPanel() {
  const { templates, addProject } = useModelStore();
  const { locale } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);

  if (!showPicker) {
    return (
      <button
        onClick={() => setShowPicker(true)}
        className="w-full py-4 rounded-xl border-2 border-dashed border-brand-300 text-brand-600 text-sm font-medium hover:bg-brand-50 hover:border-brand-500 transition-all"
      >
        + Add Project
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border-2 border-brand-300 p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-text-primary">Select a property template</h4>
        <button
          onClick={() => setShowPicker(false)}
          className="text-xs text-text-tertiary hover:text-text-primary"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((tpl) => {
          const area = computeTotalArea(tpl.roomAreas, { villaUnits: tpl.villaUnits, standardSuites: tpl.standardSuites, doubleSuites: tpl.doubleSuites });
          const capex =
            tpl.landCost +
            area * tpl.constructionCostPerM2 +
            tpl.ffeCost +
            tpl.legalFees +
            tpl.architectFees +
            tpl.civilEngineerFees +
            (area * tpl.constructionCostPerM2 + tpl.ffeCost) * tpl.contingencyRate;

          return (
            <button
              key={tpl.id}
              onClick={() => {
                addProject(tpl.id);
                setShowPicker(false);
              }}
              className="text-left p-4 rounded-xl border border-surface-tertiary hover:border-brand-400 hover:bg-brand-50/50 transition-all group"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2.5 h-2.5 rounded-full ${getPropertyDisplayType(tpl) === 'villa' ? 'bg-brand-600' : getPropertyDisplayType(tpl) === 'mixed' ? 'bg-purple-500' : 'bg-info'}`} />
                <span className="text-sm font-medium text-text-primary group-hover:text-brand-600">
                  {tpl.name}
                </span>
              </div>
              <div className="text-xs text-text-tertiary">
                {area}m² &middot; {formatCurrency(capex, true, locale)}/unit
              </div>
              {tpl.builtIn && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-tertiary text-text-tertiary mt-1 inline-block">
                  Built-in
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Greek net-salary estimator (display only, not payroll) ──
// Employee EFKA ~13.87% + simplified Greek income-tax brackets (2024).
// Tax-free credit €777 applied. Label as "approx" in UI.
function estimateGreekNetMonthly(grossMonthly: number): number {
  if (grossMonthly <= 0) return 0;
  const efka = grossMonthly * 0.1387;
  const annual = grossMonthly * 12;
  let tax = 0;
  tax += Math.min(annual, 10000) * 0.09;
  if (annual > 10000) tax += Math.min(annual - 10000, 10000) * 0.22;
  if (annual > 20000) tax += Math.min(annual - 20000, 10000) * 0.28;
  if (annual > 30000) tax += Math.min(annual - 30000, 10000) * 0.36;
  if (annual > 40000) tax += (annual - 40000) * 0.44;
  tax = Math.max(0, tax - 777); // tax-free credit
  return Math.round(grossMonthly - efka - tax / 12);
}

// ── Portfolio OPEX Migration Banner ──

function PortfolioOpexMigrationBanner() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('vlg_portfolio_opex_migration_banner_dismissed') === '1';
  });

  const migrated = typeof window !== 'undefined' &&
    localStorage.getItem('vlg_portfolio_opex_migrated_v2') === '1';

  if (!migrated || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 mb-4 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
      <span>{t('as.portfolioOpex.migrationBanner')}</span>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem('vlg_portfolio_opex_migration_banner_dismissed', '1');
          setDismissed(true);
        }}
        className="shrink-0 px-3 py-1 rounded text-xs font-medium bg-blue-100 hover:bg-blue-200 transition-colors"
      >
        {t('as.portfolioOpex.migrationDismiss')}
      </button>
    </div>
  );
}

// ── Main Page ──

export default function AssumptionsPage() {
  const { t, locale } = useTranslation();
  const {
    model,
    assumptions,
    setAssumption,
    setFinancingPath,
    resetToDefaults,
    templates,
    projects,
    addTemplate,
    activeConfigId,
    editsSinceLastSave,
    savedConfigs,
    addPortfolioStaffRole,
    updatePortfolioStaffRole,
    removePortfolioStaffRole,
    addPortfolioService,
    updatePortfolioService,
    removePortfolioService,
    addPortfolioOverhead,
    updatePortfolioOverhead,
    removePortfolioOverhead,
    updatePortfolioOpexScalar,
  } = useModelStore();
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(ASSUMPTIONS_TOUR.storageKey);
  const [tab, setTab] = useState<
    "portfolio" | "templates" | "general" | "revenue" | "opex" | "portfolio-opex" | "financing" | "dsra"
  >("portfolio");
  const [newTemplateId, setNewTemplateId] = useState<string | null>(null);

  // ── Reference scenario (admin-designated default) ──
  // Live-subscribe to appConfig/current. On first hydration where the
  // visitor hasn't touched anything yet (editsSinceLastSave === 0 AND
  // no activeConfigId), auto-load the reference scenario. Once they
  // make ANY change, this stops applying — their local state wins.
  //
  // The banner state mirrors `referenceScenarioId` and is shown only
  // when the active config matches the reference AND no edits are
  // pending. Dismissible via local-only flag.
  const [referenceScenarioId, setReferenceScenarioIdState] = useState<
    string | null
  >(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Subscribe to appConfig/current to keep banner state in sync.
  // Auto-load is handled by useReferenceScenarioAutoLoad in the layout.
  useEffect(() => {
    const db = getDb();
    if (!db) return;
    const unsub = subscribeReferenceScenarioId(db, (id) => {
      setReferenceScenarioIdState(id);
    });
    return () => unsub();
  }, []);

  // Clear highlight after animation
  useEffect(() => {
    if (newTemplateId) {
      const timer = setTimeout(() => setNewTemplateId(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [newTemplateId]);

  const handleAddTemplate = useCallback((type: 'villa' | 'suite' | 'mixed') => {
    addTemplate(type);
    // The newest template is always the last one
    const latest = useModelStore.getState().templates;
    const newId = latest[latest.length - 1]?.id;
    if (newId) setNewTemplateId(newId);
  }, [addTemplate]);

  if (!model) return null;

  const a = assumptions;
  const totalPlots = a.portfolio.reduce((s, p) => s + p.count, 0);
  const portfolioResolved = resolvePortfolio(templates, projects);
  const totalKeysMaxSplit = computeTotalKeysMaxSplit(portfolioResolved);
  const totalBedrooms     = computeTotalBedrooms(portfolioResolved);

  // Banner is visible when the active config matches the reference,
  // the user has no pending edits, and they haven't dismissed it.
  const referenceScenario = referenceScenarioId
    ? savedConfigs.find((c) => c.id === referenceScenarioId) ?? null
    : null;
  const showReferenceBanner =
    !bannerDismissed &&
    referenceScenarioId !== null &&
    activeConfigId === referenceScenarioId &&
    editsSinceLastSave === 0 &&
    referenceScenario !== null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-text-primary border-l-[3px] border-brand-400 pl-3">
            {t('as.title')}
          </h1>
          <p className="text-sm text-text-secondary mt-1">{t('as.pageIntro')}</p>
          <p className="text-sm text-text-secondary mt-1">
            {t('as.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TourButton onClick={() => setTourOpen(true)} pulsing={!!neverSeen} />
          <button
            onClick={() => {
              useModelStore.getState().requestConfirm({
                title: 'Reset all assumptions to defaults?',
                message: 'This cannot be undone. Your current edits to assumptions, templates, and projects will be lost. Saved scenarios are not affected — you can reload one from the Scenarios panel.',
                confirmLabel: 'Reset everything',
                danger: true,
                onConfirm: resetToDefaults,
              });
            }}
            className="text-sm text-text-tertiary hover:text-negative transition-colors"
          >
            {t('as.resetDefaults')}
          </button>
        </div>
      </div>

      {/* Reference scenario banner — visible whenever the live state
          matches the admin-designated default and the user hasn't yet
          dirtied anything. "Reset to defaults" already exists at the
          top right; this strip just makes the reference state visible. */}
      {showReferenceBanner && referenceScenario && (
        <div
          className="mb-6 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-brand-200 bg-brand-50/60 text-sm"
          role="status"
        >
          <span className="text-brand-700">★</span>
          <span className="text-text-secondary">
            {t('ref.viewingReference')}
            <span className="mx-1.5 text-text-tertiary">·</span>
            <strong className="text-text-primary">{referenceScenario.name}</strong>
          </span>
          <span className="ms-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                useModelStore.getState().requestConfirm({
                  title: 'Reset all assumptions to defaults?',
                  message: 'This cannot be undone. Your current edits to assumptions, templates, and projects will be lost. Saved scenarios are not affected — you can reload one from the Scenarios panel.',
                  confirmLabel: 'Reset everything',
                  danger: true,
                  onConfirm: resetToDefaults,
                });
              }}
              className="text-xs text-text-secondary hover:text-negative transition-colors underline-offset-2 hover:underline"
            >
              {t('as.resetDefaults')}
            </button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label={t('ref.dismiss')}
              title={t('ref.dismiss')}
              className="px-1.5 text-text-tertiary hover:text-text-primary transition-colors"
            >
              &times;
            </button>
          </span>
        </div>
      )}

      {/* Portfolio Summary Bar */}
      <div id="assumptions-portfolio-overview" className="mb-6 bg-white rounded-xl border border-brand-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-base text-text-primary">Portfolio Overview</h3>
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <span>{templates.length} templates</span>
            <span>&middot;</span>
            <span>{projects.length} projects</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1">{t('as.portfolioOverview.projects')}</label>
            <div className="font-mono text-2xl font-bold text-brand-600">{projects.length}</div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1">
              {t('as.portfolioOverview.keysMaxSplit')}
            </label>
            <div className="font-mono text-2xl font-bold text-text-primary">{totalKeysMaxSplit}</div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1">
              {t('as.portfolioOverview.bedrooms')}
            </label>
            <div className="font-mono text-2xl font-bold text-text-primary">{totalBedrooms}</div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1">{t('as.portfolioOverview.builtSurface')}</label>
            <div className="font-mono text-lg font-semibold text-text-primary">
              {a.portfolio.reduce((s, p) => s + computeTotalArea(p.roomAreas, { villaUnits: p.villaUnits, standardSuites: p.standardSuites, doubleSuites: p.doubleSuites }) * p.count, 0).toLocaleString()}m²
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1">{t('as.portfolioOverview.totalCapex')}</label>
            <div className="font-mono text-lg font-semibold text-text-primary">
              {formatCurrency(model.capex.portfolioTotal, true, locale)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div id="assumptions-tabs" className="flex gap-1 mb-6 bg-surface-secondary rounded-lg p-1 overflow-x-auto scrollbar-none">
        {(
          [
            { id: "portfolio", label: "Portfolio" },
            { id: "templates", label: "Templates" },
            { id: "financing", label: t('as.financingPaths') },
            { id: "general", label: t('as.general') },
            { id: "revenue", label: t('as.revenue') },
            { id: "opex", label: t('as.opexTab') },
            { id: "portfolio-opex", label: t('as.portfolioOpexTab') },
            { id: "dsra", label: t('as.dsra') },
          ] as const
        ).map((tabDef) => (
          <button
            key={tabDef.id}
            onClick={() => setTab(tabDef.id)}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${
              tab === tabDef.id
                ? "bg-white text-text-primary font-medium shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tabDef.label}
          </button>
        ))}
      </div>

      {/* ── PORTFOLIO TAB ── */}
      {tab === "portfolio" && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary mb-2">
            Each project uses a property template. Change the template or adjust units per project.
          </p>

          {projects.map((proj) => (
            <ProjectCard key={proj.id} projId={proj.id} />
          ))}

          <AddProjectPanel />

          {/* Acquisition legal */}
          <div className="bg-white rounded-xl border border-surface-tertiary p-5 mt-4">
            <h4 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3">Shared Costs</h4>
            <table className="w-full">
              <tbody>
                <AssumptionRow
                  label={t('field.acqLegalPerPlot')}
                  value={a.acquisitionLegalPerPlot}
                  path="acquisitionLegalPerPlot"
                  format="currency"
                  note={`x${totalPlots} plots = ${formatCurrency(a.acquisitionLegalPerPlot * totalPlots, true, locale)}`}
                />
              </tbody>
            </table>
          </div>

          {/* Exit assumption */}
          <div className="bg-white rounded-xl border border-surface-tertiary p-5 mt-4">
            <h4 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3">Exit Assumption</h4>
            <table className="w-full">
              <tbody>
                <AssumptionRow
                  label="Exit EBITDA multiple"
                  value={a.exitEbitdaMultiple}
                  path="exitEbitdaMultiple"
                  note="Terminal asset value = stabilised EBITDA × this multiple. Used in levered & project IRR."
                />
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TEMPLATES TAB ── */}
      {tab === "templates" && (
        <div className="space-y-6">
          {/* Create New Template — prominent CTA at top */}
          <div className="bg-gradient-to-r from-brand-50 to-blue-50 rounded-xl border border-dashed border-brand-300 p-6">
            <h3 className="font-display text-lg text-text-primary mb-2">Create a New Template</h3>
            <p className="text-sm text-text-secondary mb-4">
              Start from a default template, then customize all CAPEX and OPEX values.
              Or duplicate any existing template below.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleAddTemplate('villa')}
                className="px-5 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
              >
                + New Villa Template
              </button>
              <button
                onClick={() => handleAddTemplate('suite')}
                className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                + New Suite Template
              </button>
              <button
                onClick={() => handleAddTemplate('mixed')}
                className="px-5 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors"
              >
                + New Mixed Template
              </button>
            </div>
          </div>

          {/* Existing templates */}
          <div>
            <h3 className="text-sm font-medium uppercase tracking-wider text-text-tertiary mb-3">
              Your Templates ({templates.length})
            </h3>
            <p className="text-xs text-text-tertiary mb-4">
              Click any template to expand it and edit its CAPEX/OPEX values. Click any number to change it.
            </p>
            <div className="space-y-3">
              {/* Only auto-expand the freshly-created template; everything else
                  starts collapsed so the page is scannable instead of a wall of forms. */}
              {templates.map((tpl) => (
                <TemplateCard key={tpl.id} tpl={tpl} startExpanded={tpl.id === newTemplateId} highlight={tpl.id === newTemplateId} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FINANCING PATHS TAB ── */}
      {tab === "financing" && (
        <div>
          <p className="text-sm text-text-secondary mb-6">
            {t('as.selectPath')}
          </p>

          {/* Financing path selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {(
              [
                {
                  id: "commercial" as FinancingPath,
                  title: t('path.commercial'),
                  desc: t('path.commercialDesc'),
                  highlight: `${t('term.ds')}: ${formatCurrency(model.financingComparison[3]?.commercial as number, true, locale)}/yr`,
                  borderColor: "#8B6914",
                  bgColor: "#FAF7F0",
                },
                {
                  id: "rrf" as FinancingPath,
                  title: t('path.rrf'),
                  desc: t('path.rrfDesc'),
                  highlight: `${t('term.ds')}: ${formatCurrency(model.financingComparison[3]?.rrf as number, true, locale)}/yr`,
                  borderColor: "#4A6A8B",
                  bgColor: "#F0F4F8",
                },
                {
                  id: "grant" as FinancingPath,
                  title: t('path.grant'),
                  desc: t('path.grantDesc'),
                  highlight: `${t('term.ds')}: ${formatCurrency(model.financingComparison[3]?.grant as number, true, locale)}/yr`,
                  borderColor: "#4A7C3F",
                  bgColor: "#F0F8EF",
                },
                {
                  id: "tepix-loan" as FinancingPath,
                  title: t('path.tepixLoan'),
                  desc: t('path.tepixLoanDesc'),
                  highlight: `${t('term.ds')}: ${formatCurrency(model.financingComparison[3]?.tepixLoan as number, true, locale)}/yr`,
                  borderColor: "#7B5EA7",
                  bgColor: "#F5F0FA",
                },
              ] as const
            ).map((path) => {
              const isActive = a.financingPath === path.id;
              return (
                <button
                  key={path.id}
                  onClick={() => setFinancingPath(path.id)}
                  className={`text-left rounded-xl border-2 p-5 transition-all ${
                    isActive
                      ? `shadow-md`
                      : "border-surface-tertiary bg-white hover:border-surface-tertiary/80 hover:shadow-sm"
                  }`}
                  style={
                    isActive
                      ? {
                          borderColor: path.borderColor,
                          backgroundColor: path.bgColor,
                        }
                      : {}
                  }
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`w-3 h-3 rounded-full ${isActive ? "ring-2 ring-offset-2" : ""}`}
                      style={{ backgroundColor: path.borderColor }}
                    />
                    <h3 className="font-medium text-text-primary">{path.title}</h3>
                  </div>
                  <p className="text-xs text-text-secondary mb-3">{path.desc}</p>
                  <p className="text-sm font-mono font-medium text-text-primary">{path.highlight}</p>
                </button>
              );
            })}
          </div>

          {/* Active path details */}
          <div className="bg-white rounded-xl border border-surface-tertiary p-6">
            <h3 className="font-display text-lg text-text-primary mb-4">
              {t('as.activeParams')}
            </h3>

            {a.financingPath === "commercial" && (
              <table className="w-full">
                <tbody>
                  <AssumptionRow label={t('field.loanCoverage')} value={a.commercialLoan.loanCoverageRate} path="commercialLoan.loanCoverageRate" format="percent" note="75% of total project cost" />
                  <AssumptionRow label={t('field.interestRate')} value={a.commercialLoan.interestRate} path="commercialLoan.interestRate" format="percent" note="Indicative commercial rate" />
                  <AssumptionRow label={t('field.gracePeriod')} value={a.commercialLoan.gracePeriodYears} path="commercialLoan.gracePeriodYears" note="Interest-only, starts Q4 2026" />
                  <AssumptionRow label={t('field.repaymentTerm')} value={a.commercialLoan.repaymentTermYears} path="commercialLoan.repaymentTermYears" note="Full DS from 2029" />
                  <AssumptionRow label={t('field.workingCapital')} value={a.commercialLoan.workingCapitalFacility} path="commercialLoan.workingCapitalFacility" format="currency" note="Revolving, self-liquidating" />
                </tbody>
              </table>
            )}

            {a.financingPath === "rrf" && (
              <table className="w-full">
                <tbody>
                  <AssumptionRow label={t('field.rrfShare')} value={a.rrf.rrfShareOfLoan} path="rrf.rrfShareOfLoan" format="percent" note="80% of total financing at concessional rate" />
                  <AssumptionRow label={t('field.rrfRate')} value={a.rrf.rrfInterestRate} path="rrf.rrfInterestRate" format="percent" note="0.35% per annum" />
                  <AssumptionRow label={t('field.commShare')} value={a.rrf.commercialShareRate} path="rrf.commercialShareRate" format="percent" note="20% at commercial rate" />
                  <AssumptionRow label={t('field.commRate')} value={a.rrf.commercialInterestRate} path="rrf.commercialInterestRate" format="percent" note="5% standard" />
                  <AssumptionRow label="Loan coverage rate (% of CAPEX)" value={a.rrf.coverageRate ?? 0.80} path="rrf.coverageRate" format="percent" note="Fraction of total CAPEX financed — mirrors commercial LTV" />
                </tbody>
              </table>
            )}

            {a.financingPath === "grant" && (
              <table className="w-full">
                <tbody>
                  <AssumptionRow label={t('field.grantRate')} value={a.grant.grantRate} path="grant.grantRate" format="percent" note="60% confirmed" />
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2 pr-4 text-sm text-text-secondary">{t('field.nonPlotEligible')}</td>
                    <td className="py-2 data-cell text-right pr-2">
                      {formatCurrency(
                        model.capex.portfolioTotal -
                          a.portfolio.reduce((s, p) => s + p.landCost * p.count, 0) -
                          a.acquisitionLegalPerPlot * totalPlots,
                        false, locale
                      )}
                    </td>
                    <td className="py-2 pl-4 text-xs text-text-tertiary">CAPEX less land and acquisition legal</td>
                  </tr>
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2 pr-4 text-sm font-medium text-positive">{t('field.grantAmount')}</td>
                    <td className="py-2 data-cell text-right pr-2 font-medium text-positive">
                      {formatCurrency(
                        (model.capex.portfolioTotal -
                          a.portfolio.reduce((s, p) => s + p.landCost * p.count, 0) -
                          a.acquisitionLegalPerPlot * totalPlots) *
                          a.grant.grantRate,
                        false, locale
                      )}
                    </td>
                    <td className="py-2 pl-4 text-xs text-text-tertiary">Non-plot eligible x grant rate</td>
                  </tr>
                  <AssumptionRow label="Interest rate (on remaining loan)" value={a.commercialLoan.interestRate} path="commercialLoan.interestRate" format="percent" note="5% on reduced loan amount" />
                  <AssumptionRow label="Repayment term (years)" value={a.commercialLoan.repaymentTermYears} path="commercialLoan.repaymentTermYears" note="13 years from 2029" />
                </tbody>
              </table>
            )}

            {a.financingPath === "tepix-loan" && (<>
              <table className="w-full">
                <tbody>
                  <AssumptionRow label={t('field.tepixCoverage')} value={a.tepixLoan.coverageRate} path="tepixLoan.coverageRate" format="percent" note="90% coverage" />
                  <AssumptionRow label={t('field.tepixHdbShare')} value={a.tepixLoan.hdbShareOfLoan} path="tepixLoan.hdbShareOfLoan" format="percent" note="40% interest-free from HDB/EAT" />
                  <AssumptionRow label={t('field.tepixBankShare')} value={a.tepixLoan.bankShareOfLoan} path="tepixLoan.bankShareOfLoan" format="percent" note="60% from partner bank" />
                  <AssumptionRow label={t('field.tepixBankRate')} value={a.tepixLoan.bankInterestRate} path="tepixLoan.bankInterestRate" format="percent" note="Indicative bank rate" />
                  <AssumptionRow label={t('field.tepixSubsidy')} value={a.tepixLoan.interestSubsidy} path="tepixLoan.interestSubsidy" format="percent" note="2pp subsidy" />
                  <AssumptionRow label={t('field.tepixSubsidyDuration')} value={a.tepixLoan.subsidyDurationYears} path="tepixLoan.subsidyDurationYears" />
                  <AssumptionRow label={t('field.tepixTotalTerm')} value={a.tepixLoan.totalTermYears} path="tepixLoan.totalTermYears" />
                  <AssumptionRow label={t('field.tepixGrace')} value={a.tepixLoan.gracePeriodYears} path="tepixLoan.gracePeriodYears" />
                  <AssumptionRow label={t('field.tepixLandCap')} value={a.tepixLoan.landCapOnFundContribution} path="tepixLoan.landCapOnFundContribution" format="percent" note={t('field.tepixLandCapNote')} />
                </tbody>
              </table>
              <div className="mt-4 rounded-lg border border-purple-300 bg-purple-50 p-4">
                <h4 className="text-sm font-semibold text-[#7B5EA7] mb-3">{t('field.tepixCombinedStructure')}</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-text-tertiary">{t('field.tepixPrimaryLoan')}</span><div className="font-mono font-semibold">{formatCurrency(model.keyMetrics.primaryLoan, true, locale)}</div></div>
                  <div><span className="text-text-tertiary">{t('field.tepixSuppLoan')}</span><div className="font-mono font-semibold">{formatCurrency(model.keyMetrics.supplementaryLoan, true, locale)}</div></div>
                  <div><span className="text-text-tertiary">{t('field.tepixLandFundedByTepix')}</span><div className="font-mono font-semibold">{formatCurrency(model.keyMetrics.landFundedByTepix, true, locale)}</div></div>
                  <div><span className="text-text-tertiary">{t('field.tepixLandGap')}</span><div className="font-mono font-semibold">{formatCurrency(model.keyMetrics.landFundedByCommercial, true, locale)}</div></div>
                  <div className="col-span-2 pt-2 border-t border-purple-200"><span className="text-text-tertiary">{t('field.tepixCombinedDS')}</span><div className="font-mono font-semibold text-lg">{formatCurrency(model.keyMetrics.annualDS, true, locale)}/yr</div></div>
                </div>
              </div>
            </>)}

          </div>

          {/* Impact Summary */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-surface-tertiary p-4 text-center">
              <div className="text-xs uppercase tracking-wider text-text-tertiary mb-1">{t('kpi.loanAmount')}</div>
              <div className="kpi-value text-text-primary text-2xl">{formatCurrency(model.keyMetrics.loanAmount, true, locale)}</div>
            </div>
            <div className="bg-white rounded-xl border border-surface-tertiary p-4 text-center">
              <div className="text-xs uppercase tracking-wider text-text-tertiary mb-1">{t('kpi.equityRequired')}</div>
              <div className="kpi-value text-text-primary text-2xl">{formatCurrency(model.keyMetrics.equityRequired, true, locale)}</div>
            </div>
            <div className="bg-white rounded-xl border border-surface-tertiary p-4 text-center">
              <div className="text-xs uppercase tracking-wider text-text-tertiary mb-1">{t('term.dscr')} ({t('phase.stabilised')})</div>
              <div className="kpi-value text-text-primary text-2xl">{formatMultiple(model.keyMetrics.stabilisedDSCR)}</div>
            </div>
          </div>

          {/* Working Capital subsection */}
          <div className="mt-8 bg-white rounded-xl border border-surface-tertiary p-6">
            <SectionHeader title={t('as.workingCapital')} />
            <table className="w-full">
              <tbody>
                <ToggleRow label={t('field.wcActive')} value={a.workingCapital.active} path="workingCapital.active" note="Toggle off to model without WC" />
                <AssumptionRow label={t('field.wcFacility')} value={a.workingCapital.facilitySize} path="workingCapital.facilitySize" format="currency" note="Revolving facility" />
                <AssumptionRow label={t('field.wcSpread')} value={a.workingCapital.spreadOverTermRate} path="workingCapital.spreadOverTermRate" format="percent" note="Above term-loan rate" />
                <AssumptionRow label={t('field.wcPreOpening')} value={a.workingCapital.preOpeningTotalDraw} path="workingCapital.preOpeningTotalDraw" format="currency" note="Q3-2027 → Q2-2028" />
                <AssumptionRow label={t('field.wcSeasonal')} value={a.workingCapital.seasonalDrawPerCycle} path="workingCapital.seasonalDrawPerCycle" format="currency" note="Drawn Q4, repaid Q3 next year" />
                <AssumptionRow label={t('field.wcY2Buffer')} value={a.workingCapital.y2RampBufferTopup} path="workingCapital.y2RampBufferTopup" format="currency" note="Extra Y2 ramp buffer" />
                <ToggleRow label={t('field.wcSelfLiquidating')} value={a.workingCapital.selfLiquidating} path="workingCapital.selfLiquidating" note="Repay outstanding each Q3" />
                <ToggleRow label={t('field.wcDsra')} value={a.workingCapital.dsraConversionEnabled} path="workingCapital.dsraConversionEnabled" note={t('as.wcDsraNote')} />
                <AssumptionRow label={t('field.wcDsraLock')} value={a.workingCapital.dsraLockAmount} path="workingCapital.dsraLockAmount" format="currency" note="Locked when DSRA enabled" />
                <AssumptionRow label={t('field.wcInternalBuffer')} value={a.workingCapital.internalCashBuffer} path="workingCapital.internalCashBuffer" format="currency" note="Cash kept on hand; surplus above this offsets WC draws" />
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── GENERAL TAB ── */}
      {tab === "general" && (
        <div className="bg-white rounded-xl border border-surface-tertiary p-6">
          <SectionHeader title={t('as.rampUp')} />
          <table className="w-full">
            <tbody>
              <AssumptionRow label={t('field.y1Ramp')} value={a.general.year1RampFactor} path="general.year1RampFactor" format="percent" note="% of mature revenue" />
              <AssumptionRow label={t('field.y2Ramp')} value={a.general.year2RampFactor} path="general.year2RampFactor" format="percent" note="% of mature revenue" />
              <AssumptionRow label={t('field.nightsGrowth')} value={a.general.nightsGrowthPerYear} path="general.nightsGrowthPerYear" note="Added per year" />
              <AssumptionRow label={t('field.nightsCap')} value={a.general.nightsCap} path="general.nightsCap" note="Upper bound" />
            </tbody>
          </table>

          <SectionHeader title={t('as.tax')} />
          <table className="w-full">
            <tbody>
              <AssumptionRow label={t('field.citRate')} value={a.tax.corporateIncomeTaxRate} path="tax.corporateIncomeTaxRate" format="percent" note="Greek CIT" />
              <AssumptionRow label={t('field.vatRate')} value={a.tax.netVATRate} path="tax.netVATRate" format="percent" note="7% net after input credits" />
            </tbody>
          </table>
        </div>
      )}

      {/* ── REVENUE TAB ── */}
      {tab === "revenue" && (
        <div className="bg-white rounded-xl border border-surface-tertiary p-6">
          <SectionHeader title={t('as.realisticScenario')} />
          <table className="w-full">
            <tbody>
              <AssumptionRow label={t('field.villaADR')} value={a.revenueRealistic.villaADR} path="revenueRealistic.villaADR" format="currency" note="Net of all commissions" />
              <AssumptionRow label={t('field.villaNights')} value={a.revenueRealistic.villaBaseNights} path="revenueRealistic.villaBaseNights" note="Per project" />
              <AssumptionRow label={t('field.stdSuiteADR')} value={a.revenueRealistic.suiteStandardADR} path="revenueRealistic.suiteStandardADR" format="currency" note={`Per suite / night · ${a.portfolio.reduce((s, p) => s + p.standardSuites * p.count, 0)} in portfolio`} />
              <AssumptionRow label={t('field.dblSuiteADR')} value={a.revenueRealistic.suiteDoubleADR} path="revenueRealistic.suiteDoubleADR" format="currency" note={`Per suite / night · ${a.portfolio.reduce((s, p) => s + p.doubleSuites * p.count, 0)} in portfolio`} />
              <AssumptionRow label={t('field.suiteNights')} value={a.revenueRealistic.suiteBaseNights} path="revenueRealistic.suiteBaseNights" />
              <AssumptionRow label={t('field.eventsPerYear')} value={a.revenueRealistic.eventsPerYear} path="revenueRealistic.eventsPerYear" />
              <AssumptionRow label={t('field.profitPerEvent')} value={a.revenueRealistic.netProfitPerEvent} path="revenueRealistic.netProfitPerEvent" format="currency" />
              <AssumptionRow label={t('field.ancillaryProfit')} value={a.revenueRealistic.ancillaryBaseProfit} path="revenueRealistic.ancillaryBaseProfit" format="currency" note="Chef, boat, car rentals" />
              <AssumptionRow label={t('field.ancillaryGrowth')} value={a.revenueRealistic.ancillaryGrowthRate} path="revenueRealistic.ancillaryGrowthRate" format="percent" note="+10%/yr from 2028" />
              <AssumptionRow label={t('field.ancillaryGrowthYears')} value={a.revenueRealistic.ancillaryGrowthYears} path="revenueRealistic.ancillaryGrowthYears" note="Years of compounding from 2028, then flat" />
            </tbody>
          </table>

          <SectionHeader title={t('as.upsideScenario')} />
          <table className="w-full">
            <tbody>
              <AssumptionRow label="Villa ADR — Realistic" value={a.revenueUpside.villaADR} path="revenueUpside.villaADR" format="currency" />
              <AssumptionRow label="Villa nights — Realistic (mature)" value={a.revenueUpside.villaBaseNights} path="revenueUpside.villaBaseNights" />
              <AssumptionRow label="Standard Suite ADR — Realistic" value={a.revenueUpside.suiteStandardADR} path="revenueUpside.suiteStandardADR" format="currency" />
              <AssumptionRow label="Double Suite ADR — Realistic" value={a.revenueUpside.suiteDoubleADR} path="revenueUpside.suiteDoubleADR" format="currency" />
              <AssumptionRow label="Suite nights — Realistic" value={a.revenueUpside.suiteBaseNights} path="revenueUpside.suiteBaseNights" />
              <AssumptionRow label="Events — Realistic" value={a.revenueUpside.eventsPerYear} path="revenueUpside.eventsPerYear" />
              <AssumptionRow label="Ancillary growth years — Realistic (cap)" value={a.revenueUpside.ancillaryGrowthYears} path="revenueUpside.ancillaryGrowthYears" note="Years of compounding from 2028, then flat" />
            </tbody>
          </table>
        </div>
      )}

      {/* ── OPEX TAB ── */}
      {tab === "opex" && (
        <div className="bg-white rounded-xl border border-surface-tertiary p-6">
          <p className="text-sm text-text-secondary mb-6">
            Annual operating expenses per unit, by template. Click any value to edit. Changes apply to all projects using that template and recalculate the model instantly.
          </p>

          {/* ── FF&E Reserve Rate Schedule ── */}
          <div className="mb-6 p-4 rounded-xl bg-amber-50/40 border border-amber-200/60">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-700 mb-3">FF&amp;E Reserve Rate Schedule</h4>
            <div className="grid grid-cols-3 gap-6">
              {[
                { label: '2029 — Year 1 of ops', key: 'rate2029' as const, def: 0.02 },
                { label: '2030 — Year 2 of ops', key: 'rate2030' as const, def: 0.03 },
                { label: '2031+ — Stabilised',   key: 'rateStabilised' as const, def: 0.04 },
              ].map(({ label, key, def }) => (
                <div key={key}>
                  <p className="text-[11px] text-text-tertiary mb-1">{label}</p>
                  <EditableCell
                    value={a.ffeSchedule?.[key] ?? def}
                    format="percent"
                    label={label}
                    onChange={(v) => setAssumption(`ffeSchedule.${key}`, v, label)}
                  />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-text-tertiary mt-2">
              Engine computes <span className="font-mono bg-amber-50 px-1 rounded">max(floor, rate × revenue/unit)</span> per year.
              Floor is set per template in the Templates tab.
              Year 2028 (opening, pre-revenue): floor only.
            </p>
          </div>

          {templates.map((tpl) => {
            const rawOpex = Object.entries(tpl.opex)
              .filter(([k]) => OPEX_CONTROLLABLE_KEYS.has(k))
              .reduce((s, [, v]) => s + (v as number), 0)
              + (tpl.extraOpexLines ?? []).reduce((s, l) => s + l.value, 0);
            const totalOpex = rawOpex * (1 + (tpl.opexContingencyRate ?? 0));
            const projectCount = projects.filter((p) => p.templateId === tpl.id).length;
            return (
              <div key={tpl.id} className="mb-8 last:mb-0">
                <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-surface-tertiary">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getPropertyDisplayType(tpl) === 'villa' ? 'bg-brand-600' : getPropertyDisplayType(tpl) === 'mixed' ? 'bg-purple-500' : 'bg-info'}`} />
                    <h3 className="font-display text-lg text-text-primary">{tpl.name}</h3>
                    {projectCount > 0 && (
                      <span className="text-xs text-positive bg-positive/10 px-2 py-0.5 rounded-full">
                        Used in {projectCount} project{projectCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-text-tertiary font-mono">
                    Total: {formatCurrency(totalOpex, true, locale)}/yr
                  </span>
                </div>
                <table className="w-full">
                  <tbody>
                    {Object.entries(tpl.opex)
                      .filter(([key]) => OPEX_CONTROLLABLE_KEYS.has(key))
                      .map(([key, val]) => (
                        <TemplateRow
                          key={key}
                          label={key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                          value={val as number}
                          tplId={tpl.id}
                          path={`opex.${key}`}
                          format="currency"
                        />
                      ))}
                    {(tpl.extraOpexLines ?? []).map((line) => (
                      <CustomOpexRow key={line.id} tplId={tpl.id} line={line} />
                    ))}
                    <TemplateRow
                      label={t('field.opexContingencyRate')}
                      value={tpl.opexContingencyRate ?? 0}
                      tplId={tpl.id}
                      path="opexContingencyRate"
                      format="percent"
                    />
                    <tr className="border-b border-surface-secondary/30">
                      <td className="py-1.5 pr-3 text-xs text-text-secondary italic">Contingency amount</td>
                      <td className="py-1.5 w-28 text-right px-2 font-mono text-xs text-text-tertiary italic">
                        {formatCurrency(totalOpex - rawOpex, false, locale)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <button
                  onClick={() => useModelStore.getState().addOpexLine(tpl.id)}
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  {t('tpl.addOpexLine')}
                </button>

                {/* ── Year-by-year FF&E + OPEX projection ── */}
                {(() => {
                  const tplProject = projects.find((p) => p.templateId === tpl.id);
                  if (!tplProject || !model) return null;
                  const rows = [2029, 2030, 2031, 2032].map((year) => {
                    const pnlRow = model.scenarios.realistic.pnl.find((r) => r.year === year);
                    const bd = pnlRow?.propertyBreakdown.find((b) => b.id === tplProject.id);
                    const ffe = bd?.ffeReservePerUnit ?? 0;
                    const ctrl = bd ? bd.opexPerUnit - ffe : 0;
                    const total = bd?.opexPerUnit ?? 0;
                    return { year, ffe, ctrl, total };
                  });
                  return (
                    <div className="mt-4 pt-3 border-t border-amber-200/40">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 mb-2">
                        FF&amp;E &amp; OPEX evolution — per unit
                      </p>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wider text-text-tertiary border-b border-surface-secondary">
                            <th className="text-left py-1 pr-3 font-medium">Year</th>
                            <th className="text-right py-1 pr-3 font-medium">Controllable</th>
                            <th className="text-right py-1 pr-3 font-medium text-amber-700">FF&amp;E Reserve</th>
                            <th className="text-right py-1 font-medium">Total OPEX/unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(({ year, ffe, ctrl, total }) => (
                            <tr key={year} className="border-b border-surface-secondary/30">
                              <td className="py-1.5 pr-3 font-mono text-text-tertiary">{year}</td>
                              <td className="py-1.5 pr-3 text-right font-mono text-text-secondary">{formatCurrency(ctrl, false, locale)}</td>
                              <td className="py-1.5 pr-3 text-right font-mono text-amber-700 font-medium">{formatCurrency(ffe, false, locale)}</td>
                              <td className="py-1.5 text-right font-mono font-semibold text-text-primary">{formatCurrency(total, false, locale)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className="text-[10px] text-text-tertiary mt-1">
                        Floor: {formatCurrency(tpl.opex.ffeReserveFloor ?? 0, false, locale)}/yr &middot; count: {tplProject.count} unit{tplProject.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* ── PORTFOLIO OPEX TAB ── */}
      {tab === "portfolio-opex" && (
        <div className="space-y-4">
          <PortfolioOpexMigrationBanner />

          {/* Summary strip */}
          {(() => {
            const po = assumptions.portfolioOpex;
            if (!po) return null;
            const result = computePortfolioOpex(2031, assumptions);
            return (
              <div className="flex flex-wrap gap-3 mb-2">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 border border-blue-200">
                  <span className="text-xs text-text-tertiary">{t('as.portfolioOpex.totalBadge')}</span>
                  <span className="font-mono text-sm font-bold text-blue-800">{formatCurrency(result.total, true, locale)}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-secondary border border-surface-tertiary">
                  <span className="text-xs text-text-tertiary">{t('as.portfolioOpex.yearRoundFixed')}</span>
                  <span className="font-mono text-sm font-semibold text-text-primary">{formatCurrency(result.yearRoundFixed, true, locale)}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-secondary border border-surface-tertiary">
                  <span className="text-xs text-text-tertiary">{t('as.portfolioOpex.variable')}</span>
                  <span className="font-mono text-sm font-semibold text-text-primary">{formatCurrency(result.variable, true, locale)}</span>
                </div>
              </div>
            );
          })()}

          {/* Section 1 — Shared Staff */}
          {(() => {
            const po = assumptions.portfolioOpex;
            if (!po) return null;
            return (
              <div className="bg-white rounded-xl border border-surface-tertiary p-5">
                <h4 className="text-sm font-semibold text-text-primary mb-3">{t('as.portfolioOpex.staffSection')}</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-text-tertiary border-b border-surface-secondary">
                      <th className="text-left py-1 pr-2 font-medium">{t('as.portfolioOpex.colRole')}</th>
                      <th className="text-right py-1 pr-2 font-medium w-28">{t('as.portfolioOpex.colMonthlyGross')}</th>
                      <th className="text-right py-1 pr-2 font-medium w-24 text-text-tertiary">{t('as.portfolioOpex.colNetMonthly')}</th>
                      <th className="text-right py-1 pr-2 font-medium w-20">{t('as.portfolioOpex.colMonths')}</th>
                      <th className="text-right py-1 pr-2 font-medium w-20">{t('as.portfolioOpex.colBurden')}</th>
                      <th className="text-right py-1 pr-2 font-medium w-24">{t('as.portfolioOpex.colAllowances')}</th>
                      <th className="text-right py-1 font-medium w-28">{t('as.portfolioOpex.colAnnual')}</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.staffRoles.map((role, idx) => {
                      const annualBurdened = role.yearRound
                        ? role.monthlyGross * role.monthsPaid * role.burdenMultiplier + role.allowances
                        : role.monthlyGross * (role.seasonalMonths ?? 0) * role.burdenMultiplier * (role.headcount ?? 1) + role.allowances * (role.headcount ?? 1);
                      return (
                        <tr key={idx} className="border-b border-surface-secondary/40">
                          <td className="py-1.5 pr-2">
                            <input
                              type="text"
                              value={role.name}
                              onChange={(e) => updatePortfolioStaffRole(idx, { ...role, name: e.target.value })}
                              className="w-full px-1 py-0.5 rounded border border-transparent hover:border-surface-tertiary focus:border-blue-300 focus:outline-none text-sm bg-transparent"
                            />
                          </td>
                          <td className="py-1.5 pr-2">
                            <EditableCell value={role.monthlyGross} format="currency" label={role.name} onChange={(v) => updatePortfolioStaffRole(idx, { ...role, monthlyGross: v })} />
                          </td>
                          <td className="py-1.5 pr-2 text-right font-mono text-xs text-text-tertiary" title={t('as.portfolioOpex.colNetMonthlyTooltip')}>
                            {formatCurrency(estimateGreekNetMonthly(role.monthlyGross), false, locale)}
                          </td>
                          <td className="py-1.5 pr-2">
                            <EditableCell value={role.monthsPaid} format="number" label={t('as.portfolioOpex.colMonths')} onChange={(v) => updatePortfolioStaffRole(idx, { ...role, monthsPaid: v })} />
                          </td>
                          <td className="py-1.5 pr-2">
                            <EditableCell value={role.burdenMultiplier} format="number" label={t('as.portfolioOpex.colBurden')} onChange={(v) => updatePortfolioStaffRole(idx, { ...role, burdenMultiplier: v })} />
                          </td>
                          <td className="py-1.5 pr-2">
                            <EditableCell value={role.allowances} format="currency" label={t('as.portfolioOpex.colAllowances')} onChange={(v) => updatePortfolioStaffRole(idx, { ...role, allowances: v })} />
                          </td>
                          <td className="py-1.5 text-right font-mono text-xs text-text-secondary">
                            {formatCurrency(annualBurdened, false, locale)}
                          </td>
                          <td className="py-1.5 pl-2">
                            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${role.yearRound ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                              {role.yearRound ? t('as.portfolioOpex.roleYearRound') : t('as.portfolioOpex.roleSeasonal')}
                            </span>
                          </td>
                          <td className="py-1.5 pl-1">
                            <button type="button" onClick={() => removePortfolioStaffRole(idx)} className="text-negative text-xs hover:underline">&#x2715;</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <button
                  type="button"
                  onClick={() => addPortfolioStaffRole({ name: 'New Role', monthlyGross: 0, monthsPaid: 14, burdenMultiplier: 1.32, allowances: 0, yearRound: true })}
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  + {t('as.portfolioOpex.addRole')}
                </button>
              </div>
            );
          })()}

          {/* Section 2 — Shared Services */}
          {(() => {
            const po = assumptions.portfolioOpex;
            if (!po) return null;
            return (
              <div className="bg-white rounded-xl border border-surface-tertiary p-5">
                <h4 className="text-sm font-semibold text-text-primary mb-3">{t('as.portfolioOpex.servicesSection')}</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-text-tertiary border-b border-surface-secondary">
                      <th className="text-left py-1 pr-2 font-medium">Name</th>
                      <th className="text-left py-1 pr-2 font-medium text-text-tertiary">{t('as.portfolioOpex.sizingBasis')}</th>
                      <th className="text-right py-1 font-medium w-28">Annual €</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.sharedServices.map((line, idx) => {
                      const isPool = line.name === 'Pool R&M';
                      const poolTotal = (po.poolCount ?? 17) * (po.poolCostPerUnit ?? 1500);
                      return (
                        <tr key={idx} className="border-b border-surface-secondary/40">
                          <td className="py-1.5 pr-2">
                            <input
                              type="text"
                              value={line.name}
                              onChange={(e) => updatePortfolioService(idx, { ...line, name: e.target.value })}
                              className="w-full px-1 py-0.5 rounded border border-transparent hover:border-surface-tertiary focus:border-blue-300 focus:outline-none text-sm bg-transparent"
                            />
                          </td>
                          <td className="py-1.5 pr-2 text-xs text-text-tertiary">
                            {isPool ? (
                              <span className="flex items-center gap-1.5">
                                <EditableCell
                                  value={po.poolCount ?? 17}
                                  format="number"
                                  label={t('as.portfolioOpex.poolCount')}
                                  onChange={(v) => updatePortfolioOpexScalar('poolCount', v)}
                                />
                                <span className="text-text-tertiary">{t('as.portfolioOpex.poolsAt')}</span>
                                <EditableCell
                                  value={po.poolCostPerUnit ?? 1500}
                                  format="currency"
                                  label={t('as.portfolioOpex.poolCostPerUnit')}
                                  onChange={(v) => updatePortfolioOpexScalar('poolCostPerUnit', v)}
                                />
                                <span className="text-text-tertiary">{t('as.portfolioOpex.poolPerPoolYear')}</span>
                              </span>
                            ) : (
                              line.sizingBasis ?? ''
                            )}
                          </td>
                          <td className="py-1.5">
                            {isPool ? (
                              <span className="text-right font-mono text-xs text-text-secondary block">
                                {formatCurrency(poolTotal, false, locale)}
                              </span>
                            ) : (
                              <EditableCell value={line.annualCost} format="currency" label={line.name} onChange={(v) => updatePortfolioService(idx, { ...line, annualCost: v })} />
                            )}
                          </td>
                          <td className="py-1.5 pl-1">
                            <button type="button" onClick={() => removePortfolioService(idx)} className="text-negative text-xs hover:underline">&#x2715;</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <button
                  type="button"
                  onClick={() => addPortfolioService({ name: 'New Service', sizingBasis: '', annualCost: 0 })}
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  + {t('as.portfolioOpex.addService')}
                </button>
              </div>
            );
          })()}

          {/* Section 3 — Shared Overhead */}
          {(() => {
            const po = assumptions.portfolioOpex;
            if (!po) return null;
            return (
              <div className="bg-white rounded-xl border border-surface-tertiary p-5">
                <h4 className="text-sm font-semibold text-text-primary mb-3">{t('as.portfolioOpex.overheadSection')}</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-text-tertiary border-b border-surface-secondary">
                      <th className="text-left py-1 pr-2 font-medium">Name</th>
                      <th className="text-left py-1 pr-2 font-medium text-text-tertiary">{t('as.portfolioOpex.sizingBasis')}</th>
                      <th className="text-right py-1 font-medium w-28">Annual €</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.sharedOverhead.map((line, idx) => {
                      const isBanking = line.name.includes('Banking') || line.name.includes('Payment');
                      const isInsurance = line.name.includes('Insurance');
                      return (
                        <tr key={idx} className="border-b border-surface-secondary/40">
                          <td className="py-1.5 pr-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={line.name}
                                onChange={(e) => updatePortfolioOverhead(idx, { ...line, name: e.target.value })}
                                className="flex-1 px-1 py-0.5 rounded border border-transparent hover:border-surface-tertiary focus:border-blue-300 focus:outline-none text-sm bg-transparent"
                              />
                              {isBanking && (
                                <span className="text-[10px] text-text-tertiary bg-surface-secondary rounded px-1 py-0.5 cursor-help" title={t('as.portfolioOpex.bankingTooltip')}>?</span>
                              )}
                              {isInsurance && (
                                <span className="text-[10px] text-text-tertiary bg-surface-secondary rounded px-1 py-0.5 cursor-help" title={t('as.portfolioOpex.insuranceTooltip')}>?</span>
                              )}
                            </div>
                          </td>
                          <td className="py-1.5 pr-2 text-xs text-text-tertiary">{line.sizingBasis ?? ''}</td>
                          <td className="py-1.5">
                            <EditableCell value={line.annualCost} format="currency" label={line.name} onChange={(v) => updatePortfolioOverhead(idx, { ...line, annualCost: v })} />
                          </td>
                          <td className="py-1.5 pl-1">
                            <button type="button" onClick={() => removePortfolioOverhead(idx)} className="text-negative text-xs hover:underline">&#x2715;</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <button
                  type="button"
                  onClick={() => addPortfolioOverhead({ name: 'New Overhead', sizingBasis: '', annualCost: 0 })}
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  + {t('as.portfolioOpex.addOverhead')}
                </button>
              </div>
            );
          })()}

          {/* Section 4 — Pre-opening Amortisation */}
          {(() => {
            const po = assumptions.portfolioOpex;
            if (!po) return null;
            const annualAmort = po.preOpeningAmortYears > 0 ? po.preOpeningTotal / po.preOpeningAmortYears : 0;
            return (
              <div className="bg-white rounded-xl border border-surface-tertiary p-5">
                <h4 className="text-sm font-semibold text-text-primary mb-3">{t('as.portfolioOpex.preOpeningSection')}</h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-surface-secondary/40">
                      <td className="py-2 pr-4 text-text-secondary">{t('as.portfolioOpex.preOpeningTotal')}</td>
                      <td className="py-2 w-36">
                        <EditableCell value={po.preOpeningTotal} format="currency" label={t('as.portfolioOpex.preOpeningTotal')} onChange={(v) => updatePortfolioOpexScalar('preOpeningTotal', v)} />
                      </td>
                    </tr>
                    <tr className="border-b border-surface-secondary/40">
                      <td className="py-2 pr-4 text-text-secondary">{t('as.portfolioOpex.preOpeningAmortYears')}</td>
                      <td className="py-2 w-36">
                        <EditableCell value={po.preOpeningAmortYears} format="number" label={t('as.portfolioOpex.preOpeningAmortYears')} onChange={(v) => updatePortfolioOpexScalar('preOpeningAmortYears', v)} />
                      </td>
                    </tr>
                    <tr className="border-b border-surface-secondary/40">
                      <td className="py-2 pr-4 text-text-secondary">{t('as.portfolioOpex.preOpeningStartYear')}</td>
                      <td className="py-2 w-36">
                        <EditableCell value={po.preOpeningStartYear} format="number" label={t('as.portfolioOpex.preOpeningStartYear')} onChange={(v) => updatePortfolioOpexScalar('preOpeningStartYear', v)} />
                      </td>
                    </tr>
                    <tr className="border-b border-surface-secondary/40">
                      <td className="py-2 pr-4 text-text-secondary text-text-tertiary italic">{t('as.portfolioOpex.annualAmort')}</td>
                      <td className="py-2 w-36 text-right px-2 font-mono text-sm text-text-tertiary italic">
                        {formatCurrency(annualAmort, false, locale)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── DSRA TAB ── */}
      {tab === "dsra" && (
        <div className="bg-white rounded-xl border border-surface-tertiary p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-1">
              {t('dsra.sectionTitle')}
            </h3>
            <p className="text-xs text-text-secondary">{t('dsra.sectionSub')}</p>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {/* Target DSCR */}
              <tr className="border-b border-surface-secondary">
                <td className="py-2 pr-4 text-text-secondary">
                  {t('as.dsraTargetDSCR')}
                </td>
                <td className="py-2 text-right">
                  <EditableCell
                    value={a.dsra?.targetDSCR ?? 1.25}
                    onChange={v => setAssumption('dsra.targetDSCR' as any, v)}
                    format="number"
                  />
                </td>
              </tr>
              {/* 2028 sweep % */}
              <tr>
                <td className="pt-2 pr-4 text-text-secondary">{t('as.dsraSweepPct')}</td>
                <td className="pt-2 text-right">
                  <EditableCell
                    value={a.dsra?.sweep2028Pct ?? 1.0}
                    onChange={v => setAssumption('dsra.sweep2028Pct' as any, v)}
                    format="percent"
                  />
                </td>
              </tr>
              <tr className="border-b border-surface-secondary">
                <td colSpan={2} className="pb-2 text-[11px] text-text-tertiary leading-relaxed pr-4">
                  {t('as.dsraSweepNote')}
                </td>
              </tr>
              {/* Replenishment priority */}
              <tr className="border-b border-surface-secondary">
                <td className="py-2 pr-4 text-text-secondary">{t('as.dsraReplenishPriority')}</td>
                <td className="py-2 text-right">
                  <EditableCell
                    value={a.dsra?.replenishmentPriority ?? 1.0}
                    onChange={v => setAssumption('dsra.replenishmentPriority' as any, v)}
                    format="percent"
                  />
                </td>
              </tr>
              {/* Partner repayment threshold */}
              <tr>
                <td className="pt-2 pr-4 text-text-secondary">{t('as.dsraRepayThreshold')}</td>
                <td className="pt-2 text-right">
                  <EditableCell
                    value={a.dsra?.partnerRepaymentThreshold ?? 2}
                    onChange={v => setAssumption('dsra.partnerRepaymentThreshold' as any, Math.round(v))}
                    format="number"
                  />
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="pb-2 text-[11px] text-text-tertiary leading-relaxed pr-4">
                  {t('as.dsraRepayThresholdNote')}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-text-tertiary leading-relaxed">{t('dsra.assumptionsCaption')}</p>
        </div>
      )}

      {/* ── Change History ── */}
      <HistoryPanel />

      {/* ── Saved Configurations ── */}
      <ConfigPanel />
      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={ASSUMPTIONS_TOUR} />
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') {
    if (Math.abs(v) >= 1000) return v.toLocaleString();
    if (!Number.isInteger(v)) return v.toFixed(4).replace(/\.?0+$/, '');
    return v.toString();
  }
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function HistoryPanel() {
  const { history, currentUser, setCurrentUser, revertChange, clearHistory } = useModelStore();
  const [expanded, setExpanded] = useState(false);
  const [editingUser, setEditingUser] = useState(false);
  const [userInput, setUserInput] = useState(currentUser);

  const visible = expanded ? history.slice().reverse() : history.slice(-10).reverse();
  const activeCount = history.filter((h) => !h.superseded && !h.reverted).length;

  return (
    <div className="mt-8 bg-white rounded-xl border border-surface-tertiary p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-lg text-text-primary">Change History</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            {history.length} {history.length === 1 ? 'change' : 'changes'}
            {activeCount > 0 && ` · ${activeCount} revertable`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-tertiary">Working as:</span>
            {editingUser ? (
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onBlur={() => { setCurrentUser(userInput); setEditingUser(false); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { setCurrentUser(userInput); setEditingUser(false); }
                  if (e.key === 'Escape') { setUserInput(currentUser); setEditingUser(false); }
                }}
                autoFocus
                className="px-2 py-0.5 rounded border border-brand-500/30 text-xs focus:outline-none w-28"
              />
            ) : (
              <button
                onClick={() => { setUserInput(currentUser); setEditingUser(true); }}
                className="px-2 py-0.5 rounded-md bg-brand-600/10 text-brand-700 font-medium hover:bg-brand-600/20 transition-colors"
              >
                {currentUser} ✎
              </button>
            )}
          </div>
          {history.length > 0 && (
            <button
              onClick={() => useModelStore.getState().requestConfirm({
                title: 'Clear change history?',
                message: 'This removes the audit trail of edits made in this session. Your current assumptions, templates, projects, and saved scenarios are not affected.',
                confirmLabel: 'Clear history',
                danger: true,
                onConfirm: clearHistory,
              })}
              className="text-xs text-text-tertiary hover:text-negative transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <p className="text-sm text-text-tertiary text-center py-6">No changes yet. Edit any value to start tracking.</p>
      ) : (
        <>
          <div className="space-y-1.5">
            {visible.map((entry) => {
              const isInactive = entry.superseded || entry.reverted;
              const canRevert = !isInactive && !entry.isRevert;
              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors ${
                    isInactive
                      ? 'bg-surface-secondary/20 opacity-60'
                      : entry.isRevert
                        ? 'bg-amber-50/70'
                        : 'bg-surface-secondary/40 hover:bg-surface-secondary/60'
                  }`}
                >
                  <span className="text-text-tertiary whitespace-nowrap">{timeAgo(entry.timestamp)}</span>
                  <span className="font-medium text-brand-700 whitespace-nowrap">{entry.user}</span>
                  {entry.isRevert && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap font-medium">Revert</span>
                  )}
                  <span className="flex-1 min-w-0 truncate">
                    {entry.scopeLabel && <span className="text-text-tertiary">{entry.scopeLabel} — </span>}
                    <span className="text-text-secondary">{entry.label}:</span>{' '}
                    <span className="font-mono text-text-tertiary">{formatValue(entry.before)}</span>
                    <span className="text-text-tertiary mx-1">→</span>
                    <span className="font-mono text-text-primary">{formatValue(entry.after)}</span>
                  </span>
                  {entry.reverted && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-tertiary text-text-tertiary whitespace-nowrap">Reverted</span>
                  )}
                  {entry.superseded && !entry.reverted && !entry.isRevert && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-tertiary text-text-tertiary whitespace-nowrap">Superseded</span>
                  )}
                  {canRevert && (
                    <button
                      onClick={() => revertChange(entry.id)}
                      className="px-2 py-0.5 rounded-md bg-brand-600/10 text-brand-600 hover:bg-brand-600/20 transition-colors whitespace-nowrap font-medium"
                    >
                      Revert
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {history.length > 10 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-3 text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              {expanded ? 'Show last 10' : `Show all ${history.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ConfigPanel() {
  const { t } = useTranslation();
  const {
    savedConfigs, activeConfigId, activeConfigName,
    lastSavedConfigId, lastSavedConfigName, editsSinceLastSave,
    saveConfig, updateConfig, loadConfig, deleteConfig, renameConfig, importConfigs,
  } = useModelStore();

  // Live-subscribe to the reference scenario id so the badge and
  // "Set as reference" affordance reflect what other admins set
  // without a manual refresh.
  const [referenceScenarioId, setReferenceScenarioIdState] = useState<
    string | null
  >(null);
  useEffect(() => {
    const db = getDb();
    if (!db) return;
    const unsub = subscribeReferenceScenarioId(db, (id) => {
      setReferenceScenarioIdState(id);
    });
    return () => unsub();
  }, []);

  const handleSetReference = useCallback(
    async (scenarioId: string | null, uid: string | undefined) => {
      const db = getDb();
      const store = useModelStore.getState();
      if (!uid) {
        store.requestAlert({
          title: 'Sign-in required',
          message: 'You must be signed in as an admin to set the reference scenario.',
          tone: 'warning',
        });
        return;
      }
      try {
        await setReferenceScenarioId(db, scenarioId, uid);
      } catch (err) {
        store.requestAlert({
          title: 'Could not update reference scenario',
          message: (err as Error).message,
          tone: 'error',
        });
      }
    },
    [],
  );
  // Auth gates *write* actions only — listing/loading scenarios stays public
  // so unauthenticated visitors (e.g. bankers on a share link) can still see
  // and inspect saved scenarios. See firestore.rules:29 — create/update now
  // require `request.auth != null`, so a save attempt while signed-out would
  // 403 silently without this gate.
  // Use the impersonation-aware wrapper so View-As propagates here. `user`,
  // `signIn`, `signOut` pass through untouched from useAuth; only the
  // role-derived flag `canEdit` reflects the active impersonation.
  const {
    user,
    profile,
    canEdit,
    loading: authLoading,
    signIn,
    signOut,
    isImpersonating,
    effectiveRole,
  } = useEffectiveAuth();
  const canWrite = canEdit;
  // SECURITY: while admin is previewing as banker, treat the session as
  // unauthenticated for scenario-ownership purposes. Without this guard
  // useEffectiveAuth preserves the real `user`, so the real uid would
  // leak into the store (setCurrentAuthIdentity) and into the picker's
  // "Your scenarios" filter — defeating the View-As contract.
  // See security-auditor M1 (2026-05-22).
  const isPreviewAsBanker = isImpersonating && effectiveRole === 'banker';
  const mineUid = isPreviewAsBanker ? null : (user?.uid ?? null);
  const [newName, setNewName] = useState('');
  // Inline save row also gets the share-with-team toggle. Default off, so
  // users opt into sharing each time. Independent of the modal's state.
  const [publishToTeam, setPublishToTeam] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Auth identity bridge (sharing extension) ─────────────────────
  // Push uid / displayName / email into the store so saveConfig & friends
  // can stamp ownership without a hook (the store is plain TS). Also
  // trigger hydrateForUser to re-fetch the scenario list with the
  // own-scenarios query in addition to the published one.
  //
  // Dep array intentionally narrow — primitive uid / displayName / email
  // values, NOT the whole `user` / `profile` objects (which Firebase
  // re-creates on every token refresh and would thrash the effect).
  //
  // SECURITY: bridge `mineUid` (not `user?.uid`) so impersonation-as-banker
  // reports the session as unauthenticated to the store. Likewise blank the
  // displayName/email when previewing as banker so attribution can't leak.
  const uid = mineUid;
  // Prefer the users/{uid} displayName (admin-curated) over the auth
  // user displayName (Google profile) since the former is what other
  // editors expect to see in "Saved by X" attribution.
  const displayName = isPreviewAsBanker
    ? null
    : (profile?.displayName ?? user?.displayName ?? null);
  const email = isPreviewAsBanker ? null : (user?.email ?? null);
  useEffect(() => {
    if (authLoading) return;
    const store = useModelStore.getState();
    store.setCurrentAuthIdentity({ uid, displayName, email });
    // Only re-hydrate when the uid actually changes — display name flips
    // don't change which docs are readable, only how we render them.
    void store.hydrateForUser(uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, authLoading]);
  // Separate effect so a displayName change (e.g. admin edits profile)
  // updates the store identity but doesn't trigger a re-fetch.
  useEffect(() => {
    if (authLoading) return;
    useModelStore.getState().setCurrentAuthIdentity({ uid, displayName, email });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName, email, authLoading]);

  const handleSignIn = async () => {
    const store = useModelStore.getState();
    try {
      await signIn();
    } catch (err) {
      const msg = (err as Error).message ?? 'Could not complete Google sign-in.';
      const isUnauthorizedDomain = msg.includes('auth/unauthorized-domain');
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      store.requestAlert({
        title: 'Sign-in failed',
        message: isUnauthorizedDomain
          ? `Firebase Auth does not allow sign-in from this domain.\n\nTo fix: go to Firebase Console → Authentication → Sign-in method → Authorized domains → Add domain:\n\n${hostname}\n\nThis is a one-time setup step in the Firebase Console (console.firebase.google.com → project villa-lev-admin).`
          : msg,
        tone: 'error',
      });
    }
  };

  const handleSave = () => {
    if (!newName.trim()) return;
    void saveConfig(newName.trim(), { published: publishToTeam });
    setNewName('');
    setPublishToTeam(false);
  };

  const handleExport = () => {
    if (savedConfigs.length === 0) return;
    const json = JSON.stringify({ version: 1, savedAt: Date.now(), configs: savedConfigs }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `villa-lev-scenarios-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const store = useModelStore.getState();
      try {
        const text = String(reader.result ?? '');
        const parsed = JSON.parse(text);
        // Accept both wrapped { configs: [...] } and bare array forms.
        const incoming = Array.isArray(parsed) ? parsed : (parsed?.configs ?? []);
        if (!Array.isArray(incoming) || incoming.length === 0) {
          store.requestAlert({
            title: 'No scenarios in this file',
            message: 'The file parsed correctly but did not contain any scenarios. Make sure you exported it via the "Export backup" button.',
            tone: 'warning',
          });
          return;
        }
        const { added, updated } = importConfigs(incoming);
        const unchanged = incoming.length - added - updated;
        store.requestAlert({
          title: 'Import complete',
          message: `${added} new scenario${added !== 1 ? 's' : ''} added, ${updated} updated, ${unchanged} unchanged. They are now visible in the list below and shared with everyone connecting.`,
          tone: 'success',
        });
      } catch (err) {
        store.requestAlert({
          title: 'Import failed',
          message: 'Could not parse the file as scenario JSON.\n\n' + (err as Error).message,
          tone: 'error',
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="mt-8 bg-white rounded-xl border border-surface-tertiary p-6">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <h3 className="font-display text-lg text-text-primary">{t('config.savedConfigs')}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={savedConfigs.length === 0}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-secondary text-text-secondary hover:bg-surface-tertiary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Download all saved scenarios as a JSON backup"
          >
            ⬇ Export backup
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={!canWrite}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-positive/10 text-positive hover:bg-positive/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={canWrite ? "Restore scenarios from a previously exported JSON file" : "Sign in to import"}
          >
            ⬆ Import backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          />
        </div>
      </div>

      {/* Active scenario indicator. The "Unsaved" pill triggers whenever there
          are pending edits OR no scenario has been loaded yet, so the user
          always sees their persistence state — not just after loading one. */}
      {(activeConfigName || lastSavedConfigName || editsSinceLastSave > 0) && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${activeConfigId ? 'bg-positive animate-pulse' : 'bg-warning'}`} />
          {activeConfigName ? (
            <span className="text-text-secondary">{t('config.active')}: <strong>{activeConfigName}</strong></span>
          ) : lastSavedConfigName ? (
            <span className="text-text-secondary">Last saved: <strong>{lastSavedConfigName}</strong></span>
          ) : (
            <span className="text-text-secondary">No scenario loaded — current edits live only in your browser.</span>
          )}
          {!activeConfigId && (
            <span className="text-xs text-warning bg-warning/10 px-2 py-0.5 rounded-full">{t('config.unsaved')}</span>
          )}
        </div>
      )}

      {/* Save row — gated on admin auth. Signed-out visitors see a single
          sign-in CTA in the same slot so the affordance for "this is how you
          persist a scenario" stays in the same place. Loading state hides
          both to avoid a flash of "Sign in to save" before Firebase resolves
          the cached session. */}
      {authLoading ? (
        <div className="flex gap-2 mb-6 h-[46px]" aria-hidden="true" />
      ) : canWrite ? (
        <div className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={t('config.nameLabel')}
              className="flex-1 px-4 py-2.5 rounded-xl border border-surface-tertiary bg-surface-secondary/30 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
            />
            <button
              onClick={handleSave}
              disabled={!newName.trim()}
              className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {t('config.save')}
            </button>
            <button
              onClick={signOut}
              className="px-3 py-2.5 rounded-xl bg-surface-secondary text-text-secondary text-xs font-medium hover:bg-surface-tertiary transition-all"
              title={`Signed in as ${user?.email ?? 'admin'}`}
            >
              Sign out
            </button>
          </div>
          <label className="flex items-center gap-2 mt-2 text-xs text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox"
              checked={publishToTeam}
              onChange={(e) => setPublishToTeam(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-surface-tertiary text-brand-600 focus:ring-brand-500/30"
            />
            {t('scenarios.shareWithTeam')}
          </label>
        </div>
      ) : (
        <div className="flex gap-2 mb-6 items-center">
          <div className="flex-1 px-4 py-2.5 rounded-xl border border-surface-tertiary bg-surface-secondary/30 text-sm text-text-tertiary">
            {user
              ? `Signed in as ${user.email ?? 'unknown'} — not on admin allow-list. Scenarios are read-only.`
              : 'Scenarios are read-only for unauthenticated visitors. Save, import, rename, and delete require admin sign-in.'}
          </div>
          <button
            onClick={handleSignIn}
            className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-all"
          >
            Sign in to save
          </button>
        </div>
      )}

      {(() => {
        // ── Sharing extension: split into "Your scenarios" / "Shared scenarios" ──
        // Own scenarios = no userId (legacy local) OR userId matches mine.
        // Shared scenarios = userId != mine AND published == true.
        // Banker view (uid == null) sees ONLY shared — the "Your" section
        // is hidden entirely so it doesn't dangle empty.
        //
        // `mineUid` is computed at the top of ConfigPanel and is null when
        // (a) signed-out or (b) admin is previewing as banker (security M1).
        const own = mineUid
          ? savedConfigs
              .filter((c) => !c.userId || c.userId === mineUid)
              .slice()
              .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0))
          : [];
        const shared = savedConfigs
          .filter(
            (c) => c.userId && c.userId !== mineUid && c.published,
          )
          .slice()
          .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));

        if (savedConfigs.length === 0) {
          return (
            <div className="text-sm text-text-tertiary text-center py-6 space-y-2">
              <p>{t('config.noSaved')}</p>
              <p className="text-xs max-w-xs mx-auto leading-snug">
                Scenarios are saved to Firestore (requires sign-in) and also
                cached in your browser. If you saved scenarios before and they
                are missing, open the original browser and use{' '}
                <span className="font-medium text-text-secondary">Export backup</span>{' '}
                to download a JSON file, then import it here.
              </p>
            </div>
          );
        }

        const renderCard = (
          config: typeof savedConfigs[number],
          isOwn: boolean,
        ) => {
          const ownerName =
            config.ownerDisplayName ??
            config.copiedFrom?.displayName ??
            'Unknown';
          const savedDate = new Date(config.savedAt);
          const dateStr = `${savedDate.toLocaleDateString()} ${savedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          return (
            <div
              key={config.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                config.id === activeConfigId
                  ? 'border-brand-500/40 bg-brand-50/50'
                  : 'border-surface-tertiary hover:border-surface-tertiary/80 hover:bg-surface-secondary/20'
              }`}
            >
              {editingId === config.id && canWrite && isOwn ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { void renameConfig(config.id, editName); setEditingId(null); }
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => { void renameConfig(config.id, editName); setEditingId(null); }}
                  autoFocus
                  className="flex-1 px-3 py-1 rounded-lg border border-brand-500/30 text-sm focus:outline-none"
                />
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-text-primary truncate">{config.name}</span>
                    {/* Reference badge — visible to EVERYONE, not just admins,
                        so unauthenticated visitors see which scenario the
                        admin designated as the default. */}
                    {referenceScenarioId === config.id && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-brand-100 text-brand-700 text-[10px] font-semibold uppercase tracking-wider shrink-0">
                        {t('ref.referenceBadge')}
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => handleSetReference(null, mineUid ?? undefined)}
                            aria-label={t('ref.dismiss')}
                            title={t('ref.dismiss')}
                            className="ms-0.5 text-brand-700/70 hover:text-brand-900 transition-colors"
                          >
                            &times;
                          </button>
                        )}
                      </span>
                    )}
                    {/* Shared-with-team badge on own cards that I published.
                        Lets me see at a glance which of mine other editors
                        can see. */}
                    {isOwn && config.published && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-positive/15 text-positive text-[10px] font-semibold uppercase tracking-wider shrink-0">
                        Shared
                      </span>
                    )}
                  </div>
                  {/* Step L — attribution line. Foreign card: "Saved by X · date".
                      Own card with copiedFrom: small "Copied from X" sub-line
                      under the date. */}
                  {isOwn ? (
                    <div className="text-xs text-text-tertiary">
                      {dateStr}
                      {config.copiedFrom && (
                        <span className="ms-1 text-text-tertiary/80">
                          · {t('scenarios.copiedFrom').replace('{name}', config.copiedFrom.displayName || 'Unknown')}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-text-tertiary">
                      {t('scenarios.savedBy')
                        .replace('{name}', ownerName)
                        .replace('{date}', dateStr)}
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                {/* Load is read-only (client-side store hydration) so it
                    stays available to anonymous visitors. For shared cards
                    it ALSO triggers copy-on-load in modelStore.loadConfig. */}
                <button onClick={() => void loadConfig(config.id)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600/10 text-brand-600 hover:bg-brand-600/20 transition-colors">{t('config.load')}</button>
                {canWrite && isOwn && (
                  <>
                    {referenceScenarioId !== config.id && (
                      <button
                        onClick={() => handleSetReference(config.id, mineUid ?? undefined)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                        title={t('ref.setAsReference')}
                      >
                        ★ {t('ref.setAsReference')}
                      </button>
                    )}
                    <button
                      onClick={() => useModelStore.getState().requestConfirm({
                        title: `Overwrite "${config.name}"?`,
                        message: 'The saved state for this scenario will be replaced with your current assumptions, templates, and projects. Other scenarios in the list are not affected.',
                        confirmLabel: 'Overwrite',
                        danger: true,
                        onConfirm: () => { void updateConfig(config.id); },
                      })}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-positive/10 text-positive hover:bg-positive/20 transition-colors"
                      title="Save current state on top of this scenario"
                    >
                      Save here
                    </button>
                    <button onClick={() => { setEditingId(config.id); setEditName(config.name); }} className="px-2.5 py-1.5 text-xs rounded-lg text-text-tertiary hover:bg-surface-secondary transition-colors" title={t('config.rename')}>&#9998;</button>
                    <button
                      onClick={() => useModelStore.getState().requestConfirm({
                        title: `Delete "${config.name}"?`,
                        message: config.published
                          ? 'This removes the scenario from the shared list. Other editors will no longer see it. This cannot be undone — export a backup first if you might want it back.'
                          : 'This removes the scenario. This cannot be undone — export a backup first if you might want it back.',
                        confirmLabel: 'Delete scenario',
                        danger: true,
                        onConfirm: () => { void deleteConfig(config.id); },
                      })}
                      className="px-2.5 py-1.5 text-xs rounded-lg text-negative/60 hover:text-negative hover:bg-red-50 transition-colors"
                      title={t('config.delete')}
                    >&times;</button>
                  </>
                )}
                {/* Read-only indicator on shared cards, so the user knows
                    why Save here / rename / delete aren't offered. */}
                {!isOwn && (
                  <span
                    className="px-2 py-1 text-[10px] uppercase tracking-wider text-text-tertiary"
                    title={t('scenarios.readOnlyShared')}
                  >
                    Read-only
                  </span>
                )}
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-6">
            {mineUid && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-text-tertiary mb-2">
                  {t('scenarios.yourScenarios')}
                </h4>
                {own.length === 0 ? (
                  <p className="text-sm text-text-tertiary py-2">
                    {t('config.noSaved')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {own.map((c) => renderCard(c, true))}
                  </div>
                )}
              </div>
            )}
            {shared.length > 0 && (
              <div>
                <h4 className="text-xs uppercase tracking-wider text-text-tertiary mb-2">
                  {t('scenarios.sharedScenarios')}
                </h4>
                <div className="space-y-2">
                  {shared.map((c) => renderCard(c, false))}
                </div>
              </div>
            )}
            {!mineUid && shared.length === 0 && (
              <p className="text-sm text-text-tertiary text-center py-6">
                {t('config.noSaved')}
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
