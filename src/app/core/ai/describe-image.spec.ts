import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiConfig } from '../types';
import { describeImage, supportsImageDescription } from './describe-image';

function baseConfig(provider: AiConfig['provider'], overrides: Partial<AiConfig> = {}): AiConfig {
  return { provider, apiKey: 'test-key', customEndpoint: '', model: '', ...overrides };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const PNG_DATA_URL = 'data:image/png;base64,QUJD';

describe('supportsImageDescription', () => {
  it('is true only for providers with a registered describer (Cohere has none)', () => {
    expect(supportsImageDescription('OpenAI')).toBe(true);
    expect(supportsImageDescription('Anthropic')).toBe(true);
    expect(supportsImageDescription('Google Gemini')).toBe(true);
    expect(supportsImageDescription('Mistral')).toBe(true);
    expect(supportsImageDescription('Custom')).toBe(true);
    expect(supportsImageDescription('Cohere')).toBe(false);
  });
});

describe('describeImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('OpenAI-compatible providers: reads choices[0].message.content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'A cat.' } }] })),
    );
    const result = await describeImage(
      baseConfig('OpenAI'),
      PNG_DATA_URL,
      'describe',
      new AbortController().signal,
    );
    expect(result).toBe('A cat.');
  });

  it('Anthropic: sends the image as a base64 source block and reads content[0].text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ content: [{ text: 'A cat.' }] }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await describeImage(
      baseConfig('Anthropic'),
      PNG_DATA_URL,
      'describe',
      new AbortController().signal,
    );
    expect(result).toBe('A cat.');

    const call = fetchMock.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.messages[0].content[0]).toMatchObject({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'QUJD' },
    });
  });

  it('Anthropic: rejects a non-data-URL image before making any request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      describeImage(
        baseConfig('Anthropic'),
        'https://example.com/a.png',
        'describe',
        new AbortController().signal,
      ),
    ).rejects.toThrow('no tiene un formato reconocible');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Google Gemini: reads candidates[0].content.parts[0].text', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ candidates: [{ content: { parts: [{ text: 'A cat.' }] } }] }),
        ),
    );
    const result = await describeImage(
      baseConfig('Google Gemini'),
      PNG_DATA_URL,
      'describe',
      new AbortController().signal,
    );
    expect(result).toBe('A cat.');
  });

  it('Mistral: uses the OpenAI-compatible shape against the Mistral endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'A cat.' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    await describeImage(
      baseConfig('Mistral'),
      PNG_DATA_URL,
      'describe',
      new AbortController().signal,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.mistral.ai/v1/chat/completions',
      expect.anything(),
    );
  });

  it('Custom: normalizes the configured endpoint to /v1/chat/completions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'A cat.' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    await describeImage(
      baseConfig('Custom', { customEndpoint: 'http://127.0.0.1:1234' }),
      PNG_DATA_URL,
      'describe',
      new AbortController().signal,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:1234/v1/chat/completions',
      expect.anything(),
    );
  });

  it('rejects unsupported providers (Cohere) with a clear "not supported" error', async () => {
    await expect(
      describeImage(baseConfig('Cohere'), PNG_DATA_URL, 'describe', new AbortController().signal),
    ).rejects.toThrow('no admite descripción de imágenes');
  });

  it('throws when the provider response has no describable text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: {} }] })));
    await expect(
      describeImage(baseConfig('OpenAI'), PNG_DATA_URL, 'describe', new AbortController().signal),
    ).rejects.toThrow('no devolvió ninguna descripción');
  });
});
