import {
  Component,
  ElementRef,
  OnDestroy,
  ViewEncapsulation,
  afterNextRender,
  computed,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { AiConnectionService } from '../core/ai/ai-connection.service';
import { AiToolsService } from '../core/ai/ai-tools.service';
import { FormatService } from '../core/formats/format.service';
import { I18nService } from '../core/i18n/i18n.service';
import { DocLoader } from '../doc-loader/doc-loader';
import { DocumentsService } from '../documents/documents.service';
import { AutocompleteService } from './autocomplete.service';
import { ContextMenu, type SummaryRequest } from './context-menu';
import { DragAndDropDirective } from './drag-and-drop.directive';
import { EditorService } from './editor.service';
import { ImportStatusService } from './import-status.service';
import { LastAiEditService } from './last-ai-edit.service';
import { countOf } from './word-count';

/**
 * Editor shell — mounts the Tiptap editor, shows a word/char count, a drag-to-import drop zone,
 * and a loading overlay while a document is loading/importing. The format Toolbar is a sibling in
 * app.html, not a child here — it needs to render between the header and this component, not
 * inside the editor card (see the `gowrite-toolbar` rule in theme.css). Ported
 * from src/components/Editor/Editor.tsx + the import wiring from src/App.tsx (export and the
 * "Import…" trigger itself now live in Header/FileMenu, Phase 6's other half — this component
 * only handles *receiving* an imported file, whether via drag-drop here or a click over in
 * FileMenu, both going through the same `ImportStatusService`/`DocumentsService`).
 *
 * `ViewEncapsulation.None`: nearly everything this component's stylesheet targets (`.ProseMirror`,
 * the code-block/image node views) is DOM that Tiptap injects itself, not markup from this
 * component's own template — Angular's emulated encapsulation attribute never lands on it, so
 * scoped styles wouldn't apply to it anyway.
 */
@Component({
  selector: 'gowrite-editor-host',
  imports: [DocLoader, DragAndDropDirective, ContextMenu],
  templateUrl: './editor-host.html',
  styleUrl: './editor-host.css',
  encapsulation: ViewEncapsulation.None,
  providers: [AutocompleteService, LastAiEditService],
})
export class EditorHost implements OnDestroy {
  private readonly editorService = inject(EditorService);
  private readonly i18n = inject(I18nService);
  private readonly formats = inject(FormatService);
  private readonly ai = inject(AiConnectionService);
  private readonly tools = inject(AiToolsService);
  private readonly autocomplete = inject(AutocompleteService);
  protected readonly lastAiEdit = inject(LastAiEditService);
  protected readonly importStatus = inject(ImportStatusService);
  protected readonly docs = inject(DocumentsService);
  private readonly root = viewChild.required<ElementRef<HTMLDivElement>>('editorRoot');

  /** Bubbles ContextMenu's summarize-menu-item clicks up to App, which owns SummaryModal's open
   * state (the two are Angular siblings, same reasoning as ImportStatusService in Phase 6). */
  readonly openSummary = output<SummaryRequest>();

  readonly wordCount = computed(() => {
    const editor = this.editorService.editor();
    this.editorService.revision();
    return editor ? countOf(editor) : { words: 0, chars: 0 };
  });

  private detachAutocomplete: (() => void) | null = null;
  private detachLastAiEdit: (() => void) | null = null;

  constructor() {
    afterNextRender(() => {
      const editor = this.editorService.mount(this.root().nativeElement, {
        placeholder: this.i18n.t('editor.placeholder'),
      });
      this.detachAutocomplete = this.autocomplete.attach(
        editor,
        this.ai,
        () => this.tools.config().autocomplete,
        (from, to) => this.lastAiEdit.record(from, to),
      );
      this.detachLastAiEdit = this.lastAiEdit.attach(editor);
    });
  }

  ngOnDestroy(): void {
    this.detachAutocomplete?.();
    this.detachLastAiEdit?.();
    this.editorService.destroy();
  }

  undoLastAiEdit(): void {
    this.lastAiEdit.undo();
  }

  wordsLabel(): string {
    const { words } = this.wordCount();
    return this.i18n.t(words === 1 ? 'editor.word' : 'editor.words');
  }

  charsLabel(): string {
    const { chars } = this.wordCount();
    return this.i18n.t(chars === 1 ? 'editor.char' : 'editor.chars');
  }

  onFileDropped(file: File): void {
    const editor = this.editorService.editor();
    if (!editor) return;
    void this.importStatus.run(async () => {
      await this.formats.importFile(file, editor);
      this.docs.importAsCurrent(file.name);
    });
  }
}
