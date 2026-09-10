import { Component, OnDestroy, effect, inject, input, output, signal } from '@angular/core';
import type { Editor } from '@tiptap/core';
import { I18nService } from '../core/i18n/i18n.service';
import type { TranslationKey } from '../core/i18n/translations';
import { formatGroups } from './format-groups';
import { ToolbarButtons } from './toolbar-buttons';

// The buttons offered in the selection-triggered quick-format popup on touch devices — the
// handful of formatting actions someone reaches for immediately after selecting text. Anything
// less common (headings, lists, alignment, tables, ...) stays behind the full sheet.
const QUICK_FORMAT_KEYS: TranslationKey[] = [
  'toolbar.bold',
  'toolbar.italic',
  'toolbar.underline',
  'toolbar.strike',
];

interface Pos {
  top: number;
  left: number;
}

/** Touch-only selection toolbar: holding a text selection for `delayMs` pops a small floating
 * bar of the most common formatting actions next to it. Ported from
 * src/components/Editor/Toolbar.tsx's local `QuickFormatPopup` function — rendered with
 * `position: fixed` directly rather than a portal (see mobile-support-button.ts's note; this
 * app-shell has no stacking-context ancestors that would require escaping via a portal). */
@Component({
  selector: 'gowrite-quick-format-popup',
  imports: [ToolbarButtons],
  template: `
    @if (pos(); as p) {
      <div
        class="quick-format-bar"
        [style.top.px]="p.top"
        [style.left.px]="p.left"
        role="toolbar"
        [attr.aria-label]="i18n.t('toolbar.format')"
      >
        <gowrite-toolbar-buttons [editor]="editor()" [buttons]="quickButtons" />
        <button
          type="button"
          class="quick-format-btn quick-format-more"
          [title]="i18n.t('toolbar.moreFormatting')"
          [attr.aria-label]="i18n.t('toolbar.moreFormatting')"
          (mousedown)="$event.preventDefault()"
          (click)="hide(); expand.emit()"
        >
          ⋯
        </button>
      </div>
    }
  `,
  styleUrl: './quick-format-popup.css',
})
export class QuickFormatPopup implements OnDestroy {
  protected readonly i18n = inject(I18nService);
  readonly editor = input.required<Editor>();
  readonly delayMs = input(500);
  readonly expand = output<void>();

  protected readonly pos = signal<Pos | null>(null);
  protected readonly quickButtons = formatGroups
    .find((g) => g.labelKey === 'toolbar.group.font')!
    .buttons.filter((btn) => QUICK_FORMAT_KEYS.includes(btn.titleKey));

  private timer: number | undefined;
  private lastRange: { from: number; to: number } | null = null;
  private attachedEditor: Editor | null = null;

  private readonly onSelectionUpdate = () => {
    const editor = this.attachedEditor;
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const prev = this.lastRange;
    this.lastRange = { from, to };
    // A command applied from the popup itself (e.g. toggling bold) re-fires this event without
    // actually moving the selection — ignore that so the popup doesn't hide right after use.
    if (prev && prev.from === from && prev.to === to) return;

    this.clearTimer();
    this.pos.set(null);
    if (from === to) return;
    this.timer = window.setTimeout(() => {
      const sel = editor.state.selection;
      if (sel.from === sel.to) return;
      this.showNear(editor, sel.from, sel.to);
    }, this.delayMs());
  };
  private readonly onScroll = () => this.hide();

  constructor() {
    effect(() => {
      const editor = this.editor();
      if (this.attachedEditor === editor) return;
      this.attachedEditor?.off('selectionUpdate', this.onSelectionUpdate);
      this.attachedEditor = editor;
      editor.on('selectionUpdate', this.onSelectionUpdate);
    });
    window.addEventListener('scroll', this.onScroll, true);
  }

  ngOnDestroy(): void {
    this.clearTimer();
    this.attachedEditor?.off('selectionUpdate', this.onSelectionUpdate);
    window.removeEventListener('scroll', this.onScroll, true);
  }

  private showNear(editor: Editor, from: number, to: number): void {
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    const top = Math.min(start.top, end.top);
    const rawLeft = (Math.min(start.left, end.left) + Math.max(start.right, end.right)) / 2;
    const margin = 90;
    const left = Math.min(Math.max(rawLeft, margin), window.innerWidth - margin);
    this.pos.set({ top, left });
  }

  private clearTimer(): void {
    window.clearTimeout(this.timer);
    this.timer = undefined;
  }

  hide(): void {
    this.clearTimer();
    this.pos.set(null);
  }
}
