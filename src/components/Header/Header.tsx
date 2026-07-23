import { useState } from 'react'
import type { UseAiConnection } from '../../hooks/useAiConnection'
import type { UseDocuments } from '../../hooks/useDocuments'
import { useI18n } from '../../hooks/useI18n'
import type { FormatId, Theme } from '../../types'
import { FileMenu } from './FileMenu'

interface HeaderProps {
  filename: string
  onRename: (filename: string) => void
  onImport: (file: File) => void
  onExport: (formatId: FormatId) => void
  theme: Theme
  onToggleTheme: () => void
  ai: UseAiConnection
  aiPanelOpen: boolean
  onToggleAiPanel: () => void
  docs: UseDocuments
}

export function Header({
  filename,
  onRename,
  onImport,
  onExport,
  theme,
  onToggleTheme,
  ai,
  aiPanelOpen,
  onToggleAiPanel,
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
        <span className="app-brand">GoWrite</span>
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

      <div className="app-header-right">
        <FileMenu onImport={onImport} onExport={onExport} theme={theme} onToggleTheme={onToggleTheme} docs={docs} />
        <button
          type="button"
          className={`header-btn ai-btn${ai.isConnected ? ' is-connected' : ''}`}
          onClick={onToggleAiPanel}
          aria-expanded={aiPanelOpen}
        >
          {t('ai.buttonLabel')}
        </button>
      </div>
    </header>
  )
}
