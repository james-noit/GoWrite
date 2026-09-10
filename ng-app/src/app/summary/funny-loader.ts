import { Component, OnDestroy, OnInit, signal } from '@angular/core';

const PHRASES = [
  'Chimpancés escribiendo a máquina…',
  'Generando mediante robots…',
  'Tecleando muy deprisa…',
  'Consultando a las musas…',
  'Afilando lápices digitales…',
  'Sobornando al corrector ortográfico…',
  'Despertando a las neuronas artificiales…',
];

/** Ported from src/components/FunnyLoader.tsx. Phrases are hardcoded Spanish, not routed through
 * I18nService — an existing gap in the React app (see docs/angular-migration-plan.md §6/§8,
 * grouped with the DEFAULT_FILENAME gap), carried forward as-is rather than fixed as a drive-by
 * during this port. */
@Component({
  selector: 'gowrite-funny-loader',
  template: `
    <span
      class="funny-loader"
      role="status"
      aria-live="polite"
      aria-label="Generando respuesta de la IA, por favor espera"
    >
      <span class="spinner" aria-hidden="true"></span>
      <span class="funny-loader-text" aria-hidden="true">{{ phrase() }}</span>
    </span>
  `,
  styles: `
    .funny-loader {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #888;
      border-top-color: transparent;
      border-radius: 50%;
      animation: gowrite-spin 0.8s linear infinite;
    }
    @keyframes gowrite-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class FunnyLoader implements OnInit, OnDestroy {
  private index = Math.floor(Math.random() * PHRASES.length);
  readonly phrase = signal(PHRASES[this.index]);
  private intervalId: number | undefined;

  ngOnInit(): void {
    this.intervalId = window.setInterval(() => {
      this.index = (this.index + 1) % PHRASES.length;
      this.phrase.set(PHRASES[this.index]);
    }, 2200);
  }

  ngOnDestroy(): void {
    window.clearInterval(this.intervalId);
  }
}
