'use client'

import { useTranslation } from '@/lib/i18n/I18nProvider'
import { useModelStore } from '@/lib/store/modelStore'

const ROWS = [
  { quarter: 'Q3-2026', vatPaid: 182_139, vatRefund: 0,       netFloat: 182_139 },
  { quarter: 'Q4-2026', vatPaid: 182_139, vatRefund: 0,       netFloat: 364_278 },
  { quarter: 'Q1-2027', vatPaid: 227_673, vatRefund: 182_139, netFloat: 409_812 },
  { quarter: 'Q2-2027', vatPaid: 227_673, vatRefund: 182_139, netFloat: 455_346 },
  { quarter: 'Q3-2027', vatPaid: 227_673, vatRefund: 227_673, netFloat: 455_346 },
  { quarter: 'Q4-2027', vatPaid: 227_673, vatRefund: 227_673, netFloat: 455_346 },
  { quarter: 'Q1-2028', vatPaid: 136_604, vatRefund: 227_673, netFloat: 364_277 },
  { quarter: 'Q2-2028', vatPaid: 136_604, vatRefund: 227_673, netFloat: 273_208 },
  { quarter: 'Q3-2028', vatPaid: 136_604, vatRefund: 136_604, netFloat: 273_208 },
  { quarter: 'Q4-2028', vatPaid: 136_604, vatRefund: 136_604, netFloat: 273_208 },
]

export function ConstructionVatCashflow() {
  const { t } = useTranslation()
  const { model, activeScenario } = useModelStore()
  const scenarioKey = (activeScenario === 'breakeven' ? 'realistic' : activeScenario) as keyof NonNullable<typeof model>['scenarios']
  const COVENANT = model?.scenarios[scenarioKey]?.wcMinimumFacility ?? 500_000
  const fmt = (n: number) => '€' + n.toLocaleString('en-GB')
  const allOk = ROWS.every(r => r.netFloat <= COVENANT)

  return (
    <div className="bg-white rounded-xl border border-surface-tertiary p-6 shadow-md">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-text-primary">{t('bank.vatCashflow.title')}</h3>
        <p className="text-sm text-text-secondary mt-0.5">{t('bank.vatCashflow.sub')}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-tertiary">
              <th className="text-left py-2 text-text-secondary font-medium">{t('bank.vatCashflow.colQuarter')}</th>
              <th className="text-right py-2 text-text-secondary font-medium">{t('bank.vatCashflow.colVatPaid')}</th>
              <th className="text-right py-2 text-text-secondary font-medium">{t('bank.vatCashflow.colVatRefund')}</th>
              <th className="text-right py-2 text-text-secondary font-medium">{t('bank.vatCashflow.colNetFloat')}</th>
              <th className="text-right py-2 text-text-secondary font-medium">{t('bank.vatCashflow.colCovenant')}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(row => {
              const ok = row.netFloat <= COVENANT
              return (
                <tr key={row.quarter} className="border-b border-surface-tertiary/50">
                  <td className="py-2 text-text-primary font-mono text-xs">{row.quarter}</td>
                  <td className="py-2 text-right text-text-primary">{fmt(row.vatPaid)}</td>
                  <td className="py-2 text-right text-text-secondary">{row.vatRefund > 0 ? fmt(row.vatRefund) : '—'}</td>
                  <td className="py-2 text-right font-medium text-text-primary">{fmt(row.netFloat)}</td>
                  <td className="py-2 text-right">
                    <span className={ok ? 'text-emerald-600 font-medium text-xs' : 'text-red-600 font-medium text-xs'}>
                      {ok ? t('bank.vatCashflow.covenantOk') : t('bank.vatCashflow.covenantBreach')}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {allOk && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          <span>✓</span>
          <span>{t('bank.vatCashflow.withinCovenant')} {fmt(COVENANT)} {t('bank.wc.revolving')}</span>
        </div>
      )}
      <div className="mt-4 space-y-1">
        <p className="text-xs text-text-tertiary">{t('bank.vatCashflow.lagNote')}</p>
        <p className="text-xs text-text-tertiary">{t('bank.vatCashflow.postRefundNote')}</p>
      </div>
    </div>
  )
}
