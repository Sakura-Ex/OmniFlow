import type { Node, Edge } from 'reactflow'

/** Pre-configured demo nodes for the canvas, including source, recipe, and target nodes. */
export const initialNodes: Node[] = [
  {
    id: 'source-1',
    type: 'sourceNode',
    position: { x: -280, y: 150 },
    data: {
      mode: 'infinite',
      ports: [{ id: 'water', amount: 1000, category: 'fluid' }],
    },
  },
  {
    id: 'node-1',
    type: 'recipeNode',
    position: { x: 50, y: 150 },
    data: {
      recipe_id: 'electrolyzer_water',
      machine_name: 'Electrolyzer',
      system: 'gregtech',
      inputs: [{ id: 'water', category: 'fluid', amount: 1000 }],
      outputs: [
        { id: 'hydrogen', category: 'fluid', amount: 2000 },
        { id: 'oxygen', category: 'fluid', amount: 1000 },
      ],
      duration_seconds: 5,
      mode: 'auto',
      metadata: { eu_per_tick: 32, can_overclock: true },
    },
  },
  {
    id: 'node-2',
    type: 'recipeNode',
    position: { x: 50, y: 350 },
    data: {
      recipe_id: 'macerator_iron',
      machine_name: 'Macerator',
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
    position: { x: 600, y: 250 },
    data: {
      recipe_id: 'blast_furnace_steel_01',
      machine_name: 'Electric Blast Furnace',
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
    },
  },
  {
    id: 'node-vanilla',
    type: 'recipeNode',
    position: { x: 600, y: 550 },
    data: {
      recipe_id: 'vanilla_chest',
      machine_name: 'Crafting Table',
      system: 'vanilla',
      inputs: [{ id: 'oak_planks', category: 'item', amount: 8 }],
      outputs: [{ id: 'chest', category: 'item', amount: 1 }],
      duration_seconds: 0,
      mode: 'auto',
      metadata: {},
    },
  },
  {
    id: 'target-1',
    type: 'targetNode',
    position: { x: 1100, y: 250 },
    data: {
      mode: 'maximize',
      ports: [{ id: 'steel_ingot', amount: 1, category: 'item' }],
    },
  },
]

export const initialEdges: Edge[] = [
  {
    id: 'e-source1-water-node1-water',
    source: 'source-1',
    sourceHandle: 'fluid:water',
    target: 'node-1',
    targetHandle: 'fluid:water',
    type: 'default',
    className: 'custom-edge-fluid',
    style: { stroke: '#4ddcff', strokeWidth: 2 },
  },
  {
    id: 'e-node1-oxygen-node3-oxygen',
    source: 'node-1',
    sourceHandle: 'fluid:oxygen',
    target: 'node-3',
    targetHandle: 'fluid:oxygen',
    type: 'default',
    className: 'custom-edge-fluid',
    style: { stroke: '#4ddcff', strokeWidth: 2 },
  },
  {
    id: 'e-node2-iron-node3-iron',
    source: 'node-2',
    sourceHandle: 'item:iron_dust',
    target: 'node-3',
    targetHandle: 'item:iron_dust',
    type: 'default',
    className: 'custom-edge-item',
    style: { stroke: '#e5e7eb', strokeWidth: 2 },
  },
  {
    id: 'e-node3-steel-target1-steel',
    source: 'node-3',
    sourceHandle: 'item:steel_ingot',
    target: 'target-1',
    targetHandle: 'item:steel_ingot',
    type: 'default',
    className: 'custom-edge-item',
    style: { stroke: '#e5e7eb', strokeWidth: 2 },
  },
]
