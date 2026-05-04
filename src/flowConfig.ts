import { RecipeNode } from './components/RecipeNode'
import { SourceNode } from './components/SourceNode'
import { TargetNode } from './components/TargetNode'
import { CustomEdge } from './components/CustomEdge'

export const nodeTypes = Object.freeze({
  recipeNode: RecipeNode,
  sourceNode: SourceNode,
  targetNode: TargetNode,
})

export const edgeTypes = Object.freeze({
  default: CustomEdge,
})