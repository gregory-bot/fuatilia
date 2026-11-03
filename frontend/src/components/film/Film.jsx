import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronLeft, ChevronRight, Expand, Loader2, MessageSquareText, Mic, MicOff, Music2, Pause, Play, RotateCcw, VolumeX } from 'lucide-react'
import { api } from '../../lib/api.js'
import { fmtDate, kes } from '../../lib/format.js'
import { useI18n } from '../../lib/i18n.jsx'
import { getMusic } from '../../lib/music.js'
import { canSpeak, pickVoice, sentences, speak, stopSpeaking } from '../../lib/narrator.js'
import DialingPhone from '../DialingPhone.jsx'
import FeaturePhone from '../FeaturePhone.jsx'
import { RiskBadge, StatusPill } from '../ui.jsx'
import { FALLBACK, SCENES } from './scenes.js'

/*
 * "Amina's journey": a narrated photo film that doubles as Demo mode.
 * Scenes that need data call the REAL backend (reset → USSD → CHP visit → check-in → treat),
 * so the phone screens show what the API produced. If the API is down, FALLBACK data keeps
 * the film playing.
 */

const GAP_AFTER_VOICE = 1400 // ms of music between scenes
const msPerWord = 400 // used when narration is off/unavailable

/* ---------------- Overlays (phone screens and clinic cards) ---------------- */

function Panel({ children, className = '' }) {
  return <div className={`pop border border-white/60 bg-white/95 p-4 shadow-2xl backdrop-blur ${className}`}>{children}</div>
}

function Overlay({ scene, data, lang, playing }) {
  const p = data.patient
  const waiting = <div className="flex items-center gap-2 text-sm text-ink-muted"><Loader2 size={16} className="animate-spin" />…</div>

  if (scene.id === 'screen') {
    return (
      <Panel className="w-[300px]">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Fuatilia · {lang === 'sw' ? 'Kliniki' : 'Clinic'}</p>
        {!p ? waiting : <>
          <p className="mt-1 text-lg font-semibold text-deep">{p.name}</p>
          <p className="text-xs text-ink-muted">VIA + · {lang === 'sw' ? 'rufaa ya LEEP' : 'referred for LEEP'} · {p.distance_km} km</p>
          <div className="mt-3 flex items-center gap-3"><span className="text-4xl font-bold text-coral">{p.risk_score}</span><RiskBadge band={p.risk_band} size="lg" /></div>
          <ul className="mt-2 space-y-1 text-xs text-deep">{p.risk_factors.map((f) => <li key={f.feature}>↑ {f[lang] || f.en}</li>)}</ul>
          {p.chp && <p className="mt-2 bg-mint px-2 py-1 text-xs text-deep">CHP: {p.chp.name}</p>}
        </>}
      </Panel>
    )
  }
  if (scene.id === 'sms') {
    const sms = p?.messages.find((m) => m.purpose === 'intro')
    return <FeaturePhone buzz screen={sms ? <><b>Fuatilia</b>{'\n'}{sms.body}</> : '…'} />
  }
  if (scene.id === 'ussd') {
    const u = data.ussd
    return u ? <DialingPhone menu={u.menu} confirm={u.confirm} playing={playing} /> : <FeaturePhone screen="…" />
  }
  if (scene.id === 'chp') {
    const visit = p?.events.find((e) => e.kind === 'chp_visit')
    return (
      <Panel className="w-[290px]">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">CHP · {lang === 'sw' ? 'Orodha ya kazi' : 'Worklist'}</p>
        {!visit ? waiting : <>
          <p className="mt-1 flex items-center gap-2 font-semibold text-deep"><CheckCircle2 size={18} className="text-teal" />{visit.title}</p>
          <p className="mt-1 text-sm text-ink-muted">{visit.detail}</p>
        </>}
      </Panel>
    )
  }
  if (scene.id === 'checkin') {
    const sms = p?.messages.find((m) => m.purpose === 'voucher')
    return sms ? <FeaturePhone buzz title="M-PESA" screen={<><b>M-PESA</b>{'\n'}{sms.body}</>} /> : <Panel>{waiting}</Panel>
  }
  if (scene.id === 'treated') {
    return (
      <Panel className="w-[290px]">
        {p?.status !== 'Treated' ? waiting : <>
          <StatusPill status="Treated" />
          <p className="mt-2 text-lg font-semibold text-deep">{lang === 'sw' ? 'Matibabu yamekamilika' : 'Treatment complete'}</p>
          <p className="mt-1 text-sm text-ink-muted">{p.treatment_facility}</p>
          {p.appointment_on && <p className="mt-1 text-sm text-ink-muted">{lang === 'sw' ? 'Kipimo kijacho' : 'Next check'}: {fmtDate(p.appointment_on, lang)}</p>}
        </>}
      </Panel>
    )
  }
  return null
}

