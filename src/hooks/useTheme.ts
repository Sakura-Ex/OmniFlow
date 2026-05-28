import { useCallback, useEffect, useState } from 'react'
import type { ValueOf } from '@/common/types/common'

/** Constant map of available theme mode identifiers. */
export const ThemeMode = {
  Dark: 'dark',
  Light: 'light',
} as const satisfies Record<string, string>

/**
 *
 */
export type ThemeMode = ValueOf<typeof ThemeMode>

const DEFAULT_STORAGE_KEY = 'omniflow.theme.v1'

/**
 * Persists and toggles a dark/light theme via localStorage.
 *
 * @param storageKey localStorage key used to persist the theme choice
 *                   (defaults to `'omniflow.theme.v1'`).
 * @returns An object with the current `theme` value, a `setTheme` setter,
 *          and a `toggleTheme` function that switches between dark and light.
 */
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
