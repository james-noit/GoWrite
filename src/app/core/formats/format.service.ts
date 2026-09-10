import { Injectable } from '@angular/core';
import type { Editor } from '@tiptap/core';
import type { FormatDefinition } from '../types';
import {
  exportAs,
  formatForFilename,
  formatList,
  formatRegistry,
  importAccept,
  importFile,
} from './index';

/**
 * Thin injectable wrapper around core/formats/index.ts's plain functions — ported from
 * src/lib/formats/index.ts. Kept as free functions underneath (imported straight into
 * FormatService) rather than converting the whole registry into class methods, since the
 * registry itself (which format handles which extension) has no Angular-specific state; the
 * service exists so components consume it via DI like everything else, not because the logic
 * needs an injector.
 */
@Injectable({ providedIn: 'root' })
export class FormatService {
  readonly formatRegistry = formatRegistry;
  readonly formatList = formatList;
  readonly importAccept = importAccept;

  formatForFilename(filename: string): FormatDefinition | null {
    return formatForFilename(filename);
  }

  importFile(file: File, editor: Editor): Promise<FormatDefinition> {
    return importFile(file, editor);
  }

  exportAs(format: FormatDefinition, editor: Editor, filename: string): Promise<void> {
    return exportAs(format, editor, filename);
  }
}
