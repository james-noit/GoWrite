import { useCallback, useState } from 'react'
import { editorPrefsStorage } from '../lib/storage'
import type { EditorPrefsConfig } from '../types'

const DEFAULTS: EditorPrefsConfig = {
  quickFormatDelayMs: 500,
}

function load(): EditorPrefsConfig {
  const stored = editorPrefsStorage.get()
  if (!stored) return DEFAULTS
  return { ...DEFAULTS, ...stored }
}

export function useEditorPrefs() {
  const [config, setConfig] = useState<EditorPrefsConfig>(load)

  const update = useCallback((patch: Partial<EditorPrefsConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch }
      editorPrefsStorage.set(next)
      return next
    })
  }, [])

  return { config, update }
}

export type UseEditorPrefs = ReturnType<typeof useEditorPrefs>
