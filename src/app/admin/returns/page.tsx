"use client";

import Link from "next/link";
import { useModelStore } from "@/lib/store/modelStore";
import {
  formatCurrency,
  formatPercent,
} from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { PageSkeleton } from "@/components/Skeleton";
import { SectionHeader, KPICard } from "@/components/AdminUI";
import { PageTour, TourButton, usePageTour } from "@/components/PageTour";
import { RETURNS_TOUR } from "@/lib/tours/configs";

// ── Page ────────────────────────────────────────────────────

export default function ReturnsPage() {
  const { t, locale } = useTranslation();
  const { model, activeScenario, assumptions } = useModelStore();
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(RETURNS_TOUR.storageKey);

  if (!model) return <PageSkeleton variant="grid" />;

  const activeScenarioOutput = model.scenarios[activeScenario];
  const scenarioLabel =
    activeScenario === 'upside' ? t('scenario.upside') :
    activeScenario === 'downside' ? t('scenario.downside') :
    activeScenario === 'breakeven' ? t('scenario.breakeven') :
    t('scenario.realistic');

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
          <h1 className="font-display text-2xl text-text-primary border-l-[3px] border-brand-400 pl-3">{t('returns.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('returns.pageIntro')}</p>
          <p className="text-sm font-medium text-text-secondary mt-1">
            <span className="text-text-primary">{pathLabel}</span>
            <span className="text-text-tertiary"> &middot; </span>
            {scenarioLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TourButton onClick={() => setTourOpen(true)} pulsing={!!neverSeen} />
        </div>
      </div>

      {/* Section 1 — 6-card returns grid */}
      <SectionHeader
        title={t("dash.section.returns")}
        sub={t("dash.returnsSub")}
      />
      <div id="returns-kpi-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
          chip={terminalUnderwater ? { label: t('returns.underwater'), ok: false } : undefined}
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
      <div id="returns-exit-valuations">
      <SectionHeader
        title={t("dash.section.exitPath")}
        sub={t('returns.exitSub')}
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          label={t('returns.hotelSaleValue')}
          value={terminalAssetValue > 0 ? formatCurrency(terminalAssetValue, true, locale) : "—"}
          sublabel={t('returns.ebitdaExitMultiple')}
          accent={!propertyExitDominates}
          tone={!propertyExitDominates ? "positive" : undefined}
          chip={!propertyExitDominates ? { label: t('returns.preferredExit'), ok: true } : undefined}
        />
        <KPICard
          label={t('returns.hotelSaleIRR')}
          value={equityIRR !== 0 ? formatPercent(equityIRR) : "—"}
          sublabel={t('returns.equityIRRHotel')}
          tone={equityIRR >= 0.15 ? "positive" : equityIRR > 0 ? undefined : "warning"}
        />
        <KPICard
          label={t('returns.propertySaleValue')}
          value={
            terminalAssetValuePropertySale > 0
              ? formatCurrency(terminalAssetValuePropertySale, true, locale)
              : "—"
          }
          sublabel={`Built surface × €${exitValuationPerM2?.toLocaleString() ?? "—"}/m²`}
          accent={propertyExitDominates}
          tone={propertyExitDominates ? "positive" : undefined}
          chip={propertyExitDominates ? { label: t('returns.preferredExit'), ok: true } : undefined}
        />
        <KPICard
          label={t('returns.propertySaleIRR')}
          value={equityIRRPropertySale !== 0 ? formatPercent(equityIRRPropertySale) : "—"}
          sublabel={t('returns.equityIRRProperty')}
          tone={equityIRRPropertySale >= 0.15 ? "positive" : equityIRRPropertySale > 0 ? undefined : "warning"}
        />
      </div>

      {/* Net to equity for each path */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        <KPICard
          label={t('returns.hotelNetEquity')}
          value={terminalEquityValue > 0 ? formatCurrency(terminalEquityValue, true, locale) : terminalUnderwater ? t('returns.underwater') : "—"}
          sublabel={t('returns.assetMinusLoan')}
          tone={terminalUnderwater ? "warning" : "positive"}
        />
        <KPICard
          label={t('returns.hotelProjectIRR')}
          value={projectIRR !== 0 ? formatPercent(projectIRR) : "—"}
          sublabel={t('returns.unleveredHotel')}
          tone={projectIRR >= 0.10 ? "positive" : projectIRR > 0 ? undefined : "warning"}
        />
        <KPICard
          label={t('returns.propertyNetEquity')}
          value={
            terminalEquityValuePropertySale > 0
              ? formatCurrency(terminalEquityValuePropertySale, true, locale)
              : "—"
          }
          sublabel={t('returns.propertyMinusLoan')}
          tone={terminalEquityValuePropertySale > 0 ? "positive" : "warning"}
        />
        <KPICard
          label={t('returns.propertyProjectIRR')}
          value={projectIRRPropertySale !== 0 ? formatPercent(projectIRRPropertySale) : "—"}
          sublabel={t('returns.unleveredProperty')}
          tone={projectIRRPropertySale >= 0.10 ? "positive" : projectIRRPropertySale > 0 ? undefined : "warning"}
        />
      </div>
      </div>{/* end returns-exit-valuations */}

      {/* Section 3 — Sensitivity link */}
      <div className="mt-8 p-4 bg-surface-secondary rounded-xl border border-surface-tertiary">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">
            {t('returns.sensitivityNote')}
          </span>
          <Link
            href="/admin/sensitivity"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-[11px] font-medium hover:bg-brand-100 hover:border-brand-400 transition-all"
          >
            {t('returns.sensitivityLink')}
          </Link>
        </div>
      </div>
      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={RETURNS_TOUR} />
    </div>
  );
}
