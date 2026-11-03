/*
 * Background music for the film.
 *
 * If /media/music.mp3 exists (drop in any royalty-free track you have rights to), it is
 * looped. Otherwise a soft, uplifting "corporate" bed is synthesised live with the Web
 * Audio API (I–V–vi–IV progression, warm pad, plucked arpeggio with delay, light pulse),
 * so the demo always has licence-free music.
 *
 * Both variants share one interface: start(), pause(), resume(), stop(), duck(on), setMuted(m).
 */

const FILE_URL = '/media/music.mp3'
const BPM = 96
const BEAT = 60 / BPM
const LEVEL = 0.32 // master level
const DUCKED = 0.11 // level while the narrator speaks

// Chord roots (MIDI) with triad intervals: C – G – Am – F
const PROGRESSION = [
  { root: 48, notes: [0, 4, 7] },
  { root: 43, notes: [0, 4, 7] },
  { root: 45, notes: [0, 3, 7] },
  { root: 41, notes: [0, 4, 7] },
]
const ARP = [0, 7, 12, 16, 12, 7, 19, 12] // pattern over the chord, eighth notes

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12)

class SynthMusic {
  constructor() {
    this.ctx = null
    this.timer = null
    this.nextTime = 0
    this.step = 0 // eighth-note counter
  }

  _setup(ctx = new (window.AudioContext || window.webkitAudioContext)()) {
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0
    // Gentle glue: compressor + lowpass so nothing is harsh on laptop speakers.
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 3
    this.master.connect(comp).connect(ctx.destination)
    // Feedback delay for the plucks (dotted-eighth "shimmer").
    this.delay = ctx.createDelay(1)
    this.delay.delayTime.value = BEAT * 0.75
    const fb = ctx.createGain()
    fb.gain.value = 0.32
    const wet = ctx.createGain()
    wet.gain.value = 0.35
    this.delay.connect(fb).connect(this.delay)
    this.delay.connect(wet).connect(this.master)
    // Noise buffer for the shaker.
    const len = ctx.sampleRate * 0.2
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1
  }

  _env(gainNode, t, attack, peak, release) {
    const g = gainNode.gain
    g.setValueAtTime(0.0001, t)
    g.exponentialRampToValueAtTime(peak, t + attack)
    g.exponentialRampToValueAtTime(0.0001, t + attack + release)
  }

  _pad(t, chord) {
    const { ctx } = this
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900
    const gain = ctx.createGain()
    filter.connect(gain).connect(this.master)
    const dur = BEAT * 4
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.linearRampToValueAtTime(0.05, t + 0.9)
    gain.gain.setValueAtTime(0.05, t + dur - 0.4)
    gain.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6)
    chord.notes.forEach((n) => {
      ;[-6, 6].forEach((detune) => {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = hz(chord.root + 12 + n)
        o.detune.value = detune
        o.connect(filter)
        o.start(t)
        o.stop(t + dur + 0.7)
      })
    })
  }

  _pluck(t, midi, level = 0.09) {
    const { ctx } = this
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = hz(midi)
    const g = ctx.createGain()
    this._env(g, t, 0.005, level, 0.45)
    o.connect(g)
    g.connect(this.master)
    g.connect(this.delay)
    o.start(t)
    o.stop(t + 0.6)
  }

  _bass(t, midi) {
    const { ctx } = this
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = hz(midi)
    const g = ctx.createGain()
    this._env(g, t, 0.02, 0.16, BEAT * 1.6)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + BEAT * 2)
  }

  _kick(t) {
    const { ctx } = this
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(120, t)
    o.frequency.exponentialRampToValueAtTime(45, t + 0.18)
    const g = ctx.createGain()
    this._env(g, t, 0.004, 0.22, 0.25)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + 0.3)
  }

  _shaker(t) {
    const { ctx } = this
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 7000
    const g = ctx.createGain()
    this._env(g, t, 0.003, 0.035, 0.06)
    src.connect(hp).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + 0.1)
  }

  _schedule(horizon = this.ctx.currentTime + 0.25) {
    while (this.nextTime < horizon) {
      const t = this.nextTime
      const bar = Math.floor(this.step / 8)
      const inBar = this.step % 8
      const chord = PROGRESSION[bar % PROGRESSION.length]
      if (inBar === 0) {
        this._pad(t, chord)
        this._bass(t, chord.root - 12)
      }
      if (inBar === 4) this._bass(t, chord.root - 12 + 7)
      // Arrangement builds: plucks from bar 2, pulse from bar 4.
      if (bar >= 1) this._pluck(t, chord.root + 24 + ARP[inBar] + (chord.notes[1] === 3 && ARP[inBar] % 12 === 4 ? -1 : 0))
      if (bar >= 3 && inBar % 2 === 0) this._kick(t)
      if (bar >= 3 && inBar % 2 === 1) this._shaker(t)
      this.step += 1
      this.nextTime += BEAT / 2
    }
  }

  start() {
    if (!this.ctx) this._setup()
    this.ctx.resume()
    this.stopNow()
    this.step = 0
    this.nextTime = this.ctx.currentTime + 0.1
    this.timer = setInterval(() => this._schedule(), 60)
    this._level(this.muted ? 0 : LEVEL, 2.5)
  }

  _level(v, secs = 0.6) {
    if (!this.ctx) return
    const g = this.master.gain
    g.cancelScheduledValues(this.ctx.currentTime)
    g.setValueAtTime(g.value, this.ctx.currentTime)
    g.linearRampToValueAtTime(v, this.ctx.currentTime + secs)
  }

  pause() { this.ctx?.suspend() }
  resume() { this.ctx?.resume() }
  duck(on) { this.ducked = on; if (!this.muted) this._level(on ? DUCKED : LEVEL) }
  setMuted(m) { this.muted = m; this._level(m ? 0 : this.ducked ? DUCKED : LEVEL, 0.3) }
  stopNow() { clearInterval(this.timer); this.timer = null }
  stop() { this._level(0, 1.5); setTimeout(() => this.stopNow(), 1600) }
}

