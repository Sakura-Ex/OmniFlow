import { createContext, useContext } from 'react'
import type { RecipeNodeData } from '@/common/types/recipe'

/** Value shape provided by the recipe editor context. */
type RecipeEditorContextValue = {
  /** Callback invoked when a recipe node should be opened for editing. */
  onEdit: (id: string, data: RecipeNodeData) => void
  /** Callback invoked when a recipe node should be auto-filled with suggested values. */
  onAutoFill: (id: string) => void
}

const RecipeEditorContext = createContext<RecipeEditorContextValue | null>(null)

/** Provider component that supplies recipe editor callbacks via context. */
export const RecipeEditorProvider = RecipeEditorContext.Provider

/**
 * Retrieve the current recipe editor context.
 * Throws if used outside of a {@link RecipeEditorProvider}.
 *
 * @returns The `RecipeEditorContextValue` containing `onEdit` and `onAutoFill`.
 */
export function useRecipeEditor() {
  const ctx = useContext(RecipeEditorContext)
  if (!ctx) {
    throw new Error('RecipeEditorContext is not available')
  }
  return ctx
}
