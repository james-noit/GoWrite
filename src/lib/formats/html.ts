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
    const style = `
      pre { background: #f0f0f0; border-radius: 4px; padding: 12px 14px; overflow-x: auto; }
      code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
      table { border-collapse: collapse; }
      td, th { border: 1px solid #999; padding: 6px 10px; }
      th { background: #f0f0f0; }
    `
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${style}</style></head><body>${editor.getHTML()}</body></html>`
    return new Blob([html], { type: 'text/html;charset=utf-8' })
  },
}
