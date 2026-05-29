"use client";

import { useState, useEffect } from "react";
import { useModelStore } from "@/lib/store/modelStore";
import { formatCurrency, formatPercent, formatMultiple } from "@/lib/hooks/useModel";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { AnnualPnL } from "@/lib/engine/types";
import { Chevron } from "@/components/icons/Chevron";

type RowDef = {
  label: string;
  getValue: (p: AnnualPnL) => number | string;
  format: "currency" | "percent" | "multiple" | "raw";
  bold?: boolean;
  indent?: boolean;
  /** Section separator — renders a shaded label row with optional expand toggle */
  separator?: boolean;
  /** Section key this separator controls (omit for separators with no detail rows) */
  sectionKey?: string;
  dscrRow?: boolean;
  /** Negative values rendered in muted colour (costs / outflows) */
  outflow?: boolean;
  /** Detail row — hidden when its parent section is collapsed */
  detail?: boolean;
  /** Key of the section this detail row belongs to */
  section?: string;
  /** 'vat' — amber when negative (cash tied up), green when positive (refund received) */
  tone?: 'vat';
};


// Default expanded state for first visit (bank view)
// cfads, finance, and ebit start expanded; all others collapsed
function getDefaultExpanded(): Record<string, boolean> {
  return {
    cfads: true,
    finance: true,
    ebit: true,
  };
}

