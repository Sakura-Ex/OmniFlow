export const DEFAULT_RESOURCE_CATEGORY = 'item'

export interface ParsedResourceId {
  category: string
  id: string
}

export const parseResourceId = (raw: string): ParsedResourceId => {
  const idx = raw.indexOf(':')
  if (idx === -1) return { category: DEFAULT_RESOURCE_CATEGORY, id: raw }
  return {
    category: raw.slice(0, idx),
    id: raw.slice(idx + 1),
  }
}

export const buildResourceId = (category: string, id: string): string =>
  `${category}:${id}`

export const getCategory = (raw: string): string =>
  parseResourceId(raw).category

export const getId = (raw: string): string =>
  parseResourceId(raw).id

export const NET_PREFIX = 'Net_'
export const GLOBAL_PREFIX = 'Global_'
export const VOID_PREFIX = 'Void_'
export const VIRTUAL_GLOBAL_PREFIX = 'Virtual_Global_'

export const buildNetName = (resourceId: string, suffix: string): string =>
  `${NET_PREFIX}${resourceId}_${suffix}`

export const buildGlobalName = (qualifier: string): string =>
  `${GLOBAL_PREFIX}${qualifier}`

export const buildVoidName = (nodeId: string, fullId: string): string =>
  `${VOID_PREFIX}${nodeId}_${fullId}`

export const isNetName = (name: string): boolean =>
  name.startsWith(NET_PREFIX)

export const isVoidName = (name: string): boolean =>
  name.startsWith(VOID_PREFIX)

export const isGlobalName = (name: string): boolean =>
  name.startsWith(GLOBAL_PREFIX)

export const isRoutedName = (name: string): boolean =>
  isNetName(name) || isVoidName(name) || isGlobalName(name)

export const isVirtualGlobal = (name: string): boolean =>
  name.startsWith(VIRTUAL_GLOBAL_PREFIX)

export const parseNetName = (name: string): { resourceId: string; suffix: string } | null => {
  if (!isNetName(name)) return null
  const inner = name.slice(NET_PREFIX.length)
  const sep = inner.lastIndexOf('_')
  if (sep <= 0) return null
  return {
    resourceId: inner.slice(0, sep),
    suffix: inner.slice(sep + 1),
  }
}

export const parseVoidName = (name: string): { nodeId: string; fullId: string } | null => {
  if (!isVoidName(name)) return null
  const inner = name.slice(VOID_PREFIX.length)
  const sep = inner.indexOf('_')
  if (sep <= 0) return null
  return {
    nodeId: inner.slice(0, sep),
    fullId: inner.slice(sep + 1),
  }
}

export const normalizeResourceKey = (raw: string): string => {
  const stripped = stripNetPrefix(raw)
  const parsed = parseResourceId(stripped)
  return buildResourceId(parsed.category, parsed.id)
}

export const parseNormalizedKey = (raw: string): ParsedResourceId =>
  parseResourceId(stripNetPrefix(raw))

export const stripNetPrefix = (name: string): string => {
  if (isNetName(name)) {
    const parsed = parseNetName(name)
    return parsed ? parsed.resourceId : name
  }
  if (isVoidName(name)) {
    const parsed = parseVoidName(name)
    return parsed ? parsed.fullId : name
  }
  if (isGlobalName(name)) return name.slice(GLOBAL_PREFIX.length)
  return name
}
