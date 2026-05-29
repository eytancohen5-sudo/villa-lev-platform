'use client'

import { useTranslation } from '@/lib/i18n/I18nProvider'
import { useModelStore } from '@/lib/store/modelStore'
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'

// Construction: Q1 2027 → Q1 2029  (ADR-0026: hotel opens Summer 2029)
// Draw schedule: 35% in 2027 / 45% in 2028 / 20% in Q1-2029
// Total construction VAT @ 24%: €728,554
// AADE quarterly VAT filing — refund arrives 1 quarter after spend (optimistic)
//
// netFloat = cumulative VAT paid so far − cumulative VAT refunded so far.
// With a 1-quarter lag the outstanding float never exceeds a single quarter's spend,
// so peak is €145,711 (Q1-2029, the largest single tranche).
const ROWS = [
  // 2027: 35% of €728,554 = €254,994 · 4 equal quarterly tranches
  { quarter: 'Q1-2027', vatPaid:  63_749, vatRefund:       0, netFloat:  63_749 },
  { quarter: 'Q2-2027', vatPaid:  63_749, vatRefund:  63_749, netFloat:  63_749 },
  { quarter: 'Q3-2027', vatPaid:  63_749, vatRefund:  63_749, netFloat:  63_749 },
  { quarter: 'Q4-2027', vatPaid:  63_747, vatRefund:  63_749, netFloat:  63_747 },
  // 2028: 45% of €728,554 = €327,849 · 4 equal quarterly tranches
  { quarter: 'Q1-2028', vatPaid:  81_962, vatRefund:  63_747, netFloat:  81_962 },
  { quarter: 'Q2-2028', vatPaid:  81_962, vatRefund:  81_962, netFloat:  81_962 },
  { quarter: 'Q3-2028', vatPaid:  81_962, vatRefund:  81_962, netFloat:  81_962 },
  { quarter: 'Q4-2028', vatPaid:  81_963, vatRefund:  81_962, netFloat:  81_963 },
  // 2029 Q1: 20% of €728,554 = €145,711 · final tranche, hotel opens Summer 2029
  { quarter: 'Q1-2029', vatPaid: 145_711, vatRefund:  81_963, netFloat: 145_711 },
  // Q2-2029: refund clears last tranche (1-quarter lag from Q1-2029 spend)
  { quarter: 'Q2-2029', vatPaid:       0, vatRefund: 145_711, netFloat:       0 },
]

// Chart data — spend excl. VAT (€K), VAT paid (€K), AADE refund (€K).
// All Y-axis values in thousands.  spend = vatPaid / 0.24 (VAT rate 24%).
const CHART_DATA = ROWS.map(r => {
  const [q, yr] = r.quarter.split('-')
  return {
    period: `${yr} ${q}`,
    spend:  r.vatPaid > 0 ? Math.round(r.vatPaid / 0.24 / 1000) : 0,
    vat:    Math.round(r.vatPaid  / 1000),
    refund: Math.round(r.vatRefund / 1000),
  }
})

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
