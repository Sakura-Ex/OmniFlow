import type { RefObject } from 'react'
import type { ThemeMode } from '@/hooks/useTheme'

/**
 *
 */
type MenuBarProps = {
  menuRef: RefObject<HTMLDivElement | null>
  openMenu: string | null
  setOpenMenu: (menu: string | null) => void
  handleMenuAction: (action: () => void) => void
  theme: ThemeMode
  toggleTheme: () => void
  handleSaveCanvas: () => void
  handleLoadCanvas: () => void
  handleExportJson: () => void
  handleImportClick: () => void
  undo: () => void
  redo: () => void
  handleCopy: () => Promise<void>
  handleCut: () => Promise<void>
  handlePaste: () => Promise<void>
  handleDuplicate: () => void
  handleSelectAll: () => void
  handleClearSelection: () => void
  handleDeleteSelected: () => void
  handleDeleteSelectedNodes: () => void
  handleDeleteSelectedEdges: () => void
  handleClear: () => void
  handleAddSource: () => void
  handleAddFurnace: () => void
  handleAddTarget: () => void
  handleAddCustomRecipe: () => void
  handleAutoFillSelected: () => void
  handleFitView: () => void
  handleCalculate: () => Promise<void>
  onOpenRegistry: () => void
  onOpenTpsSettings: () => void
}

/**
 * Top menu bar component providing access to file operations (save/load/import/export),
 * edit actions (undo/redo/copy/paste/delete), node creation, view controls, solve triggers,
 * resource registry, TPS settings, and theme toggling.
 *
 * @param props - Component props
 * @param props.menuRef - Ref attached to the menu bar container for click-outside detection
 * @param props.openMenu - Currently open dropdown menu identifier, or null
 * @param props.setOpenMenu - Callback to open or close a dropdown menu
 * @param props.handleMenuAction - Callback that executes an action and closes the menu
 * @param props.theme - Current theme mode ('dark' | 'light')
 * @param props.toggleTheme - Callback to toggle between dark and light themes
 * @param props.handleSaveCanvas - Callback to persist canvas state
 * @param props.handleLoadCanvas - Callback to restore canvas from storage
 * @param props.handleExportJson - Callback to export canvas as JSON file
 * @param props.handleImportClick - Callback to trigger the file import dialog
 * @param props.undo - Callback to undo the last canvas operation
 * @param props.redo - Callback to redo a previously undone operation
 * @param props.handleCopy - Async callback to copy selected nodes/edges
 * @param props.handleCut - Async callback to cut selected nodes/edges
 * @param props.handlePaste - Async callback to paste clipboard content
 * @param props.handleDuplicate - Callback to duplicate selected nodes
 * @param props.handleSelectAll - Callback to select all nodes and edges
 * @param props.handleClearSelection - Callback to clear current selection
 * @param props.handleDeleteSelected - Callback to delete all selected items
 * @param props.handleDeleteSelectedNodes - Callback to delete only selected nodes
 * @param props.handleDeleteSelectedEdges - Callback to delete only selected edges
 * @param props.handleClear - Callback to clear the entire canvas
 * @param props.handleAddSource - Callback to add a new source node
 * @param props.handleAddFurnace - Callback to add a new machine/recipe node
 * @param props.handleAddTarget - Callback to add a new target node
 * @param props.handleAddCustomRecipe - Callback to add a custom recipe node
 * @param props.handleAutoFillSelected - Callback to auto-fill ports on selected recipe nodes
 * @param props.handleFitView - Callback to fit all canvas items into the viewport
 * @param props.handleCalculate - Async callback to trigger matrix solving
 * @param props.onOpenRegistry - Callback to open the global resource registry panel
 * @param props.onOpenTpsSettings - Callback to open the TPS settings panel
 * @returns Rendered JSX element for the menu bar.
 */
