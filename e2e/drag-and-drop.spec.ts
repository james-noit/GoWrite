import { expect, test } from '@playwright/test'

/**
 * Drag-and-drop file import — deferred since Phase 1 (docs/angular-migration-plan.md §3 Track B)
 * because it needed the real drop-zone UI (Angular: gowriteDragAndDrop directive, Phase 6).
 * Playwright can't drag a real OS file, so the drop is simulated the documented way: build a
 * DataTransfer carrying a File *inside* the page via evaluateHandle, then dispatch the drag
 * events with it — this exercises the same `DataTransfer.types` / `.files` path a real OS drag
 * would populate, unlike constructing the event with a plain (JSON-serializable) eventInit.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('.ProseMirror').waitFor()
})

// Dispatched on .ProseMirror itself rather than a specific wrapper: React's drop zone is
// `.app-main` (an ancestor of `.editor-shell`) while Angular's is `.editor-scroll` (an ancestor of
// `.ProseMirror`, one level narrower than React's) — a real, minor structural difference between
// the two ports (Angular's `gowriteDragAndDrop` directive attaches to the scrollable content div,
// not the wider outer shell React's `useDragAndDrop` ref targets). Both listen via bubbling, so
// dispatching on `.ProseMirror` — inside both apps' drop zones — reaches either one identically.
const dragOverIndicator = '.editor-shell.is-drag-over, .editor-scroll.is-drag-over'

test('dropping a .txt file onto the editor imports it and updates the filename', async ({ page }) => {
  const dataTransfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer()
    const file = new File(['Dropped fixture content'], 'dropped.txt', { type: 'text/plain' })
    dt.items.add(file)
    return dt
  })

  const editor = page.locator('.ProseMirror')
  await editor.dispatchEvent('dragenter', { dataTransfer })
  await expect(page.locator(dragOverIndicator)).toBeVisible()
  await editor.dispatchEvent('drop', { dataTransfer })

  await expect(editor).toContainText('Dropped fixture content')
  await expect(page.getByTitle('Click to rename the document')).toHaveText('dropped.txt')
  await expect(page.locator(dragOverIndicator)).toHaveCount(0)
})

test('dragging over the editor without dropping shows and then clears the drag-over state', async ({ page }) => {
  const dataTransfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['x'], 'x.txt', { type: 'text/plain' }))
    return dt
  })

  const editor = page.locator('.ProseMirror')
  await editor.dispatchEvent('dragenter', { dataTransfer })
  await expect(page.locator(dragOverIndicator)).toBeVisible()

  await editor.dispatchEvent('dragleave', { dataTransfer })
  await expect(page.locator(dragOverIndicator)).toHaveCount(0)
})
