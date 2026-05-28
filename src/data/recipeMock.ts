import type { RecipeNodeData } from '@/common/types/recipe'

/** @description Mock recipe data representing a steel-smelting blast-furnace recipe used for development and testing. */
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
    { id: 'iron_dust', category: 'item', amount: 1 },
    { id: 'oxygen', category: 'fluid', amount: 1000 },
  ],
  outputs: [
    { id: 'steel_ingot', category: 'item', amount: 1 },
    { id: 'tiny_dark_ashes', category: 'item', amount: 1 },
  ],
}
