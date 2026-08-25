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
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { CodeBlockWithLanguageInput } from './codeBlock'
import { FontSize } from './fontSize'
import { GhostSuggestion } from './ghostSuggestion'
import { Image } from './image'

export function useGoWriteEditor(onUpdate: () => void, placeholder: string) {
  return useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
        codeBlock: false,
      }),
      CodeBlockWithLanguageInput,
      Placeholder.configure({ placeholder }),
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
      GhostSuggestion,
    ],
    editorProps: {
      // ProseMirror's default clipboard text serializer joins blocks with "\n\n", which
      // inserts a blank line between every paragraph when pasted as plain text elsewhere —
      // even when the user never typed one. Use a single separator instead.
      clipboardTextSerializer: (slice) => slice.content.textBetween(0, slice.content.size, '\n'),
    },
    autofocus: 'end',
    onUpdate,
  })
}
