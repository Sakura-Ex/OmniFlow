import { translateDiagnostic } from '@/common/i18n/translateDiagnostic'
import { t, useTranslation } from '@/common/i18n'
import { useMemo } from 'react'
import { portKey } from '@/features/calculation/topology'
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
  useTranslation()
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const recipes = useRecipeStore((s) => s.recipes)
  const environment = useSettingsStore((s) => s.units)
  const issues = useMemo(() => {
    try {
      const ports = graphPorts(nodes, recipes, environment)
      const index = new Map(ports.map(port => [portKey(port.nodeId, port.portId), port]))
      return edges.flatMap(edge => {
        const message = connectionIssue(edge, ports, index)
        return message ? [{ edgeId: edge.id, message }] : []
      })
    } catch (failure) {
      const located: { edgeId?: string; message: string }[] = []
      for (const edge of edges) {
        try {
          const ports = graphPorts(nodes.filter(node => node.id === edge.source || node.id === edge.target), recipes, environment)
          const message = connectionIssue(edge, ports)
          if (message) located.push({ edgeId: edge.id, message })
        } catch (error) { located.push({ edgeId: edge.id, message: error instanceof Error ? error.message : String(error) }) }
      }
      if (!located.length) located.push({ message: failure instanceof Error ? failure.message : String(failure) })
      return located
    }
  }, [nodes, edges, recipes, environment])
  if (!issues.length) return null
  return <aside className={styles.panel} aria-label={t('canvas.connections_to_repair')}>
    <strong>{t('canvas.connectionsToRepairCount', { count: issues.length })}</strong>
    <p>{t('canvas.a_port_was_deleted_resources_are_incompatible')}</p>
    {issues.map((issue) => <button className={styles.issue} key={issue.edgeId ?? issue.message} onClick={() => {
      const store = useCanvasStore.getState()
      store.setEdges(edges.map((edge) => ({ ...edge, selected: edge.id === issue.edgeId })))
      const edge = edges.find((e) => e.id === issue.edgeId)
      store.setNodes(nodes.map((node) => ({ ...node, selected: node.id === edge?.source || node.id === edge?.target })))
    }}>{issue.edgeId}: {translateDiagnostic(issue.message)}</button>)}
  </aside>
}
