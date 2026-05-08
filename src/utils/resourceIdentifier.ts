export interface ParsedResourceId {
  category: string
  id: string
}

/**
 * 解析 category:id 格式的资源标识符。
 * 第一个冒号作为类别与 ID 的分隔符，后续冒号属于 ID 的一部分。
 *
 * 示例:
 *   "item:iron_ingot"     → { category: "item", id: "iron_ingot" }
 *   "energy:mod:power"    → { category: "energy", id: "mod:power" }
 *   "iron_ingot"          → { category: "iron_ingot", id: "iron_ingot" }
 */
export function parseResourceId(fullId: string): ParsedResourceId {
  const idx = fullId.indexOf(':')
  if (idx <= 0) {
    return { category: fullId, id: fullId }
  }
  return {
    category: fullId.slice(0, idx),
    id: fullId.slice(idx + 1),
  }
}

export function getCategory(fullId: string): string {
  const idx = fullId.indexOf(':')
  return idx > 0 ? fullId.slice(0, idx) : fullId
}

export function getId(fullId: string): string {
  const idx = fullId.indexOf(':')
  return idx > 0 ? fullId.slice(idx + 1) : fullId
}

export function buildResourceId(category: string, id: string): string {
  return `${category}:${id}`
}
