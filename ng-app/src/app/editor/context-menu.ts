import { Component, ElementRef, effect, inject, output, signal, viewChild } from '@angular/core';
import type { Editor } from '@tiptap/core';
import { AiConnectionService } from '../core/ai/ai-connection.service';
import {
  continuationMessages,
  documentText,
  editMessages,
  formatMessages,
  generate,
} from '../core/ai/actions';
import { describeImage, supportsImageDescription } from '../core/ai/describe-image';
import { generateImage, supportsImageGeneration } from '../core/ai/image-gen';
import { I18nService } from '../core/i18n/i18n.service';
import type { TranslationKey } from '../core/i18n/translations';
import { textToHtml } from '../core/text';
import { Icon } from '../icon';
import { FunnyLoader } from '../summary/funny-loader';
import { EditorService } from './editor.service';
import { formatGroups } from './format-groups';
import { LastAiEditService } from './last-ai-edit.service';
import { insertTableAction, tableEditActions } from './table-actions';

export interface SummaryRequest {
  text: string;
  titleKey: TranslationKey;
}

type Tool = 'edit' | 'generate' | 'format' | 'image' | 'describe';
type Stage = 'menu' | 'options' | 'generating' | 'review';

interface Range {
  from: number;
  to: number;
}

const MENU_WIDTH = 260;
const MENU_MAX_HEIGHT = 460;
const DEFAULT_GEN_MIN_WORDS = 50;
const DEFAULT_GEN_MAX_WORDS = 150;

/**
 * Right-click menu inside the editor: the same format/table commands as the toolbar (icon-only),
 * plus selection-scoped AI actions (summarize, edit, autogenerate, give format, AI image
 * insert/describe). Ported from src/components/Editor/ContextMenu.tsx (727 lines) — the plan
 * (§2.2) called this out as a redesign, not a straight port, because React's local closures made
 * the 4-stage state machine (menu → options → generating → review) hard to follow. In practice,
 * once each `useState` becomes a signal and the giant function becomes a class with named
 * methods, the *structure* ports directly and cleanly — no separate `ContextMenuService` or
 * per-tool components turned out to be needed (nothing else in the app reuses this state machine,
 * unlike e.g. `formatGroups`/`tableActions`, which both toolbar and this menu share already).
 * That's a deliberate scope reduction from the plan's original "service + several tool
 * components" sketch, made the same way Toolbar's local React function components were inlined
 * in Phase 6 rather than split for their own sake.
 *
 * Injects `EditorService`/`AiConnectionService`/`LastAiEditService` directly rather than taking
 * them as inputs (same as `Toolbar`) — mounted once inside `EditorHost`'s template, in the same
 * injector subtree that provides `LastAiEditService` per-editor-instance, so `record()` calls here
 * land on the same instance `EditorHost`'s "Undo last AI generation" button reads from.
 */
@Component({
  selector: 'gowrite-context-menu',
  imports: [Icon, FunnyLoader],
  templateUrl: './context-menu.html',
  styleUrl: './context-menu.css',
})
export class ContextMenu {
  protected readonly i18n = inject(I18nService);
  protected readonly editorService = inject(EditorService);
  protected readonly ai = inject(AiConnectionService);
  private readonly lastAiEdit = inject(LastAiEditService);

  readonly openSummary = output<SummaryRequest>();

  private readonly rootEl = viewChild<ElementRef<HTMLDivElement>>('root');

  protected readonly menuWidth = MENU_WIDTH;
  protected readonly menuMaxHeight = MENU_MAX_HEIGHT;
  protected readonly groups = formatGroups;
  protected readonly flatFormatButtons = formatGroups.flatMap((g) => g.buttons);
  protected readonly insertTableAction = insertTableAction;
  protected readonly tableEditActions = tableEditActions;

