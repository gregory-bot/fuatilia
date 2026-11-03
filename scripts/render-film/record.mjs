/*
 * Step 2: record the film frame by frame and render the music bed.
 *
 * Loads /film-render with a fake clock: timers and CSS animations only move when we say so,
 * so every frame is captured exactly 1/FPS apart (no dropped frames, no stutter), however
 * long each screenshot takes. Viewport 1280x720 at 1.5x scale = 1920x1080 frames.
 *
 *   node record.mjs <work_dir> <lang> [base_url]
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'

const [work, lang = 'en', base = 'http://localhost:5173'] = process.argv.slice(2)
const FPS = 30
const DT = 1000 / FPS
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const timeline = JSON.parse(fs.readFileSync(path.join(work, `timeline_${lang}.json`), 'utf8'))
const framesDir = path.join(work, `frames_${lang}`)
fs.rmSync(framesDir, { recursive: true, force: true })
fs.mkdirSync(framesDir, { recursive: true })

// Injected before the app loads: a controllable clock for timers and animations.
const clock = `(() => {
  let now = 0, id = 1
  const timers = new Map()
  window.__clockNow = () => now
  window.setTimeout = (fn, ms = 0, ...a) => { const i = id++; timers.set(i, { t: now + Math.max(0, +ms || 0), fn, a }); return i }
  window.setInterval = (fn, ms = 0, ...a) => { const i = id++; timers.set(i, { t: now + Math.max(1, +ms || 0), fn, a, every: Math.max(1, +ms || 0) }); return i }
  window.clearTimeout = window.clearInterval = (i) => timers.delete(i)
  window.__tick = (dt) => {
    const target = now + dt
    for (;;) {
      let next = null
      for (const e of timers) if (e[1].t <= target && (!next || e[1].t < next[1].t)) next = e
      if (!next) break
      const [i, t] = next
      now = t.t
      if (t.every) t.t += t.every; else timers.delete(i)
      try { if (typeof t.fn === 'function') t.fn(...t.a) } catch (e) { console.error(e) }
    }
    now = target
  }
  // New animations start at 0; existing ones move forward by dt.
  window.__advanceAnimations = (dt) => {
    for (const a of document.getAnimations()) {
      if (!a.__seen) { a.__seen = true; a.pause(); a.currentTime = 0 } else { a.pause(); a.currentTime = (a.currentTime || 0) + dt }
    }
  }
  window.__FILM_TIMELINE__ = ${JSON.stringify(timeline)}
})()`

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 })
const page = await context.newPage()
page.on('pageerror', (e) => console.error('page error:', e.message))

// --- Music bed (rendered offline in the page, same synth as the website) ---
await page.goto(`${base}/film-render?lang=${lang}`)
const seconds = timeline.total_ms / 1000
const size = await page.evaluate(async (sec) => {
  const m = await import('/src/lib/music.js')
  window.__wav = await m.renderSynthMusic(sec)
  return window.__wav.length
}, seconds)
const chunks = []
for (let off = 0; off < size; off += 1 << 20) {
  const b64 = await page.evaluate(({ off, n }) => {
    const u = window.__wav.subarray(off, off + n)
    let s = ''
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000))
    return btoa(s)
  }, { off, n: 1 << 20 })
  chunks.push(Buffer.from(b64, 'base64'))
}
fs.writeFileSync(path.join(work, `music_${lang}.wav`), Buffer.concat(chunks))
console.log(`music: ${seconds.toFixed(1)}s`)

// --- Frames ---
await context.addInitScript(clock)
await page.goto(`${base}/film-render?lang=${lang}&go=1`)
await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 30000 })
await page.evaluate(() => document.fonts.ready)

const total = Math.min(Math.ceil((timeline.total_ms / 1000) * FPS), +process.env.MAX_FRAMES || Infinity) // MAX_FRAMES: quick test runs
const settle = () => page.evaluate(() => Promise.resolve(window.__filmChain && window.__filmChain())
  .then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))))
const t0 = Date.now()
for (let f = 0; f < total; f += 1) {
  if (f > 0) await page.evaluate((dt) => window.__tick(dt), DT)
  await settle()
  await page.evaluate((dt) => window.__advanceAnimations(dt), f === 0 ? 0 : DT)
  await page.screenshot({ path: path.join(framesDir, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 })
  if (f % 150 === 0) console.log(`frame ${f}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}
await browser.close()
console.log(`frames: ${total} at ${FPS} fps`)
