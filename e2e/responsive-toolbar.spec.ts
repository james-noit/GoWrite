import { expect, test } from '@playwright/test'

/**
 * Responsive toolbar tier switch (mobile FAB/sheet vs. desktop inline bar) — deferred since
 * Phase 1 (docs/angular-migration-plan.md §3 Track B) because it needed the real Toolbar (Phase
 * 6). Viewport emulation stands in for a real touch device, same as the app's own
 * FULL_TOOLBAR_TIER_QUERY media query.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('.ProseMirror').waitFor()
})

test.describe('desktop viewport', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('shows the full inline format bar, not the FAB', async ({ page }) => {
    await expect(page.locator('.format-bar')).toBeVisible()
    await expect(page.locator('.format-fab')).toHaveCount(0)
    await expect(page.getByTitle('Bold', { exact: true })).toBeVisible()
  })
})

test.describe('mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('shows the FAB instead of the inline bar, which opens a format sheet', async ({ page }) => {
    await expect(page.locator('.format-bar')).toHaveCount(0)
    const fab = page.locator('.format-fab')
    await expect(fab).toBeVisible()

    await fab.click()
    await expect(page.locator('.fmt-sheet')).toBeVisible()
    await expect(page.getByTitle('Bold', { exact: true })).toBeVisible()
  })

  test('selecting text pops up the quick-format bar', async ({ page }) => {
    const editor = page.locator('.ProseMirror')
    await editor.click()
    await page.keyboard.type('select me')
    await page.keyboard.press('Control+A')

    await expect(page.locator('.quick-format-bar')).toBeVisible({ timeout: 3000 })
  })
})
