import { Component, computed, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { inject } from '@angular/core';
import { iconMarkup, type IconName } from './icons';

/** Renders one icon from icons.ts's static, trusted SVG markup registry — used everywhere a real
 * Angular component tree renders an icon (Toolbar, Header, ContextMenu); the NodeViews
 * (code-block.ts/image.ts) use `createIcon()` directly instead, since they're plain DOM. */
@Component({
  selector: 'gowrite-icon',
  template: `<span class="gowrite-icon" [innerHTML]="markup()"></span>`,
  styles: `
    .gowrite-icon {
      display: inline-flex;
      line-height: 0;
    }
  `,
})
export class Icon {
  private readonly sanitizer = inject(DomSanitizer);
  readonly name = input.required<IconName>();
  protected readonly markup = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(iconMarkup(this.name())),
  );
}
