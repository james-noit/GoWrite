import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AiConfig } from '../../../types'
import { testConnection } from '../testConnection'

function baseConfig(provider: AiConfig['provider'], overrides: Partial<AiConfig> = {}): AiConfig {
  return { provider, apiKey: 'test-key', customEndpoint: '', model: '', ...overrides }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('testConnection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('OpenAI-style response ({data:[{id}]}) is parsed and sorted alphabetically', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: 'gpt-4o' }, { id: 'gpt-3.5-turbo' }] })),
    )
    expect(await testConnection(baseConfig('OpenAI'))).toEqual(['gpt-3.5-turbo', 'gpt-4o'])
  })

  it('Gemini/Cohere-style response ({models:[{name}]}) strips the "models/" prefix', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ models: [{ name: 'models/gemini-1.5-pro' }, { name: 'models/gemini-1.5-flash' }] })),
    )
    expect(await testConnection(baseConfig('Google Gemini'))).toEqual(['gemini-1.5-flash', 'gemini-1.5-pro'])
  })

  it('returns an empty list when the response has neither data nor models', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ unexpected: true })))
    expect(await testConnection(baseConfig('OpenAI'))).toEqual([])
  })

  it('returns an empty list (not a throw) when the response body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })))
    expect(await testConnection(baseConfig('OpenAI'))).toEqual([])
  })

  it('throws the server error message on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'Unauthorized' } }, 401)))
    await expect(testConnection(baseConfig('OpenAI'))).rejects.toThrow('Unauthorized')
  })

  it('Custom provider: builds the models URL from the configured base endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }))
    vi.stubGlobal('fetch', fetchMock)
    await testConnection(baseConfig('Custom', { customEndpoint: 'http://127.0.0.1:1234/v1/chat/completions' }))
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:1234/v1/models', expect.anything())
  })

  it('aborts and throws a timeout-specific message when the request takes too long', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, opts: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        })
      }),
    )

    const promise = testConnection(baseConfig('OpenAI'))
    const assertion = expect(promise).rejects.toThrow('tiempo de espera agotado')
    await vi.advanceTimersByTimeAsync(8000)
    await assertion
    vi.useRealTimers()
  })
})
