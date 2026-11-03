import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { api } from '../lib/api.js'
import { useI18n } from '../lib/i18n.jsx'
import { useAsync } from '../lib/useAsync.js'
import RiskPanel from '../components/RiskPanel.jsx'
import { ErrorBox, PageHeader, PrivacyNote } from '../components/ui.jsx'

const EMPTY = {
  name: '', phone: '', age: 35, county: 'Baringo', village: '', screening_facility: '',
  distance_km: 40, phone_type: 'feature', missed_visits: 0, hiv_status: 'negative',
  screening_method: 'VIA', language: 'sw',
}

function Field({ label, children, className = '' }) {
  return <label className={`block ${className}`}><span className="label">{label}</span>{children}</label>
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-none bg-ivory p-1 ring-1 ring-line">
      {options.map(([v, label]) => (
        <button type="button" key={v} onClick={() => onChange(v)} aria-pressed={value === v}
          className={`rounded-none px-2 py-2 text-sm font-medium transition ${value === v ? 'bg-white text-deep shadow-card' : 'text-ink-muted hover:text-deep'}`}>{label}</button>
      ))}
    </div>
  )
}

export default function Register() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const meta = useAsync(api.meta, [])
  const [form, setForm] = useState(EMPTY)
  const [consent, setConsent] = useState(false)
  const [risk, setRisk] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }))

  const county = useMemo(() => meta.data?.counties.find((c) => c.name === form.county), [meta.data, form.county])

  // Live risk preview, debounced.
  useEffect(() => {
    const body = {
      age: Number(form.age), county: form.county, distance_km: Number(form.distance_km),
      phone_type: form.phone_type, missed_visits: Number(form.missed_visits),
      hiv_status: form.hiv_status, screening_method: form.screening_method,
    }
    if (!body.age || body.age < 18) return
    const id = setTimeout(() => api.scoreRisk(body).then(setRisk).catch(() => {}), 200)
    return () => clearTimeout(id)
  }, [form.age, form.county, form.distance_km, form.phone_type, form.missed_visits, form.hiv_status, form.screening_method])

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const p = await api.register({
        ...form, age: Number(form.age), distance_km: Number(form.distance_km), missed_visits: Number(form.missed_visits),
        village: form.village || null, screening_facility: form.screening_facility || null,
      })
      navigate(`/patients/${p.id}`)
    } catch (err) {
      setError(err)
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title={t('register_title')} sub={t('register_sub')} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <form onSubmit={submit} className="card space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('full_name')}><input required minLength={2} className="input" value={form.name} onChange={set('name')} placeholder="e.g. Chebet Kiptoo" /></Field>
            <Field label={t('phone')}><input required className="input" inputMode="tel" pattern="\+?[0-9 ]{9,15}" value={form.phone} onChange={set('phone')} placeholder="07XX XXX XXX" /></Field>
            <Field label={t('age')}><input required type="number" min={18} max={90} className="input" value={form.age} onChange={set('age')} /></Field>
            <Field label={t('county')}>
              <select className="input" value={form.county} onChange={(e) => setForm((f) => ({ ...f, county: e.target.value, village: '', screening_facility: '', distance_km: meta.data?.counties.find((c) => c.name === e.target.value)?.typical_distance_km ?? f.distance_km }))}>
                {meta.data?.counties.map((c) => <option key={c.name}>{c.name}</option>)}
              </select>
            </Field>
            <Field label={t('village')}>
              <input className="input" list="villages" value={form.village} onChange={set('village')} placeholder={county?.villages[0]} />
              <datalist id="villages">{county?.villages.map((v) => <option key={v} value={v} />)}</datalist>
            </Field>
            <Field label={t('screening_site')}>
              <input className="input" list="sites" value={form.screening_facility} onChange={set('screening_facility')} placeholder={county?.screening_sites[0]} />
              <datalist id="sites">{county?.screening_sites.map((v) => <option key={v} value={v} />)}</datalist>
            </Field>
          </div>
          {county && <p className="rounded-none bg-mint px-3 py-2 text-sm text-deep"><b>{t('treatment_site')}:</b> {county.treatment_facility}</p>}

          <Field label={`${t('distance')}: ${form.distance_km} km`}>
            <input type="range" min={1} max={150} className="w-full accent-teal" value={form.distance_km} onChange={set('distance_km')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('phone_type')}><Segmented value={form.phone_type} onChange={set('phone_type')} options={[['feature', t('feature_phone')], ['smartphone', t('smartphone')]]} /></Field>
            <Field label={t('missed')}><input type="number" min={0} max={20} className="input" value={form.missed_visits} onChange={set('missed_visits')} /></Field>
            <Field label={t('hiv')}><Segmented value={form.hiv_status} onChange={set('hiv_status')} options={[['negative', t('hiv_negative')], ['positive', t('hiv_positive')], ['unknown', t('hiv_unknown')]]} /></Field>
            <Field label={t('method')}><Segmented value={form.screening_method} onChange={set('screening_method')} options={[['VIA', 'VIA'], ['HPV', 'HPV']]} /></Field>
            <Field label={t('sms_language')}><Segmented value={form.language} onChange={set('language')} options={[['sw', 'Kiswahili'], ['en', 'English']]} /></Field>
          </div>

          <label className="flex items-start gap-3 rounded-none border border-line p-3 text-sm">
            <input type="checkbox" required className="mt-1 h-4 w-4 accent-teal" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{t('consent')}</span>
          </label>
          {error && <ErrorBox error={error} />}
          <button className="btn-primary w-full sm:w-auto" disabled={saving || !consent}>
            {saving && <Loader2 size={16} className="animate-spin" />}{saving ? t('saving') : t('save_patient')}
          </button>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="card p-5" aria-live="polite">
            <h2 className="mb-3 text-lg">{t('live_risk')}</h2>
            {risk ? <RiskPanel risk={risk} /> : <p className="text-sm text-ink-muted">{t('loading')}</p>}
          </div>
          <PrivacyNote compact />
        </aside>
      </div>
    </>
  )
}
