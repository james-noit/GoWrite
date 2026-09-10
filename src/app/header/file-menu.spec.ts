import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentsService } from '../documents/documents.service';
import { clearDocumentsDb } from '../documents/testing/clear-documents-db';
import { EditorService } from '../editor/editor.service';
import { FileMenu } from './file-menu';

describe('FileMenu', () => {
  let fixture: ComponentFixture<FileMenu>;
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

    fixture = TestBed.createComponent(FileMenu);
    fixture.detectChanges();
  });

  afterEach(() => {
    editorService.destroy();
    container.remove();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('the dropdown is closed until the menu button is clicked', () => {
    expect(el().querySelector('.dropdown')).toBeNull();
    el().querySelector<HTMLButtonElement>('.header-btn')!.click();
    fixture.detectChanges();
    expect(el().querySelector('.dropdown')).toBeTruthy();
  });

  it('clicking outside the menu closes it', () => {
    el().querySelector<HTMLButtonElement>('.header-btn')!.click();
    fixture.detectChanges();
    expect(el().querySelector('.dropdown')).toBeTruthy();

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(el().querySelector('.dropdown')).toBeNull();
  });

  it('"New document" creates a document and closes the menu', () => {
    el().querySelector<HTMLButtonElement>('.header-btn')!.click();
    fixture.detectChanges();
    const before = docs.documents().length;

    const newDocBtn = Array.from(el().querySelectorAll('.dropdown-item')).find((b) =>
      b.textContent?.includes('New document'),
    );
    (newDocBtn as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(docs.documents().length).toBe(before + 1);
    expect(el().querySelector('.dropdown')).toBeNull();
  });

  it('opening the documents submenu lists all documents, with the current one marked', () => {
    el().querySelector<HTMLButtonElement>('.header-btn')!.click();
    fixture.detectChanges();
    const docsToggle = Array.from(el().querySelectorAll('.dropdown-item')).find((b) =>
      b.textContent?.includes('Documents'),
    );
    (docsToggle as HTMLButtonElement).click();
    fixture.detectChanges();

    const rows = el().querySelectorAll('.document-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].classList.contains('is-current')).toBe(true);
  });

  it('deleting a document asks for confirmation and only removes it if confirmed', () => {
    docs.createNew();
    fixture.detectChanges();
    el().querySelector<HTMLButtonElement>('.header-btn')!.click();
    fixture.detectChanges();
    const docsToggle = Array.from(el().querySelectorAll('.dropdown-item')).find((b) =>
      b.textContent?.includes('Documents'),
    );
    (docsToggle as HTMLButtonElement).click();
    fixture.detectChanges();

    vi.spyOn(window, 'confirm').mockReturnValue(false);
    el().querySelector<HTMLButtonElement>('.document-row-delete')!.click();
    expect(docs.documents()).toHaveLength(2);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    el().querySelector<HTMLButtonElement>('.document-row-delete')!.click();
    fixture.detectChanges();
    expect(docs.documents()).toHaveLength(1);
  });

  it('emits openSettings("general") when Settings is clicked', () => {
    el().querySelector<HTMLButtonElement>('.header-btn')!.click();
    fixture.detectChanges();
    let emitted: string | null = null;
    fixture.componentInstance.openSettings.subscribe((tab) => (emitted = tab));

    const settingsBtn = Array.from(el().querySelectorAll('.dropdown-item')).find((b) =>
      b.textContent?.includes('Settings'),
    );
    (settingsBtn as HTMLButtonElement).click();

    expect(emitted).toBe('general');
  });

  it('formatUpdatedAt reports "just now" for a very recent timestamp', () => {
    expect(fixture.componentInstance.formatUpdatedAt(Date.now())).toBe('just now');
  });

  it('formatUpdatedAt reports minutes-ago for a timestamp under an hour old', () => {
    expect(fixture.componentInstance.formatUpdatedAt(Date.now() - 5 * 60_000)).toContain('5');
  });
});
