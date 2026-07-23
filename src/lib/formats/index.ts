import type { Editor } from '@tiptap/core'
import type { FormatDefinition, FormatId } from '../../types'
import { docxFormat } from './docx'
import { htmlFormat } from './html'
import { markdownFormat } from './markdown'
import { odtFormat } from './odt'
import { txtFormat } from './txt'

export const formatRegistry: Record<FormatId, FormatDefinition> = {
  md: markdownFormat,
  txt: txtFormat,
  html: htmlFormat,
  docx: docxFormat,
  odt: odtFormat,
}

export const formatList = Object.values(formatRegistry)

export const importAccept = formatList.map((f) => f.accept).join(',')

export function formatForFilename(filename: string): FormatDefinition | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (!ext) return null
  return formatList.find((f) => f.extension === ext) ?? null
}

export async function importFile(file: File, editor: Editor): Promise<FormatDefinition> {
  const format = formatForFilename(file.name)
  if (!format) {
    throw new Error(`Formato no soportado: ${file.name}`)
  }
  await format.importFile(file, editor)
  return format
}

export async function exportAs(format: FormatDefinition, editor: Editor, filename: string): Promise<void> {
  const blob = await format.exportContent(editor)
  const baseName = filename.replace(/\.[^./]+$/, '') || 'documento'
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${baseName}.${format.extension}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
