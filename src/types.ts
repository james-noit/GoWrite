import type { Editor, JSONContent } from '@tiptap/core'

export type Theme = 'light' | 'dark'

export type FormatId = 'txt' | 'md' | 'html' | 'docx' | 'odt'

export interface FormatDefinition {
  id: FormatId
  label: string
  extension: string
  mimeType: string
  accept: string
  importFile: (file: File, editor: Editor) => Promise<void>
  exportContent: (editor: Editor) => Promise<Blob>
}

export type AiProviderId =
  | 'OpenAI'
  | 'Anthropic'
  | 'Google Gemini'
  | 'Mistral'
  | 'Cohere'
  | 'Custom'

export interface AiConfig {
  provider: AiProviderId
  apiKey: string
  customEndpoint: string
  /** Selected model id, shared by every provider (populated from the fetched model list when available). */
  model: string
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface AutocompleteConfig {
  enabled: boolean
  waitSeconds: number
  minWords: number
  maxWords: number
}

export interface ContinueToolConfig {
  enabled: boolean
  minWords: number
  maxWords: number
}

export interface AiToolsConfig {
  summarize: { enabled: boolean }
  autocomplete: AutocompleteConfig
  continueTool: ContinueToolConfig
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface DocumentSnapshot {
  filename: string
  content: JSONContent
  updatedAt: number
}
