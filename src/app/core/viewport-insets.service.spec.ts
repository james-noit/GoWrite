import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewportInsetsService } from './viewport-insets.service';

describe('ViewportInsetsService', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--kb-inset');
    vi.unstubAllGlobals();
  });

  it('does nothing (no throw) when visualViewport is unavailable', () => {
    vi.stubGlobal('visualViewport', undefined);
    expect(() => {
      TestBed.inject(ViewportInsetsService);
      TestBed.flushEffects();
    }).not.toThrow();
  });

  it('sets --kb-inset to 0 when the viewport overlap is below the keyboard threshold', () => {
    vi.stubGlobal('visualViewport', {
      height: window.innerHeight,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    TestBed.inject(ViewportInsetsService);
    TestBed.flushEffects();
    expect(document.documentElement.style.getPropertyValue('--kb-inset')).toBe('0px');
  });

  it('sets --kb-inset to the overlap when it exceeds the keyboard threshold', () => {
    vi.stubGlobal('visualViewport', {
      height: window.innerHeight - 300,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    TestBed.inject(ViewportInsetsService);
    TestBed.flushEffects();
    expect(document.documentElement.style.getPropertyValue('--kb-inset')).toBe('300px');
  });
});
