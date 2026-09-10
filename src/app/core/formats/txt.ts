import { textToHtml } from '../text';
import type { FormatDefinition } from '../types';

export const txtFormat: FormatDefinition = {
  id: 'txt',
  label: 'Texto plano (.txt)',
  extension: 'txt',
  mimeType: 'text/plain',
  accept: '.txt,text/plain',
  async importFile(file, editor) {
    const text = await file.text();
    editor.commands.setContent(textToHtml(text));
  },
  async exportContent(editor) {
    const text = editor.getText({ blockSeparator: '\n\n' });
    return new Blob([text], { type: 'text/plain;charset=utf-8' });
  },
};
