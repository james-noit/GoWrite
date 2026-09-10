import type { FormatDefinition } from '../types';

export const markdownFormat: FormatDefinition = {
  id: 'md',
  label: 'Markdown (.md)',
  extension: 'md',
  mimeType: 'text/markdown',
  accept: '.md,.markdown,text/markdown',
  async importFile(file, editor) {
    const text = await file.text();
    editor.commands.setContent(text);
  },
  async exportContent(editor) {
    // tiptap-markdown's storage entry isn't declared on Tiptap's own `Storage` interface (no
    // module augmentation ships for it), so TypeScript can't see it without a cast.
    const markdownStorage = editor.storage as unknown as {
      markdown: { getMarkdown: () => string };
    };
    return new Blob([markdownStorage.markdown.getMarkdown()], {
      type: 'text/markdown;charset=utf-8',
    });
  },
};
