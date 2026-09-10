import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import type { Editor } from '@tiptap/core';
import { Icon } from '../icon';
import { I18nService } from '../core/i18n/i18n.service';
import { EditorService } from './editor.service';
import { formatPainter } from './format-painter';
import type { ToolbarButton } from './format-groups';

/** Renders one group's worth of `ToolbarButton`s against a given editor — extracted from
 * src/components/Editor/Toolbar.tsx's local `GroupButtons` function since it's reused by both
 * the format sheet and the touch-only quick-format popup. */
@Component({
  selector: 'gowrite-toolbar-buttons',
  imports: [Icon],
  template: `
    <!-- Reading revision()/painterTick() here is what makes isActive()/isDisabled() below
    re-evaluate on every cursor/selection/content change and every formatPainter toggle — Tiptap
    and formatPainter both track their own state internally and don't otherwise notify Angular's
    change detection, matching why the React original force-updates on both an editor
    "transaction" event and a formatPainter.subscribe() notification. -->
    @let _r = editorService.revision();
    @let _p = painterTick();
    <div class="toolbar-group-buttons" [attr.data-revision]="_r" [attr.data-painter-tick]="_p">
      @for (btn of buttons(); track btn.titleKey) {
        <button
          type="button"
          [title]="i18n.t(btn.titleKey)"
          [disabled]="btn.isDisabled?.(editor()) ?? false"
          class="toolbar-btn"
          [class.is-active]="btn.isActive?.(editor()) ?? false"
          (mousedown)="$event.preventDefault()"
          (click)="btn.run(editor(), i18n.t.bind(i18n))"
        >
          @if (btn.icon) {
            <gowrite-icon [name]="btn.icon" />
          } @else if (btn.labelKey) {
            {{ i18n.t(btn.labelKey) }}
          } @else {
            {{ btn.label }}
          }
        </button>
      }
    </div>
  `,
})
export class ToolbarButtons {
  protected readonly i18n = inject(I18nService);
  protected readonly editorService = inject(EditorService);
  readonly editor = input.required<Editor>();
  readonly buttons = input.required<ToolbarButton[]>();

  protected readonly painterTick = signal(0);

  constructor() {
    const unsubscribe = formatPainter.subscribe(() => this.painterTick.update((v) => v + 1));
    inject(DestroyRef).onDestroy(unsubscribe);
  }
}
