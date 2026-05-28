import { createContext, useContext } from 'react'
import type { EndpointRole } from '@/common/types/recipe'

type HandleUpdate = {
  role: EndpointRole
  previousId: string
  nextId: string
}

type NodeDataContextValue = {
  updateNodeData: (
    nodeId: string,
    nextData: Record<string, unknown>,
    handleUpdate?: HandleUpdate
  ) => void
}

const NodeDataContext = createContext<NodeDataContextValue | null>(null)

export const NodeDataProvider = NodeDataContext.Provider

export function useNodeData() {
  const ctx = useContext(NodeDataContext)
  if (!ctx) {
    throw new Error('NodeDataContext is not available')
  }
  return ctx
}
