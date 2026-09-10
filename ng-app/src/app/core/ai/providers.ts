import type { AiProviderId } from '../types';

export interface ProviderMeta {
  id: AiProviderId;
  label: string;
  defaultEndpoint: string;
  defaultModel: string;
  requiresApiKey: boolean;
  apiKeyLabel: string;
  endpointEditable: boolean;
  helpText?: string;
}

export const providerRegistry: Record<AiProviderId, ProviderMeta> = {
  OpenAI: {
    id: 'OpenAI',
    label: 'OpenAI',
    defaultEndpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    requiresApiKey: true,
    apiKeyLabel: 'API key de OpenAI',
    endpointEditable: false,
  },
  Anthropic: {
    id: 'Anthropic',
    label: 'Anthropic',
    defaultEndpoint: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-3-haiku-20240307',
    requiresApiKey: true,
    apiKeyLabel: 'API key de Anthropic',
    endpointEditable: false,
  },
  'Google Gemini': {
    id: 'Google Gemini',
    label: 'Google Gemini',
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    defaultModel: 'gemini-1.5-flash',
    requiresApiKey: true,
    apiKeyLabel: 'API key de Google AI Studio',
    endpointEditable: false,
  },
  Mistral: {
    id: 'Mistral',
    label: 'Mistral',
    defaultEndpoint: 'https://api.mistral.ai/v1/chat/completions',
    defaultModel: 'mistral-small-latest',
    requiresApiKey: true,
    apiKeyLabel: 'API key de Mistral',
    endpointEditable: false,
  },
  Cohere: {
    id: 'Cohere',
    label: 'Cohere',
    defaultEndpoint: 'https://api.cohere.com/v2/chat',
    defaultModel: 'command-r',
    requiresApiKey: true,
    apiKeyLabel: 'API key de Cohere',
    endpointEditable: false,
  },
  Custom: {
    id: 'Custom',
    label: 'Personalizado / Local',
    defaultEndpoint: 'http://localhost:11434',
    defaultModel: 'llama3.1',
    requiresApiKey: false,
    apiKeyLabel: 'API key (opcional)',
    endpointEditable: true,
    helpText:
      'Introduce solo la URL base del servidor, sin ruta. Ollama: http://localhost:11434 · LM Studio: http://127.0.0.1:1234. La aplicación añade automáticamente "/v1/chat/completions".',
  },
};

export const providerList = Object.values(providerRegistry);
