import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core'
import JSZip from 'jszip'
import { collectImageSizes, decodeDataUrl, extensionForMime } from './imageUtils'

const PX_TO_CM = 2.54 / 96

interface OdtImageEntry {
  fileName: string
  mime: string
  widthCm: number
  heightCm: number
}

const NS = {
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  style: 'urn:oasis:names:tc:opendocument:xmlns:style:1.0',
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  fo: 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0',
  xlink: 'http://www.w3.org/1999/xlink',
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------- import: .odt -> HTML ----------

interface CharStyleFlags {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  color?: string
  fontFamily?: string
  fontSize?: string
  highlight?: string
}

function ptToPx(pt: string): string {
  const match = /^([\d.]+)pt$/.exec(pt.trim())
  if (!match) return pt
  return `${Math.round(parseFloat(match[1]) * (96 / 72))}px`
}

function collectCharStyles(xmlDoc: Document): Map<string, CharStyleFlags> {
  const map = new Map<string, CharStyleFlags>()
  const styles = xmlDoc.getElementsByTagNameNS(NS.style, 'style')
  for (let i = 0; i < styles.length; i++) {
    const styleEl = styles[i]
    if (styleEl.getAttributeNS(NS.style, 'family') !== 'text') continue
    const name = styleEl.getAttributeNS(NS.style, 'name')
    if (!name) continue
    const props = styleEl.getElementsByTagNameNS(NS.style, 'text-properties')[0]
    if (!props) continue
    const underlineStyle = props.getAttributeNS(NS.style, 'text-underline-style')
    const strikeStyle = props.getAttributeNS(NS.style, 'text-line-through-style')
    const fontSize = props.getAttributeNS(NS.fo, 'font-size')
    map.set(name, {
      bold: props.getAttributeNS(NS.fo, 'font-weight') === 'bold',
      italic: props.getAttributeNS(NS.fo, 'font-style') === 'italic',
      underline: !!underlineStyle && underlineStyle !== 'none',
      strike: !!strikeStyle && strikeStyle !== 'none',
      color: props.getAttributeNS(NS.fo, 'color') || undefined,
      fontFamily: props.getAttributeNS(NS.style, 'font-name') || undefined,
      fontSize: fontSize ? ptToPx(fontSize) : undefined,
      highlight: props.getAttributeNS(NS.fo, 'background-color') || undefined,
    })
  }
  return map
}

const CSS_ALIGN: Record<string, string> = {
  start: 'left',
  left: 'left',
  end: 'right',
  right: 'right',
  center: 'center',
  justify: 'justify',
}

function collectParaAlign(xmlDoc: Document): Map<string, string> {
  const map = new Map<string, string>()
  const styles = xmlDoc.getElementsByTagNameNS(NS.style, 'style')
  for (let i = 0; i < styles.length; i++) {
    const styleEl = styles[i]
    if (styleEl.getAttributeNS(NS.style, 'family') !== 'paragraph') continue
    const name = styleEl.getAttributeNS(NS.style, 'name')
    if (!name) continue
    const props = styleEl.getElementsByTagNameNS(NS.style, 'paragraph-properties')[0]
    const align = props?.getAttributeNS(NS.fo, 'text-align')
    if (align && CSS_ALIGN[align]) map.set(name, CSS_ALIGN[align])
  }
  return map
}

function collectListKinds(xmlDoc: Document): Map<string, 'bullet' | 'number'> {
  const map = new Map<string, 'bullet' | 'number'>()
  const listStyles = xmlDoc.getElementsByTagNameNS(NS.text, 'list-style')
  for (let i = 0; i < listStyles.length; i++) {
    const el = listStyles[i]
    const name = el.getAttributeNS(NS.style, 'name')
    if (!name) continue
    const hasNumber = el.getElementsByTagNameNS(NS.text, 'list-level-style-number').length > 0
    map.set(name, hasNumber ? 'number' : 'bullet')
  }
  return map
}

function wrapWithFlags(inner: string, flags: CharStyleFlags): string {
  let html = inner
  if (flags.bold) html = `<strong>${html}</strong>`
  if (flags.italic) html = `<em>${html}</em>`
  if (flags.underline) html = `<u>${html}</u>`
  if (flags.strike) html = `<s>${html}</s>`
  const styleParts: string[] = []
  if (flags.color) styleParts.push(`color: ${flags.color}`)
  if (flags.fontFamily) styleParts.push(`font-family: ${flags.fontFamily}`)
  if (flags.fontSize) styleParts.push(`font-size: ${flags.fontSize}`)
  if (styleParts.length) html = `<span style="${escapeXml(styleParts.join('; '))}">${html}</span>`
  if (flags.highlight) {
    html = `<mark data-color="${escapeXml(flags.highlight)}" style="background-color: ${escapeXml(flags.highlight)}">${html}</mark>`
  }
  return html
}

function inlineNodeToHtml(node: ChildNode, charStyles: Map<string, CharStyleFlags>): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeXml(node.textContent ?? '')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const el = node as Element
  const local = el.localName

  if (local === 'line-break') return '<br>'
  if (local === 's') return ' '
  if (local === 'tab') return '\t'

  const childrenHtml = Array.from(el.childNodes)
    .map((child) => inlineNodeToHtml(child, charStyles))
    .join('')

  if (local === 'span') {
    const styleName = el.getAttributeNS(NS.text, 'style-name') ?? ''
    const flags = charStyles.get(styleName) ?? {}
    return wrapWithFlags(childrenHtml, flags)
  }
  if (local === 'a') {
    const href = el.getAttributeNS(NS.xlink, 'href') ?? '#'
    return `<a href="${escapeXml(href)}">${childrenHtml}</a>`
  }
  return childrenHtml
}

