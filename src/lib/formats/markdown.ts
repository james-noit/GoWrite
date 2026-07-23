import type { FormatDefinition } from '../../types'

export const markdownFormat: FormatDefinition = {
  id: 'md',
  label: 'Markdown (.md)',
  extension: 'md',
  mimeType: 'text/markdown',
  accept: '.md,.markdown,text/markdown',
  async importFile(file, editor) {
    const text = await file.text()
    editor.commands.setContent(text)
  },
  async exportContent(editor) {
    return new Blob([editor.storage.markdown.getMarkdown()], { type: 'text/markdown;charset=utf-8' })
  },
}