/** Cuts between photos inside one scene (e.g. Amina on board, then the matatu). */
function Shots({ shots, active }) {
  const [shot, setShot] = useState(0)
  useEffect(() => {
    setShot(0)
    if (!active) return undefined
    let at = 0
    const ids = shots.slice(0, -1).map((sh, i) => { at += sh.ms; return setTimeout(() => setShot(i + 1), at) })
    return () => ids.forEach(clearTimeout)
  }, [active, shots])
  return shots.map((sh, i) => (
    <div key={sh.img} className={`absolute inset-0 overflow-hidden transition-opacity duration-700 ${i === shot ? 'opacity-100' : 'opacity-0'}`}>
        <img key={`${sh.img}-${i === shot && active}`} src={sh.img} alt={i === 0 ? "Amina on board a matatu" : "A matatu on the highway"} className={`h-full w-full object-cover ${i === shot && active ? 'kenburns' : ''}`}
          style={{ objectPosition: sh.pos, '--kb-from': sh.kb?.from, '--kb-to': sh.kb?.to, '--kb-x1': sh.kb?.x1, '--kb-y1': sh.kb?.y1, '--kb-dur': '8s' }} />
    </div>
  ))
}

/* ---------------- The film ---------------- */

/**
 * @param renderMode video export: full-frame stage, no controls/audio; timing comes from
 *                   window.__FILM_TIMELINE__ (pre-measured narration clips), see scripts/render-film/
 * @param autoplay   start immediately (Demo mode button)
 * @param onLog      receives each backend call made by the film: ({ call, result })
 * @param onPatient  receives Amina's live record after each step
 */