/** Gathers a table's rows in document order, flattening any <table:table-header-rows> wrapper
 * and recording how many leading rows came from it (so their cells can be rendered as <th>). */
function collectTableRows(tableEl: Element): { rows: Element[]; headerRowCount: number } {
  const rows: Element[] = []
  let headerRowCount = 0
  for (const child of Array.from(tableEl.children)) {
    if (child.localName === 'table-header-rows') {
      const headerRows = Array.from(child.children).filter((c) => c.localName === 'table-row')
      rows.push(...headerRows)
      headerRowCount += headerRows.length
    } else if (child.localName === 'table-row') {
      rows.push(child)
    }
  }
  return { rows, headerRowCount }
}

function blockNodeToHtml(
  node: Element,
  charStyles: Map<string, CharStyleFlags>,
  listKinds: Map<string, 'bullet' | 'number'>,
  paraAlign: Map<string, string>,
): string {
  const local = node.localName
  const inline = () =>
    Array.from(node.childNodes)
      .map((child) => inlineNodeToHtml(child, charStyles))
      .join('')
  const alignAttr = () => {
    const styleName = node.getAttributeNS(NS.text, 'style-name') ?? ''
    const align = paraAlign.get(styleName)
    return align ? ` style="text-align: ${align}"` : ''
  }

  if (local === 'h') {
    const level = Math.min(3, Math.max(1, Number(node.getAttributeNS(NS.text, 'outline-level') ?? '1')))
    return `<h${level}${alignAttr()}>${inline() || '<br>'}</h${level}>`
  }
  if (local === 'p') {
    return `<p${alignAttr()}>${inline() || '<br>'}</p>`
  }
  if (local === 'list') {
    const styleName = node.getAttributeNS(NS.text, 'style-name') ?? ''
    const kind = listKinds.get(styleName) ?? 'bullet'
    const tag = kind === 'number' ? 'ol' : 'ul'
    const items = Array.from(node.children)
      .filter((child) => child.localName === 'list-item')
      .map((item) => {
        const inner = Array.from(item.children)
          .map((child) => blockNodeToHtml(child, charStyles, listKinds, paraAlign))
          .join('')
        return `<li>${inner}</li>`
      })
      .join('')
    return `<${tag}>${items}</${tag}>`
  }
  if (local === 'table') {
    const { rows, headerRowCount } = collectTableRows(node)
    const rowsHtml = rows
      .map((rowEl, rowIndex) => {
        const isHeaderRow = rowIndex < headerRowCount
        const cellsHtml = Array.from(rowEl.children)
          .filter((c) => c.localName === 'table-cell')
          .map((cellEl) => {
            const blocks = Array.from(cellEl.children).filter((c) => c.localName === 'p' || c.localName === 'h')
            const innerHtml = blocks.map((b) => blockNodeToHtml(b, charStyles, listKinds, paraAlign)).join('') || '<p></p>'
            const isHeaderCell =
              isHeaderRow || blocks.some((b) => b.getAttributeNS(NS.text, 'style-name') === 'TableHeader')
            const tag = isHeaderCell ? 'th' : 'td'
            return `<${tag}>${innerHtml}</${tag}>`
          })
          .join('')
        return `<tr>${cellsHtml}</tr>`
      })
      .join('')
    return `<table><tbody>${rowsHtml}</tbody></table>`
  }
  // unknown container: recurse into element children
  return Array.from(node.children)
    .map((child) => blockNodeToHtml(child, charStyles, listKinds, paraAlign))
    .join('')
}

