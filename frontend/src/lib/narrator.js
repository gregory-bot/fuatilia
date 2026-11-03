/*
 * Film narration with the browser's built-in speech engine.
 * Prefers Kenyan voices: Microsoft Edge ships "Asilia"/"Chilemba" (English, Kenya) and
 * "Zuri"/"Rafiki" (Kiswahili, Kenya). Other browsers fall back to the closest African or
 * English voice available.
 */

const PREFS = {
  en: ['en-KE', 'en-TZ', 'en-NG', 'en-ZA', 'en-GB', 'en-US', 'en'],
  sw: ['sw-KE', 'sw-TZ', 'sw'],
}
const FEMALE_HINTS = /asilia|zuri|female|woman|samantha|serena|karen|moira|tessa|libby|sonia|ezinne|leah/i

let voicesReady = null
function loadVoices() {
  if (!('speechSynthesis' in window)) return Promise.resolve([])
  if (voicesReady) return voicesReady
  voicesReady = new Promise((resolve) => {
    const have = window.speechSynthesis.getVoices()
    if (have.length) return resolve(have)
    const done = () => resolve(window.speechSynthesis.getVoices())
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true })
    setTimeout(done, 1500)
  })
  return voicesReady
}

/** Best available voice for 'en' | 'sw'; Swahili falls back to an English (Kenya) voice. */
export async function pickVoice(lang) {
  const voices = await loadVoices()
  const order = lang === 'sw' ? [...PREFS.sw, ...PREFS.en] : PREFS.en
  for (const tag of order) {
    const matches = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(tag.toLowerCase()))
    if (matches.length) {
      // Prefer natural/neural female voices for a warm, consistent narrator.
      return matches.find((v) => /natural|neural|online/i.test(v.name) && FEMALE_HINTS.test(v.name))
        || matches.find((v) => FEMALE_HINTS.test(v.name))
        || matches.find((v) => /natural|neural|online/i.test(v.name))
        || matches[0]
    }
  }
  return null
}

export const canSpeak = () => 'speechSynthesis' in window

/** Splits narration into sentences (shared with the subtitle track). */
export const sentences = (text) => (text.match(/[^.!?]+[.!?]*/g) || [text]).map((s) => s.trim())

/**
 * Speak `text`. Resolves when finished (or cancelled). Long text is split into sentences
 * because some engines stop silently after ~15 seconds of continuous speech.
 */
export function speak(text, voice, { onStart, onSentence } = {}) {
  if (!canSpeak()) return Promise.resolve()
  const synth = window.speechSynthesis
  synth.cancel()
  const parts = sentences(text)
  return new Promise((resolve) => {
    let i = 0
    const next = () => {
      if (i >= parts.length) return resolve()
      const u = new SpeechSynthesisUtterance(parts[i])
      if (voice) { u.voice = voice; u.lang = voice.lang }
      u.rate = 0.94
      u.pitch = 1
      const idx = i
      // Safety net: some engines occasionally never fire onend.
      const guard = setTimeout(() => { u.onend = null; i += 1; next() }, 2500 + parts[i].split(' ').length * 650)
      u.onstart = () => { if (idx === 0) onStart?.(); onSentence?.(idx) }
      u.onend = () => { clearTimeout(guard); i += 1; next() }
      u.onerror = () => { clearTimeout(guard); resolve() }
      synth.speak(u)
    }
    next()
  })
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel()
}
