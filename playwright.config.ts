import { defineConfig, devices } from '@playwright/test'

/**
 * E2E behavioral specs — these describe what GoWrite does, not how, so the same suite runs
 * unchanged against the current React app and against the Angular rewrite (see
 * docs/angular-migration-plan.md §3/§14's "Next step"). Keep specs framework-agnostic: assert on
 * visible text, roles, and IndexedDB/localStorage state, never on React/Angular internals.
 *
 * Targets the React app (Vite, port 5173) by default. Set E2E_TARGET=angular to run the exact
 * same suite against the Angular app instead (`ng serve`, port 4200) — this is the parity gate:
 * a spec failing only under one target is a real behavioral gap, not a tooling difference.
 */
const isAngular = process.env.E2E_TARGET === 'angular'
const port = isAngular ? 4200 : 5173

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
    // Pin the browser locale so GoWrite's navigator.language-based default (useI18n.tsx/
    // I18nService) always resolves to English — specs assert on English UI text and would
    // otherwise depend on whatever locale the host machine/CI happens to report.
    locale: 'en-US',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: isAngular ? 'npm run start --prefix ng-app' : 'npm run dev',
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
})
