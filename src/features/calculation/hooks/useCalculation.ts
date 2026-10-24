import { runNetworkDiagnostics, explainActiveLimits } from '../diagnostics'
import type { LPRequest } from '@/common/types/lp'
import { useCallback, useEffect, useRef } from 'react'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { generateId } from '@/common/utils/id'
import { readCalculationResponse } from '../calculationClient'
import { compileNetwork } from '../networkCompiler'
import { mapCalculationResult } from '../calculationResult'
import { calculationDocumentKey, CalculationSession } from '../calculationSession'

/**
 * Compile one snapshot, cancel obsolete work, and apply only matching verified results.
 * @returns Calculation commands and current presentation values.
 */
export function useCalculation() {
  const session = useRef(new CalculationSession())
  const systemInputs = useCanvasStore(s => s.systemInputs)
  const systemOutputs = useCanvasStore(s => s.systemOutputs)
  const lastSystemInputs = useCanvasStore(s => s.lastSystemInputs)
  const lastSystemOutputs = useCanvasStore(s => s.lastSystemOutputs)
  const globalInputIds = useCanvasStore(s => s.globalInputIds)
  const globalOutputIds = useCanvasStore(s => s.globalOutputIds)
  const capexList = useCanvasStore(s => s.capexList)
  const error = useCanvasStore(s => s.error)
  const capture = useCallback(() => {
    const canvas = useCanvasStore.getState()
    return calculationDocumentKey(canvas.nodes, canvas.edges, useRecipeStore.getState().recipes, canvas.networkConfiguration, useSettingsStore.getState().units)
  }, [])
  useEffect(() => {
    const activeSession = session.current
    let key = capture()
    const changed = () => {
      const next = capture()
      if (key === next) return
      key = next
      activeSession.invalidate()
      useCanvasStore.getState().invalidateCalculation()
    }
    const dispose = [useCanvasStore.subscribe(changed), useRecipeStore.subscribe(changed), useSettingsStore.subscribe(changed)]
    return () => { dispose.forEach(unsubscribe => unsubscribe()); activeSession.invalidate() }
  }, [capture])
  const resetSystemStats = useCallback(() => { session.current.invalidate(); useCanvasStore.getState().resetCalculationState() }, [])
  const handleCalculate = useCallback(async () => {
    const started = performance.now()
    const deadline = started + 10000
    const requestId = generateId()
    let activeRequestId = requestId
    const backendUrl = import.meta.env.VITE_BACKEND_URL || `http://${window.location.hostname}:7998`
    const pending = session.current.begin(() => { void fetch(`${backendUrl}/api/calculate/${encodeURIComponent(activeRequestId)}`, { method: 'DELETE' }).catch(() => undefined) })
    const canvas = useCanvasStore.getState()
    canvas.beginCalculation()
    const revision = useCanvasStore.getState().documentRevision
    const key = capture()
    try {
      const snapshot = { recipes: useRecipeStore.getState().recipes, configuration: canvas.networkConfiguration, environment: useSettingsStore.getState().units }
      const model = compileNetwork({ nodes: canvas.nodes, edges: canvas.edges, ...snapshot, requestId, documentRevision: revision })
      const evidence = canvas.captureResultEvidence(model)
      const isCurrent = () => pending.isCurrent() && capture() === key && useCanvasStore.getState().documentRevision === revision
      const solve = async (request: LPRequest) => {
        const remaining = deadline - performance.now()
        if (remaining <= 0) throw new Error('请求总预算已用尽，尚未取得已验证方案。')
        const submitted = { ...request, solver_options: { time_limit_ms: Math.min(request.solver_options.time_limit_ms, remaining) } }
        const signal = AbortSignal.any([pending.signal, AbortSignal.timeout(Math.ceil(remaining))])
        activeRequestId = request.request_id
        const response = await fetch(`${backendUrl}/api/calculate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submitted), signal })
        return readCalculationResponse(response, request)
      }
      const result = await solve(model.request)
      if (!isCurrent()) return
      useCanvasStore.getState().setCalculationResult(mapCalculationResult(model, result), evidence)
      useCanvasStore.getState().setActiveLimits(explainActiveLimits(model, result))
      if (result.status === 'infeasible') {
        const report = await runNetworkDiagnostics(model, result, { deadline, requestId: generateId(), solve, isCurrent })
        if (isCurrent() && report.status !== 'stale') useCanvasStore.getState().setDiagnosticReport(report)
      }
    } catch (failure) {
      if (!pending.isCurrent() || capture() !== key) return
      const message = failure instanceof Error ? failure.message : String(failure)
      const addresses = message.match(/\["(?:[^"\\]|\\.)*","(?:[^"\\]|\\.)*"\]/g) ?? []
      useCanvasStore.getState().setCalculationResult({ status: performance.now() >= deadline ? 'limit_reached' : 'solver_error', message: performance.now() >= deadline ? '请求总预算已用尽，尚未取得已验证方案。' : message, errors: addresses.map(address => ({ node_id: JSON.parse(address)[0] as string, path: [address], code: 'compile_error', message })) })
    }
  }, [capture])
  return { systemInputs, systemOutputs, lastSystemInputs, lastSystemOutputs, globalInputIds, globalOutputIds, capexList, error, resetSystemStats, handleCalculate }
}
