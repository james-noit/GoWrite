import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocLoader } from './doc-loader';

describe('DocLoader', () => {
  let fixture: ComponentFixture<DocLoader>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DocLoader);
    fixture.detectChanges();
  });

  it('renders a status role with 5 skeleton lines', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="status"]')).toBeTruthy();
    expect(el.querySelectorAll('.doc-loader-line')).toHaveLength(5);
  });

  it('cycles through phrases on an interval', () => {
    // Fake timers must be active *before* ngOnInit's setInterval() call (the shared beforeEach's
    // fixture was already created under real timers), so this test builds its own fixture rather
    // than reusing that one.
    vi.useFakeTimers();
    const freshFixture = TestBed.createComponent(DocLoader);
    freshFixture.detectChanges();
    const el = freshFixture.nativeElement as HTMLElement;
    const first = el.querySelector('.doc-loader-text')?.textContent;

    vi.advanceTimersByTime(2400);
    freshFixture.detectChanges();
    const second = el.querySelector('.doc-loader-text')?.textContent;

    expect(second).not.toBe(first);
    vi.useRealTimers();
  });

  it('stops the interval on destroy (no throw)', () => {
    expect(() => fixture.destroy()).not.toThrow();
  });
});
