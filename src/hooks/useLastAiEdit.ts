import type { Editor } from '@tiptap/core'
import { useCallback, useEffect, useRef, useState } from 'react'

const VISIBLE_MS = 8000

interface Range {
  from: number
  to: number
}

/**
 * Tracks the position of the most recent AI-inserted text (AutoGenerar accept, autocomplete
 * accept) so the UI can offer a precise "undo just that" affordance — narrower than the
 * editor's generic undo stack, which might also revert unrelated edits the user made since.
 * The affordance clears itself after a timeout, or immediately if the user edits the document
 * again (since the recorded range can no longer be trusted to still be "just the AI's text").
 */
export function useLastAiEdit(editor: Editor | null) {
  const [range, setRange] = useState<Range | null>(null)
  const timerRef = useRef<number | undefined>(undefined)

  const record = useCallback((from: number, to: number) => {
    window.clearTimeout(timerRef.current)
    setRange({ from, to })
    timerRef.current = window.setTimeout(() => setRange(null), VISIBLE_MS)
  }, [])

  useEffect(() => {
    if (!editor || !range) return
    const onUpdate = () => setRange(null)
    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
    }
  }, [editor, range])

  const undo = useCallback(() => {
    if (!editor || !range) return
    editor.chain().focus().deleteRange(range).run()
    window.clearTimeout(timerRef.current)
    setRange(null)
  }, [editor, range])

  return { hasUndo: !!range, record, undo }
}

export type UseLastAiEdit = ReturnType<typeof useLastAiEdit>
