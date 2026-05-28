import type { MachineArchetype } from '@/common/types/resource'

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
      io: 'input',
    },
  },
  default_modifiers: [],
}
