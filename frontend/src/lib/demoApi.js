/*
 * Browser-only demo API, used by the static GitHub Pages build (VITE_DEMO_MODE=1).
 *
 * Mirrors the FastAPI backend (backend/app/services/*) over an in-memory copy of the
 * synthetic snapshot exported by scripts/export_demo.py: same risk model coefficients,
 * pathway rules, SMS templates, USSD menu and metrics. Nothing leaves the browser and
 * every change resets on reload. Dates are shifted so the demo always looks current.
 */

const SNAPSHOT_URL = `${import.meta.env.BASE_URL}demo/snapshot.json`
const SCREENED_POSITIVE = 'Screened Positive'
const NAVIGATING = 'Navigating'
const CHECKED_IN = 'Checked In'
const TREATED = 'Treated'
const RESCREEN_DUE = 'Rescreen Due'
const LOST = 'Lost to Follow-up'
const STATUSES = [SCREENED_POSITIVE, NAVIGATING, CHECKED_IN, TREATED, RESCREEN_DUE, LOST]
const ACTIVE = [SCREENED_POSITIVE, NAVIGATING, CHECKED_IN]
const COMPLETED = [TREATED, RESCREEN_DUE]
const AMINA_CODE = 'FT-AMINA'
const SW_MONTHS = ['Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba']
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const APPOINTMENT_DAYS = { high: 10, medium: 14, low: 21 }
const EXPLAIN_ONLY_WHEN_PRESENT = new Set(['age_under_30', 'age_over_50', 'hiv_positive', 'hiv_unknown', 'hpv_screen'])
const PATHOLOGY_NOTES = {
  urgent: 'Mock model flags dense, irregular regions for first review. AI suggestion — pathologist must confirm.',
  priority: 'Mock model flags some atypical-looking areas. AI suggestion — pathologist must confirm.',
  routine: 'Mock model sees no high-priority pattern. AI suggestion — pathologist must confirm.',
}

let db = null // { ...snapshot, nextId }
let loading = null

/* ---------------- dates ---------------- */

const DAY = 86400000
const pad = (n) => String(n).padStart(2, '0')
const toDate = (s) => new Date(`${s}T00:00:00Z`)
const dateStr = (d) => d.toISOString().slice(0, 10)
const addDays = (s, n) => dateStr(new Date(toDate(s).getTime() + n * DAY))
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY)
function today() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function nowIso() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 23)
}
const shiftDateTime = (s, n) => (s ? new Date(new Date(`${s.slice(0, 23)}Z`).getTime() + n * DAY).toISOString().slice(0, 23) : s)
const shiftDate = (s, n) => (s ? addDays(s, n) : s)

