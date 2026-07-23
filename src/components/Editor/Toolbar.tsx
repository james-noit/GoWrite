import type { Editor } from '@tiptap/core'
import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../hooks/useI18n'
import type { TranslationKey } from '../../lib/i18n/translations'

type TFunction = (key: TranslationKey) => string

interface ToolbarButton {
  label: string
  titleKey: TranslationKey
  isActive?: (editor: Editor) => boolean
  run: (editor: Editor, t: TFunction) => void
}

const buttons: ToolbarButton[] = [
  { label: 'B', titleKey: 'toolbar.bold', isActive: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
  { label: 'I', titleKey: 'toolbar.italic', isActive: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
  { label: 'U', titleKey: 'toolbar.underline', isActive: (e) => e.isActive('underline'), run: (e) => e.chain().focus().toggleUnderline().run() },
  { label: 'S', titleKey: 'toolbar.strike', isActive: (e) => e.isActive('strike'), run: (e) => e.chain().focus().toggleStrike().run() },
  { label: 'H1', titleKey: 'toolbar.h1', isActive: (e) => e.isActive('heading', { level: 1 }), run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'H2', titleKey: 'toolbar.h2', isActive: (e) => e.isActive('heading', { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'H3', titleKey: 'toolbar.h3', isActive: (e) => e.isActive('heading', { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: '•', titleKey: 'toolbar.bulletList', isActive: (e) => e.isActive('bulletList'), run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: '1.', titleKey: 'toolbar.orderedList', isActive: (e) => e.isActive('orderedList'), run: (e) => e.chain().focus().toggleOrderedList().run() },
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
]

function ButtonRow({ editor }: { editor: Editor }) {
  const { t } = useI18n()
  return (
    <div className="toolbar-buttons scroll-thin">
      {buttons.map((btn) => (
        <button
          key={btn.titleKey}
          type="button"
          title={t(btn.titleKey)}
          className={`toolbar-btn${btn.isActive?.(editor) ? ' is-active' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => btn.run(editor, t)}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}

export function Toolbar({ editor }: { editor: Editor | null }) {
  const { t } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // On mobile, the accordion collapses when focus/clicks leave the toolbar — unless pinned.
  useEffect(() => {
    if (!menuOpen || pinned) return
    const onFocusChange = (e: Event) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onFocusChange)
    document.addEventListener('focusin', onFocusChange)
    return () => {
      document.removeEventListener('mousedown', onFocusChange)
      document.removeEventListener('focusin', onFocusChange)
    }
  }, [menuOpen, pinned])

  if (!editor) return null

  return (
    <div className="format-bar glass-panel" ref={rootRef}>
      <div className="format-bar-inline">
        <ButtonRow editor={editor} />
      </div>

      <button
        type="button"
        className="format-tab"
        onClick={() => setMenuOpen((v) => !v)}
        aria-expanded={menuOpen}
        aria-label={t('toolbar.showFormatBar')}
      >
        {t('toolbar.format')} {menuOpen ? '▴' : '▾'}
      </button>

      <div className={`toolbar-accordion${menuOpen ? ' is-open' : ''}`}>
        <div className="toolbar-accordion-inner">
          <ButtonRow editor={editor} />
          <button
            type="button"
            className={`toolbar-pin${pinned ? ' is-pinned' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPinned((v) => !v)}
            aria-pressed={pinned}
            title={pinned ? t('toolbar.pinOn') : t('toolbar.pinOff')}
          >
            📌
          </button>
        </div>
      </div>
    </div>
  )
}
