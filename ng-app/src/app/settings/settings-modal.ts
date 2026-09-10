import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { AiConnectionService } from '../core/ai/ai-connection.service';
import { AiToolsService } from '../core/ai/ai-tools.service';
import { providerList } from '../core/ai/providers';
import { EditorPrefsService } from '../core/editor-prefs.service';
import { I18nService } from '../core/i18n/i18n.service';
import type { Locale } from '../core/i18n/translations';
import { ThemeService } from '../core/theme.service';
import type { AiProviderId } from '../core/types';

export type SettingsTab = 'general' | 'ai';

/**
 * Ported from src/components/Settings/SettingsModal.tsx. Structural/behavioral port — general
 * tab's "clear storage" section is deliberately omitted here: it depends on DocumentsService
 * (useDocuments.ts's port), which is Phase 6 work, not yet built. Everything else (appearance,
 * quick-format delay, AI provider config + tools) is real and wired to the real services.
 *
 * Always rendered (visibility controlled by `open`, not `@if` at the call site) so its effects —
 * syncing to `initialTab` on open, auto-collapsing the AI config accordion on connect — keep
 * running exactly like the React original, whose hooks all run every render regardless of the
 * `if (!open) return null` that comes after them.
 */
@Component({
  selector: 'gowrite-settings-modal',
  imports: [CdkTrapFocus],
  templateUrl: './settings-modal.html',
  styleUrl: './settings-modal.css',
})
export class SettingsModal {
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(ThemeService);
  protected readonly editorPrefs = inject(EditorPrefsService);
  protected readonly ai = inject(AiConnectionService);
  protected readonly tools = inject(AiToolsService);

  readonly open = input(false);
  readonly initialTab = input<SettingsTab>('general');
  readonly closed = output<void>();

  protected readonly tab = signal<SettingsTab>('general');
  protected readonly configOpen = signal(!this.ai.isConnected());
  protected readonly autoFlash = signal<'on' | 'off' | null>(null);
  protected readonly providerList = providerList;
  protected readonly locales: Locale[] = ['es', 'en'];
  private flashTimer: number | undefined;

  constructor() {
    // Re-sync to whichever tab the caller asked for each time the modal opens.
    effect(() => {
      const isOpen = this.open();
      const initial = this.initialTab();
      if (isOpen) this.tab.set(initial);
    });

    // Auto-collapse provider config on successful connection; reopen it when it drops.
    effect(() => {
      const status = this.ai.status();
      if (status === 'connected') this.configOpen.set(false);
      if (status === 'error') this.configOpen.set(true);
    });

    effect((onCleanup) => {
      if (!this.open()) return;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') this.closed.emit();
      };
      document.addEventListener('keydown', onKeyDown);
      onCleanup(() => document.removeEventListener('keydown', onKeyDown));
    });
  }

  protected statusLabel(): string {
    return this.i18n.t(`ai.status.${this.ai.status()}`);
  }

  protected setTab(tab: SettingsTab): void {
    this.tab.set(tab);
  }

  protected toggleConfigOpen(): void {
    this.configOpen.update((v) => !v);
  }

  protected setLocale(locale: Locale): void {
    this.i18n.setLocale(locale);
  }

  protected setProvider(provider: string): void {
    this.ai.setProvider(provider as AiProviderId);
  }

  protected toggleAutocomplete(): void {
    const next = !this.tools.config().autocomplete.enabled;
    this.tools.updateTool('autocomplete', { enabled: next });
    this.autoFlash.set(next ? 'on' : 'off');
    window.clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => this.autoFlash.set(null), 2000);
  }

  protected close(): void {
    this.closed.emit();
  }
}
