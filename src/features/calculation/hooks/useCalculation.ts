import { useCallback } from 'react'
import type { CalculateResponse } from '@/common/types/api'
import { buildCalculationPayload } from '../payloadBuilder'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useCanvasStore } from '@/features/canvas/canvas.store'

export function useCalculation() {
  const systemInputs = useCanvasStore((s) => s.systemInputs)
  const systemOutputs = useCanvasStore((s) => s.systemOutputs)
  const lastSystemInputs = useCanvasStore((s) => s.lastSystemInputs)
  const lastSystemOutputs = useCanvasStore((s) => s.lastSystemOutputs)
  const globalInputIds = useCanvasStore((s) => s.globalInputIds)
  const globalOutputIds = useCanvasStore((s) => s.globalOutputIds)
  const capexList = useCanvasStore((s) => s.capexList)
  const error = useCanvasStore((s) => s.error)

  const resetSystemStats = useCallback(() => {
    useCanvasStore.getState().resetCalculationState()
  }, [])

  const handleCalculate = useCallback(async () => {
    const nodes = useCanvasStore.getState().nodes
    const edges = useCanvasStore.getState().edges
    const recipeStore = useRecipeStore.getState().recipes

    const result = buildCalculationPayload(nodes, edges, recipeStore)

    if (result.zeroOutputNodeNames.length > 0) {
      const names = result.zeroOutputNodeNames.join(' / ')
      useCanvasStore.getState().setError(`Outputs of these recipe nodes are all zero:\n${names}\n(Set valid outputs or fix machine parameters.)`)
      return
    }

    const payload = {
      nodes: result.payloadNodes,
      edges: result.payloadEdges,
    }

    const canvasStore = useCanvasStore.getState()
    canvasStore.setGlobalInputIds(Array.from(result.globalInputSet))
    canvasStore.setGlobalOutputIds(Array.from(result.globalOutputSet))

    const backendUrl = import.meta.env.VITE_BACKEND_URL || `http://${window.location.hostname}:7998`
    const apiUrl = `${backendUrl}/api/calculate`

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
      const data = await response.json() as CalculateResponse
      console.log('Calculation result:', data)
      canvasStore.setCalculationResult(data)
    } catch (err) {
      console.error('calculate failed', err)
      canvasStore.setError(`Cannot connect to backend: ${err instanceof Error ? err.message : 'Unknown error'}\nPlease confirm the backend is running at http://localhost:8000`)
    }
  }, [])

  return {
    systemInputs,
    systemOutputs,
    lastSystemInputs,
    lastSystemOutputs,
    globalInputIds,
    globalOutputIds,
    capexList,
    error,
    resetSystemStats,
    handleCalculate,
  }
}
