import { useSettingsStore } from '../stores/settingsStore'

export function TpsSettingsPanel({ onClose }: { onClose: () => void }) {
  const tps = useSettingsStore((s) => s.tps)
  const setTps = useSettingsStore((s) => s.setTps)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>TPS Settings</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <label className="recipe-editor__field">
            <span>Ticks Per Second</span>
            <div className="recipe-editor__input-wrap">
              <input
                type="number"
                min={1}
                max={1200}
                step={1}
                value={tps}
                onChange={(e) => setTps(Number(e.target.value) || 1)}
              />
              <span className="recipe-editor__input-suffix">TPS</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  )
}
