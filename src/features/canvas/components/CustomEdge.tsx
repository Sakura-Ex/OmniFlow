import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { FALLBACK_CATEGORY } from '@/features/resource-registry/registry.defaults'
import type { ResourceCategoryDef } from '@/common/types/registry'
import { getCategory } from '@/common/utils/resourceId'

/**
 * Resolve the edge colour based on the resource category of the connected handle.
 * @param categories - Map of resource category definitions.
 * @param handleId - The source or target handle identifier, or null.
 * @returns The hex colour string for the edge.
 */
function resolveEdgeColor(
  categories: Record<string, ResourceCategoryDef>,
  handleId?: string | null
): string {
  if (!handleId) return FALLBACK_CATEGORY.themeColor
  const categoryId = getCategory(handleId)
  const exact = categories[categoryId]
  if (exact) return exact.themeColor
  const colonIdx = categoryId.indexOf(':')
  if (colonIdx > 0) {
    const ns = categoryId.slice(0, colonIdx)
    const nsMatch = categories[ns]
    if (nsMatch) return nsMatch.themeColor
  }
  return FALLBACK_CATEGORY.themeColor
}

/**
 * Custom edge component for ReactFlow.
 * Renders a bezier-styled edge colored by the resource category of the connected handle,
 * with a label overlay showing the handle identifier.
 *
 * @param props - Edge props from ReactFlow
 * @param props.id - Unique edge identifier
 * @param props.sourceX - Source node X coordinate
 * @param props.sourceY - Source node Y coordinate
 * @param props.targetX - Target node X coordinate
 * @param props.targetY - Target node Y coordinate
 * @param props.sourcePosition - Source handle position
 * @param props.targetPosition - Target handle position
 * @param props.sourceHandleId - Source handle identifier
 * @param props.targetHandleId - Target handle identifier
 * @param props.markerEnd - End marker definition for the edge arrow
 * @returns Rendered JSX element for the custom edge.
 */
export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  sourceHandleId,
  targetHandleId,
  markerEnd,
}: EdgeProps) {
  const categories = useGlobalResourceTable((state) => state.categories)
  const handleId = sourceHandleId ?? targetHandleId ?? ''
  const color = resolveEdgeColor(categories, handleId)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: color, strokeWidth: 2 }} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 9,
            fontFamily: 'var(--mono)',
            color,
            background: 'rgba(3, 8, 16, 0.85)',
            padding: '2px 6px',
            borderRadius: 4,
            pointerEvents: 'all',
            whiteSpace: 'nowrap',
          }}
          className="nodrag nopan"
        >
          {handleId || '?'}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
