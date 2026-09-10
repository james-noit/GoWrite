import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { StorageService } from '../core/storage.service';
import { MobileSupportButton } from './mobile-support-button';

function stubMatchMedia(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

describe('MobileSupportButton', () => {
  let fixture: ComponentFixture<MobileSupportButton>;

  beforeEach(() => {
    localStorage.clear();
  });

  it('renders on touch tiers (full-toolbar query not matching)', () => {
    stubMatchMedia(false);
    fixture = TestBed.createComponent(MobileSupportButton);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.mobile-coffee')).toBeTruthy();
  });

  it('renders nothing on the full-toolbar (desktop) tier', () => {
    stubMatchMedia(true);
    fixture = TestBed.createComponent(MobileSupportButton);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.mobile-coffee')).toBeNull();
  });

  it('dismissing persists via StorageService and hides the badge', () => {
    stubMatchMedia(false);
    fixture = TestBed.createComponent(MobileSupportButton);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('.mobile-coffee-close')!
      .click();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.mobile-coffee')).toBeNull();
    expect(TestBed.inject(StorageService).coffeeDismissed.get()).toBe(true);
  });

  it('starts dismissed if previously dismissed (persisted)', () => {
    TestBed.inject(StorageService).coffeeDismissed.set(true);
    stubMatchMedia(false);
    fixture = TestBed.createComponent(MobileSupportButton);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.mobile-coffee')).toBeNull();
  });
});
