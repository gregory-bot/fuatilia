import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'
import { useI18n } from '../lib/i18n.jsx'

const RISK_STYLES = {
  high: 'bg-coral-50 text-coral-700 ring-coral/30',
  medium: 'bg-amber-50 text-[#8A5A12] ring-amber/30',
  low: 'bg-mint text-teal-600 ring-teal/20',
}
const RISK_DOT = { high: 'bg-coral', medium: 'bg-amber', low: 'bg-teal' }

export function RiskBadge({ band = 'low', score, size = 'sm' }) {
  const { t } = useI18n()
  return (
    <span className={`chip ring-1 ${RISK_STYLES[band]} ${size === 'lg' ? 'text-sm px-3 py-1.5' : ''}`}>
      <span className={`h-2 w-2 rounded-full ${RISK_DOT[band]}`} aria-hidden />
      {t(`risk_${band}`)}{score != null && <span className="tabular-nums opacity-80">· {score}</span>}
    </span>
  )
}

const STATUS_STYLES = {
  'Screened Positive': 'bg-[#EEF0F7] text-[#3C4A7A]',
  Navigating: 'bg-mint text-teal-600',
  'Checked In': 'bg-[#E3EEF6] text-[#235A7E]',
  Treated: 'bg-deep text-white',
  'Rescreen Due': 'bg-amber-50 text-[#8A5A12]',
  'Lost to Follow-up': 'bg-coral-50 text-coral-700',
}

export function StatusPill({ status }) {
  const { t } = useI18n()
  return <span className={`chip ${STATUS_STYLES[status] || 'bg-mint text-deep'}`}>{t(status)}</span>
}

export function MetricCard({ label, value, note, icon: Icon, hero = false, tone = 'teal' }) {
  return (
    <article className={`card p-5 ${hero ? 'bg-deep text-white border-deep sm:col-span-2 lg:col-span-1' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`text-sm font-medium ${hero ? 'text-white/80' : 'text-ink-muted'}`}>{label}</span>
        {Icon && (
          <span className={`grid h-9 w-9 place-items-center rounded-none ${hero ? 'bg-white/10 text-white' : tone === 'coral' ? 'bg-coral-50 text-coral' : 'bg-mint text-teal'}`}>
            <Icon size={18} />
          </span>
        )}
      </div>
      <strong className={`mt-2 block font-display tabular-nums ${hero ? 'text-5xl' : 'text-3xl text-deep'}`}>{value}</strong>
      {note && <small className={`mt-1 block text-xs ${hero ? 'text-white/70' : 'text-ink-muted'}`}>{note}</small>}
    </article>
  )
}

export function PageHeader({ title, sub, actions }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-ink-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function Loading() {
  const { t } = useI18n()
  return <div className="flex items-center gap-2 p-8 text-ink-muted"><Loader2 className="animate-spin" size={18} />{t('loading')}</div>
}

export function ErrorBox({ error, onRetry }) {
  const { t } = useI18n()
  return (
    <div role="alert" className="card flex flex-wrap items-center gap-3 border-coral/40 bg-coral-50 p-4 text-coral-700">
      <AlertTriangle size={18} />
      <span className="flex-1 text-sm"><b>{t('error')}:</b> {error?.message || String(error)}</span>
      {onRetry && <button className="btn-ghost" onClick={onRetry}>{t('retry')}</button>}
    </div>
  )
}

export function PrivacyNote({ compact = false }) {
  const { t } = useI18n()
  return (
    <div className={`flex items-start gap-2 rounded-none bg-mint text-deep ${compact ? 'p-3 text-xs' : 'p-4 text-sm'}`}>
      <ShieldCheck size={compact ? 16 : 18} className="mt-0.5 shrink-0 text-teal" />
      <p>{compact ? t('privacy_short') : t('privacy_long')}</p>
    </div>
  )
}

export function AiLabel({ className = '' }) {
  const { t } = useI18n()
  return <span className={`chip bg-amber-50 text-[#8A5A12] ring-1 ring-amber/30 ${className}`}>⚠ {t('ai_label')}</span>
}
