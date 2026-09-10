import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { Editor } from '@tiptap/core';
import { I18nService } from '../core/i18n/i18n.service';
import { buildEditorExtensions } from './editor-extensions';

/**
 * Owns the single Tiptap `Editor` instance's lifecycle — ported from
 * src/components/Editor/useGoWriteEditor.ts (a React hook wrapping `useEditor`). Angular has no
 * equivalent hook, so this is a plain injectable: `mount()` creates the editor into a given DOM
 * element (Tiptap can attach directly, unlike React's `EditorContent` + portal pattern), `destroy()`
 * tears it down. The extension list, clipboard serializer and autofocus behavior are unchanged.
 */
@Injectable({ providedIn: 'root' })
export class EditorService {
  private readonly i18n = inject(I18nService);
  private readonly injector = inject(Injector);

  private readonly _editor = signal<Editor | null>(null);
  readonly editor = this._editor.asReadonly();

  /** Recomputed on every Tiptap transaction dispatch (see mount()'s onTransaction) so templates
   * bound to it re-render on selection/content changes, matching how the React app forces a
   * re-render on every editor transaction to keep toolbar/active-state UI in sync. */
  private readonly _revision = signal(0);
  readonly revision = computed(() => this._revision());

  mount(element: HTMLElement, options: { placeholder: string; onUpdate?: () => void }): Editor {
    this._editor()?.destroy();

    const editor = new Editor({
      element,
      extensions: buildEditorExtensions({
        placeholder: options.placeholder,
        imageDeps: { i18n: this.i18n, injector: this.injector },
      }),
      editorProps: {
        // ProseMirror's default clipboard text serializer joins blocks with "\n\n", which
        // inserts a blank line between every paragraph when pasted as plain text elsewhere —
        // even when the user never typed one. Use a single separator instead.
        clipboardTextSerializer: (slice) => slice.content.textBetween(0, slice.content.size, '\n'),
      },
      autofocus: 'end',
      // Only include onUpdate when actually supplied: Tiptap merges this options object with its
      // own internal defaults via a plain spread, so an explicit `onUpdate: undefined` key
      // *overrides* that default (a no-op listener) with `undefined` itself — the callback array
      // ends up holding `undefined` and every `editor.on('update', ...)` dispatch throws trying
      // to call it. Found via manual browser verification, not caught by the unit tests (which
      // never exercise the "no onUpdate provided" path through the real Editor constructor).
      ...(options.onUpdate ? { onUpdate: options.onUpdate } : {}),
      onTransaction: () => this._revision.update((r) => r + 1),
    });

    this._editor.set(editor);
    // Manual-QA hook, same convention as the React app's `window.__gwEditor` (see App.tsx) —
    // lets a real browser session drive editor commands from the console.
    (window as unknown as { __gwEditor?: Editor }).__gwEditor = editor;
    return editor;
  }

  destroy(): void {
    this._editor()?.destroy();
    this._editor.set(null);
  }
}
