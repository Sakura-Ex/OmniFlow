import { compilerFixture } from '../../fixtures/compiler/cases'
import { compileNetwork } from '../../src/features/calculation/networkCompiler'
import { portKey } from '../../src/features/calculation/topology'
import type { NetworkCompileInput } from '../../src/features/calculation/networkCompiler'
import type { ProfilerOnRenderCallback } from 'react'
import { useNodeDisplayStore } from '../../src/features/settings/nodeDisplay.store'
import { useCanvasStore } from '../../src/features/canvas/canvas.store'
import { NODE_DISPLAY_MODES } from '../../src/common/types/nodeDisplay'

let displayCommits: number[] | null = null

/** Record React work only while a display-mode sample is active. */
export const recordDisplayCommit: ProfilerOnRenderCallback = (_id, _phase, duration) => {
  displayCommits?.push(duration)
}

/** Measure mode switches on the currently loaded graph, including deferred handle updates.
 * @returns Per-transition wall time, React render time and commit count; not GPU completion.
 */
export async function benchmarkDisplayModes() {
  const original = useNodeDisplayStore.getState().mode
  const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  const settle = async () => { for (let i = 0; i < 4; i++) await frame() }
  const samples = []
  try {
    for (let round = -1; round < 5; round++) {
      for (const mode of NODE_DISPLAY_MODES) {
        if (useNodeDisplayStore.getState().mode === mode) continue
        displayCommits = []
        let nodeWrites = 0
        const unsubscribe = useCanvasStore.subscribe((next, previous) => { if (next.nodes !== previous.nodes) nodeWrites++ })
        const start = performance.now()
        try {
          useNodeDisplayStore.getState().selectMode(mode)
          await settle()
          if (round >= 0) samples.push({ mode, elapsedMs: performance.now() - start, reactMs: displayCommits.reduce((a, b) => a + b, 0), commits: displayCommits.length, nodeWrites })
        } finally { unsubscribe() }
        displayCommits = null
      }
    }
  } finally {
    displayCommits = null
    useNodeDisplayStore.getState().selectMode(original)
  }
  return { userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency, nodes: useCanvasStore.getState().nodes.length, edges: useCanvasStore.getState().edges.length, note: 'Development build; one warmup round, five measured rounds. Elapsed time includes four animation frames; React Profiler includes render work, not browser layout/paint or GPU completion. Uses current graph; restores original mode.', samples }
}

/** Fixed linear chains; setup is excluded from compilation timing. */
export function chainFixture(size: number): NetworkCompileInput {
  const input = compilerFixture()
  const recipe = input.recipes.r
  input.nodes = input.nodes.filter(node => node.id !== 'r')
  input.edges = []
  input.recipes = {}
  input.nodes[0].data.ports[0].id = 'material-0'
  input.nodes[1].data.ports[0].id = `material-${size}`
  for (let index = 0; index < size; index++) {
    const id = `r${index}`
    input.nodes.push({ id, type: 'recipeNode', position: { x: index * 320, y: 200 }, data: {} })
    input.recipes[id] = { ...structuredClone(recipe), recipe_id: id, inputs: [{ ...recipe.inputs[0], id: `material-${index}` }], outputs: [{ ...recipe.outputs[0], id: `material-${index + 1}` }] }
    input.edges.push({ id: `e${index}`, source: index ? `r${index - 1}` : 's', sourceHandle: index ? 'out' : 's', target: id, targetHandle: 'in' })
  }
  input.edges.push({ id: 'end', source: `r${size - 1}`, sourceHandle: 'out', target: 't', targetHandle: 't' })
  input.configuration!.ports[portKey('s', 's')].boundary = { kind: 'source', capacity: 10 }
  return input
}

/** Browser CPU measurements use one warmup and twenty independent compilations. */
export async function benchmarkBrowser(apply: (input: NetworkCompileInput) => void) {
  const results = []
  const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  for (const size of [100, 1000, 5000]) {
    const input = chainFixture(size)
    const samples = []
    let bytes = 0
    for (let iteration = -1; iteration < 20; iteration++) {
      await frame()
      const start = performance.now()
      const model = compileNetwork(input)
      const compiled = performance.now()
      const wire = JSON.stringify(model.request)
      const serialized = performance.now()
      bytes = new TextEncoder().encode(wire).byteLength
      let renderMs: number | null = null
      if (size <= 1000) {
        const renderStart = performance.now()
        apply(structuredClone(input))
        await frame()
        renderMs = performance.now() - renderStart
      }
      if (iteration >= 0) samples.push({ compileMs: compiled - start, serializeMs: serialized - compiled, renderCommitAndTwoFramesMs: renderMs })
    }
    results.push({ size, bytes, samples })
  }
  return { userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency, measuredAt: new Date().toISOString(), note: 'Vite development build. Render includes store update, React commit and two animation frames, not GPU completion. All nodes mounted; 5000-node render intentionally omitted. No browser native memory metric available.', results }
}
