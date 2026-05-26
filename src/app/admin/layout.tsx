"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useModelStore, ScenarioName } from "@/lib/store/modelStore";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ViewAsControl } from "@/components/ViewAsControl";
import { BankViewBadge } from "@/components/BankViewToggle";
import { AssumptionPrompts } from "@/components/AssumptionPrompts";
import { AssumptionsMemoButton } from "@/components/AssumptionsMemoButton";
import { FinancingPath } from "@/lib/engine/types";
import { TranslationDictionary } from "@/lib/i18n/types";
import { useSeasonSnapshot } from "@/lib/data/useSeasonSnapshot";
import { useEffectiveAuth, clearImpersonation } from "@/lib/data/useEffectiveAuth";
import { useReferenceScenarioAutoLoad } from "@/lib/hooks/useReferenceScenarioAutoLoad";
import { AuthGate } from "@/components/AuthGate";

// Single brand accent for path pills — the prior multi-colour palette (one
// hue per financing path) read as visual noise. Active = brand-700, others
// stay neutral.
const financingPaths: { id: FinancingPath; shortKey: keyof TranslationDictionary }[] = [
  { id: "commercial", shortKey: "path.commercialShort" },
  { id: "rrf", shortKey: "path.rrfShort" },
  { id: "grant", shortKey: "path.grantShort" },
  { id: "tepix-loan", shortKey: "path.tepixLoanShort" },
];

function PercentInput({
  value,
  onCommit,
  decimals,
  step,
}: {
  value: number;
  onCommit: (next: number) => void;
  decimals: number;
  step: number;
}) {
  const formatted = (value * 100).toFixed(decimals);
  const [local, setLocal] = useState(formatted);
  useEffect(() => {
    setLocal(formatted);
  }, [formatted]);

  const commit = (raw: string) => {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed / 100 !== value) onCommit(parsed / 100);
    else setLocal(formatted);
  };

  return (
    <input
      type="number"
      step={step}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setLocal(formatted);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className="w-16 px-1.5 py-1 text-xs font-mono text-right rounded border border-surface-tertiary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
    />
  );
}

