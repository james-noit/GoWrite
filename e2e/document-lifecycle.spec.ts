import { expect, test } from '@playwright/test'

/**
 * Document CRUD + persistence — the core of useDocuments.ts / lib/db.ts. Each test gets a fresh
 * browser context (Playwright default), so IndexedDB/localStorage start empty every time.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('.ProseMirror').waitFor()
})

test('typed content autosaves and survives a reload', async ({ page }) => {
  await page.locator('.ProseMirror').click()
  await page.keyboard.type('Hello, GoWrite!')

  // useDocuments debounces autosave by 500ms
  await page.waitForTimeout(700)
  await page.reload()

  await expect(page.locator('.ProseMirror')).toContainText('Hello, GoWrite!')
})

test('renaming the document updates the title and persists across reload', async ({ page }) => {
  await page.getByTitle('Click to rename the document').click()
  const input = page.locator('.app-filename-input')
  await input.fill('my-notes')
  await input.press('Enter')

  await expect(page.getByTitle('Click to rename the document')).toHaveText('my-notes')

  await page.reload()
  await expect(page.getByTitle('Click to rename the document')).toHaveText('my-notes')
})

test('creating a new document clears the editor and adds it to the document list', async ({ page }) => {
  await page.locator('.ProseMirror').click()
  await page.keyboard.type('First document content')
  await page.waitForTimeout(700)

  await page.getByRole('button', { name: 'File', exact: false }).click()
  await page.getByText('New document', { exact: false }).click()

  await expect(page.locator('.ProseMirror')).not.toContainText('First document content')

  await page.getByRole('button', { name: 'File', exact: false }).click()
  await page.getByText(/Documents/).click()
  await expect(page.locator('.document-row')).toHaveCount(2)
})

test('switching between documents restores each one\'s own content', async ({ page }) => {
  await page.locator('.ProseMirror').click()
  await page.keyboard.type('Content A')
  await page.waitForTimeout(700)

  await page.getByRole('button', { name: 'File', exact: false }).click()
  await page.getByText('New document', { exact: false }).click()
  await page.locator('.ProseMirror').click()
  await page.keyboard.type('Content B')
  await page.waitForTimeout(700)

  await page.getByRole('button', { name: 'File', exact: false }).click()
  await page.getByText(/Documents/).click()
  // Open whichever row isn't the currently-open one (the other document, holding Content A).
  await page.locator('.document-row:not(.is-current) .document-row-open').first().click()

  await expect(page.locator('.ProseMirror')).toContainText('Content A')
})

test('deleting a document removes it from the list (with confirmation)', async ({ page }) => {
  await page.locator('.ProseMirror').click()
  await page.keyboard.type('Doc to delete')
  await page.waitForTimeout(700)

  await page.getByRole('button', { name: 'File', exact: false }).click()
  await page.getByText('New document', { exact: false }).click()
  await page.waitForTimeout(200)

  await page.getByRole('button', { name: 'File', exact: false }).click()
  await page.getByText('Documents', { exact: false }).first().click()

  page.once('dialog', (dialog) => dialog.accept())
  await page.locator('.document-row-delete').first().click()

  await expect(page.locator('.document-row')).toHaveCount(1)
})
