import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiConnectionService } from '../core/ai/ai-connection.service';
import { ContextMenu } from './context-menu';
import { EditorService } from './editor.service';
import { LastAiEditService } from './last-ai-edit.service';

/** Builds a fetch Response streaming one SSE `data:` line — same technique as
 * actions.spec.ts/summary-modal.spec.ts (mocking `fetch`, the real network boundary, since
 * Angular's Vitest builder disallows `vi.mock`/`vi.spyOn` for this module). */
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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('ContextMenu', () => {
  let fixture: ComponentFixture<ContextMenu>;
  let editorService: EditorService;
  let ai: AiConnectionService;
  let container: HTMLDivElement;

  function mount() {
    container = document.createElement('div');
    document.body.appendChild(container);
    editorService = TestBed.inject(EditorService);
    return editorService.mount(container, { placeholder: '' });
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rightClick(target: EventTarget, x = 50, y = 50) {
    target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    fixture.detectChanges();
  }

  function menuItem(label: string): HTMLButtonElement {
    return Array.from(el().querySelectorAll('.context-menu-item')).find((b) =>
      b.textContent?.includes(label),
    ) as HTMLButtonElement;
  }

  async function waitFor(predicate: () => void): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      predicate();
    });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LastAiEditService] });
    const editor = mount();
    editor.commands.setContent('<p>Hola mundo, esto es una prueba</p>');
    // Mirrors EditorHost's real wiring (it calls lastAiEdit.attach(editor) in its own
    // constructor) — without it, record()/undo() below silently no-op since LastAiEditService's
    // internal `editor` field stays null.
    TestBed.inject(LastAiEditService).attach(editor);
    fixture = TestBed.createComponent(ContextMenu);
    fixture.detectChanges();
    ai = TestBed.inject(AiConnectionService);
  });

  afterEach(() => {
    editorService.destroy();
    container.remove();
    vi.unstubAllGlobals();
  });

  it('renders nothing until the editor is right-clicked', () => {
    expect(el().querySelector('.context-menu')).toBeNull();
  });

  it('right-click opens the menu at the click position', () => {
    rightClick(editorService.editor()!.view.dom, 42, 77);
    const menu = el().querySelector('.context-menu') as HTMLElement;
    expect(menu).toBeTruthy();
    expect(menu.style.left).toBe('42px');
    expect(menu.style.top).toBe('77px');
  });

  it('Escape closes the menu', () => {
    rightClick(editorService.editor()!.view.dom);
    expect(el().querySelector('.context-menu')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el().querySelector('.context-menu')).toBeNull();
  });

  it('clicking outside the menu closes it', () => {
    rightClick(editorService.editor()!.view.dom);
    expect(el().querySelector('.context-menu')).toBeTruthy();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();
    expect(el().querySelector('.context-menu')).toBeNull();
  });

  it('clicking a format icon (Bold) toggles the mark and closes the menu', () => {
    const editor = editorService.editor()!;
    editor.commands.selectAll();
    rightClick(editor.view.dom);

    const boldBtn = el().querySelector('.context-menu-icon-btn[title="Bold"]') as HTMLButtonElement;
    expect(boldBtn).toBeTruthy();
    boldBtn.click();
    fixture.detectChanges();

    expect(editor.isActive('bold')).toBe(true);
    expect(el().querySelector('.context-menu')).toBeNull();
  });

  it('Insert table runs the command and closes the menu; table-edit actions only show up inside a table', () => {
    const editor = editorService.editor()!;
    rightClick(editor.view.dom);

    const insertBtn = el().querySelector('.context-menu-icon-btn[title="Insert table"]') as HTMLButtonElement;
    insertBtn.click();
    fixture.detectChanges();

    expect(editor.isActive('table')).toBe(true);
    expect(el().querySelector('.context-menu')).toBeNull();

    rightClick(editor.view.dom);
    expect(el().querySelector('.context-menu-icon-btn[title="Add row"]')).toBeTruthy();
  });

  it('shows "Summarize document" with no selection, and emits the whole document text', () => {
    ai.status.set('connected');
    const editor = editorService.editor()!;
    editor.commands.setTextSelection(0);
    rightClick(editor.view.dom);

    let emitted: { text: string; titleKey: string } | undefined;
    fixture.componentInstance.openSummary.subscribe((e) => (emitted = e));
    menuItem('Summarize document').click();
    fixture.detectChanges();

    expect(emitted?.titleKey).toBe('summary.titleDocument');
    expect(emitted?.text).toBe('Hola mundo, esto es una prueba');
    expect(el().querySelector('.context-menu')).toBeNull();
  });

  it('shows the three selection-scoped summarize variants when there is a selection', () => {
    ai.status.set('connected');
    const editor = editorService.editor()!;
    // select the word "mundo" (positions found via the plain-text content set in beforeEach)
    editor.commands.setTextSelection({ from: 6, to: 11 });
    rightClick(editor.view.dom);

    expect(menuItem('Summarize document')).toBeUndefined();
    let emitted: { text: string; titleKey: string } | undefined;
    fixture.componentInstance.openSummary.subscribe((e) => (emitted = e));

    menuItem('Summarize selection').click();
    expect(emitted?.titleKey).toBe('summary.titleSelection');
    expect(emitted?.text).toBe('mundo');
  });

  it('summarize items are disabled while the AI provider is not connected', () => {
    const editor = editorService.editor()!;
    editor.commands.setTextSelection(0);
    rightClick(editor.view.dom);
    expect(menuItem('Summarize document').disabled).toBe(true);
  });

  it('"Edit with AI" only appears with a selection, and applies the edited draft to that range', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse('mundo hermoso')));
    ai.status.set('connected');
    const editor = editorService.editor()!;
    editor.commands.setTextSelection(0);
    rightClick(editor.view.dom);
    expect(menuItem('Edit with AI')).toBeUndefined();

    editor.commands.setTextSelection({ from: 6, to: 11 }); // "mundo"
    rightClick(editor.view.dom);
    menuItem('Edit with AI').click();
    fixture.detectChanges();

    const input = el().querySelector('.field-input') as HTMLInputElement;
    input.value = 'hazlo más poético';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    await waitFor(() => expect(el().querySelector('.gen-draft')).toBeTruthy());
    const acceptBtn = Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes('Accept')) as HTMLButtonElement;
    acceptBtn.click();
    fixture.detectChanges();

    expect(editor.getText()).toBe('Hola mundo hermoso, esto es una prueba');
    expect(el().querySelector('.context-menu')).toBeNull();
  });

  it('Autogenerate inserts the generated draft at the selection end', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(' y más.')));
    ai.status.set('connected');
    const editor = editorService.editor()!;
    editor.commands.setTextSelection(editor.state.doc.content.size);
    rightClick(editor.view.dom);
    menuItem('Autogenerate from here').click();
    fixture.detectChanges();

    const genBtn = Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes('AutoGenerate')) as HTMLButtonElement;
    genBtn.click();
    fixture.detectChanges();

    await waitFor(() => expect(el().querySelector('.gen-draft')).toBeTruthy());
    const acceptBtn = Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes('Accept')) as HTMLButtonElement;
    acceptBtn.click();

    expect(editor.getText()).toContain('y más.');
  });

  it("Give format's Apply is disabled once all three option checkboxes are unchecked", () => {
    ai.status.set('connected');
    const editor = editorService.editor()!;
    rightClick(editor.view.dom);
    menuItem('Give format').click();
    fixture.detectChanges();

    const checkboxes = Array.from(el().querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
    const applyBtn = Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Apply') as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(false);

    for (const cb of checkboxes) {
      cb.checked = false;
      cb.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    }
    expect(applyBtn.disabled).toBe(true);
  });

  it('AI image insert is disabled for a provider without image-generation support', () => {
    ai.status.set('connected');
    ai.config.update((c) => ({ ...c, provider: 'Cohere' }));
    const editor = editorService.editor()!;
    rightClick(editor.view.dom);
    menuItem('Insert AI image').click();
    fixture.detectChanges();

    expect(el().textContent).toContain("doesn't offer image generation in GoWrite");
    const textarea = el().querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });

  it('generates and inserts an AI image for a supported provider (default OpenAI)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: [{ b64_json: 'AAAA' }] })));
    ai.status.set('connected');
    const editor = editorService.editor()!;
    editor.commands.setTextSelection(editor.state.doc.content.size);
    rightClick(editor.view.dom);
    menuItem('Insert AI image').click();
    fixture.detectChanges();

    const textarea = el().querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'a red bicycle';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const genBtn = Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes('Generate image')) as HTMLButtonElement;
    genBtn.click();

    function hasImageNode(): boolean {
      let found = false;
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'image') found = true;
      });
      return found;
    }
    await waitFor(() => expect(hasImageNode()).toBe(true));
    expect(el().querySelector('.context-menu')).toBeNull();
  });

  it('"Undo last AI generation" correctly removes the draft even when it shrinks the document (regression)', async () => {
    // Replacing a 5-char selection ("mundo") with a 2-char draft ("Hi") nets a *negative* size
    // delta — the exact case that used to compute an inverted (to < from) record() range and
    // make undo() either no-op or throw "Position out of range" (see acceptDraft's comment).
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse('Hi')));
    ai.status.set('connected');
    const editor = editorService.editor()!;
    editor.commands.setTextSelection({ from: 6, to: 11 }); // "mundo"
    rightClick(editor.view.dom);
    menuItem('Edit with AI').click();
    fixture.detectChanges();
    const input = el().querySelector('.field-input') as HTMLInputElement;
    input.value = 'shrink it';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    await waitFor(() => expect(el().querySelector('.gen-draft')).toBeTruthy());
    const acceptBtn = Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes('Accept')) as HTMLButtonElement;
    acceptBtn.click();
    fixture.detectChanges();
    expect(editor.getText()).toBe('Hola Hi, esto es una prueba');

    const lastAiEdit = TestBed.inject(LastAiEditService);
    expect(lastAiEdit.hasUndo()).toBe(true);
    expect(() => lastAiEdit.undo()).not.toThrow();
    expect(editor.getText()).toBe('Hola , esto es una prueba');
  });

  it('Describe image only appears when right-clicking an image, and shows the AI description in review', async () => {
    // describeImage (unlike generate/summarize) is a plain non-streaming JSON POST, not SSE.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'Una bicicleta roja.' } }] })),
    );
    ai.status.set('connected');
    const editor = editorService.editor()!;
    editor.chain().focus().setImage({ src: 'data:image/png;base64,AAAA', alt: 'bici' }).run();
    fixture.detectChanges();

    rightClick(editor.view.dom);
    expect(menuItem('Describe image with AI')).toBeUndefined();

    const img = editor.view.dom.querySelector('.gw-image img') as HTMLImageElement;
    rightClick(img);
    const describeBtn = menuItem('Describe image with AI');
    expect(describeBtn).toBeTruthy();
    describeBtn.click();
    fixture.detectChanges();

    const generateBtn = Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.includes('Describe')) as HTMLButtonElement;
    generateBtn.click();

    await waitFor(() => expect((el().querySelector('textarea') as HTMLTextAreaElement)?.value).toBe('Una bicicleta roja.'));
    expect(el().querySelector('textarea')?.hasAttribute('readonly')).toBe(true);
  });
});
