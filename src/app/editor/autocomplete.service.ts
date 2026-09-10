import { Injectable } from '@angular/core';
import type { Editor } from '@tiptap/core';
import { autocompleteCodeMessages, autocompleteMessages, generate, textBeforeCursor } from '../core/ai/actions';
import type { AiConnectionService } from '../core/ai/ai-connection.service';
import type { AutocompleteConfig } from '../core/types';
import { getGhost, hideGhost, showGhost } from './ghost-suggestion';

/**
 * Idle-typing autocomplete: after the user stops typing for the configured delay, requests a
 * short continuation and shows it as inline ghost text with accept/reject controls. Rejecting
 * mutes the tool until the user types again; any further typing resets the pending suggestion
 * and timer. Ported from src/hooks/useAutocomplete.ts.
 *
 * Not `providedIn: 'root'` — call `attach(editor, ai, config, onAccepted?)` once per mounted
 * editor; the returned function detaches everything (mirrors the hook's cleanup).
 */
@Injectable()
export class AutocompleteService {
  attach(
    editor: Editor,
    ai: AiConnectionService,
    getConfig: () => AutocompleteConfig,
    onAccepted?: (from: number, to: number) => void,
  ): () => void {
    let muted = false;
    let timer: number | undefined;
    let controller: AbortController | null = null;

    const storage = editor.storage['ghostSuggestion'];

    storage.onAccept = () => {
      const ghost = getGhost(editor);
      if (!ghost) return;
      hideGhost(editor);
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.insertText(ghost.text, ghost.pos);
          return true;
        })
        .run();
      onAccepted?.(ghost.pos, ghost.pos + ghost.text.length);
    };

    storage.onReject = () => {
      hideGhost(editor);
      muted = true;
    };

    const requestSuggestion = async () => {
      const cfg = getConfig();
      if (!cfg.enabled || !ai.isConnected() || muted) return;
      const before = textBeforeCursor(editor);
      if (!before.trim()) return;

      const inCodeBlock = editor.isActive('codeBlock');

      controller = new AbortController();
      const { signal } = controller;
      try {
        const raw = await generate({
          messages: inCodeBlock
            ? autocompleteCodeMessages(before, cfg.minWords, cfg.maxWords)
            : autocompleteMessages(before, cfg.minWords, cfg.maxWords),
          config: ai.config(),
          signal,
          maxTokens: Math.min(512, Math.max(64, cfg.maxWords * 4)),
        });
        if (signal.aborted || muted) return;
        // Code needs its newlines/indentation preserved; prose collapses stray whitespace.
        const suggestion = inCodeBlock ? raw.replace(/^\n+|\s+$/g, '') : raw.trim().replace(/\s+/g, ' ');
        if (!suggestion) return;
        const head = editor.state.selection.head;
        const prevChar = editor.state.doc.textBetween(Math.max(0, head - 1), head);
        const needsSpace = !inCodeBlock && !!prevChar && !/\s/.test(prevChar) && !/^[.,;:!?)]/.test(suggestion);
        showGhost(editor, needsSpace ? ` ${suggestion}` : suggestion);
      } catch {
        // best-effort: a failed suggestion should never interrupt writing
      }
    };

    const onUpdate = () => {
      window.clearTimeout(timer);
      controller?.abort();
      muted = false;
      const cfg = getConfig();
      if (!cfg.enabled || !ai.isConnected()) return;
      const waitMs = Math.max(500, (cfg.waitSeconds || 3) * 1000);
      timer = window.setTimeout(() => {
        void requestSuggestion();
      }, waitMs);
    };

    editor.on('update', onUpdate);
    return () => {
      editor.off('update', onUpdate);
      window.clearTimeout(timer);
      controller?.abort();
      storage.onAccept = null;
      storage.onReject = null;
    };
  }
}
