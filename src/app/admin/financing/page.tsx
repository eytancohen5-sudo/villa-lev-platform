"use client";

import { useModelStore } from "@/lib/store/modelStore";
import type { GraceMode } from "@/lib/engine/types";
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
  const { model, assumptions, activeScenario, setGraceMode, setAssumption, financingPathOverride } = useModelStore();
  const [tourOpen, setTourOpen, neverSeen] = usePageTour(FINANCING_TOUR.storageKey);

  if (!model) return <PageSkeleton variant="grid" />;

  const activeScenarioOutput = model.scenarios[activeScenario];
  const activePnL = activeScenarioOutput.pnl;
  const km = model.keyMetrics;
  const activePath = financingPathOverride ?? assumptions.financingPath;

  const pathLabel =
    activePath === "grant"
      ? t("path.grant")
      : activePath === "rrf"
        ? t("path.rrf")
        : activePath === "tepix-loan"
          ? t("path.tepixLoan")
          : activePath === "optima"
            ? t("bank.bar.optima")
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

  const graceMode = (assumptions.commercialLoan?.graceMode ?? 'standard') as GraceMode;

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

      {/* Grace structure — commercial, grant, and optima paths */}
      {(['commercial', 'grant', 'optima'] as string[]).includes(activePath) && (
        <div className="bg-white rounded-xl border border-surface-tertiary px-5 py-4 mt-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary shrink-0 w-36">
              {t('bank.graceMode.label')}
            </span>
            <div className="flex gap-1">
              {(['two-phase', 'rolling'] as GraceMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setGraceMode(m)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    graceMode === m
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface-secondary text-text-secondary hover:bg-surface-tertiary'
                  }`}
                >
                  {t(`bank.graceMode.${m.replace('-','_')}` as 'bank.graceMode.two_phase' | 'bank.graceMode.rolling')}
                </button>
              ))}
            </div>
          </div>
          {/* Description for selected mode */}
          <p className="text-[12px] text-text-secondary leading-relaxed">
            {graceMode === 'rolling'
              ? t('bank.graceMode.rolling.desc')
              : t('bank.graceMode.two_phase.desc')}
          </p>
          {graceMode === 'rolling' && (
            <div className="border-t border-surface-tertiary pt-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-text-secondary w-36 shrink-0">
                  {t('bank.graceMode.plotsStart')}
                </span>
                <select
                  value={assumptions.commercialLoan?.plotsStartYear ?? 2026}
                  onChange={e => setAssumption('commercialLoan.plotsStartYear', Number(e.target.value), 'Plots start year')}
                  className="text-xs border border-surface-tertiary rounded px-2 py-1.5 bg-surface-primary text-text-primary"
                >
                  {[2025, 2026, 2027, 2028, 2029].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select
                  value={assumptions.commercialLoan?.plotsStartQ ?? 1}
                  onChange={e => setAssumption('commercialLoan.plotsStartQ', Number(e.target.value) as 1 | 2 | 3 | 4, 'Plots start Q')}
                  className="text-xs border border-surface-tertiary rounded px-2 py-1.5 bg-surface-primary text-text-primary"
                >
                  {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-text-secondary w-36 shrink-0">
                  {t('bank.graceMode.constructionStart')}
                </span>
                <select
                  value={assumptions.commercialLoan?.constructionStartYear ?? 2027}
                  onChange={e => setAssumption('commercialLoan.constructionStartYear', Number(e.target.value), 'Construction start year')}
                  className="text-xs border border-surface-tertiary rounded px-2 py-1.5 bg-surface-primary text-text-primary"
                >
                  {[2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select
                  value={assumptions.commercialLoan?.constructionStartQ ?? 1}
                  onChange={e => setAssumption('commercialLoan.constructionStartQ', Number(e.target.value) as 1 | 2 | 3 | 4, 'Construction start Q')}
                  className="text-xs border border-surface-tertiary rounded px-2 py-1.5 bg-surface-primary text-text-primary"
                >
                  {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section 2 — Financing Comparison table */}
      <div id="section-financing-comparison" className="scroll-mt-24">
      <SectionHeader
        title={t("dash.financingComparison")}
        sub={t('financing.activePathNote')}
      />
      <div className="bg-white rounded-xl border border-surface-tertiary p-5">
        <div className="overflow-x-auto">
          {(() => {
            const comm    = model.commercialScenario;
            const rrfSc   = model.rrfScenario;
            const grantSc = model.grantScenario;
            const tepix   = model.tepixLoanScenario;
            const optima  = model.optimaScenario;

            const savingRow = model.financingComparison.find((r) => r.key === "equitySavingVsCommercial");
            const savings = {
              rrf:       typeof savingRow?.rrf       === "number" ? savingRow.rrf       : 0,
              grant:     typeof savingRow?.grant     === "number" ? savingRow.grant     : 0,
              tepixLoan: typeof savingRow?.tepixLoan === "number" ? savingRow.tepixLoan : 0,
              optima:    typeof savingRow?.optima    === "number" ? savingRow.optima    : 0,
            };
            const maxSaving = Math.max(savings.rrf, savings.grant, savings.tepixLoan, savings.optima);
            const bestSavingPath =
              maxSaving <= 0 ? null :
              savings.grant     === maxSaving ? "grant" :
              savings.tepixLoan === maxSaving ? "tepix-loan" :
              savings.optima    === maxSaving ? "optima" : "rrf";

            const dscrColor = (v: string | number) => {
              if (typeof v !== "number") return "";
              if (v >= 1.5) return "text-positive font-semibold";
              if (v >= 1.25) return "text-brand-600 font-semibold";
              if (v > 0) return "text-warning font-semibold";
              return "";
            };
            const irrColor  = (v: number) => v >= 0.15 ? "text-positive" : v >= 0.10 ? "text-brand-600" : "text-warning";
            const moicColor = (v: number) => v >= 4 ? "text-positive" : v >= 2.5 ? "text-brand-600" : "text-warning";

            const rowByKey = Object.fromEntries(model.financingComparison.map((r) => [r.key, r]));
            const formatVal = (val: string | number | undefined, isDscr = false) =>
              val == null ? "—" :
              typeof val === "number" ? (isDscr ? formatMultiple(val) : formatCurrency(val, true, locale)) : val;

            const cellCls = (pathKey: string, extra?: string) =>
              `text-right py-2.5 px-3 data-cell ${colClass(pathKey)} ${extra ?? ""}`.trim();

            const eqR = rowByKey["equityRequired"];
            const gcR = rowByKey["graceInterestCarry"];

            // Column definitions — order will be sorted so active path is first.
            type ColDef = {
              pathKey: string;
              label: string;
              dataKey: 'commercial' | 'rrf' | 'grant' | 'tepixLoan' | 'optima';
              scenario: typeof comm | undefined;
              eqAtClose: number;
              inactiveClass: string;
              inactiveStyle?: React.CSSProperties;
            };
            const allCols: ColDef[] = [
              {
                pathKey: 'commercial', label: t('path.commercialShort'), dataKey: 'commercial',
                scenario: comm, eqAtClose: ((eqR?.commercial as number) ?? 0) + ((gcR?.commercial as number) ?? 0),
                inactiveClass: 'text-text-tertiary', inactiveStyle: undefined,
              },
              {
                pathKey: 'rrf', label: t('path.rrfShort'), dataKey: 'rrf',
                scenario: rrfSc, eqAtClose: ((eqR?.rrf as number) ?? 0) + ((gcR?.rrf as number) ?? 0),
                inactiveClass: 'text-text-tertiary', inactiveStyle: undefined,
              },
              {
                pathKey: 'grant', label: t('path.grantShort'), dataKey: 'grant',
                scenario: grantSc, eqAtClose: ((eqR?.grant as number) ?? 0) + ((gcR?.grant as number) ?? 0),
                inactiveClass: 'text-positive', inactiveStyle: undefined,
              },
              {
                pathKey: 'tepix-loan', label: t('path.tepixLoanShort'), dataKey: 'tepixLoan',
                scenario: tepix, eqAtClose: ((eqR?.tepixLoan as number) ?? 0) + ((gcR?.tepixLoan as number) ?? 0),
                inactiveClass: '', inactiveStyle: { color: '#7B5EA7' },
              },
              {
                pathKey: 'optima', label: t('bank.bar.optima'), dataKey: 'optima',
                scenario: optima, eqAtClose: ((eqR?.optima as number) ?? 0) + ((gcR?.optima as number) ?? 0),
                inactiveClass: '', inactiveStyle: { color: '#1565C0' },
              },
            ];
            // Active path always first; rest in original order.
            const cols = [
              ...allCols.filter(c => c.pathKey === activePath),
              ...allCols.filter(c => c.pathKey !== activePath),
            ];

            const BandSep = ({ label }: { label: string }) => (
              <tr className="bg-surface-secondary/60">
                <td colSpan={cols.length + 1} className="py-1.5 pl-4 pr-4 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  {label}
                </td>
              </tr>
            );

            const capStructureKeys = ["totalLoanDrawn", "grantReceived", "equityRequired", "graceInterestCarry", "annualDebtService"];
            const bankMetricKeys   = ["stabilisedDSCR", "effectiveDSCRStabilised", "dsraTarget"];

            return (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-tertiary">
                    <th className="text-left py-2 pr-4 text-text-tertiary font-medium text-xs uppercase tracking-wider">
                      {t("common.metric")}
                    </th>
                    {cols.map(col => (
                      <th key={col.pathKey} className={`text-right py-2 px-3 text-xs uppercase tracking-wider font-medium ${colClass(col.pathKey)}`}>
                        <span
                          className={activePath === col.pathKey ? "bg-brand-500 text-white rounded px-2 py-0.5" : col.inactiveClass}
                          style={activePath !== col.pathKey ? col.inactiveStyle : undefined}
                        >
                          {col.label}
                        </span>
                        {bestSavingPath === col.pathKey && km.grantAmount > 0 && (
                          <span
                            className="text-[9px] font-semibold uppercase tracking-wider block mt-0.5"
                            style={activePath !== col.pathKey ? col.inactiveStyle : undefined}
                          >
                            Recommended
                          </span>
                        )}
                      </th>
                    ))}
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
                          {key === 'annualDebtService' && graceMode !== 'standard' && (
                            <div className="text-[10px] text-text-tertiary mt-0.5 leading-snug">
                              {(t as (k: string) => string)('finComp.annualDebtServiceNote')}
                            </div>
                          )}
                        </td>
                        {cols.map(col => (
                          <td
                            key={col.pathKey}
                            className={cellCls(col.pathKey, activePath !== col.pathKey ? col.inactiveClass : '')}
                            style={activePath !== col.pathKey ? col.inactiveStyle : undefined}
                          >
                            {formatVal(row[col.dataKey])}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {/* Total equity at close */}
                  <tr className="border-b border-surface-secondary/50 bg-surface-secondary/20 font-medium">
                    <td className="py-2.5 pr-4 text-text-primary">{t('finComp.totalEquityAtClose')}</td>
                    {cols.map(col => (
                      <td
                        key={col.pathKey}
                        className={cellCls(col.pathKey, activePath !== col.pathKey ? col.inactiveClass : '')}
                        style={activePath !== col.pathKey ? col.inactiveStyle : undefined}
                      >
                        {formatCurrency(col.eqAtClose, true, locale)}
                      </td>
                    ))}
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
                        {cols.map(col => {
                          const val = row[col.dataKey];
                          return (
                            <td
                              key={col.pathKey}
                              className={`${cellCls(col.pathKey)} ${isDscr ? dscrColor(val ?? 0) : (activePath !== col.pathKey ? col.inactiveClass : '')}`}
                              style={!isDscr && activePath !== col.pathKey ? col.inactiveStyle : undefined}
                            >
                              {formatVal(val, isDscr)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {/* Min DSCR (loan life) */}
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">
                      {(t as (k: string) => string)('finComp.minDSCRLoanLife')}
                    </td>
                    {cols.map(col => {
                      const v = col.scenario?.minDSCRLoanLife ?? 0;
                      return (
                        <td key={col.pathKey} className={`${cellCls(col.pathKey)} ${dscrColor(v)}`}>
                          {formatMultiple(v)}
                        </td>
                      );
                    })}
                  </tr>

                  {/* ── Band 3: Equity Returns ── */}
                  <BandSep label={t("finComp.equityIRR")} />
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('finComp.equityIRR')}</td>
                    {cols.map(col => {
                      const v = col.scenario?.equityIRR ?? 0;
                      return (
                        <td key={col.pathKey} className={`${cellCls(col.pathKey)} ${irrColor(v)}`}>
                          {formatPercent(v)}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('finComp.moic')}</td>
                    {cols.map(col => {
                      const v = col.scenario?.totalMOIC ?? 0;
                      return (
                        <td key={col.pathKey} className={`${cellCls(col.pathKey)} ${moicColor(v)}`}>
                          {formatMultiple(v)}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-surface-secondary/50">
                    <td className="py-2.5 pr-4 text-text-secondary">{t('finComp.payback')}</td>
                    {cols.map(col => (
                      <td
                        key={col.pathKey}
                        className={cellCls(col.pathKey, activePath !== col.pathKey ? col.inactiveClass : '')}
                        style={activePath !== col.pathKey ? col.inactiveStyle : undefined}
                      >
                        {col.scenario?.equityPaybackYears != null ? `${col.scenario.equityPaybackYears}y` : "—"}
                      </td>
                    ))}
                  </tr>

                  {/* ── Band 4: vs Commercial Baseline ── */}
                  <BandSep label={t("finComp.equitySavingVsCommercial")} />
                  {savingRow && (
                    <tr className="border-b border-surface-secondary/50">
                      <td className="py-2.5 pr-4 text-text-secondary">
                        {(t as (k: string) => string)("finComp.equitySavingVsCommercial") || savingRow.metric}
                      </td>
                      {cols.map(col => (
                        <td
                          key={col.pathKey}
                          className={cellCls(col.pathKey, col.pathKey !== 'commercial' && activePath !== col.pathKey ? col.inactiveClass : '')}
                          style={col.pathKey !== 'commercial' && activePath !== col.pathKey ? col.inactiveStyle : undefined}
                        >
                          {col.pathKey === 'commercial' ? '—' : formatVal(savingRow[col.dataKey])}
                        </td>
                      ))}
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
