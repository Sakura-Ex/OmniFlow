import type { MachineArchetype } from '../../types/types'

export const fluidNetworkedArchetype: MachineArchetype = {
  id: 'fluid_networked',
  name: '流体公用范式',
  fixed_utilities: {
    'utility:water': {
      type: 'utility:water',
      amount_mutable: true,
      routing_mode: 'global',
      routing_locked: false,
    },
  },
  default_modifiers: [],
}
