import JSZip from 'jszip'
import { beforeEach, describe, expect, it } from 'vitest'
import { docxFormat } from '../docx'
import { htmlFormat } from '../html'
import { markdownFormat } from '../markdown'
import { odtFormat } from '../odt'
import { txtFormat } from '../txt'
import { createTestEditor, fileFrom } from './testEditor'

const SOURCE_HTML =
  '<h1>Título de prueba</h1><p>Un párrafo con <strong>negrita</strong> y <em>cursiva</em>.</p><ul><li><p>Primer elemento</p></li><li><p>Segundo elemento</p></li></ul>'

describe('format round-trips', () => {
  let sourceEditor: ReturnType<typeof createTestEditor>

  beforeEach(() => {
    sourceEditor = createTestEditor()
    sourceEditor.commands.setContent(SOURCE_HTML)
  })

  it('markdown preserves heading, bold, italic and list structure', async () => {
    const blob = await markdownFormat.exportContent(sourceEditor)
    const text = await blob.text()
    expect(text).toContain('# Título de prueba')
    expect(text).toMatch(/\*\*negrita\*\*/)
    expect(text).toMatch(/\*cursiva\*/)

    const roundTripped = createTestEditor()
    await markdownFormat.importFile(fileFrom(blob, 'doc.md', 'text/markdown'), roundTripped)
    expect(roundTripped.getJSON()).toEqual(sourceEditor.getJSON())
    roundTripped.destroy()
  })

  it('html preserves the full structure byte-for-byte in the editor model', async () => {
    const blob = await htmlFormat.exportContent(sourceEditor)
    const roundTripped = createTestEditor()
    await htmlFormat.importFile(fileFrom(blob, 'doc.html', 'text/html'), roundTripped)
    expect(roundTripped.getJSON()).toEqual(sourceEditor.getJSON())
    roundTripped.destroy()
  })

  it('txt keeps the words (formatting is necessarily lost)', async () => {
    const blob = await txtFormat.exportContent(sourceEditor)
    const text = await blob.text()
    expect(text).toContain('Título de prueba')
    expect(text).toContain('negrita')
    expect(text).toContain('Primer elemento')

    const roundTripped = createTestEditor()
    await txtFormat.importFile(fileFrom(blob, 'doc.txt', 'text/plain'), roundTripped)
    expect(roundTripped.getText()).toContain('Título de prueba')
    roundTripped.destroy()
  })

  // docx *import* goes through mammoth's browser-only zip reader (swapped in via package.json's
  // "browser" field), which Node-based test runners don't exercise the same way a real browser
  // build does — that path is covered by manual verification instead. Here we check what our own
  // docx.ts export code is responsible for: the generated document.xml actually contains the
  // heading, the bold/italic runs and both list items.
  it('docx export produces a valid zip with heading, bold, italic and list items', async () => {
    const blob = await docxFormat.exportContent(sourceEditor)
    expect(blob.size).toBeGreaterThan(0)

    const zip = await JSZip.loadAsync(blob)
    const documentXml = await zip.file('word/document.xml')!.async('text')

    expect(documentXml).toContain('Título de prueba')
    expect(documentXml).toMatch(/<w:b\s*\/>/)
    expect(documentXml).toMatch(/<w:i\s*\/>/)
    expect(documentXml).toContain('negrita')
    expect(documentXml).toContain('cursiva')
    expect(documentXml).toContain('Primer elemento')
    expect(documentXml).toContain('Segundo elemento')
  })

  it('odt round-trip preserves heading, bold, italic and list items', async () => {
    const blob = await odtFormat.exportContent(sourceEditor)
    expect(blob.size).toBeGreaterThan(0)

    const roundTripped = createTestEditor()
    await odtFormat.importFile(fileFrom(blob, 'doc.odt', blob.type), roundTripped)
    const json = roundTripped.getJSON()

    expect(roundTripped.getText()).toContain('Título de prueba')
    expect(JSON.stringify(json)).toContain('"type":"bold"')
    expect(JSON.stringify(json)).toContain('"type":"italic"')
    expect(roundTripped.getText()).toContain('Primer elemento')
    expect(roundTripped.getText()).toContain('Segundo elemento')
    roundTripped.destroy()
  })
})
