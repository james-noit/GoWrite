import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { Editor, JSONContent } from '@tiptap/core';
import { DbService, type StoredDocument } from '../core/db.service';
import { StorageService } from '../core/storage.service';
import { EditorService } from '../editor/editor.service';

const EMPTY_DOC_CONTENT: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
const DEFAULT_FILENAME = 'Documento sin título.md';

function sortByRecent(docs: StoredDocument[]): StoredDocument[] {
  return [...docs].sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Multi-document store backed by IndexedDB — ported from src/hooks/useDocuments.ts. On first run
 * it migrates the old single-document localStorage snapshot (if any) into the first IndexedDB
 * record.
 *
 * The React original took `editor` as a parameter and kept a `currentRef` so callbacks could read
 * fresh state without it being a `useCallback` dependency; neither is needed here — `EditorService`
 * is an app-root singleton this service can just inject, and Angular signals are always read
 * fresh, so `current()` (a computed) replaces the ref outright. Init/autosave, which the original
 * gated on `editor` becoming non-null via a `useEffect` dependency array, are `effect()`s here
 * that react to `editorService.editor()` the same way.
 */
@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly db = inject(DbService);
  private readonly storage = inject(StorageService);
  private readonly editorService = inject(EditorService);

  readonly documents = signal<StoredDocument[]>([]);
  readonly currentId = signal<string | null>(null);
  readonly ready = signal(false);

  readonly current = computed<StoredDocument | null>(
    () => this.documents().find((d) => d.id === this.currentId()) ?? null,
  );
  readonly currentFilename = computed(() => this.current()?.filename ?? DEFAULT_FILENAME);

  private initStarted = false;
  private autosaveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Initial load (+ one-time migration from the legacy single-document localStorage snapshot).
    effect(() => {
      const editor = this.editorService.editor();
      if (!editor || this.initStarted) return;
      this.initStarted = true;
      void this.init(editor);
    });

    // Debounced autosave of the current document's content.
    effect((onCleanup) => {
      const editor = this.editorService.editor();
      if (!editor || !this.ready()) return;
      const save = () => {
        clearTimeout(this.autosaveTimer);
        this.autosaveTimer = setTimeout(() => {
          const current = this.current();
          if (!current) return;
          const updated: StoredDocument = {
            ...current,
            content: editor.getJSON(),
            updatedAt: Date.now(),
          };
          void this.db.putDocument(updated);
          this.documents.update((prev) =>
            sortByRecent(prev.map((d) => (d.id === updated.id ? updated : d))),
          );
        }, 500);
      };
      editor.on('update', save);
      onCleanup(() => {
        clearTimeout(this.autosaveTimer);
        editor.off('update', save);
      });
    });
  }

  private async init(editor: Editor): Promise<void> {
    let docs = await this.db.listDocuments();
    if (docs.length === 0) {
      const legacy = this.storage.document.get();
      const now = Date.now();
      const seed: StoredDocument = legacy
        ? {
            id: this.db.newDocumentId(),
            filename: legacy.filename,
            content: legacy.content,
            createdAt: now,
            updatedAt: legacy.updatedAt || now,
          }
        : {
            id: this.db.newDocumentId(),
            filename: DEFAULT_FILENAME,
            content: EMPTY_DOC_CONTENT,
            createdAt: now,
            updatedAt: now,
          };
      await this.db.putDocument(seed);
      docs = [seed];
    }
    const sorted = sortByRecent(docs);
    this.documents.set(sorted);
    this.currentId.set(sorted[0].id);
    editor.commands.setContent(sorted[0].content);
    this.ready.set(true);
  }

  rename(filename: string): void {
    const current = this.current();
    if (!current) return;
    const updated: StoredDocument = { ...current, filename, updatedAt: Date.now() };
    void this.db.putDocument(updated);
    this.documents.update((prev) =>
      sortByRecent(prev.map((d) => (d.id === updated.id ? updated : d))),
    );
  }

  createNew(): void {
    const editor = this.editorService.editor();
    if (!editor) return;
    const now = Date.now();
    const doc: StoredDocument = {
      id: this.db.newDocumentId(),
      filename: DEFAULT_FILENAME,
      content: EMPTY_DOC_CONTENT,
      createdAt: now,
      updatedAt: now,
    };
    void this.db.putDocument(doc);
    this.documents.update((prev) => sortByRecent([doc, ...prev]));
    this.currentId.set(doc.id);
    editor.commands.setContent(doc.content);
  }

  openDocument(id: string): void {
    const editor = this.editorService.editor();
    if (!editor) return;
    const doc = this.documents().find((d) => d.id === id);
    if (!doc) return;
    this.currentId.set(id);
    editor.commands.setContent(doc.content);
  }

  importAsCurrent(filename: string): void {
    const editor = this.editorService.editor();
    const current = this.current();
    if (!editor || !current) return;
    const updated: StoredDocument = {
      ...current,
      filename,
      content: editor.getJSON(),
      updatedAt: Date.now(),
    };
    void this.db.putDocument(updated);
    this.documents.update((prev) =>
      sortByRecent(prev.map((d) => (d.id === updated.id ? updated : d))),
    );
  }

  /** Wipes the current document's saved content back to blank, keeping its id/filename in place. */
  clearCurrentStorage(): void {
    const editor = this.editorService.editor();
    const current = this.current();
    if (!editor || !current) return;
    const now = Date.now();
    const cleared: StoredDocument = { ...current, content: EMPTY_DOC_CONTENT, updatedAt: now };
    void this.db.putDocument(cleared);
    this.documents.update((prev) =>
      sortByRecent(prev.map((d) => (d.id === cleared.id ? cleared : d))),
    );
    editor.commands.setContent(EMPTY_DOC_CONTENT);
  }

  removeDocument(id: string): void {
    const editor = this.editorService.editor();
    void this.db.deleteDocument(id);
    const remaining = this.documents().filter((d) => d.id !== id);

    if (id === this.currentId() && editor) {
      if (remaining.length > 0) {
        this.currentId.set(remaining[0].id);
        editor.commands.setContent(remaining[0].content);
        this.documents.set(remaining);
      } else {
        const now = Date.now();
        const fresh: StoredDocument = {
          id: this.db.newDocumentId(),
          filename: DEFAULT_FILENAME,
          content: EMPTY_DOC_CONTENT,
          createdAt: now,
          updatedAt: now,
        };
        void this.db.putDocument(fresh);
        this.currentId.set(fresh.id);
        editor.commands.setContent(fresh.content);
        this.documents.set([fresh]);
      }
    } else {
      this.documents.set(remaining);
    }
  }
}
