'use client'

import { useTranslation } from '@/lib/i18n/I18nProvider'
import { useModelStore } from '@/lib/store/modelStore'
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'

// All 4 construction tranches in 2029 (mobilization + 3 milestones, March–June 2029).
// AADE refund arrives Q1-Q2 2030 (~2-quarter lag after 2029 completion).
const ROWS = [
  { quarter: 'Q1-2029', vatPaid: 182_139, vatRefund: 0,       netFloat: 182_139 },
  { quarter: 'Q2-2029', vatPaid: 364_278, vatRefund: 0,       netFloat: 546_416 },
  { quarter: 'Q3-2029', vatPaid: 182_139, vatRefund: 0,       netFloat: 728_554 },
  { quarter: 'Q4-2029', vatPaid: 0,       vatRefund: 0,       netFloat: 728_554 },
  { quarter: 'Q1-2030', vatPaid: 0,       vatRefund: 364_277, netFloat: 364_277 },
  { quarter: 'Q2-2030', vatPaid: 0,       vatRefund: 364_277, netFloat: 0       },
]

// Pre-construction periods (zero activity) — extend back to 2027 so the chart
// makes clear construction starts in 2029, not earlier. The 2026-2028 figures
// in our earlier analysis were the hypothetical old schedule (ADR-0026: never executed).
const PRE_CONSTRUCTION = [
  '2027 Q1','2027 Q2','2027 Q3','2027 Q4',
  '2028 Q1','2028 Q2','2028 Q3','2028 Q4',
].map(period => ({ period, spend: 0, vat: 0, refund: 0 }))

// Construction + refund periods derived from ROWS (stays in sync with the table).
// spend = construction cost excl. VAT  (= vatPaid / 0.24, VAT rate 24%)
const CONSTRUCTION_DATA = ROWS.map(r => {
  const [q, yr] = r.quarter.split('-')
  return {
    period: `${yr} ${q}`,
    spend:  r.vatPaid > 0 ? Math.round(r.vatPaid / 0.24 / 1000) : 0,
    vat:    Math.round(r.vatPaid  / 1000),
    refund: Math.round(r.vatRefund / 1000),
  }
})

const CHART_DATA = [...PRE_CONSTRUCTION, ...CONSTRUCTION_DATA]

// Table value formatter — module-level to avoid recreation on every render.
const fmt = (n: number) => '€' + n.toLocaleString('en-GB')

export function ConstructionVatCashflow() {
  const { t } = useTranslation()
  const { model, activeScenario } = useModelStore()
  const scenarioKey = (activeScenario === 'breakeven' ? 'realistic' : activeScenario) as keyof NonNullable<typeof model>['scenarios']
  const COVENANT   = model?.scenarios[scenarioKey]?.wcMinimumFacility ?? 500_000
  const COVENANT_K = Math.round(COVENANT / 1000)
  const allOk      = ROWS.every(r => r.netFloat <= COVENANT)

  return (
    <div className="bg-white rounded-xl border border-surface-tertiary p-6 shadow-md">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-text-primary">{t('bank.vatCashflow.title')}</h3>
        <p className="text-sm text-text-secondary mt-0.5">{t('bank.vatCashflow.sub')}</p>
      </div>

      {/* Construction spend + VAT + refund chart */}
      <p className="text-xs text-stone-500 italic mb-3">
        {t('bank.vatCashflow.chart.chartSubtitle')}
      </p>

      {/* dir="ltr" prevents chart mirroring in Hebrew locale */}
      <div dir="ltr" className="mb-6">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={CHART_DATA} margin={{ top: 8, right: 16, left: 4, bottom: 36 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 9 }}
              interval={0}
              angle={-40}
              textAnchor="end"
              height={56}
            />
            <YAxis
              tickFormatter={(v: number) => `€${v}K`}
              tick={{ fontSize: 9 }}
              width={62}
            />
            <Tooltip
              formatter={(value, name) => [`€${Number(value)}K`, String(name)]}
              contentStyle={{ borderRadius: 8, border: '1px solid #EDE6D5', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />

            {/* Covenant threshold (WC facility cap) */}
            <ReferenceLine
              y={COVENANT_K}
              stroke="#B45309"
              strokeDasharray="5 5"
              label={{ value: t('bank.vatCashflow.chart.covenantLabel'), position: 'insideTopRight', fontSize: 9, fill: '#B45309' }}
            />

            {/* Line 1 — construction spend excl. VAT (blue) */}
            <Line
              type="monotone"
              dataKey="spend"
              name={t('bank.vatCashflow.chart.capexBar')}
              stroke="#3B82F6"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#3B82F6' }}
              activeDot={{ r: 5 }}
            />

            {/* Line 2 — VAT paid on that spend (amber) */}
            <Line
              type="monotone"
              dataKey="vat"
              name={t('bank.vatCashflow.chart.vatBar')}
              stroke="#F59E0B"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#F59E0B' }}
              activeDot={{ r: 5 }}
            />

            {/* Line 3 — AADE refund received (green) */}
            <Line
              type="monotone"
              dataKey="refund"
              name={t('bank.vatCashflow.chart.refundBar')}
              stroke="#10B981"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#10B981' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-tertiary">
              <th className="text-left  py-2 text-text-secondary font-medium">{t('bank.vatCashflow.colQuarter')}</th>
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
