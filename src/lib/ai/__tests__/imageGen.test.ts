import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AiConfig } from '../../../types'
import { generateImage, supportsImageGeneration } from '../imageGen'

function baseConfig(provider: AiConfig['provider'], overrides: Partial<AiConfig> = {}): AiConfig {
  return { provider, apiKey: 'test-key', customEndpoint: '', model: '', ...overrides }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('supportsImageGeneration', () => {
  it('is true only for providers with a registered image generator', () => {
    expect(supportsImageGeneration('OpenAI')).toBe(true)
    expect(supportsImageGeneration('Google Gemini')).toBe(true)
    expect(supportsImageGeneration('Custom')).toBe(true)
    expect(supportsImageGeneration('Anthropic')).toBe(false)
    expect(supportsImageGeneration('Mistral')).toBe(false)
    expect(supportsImageGeneration('Cohere')).toBe(false)
  })
})

describe('generateImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('OpenAI: returns a data URL built from the b64_json response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: [{ b64_json: 'QUJD' }] })))
    const result = await generateImage(baseConfig('OpenAI'), 'a cat', new AbortController().signal)
    expect(result).toBe('data:image/png;base64,QUJD')
  })

  it('OpenAI: throws when the provider returns no image data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: [] })))
    await expect(generateImage(baseConfig('OpenAI'), 'a cat', new AbortController().signal)).rejects.toThrow(
      'no devolvió ninguna imagen',
    )
  })

  it('Google Gemini: returns a data URL built from bytesBase64Encoded', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ predictions: [{ bytesBase64Encoded: 'QUJD' }] }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await generateImage(baseConfig('Google Gemini'), 'a cat', new AbortController().signal)
    expect(result).toBe('data:image/png;base64,QUJD')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('imagen-3.0-generate-002:predict'), expect.anything())
  })

  it('Custom: posts to the configured endpoint normalized to /v1/images/generations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ b64_json: 'QUJD' }] }))
    vi.stubGlobal('fetch', fetchMock)
    await generateImage(
      baseConfig('Custom', { customEndpoint: 'http://127.0.0.1:1234' }),
      'a cat',
      new AbortController().signal,
    )
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:1234/v1/images/generations', expect.anything())
  })

  it('rejects unsupported providers (Anthropic) with a clear "not supported" error', async () => {
    await expect(generateImage(baseConfig('Anthropic'), 'a cat', new AbortController().signal)).rejects.toThrow(
      'no admite generación de imágenes',
    )
  })

  it('throws the server error message on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'Quota exceeded' } }, 429)))
    await expect(generateImage(baseConfig('OpenAI'), 'a cat', new AbortController().signal)).rejects.toThrow(
      'Quota exceeded',
    )
  })
})
