import { useSyncExternalStore } from 'react'
import { en, zhCN } from './messages'
import type { UiTranslationKey } from './messages'

export type { UiTranslationKey } from './messages'

/** Supported application UI locales. */
export type Locale = 'zh-CN' | 'en'

/** Named values substituted into UI message placeholders. */
export type TranslationParams = Record<string, string | number>

const storageKey = 'omniflow.ui.locale'
const listeners = new Set<() => void>()

/** Read the saved UI language without requiring browser storage availability.
 * @returns Saved language, or Chinese by default.
 */
function readLocale(): Locale {
  try {
    return globalThis.localStorage?.getItem(storageKey) === 'en' ? 'en' : 'zh-CN'
  } catch {
    return 'zh-CN'
  }
}

let locale: Locale = readLocale()

/** Return the currently selected UI language.
 * @returns Current UI language.
 */
export function getLocale(): Locale {
  return locale
}

/** Change UI language and persist it when browser storage is available.
 * @param next Supported UI language.
 */
export function setLocale(next: Locale): void {
  if (next !== 'en' && next !== 'zh-CN') return
  if (next === locale) return
  locale = next
  try {
    globalThis.localStorage?.setItem(storageKey, next)
  } catch {
    // Private browsing or blocked storage must not prevent language changes.
  }
  listeners.forEach(listener => listener())
}

/** Resolve a UI message, falling back to Chinese and then the key itself.
 * @param key Typed UI message key; never a resource ID.
 * @param paramsOrLanguage Named values, or a language for backwards-compatible lookup.
 * @param language Optional explicit language for non-React callers.
 * @returns Localized UI label.
 */
export function t(key: UiTranslationKey, paramsOrLanguage?: TranslationParams | Locale, language: Locale = locale): string {
  const selected = typeof paramsOrLanguage === 'string' ? paramsOrLanguage : language
  const primary: Partial<Record<UiTranslationKey, string>> = selected === 'en' ? en : zhCN
  const message = primary[key] || zhCN[key] || key
  const params = typeof paramsOrLanguage === 'object' ? paramsOrLanguage : {}
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) => Object.hasOwn(params, name) ? String(params[name]) : placeholder)
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Subscribe a component to UI language changes.
 * @returns Current locale, localized lookup, and language setter.
 */
export function useTranslation() {
  const language = useSyncExternalStore(subscribe, getLocale, () => 'zh-CN' as const)
  return {
    locale: language,
    setLocale,
    t: (key: UiTranslationKey, params?: TranslationParams) => t(key, params, language),
  }
}
