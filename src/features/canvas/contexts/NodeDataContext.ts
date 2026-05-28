import { createContext, useContext } from 'react'
import type { EndpointRole } from '@/common/types/recipe'

/**
 *
 */
type HandleUpdate = {
  role: EndpointRole
  previousId: string
  nextId: string
}

/**
 *
 */
type NodeDataContextValue = {
  updateNodeData: (
    nodeId: string,
    nextData: Record<string, unknown>,
    handleUpdate?: HandleUpdate
  ) => void
}

const NodeDataContext = createContext<NodeDataContextValue | null>(null)

/** React context provider for the node-data value. */
export const NodeDataProvider = NodeDataContext.Provider

/**
 * Access the nearest `NodeDataProvider` value.
 * @returns The `NodeDataContextValue` containing `updateNodeData`.
 * @throws If called outside of a `NodeDataProvider`.
 */
export function useNodeData() {
  const ctx = useContext(NodeDataContext)
  if (!ctx) {
    throw new Error('NodeDataContext is not available')
  }
  return ctx
}
