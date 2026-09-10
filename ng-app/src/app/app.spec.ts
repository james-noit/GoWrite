import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { AiConnectionService } from './core/ai/ai-connection.service';
import { DocumentsService } from './documents/documents.service';
import { clearDocumentsDb } from './documents/testing/clear-documents-db';
import { EditorService } from './editor/editor.service';

function stubMatchMedia(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

describe('App', () => {
  beforeEach(async () => {
    stubMatchMedia(true); // desktop tier — MobileSupportButton/Toolbar need matchMedia to exist at all
    // clearDocumentsDb() injects DbService, which would instantiate the TestBed environment with
    // default config if called before configureTestingModule() — must come after.
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
    await clearDocumentsDb();
  });

  /** App's own EditorHost mounts a real editor via afterNextRender, which kicks off
   * DocumentsService's async init — waiting for it to finish (rather than letting it resolve
   * after the test has already moved on and torn its fixture down) is what avoids an unhandled
   * "Cannot read properties of null" rejection against an already-destroyed editor. */
  async function waitForReady(): Promise<void> {
    await vi.waitFor(() => expect(TestBed.inject(DocumentsService).ready()).toBe(true));
  }

  it('should create the app', async () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
    fixture.detectChanges();
    await waitForReady();
  });

  it('renders the app shell with the header and editor host', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await waitForReady();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.app-shell')).toBeTruthy();
    expect(el.querySelector('gowrite-header')).toBeTruthy();
    expect(el.querySelector('gowrite-editor-host')).toBeTruthy();
  });

  it('Header emitting openSettings opens SettingsModal on the requested tab', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await waitForReady();
    fixture.componentInstance['openSettings']('ai');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.settings-modal')).toBeTruthy();
    expect(el.textContent).toContain('Configure provider');
  });

  it("ContextMenu's summarize-document item opens SummaryModal, bubbled up through EditorHost", async () => {
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse('Resumen de prueba.')));

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await waitForReady();

    // Summarize menu items are disabled while the AI provider isn't connected (same as the real
    // toolbar/settings gating) — connect it first so the click actually fires.
    TestBed.inject(AiConnectionService).status.set('connected');
    const editor = TestBed.inject(EditorService).editor()!;
    editor.commands.setContent('<p>Texto del documento</p>');
    fixture.detectChanges();

    editor.view.dom.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 }));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const summarizeBtn = Array.from(el.querySelectorAll('.context-menu-item')).find((b) =>
      b.textContent?.includes('Summarize document'),
    ) as HTMLButtonElement;
    summarizeBtn.click();
    fixture.detectChanges();

    expect(el.querySelector('.summary-modal')).toBeTruthy();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(el.querySelector('.summary-modal')?.textContent).toContain('Resumen de prueba.');
    });
    vi.unstubAllGlobals();
  });

  it('closing SettingsModal clears settingsOpen', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await waitForReady();
    fixture.componentInstance['openSettings']('general');
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.settings-modal .icon-btn')!.click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.settings-modal')).toBeNull();
  });
});
