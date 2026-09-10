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
    // e2e/ holds Playwright specs (run via `npm run test:e2e`), not Vitest ones — both use the
    // .spec.ts suffix, so Vitest's default include glob would otherwise try to run them too.
    // ng-app/ is the separate Angular workspace (its own `ng test` / Vitest-via-Angular-builder
    // setup, which needs Angular's TestBed environment) — without this exclude, root `npm test`
    // picks up its *.spec.ts files too and fails them all with "TestBed not initialized" errors,
    // since plain Vitest here has no Angular builder wiring it up.
    exclude: ['**/node_modules/**', '**/e2e/**', '**/ng-app/**'],
  },
})
