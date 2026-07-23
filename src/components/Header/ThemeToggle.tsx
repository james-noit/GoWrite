import type { Theme } from '../../types'

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-checked={isDark}
      onClick={onToggle}
    >
      <span className="theme-toggle-icon" aria-hidden="true">☀️</span>
      <span className={`theme-toggle-track${isDark ? ' is-dark' : ''}`}>
        <span className="theme-toggle-thumb" />
      </span>
      <span className="theme-toggle-icon" aria-hidden="true">🌙</span>
    </button>
  )
}
