import { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  useUpdateNodeInternals,
  type ReactFlowInstance,
} from 'reactflow'
import { nodeTypes, edgeTypes } from './flowConfig'
import { RecipeEditorModal } from './components/RecipeEditorModal'
import { EndpointEditorModal } from './components/EndpointEditorModal'
import { SystemHUD } from './components/SystemHUD'
import { ResourceRegistryPanel } from './components/ResourceRegistryPanel'
import { TpsSettingsPanel } from './components/TpsSettingsPanel'
import { RecipeEditorProvider } from './RecipeEditorContext'
import { EndpointEditorProvider } from './EndpointEditorContext'
import { NodeDataProvider } from './NodeDataContext'
import { useCanvasState } from './hooks/useCanvasState'
import { useUndoRedo } from './hooks/useUndoRedo'
import { useTheme } from './hooks/useTheme'
import { useClickOutside } from './hooks/useClickOutside'
import { useCanvasOperations } from './hooks/useCanvasOperations'
import { useClipboard } from './hooks/useClipboard'
import { useFileIO } from './hooks/useFileIO'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useNodeEditor } from './hooks/useNodeEditor'
import { useCalculation } from './hooks/useCalculation'
import { useNodeOperations } from './hooks/useNodeOperations'
import { useRecipeStore } from './stores/recipeStore'
import { useCanvasStore } from './stores/canvasStore'
import type { RecipeNodeData } from './types/recipe'
import { MenuBar } from './components/MenuBar'
import { initialNodes, initialEdges } from './domain/canvas/initialState'
import { normalizeCanvasNode } from './domain/canvas/validators'
import './App.css'

const defaultEdgeOptions = {
  type: 'default',
  style: { stroke: 'rgba(255, 255, 255, 0.3)', strokeWidth: 2 },
  interactionWidth: 20,
}
const fitViewOptions = { padding: 0.2 }
const proOptions = { hideAttribution: true }
const STORAGE_KEY = 'omniflow.canvas.v1'

function UpdateInternalsBridge({ onReady }: { onReady: (fn: (nodeId: string) => void) => void }) {
  const updateNodeInternals = useUpdateNodeInternals()
  useEffect(() => {
    onReady(updateNodeInternals)
  }, [updateNodeInternals, onReady])
  return null
}

export default function App() {
  const {
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    nodesRef,
    edgesRef,
  } = useCanvasState(initialNodes, initialEdges)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const { theme, toggleTheme } = useTheme()
  const [showRegistry, setShowRegistry] = useState(false)
  const [showTpsSettings, setShowTpsSettings] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const reactFlowRef = useRef<ReactFlowInstance | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const updateNodeInternalsRef = useRef<((nodeId: string) => void) | null>(null)
  const updateNodeInternals = useCallback((nodeId: string) => {
    updateNodeInternalsRef.current?.(nodeId)
  }, [])

  const { takeSnapshot, undo, redo } = useUndoRedo({ nodesRef, edgesRef, setNodes, setEdges })

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

  const {
    isValidConnection,
    onConnect,
    onEdgeDoubleClick,
    handleAddSource,
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
  })

  const backgroundDotColor = theme === 'light' ? 'rgba(71, 85, 105, 0.22)' : 'rgba(148, 163, 184, 0.24)'

  const { handleCopy, handlePaste, handleCut, handleDuplicate } = useClipboard({
    nodesRef,
    edgesRef,
    setNodes,
    setEdges,
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
    setNodes,
    setEdges,
    takeSnapshot,
    lastSystemInputs,
    lastSystemOutputs,
  })

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
    takeSnapshot,
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
    isEditing: editingNode !== null || editingEndpoint !== null,
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

  const dismissError = useCallback(() => {
    useCanvasStore.getState().setError(null)
  }, [])

  return (
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
        {showRegistry && <ResourceRegistryPanel onClose={() => setShowRegistry(false)} />}
        {showTpsSettings && <TpsSettingsPanel onClose={() => setShowTpsSettings(false)} />}

        {error && (
          <div className="toast-error" onClick={dismissError}>
            {error}
          </div>
        )}

        <SystemHUD
          systemInputs={systemInputs}
          systemOutputs={systemOutputs}
          globalInputIds={globalInputIds}
          globalOutputIds={globalOutputIds}
          capexList={capexList}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleImportJson}
          style={{ display: 'none' }}
        />
        <MenuBar
          menuRef={menuRef}
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          handleMenuAction={handleMenuAction}
          theme={theme}
          toggleTheme={toggleTheme}
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
          handleClear={handleClear}
          handleAddSource={handleAddSource}
          handleAddFurnace={handleAddFurnace}
          handleAddTarget={handleAddTarget}
          handleAddCustomRecipe={handleAddCustomRecipe}
          handleAutoFillSelected={handleAutoFillSelected}
          handleFitView={handleFitView}
          handleCalculate={handleCalculate}
          onOpenRegistry={() => setShowRegistry(true)}
          onOpenTpsSettings={() => setShowTpsSettings(true)}
        />

        <RecipeEditorProvider value={{ onEdit: handleEditNode, onAutoFill: autoFillEndpoints }}>
          <EndpointEditorProvider value={{ onEdit: handleEditEndpoint }}>
          <NodeDataProvider value={{ updateNodeData }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
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
              connectionLineStyle={{ stroke: 'rgba(148, 163, 184, 0.6)', strokeWidth: 2 }}
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
              <Controls position="bottom-right" showInteractive={false} />
            </ReactFlow>
          </NodeDataProvider>
          </EndpointEditorProvider>
        </RecipeEditorProvider>
      </section>
    </main>
  )
}
