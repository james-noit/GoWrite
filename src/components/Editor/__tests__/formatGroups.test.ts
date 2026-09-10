import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../../lib/formats/__tests__/testEditor'
import { formatGroups } from '../formatGroups'

function findButton(titleKey: string) {
  for (const group of formatGroups) {
    const button = group.buttons.find((b) => b.titleKey === titleKey)
    if (button) return button
  }
  throw new Error(`No button with titleKey ${titleKey}`)
}

describe('formatGroups', () => {
  it('bold: run toggles the mark, isActive tracks it', () => {
    const editor = createTestEditor()
    editor.commands.setContent('<p>hola</p>')
    editor.commands.selectAll()
    const bold = findButton('toolbar.bold')

    expect(bold.isActive!(editor)).toBe(false)
    bold.run(editor, (k) => k)
    expect(bold.isActive!(editor)).toBe(true)
    bold.run(editor, (k) => k)
    expect(bold.isActive!(editor)).toBe(false)
    editor.destroy()
  })

  it('h1/h2/h3: run toggles heading level, isActive is level-specific', () => {
    const editor = createTestEditor()
    editor.commands.setContent('<p>hola</p>')
    editor.commands.setTextSelection(1)
    const h1 = findButton('toolbar.h1')
    const h2 = findButton('toolbar.h2')

    h1.run(editor, (k) => k)
    expect(h1.isActive!(editor)).toBe(true)
    expect(h2.isActive!(editor)).toBe(false)
    expect(editor.getJSON().content?.[0].type).toBe('heading')

    // toggling the same level again turns it back into a paragraph
    h1.run(editor, (k) => k)
    expect(editor.getJSON().content?.[0].type).toBe('paragraph')
    editor.destroy()
  })

  it('bulletList/orderedList: run toggles list type', () => {
    const editor = createTestEditor()
    editor.commands.setContent('<p>uno</p>')
    editor.commands.setTextSelection(1)
    const bulletList = findButton('toolbar.bulletList')

    bulletList.run(editor, (k) => k)
    expect(bulletList.isActive!(editor)).toBe(true)
    expect(editor.getJSON().content?.[0].type).toBe('bulletList')
    editor.destroy()
  })

  it('alignLeft/Center/Right/Justify: run sets textAlign, isActive matches only the active one', () => {
    const editor = createTestEditor()
    editor.commands.setContent('<p>hola</p>')
    editor.commands.setTextSelection(1)
    const alignCenter = findButton('toolbar.alignCenter')
    const alignRight = findButton('toolbar.alignRight')

    alignCenter.run(editor, (k) => k)
    expect(alignCenter.isActive!(editor)).toBe(true)
    expect(alignRight.isActive!(editor)).toBe(false)
    expect(editor.getJSON().content?.[0].attrs?.textAlign).toBe('center')
    editor.destroy()
  })

  it('link: prompts for a URL and sets it; toggling again on an active link unsets it without prompting', () => {
    const editor = createTestEditor()
    editor.commands.setContent('<p>hola</p>')
    editor.commands.setTextSelection({ from: 1, to: 5 })
    const link = findButton('toolbar.link')

    const promptSpy = stubPrompt('https://example.com')
    link.run(editor, (k) => k)
    expect(editor.isActive('link')).toBe(true)
    expect(editor.getAttributes('link').href).toBe('https://example.com')
    promptSpy.restore()

    link.run(editor, (k) => k)
    expect(editor.isActive('link')).toBe(false)
    editor.destroy()
  })

  it('link: does nothing if the prompt is cancelled (returns null)', () => {
    const editor = createTestEditor()
    editor.commands.setContent('<p>hola</p>')
    editor.commands.setTextSelection({ from: 1, to: 5 })
    const link = findButton('toolbar.link')

    const promptSpy = stubPrompt(null)
    link.run(editor, (k) => k)
    expect(editor.isActive('link')).toBe(false)
    promptSpy.restore()
    editor.destroy()
  })
})

/** window.prompt isn't implemented in jsdom by default; stub it for the duration of one assertion. */
function stubPrompt(returnValue: string | null) {
  const original = window.prompt
  window.prompt = () => returnValue
  return {
    restore: () => {
      window.prompt = original
    },
  }
}
