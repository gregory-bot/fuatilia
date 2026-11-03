import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Delete, Phone, PhoneOff, Send } from 'lucide-react'
import { api } from '../lib/api.js'
import { useI18n } from '../lib/i18n.jsx'
import { useAsync } from '../lib/useAsync.js'
import FeaturePhone, { Keypad } from '../components/FeaturePhone.jsx'
import { PageHeader } from '../components/ui.jsx'

const CODE = '*384*12#'
const AMINA_PHONE = '+254700000384'

/**
 * Drives the real /api/ussd callback exactly like Africa's Talking would:
 * each request carries the whole input history joined by '*'.
 */
export default function UssdSimulator() {
  const { t, lang } = useI18n()
  const candidates = useAsync(() => api.patients({ risk: 'high', status: 'Navigating', limit: 6 }), [])
  const [phone, setPhone] = useState(AMINA_PHONE)
  const [mode, setMode] = useState('idle') // idle | session | ended
  const [dial, setDial] = useState('')
  const [reply, setReply] = useState('')
  const [history, setHistory] = useState([])
  const [screen, setScreen] = useState('')
  const [log, setLog] = useState([])
  const sessionId = useRef('')
  const logEnd = useRef(null)
  useEffect(() => { logEnd.current?.scrollIntoView({ block: 'nearest' }) }, [log])

  async function send(inputs) {
    const text = inputs.join('*')
    setScreen('…')
    try {
      const res = await api.ussd({ sessionId: sessionId.current, phoneNumber: phone, text, lang })
      setLog((l) => [...l, { text, res }])
      setScreen(res.slice(4))
      setMode(res.startsWith('END') ? 'ended' : 'session')
    } catch (e) {
      setScreen(`Error: ${e.message}`)
      setMode('ended')
    }
  }

  function call() {
    if (dial !== CODE) { setScreen(`${dial}\n\nUnknown code. Try ${CODE}`); setMode('ended'); return }
    sessionId.current = `SIM-${Date.now()}`
    setHistory([])
    setLog([])
    send([])
  }

  function submit() {
    if (!reply) return
    const next = [...history, reply]
    setHistory(next)
    setReply('')
    send(next)
  }

  function hangUp() { setMode('idle'); setDial(''); setReply(''); setScreen('') }

  const onKey = (k) => (mode === 'session' ? setReply((r) => r + k) : mode === 'idle' && setDial((d) => d + k))
  const backspace = () => (mode === 'session' ? setReply((r) => r.slice(0, -1)) : setDial((d) => d.slice(0, -1)))

  const display = mode === 'idle'
    ? <div className="flex h-full flex-col justify-end text-right"><span className="text-[11px]">{phone}</span><span className="caret text-xl font-bold">{dial}</span></div>
    : <>{screen}{mode === 'session' && <div className="mt-1 border-t border-[#14301E]/30 pt-1"><span className="caret">{reply}</span></div>}</>

  return (
    <>
      <PageHeader title={t('ussd_title')} sub={t('ussd_sub')} />
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <div>
          <FeaturePhone screen={display}
            footer={(
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {mode === 'idle'
                  ? <button className="rounded-none bg-[#2E9E44] py-2 text-white" onClick={call} aria-label={t('dial')}><Phone size={16} className="mx-auto" /></button>
                  : <button className="rounded-none bg-[#2E9E44] py-2 text-white disabled:opacity-40" onClick={submit} disabled={mode !== 'session'} aria-label={t('reply')}><Send size={16} className="mx-auto" /></button>}
                <button className="rounded-none bg-[#3A4547] py-2 text-white" onClick={backspace} aria-label="Delete"><Delete size={16} className="mx-auto" /></button>
                <button className="rounded-none bg-coral py-2 text-white" onClick={hangUp} aria-label={t('hang_up')}><PhoneOff size={16} className="mx-auto" /></button>
              </div>
            )}
            keypad={<Keypad onKey={onKey} disabled={mode === 'ended'} />} />
          {mode === 'idle' && (
            <button className="btn-ghost mx-auto mt-4 flex" onClick={() => setDial(CODE)}>{t('dial')} {CODE}</button>
          )}
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <label className="label" htmlFor="ph">{t('choose_patient')}</label>
            <select id="ph" className="input" value={phone} onChange={(e) => { setPhone(e.target.value); hangUp() }}>
              <option value={AMINA_PHONE}>Amina Lenaseiyan · {AMINA_PHONE} (demo)</option>
              {candidates.data?.items.map((p) => <option key={p.id} value={p.phone}>{p.name} · {p.county}</option>)}
              <option value="+254799999999">Unknown number (guest menu)</option>
            </select>
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-ink-muted">
              <li>{t('dial')} <b className="text-deep">{CODE}</b> → <Phone size={13} className="inline" /></li>
              <li>1 = confirm · 2 = change date · 3 = find a clinic · 4 = call me · 5 = {lang === 'sw' ? 'English' : 'Kiswahili'}</li>
              <li>{t('reply')} <Send size={13} className="inline" /></li>
            </ol>
            <p className="mt-3 text-xs text-ink-faint">{t('ussd_how')}</p>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-lg">POST /api/ussd</h2>
            {log.length === 0 && <p className="text-sm text-ink-muted">—</p>}
            <ul className="space-y-2 font-mono text-xs">
              {log.map((l, i) => (
                <li key={i} className="fade-up rounded-none bg-ivory p-3">
                  <p className="text-ink-faint">sessionId={sessionId.current} phoneNumber={phone} text=&quot;{l.text}&quot;</p>
                  <pre className={`mt-1 whitespace-pre-wrap ${l.res.startsWith('END') ? 'text-coral-700' : 'text-teal-600'}`}>{l.res}</pre>
                </li>
              ))}
            </ul>
            <div ref={logEnd} />
            {log.length > 0 && phone === AMINA_PHONE && <Link to="/journey" className="mt-3 inline-block text-sm font-semibold text-teal">→ {t('nav_journey')}</Link>}
          </div>
        </div>
      </div>
    </>
  )
}
