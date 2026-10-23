import { benchmarkBrowser } from './browser-benchmark'
import { useState } from 'react'
import App from '../../src/App'
import { readCanvasDocument } from '../../src/features/file-io/canvasDocument'
import { useCanvasStore } from '../../src/features/canvas/canvas.store'
import { useRecipeStore } from '../../src/features/recipe/recipe.store'
import { useSettingsStore } from '../../src/features/settings/settings.store'
import { useGlobalResourceTable } from '../../src/features/resource-registry/registry.store'
import 'reactflow/dist/style.css'
import '../../src/index.css'

/** Test-only loader mounts the real application and validates saved fixture documents. */
export default function ValidationHarness() {
  const [name, setName] = useState('baseline')
  const [status, setStatus] = useState('Choose a saved fixture; all calculation controls below are the real app.')
  const [benchmark, setBenchmark] = useState('')
  const runBenchmark = async () => {
    setStatus('Benchmark running')
    const result = await benchmarkBrowser(input => {
      useRecipeStore.getState().loadAll(input.recipes)
      const store = useCanvasStore.getState()
      store.setNetworkConfiguration(input.configuration!)
      store.setNodes(input.nodes)
      store.setEdges(input.edges)
    })
    setBenchmark(JSON.stringify(result))
    setStatus('Benchmark complete')
  }
  const load = async () => {
    try {
      const response = await fetch(new URL(`../../fixtures/canvas/${name}.json`, import.meta.url))
      if (!response.ok) throw new Error(`Fixture load failed: ${response.status}`)
      const { document } = readCanvasDocument(await response.json())
      useRecipeStore.setState({ recipes: {} })
      useSettingsStore.getState().setEnvironment(document.environment)
      useGlobalResourceTable.getState().restore(document.registry)
      useRecipeStore.getState().loadAll(document.domain.recipes)
      const store = useCanvasStore.getState()
      store.resetCalculationState()
      store.setNetworkConfiguration(document.networkConfiguration)
      store.setNodes(document.ui.nodes)
      store.setEdges(document.ui.edges)
      setStatus('Loaded ' + name + ' through v5 validation')
    } catch (error) { setStatus(String(error)) }
  }
  return <><App /><aside style={{ position: 'fixed', bottom: 12, left: 12, zIndex: 50, maxWidth: 500, background: '#fff', color: '#111', border: '2px solid #334155', padding: 8 }}>
    <details open><summary>验证工具</summary><label>Validation fixture <select value={name} onChange={event => setName(event.target.value)}>{['baseline','fractional','unconnected-input','shortage','waste','splitter','splitter-blocked','splitter-spill','splitter-capacity','splitter-zero'].map(item => <option key={item}>{item}</option>)}</select></label>
    <button onClick={load}>Load validation fixture</button><button onClick={runBenchmark}>Run browser benchmark</button><details><summary>Benchmark raw JSON</summary><pre data-testid="benchmark-results" style={{ maxHeight: 150, overflow: 'auto' }}>{benchmark}</pre></details><p role="status">{status}</p>
  </details></aside></>
}
