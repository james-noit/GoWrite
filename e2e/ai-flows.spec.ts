import { expect, test } from '@playwright/test'

/**
 * AI-dependent flows (settings connect, autocomplete, context-menu AI tools) — deferred since
 * Phase 1/2 of the Angular migration (docs/angular-migration-plan.md §3 Track B) to be filled in
 * opportunistically once the corresponding UI existed. All network calls are intercepted via
 * Playwright route mocking (never hit a real provider), targeting the "Custom" provider so the
 * default http://localhost:11434 endpoint needs no UI change to reach.
 */

function sseBody(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`
}

test.beforeEach(async ({ page }) => {
  await page.route('**/v1/models', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'test-model' }] }) }),
  )
  await page.goto('/')
  await page.locator('.ProseMirror').waitFor()
})

async function connectCustomProvider(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'File', exact: false }).click()
  await page.getByText('Settings', { exact: false }).click()
  await page.getByRole('tab', { name: /AI/ }).click()
  // The provider-config accordion starts *open* by default while disconnected (`configOpen =
  // !isConnected` at construction time) — every test here starts from a fresh, disconnected
  // browser context, so it's already open; `#ai-provider`'s own auto-waiting locator handles the
  // brief render delay after switching tabs (an `isVisible()` snapshot check here would be racy
  // and risks toggling the still-opening accordion closed instead).
  await page.locator('#ai-provider').selectOption('Custom')
  await page.locator('.connect-btn').click()
  // Assert on the accordion header's own status label, not `.connect-btn`'s text — a successful
  // connect auto-collapses the accordion (ported UX from the original React SettingsModal), which
  // removes `.connect-btn` from the DOM entirely rather than just relabeling it.
  await expect(page.locator('.ai-accordion-header .conn-label')).toHaveText('connected')
}

test('connecting a provider updates the AI status shown in the header', async ({ page }) => {
  await connectCustomProvider(page)
  await page.locator('.icon-btn').click() // close settings
  await expect(page.locator('.toolbar-ai-meta')).toContainText('test-model')
})

test('autocomplete streams a ghost suggestion and accepts it with Tab', async ({ page }) => {
  await page.route('**/v1/chat/completions', (route) =>
    route.fulfill({ contentType: 'text/event-stream', body: sseBody(' and it kept going nicely.') }),
  )
  await connectCustomProvider(page)

  // Speed the test up: default wait is 3s, drop it to 1s via the same tab's "Autocomplete" section.
  await page.locator('#auto-wait').fill('1')
  await page.locator('#auto-wait').blur()
  const autoToggle = page.locator('.tool-enable-row .switch-track')
  await autoToggle.click()
  await expect(autoToggle).toHaveAttribute('aria-checked', 'true')
  await page.locator('.icon-btn').click() // close settings

  const editor = page.locator('.ProseMirror')
  await editor.click()
  await page.keyboard.type('The quick brown fox jumps over the lazy dog and then')
  await expect(page.locator('.ghost-suggestion-text')).toHaveText('and it kept going nicely.', { timeout: 5000 })

  await page.keyboard.press('Tab')
  await expect(page.locator('.ghost-suggestion')).toHaveCount(0)
  await expect(editor).toContainText('and it kept going nicely.')
})

test('right-click "Summarize document" runs the AI and shows the result in SummaryModal', async ({ page }) => {
  await page.route('**/v1/chat/completions', (route) =>
    route.fulfill({ contentType: 'text/event-stream', body: sseBody('A brief summary.') }),
  )
  await connectCustomProvider(page)
  await page.locator('.icon-btn').click() // close settings

  const editor = page.locator('.ProseMirror')
  await editor.click()
  await page.keyboard.type('Some document content worth summarizing.')
  await editor.click({ button: 'right' })

  await page.getByText('Summarize document', { exact: false }).click()
  await expect(page.locator('.summary-modal')).toBeVisible()
  await expect(page.locator('.summary-body')).toHaveText('A brief summary.', { timeout: 5000 })
})

test('"Edit with AI" from the context menu replaces the selection with the AI draft', async ({ page }) => {
  await page.route('**/v1/chat/completions', (route) =>
    route.fulfill({ contentType: 'text/event-stream', body: sseBody('EDITED') }),
  )
  await connectCustomProvider(page)
  await page.locator('.icon-btn').click() // close settings

  const editor = page.locator('.ProseMirror')
  await editor.click()
  await page.keyboard.type('original text here')
  await page.keyboard.press('Control+A')
  await editor.click({ button: 'right' })

  await page.getByText('Edit with AI', { exact: false }).click()
  await page.locator('.context-menu .field-input').fill('rewrite it')
  await page.keyboard.press('Enter')

  await expect(page.locator('.context-menu .gen-draft')).toHaveValue('EDITED', { timeout: 5000 })
  await page.getByRole('button', { name: 'Accept', exact: false }).click()
  await expect(editor).toHaveText('EDITED')
  await expect(page.locator('.undo-ai-btn')).toBeVisible()
})