  protected readonly pos = signal<{ x: number; y: number } | null>(null);
  protected readonly tool = signal<Tool | null>(null);
  protected readonly stage = signal<Stage>('menu');
  protected readonly range = signal<Range | null>(null);
  protected readonly cursorPos = signal(0);
  protected readonly imageSrc = signal<string | null>(null);

  protected readonly instruction = signal('');
  protected readonly genMin = signal(DEFAULT_GEN_MIN_WORDS);
  protected readonly genMax = signal(DEFAULT_GEN_MAX_WORDS);
  protected readonly formatScope = signal<'selection' | 'document'>('selection');
  protected readonly fmtParagraphs = signal(true);
  protected readonly fmtPunctuation = signal(true);
  protected readonly fmtStructure = signal(true);
  protected readonly imagePrompt = signal('');
  protected readonly describePrompt = signal('');
  protected readonly copied = signal(false);

  protected readonly draft = signal('');
  protected readonly error = signal<string | null>(null);
  private insertRange: Range | null = null;
  private insertAt: number | null = null;

  protected readonly aiDisabled = () => !this.ai.isConnected();
  protected readonly supportsImageGen = () => supportsImageGeneration(this.ai.config().provider);
  protected readonly supportsImageDescribe = () => supportsImageDescription(this.ai.config().provider);

  private controller: AbortController | null = null;
  private attachedEditor: Editor | null = null;

