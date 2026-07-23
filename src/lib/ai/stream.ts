import type { AiConfig, ChatMessage } from '../../types'
import { customChatCompletionsUrl } from './endpoint'
import { providerRegistry } from './providers'

type OnToken = (delta: string) => void

async function readSse(response: Response, onEvent: (data: string) => void, signal: AbortSignal) {
  const reader = response.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    if (signal.aborted) return
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      for (const line of part.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const data = trimmed.slice(5).trim()
        if (data) onEvent(data)
      }
    }
  }
}

export async function extractHttpError(response: Response): Promise<string> {
  try {
    const body = await response.clone().json()
    return body?.error?.message ?? body?.message ?? `HTTP ${response.status}`
  } catch {
    return `HTTP ${response.status}`
  }
}

async function streamOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  onToken: OnToken,
  signal: AbortSignal,
  maxTokens: number,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({ model, stream: true, max_tokens: maxTokens, messages }),
  })
  if (!response.ok) throw new Error(await extractHttpError(response))

  await readSse(
    response,
    (data) => {
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) onToken(delta)
      } catch {
        // ignore malformed chunk
      }
    },
    signal,
  )
}

async function streamAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  onToken: OnToken,
  signal: AbortSignal,
  maxTokens: number,
) {
  const system = messages.find((m) => m.role === 'system')?.content
  const rest = messages.filter((m) => m.role !== 'system')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    signal,
    body: JSON.stringify({ model, max_tokens: maxTokens, stream: true, system, messages: rest }),
  })
  if (!response.ok) throw new Error(await extractHttpError(response))

  await readSse(
    response,
    (data) => {
      try {
        const json = JSON.parse(data)
        if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
          onToken(json.delta.text ?? '')
        }
      } catch {
        // ignore malformed chunk
      }
    },
    signal,
  )
}

async function streamGemini(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  onToken: OnToken,
  signal: AbortSignal,
  maxTokens: number,
) {
  const system = messages.find((m) => m.role === 'system')?.content
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  })
  if (!response.ok) throw new Error(await extractHttpError(response))

  await readSse(
    response,
    (data) => {
      try {
        const json = JSON.parse(data)
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) onToken(text)
      } catch {
        // ignore malformed chunk
      }
    },
    signal,
  )
}

async function streamCohere(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  onToken: OnToken,
  signal: AbortSignal,
  maxTokens: number,
) {
  const response = await fetch('https://api.cohere.com/v2/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal,
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: maxTokens,
      messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : m.role, content: m.content })),
    }),
  })
  if (!response.ok) throw new Error(await extractHttpError(response))

  await readSse(
    response,
    (data) => {
      try {
        const json = JSON.parse(data)
        if (json.type === 'content-delta') {
          const text = json.delta?.message?.content?.text
          if (text) onToken(text)
        }
      } catch {
        // ignore malformed chunk
      }
    },
    signal,
  )
}

export async function streamChat(
  config: AiConfig,
  messages: ChatMessage[],
  onToken: OnToken,
  signal: AbortSignal,
  options?: { maxTokens?: number },
): Promise<void> {
  const meta = providerRegistry[config.provider]
  const model = config.model || meta.defaultModel
  const maxTokens = options?.maxTokens ?? 2048

  switch (config.provider) {
    case 'OpenAI':
    case 'Mistral':
      return streamOpenAICompatible(meta.defaultEndpoint, config.apiKey, model, messages, onToken, signal, maxTokens)
    case 'Custom':
      return streamOpenAICompatible(
        customChatCompletionsUrl(config.customEndpoint || meta.defaultEndpoint),
        config.apiKey,
        model,
        messages,
        onToken,
        signal,
        maxTokens,
      )
    case 'Anthropic':
      return streamAnthropic(config.apiKey, model, messages, onToken, signal, maxTokens)
    case 'Google Gemini':
      return streamGemini(config.apiKey, model, messages, onToken, signal, maxTokens)
    case 'Cohere':
      return streamCohere(config.apiKey, model, messages, onToken, signal, maxTokens)
  }
}
