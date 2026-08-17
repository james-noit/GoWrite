import type { Editor } from '@tiptap/core'
import type { TranslationKey } from '../../lib/i18n/translations'
import { AddColumnIcon, AddRowIcon, CellFormatIcon, DeleteColumnIcon, DeleteRowIcon, InsertTableIcon } from '../icons'

export interface TableAction {
  key: string
  titleKey: TranslationKey
  icon: () => React.JSX.Element
  isActive?: (editor: Editor) => boolean
  run: (editor: Editor) => void
}

/** Always available, regardless of whether the cursor is inside a table. */
export const insertTableAction: TableAction = {
  key: 'insertTable',
  titleKey: 'toolbar.insertTable',
  icon: InsertTableIcon,
  run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
}

/** Only meaningful (and only shown) while the cursor is inside a table. */
export const tableEditActions: TableAction[] = [
  { key: 'addColumn', titleKey: 'toolbar.addColumn', icon: AddColumnIcon, run: (e) => e.chain().focus().addColumnAfter().run() },
  { key: 'addRow', titleKey: 'toolbar.addRow', icon: AddRowIcon, run: (e) => e.chain().focus().addRowAfter().run() },
  { key: 'deleteColumn', titleKey: 'toolbar.deleteColumn', icon: DeleteColumnIcon, run: (e) => e.chain().focus().deleteColumn().run() },
  { key: 'deleteRow', titleKey: 'toolbar.deleteRow', icon: DeleteRowIcon, run: (e) => e.chain().focus().deleteRow().run() },
  {
    key: 'cellFormat',
    titleKey: 'toolbar.cellFormat',
    icon: CellFormatIcon,
    isActive: (e) => e.isActive('tableHeader'),
    run: (e) => e.chain().focus().toggleHeaderCell().run(),
  },
]
