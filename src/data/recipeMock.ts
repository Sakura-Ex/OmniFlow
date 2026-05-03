import type { RecipeNodeData } from '../types/recipe'

export const recipeMock: RecipeNodeData = {
  recipe_id: 'blast_furnace_steel_01',
  machine_name: 'Electric Blast Furnace',
  system: 'gregtech',
  duration_seconds: 60,
  metadata: {
    eu_per_tick: 120,
    can_overclock: true
  },
  inputs: [
    { id: 'iron_dust', type: 'item', amount: 1 },
    { id: 'oxygen', type: 'fluid', amount: 1000 },
  ],
  outputs: [
    { id: 'steel_ingot', type: 'item', amount: 1 },
    { id: 'tiny_dark_ashes', type: 'item', amount: 1 },
  ],
}