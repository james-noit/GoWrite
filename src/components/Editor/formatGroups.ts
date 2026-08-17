import type { Editor } from '@tiptap/core'
import type { TranslationKey } from '../../lib/i18n/translations'

export type TFunction = (key: TranslationKey) => string

export interface ToolbarButton {
  label?: string
  labelKey?: TranslationKey
  titleKey: TranslationKey
  isActive?: (editor: Editor) => boolean
  isDisabled?: (editor: Editor) => boolean
  run: (editor: Editor, t: TFunction) => void
}

export interface ToolbarGroup {
  labelKey: TranslationKey
  buttons: ToolbarButton[]
}

/** Format button definitions shared by the toolbar and the right-click context menu, so both
 * surfaces run the exact same commands and stay in sync automatically. */
export const formatGroups: ToolbarGroup[] = [
  {
    labelKey: 'toolbar.group.font',
    buttons: [
      { label: 'B', titleKey: 'toolbar.bold', isActive: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
      { label: 'I', titleKey: 'toolbar.italic', isActive: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
      { label: 'U', titleKey: 'toolbar.underline', isActive: (e) => e.isActive('underline'), run: (e) => e.chain().focus().toggleUnderline().run() },
      { label: 'S', titleKey: 'toolbar.strike', isActive: (e) => e.isActive('strike'), run: (e) => e.chain().focus().toggleStrike().run() },
    ],
  },
  {
    labelKey: 'toolbar.group.style',
    buttons: [
      { label: 'H1', titleKey: 'toolbar.h1', isActive: (e) => e.isActive('heading', { level: 1 }), run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
      { label: 'H2', titleKey: 'toolbar.h2', isActive: (e) => e.isActive('heading', { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
      { label: 'H3', titleKey: 'toolbar.h3', isActive: (e) => e.isActive('heading', { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
    ],
  },
  {
    labelKey: 'toolbar.group.lists',
    buttons: [
      { label: '•', titleKey: 'toolbar.bulletList', isActive: (e) => e.isActive('bulletList'), run: (e) => e.chain().focus().toggleBulletList().run() },
      { label: '1.', titleKey: 'toolbar.orderedList', isActive: (e) => e.isActive('orderedList'), run: (e) => e.chain().focus().toggleOrderedList().run() },
    ],
  },
  {
    labelKey: 'toolbar.group.insert',
    buttons: [
      { label: '❝', titleKey: 'toolbar.blockquote', isActive: (e) => e.isActive('blockquote'), run: (e) => e.chain().focus().toggleBlockquote().run() },
      { label: '</>', titleKey: 'toolbar.codeBlock', isActive: (e) => e.isActive('codeBlock'), run: (e) => e.chain().focus().toggleCodeBlock().run() },
      {
        label: '🔗',
        titleKey: 'toolbar.link',
        isActive: (e) => e.isActive('link'),
        run: (e, t) => {
          if (e.isActive('link')) {
            e.chain().focus().unsetLink().run()
            return
          }
          const url = window.prompt(t('toolbar.linkPrompt'))
          if (url) e.chain().focus().setLink({ href: url }).run()
        },
      },
    ],
  },
  {
    labelKey: 'toolbar.group.align',
    buttons: [
      { label: '⟸', titleKey: 'toolbar.alignLeft', isActive: (e) => e.isActive({ textAlign: 'left' }), run: (e) => e.chain().focus().setTextAlign('left').run() },
      { label: '⟺', titleKey: 'toolbar.alignCenter', isActive: (e) => e.isActive({ textAlign: 'center' }), run: (e) => e.chain().focus().setTextAlign('center').run() },
      { label: '⟹', titleKey: 'toolbar.alignRight', isActive: (e) => e.isActive({ textAlign: 'right' }), run: (e) => e.chain().focus().setTextAlign('right').run() },
      { label: '☰', titleKey: 'toolbar.alignJustify', isActive: (e) => e.isActive({ textAlign: 'justify' }), run: (e) => e.chain().focus().setTextAlign('justify').run() },
    ],
  },
]
