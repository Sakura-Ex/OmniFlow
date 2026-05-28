import { create } from 'zustand'
import type { RecipeNodeData } from '@/common/types/recipe'
import type { ComputedNodePayload } from '@/common/types/resource'
import { ensureRecipeDataShape, runModifierPipeline } from '@/features/modifier/modifier.pipeline'
import { applyArchetypeToInputs } from '@/data/archetypes/index'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { buildResourceId } from '@/common/utils/resourceId'
import { flattenRecipeResources } from '@/features/canvas/canvas.utils'

/** State shape for the recipe store. */
export type RecipeStore = {
  /** All recipes indexed by their node ID. */
  recipes: Record<string, RecipeNodeData>
  /** Replace the recipe for a given node with new data (shapes and computes it). */
  setRecipe: (nodeId: string, data: RecipeNodeData) => void
  /** Merge a partial patch into an existing recipe (shapes and computes it). */
  updateRecipe: (nodeId: string, patch: Partial<RecipeNodeData>) => void
  /** Remove the recipe for a given node. */
  removeRecipe: (nodeId: string) => void
  /** Switch the archetype of a recipe, re-applying archetype-driven inputs/outputs. */
  switchArchetype: (nodeId: string, archetypeId: string) => void
  /** Retrieve the computed payload for a given node, or null if not found. */
  getPayload: (nodeId: string) => ComputedNodePayload | null
  /** Bulk-load recipes (shapes and computes each one). */
  loadAll: (recipes: Record<string, RecipeNodeData>) => void
  /** Dump all recipes with computed fields stripped. */
  dumpAll: () => Record<string, RecipeNodeData>
}

/**
 * Ensure a recipe has the correct shape and run the modifier pipeline on it.
 * @param data - The raw recipe node data.
 * @returns A new recipe object with the `_computed` field attached.
 */
function shapeAndCompute(data: RecipeNodeData): RecipeNodeData {
  const shaped = ensureRecipeDataShape(data)
  const computed = runModifierPipeline(shaped)
  return { ...shaped, _computed: computed }
}

/**
 * Walk all resources referenced by a recipe and ensure each has an entry
 * in the global resource table so they are tracked.
 * @param data - The recipe node data whose resources should be registered.
 */
function ensureAllResourceEntries(data: RecipeNodeData) {
  const table = useGlobalResourceTable.getState()
  const resources = flattenRecipeResources(data)
  for (const res of resources) {
    if (res.id) {
      table.ensureEntry(buildResourceId(res.category, res.id))
    }
  }
}

/**
 * Strip the `_computed` runtime-only field from a recipe so it can be safely
 * serialised or persisted.
 * @param recipe - The recipe node data.
 * @returns A shallow copy without the `_computed` field.
 */
function stripComputed(recipe: RecipeNodeData): RecipeNodeData {
  const { _computed, ...rest } = recipe as RecipeNodeData & { _computed?: unknown }
  void _computed
  return rest as RecipeNodeData
}

/**
 * Zustand store that manages all recipe node data within the editor.
 * Each recipe is keyed by its React Flow node ID.
 */
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
