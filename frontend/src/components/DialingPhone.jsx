import { useEffect, useState } from 'react'
import { Delete, Phone, PhoneOff, Send } from 'lucide-react'
import FeaturePhone, { Fingertip, Keypad } from './FeaturePhone.jsx'

const CODE = '*384*12#'
const DEFAULT_MENU = 'Fuatilia: Habari Amina\n1. Thibitisha miadi (13 Novemba)\n2. Badilisha tarehe\n3. Tafuta kituo cha matibabu\n4. Nipigie (mhudumu wa afya)\n5. English'
const DEFAULT_CONFIRM = 'Asante Amina. Miadi yako ya 13 Novemba Maralal Hospital imethibitishwa. Nauli ya M-Pesa itatumwa ukifika.'

/**
 * Builds the timeline: type *384*12#, press call, show the menu, press 1, send, confirmation.
 * Each step is { at: ms, pressed, screen }.
 */
function buildScript(menu, confirm) {
  const steps = []
  let t = 500
  let typed = ''
  for (const ch of CODE) {
    typed += ch
    const shown = typed
    steps.push({ at: t, pressed: ch, screen: { kind: 'dial', text: shown } })
    t += 380
  }
  steps.push({ at: t + 250, pressed: 'call', screen: { kind: 'dial', text: CODE } })
  steps.push({ at: t + 700, pressed: null, screen: { kind: 'msg', text: 'USSD code running…' } })
  steps.push({ at: t + 1700, pressed: null, screen: { kind: 'menu', text: menu, reply: '' } })
  steps.push({ at: t + 3900, pressed: '1', screen: { kind: 'menu', text: menu, reply: '1' } })
  steps.push({ at: t + 4700, pressed: 'send', screen: { kind: 'menu', text: menu, reply: '1' } })
  steps.push({ at: t + 5100, pressed: null, screen: { kind: 'msg', text: '…' } })
  steps.push({ at: t + 5800, pressed: null, screen: { kind: 'msg', text: confirm } })
  return { steps, length: t + 10500 }
}

/** A Safaricom feature phone that dials *384*12# by itself. Used in the film and on the home page. */
export default function DialingPhone({ menu = DEFAULT_MENU, confirm = DEFAULT_CONFIRM, loop = false, playing = true, className = '' }) {
  const [step, setStep] = useState(-1)
  const [cycle, setCycle] = useState(0)
  const { steps, length } = buildScript(menu, confirm)

  useEffect(() => {
    if (!playing) return undefined
    setStep(-1)
    const timers = steps.map((s, i) => setTimeout(() => setStep(i), s.at))
    if (loop) timers.push(setTimeout(() => setCycle((c) => c + 1), length))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, cycle, menu, confirm])

  const s = steps[step]
  // A key is shown pressed for ~260 ms after its step starts.
  const [pressed, setPressed] = useState(null)
  useEffect(() => {
    if (!s?.pressed) return undefined
    setPressed(s.pressed)
    const id = setTimeout(() => setPressed(null), 260)
    return () => clearTimeout(id)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const sc = s?.screen
  const screen = !sc
    ? <div className="flex h-full items-end justify-end"><span className="caret text-xl font-bold" /></div>
    : sc.kind === 'dial'
      ? <div className="flex h-full flex-col justify-end text-right"><span className="text-[11px]">Safaricom</span><span className="caret text-xl font-bold">{sc.text}</span></div>
      : sc.kind === 'menu'
        ? <>{sc.text}<div className="mt-1 border-t border-[#14301E]/30 pt-1"><span className="caret">{sc.reply}</span></div></>
        : sc.text

  const Btn = ({ id, className: c, children, label }) => (
    <span aria-label={label} className={`relative grid place-items-center rounded-lg py-2 text-white transition duration-150 ${c} ${pressed === id ? 'translate-y-px scale-95 brightness-110' : ''}`}>
      {children}{pressed === id && <Fingertip />}
    </span>
  )

  return (
    <FeaturePhone className={className} screen={screen} title={sc && sc.kind !== 'dial' ? '*384*12#' : 'Safaricom'}
      footer={(
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {sc?.kind === 'menu'
            ? <Btn id="send" label="Send" className="bg-[#2E9E44]"><Send size={16} /></Btn>
            : <Btn id="call" label="Call" className="bg-[#2E9E44]"><Phone size={16} /></Btn>}
          <Btn id="del" label="Delete" className="bg-[#3A4547]"><Delete size={16} /></Btn>
          <Btn id="end" label="End" className="bg-coral"><PhoneOff size={16} /></Btn>
        </div>
      )}
      keypad={<Keypad pressed={pressed} disabled={false} />} />
  )
}
