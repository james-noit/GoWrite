import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { EditorPrefsService } from './editor-prefs.service';

describe('EditorPrefsService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults quickFormatDelayMs to 500', () => {
    const prefs = TestBed.inject(EditorPrefsService);
    expect(prefs.config()).toEqual({ quickFormatDelayMs: 500 });
  });

  it('update() merges a patch and persists it', () => {
    const prefs = TestBed.inject(EditorPrefsService);
    prefs.update({ quickFormatDelayMs: 800 });
    expect(prefs.config().quickFormatDelayMs).toBe(800);
    expect(JSON.parse(localStorage.getItem('gowrite:editor-prefs')!)).toEqual({ quickFormatDelayMs: 800 });
  });
});
