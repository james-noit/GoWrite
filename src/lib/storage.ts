import type { AiConfig, AiToolsConfig, DocumentSnapshot, Theme } from '../types'

const KEYS = {
  theme: 'gowrite:theme',
  aiConfig: 'gowrite:ai-config',
  aiTools: 'gowrite:ai-tools',
  document: 'gowrite:document',
} as const

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable (private mode / quota) — fail silently, editing still works
  }
}

export const themeStorage = {
  get: (): Theme | null => read<Theme>(KEYS.theme),
  set: (theme: Theme): void => write(KEYS.theme, theme),
}

export const aiConfigStorage = {
  get: (): AiConfig | null => read<AiConfig>(KEYS.aiConfig),
  set: (config: AiConfig): void => write(KEYS.aiConfig, config),
  clear: (): void => localStorage.removeItem(KEYS.aiConfig),
}

export const aiToolsStorage = {
  get: (): Partial<AiToolsConfig> | null => read<Partial<AiToolsConfig>>(KEYS.aiTools),
  set: (config: AiToolsConfig): void => write(KEYS.aiTools, config),
}

export const documentStorage = {
  get: (): DocumentSnapshot | null => read<DocumentSnapshot>(KEYS.document),
  set: (snapshot: DocumentSnapshot): void => write(KEYS.document, snapshot),
}
