/**
 * The default resource category assigned when no category prefix is present
 * in a resource ID string.
 */
export const DEFAULT_RESOURCE_CATEGORY = 'item'

/**
 * The result of parsing a resource ID string into its category and id components.
 */
export interface ParsedResourceId {
  /** The resource category (e.g. "item", "fluid"). */
  category: string
  /** The resource identifier within its category. */
  id: string
}

/**
 * Parse a resource ID string of the form `"category:id"` into its components.
 * If no colon separator is found, the entire string is treated as the resource
 * ID and the default category (`"item"`) is used.
 *
 * @param raw - The raw resource identifier string.
 * @returns An object with `category` and `id` properties.
 *
 * @example
 * parseResourceId("fluid:water")       // => { category: "fluid", id: "water" }
 * parseResourceId("iron_ingot")        // => { category: "item", id: "iron_ingot" }
 * parseResourceId("item:iron_ingot")   // => { category: "item", id: "iron_ingot" }
 */
export const parseResourceId = (raw: string): ParsedResourceId => {
  const idx = raw.indexOf(':')
  if (idx === -1) return { category: DEFAULT_RESOURCE_CATEGORY, id: raw }
  return {
    category: raw.slice(0, idx),
    id: raw.slice(idx + 1),
  }
}

/**
 * Build a fully qualified resource ID string from a category and identifier.
 *
 * @param category - The resource category (e.g. "item", "fluid").
 * @param id - The resource identifier within its category.
 * @returns A string in the form `"category:id"`.
 *
 * @example
 * buildResourceId("fluid", "water")    // => "fluid:water"
 * buildResourceId("item", "iron_ingot") // => "item:iron_ingot"
 */
export const buildResourceId = (category: string, id: string): string =>
  `${category}:${id}`

/**
 * Extract the category portion from a resource ID string.
 *
 * @param raw - The raw resource identifier string.
 * @returns The category component.
 *
 * @example
 * getCategory("fluid:water")   // => "fluid"
 * getCategory("iron_ingot")    // => "item"
 */
export const getCategory = (raw: string): string =>
  parseResourceId(raw).category

/**
 * Extract the ID portion (without category) from a resource ID string.
 *
 * @param raw - The raw resource identifier string.
 * @returns The identifier component.
 *
 * @example
 * getId("fluid:water")      // => "water"
 * getId("item:iron_ingot")  // => "iron_ingot"
 */
export const getId = (raw: string): string =>
  parseResourceId(raw).id

/** Prefix for network-routed names. */
export const NET_PREFIX = 'Net_'
/** Prefix for globally-routed names. */
export const GLOBAL_PREFIX = 'Global_'
/** Prefix for void/sink names. */
export const VOID_PREFIX = 'Void_'
/** Prefix for virtual global names used internally by the solver. */
export const VIRTUAL_GLOBAL_PREFIX = 'Virtual_Global_'

/**
 * Build a network-routed name from a resource ID and a suffix.
 *
 * @param resourceId - The fully qualified resource ID.
 * @param suffix - A disambiguation suffix (e.g. "in", "out").
 * @returns A string with the `Net_` prefix.
 *
 * @example
 * buildNetName("item:iron_ingot", "in") // => "Net_item:iron_ingot_in"
 */
export const buildNetName = (resourceId: string, suffix: string): string =>
  `${NET_PREFIX}${resourceId}_${suffix}`

/**
 * Build a globally-routed name from a qualifier string.
 *
 * @param qualifier - The global qualifier (e.g. a resource or category name).
 * @returns A string with the `Global_` prefix.
 *
 * @example
 * buildGlobalName("item:iron_ingot") // => "Global_item:iron_ingot"
 */
export const buildGlobalName = (qualifier: string): string =>
  `${GLOBAL_PREFIX}${qualifier}`

/**
 * Build a void/sink name from a node ID and a fully qualified resource ID.
 *
 * @param nodeId - The ID of the void node.
 * @param fullId - The fully qualified resource ID being voided.
 * @returns A string with the `Void_` prefix.
 *
 * @example
 * buildVoidName("node_1", "item:iron_ingot") // => "Void_node_1_item:iron_ingot"
 */
