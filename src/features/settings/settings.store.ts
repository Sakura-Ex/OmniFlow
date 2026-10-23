import { create } from 'zustand'
import type { UnitSnapshot } from '@/common/types/units'
import { UnitSystem } from '@/common/units/UnitSystem'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'

/** State shape for the global application settings store. */
interface SettingsState {
  tps: number
  units: UnitSnapshot
  setTps: (tps: number) => void
  setEnvironment: (snapshot: UnitSnapshot) => void
}

/** @description Zustand store for global application settings (e.g. ticks-per-second). */
export const useSettingsStore = create<SettingsState>((set, get) => ({
  tps: 20,
  units: new UnitSystem(DEFAULT_UNIT_SNAPSHOT).snapshot,
  setTps: (tps) => get().setEnvironment({ ...get().units, ticksPerSecond: tps }),
  setEnvironment: (snapshot) => {
    const units = new UnitSystem(snapshot).snapshot
    set({ tps: units.ticksPerSecond, units })
  },
}))
