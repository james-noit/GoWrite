import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import type { TranslationKey } from '../core/i18n/translations';

const PHRASE_KEYS: TranslationKey[] = [
  'docLoader.phrase1',
  'docLoader.phrase2',
  'docLoader.phrase3',
  'docLoader.phrase4',
  'docLoader.phrase5',
];

const LINE_WIDTHS = [82, 58, 94, 40, 70];

/** A magnifying glass "reads" its way down a stack of skeleton lines while a document loads —
 * ported from src/components/DocLoader.tsx. */
@Component({
  selector: 'gowrite-doc-loader',
  template: `
    <div
      class="doc-loader"
      role="status"
      aria-live="polite"
      [attr.aria-label]="i18n.t('docLoader.ariaLabel')"
    >
      <div class="doc-loader-page">
        @for (w of lineWidths; track $index) {
          <span
            class="doc-loader-line"
            [style.width.%]="w"
            [style.animation-delay.s]="$index * 0.15"
          ></span>
        }
        <span class="doc-loader-glass" aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
          >
            <circle cx="10" cy="10" r="6.5" />
            <line x1="15" y1="15" x2="21" y2="21" />
          </svg>
        </span>
      </div>
      <p class="doc-loader-text" aria-hidden="true">{{ i18n.t(phrase()) }}</p>
    </div>
  `,
  styles: `
    .doc-loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 2rem;
    }
    .doc-loader-page {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: min(240px, 60vw);
    }
    .doc-loader-line {
      height: 8px;
      border-radius: 4px;
      background: currentColor;
      opacity: 0.15;
      animation: gowrite-pulse 1.4s ease-in-out infinite;
    }
    .doc-loader-glass {
      position: absolute;
      right: -4px;
      bottom: -4px;
      opacity: 0.6;
    }
    .doc-loader-text {
      font-size: 0.85rem;
      opacity: 0.7;
      margin: 0;
    }
    @keyframes gowrite-pulse {
      0%,
      100% {
        opacity: 0.1;
      }
      50% {
        opacity: 0.25;
      }
    }
  `,
})
export class DocLoader implements OnInit, OnDestroy {
  protected readonly i18n = inject(I18nService);
  protected readonly lineWidths = LINE_WIDTHS;
  private index = Math.floor(Math.random() * PHRASE_KEYS.length);
  protected readonly phrase = signal(PHRASE_KEYS[this.index]);
  private intervalId: number | undefined;

  ngOnInit(): void {
    this.intervalId = window.setInterval(() => {
      this.index = (this.index + 1) % PHRASE_KEYS.length;
      this.phrase.set(PHRASE_KEYS[this.index]);
    }, 2400);
  }

  ngOnDestroy(): void {
    window.clearInterval(this.intervalId);
  }
}
