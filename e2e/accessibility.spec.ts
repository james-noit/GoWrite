import { expect, test } from '@playwright/test'

/**
 * Focus-trap and keyboard behavior for modals — deferred since Phase 1
 * (docs/angular-migration-plan.md §3 Track B). Both apps adopted Angular CDK / a hand-rolled
 * equivalent focus trap for SettingsModal/SummaryModal (React: useFocusTrap.ts; Angular: CDK's
 * cdkTrapFocus, Phase 5), so Tab should cycle within the modal and Escape should close it.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('.ProseMirror').waitFor()
})

test('Escape closes SettingsModal', async ({ page }) => {
  await page.getByRole('button', { name: 'File', exact: false }).click()
  await page.getByText('Settings', { exact: false }).click()
  await expect(page.locator('.settings-modal')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.settings-modal')).toHaveCount(0)
})

test('Tab cycling stays within SettingsModal (focus trap)', async ({ page }) => {
  await page.getByRole('button', { name: 'File', exact: false }).click()
  await page.getByText('Settings', { exact: false }).click()
  const modal = page.locator('.settings-modal')
  await expect(modal).toBeVisible()

  // Tab through every focusable element inside the modal, well past its own count, and confirm
  // focus never escapes to something outside — a real focus trap wraps back around instead.
  const focusableCount = await modal.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])').count()
  for (let i = 0; i < focusableCount + 5; i++) {
    await page.keyboard.press('Tab')
    const stillInside = await page.evaluate(() => {
      const modalEl = document.querySelector('.settings-modal')
      return !!modalEl && modalEl.contains(document.activeElement)
    })
    expect(stillInside).toBe(true)
  }
})

test('clicking the backdrop closes SettingsModal', async ({ page }) => {
  await page.getByRole('button', { name: 'File', exact: false }).click()
  await page.getByText('Settings', { exact: false }).click()
  await expect(page.locator('.settings-modal')).toBeVisible()

  await page.locator('.settings-backdrop').click({ position: { x: 5, y: 5 } })
  await expect(page.locator('.settings-modal')).toHaveCount(0)
})

test('right-click context menu closes on Escape', async ({ page }) => {
  const editor = page.locator('.ProseMirror')
  await editor.click()
  await page.keyboard.type('some text')
  await editor.click({ button: 'right' })
  await expect(page.locator('.context-menu')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.context-menu')).toHaveCount(0)
})
