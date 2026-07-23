import type { Editor } from '@tiptap/core'
import { useEffect, useRef } from 'react'
import { getGhost, hideGhost, showGhost } from '../components/Editor/ghostSuggestion'
import { autocompleteMessages, generate, textBeforeCursor } from '../lib/ai/actions'
import type { AutocompleteConfig } from '../types'
import type { UseAiConnection } from './useAiConnection'

/**
 * Idle-typing autocomplete: after the user stops typing for the configured delay,
 * requests a short continuation and shows it as inline ghost text with accept/reject
 * controls. Rejecting mutes the tool until the user types again; any further typing
 * resets the pending suggestion and timer.
 */
export function useAutocomplete(
  editor: Editor | null,
  ai: UseAiConnection,
  config: AutocompleteConfig,
  onAccepted?: (from: number, to: number) => void,
) {
  const configRef = useRef(config)
  configRef.current = config
  const aiRef = useRef(ai)
  aiRef.current = ai
  const onAcceptedRef = useRef(onAccepted)
  onAcceptedRef.current = onAccepted

  useEffect(() => {
    if (!editor) return

    let muted = false
    let timer: number | undefined
    let controller: AbortController | null = null

    const storage = editor.storage.ghostSuggestion

    storage.onAccept = () => {
      const ghost = getGhost(editor)
      if (!ghost) return
      hideGhost(editor)
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.insertText(ghost.text, ghost.pos)
          return true
        })
        .run()
      onAcceptedRef.current?.(ghost.pos, ghost.pos + ghost.text.length)
    }

    storage.onReject = () => {
      hideGhost(editor)
      muted = true
    }

    const requestSuggestion = async () => {
      const cfg = configRef.current
      const aiNow = aiRef.current
      if (!cfg.enabled || !aiNow.isConnected || muted) return
      const before = textBeforeCursor(editor)
      if (!before.trim()) return

      controller = new AbortController()
      const { signal } = controller
      try {
        const raw = await generate({
          messages: autocompleteMessages(before, cfg.minWords, cfg.maxWords),
          config: aiNow.config,
          signal,
          maxTokens: Math.min(512, Math.max(64, cfg.maxWords * 4)),
        })
        if (signal.aborted || muted) return
        const suggestion = raw.trim().replace(/\s+/g, ' ')
        if (!suggestion) return
        const head = editor.state.selection.head
        const prevChar = editor.state.doc.textBetween(Math.max(0, head - 1), head)
        const needsSpace = !!prevChar && !/\s/.test(prevChar) && !/^[.,;:!?)]/.test(suggestion)
        showGhost(editor, needsSpace ? ` ${suggestion}` : suggestion)
      } catch {
        // best-effort: a failed suggestion should never interrupt writing
      }
    }

    const onUpdate = () => {
      window.clearTimeout(timer)
      controller?.abort()
      muted = false
      const cfg = configRef.current
      if (!cfg.enabled || !aiRef.current.isConnected) return
      const waitMs = Math.max(500, (cfg.waitSeconds || 3) * 1000)
      timer = window.setTimeout(() => {
        void requestSuggestion()
      }, waitMs)
    }

    editor.on('update', onUpdate)
    return () => {
      editor.off('update', onUpdate)
      window.clearTimeout(timer)
      controller?.abort()
      storage.onAccept = null
      storage.onReject = null
    }
  }, [editor])
}