export function MenuBar({
  menuRef,
  openMenu,
  setOpenMenu,
  handleMenuAction,
  theme,
  toggleTheme,
  handleSaveCanvas,
  handleLoadCanvas,
  handleExportJson,
  handleImportClick,
  undo,
  redo,
  handleCopy,
  handleCut,
  handlePaste,
  handleDuplicate,
  handleSelectAll,
  handleClearSelection,
  handleDeleteSelected,
  handleDeleteSelectedNodes,
  handleDeleteSelectedEdges,
  handleClear,
  handleAddSource,
  handleAddFurnace,
  handleAddTarget,
  handleAddCustomRecipe,
  handleAutoFillSelected,
  handleFitView,
  handleCalculate,
  onOpenRegistry,
  onOpenTpsSettings,
}: MenuBarProps) {
  return (
    <div className="menu-bar" ref={menuRef}>
      <div className="menu-group">
        <button
          className="menu-button"
          type="button"
          onClick={() => setOpenMenu(openMenu === 'file' ? null : 'file')}
        >
          文件
          <span className="menu-caret">▾</span>
        </button>
        {openMenu === 'file' && (
          <div className="menu-dropdown">
            <button className="menu-item" onClick={() => handleMenuAction(handleSaveCanvas)}>💾 保存画布</button>
            <button className="menu-item" onClick={() => handleMenuAction(handleLoadCanvas)}>📥 读取画布</button>
            <div className="menu-divider" />
            <button className="menu-item" onClick={() => handleMenuAction(handleExportJson)}>⬇️ 导出 JSON</button>
            <button className="menu-item" onClick={() => handleMenuAction(handleImportClick)}>📂 导入 JSON</button>
          </div>
        )}
      </div>

      <div className="menu-group">
        <button
          className="menu-button"
          type="button"
          onClick={() => setOpenMenu(openMenu === 'edit' ? null : 'edit')}
        >
          编辑
          <span className="menu-caret">▾</span>
        </button>
        {openMenu === 'edit' && (
          <div className="menu-dropdown">
            <button className="menu-item" onClick={() => handleMenuAction(undo)}>↩️ 撤销</button>
            <button className="menu-item" onClick={() => handleMenuAction(redo)}>↪️ 重做</button>
            <div className="menu-divider" />
            <button className="menu-item" onClick={() => handleMenuAction(() => { void handleCopy() })}>📋 复制</button>
            <button className="menu-item" onClick={() => handleMenuAction(() => { void handleCut() })}>✂️ 剪切</button>
            <button className="menu-item" onClick={() => handleMenuAction(() => { void handlePaste() })}>📌 粘贴</button>
            <button className="menu-item" onClick={() => handleMenuAction(handleDuplicate)}>🧩 复制副本</button>
            <div className="menu-divider" />
            <div className="menu-submenu">
              <button className="menu-item" type="button">
                选择
                <span className="menu-caret">▸</span>
              </button>
              <div className="menu-submenu-dropdown">
                <button className="menu-item" onClick={() => handleMenuAction(handleSelectAll)}>🔲 全选</button>
                <button className="menu-item" onClick={() => handleMenuAction(handleClearSelection)}>🧼 清除选择</button>
              </div>
            </div>
            <div className="menu-submenu">
              <button className="menu-item" type="button">
                删除
                <span className="menu-caret">▸</span>
              </button>
              <div className="menu-submenu-dropdown">
                <button className="menu-item" onClick={() => handleMenuAction(handleDeleteSelected)}>🗑️ 删除选中</button>
                <button className="menu-item" onClick={() => handleMenuAction(handleDeleteSelectedNodes)}>🧱 删除选中节点</button>
                <button className="menu-item" onClick={() => handleMenuAction(handleDeleteSelectedEdges)}>🔌 删除选中连线</button>
                <button className="menu-item" onClick={() => handleMenuAction(handleClear)}>🧹 清空画布</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="menu-group">
        <button
          className="menu-button"
          type="button"
          onClick={() => setOpenMenu(openMenu === 'nodes' ? null : 'nodes')}
        >
          节点
          <span className="menu-caret">▾</span>
        </button>
        {openMenu === 'nodes' && (
          <div className="menu-dropdown">
            <div className="menu-submenu">
              <button className="menu-item" type="button">
                新建
                <span className="menu-caret">▸</span>
              </button>
              <div className="menu-submenu-dropdown">
                <button className="menu-item" onClick={() => handleMenuAction(handleAddSource)}>＋ 原料源</button>
                <button className="menu-item" onClick={() => handleMenuAction(handleAddFurnace)}>＋ 机器配方</button>
                <button className="menu-item" onClick={() => handleMenuAction(handleAddTarget)}>＋ 目标需求</button>
                <button className="menu-item" onClick={() => handleMenuAction(handleAddCustomRecipe)}>➕ 自定义配方</button>
              </div>
            </div>
            <div className="menu-divider" />
            <button className="menu-item" onClick={() => handleMenuAction(handleAutoFillSelected)}>🪄 补全选中配方端口</button>
          </div>
        )}
      </div>

      <div className="menu-group">
        <button
          className="menu-button"
          type="button"
          onClick={() => setOpenMenu(openMenu === 'view' ? null : 'view')}
        >
          视图
          <span className="menu-caret">▾</span>
        </button>
        {openMenu === 'view' && (
          <div className="menu-dropdown">
            <button className="menu-item" onClick={() => handleMenuAction(handleFitView)}>🧭 适配视图</button>
          </div>
        )}
      </div>

      <div className="menu-group">
        <button
          className="menu-button menu-button--primary"
          type="button"
          onClick={() => setOpenMenu(openMenu === 'solve' ? null : 'solve')}
        >
          求解
          <span className="menu-caret">▾</span>
        </button>
        {openMenu === 'solve' && (
          <div className="menu-dropdown">
            <button className="menu-item" onClick={() => { void handleCalculate(); setOpenMenu(null); }}>🚀 执行矩阵求解</button>
          </div>
        )}
      </div>

      <div className="menu-group menu-group--theme">
        <button
          className="menu-button menu-button--theme"
          type="button"
          onClick={() => handleMenuAction(onOpenRegistry)}
        >
          ⚙️ 全局资源字典
        </button>
        <button
          className="menu-button menu-button--theme"
          type="button"
          onClick={() => handleMenuAction(onOpenTpsSettings)}
        >
          ⏱️ TPS 设置
        </button>
      </div>

      <div className="menu-group menu-group--theme">
        <button
          className="menu-button menu-button--theme"
          type="button"
          onClick={toggleTheme}
          title="切换深色/浅色主题"
        >
          {theme === 'dark' ? '☀️ 浅色' : '🌙 深色'}
        </button>
      </div>
    </div>
  )
}
