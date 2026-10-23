import { createContext, useContext, useEffect, useId } from 'react'

/** Report unapplied drafts to the containing settings page. */
export const DraftStateContext = createContext<((id: string, dirty: boolean) => void) | null>(null)

/** Register an editor draft without coupling the editor to its containing page.
 * @param dirty - Whether the draft differs from committed settings.
 */
export function useDraftState(dirty: boolean) {
  const report = useContext(DraftStateContext)
  const id = useId()
  useEffect(() => {
    report?.(id, dirty)
    return () => report?.(id, false)
  }, [report, id, dirty])
}
