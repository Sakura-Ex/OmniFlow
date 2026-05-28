import { create } from 'zustand'
import type { RecipeNodeData } from '@/common/types/recipe'
import type { ComputedNodePayload } from '@/common/types/resource'
import { ensureRecipeDataShape, runModifierPipeline } from '@/features/modifier/modifier.pipeline'
import { applyArchetypeToInputs } from '@/data/archetypes/index'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { buildResourceId } from '@/common/utils/resourceId'
import { flattenRecipeResources } from '@/features/canvas/canvas.utils'

export type RecipeStore = {
  recipes: Record<string, RecipeNodeData>
  setRecipe: (nodeId: string, data: RecipeNodeData) => void
  updateRecipe: (nodeId: string, patch: Partial<RecipeNodeData>) => void
  removeRecipe: (nodeId: string) => void
  switchArchetype: (nodeId: string, archetypeId: string) => void
  getPayload: (nodeId: string) => ComputedNodePayload | null
  loadAll: (recipes: Record<string, RecipeNodeData>) => void
  dumpAll: () => Record<string, RecipeNodeData>
}

function shapeAndCompute(data: RecipeNodeData): RecipeNodeData {
  const shaped = ensureRecipeDataShape(data)
  const computed = runModifierPipeline(shaped)
  return { ...shaped, _computed: computed }
}

function ensureAllResourceEntries(data: RecipeNodeData) {
  const table = useGlobalResourceTable.getState()
  const resources = flattenRecipeResources(data)
  for (const res of resources) {
    if (res.id) {
      table.ensureEntry(buildResourceId(res.category, res.id))
    }
  }
}

function stripComputed(recipe: RecipeNodeData): RecipeNodeData {
  const { _computed, ...rest } = recipe as RecipeNodeData & { _computed?: unknown }
  void _computed
  return rest as RecipeNodeData
}

export const useRecipeStore = create<RecipeStore>((set, get) => ({
  recipes: {},

  setRecipe: (nodeId, data) => {
    set((state) => {
      const shaped = shapeAndCompute(data)
      ensureAllResourceEntries(shaped)
      return { recipes: { ...state.recipes, [nodeId]: shaped } }
    })
  },

  updateRecipe: (nodeId, patch) => {
    set((state) => {
      const current = state.recipes[nodeId]
      if (!current) return state
      const merged = { ...current, ...patch }
      const shaped = shapeAndCompute(merged)
      ensureAllResourceEntries(shaped)
      return { recipes: { ...state.recipes, [nodeId]: shaped } }
    })
  },

  removeRecipe: (nodeId) => {
    set((state) => {
      const next = { ...state.recipes }
      delete next[nodeId]
      return { recipes: next }
    })
  },

  switchArchetype: (nodeId, archetypeId) => {
    set((state) => {
      const current = state.recipes[nodeId]
      if (!current) return state
      const currentInputs = current.base_inputs ?? []
      const { materials, utilityInputs, utilityOutputs } = applyArchetypeToInputs(
        currentInputs,
        archetypeId,
        current.metadata ?? {}
      )
      const merged = {
        ...current,
        archetype_id: archetypeId,
        base_inputs: materials,
        base_utility_inputs: [
          ...utilityInputs,
          ...(current.base_utility_inputs ?? []).filter((u) => !(u._uid?.startsWith('utility-'))),
        ],
        base_utility_outputs: [
          ...utilityOutputs,
          ...(current.base_utility_outputs ?? []).filter((u) => !(u._uid?.startsWith('utility-'))),
        ],
      }
      const shaped = shapeAndCompute(merged)
      ensureAllResourceEntries(shaped)
      return { recipes: { ...state.recipes, [nodeId]: shaped } }
    })
  },

  getPayload: (nodeId) => {
    const recipe = get().recipes[nodeId]
    if (!recipe) return null
    const computed = (recipe as RecipeNodeData & { _computed?: ComputedNodePayload })._computed
    return computed ?? null
  },

  loadAll: (recipes) => {
    set((state) => {
      const shaped: Record<string, RecipeNodeData> = {}
      for (const [id, data] of Object.entries(recipes)) {
        shaped[id] = shapeAndCompute(data)
        ensureAllResourceEntries(shaped[id])
      }
      return { recipes: { ...state.recipes, ...shaped } }
    })
  },

  dumpAll: () => {
    const all: Record<string, RecipeNodeData> = {}
    for (const [id, recipe] of Object.entries(get().recipes)) {
      all[id] = stripComputed(recipe)
    }
    return all
  },
}))
