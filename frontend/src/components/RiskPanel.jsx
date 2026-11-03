import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { useI18n } from '../lib/i18n.jsx'
import { RiskBadge } from './ui.jsx'

const RING = { high: '#E0684B', medium: '#C9892B', low: '#1C7C7D' }

// Semicircle gauge + the model's top 3 contributing factors in plain language.
export default function RiskPanel({ risk, compact = false }) {
  const { t, lang } = useI18n()
  if (!risk) return null
  const { score, band, factors } = risk
  const angle = Math.PI * (1 - score / 100)
  const x = 60 + 48 * Math.cos(angle)
  const y = 60 - 48 * Math.sin(angle)
  return (
    <div>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 70" className={compact ? 'w-28' : 'w-36'} role="img" aria-label={`${t('risk')} ${score}/100`}>
          <path d="M12 60 A48 48 0 0 1 108 60" fill="none" stroke="#E7F1EF" strokeWidth="10" strokeLinecap="round" />
          <path d={`M12 60 A48 48 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`} fill="none" stroke={RING[band]} strokeWidth="10" strokeLinecap="round" className="transition-all duration-500" />
          <text x="60" y="56" textAnchor="middle" className="fill-deep font-display" fontSize="24" fontWeight="600">{score}</text>
          <text x="60" y="68" textAnchor="middle" className="fill-ink-faint" fontSize="8">/ 100</text>
        </svg>
        <div>
          <RiskBadge band={band} size="lg" />
          <p className="mt-2 text-sm text-ink-muted">{t(`plan_${band}`)}</p>
        </div>
      </div>
      <h3 className="mt-4 text-sm font-sans font-semibold uppercase tracking-wide text-ink-muted">{t('why')}</h3>
      <ul className="mt-2 space-y-2">
        {factors.map((f) => (
          <li key={f.feature} className="fade-up flex items-start gap-2 rounded-none bg-ivory p-3 text-sm">
            {f.direction === 'raises'
              ? <ArrowUpRight size={18} className="mt-0.5 shrink-0 text-coral" aria-label={t('raises')} />
              : <ArrowDownRight size={18} className="mt-0.5 shrink-0 text-teal" aria-label={t('lowers')} />}
            <span className="flex-1 text-deep">{f[lang] || f.en}</span>
            <span className="whitespace-nowrap text-xs text-ink-faint">{t(f.direction)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
