import type { FormatDefinition } from '../../types'

export const htmlFormat: FormatDefinition = {
  id: 'html',
  label: 'HTML (.html)',
  extension: 'html',
  mimeType: 'text/html',
  accept: '.html,.htm,text/html',
  async importFile(file, editor) {
    const text = await file.text()
    // A full HTML document (as produced by our own export, or any other editor/browser "save as
    // HTML") parses through <head>/whitespace as stray empty paragraphs if handed to the editor
    // as-is — extract just the body markup first.
    const parsed = new DOMParser().parseFromString(text, 'text/html')
    editor.commands.setContent(parsed.body.innerHTML)
  },
  async exportContent(editor) {
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>${editor.getHTML()}</body></html>`
    return new Blob([html], { type: 'text/html;charset=utf-8' })
  },
}