async function odtToHtml(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file)
  const contentXml = await zip.file('content.xml')?.async('text')
  if (!contentXml) throw new Error('El archivo .odt no contiene content.xml')

  const xmlDoc = new DOMParser().parseFromString(contentXml, 'application/xml')
  const charStyles = collectCharStyles(xmlDoc)
  const listKinds = collectListKinds(xmlDoc)
  const paraAlign = collectParaAlign(xmlDoc)

  const bodyText = xmlDoc.getElementsByTagNameNS(NS.office, 'text')[0]
  if (!bodyText) return '<p></p>'

  return Array.from(bodyText.children)
    .map((child) => blockNodeToHtml(child, charStyles, listKinds, paraAlign))
    .join('')
}

// ---------- export: editor JSON -> .odt ----------

const LIST_STYLE_XML = `
<text:list-style style:name="LB">
  <text:list-level-style-bullet text:level="1" text:bullet-char="•"><style:list-level-properties text:space-before="0.25in"/></text:list-level-style-bullet>
  <text:list-level-style-bullet text:level="2" text:bullet-char="◦"><style:list-level-properties text:space-before="0.5in"/></text:list-level-style-bullet>
  <text:list-level-style-bullet text:level="3" text:bullet-char="▪"><style:list-level-properties text:space-before="0.75in"/></text:list-level-style-bullet>
</text:list-style>
<text:list-style style:name="LN">
  <text:list-level-style-number text:level="1" style:num-format="1" text:num-suffix="."><style:list-level-properties text:space-before="0.25in"/></text:list-level-style-number>
  <text:list-level-style-number text:level="2" style:num-format="1" text:num-suffix="."><style:list-level-properties text:space-before="0.5in"/></text:list-level-style-number>
  <text:list-level-style-number text:level="3" style:num-format="1" text:num-suffix="."><style:list-level-properties text:space-before="0.75in"/></text:list-level-style-number>
</text:list-style>`

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="${NS.office}" xmlns:style="${NS.style}" xmlns:text="${NS.text}" xmlns:fo="${NS.fo}" office:version="1.2">
  <office:styles>
    <style:style style:name="Standard" style:family="paragraph"/>
    <style:style style:name="Heading_1" style:display-name="Heading 1" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties fo:font-size="24pt" fo:font-weight="bold"/></style:style>
    <style:style style:name="Heading_2" style:display-name="Heading 2" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties fo:font-size="18pt" fo:font-weight="bold"/></style:style>
    <style:style style:name="Heading_3" style:display-name="Heading 3" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties fo:font-size="14pt" fo:font-weight="bold"/></style:style>
    <style:style style:name="Quotations" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-left="0.5in"/><style:text-properties fo:font-style="italic"/></style:style>
    <style:style style:name="Preformatted_Text" style:display-name="Preformatted Text" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:background-color="#F0F0F0"/><style:text-properties style:font-name="Consolas" fo:background-color="#F0F0F0"/></style:style>
    <style:style style:name="TableHeader" style:family="paragraph" style:parent-style-name="Standard"><style:text-properties fo:font-weight="bold"/></style:style>
  </office:styles>
