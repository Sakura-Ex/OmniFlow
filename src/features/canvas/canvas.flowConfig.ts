import { RecipeNode } from '@/features/canvas/components/RecipeNode'
import { SourceNode } from '@/features/canvas/components/SourceNode'
import { TargetNode } from '@/features/canvas/components/TargetNode'
import { CustomEdge } from '@/features/canvas/components/CustomEdge'

export const nodeTypes = Object.freeze({
  recipeNode: RecipeNode,
  sourceNode: SourceNode,
  targetNode: TargetNode,
})

export const edgeTypes = Object.freeze({
  default: CustomEdge,
})
