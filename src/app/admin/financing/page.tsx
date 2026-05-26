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
          {(() => {
            // Equity return values read directly from path scenario outputs (not financingComparison)
            const comm  = model.commercialScenario;
            const rrfSc = model.rrfScenario;
            const grantSc = model.grantScenario;
            const tepix = model.tepixLoanScenario;

            // Best saving path — highest equitySavingVsCommercial
            const savingRow = model.financingComparison.find((r) => r.key === "equitySavingVsCommercial");
            const savings = {
              rrf:       typeof savingRow?.rrf       === "number" ? savingRow.rrf       : 0,
              grant:     typeof savingRow?.grant     === "number" ? savingRow.grant     : 0,
              tepixLoan: typeof savingRow?.tepixLoan === "number" ? savingRow.tepixLoan : 0,
            };
            const maxSaving = Math.max(savings.rrf, savings.grant, savings.tepixLoan);
            const bestSavingPath =
              maxSaving <= 0 ? null :
              savings.grant     === maxSaving ? "grant" :
              savings.tepixLoan === maxSaving ? "tepix-loan" : "rrf";

            const dscrColor = (v: string | number) => {
              if (typeof v !== "number") return "";
              if (v >= 1.5) return "text-positive font-semibold";
              if (v >= 1.25) return "text-brand-600 font-semibold";
              if (v > 0) return "text-warning font-semibold";
              return "";
            };
            const irrColor = (v: number) =>
              v >= 0.15 ? "text-positive" : v >= 0.10 ? "text-brand-600" : "text-warning";
            const moicColor = (v: number) =>
              v >= 4 ? "text-positive" : v >= 2.5 ? "text-brand-600" : "text-warning";

            const BandSep = ({ label }: { label: string }) => (
              <tr className="bg-surface-secondary/60">
                <td colSpan={5} className="py-1.5 pl-4 pr-4 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  {label}
                </td>
              </tr>
            );

            const capStructureKeys = ["totalLoanDrawn", "grantReceived", "equityRequired", "graceInterestCarry", "annualDebtService"];
            const bankMetricKeys   = ["stabilisedDSCR", "effectiveDSCRStabilised", "dsraTarget"];
            const rowByKey = Object.fromEntries(model.financingComparison.map((r) => [r.key, r]));

            const formatVal = (val: string | number, isDscr = false) =>
              typeof val === "number"
                ? isDscr ? formatMultiple(val) : formatCurrency(val, true, locale)
                : val;

            const cellCls = (pathKey: string, extra?: string) =>
              `text-right py-2.5 px-3 data-cell ${colClass(pathKey)} ${extra ?? ""}`.trim();

            // Total equity at close per path (equityRequired + graceInterestCarry)
            const eqR = rowByKey["equityRequired"];
            const gcR = rowByKey["graceInterestCarry"];
            const eqAtClose = {
              commercial: ((eqR?.commercial as number) ?? 0) + ((gcR?.commercial as number) ?? 0),
              rrf:        ((eqR?.rrf        as number) ?? 0) + ((gcR?.rrf        as number) ?? 0),
              grant:      ((eqR?.grant      as number) ?? 0) + ((gcR?.grant      as number) ?? 0),
              tepixLoan:  ((eqR?.tepixLoan  as number) ?? 0) + ((gcR?.tepixLoan  as number) ?? 0),
            };

            return (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-tertiary">
                    <th className="text-left py-2 pr-4 text-text-tertiary font-medium text-xs uppercase tracking-wider">
                      {t("common.metric")}
                    </th>
                    {/* Commercial */}
                    <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass("commercial")}`}>
                      <span className={activePath === "commercial" ? "bg-brand-500 text-white rounded px-2 py-0.5" : "text-text-tertiary"}>
                        {t("path.commercialShort")}
                      </span>
                    </th>
                    {/* RRF */}
                    <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass("rrf")}`}>
                      <span className={activePath === "rrf" ? "bg-brand-500 text-white rounded px-2 py-0.5" : "text-text-tertiary"}>
                        {t("path.rrfShort")}
                      </span>
                    </th>
                    {/* Grant */}
                    <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass("grant")}`}>
                      <span className={activePath === "grant" ? "bg-brand-500 text-white rounded px-2 py-0.5" : "text-positive"}>
                        {t("path.grantShort")}
                      </span>
                      {bestSavingPath === "grant" && km.grantAmount > 0 && (
                        <span className="text-[9px] text-positive font-semibold uppercase tracking-wider block mt-0.5">Recommended</span>
                      )}
                    </th>
                    {/* TEPIX */}
                    <th className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass("tepix-loan")}`}>
                      <span
                        className={activePath === "tepix-loan" ? "bg-brand-500 text-white rounded px-2 py-0.5" : ""}
                        style={activePath !== "tepix-loan" ? { color: "#7B5EA7" } : {}}
                      >
                        {t("path.tepixLoanShort")}
                      </span>
                      {bestSavingPath === "tepix-loan" && km.grantAmount > 0 && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider block mt-0.5" style={{ color: "#7B5EA7" }}>Recommended</span>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* ── Band 1: Capital Structure ── */}
                  {capStructureKeys.map((key) => {
                    const row = rowByKey[key];
                    if (!row) return null;
                    return (
                      <tr key={key} className="border-b border-surface-secondary/50">
                        <td className="py-2.5 pr-4 text-text-secondary">
                          {(t as (k: string) => string)(`finComp.${row.key}`) || row.metric}
                        </td>
                        <td className={cellCls("commercial")}>{formatVal(row.commercial)}</td>
                        <td className={cellCls("rrf")}>{formatVal(row.rrf)}</td>
                        <td className={cellCls("grant", "text-positive font-medium")}>{formatVal(row.grant)}</td>
                        <td className={cellCls("tepix-loan")} style={{ color: "#7B5EA7" }}>{formatVal(row.tepixLoan)}</td>
                      </tr>
                    );
                  })}
                  {/* Total equity at close */}
                  <tr className="border-b border-surface-secondary/50 bg-surface-secondary/20 font-medium">
                    <td className="py-2.5 pr-4 text-text-primary">{t('finComp.totalEquityAtClose')}</td>
                    <td className={cellCls("commercial")}>{formatCurrency(eqAtClose.commercial, true, locale)}</td>
                    <td className={cellCls("rrf")}>{formatCurrency(eqAtClose.rrf, true, locale)}</td>
                    <td className={cellCls("grant", "text-positive font-medium")}>{formatCurrency(eqAtClose.grant, true, locale)}</td>
                    <td className={cellCls("tepix-loan")} style={{ color: "#7B5EA7" }}>{formatCurrency(eqAtClose.tepixLoan, true, locale)}</td>
                  </tr>

                  {/* ── Band 2: Bank Metrics ── */}
                  <BandSep label={t("pnl.coverageSection")} />
                  {bankMetricKeys.map((key) => {
                    const row = rowByKey[key];
                    if (!row) return null;
                    const isDscr = key === "stabilisedDSCR" || key === "effectiveDSCRStabilised";
                    return (
                      <tr key={key} className="border-b border-surface-secondary/50">
                        <td className="py-2.5 pr-4 text-text-secondary">
                          {(t as (k: string) => string)(`finComp.${row.key}`) || row.metric}
                        </td>
                        <td className={`${cellCls("commercial")} ${isDscr ? dscrColor(row.commercial) : ""}`}>{formatVal(row.commercial, isDscr)}</td>
                        <td className={`${cellCls("rrf")} ${isDscr ? dscrColor(row.rrf) : ""}`}>{formatVal(row.rrf, isDscr)}</td>
                        <td className={`${cellCls("grant")} ${isDscr ? dscrColor(row.grant) : "text-positive font-medium"}`}>{formatVal(row.grant, isDscr)}</td>
                        <td className={`${cellCls("tepix-loan")} ${isDscr ? dscrColor(row.tepixLoan) : ""}`} style={{ color: isDscr ? undefined : "#7B5EA7" }}>{formatVal(row.tepixLoan, isDscr)}</td>
                      </tr>
                    );
                  })}

                  {/* ── Band 3: Equity Returns ── */}
                  <BandSep label={t("finComp.equityIRR")} />
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('finComp.equityIRR')}</td>
                    <td className={`${cellCls("commercial")} ${irrColor(comm?.equityIRR ?? 0)}`}>{formatPercent(comm?.equityIRR ?? 0)}</td>
                    <td className={`${cellCls("rrf")} ${irrColor(rrfSc?.equityIRR ?? 0)}`}>{formatPercent(rrfSc?.equityIRR ?? 0)}</td>
                    <td className={`${cellCls("grant")} ${irrColor(grantSc?.equityIRR ?? 0)} text-positive`}>{formatPercent(grantSc?.equityIRR ?? 0)}</td>
                    <td className={`${cellCls("tepix-loan")} ${irrColor(tepix?.equityIRR ?? 0)}`} style={{ color: "#7B5EA7" }}>{formatPercent(tepix?.equityIRR ?? 0)}</td>
                  </tr>
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('finComp.moic')}</td>
                    <td className={`${cellCls("commercial")} ${moicColor(comm?.totalMOIC ?? 0)}`}>{formatMultiple(comm?.totalMOIC ?? 0)}</td>
                    <td className={`${cellCls("rrf")} ${moicColor(rrfSc?.totalMOIC ?? 0)}`}>{formatMultiple(rrfSc?.totalMOIC ?? 0)}</td>
                    <td className={`${cellCls("grant")} ${moicColor(grantSc?.totalMOIC ?? 0)} text-positive`}>{formatMultiple(grantSc?.totalMOIC ?? 0)}</td>
                    <td className={`${cellCls("tepix-loan")} ${moicColor(tepix?.totalMOIC ?? 0)}`} style={{ color: "#7B5EA7" }}>{formatMultiple(tepix?.totalMOIC ?? 0)}</td>
                  </tr>
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('finComp.payback')}</td>
                    <td className={cellCls("commercial")}>{comm?.equityPaybackYears != null ? `${comm.equityPaybackYears}y` : "—"}</td>
                    <td className={cellCls("rrf")}>{rrfSc?.equityPaybackYears != null ? `${rrfSc.equityPaybackYears}y` : "—"}</td>
                    <td className={`${cellCls("grant")} text-positive font-medium`}>{grantSc?.equityPaybackYears != null ? `${grantSc.equityPaybackYears}y` : "—"}</td>
                    <td className={cellCls("tepix-loan")} style={{ color: "#7B5EA7" }}>{tepix?.equityPaybackYears != null ? `${tepix.equityPaybackYears}y` : "—"}</td>
                  </tr>

                  {/* ── Band 4: vs Commercial Baseline ── */}
                  <BandSep label={t("finComp.equitySavingVsCommercial")} />
                  {savingRow && (
                    <tr className="border-b border-surface-secondary/50">
                      <td className="py-2.5 pr-4 text-text-secondary">
                        {(t as (k: string) => string)("finComp.equitySavingVsCommercial") || savingRow.metric}
                      </td>
                      <td className={cellCls("commercial")}>—</td>
                      <td className={cellCls("rrf")}>{formatVal(savingRow.rrf)}</td>
                      <td className={`${cellCls("grant")} text-positive font-medium`}>{formatVal(savingRow.grant)}</td>
                      <td className={cellCls("tepix-loan")} style={{ color: "#7B5EA7" }}>{formatVal(savingRow.tepixLoan)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>
      </div>{/* end section-financing-comparison */}
      <PageTour open={tourOpen} onClose={() => setTourOpen(false)} config={FINANCING_TOUR} />
    </div>
  );
}
