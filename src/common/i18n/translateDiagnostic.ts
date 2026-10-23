import { getLocale, type Locale } from './index'
import { domainEn, domainZhCN, type DomainMessageKey } from './domainMessages'

/** One bidirectional diagnostic template matcher. */
type MessagePattern = { key: DomainMessageKey; pattern: RegExp; names: string[] }

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const keys = Object.keys(domainZhCN) as DomainMessageKey[]
const exact = new Map<string, DomainMessageKey>()
const patterns: MessagePattern[] = []

// These are presentation aliases only; response status fields remain unchanged.
for (const [source, key] of Object.entries({ success: 'domain.success', infeasible: 'domain.infeasible', unbounded: 'domain.unbounded', limit_reached: 'domain.limitReached', solver_error: 'domain.solverError', invalid_model: 'domain.invalidModel' } as const)) exact.set(source, key)

for (const key of keys) for (const catalog of [domainZhCN, domainEn]) {
  const template = catalog[key]
  const names: string[] = []
  let cursor = 0
  let expression = ''
  for (const match of template.matchAll(/\{([a-zA-Z]+)\}/g)) {
    expression += escapePattern(template.slice(cursor, match.index)) + '(.+?)'
    names.push(match[1])
    cursor = match.index! + match[0].length
  }
  if (!names.length) exact.set(template, key)
  else patterns.push({ key, names, pattern: new RegExp('^' + expression + escapePattern(template.slice(cursor)) + '$') })
}

/** Translate recognized domain text without changing quantities or identities.
 * @param message - Canonical or previously localized diagnostic text.
 * @param language - Selected presentation language.
 * @returns Localized known diagnostics; unknown backend details remain unchanged.
 */
export function translateDiagnostic(message: string, language: Locale = getLocale()): string {
  return translate(message, language, 0)
}

/** Match only known complete messages, then preserve their surrounding diagnostic context.
 * @param message - Diagnostic text or a located diagnostic wrapper.
 * @param language - Selected presentation language.
 * @param depth - Bounded recursion for nested diagnostic wrappers.
 * @returns Translated text with raw domain identity fragments preserved.
 */
function translate(message: string, language: Locale, depth: number): string {
  if (depth > 8 || !message) return message
  const catalog = language === 'en' ? domainEn : domainZhCN
  const key = exact.get(message)
  if (key) return catalog[key]
  for (const { key, pattern, names } of patterns) {
    const match = pattern.exec(message)
    if (!match) continue
    const values = Object.fromEntries(names.map((name, index) => [name, name === 'detail' || name === 'status' ? translate(match[index + 1], language, depth + 1) : match[index + 1]]))
    return catalog[key].replace(/\{([a-zA-Z]+)\}/g, (_, name: string) => values[name])
  }

  // Zod errors retain their paths, codes and input values; only messages are display text.
  if (message.trimStart().startsWith('[')) {
    try {
      const issues: unknown = JSON.parse(message)
      if (Array.isArray(issues) && issues.length && issues.every(issue => issue && typeof issue === 'object' && typeof issue.message === 'string' && Array.isArray(issue.path))) {
        const localized = issues.map(issue => ({ ...issue, message: translate(issue.message, language, depth + 1) }))
        return localized.some((issue, index) => issue.message !== issues[index].message) ? JSON.stringify(localized, null, 2) : message
      }
    } catch {
      // A port address or arbitrary backend detail is not a validation issue list.
    }
  }
  if (message.includes('\n')) return message.split('\n').map(line => translate(line, language, depth + 1)).join('\n')
  if (message.includes('; ')) return message.split('; ').map(part => translate(part, language, depth + 1)).join('; ')
  const located = /^(.*?)(: |：)(.+)$/.exec(message)
  if (located) {
    const detail = translate(located[3], language, depth + 1)
    const prefix = translate(located[1], language, depth + 1)
    if (detail !== located[3] || prefix !== located[1]) return `${prefix}: ${detail}`
  }
  const locatedDetail = /^(.*?) — (.+)$/.exec(message)
  if (locatedDetail) return `${locatedDetail[1]} — ${translate(locatedDetail[2], language, depth + 1)}`
  return message
}
