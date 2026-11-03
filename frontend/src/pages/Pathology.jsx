import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ImagePlus, Loader2, X } from 'lucide-react'
import { api } from '../lib/api.js'
import { fmtDateTime } from '../lib/format.js'
import { useI18n } from '../lib/i18n.jsx'
import { useAsync } from '../lib/useAsync.js'
import { AiLabel, ErrorBox, Loading, PageHeader } from '../components/ui.jsx'

const BAND = {
  urgent: { bar: 'bg-coral', chip: 'bg-coral-50 text-coral-700' },
  priority: { bar: 'bg-amber', chip: 'bg-amber-50 text-[#8A5A12]' },
  routine: { bar: 'bg-teal', chip: 'bg-mint text-teal-600' },
}

// Seeded cases have no photo: draw a stylised H&E-like field (pink/purple) from the case id.
function SlidePlaceholder({ seed }) {
  const dots = Array.from({ length: 26 }, (_, i) => {
    const r = Math.sin(seed * 97 + i * 13.7) * 10000
    const f = r - Math.floor(r)
    const g = Math.sin(seed * 31 + i * 7.3) * 10000
    return { x: 8 + (f * 84), y: 8 + ((g - Math.floor(g)) * 84), r: 2 + ((f * 7) % 4) }
  })
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <defs><radialGradient id={`g${seed}`}><stop offset="0" stopColor="#F6D6E4" /><stop offset="1" stopColor="#E7A9C6" /></radialGradient></defs>
      <rect width="100" height="100" fill={`url(#g${seed})`} />
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={i % 3 ? '#7B4E9E' : '#9C5FB5'} opacity=".75" />)}
    </svg>
  )
}

function CaseRow({ c, onChange }) {
  const { t, lang } = useI18n()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const pending = c.status === 'pending'

  async function review(decision) {
    setBusy(decision)
    setError(null)
    try { onChange(await api.review(c.id, decision, note)) } catch (e) { setError(e) } finally { setBusy(null) }
  }

  return (
    <li className={`card flex flex-col gap-4 p-4 sm:flex-row ${pending ? '' : 'opacity-70'}`}>
      <div className="h-36 w-full shrink-0 overflow-hidden rounded-none bg-mint sm:h-32 sm:w-32">
        {c.image_url ? <img src={c.image_url} alt={`Slide ${c.case_code}`} className="h-full w-full object-cover" /> : <SlidePlaceholder seed={c.id} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <b className="font-display text-lg text-deep">{c.case_code}</b>
          <span className={`chip ${BAND[c.urgency_band].chip}`}>{c.urgency_band}</span>
          {!pending && <span className={`chip ${c.status === 'confirmed' ? 'bg-deep text-white' : 'bg-line text-ink'}`}>{t(c.status)}</span>}
        </div>
        <p className="mt-0.5 truncate text-sm text-ink-muted">
          {c.patient_id ? <Link to={`/patients/${c.patient_id}`} className="text-teal hover:underline">{c.patient_name} ({c.patient_code})</Link> : c.original_filename}
          {' · '}{fmtDateTime(c.created_at, lang)}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('urgency')}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line"><div className={`h-full rounded-full ${BAND[c.urgency_band].bar}`} style={{ width: `${c.urgency_score}%` }} /></div>
          <b className="tabular-nums text-deep">{c.urgency_score}</b>
        </div>
        <p className="mt-2 text-xs text-ink-muted">{c.ai_note}</p>
        {c.reviewer_note && <p className="mt-1 text-xs text-deep">“{c.reviewer_note}”</p>}
        {pending && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input className="input flex-1" placeholder="Pathologist note" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={!!busy} onClick={() => review('confirmed')}>{busy === 'confirmed' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{t('confirm')}</button>
              <button className="btn-ghost flex-1" disabled={!!busy} onClick={() => review('rejected')}>{busy === 'rejected' ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}{t('reject')}</button>
            </div>
          </div>
        )}
        {error && <div className="mt-2"><ErrorBox error={error} /></div>}
      </div>
    </li>
  )
}

export default function Pathology() {
  const { t } = useI18n()
  const queue = useAsync(api.pathology, [])
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [drag, setDrag] = useState(false)

  async function upload(file) {
    if (!file) return
    setUploading(true)
    setError(null)
    try { await api.uploadSlide(file); queue.reload() } catch (e) { setError(e) } finally { setUploading(false) }
  }
  const replace = (c) => queue.setData((list) => list.map((x) => (x.id === c.id ? c : x)))
  const pending = queue.data?.filter((c) => c.status === 'pending').length ?? 0

  return (
    <>
      <PageHeader title={t('path_title')} sub={t('path_sub')} />
      <AiLabel className="mb-4" />
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]) }}
        className={`card mb-6 flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed p-8 text-center transition ${drag ? 'border-teal bg-mint' : 'border-line'}`}>
        {uploading ? <Loader2 className="animate-spin text-teal" /> : <ImagePlus className="text-teal" size={28} />}
        <span className="font-semibold text-deep">{t('upload')}</span>
        <span className="text-xs text-ink-muted">JPG · PNG · WEBP · max 10 MB. Mock scoring only.</span>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { upload(e.target.files[0]); e.target.value = '' }} />
      </label>
      {error && <div className="mb-4"><ErrorBox error={error} /></div>}
      {queue.data && <p className="mb-3 text-sm text-ink-muted"><b className="text-deep">{pending}</b> {t('pending').toLowerCase()}</p>}
      {queue.error && <ErrorBox error={queue.error} onRetry={queue.reload} />}
      {queue.loading && !queue.data && <Loading />}
      <ul className="space-y-3">{queue.data?.map((c) => <CaseRow key={c.id} c={c} onChange={replace} />)}</ul>
    </>
  )
}
