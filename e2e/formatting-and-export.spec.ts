import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('.ProseMirror').waitFor()
})

test('bold button toggles the mark on selected text', async ({ page }) => {
  const editor = page.locator('.ProseMirror')
  await editor.click()
  await page.keyboard.type('hola mundo')
  await page.keyboard.press('Control+A')

  const bold = page.getByTitle('Bold', { exact: true })
  await bold.click()
  await expect(editor.locator('strong')).toHaveText('hola mundo')

  await bold.click()
  await expect(editor.locator('strong')).toHaveCount(0)
})

test('heading buttons change the block type', async ({ page }) => {
  const editor = page.locator('.ProseMirror')
  await editor.click()
  await page.keyboard.type('Section title')
  await page.keyboard.press('Control+A')

  await page.getByTitle('Heading 1', { exact: true }).click()
  await expect(editor.locator('h1')).toHaveText('Section title')
})

test('exporting as Markdown downloads a .md file with the typed content', async ({ page }) => {
  const editor = page.locator('.ProseMirror')
  await editor.click()
  await page.keyboard.type('Exported content')

  await page.getByRole('button', { name: 'File', exact: false }).click()
  await page.getByText('Export as', { exact: false }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByText('Markdown (.md)', { exact: false }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toMatch(/\.md$/)
  const downloadPath = await download.path()
  const content = await fs.readFile(downloadPath!, 'utf-8')
  expect(content).toContain('Exported content')
})

test('importing a .txt file replaces the editor content', async ({ page }) => {
  const fixture = path.join(__dirname, 'fixtures', 'sample.txt')

  await page.getByRole('button', { name: 'File', exact: false }).click()
  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByText('Import', { exact: false }).click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(fixture)

  await expect(page.locator('.ProseMirror')).toContainText('Imported fixture content')
})

test('theme toggle switches the document theme attribute and persists across reload', async ({ page }) => {
  const getTheme = () => page.evaluate(() => document.documentElement.dataset.theme)

  await page.getByRole('button', { name: 'File', exact: false }).click()
  await page.getByText('Settings', { exact: false }).click()

  const before = await getTheme()
  await page.getByRole('switch').click()
  // Angular's ThemeService syncs `document.documentElement.dataset.theme` from an effect(), which
  // (unlike React's synchronous state commit) can land a tick after the click event itself under
  // zoneless change detection — poll rather than reading the DOM the instant the click resolves.
  await expect.poll(getTheme).not.toBe(before)
  const after = await getTheme()

  await page.reload()
  await expect.poll(getTheme).toBe(after)
})

test('locale toggle switches UI text and persists across reload', async ({ page }) => {
  await page.getByRole('button', { name: 'File', exact: false }).click()
  await page.getByText('Settings', { exact: false }).click()

  await page.getByText('ES', { exact: true }).click()
  await page.getByRole('tab', { name: /IA/ }).click()
  await expect(page.getByText('Configurar proveedor')).toBeVisible()

  await page.reload()
  // The FileMenu button's own accessible name is now in Spanish too, so target it by class.
  await page.locator('.header-btn').click()
  await expect(page.getByText('Ajustes', { exact: false })).toBeVisible() // "Settings" in Spanish
})
