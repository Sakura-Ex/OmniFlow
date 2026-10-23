import { useCanvasStore } from '@/features/canvas/canvas.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { graphPorts, connectionIssue } from '@/features/calculation/graphPorts'
import styles from './GraphIssuesPanel.module.css'

/**
 * Retain broken edges as editable data and make missing/dynamic handles visible.
 * @returns Repairable edge issue controls, or null.
 */
export function GraphIssuesPanel() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const recipes = useRecipeStore((s) => s.recipes)
  const environment = useSettingsStore((s) => s.units)
  const issues: { edgeId?: string; message: string }[] = []
  for (const edge of edges) {
    try {
      const ports = graphPorts(nodes.filter((n) => n.id === edge.source || n.id === edge.target), recipes, environment)
      const message = connectionIssue(edge, ports)
      if (message) issues.push({ edgeId: edge.id, message })
    } catch (error) { issues.push({ edgeId: edge.id, message: error instanceof Error ? error.message : String(error) }) }
  }
  if (!issues.length) return null
  return <aside className={styles.panel} aria-label="待修复连线">
    <strong>待修复连线（{issues.length}）</strong>
    <p>端口已删除、资源不兼容或旧连线有歧义。选中后可删除并重新连接。</p>
    {issues.map((issue) => <button className={styles.issue} key={issue.edgeId} onClick={() => {
      const store = useCanvasStore.getState()
      store.setEdges(edges.map((edge) => ({ ...edge, selected: edge.id === issue.edgeId })))
      const edge = edges.find((e) => e.id === issue.edgeId)
      store.setNodes(nodes.map((node) => ({ ...node, selected: node.id === edge?.source || node.id === edge?.target })))
    }}>{issue.edgeId}: {issue.message}</button>)}
  </aside>
}
