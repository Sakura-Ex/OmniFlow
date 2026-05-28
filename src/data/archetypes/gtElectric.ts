import type { MachineArchetype } from '@/common/types/resource'

export const gtElectricArchetype: MachineArchetype = {
  id: 'gt_electric',
  name: '格雷电力机器范式',
  fixed_utilities: {
    gt_energy: {
      type: 'energy:gt_eu',
      resource_id: 'gt_eu',
      amount_mutable: true,
      routing_mode: 'global',
      routing_locked: true,
      time_base: 'rate_per_tick',
      io: 'input',
    },
  },
  default_modifiers: ['gt_overclocker'],
  traits: {
    energyHatches: {
      key: 'energyHatches',
      label: '能源仓配置',
      default: [{ tier: 'LV', amps: 1 }],
    },
  },
}
