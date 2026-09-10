import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from './i18n.service';
import { translations } from './translations';

function stubLanguage(language: string) {
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(language);
}

describe('I18nService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to Spanish when the browser language starts with "es"', () => {
    stubLanguage('es-MX');
    expect(new I18nService().locale()).toBe('es');
  });

  it('defaults to English when the browser language does not start with "es"', () => {
    stubLanguage('fr-FR');
    expect(new I18nService().locale()).toBe('en');
  });

  it('prefers a previously stored locale over the browser language', () => {
    localStorage.setItem('gowrite:locale', 'en');
    stubLanguage('es-ES');
    expect(new I18nService().locale()).toBe('en');
  });

  it('t() looks up the key in the current locale', () => {
    stubLanguage('en-US');
    const i18n = new I18nService();
    expect(i18n.t('common.close')).toBe(translations.en['common.close']);
  });

  it('setLocale updates the signal and persists the choice for next time', () => {
    stubLanguage('en-US');
    const i18n = new I18nService();
    i18n.setLocale('es');

    expect(i18n.locale()).toBe('es');
    expect(i18n.t('common.close')).toBe(translations.es['common.close']);
    expect(localStorage.getItem('gowrite:locale')).toBe('es');

    // a fresh instance (simulating a reload) should pick up the persisted choice
    expect(new I18nService().locale()).toBe('es');
  });
});
