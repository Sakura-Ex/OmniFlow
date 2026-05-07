import type { MachineArchetype } from '../../types/types'

export const fluidNetworkedArchetype: MachineArchetype = {
  id: 'fluid_networked',
  name: '流体公用范式',
  fixed_utilities: {
    cooling_water: {
      type: 'fluid:water',
      resource_id: 'water',
      amount_mutable: true,
      routing_mode: 'global',
      routing_locked: false,
      time_base: 'rate_per_sec',
    },
  },
  default_modifiers: [],
}
