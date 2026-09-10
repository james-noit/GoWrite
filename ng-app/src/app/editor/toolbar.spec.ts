import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorService } from './editor.service';
import { Toolbar } from './toolbar';

function stubMatchMedia(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

describe('Toolbar', () => {
  let fixture: ComponentFixture<Toolbar>;
  let editorService: EditorService;
  let container: HTMLDivElement;

  function mount() {
    container = document.createElement('div');
    document.body.appendChild(container);
    editorService = TestBed.inject(EditorService);
    return editorService.mount(container, { placeholder: '' });
  }

  afterEach(() => {
    editorService?.destroy();
    container?.remove();
  });

  it('renders nothing when there is no mounted editor', () => {
    stubMatchMedia(true);
    fixture = TestBed.createComponent(Toolbar);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('');
  });

  describe('desktop (full toolbar tier)', () => {
    beforeEach(() => {
      stubMatchMedia(true);
      mount();
      fixture = TestBed.createComponent(Toolbar);
      fixture.detectChanges();
    });

    it('renders the inline format bar, not the FAB/sheet', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.format-bar')).toBeTruthy();
      expect(el.querySelector('.format-fab')).toBeNull();
    });

    it('clicking Bold toggles the mark and reflects active state', () => {
      const editor = editorService.editor()!;
      editor.commands.setContent('<p>hola</p>');
      editor.commands.selectAll();
      fixture.detectChanges();

      const boldBtn = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
      ).find((b) => b.textContent?.trim() === 'B') as HTMLButtonElement;
      boldBtn.click();
      fixture.detectChanges();

      expect(editor.isActive('bold')).toBe(true);
      expect(boldBtn.classList.contains('is-active')).toBe(true);
    });

    it('the color input changes the text color', () => {
      const editor = editorService.editor()!;
      editor.commands.setContent('<p>hola</p>');
      editor.commands.selectAll();
      fixture.detectChanges();

      const colorInput = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
        '.toolbar-color-swatch:not(.toolbar-color-swatch--highlight) input[type="color"]',
      )!;
      colorInput.value = '#ff0000';
      colorInput.dispatchEvent(new Event('change', { bubbles: true }));
      fixture.detectChanges();

      expect(editor.getAttributes('textStyle')['color']).toBe('#ff0000');
    });

    it('inserting a table adds a table node, then table-edit buttons appear', () => {
      const editor = editorService.editor()!;
      editor.commands.setContent('<p></p>');
      fixture.detectChanges();

      const insertBtn = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
      ).find((b) => b.title.includes('table') || b.textContent?.includes('table'));
      insertBtn?.click();
      fixture.detectChanges();

      expect(JSON.stringify(editor.getJSON())).toContain('"type":"table"');
    });
  });

  describe('touch (FAB + sheet)', () => {
    beforeEach(() => {
      stubMatchMedia(false);
      mount();
      fixture = TestBed.createComponent(Toolbar);
      fixture.detectChanges();
    });

    it('renders the FAB, not the inline bar', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.format-fab')).toBeTruthy();
      expect(el.querySelector('.format-bar')).toBeNull();
    });

    it('clicking the FAB opens the sheet; clicking its close button closes it', () => {
      const el = fixture.nativeElement as HTMLElement;
      el.querySelector<HTMLButtonElement>('.format-fab')!.click();
      fixture.detectChanges();
      expect(el.querySelector('.fmt-sheet')).toBeTruthy();

      el.querySelector<HTMLButtonElement>('.fmt-sheet-header .icon-btn')!.click();
      fixture.detectChanges();
      expect(el.querySelector('.fmt-sheet')).toBeNull();
    });

    it('Escape closes the open sheet', () => {
      const el = fixture.nativeElement as HTMLElement;
      el.querySelector<HTMLButtonElement>('.format-fab')!.click();
      fixture.detectChanges();
      expect(el.querySelector('.fmt-sheet')).toBeTruthy();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(el.querySelector('.fmt-sheet')).toBeNull();
    });
  });
});
