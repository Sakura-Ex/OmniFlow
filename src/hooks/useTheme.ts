import { useCallback, useEffect, useState } from 'react'

export type ThemeMode = 'dark' | 'light'

const DEFAULT_STORAGE_KEY = 'omniflow.theme.v1'

export function useTheme(storageKey: string = DEFAULT_STORAGE_KEY) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark'
    const savedTheme = window.localStorage.getItem(storageKey)
    return savedTheme === 'light' ? 'light' : 'dark'
  })

  useEffect(() => {
    window.localStorage.setItem(storageKey, theme)
  }, [storageKey, theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return {
    theme,
    setTheme,
    toggleTheme,
  }
}
