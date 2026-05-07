import type { MachineArchetype } from '../../types/types'

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
    },
  },
  default_modifiers: ['gt_multiblock'],
}