</office:document-styles>`

function buildManifestXml(images: OdtImageEntry[]): string {
  const imageEntries = images
    .map((img) => `  <manifest:file-entry manifest:full-path="Pictures/${img.fileName}" manifest:media-type="${img.mime}"/>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
${imageEntries}
</manifest:manifest>`
}

const ODT_ALIGN: Record<string, string> = {
  left: 'start',
  center: 'center',
  right: 'end',
  justify: 'justify',
}

type Mark = { type: string; attrs?: Record<string, unknown> }

function buildContentXml(json: JSONContent, images: Map<string, OdtImageEntry>): string {
  const charStyleMap = new Map<string, string>()
  const charStyleDefs: string[] = []
  const paraStyleMap = new Map<string, string>()
  const paraStyleDefs: string[] = []
  let tableCount = 0
  let frameCount = 0

  function styleForAlign(baseStyle: string, textAlign: string | undefined): string {
    if (!textAlign || !ODT_ALIGN[textAlign]) return baseStyle
    const key = `${baseStyle}:${textAlign}`
    const existing = paraStyleMap.get(key)
    if (existing) return existing
    const name = `${baseStyle}_A${paraStyleMap.size}`
    paraStyleMap.set(key, name)
    paraStyleDefs.push(
      `<style:style style:name="${name}" style:family="paragraph" style:parent-style-name="${baseStyle}"><style:paragraph-properties fo:text-align="${ODT_ALIGN[textAlign]}"/></style:style>`,
    )
    return name
  }

  function getOrCreateCharStyle(marks: Mark[]): string {
    const key = marks
      .map((m) => `${m.type}:${JSON.stringify(m.attrs ?? {})}`)
      .sort()
      .join('|')
    const existing = charStyleMap.get(key)
    if (existing) return existing
    const name = `Tc${charStyleMap.size}`
    charStyleMap.set(key, name)
    const bold = marks.some((m) => m.type === 'bold')
    const italic = marks.some((m) => m.type === 'italic')
    const underline = marks.some((m) => m.type === 'underline')
    const strike = marks.some((m) => m.type === 'strike')
    const code = marks.some((m) => m.type === 'code')
    const textStyleMark = marks.find((m) => m.type === 'textStyle')
    const highlightMark = marks.find((m) => m.type === 'highlight')
    const color = textStyleMark?.attrs?.color as string | undefined
    const fontFamily = (textStyleMark?.attrs?.fontFamily as string | undefined)
      ?.split(',')[0]
      ?.replace(/["']/g, '')
      .trim()
    const fontSize = textStyleMark?.attrs?.fontSize as string | undefined
    const fontSizePt = fontSize ? `${(parseFloat(fontSize) * 0.75).toFixed(2)}pt` : undefined
    const highlightColor = highlightMark?.attrs?.color as string | undefined
    const props = [
      bold ? 'fo:font-weight="bold"' : '',
      italic ? 'fo:font-style="italic"' : '',
      underline ? 'style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"' : '',
      strike ? 'style:text-line-through-style="solid"' : '',
      code ? 'style:font-name="Consolas"' : '',
      fontFamily ? `style:font-name="${escapeXml(fontFamily)}"` : '',
      color ? `fo:color="${escapeXml(color)}"` : '',
      fontSizePt ? `fo:font-size="${fontSizePt}"` : '',
      highlightColor ? `fo:background-color="${escapeXml(highlightColor)}"` : '',
    ]
      .filter(Boolean)
      .join(' ')
    charStyleDefs.push(`<style:style style:name="${name}" style:family="text"><style:text-properties ${props}/></style:style>`)
    return name
  }

  function inlineToOdt(nodes: JSONContent[] = []): string {
    return nodes
      .map((node) => {
        if (node.type === 'hardBreak') return '<text:line-break/>'
        if (node.type !== 'text') return ''
        const marks = (node.marks ?? []) as Mark[]
        const text = escapeXml(node.text ?? '')
        const linkMark = marks.find((m) => m.type === 'link')
        const styleMarks = marks.filter((m) => m.type !== 'link')
        let inner = text
        if (styleMarks.length) {
          const styleName = getOrCreateCharStyle(styleMarks)
          inner = `<text:span text:style-name="${styleName}">${inner}</text:span>`
        }
        if (linkMark) {
          const href = escapeXml(String(linkMark.attrs?.href ?? '#'))
          inner = `<text:a xlink:href="${href}" xlink:type="simple">${inner}</text:a>`
        }
        return inner
      })
      .join('')
  }

  function listToOdt(node: JSONContent, styleName: 'LB' | 'LN'): string {
    const items = (node.content ?? [])
      .map((item) => {
        const inner = (item.content ?? [])
          .map((child) => {
            if (child.type === 'bulletList') return listToOdt(child, 'LB')
            if (child.type === 'orderedList') return listToOdt(child, 'LN')
            return blockToOdt(child, 'Standard')
          })
          .join('')
        return `<text:list-item>${inner}</text:list-item>`
      })
      .join('')
    return `<text:list text:style-name="${styleName}">${items}</text:list>`
  }

  function tableToOdt(node: JSONContent): string {
    tableCount += 1
    const tableName = `Table${tableCount}`
    const columnCount = (node.content?.[0]?.content ?? []).length
    const columnsXml = columnCount > 0 ? `<table:table-column table:number-columns-repeated="${columnCount}"/>` : ''

    const rows = node.content ?? []
    const headerRows = rows.filter((row) => (row.content ?? []).every((cell) => cell.type === 'tableHeader'))
    const bodyRows = rows.filter((row) => !(row.content ?? []).every((cell) => cell.type === 'tableHeader'))

    const rowToOdt = (row: JSONContent) => {
      const cellsXml = (row.content ?? [])
        .map((cell) => {
          const isHeader = cell.type === 'tableHeader'
          const cellBody = (cell.content ?? [])
            .map((child) => blockToOdt(child, isHeader ? 'TableHeader' : 'Standard'))
            .join('')
          return `<table:table-cell office:value-type="string">${cellBody || '<text:p/>'}</table:table-cell>`
        })
        .join('')
      return `<table:table-row>${cellsXml}</table:table-row>`
    }

    const headerXml = headerRows.length
      ? `<table:table-header-rows>${headerRows.map(rowToOdt).join('')}</table:table-header-rows>`
      : ''
    const bodyXml = bodyRows.map(rowToOdt).join('')

    return `<table:table table:name="${tableName}">${columnsXml}${headerXml}${bodyXml}</table:table>`
  }

  function blockToOdt(node: JSONContent, paragraphStyle: string): string {
    switch (node.type) {
      case 'paragraph': {
        const styleName = styleForAlign(paragraphStyle, node.attrs?.textAlign as string | undefined)
        return `<text:p text:style-name="${styleName}">${inlineToOdt(node.content) || ''}</text:p>`
      }
      case 'heading': {
        const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)))
        const styleName = styleForAlign(`Heading_${level}`, node.attrs?.textAlign as string | undefined)
        return `<text:h text:style-name="${styleName}" text:outline-level="${level}">${inlineToOdt(node.content)}</text:h>`
      }
      case 'blockquote':
        return (node.content ?? []).map((child) => blockToOdt(child, 'Quotations')).join('')
      case 'bulletList':
        return listToOdt(node, 'LB')
      case 'orderedList':
        return listToOdt(node, 'LN')
      case 'table':
        return tableToOdt(node)
      case 'image': {
        const src = node.attrs?.src as string | undefined
        const entry = src ? images.get(src) : undefined
        if (!entry) return ''
        frameCount += 1
        const align = (node.attrs?.align as string | undefined) ?? 'center'
        const styleName = styleForAlign('Standard', align === 'left' || align === 'right' ? align : undefined)
        const frame = `<draw:frame draw:name="Image${frameCount}" svg:width="${entry.widthCm.toFixed(3)}cm" svg:height="${entry.heightCm.toFixed(3)}cm" text:anchor-type="as-char"><draw:image xlink:href="Pictures/${entry.fileName}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>`
        const caption = node.attrs?.caption as string | undefined
        const captionXml = caption
          ? `<text:p text:style-name="Standard">${escapeXml(caption)}</text:p>`
          : ''
        return `<text:p text:style-name="${styleName}">${frame}</text:p>${captionXml}`
      }
      case 'codeBlock': {
        const text = (node.content ?? []).map((t) => t.text ?? '').join('')
        return text
          .split('\n')
          .map((line) => `<text:p text:style-name="Preformatted_Text">${escapeXml(line)}</text:p>`)
          .join('')
      }
      case 'horizontalRule':
        return `<text:p text:style-name="Standard">───────────</text:p>`
      default:
        return (node.content ?? []).map((child) => blockToOdt(child, paragraphStyle)).join('')
    }
  }

  const bodyXml = (json.content ?? []).map((node) => blockToOdt(node, 'Standard')).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="${NS.office}" xmlns:style="${NS.style}" xmlns:text="${NS.text}" xmlns:table="${NS.table}" xmlns:fo="${NS.fo}" xmlns:xlink="${NS.xlink}" office:version="1.2">
  <office:automatic-styles>
    ${charStyleDefs.join('\n    ')}
    ${paraStyleDefs.join('\n    ')}
    ${LIST_STYLE_XML}
  </office:automatic-styles>
  <office:body>
    <office:text>${bodyXml}</office:text>
  </office:body>
