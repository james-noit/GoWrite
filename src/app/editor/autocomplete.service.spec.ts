import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiConnectionService } from '../core/ai/ai-connection.service';
import type { AutocompleteConfig } from '../core/types';
import { createTestEditor } from '../core/formats/testing/create-test-editor';
import { AutocompleteService } from './autocomplete.service';
import { getGhost } from './ghost-suggestion';

function sseResponse(text: string): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

const ENABLED_CONFIG: AutocompleteConfig = { enabled: true, waitSeconds: 3, minWords: 5, maxWords: 30 };

describe('AutocompleteService', () => {
  let service: AutocompleteService;
  let ai: AiConnectionService;
  let editor: ReturnType<typeof createTestEditor>;
  let detach: () => void;
  let config: AutocompleteConfig;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new AutocompleteService();
    ai = TestBed.inject(AiConnectionService);
    ai.status.set('connected');
    editor = createTestEditor();
    config = ENABLED_CONFIG;
    detach = service.attach(editor, ai, () => config, undefined);
  });

  afterEach(() => {
    detach();
    editor.destroy();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does nothing while disabled', async () => {
    config = { ...ENABLED_CONFIG, enabled: false };
    editor.commands.insertContent('hola');
    await vi.advanceTimersByTimeAsync(5000);
    expect(getGhost(editor)).toBeNull();
  });

  it('does nothing when the AI is not connected', async () => {
    ai.status.set('idle');
    editor.commands.insertContent('hola mundo, esto es una prueba');
    await vi.advanceTimersByTimeAsync(5000);
    expect(getGhost(editor)).toBeNull();
  });

  it('requests and shows a ghost suggestion after the configured wait, once connected and enabled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(' continuación')));
    editor.commands.insertContent('hola mundo, esto es una prueba');

    await vi.advanceTimersByTimeAsync(3000);
    expect(getGhost(editor)?.text).toBe(' continuación');
  });

  it('a suggestion beginning with punctuation is not given an extra leading space', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(', continuación')));
    editor.commands.insertContent('hola mundo');

    await vi.advanceTimersByTimeAsync(3000);
    expect(getGhost(editor)?.text).toBe(', continuación');
  });

  it('further typing resets the debounce timer and clears the mute from a prior rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(' x')));
    editor.commands.insertContent('hola');
    editor.storage['ghostSuggestion'].onReject?.(); // simulate a reject
    await vi.advanceTimersByTimeAsync(2000);

    editor.commands.insertContent(' mundo'); // typing again should un-mute
    await vi.advanceTimersByTimeAsync(3000);
    expect(getGhost(editor)?.text).toBe(' x');
  });

  it('accepting the suggestion inserts the text and reports the inserted range', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(' final')));
    const accepted: Array<[number, number]> = [];
    detach();
    detach = service.attach(editor, ai, () => config, (from, to) => accepted.push([from, to]));

    editor.commands.setContent('<p>hola</p>');
    editor.commands.insertContent('');
    await vi.advanceTimersByTimeAsync(3000);
    editor.storage['ghostSuggestion'].onAccept?.();

    expect(editor.getText()).toContain('final');
    expect(accepted).toHaveLength(1);
  });

  it('detach() clears the storage callbacks so accept/reject no longer do anything', () => {
    detach();
    expect(editor.storage['ghostSuggestion'].onAccept).toBeNull();
    expect(editor.storage['ghostSuggestion'].onReject).toBeNull();
  });
});
