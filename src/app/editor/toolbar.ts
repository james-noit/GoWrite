import { NgTemplateOutlet } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import type { Editor } from '@tiptap/core';
import { FULL_TOOLBAR_TIER_QUERY } from '../core/breakpoints';
import { I18nService } from '../core/i18n/i18n.service';
import { MediaQueryService } from '../core/media-query.service';
import { Icon } from '../icon';
import { EditorService } from './editor.service';
import { formatGroups as groups } from './format-groups';
import { QuickFormatPopup } from './quick-format-popup';
import { insertTableAction, tableEditActions } from './table-actions';
import { ToolbarButtons } from './toolbar-buttons';

const FONT_FAMILIES = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: '"Courier New", monospace', label: 'Courier New' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: '"Trebuchet MS", sans-serif', label: 'Trebuchet MS' },
];

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '40px'];
const DEFAULT_FONT_FAMILY_LABEL = 'Inter';
const DEFAULT_FONT_SIZE_LABEL = '16px';
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

interface SavedSelection {
  from: number;
  to: number;
}

/**
 * Ported from src/components/Editor/Toolbar.tsx. The React original split into several local
 * function components (TypographyControls, TableControls, FormatGroups) purely for code
 * organization, not for separate reactivity boundaries — they're inlined as template sections
 * here instead, since Angular doesn't need the split to stay readable. `GroupButtons` and
 * `QuickFormatPopup` *are* separate Angular components (toolbar-buttons.ts, quick-format-popup.ts)
 * because both are genuinely reused across more than one place in this component's own template.
 */
@Component({
  selector: 'gowrite-toolbar',
  imports: [Icon, ToolbarButtons, QuickFormatPopup, NgTemplateOutlet],
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.css',
})
export class Toolbar {
  protected readonly i18n = inject(I18nService);
  protected readonly editorService = inject(EditorService);
  private readonly mediaQuery = inject(MediaQueryService);

  readonly quickFormatDelayMs = input(500);

  protected readonly isFullTier = this.mediaQuery.observe(FULL_TOOLBAR_TIER_QUERY);
  protected readonly menuOpen = signal(false);
  protected readonly groups = groups;
  protected readonly insertTableAction = insertTableAction;
  protected readonly tableEditActions = tableEditActions;
  protected readonly fontFamilies = FONT_FAMILIES;
  protected readonly fontSizes = FONT_SIZES;
  protected readonly defaultFontFamilyLabel = DEFAULT_FONT_FAMILY_LABEL;
  protected readonly defaultFontSizeLabel = DEFAULT_FONT_SIZE_LABEL;

  private savedSelection: SavedSelection | null = null;

  constructor() {
    // The sheet is non-modal by design (the document must stay reachable while formatting), so it
    // only closes on an explicit action: the toggle, its own close button, or Escape.
    effect((onCleanup) => {
      if (!this.menuOpen()) return;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') this.menuOpen.set(false);
      };
      document.addEventListener('keydown', onKeyDown);
      onCleanup(() => document.removeEventListener('keydown', onKeyDown));
    });

    // Snapshot the editor's selection whenever the user touches toolbar chrome (inline bar or
    // sheet), so a native picker that steals focus (a <select> or a color input) can have the
    // selection restored before its command runs.
    effect((onCleanup) => {
      const editor = this.editorService.editor();
      if (!editor) return;
      const onPointerDown = () => {
        const { from, to } = editor.state.selection;
        this.savedSelection = { from, to };
      };
      document.addEventListener('pointerdown', onPointerDown, true);
      onCleanup(() => document.removeEventListener('pointerdown', onPointerDown, true));
    });

    // The sheet can occlude the lower half of a short viewport, so nudge the caret back into view
    // once it opens rather than leaving the user formatting text they can no longer see.
    effect((onCleanup) => {
      const editor = this.editorService.editor();
      if (!this.menuOpen() || !editor) return;
      const id = requestAnimationFrame(() => editor.commands.scrollIntoView());
      onCleanup(() => cancelAnimationFrame(id));
    });
  }

  protected inTable(editor: Editor): boolean {
    return editor.isActive('table');
  }

  protected restoreSelectionIfCollapsed(editor: Editor): void {
    const saved = this.savedSelection;
    if (!saved || saved.from === saved.to) return;
    const { from, to } = editor.state.selection;
    if (from === to) editor.commands.setTextSelection(saved);
  }

  protected color(editor: Editor): string {
    const raw = (editor.getAttributes('textStyle')['color'] as string | undefined) ?? '';
    return HEX_COLOR_RE.test(raw) ? raw : '#000000';
  }

  protected rawColor(editor: Editor): string {
    return (editor.getAttributes('textStyle')['color'] as string | undefined) ?? '';
  }

  protected highlight(editor: Editor): string {
    const raw = (editor.getAttributes('highlight')['color'] as string | undefined) ?? '';
    return HEX_COLOR_RE.test(raw) ? raw : '#ffff00';
  }

  protected rawHighlight(editor: Editor): string {
    return (editor.getAttributes('highlight')['color'] as string | undefined) ?? '';
  }

  protected fontFamily(editor: Editor): string {
    return (editor.getAttributes('textStyle')['fontFamily'] as string | undefined) ?? '';
  }

  protected fontSize(editor: Editor): string {
    return (editor.getAttributes('textStyle')['fontSize'] as string | undefined) ?? '';
  }

  protected onColorChange(editor: Editor, value: string): void {
    this.restoreSelectionIfCollapsed(editor);
    editor.chain().focus().setColor(value).run();
  }

  protected onColorClear(editor: Editor): void {
    editor.chain().focus().unsetColor().run();
  }

  protected onFontFamilyChange(editor: Editor, value: string): void {
    this.restoreSelectionIfCollapsed(editor);
    if (!value) editor.chain().focus().unsetFontFamily().run();
    else editor.chain().focus().setFontFamily(value).run();
  }

  protected onFontSizeChange(editor: Editor, value: string): void {
    this.restoreSelectionIfCollapsed(editor);
    if (!value) editor.chain().focus().unsetFontSize().run();
    else editor.chain().focus().setFontSize(value).run();
  }

  protected onHighlightChange(editor: Editor, value: string): void {
    this.restoreSelectionIfCollapsed(editor);
    editor.chain().focus().setHighlight({ color: value }).run();
  }

  protected onHighlightClear(editor: Editor): void {
    editor.chain().focus().unsetHighlight().run();
  }

  protected toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
