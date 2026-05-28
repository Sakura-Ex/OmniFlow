import { create } from 'zustand'

interface SettingsState {
  tps: number
  setTps: (tps: number) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  tps: 20,
  setTps: (tps: number) => set({ tps: Math.max(1, tps) }),
}))
