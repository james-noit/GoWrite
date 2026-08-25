import type { Editor } from '@tiptap/core'
import { useEffect, useRef, useState } from 'react'
import type { UseAiConnection } from '../../hooks/useAiConnection'
import { useI18n } from '../../hooks/useI18n'
import type { TranslationKey } from '../../lib/i18n/translations'
import { continuationMessages, documentText, editMessages, formatMessages, generate } from '../../lib/ai/actions'
import { describeImage, supportsImageDescription } from '../../lib/ai/describeImage'
import { generateImage, supportsImageGeneration } from '../../lib/ai/imageGen'
import { textToHtml } from '../../lib/text'
import { AiImageIcon, AutoGenerateIcon, DescribeImageIcon, GiveFormatIcon, SummarizeIcon } from '../icons'
import { FunnyLoader } from '../FunnyLoader'
import { formatGroups } from './formatGroups'
import { insertTableAction, tableEditActions } from './tableActions'

interface ContextMenuProps {
  editor: Editor | null
  ai: UseAiConnection
  onOpenSummary: (text: string, titleKey: TranslationKey) => void
  onAiInsertion: (from: number, to: number) => void
}

type Tool = 'edit' | 'generate' | 'format' | 'image' | 'describe'
type Stage = 'menu' | 'options' | 'generating' | 'review'

const MENU_WIDTH = 260
const MENU_MAX_HEIGHT = 460

/** Right-click menu inside the editor: the same format/table commands as the toolbar (icon-only),
 * plus selection-scoped AI actions (summarize, edit, autogenerate, give format). Built on the same
 * command definitions as Toolbar.tsx so the two surfaces can never drift apart. */
