import { useSettingsStore } from '../stores/settingsStore'
import { SettingsDrawerShell } from './SettingsDrawerShell'

export function TpsSettingsPanel({ onClose }: { onClose: () => void }) {
  const tps = useSettingsStore((s) => s.tps)
  const setTps = useSettingsStore((s) => s.setTps)

  return (
    <SettingsDrawerShell
      title="TPS 设置"
      eyebrow="Global Settings"
      onClose={onClose}
    >
      <p className="resource-registry__hint">
        <code>Ticks Per Second</code> 控制游戏刻与秒的换算比例。默认 <code>20</code>，修改后所有瞬时速率和显示都会同步更新。
      </p>

      <div className="resource-registry__list-section">
        <div className="resource-registry__table">
          <div className="resource-registry__table-row resource-registry__table-row--header">
            <span>参数</span>
            <span>当前值</span>
          </div>
          <div className="resource-registry__table-row">
            <span className="resource-registry__mono">Ticks Per Second</span>
            <input
              type="number"
              min={1}
              max={1200}
              step={1}
              value={tps}
              onChange={(e) => setTps(Number(e.target.value) || 1)}
            />
          </div>
        </div>
      </div>
    </SettingsDrawerShell>
  )
}
