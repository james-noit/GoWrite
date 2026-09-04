import { useEffect, useState } from 'react'
import type { UseAiConnection } from '../../hooks/useAiConnection'
import type { UseDocuments } from '../../hooks/useDocuments'
import { useI18n } from '../../hooks/useI18n'
import type { TranslationKey } from '../../lib/i18n/translations'
import type { FormatId } from '../../types'
import { AutocompleteIcon } from '../icons'
import { FileMenu } from './FileMenu'

interface AiStatusCardProps {
  ai: UseAiConnection
  autocompleteEnabled: boolean
  onOpen: () => void
}

function AiStatusCard({ ai, autocompleteEnabled, onOpen }: AiStatusCardProps) {
  const { t } = useI18n()
  const [showIntro, setShowIntro] = useState(false)
  const statusLabel = t(`ai.status.${ai.status}` as TranslationKey)
  const metaText = ai.isConnected ? ai.config.model || ai.meta.defaultModel : statusLabel

  // One-shot welcome effect (spin the border, sweep a reflection, pop) once the page has
  // fully finished loading — never replays afterwards, since this state only ever flips once.
  useEffect(() => {
    if (document.readyState === 'complete') {
      setShowIntro(true)
      return
    }
    const onLoad = () => setShowIntro(true)
    window.addEventListener('load', onLoad, { once: true })
    return () => window.removeEventListener('load', onLoad)
  }, [])

  return (
    <button
      type="button"
      className={`toolbar-ai-card toolbar-ai-card--${ai.status}${showIntro ? ' ai-intro' : ''}`}
      onClick={onOpen}
      aria-haspopup="dialog"
      title={`${t('ai.buttonLabel')} — ${statusLabel}`}
    >
      <span className="toolbar-ai-dot" aria-hidden="true" />
      <span className="toolbar-ai-text">
        <span className="toolbar-ai-label">{t('ai.buttonLabel')}</span>
        <span className="toolbar-ai-meta">{metaText}</span>
      </span>
      {autocompleteEnabled && (
        <span className="toolbar-ai-auto" title={t('ai.autocomplete')} aria-label={t('ai.autocomplete')}>
          <AutocompleteIcon />
        </span>
      )}
    </button>
  )
}

interface HeaderProps {
  filename: string
  onRename: (filename: string) => void
  onImport: (file: File) => void
  onExport: (formatId: FormatId) => void
  onOpenSettings: () => void
  onOpenAiSettings: () => void
  ai: UseAiConnection
  autocompleteEnabled: boolean
  docs: UseDocuments
}

export function Header({
  filename,
  onRename,
  onImport,
  onExport,
  onOpenSettings,
  onOpenAiSettings,
  ai,
  autocompleteEnabled,
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
        <AiStatusCard ai={ai} autocompleteEnabled={autocompleteEnabled} onOpen={onOpenAiSettings} />
        <span className="app-version" title={`GoWrite v${__APP_VERSION__}`}>
          v{__APP_VERSION__}
        </span>
      </div>
    </header>
  )
}
