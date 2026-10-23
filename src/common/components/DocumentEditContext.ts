import { createContext, useContext } from 'react'

const DocumentEditContext = createContext<((action: () => void) => void) | null>(null)

/** Supply the application's history-aware synchronous document transaction. */
export const DocumentEditProvider = DocumentEditContext.Provider

/** Access document commits without coupling editors to stores or history ownership.
 * @returns Commit an edit as one undoable transaction.
 */
export function useDocumentEdit() {
  const commit = useContext(DocumentEditContext)
  if (!commit) throw new Error('DocumentEditProvider is required')
  return commit
}
