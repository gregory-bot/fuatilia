import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies API and uploaded images to FastAPI, so the browser only ever
// talks to one origin (this also makes testing on a phone over Wi-Fi work: `--host`).
export default defineConfig({
  // "/" locally; "/fuatilia/" for GitHub Pages (set by the deploy workflow).
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/uploads': 'http://127.0.0.1:8000',
    },
  },
})
