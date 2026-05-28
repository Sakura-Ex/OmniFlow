import type { TimeBase } from '@/common/types/resource'

/**
 * Defines a resource category — the top-level grouping of resources
 * (e.g. "item", "fluid", "energy").
 */
export interface ResourceCategoryDef {
  /** Unique identifier for the category (e.g. "item"). */
  id: string
  /** Human-readable display name (e.g. "Items"). */
  displayName: string
  /** Base unit string for amounts in this category (e.g. "mb", "items"). */
  base_unit: string
  /** Theme color for UI rendering (CSS color string). */
  themeColor: string
  /** The default time base to use when displaying amounts in this category. */
  preferred_time_base: TimeBase
}

/**
 * An optional per-resource override for the display unit.
 */
export interface UnitOverride {
  /** Custom unit label to display instead of the category default. */
  unit_override?: string
}

/**
 * A single resource entry registered in the global resource table.
 */
export interface ResourceEntry {
  /** Fully qualified resource ID (e.g. "item:iron_ingot"). */
  fullId: string
  /** Optional human-readable display name. */
  displayName?: string
}

/**
 * Fully resolved display properties for a resource, computed by merging
 * the category definition, any per-resource overrides, and fallback values.
 */
export interface ResolvedResourceProps {
  /** Display unit string (from override or category default). */
  unit: string
  /** Theme color from the category definition. */
  themeColor: string
  /** Display name (from entry or a fallback based on fullId). */
  displayName: string
  /** Preferred time base from the category definition. */
  preferred_time_base: TimeBase
  /** Whether the resource could not be found in any registered category. */
  is_unknown: boolean
}

/**
 * State interface for a global resource lookup table that manages categories,
 * per-resource overrides, entries, and property resolution.
 */
export interface GlobalResourceTableState {
  /** All registered resource categories, keyed by category ID. */
  categories: Record<string, ResourceCategoryDef>
  /** Per-resource unit overrides, keyed by fully qualified resource ID. */
  overrides: Record<string, UnitOverride>
  /** Registered resource entries, keyed by fully qualified resource ID. */
  entries: Record<string, ResourceEntry>

  /** Register a new resource category. */
  addCategory: (def: ResourceCategoryDef) => void
  /** Partially update an existing category definition. */
  updateCategory: (id: string, patch: Partial<ResourceCategoryDef>) => void
  /** Remove a category and all its associated resources. */
  removeCategory: (id: string) => void

  /** Set or update a unit override for a specific resource. */
  setOverride: (fullId: string, def: UnitOverride) => void
  /** Remove a unit override for a specific resource. */
  removeOverride: (fullId: string) => void

  /** Ensure a resource entry exists, creating a default one if necessary. */
  ensureEntry: (fullId: string) => void
  /** Partially update an existing resource entry. */
  setEntry: (fullId: string, patch: Partial<ResourceEntry>) => void
  /** Remove a resource entry. */
  removeEntry: (fullId: string) => void

  /** Resolve the full display properties for a given resource ID. */
  resolve: (fullId: string) => ResolvedResourceProps
}
