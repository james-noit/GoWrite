import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiConnectionService } from '../core/ai/ai-connection.service';
import { AiToolsService } from '../core/ai/ai-tools.service';
import { DocumentsService } from '../documents/documents.service';
import { clearDocumentsDb } from '../documents/testing/clear-documents-db';
import { EditorService } from '../editor/editor.service';
import { Header } from './header';

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let editorService: EditorService;
  let docs: DocumentsService;
  let container: HTMLDivElement;

  beforeEach(async () => {
    localStorage.clear();
    await clearDocumentsDb();
    container = document.createElement('div');
    document.body.appendChild(container);
    editorService = TestBed.inject(EditorService);
    editorService.mount(container, { placeholder: '' });
    docs = TestBed.inject(DocumentsService);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(docs.ready()).toBe(true));

    fixture = TestBed.createComponent(Header);
    fixture.detectChanges();
  });

  afterEach(() => {
    editorService.destroy();
    container.remove();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the current document filename', () => {
    expect(el().querySelector('.app-filename')?.textContent?.trim()).toBe(docs.currentFilename());
  });

  it('clicking the filename switches to an editable input pre-filled with the current name', () => {
    el().querySelector<HTMLButtonElement>('.app-filename')!.click();
    fixture.detectChanges();
    const input = el().querySelector<HTMLInputElement>('.app-filename-input')!;
    expect(input.value).toBe(docs.currentFilename());
  });

  it('pressing Enter commits the new filename via DocumentsService.rename', () => {
    el().querySelector<HTMLButtonElement>('.app-filename')!.click();
    fixture.detectChanges();
    const input = el().querySelector<HTMLInputElement>('.app-filename-input')!;
    input.value = 'renamed.md';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(docs.currentFilename()).toBe('renamed.md');
    expect(el().querySelector('.app-filename-input')).toBeNull();
  });

  it('pressing Escape cancels the rename without changing the filename', () => {
    const original = docs.currentFilename();
    el().querySelector<HTMLButtonElement>('.app-filename')!.click();
    fixture.detectChanges();
    const input = el().querySelector<HTMLInputElement>('.app-filename-input')!;
    input.value = 'should-not-stick.md';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(docs.currentFilename()).toBe(original);
  });

  it('shows the AI status label when disconnected', () => {
    expect(el().querySelector('.toolbar-ai-meta')?.textContent).toContain('not connected');
  });

  it('shows the model name once connected', () => {
    const ai = TestBed.inject(AiConnectionService);
    ai.status.set('connected');
    ai.config.update((c) => ({ ...c, model: 'gpt-4o' }));
    fixture.detectChanges();
    expect(el().querySelector('.toolbar-ai-meta')?.textContent).toContain('gpt-4o');
  });

  it('shows the autocomplete indicator only when autocomplete is enabled', () => {
    expect(el().querySelector('.toolbar-ai-auto')).toBeNull();
    TestBed.inject(AiToolsService).updateTool('autocomplete', { enabled: true });
    fixture.detectChanges();
    expect(el().querySelector('.toolbar-ai-auto')).toBeTruthy();
  });

  it('clicking the AI status card emits openAiSettings', () => {
    let emitted = false;
    fixture.componentInstance.openAiSettings.subscribe(() => (emitted = true));
    el().querySelector<HTMLButtonElement>('.toolbar-ai-card')!.click();
    expect(emitted).toBe(true);
  });

  it("FileMenu's openSettings bubbles up as Header's own openSettings output", () => {
    let emitted: string | null = null;
    fixture.componentInstance.openSettings.subscribe((tab) => (emitted = tab));

    el().querySelector<HTMLButtonElement>('.header-btn')!.click();
    fixture.detectChanges();
    const settingsBtn = Array.from(el().querySelectorAll('.dropdown-item')).find((b) =>
      b.textContent?.includes('Settings'),
    );
    (settingsBtn as HTMLButtonElement).click();

    expect(emitted).toBe('general');
  });
});
