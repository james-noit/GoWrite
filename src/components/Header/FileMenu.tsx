import { useEffect, useRef, useState } from 'react'
import type { UseDocuments } from '../../hooks/useDocuments'
import { useI18n } from '../../hooks/useI18n'
import type { Locale } from '../../lib/i18n/translations'
import { formatList, importAccept } from '../../lib/formats'
import type { FormatId, Theme } from '../../types'
import { MenuIcon } from '../icons'
import { ThemeToggle } from './ThemeToggle'

interface FileMenuProps {
  onImport: (file: File) => void
  onExport: (formatId: FormatId) => void
  theme: Theme
  onToggleTheme: () => void
  docs: UseDocuments
}

export function FileMenu({ onImport, onExport, theme, onToggleTheme, docs }: FileMenuProps) {
  const { t, locale, setLocale } = useI18n()
  const [open, setOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [docsOpen, setDocsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function formatUpdatedAt(ts: number): string {
    const diffMinutes = Math.round((Date.now() - ts) / 60000)
    if (diffMinutes < 1) return t('file.justNow')
    if (diffMinutes < 60) return `${t('file.minutesAgoPrefix')}${diffMinutes}${t('file.minutesAgoSuffix')}`
    const diffHours = Math.round(diffMinutes / 60)
    if (diffHours < 24) return `${t('file.hoursAgoPrefix')}${diffHours}${t('file.hoursAgoSuffix')}`
    return new Date(ts).toLocaleDateString(locale)
  }

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setExportOpen(false)
        setDocsOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div className="menu-root" ref={rootRef}>
      <button
        type="button"
        className="header-btn header-btn--brand"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('file.menuLabel')}
        title={t('file.menuLabel')}
      >
        <MenuIcon />
        <span className="app-brand">GoWrite</span>
      </button>

      {open && (
        <div className="dropdown glass-panel">
          <button
            type="button"
            className="dropdown-item"
            onClick={() => {
              docs.createNew()
              setOpen(false)
            }}
          >
            {t('file.newDocument')}
          </button>

          <div className="dropdown-submenu-root">
            <button
              type="button"
              className="dropdown-item"
              onClick={() => setDocsOpen((v) => !v)}
            >
              {t('file.documents')} ({docs.documents.length}) <span className="chevron">{docsOpen ? '▾' : '▸'}</span>
            </button>
            {docsOpen && (
              <div className="dropdown-submenu documents-submenu scroll-thin">
                {docs.documents.length === 0 && <p className="field-hint">{t('file.noDocuments')}</p>}
                {docs.documents.map((d) => (
                  <div
                    key={d.id}
                    className={`document-row${d.id === docs.currentId ? ' is-current' : ''}`}
                  >
                    <button
                      type="button"
                      className="document-row-open"
                      onClick={() => {
                        docs.openDocument(d.id)
                        setOpen(false)
                        setDocsOpen(false)
                      }}
                      title={d.filename}
                    >
                      <span className="document-row-name">{d.filename}</span>
                      <span className="document-row-date">{formatUpdatedAt(d.updatedAt)}</span>
                    </button>
                    {docs.documents.length > 1 && (
                      <button
                        type="button"
                        className="document-row-delete"
                        aria-label={`${t('file.deleteDocument')}: ${d.filename}`}
                        title={t('file.deleteDocument')}
                        onClick={() => {
                          if (window.confirm(`${t('file.deleteConfirmPrefix')}${d.filename}${t('file.deleteConfirmSuffix')}`)) {
                            docs.removeDocument(d.id)
                          }
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="dropdown-divider" />

          <button
            type="button"
            className="dropdown-item"
            onClick={() => fileInputRef.current?.click()}
          >
            {t('file.import')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={importAccept}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onImport(file)
              e.target.value = ''
              setOpen(false)
            }}
          />

          <div className="dropdown-submenu-root">
            <button
              type="button"
              className="dropdown-item"
              onClick={() => setExportOpen((v) => !v)}
            >
              {t('file.exportAs')} <span className="chevron">{exportOpen ? '▾' : '▸'}</span>
            </button>
            {exportOpen && (
              <div className="dropdown-submenu">
                {formatList.map((format) => (
                  <button
                    key={format.id}
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      onExport(format.id)
                      setOpen(false)
                      setExportOpen(false)
                    }}
                  >
                    {format.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="dropdown-divider" />

          <div className="dropdown-item dropdown-item--static">
            <span>{t('file.theme')}</span>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>

          <div className="dropdown-item dropdown-item--static">
            <span>{t('file.language')}</span>
            <div className="language-toggle">
              {(['es', 'en'] as Locale[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`language-btn${locale === l ? ' is-active' : ''}`}
                  onClick={() => setLocale(l)}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="dropdown-divider" />

          <button
            type="button"
            className="dropdown-item dropdown-item--danger"
            onClick={() => {
              const filename = docs.documents.find((d) => d.id === docs.currentId)?.filename ?? ''
              if (window.confirm(`${t('file.clearStorageConfirmPrefix')}${filename}${t('file.clearStorageConfirmSuffix')}`)) {
                docs.clearCurrentStorage()
              }
              setOpen(false)
            }}
          >
            {t('file.clearStorage')}
          </button>
        </div>
      )}
    </div>
  )
}
