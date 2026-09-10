import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dataset['theme'] = '';
  });

  it('defaults to light when nothing is stored', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.theme()).toBe('light');
  });

  it('picks up a previously stored theme', () => {
    localStorage.setItem('gowrite:theme', '"dark"');
    const theme = TestBed.inject(ThemeService);
    expect(theme.theme()).toBe('dark');
  });

  it('syncs document.documentElement.dataset.theme and persists on change', () => {
    const theme = TestBed.inject(ThemeService);
    theme.setTheme('dark');
    TestBed.flushEffects();

    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('gowrite:theme')).toBe('"dark"');
  });

  it('toggleTheme flips between light and dark', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.theme()).toBe('light');

    theme.toggleTheme();
    expect(theme.theme()).toBe('dark');

    theme.toggleTheme();
    expect(theme.theme()).toBe('light');
  });

  it('syncs the DOM immediately on construction, not just on later changes', () => {
    localStorage.setItem('gowrite:theme', '"dark"');
    TestBed.inject(ThemeService);
    TestBed.flushEffects();

    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});
