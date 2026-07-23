import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Match how Vite resolves these packages for the real browser build (e.g. mammoth ships a
    // browser-only unzip implementation via package.json's legacy "browser" field) — without this,
    // Vitest's Node-style resolution picks the wrong entry point and format tests misbehave.
    mainFields: ['browser', 'module', 'main'],
    conditions: ['browser'],
  },
  ssr: {
    // Vite's SSR resolution ignores the "browser" field replacement map by design; mammoth relies
    // on it to swap in a browser-only zip reader, so force it through the client resolution path.
    noExternal: ['mammoth'],
  },
  test: {
    environment: 'jsdom',
    globals: false,
  },
})
