import type { Editor, JSONContent } from '@tiptap/core';

export type Theme = 'light' | 'dark';

export type FormatId = 'txt' | 'md' | 'html' | 'docx' | 'odt';

export interface FormatDefinition {
  id: FormatId;
  label: string;
  extension: string;
  mimeType: string;
  accept: string;
  importFile: (file: File, editor: Editor) => Promise<void>;
  exportContent: (editor: Editor) => Promise<Blob>;
}

export type AiProviderId = 'OpenAI' | 'Anthropic' | 'Google Gemini' | 'Mistral' | 'Cohere' | 'Custom';

export interface AiConfig {
  provider: AiProviderId;
  apiKey: string;
  customEndpoint: string;
  /** Selected model id, shared by every provider (populated from the fetched model list when available). */
  model: string;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface AutocompleteConfig {
  enabled: boolean;
  waitSeconds: number;
  minWords: number;
  maxWords: number;
}

export interface AiToolsConfig {
  autocomplete: AutocompleteConfig;
}

export interface EditorPrefsConfig {
  /** How long a text selection must be held on a touch device before the quick-format popup
   * appears next to it — the "standoff" before the contextual menu pops up. */
  quickFormatDelayMs: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DocumentSnapshot {
  filename: string;
  content: JSONContent;
  updatedAt: number;
}
