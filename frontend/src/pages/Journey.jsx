import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Server } from 'lucide-react'
import { useI18n } from '../lib/i18n.jsx'
import Film from '../components/film/Film.jsx'
import { RiskBadge, StatusPill } from '../components/ui.jsx'

// Demo mode: the film plus a live panel listing every backend call it makes.
export default function Journey() {
  const { lang, t } = useI18n()
  const [params] = useSearchParams()
  const [log, setLog] = useState([])
  const [patient, setPatient] = useState(null)

  return (
    <>
      <div className="mb-6">
        <p className="eyebrow">{t('demo_mode')}</p>
        <h1 className="mt-1 text-3xl sm:text-4xl">{lang === 'sw' ? 'Safari ya Amina' : "Amina's journey"}</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          {lang === 'sw'
            ? 'Filamu fupi yenye sauti inayoonyesha jinsi Fuatilia inavyomsaidia mwanamke kutoka kipimo chanya hadi matibabu. Kila tukio linaita mfumo halisi.'
            : 'A short narrated film of how Fuatilia carries one woman from a positive screen to treatment. Every scene runs the real system.'}
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Film autoplay={!!params.get('autoplay')} onLog={(l) => setLog((x) => [...x, l])} onPatient={setPatient} />
        <aside className="card h-fit p-5">
          <h2 className="flex items-center gap-2 text-lg"><Server size={18} className="text-teal" />{lang === 'sw' ? 'Mfumo halisi' : 'Live system'}</h2>
          <p className="mt-1 text-xs text-ink-muted">{lang === 'sw' ? 'Kila tukio linaita API halisi.' : 'Each scene calls the real API.'}</p>
          {patient && (
            <div className="mt-4 bg-ivory p-3">
              <p className="font-semibold text-deep">{patient.name}</p>
              <div className="mt-1 flex flex-wrap gap-1.5"><StatusPill status={patient.status} /><RiskBadge band={patient.risk_band} score={patient.risk_score} /></div>
            </div>
          )}
          <ol className="mt-4 space-y-2">
            {log.map((l, i) => (
              <li key={i} className="fade-up border border-line p-3">
                <p className="font-mono text-[11px] text-teal-600">{l.call}</p>
                <p className="mt-0.5 text-xs text-deep">{l.result}</p>
              </li>
            ))}
            {log.length === 0 && <li className="text-sm text-ink-muted">{lang === 'sw' ? 'Bonyeza Cheza ili kuanza.' : 'Press play to begin.'}</li>}
          </ol>
        </aside>
      </div>
    </>
  )
}
