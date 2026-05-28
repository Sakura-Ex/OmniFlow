import { createContext, useContext } from 'react'
import type { RecipeNodeData } from '@/common/types/recipe'

type RecipeEditorContextValue = {
  onEdit: (id: string, data: RecipeNodeData) => void
  onAutoFill: (id: string) => void
}

const RecipeEditorContext = createContext<RecipeEditorContextValue | null>(null)

export const RecipeEditorProvider = RecipeEditorContext.Provider

export function useRecipeEditor() {
  const ctx = useContext(RecipeEditorContext)
  if (!ctx) {
    throw new Error('RecipeEditorContext is not available')
  }
  return ctx
}
