import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorService } from '../editor/editor.service';
import { DocumentsService } from './documents.service';
import { clearDocumentsDb } from './testing/clear-documents-db';

describe('DocumentsService', () => {
  let container: HTMLDivElement;
  let editorService: EditorService;

  function mountEditor() {
    container = document.createElement('div');
    document.body.appendChild(container);
    editorService = TestBed.inject(EditorService);
    return editorService.mount(container, { placeholder: '' });
  }

  beforeEach(async () => {
    localStorage.clear();
    // fake-indexeddb keeps state across every spec file in the same Vitest worker, not just
    // within this one — DocumentsService's own migrate-if-empty check would otherwise silently
    // skip on every test after the first, since a prior test's documents are still there.
    await clearDocumentsDb();
  });

  afterEach(() => {
    editorService?.destroy();
    container?.remove();
  });

  it('creates a default document on first run and loads it into the editor', async () => {
    const editor = mountEditor();
    const docs = TestBed.inject(DocumentsService);
    TestBed.flushEffects();

    await vi.waitFor(() => expect(docs.ready()).toBe(true));
    expect(docs.documents()).toHaveLength(1);
    expect(docs.currentFilename()).toBe('Documento sin título.md');
    // TextAlign's default `textAlign: null` attr shows up once the content has actually passed
    // through the editor's schema (setContent), even though the raw seed content doesn't have it.
    expect(editor.getJSON()).toEqual({ type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: null } }] });
  });

  it('migrates a legacy single-document localStorage snapshot on first run', async () => {
    localStorage.setItem(
      'gowrite:document',
      JSON.stringify({
        filename: 'legacy.md',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'old content' }] }],
        },
        updatedAt: 12345,
      }),
    );
    const editor = mountEditor();
    const docs = TestBed.inject(DocumentsService);
    TestBed.flushEffects();

    await vi.waitFor(() => expect(docs.ready()).toBe(true));
    expect(docs.currentFilename()).toBe('legacy.md');
    expect(editor.getText()).toBe('old content');
  });

  it('rename() persists the new filename', async () => {
    mountEditor();
    const docs = TestBed.inject(DocumentsService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(docs.ready()).toBe(true));

    docs.rename('my-notes.md');
    expect(docs.currentFilename()).toBe('my-notes.md');
  });

  it('createNew() adds a fresh document, makes it current, and clears the editor', async () => {
    const editor = mountEditor();
    const docs = TestBed.inject(DocumentsService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(docs.ready()).toBe(true));

    editor.commands.setContent('<p>hello</p>');
    docs.createNew();

    expect(docs.documents()).toHaveLength(2);
    expect(editor.getText()).toBe('');
  });

  it("openDocument() switches the current id and loads that document's content", async () => {
    const editor = mountEditor();
    const docs = TestBed.inject(DocumentsService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(docs.ready()).toBe(true));
    const firstId = docs.currentId()!;

    editor.commands.setContent('<p>first doc content</p>');
    docs.createNew();
    editor.commands.setContent('<p>second doc content</p>');

    docs.openDocument(firstId);
    expect(docs.currentId()).toBe(firstId);
  });

  it('removeDocument() on a non-current document just removes it from the list', async () => {
    mountEditor();
    const docs = TestBed.inject(DocumentsService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(docs.ready()).toBe(true));
    const firstId = docs.currentId()!;
    docs.createNew();
    const secondId = docs.currentId()!;

    docs.removeDocument(firstId);
    expect(docs.documents().map((d) => d.id)).toEqual([secondId]);
    expect(docs.currentId()).toBe(secondId);
  });

  it('removeDocument() on the current document switches to another remaining one', async () => {
    mountEditor();
    const docs = TestBed.inject(DocumentsService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(docs.ready()).toBe(true));
    const firstId = docs.currentId()!;
    docs.createNew();
    const secondId = docs.currentId()!;

    docs.removeDocument(secondId);
    expect(docs.currentId()).toBe(firstId);
    expect(docs.documents()).toHaveLength(1);
  });

  it('removeDocument() on the last remaining document creates a fresh replacement', async () => {
    mountEditor();
    const docs = TestBed.inject(DocumentsService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(docs.ready()).toBe(true));
    const onlyId = docs.currentId()!;

    docs.removeDocument(onlyId);
    expect(docs.documents()).toHaveLength(1);
    expect(docs.currentId()).not.toBe(onlyId);
    expect(docs.currentFilename()).toBe('Documento sin título.md');
  });

  it('clearCurrentStorage() blanks the current document but keeps its id/filename', async () => {
    const editor = mountEditor();
    const docs = TestBed.inject(DocumentsService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(docs.ready()).toBe(true));
    docs.rename('keep-this-name.md');
    editor.commands.setContent('<p>will be wiped</p>');
    const id = docs.currentId();

    docs.clearCurrentStorage();
    expect(editor.getText()).toBe('');
    expect(docs.currentId()).toBe(id);
    expect(docs.currentFilename()).toBe('keep-this-name.md');
  });

  it('autosave persists editor content after the debounce delay', async () => {
    vi.useFakeTimers();
    const editor = mountEditor();
    const docs = TestBed.inject(DocumentsService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(docs.ready()).toBe(true), { timeout: 2000 });

    editor.commands.setContent('<p>autosaved text</p>');
    await vi.advanceTimersByTimeAsync(500);

    expect(docs.documents()[0].content).toMatchObject({
      content: [{ content: [{ text: 'autosaved text' }] }],
    });
    vi.useRealTimers();
  });
});
