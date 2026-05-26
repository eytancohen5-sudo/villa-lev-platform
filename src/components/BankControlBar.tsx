'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useModelStore, ScenarioName } from '@/lib/store/modelStore';
import { useTranslation } from '@/lib/i18n/I18nProvider';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useEffectiveAuth, clearImpersonation } from '@/lib/data/useEffectiveAuth';
import type { ReactNode } from 'react';

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
  { key: 'breakeven', labelKey: 'bank.bar.breakeven' },
] as const;

export default function BankControlBar({ tourSlot }: { tourSlot?: ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    financingPathOverride, setFinancingPathOverride,
    activeScenario, setActiveScenario,
    assumptions,
  } = useModelStore();
  const { user, isAdmin, actualRole, loading: authLoading } = useEffectiveAuth();

  // Use the ephemeral override when set; otherwise fall back to the persisted
  // assumptions.financingPath so the pill highlights match what the page renders.
  const activePath = financingPathOverride ?? assumptions.financingPath;

  return (
    <div className="sticky top-0 z-50 bg-[#1C1A16] border-b border-[#2D2B24] print:hidden">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: brand */}
        <span className="font-semibold text-sm text-[#C4A55E] shrink-0 tracking-wide">Villa Lev Group</span>

        {/* Centre + Right: controls */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Path pills */}
          <div className="flex gap-1">
            {PATHS.map(p => (
              <button
                key={p.key}
                onClick={() => setFinancingPathOverride(p.key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  activePath === p.key
                    ? 'bg-brand-600 text-white'
                    : 'text-[#9A9080] hover:bg-white/8 hover:text-[#C4A55E]'
                }`}
              >
                {t(p.labelKey)}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-[#2D2B24]" />

          {/* Scenario pills */}
          <div className="flex gap-1">
            {SCENARIOS.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveScenario(s.key as ScenarioName)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeScenario === s.key
                    ? 'bg-brand-600 text-white'
                    : 'text-[#9A9080] hover:bg-white/8 hover:text-[#F0EAD8]'
                }`}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-[#2D2B24]" />

          {/* Language toggle */}
          <LanguageToggle placement="down" />

          {/* Tour slot — optional, passed from page */}
          {tourSlot}

          {/* Back-link: real admins (actualRole, not impersonated) go to dashboard;
              unauthenticated visitors get a sign-in link;
              logged-in non-admins (viewers/editors) see nothing extra. */}
          {!authLoading && (
            <>
              {actualRole === 'admin' && (
                <>
                  <div className="w-px h-5 bg-surface-tertiary" />
                  {/* Clear any active impersonation before going back to admin.
                      Without this, banker mode persists in localStorage and the
                      AdminLayout effect immediately redirects back to /bank. */}
                  <button
                    type="button"
                    onClick={() => {
                      clearImpersonation();
                      router.push('/admin/dashboard');
                    }}
                    className="px-3 py-1 rounded text-xs font-medium text-[#9A9080] hover:bg-white/8 hover:text-[#F0EAD8] transition-colors border border-[#2D2B24]"
                  >
                    {t('bar.toAdmin')}
                  </button>
                </>
              )}
              {!user && (
                <>
                  <div className="w-px h-5 bg-surface-tertiary" />
                  <Link
                    href="/admin/login"
                    className="px-3 py-1 rounded text-xs font-medium text-[#9A9080] hover:bg-white/8 hover:text-[#F0EAD8] transition-colors border border-[#2D2B24]"
                  >
                    {t('bar.signIn')}
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
