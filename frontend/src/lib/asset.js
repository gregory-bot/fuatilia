// Public files (photos, demo data) resolved against the deploy base path,
// e.g. "/" locally and "/fuatilia/" on GitHub Pages. (Falls back to "/" outside Vite,
// e.g. when the video exporter reads the film script in Node.)
const BASE = import.meta.env?.BASE_URL ?? '/'
export const asset = (path) => `${BASE}${path.replace(/^\//, '')}`
