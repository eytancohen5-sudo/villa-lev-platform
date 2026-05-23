"use client";

import { useModelStore } from "@/lib/store/modelStore";
import {
  formatCurrency,
  formatPercent,
  formatMultiple,
} from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { PageSkeleton } from "@/components/Skeleton";

// ── Shared UI components ─────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3 mt-8 first:mt-0 px-1">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
        {title}
      </h2>
      {sub && <span className="text-[11px] text-text-tertiary">{sub}</span>}
    </div>
  );
}

function StatusChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${
        ok ? "bg-positive/15 text-positive" : "bg-warning/15 text-warning"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-positive" : "bg-warning"}`} />
      {label}
    </span>
  );
}

function KPICard({
  label,
  value,
  sublabel,
  threshold,
  chip,
  accent = false,
  tone,
}: {
  label: string;
  value: string;
  sublabel?: string;
  threshold?: string;
  chip?: { label: string; ok: boolean };
  accent?: boolean;
  tone?: "positive" | "warning" | "neutral";
}) {
  const valueColor =
    tone === "positive" ? "text-positive" : tone === "warning" ? "text-warning" : "text-text-primary";
  return (
    <div
      className={`relative rounded-xl border p-5 ${
        accent ? "bg-brand-50 border-brand-200" : "bg-white border-surface-tertiary"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
          {label}
        </div>
        {chip && <StatusChip label={chip.label} ok={chip.ok} />}
      </div>
      <div className={`kpi-value ${valueColor}`}>{value}</div>
      {sublabel && <div className="text-xs text-text-tertiary mt-1">{sublabel}</div>}
      {threshold && (
        <div className="text-[11px] text-text-tertiary/80 mt-1.5 pt-1.5 border-t border-surface-tertiary/50">
          {threshold}
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────

export default function ReturnsPage() {
  const { t, locale } = useTranslation();
  const { model, activeScenario, assumptions } = useModelStore();

  if (!model) return <PageSkeleton variant="grid" />;

  const activeScenarioOutput = model.scenarios[activeScenario];
  const scenarioLabel = activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1);

  const yieldStabilised = activeScenarioOutput.yieldStabilised;
  const cumulativeYieldFinal = activeScenarioOutput.cumulativeYieldFinal;
  const totalMOIC = activeScenarioOutput.totalMOIC;
  const equityPaybackYears = activeScenarioOutput.equityPaybackYears;
  const equityIRR = activeScenarioOutput.equityIRR;
  const projectIRR = activeScenarioOutput.projectIRR;
  const terminalUnderwater = activeScenarioOutput.terminalUnderwater;

  const terminalAssetValue = activeScenarioOutput.terminalAssetValue;
  const terminalAssetValuePropertySale = activeScenarioOutput.terminalAssetValuePropertySale;
  const terminalEquityValue = activeScenarioOutput.terminalEquityValue;
  const terminalEquityValuePropertySale = activeScenarioOutput.terminalEquityValuePropertySale;
  const equityIRRPropertySale = activeScenarioOutput.equityIRRPropertySale;
  const projectIRRPropertySale = activeScenarioOutput.projectIRRPropertySale;
  const propertyExitDominates = activeScenarioOutput.propertyExitDominates;
  const exitValuationPerM2 = activeScenarioOutput.exitValuationPerM2;

  const formatYieldMultiple = (v: number) => `${v.toFixed(2)}×`;

  const pathLabel =
    assumptions.financingPath === "grant"
      ? t("path.grant")
      : assumptions.financingPath === "rrf"
        ? t("path.rrf")
        : assumptions.financingPath === "tepix-loan"
          ? t("path.tepixLoan")
          : t("path.commercial");

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-text-primary">Returns Analysis</h1>
          <p className="text-sm font-medium text-text-secondary mt-1">
            <span className="text-text-primary">{pathLabel}</span>
            <span className="text-text-tertiary"> &middot; </span>
            {scenarioLabel}
          </p>
        </div>
      </div>

      {/* Section 1 — 6-card returns grid */}
      <SectionHeader
        title={t("dash.section.returns")}
        sub={t("dash.returnsSub")}
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          label={t("kpi.equityYield")}
          value={yieldStabilised !== 0 ? formatPercent(yieldStabilised) : "—"}
          sublabel={t("kpi.equityYieldSub")}
          tone={yieldStabilised >= 0.15 ? "positive" : yieldStabilised > 0 ? undefined : "warning"}
          accent={yieldStabilised >= 0.15}
        />
        <KPICard
          label={t("kpi.operatingYield")}
          value={cumulativeYieldFinal !== 0 ? formatYieldMultiple(cumulativeYieldFinal) : "—"}
          sublabel={t("kpi.operatingYieldSub")}
          tone={cumulativeYieldFinal >= 1 ? "positive" : cumulativeYieldFinal > 0 ? undefined : "warning"}
          threshold={t("kpi.operatingYieldNote")}
        />
        <KPICard
          label={t("kpi.totalMOIC")}
          value={totalMOIC !== 0 ? formatYieldMultiple(totalMOIC) : "—"}
          sublabel={t("kpi.totalMOICSub")}
          tone={terminalUnderwater ? "warning" : totalMOIC >= 2 ? "positive" : totalMOIC > 1 ? undefined : "warning"}
          accent={totalMOIC >= 3 && !terminalUnderwater}
          chip={terminalUnderwater ? { label: "underwater", ok: false } : undefined}
          threshold={terminalUnderwater ? t("kpi.totalMOICUnderwaterNote") : undefined}
        />
        <KPICard
          label={t("kpi.equityPayback")}
          value={
            equityPaybackYears !== null && equityPaybackYears !== undefined
              ? `${equityPaybackYears} ${t("dash.years")}`
              : t("dash.never")
          }
          sublabel={t("kpi.equityPaybackSub")}
          tone={
            equityPaybackYears && equityPaybackYears <= 8
              ? "positive"
              : equityPaybackYears && equityPaybackYears <= 12
                ? undefined
                : "warning"
          }
          threshold={t("kpi.equityPaybackNote")}
        />
        <KPICard
          label={t("kpi.equityIRR")}
          value={equityIRR > 0 ? formatPercent(equityIRR) : "—"}
          sublabel={t("kpi.equityIRRSub")}
          tone={equityIRR >= 0.15 ? "positive" : equityIRR > 0 ? undefined : "warning"}
        />
        <KPICard
          label={t("kpi.projectIRR")}
          value={projectIRR > 0 ? formatPercent(projectIRR) : "—"}
          sublabel={t("kpi.projectIRRSub")}
          tone={projectIRR >= 0.10 ? "positive" : projectIRR > 0 ? undefined : "warning"}
        />
      </div>

      {/* Section 2 — Full exit path comparison */}
      <SectionHeader
        title={t("dash.section.exitPath")}
        sub="Hotel sale (EBITDA × multiple) vs property sale (built surface × €/m²)"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label="Hotel sale value"
          value={terminalAssetValue > 0 ? formatCurrency(terminalAssetValue, true, locale) : "—"}
          sublabel="EBITDA × exit multiple"
          accent={!propertyExitDominates}
          tone={!propertyExitDominates ? "positive" : undefined}
          chip={!propertyExitDominates ? { label: "preferred exit", ok: true } : undefined}
        />
        <KPICard
          label="Hotel sale IRR"
          value={equityIRR > 0 ? formatPercent(equityIRR) : "—"}
          sublabel="Equity IRR, hotel exit"
          tone={equityIRR >= 0.15 ? "positive" : equityIRR > 0 ? undefined : "warning"}
        />
        <KPICard
          label="Property sale value"
          value={
            terminalAssetValuePropertySale > 0
              ? formatCurrency(terminalAssetValuePropertySale, true, locale)
              : "—"
          }
          sublabel={`Built surface × €${exitValuationPerM2?.toLocaleString() ?? "—"}/m²`}
          accent={propertyExitDominates}
          tone={propertyExitDominates ? "positive" : undefined}
          chip={propertyExitDominates ? { label: "preferred exit", ok: true } : undefined}
        />
        <KPICard
          label="Property sale IRR"
          value={equityIRRPropertySale > 0 ? formatPercent(equityIRRPropertySale) : "—"}
          sublabel="Equity IRR, property exit"
          tone={equityIRRPropertySale >= 0.15 ? "positive" : equityIRRPropertySale > 0 ? undefined : "warning"}
        />
      </div>

      {/* Net to equity for each path */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        <KPICard
          label="Hotel exit — net to equity"
          value={terminalEquityValue > 0 ? formatCurrency(terminalEquityValue, true, locale) : terminalUnderwater ? "Underwater" : "—"}
          sublabel="Asset value − remaining loan"
          tone={terminalUnderwater ? "warning" : "positive"}
        />
        <KPICard
          label="Hotel exit — project IRR"
          value={projectIRR > 0 ? formatPercent(projectIRR) : "—"}
          sublabel="Unlevered, hotel sale"
          tone={projectIRR >= 0.10 ? "positive" : projectIRR > 0 ? undefined : "warning"}
        />
        <KPICard
          label="Property exit — net to equity"
          value={
            terminalEquityValuePropertySale > 0
              ? formatCurrency(terminalEquityValuePropertySale, true, locale)
              : "—"
          }
          sublabel="Property value − remaining loan"
          tone={terminalEquityValuePropertySale > 0 ? "positive" : "warning"}
        />
        <KPICard
          label="Property exit — project IRR"
          value={projectIRRPropertySale > 0 ? formatPercent(projectIRRPropertySale) : "—"}
          sublabel="Unlevered, property sale"
          tone={projectIRRPropertySale >= 0.10 ? "positive" : projectIRRPropertySale > 0 ? undefined : "warning"}
        />
      </div>

      {/* Section 3 — Sensitivity link */}
      <div className="mt-8 p-4 bg-surface-secondary rounded-xl border border-surface-tertiary">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">
            See how returns change under ADR, occupancy, and rate stress
          </span>
          <a
            href="/admin/sensitivity"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Full sensitivity analysis and tornado →
          </a>
        </div>
      </div>
    </div>
  );
}