class FileMusic {
  constructor(url) {
    this.audio = new Audio(url)
    this.audio.loop = true
    this.audio.volume = 0
  }
  _fade(to, ms = 600) {
    clearInterval(this.fader)
    const from = this.audio.volume
    const t0 = performance.now()
    this.fader = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms)
      this.audio.volume = from + (to - from) * k
      if (k === 1) clearInterval(this.fader)
    }, 30)
  }
  start() { this.audio.currentTime = 0; this.audio.play().catch(() => {}); this._fade(this.muted ? 0 : LEVEL * 1.6, 2500) }
  pause() { this.audio.pause() }
  resume() { this.audio.play().catch(() => {}) }
  duck(on) { this.ducked = on; if (!this.muted) this._fade(on ? DUCKED * 1.6 : LEVEL * 1.6) }
  setMuted(m) { this.muted = m; this._fade(m ? 0 : (this.ducked ? DUCKED : LEVEL) * 1.6, 300) }
  stop() { this._fade(0, 1500); setTimeout(() => this.audio.pause(), 1600) }
}

let instance = null

/** Returns the shared music player, preferring /media/music.mp3 when present. */
export async function getMusic() {
  if (instance) return instance
  let hasFile = false
  try {
    const res = await fetch(FILE_URL, { method: 'HEAD' })
    hasFile = res.ok && (res.headers.get('content-type') || '').startsWith('audio')
  } catch { /* offline: synthesise */ }
  instance = hasFile ? new FileMusic(FILE_URL) : new SynthMusic()
  instance.kind = hasFile ? 'file' : 'synth'
  return instance
}

/**
 * Render the synthesised bed offline (no speakers) for the video exporter.
 * Returns a 16-bit stereo WAV as a Uint8Array; fades in over 2.5 s and out over the last 4 s.
 */
export async function renderSynthMusic(seconds, sampleRate = 48000) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate)
  const m = new SynthMusic()
  m._setup(ctx)
  const g = m.master.gain
  g.setValueAtTime(0, 0)
  g.linearRampToValueAtTime(LEVEL, 2.5)
  g.setValueAtTime(LEVEL, Math.max(2.6, seconds - 4))
  g.linearRampToValueAtTime(0, seconds)
  m.step = 0
  m.nextTime = 0.1
  m._schedule(seconds)
  const buf = await ctx.startRendering()

  const frames = buf.length
  const out = new DataView(new ArrayBuffer(44 + frames * 4))
  const str = (o, t) => [...t].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); out.setUint32(4, 36 + frames * 4, true); str(8, 'WAVEfmt ')
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true)
  out.setUint32(24, sampleRate, true); out.setUint32(28, sampleRate * 4, true)
  out.setUint16(32, 4, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, frames * 4, true)
  const L = buf.getChannelData(0)
  const R = buf.getChannelData(1)
  for (let i = 0; i < frames; i += 1) {
    out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 0x7fff, true)
    out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 0x7fff, true)
  }
  return new Uint8Array(out.buffer)
}
