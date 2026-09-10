import { Component, inject, signal } from '@angular/core';
import { Icon } from '../icon';
import { FULL_TOOLBAR_TIER_QUERY } from '../core/breakpoints';
import { I18nService } from '../core/i18n/i18n.service';
import { MediaQueryService } from '../core/media-query.service';
import { StorageService } from '../core/storage.service';

const COFFEE_URL = 'https://www.buymeacoffee.com/jamesnoitt';

/** Touch-only, compact stand-in for the header's "Buy me a coffee" badge — ported from
 * src/components/Header/MobileSupportButton.tsx. The original portals to `document.body` to
 * escape any stacking-context ancestors; this app-shell has none of those, so a plain
 * `position: fixed` in mobile-support-button.css does the same job without the portal
 * machinery. */
@Component({
  selector: 'gowrite-mobile-support-button',
  imports: [Icon],
  template: `
    @if (!isFullTier() && !dismissed()) {
      <div class="mobile-coffee">
        <a
          [href]="coffeeUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mobile-coffee-btn"
          [title]="i18n.t('header.buyCoffee')"
          [attr.aria-label]="i18n.t('header.buyCoffee')"
        >
          <gowrite-icon name="coffee" />
        </a>
        <button
          type="button"
          class="mobile-coffee-close"
          (click)="dismiss()"
          [attr.aria-label]="i18n.t('header.dismissSupport')"
        >
          ✕
        </button>
      </div>
    }
  `,
  styleUrl: './mobile-support-button.css',
})
export class MobileSupportButton {
  protected readonly i18n = inject(I18nService);
  private readonly storage = inject(StorageService);
  protected readonly coffeeUrl = COFFEE_URL;

  protected readonly isFullTier = inject(MediaQueryService).observe(FULL_TOOLBAR_TIER_QUERY);
  protected readonly dismissed = signal(this.storage.coffeeDismissed.get());

  protected dismiss(): void {
    this.storage.coffeeDismissed.set(true);
    this.dismissed.set(true);
  }
}
