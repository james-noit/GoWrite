import { useEffect, useState } from 'react'
import { useI18n } from '../hooks/useI18n'
import type { TranslationKey } from '../lib/i18n/translations'

const PHRASE_KEYS: TranslationKey[] = [
  'docLoader.phrase1',
  'docLoader.phrase2',
  'docLoader.phrase3',
  'docLoader.phrase4',
  'docLoader.phrase5',
]

const LINE_WIDTHS = [82, 58, 94, 40, 70]

/** A magnifying glass "reads" its way down a stack of skeleton lines while a document loads —
 * a literal (and hopefully charming) stand-in for a spinner, since we're actually scanning text. */
export function DocLoader() {
  const { t } = useI18n()
  const [index, setIndex] = useState(() => Math.floor(Math.random() * PHRASE_KEYS.length))

  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => (i + 1) % PHRASE_KEYS.length), 2400)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="doc-loader" role="status" aria-live="polite" aria-label={t('docLoader.ariaLabel')}>
      <div className="doc-loader-page">
        {LINE_WIDTHS.map((w, i) => (
          <span key={i} className="doc-loader-line" style={{ width: `${w}%`, animationDelay: `${i * 0.15}s` }} />
        ))}
        <span className="doc-loader-glass" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <circle cx="10" cy="10" r="6.5" />
            <line x1="15" y1="15" x2="21" y2="21" />
          </svg>
        </span>
      </div>
      <p className="doc-loader-text" aria-hidden="true">{t(PHRASE_KEYS[index])}</p>
    </div>
  )
}
