import { benchmarkBrowser, benchmarkDisplayModes, recordDisplayCommit } from './browser-benchmark'
import { Profiler, useState } from 'react'
import App from '../../src/App'
import { readCanvasDocument } from '../../src/features/file-io/canvasDocument'
import { useCanvasStore } from '../../src/features/canvas/canvas.store'
import { useRecipeStore } from '../../src/features/recipe/recipe.store'
import { useNodeDisplayStore } from '../../src/features/settings/nodeDisplay.store'
import { replaceDocument } from '../../src/features/file-io/replaceDocument'
import { createHistory } from '../../src/common/utils/history'
import { captureSnapshot, restoreSnapshot } from '../../src/features/canvas/hooks/useUndoRedo'
import 'reactflow/dist/style.css'
import '../../src/index.css'

/** Test-only loader mounts the real application and validates saved fixture documents. */
export default function ValidationHarness() {
  const [name, setName] = useState('baseline')
  const [status, setStatus] = useState('Choose a saved fixture; all calculation controls below are the real app.')
  const [benchmark, setBenchmark] = useState('')
  const [displayBenchmark, setDisplayBenchmark] = useState('')
  const [displayBenchmarkRunning, setDisplayBenchmarkRunning] = useState(false)
  const runDisplayBenchmark = async () => {
    setDisplayBenchmarkRunning(true)
    setStatus('Display benchmark running')
    try {
      setDisplayBenchmark(JSON.stringify(await benchmarkDisplayModes()))
      setStatus('Display benchmark complete')
    } catch (error) { setStatus(String(error)) }
    finally { setDisplayBenchmarkRunning(false) }
  }
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
      const store = useCanvasStore.getState()
      const transaction = createHistory({
        capture: () => captureSnapshot(useCanvasStore.getState().nodes, useCanvasStore.getState().edges),
        restore: snapshot => { restoreSnapshot(snapshot); store.setNodes(snapshot.nodes); store.setEdges(snapshot.edges) },
      })
      transaction.commit(() => replaceDocument(document, { setNodes: store.setNodes, setEdges: store.setEdges,
        normalizeCanvasNode: node => node, resetSystemStats: store.resetCalculationState }))
      useNodeDisplayStore.getState().restoreMode(document.ui.nodeDisplayMode)
      setStatus('Loaded ' + name + ' through v5 validation')
    } catch (error) { setStatus(String(error)) }
  }
  return <><Profiler id="app" onRender={recordDisplayCommit}><App /></Profiler><aside style={{ position: 'fixed', bottom: 12, left: 12, zIndex: 50, maxWidth: 500, background: '#fff', color: '#111', border: '2px solid #334155', padding: 8 }}>
    <details open><summary>验证工具</summary><label>Validation fixture <select value={name} onChange={event => setName(event.target.value)}>{['baseline','display-stress','display-endpoint-capacity','fractional','unconnected-input','shortage','waste','splitter','splitter-blocked','splitter-spill','splitter-capacity','splitter-zero'].map(item => <option key={item}>{item}</option>)}</select></label>
    <button disabled={displayBenchmarkRunning} onClick={load}>Load validation fixture</button><button disabled={displayBenchmarkRunning} onClick={runBenchmark}>Run browser benchmark</button><button disabled={displayBenchmarkRunning} onClick={runDisplayBenchmark}>Benchmark display modes</button><details><summary>Benchmark raw JSON</summary><pre data-testid="benchmark-results" style={{ maxHeight: 150, overflow: 'auto' }}>{benchmark}</pre></details><details><summary>Display benchmark JSON</summary><pre data-testid="display-benchmark-results" style={{ maxHeight: 150, overflow: 'auto' }}>{displayBenchmark}</pre></details><p role="status">{status}</p>
  </details></aside></>
}
