'use client';

import { useModelStore, ScenarioName } from '@/lib/store/modelStore';
import { useTranslation } from '@/lib/i18n/I18nProvider';
import { LanguageToggle } from '@/components/LanguageToggle';

const PATHS = [
  { key: 'commercial', labelKey: 'bank.bar.commercial' },
  { key: 'rrf',        labelKey: 'bank.bar.rrf' },
  { key: 'grant',      labelKey: 'bank.bar.grant' },
  { key: 'tepix-loan', labelKey: 'bank.bar.tepix' },
] as const;

const SCENARIOS = [
  { key: 'realistic', labelKey: 'bank.bar.realistic' },
  { key: 'upside',    labelKey: 'bank.bar.upside' },
  { key: 'downside',  labelKey: 'bank.bar.downside' },
] as const;

export default function BankControlBar() {
  const { t } = useTranslation();
  const { financingPathOverride, setFinancingPathOverride, activeScenario, setActiveScenario } = useModelStore();

  const activePath = financingPathOverride ?? 'commercial'; // default if null

  return (
    <div className="sticky top-0 z-50 bg-surface-primary/90 backdrop-blur-md border-b border-surface-tertiary print:hidden">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-6">
        {/* Left: brand */}
        <span className="font-semibold text-sm text-text-primary">Villa Lev Group</span>

        {/* Right: controls */}
        <div className="flex items-center gap-4">
          {/* Path pills */}
          <div className="flex gap-1">
            {PATHS.map(p => (
              <button
                key={p.key}
                onClick={() => setFinancingPathOverride(p.key)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activePath === p.key
                    ? 'bg-brand-500 text-white'
                    : 'text-text-secondary hover:bg-surface-secondary'
                }`}
              >
                {t(p.labelKey)}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-surface-tertiary" />

          {/* Scenario pills */}
          <div className="flex gap-1">
            {SCENARIOS.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveScenario(s.key as ScenarioName)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activeScenario === s.key
                    ? 'bg-earth-olive text-white'
                    : 'text-text-secondary hover:bg-surface-secondary'
                }`}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </div>

          {/* Language toggle */}
          <LanguageToggle />
        </div>
      </div>
    </div>
  );
}
