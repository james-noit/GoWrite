import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AiConnectionService } from '../core/ai/ai-connection.service';
import { I18nService } from '../core/i18n/i18n.service';
import { SettingsModal } from './settings-modal';

describe('SettingsModal', () => {
  let fixture: ComponentFixture<SettingsModal>;

  beforeEach(() => {
    localStorage.clear();
    fixture = TestBed.createComponent(SettingsModal);
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('renders nothing when closed', () => {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.settings-modal')).toBeNull();
  });

  it('renders the dialog when open, defaulting to the General tab', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.settings-modal')).toBeTruthy();
    expect(text()).toContain('Appearance');
  });

  it('opening with initialTab "ai" shows the AI tab content', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('initialTab', 'ai');
    fixture.detectChanges();
    expect(text()).toContain('Configure provider');
  });

  it('clicking the General/AI tab buttons switches tabs', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const tabs = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.settings-tab');
    tabs[1].click(); // AI tab
    fixture.detectChanges();
    expect(text()).toContain('Configure provider');

    tabs[0].click(); // General tab
    fixture.detectChanges();
    expect(text()).toContain('Appearance');
  });

  it('clicking the close button emits closed', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    let closedCount = 0;
    fixture.componentInstance.closed.subscribe(() => closedCount++);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.icon-btn')!.click();
    expect(closedCount).toBe(1);
  });

  it('clicking the backdrop emits closed, clicking inside the dialog does not', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    let closedCount = 0;
    fixture.componentInstance.closed.subscribe(() => closedCount++);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.settings-modal')!.click();
    expect(closedCount).toBe(0);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.settings-backdrop')!.click();
    expect(closedCount).toBe(1);
  });

  it('locale buttons call I18nService.setLocale', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const enBtn = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'EN',
    ) as HTMLButtonElement;
    enBtn.click();
    fixture.detectChanges();
    expect(TestBed.inject(I18nService).locale()).toBe('en');
  });

  it('the AI config accordion auto-collapses when the connection becomes connected', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('initialTab', 'ai');
    fixture.detectChanges();
    expect(text()).toContain('Provider'); // accordion body visible while disconnected

    const ai = TestBed.inject(AiConnectionService);
    ai.status.set('connected');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.ai-accordion-body')).toBeNull();
  });

  it('toggling autocomplete shows a transient flash message', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('initialTab', 'ai');
    fixture.detectChanges();
    const track = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.switch-track')!;
    track.click();
    fixture.detectChanges();
    expect(text()).toContain('Autocomplete turned on');
  });
});
