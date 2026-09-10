import { Injectable, signal } from '@angular/core';
import { translations, type Locale, type TranslationKey } from './translations';

const STORAGE_KEY = 'gowrite:locale';

/**
 * Runtime-switchable locale (no reload needed) — ported from src/hooks/useI18n.tsx. Angular's
 * built-in i18n is compile-time and doesn't fit this requirement, so this stays a hand-rolled
 * service (signal instead of React Context) rather than switching to $localize.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly locale = signal<Locale>(this.detectDefaultLocale());

  setLocale(next: Locale): void {
    this.locale.set(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  t(key: TranslationKey): string {
    return translations[this.locale()][key];
  }

  private detectDefaultLocale(): Locale {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
    return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
  }
}
