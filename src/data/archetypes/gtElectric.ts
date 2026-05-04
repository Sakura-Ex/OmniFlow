import type { MachineArchetype } from '../../types/types'

export const gtElectricArchetype: MachineArchetype = {
  id: 'gt_electric',
  name: '格雷电力机器范式',
  fixed_utilities: {
    'gt:eu': {
      type: 'gt:eu',
      amount_mutable: true,
      routing_mode: 'global',
      routing_locked: true,
    },
  },
  default_modifiers: ['gt_multiblock'],
}
