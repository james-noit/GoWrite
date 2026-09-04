import { useCallback, useState } from 'react'
import { aiToolsStorage } from '../lib/storage'
import type { AiToolsConfig } from '../types'

const DEFAULTS: AiToolsConfig = {
  autocomplete: { enabled: false, waitSeconds: 3, minWords: 5, maxWords: 30 },
}

function load(): AiToolsConfig {
  const stored = aiToolsStorage.get()
  if (!stored) return DEFAULTS
  return {
    autocomplete: { ...DEFAULTS.autocomplete, ...stored.autocomplete },
  }
}

export function useAiTools() {
  const [config, setConfig] = useState<AiToolsConfig>(load)

  const updateTool = useCallback(
    <K extends keyof AiToolsConfig>(tool: K, patch: Partial<AiToolsConfig[K]>) => {
      setConfig((prev) => {
        const next = { ...prev, [tool]: { ...prev[tool], ...patch } }
        aiToolsStorage.set(next)
        return next
      })
    },
    [],
  )

  return { config, updateTool }
}

export type UseAiTools = ReturnType<typeof useAiTools>
