import { Injectable } from '@angular/core';
import type { AiConfig, AiToolsConfig, DocumentSnapshot, EditorPrefsConfig, Theme } from './types';

const KEYS = {
  theme: 'gowrite:theme',
  aiConfig: 'gowrite:ai-config',
  aiTools: 'gowrite:ai-tools',
  document: 'gowrite:document',
  editorPrefs: 'gowrite:editor-prefs',
  coffeeDismissed: 'gowrite:coffee-dismissed',
} as const;

/**
 * Thin wrapper around localStorage — ported from src/lib/storage.ts. Kept as an injectable
 * (rather than plain module-level functions like the React original) so components/services
 * consuming it can be tested against a fake in Angular's TestBed instead of touching real
 * localStorage.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage unavailable (private mode / quota) — fail silently, editing still works
    }
  }

  readonly theme = {
    get: (): Theme | null => this.read<Theme>(KEYS.theme),
    set: (theme: Theme): void => this.write(KEYS.theme, theme),
  };

  readonly aiConfig = {
    get: (): AiConfig | null => this.read<AiConfig>(KEYS.aiConfig),
    set: (config: AiConfig): void => this.write(KEYS.aiConfig, config),
    clear: (): void => localStorage.removeItem(KEYS.aiConfig),
  };

  readonly aiTools = {
    get: (): Partial<AiToolsConfig> | null => this.read<Partial<AiToolsConfig>>(KEYS.aiTools),
    set: (config: AiToolsConfig): void => this.write(KEYS.aiTools, config),
  };

  readonly document = {
    get: (): DocumentSnapshot | null => this.read<DocumentSnapshot>(KEYS.document),
    set: (snapshot: DocumentSnapshot): void => this.write(KEYS.document, snapshot),
  };

  readonly editorPrefs = {
    get: (): Partial<EditorPrefsConfig> | null => this.read<Partial<EditorPrefsConfig>>(KEYS.editorPrefs),
    set: (prefs: EditorPrefsConfig): void => this.write(KEYS.editorPrefs, prefs),
  };

  readonly coffeeDismissed = {
    get: (): boolean => this.read<boolean>(KEYS.coffeeDismissed) === true,
    set: (dismissed: boolean): void => this.write(KEYS.coffeeDismissed, dismissed),
  };
}
