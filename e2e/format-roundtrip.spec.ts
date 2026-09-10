import fs from 'node:fs/promises'
import { expect, test } from '@playwright/test'

/**
 * Round-trips the three formats formatting-and-export.spec.ts doesn't already cover (md/txt are
 * there) through the real UI: export via FileMenu, then re-import the downloaded file via the
 * real file picker — proving the full browser file I/O path works, not just the format codecs
 * (those already have thorough Vitest coverage in core/formats/*.spec.ts). Deferred since Phase 2
 * per docs/angular-migration-plan.md §3 Track B, filled in now that both apps have the real UI.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('.ProseMirror').waitFor()
})

async function exportAndReimport(page: import('@playwright/test').Page, label: string) {
  const editor = page.locator('.ProseMirror')
  await editor.click()
  await page.keyboard.type('Round trip content')

  await page.getByRole('button', { name: 'File', exact: false }).click()
  await page.getByText('Export as', { exact: false }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByText(label, { exact: false }).click()
  const download = await downloadPromise
  // download.path() is a temp file with no extension — the app picks an import format from the
  // filename's extension, so the re-import needs the real suggested name, not the temp path.
  const buffer = await fs.readFile((await download.path())!)
  const name = download.suggestedFilename()

  // New document so the re-import target starts empty, proving the imported file's own content
  // (not a leftover) is what lands in the editor.
  await page.getByRole('button', { name: 'File', exact: false }).click()
  await page.getByText('New document', { exact: false }).click()
  await expect(editor).not.toContainText('Round trip content')

  await page.getByRole('button', { name: 'File', exact: false }).click()
  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByText('Import', { exact: false }).click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({ name, mimeType: 'application/octet-stream', buffer })

  await expect(editor).toContainText('Round trip content')
}

test('exporting and re-importing a .docx round-trips the content', async ({ page }) => {
  await exportAndReimport(page, 'Word (.docx)')
})

test('exporting and re-importing an .odt round-trips the content', async ({ page }) => {
  await exportAndReimport(page, 'OpenDocument (.odt)')
})

test('exporting and re-importing an .html round-trips the content', async ({ page }) => {
  await exportAndReimport(page, 'HTML (.html)')
})
