import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiConfig, ChatMessage } from '../types';
import { extractHttpError, streamChat } from './stream';

/** Builds a fetch Response whose body streams Server-Sent Events, one chunk per `data: <line>`
 * plus the blank-line separator SSE requires — this is the wire format all four streamers parse
 * via stream.ts's shared readSse() helper. */
function sseResponse(dataLines: string[], init: { ok?: boolean; status?: number } = {}): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of dataLines) {
        controller.enqueue(encoder.encode(`data: ${line}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(body, { status: init.status ?? 200 });
}

function errorResponse(status: number, jsonBody?: unknown): Response {
  return new Response(jsonBody ? JSON.stringify(jsonBody) : 'plain text error', { status });
}

const messages: ChatMessage[] = [{ role: 'user', content: 'hola' }];

function baseConfig(provider: AiConfig['provider']): AiConfig {
  return { provider, apiKey: 'test-key', customEndpoint: '', model: '' };
}

describe('streamChat', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('OpenAI: accumulates delta.content tokens and stops at [DONE]', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          JSON.stringify({ choices: [{ delta: { content: 'Hola' } }] }),
          JSON.stringify({ choices: [{ delta: { content: ' mundo' } }] }),
          '[DONE]',
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);

    const tokens: string[] = [];
    await streamChat(
      baseConfig('OpenAI'),
      messages,
      (t) => tokens.push(t),
      new AbortController().signal,
    );

    expect(tokens.join('')).toBe('Hola mundo');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('openai.com'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('OpenAI: silently ignores a malformed (non-JSON) chunk instead of throwing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          'not json at all',
          JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }),
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);

    const tokens: string[] = [];
    await streamChat(
      baseConfig('OpenAI'),
      messages,
      (t) => tokens.push(t),
      new AbortController().signal,
    );
    expect(tokens.join('')).toBe('ok');
  });

  it('Mistral: uses the same OpenAI-compatible parser', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse([JSON.stringify({ choices: [{ delta: { content: 'bonjour' } }] })]),
      );
    vi.stubGlobal('fetch', fetchMock);

    const tokens: string[] = [];
    await streamChat(
      baseConfig('Mistral'),
      messages,
      (t) => tokens.push(t),
      new AbortController().signal,
    );
    expect(tokens.join('')).toBe('bonjour');
  });

  it('Custom: normalizes the configured base URL to /v1/chat/completions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(sseResponse([JSON.stringify({ choices: [{ delta: { content: 'x' } }] })]));
    vi.stubGlobal('fetch', fetchMock);

    const config = { ...baseConfig('Custom'), customEndpoint: 'http://127.0.0.1:1234/some/path' };
    await streamChat(config, messages, () => {}, new AbortController().signal);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:1234/v1/chat/completions',
      expect.anything(),
    );
  });

  it('Anthropic: reads text from content_block_delta events and ignores other event types', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          JSON.stringify({ type: 'message_start' }),
          JSON.stringify({
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hola' },
          }),
          JSON.stringify({
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: ' mundo' },
          }),
          JSON.stringify({ type: 'message_stop' }),
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);

    const tokens: string[] = [];
    await streamChat(
      baseConfig('Anthropic'),
      messages,
      (t) => tokens.push(t),
      new AbortController().signal,
    );
    expect(tokens.join('')).toBe('Hola mundo');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'test-key' }) }),
    );
  });

  it('Google Gemini: reads text from candidates[0].content.parts[0].text', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hola' }] } }] }),
          JSON.stringify({ candidates: [{ content: { parts: [{ text: ' mundo' }] } }] }),
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);

    const tokens: string[] = [];
    await streamChat(
      baseConfig('Google Gemini'),
      messages,
      (t) => tokens.push(t),
      new AbortController().signal,
    );
    expect(tokens.join('')).toBe('Hola mundo');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('generativelanguage.googleapis.com'),
      expect.anything(),
    );
  });

  it('Cohere: reads text from content-delta events only', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          JSON.stringify({ type: 'message-start' }),
          JSON.stringify({
            type: 'content-delta',
            delta: { message: { content: { text: 'Hola mundo' } } },
          }),
          JSON.stringify({ type: 'message-end' }),
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);

    const tokens: string[] = [];
    await streamChat(
      baseConfig('Cohere'),
      messages,
      (t) => tokens.push(t),
      new AbortController().signal,
    );
    expect(tokens.join('')).toBe('Hola mundo');
  });

  it('throws the server-provided error message when the response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(errorResponse(401, { error: { message: 'Invalid API key' } })),
    );
    await expect(
      streamChat(baseConfig('OpenAI'), messages, () => {}, new AbortController().signal),
    ).rejects.toThrow('Invalid API key');
  });

  it('re-throws AbortError from fetch without rewriting it into a generic connection error', async () => {
    const abortError = new DOMException('aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));
    await expect(
      streamChat(baseConfig('OpenAI'), messages, () => {}, new AbortController().signal),
    ).rejects.toBe(abortError);
  });

  it('a chunk split across two stream reads is still parsed correctly (SSE events can span reads)', async () => {
    const encoder = new TextEncoder();
    const fullEvent = `data: ${JSON.stringify({ choices: [{ delta: { content: 'completo' } }] })}\n\n`;
    const splitPoint = Math.floor(fullEvent.length / 2);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(fullEvent.slice(0, splitPoint)));
        controller.enqueue(encoder.encode(fullEvent.slice(splitPoint)));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));

    const tokens: string[] = [];
    await streamChat(
      baseConfig('OpenAI'),
      messages,
      (t) => tokens.push(t),
      new AbortController().signal,
    );
    expect(tokens.join('')).toBe('completo');
  });
});

describe('extractHttpError', () => {
  it('reads a nested error.message from an OpenAI-shaped error body', async () => {
    const response = errorResponse(400, { error: { message: 'Bad request' } });
    expect(await extractHttpError(response)).toBe('Bad request');
  });

  it('reads a top-level message field when there is no nested error object', async () => {
    const response = errorResponse(400, { message: 'Something went wrong' });
    expect(await extractHttpError(response)).toBe('Something went wrong');
  });

  it('falls back to "HTTP <status>" when the body is not JSON', async () => {
    const response = errorResponse(500);
    expect(await extractHttpError(response)).toBe('HTTP 500');
  });
});
