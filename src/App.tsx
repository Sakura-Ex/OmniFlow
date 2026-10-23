import { useTranslation } from '@/common/i18n'
import { DocumentEditProvider } from '@/common/components/DocumentEditContext'
import { useDocumentSession } from '@/app/document/useDocumentSession'
import { translateDiagnostic } from '@/common/i18n/translateDiagnostic'
import { Icon } from '@/common/components/Icon'
import { PlanningEditorProvider, BoundaryCommitProvider, BoundaryBatchCommitProvider } from '@/features/calculation/contexts/PlanningEditorContext'
import { replaceEndpointBoundaries } from '@/features/calculation/endpointBoundary'
import type { Boundary } from '@/features/calculation/networkConfig'
import { DiagnosticsPanel } from '@/features/calculation/components/DiagnosticsPanel'
import { NetworkConfigurationEditor } from '@/features/calculation/components/NetworkConfigurationEditor'
import { GraphIssuesPanel } from '@/features/canvas/components/GraphIssuesPanel'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ControlButton,
  useReactFlow,
  useStore,
  useUpdateNodeInternals,
  type ReactFlowInstance,
  type Node as RFNode,
  type Edge as RFEdge,
} from 'reactflow'
import { nodeTypes, edgeTypes } from '@/features/canvas/canvas.flowConfig'
import { RecipeEditorModal } from '@/features/recipe/components/RecipeEditorModal'
import { EndpointEditorModal } from '@/features/endpoint/components/EndpointEditorModal'
import { SystemHUD } from '@/features/canvas/components/SystemHUD'
import { RecipeEditorProvider } from '@/features/recipe/contexts/RecipeEditorContext'
import { EndpointEditorProvider } from '@/features/canvas/contexts/EndpointEditorContext'
import { NodeDataProvider } from '@/features/canvas/contexts/NodeDataContext'
import { useCanvasState } from '@/features/canvas/hooks/useCanvasState'
import { useUndoRedo } from '@/features/canvas/hooks/useUndoRedo'
import { useTheme } from '@/hooks/useTheme'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useCanvasOperations } from '@/features/canvas/hooks/useCanvasOperations'
import { useClipboard } from '@/features/file-io/hooks/useClipboard'
import { useFileIO } from '@/features/file-io/hooks/useFileIO'
import { useKeyboardShortcuts } from '@/features/canvas/hooks/useKeyboardShortcuts'
import { useNodeEditor } from '@/features/recipe/hooks/useNodeEditor'
import { useCalculation } from '@/features/calculation/hooks/useCalculation'
import { useNodeOperations } from '@/features/recipe/hooks/useNodeOperations'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import type { RecipeNodeData } from '@/common/types/recipe'
import { MenuBar } from '@/app/components/MenuBar'
import { SettingsPage } from '@/app/components/SettingsPage'
import { ShortcutHelp } from '@/app/components/ShortcutHelp'
import { initialNodes, initialEdges, initialConfiguration, initialEnvironment } from '@/features/canvas/canvas.initialState'
import { normalizeCanvasNode } from '@/features/canvas/canvas.validators'
import './App.css'

const defaultEdgeOptions = {
  type: 'default',
  style: { stroke: 'var(--edge-default)', strokeWidth: 2 },
  interactionWidth: 20,
}
const fitViewOptions = { padding: 0.2 }
const proOptions = { hideAttribution: true }
const STORAGE_KEY = 'omniflow.canvas.v1'

/** Localize v11 controls while preserving ReactFlow zoom-limit behavior.
 * @returns Canvas controls subscribed to the current viewport and UI language.
 */
