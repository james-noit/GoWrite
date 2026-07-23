import type { JSONContent } from '@tiptap/core'
import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import mammoth from 'mammoth'
import type { FormatDefinition } from '../../types'

const HEADING_MAP = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
} as const

const ORDERED_LIST_REF = 'gowrite-ordered-list'
const INDENT_STEP = 480

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
    const run = new TextRun({
      text: node.text ?? '',
      bold: marks.some((m) => m.type === 'bold'),
      italics: marks.some((m) => m.type === 'italic'),
      strike: marks.some((m) => m.type === 'strike'),
      underline: marks.some((m) => m.type === 'underline') ? {} : undefined,
      font: marks.some((m) => m.type === 'code') ? 'Consolas' : undefined,
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

function blockToParagraphs(node: JSONContent, indent = 0): Paragraph[] {
  const indentOpt = indent > 0 ? { left: indent * INDENT_STEP } : undefined
  switch (node.type) {
    case 'paragraph':
      return [new Paragraph({ children: inlineToRuns(node.content), indent: indentOpt })]
    case 'heading': {
      const level = (node.attrs?.level ?? 1) as 1 | 2 | 3
      return [
        new Paragraph({
          heading: HEADING_MAP[level] ?? HeadingLevel.HEADING_1,
          children: inlineToRuns(node.content),
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
      return text.split('\n').map(
        (line) =>
          new Paragraph({
            children: [new TextRun({ text: line, font: 'Consolas' })],
            indent: indentOpt,
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
    const paragraphs = (json.content ?? []).flatMap((node) => blockToParagraphs(node))

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
      sections: [{ children: paragraphs.length ? paragraphs : [new Paragraph('')] }],
    })

    const blob = await Packer.toBlob(doc)
    return blob
  },
}
