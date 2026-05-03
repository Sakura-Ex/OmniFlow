import { createContext, useContext } from 'react'
import type { SourceNodeData, TargetNodeData } from './types/recipe'

type EndpointEditorTarget = {
  id: string
  role: 'source' | 'target'
  data: SourceNodeData | TargetNodeData
}

type EndpointEditorContextValue = {
  onEdit: (id: string, role: 'source' | 'target', data: SourceNodeData | TargetNodeData) => void
}

const EndpointEditorContext = createContext<EndpointEditorContextValue | null>(null)

export type { EndpointEditorTarget }
export const EndpointEditorProvider = EndpointEditorContext.Provider

export function useEndpointEditor() {
  const ctx = useContext(EndpointEditorContext)
  if (!ctx) throw new Error('EndpointEditorContext is not available')
  return ctx
}