function LocalizedFlowControls() {
  const { t } = useTranslation()
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const minZoomReached = useStore(state => state.transform[2] <= state.minZoom)
  const maxZoomReached = useStore(state => state.transform[2] >= state.maxZoom)
  return <Controls position="bottom-right" showZoom={false} showFitView={false} showInteractive={false}>
    <ControlButton className="react-flow__controls-zoomin" title={t('shell.zoomIn')} aria-label={t('shell.zoomIn')} disabled={maxZoomReached} onClick={() => { void zoomIn() }}><Icon name="plus" /></ControlButton>
    <ControlButton className="react-flow__controls-zoomout" title={t('shell.zoomOut')} aria-label={t('shell.zoomOut')} disabled={minZoomReached} onClick={() => { void zoomOut() }}><Icon name="minus" /></ControlButton>
    <ControlButton className="react-flow__controls-fitview" title={t('action.fitView')} aria-label={t('action.fitView')} onClick={() => { void fitView() }}><Icon name="fitView" /></ControlButton>
  </Controls>
}

/**
 * Bridge component that exposes the ReactFlow `updateNodeInternals` function
 * via a callback so parent components can invoke it imperatively.
 *
 * @param _ - Component props.
 * @param _.onReady - Callback receiving the `updateNodeInternals` function.
 * @returns A null render.
 */
function UpdateInternalsBridge({ onReady }: { onReady: (fn: (nodeId: string) => void) => void }) {
  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => {
    onReady(updateNodeInternals)
  }, [updateNodeInternals, onReady])
  return null
}

/**
 * Root application component.
 * Renders the ReactFlow canvas, menu bar, system HUD, modals (recipe editor / endpoint editor),
 * and wires up all state management, keyboard shortcuts, undo/redo, clipboard, file I/O,
 * and calculation logic.
 *
 * @returns Rendered JSX element for the entire application shell.
 */
