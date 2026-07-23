import type { Editor } from '@tiptap/core'
import { useEffect, useState } from 'react'

function countOf(editor: Editor): { words: number; chars: number } {
  const text = editor.getText()
  const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length
  return { words, chars: text.length }
}

export function useWordCount(editor: Editor | null) {
  const [count, setCount] = useState({ words: 0, chars: 0 })

  useEffect(() => {
    if (!editor) return
    setCount(countOf(editor))
    const onUpdate = () => setCount(countOf(editor))
    editor.on('update', onUpdate)
    editor.on('create', onUpdate)
    return () => {
      editor.off('update', onUpdate)
      editor.off('create', onUpdate)
    }
  }, [editor])

  return count
}
