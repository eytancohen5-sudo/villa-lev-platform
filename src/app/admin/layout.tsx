"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useModelStore, ScenarioName } from "@/lib/store/modelStore";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { LanguageToggle } from "@/components/LanguageToggle";
import { AssumptionPrompts } from "@/components/AssumptionPrompts";
import { ViewAsControl } from "@/components/ViewAsControl";
import { BankViewToggle, BankViewBadge, CopyBankLinkButton } from "@/components/BankViewToggle";
import { FinancingPath } from "@/lib/engine/types";
import { TranslationDictionary } from "@/lib/i18n/types";
import { useSeasonSnapshot } from "@/lib/data/useSeasonSnapshot";
import { useEffectiveAuth } from "@/lib/data/useEffectiveAuth";

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
}: {
  rate: number;
  coverage: number;
  onRate: (v: number) => void;
  onCoverage: (v: number) => void;
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`px-2.5 py-1 rounded-md text-[11px] font-medium uppercase tracking-wider transition-colors ${
          open
            ? "bg-brand-50 text-brand-700 border border-brand-200"
            : "bg-surface-secondary text-text-secondary border border-surface-tertiary hover:bg-surface-tertiary"
        }`}
        aria-expanded={open}
        title={`Rate ${(rate * 100).toFixed(2)}% · Loan ${(coverage * 100).toFixed(0)}%`}
      >
        Adjust · {(rate * 100).toFixed(1)}% / {(coverage * 100).toFixed(0)}%
      </button>
      {open && (
        <div className="absolute top-full mt-2 right-0 z-30 bg-white border border-surface-tertiary rounded-xl shadow-lg p-4 min-w-[220px]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">
            Loan parameters
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs text-text-secondary">Interest rate</label>
              <div className="flex items-center gap-1">
                <PercentInput value={rate} decimals={2} step={0.05} onCommit={onRate} />
                <span className="text-xs text-text-tertiary">%</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs text-text-secondary">Loan coverage</label>
              <div className="flex items-center gap-1">
                <PercentInput value={coverage} decimals={0} step={1} onCommit={onCoverage} />
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
  label: string;
  items: NavItem[];
}
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Analyse",
    items: [
      { href: "/admin/dashboard",     labelKey: "nav.dashboard" },
      { href: "/admin/returns",       labelKey: "nav.returns" },
      { href: "/admin/pnl",           labelKey: "nav.pnl" },
      { href: "/admin/breakeven",     labelKey: "nav.breakeven" },
      { href: "/admin/sensitivity",   labelKey: "nav.sensitivity" },
      { href: "/admin/debt-coverage", labelKey: "nav.debtCoverage" },
      { href: "/admin/financing",     labelKey: "nav.financingPaths" },
    ],
  },
  {
    label: "Structure",
    items: [
      { href: "/admin/opco-split", labelKey: "nav.opcoSplit" },
      { href: "/admin/cap-table",  labelKey: "nav.capTable" },
    ],
  },
  {
    label: "Inputs",
    items: [
      { href: "/admin/assumptions", labelKey: "nav.assumptions" },
      { href: "/admin/capex",       labelKey: "nav.capex" },
      { href: "/admin/scenarios",   labelKey: "nav.scenarios" },
      { href: "/admin/lexicon",     labelKey: "nav.lexicon" },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Impersonation: only fires for an actual admin pretending to be a
  // banker. Real unauthenticated visitors never satisfy isImpersonating,
  // so this redirect is safe to live in /admin/* — bankers viewing the
  // public share-link never hit this codepath.
  const { isImpersonating, effectiveRole } = useEffectiveAuth();
  useEffect(() => {
    if (isImpersonating && effectiveRole === "banker") {
      router.replace("/bank");
    }
  }, [isImpersonating, effectiveRole, router]);
  const { init, model, computeTimeMs, assumptions, setFinancingPath, activeScenario, setActiveScenario, setAssumption } =
    useModelStore();
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
  const { t } = useTranslation();

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
      <aside className="w-56 bg-white border-e border-surface-tertiary flex flex-col shrink-0 h-screen">
        <div className="p-5 border-b border-surface-tertiary">
          <Link href="/" className="block">
            <h1 className="font-display text-lg text-text-primary">
              {t("app.title")}
            </h1>
            <p className="text-xs text-text-tertiary mt-0.5">
              {t("app.platform")}
            </p>
          </Link>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_GROUPS.map((group, gIdx) => (
            <div key={group.label} className={gIdx > 0 ? "mt-4" : ""}>
              <div className="px-5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                {group.label}
              </div>
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-5 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-brand-50 text-brand-700 border-e-2 border-brand-500 font-medium"
                        : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                    }`}
                  >
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-surface-tertiary space-y-1.5">
          <LanguageToggle />
          <ViewAsControl />
          <a
            href="/presentation"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[11px] text-text-tertiary hover:text-brand-700 transition-colors py-0.5"
          >
            View Presentation ↗
          </a>
          <div className="flex items-center gap-1.5 pt-0.5">
            <BankViewToggle />
            <CopyBankLinkButton />
            {model && (
              <span
                className="ms-auto text-[10px] font-mono text-text-tertiary opacity-60 tabular-nums"
                title="Model compute time"
              >
                {computeTimeMs.toFixed(0)}ms
              </span>
            )}
          </div>
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
              Showing static snapshot from <strong>{snapshotPulledAt}</strong> — live
              <code className="mx-1 px-1 rounded bg-amber-100 font-mono">seasonSnapshots/latest</code>
              feed not connected.
            </span>
          </div>
        )}
        {/* Stripped control bar — Path, Scenario, Exit, Rate/Loan popover.
            Live KPIs removed (they're on the dashboard, one home only). */}
        <div id="control-bar" className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-surface-tertiary scroll-mt-24">
          <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            {/* Bank-view indicator (only renders when the admin has toggled
                into Bank view; hidden otherwise so the bar stays clean). */}
            <BankViewBadge />
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
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "bg-brand-700 text-white shadow-sm"
                          : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                      }`}
                    >
                      {t(fp.shortKey)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-px h-6 bg-surface-tertiary" />

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
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "bg-text-primary text-white shadow-sm"
                          : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                      }`}
                    >
                      {t(s.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-px h-6 bg-surface-tertiary" />

            {/* Exit year × multiple — inline since they're tuned often */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Exit
                </span>
                <input
                  type="number"
                  min={2030}
                  max={2036}
                  step={1}
                  value={assumptions.exitYear ?? 2036}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (Number.isFinite(v)) {
                      setAssumption("exitYear", Math.max(2030, Math.min(2036, v)), "Exit year");
                    }
                  }}
                  className={`w-16 px-1.5 py-1 text-xs font-mono text-right rounded border bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${
                    exitUnderwater ? "border-warning ring-1 ring-warning/30" : "border-surface-tertiary"
                  }`}
                  title={
                    exitUnderwater
                      ? "Remaining debt exceeds asset value at exit — equity holders receive only operating distributions; terminal proceeds are €0."
                      : "Exit year"
                  }
                />
                {exitUnderwater && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-warning/15 text-warning"
                    title="Remaining debt > asset value at this exit. Equity sale proceeds floor at €0."
                  >
                    ⚠ stub at maturity
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  ×
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
                  className="w-14 px-1.5 py-1 text-xs font-mono text-right rounded border border-surface-tertiary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  title={
                    (assumptions.exitEbitdaMultiple ?? 10) < 7
                      ? "Warning: below market floor for boutique hotels"
                      : (assumptions.exitEbitdaMultiple ?? 10) > 14
                        ? "Aggressive: above typical boutique-hotel range — sponsor sensitivity"
                        : "Exit EBITDA multiple"
                  }
                />
              </div>
              {/* Property-sale exit valuation €/m². Drives the parallel
                  exit-IRR shown alongside the hotel-sale IRR. Default 9 000
                  is the market mid (matches the `collateral.market` tier). */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                  €/m²
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
                  className="w-20 px-1.5 py-1 text-xs font-mono text-right rounded border border-surface-tertiary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  title="Property-sale exit valuation (€/m²). Drives the parallel exit-IRR alongside the EBITDA-multiple hotel-sale IRR."
                />
              </div>
            </div>

            {/* Rate / Loan popover (only when applicable to active path) */}
            {rateLoanConfig && (
              <>
                <div className="w-px h-6 bg-surface-tertiary" />
                <RateLoanPopover
                  rate={rateLoanConfig.rate}
                  coverage={rateLoanConfig.coverage}
                  onRate={(v) => setAssumption(rateLoanConfig.ratePath, v, "Interest rate")}
                  onCoverage={(v) => setAssumption(rateLoanConfig.coveragePath, v, "Loan coverage")}
                />
              </>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-6">{children}</div>
      </main>
      <AssumptionPrompts />
    </div>
  );
}
