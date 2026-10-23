import { z } from 'zod'
import type { Node, Edge } from 'reactflow'
import type { RecipeNodeData } from '@/common/types/recipe'
import type { Resource } from '@/common/types/resource'
import type { ResourceCategoryDef, ResourceEntry, UnitOverride } from '@/common/types/registry'
import type { UnitSnapshot } from '@/common/types/units'
import { UnitSnapshotSchema } from '@/common/schemas/units.schema'
import { RecipeNodeDataSchema } from '@/common/schemas/recipe.schema'
import { ResourceSchema } from '@/common/schemas/resource.schema'
import { UnitSystem } from '@/common/units/UnitSystem'
import { DEFAULT_UNIT_SNAPSHOT, legacyUnit, defaultResourceUnit } from '@/common/units/defaults'
import { normalizeGraph } from '@/features/canvas/graphDocument'
import { DEFAULT_RESOURCE_CATEGORIES, DEFAULT_OVERRIDES } from '@/features/resource-registry/registry.defaults'

/** Reproducible file format: v3 introduced units; v4 adds persistent port identities. */
export interface CanvasDocument {
  version: 4
  pluginApiVersion: 2
  environment: UnitSnapshot
  registry: {
    categories: Record<string, ResourceCategoryDef>
    overrides: Record<string, UnitOverride>
    entries: Record<string, ResourceEntry>
  }
  ui: { nodes: Node[]; edges: Edge[] }
  domain: { recipes: Record<string, RecipeNodeData> }
}

const CategorySchema = z.object({ id: z.string(), displayName: z.string(), base_unit: z.string(), themeColor: z.string(), preferred_time_base: z.enum(['per_cycle', 'rate_per_tick', 'rate_per_sec']) })
const RegistrySchema = z.object({
  categories: z.record(CategorySchema),
  overrides: z.record(z.object({ unit_override: z.string().optional() })),
  entries: z.record(z.object({ fullId: z.string(), displayName: z.string().optional() })),
})
const IdentitySchema = z.string().refine((id) => id.trim().length > 0, 'Identity must not be blank')
const NodeSchema = z.object({ id: IdentitySchema, type: z.enum(['recipeNode', 'sourceNode', 'targetNode']), position: z.object({ x: z.number().finite(), y: z.number().finite() }), data: z.record(z.unknown()) }).passthrough()
const EdgeSchema = z.object({ id: IdentitySchema, source: IdentitySchema, target: IdentitySchema, sourceHandle: z.string().nullable().optional(), targetHandle: z.string().nullable().optional() }).passthrough()
const DocumentSchema = z.object({
  version: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  pluginApiVersion: z.literal(2).optional(),
  environment: UnitSnapshotSchema.optional(),
  registry: RegistrySchema.optional(),
  ui: z.object({ nodes: z.array(NodeSchema), edges: z.array(EdgeSchema) }),
  domain: z.object({ recipes: z.record(RecipeNodeDataSchema) }),
}).superRefine((document, context) => {
  for (const group of ['nodes', 'edges'] as const) {
    const seen = new Set<string>()
    document.ui[group].forEach((item, index) => {
      if (seen.has(item.id)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate graph identity', path: ['ui', group, index, 'id'] })
      seen.add(item.id)
    })
  }
})

/**
 * Validate first, migrate on copies, then let the caller commit the complete document.
 * @returns Validated v4 document and migration warnings.
 * @param input - Untrusted parsed document data.
 */
export function readCanvasDocument(input: unknown): { document: CanvasDocument; warnings: string[] } {
  const parsed = DocumentSchema.parse(input)
  if (parsed.version >= 3 && !parsed.environment) throw new Error('Missing saved environment')
  if (parsed.version === 4 && parsed.pluginApiVersion !== 2) throw new Error('Unsupported modifier plugin API')
  const warnings: string[] = []
  if (!parsed.environment) warnings.push('旧文件未保存环境，已采用默认 20 TPS。')
  if (parsed.version < 4) warnings.push('修饰器接口已升级至 v2；已按现有配置重新编译预览。')
  const registry = parsed.registry ?? { categories: Object.fromEntries(DEFAULT_RESOURCE_CATEGORIES.map((c) => [c.id, c])), overrides: DEFAULT_OVERRIDES, entries: {} }
  const environment = structuredClone(parsed.environment ?? DEFAULT_UNIT_SNAPSHOT) as UnitSnapshot
  const definitions = [...environment.definitions]
  const migrateResource = (resource: Resource): Resource => {
    if (parsed.version === 4 && !resource.portId) throw new Error('Missing persisted port identity')
    const label = registry.overrides[`${resource.category}:${resource.id}`]?.unit_override ?? registry.categories[resource.category]?.base_unit
    const unit = resource.unit ?? (label ? legacyUnit(label) : defaultResourceUnit(resource.category, resource.id))
    for (const factor of unit) {
      if (!definitions.some((d) => d.id === factor.baseUnitId)) {
        if (resource.unit || !factor.baseUnitId.startsWith('legacy:')) throw new Error(`Unknown unit: ${factor.baseUnitId}`)
        definitions.push({ id: factor.baseUnitId, symbol: factor.baseUnitId.slice(7) })
      }
    }
    return { ...resource, unit }
  }
  const recipes: Record<string, RecipeNodeData> = {}
  for (const [id, recipe] of Object.entries(parsed.domain.recipes)) {
    recipes[id] = { ...recipe } as RecipeNodeData
    for (const group of ['inputs', 'outputs', 'base_inputs', 'base_outputs', 'base_utility_inputs', 'base_utility_outputs'] as const) {
      if (recipes[id][group]) recipes[id][group] = recipes[id][group]!.map(migrateResource)
    }
  }
  const nodes = parsed.ui.nodes.map((node) => {
    if (node.type === 'recipeNode') {
      if (!recipes[node.id]) throw new Error(`Missing recipe: ${node.id}`)
      return node
    }
    if (node.data.mode !== undefined) (node.type === 'sourceNode' ? z.enum(['limit', 'infinite']) : z.enum(['demand', 'maximize', 'overflow'])).parse(node.data.mode)
    const ports = z.array(ResourceSchema).parse(node.data.ports)
    return { ...node, data: { ...node.data, ports: ports.map((p) => migrateResource(p as Resource)) } }
  }) as Node[]
  const units = new UnitSystem({ ...environment, definitions })
  const validateUnits = (port: Resource) => {
    const rate = units.rateQuantity(1, port.unit!, 'rate_per_sec', 1).unit
    if (port.displayUnit) units.expression(port.displayUnit).conversionScale(rate)
  }
  for (const recipe of Object.values(recipes)) {
    for (const group of ['inputs', 'outputs', 'base_inputs', 'base_outputs', 'base_utility_inputs', 'base_utility_outputs'] as const) {
      for (const port of recipe[group] ?? []) validateUnits(port)
    }
  }
  for (const node of nodes) {
    if (node.type !== 'recipeNode') for (const port of node.data.ports) validateUnits(port)
  }
  const graph = normalizeGraph(nodes, parsed.ui.edges as Edge[], recipes, parsed.version < 4)
  const issues = graph.edges.filter((edge) => edge.data?.portIssue)
  if (issues.length) warnings.push(...issues.map((edge) => `连线 ${edge.id} 待修复：${edge.data.portIssue}`))
  return { document: { version: 4, pluginApiVersion: 2, environment: units.snapshot, registry, ui: { nodes: graph.nodes, edges: graph.edges }, domain: { recipes: graph.recipes } }, warnings }
}
