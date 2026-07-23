import { Editor } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'

/** A headless Tiptap editor (same extensions as the app) for exercising format import/export in tests. */
export function createTestEditor(): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false, autolink: true } }),
      Placeholder.configure({ placeholder: '' }),
      Markdown.configure({ html: true, transformPastedText: false }),
    ],
  })
}

export function fileFrom(blob: Blob, filename: string, type: string): File {
  return new File([blob], filename, { type })
}
