import type { Editor } from '@tiptap/core'
import { useEffect, useRef, useState } from 'react'
import type { UseAiConnection } from '../../hooks/useAiConnection'
import type { UseAiTools } from '../../hooks/useAiTools'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useI18n } from '../../hooks/useI18n'
import { continuationMessages, editMessages, generate, scopeText } from '../../lib/ai/actions'
import { providerList } from '../../lib/ai/providers'
import { textToHtml } from '../../lib/text'
import type { ConnectionStatus } from '../../types'
import { FunnyLoader } from '../FunnyLoader'

interface AiPanelProps {
  open: boolean
  onClose: () => void
  editor: Editor | null
  ai: UseAiConnection
  tools: UseAiTools
  onOpenSummary: () => void
  onAiInsertion: (from: number, to: number) => void
}

type GenPhase = 'idle' | 'generating' | 'review' | 'editing'

export function AiPanel({ open, onClose, editor, ai, tools, onOpenSummary, onAiInsertion }: AiPanelProps) {
  const { t } = useI18n()
  const [configOpen, setConfigOpen] = useState(!ai.isConnected)
  const [autoFlash, setAutoFlash] = useState<'on' | 'off' | null>(null)
  const [genPhase, setGenPhase] = useState<GenPhase>('idle')
  const [draft, setDraft] = useState('')
  const [draftInsertPos, setDraftInsertPos] = useState(0)
  const [draftHadSelection, setDraftHadSelection] = useState(false)
  const [showEditPrompt, setShowEditPrompt] = useState(false)
  const [editInstruction, setEditInstruction] = useState('')
  const [genError, setGenError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const flashTimer = useRef<number | undefined>(undefined)
  const panelRef = useRef<HTMLDivElement>(null)

  const statusLabel: Record<ConnectionStatus, string> = {
    idle: t('ai.status.idle'),
    connecting: t('ai.status.connecting'),
    connected: t('ai.status.connected'),
    error: t('ai.status.error'),
  }

  useFocusTrap(panelRef, open)

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

  const runGenerate = async () => {
    if (!editor || !ai.isConnected) return
    const scope = scopeText(editor)
    if (!scope.text.trim()) {
      setGenError(t('ai.noTextToContinue'))
      return
    }
    const controller = new AbortController()
    controllerRef.current = controller
    ai.abortRef.current = controller
    setGenPhase('generating')
    setGenError(null)
    setDraft('')
    setDraftInsertPos(scope.insertPos)
    setDraftHadSelection(scope.hasSelection)
    setShowEditPrompt(false)
    try {
      const result = await generate({
        messages: continuationMessages(scope.text, cont.minWords, cont.maxWords),
        config: ai.config,
        signal: controller.signal,
      })
      setDraft(result.trim())
      setGenPhase('review')
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setGenError((err as Error).message || t('ai.status.error'))
      }
      setGenPhase('idle')
    }
  }

  const runEditWithAi = async () => {
    const instruction = editInstruction.trim()
    if (!instruction || !draft || !ai.isConnected) return
    const controller = new AbortController()
    controllerRef.current = controller
    ai.abortRef.current = controller
    setGenPhase('editing')
    setGenError(null)
    try {
      const result = await generate({
        messages: editMessages(draft, instruction),
        config: ai.config,
        signal: controller.signal,
      })
      setDraft(result.trim())
      setEditInstruction('')
      setShowEditPrompt(false)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setGenError((err as Error).message || t('ai.status.error'))
      }
    } finally {
      setGenPhase('review')
    }
  }

  const acceptDraft = () => {
    if (!editor || !draft.trim()) return
    const pos = Math.min(draftInsertPos, editor.state.doc.content.size)
    const sizeBefore = editor.state.doc.content.size
    editor.chain().focus().insertContentAt(pos, textToHtml(draft)).run()
    const sizeAfter = editor.state.doc.content.size
    onAiInsertion(pos, pos + (sizeAfter - sizeBefore))
    setDraft('')
    setGenPhase('idle')
    setShowEditPrompt(false)
  }

  const discardDraft = () => {
    setDraft('')
    setGenPhase('idle')
    setShowEditPrompt(false)
    setEditInstruction('')
  }

  return (
    <div className="ai-panel-backdrop" onClick={onClose}>
      <div
        className="ai-panel glass-panel"
        onClick={(e) => e.stopPropagation()}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-panel-title"
      >
        <div className="ai-panel-header">
          <h2 id="ai-panel-title">{t('ai.title')}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>

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

          <div className="tool-card">
            <button
              type="button"
              className={`tool-toggle${toolsConfig.summarize.enabled ? ' is-on' : ''}`}
              onClick={() => updateTool('summarize', { enabled: !toolsConfig.summarize.enabled })}
              aria-expanded={toolsConfig.summarize.enabled}
            >
              <span>{t('ai.summarize')}</span>
              <span className="chevron" aria-hidden="true">{toolsConfig.summarize.enabled ? '▾' : '▸'}</span>
            </button>
            {toolsConfig.summarize.enabled && (
              <div className="tool-body">
                <p className="field-hint">{t('ai.summarizeHint')}</p>
                <button type="button" className="connect-btn" disabled={!ai.isConnected} onClick={onOpenSummary}>
                  {t('ai.generateSummary')}
                </button>
              </div>
            )}
          </div>

          <div className="tool-card">
            <button
              type="button"
              className={`tool-toggle${auto.enabled ? ' is-on' : ''}`}
              onClick={toggleAutocomplete}
              aria-pressed={auto.enabled}
            >
              <span>{t('ai.autocomplete')}</span>
              <span className="tool-toggle-right">
                {autoFlash && (
                  <span className={`tool-flash tool-flash--${autoFlash}`}>
                    {autoFlash === 'on' ? t('ai.autocompleteOn') : t('ai.autocompleteOff')}
                  </span>
                )}
                <span className="tool-check" aria-hidden="true">{auto.enabled ? '✓' : ''}</span>
              </span>
            </button>
            {auto.enabled && (
              <div className="tool-body">
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
          </div>

          <div className="tool-card">
            <button
              type="button"
              className={`tool-toggle${cont.enabled ? ' is-on' : ''}`}
              onClick={() => updateTool('continueTool', { enabled: !cont.enabled })}
              aria-expanded={cont.enabled}
            >
              <span>{t('ai.autoGenerate')}</span>
              <span className="chevron" aria-hidden="true">{cont.enabled ? '▾' : '▸'}</span>
            </button>
            {cont.enabled && (
              <div className="tool-body">
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

                {genError && <p className="field-error" role="alert">{genError}</p>}

                {genPhase === 'idle' && (
                  <div className="action-row">
                    <button
                      type="button"
                      className="connect-btn"
                      disabled={!ai.isConnected}
                      onClick={() => void runGenerate()}
                    >
                      {t('ai.autoGenerateBtn')}
                    </button>
                  </div>
                )}

                {(genPhase === 'generating' || genPhase === 'editing') && (
                  <div className="action-row action-row--loading">
                    <FunnyLoader />
                    <button
                      type="button"
                      className="connect-btn connect-btn--danger"
                      onClick={() => controllerRef.current?.abort()}
                    >
                      {t('ai.stop')}
                    </button>
                  </div>
                )}

                {genPhase === 'review' && (
                  <>
                    <label className="field-label" htmlFor="gen-draft">
                      {draftHadSelection ? t('ai.draftLabelSelection') : t('ai.draftLabelDocument')}
                    </label>
                    <textarea
                      id="gen-draft"
                      className="field-input gen-draft scroll-thin"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <div className="action-row">
                      <button
                        type="button"
                        className="connect-btn connect-btn--ghost"
                        onClick={() => setShowEditPrompt((v) => !v)}
                      >
                        {t('ai.editWithAi')}
                      </button>
                      <button
                        type="button"
                        className="connect-btn connect-btn--connected"
                        onClick={acceptDraft}
                        title={t('ai.accept')}
                      >
                        {t('ai.accept')}
                      </button>
                      <button
                        type="button"
                        className="connect-btn connect-btn--danger"
                        onClick={discardDraft}
                        title={t('ai.discard')}
                      >
                        {t('ai.discard')}
                      </button>
                    </div>
                    {showEditPrompt && (
                      <div className="action-row">
                        <input
                          className="field-input edit-instruction"
                          type="text"
                          placeholder={t('ai.editInstructionPlaceholder')}
                          value={editInstruction}
                          autoFocus
                          onChange={(e) => setEditInstruction(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void runEditWithAi()
                          }}
                        />
                        <button
                          type="button"
                          className="connect-btn"
                          disabled={!editInstruction.trim()}
                          onClick={() => void runEditWithAi()}
                        >
                          {t('ai.apply')}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