export default function App() {
  const { t } = useTranslation()
  const {
    nodes,
    setNodes: _setNodes,
    onNodesChange,
    edges,
    setEdges: _setEdges,
    onEdgesChange,
    nodesRef,
    edgesRef,
  } = useCanvasState(initialNodes, initialEdges, initialConfiguration, initialEnvironment)
  const setNodes = useCallback((value: RFNode[]) => _setNodes(value), [_setNodes])
  const setEdges = useCallback((value: RFEdge[]) => _setEdges(value), [_setEdges])
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showResults, setShowResults] = useState(true)
  const calculationStatus = useCanvasStore(state => state.calculationStatus)
  const isDirty = useCanvasStore(state => state.isDirty)
  const { theme, toggleTheme } = useTheme()
  const [showNetworkConfiguration, setShowNetworkConfiguration] = useState(false)
  const [planningNodeId, setPlanningNodeId] = useState<string | undefined>()
  const openPlanning = useCallback((nodeId?: string) => { setPlanningNodeId(nodeId); setShowNetworkConfiguration(true) }, [])
  const [showSettings, setShowSettings] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const reactFlowRef = useRef<ReactFlowInstance | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const updateNodeInternalsRef = useRef<((nodeId: string) => void) | null>(null)
  const updateNodeInternals = useCallback((nodeId: string) => {
    updateNodeInternalsRef.current?.(nodeId)
  }, [])

  const { takeSnapshot, commitEdit, clearHistory, undo, redo, canUndo, canRedo } = useUndoRedo({ setNodes, setEdges })
  const commitBoundaries = useCallback((nodeId: string, boundaries: Record<string, Boundary>) => {
    const canvas = useCanvasStore.getState()
    if (!canvas.nodes.some(node => node.id === nodeId)) return
    const next = replaceEndpointBoundaries(canvas.networkConfiguration, nodeId, boundaries)
    if (JSON.stringify(next) === JSON.stringify(canvas.networkConfiguration)) return
    takeSnapshot()
    canvas.setNetworkConfiguration(next)
  }, [takeSnapshot])

  const commitBoundary = useCallback((nodeId: string, portId: string, boundary: Boundary) => {
    commitBoundaries(nodeId, { [portId]: boundary })
  }, [commitBoundaries])

  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current) return
    const store = useRecipeStore.getState()
    const needsSeed = nodesRef.current.some(
      (n) => n.type === 'recipeNode' && !store.recipes[n.id]
    )
    if (!needsSeed) {
      seededRef.current = true
      return
    }
    const trimmed = nodesRef.current.map((node) => {
      if (node.type === 'recipeNode') {
        const data = node.data as RecipeNodeData
        store.setRecipe(node.id, data)
        return { ...node, data: { type: 'recipeNode', label: data.machine_name ?? '' } }
      }
      return node
    })
    setNodes(trimmed)
    seededRef.current = true
  }, [nodesRef, setNodes])

  const {
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
  } = useCalculation()

  const starterCalculation = useRef(false)
  useEffect(() => {
    if (starterCalculation.current) return
    const timer = window.setTimeout(() => {
      starterCalculation.current = true
      if (useCanvasStore.getState().canvasId !== null) return
      void handleCalculate()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [handleCalculate])

  const getViewportCenter = useCallback((): { x: number; y: number } => {
    const instance = reactFlowRef.current
    if (!instance) return { x: 300, y: 200 }
    const container = document.querySelector('.react-flow') as HTMLElement | null
    if (!container) return { x: 300, y: 200 }
    const rect = container.getBoundingClientRect()
    return instance.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
  }, [])

  const {
    isValidConnection,
    onConnect,
    onEdgeDoubleClick,
    handleAddSource, handleAddSplitter,
    handleAddFurnace,
    handleAddCustomRecipe,
    handleAddTarget,
    handleClear,
    handleDeleteSelected,
    handleDeleteSelectedEdges,
    handleDeleteSelectedNodes,
    handleSelectAll,
    handleClearSelection,
  } = useCanvasOperations({
    setNodes,
    setEdges,
    takeSnapshot,
    getViewportCenter,
  })

  const backgroundDotColor = 'var(--canvas-dot)'

  const { handleCopy, handlePaste, handleCut, handleDuplicate } = useClipboard({
    nodesRef,
    edgesRef,
    setNodes: _setNodes,
    setEdges: _setEdges,
    takeSnapshot,
    onDeleteSelected: handleDeleteSelected,
  })

  const {
    editingNode,
    handleEditNode,
    handleCloseEditor,
    handleSaveEditor,
    editingEndpoint,
    handleEditEndpoint,
    handleCloseEndpointEditor,
    handleSaveEndpoint,
  } = useNodeEditor({ setNodes, takeSnapshot, updateNodeInternals })

  const { updateNodeData, autoFillEndpoints, handleAutoFillSelected } = useNodeOperations({
    nodesRef,
    edgesRef,
    setNodes: _setNodes,
    setEdges: _setEdges,
    takeSnapshot,
    lastSystemInputs,
    lastSystemOutputs,
  })

  const { markSaved, confirmReplace } = useDocumentSession()
  const onLoaded = useCallback((snapshot: Parameters<typeof markSaved>[0]) => {
    markSaved(snapshot)
    clearHistory()
  }, [markSaved, clearHistory])
  const {
    handleSaveCanvas,
    handleLoadCanvas,
    handleExportJson,
    handleImportClick,
    handleImportJson,
  } = useFileIO({
    storageKey: STORAGE_KEY,
    fileInputRef,
    nodesRef,
    edgesRef,
    setNodes,
    setEdges,
    commitEdit, confirmReplace, onLoaded, onSaved: markSaved,
    normalizeCanvasNode,
    resetSystemStats,
  })

  useKeyboardShortcuts({
    takeSnapshot,
    undo,
    redo,
    handleSelectAll,
    handleClearSelection,
    handleCopy,
    handleCut,
    handlePaste,
    handleDuplicate,
    onDelete: handleDeleteSelected,
    isEditing: editingNode !== null || editingEndpoint !== null || showSettings || showNetworkConfiguration || showShortcuts || openMenu !== null,
  })

  const handleFitView = useCallback(() => {
    reactFlowRef.current?.fitView({ padding: 0.2 })
  }, [])

  const handleMenuAction = useCallback((action: () => void) => {
    action()
    setOpenMenu(null)
  }, [])

  const handleCloseMenus = useCallback(() => {
    setOpenMenu(null)
  }, [])

  useClickOutside(menuRef, () => setOpenMenu(null))

  const diagnosticReport = useCanvasStore(state => state.diagnosticReport)
  const activeLimits = useCanvasStore(state => state.activeLimits)
  const locateDiagnostic = (nodeIds: string[]) => {
    const ids = new Set(nodeIds)
    const canvas = useCanvasStore.getState()
    canvas.setNodes(canvas.nodes.map(node => ({ ...node, selected: ids.has(node.id) })))
    void reactFlowRef.current?.fitView({ nodes: canvas.nodes.filter(node => ids.has(node.id)), padding: 0.5 })
  }
  const calculationIssues = useCanvasStore(state => state.calculationIssues)

  const dismissError = useCallback(() => {
    useCanvasStore.getState().setError(null)
  }, [])

  return (
    <DocumentEditProvider value={commitEdit}>
    <main className="app-shell" data-theme={theme}>
      <section className="canvas-shell">
        <RecipeEditorModal
          key={editingNode?.id ?? 'editor-closed'}
          node={editingNode}
          onClose={handleCloseEditor}
          onSave={handleSaveEditor}
        />
        <EndpointEditorModal
          key={editingEndpoint?.id ?? 'endpoint-closed'}
          node={editingEndpoint}
          onClose={handleCloseEndpointEditor}
          onSave={handleSaveEndpoint}
        />
        {showSettings && <SettingsPage theme={theme} toggleTheme={toggleTheme} takeSnapshot={takeSnapshot} onClose={() => setShowSettings(false)} />}

        {error && (
          <div className="toast-error" onClick={dismissError}>
              <span className="toast-error__icon"><Icon name="warning" size={18} /></span>
            {translateDiagnostic(error)}
            {calculationIssues.map((issue, index) => <button key={index} onClick={event => {
              event.stopPropagation()
              const ids = new Set(issue.node_id ? [issue.node_id] : issue.path.flatMap(path => { try { const address: unknown = JSON.parse(String(path)); return Array.isArray(address) && typeof address[0] === 'string' ? [address[0]] : [] } catch { return [] } }))
              const canvas = useCanvasStore.getState()
              canvas.setNodes(canvas.nodes.map(node => ({ ...node, selected: ids.has(node.id) })))
              void reactFlowRef.current?.fitView({ nodes: canvas.nodes.filter(node => ids.has(node.id)), padding: 0.5 })
            }}>{t('shell.locate')} {issue.path.join(' / ')}</button>)}
          </div>
        )}

        {showNetworkConfiguration && <NetworkConfigurationEditor nodeId={planningNodeId} onClose={() => setShowNetworkConfiguration(false)} takeSnapshot={takeSnapshot} />}
        <GraphIssuesPanel />
        <DiagnosticsPanel report={diagnosticReport} limits={activeLimits} onLocate={locateDiagnostic} />
        {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}
        {showResults && <SystemHUD
          systemInputs={systemInputs}
          systemOutputs={systemOutputs}
          globalInputIds={globalInputIds}
          globalOutputIds={globalOutputIds}
          capexList={capexList}
        />}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleImportJson}
          style={{ display: 'none' }}
        />
        <MenuBar
          isDirty={isDirty}
          canUndo={canUndo}
          canRedo={canRedo}
          hasCanvasContent={nodes.length > 0}
          hasSelection={nodes.some(node => node.selected) || edges.some(edge => edge.selected)}
          hasSelectedNodes={nodes.some(node => node.selected)}
          hasSelectedEdges={edges.some(edge => edge.selected)}
          hasSelectedRecipes={nodes.some(node => node.selected && node.type === 'recipeNode')}
          isCalculating={calculationStatus === 'running'}
          status={{ kind: calculationStatus }}
          showResults={showResults}
          onToggleResults={() => setShowResults(value => !value)}
          onOpenShortcuts={() => setShowShortcuts(true)}
          handleInvertSelection={() => {
            setNodes(nodes.map(node => ({ ...node, selected: !node.selected })))
            setEdges(edges.map(edge => ({ ...edge, selected: !edge.selected })))
          }}
          handleFocusSelection={() => {
            const selected = new Set(nodes.filter(node => node.selected).map(node => node.id))
            edges.filter(edge => edge.selected).forEach(edge => { selected.add(edge.source); selected.add(edge.target) })
            void reactFlowRef.current?.fitView({ nodes: nodes.filter(node => selected.has(node.id)), padding: 0.3 })
          }}
          handleZoom100={() => { void reactFlowRef.current?.zoomTo(1) }}
          menuRef={menuRef}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          handleMenuAction={handleMenuAction}
          handleSaveCanvas={handleSaveCanvas}
          handleLoadCanvas={handleLoadCanvas}
          handleExportJson={handleExportJson}
          handleImportClick={handleImportClick}
          undo={undo}
          redo={redo}
          handleCopy={handleCopy}
          handleCut={handleCut}
          handlePaste={handlePaste}
          handleDuplicate={handleDuplicate}
          handleSelectAll={handleSelectAll}
          handleClearSelection={handleClearSelection}
          handleDeleteSelected={handleDeleteSelected}
          handleDeleteSelectedNodes={handleDeleteSelectedNodes}
          handleDeleteSelectedEdges={handleDeleteSelectedEdges}
          handleClear={() => { if (confirmReplace()) handleClear() }}
          handleAddSplitter={handleAddSplitter}
          handleAddSource={handleAddSource}
          handleAddFurnace={handleAddFurnace}
          handleAddTarget={handleAddTarget}
          handleAddCustomRecipe={handleAddCustomRecipe}
          handleAutoFillSelected={handleAutoFillSelected}
          handleFitView={handleFitView}
          handleCalculate={handleCalculate}
          onOpenSettings={() => setShowSettings(true)}
        />

        <PlanningEditorProvider value={openPlanning}>
        <BoundaryCommitProvider value={commitBoundary}>
        <BoundaryBatchCommitProvider value={commitBoundaries}>
        <RecipeEditorProvider value={{ onEdit: handleEditNode, onAutoFill: autoFillEndpoints }}>
          <EndpointEditorProvider value={{ onEdit: handleEditEndpoint }}>
          <NodeDataProvider value={{ updateNodeData }}>
            <ReactFlow
              deleteKeyCode={null}
              nodes={nodes}
              edges={edges.map(edge => ({ ...edge, ariaLabel: edge.ariaLabel ?? t('shell.edgeFromTo', { source: edge.source, target: edge.target }) }))}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              minZoom={0.08}
              maxZoom={1.35}
              onNodeDragStart={takeSnapshot}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              onEdgeDoubleClick={onEdgeDoubleClick}
              onPaneClick={handleCloseMenus}
              onNodeClick={handleCloseMenus}
              defaultEdgeOptions={defaultEdgeOptions}
              connectionLineStyle={{ stroke: 'var(--edge-default)', strokeWidth: 2 }}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onInit={(instance) => {
                reactFlowRef.current = instance
              }}
              fitView
              fitViewOptions={fitViewOptions}
              proOptions={proOptions}
            >
              <UpdateInternalsBridge onReady={(fn) => { updateNodeInternalsRef.current = fn }} />
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={backgroundDotColor} />
              <LocalizedFlowControls />
            </ReactFlow>
          </NodeDataProvider>
          </EndpointEditorProvider>
        </RecipeEditorProvider>
        </BoundaryBatchCommitProvider>
        </BoundaryCommitProvider>
        </PlanningEditorProvider>
      </section>
    </main>
    </DocumentEditProvider>
  )
}
