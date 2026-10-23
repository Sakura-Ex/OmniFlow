import { create } from 'zustand'
import { NODE_DISPLAY_MODES, type NodeDisplayMode } from '@/common/types/nodeDisplay'

const storageKey = 'omniflow.ui.nodeDisplayMode'

/** Read the last explicit choice without requiring browser storage.
 * @returns The local preference or the first-use compact mode.
 */
function readPreference(): NodeDisplayMode {
  try {
    const saved = globalThis.localStorage?.getItem(storageKey)
    return NODE_DISPLAY_MODES.find(mode => mode === saved) ?? 'compact'
  } catch {
    return 'compact'
  }
}

/** Presentation state is intentionally excluded from model history and calculation identity. */
interface NodeDisplayState {
  mode: NodeDisplayMode
  selectMode: (mode: NodeDisplayMode) => void
  restoreMode: (mode?: NodeDisplayMode) => void
}

export const useNodeDisplayStore = create<NodeDisplayState>((set) => ({
  mode: readPreference(),
  selectMode: mode => {
    try { globalThis.localStorage?.setItem(storageKey, mode) } catch { /* Blocked storage must not prevent a view change. */ }
    set({ mode })
  },
  restoreMode: mode => set({ mode: mode ?? readPreference() }),
}))
