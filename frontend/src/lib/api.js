// Thin fetch wrapper. Vite proxies /api to FastAPI (see vite.config.js).
async function request(path, { method = 'GET', body, form } = {}) {
  const init = { method, headers: {} }
  if (form) init.body = form
  else if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`/api${path}`, init)
  const type = res.headers.get('content-type') || ''
  const data = type.includes('json') ? await res.json() : await res.text()
  if (!res.ok) {
    const detail = typeof data === 'object' ? data.detail : data
    throw new Error(Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : detail || res.statusText)
  }
  return data
}

const qs = (params) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString()
  return s ? `?${s}` : ''
}

export const api = {
  meta: () => request('/meta'),
  metrics: () => request('/metrics'),
  impact: () => request('/impact'),
  model: () => request('/model'),
  patients: (params = {}) => request(`/patients${qs(params)}`),
  patient: (id) => request(`/patients/${id}`),
  register: (data) => request('/patients', { method: 'POST', body: data }),
  scoreRisk: (data) => request('/risk/score', { method: 'POST', body: data }),
  checkIn: (id, amount_kes) => request(`/patients/${id}/check-in`, { method: 'POST', body: amount_kes ? { amount_kes } : {} }),
  treat: (id) => request(`/patients/${id}/treat`, { method: 'POST' }),
  markLost: (id, note) => request(`/patients/${id}/lost`, { method: 'POST', body: { note } }),
  remind: (id) => request(`/patients/${id}/remind`, { method: 'POST' }),
  chps: () => request('/chp'),
  worklist: (chp_id) => request(`/chp/worklist${qs({ chp_id })}`),
  logVisit: (id, note) => request(`/chp/visits/${id}`, { method: 'POST', body: { note } }),
  facilities: (q, county) => request(`/facilities${qs({ q, county })}`),
  settings: () => request('/settings'),
  saveSettings: (data) => request('/settings', { method: 'PUT', body: data }),
  pathology: () => request('/pathology'),
  uploadSlide: (file, patientId) => {
    const form = new FormData()
    form.append('file', file)
    if (patientId) form.append('patient_id', patientId)
    return request('/pathology', { method: 'POST', form })
  },
  review: (id, decision, note) => request(`/pathology/${id}/review`, { method: 'POST', body: { decision, note } }),
  // Africa's Talking-style USSD callback: form-encoded, returns "CON ..." / "END ..." text.
  ussd: ({ sessionId, phoneNumber, text, lang }) => {
    const form = new URLSearchParams({ sessionId, phoneNumber, text, serviceCode: '*384*12#' })
    if (lang) form.append('lang', lang)
    return request('/ussd', { method: 'POST', form })
  },
  resetAmina: () => request('/demo/amina/reset', { method: 'POST' }),
  amina: () => request('/demo/amina'),
}