// Tiny dropdown popover for Rate / Loan — they rarely change session-to-
// session, so they don't deserve permanent space in the top bar.
function RateLoanPopover({
  rate,
  coverage,
  onRate,
  onCoverage,
  t,
}: {
  rate: number;
  coverage: number;
  onRate: (v: number) => void;
  onCoverage: (v: number) => void;
  t: (key: keyof TranslationDictionary) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Stepper helpers — step is the display-percentage step (e.g. 0.05 for rate,
  // 1 for coverage), so the raw delta is step / 100.
  const nudgeRate = (delta: number) => {
    const next = Math.min(0.25, Math.max(0, rate + delta));
    if (next !== rate) onRate(next);
  };
  const nudgeCoverage = (delta: number) => {
    const next = Math.min(1, Math.max(0, coverage + delta));
    if (next !== coverage) onCoverage(next);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider transition-colors ${
          open
            ? "bg-brand-50 text-brand-700 border border-brand-200"
            : "bg-surface-secondary text-text-secondary border border-surface-tertiary hover:bg-surface-tertiary"
        }`}
        aria-expanded={open}
        title={t('admin.bar.adjust')}
      >
        {/* Inline sliders / tuning icon */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className="shrink-0 text-brand-500"
        >
          {/* Three horizontal track lines */}
          <line x1="1" y1="2.5" x2="11" y2="2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="1" y1="6"   x2="11" y2="6"   stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="1" y1="9.5" x2="11" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          {/* Thumb circles at staggered positions */}
          <circle cx="4"  cy="2.5" r="1.5" fill="currentColor" />
          <circle cx="8"  cy="6"   r="1.5" fill="currentColor" />
          <circle cx="5"  cy="9.5" r="1.5" fill="currentColor" />
        </svg>
        {t('admin.bar.adjust')} · {(rate * 100).toFixed(1)}% / {(coverage * 100).toFixed(0)}%
      </button>
      {open && (
        <div className="absolute top-full mt-2 right-0 z-30 bg-white border border-surface-tertiary rounded-xl shadow-lg p-4 min-w-[260px]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">
            {t('admin.bar.loanParams')}
          </div>
          <div className="space-y-3">
            {/* Interest rate row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <label className="text-xs text-text-secondary">{t('field.interestRate')}</label>
                <span className="text-[10px] text-text-tertiary">Annual rate on drawn balance</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => nudgeRate(-0.05 / 100)}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-surface-secondary border border-surface-tertiary hover:bg-surface-tertiary text-xs font-mono text-text-secondary"
                  aria-label="Decrease interest rate"
                >
                  −
                </button>
                <PercentInput value={rate} decimals={2} step={0.05} onCommit={onRate} />
                <button
                  type="button"
                  onClick={() => nudgeRate(0.05 / 100)}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-surface-secondary border border-surface-tertiary hover:bg-surface-tertiary text-xs font-mono text-text-secondary"
                  aria-label="Increase interest rate"
                >
                  +
                </button>
                <span className="text-xs text-text-tertiary">%</span>
              </div>
            </div>
            {/* Loan coverage row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <label className="text-xs text-text-secondary">{t('field.loanCoverage')}</label>
                <span className="text-[10px] text-text-tertiary">% of eligible cost financed</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => nudgeCoverage(-1 / 100)}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-surface-secondary border border-surface-tertiary hover:bg-surface-tertiary text-xs font-mono text-text-secondary"
                  aria-label="Decrease loan coverage"
                >
                  −
                </button>
                <PercentInput value={coverage} decimals={0} step={1} onCommit={onCoverage} />
                <button
                  type="button"
                  onClick={() => nudgeCoverage(1 / 100)}
                  className="w-6 h-6 flex items-center justify-center rounded-md bg-surface-secondary border border-surface-tertiary hover:bg-surface-tertiary text-xs font-mono text-text-secondary"
                  aria-label="Increase loan coverage"
                >
                  +
                </button>
                <span className="text-xs text-text-tertiary">%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sidebar groups — replaces the prior flat 10-item list. "Analyse" first;
// founder/CFO "Structure" second; "Inputs" last.
interface NavItem {
  href: string;
  labelKey: keyof TranslationDictionary;
}
interface NavGroup {
  labelKey: keyof TranslationDictionary;
  items: NavItem[];
}
const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "nav.groupAnalyse",
    items: [
      { href: "/admin/dashboard",      labelKey: "nav.dashboard" },
      { href: "/admin/returns",        labelKey: "nav.returns" },
      { href: "/admin/pnl",            labelKey: "nav.pnl" },
      { href: "/admin/breakeven",      labelKey: "nav.breakeven" },
      { href: "/admin/sensitivity",    labelKey: "nav.sensitivity" },
      { href: "/admin/debt-coverage",  labelKey: "nav.debtCoverage" },
      { href: "/admin/financing",      labelKey: "nav.financingPaths" },
      { href: "/admin/presentation",   labelKey: "nav.presentation" },
    ],
  },
  {
    labelKey: "nav.groupStructure",
    items: [
      { href: "/admin/opco-split", labelKey: "nav.opcoSplit" },
      { href: "/admin/cap-table",  labelKey: "nav.capTable" },
    ],
  },
  {
    labelKey: "nav.groupInputs",
    items: [
      { href: "/admin/assumptions", labelKey: "nav.assumptions" },
      { href: "/admin/capex",       labelKey: "nav.capex" },
      { href: "/admin/scenarios",   labelKey: "nav.scenarios" },
      { href: "/admin/lexicon",     labelKey: "nav.lexicon" },
      { href: "/admin/team",        labelKey: "nav.team" },
    ],
  },
];

function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { init, model, assumptions, setFinancingPath, activeScenario, setActiveScenario, setAssumption } =
    useModelStore();
  useReferenceScenarioAutoLoad();
  const { t } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [exitYearRaw, setExitYearRaw] = useState('');
  const activeScenarioOutput = model?.scenarios[activeScenario];
  const exitUnderwater = !!activeScenarioOutput?.terminalUnderwater;
  // Freshness banner: when the seasonSnapshot Firestore subscription returns
  // nothing (or shape-mismatches), useSeasonSnapshot falls back to the static
  // file at currentVillaActuals.ts. Surface that to operators so they don't
  // mistake stale data for live.
  const { source: snapshotSource, pulledAt: snapshotPulledAt } = useSeasonSnapshot();
  const showStaleBanner = snapshotSource === "static-fallback";

  const rateLoanConfig =
    assumptions.financingPath === "tepix-loan"
      ? {
          rate: assumptions.tepixLoan.bankInterestRate,
          coverage: assumptions.tepixLoan.coverageRate,
          ratePath: "tepixLoan.bankInterestRate",
          coveragePath: "tepixLoan.coverageRate",
        }
      : assumptions.financingPath === "commercial" || assumptions.financingPath === "grant"
        ? {
            rate: assumptions.commercialLoan.interestRate,
            coverage: assumptions.commercialLoan.loanCoverageRate,
            ratePath: "commercialLoan.interestRate",
            coveragePath: "commercialLoan.loanCoverageRate",
          }
        : null;

  const scenarios: { id: ScenarioName; labelKey: keyof TranslationDictionary }[] = [
    { id: "realistic", labelKey: "scenario.realistic" },
    { id: "upside", labelKey: "scenario.upside" },
    { id: "downside", labelKey: "scenario.downside" },
    { id: "breakeven", labelKey: "scenario.breakeven" },
  ];

  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      init();
    }
  }, [init]);

  return (
    <div className="flex h-screen bg-surface-primary">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-14' : 'w-56'} transition-[width] duration-200 overflow-hidden bg-white border-e border-surface-tertiary flex flex-col shrink-0 h-screen`}>
        <div className="p-5 border-b border-surface-tertiary overflow-hidden">
          <Link href="/" className="block">
            {sidebarCollapsed ? (
              <h1 className="font-display text-lg text-brand-600 truncate">VL</h1>
            ) : (
              <>
                <h1 className="font-display text-lg text-text-primary">
                  {t("app.title")}
                </h1>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {t("app.platform")}
                </p>
              </>
            )}
          </Link>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={group.labelKey} className={gIdx > 0 ? "mt-4" : ""}>
              {!sidebarCollapsed && (
                <div className="px-5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
                  {t(group.labelKey)}
                </div>
              )}
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const label = t(item.labelKey);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-5 py-2 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-brand-400/40 focus-visible:outline-none rounded-sm ${
                      isActive
                        ? "bg-brand-50 text-brand-700 border-e-2 border-brand-400 font-medium"
                        : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                    }`}
                    title={sidebarCollapsed ? label : undefined}
                  >
                    {sidebarCollapsed ? (
                      <span className="text-text-tertiary text-sm font-mono">{label.charAt(0).toUpperCase()}</span>
                    ) : (
                      <span>{label}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-surface-tertiary space-y-1.5">
          <LanguageToggle />
          <Link
            href="/bank"
            className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-[11px] font-medium text-text-secondary bg-surface-secondary border border-surface-tertiary hover:bg-surface-tertiary hover:text-text-primary transition-colors"
            title={sidebarCollapsed ? t('admin.bar.bankerView') : undefined}
          >
            {sidebarCollapsed ? (
              <span className="opacity-50 mx-auto">{t('admin.bar.bankerViewArrow')}</span>
            ) : (
              <>
                <span>{t('admin.bar.bankerView')}</span>
                <span className="opacity-50">{t('admin.bar.bankerViewArrow')}</span>
              </>
            )}
          </Link>
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex items-center justify-center w-full py-2 text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={`transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`}>
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {!sidebarCollapsed && <span className="ml-2 text-xs">{t('admin.nav.collapse')}</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto h-screen">
        {showStaleBanner && (
          <div
            role="status"
            aria-live="polite"
            className="bg-amber-50 border-b border-amber-300 text-amber-900 text-xs px-6 py-2 flex items-center gap-2 print:hidden"
          >
            <span aria-hidden="true">⚠</span>
            <span>
              {t('admin.banner.stalePart1')}{snapshotPulledAt ? <> <bdi><strong>{snapshotPulledAt}</strong></bdi></> : null}{' '}{t('admin.banner.stalePart2')}
              {' '}<code className="mx-1 px-1 rounded bg-amber-100 font-mono">seasonSnapshots/latest</code>
            </span>
          </div>
        )}
        {/* Stripped control bar — Path, Scenario, Exit, Rate/Loan popover.
            Live KPIs removed (they're on the dashboard, one home only). */}
        <div id="control-bar" className="sticky top-0 z-20 bg-white border-b border-surface-tertiary scroll-mt-24">
          <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            {/* Financing path */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                {t("bar.path")}
              </span>
              <div className="flex gap-1">
                {financingPaths.map((fp) => {
                  const isActive = assumptions.financingPath === fp.id;
                  return (
                    <button
                      key={fp.id}
                      onClick={() => setFinancingPath(fp.id)}
                      aria-pressed={isActive}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        isActive
                          ? "bg-brand-600 text-white shadow-sm"
                          : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
                      }`}
                    >
                      {t(fp.shortKey)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-px h-5 bg-surface-tertiary" />

            {/* Scenario */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                {t("bar.scenario")}
              </span>
              <div className="flex gap-1">
                {scenarios.map((s) => {
                  const isActive = activeScenario === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveScenario(s.id)}
                      aria-pressed={isActive}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        isActive
                          ? "bg-brand-600 text-white shadow-sm"
                          : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
                      }`}
                    >
                      {t(s.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-px h-5 bg-surface-tertiary" />

            {/* Exit year × multiple — inline since they're tuned often */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  {t('admin.bar.exitYear')}
                </span>
                <input
                  type="number"
                  min={2030}
                  max={2036}
                  step={1}
                  value={exitYearRaw || String(assumptions.exitYear ?? 2036)}
                  onChange={(e) => {
                    setExitYearRaw(e.target.value);
                    const v = parseInt(e.target.value, 10);
                    if (Number.isFinite(v)) {
                      setAssumption("exitYear", Math.max(2030, Math.min(2036, v)), "Exit year");
                    }
                  }}
                  onBlur={() => setExitYearRaw('')}
                  className={`w-16 px-1.5 py-1 text-xs font-mono text-right rounded border text-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-brand-400/40 ${
                    exitUnderwater ? "border-warning ring-1 ring-warning/40" : "border-surface-tertiary"
                  }`}
                  title={
                    exitUnderwater
                      ? "Remaining debt exceeds asset value at exit — equity holders receive only operating distributions; terminal proceeds are €0."
                      : "Exit year"
                  }
                />
                {exitYearRaw && (parseInt(exitYearRaw) < 2030 || parseInt(exitYearRaw) > 2036) && (
                  <span className="text-[10px] text-warning ml-1">{t('admin.bar.exitYearRange')}</span>
                )}
                {exitUnderwater && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-warning/15 text-warning"
                    title="Remaining debt > asset value at this exit. Equity sale proceeds floor at €0."
                  >
                    ⚠ {t('admin.bar.stubAtMaturity')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  {t('bar.exitMultipleLabel')}
                </span>
                <input
                  type="number"
                  min={4}
                  step={0.5}
                  value={assumptions.exitEbitdaMultiple ?? 10}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) {
                      // Floor at 4× (below which the buyer would be paying < cap rate cost of debt);
                      // no upper bound — sponsor can model the optimistic ceiling without the input
                      // silently clamping per Eytan 2026-05-22.
                      setAssumption("exitEbitdaMultiple", Math.max(4, v), "Exit EBITDA multiple");
                    }
                  }}
                  className="w-14 px-1.5 py-1 text-xs font-mono text-right rounded border border-surface-tertiary text-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-brand-400/40"
                  title={
                    (assumptions.exitEbitdaMultiple ?? 10) < 7
                      ? t('bar.exitMultiple.tipLow')
                      : (assumptions.exitEbitdaMultiple ?? 10) > 14
                        ? t('bar.exitMultiple.tipHigh')
                        : t('bar.exitMultiple.tipNormal')
                  }
                />
              </div>
              {/* Property-sale exit valuation €/m². Drives the parallel
                  exit-IRR shown alongside the hotel-sale IRR. Default 9 000
                  is the market mid (matches the `collateral.market` tier). */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  {t('admin.bar.perM2')}
                </span>
                <input
                  type="number"
                  min={1000}
                  step={100}
                  value={assumptions.exitValuationPerM2 ?? 9000}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) {
                      setAssumption(
                        "exitValuationPerM2",
                        Math.max(1000, v),
                        "Property-sale exit valuation (€/m²)",
                      );
                    }
                  }}
                  className="w-20 px-1.5 py-1 text-xs font-mono text-right rounded border border-surface-tertiary text-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-brand-400/40"
                  title="Property-sale exit valuation (€/m²). Drives the parallel exit-IRR alongside the EBITDA-multiple hotel-sale IRR."
                />
              </div>
            </div>

            {/* Rate / Loan popover (only when applicable to active path) */}
            {rateLoanConfig && (
              <>
                <div className="w-px h-5 bg-surface-tertiary" />
                <RateLoanPopover
                  rate={rateLoanConfig.rate}
                  coverage={rateLoanConfig.coverage}
                  onRate={(v) => setAssumption(rateLoanConfig.ratePath, v, "Interest rate")}
                  onCoverage={(v) => setAssumption(rateLoanConfig.coveragePath, v, "Loan coverage")}
                  t={t}
                />
              </>
            )}

          </div>
        </div>

        <div className="max-w-7xl mx-auto p-6">
          {children}
        </div>
      </main>
      <AssumptionPrompts />
      {/* <AssumptionsMemoButton /> */}
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  // Impersonation: only fires for an actual admin pretending to be a
  // banker. Real unauthenticated visitors never satisfy isImpersonating,
  // so this redirect is safe to live in /admin/* — bankers viewing the
  // public share-link never hit this codepath.
  const { isImpersonating, effectiveRole } = useEffectiveAuth();
  useEffect(() => {
    // When landing on the login page, clear any active impersonation
    // synchronously and stop. Without the early return, the stale
    // isImpersonating closure value (from the same render) would still
    // be true and router.replace('/bank') would fire before re-render.
    if (pathname === "/admin/login") {
      clearImpersonation();
      return;
    }
    // Redirect fires only after the Firestore profile arrives and
    // canImpersonate becomes true — no premature redirect on cold boot.
    if (isImpersonating && effectiveRole === "banker") {
      router.replace("/bank");
    }
  }, [pathname, isImpersonating, effectiveRole, router]);

  // Login page: render a minimal shell — no sidebar, no control bar.
  // Only Language toggle + Banker View link so the page is clean for unauthenticated visitors.
  if (pathname === '/admin/login') {
    return (
      <AuthGate>
        <div className="min-h-screen bg-surface-primary flex flex-col">
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-b border-surface-tertiary bg-white">
            <LanguageToggle />
            <Link
              href="/bank"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-text-secondary bg-surface-secondary border border-surface-tertiary hover:bg-surface-tertiary transition-colors"
            >
              <span>{t('admin.bar.bankerView')}</span>
              <span className="opacity-50">{t('admin.bar.bankerViewArrow')}</span>
            </Link>
          </div>
          <div className="flex-1">
            {children}
          </div>
        </div>
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </AuthGate>
  );
}
