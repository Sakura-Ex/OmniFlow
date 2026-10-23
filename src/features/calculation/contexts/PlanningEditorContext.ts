import { createContext, useContext } from 'react'
import type { Boundary } from '../networkConfig'

const PlanningEditorContext = createContext<(nodeId?: string) => void>(() => undefined)

/** Share the application's local planning editor entry point with canvas cards. */
export const PlanningEditorProvider = PlanningEditorContext.Provider

/** The application owns history and commits the sole authoritative boundary configuration. */
const BoundaryCommitContext = createContext<(nodeId: string, portId: string, boundary: Boundary) => void>(() => undefined)

/** Provide direct endpoint edits separately, preserving the planning opener function API. */
export const BoundaryCommitProvider = BoundaryCommitContext.Provider

const BoundaryBatchCommitContext = createContext<(nodeId: string, boundaries: Record<string, Boundary>) => void>(() => undefined)

/** Commit node-wide mode changes as a single history entry. */
export const BoundaryBatchCommitProvider = BoundaryBatchCommitContext.Provider

/** Access atomic endpoint edits.
 * @returns Commit all changed ports in one document transaction.
 */
export function useBoundaryBatchCommit() {
  return useContext(BoundaryBatchCommitContext)
}

/** Access history-aware direct boundary edits.
 * @returns Commit a boundary through the application's document owner.
 */
export function useBoundaryCommit() {
  return useContext(BoundaryCommitContext)
}

/**
 * Access the planning editor without making cards own modal or history state.
 * @returns Open the whole plan or the settings for one node.
 */
export function usePlanningEditor() {
  return useContext(PlanningEditorContext)
}
