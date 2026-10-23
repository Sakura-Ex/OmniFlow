import { RESOURCE_COLORS } from '@/common/utils/resourcePalette'
import type { Node, Edge } from 'reactflow'
import type { NetworkConfiguration } from '@/common/schemas/network.schema'
import { portKey } from '@/features/calculation/topology'
import { DEFAULT_UNIT_SNAPSHOT } from '@/common/units/defaults'
import type { UnitSnapshot } from '@/common/types/units'

/** The starter document expresses its target in items per minute. */
export const initialEnvironment: UnitSnapshot = {
  ...DEFAULT_UNIT_SNAPSHOT,
  definitions: [...DEFAULT_UNIT_SNAPSHOT.definitions, { id: 'min', symbol: 'min', scale: 60, derived: [{ baseUnitId: 's', exponent: 1 }] }],
}

/** Pre-configured demo nodes for the canvas, including source, recipe, and target nodes. */
export const initialNodes: Node[] = [
  { id: 'source-ore', type: 'sourceNode', position: { x: -380, y: 0 }, data: { mode: 'infinite', ports: [{ id: 'iron_ore', category: 'item', amount: 1 }] } },
  { id: 'spill-hydrogen', type: 'targetNode', position: { x: 510, y: 520 }, data: { mode: 'overflow', ports: [{ id: 'hydrogen', category: 'fluid', amount: 0 }] } },
  { id: 'spill-ashes', type: 'targetNode', position: { x: 970, y: 220 }, data: { mode: 'overflow', ports: [{ id: 'tiny_dark_ashes', category: 'item', amount: 0 }] } },
  {
    id: 'source-1',
    type: 'sourceNode',
    position: { x: -380, y: 380 },
    data: {
      mode: 'infinite',
      ports: [{ id: 'water', amount: 1000, category: 'fluid' }],
    },
  },
  {
    id: 'node-1',
    type: 'recipeNode',
    position: { x: 40, y: 380 },
    data: {
      recipe_id: 'electrolyzer_water',
      machine_name: '电解机',
      system: 'gregtech',
      inputs: [{ id: 'water', category: 'fluid', amount: 1000 }],
      outputs: [
        { id: 'oxygen', category: 'fluid', amount: 1000 },
        { id: 'hydrogen', category: 'fluid', amount: 2000 },
      ],
      duration_seconds: 5,
      mode: 'auto',
      metadata: { eu_per_tick: 32, can_overclock: true },
    },
  },
  {
    id: 'node-2',
    type: 'recipeNode',
    position: { x: 40, y: 0 },
    data: {
      recipe_id: 'macerator_iron',
      machine_name: '粉碎机',
      system: 'gregtech',
      inputs: [{ id: 'iron_ore', category: 'item', amount: 1 }],
      outputs: [{ id: 'iron_dust', category: 'item', amount: 2 }],
      duration_seconds: 20,
      mode: 'auto',
      metadata: { eu_per_tick: 16, can_overclock: true },
    },
  },
  {
    id: 'node-3',
    type: 'recipeNode',
    position: { x: 510, y: 0 },
    data: {
      recipe_id: 'blast_furnace_steel_01',
      machine_name: '电力高炉',
      system: 'gregtech',
      inputs: [
        { id: 'iron_dust', category: 'item', amount: 1 },
        { id: 'oxygen', category: 'fluid', amount: 1000 },
      ],
      outputs: [
        { id: 'steel_ingot', category: 'item', amount: 1 },
        { id: 'tiny_dark_ashes', category: 'item', amount: 1 },
      ],
      duration_seconds: 60,
      mode: 'auto',
      metadata: { eu_per_tick: 120, can_overclock: true },
      hardware_specs: { energyHatches: [{ tier: 'MV', amps: 1 }] },
    },
  },
  {
    id: 'target-1',
    type: 'targetNode',
    position: { x: 970, y: 0 },
    data: {
      mode: 'demand',
      ports: [{ id: 'steel_ingot', amount: 10, category: 'item', unit: [{ baseUnitId: 'item', exponent: 1 }, { baseUnitId: 'min', exponent: -1 }] }],
    },
  },
]

export const initialEdges: Edge[] = [
  { id: 'e-ore', source: 'source-ore', sourceHandle: 'item:iron_ore', target: 'node-2', targetHandle: 'item:iron_ore' },
  { id: 'e-hydrogen', source: 'node-1', sourceHandle: 'fluid:hydrogen', target: 'spill-hydrogen', targetHandle: 'fluid:hydrogen' },
  { id: 'e-ashes', source: 'node-3', sourceHandle: 'item:tiny_dark_ashes', target: 'spill-ashes', targetHandle: 'item:tiny_dark_ashes' },
  {
    id: 'e-source1-water-node1-water',
    source: 'source-1',
    sourceHandle: 'fluid:water',
    target: 'node-1',
    targetHandle: 'fluid:water',
    type: 'default',
    className: 'custom-edge-fluid',
    style: { stroke: RESOURCE_COLORS.fluid, strokeWidth: 2 },
  },
  {
    id: 'e-node1-oxygen-node3-oxygen',
    source: 'node-1',
    sourceHandle: 'fluid:oxygen',
    target: 'node-3',
    targetHandle: 'fluid:oxygen',
    type: 'default',
    className: 'custom-edge-fluid',
    style: { stroke: RESOURCE_COLORS.fluid, strokeWidth: 2 },
  },
  {
    id: 'e-node2-iron-node3-iron',
    source: 'node-2',
    sourceHandle: 'item:iron_dust',
    target: 'node-3',
    targetHandle: 'item:iron_dust',
    type: 'default',
    className: 'custom-edge-item',
    style: { stroke: RESOURCE_COLORS.item, strokeWidth: 2 },
  },
  {
    id: 'e-node3-steel-target1-steel',
    source: 'node-3',
    sourceHandle: 'item:steel_ingot',
    target: 'target-1',
    targetHandle: 'item:steel_ingot',
    type: 'default',
    className: 'custom-edge-item',
    style: { stroke: RESOURCE_COLORS.item, strokeWidth: 2 },
  },
]

/** Explicit power supply for the starter line; endpoint policies are seeded normally. */
export const initialConfiguration: NetworkConfiguration = {
  version: 1,
  ports: Object.fromEntries(['node-1', 'node-2', 'node-3'].map(nodeId => [
    portKey(nodeId, 'utility-gt_energy'),
    { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' as const }, boundary: { kind: 'source' as const, capacity: null } },
  ])),
  machines: {},
}
