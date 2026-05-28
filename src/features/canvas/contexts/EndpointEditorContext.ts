import { createContext, useContext } from 'react'
import type { EndpointRole, SourceNodeData, TargetNodeData } from '@/common/types/recipe'

/** Describes the target of an endpoint-edit action. */
type EndpointEditorTarget = {
  id: string
  role: EndpointRole
  data: SourceNodeData | TargetNodeData
}

/**
 *
 */
type EndpointEditorContextValue = {
  onEdit: (id: string, role: EndpointRole, data: SourceNodeData | TargetNodeData) => void
}

const EndpointEditorContext = createContext<EndpointEditorContextValue | null>(null)

export type { EndpointEditorTarget }
/** React context provider for the endpoint-editor value. */
export const EndpointEditorProvider = EndpointEditorContext.Provider

/**
 * Access the nearest `EndpointEditorProvider` value.
 * @returns The `EndpointEditorContextValue` containing `onEdit`.
 * @throws If called outside of an `EndpointEditorProvider`.
 */
export function useEndpointEditor() {
  const ctx = useContext(EndpointEditorContext)
  if (!ctx) throw new Error('EndpointEditorContext is not available')
  return ctx
}