export const buildVoidName = (nodeId: string, fullId: string): string =>
  `${VOID_PREFIX}${nodeId}_${fullId}`

/**
 * Check whether a name has the network-routed prefix.
 *
 * @param name - The name to check.
 * @returns `true` if the name starts with `Net_`.
 */
export const isNetName = (name: string): boolean =>
  name.startsWith(NET_PREFIX)

/**
 * Check whether a name has the void/sink prefix.
 *
 * @param name - The name to check.
 * @returns `true` if the name starts with `Void_`.
 */
export const isVoidName = (name: string): boolean =>
  name.startsWith(VOID_PREFIX)

/**
 * Check whether a name has the global prefix.
 *
 * @param name - The name to check.
 * @returns `true` if the name starts with `Global_`.
 */
export const isGlobalName = (name: string): boolean =>
  name.startsWith(GLOBAL_PREFIX)

/**
 * Check whether a name has any routed prefix (Net_, Void_, or Global_).
 *
 * @param name - The name to check.
 * @returns `true` if the name is a routed name.
 */
export const isRoutedName = (name: string): boolean =>
  isNetName(name) || isVoidName(name) || isGlobalName(name)

/**
 * Check whether a name has the virtual global prefix.
 *
 * @param name - The name to check.
 * @returns `true` if the name starts with `Virtual_Global_`.
 */
export const isVirtualGlobal = (name: string): boolean =>
  name.startsWith(VIRTUAL_GLOBAL_PREFIX)

/**
 * Parse a network-routed name back into its resource ID and suffix components.
 *
 * @param name - The network-routed name (starting with `Net_`).
 * @returns An object with `resourceId` and `suffix`, or `null` if the name
 *          is not a valid network name.
 *
 * @example
 * parseNetName("Net_item:iron_ingot_in")
 * // => { resourceId: "item:iron_ingot", suffix: "in" }
 *
 * parseNetName("not_a_net_name")
 * // => null
 */
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

/**
 * Parse a void/sink name back into its node ID and resource ID components.
 *
 * @param name - The void name (starting with `Void_`).
 * @returns An object with `nodeId` and `fullId`, or `null` if the name is
 *          not a valid void name.
 *
 * @example
 * parseVoidName("Void_node_1_item:iron_ingot")
 * // => { nodeId: "node_1", fullId: "item:iron_ingot" }
 *
 * parseVoidName("not_a_void_name")
 * // => null
 */
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
 * Normalize a raw resource key by stripping any routing prefix and then
 * parsing and rebuilding it as a canonical `"category:id"` string.
 *
 * @param raw - The raw resource key (may include Net_/Void_/Global_ prefix).
 * @returns The canonical resource ID in `"category:id"` form.
 *
 * @example
 * normalizeResourceKey("Net_item:iron_ingot_in") // => "item:iron_ingot"
 * normalizeResourceKey("fluid:water")            // => "fluid:water"
 */
export const normalizeResourceKey = (raw: string): string => {
  const stripped = stripNetPrefix(raw)
  const parsed = parseResourceId(stripped)
  return buildResourceId(parsed.category, parsed.id)
}

/**
 * Parse a normalized resource key by first stripping any routing prefix,
 * then parsing the result into category and id components.
 *
 * @param raw - The raw resource key (may include Net_/Void_/Global_ prefix).
 * @returns The parsed category and id.
 *
 * @example
 * parseNormalizedKey("Net_item:iron_ingot_in")
 * // => { category: "item", id: "iron_ingot" }
 */
export const parseNormalizedKey = (raw: string): ParsedResourceId =>
  parseResourceId(stripNetPrefix(raw))

/**
 * Strip any routing prefix (Net_, Void_, Global_) from a name, returning
 * the inner resource identifier.
 *
 * @param name - The name possibly prefixed with a routing marker.
 * @returns The name with the routing prefix removed.
 *
 * @example
 * stripNetPrefix("Net_item:iron_ingot_in")    // => "item:iron_ingot"
 * stripNetPrefix("Global_item:iron_ingot")    // => "item:iron_ingot"
 * stripNetPrefix("Void_node_1_item:iron_ingot") // => "item:iron_ingot"
 * stripNetPrefix("item:iron_ingot")           // => "item:iron_ingot"
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