export function ContextMenu({ editor, ai, onOpenSummary, onAiInsertion }: ContextMenuProps) {
  const { t } = useI18n()
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [tool, setTool] = useState<Tool | null>(null)
  const [stage, setStage] = useState<Stage>('menu')
  const [range, setRange] = useState<{ from: number; to: number } | null>(null)
  const [cursorPos, setCursorPos] = useState(0)
  const [imageSrc, setImageSrc] = useState<string | null>(null)

  const [instruction, setInstruction] = useState('')
  const [genMin, setGenMin] = useState(50)
  const [genMax, setGenMax] = useState(150)
  const [formatScope, setFormatScope] = useState<'selection' | 'document'>('selection')
  const [fmtParagraphs, setFmtParagraphs] = useState(true)
  const [fmtPunctuation, setFmtPunctuation] = useState(true)
  const [fmtStructure, setFmtStructure] = useState(true)
  const [imagePrompt, setImagePrompt] = useState('')
  const [describePrompt, setDescribePrompt] = useState('')
  const [copied, setCopied] = useState(false)

  const [draft, setDraft] = useState('')
  const [insertRange, setInsertRange] = useState<{ from: number; to: number } | null>(null)
  const [insertAt, setInsertAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const close = () => {
    controllerRef.current?.abort()
    setPos(null)
    setTool(null)
    setStage('menu')
    setRange(null)
    setImageSrc(null)
    setInstruction('')
    setImagePrompt('')
    setDescribePrompt('')
    setCopied(false)
    setDraft('')
    setInsertRange(null)
    setInsertAt(null)
    setError(null)
  }

  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      const { from, to, empty, head } = editor.state.selection
      setRange(empty ? null : { from, to })
      setCursorPos(head)
      const target = e.target as HTMLElement | null
      const imgEl = target?.closest('.gw-image')?.querySelector('img') as HTMLImageElement | null
      setImageSrc(imgEl?.src ?? null)
      setTool(null)
      setStage('menu')
      setInstruction('')
      setImagePrompt('')
      setDescribePrompt('')
      setCopied(false)
      setDraft('')
      setInsertRange(null)
      setInsertAt(null)
      setError(null)
      setFormatScope(empty ? 'document' : 'selection')
      const x = Math.max(10, Math.min(e.clientX, window.innerWidth - MENU_WIDTH - 10))
      const y = Math.max(10, Math.min(e.clientY, window.innerHeight - 10 - Math.min(MENU_MAX_HEIGHT, 320)))
      setPos({ x, y })
    }
    dom.addEventListener('contextmenu', onContextMenu)
    return () => dom.removeEventListener('contextmenu', onContextMenu)
  }, [editor])

  useEffect(() => {
    if (!pos) return
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [pos])

  if (!editor || !pos) return null

  const inTable = editor.isActive('table')

  const openSummary = (text: string, titleKey: TranslationKey) => {
    onOpenSummary(text, titleKey)
    close()
  }

  const runTool = async () => {
    if (!editor || !tool) return
    let messages
    let nextInsertRange: { from: number; to: number } | null = null
    let nextInsertAt: number | null = null

    if (tool === 'edit') {
      const value = instruction.trim()
      if (!range || !value) return
      const text = editor.state.doc.textBetween(range.from, range.to, '\n')
      messages = editMessages(text, value)
      nextInsertRange = range
    } else if (tool === 'generate') {
      const text = range
        ? editor.state.doc.textBetween(range.from, range.to, '\n')
        : editor.state.doc.textBetween(0, cursorPos, '\n')
      messages = continuationMessages(text, genMin, genMax)
      nextInsertAt = range ? range.to : cursorPos
    } else {
      const useSelection = formatScope === 'selection' && !!range
      const scopeRange = useSelection ? range! : { from: 0, to: editor.state.doc.content.size }
      const text = editor.state.doc.textBetween(scopeRange.from, scopeRange.to, '\n')
      if (!text.trim()) {
        setError(t('summary.noText'))
        return
      }
      messages = formatMessages(text, { paragraphs: fmtParagraphs, punctuation: fmtPunctuation, structure: fmtStructure })
      nextInsertRange = scopeRange
    }

    const controller = new AbortController()
    controllerRef.current = controller
    setInsertRange(nextInsertRange)
    setInsertAt(nextInsertAt)
    setStage('generating')
    setError(null)
    try {
      const result = await generate({ messages, config: ai.config, signal: controller.signal })
      setDraft(result.trim())
      setStage('review')
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message || t('ai.status.error'))
        setStage('options')
      }
    }
  }

  const runImageTool = async () => {
    if (!editor) return
    const prompt = imagePrompt.trim()
    if (!prompt) return
    if (!supportsImageGeneration(ai.config.provider)) {
      setError(t('contextMenu.aiImageUnsupported'))
      return
    }

    const insertPos = range ? range.to : cursorPos
    const controller = new AbortController()
    controllerRef.current = controller
    setStage('generating')
    setError(null)
    try {
      const src = await generateImage(ai.config, prompt, controller.signal)
      const sizeBefore = editor.state.doc.content.size
      editor
        .chain()
        .focus()
        .setTextSelection(insertPos)
        .insertContent({ type: 'image', attrs: { src, alt: prompt } })
        .run()
      const sizeAfter = editor.state.doc.content.size
      onAiInsertion(insertPos, insertPos + (sizeAfter - sizeBefore))
      close()
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message || t('ai.status.error'))
        setStage('options')
      }
    }
  }

  const runDescribeTool = async () => {
    if (!imageSrc) return
    const prompt = describePrompt.trim()
    if (!prompt) return
    if (!supportsImageDescription(ai.config.provider)) {
      setError(t('contextMenu.aiDescribeUnsupported'))
      return
    }

    const controller = new AbortController()
    controllerRef.current = controller
    setStage('generating')
    setError(null)
    try {
      const result = await describeImage(ai.config, imageSrc, prompt, controller.signal)
      setDraft(result.trim())
      setCopied(false)
      setStage('review')
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message || t('ai.status.error'))
        setStage('options')
      }
    }
  }

  const copyDescription = () => {
    void navigator.clipboard
      .writeText(draft)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }

  const acceptDraft = () => {
    if (!editor || !draft.trim()) return
    const sizeBefore = editor.state.doc.content.size
    // "Give format" output relies on Markdown syntax (headings/lists), which tiptap-markdown
    // parses on insertContentAt; the other tools escape their draft to plain paragraphs so
    // stray AI-generated punctuation is never misread as Markdown.
    const content = tool === 'format' ? draft : textToHtml(draft)
    if (insertRange) {
      editor.chain().focus().insertContentAt(insertRange, content).run()
    } else if (insertAt !== null) {
      editor.chain().focus().insertContentAt(insertAt, content).run()
    } else {
      return
    }
    const sizeAfter = editor.state.doc.content.size
    const from = insertRange ? insertRange.from : insertAt!
    onAiInsertion(from, from + (sizeAfter - sizeBefore))
    close()
  }

  const aiDisabled = !ai.isConnected

  return (
    <div
      className="context-menu glass-panel scroll-thin"
      style={{ left: pos.x, top: pos.y, maxHeight: MENU_MAX_HEIGHT }}
      ref={rootRef}
      role="menu"
    >
      {stage === 'menu' && (
        <>
          <div className="context-menu-icons">
            {formatGroups.flatMap((group) => group.buttons).map((btn) => (
              <button
                key={btn.titleKey}
                type="button"
                title={t(btn.titleKey)}
                aria-label={t(btn.titleKey)}
                className={`context-menu-icon-btn${btn.isActive?.(editor) ? ' is-active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  btn.run(editor, t)
                  close()
                }}
              >
                {btn.icon ? <btn.icon /> : btn.labelKey ? t(btn.labelKey) : btn.label}
              </button>
            ))}
          </div>

          <div className="context-menu-divider" />

          <div className="context-menu-icons">
            <button
              type="button"
              title={t(insertTableAction.titleKey)}
              aria-label={t(insertTableAction.titleKey)}
              className="context-menu-icon-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                insertTableAction.run(editor)
                close()
              }}
            >
              <insertTableAction.icon />
            </button>
            {inTable &&
              tableEditActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  title={t(action.titleKey)}
                  aria-label={t(action.titleKey)}
                  className={`context-menu-icon-btn${action.isActive?.(editor) ? ' is-active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    action.run(editor)
                    close()
                  }}
                >
                  <action.icon />
                </button>
              ))}
          </div>

          <div className="context-menu-divider" />

          <div className="context-menu-group" role="none">
            {range ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className="context-menu-item"
                  disabled={aiDisabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => openSummary(editor.state.doc.textBetween(range.from, range.to, '\n'), 'summary.titleSelection')}
                >
                  <SummarizeIcon />
                  {t('contextMenu.summarizeSelection')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="context-menu-item"
                  disabled={aiDisabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => openSummary(editor.state.doc.textBetween(0, range.from, '\n'), 'summary.titleBefore')}
                >
                  <SummarizeIcon />
                  {t('contextMenu.summarizeBefore')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="context-menu-item"
                  disabled={aiDisabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    openSummary(editor.state.doc.textBetween(range.to, editor.state.doc.content.size, '\n'), 'summary.titleAfter')
                  }
                >
                  <SummarizeIcon />
                  {t('contextMenu.summarizeAfter')}
                </button>
              </>
            ) : (
              <button
                type="button"
                role="menuitem"
                className="context-menu-item"
                disabled={aiDisabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => openSummary(documentText(editor), 'summary.titleDocument')}
              >
                <SummarizeIcon />
                {t('contextMenu.summarizeDocument')}
              </button>
            )}

            {range && (
              <button
                type="button"
                role="menuitem"
                className="context-menu-item"
                disabled={aiDisabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setTool('edit')
                  setStage('options')
                }}
              >
                <AutoGenerateIcon />
                {t('contextMenu.editWithAi')}
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              className="context-menu-item"
              disabled={aiDisabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setTool('generate')
                setStage('options')
              }}
            >
              <AutoGenerateIcon />
              {t('contextMenu.autogenerate')}
            </button>

            <button
              type="button"
              role="menuitem"
              className="context-menu-item"
              disabled={aiDisabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setTool('format')
                setStage('options')
              }}
            >
              <GiveFormatIcon />
              {t('contextMenu.giveFormat')}
            </button>

            <button
              type="button"
              role="menuitem"
              className="context-menu-item"
              disabled={aiDisabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setTool('image')
                setStage('options')
              }}
            >
              <AiImageIcon />
              {t('contextMenu.aiImage')}
            </button>

            {imageSrc && (
              <button
                type="button"
                role="menuitem"
                className="context-menu-item"
                disabled={aiDisabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setTool('describe')
                  setDescribePrompt(t('contextMenu.aiDescribeDefaultPrompt'))
                  setStage('options')
                }}
              >
                <DescribeImageIcon />
                {t('contextMenu.aiDescribe')}
              </button>
            )}
          </div>
        </>
      )}

      {stage === 'options' && tool === 'edit' && (
        <div className="context-menu-prompt">
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <input
            className="field-input"
            type="text"
            autoFocus
            placeholder={t('contextMenu.editWithAiPlaceholder')}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runTool()
            }}
          />
          <div className="action-row">
            <button type="button" className="connect-btn connect-btn--ghost" onClick={() => setStage('menu')}>
              {t('common.cancel')}
            </button>
            <button type="button" className="connect-btn" disabled={!instruction.trim()} onClick={() => void runTool()}>
              {t('ai.apply')}
            </button>
          </div>
        </div>
      )}

      {stage === 'options' && tool === 'generate' && (
        <div className="context-menu-prompt">
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="tool-grid">
            <div>
              <label className="field-label" htmlFor="cm-gen-min">{t('ai.minWords')}</label>
              <input
                id="cm-gen-min"
                className="field-input"
                type="number"
                min={1}
                value={genMin}
                onChange={(e) => setGenMin(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="cm-gen-max">{t('ai.maxWords')}</label>
              <input
                id="cm-gen-max"
                className="field-input"
                type="number"
                min={1}
                value={genMax}
                onChange={(e) => setGenMax(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="action-row">
            <button type="button" className="connect-btn connect-btn--ghost" onClick={() => setStage('menu')}>
              {t('common.cancel')}
            </button>
            <button type="button" className="connect-btn" onClick={() => void runTool()}>
              {t('ai.autoGenerateBtn')}
            </button>
          </div>
        </div>
      )}

      {stage === 'options' && tool === 'format' && (
        <div className="context-menu-prompt">
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          {range && (
            <>
              <span className="field-label">{t('contextMenu.giveFormatScope')}</span>
              <div className="context-menu-scope-row">
                <label>
                  <input
                    type="radio"
                    name="cm-format-scope"
                    checked={formatScope === 'selection'}
                    onChange={() => setFormatScope('selection')}
                  />{' '}
                  {t('contextMenu.giveFormatScopeSelection')}
                </label>
                <label>
                  <input
                    type="radio"
                    name="cm-format-scope"
                    checked={formatScope === 'document'}
                    onChange={() => setFormatScope('document')}
                  />{' '}
                  {t('contextMenu.giveFormatScopeDocument')}
                </label>
              </div>
            </>
          )}
          <label className="context-menu-checkbox-row">
            <input type="checkbox" checked={fmtParagraphs} onChange={(e) => setFmtParagraphs(e.target.checked)} />
            {t('contextMenu.giveFormatOptionParagraphs')}
          </label>
          <label className="context-menu-checkbox-row">
            <input type="checkbox" checked={fmtPunctuation} onChange={(e) => setFmtPunctuation(e.target.checked)} />
            {t('contextMenu.giveFormatOptionPunctuation')}
          </label>
          <label className="context-menu-checkbox-row">
            <input type="checkbox" checked={fmtStructure} onChange={(e) => setFmtStructure(e.target.checked)} />
            {t('contextMenu.giveFormatOptionStructure')}
          </label>
          <div className="action-row">
            <button type="button" className="connect-btn connect-btn--ghost" onClick={() => setStage('menu')}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="connect-btn"
              disabled={!fmtParagraphs && !fmtPunctuation && !fmtStructure}
              onClick={() => void runTool()}
            >
              {t('ai.apply')}
            </button>
          </div>
        </div>
      )}

      {stage === 'options' && tool === 'image' && (
        <div className="context-menu-prompt">
          {!supportsImageGeneration(ai.config.provider) && (
            <p className="field-hint context-menu-notice">{t('contextMenu.aiImageUnsupported')}</p>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <textarea
            className="field-input gen-draft scroll-thin"
            autoFocus
            placeholder={t('contextMenu.aiImagePlaceholder')}
            value={imagePrompt}
            disabled={!supportsImageGeneration(ai.config.provider)}
            onChange={(e) => setImagePrompt(e.target.value)}
          />
          <div className="action-row">
            <button type="button" className="connect-btn connect-btn--ghost" onClick={() => setStage('menu')}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="connect-btn"
              disabled={!imagePrompt.trim() || !supportsImageGeneration(ai.config.provider)}
              onClick={() => void runImageTool()}
            >
              {t('contextMenu.aiImageGenerate')}
            </button>
          </div>
        </div>
      )}

      {stage === 'options' && tool === 'describe' && (
        <div className="context-menu-prompt">
          {!supportsImageDescription(ai.config.provider) && (
            <p className="field-hint context-menu-notice">{t('contextMenu.aiDescribeUnsupported')}</p>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <textarea
            className="field-input gen-draft scroll-thin"
            autoFocus
            placeholder={t('contextMenu.aiDescribePlaceholder')}
            value={describePrompt}
            disabled={!supportsImageDescription(ai.config.provider)}
            onChange={(e) => setDescribePrompt(e.target.value)}
          />
          <div className="action-row">
            <button type="button" className="connect-btn connect-btn--ghost" onClick={() => setStage('menu')}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="connect-btn"
              disabled={!describePrompt.trim() || !supportsImageDescription(ai.config.provider)}
              onClick={() => void runDescribeTool()}
            >
              {t('contextMenu.aiDescribeGenerate')}
            </button>
          </div>
        </div>
      )}

      {stage === 'generating' && (
        <div className="context-menu-prompt">
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

      {stage === 'review' && tool === 'describe' && (
        <div className="context-menu-prompt">
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <textarea className="field-input gen-draft scroll-thin" value={draft} readOnly />
          <div className="action-row">
            <button type="button" className="connect-btn connect-btn--ghost" onClick={() => setStage('options')}>
              {t('contextMenu.aiDescribeEditPrompt')}
            </button>
            <button type="button" className="connect-btn connect-btn--connected" onClick={copyDescription}>
              {copied ? t('summary.copied') : t('summary.copy')}
            </button>
            <button type="button" className="connect-btn connect-btn--danger" onClick={close}>
              {t('common.close')}
            </button>
          </div>
        </div>
      )}

      {stage === 'review' && tool !== 'describe' && (
        <div className="context-menu-prompt">
          <textarea
            className="field-input gen-draft scroll-thin"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="action-row">
            <button type="button" className="connect-btn connect-btn--connected" onClick={acceptDraft}>
              {t('ai.accept')}
            </button>
            <button type="button" className="connect-btn connect-btn--danger" onClick={close}>
              {t('ai.discard')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
