import { defineConfig, devices } from '@playwright/test'

/**
 * E2E behavioral specs for the Angular app. These ran against both the React app and this
 * Angular rewrite during the migration as a parity gate (docs/angular-migration-plan.md §15) —
 * now that the React app is retired (§17, cutover), this targets the Angular dev server only.
 * Kept framework-agnostic in spirit (assert on visible text/roles/storage state, not component
 * internals) since that discipline is what made the parity check possible in the first place.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    // Pin the browser locale so GoWrite's navigator.language-based default (I18nService) always
    // resolves to English — specs assert on English UI text and would otherwise depend on
    // whatever locale the host machine/CI happens to report.
    locale: 'en-US',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
  },
})
