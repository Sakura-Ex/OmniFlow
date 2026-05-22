// ─────────────────────────────────────────────────────────
//  资源标识符 & 拓扑网络命名 — 统一解析/构造
// ─────────────────────────────────────────────────────────
//  白皮书 §3:   category:id  (首个冒号前=类别，后=完整标识符)
//  白皮书 §8.1: Net_ / Global_ / Void_  三种 Net 命名
// ─────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════
//  Part 1 — 类别:标识符 解析
// ══════════════════════════════════════════════════════

/** 资源标识体系的默认类别。当端口未指定 category 时兜底为此值。 */
export const DEFAULT_RESOURCE_CATEGORY = 'item'

export interface ParsedResourceId {
  category: string
  id: string
}

/**
 * 解析 category:id — 第一个冒号前为类别，余下全量为标识符。
 * 无冒号时兜底为 DEFAULT_RESOURCE_CATEGORY。
 */
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

/** 便捷: 提取类别 */
export const getCategory = (raw: string): string =>
  parseResourceId(raw).category

/** 便捷: 提取标识符 */
export const getId = (raw: string): string =>
  parseResourceId(raw).id

// ══════════════════════════════════════════════════════
//  Part 2 — Net 命名器
// ══════════════════════════════════════════════════════

export const NET_PREFIX = 'Net_'
export const GLOBAL_PREFIX = 'Global_'
export const VOID_PREFIX = 'Void_'
export const VIRTUAL_GLOBAL_PREFIX = 'Virtual_Global_'

// ── 构造 ──

/** Net_<resourceId>_<suffix>  有线连通分量 */
export const buildNetName = (resourceId: string, suffix: string): string =>
  `${NET_PREFIX}${resourceId}_${suffix}`

/** Global_<qualifier>  隐式全局总线 */
export const buildGlobalName = (qualifier: string): string =>
  `${GLOBAL_PREFIX}${qualifier}`

/** Void_<nodeId>_<fullId>  孤立端口 (对空排放) */
export const buildVoidName = (nodeId: string, fullId: string): string =>
  `${VOID_PREFIX}${nodeId}_${fullId}`

// ── 判断 ──

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

// ── 解析 ──

/** 解析 Net_<resourceId>_<suffix> → { resourceId, suffix } */
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

/** 解析 Void_<nodeId>_<fullId> → { nodeId, fullId } */
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

/**
 * 从 Net/Void/Global 名称中还原原始资源标识符。
 *  - Net_xxx_<suffix> → xxx
 *  - Void_<nodeId>_xxx → xxx
 *  - Global_xxx → xxx
 *  - 其余原样返回
 */
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
