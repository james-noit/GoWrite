import type { Editor, JSONContent } from '@tiptap/core'
import { describe, expect, it } from 'vitest'
import { createTestEditor } from '../../../lib/formats/__tests__/testEditor'
import { insertTableAction, tableEditActions } from '../tableActions'

function action(key: string) {
  const found = tableEditActions.find((a) => a.key === key)
  if (!found) throw new Error(`No table action with key ${key}`)
  return found
}

/** editor.getJSON()'s return type is a strict, schema-derived union in this Tiptap version, which
 * makes deep `.content[i].content` chains fight the type checker for no real benefit in a test —
 * cast once to the loose JSONContent shape instead. */
function firstTable(editor: Editor): JSONContent | undefined {
  return (editor.getJSON() as JSONContent).content?.find((n) => n.type === 'table')
}

describe('insertTableAction', () => {
  it('inserts a 3x3 table with a header row', () => {
    const editor = createTestEditor()
    editor.commands.setContent('<p></p>')
    insertTableAction.run(editor)

    const table = firstTable(editor)
    expect(table).toBeDefined()
    expect(table?.content).toHaveLength(3) // 3 rows
    expect(table?.content?.[0].content?.every((cell) => cell.type === 'tableHeader')).toBe(true)
    editor.destroy()
  })
})

describe('tableEditActions', () => {
  function editorWithTable() {
    const editor = createTestEditor()
    editor.commands.setContent('<p></p>')
    insertTableAction.run(editor)
    // put the cursor inside the first data cell (row 2, col 1)
    const firstDataCellPos = editor.state.doc.content.firstChild!.content.firstChild!.nodeSize + 3
    editor.commands.setTextSelection(firstDataCellPos)
    return editor
  }

  it('addColumn adds a column to every row', () => {
    const editor = editorWithTable()
    const before = firstTable(editor)?.content?.[0].content?.length
    action('addColumn').run(editor)
    const after = firstTable(editor)?.content?.[0].content?.length
    expect(after).toBe((before ?? 0) + 1)
    editor.destroy()
  })

  it('addRow adds a row to the table', () => {
    const editor = editorWithTable()
    const before = firstTable(editor)?.content?.length
    action('addRow').run(editor)
    const after = firstTable(editor)?.content?.length
    expect(after).toBe((before ?? 0) + 1)
    editor.destroy()
  })

  it('deleteColumn removes a column from every row', () => {
    const editor = editorWithTable()
    const before = firstTable(editor)?.content?.[0].content?.length
    action('deleteColumn').run(editor)
    const after = firstTable(editor)?.content?.[0].content?.length
    expect(after).toBe((before ?? 0) - 1)
    editor.destroy()
  })

  it('deleteRow removes a row from the table', () => {
    const editor = editorWithTable()
    const before = firstTable(editor)?.content?.length
    action('deleteRow').run(editor)
    const after = firstTable(editor)?.content?.length
    expect(after).toBe((before ?? 0) - 1)
    editor.destroy()
  })

  it('cellFormat toggles the current cell between tableCell and tableHeader; isActive reflects it', () => {
    const editor = editorWithTable()
    const cellFormat = action('cellFormat')
    expect(cellFormat.isActive!(editor)).toBe(false)
    cellFormat.run(editor)
    expect(cellFormat.isActive!(editor)).toBe(true)
    editor.destroy()
  })
})
