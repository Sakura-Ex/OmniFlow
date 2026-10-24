import { create } from 'zustand'

const key = 'omniflow.ui.workspace'
/** Local-only visibility preferences; no document content belongs here. */
type Panels = { objects: boolean; properties: boolean }

/** Validate local-only panel preferences without introducing a document contract.
 * @param value - Untrusted local storage value.
 * @returns Safe first-use defaults with supported boolean overrides.
 */
export function parseWorkspacePreferences(value: unknown): Panels {
  const data = value && typeof value === 'object' ? value as Partial<Panels> : {}
  return { objects: typeof data.objects === 'boolean' ? data.objects : true, properties: typeof data.properties === 'boolean' ? data.properties : false }
}

/** Read optional local preferences without preventing startup when storage is unavailable.
 * @returns Validated panel defaults or saved boolean choices.
 */
function read(): Panels {
  try { return parseWorkspacePreferences(JSON.parse(localStorage.getItem(key) ?? 'null')) } catch { return parseWorkspacePreferences(null) }
}

/** Panel preferences never enter canvas history or calculation identity. */
export const useWorkspacePreferences = create<Panels & { setPanels: (patch: Partial<Panels>) => void }>((set, get) => ({
  ...read(),
  setPanels: patch => {
    const next = parseWorkspacePreferences({ ...get(), ...patch })
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* A blocked preference write must not block navigation. */ }
    set(next)
  },
}))