export default function Film({ autoplay = false, onLog, onPatient, renderMode = false }) {
  const { lang } = useI18n()
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [index, setIndex] = useState(0)
  const [line, setLine] = useState(0) // which sentence of the narration is on screen
  const [data, setData] = useState({ patient: null, ussd: null })
  const [musicOn, setMusicOn] = useState(true)
  const [voiceOn, setVoiceOn] = useState(true)
  const [subsOn, setSubsOn] = useState(true)
  const [offline, setOffline] = useState(false)
  const [playId, setPlayId] = useState(0) // bumps on every (re)start so narration restarts
  const stageRef = useRef(null)
  const music = useRef(null)
  const chain = useRef(Promise.resolve())
  const done = useRef(-1)
  const generation = useRef(0)
  const run = useRef(0) // invalidates narration continuations on pause/seek
  const patientRef = useRef(null)
  const scene = SCENES[index]
  const timeline = renderMode ? window.__FILM_TIMELINE__ : null
  const lines = sentences(scene.voice[lang])

  const log = (call, result) => onLog?.({ call, result })
  const setPatient = (p) => { patientRef.current = p; setData((d) => ({ ...d, patient: p })); onPatient?.(p) }

  // One function per backend step; each falls back to demo data if the API is unreachable.
  const STEPS = {
    register: async () => {
      const p = await api.resetAmina()
      setPatient(p)
      log('POST /api/demo/amina/reset', `${p.code} registered · risk ${p.risk_score}/100 (${p.risk_band}) · CHP ${p.chp?.name ?? '—'}`)
    },
    sms: async () => {
      const m = patientRef.current.messages.find((x) => x.purpose === 'intro')
      log("SMS adapter (Africa's Talking, sandbox)", `${m.status} · ${m.language.toUpperCase()} · ${m.body.length} chars · ref ${m.provider_ref}`)
    },
    ussd: async () => {
      const base = { sessionId: `FILM-${Date.now()}`, phoneNumber: patientRef.current.phone }
      const menu = await api.ussd({ ...base, text: '' })
      const confirm = await api.ussd({ ...base, text: '1' })
      setData((d) => ({ ...d, ussd: { menu: menu.slice(4), confirm: confirm.slice(4) } }))
      log('POST /api/ussd  text=""', menu.split('\n')[0])
      log('POST /api/ussd  text="1"', `${confirm.slice(0, 70)}…`)
      setPatient(await api.patient(patientRef.current.id))
    },
    chp: async () => {
      const p = await api.logVisit(patientRef.current.id, 'Planned the trip to Maralal; her sister will travel with her.')
      setPatient(p)
      log(`POST /api/chp/visits/${p.id}`, `Visit by ${p.chp?.name} · status ${p.status}`)
    },
    checkin: async () => {
      const p = await api.checkIn(patientRef.current.id)
      setPatient(p)
      const v = p.vouchers[0]
      log(`POST /api/patients/${p.id}/check-in`, `M-Pesa B2C (${v.mode}) ${v.transaction_id} · ${kes(v.amount_kes)}`)
    },
    treat: async () => {
      const p = await api.treat(patientRef.current.id)
      setPatient(p)
      log(`POST /api/patients/${p.id}/treat`, `status ${p.status} · next check ${p.appointment_on}`)
    },
  }

  const useFallback = () => {
    setOffline(true)
    patientRef.current = FALLBACK.patient
    setData(FALLBACK)
  }

  // Run every backend step up to scene `upTo`, in order, once per playthrough.
  const ensureSteps = useCallback((upTo) => {
    const gen = generation.current
    chain.current = chain.current.then(async () => {
      for (let i = done.current + 1; i <= upTo; i += 1) {
        if (gen !== generation.current) return
        const step = SCENES[i].step
        if (step && !patientRef.current?.id && step !== 'register') { done.current = i; continue } // offline
        try {
          if (step) await STEPS[step]()
        } catch {
          useFallback()
          log('API unreachable', 'Playing with built-in demo data')
        }
        done.current = i
      }
    })
    if (renderMode) window.__filmChain = () => chain.current // lets the exporter wait for API steps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = useCallback(async () => {
    generation.current += 1
    run.current += 1
    stopSpeaking()
    done.current = -1
    patientRef.current = null
    setOffline(false)
    setData({ patient: null, ussd: null })
    setIndex(0)
    setLine(0)
    setStarted(true)
    setPlaying(true)
    setPlayId((n) => n + 1)
    if (renderMode) return // the exporter mixes its own soundtrack
    music.current = music.current || await getMusic()
    music.current.setMuted(!musicOn)
    music.current.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicOn])

  useEffect(() => { if (autoplay) start() }, [autoplay, start])
  useEffect(() => { if (started) ensureSteps(index) }, [started, index, ensureSteps])

  // Narrate the current scene, then move on. Re-runs on play/seek/language change.
  useEffect(() => {
    if (!started || !playing) return undefined
    const token = ++run.current
    const text = scene.voice[lang]
    const advance = () => {
      if (token !== run.current) return
      setTimeout(() => {
        if (token !== run.current) return
        if (index < SCENES.length - 1) setIndex(index + 1)
        else { setPlaying(false); music.current?.stop() }
      }, GAP_AFTER_VOICE)
    }
    setLine(0)
    if (timeline) {
      // Video export: absolute times (ms) measured from the narration clips, read against the
      // exporter's clock so scene changes never drift.
      const tl = timeline.scenes[index]
      const now = window.__clockNow ? window.__clockNow() : 0
      const timers = tl.lines.map((ms, i) => setTimeout(() => setLine(i), Math.max(0, ms - now)))
      timers.push(setTimeout(() => {
        if (index < SCENES.length - 1) setIndex(index + 1)
        else window.__FILM_DONE__ = true
      }, Math.max(0, tl.end - now)))
      return () => timers.forEach(clearTimeout)
    }
    if (voiceOn && canSpeak()) {
      pickVoice(lang).then((voice) => {
        if (token !== run.current) return
        music.current?.duck(true)
        speak(text, voice, { onSentence: (i) => token === run.current && setLine(i) }).then(() => {
          if (token !== run.current) return
          music.current?.duck(false)
          advance()
        })
      })
    } else {
      // Silent mode: time subtitles by word count.
      const parts = sentences(text)
      let elapsed = 0
      const timers = parts.map((p, i) => { const at = elapsed; elapsed += p.split(' ').length * msPerWord; return setTimeout(() => token === run.current && setLine(i), at) })
      timers.push(setTimeout(advance, elapsed))
      return () => { timers.forEach(clearTimeout) }
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, playing, index, lang, voiceOn, playId])

  // Stop everything when leaving the page.
  useEffect(() => () => { run.current += 1; stopSpeaking(); music.current?.stop() }, [])

  const togglePlay = () => {
    if (!started) return start()
    if (playing) { run.current += 1; stopSpeaking(); music.current?.pause(); setPlaying(false) } else { music.current?.resume(); setPlaying(true) }
    return undefined
  }
  const seek = (i) => { if (!started) return; run.current += 1; stopSpeaking(); setIndex(Math.max(0, Math.min(SCENES.length - 1, i))) }
  const toggleMusic = () => { setMusicOn((m) => { music.current?.setMuted(m); return !m }) }
  const toggleVoice = () => { run.current += 1; stopSpeaking(); music.current?.duck(false); setVoiceOn((v) => !v) }

  // Keyboard: space = play/pause, arrows = scene, f = fullscreen (only when the film is in view).
  useEffect(() => {
    const onKey = (e) => {
      if (!started || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return
      const r = stageRef.current?.getBoundingClientRect()
      if (!r || r.bottom < 0 || r.top > window.innerHeight) return
      if (e.key === ' ') { e.preventDefault(); togglePlay() }
      if (e.key === 'ArrowRight') seek(index + 1)
      if (e.key === 'ArrowLeft') seek(index - 1)
      if (e.key === 'f') stageRef.current?.requestFullscreen?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const overlay = started && <Overlay key={scene.id} scene={scene} data={data} lang={lang} playing={playing} />
  const isEnd = scene.id === 'end'

  return (
    <div>
      <div ref={stageRef} className={`${renderMode ? 'fixed inset-0' : 'relative aspect-video w-full rounded-[24px] shadow-float'} overflow-hidden bg-[#0b1f22] ${playing || renderMode ? '' : 'film-paused'}`}>
        {/* Photo layer */}
        {SCENES.map((s, i) => (
          <div key={s.id} className={`absolute inset-0 transition-opacity duration-[1400ms] ${(started ? i === index : i === 0) ? 'opacity-100' : 'opacity-0'}`} aria-hidden={i !== index}>
            {s.layout === 'portrait' || s.layout === 'phone' ? (
              <>
                <img src={s.img} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl brightness-75" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/30" />
                <img key={`${s.id}-${started && i === index}`} src={s.img} alt="Amina, a mother from Samburu County"
                  className={`kenburns absolute left-[8%] top-[8%] h-[84%] w-auto max-w-[45%] object-cover shadow-2xl ${s.layout === 'phone' ? 'brightness-90' : ''}`}
                  style={{ '--kb-from': 1, '--kb-to': 1.05, '--kb-dur': '16s' }} />
              </>
            ) : s.shots ? (
              <Shots shots={s.shots} active={started && i === index} />
            ) : (
              <img key={`${s.id}-${started && i === index}`} src={s.img} alt="" className="kenburns absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: s.pos, '--kb-from': s.kb?.from, '--kb-to': s.kb?.to, '--kb-x0': s.kb?.x0, '--kb-y0': s.kb?.y0, '--kb-x1': s.kb?.x1, '--kb-y1': s.kb?.y1, '--kb-dur': '16s' }} />
            )}
          </div>
        ))}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />

        {started && <span className="absolute right-6 top-5 hidden text-xs font-bold uppercase tracking-[0.25em] text-white/80 sm:block">Fuatilia</span>}
        {overlay && !isEnd && (scene.layout === 'phone'
          ? <div className="absolute right-[14%] top-1/2 hidden -translate-y-1/2 scale-[.62] sm:block lg:scale-[.88] 2xl:scale-100">{overlay}</div>
          : <div className={`absolute top-12 hidden scale-[.72] lg:block 2xl:scale-90 ${scene.overlayLeft ? 'left-5 origin-top-left' : 'right-5 origin-top-right'}`}>{overlay}</div>)}

        {/* Closing card */}
        {started && isEnd && (
          <div className="absolute inset-0 grid place-items-center bg-deep/60 p-6 text-center">
            <div className="fade-up max-w-3xl">
              <p className="text-base font-medium text-white/85 sm:text-2xl">“{lines[0]}</p>
              <p className="mt-2 text-2xl font-bold text-white sm:text-5xl">{lines[1]}”</p>
              <p className="mt-4 text-sm text-white/85 sm:text-lg">{lines[2]}</p>
              {!renderMode && <div className="mt-6 flex flex-wrap justify-center gap-2">
                {data.patient?.id && <Link to={`/patients/${data.patient.id}`} className="btn-coral">{lang === 'sw' ? 'Fungua wasifu wa Amina' : "Open Amina's record"}</Link>}
                <button className="btn-light" onClick={start}><RotateCcw size={16} />{lang === 'sw' ? 'Tazama tena' : 'Replay'}</button>
              </div>}
            </div>
          </div>
        )}

        {/* Subtitles (lower third) */}
        {started && subsOn && !isEnd && (
          <div className="absolute inset-x-4 bottom-4 hidden sm:block sm:inset-x-8 sm:bottom-7">
            <p key={`${index}-${line}-${lang}`} className="fade-up mx-auto max-w-3xl border-l-4 border-coral bg-black/55 px-4 py-2.5 text-base font-medium leading-snug text-white backdrop-blur 2xl:text-xl">
              {lines[line]}
            </p>
          </div>
        )}

        {/* Poster */}
        {!started && (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/70 via-black/30 to-black/20 p-6 text-center">
            <div>
              <button onClick={start} className="pulse-ring mx-auto grid h-20 w-20 place-items-center rounded-full bg-coral text-white shadow-2xl transition hover:scale-105" aria-label="Play film">
                <Play size={34} className="ml-1" />
              </button>
              <p className="mt-5 text-2xl font-bold text-white sm:text-4xl">{lang === 'sw' ? 'Safari ya Amina' : "Amina's journey"}</p>
              <p className="mt-2 text-sm text-white/85">{lang === 'sw' ? 'Dakika 2 · sauti, muziki na mfumo halisi' : '2 minutes · narrated · runs the real system live'}</p>
            </div>
          </div>
        )}
      </div>

      {renderMode ? null : <>
      {/* On phones, subtitles and screens sit below the picture so it stays visible. */}
      {started && subsOn && !isEnd && <p key={`m${index}-${line}-${lang}`} className="fade-up mt-3 border-l-4 border-coral bg-white px-3 py-2 text-sm text-deep sm:hidden">{lines[line]}</p>}
      {overlay && !isEnd && <div className={`mt-4 flex justify-center ${scene.layout === 'phone' ? 'sm:hidden' : 'lg:hidden'}`}>{overlay}</div>}

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className="btn-primary h-11 w-11 p-0" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
        <button className="btn-ghost h-11 w-11 p-0" disabled={!started || index === 0} onClick={() => seek(index - 1)} aria-label="Previous scene"><ChevronLeft size={18} /></button>
        <button className="btn-ghost h-11 w-11 p-0" disabled={!started || index === SCENES.length - 1} onClick={() => seek(index + 1)} aria-label="Next scene"><ChevronRight size={18} /></button>
        <div className="flex min-w-[160px] flex-1 gap-1 px-1" aria-label="Scenes">
          {SCENES.map((s, i) => (
            <button key={s.id} onClick={() => seek(i)} className={`h-1.5 flex-1 rounded-full transition ${i < index || (started && i === index) ? 'bg-coral' : 'bg-line'} ${started && i === index ? 'opacity-100' : i < index ? 'opacity-60' : ''}`} aria-label={`Scene ${i + 1}`} />
          ))}
        </div>
        <button className={`btn-ghost h-11 w-11 p-0 ${musicOn ? '' : 'text-ink-faint'}`} onClick={toggleMusic} aria-pressed={musicOn} aria-label="Music" title="Music">{musicOn ? <Music2 size={18} /> : <VolumeX size={18} />}</button>
        <button className={`btn-ghost h-11 w-11 p-0 ${voiceOn ? '' : 'text-ink-faint'}`} onClick={toggleVoice} aria-pressed={voiceOn} aria-label="Narration" title="Narration">{voiceOn ? <Mic size={18} /> : <MicOff size={18} />}</button>
        <button className={`btn-ghost h-11 w-11 p-0 ${subsOn ? '' : 'text-ink-faint'}`} onClick={() => setSubsOn((v) => !v)} aria-pressed={subsOn} aria-label="Subtitles" title="Subtitles"><MessageSquareText size={18} /></button>
        <button className="btn-ghost h-11 w-11 p-0" onClick={() => stageRef.current?.requestFullscreen?.()} aria-label="Fullscreen" title="Fullscreen"><Expand size={18} /></button>
      </div>
      {offline && <p className="mt-2 text-xs text-ink-faint">{lang === 'sw' ? 'API haipatikani: data ya mfano' : 'API offline: playing with built-in demo data'}</p>}
      </>}
    </div>
  )
}
