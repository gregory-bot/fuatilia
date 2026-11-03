import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, Menu, PlayCircle, ShieldCheck, X } from 'lucide-react'
import { useI18n } from '../lib/i18n.jsx'
import { isDemoMode } from '../lib/api.js'

// Platform tools live under one "Platform" menu so the bar stays calm.
const PLATFORM = [
  { to: '/register', key: 'nav_register', desc: 'nav_register_desc' },
  { to: '/chp', key: 'nav_worklist', desc: 'nav_worklist_desc' },
  { to: '/ussd', key: 'nav_ussd', desc: 'nav_ussd_desc' },
  { to: '/pathology', key: 'nav_pathology', desc: 'nav_pathology_desc' },
]
const PRIMARY = [
  { to: '/', key: 'nav_home', end: true },
  { to: '/dashboard', key: 'nav_dashboard' },
  { to: '/impact', key: 'nav_impact' },
  { to: '/journey', key: 'nav_journey' },
]

export function Logo({ light = false }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Fuatilia home">
      <svg viewBox="0 0 32 32" className="h-9 w-9 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="9" fill={light ? '#F7F4EE' : '#0F3A40'} />
        <path d="M7 19c3 0 4-8 9-8s4 12 9 12" stroke="#E0684B" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
      <span className="leading-none">
        <span className={`block text-lg font-bold tracking-tight ${light ? 'text-white' : 'text-deep'}`}>Fuatilia</span>
        <span className={`block text-[10px] font-semibold uppercase tracking-[0.2em] ${light ? 'text-white/60' : 'text-ink-faint'}`}>Care, connected</span>
      </span>
    </Link>
  )
}

function LangToggle({ className = '', onHero = false }) {
  const { lang, setLang } = useI18n()
  return (
    <div className={`inline-flex rounded-full p-0.5 text-xs font-semibold ${onHero ? 'border border-white/40' : 'border border-line bg-ivory'} ${className}`} role="group" aria-label="Language">
      {['en', 'sw'].map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
          className={`rounded-full px-3 py-1.5 transition ${lang === l ? (onHero ? 'bg-white text-deep' : 'bg-deep text-white') : (onHero ? 'text-white/85' : 'text-ink-muted hover:text-deep')}`}>
          {l === 'en' ? 'EN' : 'SW'}
        </button>
      ))}
    </div>
  )
}

const linkClass = (onHero) => ({ isActive }) =>
  `px-3 py-2 text-sm font-semibold transition ${onHero
    ? (isActive ? 'text-white underline decoration-coral decoration-2 underline-offset-8' : 'text-white/85 hover:text-white')
    : (isActive ? 'text-deep underline decoration-coral decoration-2 underline-offset-8' : 'text-ink-muted hover:text-deep')}`

function PlatformMenu({ onHero }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const location = useLocation()
  const active = PLATFORM.some((p) => location.pathname.startsWith(p.to))
  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className={`inline-flex items-center gap-1 px-3 py-2 text-sm font-semibold transition ${onHero ? 'text-white/85 hover:text-white' : active ? 'text-deep' : 'text-ink-muted hover:text-deep'}`}>
        {t('nav_platform')} <ChevronDown size={15} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="pop absolute left-1/2 top-full z-50 mt-3 w-80 -translate-x-1/2 rounded-[20px] border border-line bg-white p-2 shadow-float">
          {PLATFORM.map((p) => (
            <Link key={p.to} to={p.to} className="block rounded-[14px] px-4 py-3 hover:bg-mint">
              <span className="block text-sm font-semibold text-deep">{t(p.key)}</span>
              <span className="block text-xs text-ink-muted">{t(p.desc)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Plain top navigation. On the home page it sits transparently over the hero (white text);
 * once you scroll, or on any other page, it becomes a solid white bar.
 */
function Navbar() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const isHome = location.pathname === '/'
  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const onHero = isHome && !scrolled && !open

  return (
    <header className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${onHero ? 'bg-gradient-to-b from-black/45 to-transparent' : 'border-b border-line bg-white/95 backdrop-blur'}`}>
      <nav className="container-page flex h-[72px] items-center justify-between gap-3" aria-label="Main">
        <Logo light={onHero} />
        <div className="hidden items-center gap-1 lg:flex">
          {PRIMARY.slice(0, 2).map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={linkClass(onHero)}>{t(n.key)}</NavLink>)}
          <PlatformMenu onHero={onHero} />
          {PRIMARY.slice(2).map((n) => <NavLink key={n.to} to={n.to} className={linkClass(onHero)}>{t(n.key)}</NavLink>)}
        </div>
        <div className="flex items-center gap-2">
          <LangToggle onHero={onHero} className="hidden sm:inline-flex" />
          <Link to="/journey?autoplay=1" className="btn-coral hidden sm:inline-flex"><PlayCircle size={16} />{t('demo_mode')}</Link>
          <button onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}
            className={`grid h-11 w-11 place-items-center rounded-full lg:hidden ${onHero ? 'bg-white/15 text-white' : 'bg-coral-50 text-coral-700'}`}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-line bg-white lg:hidden">
          <div className="container-page grid gap-1 py-3">
            {[...PRIMARY, ...PLATFORM].map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => `px-2 py-3 text-base font-medium ${isActive ? 'text-deep' : 'text-ink'}`}>
                {t(n.key)}
              </NavLink>
            ))}
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-4">
              <LangToggle />
              <Link to="/journey?autoplay=1" className="btn-coral"><PlayCircle size={16} />{t('demo_mode')}</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

function Footer() {
  const { t } = useI18n()
  const cols = [
    { title: t('footer_platform'), links: [['/dashboard', t('nav_dashboard')], ['/register', t('nav_register')], ['/chp', t('nav_worklist')], ['/ussd', t('nav_ussd')], ['/pathology', t('nav_pathology')]] },
    { title: t('footer_learn'), links: [['/#problem', t('footer_problem')], ['/#solution', t('footer_solution')], ['/journey', t('nav_journey')], ['/impact', t('nav_impact')], ['/#about', t('footer_about')]] },
  ]
  return (
    <footer className="mt-20 bg-deep text-white">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">{t('footer_mission')}</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h3 className="text-sm font-semibold text-white">{c.title}</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-white/70">
              {c.links.map(([to, label]) => <li key={to}><Link to={to} className="hover:text-white">{label}</Link></li>)}
            </ul>
          </div>
        ))}
        <div>
          <h3 className="text-sm font-semibold text-white">{t('footer_privacy')}</h3>
          <p className="mt-4 flex gap-2 text-sm leading-relaxed text-white/70"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-coral" />{t('privacy_long')}</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Fuatilia · {t('footer_rights')}</p>
          <p>{isDemoMode ? `${t('footer_demo')} · ` : ''}{t('footer_photos')}</p>
        </div>
      </div>
    </footer>
  )
}

export default function Layout({ children }) {
  const location = useLocation()
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' })
    else window.scrollTo(0, 0)
  }, [location.pathname, location.hash])

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className={`flex-1 ${location.pathname === '/' ? '' : 'pt-[72px]'}`}>{children}</main>
      <Footer />
    </div>
  )
}

/** Standard width + padding for the platform (app) pages. */
export function AppPage({ children }) {
  return <div className="container-page pb-6 pt-8 sm:pt-10">{children}</div>
}
