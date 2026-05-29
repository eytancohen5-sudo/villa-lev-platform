'use client'

import { useTranslation } from '@/lib/i18n/I18nProvider'
import { useModelStore } from '@/lib/store/modelStore'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts'

// All 4 construction tranches in 2029 (mobilization + 3 milestones, March–July 2029).
// AADE refund arrives Q1-Q2 2030 (~4-month lag after 2029 completion).
const ROWS = [
  { quarter: 'Q1-2029', vatPaid: 182_139, vatRefund: 0,       netFloat: 182_139 },
  { quarter: 'Q2-2029', vatPaid: 364_278, vatRefund: 0,       netFloat: 546_416 },
  { quarter: 'Q3-2029', vatPaid: 182_139, vatRefund: 0,       netFloat: 728_554 },
  { quarter: 'Q4-2029', vatPaid: 0,       vatRefund: 0,       netFloat: 728_554 },
  { quarter: 'Q1-2030', vatPaid: 0,       vatRefund: 364_277, netFloat: 364_277 },
  { quarter: 'Q2-2030', vatPaid: 0,       vatRefund: 364_277, netFloat: 0       },
]

// All periods on the shared X-axis, chronological order
const ALL_PERIODS = [
  '2026 Q4','2027 Q1','2027 Q2','2027 Q3','2027 Q4',
  '2028 Q1','2028 Q2','2028 Q3','2028 Q4',
  '2029 Q1','2029 Q2','2029 Q3','2029 Q4',
  '2030 Q1','2030 Q2',
]

// Old schedule: hardcoded counterfactual — the 2026-2028 spread that was never executed.
// These values are intentionally hardcoded; they are NOT engine outputs.
const OLD_K: Record<string, number> = {
  '2026 Q4': 90,  '2027 Q1': 195, '2027 Q2': 335, '2027 Q3': 455,
  '2027 Q4': 410, '2028 Q1': 355, '2028 Q2': 295, '2028 Q3': 273,
  '2028 Q4': 273, '2029 Q1': 136, '2029 Q2': 0,
}

// New-schedule net float in €K — derived from ROWS so the chart always matches the table.
// ROWS quarter format is 'Q1-2029'; ALL_PERIODS format is '2029 Q1'.
// Module-level because ROWS is a constant — no component state involved.
const newK: Record<string, number> = {
  '2028 Q4': 0, // start-of-construction anchor
  ...Object.fromEntries(
    ROWS.map(r => {
      const [q, yr] = r.quarter.split('-')
      return [`${yr} ${q}`, Math.round(r.netFloat / 1000)]
    })
  ),
}

// Merged dataset for the Recharts LineChart.
// null fills for periods where a series has no data point — Recharts skips nulls (connectNulls=false).
// Module-level: neither OLD_K nor newK depends on component state.
const CHART_DATA = ALL_PERIODS.map(p => ({
  period: p,
  old: OLD_K[p] ?? null,
  new: newK[p] ?? null,
}))

// Derived peak for the new-schedule annotation — keeps the label in sync with ROWS.
const NEW_PEAK_K = Math.max(...Object.values(newK))

// Table value formatter — module-level to avoid recreation on every render.
const fmt = (n: number) => '€' + n.toLocaleString('en-GB')

export function ConstructionVatCashflow() {
  const { t } = useTranslation()
  const { model, activeScenario } = useModelStore()
  const scenarioKey = (activeScenario === 'breakeven' ? 'realistic' : activeScenario) as keyof NonNullable<typeof model>['scenarios']
  const COVENANT = model?.scenarios[scenarioKey]?.wcMinimumFacility ?? 500_000
  const COVENANT_K = Math.round(COVENANT / 1000)

  const allOk = ROWS.every(r => r.netFloat <= COVENANT)

  return (
    <div className="bg-white rounded-xl border border-surface-tertiary p-6 shadow-md">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-text-primary">{t('bank.vatCashflow.title')}</h3>
        <p className="text-sm text-text-secondary mt-0.5">{t('bank.vatCashflow.sub')}</p>
      </div>

      {/* VAT float comparison chart */}
      <p className="text-xs text-stone-500 italic mb-3">
        {t('bank.vatCashflow.chart.illustrativeNote')}
      </p>

      {/* dir="ltr" forces LTR layout so the chart axes are never mirrored in Hebrew locale */}
      <div dir="ltr" className="mb-4">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={CHART_DATA} margin={{ top: 16, right: 28, left: 4, bottom: 32 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDE6D5" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 9 }}
              interval={0}
              angle={-40}
              textAnchor="end"
              height={52}
            />
            <YAxis
              tickFormatter={(v: number) => `€${v}K`}
              tick={{ fontSize: 9 }}
              width={56}
              domain={[0, 800]}
            />
            <Tooltip
              formatter={(value) => [`€${value}K`, '']}
              contentStyle={{ borderRadius: 8, border: '1px solid #EDE6D5', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <ReferenceLine
              y={COVENANT_K}
              stroke="#B45309"
              strokeDasharray="5 5"
              label={{ value: t('bank.vatCashflow.chart.covenantLabel'), position: 'insideTopRight', fontSize: 9, fill: '#B45309' }}
            />
            <ReferenceLine
              y={455}
              stroke="transparent"
              label={{ value: t('bank.vatCashflow.chart.oldPeakLabel'), position: 'insideTopLeft', fontSize: 9, fill: '#9E3B3B' }}
            />
            <ReferenceLine
              y={NEW_PEAK_K}
              stroke="transparent"
              label={{ value: t('bank.vatCashflow.chart.newPeakLabel'), position: 'insideTopRight', fontSize: 9, fill: '#2563EB' }}
            />
            <Line
              type="monotone"
              dataKey="old"
              name={t('bank.vatCashflow.chart.oldSchedule')}
              stroke="#9E3B3B"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="new"
              name={t('bank.vatCashflow.chart.newSchedule')}
              stroke="#2563EB"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
        <p className="text-xs font-semibold text-amber-800 mb-1">
          {t('bank.vatCashflow.chart.insightHeading')}
        </p>
        <p className="text-xs text-amber-700 leading-relaxed">
          {t('bank.vatCashflow.chart.insightBody')}
        </p>
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
