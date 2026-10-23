import { getLocale } from './index'
import type { Locale } from './index'

const builtInCategories: Record<string, readonly [string, string]> = {
  item: ['物品', 'Items'],
  fluid: ['流体', 'Fluids'],
  energy: ['能源', 'Energy'],
  stress: ['应力', 'Stress'],
  heat: ['热能', 'Heat'],
  _fallback: ['未定义', 'Undefined'],
}

/** Localize untouched built-in category names while preserving custom category names.
 * @param id Stable category ID.
 * @param displayName Saved display name; custom values pass through unchanged.
 * @param locale Optional captured UI locale for memoized callers.
 * @returns Presentation-only category label.
 */
export function categoryDisplayName(id: string, displayName: string, locale: Locale = getLocale()): string {
  const builtin = builtInCategories[id]
  return builtin && displayName === builtin[0] ? builtin[locale === 'en' ? 1 : 0] : displayName
}

const builtInArchetypes: Record<string, readonly [string, string]> = {
  custom_generic: ['通用自定义范式', 'Generic custom archetype'],
  gt_electric: ['格雷电力机器范式', 'GregTech electric archetype'],
  fluid_networked: ['流体公用范式', 'Fluid utility archetype'],
}

/** Localize built-in archetype metadata without modifying machine or resource names.
 * @param id Stable archetype ID.
 * @param name Display metadata.
 * @returns Localized built-in label or original metadata.
 */
export function archetypeDisplayName(id: string, name: string): string {
  const builtin = builtInArchetypes[id]
  return builtin && name === builtin[0] ? builtin[getLocale() === 'en' ? 1 : 0] : name
}
