import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Check, Footprints, Loader2, MapPin, Phone } from 'lucide-react'
import { api } from '../lib/api.js'
import { fmtDate } from '../lib/format.js'
import { useI18n } from '../lib/i18n.jsx'
import { useAsync } from '../lib/useAsync.js'
import { ErrorBox, Loading, PageHeader, RiskBadge, StatusPill } from '../components/ui.jsx'

function VisitCard({ p, onVisited }) {
  const { t, lang } = useI18n()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const visited = !!p.visited_at

  async function visit() {
    setBusy(true)
    setError(null)
    try { await api.logVisit(p.id, note); onVisited() } catch (e) { setError(e); setBusy(false) }
  }

  return (
    <li className={`card flex flex-col p-5 ${visited ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/patients/${p.id}`} className="font-display text-xl font-semibold text-deep hover:underline">{p.name}</Link>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-muted"><MapPin size={14} />{p.village}, {p.county} · {p.distance_km} {t('km')}</p>
        </div>
        <RiskBadge band={p.risk_band} score={p.risk_score} />
      </div>
      {p.top_reason && <p className="mt-3 rounded-none bg-coral-50 px-3 py-2 text-sm text-coral-700">{p.top_reason[lang] || p.top_reason.en}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <StatusPill status={p.status} />
        <span className="inline-flex items-center gap-1"><CalendarDays size={14} />{fmtDate(p.appointment_on, lang)}</span>
        <span>· {p.chp?.name}</span>
      </div>
      <div className="mt-auto pt-4">
        {visited ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal"><Check size={16} />{t('visited')} · {fmtDate(p.visited_at, lang)}</p>
        ) : (
          <div className="space-y-2">
            <input className="input" placeholder={t('visit_note')} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-2">
              <a href={`tel:${p.phone}`} className="btn-ghost flex-1"><Phone size={16} />{t('call')}</a>
              <button className="btn-primary flex-[2]" onClick={visit} disabled={busy}>
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Footprints size={16} />}{t('mark_visited')}
              </button>
            </div>
            {error && <ErrorBox error={error} />}
          </div>
        )}
      </div>
    </li>
  )
}

export default function Worklist() {
  const { t } = useI18n()
  const chps = useAsync(api.chps, [])
  const [chpId, setChpId] = useState('')
  const list = useAsync(() => api.worklist(chpId), [chpId])
  const pending = list.data?.filter((p) => !p.visited_at).length ?? 0

  return (
    <>
      <PageHeader title={t('worklist_title')} sub={t('worklist_sub')}
        actions={(
          <select className="input w-full sm:w-72" value={chpId} onChange={(e) => setChpId(e.target.value)} aria-label={t('chp')}>
            <option value="">{t('all_chps')}</option>
            {chps.data?.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.county} ({c.active_patients})</option>)}
          </select>
        )} />
      {list.data && <p className="mb-4 text-sm text-ink-muted"><b className="text-deep">{pending}</b> / {list.data.length} · {t('mark_visited').toLowerCase()}</p>}
      {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
      {list.loading && !list.data && <Loading />}
      {list.data?.length === 0 && <p className="card p-8 text-center text-ink-muted">{t('nothing_to_do')}</p>}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.data?.map((p) => <VisitCard key={p.id} p={p} onVisited={list.reload} />)}
      </ul>
    </>
  )
}
