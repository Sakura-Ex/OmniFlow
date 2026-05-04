import { useCallback, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { Edge, Node } from 'reactflow'
import type { RecipeNodeData } from '../types/recipe'
import type { CalculateResponse } from '../types/api'
import { ensureRecipeDataShape, getCalculatedRates, toLegacyPort } from '../modifiers/calculate'
import { buildTopologicalNets, translatePortIds } from '../utils/topologicalNets'

const VIRTUAL_GLOBAL_SOURCE = 'Virtual_Global_Source'
const VIRTUAL_GLOBAL_TARGET = 'Virtual_Global_Target'

function resolveIsAuto(data: Record<string, unknown> | undefined): boolean {
  if (typeof data?.mode === 'string') {
    return data.mode !== 'limit' && data.mode !== 'demand'
  }
  if (typeof data?.is_auto === 'boolean') return data.is_auto
  if (typeof data?.is_virtual === 'boolean') return data.is_virtual
  return true
}

type UseCalculationParams = {
  nodesRef: MutableRefObject<Node[]>
  edgesRef: MutableRefObject<Edge[]>
  setNodes: Dispatch<SetStateAction<Node[]>>
}

export function useCalculation({ nodesRef, edgesRef, setNodes }: UseCalculationParams) {
  const [systemInputs, setSystemInputs] = useState<Record<string, number>>({})
  const [systemOutputs, setSystemOutputs] = useState<Record<string, number>>({})
  const [lastSystemInputs, setLastSystemInputs] = useState<Record<string, number>>({})
  const [lastSystemOutputs, setLastSystemOutputs] = useState<Record<string, number>>({})
  const [globalInputIds, setGlobalInputIds] = useState<string[]>([])
  const [globalOutputIds, setGlobalOutputIds] = useState<string[]>([])

  const resetSystemStats = useCallback(() => {
    setSystemInputs({})
    setSystemOutputs({})
    setLastSystemInputs({})
    setLastSystemOutputs({})
    setGlobalInputIds([])
    setGlobalOutputIds([])
  }, [])

  const handleCalculate = useCallback(async () => {
    const shapedRecipeByNodeId = new Map<string, RecipeNodeData>()
    const globalInputSet = new Set<string>()
    const globalOutputSet = new Set<string>()

    // ── Step 1: shape all recipe nodes so we know routing_mode per port ──────
    for (const n of nodesRef.current) {
      if (n.type !== 'recipeNode') continue
      const shaped = ensureRecipeDataShape(n.data as RecipeNodeData)
      shapedRecipeByNodeId.set(n.id, shaped)

      for (const port of shaped.base_inputs ?? []) {
        if (port.routing_mode === 'global') globalInputSet.add(`${port.category}:${port.id}`)
      }
      for (const port of shaped.base_outputs ?? []) {
        if (port.routing_mode === 'global') globalOutputSet.add(`${port.category}:${port.id}`)
      }
    }

    // ── Step 2: build topological net table (Task 1) ─────────────────────────
    // Only pass wired edges to the net compiler; global ports never appear in
    // physical edges, so filtering is straightforward.
    const physicalEdges = edgesRef.current.filter((e) => {
      const srcGlobal =
        e.sourceHandle
          ? (shapedRecipeByNodeId.get(e.source)?.base_outputs ?? []).some(
              (p) => p.id && `${p.category}:${p.id}` === e.sourceHandle && p.routing_mode === 'global'
            )
          : false
      const tgtGlobal =
        e.targetHandle
          ? (shapedRecipeByNodeId.get(e.target)?.base_inputs ?? []).some(
              (p) => p.id && `${p.category}:${p.id}` === e.targetHandle && p.routing_mode === 'global'
            )
          : false
      return !srcGlobal && !tgtGlobal
    })

    const { lookup: netLookup } = buildTopologicalNets(
      nodesRef.current,
      physicalEdges,
      shapedRecipeByNodeId
    )

    // Build translated-id -> original-id alias map so HUD totals can merge
    // namespaced keys (Net_/Global_/Void_) back into the same resource bucket.
    const namespaceAlias = new Map<string, string>()
    for (const n of nodesRef.current) {
      if (n.type === 'recipeNode') {
        const shaped = shapedRecipeByNodeId.get(n.id)
        if (!shaped) continue
        for (const port of shaped.base_inputs ?? []) {
          if (!port.id) continue
          const qualifiedId = `${port.category}:${port.id}`
          const translated = netLookup.get(`${n.id}|${qualifiedId}`) ?? `Void_${n.id}_${qualifiedId}`
          namespaceAlias.set(translated, port.id)
        }
        for (const port of shaped.base_outputs ?? []) {
          if (!port.id) continue
          const qualifiedId = `${port.category}:${port.id}`
          const translated = netLookup.get(`${n.id}|${qualifiedId}`) ?? `Void_${n.id}_${qualifiedId}`
          namespaceAlias.set(translated, port.id)
        }
        continue
      }

      if (n.type === 'sourceNode' || n.type === 'targetNode') {
        const resourceId: string = n.data?.id ?? n.id
        const itemType: string = n.data?.item_type ?? 'item'
        const qualifiedId = `${itemType}:${resourceId}`
        const translated = netLookup.get(`${n.id}|${qualifiedId}`) ?? `Void_${n.id}_${qualifiedId}`
        namespaceAlias.set(translated, resourceId)
      }
    }

    // ── Step 3: compile payload nodes with translated port IDs (Task 2) ──────
    const payloadNodes = nodesRef.current.map((n) => {
      // Source / target nodes have a single port whose ID equals data.id.
      // We must rewrite that ID to the same net name used on the edge handles,
      // otherwise the backend can't match the edge to the node port.
      if (n.type === 'sourceNode' || n.type === 'targetNode') {
        const resourceId: string = n.data?.id ?? n.id
        const itemType: string = n.data?.item_type ?? 'item'
        const qualifiedId = `${itemType}:${resourceId}`
        const key = `${n.id}|${qualifiedId}`
        const netName = netLookup.get(key) ?? qualifiedId
        return { id: n.id, type: n.type, data: { ...n.data, id: netName } }
      }

      if (n.type !== 'recipeNode') return { id: n.id, type: n.type, data: n.data }

      const shaped = shapedRecipeByNodeId.get(n.id)!
      const calculated = getCalculatedRates(shaped)

      const rawInputs = calculated.inputRates.map(toLegacyPort)
      const rawOutputs = calculated.outputRates.map(toLegacyPort)

      return {
        id: n.id,
        type: n.type,
        data: {
          ...shaped,
          // Task 2: rewrite port IDs to net names
          inputs: translatePortIds(rawInputs, n.id, netLookup),
          outputs: translatePortIds(rawOutputs, n.id, netLookup),
          duration_ticks: 20,
        },
      }
    })

    // ── Step 4: build wired edges with translated handle IDs (Task 3) ─────────
    // The backend matches edges to ports by their handle string; since we've
    // renamed port IDs in the node payload, we must rename handles here too.
    const wiredEdges = physicalEdges.map((e) => {
      const srcNetName = e.sourceHandle
        ? (netLookup.get(`${e.source}|${e.sourceHandle}`) ?? e.sourceHandle)
        : e.sourceHandle
      const tgtNetName = e.targetHandle
        ? (netLookup.get(`${e.target}|${e.targetHandle}`) ?? e.targetHandle)
        : e.targetHandle
      return {
        source: e.source,
        target: e.target,
        sourceHandle: srcNetName,
        targetHandle: tgtNetName,
      }
    })

    const implicitEdges: Array<{
      source: string
      target: string
      sourceHandle: string | null | undefined
      targetHandle: string | null | undefined
    }> = []

    for (const [nodeId, shaped] of shapedRecipeByNodeId.entries()) {
      for (const port of shaped.base_inputs ?? []) {
        if (port.routing_mode !== 'global' || !port.id) continue
        const qualifiedId = `${port.category}:${port.id}`
        const globalNet = `Global_${qualifiedId}`
        implicitEdges.push({
          source: VIRTUAL_GLOBAL_SOURCE,
          target: nodeId,
          sourceHandle: globalNet,
          targetHandle: globalNet,
        })
      }
      for (const port of shaped.base_outputs ?? []) {
        if (port.routing_mode !== 'global' || !port.id) continue
        const qualifiedId = `${port.category}:${port.id}`
        const globalNet = `Global_${qualifiedId}`
        implicitEdges.push({
          source: nodeId,
          target: VIRTUAL_GLOBAL_TARGET,
          sourceHandle: globalNet,
          targetHandle: globalNet,
        })
      }
    }

    const payload = {
      nodes: payloadNodes.concat([
        {
          id: VIRTUAL_GLOBAL_SOURCE,
          type: 'virtualNode',
          data: { kind: 'global_source' },
        },
        {
          id: VIRTUAL_GLOBAL_TARGET,
          type: 'virtualNode',
          data: { kind: 'global_target' },
        },
      ]),
      edges: wiredEdges.concat(implicitEdges),
    }

    setGlobalInputIds(Array.from(globalInputSet))
    setGlobalOutputIds(Array.from(globalOutputSet))

    const stripVirtualKeys = (record: Record<string, number>) => {
      const next: Record<string, number> = {}
      for (const [key, value] of Object.entries(record)) {
        if (key.startsWith(VIRTUAL_GLOBAL_SOURCE) || key.startsWith(VIRTUAL_GLOBAL_TARGET)) continue
        const originalId = namespaceAlias.get(key) ?? key
        next[originalId] = (next[originalId] ?? 0) + value
      }
      return next
    }

    try {
      const response = await fetch('http://localhost:8000/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const result = await response.json() as CalculateResponse

      if (result.status === 'success') {
        const nodeResults = result.node_results ?? {}
        const nextSystemInputs = stripVirtualKeys(result.system_inputs ?? {})
        const nextSystemOutputs = stripVirtualKeys(result.system_outputs ?? {})

        setNodes((prev) => prev.map((node) => {
          let nextData = node.data
          const directNodeResult = nodeResults[node.id]
          const recipeId = typeof node.data?.recipe_id === 'string' ? node.data.recipe_id : null
          const nodeResult = directNodeResult ?? (recipeId ? nodeResults[recipeId] : undefined)

          if (nodeResult) nextData = { ...nextData, ...nodeResult }

          if (node.type === 'sourceNode') {
            const isAuto = resolveIsAuto(nextData)
            nextData = {
              ...nextData,
              is_auto: isAuto,
              actual_amount: typeof directNodeResult?.actual_amount === 'number'
                ? directNodeResult.actual_amount
                : nextSystemInputs[nextData.id],
            }
          }

          if (node.type === 'targetNode') {
            const isAuto = resolveIsAuto(nextData)
            nextData = {
              ...nextData,
              is_auto: isAuto,
              actual_amount: typeof directNodeResult?.actual_amount === 'number'
                ? directNodeResult.actual_amount
                : nextSystemOutputs[nextData.id],
            }
          }

          if (node.type === 'recipeNode') {
            nextData = { ...nextData, is_auto: resolveIsAuto(nextData) }
          }

          if (nextData === node.data) return node
          return { ...node, data: nextData }
        }))

        setSystemInputs(nextSystemInputs)
        setSystemOutputs(nextSystemOutputs)
        setLastSystemInputs(nextSystemInputs)
        setLastSystemOutputs(nextSystemOutputs)
      } else if (result.status === 'unbounded') {
        setSystemInputs({})
        setSystemOutputs({})
        setGlobalInputIds([])
        setGlobalOutputIds([])
        alert('⚠️ 产线无界：发现"最大化产出"节点，但产线缺乏物理瓶颈。请为任意上游配方节点或输入源设定"产能上限"！')
      } else if (result.status === 'infeasible') {
        setSystemInputs({})
        setSystemOutputs({})
        setGlobalInputIds([])
        setGlobalOutputIds([])
        alert('产线无解，请检查是否有冲突的边界条件或缺少输入源')
      } else {
        setSystemInputs({})
        setSystemOutputs({})
        setGlobalInputIds([])
        setGlobalOutputIds([])
        alert('计算失败，请稍后再试')
      }
    } catch (error) {
      console.error('calculate failed', error)
      setSystemInputs({})
      setSystemOutputs({})
      setGlobalInputIds([])
      setGlobalOutputIds([])
      alert('无法连接后端，请确认服务已启动')
    }
  }, [nodesRef, edgesRef, setNodes])

  return {
    systemInputs,
    systemOutputs,
    lastSystemInputs,
    lastSystemOutputs,
    setSystemInputs,
    setSystemOutputs,
    setLastSystemInputs,
    setLastSystemOutputs,
    globalInputIds,
    globalOutputIds,
    resetSystemStats,
    handleCalculate,
  }
}
