import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SummaryModal } from './summary-modal';

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

describe('SummaryModal', () => {
  let fixture: ComponentFixture<SummaryModal>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SummaryModal);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  /** Zoneless Angular's `fixture.whenStable()` doesn't track raw `fetch`/`ReadableStream` work
   * (there's no zone.js monkey-patching them to register as pending tasks), so it can resolve
   * before the summary's async generate() call actually finishes. Poll instead. */
  async function waitUntil(predicate: () => boolean): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      if (!predicate()) throw new Error('condition not yet met');
    });
  }

  it('renders nothing when request is null', () => {
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.summary-modal')).toBeNull();
  });

  it('shows an error immediately for an empty/whitespace-only source text, without calling the AI', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    fixture.componentRef.setInput('request', { text: '   ', titleKey: 'summary.titleDocument' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(text()).toContain('There is no text to summarize');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the loading state, then the generated summary once streaming completes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse('Un resumen breve.')));
    fixture.componentRef.setInput('request', { text: 'Texto largo de prueba.', titleKey: 'summary.titleDocument' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('gowrite-funny-loader')).toBeTruthy();

    await waitUntil(() => text().includes('Un resumen breve.'));
    expect((fixture.nativeElement as HTMLElement).querySelector('gowrite-funny-loader')).toBeNull();
  });

  it('shows an error message when the AI call fails', async () => {
    // A raw fetch rejection is a network-level failure, which streamOpenAICompatible (stream.ts)
    // deliberately wraps into a generic "couldn't reach the provider" message instead of
    // surfacing the raw error — so that's what should end up on screen, not "network down". That
    // wrapped message is itself a hardcoded Spanish string (stream.ts doesn't route it through
    // I18nService), an existing characteristic carried over from the React app, not a new gap.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    fixture.componentRef.setInput('request', { text: 'Texto.', titleKey: 'summary.titleDocument' });
    fixture.detectChanges();

    await waitUntil(() => text().includes('No se pudo contactar con el proveedor'));
  });

  it('clicking close emits closed', async () => {
    fixture.componentRef.setInput('request', { text: 'Texto.', titleKey: 'summary.titleDocument' });
    fixture.detectChanges();
    let closedCount = 0;
    fixture.componentInstance.closed.subscribe(() => closedCount++);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.icon-btn')!.click();
    expect(closedCount).toBe(1);
  });

  it('copy button writes the summary text to the clipboard and shows a "copied" confirmation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse('Resumen.')));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    fixture.componentRef.setInput('request', { text: 'Texto.', titleKey: 'summary.titleDocument' });
    fixture.detectChanges();
    await waitUntil(() => text().includes('Resumen.'));

    const copyBtn = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Copy'),
    ) as HTMLButtonElement;
    copyBtn.click();
    await waitUntil(() => text().includes('Copied'));

    expect(writeText).toHaveBeenCalledWith('Resumen.');
  });
});
