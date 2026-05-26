"use client";

import { useModelStore } from "@/lib/store/modelStore";
import {
  formatCurrency,
  formatPercent,
  formatMultiple,
} from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { PageSkeleton } from "@/components/Skeleton";
import { SectionHeader, StatusChip } from "@/components/AdminUI";
import { PageTour, TourButton, usePageTour } from "@/components/PageTour";
import { FINANCING_TOUR } from "@/lib/tours/configs";

// ── Page ────────────────────────────────────────────────────

export default function FinancingPage() {
  const { t, locale } = useTranslation();
  const { model, assumptions, activeScenario } = useModelStore();
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(FINANCING_TOUR.storageKey);

  if (!model) return <PageSkeleton variant="grid" />;

  const activeScenarioOutput = model.scenarios[activeScenario];
  const activePnL = activeScenarioOutput.pnl;
  const km = model.keyMetrics;
  const activePath = assumptions.financingPath;

  const pathLabel =
    activePath === "grant"
      ? t("path.grant")
      : activePath === "rrf"
        ? t("path.rrf")
        : activePath === "tepix-loan"
          ? t("path.tepixLoan")
          : t("path.commercial");

  const scenarioLabel =
    activeScenario === 'upside' ? t('scenario.upside') :
    activeScenario === 'downside' ? t('scenario.downside') :
    activeScenario === 'breakeven' ? t('scenario.breakeven') :
    t('scenario.realistic');

  // Derive deal term sheet values from active path
  const ratePct =
    activePath === "tepix-loan"
      ? assumptions.tepixLoan.bankInterestRate
      : activePath === "rrf"
        ? assumptions.rrf.commercialInterestRate
        : assumptions.commercialLoan.interestRate;

  const term =
    activePath === "tepix-loan"
      ? assumptions.tepixLoan.totalTermYears
      : activePath === "rrf"
        ? assumptions.rrf.repaymentTermYears
        : assumptions.commercialLoan.repaymentTermYears;

  const grace =
    activePath === "tepix-loan"
      ? assumptions.tepixLoan.gracePeriodYears
      : activePath === "rrf"
        ? assumptions.rrf.gracePeriodYears
        : activePath === "grant"
          ? assumptions.grant.gracePeriodYears
          : assumptions.commercialLoan.gracePeriodYears;

  const covenant = assumptions.dscrCovenantThreshold;
  const stabDscr = activeScenarioOutput.stabilisedYear?.dscr ?? 0;
  const minDscr = activeScenarioOutput.minDSCRLoanLife;
  const dscrPass = minDscr >= covenant;

  // Column active-highlight helper — mirrors bank/page.tsx colClass
  const colClass = (pathKey: string) =>
    activePath === pathKey ? "bg-brand-50" : "";

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl text-text-primary border-l-[3px] border-brand-400 pl-3">{t('nav.financingPaths')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('financing.pageIntro')}</p>
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

      {/* Section 1 — Deal Terms / Term Sheet */}
      <div id="section-termsheet-financing" className="scroll-mt-24">
      <SectionHeader title={t("dash.termsheet.title")} sub={`${pathLabel} · ${scenarioLabel}`} />
      <div className="bg-white rounded-xl border border-surface-tertiary px-4 md:px-5 py-4 md:py-5">
        <div className="flex flex-col md:flex-row md:items-center md:flex-wrap md:gap-x-6 md:gap-y-2 gap-y-2.5 md:divide-x md:divide-surface-tertiary/60">
          {[
            {
              label: t("dash.termsheet.loan"),
              value: formatCurrency(km.loanAmount, true, locale),
              sub: `${(km.ltv * 100).toFixed(0)}% ${t("dash.termsheet.loanSub")}`,
              tone: undefined as "positive" | "warning" | undefined,
            },
            {
              label: t("dash.termsheet.term"),
              value: `${term}y · ${grace}y`,
              sub: t("dash.termsheet.termSub"),
              tone: undefined as "positive" | "warning" | undefined,
            },
            {
              label: t("dash.termsheet.rate"),
              value: `${(ratePct * 100).toFixed(2)}%`,
              sub: pathLabel,
              tone: undefined as "positive" | "warning" | undefined,
            },
            {
              label: t("dash.termsheet.annualDS"),
              value: formatCurrency(km.annualDS, true, locale),
              sub: `${t("kpi.assetCoverage")} ${formatMultiple(km.assetCoverage)}`,
              tone: undefined as "positive" | "warning" | undefined,
            },
            {
              label: t("dash.termsheet.dscrCovenant"),
              value: `${covenant.toFixed(2)}×`,
              sub: `${t("dash.termsheet.min")} ${minDscr.toFixed(2)}× — ${dscrPass ? t("dash.termsheet.pass") : t("dash.termsheet.fail")}`,
              tone: (dscrPass ? "positive" : "warning") as "positive" | "warning",
            },
            ...(activePath === "grant" ? [{
              label: t("kpi.grantAmount"),
              value: formatCurrency(km.grantAmount, true, locale),
              sub: `${formatPercent(km.grantAmount / km.totalCapex, 0)} ${t("kpi.grantAmountSub")}`,
              tone: "positive" as "positive" | "warning" | undefined,
            }] : []),
            ...((activeScenarioOutput?.dsraTarget ?? 0) > 0 ? [{
              label: t("dsra.dealTermLabel"),
              value: formatCurrency(activeScenarioOutput.dsraTarget ?? 0, true, locale),
              sub: `${formatCurrency(activeScenarioOutput.dsraSweep2028 ?? 0, true, locale)} ${t("dsra.dealTermSub")}`,
              tone: undefined as "positive" | "warning" | undefined,
            }] : []),
          ].map((c, i) => (
            <div
              key={c.label}
              className={`flex flex-col md:flex-row md:items-baseline md:gap-2 ${i > 0 ? "md:pl-6" : ""} text-sm`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                {c.label}
              </span>
              <span
                className={`font-mono font-semibold ${
                  c.tone === "positive"
                    ? "text-positive"
                    : c.tone === "warning"
                      ? "text-warning"
                      : "text-text-primary"
                }`}
              >
                {c.value}
              </span>
              {c.sub && (
                <span className="text-[11px] text-text-tertiary leading-snug md:before:content-['·'] md:before:mr-1.5 md:before:text-text-tertiary/60">
                  {c.sub}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-surface-tertiary/50 flex flex-wrap items-center gap-3">
          <StatusChip label={dscrPass ? t("dash.termsheet.pass") : t("dash.termsheet.fail")} ok={dscrPass} />
          <span className="text-[11px] text-text-tertiary">
            {t('financing.stabilisedDSCR')} {formatMultiple(stabDscr)} · {t('financing.securityNote')}
          </span>
          {(activeScenarioOutput?.dsraTarget ?? 0) > 0 && (
            <p className="w-full text-[11px] text-text-tertiary leading-relaxed pt-1">
              {t('dsra.financingCaption')}
            </p>
          )}
        </div>
      </div>
      </div>{/* end section-termsheet-financing */}

      {/* Section 2 — Financing Comparison table */}
      <div id="section-financing-comparison" className="scroll-mt-24">
      <SectionHeader
        title={t("dash.financingComparison")}
        sub={t('financing.activePathNote')}
      />
      <div className="bg-white rounded-xl border border-surface-tertiary p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-tertiary">
                <th className="text-left py-2 pr-4 text-text-tertiary font-medium text-xs uppercase tracking-wider">
                  {t("common.metric")}
                </th>
                <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass("commercial")}`}>
                  <span
                    className={
                      activePath === "commercial"
                        ? "bg-brand-500 text-white rounded px-2 py-0.5"
                        : "text-text-tertiary"
                    }
                  >
                    {t("path.commercialShort")}
                  </span>
                </th>
                <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass("rrf")}`}>
                  <span
                    className={
                      activePath === "rrf"
                        ? "bg-brand-500 text-white rounded px-2 py-0.5"
                        : "text-text-tertiary"
                    }
                  >
                    {t("path.rrfShort")}
                  </span>
                </th>
                <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass("grant")}`}>
                  <span
                    className={
                      activePath === "grant"
                        ? "bg-brand-500 text-white rounded px-2 py-0.5"
                        : "text-positive"
                    }
                  >
                    {t("path.grantShort")}
                  </span>
                </th>
                <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass("tepix-loan")}`}>
                  <span
                    className={activePath === "tepix-loan" ? "bg-brand-500 text-white rounded px-2 py-0.5" : ""}
                    style={activePath !== "tepix-loan" ? { color: "#7B5EA7" } : {}}
                  >
                    {t("path.tepixLoanShort")}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {model.financingComparison.map((row, i) => {
                const formatVal = (val: string | number) =>
                  typeof val === "number"
                    ? row.key === "stabilisedDSCR"
                      ? formatMultiple(val)
                      : formatCurrency(val, true, locale)
                    : val;
                return (
                  <tr key={i} className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{(t as (k: string) => string)(`finComp.${row.key}`) || row.metric}</td>
                    <td className={`text-right py-2.5 px-3 data-cell ${colClass("commercial")}`}>
                      {formatVal(row.commercial)}
                    </td>
                    <td className={`text-right py-2.5 px-3 data-cell ${colClass("rrf")}`}>
                      {formatVal(row.rrf)}
                    </td>
                    <td
                      className={`text-right py-2.5 px-3 data-cell text-positive font-medium ${colClass("grant")}`}
                    >
                      {formatVal(row.grant)}
                    </td>
                    <td
                      className={`text-right py-2.5 px-3 data-cell ${colClass("tepix-loan")}`}
                      style={{ color: "#7B5EA7" }}
                    >
                      {formatVal(row.tepixLoan)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </div>{/* end section-financing-comparison */}
      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={FINANCING_TOUR} />
    </div>
  );
}
