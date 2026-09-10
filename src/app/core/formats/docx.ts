import type { FormatDefinition } from '../types';

export const docxFormat: FormatDefinition = {
  id: 'docx',
  label: 'Word (.docx)',
  extension: 'docx',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  accept: '.docx',
  async importFile(file, editor) {
    const { importDocx } = await import('./docx-impl');
    return importDocx(file, editor);
  },
  async exportContent(editor) {
    const { exportDocx } = await import('./docx-impl');
    return exportDocx(editor);
  },
};
