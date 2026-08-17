import { useCallback, useEffect, useState } from 'react'
import { themeStorage } from '../lib/storage'
import type { Theme } from '../types'

function getInitialTheme(): Theme {
  const stored = themeStorage.get()
  if (stored) return stored
  return 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    themeStorage.set(theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'))
  }, [])

  return { theme, setTheme, toggleTheme }
}
