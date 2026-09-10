import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import type { EditorPrefsConfig } from './types';

const DEFAULTS: EditorPrefsConfig = {
  quickFormatDelayMs: 500,
};

/** Ported from src/hooks/useEditorPrefs.ts. Ported ahead of its Phase 6 slot (it belongs with
 * Toolbar, which reads quickFormatDelayMs) because SettingsModal's General tab needs it too and
 * SettingsModal is Phase 5 work — same "small needed dependency, port it now" call as icons.ts
 * in Phase 3. */
@Injectable({ providedIn: 'root' })
export class EditorPrefsService {
  private readonly storage = inject(StorageService);

  readonly config = signal<EditorPrefsConfig>(this.load());

  update(patch: Partial<EditorPrefsConfig>): void {
    const next = { ...this.config(), ...patch };
    this.storage.editorPrefs.set(next);
    this.config.set(next);
  }

  private load(): EditorPrefsConfig {
    const stored = this.storage.editorPrefs.get();
    if (!stored) return DEFAULTS;
    return { ...DEFAULTS, ...stored };
  }
}
