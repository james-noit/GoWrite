import { beforeEach, describe, expect, it } from 'vitest';
import { StorageService } from './storage.service';
import type { AiConfig } from './types';

describe('StorageService', () => {
  let storage: StorageService;

  beforeEach(() => {
    localStorage.clear();
    storage = new StorageService();
  });

  it('theme: returns null when nothing is stored', () => {
    expect(storage.theme.get()).toBeNull();
  });

  it('theme: round-trips a stored value', () => {
    storage.theme.set('dark');
    expect(storage.theme.get()).toBe('dark');
  });

  it('aiConfig: round-trips and clears', () => {
    const config: AiConfig = { provider: 'OpenAI', apiKey: 'sk-test', customEndpoint: '', model: 'gpt-4o' };
    storage.aiConfig.set(config);
    expect(storage.aiConfig.get()).toEqual(config);

    storage.aiConfig.clear();
    expect(storage.aiConfig.get()).toBeNull();
  });

  it('aiTools: round-trips a partial config', () => {
    storage.aiTools.set({ autocomplete: { enabled: true, waitSeconds: 2, minWords: 3, maxWords: 12 } });
    expect(storage.aiTools.get()).toEqual({ autocomplete: { enabled: true, waitSeconds: 2, minWords: 3, maxWords: 12 } });
  });

  it('document: round-trips a snapshot', () => {
    const snapshot = { filename: 'notes.md', content: { type: 'doc' }, updatedAt: 12345 };
    storage.document.set(snapshot);
    expect(storage.document.get()).toEqual(snapshot);
  });

  it('editorPrefs: round-trips a value', () => {
    storage.editorPrefs.set({ quickFormatDelayMs: 400 });
    expect(storage.editorPrefs.get()).toEqual({ quickFormatDelayMs: 400 });
  });

  it('coffeeDismissed: defaults to false and round-trips true', () => {
    expect(storage.coffeeDismissed.get()).toBe(false);
    storage.coffeeDismissed.set(true);
    expect(storage.coffeeDismissed.get()).toBe(true);
  });

  it('get() returns null instead of throwing when the stored JSON is corrupt', () => {
    localStorage.setItem('gowrite:theme', '{not valid json');
    expect(storage.theme.get()).toBeNull();
  });

  it('set() fails silently (does not throw) when localStorage.setItem throws', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('QuotaExceededError');
    };
    try {
      expect(() => storage.theme.set('dark')).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it('different keys do not clobber each other', () => {
    storage.theme.set('dark');
    storage.coffeeDismissed.set(true);
    expect(storage.theme.get()).toBe('dark');
    expect(storage.coffeeDismissed.get()).toBe(true);
  });
});
