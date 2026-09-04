import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useI18n } from '../../hooks/useI18n'
import { FULL_TOOLBAR_TIER_QUERY } from '../../lib/breakpoints'
import { coffeeDismissedStorage } from '../../lib/storage'
import { CoffeeIcon } from '../icons'

const COFFEE_URL = 'https://www.buymeacoffee.com/jamesnoitt'

/** Touch-only, compact stand-in for the header's "Buy me a coffee" badge (hidden on mobile so
 * the header stays a single row) — floats next to the format FAB instead, at a size that fits a
 * corner overlay, and can be dismissed for good since it's promotional, not functional. */
export function MobileSupportButton() {
  const { t } = useI18n()
  const isFullTier = useMediaQuery(FULL_TOOLBAR_TIER_QUERY)
  const [dismissed, setDismissed] = useState(coffeeDismissedStorage.get)

  if (isFullTier || dismissed) return null

  return createPortal(
    <div className="mobile-coffee">
      <a
        href={COFFEE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mobile-coffee-btn"
        title={t('header.buyCoffee')}
        aria-label={t('header.buyCoffee')}
      >
        <CoffeeIcon />
      </a>
      <button
        type="button"
        className="mobile-coffee-close"
        onClick={() => {
          coffeeDismissedStorage.set(true)
          setDismissed(true)
        }}
        aria-label={t('header.dismissSupport')}
      >
        ✕
      </button>
    </div>,
    document.body,
  )
}
