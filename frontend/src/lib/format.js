export const kes = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`

export function fmtDate(value, lang = 'en', opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '—'
  const d = typeof value === 'string' && value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value)
  return d.toLocaleDateString(lang === 'sw' ? 'sw-KE' : 'en-KE', opts)
}

export function fmtDateTime(value, lang = 'en') {
  return fmtDate(value, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export const initials = (name = '') => name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

// SMS segment count (GSM-7: 160 chars single, 153 per part when concatenated).
export const smsParts = (text = '') => (text.length <= 160 ? 1 : Math.ceil(text.length / 153))
