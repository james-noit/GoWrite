import { Editor } from '@tiptap/core'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { CodeBlockWithLanguageInput } from '../../../components/Editor/codeBlock'
import { FontSize } from '../../../components/Editor/fontSize'
import { Image } from '../../../components/Editor/image'

/** A headless Tiptap editor with the same extension set as the real app (see useGoWriteEditor.ts)
 * for exercising format import/export in tests. Keep this in sync with useGoWriteEditor.ts — a
 * drift here silently under-tests whatever extension was left out (this is how the table/image/
 * font-styling round-trip gap happened in the first place). */
export function createTestEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true }, codeBlock: false }),
      CodeBlockWithLanguageInput,
      Placeholder.configure({ placeholder: '' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Markdown.configure({ html: true, transformPastedText: false }),
      Image,
    ],
  })
}

export function fileFrom(blob: Blob, filename: string, type: string): File {
  return new File([blob], filename, { type })
}
