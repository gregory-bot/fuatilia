// A simple Nokia-style feature phone drawn with CSS. Used by the USSD simulator and the demo film.
export default function FeaturePhone({ screen, title = 'Safaricom', footer, keypad, className = '', buzz = false }) {
  return (
    <div className={`relative mx-auto w-[220px] select-none ${buzz ? 'buzz' : ''} ${className}`}>
      <div className="rounded-[34px] bg-gradient-to-b from-[#2B3436] to-[#141A1B] p-3 pb-4 shadow-2xl ring-1 ring-black/40">
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-black/60" aria-hidden />
        <div className="lcd h-[210px] overflow-hidden rounded-lg border-4 border-[#0D1112] p-2 text-[12.5px] leading-snug">
          <div className="mb-1 flex items-center justify-between border-b border-[#14301E]/30 pb-0.5 text-[10px] font-bold">
            <span>▂▄▆ {title}</span><span>▮▮▮▯</span>
          </div>
          <div className="h-[165px] overflow-y-auto whitespace-pre-wrap break-words">{screen}</div>
        </div>
        {footer}
        {keypad}
      </div>
    </div>
  )
}

export const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']

export function Keypad({ onKey, disabled }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-1.5">
      {KEYS.map((k) => (
        <button key={k} type="button" disabled={disabled} onClick={() => onKey(k)}
          className="rounded-lg bg-[#3A4547] py-1.5 text-sm font-semibold text-white shadow-inner hover:bg-[#4A5759] active:translate-y-px disabled:opacity-40">
          {k}
        </button>
      ))}
    </div>
  )
}
