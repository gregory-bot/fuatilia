import { BadgeCheck, CalendarCheck, Footprints, HeartPulse, MapPin, MessageSquare, Microscope, Phone, ShieldAlert, UserRoundCheck, Wallet } from 'lucide-react'
import { fmtDateTime } from '../lib/format.js'
import { useI18n } from '../lib/i18n.jsx'

const ICONS = {
  screened: Microscope, risk: HeartPulse, chp: UserRoundCheck, sms: MessageSquare, ussd: Phone,
  status: CalendarCheck, chp_visit: Footprints, checked_in: MapPin, voucher: Wallet, treated: BadgeCheck,
  rescreen: CalendarCheck, lost: ShieldAlert,
}

export default function Timeline({ events }) {
  const { lang } = useI18n()
  return (
    <ol className="relative space-y-4 border-l-2 border-mint pl-6">
      {events.map((e) => {
        const Icon = ICONS[e.kind] || CalendarCheck
        const tone = e.kind === 'lost' || e.kind === 'risk' ? 'bg-coral text-white' : e.kind === 'treated' ? 'bg-deep text-white' : 'bg-mint text-teal'
        return (
          <li key={e.id} className="fade-up relative">
            <span className={`absolute -left-[37px] grid h-7 w-7 place-items-center rounded-full ring-4 ring-white ${tone}`}><Icon size={14} /></span>
            <p className="text-sm font-semibold text-deep">{e.title}</p>
            {e.detail && <p className="mt-0.5 text-sm text-ink-muted">{e.detail}</p>}
            <time className="mt-0.5 block text-xs text-ink-faint">{fmtDateTime(e.created_at, lang)}</time>
          </li>
        )
      })}
    </ol>
  )
}
