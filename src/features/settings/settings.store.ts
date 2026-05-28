import { create } from 'zustand'

/** State shape for the global application settings store. */
interface SettingsState {
  tps: number
  setTps: (tps: number) => void
}

/** @description Zustand store for global application settings (e.g. ticks-per-second). */
export const useSettingsStore = create<SettingsState>((set) => ({
  tps: 20,
  setTps: (tps: number) => set({ tps: Math.max(1, tps) }),
}))
