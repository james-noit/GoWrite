import { useEffect, useRef, useState } from 'react'
import type { UseAiConnection } from '../../hooks/useAiConnection'
import type { UseAiTools } from '../../hooks/useAiTools'
import type { UseDocuments } from '../../hooks/useDocuments'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useI18n } from '../../hooks/useI18n'
import type { Locale } from '../../lib/i18n/translations'
import { providerList } from '../../lib/ai/providers'
import type { Theme } from '../../types'
import { AutocompleteIcon, AutoGenerateIcon, SummarizeIcon } from '../icons'
import { ThemeToggle } from '../Header/ThemeToggle'

export type SettingsTab = 'general' | 'ai'

interface SettingsModalProps {
  open: boolean
  initialTab: SettingsTab
  onClose: () => void
  theme: Theme
  onToggleTheme: () => void
  docs: UseDocuments
  ai: UseAiConnection
  tools: UseAiTools
}

type ToolKey = 'summarize' | 'autocomplete' | 'continueTool'

export function SettingsModal({ open, initialTab, onClose, theme, onToggleTheme, docs, ai, tools }: SettingsModalProps) {
  const { t, locale, setLocale } = useI18n()
  const [tab, setTab] = useState<SettingsTab>(initialTab)
  const [configOpen, setConfigOpen] = useState(!ai.isConnected)
  const [expandedTool, setExpandedTool] = useState<ToolKey | null>(null)
  const [autoFlash, setAutoFlash] = useState<'on' | 'off' | null>(null)
  const flashTimer = useRef<number | undefined>(undefined)
  const modalRef = useRef<HTMLDivElement>(null)

  const statusLabel: Record<typeof ai.status, string> = {
    idle: t('ai.status.idle'),
    connecting: t('ai.status.connecting'),
    connected: t('ai.status.connected'),
    error: t('ai.status.error'),
  }

  useFocusTrap(modalRef, open)

  // Re-sync to whichever tab the caller asked for each time the modal opens.
  useEffect(() => {
    if (open) setTab(initialTab)
  }, [open, initialTab])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // Auto-collapse provider config on successful connection; reopen it when it drops.
  const prevStatus = useRef(ai.status)
  useEffect(() => {
    if (prevStatus.current === ai.status) return
    prevStatus.current = ai.status
    if (ai.status === 'connected') setConfigOpen(false)
    if (ai.status === 'error') setConfigOpen(true)
  }, [ai.status])

  if (!open) return null

  const { config: toolsConfig, updateTool } = tools
  const auto = toolsConfig.autocomplete
  const cont = toolsConfig.continueTool

  const toggleAutocomplete = () => {
    const next = !auto.enabled
    updateTool('autocomplete', { enabled: next })
    setAutoFlash(next ? 'on' : 'off')
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setAutoFlash(null), 2000)
  }

  const clearStorage = () => {
    const filename = docs.documents.find((d) => d.id === docs.currentId)?.filename ?? ''
    if (window.confirm(`${t('file.clearStorageConfirmPrefix')}${filename}${t('file.clearStorageConfirmSuffix')}`)) {
      docs.clearCurrentStorage()
    }
  }

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div
        className="settings-modal glass-panel"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className="ai-panel-header">
          <h2 id="settings-modal-title">{t('settings.title')}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>

        <div className="settings-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'general'}
            className={`settings-tab${tab === 'general' ? ' is-active' : ''}`}
            onClick={() => setTab('general')}
          >
            {t('settings.tabGeneral')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'ai'}
            className={`settings-tab${tab === 'ai' ? ' is-active' : ''}`}
            onClick={() => setTab('ai')}
          >
            <span className={`status-dot status-dot--${ai.status}`} aria-hidden="true" />
            {t('settings.tabAiTools')}
          </button>
        </div>

        <div className="settings-body scroll-thin">
          {tab === 'general' && (
            <>
              <section className="ai-panel-section">
                <h3 className="ai-panel-subtitle">{t('settings.appearance')}</h3>
                <div className="settings-row">
                  <span>{t('file.theme')}</span>
                  <ThemeToggle theme={theme} onToggle={onToggleTheme} />
                </div>
                <div className="settings-row">
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
              </section>

              <section className="ai-panel-section">
                <h3 className="ai-panel-subtitle">{t('settings.data')}</h3>
                <div className="action-row">
                  <button type="button" className="connect-btn connect-btn--danger" onClick={clearStorage}>
                    {t('file.clearStorage')}
                  </button>
                </div>
              </section>
            </>
          )}

          {tab === 'ai' && (
            <>
              <section className="ai-accordion">
                <button
                  type="button"
                  className="ai-accordion-header"
                  onClick={() => setConfigOpen((v) => !v)}
                  aria-expanded={configOpen}
                >
                  <span className={`status-dot status-dot--${ai.status}`} aria-hidden="true" />
                  <span className="ai-accordion-title">{t('ai.configureProvider')}</span>
                  <span className={`conn-label conn-label--${ai.status}`}>{statusLabel[ai.status]}</span>
                  <span className="chevron">{configOpen ? '▾' : '▸'}</span>
                </button>

                {configOpen && (
                  <div className="ai-accordion-body">
                    <label className="field-label" htmlFor="ai-provider">{t('ai.provider')}</label>
                    <select
                      id="ai-provider"
                      className="field-input"
                      value={ai.config.provider}
                      onChange={(e) => ai.setProvider(e.target.value as typeof ai.config.provider)}
                    >
                      {providerList.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>

                    {ai.meta.endpointEditable && (
                      <>
                        <label className="field-label" htmlFor="ai-endpoint">{t('ai.server')}</label>
                        <input
                          id="ai-endpoint"
                          className="field-input"
                          type="text"
                          placeholder={ai.meta.defaultEndpoint}
                          value={ai.config.customEndpoint}
                          onChange={(e) => ai.updateField('customEndpoint', e.target.value)}
                        />
                        {ai.meta.helpText && <p className="field-hint">{ai.meta.helpText}</p>}
                      </>
                    )}

                    <label className="field-label" htmlFor="ai-key">{ai.meta.apiKeyLabel}</label>
                    <input
                      id="ai-key"
                      className="field-input"
                      type="password"
                      autoComplete="off"
                      value={ai.config.apiKey}
                      onChange={(e) => ai.updateField('apiKey', e.target.value)}
                    />
                    <p className="field-hint">{t('ai.apiKeyStorageHint')}</p>

                    <label className="field-label" htmlFor="ai-model">{t('ai.model')}</label>
                    {ai.models.length > 0 ? (
                      <select
                        id="ai-model"
                        className="field-input"
                        value={ai.config.model || ai.models[0]}
                        onChange={(e) => ai.updateField('model', e.target.value)}
                      >
                        {ai.models.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id="ai-model"
                        className="field-input"
                        type="text"
                        placeholder={ai.meta.defaultModel}
                        value={ai.config.model}
                        onChange={(e) => ai.updateField('model', e.target.value)}
                      />
                    )}
                    {ai.models.length === 0 && ai.isConnected && <p className="field-hint">{t('ai.modelFallbackHint')}</p>}

                    {ai.error && <p className="field-error" role="alert">{ai.error}</p>}

                    <button
                      type="button"
                      className={`connect-btn connect-btn--${ai.status}`}
                      onClick={ai.connect}
                      disabled={ai.status === 'connecting'}
                    >
                      {ai.status === 'connecting' && t('ai.connecting')}
                      {ai.status === 'connected' && t('ai.connected')}
                      {ai.status === 'error' && t('ai.retry')}
                      {ai.status === 'idle' && t('ai.connect')}
                    </button>
                  </div>
                )}
              </section>

              <section className="ai-panel-section">
                <h3 className="ai-panel-subtitle">{t('ai.tools')}</h3>
                {!ai.isConnected && <p className="field-hint">{t('ai.toolsDisconnectedHint')}</p>}

                <ul className="tool-list">
                  <li className="tool-card">
                    <button
                      type="button"
                      className={`tool-toggle${toolsConfig.summarize.enabled ? ' is-on' : ''}`}
                      onClick={() => setExpandedTool((v) => (v === 'summarize' ? null : 'summarize'))}
                      aria-expanded={expandedTool === 'summarize'}
                    >
                      <span className="tool-toggle-label">
                        <SummarizeIcon />
                        {t('ai.summarize')}
                      </span>
                      <span className="tool-toggle-right">
                        <span className="tool-check" aria-hidden="true">{toolsConfig.summarize.enabled ? '✓' : ''}</span>
                        <span className="chevron" aria-hidden="true">{expandedTool === 'summarize' ? '▾' : '▸'}</span>
                      </span>
                    </button>
                    {expandedTool === 'summarize' && (
                      <div className="tool-body">
                        <div className="tool-enable-row">
                          <span className="tool-enable-label">{t('settings.summarizeEnable')}</span>
                          <button
                            type="button"
                            className={`switch-track${toolsConfig.summarize.enabled ? ' is-on' : ''}`}
                            role="switch"
                            aria-checked={toolsConfig.summarize.enabled}
                            onClick={() => updateTool('summarize', { enabled: !toolsConfig.summarize.enabled })}
                          >
                            <span className="switch-thumb" />
                          </button>
                        </div>
                        <p className="field-hint">{t('settings.summarizeEnableHint')}</p>
                      </div>
                    )}
                  </li>

                  <li className="tool-card">
                    <button
                      type="button"
                      className={`tool-toggle${auto.enabled ? ' is-on' : ''}`}
                      onClick={() => setExpandedTool((v) => (v === 'autocomplete' ? null : 'autocomplete'))}
                      aria-expanded={expandedTool === 'autocomplete'}
                    >
                      <span className="tool-toggle-label">
                        <AutocompleteIcon />
                        {t('ai.autocomplete')}
                      </span>
                      <span className="tool-toggle-right">
                        <span className="tool-check" aria-hidden="true">{auto.enabled ? '✓' : ''}</span>
                        <span className="chevron" aria-hidden="true">{expandedTool === 'autocomplete' ? '▾' : '▸'}</span>
                      </span>
                    </button>
                    {expandedTool === 'autocomplete' && (
                      <div className="tool-body">
                        <div className="tool-enable-row">
                          <span className="tool-enable-label">{t('ai.autocompleteEnable')}</span>
                          <button
                            type="button"
                            className={`switch-track${auto.enabled ? ' is-on' : ''}`}
                            role="switch"
                            aria-checked={auto.enabled}
                            onClick={toggleAutocomplete}
                          >
                            <span className="switch-thumb" />
                          </button>
                        </div>
                        {autoFlash && (
                          <span className={`tool-flash tool-flash--${autoFlash}`}>
                            {autoFlash === 'on' ? t('ai.autocompleteOn') : t('ai.autocompleteOff')}
                          </span>
                        )}
                        <label className="field-label" htmlFor="auto-wait">{t('ai.waitSeconds')}</label>
                        <input
                          id="auto-wait"
                          className="field-input"
                          type="number"
                          min={1}
                          max={30}
                          value={auto.waitSeconds}
                          onChange={(e) => updateTool('autocomplete', { waitSeconds: Number(e.target.value) })}
                        />
                        <div className="tool-grid">
                          <div>
                            <label className="field-label" htmlFor="auto-min">{t('ai.minWords')}</label>
                            <input
                              id="auto-min"
                              className="field-input"
                              type="number"
                              min={1}
                              value={auto.minWords}
                              onChange={(e) => updateTool('autocomplete', { minWords: Number(e.target.value) })}
                            />
                          </div>
                          <div>
                            <label className="field-label" htmlFor="auto-max">{t('ai.maxWords')}</label>
                            <input
                              id="auto-max"
                              className="field-input"
                              type="number"
                              min={1}
                              value={auto.maxWords}
                              onChange={(e) => updateTool('autocomplete', { maxWords: Number(e.target.value) })}
                            />
                          </div>
                        </div>
                        <p className="field-hint">{t('ai.autocompleteHint')}</p>
                      </div>
                    )}
                  </li>

                  <li className="tool-card">
                    <button
                      type="button"
                      className={`tool-toggle${cont.enabled ? ' is-on' : ''}`}
                      onClick={() => setExpandedTool((v) => (v === 'continueTool' ? null : 'continueTool'))}
                      aria-expanded={expandedTool === 'continueTool'}
                    >
                      <span className="tool-toggle-label">
                        <AutoGenerateIcon />
                        {t('ai.autoGenerate')}
                      </span>
                      <span className="tool-toggle-right">
                        <span className="tool-check" aria-hidden="true">{cont.enabled ? '✓' : ''}</span>
                        <span className="chevron" aria-hidden="true">{expandedTool === 'continueTool' ? '▾' : '▸'}</span>
                      </span>
                    </button>
                    {expandedTool === 'continueTool' && (
                      <div className="tool-body">
                        <div className="tool-enable-row">
                          <span className="tool-enable-label">{t('settings.autoGenerateEnable')}</span>
                          <button
                            type="button"
                            className={`switch-track${cont.enabled ? ' is-on' : ''}`}
                            role="switch"
                            aria-checked={cont.enabled}
                            onClick={() => updateTool('continueTool', { enabled: !cont.enabled })}
                          >
                            <span className="switch-thumb" />
                          </button>
                        </div>
                        <p className="field-hint">{t('settings.autoGenerateEnableHint')}</p>
                        <div className="tool-grid">
                          <div>
                            <label className="field-label" htmlFor="cont-min">{t('ai.minWords')}</label>
                            <input
                              id="cont-min"
                              className="field-input"
                              type="number"
                              min={1}
                              value={cont.minWords}
                              onChange={(e) => updateTool('continueTool', { minWords: Number(e.target.value) })}
                            />
                          </div>
                          <div>
                            <label className="field-label" htmlFor="cont-max">{t('ai.maxWords')}</label>
                            <input
                              id="cont-max"
                              className="field-input"
                              type="number"
                              min={1}
                              value={cont.maxWords}
                              onChange={(e) => updateTool('continueTool', { maxWords: Number(e.target.value) })}
                            />
                          </div>
                        </div>
                        <p className="field-hint">{t('ai.autoGenerateFutureHint')}</p>
                      </div>
                    )}
                  </li>
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
