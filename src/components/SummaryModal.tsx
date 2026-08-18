import { useEffect, useRef, useState } from 'react'
import type { UseAiConnection } from '../hooks/useAiConnection'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { useI18n } from '../hooks/useI18n'
import type { TranslationKey } from '../lib/i18n/translations'
import { generate, summaryMessages } from '../lib/ai/actions'
import { FunnyLoader } from './FunnyLoader'

export interface SummaryRequest {
  text: string
  titleKey: TranslationKey
}

interface SummaryModalProps {
  request: SummaryRequest | null
  onClose: () => void
  ai: UseAiConnection
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function SummaryModal({ request, onClose, ai }: SummaryModalProps) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const aiRef = useRef(ai)
  aiRef.current = ai

  const open = !!request

  useFocusTrap(modalRef, open)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!request) return
    setText('')
    setError(null)
    setCopied(false)

    const source = request.text
    if (!source.trim()) {
      setError(t('summary.noText'))
      return
    }

    const controller = new AbortController()
    controllerRef.current = controller
    setIsRunning(true)
    void (async () => {
      try {
        const result = await generate({
          messages: summaryMessages(source),
          config: aiRef.current.config,
          signal: controller.signal,
        })
        setText(result.trim())
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message || t('summary.genericError'))
        }
      } finally {
        setIsRunning(false)
      }
    })()

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  if (!request) return null

  const copyText = () => {
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }

  const baseName = t('summary.fileBaseName')
  const downloadTxt = () =>
    download(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${baseName}.txt`)
  const downloadMd = () =>
    download(new Blob([text], { type: 'text/markdown;charset=utf-8' }), `${baseName}.md`)
  const downloadDocx = async () => {
    const { Document, Packer, Paragraph } = await import('docx')
    const paragraphs = text
      .split(/\r?\n+/)
      .filter((line) => line.trim())
      .map((line) => new Paragraph(line))
    const doc = new Document({
      sections: [{ children: paragraphs.length ? paragraphs : [new Paragraph('')] }],
    })
    download(await Packer.toBlob(doc), `${baseName}.docx`)
  }

  return (
    <div className="summary-backdrop" onClick={onClose}>
      <div
        className="summary-modal glass-panel"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-modal-title"
      >
        <div className="ai-panel-header">
          <h2 id="summary-modal-title">{t(request.titleKey)}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        {isRunning ? (
          <div className="summary-body summary-body--loading">
            <FunnyLoader />
          </div>
        ) : (
          text && <div className="summary-body scroll-thin">{text}</div>
        )}

        <div className="action-row">
          {isRunning ? (
            <button
              type="button"
              className="connect-btn connect-btn--danger"
              onClick={() => controllerRef.current?.abort()}
            >
              {t('ai.stop')}
            </button>
          ) : (
            text && (
              <>
                <button type="button" className="connect-btn connect-btn--ghost" onClick={copyText}>
                  {copied ? t('summary.copied') : t('summary.copy')}
                </button>
                <span className="download-label">{t('summary.downloadLabel')}</span>
                <button type="button" className="connect-btn connect-btn--ghost" onClick={downloadTxt}>
                  .txt
                </button>
                <button type="button" className="connect-btn connect-btn--ghost" onClick={downloadMd}>
                  .md
                </button>
                <button type="button" className="connect-btn connect-btn--ghost" onClick={() => void downloadDocx()}>
                  .docx
                </button>
              </>
            )
          )}
        </div>
      </div>
    </div>
  )
}
