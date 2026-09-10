import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaQueryService } from './media-query.service';

/** jsdom doesn't implement matchMedia — build a minimal fake that lets tests flip `matches` and
 * fire the 'change' listener, mirroring how a real browser notifies on a query boundary cross. */
function stubMatchMedia(initialMatches: boolean) {
  let listener: (() => void) | null = null;
  let matches = initialMatches;
  const mql = {
    get matches() {
      return matches;
    },
    addEventListener: (_type: string, cb: () => void) => {
      listener = cb;
    },
    removeEventListener: () => {
      listener = null;
    },
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql),
  );
  return {
    fireChange: (newMatches: boolean) => {
      matches = newMatches;
      listener?.();
    },
  };
}

describe('MediaQueryService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the current match state as a signal', () => {
    stubMatchMedia(true);
    const service = TestBed.inject(MediaQueryService);
    const result = TestBed.runInInjectionContext(() => service.observe('(min-width: 1024px)'));
    expect(result()).toBe(true);
  });

  it('updates the signal when the media query match state changes', () => {
    const stub = stubMatchMedia(false);
    const service = TestBed.inject(MediaQueryService);
    const result = TestBed.runInInjectionContext(() => service.observe('(min-width: 1024px)'));

    expect(result()).toBe(false);
    stub.fireChange(true);
    expect(result()).toBe(true);
  });
});