/** "13 Novemba" / "13 Nov" (matches messaging.fmt_date). */
function fmtDate(s, lang) {
  const d = toDate(s)
  return lang === 'sw' ? `${d.getUTCDate()} ${SW_MONTHS[d.getUTCMonth()]}` : `${d.getUTCDate()} ${EN_MONTHS[d.getUTCMonth()]}`
}
const fmtLong = (s) => { const d = toDate(s); return `${pad(d.getUTCDate())} ${EN_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
const fmtShort = (s) => { const d = toDate(s); return `${pad(d.getUTCDate())} ${EN_MONTHS[d.getUTCMonth()]}` }
const fmtMonthYear = (s) => { const d = toDate(s); return `${EN_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` }

/* ---------------- loading ---------------- */

async function ready() {
  if (db) return db
  if (!loading) {
    loading = fetch(SNAPSHOT_URL).then((r) => {
      if (!r.ok) throw new Error('Could not load demo data')
      return r.json()
    }).then((snap) => {
      // Shift every date so "today" in the snapshot is today in the browser.
      const n = daysBetween(snap.exported_on, today())
      for (const p of snap.patients) {
        for (const k of ['screened_on', 'appointment_on', 'checked_in_on', 'treated_on']) p[k] = shiftDate(p[k], n)
        p.chp_visited_at = shiftDateTime(p.chp_visited_at, n)
        p.events.forEach((e) => { e.created_at = shiftDateTime(e.created_at, n) })
        p.messages.forEach((m) => { m.send_at = shiftDateTime(m.send_at, n) })
        p.vouchers.forEach((v) => { v.created_at = shiftDateTime(v.created_at, n) })
      }
      snap.pathology.forEach((c) => { c.created_at = shiftDateTime(c.created_at, n) })
      const ids = snap.patients.flatMap((p) => [p.id, ...p.events.map((e) => e.id), ...p.messages.map((m) => m.id), ...p.vouchers.map((v) => v.id)])
      db = { ...snap, nextId: Math.max(...ids, 0) + 1 }
      return db
    })
  }
  return loading
}

const newId = () => db.nextId++
const clone = (x) => JSON.parse(JSON.stringify(x))
const county = (name) => {
  const c = db.counties.find((x) => x.name === name)
  if (!c) throw new Error(`Unknown county: ${name}`)
  return c
}
function findPatient(id) {
  const p = db.patients.find((x) => x.id === Number(id))
  if (!p) throw new Error('Patient not found')
  return p
}
/** Profile view: events and messages in time order, like the API. */
function detail(p) {
  const out = clone(p)
  out.events.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
  out.messages.sort((a, b) => a.send_at.localeCompare(b.send_at) || a.id - b.id)
  return out
}
const randHex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, n)
const fakeMpesaId = () => 'S' + Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 36]).join('')

/* ---------------- risk model (services/risk_model.py) ---------------- */

function featurize(p) {
  const age = Number(p.age)
  return [
    Number(p.distance_km),
    p.phone_type === 'feature' ? 1 : 0,
    Number(p.missed_visits),
    age < 30 ? 1 : 0,
    age > 50 ? 1 : 0,
    p.hiv_status === 'positive' ? 1 : 0,
    p.hiv_status === 'unknown' ? 1 : 0,
    p.screening_method === 'HPV' ? 1 : 0,
  ]
}

function phrase(feature, p, raises) {
  const d = Math.round(Number(p.distance_km))
  const n = Number(p.missed_visits)
  switch (feature) {
    case 'distance_km':
      return raises ? [`Lives ${d} km from the treatment site`, `Anaishi km ${d} kutoka kituo cha matibabu`]
        : [`Lives only ${d} km from the treatment site`, `Anaishi km ${d} tu kutoka kituo cha matibabu`]
    case 'feature_phone':
      return p.phone_type === 'feature' ? ['Uses a feature phone (SMS/USSD only)', 'Anatumia simu ya kawaida (SMS/USSD pekee)']
        : ['Has a smartphone for reminders', 'Ana simu janja ya kupokea vikumbusho']
    case 'missed_visits':
      return n > 0 ? [`Missed ${n} previous clinic ${n === 1 ? 'visit' : 'visits'}`, `Alikosa miadi ${n} ya kliniki hapo awali`]
        : ['No missed visits on record', 'Hajawahi kukosa miadi ya kliniki']
    case 'age_under_30': return ['Younger than 30', 'Ana umri chini ya miaka 30']
    case 'age_over_50': return ['Aged over 50', 'Ana umri zaidi ya miaka 50']
    case 'hiv_positive': return ['Already in HIV care, with regular clinic contact', 'Yuko kwenye huduma ya VVU, huhudhuria kliniki mara kwa mara']
    case 'hiv_unknown': return ['HIV status not known', 'Hali ya VVU haijulikani']
    case 'hpv_screen': return ['HPV-positive: needs an extra visit for triage', 'HPV chanya: anahitaji ziara ya ziada ya uchunguzi']
    default: return [feature, feature]
  }
}

function bandFor(score) {
  const b = db.model.bands
  return score >= b.high_from ? 'high' : score >= b.medium_from ? 'medium' : 'low'
}

function scoreRisk(p) {
  const m = db.model
  const x = featurize(p)
  const xs = x.map((v, i) => (v - m.mean[i]) / m.scale[i])
  const contrib = xs.map((v, i) => v * m.coef[i])
  const z = m.intercept + contrib.reduce((a, b) => a + b, 0)
  const score = Math.round(100 / (1 + Math.exp(-z)))
  const candidates = m.features.map((f, i) => [f, contrib[i], x[i]]).filter(([f, , v]) => !(EXPLAIN_ONLY_WHEN_PRESENT.has(f) && v === 0))
  const raising = candidates.filter((c) => c[1] > 0).sort((a, b) => b[1] - a[1])
  const lowering = candidates.filter((c) => c[1] <= 0).sort((a, b) => a[1] - b[1])
  const factors = [...raising, ...lowering].slice(0, 3).map(([f, w]) => {
    const [en, sw] = phrase(f, p, w > 0)
    return { feature: f, direction: w > 0 ? 'raises' : 'lowers', weight: Math.round(w * 100) / 100, en, sw }
  })
  return { score, band: bandFor(score), factors }
}

/* ---------------- messaging (services/messaging.py) ---------------- */

function shortSite(name) {
  if (name.includes(',')) return `${name.split(',').pop().trim()} Hospital`
  return name.replace('County Referral Hospital', 'Hospital').replace('Teaching & Referral Hospital', 'Hospital')
}

function render(purpose, p, on, extra = {}) {
  const lang = p.language === 'en' ? 'en' : 'sw'
  const vars = {
    first: p.name.split(' ')[0],
    screen: shortSite(p.screening_facility),
    site: shortSite(p.treatment_facility),
    date: fmtDate(on || p.appointment_on || today(), lang),
    ussd: db.ussd_code,
    chp: p.chp ? p.chp.name.split(' ')[0] : (lang === 'sw' ? 'Mhudumu wako' : 'Your health promoter'),
    ...extra,
  }
  return db.templates[purpose][lang].replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}

function sendNow(p, purpose, body, at) {
  const m = { id: newId(), channel: 'SMS', language: p.language, purpose, body, status: 'sent', provider_ref: `ATSim_${randHex(10)}`, send_at: at || nowIso() }
  p.messages.push(m)
  return m
}

const cancelScheduled = (p) => { p.messages = p.messages.filter((m) => m.status !== 'scheduled') }

function scheduleReminders(p) {
  cancelScheduled(p)
  if (!p.appointment_on) return
  const purpose = `reminder_${p.risk_band}`
  for (const days of db.reminder_days[p.risk_band]) {
    const sendDay = addDays(p.appointment_on, -days)
    if (sendDay <= today()) continue
    p.messages.push({ id: newId(), channel: 'SMS', language: p.language, purpose, body: render(purpose, p), status: 'scheduled', provider_ref: null, send_at: `${sendDay}T08:00:00` })
  }
}

/* ---------------- pathway (services/pathway.py) ---------------- */

function addEvent(p, kind, title, detailText = '', at) {
  p.events.push({ id: newId(), kind, title, detail: detailText, created_at: at || nowIso() })
}

function requireStatus(p, allowed, action) {
  if (!allowed.includes(p.status)) throw new Error(`Cannot ${action} a patient whose status is '${p.status}'.`)
}

function assignChp(p) {
  if (p.chp) return p.chp
  const candidates = db.chps.filter((c) => c.county === p.county)
  if (!candidates.length) return null
  const load = (c) => db.patients.filter((x) => x.chp?.id === c.id && ACTIVE.includes(x.status)).length
  const local = candidates.filter((c) => p.village && c.area.toLowerCase().includes(p.village.toLowerCase()))
  const chp = [...(local.length ? local : candidates)].sort((a, b) => load(a) - load(b) || a.id - b.id)[0]
  p.chp = { ...chp }
  addEvent(p, 'chp', `Assigned to CHP ${chp.name}`, `High dropout risk. ${chp.name} covers ${chp.area} and will visit.`)
  return p.chp
}

function nextCode() {
  let n = Math.max(0, ...db.patients.map((p) => p.id)) + 1
  while (db.patients.some((p) => p.code === `FT-${String(n).padStart(4, '0')}`)) n += 1
  return `FT-${String(n).padStart(4, '0')}`
}

function register(data, code) {
  const c = county(data.county)
  const risk = scoreRisk(data)
  const screened = today()
  const p = {
    id: newId(), code: code || nextCode(), name: data.name, age: Number(data.age), county: c.name,
    village: data.village || c.villages[0], phone: normalisePhone(data.phone), phone_type: data.phone_type,
    language: data.language || 'sw', distance_km: Number(data.distance_km), missed_visits: Number(data.missed_visits),
    hiv_status: data.hiv_status, screening_method: data.screening_method,
    screening_facility: data.screening_facility || c.screening_sites[0], treatment_facility: c.treatment_facility,
    screened_on: screened, appointment_on: addDays(screened, APPOINTMENT_DAYS[risk.band]), status: SCREENED_POSITIVE,
    risk_score: risk.score, risk_band: risk.band, risk_factors: risk.factors, chp: null, chp_visited_at: null,
    checked_in_on: null, treated_on: null, events: [], messages: [], vouchers: [], outcome_completed: null,
  }
  db.patients.push(p)
  addEvent(p, 'screened', `Screened positive (${p.screening_method})`, `At ${p.screening_facility}. Referred to ${p.treatment_facility}.`)
  addEvent(p, 'risk', `Dropout risk ${risk.score}/100 (${risk.band})`, risk.factors.map((f) => f.en).join('; '))
  if (risk.band === 'high') assignChp(p)
  const body = render('intro', p)
  sendNow(p, 'intro', body)
  addEvent(p, 'sms', `First SMS sent (${p.language === 'sw' ? 'Kiswahili' : 'English'})`, body)
  scheduleReminders(p)
  return p
}

function startNavigating(p, reason) {
  if (p.status === SCREENED_POSITIVE) {
    p.status = NAVIGATING
    addEvent(p, 'status', 'Now navigating', reason)
  }
}

function confirmAppointment(p, via = 'USSD') {
  requireStatus(p, ACTIVE, 'confirm an appointment for')
  addEvent(p, 'ussd', `Appointment confirmed via ${via}`, `For ${fmtLong(p.appointment_on)} at ${p.treatment_facility}.`)
  startNavigating(p, `Patient confirmed by ${via}.`)
  sendNow(p, 'confirmed', render('confirmed', p))
}

function reschedule(p, newDate, via = 'USSD') {
  requireStatus(p, ACTIVE, 'reschedule')
  const old = p.appointment_on
  p.appointment_on = newDate
  addEvent(p, 'ussd', `Rescheduled via ${via}`, old ? `From ${fmtShort(old)} to ${fmtLong(newDate)}.` : `To ${fmtLong(newDate)}.`)
  startNavigating(p, `Patient engaged by ${via}.`)
  sendNow(p, 'rescheduled', render('rescheduled', p))
  scheduleReminders(p)
}

function requestCallback(p) {
  const chp = assignChp(p)
  addEvent(p, 'ussd', 'Asked for a call from her health promoter', chp ? `${chp.name} notified.` : 'No CHP in this county yet; clinic notified.')
  return chp
}

/* ---------------- USSD (services/ussd.py) ---------------- */

const T = {
  welcome: { en: 'Fuatilia: Hello {first}', sw: 'Fuatilia: Habari {first}' },
  menu: {
    en: '1. Confirm visit ({date})\n2. Change date\n3. Find a treatment clinic\n4. Call me (health promoter)\n5. Kiswahili',
    sw: '1. Thibitisha miadi ({date})\n2. Badilisha tarehe\n3. Tafuta kituo cha matibabu\n4. Nipigie (mhudumu wa afya)\n5. English',
  },
  guest: { en: 'Welcome to Fuatilia\n1. Find a treatment clinic\n5. Kiswahili', sw: 'Karibu Fuatilia\n1. Tafuta kituo cha matibabu\n5. English' },
  confirmed: {
    en: 'Thank you {first}. Your visit on {date} at {site} is confirmed. M-Pesa fare is sent when you check in.',
    sw: 'Asante {first}. Miadi yako ya {date} {site} imethibitishwa. Nauli ya M-Pesa itatumwa ukifika.',
  },
  pick_date: { en: 'Choose a new date:', sw: 'Chagua tarehe mpya:' },
  rescheduled: { en: 'Done. Your new date is {date} at {site}. We will send an SMS reminder.', sw: 'Sawa. Tarehe yako mpya ni {date} {site}. Tutakutumia kumbusho kwa SMS.' },
  pick_county: { en: 'Choose your county:', sw: 'Chagua kaunti yako:' },
  clinics: { en: 'Treatment: {treat}\nScreening: {screen}', sw: 'Matibabu: {treat}\nUchunguzi: {screen}' },
  callback: { en: '{chp} will call you within 24 hours. Asante.', sw: '{chp} atakupigia simu ndani ya saa 24. Asante.' },
  no_active: { en: 'You have no upcoming visit. Thank you for completing your care.', sw: 'Huna miadi inayokuja. Asante kwa kukamilisha huduma yako.' },
  invalid: { en: 'Invalid choice. Please dial again.', sw: 'Chaguo si sahihi. Tafadhali piga tena.' },
}
const t = (key, lang, vars = {}) => T[key][lang].replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')

function normalisePhone(phone) {
  let digits = String(phone).replace(/\D/g, '')
  if (digits.startsWith('0')) digits = `254${digits.slice(1)}`
  return `+${digits}`
}

function ussd(phone, text, langOverride) {
  const target = normalisePhone(phone)
  const patient = db.patients.filter((p) => p.phone === target).sort((a, b) => b.id - a.id)[0]
  let lang = langOverride || (patient ? patient.language : 'sw')
  let parts = text ? text.split('*').filter((x) => x !== '') : []
  while (parts.length && parts[0] === '5') { lang = lang === 'sw' ? 'en' : 'sw'; parts = parts.slice(1) }

  const countyMenu = db.counties.map((c, i) => `${i + 1}. ${c.name}`).join('\n')
  const clinics = (choice) => {
    const i = Number(choice)
    if (!Number.isInteger(i) || i < 1 || i > db.counties.length) return `END ${t('invalid', lang)}`
    const c = db.counties[i - 1]
    return `END ${t('clinics', lang, { treat: c.treatment_facility, screen: c.screening_sites.slice(0, 2).join(', ') })}`
  }

  if (!patient || !ACTIVE.includes(patient.status)) {
    if (!parts.length) return patient ? `END ${t('no_active', lang)}` : `CON ${t('guest', lang)}`
    if (parts[0] === '1') return parts.length === 1 ? `CON ${t('pick_county', lang)}\n${countyMenu}` : clinics(parts[1])
    return `END ${t('invalid', lang)}`
  }

  const p = patient
  p.language = lang
  const site = shortSite(p.treatment_facility)
  const date = p.appointment_on ? fmtDate(p.appointment_on, lang) : '-'
  if (!parts.length) return `CON ${t('welcome', lang, { first: p.name.split(' ')[0] })}\n${t('menu', lang, { date })}`
  const choice = parts[0]
  if (choice === '1') {
    confirmAppointment(p, 'USSD')
    return `END ${t('confirmed', lang, { first: p.name.split(' ')[0], date, site })}`
  }
  if (choice === '2') {
    const options = [3, 7, 14].map((d) => addDays(p.appointment_on, d))
    if (parts.length === 1) return `CON ${t('pick_date', lang)}\n${options.map((d, i) => `${i + 1}. ${fmtDate(d, lang)}`).join('\n')}`
    if (['1', '2', '3'].includes(parts[1])) {
      const d = options[Number(parts[1]) - 1]
      reschedule(p, d, 'USSD')
      return `END ${t('rescheduled', lang, { date: fmtDate(d, lang), site })}`
    }
    return `END ${t('invalid', lang)}`
  }
  if (choice === '3') return parts.length === 1 ? `CON ${t('pick_county', lang)}\n${countyMenu}` : clinics(parts[1])
  if (choice === '4') {
    const chp = requestCallback(p)
    const who = chp ? chp.name.split(' ')[0] : (lang === 'sw' ? 'Mhudumu wa afya' : 'A health worker')
    return `END ${t('callback', lang, { chp: who })}`
  }
  return `END ${t('invalid', lang)}`
}

/* ---------------- metrics (services/metrics.py) ---------------- */

function metrics() {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]))
  const byRisk = { low: 0, medium: 0, high: 0 }
  db.patients.forEach((p) => { byStatus[p.status] += 1; byRisk[p.risk_band] += 1 })
  const completed = COMPLETED.reduce((a, s) => a + byStatus[s], 0)
  const lost = byStatus[LOST]
  const treated = db.patients.filter((p) => p.treated_on)
  const vouchers = db.patients.flatMap((p) => p.vouchers)
  const messages = db.patients.flatMap((p) => p.messages)
  return {
    completion_rate: completed + lost ? Math.round((1000 * completed) / (completed + lost)) / 10 : 0,
    completed,
    lost_to_follow_up: lost,
    active: ACTIVE.reduce((a, s) => a + byStatus[s], 0),
    total_patients: db.patients.length,
    avg_days_to_treatment: treated.length ? Math.round((10 * treated.reduce((a, p) => a + daysBetween(p.screened_on, p.treated_on), 0)) / treated.length) / 10 : null,
    vouchers_paid: vouchers.length,
    vouchers_kes: vouchers.reduce((a, v) => a + v.amount_kes, 0),
    sms_sent: messages.filter((m) => m.status === 'sent').length,
    sms_scheduled: messages.filter((m) => m.status === 'scheduled').length,
    by_status: byStatus,
    by_risk: byRisk,
  }
}

/* ---------------- pathology (services/pathology.py) ---------------- */

const urgencyBand = (s) => (s >= 75 ? 'urgent' : s >= 45 ? 'priority' : 'routine')
function caseOut(c) {
  const p = c.patient_id ? db.patients.find((x) => x.id === c.patient_id) : null
  return { ...c, patient_name: p?.name ?? null, patient_code: p?.code ?? null }
}

/* ---------------- public interface (same shape as api.js) ---------------- */

const run = async (fn) => { await ready(); return fn() }

export const demoApi = {
  meta: () => run(() => ({
    statuses: STATUSES,
    counties: clone(db.counties),
    ussd_code: db.ussd_code,
    risk_bands: db.model.bands,
    integrations: { sms: 'simulated (browser demo)', mpesa: 'simulated (browser demo)' },
    settings: { ...db.settings },
    synthetic_data_only: true,
  })),
  metrics: () => run(metrics),
  impact: () => run(() => clone(db.impact)),
  model: () => run(() => ({
    type: 'LogisticRegression (scikit-learn), exported coefficients',
    coefficients: Object.fromEntries(db.model.features.map((f, i) => [f, db.model.coef[i]])),
    note: 'Trained on synthetic data only. Not clinically validated.',
  })),
  patients: (params = {}) => run(() => {
    let rows = db.patients
    if (params.risk) rows = rows.filter((p) => p.risk_band === params.risk)
    if (params.status) rows = rows.filter((p) => p.status === params.status)
    if (params.county) rows = rows.filter((p) => p.county === params.county)
    if (params.q) {
      const q = params.q.trim().toLowerCase()
      rows = rows.filter((p) => [p.name, p.code, p.village].some((v) => v.toLowerCase().includes(q)))
    }
    rows = [...rows].sort(params.sort === 'risk'
      ? (a, b) => b.risk_score - a.risk_score
      : (a, b) => b.screened_on.localeCompare(a.screened_on) || b.id - a.id)
    const offset = Number(params.offset || 0)
    const limit = Number(params.limit || 25)
    return { total: rows.length, items: clone(rows.slice(offset, offset + limit)) }
  }),
  patient: (id) => run(() => detail(findPatient(id))),
  register: (data) => run(() => detail(register(data))),
  scoreRisk: (data) => run(() => { county(data.county); return scoreRisk(data) }),
  checkIn: (id, amountKes) => run(() => {
    const p = findPatient(id)
    requireStatus(p, [SCREENED_POSITIVE, NAVIGATING], 'check in')
    p.status = CHECKED_IN
    p.checked_in_on = today()
    cancelScheduled(p)
    addEvent(p, 'checked_in', `Checked in at ${p.treatment_facility}`, `${daysBetween(p.screened_on, today())} days after positive screen.`)
    const amount = Number(amountKes || db.settings.voucher_amount_kes)
    const txn = fakeMpesaId()
    p.vouchers.push({ id: newId(), amount_kes: amount, transaction_id: txn, status: 'paid', mode: 'simulated', created_at: nowIso() })
    addEvent(p, 'voucher', `M-Pesa transport voucher: KES ${amount.toLocaleString('en-US')}`, `Transaction ${txn} (simulated).`)
    sendNow(p, 'voucher', render('voucher', p, today(), { txn, amount: amount.toLocaleString('en-US') }))
    return detail(p)
  }),
  treat: (id) => run(() => {
    const p = findPatient(id)
    requireStatus(p, [CHECKED_IN], 'mark treated')
    p.status = TREATED
    p.treated_on = today()
    const rescreen = addDays(today(), 365)
    p.appointment_on = rescreen
    addEvent(p, 'treated', 'Treatment completed', `${daysBetween(p.screened_on, today())} days from positive screen. Rescreen due ${fmtMonthYear(rescreen)}.`)
    sendNow(p, 'treated', render('treated', p, rescreen))
    return detail(p)
  }),
  markLost: (id, note) => run(() => {
    const p = findPatient(id)
    requireStatus(p, ACTIVE, 'mark lost')
    p.status = LOST
    cancelScheduled(p)
    addEvent(p, 'lost', 'Lost to follow-up', note || 'Unreachable after reminders and CHP tracing.')
    return detail(p)
  }),
  remind: (id) => run(() => {
    const p = findPatient(id)
    const purpose = `reminder_${p.risk_band}`
    const body = render(purpose, p)
    sendNow(p, purpose, body)
    addEvent(p, 'sms', 'Reminder SMS sent', body)
    return detail(p)
  }),
  chps: () => run(() => [...db.chps]
    .sort((a, b) => a.county.localeCompare(b.county) || a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name, county: c.county, area: c.area,
      active_patients: db.patients.filter((p) => p.chp?.id === c.id && ACTIVE.includes(p.status)).length }))),
  worklist: (chpId) => run(() => db.patients
    .filter((p) => ACTIVE.includes(p.status) && p.risk_band === 'high' && p.chp && (!chpId || p.chp.id === Number(chpId)))
    .sort((a, b) => (a.chp_visited_at ? 1 : 0) - (b.chp_visited_at ? 1 : 0)
      || (a.appointment_on || a.screened_on).localeCompare(b.appointment_on || b.screened_on)
      || b.risk_score - a.risk_score)
    .map((p) => ({ ...clone(p), visited_at: p.chp_visited_at, top_reason: p.risk_factors[0] || null }))),
  logVisit: (id, note) => run(() => {
    const p = findPatient(id)
    requireStatus(p, ACTIVE, 'log a CHP visit for')
    p.chp_visited_at = nowIso()
    addEvent(p, 'chp_visit', `Home visit by ${p.chp ? p.chp.name : 'CHP'}`, note || 'Explained the visit, planned transport.')
    startNavigating(p, 'CHP home visit.')
    return detail(p)
  }),
  facilities: (q = '', countyName) => run(() => {
    const query = (q || '').trim().toLowerCase()
    const rows = db.counties.filter((c) => !countyName || c.name === countyName).flatMap((c) => [
      { name: c.treatment_facility, county: c.name, type: 'treatment', services: ['LEEP', 'Thermal ablation', 'Cryotherapy', 'Biopsy', 'Referral oncology'] },
      ...c.screening_sites.map((s) => ({ name: s, county: c.name, type: 'screening', services: ['VIA screening', 'HPV self-sampling', 'Thermal ablation'] })),
    ])
    return query ? rows.filter((r) => r.name.toLowerCase().includes(query) || r.county.toLowerCase().includes(query)) : rows
  }),
  settings: () => run(() => ({ ...db.settings })),
  saveSettings: (data) => run(() => { db.settings = { ...db.settings, ...data }; return { ...db.settings } }),
  pathology: () => run(() => [...db.pathology]
    .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1)
      || b.urgency_score - a.urgency_score || b.created_at.localeCompare(a.created_at))
    .map(caseOut)),
  uploadSlide: async (file, patientId) => {
    await ready()
    const ext = (file.name.match(/\.[^.]+$/) || [''])[0].toLowerCase()
    if (!['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) throw new Error('Please upload a JPG, PNG, WEBP or GIF image.')
    if (file.size > 10 * 1024 * 1024) throw new Error('Image is larger than 10 MB.')
    // Same deterministic mock score as the API: from the SHA-256 of the image bytes.
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))
    const score = 5 + (((digest[0] << 8) | digest[1]) % 94)
    const band = urgencyBand(score)
    const id = Math.max(0, ...db.pathology.map((c) => c.id)) + 1
    const c = {
      id, case_code: `PX-${String(id).padStart(4, '0')}`, patient_id: patientId ? Number(patientId) : null,
      image_url: URL.createObjectURL(file), original_filename: file.name.slice(0, 200), urgency_score: score,
      urgency_band: band, ai_note: PATHOLOGY_NOTES[band], status: 'pending', reviewer_note: null, created_at: nowIso(), reviewed_at: null,
    }
    db.pathology.push(c)
    return caseOut(c)
  },
  review: (id, decision, note) => run(() => {
    const c = db.pathology.find((x) => x.id === Number(id))
    if (!c) throw new Error('Case not found')
    Object.assign(c, { status: decision, reviewer_note: note || null, reviewed_at: nowIso() })
    return caseOut(c)
  }),
  ussd: ({ phoneNumber, text, lang }) => run(() => ussd(phoneNumber, text || '', lang === 'sw' || lang === 'en' ? lang : null)),
  resetAmina: () => run(() => {
    const old = db.patients.find((p) => p.code === AMINA_CODE)
    if (old) {
      db.patients = db.patients.filter((p) => p !== old)
      db.pathology = db.pathology.filter((c) => c.patient_id !== old.id)
    }
    return detail(register({ ...db.amina }, AMINA_CODE))
  }),
  amina: () => run(() => detail(db.patients.find((p) => p.code === AMINA_CODE) || register({ ...db.amina }, AMINA_CODE))),
}
