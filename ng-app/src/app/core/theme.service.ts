import { effect, inject, Injectable, signal } from '@angular/core';
import { StorageService } from './storage.service';
import type { Theme } from './types';

/** Light/dark theme, synced to `<html data-theme>` and persisted — ported from src/hooks/useTheme.ts. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storage = inject(StorageService);
  readonly theme = signal<Theme>(this.storage.theme.get() ?? 'light');

  constructor() {
    effect(() => {
      const value = this.theme();
      document.documentElement.dataset['theme'] = value;
      this.storage.theme.set(value);
    });
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
  }

  toggleTheme(): void {
    this.theme.update((current) => (current === 'light' ? 'dark' : 'light'));
  }
}
