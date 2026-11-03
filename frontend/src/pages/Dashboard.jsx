import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, ChevronRight, Search, UserX, Users, Wallet } from 'lucide-react'
import { api } from '../lib/api.js'
import { fmtDate, kes } from '../lib/format.js'
import { useI18n } from '../lib/i18n.jsx'
import { useAsync } from '../lib/useAsync.js'
import { ErrorBox, Loading, MetricCard, PageHeader, RiskBadge, StatusPill } from '../components/ui.jsx'

const STATUSES = ['Screened Positive', 'Navigating', 'Checked In', 'Treated', 'Rescreen Due', 'Lost to Follow-up']
const STATUS_BAR = { 'Screened Positive': '#5B6A9E', Navigating: '#1C7C7D', 'Checked In': '#3B7FA8', Treated: '#0F3A40', 'Rescreen Due': '#C9892B', 'Lost to Follow-up': '#E0684B' }
const PAGE = 15

// Where every woman is in the pathway right now, as one segmented bar with a legend.
function PathwayBar({ byStatus, onPick }) {
  const { t } = useI18n()
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0) || 1
  return (
    <div className="card p-5">
      <h2 className="text-lg">{t('patients')}: {total}</h2>
      <div className="mt-4 flex h-4 gap-[2px] overflow-hidden rounded-full">
        {STATUSES.map((s) => byStatus[s] > 0 && (
          <button key={s} title={`${t(s)}: ${byStatus[s]}`} onClick={() => onPick(s)}
            style={{ width: `${(100 * byStatus[s]) / total}%`, background: STATUS_BAR[s] }} className="h-full transition hover:opacity-80" />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
        {STATUSES.map((s) => (
          <li key={s}>
            <button onClick={() => onPick(s)} className="flex w-full items-center gap-2 rounded-none text-left hover:bg-mint">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_BAR[s] }} />
              <span className="text-ink-muted">{t(s)}</span>
              <b className="ml-auto tabular-nums text-deep">{byStatus[s]}</b>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Dashboard() {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const metrics = useAsync(api.metrics, [])
  const meta = useAsync(api.meta, [])
  const [filters, setFilters] = useState({ risk: '', status: '', county: '', q: '', sort: 'recent' })
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const list = useAsync(() => api.patients({ ...filters, limit: PAGE, offset: page * PAGE }), [filters, page])

  // Debounce search typing.
  useEffect(() => {
    const id = setTimeout(() => { setFilters((f) => ({ ...f, q: query })); setPage(0) }, 250)
    return () => clearTimeout(id)
  }, [query])
  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(0) }

  const m = metrics.data
  return (
    <>
      <PageHeader title={t('nav_dashboard')} sub={`${t('tagline')} ${t('privacy_short')}`}
        actions={<Link to="/register" className="btn-primary">+ {t('nav_register')}</Link>} />

      {metrics.error && <ErrorBox error={metrics.error} onRetry={metrics.reload} />}
      {m && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key metrics">
          <MetricCard hero label={t('completion_rate')} value={`${m.completion_rate}%`} note={`${m.completed} ${t('completion_note')}`} />
          <MetricCard label={t('avg_days')} value={m.avg_days_to_treatment ?? '—'} note={t('avg_days_note')} icon={CalendarClock} />
          <MetricCard label={t('lost')} value={m.lost_to_follow_up} note={t('lost_note')} icon={UserX} tone="coral" />
          <MetricCard label={t('vouchers')} value={m.vouchers_paid} note={`${kes(m.vouchers_kes)} ${t('vouchers_note')}`} icon={Wallet} />
        </section>
      )}
      {m && <div className="mt-4"><PathwayBar byStatus={m.by_status} onPick={(s) => setFilter('status', s)} /></div>}

      <section className="card mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input className="input pl-9" placeholder={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('search')} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
            <select className="input lg:w-40" value={filters.risk} onChange={(e) => setFilter('risk', e.target.value)} aria-label={t('risk')}>
              <option value="">{t('all_risks')}</option>
              {['high', 'medium', 'low'].map((b) => <option key={b} value={b}>{t(`risk_${b}`)}</option>)}
            </select>
            <select className="input lg:w-44" value={filters.status} onChange={(e) => setFilter('status', e.target.value)} aria-label={t('status')}>
              <option value="">{t('all_statuses')}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
            </select>
            <select className="input lg:w-40" value={filters.county} onChange={(e) => setFilter('county', e.target.value)} aria-label={t('county')}>
              <option value="">{t('all_counties')}</option>
              {meta.data?.counties.map((c) => <option key={c.name}>{c.name}</option>)}
            </select>
            <select className="input lg:w-36" value={filters.sort} onChange={(e) => setFilter('sort', e.target.value)} aria-label="Sort">
              <option value="recent">{t('sort_recent')}</option>
              <option value="risk">{t('sort_risk')}</option>
            </select>
          </div>
        </div>

        {list.error && <div className="p-4"><ErrorBox error={list.error} onRetry={list.reload} /></div>}
        {list.loading && !list.data && <Loading />}
        {list.data && (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-ivory text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{t('name')}</th>
                    <th className="px-4 py-3 font-semibold">{t('county')}</th>
                    <th className="px-4 py-3 font-semibold">{t('risk')}</th>
                    <th className="px-4 py-3 font-semibold">{t('status')}</th>
                    <th className="px-4 py-3 font-semibold">{t('next_visit')}</th>
                    <th className="px-4 py-3 font-semibold">{t('chp')}</th>
                    <th className="sr-only">{t('open_profile')}</th>
                  </tr>
                </thead>
                <tbody className={`divide-y divide-line ${list.loading ? 'opacity-60' : ''}`}>
                  {list.data.items.map((p) => (
                    <tr key={p.id} className="cursor-pointer hover:bg-mint/60" onClick={() => navigate(`/patients/${p.id}`)}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-deep">{p.name}</p>
                        <p className="text-xs text-ink-faint">{p.code} · {p.age} {t('years')} · {p.distance_km} {t('km')}</p>
                      </td>
                      <td className="px-4 py-3">{p.county}<p className="text-xs text-ink-faint">{p.village}</p></td>
                      <td className="px-4 py-3"><RiskBadge band={p.risk_band} score={p.risk_score} /></td>
                      <td className="px-4 py-3"><StatusPill status={p.status} /></td>
                      <td className="px-4 py-3 tabular-nums">{fmtDate(p.appointment_on, lang)}</td>
                      <td className="px-4 py-3 text-ink-muted">{p.chp?.name || '—'}</td>
                      <td className="px-4 py-3 text-right"><Link to={`/patients/${p.id}`} className="text-teal" aria-label={`${t('open_profile')} ${p.name}`}><ChevronRight size={18} /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <ul className="divide-y divide-line md:hidden">
              {list.data.items.map((p) => (
                <li key={p.id}>
                  <Link to={`/patients/${p.id}`} className="flex items-center gap-3 p-4 hover:bg-mint/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-deep">{p.name}</p>
                      <p className="text-xs text-ink-faint">{p.county} · {p.distance_km} {t('km')} · {fmtDate(p.appointment_on, lang)}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5"><RiskBadge band={p.risk_band} score={p.risk_score} /><StatusPill status={p.status} /></div>
                    </div>
                    <ChevronRight size={18} className="text-ink-faint" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-line p-4 text-sm text-ink-muted">
              <span><Users size={14} className="mr-1 inline" />{t('showing')} {list.data.items.length ? page * PAGE + 1 : 0}–{page * PAGE + list.data.items.length} {t('of')} {list.data.total}</span>
              <div className="flex gap-2">
                <button className="btn-ghost px-3 py-1.5" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{t('prev')}</button>
                <button className="btn-ghost px-3 py-1.5" disabled={(page + 1) * PAGE >= list.data.total} onClick={() => setPage((p) => p + 1)}>{t('next')}</button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  )
}
