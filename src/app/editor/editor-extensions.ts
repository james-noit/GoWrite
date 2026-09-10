import type { AnyExtension } from '@tiptap/core';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { CodeBlockWithLanguageInput } from './code-block';
import { FontSize } from './font-size';
import { FootnoteExtensions } from './footnote';
import { GhostSuggestion } from './ghost-suggestion';
import { Image, type ImageNodeViewDeps } from './image';

/**
 * The app's full Tiptap extension set — ported from src/components/Editor/useGoWriteEditor.ts.
 * Pulled out of EditorService so headless format-testing editors (see
 * core/formats/testing/create-test-editor.ts) can build the *exact same* extension list instead
 * of maintaining a second copy that silently drifts out of sync — that drift is precisely how the
 * original React app's format round-trip tests under-tested tables/images/font-styling for a long
 * time (see docs/angular-migration-plan.md, Phase 1 §3 Track A).
 */
export function buildEditorExtensions(options: { placeholder: string; imageDeps: ImageNodeViewDeps }): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true },
      codeBlock: false,
    }),
    CodeBlockWithLanguageInput,
    Placeholder.configure({ placeholder: options.placeholder }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    Highlight.configure({ multicolor: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Markdown.configure({ html: true, transformPastedText: false }),
    Image.configure({ deps: options.imageDeps }),
    GhostSuggestion,
    ...FootnoteExtensions,
  ];
}
