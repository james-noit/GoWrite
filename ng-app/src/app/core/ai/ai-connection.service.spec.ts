import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiConnectionService } from './ai-connection.service';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('AiConnectionService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('defaults to OpenAI with an empty config when nothing is stored', () => {
    const ai = TestBed.inject(AiConnectionService);
    expect(ai.config()).toEqual({ provider: 'OpenAI', apiKey: '', customEndpoint: '', model: '' });
    expect(ai.status()).toBe('idle');
    expect(ai.isConnected()).toBe(false);
  });

  it('picks up a previously stored config', () => {
    localStorage.setItem(
      'gowrite:ai-config',
      JSON.stringify({ provider: 'Anthropic', apiKey: 'sk-test', customEndpoint: '', model: 'claude-3' }),
    );
    const ai = TestBed.inject(AiConnectionService);
    expect(ai.config().provider).toBe('Anthropic');
  });

  it('meta reflects the current provider', () => {
    const ai = TestBed.inject(AiConnectionService);
    expect(ai.meta().label).toBe('OpenAI');
    ai.setProvider('Anthropic');
    expect(ai.meta().label).toBe('Anthropic');
  });

  it('connect() fails fast with a field-required error when the provider needs a key and none is set', async () => {
    const ai = TestBed.inject(AiConnectionService);
    await ai.connect();
    expect(ai.status()).toBe('error');
    expect(ai.error()).toContain('API key de OpenAI');
  });

  it('connect() fails fast with an invalid-endpoint error for a bad Custom endpoint', async () => {
    const ai = TestBed.inject(AiConnectionService);
    ai.setProvider('Custom');
    ai.updateField('customEndpoint', 'not a url');
    await ai.connect();
    expect(ai.status()).toBe('error');
  });

  it('connect() succeeds, stores the fetched models, and picks a default model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: 'gpt-4o' }] })));
    const ai = TestBed.inject(AiConnectionService);
    ai.updateField('apiKey', 'sk-test');

    await ai.connect();

    expect(ai.status()).toBe('connected');
    expect(ai.isConnected()).toBe(true);
    expect(ai.models()).toEqual(['gpt-4o']);
    expect(ai.config().model).toBe('gpt-4o');
    expect(JSON.parse(localStorage.getItem('gowrite:ai-config')!).model).toBe('gpt-4o');
  });

  it('connect() keeps the user\'s already-chosen model if it is still in the fetched list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] })),
    );
    const ai = TestBed.inject(AiConnectionService);
    ai.updateField('apiKey', 'sk-test');
    ai.updateField('model', 'gpt-4o-mini');

    await ai.connect();
    expect(ai.config().model).toBe('gpt-4o-mini');
  });

  it('connect() sets an error status when the network call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const ai = TestBed.inject(AiConnectionService);
    ai.updateField('apiKey', 'sk-test');

    await ai.connect();
    expect(ai.status()).toBe('error');
  });

  it('setProvider resets status/error/models and bumps the request sequence (stale responses are ignored)', async () => {
    let resolveFirst: (r: Response) => void;
    const firstCall = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(firstCall));

    const ai = TestBed.inject(AiConnectionService);
    ai.updateField('apiKey', 'sk-test');
    const connecting = ai.connect(); // never resolves yet

    ai.setProvider('Anthropic'); // supersedes the in-flight connect
    expect(ai.status()).toBe('idle');
    expect(ai.models()).toEqual([]);

    resolveFirst!(jsonResponse({ data: [{ id: 'gpt-4o' }] }));
    await connecting;

    // the stale response must not overwrite the state setProvider() already reset
    expect(ai.status()).toBe('idle');
    expect(ai.models()).toEqual([]);
  });

  it('updateField("model") persists immediately without resetting connection status', () => {
    const ai = TestBed.inject(AiConnectionService);
    ai.status.set('connected');
    ai.updateField('model', 'gpt-4o-mini');
    expect(ai.status()).toBe('connected');
    expect(ai.config().model).toBe('gpt-4o-mini');
  });

  it('updateField("apiKey") resets status/error (a different key means a different account)', () => {
    const ai = TestBed.inject(AiConnectionService);
    ai.status.set('error');
    ai.error.set('boom');
    ai.updateField('apiKey', 'sk-new');
    expect(ai.status()).toBe('idle');
    expect(ai.error()).toBeNull();
  });

  it('disconnect() resets status/error', () => {
    const ai = TestBed.inject(AiConnectionService);
    ai.status.set('connected');
    ai.disconnect();
    expect(ai.status()).toBe('idle');
    expect(ai.error()).toBeNull();
  });

  it('health-check: re-tests the connection every 5 minutes while connected', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [{ id: 'gpt-4o' }] }));
    vi.stubGlobal('fetch', fetchMock);

    const ai = TestBed.inject(AiConnectionService);
    ai.updateField('apiKey', 'sk-test');
    await ai.connect();
    TestBed.flushEffects();
    fetchMock.mockClear();

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(fetchMock).toHaveBeenCalled();
  });
});
