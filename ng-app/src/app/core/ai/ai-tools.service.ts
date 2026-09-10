import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from '../storage.service';
import type { AiToolsConfig } from '../types';

const DEFAULTS: AiToolsConfig = {
  autocomplete: { enabled: false, waitSeconds: 3, minWords: 5, maxWords: 30 },
};

/** Ported from src/hooks/useAiTools.ts. */
@Injectable({ providedIn: 'root' })
export class AiToolsService {
  private readonly storage = inject(StorageService);

  readonly config = signal<AiToolsConfig>(this.load());

  updateTool<K extends keyof AiToolsConfig>(tool: K, patch: Partial<AiToolsConfig[K]>): void {
    const prev = this.config();
    const next = { ...prev, [tool]: { ...prev[tool], ...patch } };
    this.storage.aiTools.set(next);
    this.config.set(next);
  }

  private load(): AiToolsConfig {
    const stored = this.storage.aiTools.get();
    if (!stored) return DEFAULTS;
    return { autocomplete: { ...DEFAULTS.autocomplete, ...stored.autocomplete } };
  }
}
