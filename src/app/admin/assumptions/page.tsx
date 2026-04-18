"use client";

import { useModelStore } from "@/lib/store/modelStore";
import {
  formatCurrency,
  formatPercent,
  formatMultiple,
} from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { useState } from "react";
import { FinancingPath, PropertyTemplate } from "@/lib/engine/types";

// ── Shared Components ──

function EditableCell({
  value,
  onChange,
  format = "number",
}: {
  value: number;
  onChange: (v: number) => void;
  format?: "number" | "currency" | "percent";
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

  if (editing) {
    return (
      <input
        type="number"
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

  return (
    <div
      className="px-2 py-1 text-right data-cell bg-blue-50/50 rounded cursor-pointer hover:bg-blue-100/50 transition-colors"
      onClick={() => {
        setInputValue(
          format === "percent" ? (value * 100).toString() : value.toString()
        );
        setEditing(true);
      }}
    >
      {display}
    </div>
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
          onChange={(v) => setAssumption(path, v)}
        />
      </td>
      <td className="py-2 pl-4 text-xs text-text-tertiary">{note}</td>
    </tr>
  );
}

// ── Template Card ──

function TemplateCard({ tpl, startExpanded = false }: { tpl: PropertyTemplate; startExpanded?: boolean }) {
  const { locale } = useTranslation();
  const { updateTemplate, renameTemplate, duplicateTemplate, deleteTemplate, projects } =
    useModelStore();
  const [expanded, setExpanded] = useState(startExpanded);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(tpl.name);

  const inUse = projects.some((p) => p.templateId === tpl.id);
  const projectCount = projects.filter((p) => p.templateId === tpl.id).length;

  const capexPerUnit =
    tpl.landCost +
    tpl.constructionArea * tpl.constructionCostPerM2 +
    tpl.ffeCost +
    tpl.legalFees +
    tpl.architectFees +
    tpl.civilEngineerFees +
    (tpl.constructionArea * tpl.constructionCostPerM2 + tpl.ffeCost) * tpl.contingencyRate;

  const totalOpex = Object.values(tpl.opex).reduce((s, v) => s + v, 0);

  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-all ${
      tpl.builtIn ? 'border-surface-tertiary' : 'border-brand-300 shadow-sm'
    }`}>
      {/* Header — clickable to expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 bg-surface-secondary/30 hover:bg-surface-secondary/50 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${tpl.type === 'villa' ? 'bg-brand-600' : 'bg-info'}`} />
          <span className="text-sm font-semibold text-text-primary">
            {tpl.name}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            tpl.type === 'villa'
              ? 'bg-brand-100 text-brand-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {tpl.type === 'villa' ? 'Villa' : 'Suite'}
          </span>
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
              <span>{tpl.constructionArea}m² &middot; {formatCurrency(tpl.constructionCostPerM2, false, locale)}/m²</span>
              <span>Land: {formatCurrency(tpl.landCost, false, locale)}</span>
              <span>OPEX/yr: {formatCurrency(totalOpex, true, locale)}</span>
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
              {!tpl.builtIn && !inUse && (
                <button
                  onClick={() => deleteTemplate(tpl.id)}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CAPEX */}
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wider text-text-tertiary mb-3">CAPEX Parameters</h4>
                <table className="w-full">
                  <tbody>
                    <TemplateRow label="Land cost" value={tpl.landCost} tplId={tpl.id} path="landCost" format="currency" />
                    <TemplateRow label="Construction area (m²)" value={tpl.constructionArea} tplId={tpl.id} path="constructionArea" />
                    <TemplateRow label="Cost per m²" value={tpl.constructionCostPerM2} tplId={tpl.id} path="constructionCostPerM2" format="currency" />
                    <TemplateRow label="FF&E" value={tpl.ffeCost} tplId={tpl.id} path="ffeCost" format="currency" />
                    <TemplateRow label="Legal & notary" value={tpl.legalFees} tplId={tpl.id} path="legalFees" format="currency" />
                    <TemplateRow label="Architect + design" value={tpl.architectFees} tplId={tpl.id} path="architectFees" format="currency" />
                    <TemplateRow label="Civil engineer" value={tpl.civilEngineerFees} tplId={tpl.id} path="civilEngineerFees" format="currency" />
                    <TemplateRow label="Contingency rate" value={tpl.contingencyRate} tplId={tpl.id} path="contingencyRate" format="percent" />
                  </tbody>
                </table>
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
                    {Object.entries(tpl.opex).map(([key, val]) => (
                      <TemplateRow
                        key={key}
                        label={key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                        value={val}
                        tplId={tpl.id}
                        path={`opex.${key}`}
                        format="currency"
                      />
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 pt-2 border-t border-surface-secondary/50 flex justify-between text-xs">
                  <span className="font-medium text-text-secondary">Total OPEX/yr</span>
                  <span className="font-mono font-semibold text-text-primary">{formatCurrency(totalOpex, true, locale)}</span>
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
          onChange={(v) => updateTemplate(tplId, path, v)}
        />
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

  const capexPerUnit = tpl
    ? tpl.landCost +
      tpl.constructionArea * tpl.constructionCostPerM2 +
      tpl.ffeCost +
      tpl.legalFees +
      tpl.architectFees +
      tpl.civilEngineerFees +
      (tpl.constructionArea * tpl.constructionCostPerM2 + tpl.ffeCost) * tpl.contingencyRate
    : 0;

  return (
    <div className="bg-white rounded-xl border border-surface-tertiary shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${tpl?.type === 'villa' ? 'bg-brand-600' : 'bg-info'}`} />

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
                  {t.name} ({t.type})
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
              className="text-xs text-negative/50 hover:text-negative transition-colors px-1"
              title="Remove project"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Summary line */}
      {tpl && (
        <div className="px-5 py-2 flex items-center gap-6 text-xs text-text-tertiary border-t border-surface-secondary/30 bg-surface-secondary/20">
          <span>{tpl.constructionArea}m² &middot; {tpl.type}</span>
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
          const capex =
            tpl.landCost +
            tpl.constructionArea * tpl.constructionCostPerM2 +
            tpl.ffeCost +
            tpl.legalFees +
            tpl.architectFees +
            tpl.civilEngineerFees +
            (tpl.constructionArea * tpl.constructionCostPerM2 + tpl.ffeCost) * tpl.contingencyRate;

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
                <div className={`w-2.5 h-2.5 rounded-full ${tpl.type === 'villa' ? 'bg-brand-600' : 'bg-info'}`} />
                <span className="text-sm font-medium text-text-primary group-hover:text-brand-600">
                  {tpl.name}
                </span>
              </div>
              <div className="text-xs text-text-tertiary">
                {tpl.constructionArea}m² &middot; {formatCurrency(capex, true, locale)}/unit
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
  } = useModelStore();
  const [tab, setTab] = useState<
    "portfolio" | "templates" | "general" | "revenue" | "financing"
  >("portfolio");

  if (!model) return null;

  const a = assumptions;
  const totalPlots = a.portfolio.reduce((s, p) => s + p.count, 0);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-text-primary">
            {t('as.title')}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {t('as.subtitle')}
          </p>
        </div>
        <button
          onClick={resetToDefaults}
          className="text-sm text-text-tertiary hover:text-negative transition-colors"
        >
          {t('as.resetDefaults')}
        </button>
      </div>

      {/* Portfolio Summary Bar */}
      <div className="mb-6 bg-white rounded-2xl border-2 border-brand-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-base text-text-primary">Portfolio Overview</h3>
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <span>{templates.length} templates</span>
            <span>&middot;</span>
            <span>{projects.length} projects</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1">Projects</label>
            <div className="font-mono text-2xl font-bold text-brand-600">{projects.length}</div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1">Total Units</label>
            <div className="font-mono text-2xl font-bold text-text-primary">{totalPlots}</div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1">Built Surface</label>
            <div className="font-mono text-lg font-semibold text-text-primary">
              {a.portfolio.reduce((s, p) => s + p.constructionArea * p.count, 0).toLocaleString()}m²
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-text-tertiary mb-1">Total CAPEX</label>
            <div className="font-mono text-lg font-semibold text-text-primary">
              {formatCurrency(model.capex.portfolioTotal, true, locale)}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-secondary rounded-lg p-1">
        {(
          [
            { id: "portfolio", label: "Portfolio" },
            { id: "templates", label: "Templates" },
            { id: "financing", label: t('as.financingPaths') },
            { id: "general", label: t('as.general') },
            { id: "revenue", label: t('as.revenue') },
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
        </div>
      )}

      {/* ── TEMPLATES TAB ── */}
      {tab === "templates" && (
        <div className="space-y-6">
          {/* Create New Template — prominent CTA at top */}
          <div className="bg-gradient-to-r from-brand-50 to-blue-50 rounded-2xl border-2 border-dashed border-brand-300 p-6">
            <h3 className="font-display text-lg text-text-primary mb-2">Create a New Template</h3>
            <p className="text-sm text-text-secondary mb-4">
              Start from a default template, then customize all CAPEX and OPEX values.
              Or duplicate any existing template below.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => addTemplate('villa')}
                className="px-5 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors shadow-sm"
              >
                + New Villa Template
              </button>
              <button
                onClick={() => addTemplate('suite')}
                className="px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                + New Suite Template
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
              {templates.map((tpl) => (
                <TemplateCard key={tpl.id} tpl={tpl} startExpanded={!tpl.builtIn} />
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
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
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
                {
                  id: "tepix-guarantee" as FinancingPath,
                  title: t('path.tepixGuarantee'),
                  desc: t('path.tepixGuaranteeDesc'),
                  highlight: `${t('term.ds')}: ${formatCurrency(model.financingComparison[3]?.tepixGuarantee as number, true, locale)}/yr`,
                  borderColor: "#C4754B",
                  bgColor: "#FDF5F0",
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
                  <AssumptionRow label={t('field.totalLoanDrawn')} value={a.rrf.totalLoanDrawn} path="rrf.totalLoanDrawn" format="currency" />
                  <AssumptionRow label={t('field.equityRequired')} value={a.rrf.equityRequired} path="rrf.equityRequired" format="currency" />
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

            {a.financingPath === "tepix-guarantee" && (<>
              <table className="w-full">
                <tbody>
                  <AssumptionRow label={t('field.tepixCoverage')} value={a.tepixGuarantee.coverageRate} path="tepixGuarantee.coverageRate" format="percent" note="90% coverage" />
                  <AssumptionRow label={t('field.tepixGuaranteeRate')} value={a.tepixGuarantee.guaranteeRate} path="tepixGuarantee.guaranteeRate" format="percent" note="70% guarantee" />
                  <AssumptionRow label={t('field.tepixBankRate')} value={a.tepixGuarantee.bankInterestRate} path="tepixGuarantee.bankInterestRate" format="percent" />
                  <AssumptionRow label={t('field.tepixSubsidy')} value={a.tepixGuarantee.interestSubsidy} path="tepixGuarantee.interestSubsidy" format="percent" note="2pp subsidy" />
                  <AssumptionRow label={t('field.tepixSubsidyDuration')} value={a.tepixGuarantee.subsidyDurationYears} path="tepixGuarantee.subsidyDurationYears" />
                  <AssumptionRow label={t('field.tepixTotalTerm')} value={a.tepixGuarantee.totalTermYears} path="tepixGuarantee.totalTermYears" />
                  <AssumptionRow label={t('field.tepixGrace')} value={a.tepixGuarantee.gracePeriodYears} path="tepixGuarantee.gracePeriodYears" />
                  <AssumptionRow label={t('field.tepixCollateralCap')} value={a.tepixGuarantee.collateralCapRate} path="tepixGuarantee.collateralCapRate" format="percent" />
                  <AssumptionRow label={t('field.tepixLandCap')} value={a.tepixGuarantee.landCapOnFundContribution} path="tepixGuarantee.landCapOnFundContribution" format="percent" note={t('field.tepixLandCapNote')} />
                </tbody>
              </table>
              <div className="mt-4 rounded-lg border border-orange-300 bg-orange-50 p-4">
                <h4 className="text-sm font-semibold text-[#C4754B] mb-3">{t('field.tepixCombinedStructure')}</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-text-tertiary">{t('field.tepixPrimaryLoan')}</span><div className="font-mono font-semibold">{formatCurrency(model.keyMetrics.primaryLoan, true, locale)}</div></div>
                  <div><span className="text-text-tertiary">{t('field.tepixSuppLoan')}</span><div className="font-mono font-semibold">{formatCurrency(model.keyMetrics.supplementaryLoan, true, locale)}</div></div>
                  <div><span className="text-text-tertiary">{t('field.tepixLandFundedByTepix')}</span><div className="font-mono font-semibold">{formatCurrency(model.keyMetrics.landFundedByTepix, true, locale)}</div></div>
                  <div><span className="text-text-tertiary">{t('field.tepixLandGap')}</span><div className="font-mono font-semibold">{formatCurrency(model.keyMetrics.landFundedByCommercial, true, locale)}</div></div>
                  <div className="col-span-2 pt-2 border-t border-orange-200"><span className="text-text-tertiary">{t('field.tepixCombinedDS')}</span><div className="font-mono font-semibold text-lg">{formatCurrency(model.keyMetrics.annualDS, true, locale)}/yr</div></div>
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
              <AssumptionRow label={t('field.stdSuiteADR')} value={a.revenueRealistic.suiteStandardADR} path="revenueRealistic.suiteStandardADR" format="currency" note="x2 suites" />
              <AssumptionRow label={t('field.dblSuiteADR')} value={a.revenueRealistic.suiteDoubleADR} path="revenueRealistic.suiteDoubleADR" format="currency" note="x2 suites" />
              <AssumptionRow label={t('field.suiteNights')} value={a.revenueRealistic.suiteBaseNights} path="revenueRealistic.suiteBaseNights" />
              <AssumptionRow label={t('field.eventsPerYear')} value={a.revenueRealistic.eventsPerYear} path="revenueRealistic.eventsPerYear" />
              <AssumptionRow label={t('field.profitPerEvent')} value={a.revenueRealistic.netProfitPerEvent} path="revenueRealistic.netProfitPerEvent" format="currency" />
              <AssumptionRow label={t('field.ancillaryProfit')} value={a.revenueRealistic.ancillaryBaseProfit} path="revenueRealistic.ancillaryBaseProfit" format="currency" note="Chef, boat, car rentals" />
              <AssumptionRow label={t('field.ancillaryGrowth')} value={a.revenueRealistic.ancillaryGrowthRate} path="revenueRealistic.ancillaryGrowthRate" format="percent" note="+10%/yr from 2028" />
            </tbody>
          </table>

          <SectionHeader title={t('as.upsideScenario')} />
          <table className="w-full">
            <tbody>
              <AssumptionRow label="Villa ADR — upside" value={a.revenueUpside.villaADR} path="revenueUpside.villaADR" format="currency" />
              <AssumptionRow label="Villa nights — upside (mature)" value={a.revenueUpside.villaBaseNights} path="revenueUpside.villaBaseNights" />
              <AssumptionRow label="Standard Suite ADR — upside" value={a.revenueUpside.suiteStandardADR} path="revenueUpside.suiteStandardADR" format="currency" />
              <AssumptionRow label="Double Suite ADR — upside" value={a.revenueUpside.suiteDoubleADR} path="revenueUpside.suiteDoubleADR" format="currency" />
              <AssumptionRow label="Suite nights — upside" value={a.revenueUpside.suiteBaseNights} path="revenueUpside.suiteBaseNights" />
              <AssumptionRow label="Events — upside" value={a.revenueUpside.eventsPerYear} path="revenueUpside.eventsPerYear" />
            </tbody>
          </table>
        </div>
      )}

      {/* ── Saved Configurations ── */}
      <ConfigPanel />
    </div>
  );
}

function ConfigPanel() {
  const { t } = useTranslation();
  const {
    savedConfigs, activeConfigId, activeConfigName,
    saveConfig, loadConfig, deleteConfig, renameConfig,
  } = useModelStore();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleSave = () => {
    if (!newName.trim()) return;
    saveConfig(newName.trim());
    setNewName('');
  };

  return (
    <div className="mt-8 bg-white rounded-2xl border border-surface-tertiary shadow-sm p-6">
      <h3 className="font-display text-lg text-text-primary mb-4">{t('config.savedConfigs')}</h3>

      {activeConfigName && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
          <span className="text-text-secondary">{t('config.active')}: <strong>{activeConfigName}</strong></span>
          {!activeConfigId && (
            <span className="text-xs text-warning bg-warning/10 px-2 py-0.5 rounded-full">{t('config.unsaved')}</span>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-6">
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
          className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {t('config.save')}
        </button>
      </div>

      {savedConfigs.length === 0 ? (
        <p className="text-sm text-text-tertiary text-center py-6">{t('config.noSaved')}</p>
      ) : (
        <div className="space-y-2">
          {savedConfigs.map((config) => (
            <div
              key={config.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                config.id === activeConfigId
                  ? 'border-brand-500/40 bg-brand-50/50'
                  : 'border-surface-tertiary hover:border-surface-tertiary/80 hover:bg-surface-secondary/20'
              }`}
            >
              {editingId === config.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { renameConfig(config.id, editName); setEditingId(null); }
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => { renameConfig(config.id, editName); setEditingId(null); }}
                  autoFocus
                  className="flex-1 px-3 py-1 rounded-lg border border-brand-500/30 text-sm focus:outline-none"
                />
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">{config.name}</div>
                  <div className="text-xs text-text-tertiary">
                    {new Date(config.savedAt).toLocaleDateString()} {new Date(config.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <button onClick={() => loadConfig(config.id)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600/10 text-brand-600 hover:bg-brand-600/20 transition-colors">{t('config.load')}</button>
                <button onClick={() => { setEditingId(config.id); setEditName(config.name); }} className="px-2.5 py-1.5 text-xs rounded-lg text-text-tertiary hover:bg-surface-secondary transition-colors" title={t('config.rename')}>&#9998;</button>
                <button onClick={() => deleteConfig(config.id)} className="px-2.5 py-1.5 text-xs rounded-lg text-negative/60 hover:text-negative hover:bg-red-50 transition-colors" title={t('config.delete')}>&times;</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
