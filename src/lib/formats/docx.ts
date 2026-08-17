import type { JSONContent } from '@tiptap/core'
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import mammoth from 'mammoth'
import type { FormatDefinition } from '../../types'

const HEADING_MAP = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
} as const

const ALIGN_MAP: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
}

function alignmentOf(node: JSONContent) {
  const align = node.attrs?.textAlign as string | undefined
  return align ? ALIGN_MAP[align] : undefined
}

const ORDERED_LIST_REF = 'gowrite-ordered-list'
const INDENT_STEP = 480

function hexNoHash(hex?: string | null): string | undefined {
  if (!hex) return undefined
  return hex.replace('#', '').toUpperCase()
}

function inlineToRuns(nodes: JSONContent[] = []): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = []
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      runs.push(new TextRun({ break: 1 }))
      continue
    }
    if (node.type !== 'text') continue
    const marks = node.marks ?? []
    const linkMark = marks.find((m) => m.type === 'link')
    const textStyleMark = marks.find((m) => m.type === 'textStyle')
    const highlightMark = marks.find((m) => m.type === 'highlight')
    const color = hexNoHash(textStyleMark?.attrs?.color as string | undefined)
    const fontFamily = (textStyleMark?.attrs?.fontFamily as string | undefined)
      ?.split(',')[0]
      ?.replace(/["']/g, '')
      .trim()
    const fontSizePx = textStyleMark?.attrs?.fontSize as string | undefined
    const sizeHalfPoints = fontSizePx ? Math.round(parseFloat(fontSizePx) * 1.5) : undefined
    const highlightHex = hexNoHash(highlightMark?.attrs?.color as string | undefined)
    const run = new TextRun({
      text: node.text ?? '',
      bold: marks.some((m) => m.type === 'bold'),
      italics: marks.some((m) => m.type === 'italic'),
      strike: marks.some((m) => m.type === 'strike'),
      underline: marks.some((m) => m.type === 'underline') ? {} : undefined,
      font: fontFamily || (marks.some((m) => m.type === 'code') ? 'Consolas' : undefined),
      color,
      size: sizeHalfPoints,
      shading: highlightHex ? { fill: highlightHex, color: 'auto', type: ShadingType.CLEAR } : undefined,
    })
    runs.push(linkMark ? new ExternalHyperlink({ link: String(linkMark.attrs?.href ?? '#'), children: [run] }) : run)
  }
  return runs.length ? runs : [new TextRun('')]
}

function listToParagraphs(node: JSONContent, ordered: boolean, level: number): Paragraph[] {
  const items = node.content ?? []
  const paragraphs: Paragraph[] = []
  items.forEach((item, index) => {
    for (const child of item.content ?? []) {
      if (child.type === 'bulletList') {
        paragraphs.push(...listToParagraphs(child, false, level + 1))
      } else if (child.type === 'orderedList') {
        paragraphs.push(...listToParagraphs(child, true, level + 1))
      } else {
        paragraphs.push(
          new Paragraph({
            children: inlineToRuns(child.content),
            bullet: ordered ? undefined : { level },
            numbering: ordered ? { reference: ORDERED_LIST_REF, level } : undefined,
          }),
        )
      }
    }
    void index
  })
  return paragraphs
}

const HEADER_CELL_SHADING = { fill: 'E5E5E5', color: 'auto', type: ShadingType.CLEAR } as const

function tableToDocxTable(node: JSONContent): Table {
  const rows = (node.content ?? []).map((rowNode) => {
    const cells = (rowNode.content ?? []).map((cellNode) => {
      const cellChildren = (cellNode.content ?? []).flatMap((child) => blockToParagraphs(child))
      return new TableCell({
        children: cellChildren.length ? cellChildren : [new Paragraph('')],
        shading: cellNode.type === 'tableHeader' ? HEADER_CELL_SHADING : undefined,
      })
    })
    return new TableRow({ children: cells })
  })
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })
}

function blockToParagraphs(node: JSONContent, indent = 0): (Paragraph | Table)[] {
  const indentOpt = indent > 0 ? { left: indent * INDENT_STEP } : undefined
  switch (node.type) {
    case 'table':
      return [tableToDocxTable(node)]
    case 'paragraph':
      return [new Paragraph({ children: inlineToRuns(node.content), indent: indentOpt, alignment: alignmentOf(node) })]
    case 'heading': {
      const level = (node.attrs?.level ?? 1) as 1 | 2 | 3
      return [
        new Paragraph({
          heading: HEADING_MAP[level] ?? HeadingLevel.HEADING_1,
          children: inlineToRuns(node.content),
          alignment: alignmentOf(node),
        }),
      ]
    }
    case 'blockquote':
      return (node.content ?? []).flatMap((child) => blockToParagraphs(child, indent + 1))
    case 'bulletList':
      return listToParagraphs(node, false, indent)
    case 'orderedList':
      return listToParagraphs(node, true, indent)
    case 'codeBlock': {
      const text = (node.content ?? []).map((t) => t.text ?? '').join('')
      const lines = text.split('\n')
      return lines.map(
        (line, i) =>
          new Paragraph({
            children: [new TextRun({ text: line || ' ', font: 'Consolas' })],
            indent: indentOpt,
            shading: { fill: 'F0F0F0', color: 'auto', type: ShadingType.CLEAR },
            spacing: { before: i === 0 ? 60 : 0, after: i === lines.length - 1 ? 60 : 0 },
          }),
      )
    }
    case 'horizontalRule':
      return [new Paragraph({ children: [new TextRun({ text: '───────────' })] })]
    default:
      return node.content ? node.content.flatMap((child) => blockToParagraphs(child, indent)) : []
  }
}

export const docxFormat: FormatDefinition = {
  id: 'docx',
  label: 'Word (.docx)',
  extension: 'docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  accept: '.docx',
  async importFile(file, editor) {
    const arrayBuffer = await file.arrayBuffer()
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer })
    editor.commands.setContent(html)
  },
  async exportContent(editor) {
    const json = editor.getJSON()
    const children = (json.content ?? []).flatMap((node) => blockToParagraphs(node))

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: ORDERED_LIST_REF,
            levels: [0, 1, 2].map((level) => ({
              level,
              format: LevelFormat.DECIMAL,
              text: `%${level + 1}.`,
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: (level + 1) * INDENT_STEP, hanging: 360 } } },
            })),
          },
        ],
      },
      sections: [{ children: children.length ? children : [new Paragraph('')] }],
    })

    const blob = await Packer.toBlob(doc)
    return blob
  },
}
