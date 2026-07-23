import Placeholder from '@tiptap/extension-placeholder'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { GhostSuggestion } from './ghostSuggestion'

export function useGoWriteEditor(onUpdate: () => void, placeholder: string) {
  return useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({ html: true, transformPastedText: false }),
      GhostSuggestion,
    ],
    autofocus: 'end',
    onUpdate,
  })
}