export function BankPnLSection({
  capexRatio,
  subProjectLabel,
  suppressCoverageRows,
  annualDebtServiceOverride,
}: {
  capexRatio?: number;
  subProjectLabel?: string;
  suppressCoverageRows?: boolean;
  annualDebtServiceOverride?: number;
} = {}) {
  const { t, locale } = useTranslation();
  const { model, activeScenario } = useModelStore();
  // Distinct storage key for optima context so expand state doesn't bleed between pages.
  const storageKey = subProjectLabel !== undefined ? 'bank-pnl-expanded-optima' : 'bank-pnl-expanded';
  // useState must be unconditional (Rules of Hooks) — placed before any early return.
  // Each key maps to whether that section is expanded; default is all collapsed.
  // Hydrates from sessionStorage after mount so expand state survives scenario switches.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // SSR safe: return empty during server render
    return {};
  });

  useEffect(() => {
    // Hydrate from sessionStorage after mount only
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        setExpanded(JSON.parse(raw));
      } else {
        // First visit — default cfads and finance expanded
        const defaults = getDefaultExpanded();
        setExpanded(defaults);
        sessionStorage.setItem(storageKey, JSON.stringify(defaults));
      }
    } catch {
      // sessionStorage unavailable (private browsing, etc.)
      setExpanded(getDefaultExpanded());
    }
  }, [storageKey]); // re-run if page context changes

  const toggleSection = (key: string) => {
    setExpanded(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  if (!model) return null;

  const isExpanded = (key: string) => !!expanded[key];

  // Use the active scenario for revenue / cost / EBITDA rows so the P&L
  // responds to the scenario pill selection in the control bar.
  const activePnl = model.scenarios[activeScenario as keyof typeof model.scenarios]?.pnl
    ?? model.scenarios.realistic.pnl;
  const upside   = model.scenarios.upside.pnl;
  const downside = model.scenarios.downside.pnl;
  const years = activePnl.map((p) => p.year);

  // Portfolio shape and OpCo detection use realistic (structure is scenario-invariant)
  const sampleYear = model.scenarios.realistic.pnl.find((p) => p.propertyBreakdown.length > 0);
  const portfolioShape = sampleYear?.propertyBreakdown ?? [];
  const opCoActive = model.scenarios.realistic.pnl.some((p) => p.opCoTotalFee !== 0);

  const rows: RowDef[] = [];

  // ── Revenue block ────────────────────────────────────────────────────────
  rows.push({ label: t('pnl.revenue'), getValue: () => "", format: "raw", separator: true, sectionKey: "revenue" });

  for (const prop of portfolioShape) {
    rows.push({
      label: prop.count > 1 ? `${prop.name} (×${prop.count})` : prop.name,
      getValue: (p) => {
        const pb = p.propertyBreakdown.find((b) => b.id === prop.id);
        return pb ? (prop.count > 1 ? pb.totalRevenue : pb.revenuePerUnit) : 0;
      },
      format: "currency",
      indent: true,
      detail: true,
      section: "revenue",
    });
  }

  rows.push(
    { label: t('pnl.events'),            getValue: (p) => p.revenueEvents,    format: "currency", indent: true, detail: true, section: "revenue" },
    { label: t('pnl.ancillary'),         getValue: (p) => p.revenueAncillary, format: "currency", indent: true, detail: true, section: "revenue" },
    { label: t('pnl.grossRevenue'),      getValue: (p) => p.grossRevenue,     format: "currency", bold: true },
    { label: t('pnl.otaCommissions'),    getValue: (p) => p.otaCommissions,   format: "currency", indent: true, outflow: true },
    { label: t('pnl.netRevenuePostOTA'), getValue: (p) => p.totalRevenue,     format: "currency", bold: true },
  );

  // ── Operating costs ───────────────────────────────────────────────────────
  rows.push({ label: t('pnl.totalOpex'), getValue: () => "", format: "raw", separator: true, sectionKey: "opex" });
  rows.push(
    { label: t('pnl.totalOpex'), getValue: (p) => p.totalOpex, format: "currency", outflow: true },
  );

  // ── EBITDA pre-OpCo (pivot row) ───────────────────────────────────────────
  rows.push(
    {
      label: t('pnl.gopPreMgmt'),
      getValue: (p) => p.ebitdaPreOpCo,
      format: "currency",
      bold: true,
    },
    { label: t('term.ebitdaMargin'), getValue: (p) => p.totalRevenue > 0 ? (p.ebitdaPreOpCo ?? 0) / p.totalRevenue : 0, format: "percent" },
  );

  // ── EBIT section (default collapsed) ─────────────────────────────────────
  rows.push({ label: t('pnl.ebit'), getValue: () => "", format: "raw", separator: true, sectionKey: "ebit" });
  rows.push(
    {
      label: t('pnl.depreciation'),
      getValue: (p) => -(p.annualDepreciation ?? 0),
      format: "currency",
      indent: true,
      outflow: true,
      detail: true,
      section: "ebit",
    },
    {
      label: t('pnl.ebit'),
      getValue: (p) => (p.ebitdaPreOpCo ?? 0) - (p.annualDepreciation ?? 0),
      format: "currency",
      bold: true,
    },
  );

  // ── Finance section (default EXPANDED in bank view) ───────────────────────
  rows.push({ label: t('pnl.debtServiceSection'), getValue: () => "", format: "raw", separator: true, sectionKey: "finance" });
  rows.push(
    // NEW: wcInterestExpense row
    {
      label: t('pnl.wcInterest'),
      getValue: (p) => p.wcInterestExpense ?? 0,
      format: "currency",
      outflow: true,
      detail: false,
      section: "finance",
    },
    { label: t('pnl.termLoanInterest'), getValue: (p) => p.termLoanInterest, format: "currency", indent: true, outflow: true, detail: true, section: "finance" },
    { label: t('pnl.termLoanPrincipal'), getValue: (p) => p.termLoanPrincipal, format: "currency", indent: true, outflow: true, detail: true, section: "finance" },
    { label: t('pnl.loanBalanceClosing'), getValue: (p) => p.termLoanBalance, format: "currency", indent: true, detail: true, section: "finance" },
  );

  // ── Tax section (default collapsed) ──────────────────────────────────────
  rows.push({ label: t('pnl.cfadsBridge'), getValue: () => "", format: "raw", separator: true, sectionKey: "tax" });
  rows.push(
    {
      label: t('pnl.corporateTax'),
      getValue: (p) => p.citPayable,
      format: "currency",
      indent: true,
      outflow: true,
      detail: true,
      section: "tax",
    },
  );

  // ── CFADS section (default EXPANDED in bank view) ─────────────────────────
  rows.push({ label: t('pnl.cfadsBridge'), getValue: () => "", format: "raw", separator: true, sectionKey: "cfads" });
  rows.push(
    {
      label: t('pnl.cfadsDscrNumerator'),
      getValue: (p) => p.cfads,
      format: "currency",
      bold: true,
    },
  );

  // ── Debt service block ────────────────────────────────────────────────────
  rows.push({ label: t('pnl.debtServiceSection'), getValue: () => "", format: "raw", separator: true, sectionKey: "debtService" });
  rows.push(
    { label: t('pnl.debtService'),        getValue: (p) => annualDebtServiceOverride !== undefined ? annualDebtServiceOverride : p.debtService,        format: "currency", bold: true, outflow: true },
    { label: t('pnl.postDsResidual'),     getValue: (p) => p.ebitdaPreOpCo - (annualDebtServiceOverride !== undefined ? annualDebtServiceOverride : p.debtService), format: "currency", bold: true },
    ...(opCoActive ? [
      { label: t('pnl.opcoIncentiveFee'), getValue: (p: AnnualPnL) => p.opCoIncentiveFee, format: "currency" as const, bold: true, outflow: true },
    ] as RowDef[] : []),
    {
      label: opCoActive ? `${t('term.ebitda')} ${t('pnl.netOfMgmtFees')}` : t('term.ebitda'),
      getValue: (p) => p.ebitda,
      format: "currency" as const,
      bold: true,
    },
    {
      label: t('pnl.profitBeforeTax'),
      getValue: (p) => (p.ebitdaPreOpCo ?? 0) - (p.annualDepreciation ?? 0) - (p.termLoanInterest ?? 0) - (p.wcInterestExpense ?? 0),
      format: "currency" as const,
      bold: true,
    },
  );

  // ── Coverage ratios ───────────────────────────────────────────────────────
  if (!suppressCoverageRows) {
    rows.push({ label: t('pnl.coverageSection'), getValue: () => "", format: "raw", separator: true, sectionKey: "coverage" });
    rows.push(
      {
        label: t('pnl.dscrBaseCase'),
        getValue: (p) => p.dscr,
        format: "multiple",
        bold: true,
        dscrRow: true,
      },
      {
        label: t('pnl.dscrCfads'),
        getValue: (p) => p.debtService > 0 ? (p.cfads ?? 0) / p.debtService : 0,
        format: "multiple",
        bold: true,
        dscrRow: true,
      },
      {
        label: t('pnl.dscrUpside'),
        getValue: (p) => upside.find((u) => u.year === p.year)?.dscr ?? 0,
        format: "multiple",
        indent: true,
        dscrRow: true,
        detail: true,
        section: "coverage",
      },
      {
        label: t('pnl.dscrDownside'),
        getValue: (p) => downside.find((d) => d.year === p.year)?.dscr ?? 0,
        format: "multiple",
        indent: true,
        dscrRow: true,
        detail: true,
        section: "coverage",
      },
      {
        label: t('pnl.dscrLoadedLabel'),
        getValue: (p) => p.dscrLoaded,
        format: "multiple",
        indent: true,
        dscrRow: true,
        detail: true,
        section: "coverage",
      },
      {
        label: t('pnl.icrInterestCoverage'),
        getValue: (p) => p.interestCoverageRatio,
        format: "multiple",
        indent: true,
        dscrRow: true,
        detail: true,
        section: "coverage",
      },
    );
  }

  // ── Construction VAT timing (memo) ────────────────────────────────────────
  rows.push({ label: t('pnl.vatMemoSection'), getValue: () => "", format: "raw", separator: true });
  rows.push({
    label: t('pnl.vatReceivable'),
    getValue: (p) => model.capex.constructionVatByYear?.[p.year] ?? 0,
    format: "currency",
    tone: 'vat',
  });

  // ── Formatting helpers ────────────────────────────────────────────────────
  const fmt = (val: number | string, row: RowDef): string => {
    if (typeof val === "string") return val;
    if (val === 0) return "—";
    switch (row.format) {
      case "currency": {
        const scale = (capexRatio !== undefined && !row.dscrRow) ? capexRatio : 1;
        return formatCurrency(val * scale, true, locale);
      }
      case "percent":  return formatPercent(val);
      case "multiple": return formatMultiple(val);
      default:         return String(val);
    }
  };

  const dscrColor = (val: number | string): string => {
    if (typeof val !== "number" || val === 0) return "";
    if (val >= 1.5)  return "text-positive font-semibold";
    if (val >= 1.25) return "text-brand-600 font-semibold";
    if (val >  0)    return "text-warning font-semibold";
    return "";
  };

  const phaseLabel = (year: number) =>
    year <= 2027 ? t('pnl.phaseDev') : year === 2028 ? t('pnl.phaseRampGrace') : year === 2029 ? t('pnl.phaseRampDS') : t('pnl.phaseStab');

  // How many sections currently have at least one detail row visible
  const anyExpanded = Object.values(expanded).some(Boolean);

  const expandAll = () => {
    const keys = rows.filter((r) => r.sectionKey).map((r) => r.sectionKey as string);
    const next = Object.fromEntries(keys.map((k) => [k, true]));
    setExpanded(next);
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  return (
    <div className="bg-white rounded-2xl border border-surface-tertiary shadow-sm overflow-clip">
      <div className="px-6 pt-5 pb-3 border-b border-surface-tertiary flex items-start justify-between gap-4 sticky top-[57px] z-20 bg-white">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            {t('pnl.title')} — {{
              realistic: t('bank.bar.realistic'),
              upside:    t('bank.bar.upside'),
              downside:  t('bank.bar.downside'),
              breakeven: t('bank.bar.breakeven'),
            }[activeScenario] ?? t('bank.bar.realistic')} · {t('pnl.yearByYear')}
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            {t('pnl.expandHint')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-0.5">
          {!anyExpanded ? (
            <button
              onClick={expandAll}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-brand-500 text-brand-600 hover:bg-brand-50 transition-colors"
            >
              {t('pnl.expandAll')}
            </button>
          ) : (
            <button
              onClick={() => { setExpanded({}); try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ } }}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-surface-tertiary text-text-secondary hover:bg-surface-secondary/60 transition-colors"
            >
              {t('pnl.collapseAll')}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-auto max-h-[calc(100vh-250px)]">
        <table className="min-w-max text-xs">
          <thead>
            <tr className="bg-surface-secondary sticky top-0 z-30">
              <th className="text-left py-2.5 px-4 text-xs uppercase tracking-wider text-text-tertiary font-medium sticky left-0 bg-surface-secondary min-w-[220px] z-30">
                {t('pnl.lineHeader')}
              </th>
              {years.map((yr) => {
                const tone =
                  yr <= 2027
                    ? "border-t-4 border-earth-terracotta/60"
                    : yr <= 2029
                      ? "border-t-4 border-warning/60"
                      : "border-t-4 border-positive/60";
                return (
                  <th
                    key={yr}
                    className={`text-right py-2.5 px-2 text-xs uppercase tracking-wider text-text-tertiary font-medium min-w-[80px] ${tone}`}
                  >
                    {yr}
                  </th>
                );
              })}
            </tr>
            {subProjectLabel !== undefined && capexRatio !== undefined && (
              <tr className="sticky top-[38px] z-30 bg-white">
                <td className="sticky left-0 bg-white z-30 py-0.5 px-4" />
                <td
                  colSpan={years.length}
                  className="py-0.5 px-2 text-[10px] text-text-tertiary italic text-right"
                >
                  {t('bank.pnl.subProjectNote')
                    .replace('{label}', subProjectLabel)
                    .replace('{pct}', String(Math.round(capexRatio * 100)))}
                </td>
              </tr>
            )}
            <tr className="border-b border-surface-tertiary">
              <td className="py-1 px-4 text-xs text-text-tertiary sticky left-0 bg-white z-10">
                {t('pnl.phase')}
              </td>
              {years.map((yr) => (
                <td key={yr} className="text-right py-1 px-2 text-xs text-text-tertiary">
                  {phaseLabel(yr)}
                </td>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.filter((r) => !r.detail || isExpanded(r.section ?? "")).map((row, ri) => {
              // Section separator row
              if (row.separator) {
                const hasToggle = !!row.sectionKey;
                const open = hasToggle && isExpanded(row.sectionKey!);
                return (
                  <tr key={ri} className="bg-surface-secondary">
                    <td
                      colSpan={years.length + 1}
                      className="py-0 sticky left-0 z-20"
                    >
                      {hasToggle ? (
                        <button
                          onClick={() => toggleSection(row.sectionKey!)}
                          className="w-full flex items-center justify-between py-1.5 pl-4 pr-3 text-[10px] uppercase tracking-wider text-text-tertiary font-semibold hover:bg-surface-secondary/80 transition-colors group"
                        >
                          <span className="flex items-center gap-1.5">
                            <Chevron open={open} />
                            {row.label}
                          </span>
                          <span className={`normal-case tracking-normal text-[10px] font-medium transition-colors ${open ? "text-brand-500" : "text-text-tertiary/60 group-hover:text-brand-400"}`}>
                            {open ? t('common.collapse') : t('common.expand')}
                          </span>
                        </button>
                      ) : (
                        <div className="py-1.5 pl-4 pr-4 text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">
                          {row.label}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={ri}
                  className={`border-t border-surface-secondary/40 ${row.bold ? "bg-surface-secondary/20 font-medium" : ""}`}
                >
                  <td
                    className={`py-2 px-4 sticky left-0 z-10 ${
                      row.bold
                        ? "bg-surface-secondary/20 font-medium text-text-primary"
                        : "bg-white text-text-secondary"
                    } ${row.indent ? "pl-9" : ""}`}
                  >
                    {row.label}
                  </td>

                  {activePnl.map((p) => {
                    const val     = row.getValue(p);
                    const display = fmt(val, row);
                    const numVal  = typeof val === "number" ? val : 0;
                    const isNcfToEquityRow = row.label === t('pnl.ncfToEquity');

                    let colorClass = "";
                    if (row.dscrRow) {
                      colorClass = dscrColor(val);
                    } else if (row.tone === 'vat') {
                      colorClass = numVal > 0 ? "text-positive font-semibold" : numVal < 0 ? "text-amber-600 font-semibold" : "";
                    } else if (row.outflow && numVal !== 0) {
                      colorClass = "text-text-secondary";
                    } else if (row.format === "currency" && row.bold) {
                      colorClass = (isNcfToEquityRow && p.distributionGated)
                        ? "text-warning"
                        : numVal >= 0 ? "text-positive" : "text-warning";
                    }

                    return (
                      <td
                        key={p.year}
                        title={isNcfToEquityRow && p.distributionGated ? t('covenant.distributionGatedTooltip') : undefined}
                        className={`text-right py-2 px-2 font-mono ${colorClass}`}
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 border-t border-surface-tertiary bg-surface-secondary/20 space-y-1">
        <p className="text-xs text-text-tertiary">
          {t('bank.pnlFooterNote')}
          {" "}{t('pnl.cfadsNote')}
        </p>
        <p className="text-xs text-amber-600/80 italic">
          {t('pnl.vatMemoNote')}
        </p>
      </div>
    </div>
  );
}
