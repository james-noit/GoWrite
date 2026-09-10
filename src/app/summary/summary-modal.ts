import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { generate, summaryMessages } from '../core/ai/actions';
import { AiConnectionService } from '../core/ai/ai-connection.service';
import { I18nService } from '../core/i18n/i18n.service';
import type { TranslationKey } from '../core/i18n/translations';
import { FunnyLoader } from './funny-loader';

export interface SummaryRequest {
  text: string;
  titleKey: TranslationKey;
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Ported from src/components/SummaryModal.tsx. */
@Component({
  selector: 'gowrite-summary-modal',
  imports: [CdkTrapFocus, FunnyLoader],
  templateUrl: './summary-modal.html',
  styleUrl: './summary-modal.css',
})
export class SummaryModal {
  private readonly i18n = inject(I18nService);
  private readonly ai = inject(AiConnectionService);

  readonly request = input<SummaryRequest | null>(null);
  readonly closed = output<void>();

  protected readonly text = signal('');
  protected readonly isRunning = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly copied = signal(false);
  private controller: AbortController | null = null;

  protected readonly t = (key: TranslationKey) => this.i18n.t(key);

  constructor() {
    effect((onCleanup) => {
      const req = this.request();
      if (!req) return;

      this.text.set('');
      this.error.set(null);
      this.copied.set(false);

      if (!req.text.trim()) {
        this.error.set(this.i18n.t('summary.noText'));
        return;
      }

      const controller = new AbortController();
      this.controller = controller;
      this.isRunning.set(true);
      void (async () => {
        try {
          const result = await generate({
            messages: summaryMessages(req.text),
            config: this.ai.config(),
            signal: controller.signal,
          });
          this.text.set(result.trim());
        } catch (err) {
          if ((err as Error).name !== 'AbortError') {
            this.error.set((err as Error).message || this.i18n.t('summary.genericError'));
          }
        } finally {
          this.isRunning.set(false);
        }
      })();

      onCleanup(() => controller.abort());
    });

    effect((onCleanup) => {
      if (!this.request()) return;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') this.closed.emit();
      };
      document.addEventListener('keydown', onKeyDown);
      onCleanup(() => document.removeEventListener('keydown', onKeyDown));
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected stop(): void {
    this.controller?.abort();
  }

  protected copyText(): void {
    void navigator.clipboard
      .writeText(this.text())
      .then(() => {
        this.copied.set(true);
        window.setTimeout(() => this.copied.set(false), 1500);
      })
      .catch(() => {});
  }

  protected downloadTxt(): void {
    download(new Blob([this.text()], { type: 'text/plain;charset=utf-8' }), `${this.baseName()}.txt`);
  }

  protected downloadMd(): void {
    download(new Blob([this.text()], { type: 'text/markdown;charset=utf-8' }), `${this.baseName()}.md`);
  }

  protected async downloadDocx(): Promise<void> {
    const { Document, Packer, Paragraph } = await import('docx');
    const paragraphs = this.text()
      .split(/\r?\n+/)
      .filter((line) => line.trim())
      .map((line) => new Paragraph(line));
    const doc = new Document({
      sections: [{ children: paragraphs.length ? paragraphs : [new Paragraph('')] }],
    });
    download(await Packer.toBlob(doc), `${this.baseName()}.docx`);
  }

  private baseName(): string {
    return this.i18n.t('summary.fileBaseName');
  }
}
