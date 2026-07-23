import type { Editor as TiptapEditor } from '@tiptap/core'
import { EditorContent } from '@tiptap/react'
import { useI18n } from '../../hooks/useI18n'
import { useWordCount } from '../../hooks/useWordCount'

interface EditorProps {
  editor: TiptapEditor | null
  isDragOver: boolean
}

export function Editor({ editor, isDragOver }: EditorProps) {
  const { t } = useI18n()
  const { words, chars } = useWordCount(editor)

  return (
    <div className={`editor-shell${isDragOver ? ' is-drag-over' : ''}`}>
      <div className="editor-scroll scroll-thin">
        <EditorContent editor={editor} className="editor-content" />
      </div>
      <div className="status-bar" aria-live="polite">
        <span>{words} {t(words === 1 ? 'editor.word' : 'editor.words')}</span>
        <span className="status-bar-sep">·</span>
        <span>{chars} {t(chars === 1 ? 'editor.char' : 'editor.chars')}</span>
      </div>
      {isDragOver && (
        <div className="drop-overlay">
          <div className="drop-overlay-card">
            <span className="drop-icon">⇩</span>
            <p>{t('editor.dropHint')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
