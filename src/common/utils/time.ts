import { useSettingsStore } from '@/features/settings/settings.store'

export function ticksToSeconds(value: number | undefined): number {
  const ticks = Number(value)
  return Number.isFinite(ticks) ? ticks / useSettingsStore.getState().tps : 0
}

export function secondsToTicks(value: number | undefined): number {
  const seconds = Number(value)
  return Number.isFinite(seconds) ? seconds * useSettingsStore.getState().tps : 0
}
