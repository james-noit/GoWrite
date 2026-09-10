import { Component, ElementRef, OnInit, inject, output, signal, viewChild } from '@angular/core';
import { AiConnectionService } from '../core/ai/ai-connection.service';
import { AiToolsService } from '../core/ai/ai-tools.service';
import { I18nService } from '../core/i18n/i18n.service';
import type { TranslationKey } from '../core/i18n/translations';
import { DocumentsService } from '../documents/documents.service';
import { Icon } from '../icon';
import type { SettingsTab } from '../settings/settings-modal';
import { FileMenu } from './file-menu';

/** Ported from src/components/Header/Header.tsx (+ its inline `AiStatusCard`). */
@Component({
  selector: 'gowrite-header',
  imports: [FileMenu, Icon],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header implements OnInit {
  protected readonly i18n = inject(I18nService);
  protected readonly docs = inject(DocumentsService);
  protected readonly ai = inject(AiConnectionService);
  protected readonly tools = inject(AiToolsService);

  readonly openSettings = output<SettingsTab>();
  readonly openAiSettings = output<void>();

  protected readonly isEditingTitle = signal(false);
  protected readonly draftTitle = signal('');
  protected readonly showIntro = signal(false);
  protected readonly appVersion =
    (globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ ?? '';

  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

  // One-shot welcome effect (spin the border, sweep a reflection, pop) once the page has fully
  // finished loading — never replays afterwards, since this state only ever flips once.
  ngOnInit(): void {
    if (document.readyState === 'complete') {
      this.showIntro.set(true);
      return;
    }
    window.addEventListener('load', () => this.showIntro.set(true), { once: true });
  }

  protected statusLabel(): string {
    return this.i18n.t(`ai.status.${this.ai.status()}` as TranslationKey);
  }

  protected metaText(): string {
    return this.ai.isConnected()
      ? this.ai.config().model || this.ai.meta().defaultModel
      : this.statusLabel();
  }

  protected startRename(): void {
    this.draftTitle.set(this.docs.currentFilename());
    this.isEditingTitle.set(true);
    queueMicrotask(() => this.titleInput()?.nativeElement.focus());
  }

  protected commitRename(): void {
    const value = this.draftTitle().trim();
    if (value && value !== this.docs.currentFilename()) this.docs.rename(value);
    this.isEditingTitle.set(false);
  }

  protected cancelRename(): void {
    this.isEditingTitle.set(false);
  }

  protected onTitleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.commitRename();
    if (event.key === 'Escape') this.cancelRename();
  }

  protected emitOpenSettings(tab: SettingsTab): void {
    this.openSettings.emit(tab);
  }
}
