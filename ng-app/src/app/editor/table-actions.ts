import type { Editor } from '@tiptap/core';
import type { IconName } from '../icons';
import type { TranslationKey } from '../core/i18n/translations';

export interface TableAction {
  key: string;
  titleKey: TranslationKey;
  icon: IconName;
  isActive?: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

/** Ported from src/components/Editor/tableActions.ts. */

/** Always available, regardless of whether the cursor is inside a table. */
export const insertTableAction: TableAction = {
  key: 'insertTable',
  titleKey: 'toolbar.insertTable',
  icon: 'insertTable',
  run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
};

/** Only meaningful (and only shown) while the cursor is inside a table. */
export const tableEditActions: TableAction[] = [
  {
    key: 'addColumn',
    titleKey: 'toolbar.addColumn',
    icon: 'addColumn',
    run: (e) => e.chain().focus().addColumnAfter().run(),
  },
  {
    key: 'addRow',
    titleKey: 'toolbar.addRow',
    icon: 'addRow',
    run: (e) => e.chain().focus().addRowAfter().run(),
  },
  {
    key: 'deleteColumn',
    titleKey: 'toolbar.deleteColumn',
    icon: 'deleteColumn',
    run: (e) => e.chain().focus().deleteColumn().run(),
  },
  {
    key: 'deleteRow',
    titleKey: 'toolbar.deleteRow',
    icon: 'deleteRow',
    run: (e) => e.chain().focus().deleteRow().run(),
  },
  {
    key: 'cellFormat',
    titleKey: 'toolbar.cellFormat',
    icon: 'cellFormat',
    isActive: (e) => e.isActive('tableHeader'),
    run: (e) => e.chain().focus().toggleHeaderCell().run(),
  },
];
