import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow'
import { useGlobalResourceTable } from '../registry/globalResourceTable'
import { FALLBACK_CATEGORY } from '../registry/defaults'
import type { ResourceCategoryDef } from '../registry/types'
import { getCategory } from '../utils/resourceIdentifier'

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
