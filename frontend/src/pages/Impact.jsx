import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../lib/api.js'
import { useI18n } from '../lib/i18n.jsx'
import { useAsync } from '../lib/useAsync.js'
import { ErrorBox, Loading, PageHeader } from '../components/ui.jsx'

// Baseline is a deliberate neutral; Fuatilia is the brand teal. Values are always direct-labelled.
const WITHOUT = '#A9B4B2'
const WITH = '#1C7C7D'

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-none border border-line bg-white px-3 py-2 text-sm shadow-card">
      <p className="mb-1 font-semibold text-deep">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-ink">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />{p.name}: <b className="tabular-nums">{p.value}%</b>
        </p>
      ))}
      {payload[0].payload.n != null && <p className="mt-1 text-xs text-ink-faint">n = {payload[0].payload.n}</p>}
    </div>
  )
}

function Compare({ data, xKey, title, layout = 'horizontal' }) {
  const { t } = useI18n()
  const [table, setTable] = useState(false)
  const vertical = layout === 'vertical'
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg">{title}</h2>
        <button className="text-sm font-semibold text-teal" onClick={() => setTable((v) => !v)}>{table ? t('chart_view') : t('table_view')}</button>
      </div>
      {table ? (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-ink-muted"><tr><th className="py-2" /><th>{t('without')}</th><th>{t('with')}</th><th>n</th></tr></thead>
          <tbody className="divide-y divide-line tabular-nums">
            {data.map((d) => <tr key={d[xKey]}><td className="py-2 font-medium text-deep">{d[xKey]}</td><td>{d.without}%</td><td className="font-semibold text-teal-600">{d.with}%</td><td className="text-ink-faint">{d.n}</td></tr>)}
          </tbody>
        </table>
      ) : (
        <div style={{ height: vertical ? data.length * 52 + 60 : 300 }}>
          <ResponsiveContainer>
            <BarChart data={data} layout={layout} barGap={2} barCategoryGap={vertical ? '22%' : '28%'} margin={{ top: 20, right: 36, left: vertical ? 8 : -12, bottom: 0 }}>
              <CartesianGrid stroke="#E6EBE8" vertical={vertical} horizontal={!vertical} />
              {vertical ? (
                <>
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#5B6B6C', fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
                  <YAxis type="category" dataKey={xKey} width={84} tick={{ fill: '#1D2B2D', fontSize: 12 }} axisLine={false} tickLine={false} />
                </>
              ) : (
                <>
                  <XAxis dataKey={xKey} tick={{ fill: '#1D2B2D', fontSize: 13 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#5B6B6C', fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
                </>
              )}
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(28,124,125,.06)' }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 13 }} formatter={(v) => <span style={{ color: '#1D2B2D' }}>{v}</span>} />
              <Bar dataKey="without" name={t('without')} fill={WITHOUT} isAnimationActive={false} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
                <LabelList dataKey="without" position={vertical ? 'right' : 'top'} formatter={(v) => `${Math.round(v)}%`} style={{ fill: '#5B6B6C', fontSize: 11 }} />
              </Bar>
              <Bar dataKey="with" name={t('with')} fill={WITH} isAnimationActive={false} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}>
                <LabelList dataKey="with" position={vertical ? 'right' : 'top'} formatter={(v) => `${Math.round(v)}%`} style={{ fill: '#0F3A40', fontSize: 11, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

export default function Impact() {
  const { t } = useI18n()
  const { data, error, loading, reload } = useAsync(api.impact, [])
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (loading || !data) return <Loading />
  const byRisk = data.by_risk.map((r) => ({ ...r, label: t(`risk_${r.band}`) }))

  return (
    <>
      <PageHeader title={t('impact_title')} sub={t('impact_sub')} />
      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-ink-muted">{t('without')}</p>
          <p className="font-display text-5xl text-ink-muted tabular-nums">{data.overall.without}%</p>
          <p className="mt-1 text-xs text-ink-faint">{t('completion_rate')} · n = {data.overall.n}</p>
        </div>
        <div className="card border-deep bg-deep p-5 text-white">
          <p className="text-sm text-white/80">{t('with')}</p>
          <p className="font-display text-5xl tabular-nums">{data.overall.with}%</p>
          <p className="mt-1 text-xs text-white/70">+{(data.overall.with - data.overall.without).toFixed(1)} pts</p>
        </div>
        <div className="card bg-mint p-5">
          <p className="font-display text-5xl text-deep tabular-nums">+{data.women_retained}</p>
          <p className="mt-1 text-sm text-deep">{t('retained')}</p>
        </div>
      </section>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-2">
        <Compare data={byRisk} xKey="label" title={t('by_risk')} />
        <Compare data={data.by_county} xKey="county" title={t('by_county')} layout="vertical" />
      </div>

      <section className="card mt-6 p-5">
        <h2 className="mb-3 text-lg">{t('assumptions')}</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {data.assumptions.map((a) => (
            <li key={a.key} className="rounded-none bg-ivory p-4">
              <p className="font-display text-3xl text-deep">−{Math.round((1 - a.rr) * 100)}%</p>
              <p className="text-sm text-ink-muted">dropout · {a.label}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-ink-muted">
          Context: in one western Kenya cervical screening programme, overall loss to follow-up was 31.5%, rising to 49.3% between biopsy and LEEP.
          Kenya’s CATSystem tracking tool already showed better follow-up for enrolled women; Fuatilia adds risk prediction, M-Pesa incentives and pathology triage on top.
        </p>
        <p className="mt-2 text-xs text-ink-faint">{data.note}</p>
      </section>
    </>
  )
}
