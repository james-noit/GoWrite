import { useState } from 'react'
import type { UseDocuments } from '../../hooks/useDocuments'
import { useI18n } from '../../hooks/useI18n'
import type { FormatId } from '../../types'
import { FileMenu } from './FileMenu'

interface HeaderProps {
  filename: string
  onRename: (filename: string) => void
  onImport: (file: File) => void
  onExport: (formatId: FormatId) => void
  onOpenSettings: () => void
  docs: UseDocuments
}

export function Header({
  filename,
  onRename,
  onImport,
  onExport,
  onOpenSettings,
  docs,
}: HeaderProps) {
  const { t } = useI18n()
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [draftTitle, setDraftTitle] = useState(filename)

  const startRename = () => {
    setDraftTitle(filename)
    setIsEditingTitle(true)
  }

  const commitRename = () => {
    const value = draftTitle.trim()
    if (value && value !== filename) onRename(value)
    setIsEditingTitle(false)
  }

  return (
    <header className="app-header glass-panel">
      <div className="app-header-left">
        <FileMenu onImport={onImport} onExport={onExport} onOpenSettings={onOpenSettings} docs={docs} />
        {isEditingTitle ? (
          <input
            className="app-filename-input"
            value={draftTitle}
            autoFocus
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setIsEditingTitle(false)
            }}
          />
        ) : (
          <button
            type="button"
            className="app-filename"
            title={t('app.renameTitle')}
            onClick={startRename}
          >
            {filename}
          </button>
        )}
      </div>

      <div className="app-header-center">
        <span className="bmc-support-label">{t('header.supportLabel')}</span>
        <a
          href="https://www.buymeacoffee.com/jamesnoitt"
          target="_blank"
          rel="noopener noreferrer"
          className="bmc-button"
        >
          <img
            src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=jamesnoitt&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff"
            alt="Buy me a coffee"
          />
        </a>
      </div>

      <div className="app-header-right">
        <span className="app-version" title={`GoWrite v${__APP_VERSION__}`}>
          v{__APP_VERSION__}
        </span>
      </div>
    </header>
  )
}