</office:document-content>`
}

export async function importOdt(file: File, editor: TiptapEditor): Promise<void> {
  const html = await odtToHtml(file)
  editor.commands.setContent(html)
}

/** Decodes every distinct image src in the doc, resolves its natural size, and stages it for the
 * zip under Pictures/ — ODT requires images to be embedded package assets, not data URIs. */
async function prepareOdtImages(json: JSONContent): Promise<{ images: Map<string, OdtImageEntry>; files: Map<string, Uint8Array> }> {
  const naturalSizes = await collectImageSizes(json)
  const images = new Map<string, OdtImageEntry>()
  const files = new Map<string, Uint8Array>()

  const srcs = new Set<string>()
  const walk = (node: JSONContent) => {
    if (node.type === 'image' && typeof node.attrs?.src === 'string') srcs.add(node.attrs.src)
    node.content?.forEach(walk)
  }
  walk(json)

  let count = 0
  for (const src of srcs) {
    const decoded = decodeDataUrl(src)
    if (!decoded) continue
    count += 1
    const ext = extensionForMime(decoded.mime)
    const fileName = `img${count}.${ext}`
    const natural = naturalSizes.get(src) ?? { width: 300, height: 200 }
    const width = Math.min(natural.width, 600)
    const height = Math.round(natural.height * (width / natural.width))
    images.set(src, { fileName, mime: decoded.mime, widthCm: width * PX_TO_CM, heightCm: height * PX_TO_CM })
    files.set(fileName, decoded.bytes)
  }

  return { images, files }
}

export async function exportOdt(editor: TiptapEditor): Promise<Blob> {
  const json = editor.getJSON()
  const { images, files } = await prepareOdtImages(json)

  const zip = new JSZip()
  zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' })
  zip.folder('META-INF')?.file('manifest.xml', buildManifestXml(Array.from(images.values())))
  zip.file('styles.xml', STYLES_XML)
  zip.file('content.xml', buildContentXml(json, images))
  const pictures = zip.folder('Pictures')
  for (const [fileName, bytes] of files) {
    pictures?.file(fileName, bytes)
  }
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.oasis.opendocument.text' })
}
