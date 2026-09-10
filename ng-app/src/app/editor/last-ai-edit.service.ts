import { Injectable, computed, signal } from '@angular/core';
import type { Editor } from '@tiptap/core';

const VISIBLE_MS = 8000;

interface EditRange {
  from: number;
  to: number;
}

/**
 * Tracks the position of the most recent AI-inserted text (AutoGenerar accept, autocomplete
 * accept) so the UI can offer a precise "undo just that" affordance — narrower than the editor's
 * generic undo stack, which might also revert unrelated edits the user made since. The
 * affordance clears itself after a timeout, or immediately if the user edits the document again.
 * Ported from src/hooks/useLastAiEdit.ts.
 *
 * Not `providedIn: 'root'` — call `attach(editor)` once per mounted editor (mirrors
 * AutocompleteService); a fresh instance per editor avoids stale editor references surviving a
 * remount.
 */
@Injectable()
export class LastAiEditService {
  private readonly range = signal<EditRange | null>(null);
  private timer: number | undefined;
  private editor: Editor | null = null;
  private onUpdate = () => this.range.set(null);

  readonly hasUndo = computed(() => this.range() !== null);

  attach(editor: Editor): () => void {
    this.editor = editor;
    return () => {
      this.editor?.off('update', this.onUpdate);
      window.clearTimeout(this.timer);
      this.editor = null;
    };
  }

  record(from: number, to: number): void {
    window.clearTimeout(this.timer);
    this.editor?.off('update', this.onUpdate); // avoid double-registering across repeated record() calls
    this.range.set({ from, to });
    this.editor?.on('update', this.onUpdate);
    this.timer = window.setTimeout(() => {
      this.range.set(null);
      this.editor?.off('update', this.onUpdate);
    }, VISIBLE_MS);
  }

  undo(): void {
    const range = this.range();
    if (!this.editor || !range) return;
    this.editor.chain().focus().deleteRange(range).run();
    window.clearTimeout(this.timer);
    this.editor.off('update', this.onUpdate);
    this.range.set(null);
  }
}