  private readonly onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const editor = this.attachedEditor;
    if (!editor) return;
    const { from, to, empty, head } = editor.state.selection;
    this.range.set(empty ? null : { from, to });
    this.cursorPos.set(head);
    const target = e.target as HTMLElement | null;
    const imgEl = target?.closest('.gw-image')?.querySelector('img') as HTMLImageElement | null;
    this.imageSrc.set(imgEl?.src ?? null);
    this.tool.set(null);
    this.stage.set('menu');
    this.instruction.set('');
    this.imagePrompt.set('');
    this.describePrompt.set('');
    this.copied.set(false);
    this.draft.set('');
    this.insertRange = null;
    this.insertAt = null;
    this.error.set(null);
    this.formatScope.set(empty ? 'document' : 'selection');
    const x = Math.max(10, Math.min(e.clientX, window.innerWidth - MENU_WIDTH - 10));
    const y = Math.max(10, Math.min(e.clientY, window.innerHeight - 10 - Math.min(MENU_MAX_HEIGHT, 320)));
    this.pos.set({ x, y });
  };

  constructor() {
    effect((onCleanup) => {
      const editor = this.editorService.editor();
      if (!editor) return;
      this.attachedEditor = editor;
      const dom = editor.view.dom;
      dom.addEventListener('contextmenu', this.onContextMenu);
      onCleanup(() => {
        dom.removeEventListener('contextmenu', this.onContextMenu);
        this.attachedEditor = null;
      });
    });

    effect((onCleanup) => {
      if (!this.pos()) return;
      const onPointerDown = (e: MouseEvent) => {
        const root = this.rootEl()?.nativeElement;
        if (root && !root.contains(e.target as Node)) this.close();
      };
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') this.close();
      };
      document.addEventListener('mousedown', onPointerDown);
      document.addEventListener('keydown', onKeyDown);
      onCleanup(() => {
        document.removeEventListener('mousedown', onPointerDown);
        document.removeEventListener('keydown', onKeyDown);
      });
    });
  }

  protected close(): void {
    this.controller?.abort();
    this.pos.set(null);
    this.tool.set(null);
    this.stage.set('menu');
    this.range.set(null);
    this.imageSrc.set(null);
    this.instruction.set('');
    this.imagePrompt.set('');
    this.describePrompt.set('');
    this.copied.set(false);
    this.draft.set('');
    this.insertRange = null;
    this.insertAt = null;
    this.error.set(null);
  }

  protected inTable(editor: Editor): boolean {
    return editor.isActive('table');
  }

  protected runFormatButton(editor: Editor, run: (editor: Editor, t: (key: TranslationKey) => string) => void): void {
    run(editor, this.i18n.t.bind(this.i18n));
    this.close();
  }

  protected runTableAction(editor: Editor, run: (editor: Editor) => void): void {
    run(editor);
    this.close();
  }

  private emitSummary(text: string, titleKey: TranslationKey): void {
    this.openSummary.emit({ text, titleKey });
    this.close();
  }

  protected summarizeSelection(editor: Editor): void {
    const r = this.range();
    if (!r) return;
    this.emitSummary(editor.state.doc.textBetween(r.from, r.to, '\n'), 'summary.titleSelection');
  }

  protected summarizeBefore(editor: Editor): void {
    const r = this.range();
    if (!r) return;
    this.emitSummary(editor.state.doc.textBetween(0, r.from, '\n'), 'summary.titleBefore');
  }

  protected summarizeAfter(editor: Editor): void {
    const r = this.range();
    if (!r) return;
    this.emitSummary(editor.state.doc.textBetween(r.to, editor.state.doc.content.size, '\n'), 'summary.titleAfter');
  }

  protected summarizeDocument(editor: Editor): void {
    this.emitSummary(documentText(editor), 'summary.titleDocument');
  }

  protected openTool(tool: Tool): void {
    this.tool.set(tool);
    if (tool === 'describe') this.describePrompt.set(this.i18n.t('contextMenu.aiDescribeDefaultPrompt'));
    this.stage.set('options');
  }

  protected backToMenu(): void {
    this.stage.set('menu');
  }

  protected async runTool(): Promise<void> {
    const editor = this.editorService.editor();
    const tool = this.tool();
    if (!editor || !tool) return;

    let messages;
    let nextInsertRange: Range | null = null;
    let nextInsertAt: number | null = null;
    const r = this.range();

    if (tool === 'edit') {
      const value = this.instruction().trim();
      if (!r || !value) return;
      const text = editor.state.doc.textBetween(r.from, r.to, '\n');
      messages = editMessages(text, value);
      nextInsertRange = r;
    } else if (tool === 'generate') {
      const text = r
        ? editor.state.doc.textBetween(r.from, r.to, '\n')
        : editor.state.doc.textBetween(0, this.cursorPos(), '\n');
      messages = continuationMessages(text, this.genMin(), this.genMax());
      nextInsertAt = r ? r.to : this.cursorPos();
    } else {
      const useSelection = this.formatScope() === 'selection' && !!r;
      const scopeRange = useSelection ? r! : { from: 0, to: editor.state.doc.content.size };
      const text = editor.state.doc.textBetween(scopeRange.from, scopeRange.to, '\n');
      if (!text.trim()) {
        this.error.set(this.i18n.t('summary.noText'));
        return;
      }
      messages = formatMessages(text, {
        paragraphs: this.fmtParagraphs(),
        punctuation: this.fmtPunctuation(),
        structure: this.fmtStructure(),
      });
      nextInsertRange = scopeRange;
    }

    const controller = new AbortController();
    this.controller = controller;
    this.insertRange = nextInsertRange;
    this.insertAt = nextInsertAt;
    this.stage.set('generating');
    this.error.set(null);
    try {
      const result = await generate({ messages, config: this.ai.config(), signal: controller.signal });
      this.draft.set(result.trim());
      this.stage.set('review');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        this.error.set((err as Error).message || this.i18n.t('ai.status.error'));
        this.stage.set('options');
      }
    }
  }

  protected async runImageTool(): Promise<void> {
    const editor = this.editorService.editor();
    if (!editor) return;
    const prompt = this.imagePrompt().trim();
    if (!prompt) return;
    if (!supportsImageGeneration(this.ai.config().provider)) {
      this.error.set(this.i18n.t('contextMenu.aiImageUnsupported'));
      return;
    }

    const insertPos = this.range()?.to ?? this.cursorPos();
    const controller = new AbortController();
    this.controller = controller;
    this.stage.set('generating');
    this.error.set(null);
    try {
      const src = await generateImage(this.ai.config(), prompt, controller.signal);
      const sizeBefore = editor.state.doc.content.size;
      editor
        .chain()
        .focus()
        .setTextSelection(insertPos)
        .insertContent({ type: 'image', attrs: { src, alt: prompt } })
        .run();
      const sizeAfter = editor.state.doc.content.size;
      this.lastAiEdit.record(insertPos, insertPos + (sizeAfter - sizeBefore));
      this.close();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        this.error.set((err as Error).message || this.i18n.t('ai.status.error'));
        this.stage.set('options');
      }
    }
  }

  protected async runDescribeTool(): Promise<void> {
    const imageSrc = this.imageSrc();
    if (!imageSrc) return;
    const prompt = this.describePrompt().trim();
    if (!prompt) return;
    if (!supportsImageDescription(this.ai.config().provider)) {
      this.error.set(this.i18n.t('contextMenu.aiDescribeUnsupported'));
      return;
    }

    const controller = new AbortController();
    this.controller = controller;
    this.stage.set('generating');
    this.error.set(null);
    try {
      const result = await describeImage(this.ai.config(), imageSrc, prompt, controller.signal);
      this.draft.set(result.trim());
      this.copied.set(false);
      this.stage.set('review');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        this.error.set((err as Error).message || this.i18n.t('ai.status.error'));
        this.stage.set('options');
      }
    }
  }

  protected copyDescription(): void {
    void navigator.clipboard
      .writeText(this.draft())
      .then(() => {
        this.copied.set(true);
        window.setTimeout(() => this.copied.set(false), 1500);
      })
      .catch(() => {});
  }

  protected acceptDraft(): void {
    const editor = this.editorService.editor();
    const draft = this.draft();
    if (!editor || !draft.trim()) return;
    const sizeBefore = editor.state.doc.content.size;
    // "Give format" output relies on Markdown syntax (headings/lists), which tiptap-markdown
    // parses on insertContentAt; the other tools escape their draft to plain paragraphs so stray
    // AI-generated punctuation is never misread as Markdown.
    const content = this.tool() === 'format' ? draft : textToHtml(draft);
    if (this.insertRange) {
      editor.chain().focus().insertContentAt(this.insertRange, content).run();
    } else if (this.insertAt !== null) {
      editor.chain().focus().insertContentAt(this.insertAt, content).run();
    } else {
      return;
    }
    const sizeAfter = editor.state.doc.content.size;
    const from = this.insertRange ? this.insertRange.from : this.insertAt!;
    // Real bug found during this port, not present-but-untested in React's ContextMenu.tsx
    // (which computes `to` the same wrong way — it just had no test coverage to catch it): the
    // size delta (sizeAfter - sizeBefore) nets out both the deleted *and* inserted content when
    // `insertRange` replaces a non-empty selection, so `from + delta` goes negative-length
    // (`to < from`) whenever the AI's draft is shorter than what it replaced — which is the
    // common case for "Edit with AI"/"Give format" (condensing/correcting text). That inverted
    // range made `LastAiEditService.undo()`'s `deleteRange` either no-op or throw
    // "Position out of range" depending on how far negative it went. The inserted span's end must
    // be measured from the *original* range's `to`, not `from`, when a replacement happened;
    // `insertAt` (a plain insertion, tool === 'generate'/AI image) has no prior range to replace,
    // so delta alone is already correct there.
    const to = this.insertRange ? this.insertRange.to + (sizeAfter - sizeBefore) : from + (sizeAfter - sizeBefore);
    this.lastAiEdit.record(from, to);
    this.close();
  }

  protected abortGenerating(): void {
    this.controller?.abort();
  }

  protected stopPropagation(e: Event): void {
    e.preventDefault();
  }

  protected setGenMin(value: string): void {
    this.genMin.set(Number(value));
  }

  protected setGenMax(value: string): void {
    this.genMax.set(Number(value));
  }
}
