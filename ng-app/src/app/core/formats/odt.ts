import type { FormatDefinition } from '../types';

export const odtFormat: FormatDefinition = {
  id: 'odt',
  label: 'OpenDocument (.odt)',
  extension: 'odt',
  mimeType: 'application/vnd.oasis.opendocument.text',
  accept: '.odt',
  async importFile(file, editor) {
    const { importOdt } = await import('./odt-impl');
    return importOdt(file, editor);
  },
  async exportContent(editor) {
    const { exportOdt } = await import('./odt-impl');
    return exportOdt(editor);
  },
};
