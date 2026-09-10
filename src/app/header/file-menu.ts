import {
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { EditorService } from '../editor/editor.service';
import { FormatService } from '../core/formats/format.service';
import { I18nService } from '../core/i18n/i18n.service';
import { ImportStatusService } from '../editor/import-status.service';
import { Icon } from '../icon';
import { DocumentsService } from '../documents/documents.service';
import type { FormatId } from '../core/types';
import type { SettingsTab } from '../settings/settings-modal';

/** Ported from src/components/Header/FileMenu.tsx. Import/export orchestration now lives here
 * (rather than being passed down as `onImport`/`onExport` props from an `App.tsx`-equivalent
 * shell) since `ImportStatusService`/`FormatService`/`DocumentsService`/`EditorService` are all
 * DI singletons this component can reach directly — see editor-host.ts's doc comment for the
 * same point about drag-drop import sharing the same services. */
@Component({
  selector: 'gowrite-file-menu',
  imports: [Icon],
  templateUrl: './file-menu.html',
  styleUrl: './file-menu.css',
})
export class FileMenu implements OnDestroy {
  protected readonly i18n = inject(I18nService);
  protected readonly docs = inject(DocumentsService);
  private readonly editorService = inject(EditorService);
  private readonly formats = inject(FormatService);
  private readonly importStatus = inject(ImportStatusService);

  readonly openSettings = output<SettingsTab>();

  protected readonly open = signal(false);
  protected readonly exportOpen = signal(false);
  protected readonly docsOpen = signal(false);
  protected readonly formatList = this.formats.formatList;
  protected readonly importAccept = this.formats.importAccept;

  private readonly root = viewChild.required<ElementRef<HTMLDivElement>>('root');
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  private readonly onClickOutside = (e: MouseEvent) => {
    if (!this.root().nativeElement.contains(e.target as Node)) {
      this.open.set(false);
      this.exportOpen.set(false);
      this.docsOpen.set(false);
    }
  };

  constructor() {
    effect((onCleanup) => {
      if (!this.open()) return;
      document.addEventListener('mousedown', this.onClickOutside);
      onCleanup(() => document.removeEventListener('mousedown', this.onClickOutside));
    });
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousedown', this.onClickOutside);
  }

  protected toggleOpen(): void {
    this.open.update((v) => !v);
  }

  protected newDocument(): void {
    this.docs.createNew();
    this.open.set(false);
  }

  protected toggleDocsOpen(): void {
    this.docsOpen.update((v) => !v);
  }

  protected toggleExportOpen(): void {
    this.exportOpen.update((v) => !v);
  }

  protected openDocument(id: string): void {
    this.docs.openDocument(id);
    this.open.set(false);
    this.docsOpen.set(false);
  }

  protected deleteDocument(id: string, filename: string): void {
    if (
      window.confirm(
        `${this.i18n.t('file.deleteConfirmPrefix')}${filename}${this.i18n.t('file.deleteConfirmSuffix')}`,
      )
    ) {
      this.docs.removeDocument(id);
    }
  }

  protected triggerImport(): void {
    this.fileInput().nativeElement.click();
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    this.open.set(false);
    if (!file) return;

    const editor = this.editorService.editor();
    if (!editor) return;
    void this.importStatus.run(async () => {
      await this.formats.importFile(file, editor);
      this.docs.importAsCurrent(file.name);
    });
  }

  protected exportAs(formatId: FormatId): void {
    const editor = this.editorService.editor();
    if (!editor) return;
    void this.formats.exportAs(
      this.formats.formatRegistry[formatId],
      editor,
      this.docs.currentFilename(),
    );
    this.open.set(false);
    this.exportOpen.set(false);
  }

  protected openSettingsTab(): void {
    this.openSettings.emit('general');
    this.open.set(false);
  }

  formatUpdatedAt(ts: number): string {
    const diffMinutes = Math.round((Date.now() - ts) / 60000);
    if (diffMinutes < 1) return this.i18n.t('file.justNow');
    if (diffMinutes < 60)
      return `${this.i18n.t('file.minutesAgoPrefix')}${diffMinutes}${this.i18n.t('file.minutesAgoSuffix')}`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24)
      return `${this.i18n.t('file.hoursAgoPrefix')}${diffHours}${this.i18n.t('file.hoursAgoSuffix')}`;
    return new Date(ts).toLocaleDateString(this.i18n.locale());
  }
}
