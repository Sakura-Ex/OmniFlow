import { createContext, useContext } from 'react'

type HandleUpdate = {
  role: 'source' | 'target'
  previousId: string
  nextId: string
}

type NodeDataContextValue = {
  updateNodeData: (
    nodeId: string,
    nextData: Record<string, any>,
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
