"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useModelStore, ScenarioName } from "@/lib/store/modelStore";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { formatCurrency } from "@/lib/hooks/useModel";
import { LanguageToggle } from "@/components/LanguageToggle";
import { FinancingPath } from "@/lib/engine/types";
import { TranslationDictionary } from "@/lib/i18n/types";

const financingPaths: { id: FinancingPath; shortKey: keyof TranslationDictionary; color: string }[] = [
  { id: "commercial", shortKey: "path.commercialShort", color: "#8B6914" },
  { id: "rrf", shortKey: "path.rrfShort", color: "#4A6A8B" },
  { id: "grant", shortKey: "path.grantShort", color: "#4A7C3F" },
  { id: "tepix-loan", shortKey: "path.tepixLoanShort", color: "#7B5EA7" },
  { id: "tepix-guarantee", shortKey: "path.tepixGuaranteeShort", color: "#C4754B" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { init, model, computeTimeMs, assumptions, setFinancingPath, activeScenario, setActiveScenario } =
    useModelStore();
  const { t, locale } = useTranslation();

  const navItems: { href: string; labelKey: keyof TranslationDictionary }[] = [
    { href: "/admin/dashboard", labelKey: "nav.dashboard" },
    { href: "/admin/pnl", labelKey: "nav.pnl" },
    { href: "/admin/breakeven", labelKey: "nav.breakeven" },
    { href: "/admin/capex", labelKey: "nav.capex" },
    { href: "/admin/scenarios", labelKey: "nav.scenarios" },
    { href: "/admin/assumptions", labelKey: "nav.assumptions" },
    { href: "/admin/sensitivity", labelKey: "nav.sensitivity" },
    { href: "/admin/lexicon", labelKey: "nav.lexicon" },
  ];

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

        <nav className="flex-1 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-700 border-e-2 border-brand-500 font-medium"
                    : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                }`}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-surface-tertiary">
          {model && (
            <div className="text-xs text-text-tertiary flex justify-between">
              <span>{t("bar.engine")}</span>
              <span className="font-mono">{computeTimeMs.toFixed(1)}ms</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto h-screen">
        {/* Prominent toggles — always visible */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-surface-tertiary">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-6">
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
                          ? "text-white shadow-md"
                          : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                      }`}
                      style={isActive ? { backgroundColor: fp.color } : undefined}
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
                          ? "bg-text-primary text-white shadow-md"
                          : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                      }`}
                    >
                      {t(s.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live KPIs + Language toggle */}
            <div className="ms-auto flex items-center gap-4 text-xs text-text-tertiary">
              {model && (
                <>
                  <span>
                    {t("bar.ds")}:{" "}
                    <span className="font-mono font-medium text-text-primary">
                      {formatCurrency(model.keyMetrics.annualDS, true, locale)}
                    </span>
                  </span>
                  <span>
                    {t("bar.dscr")}:{" "}
                    <span className="font-mono font-medium text-text-primary">
                      {(model.scenarios[activeScenario].stabilisedYear?.dscr ?? 0).toFixed(2)}×
                    </span>
                  </span>
                  <span>
                    {t("bar.ncf")}:{" "}
                    <span className="font-mono font-medium text-text-primary">
                      {formatCurrency(
                        model.scenarios[activeScenario].stabilisedYear?.netCashFlowPostVAT ?? 0,
                        true,
                        locale
                      )}
                    </span>
                  </span>
                </>
              )}
              <div className="w-px h-4 bg-surface-tertiary" />
              <LanguageToggle />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
