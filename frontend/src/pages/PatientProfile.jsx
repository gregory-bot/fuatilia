import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, Check, Clock, Loader2, MapPin, MessageSquare, Phone, Send, UserRoundCheck, Wallet } from 'lucide-react'
import { api } from '../lib/api.js'
import { fmtDate, fmtDateTime, kes, smsParts } from '../lib/format.js'
import { useI18n } from '../lib/i18n.jsx'
import { useAsync } from '../lib/useAsync.js'
import RiskPanel from '../components/RiskPanel.jsx'
import Timeline from '../components/Timeline.jsx'
import { ErrorBox, Loading, RiskBadge, StatusPill } from '../components/ui.jsx'

const STEPS = ['Screened Positive', 'Navigating', 'Checked In', 'Treated', 'Rescreen Due']

function Stepper({ status }) {
  const { t } = useI18n()
  const lost = status === 'Lost to Follow-up'
  const at = STEPS.indexOf(status)
  return (
    <ol className="grid grid-cols-5 gap-1 sm:gap-2" aria-label={t('status')}>
      {STEPS.map((s, i) => {
        const done = !lost && i <= at
        return (
          <li key={s} className="min-w-0">
            <div className={`h-1.5 rounded-full ${done ? 'bg-teal' : lost && i === 0 ? 'bg-coral' : 'bg-line'}`} />
            <p className={`mt-1.5 truncate text-[11px] sm:text-xs ${done ? 'font-semibold text-deep' : 'text-ink-faint'}`}>{t(s)}</p>
          </li>
        )
      })}
    </ol>
  )
}

function Card({ title, icon: Icon, children, className = '' }) {
  return (
    <section className={`card p-5 ${className}`}>
      <h2 className="mb-4 flex items-center gap-2 text-lg">{Icon && <Icon size={18} className="text-teal" />}{title}</h2>
      {children}
    </section>
  )
}

export default function PatientProfile() {
  const { id } = useParams()
  const { t, lang } = useI18n()
  const { data: p, error, loading, reload, setData } = useAsync(() => api.patient(id), [id])
  const settings = useAsync(api.settings, [])
  const [busy, setBusy] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [amount, setAmount] = useState('')

  async function act(name, fn) {
    setBusy(name)
    setActionError(null)
    try { setData(await fn()) } catch (e) { setActionError(e) } finally { setBusy(null) }
  }

  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (loading && !p) return <Loading />
  if (!p) return null

  const canCheckIn = ['Screened Positive', 'Navigating'].includes(p.status)
  const canTreat = p.status === 'Checked In'
  const active = ['Screened Positive', 'Navigating', 'Checked In'].includes(p.status)
  const Spin = <Loader2 size={16} className="animate-spin" />

  return (
    <>
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-teal"><ArrowLeft size={16} />{t('nav_dashboard')}</Link>

      <header className="card mb-6 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><StatusPill status={p.status} /><RiskBadge band={p.risk_band} score={p.risk_score} /></div>
            <h1 className="mt-2 text-3xl sm:text-4xl">{p.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">{p.code} · {p.age} {t('years')} · {p.village}, {p.county} · {p.distance_km} {t('km')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCheckIn && (
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="amt">KES</label>
                <input id="amt" type="number" min={0} className="input w-28" placeholder={`KES ${settings.data?.voucher_amount_kes ?? 1500}`} value={amount} onChange={(e) => setAmount(e.target.value)} />
                <button className="btn-primary" disabled={!!busy} onClick={() => act('in', () => api.checkIn(p.id, amount ? Number(amount) : undefined))}>
                  {busy === 'in' ? Spin : <MapPin size={16} />}{t('mark_checked_in')}
                </button>
              </div>
            )}
            {canTreat && (
              <button className="btn-primary" disabled={!!busy} onClick={() => act('tx', () => api.treat(p.id))}>
                {busy === 'tx' ? Spin : <BadgeCheck size={16} />}{t('mark_treated')}
              </button>
            )}
            {active && (
              <button className="btn-ghost" disabled={!!busy} onClick={() => act('sms', () => api.remind(p.id))}>
                {busy === 'sms' ? Spin : <Send size={16} />}{t('send_reminder')}
              </button>
            )}
            {active && p.status !== 'Checked In' && (
              <button className="btn-ghost text-coral-700" disabled={!!busy} onClick={() => act('lost', () => api.markLost(p.id, ''))}>{t('mark_lost')}</button>
            )}
          </div>
        </div>
        <div className="mt-5"><Stepper status={p.status} /></div>
        {actionError && <div className="mt-4"><ErrorBox error={actionError} /></div>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card title={t('timeline')} icon={Clock}><Timeline events={p.events} /></Card>

        <div className="space-y-6">
          <Card title={t('risk_explained')}><RiskPanel risk={{ score: p.risk_score, band: p.risk_band, factors: p.risk_factors }} compact /></Card>

          <Card title={t('voucher_status')} icon={Wallet}>
            {p.vouchers.length === 0 ? <p className="text-sm text-ink-muted">{t('no_voucher')}</p> : p.vouchers.map((v) => (
              <div key={v.id} className="pop flex items-center gap-3 rounded-none bg-[#E9F6E9] p-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#2E9E44] text-white"><Check size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-deep">{kes(v.amount_kes)} · M-Pesa</p>
                  <p className="truncate text-xs text-ink-muted">{v.transaction_id} · {v.status} ({v.mode}) · {fmtDateTime(v.created_at, lang)}</p>
                </div>
              </div>
            ))}
          </Card>

          <Card title={t('details')} icon={UserRoundCheck}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                [t('phone'), <span className="inline-flex items-center gap-1"><Phone size={13} />{p.phone}</span>],
                [t('phone_type'), p.phone_type === 'feature' ? t('feature_phone') : t('smartphone')],
                [t('hiv'), t(`hiv_${p.hiv_status}`)],
                [t('method'), p.screening_method],
                [t('missed'), p.missed_visits],
                [t('sms_language'), p.language === 'sw' ? 'Kiswahili' : 'English'],
                [t('screening_site'), p.screening_facility],
                [t('treatment_site'), p.treatment_facility],
                [t('next_visit'), fmtDate(p.appointment_on, lang)],
                [t('chp'), p.chp ? `${p.chp.name}${p.chp_visited_at ? ` · ${t('visited')} ✓` : ''}` : t('none')],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0"><dt className="text-xs text-ink-faint">{k}</dt><dd className="font-medium text-deep">{v}</dd></div>
              ))}
            </dl>
          </Card>

          <Card title={`${t('messages')} (${p.messages.length})`} icon={MessageSquare}>
            <ul className="space-y-3">
              {p.messages.map((m) => (
                <li key={m.id} className={`rounded-none rounded-tl-sm p-3 text-sm ${m.status === 'scheduled' ? 'border border-dashed border-line bg-white text-ink-muted' : 'bg-mint text-deep'}`}>
                  <p>{m.body}</p>
                  <p className="mt-1.5 flex flex-wrap gap-x-2 text-[11px] text-ink-faint">
                    <span className="font-semibold uppercase">{m.status === 'sent' ? t('sent') : t('scheduled')}</span>
                    <span>{fmtDateTime(m.send_at, lang)}</span><span>{m.language.toUpperCase()}</span>
                    <span>{m.body.length} chars · {smsParts(m.body)} SMS</span>
                    {m.provider_ref && <span>ref {m.provider_ref}</span>}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}
