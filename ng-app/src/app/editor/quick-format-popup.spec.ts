import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestEditor } from '../core/formats/testing/create-test-editor';
import { QuickFormatPopup } from './quick-format-popup';

describe('QuickFormatPopup', () => {
  let fixture: ComponentFixture<QuickFormatPopup>;
  let editor: ReturnType<typeof createTestEditor>;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    editor = createTestEditor();
    editor.commands.setContent('<p>hola mundo</p>');

    fixture = TestBed.createComponent(QuickFormatPopup);
    fixture.componentRef.setInput('editor', editor);
    fixture.componentRef.setInput('delayMs', 300);
    fixture.detectChanges();
    TestBed.flushEffects();
  });

  afterEach(() => {
    fixture.destroy();
    editor.destroy();
    container.remove();
    vi.useRealTimers();
  });

  it('renders nothing with no selection', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('.quick-format-bar')).toBeNull();
  });

  it('does not show immediately on selecting text — waits out the delay first', () => {
    editor.commands.setTextSelection({ from: 1, to: 6 });
    expect((fixture.nativeElement as HTMLElement).querySelector('.quick-format-bar')).toBeNull();
  });

  it('shows the popup after the configured delay following a non-empty selection', () => {
    editor.commands.setTextSelection({ from: 1, to: 6 });
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.quick-format-bar')).toBeTruthy();
  });

  it('hides again once the selection collapses', () => {
    editor.commands.setTextSelection({ from: 1, to: 6 });
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.quick-format-bar')).toBeTruthy();

    editor.commands.setTextSelection(1);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.quick-format-bar')).toBeNull();
  });

  it('the "more" button hides the popup and emits expand', () => {
    editor.commands.setTextSelection({ from: 1, to: 6 });
    vi.advanceTimersByTime(300);
    fixture.detectChanges();

    let expanded = false;
    fixture.componentInstance.expand.subscribe(() => (expanded = true));
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.quick-format-more')!
      .click();
    fixture.detectChanges();

    expect(expanded).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('.quick-format-bar')).toBeNull();
  });
});
