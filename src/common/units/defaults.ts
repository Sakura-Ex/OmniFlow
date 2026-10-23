import type { UnitExpression, UnitSnapshot } from '@/common/types/units'

/** Explicit game mappings; mB is an independent atom unless a game declares a relation. */
export const DEFAULT_UNIT_SNAPSHOT: UnitSnapshot = {
  ticksPerSecond: 20,
  prefixes: [
    { id: 'k', symbol: 'k', scale: 1000 },
    { id: 'milli', symbol: 'm', scale: 0.001 },
    { id: 'micro', symbol: 'µ', scale: 0.000001 },
    { id: 'mega', symbol: 'M', scale: 1000000 },
  ],
  definitions: [
    ...['s', 'g', 'm', 'L', 'J', 'EU', 'RF', 'HU', 'su', 'RPM', 'mB'].map((id) => ({ id, symbol: id })),
    { id: 'item', symbol: '个' },
    { id: 'tick', symbol: 't', scale: 0.05, derived: [{ baseUnitId: 's', exponent: 1 }] },
    { id: 'W', symbol: 'W', nativeRate: true, derived: [{ baseUnitId: 'J', exponent: 1 }, { baseUnitId: 's', exponent: -1 }] },
  ],
}

/**
 * Migrate exact known labels only, preserving unknown labels as separate atoms.
 * @returns Explicitly mapped factors or a separate legacy atom.
 * @param label - Exact legacy unit label; arbitrary prefix parsing is forbidden.
 */
export function legacyUnit(label: string): UnitExpression {
  const id = label === '个' ? 'item' : label
  if (id === 'kg') return [{ baseUnitId: 'g', prefixId: 'k', exponent: 1 }]
  if (id === 'mL') return [{ baseUnitId: 'L', prefixId: 'milli', exponent: 1 }]
  return [{ baseUnitId: DEFAULT_UNIT_SNAPSHOT.definitions.some((d) => d.id === id) ? id : `legacy:${label}`, exponent: 1 }]
}

/**
 * Canonical unit default is resource-specific before category-specific.
 * @returns Declared built-in amount unit factors.
 * @param category - Resource category identity.
 * @param id - Resource identifier within its category.
 */
export function defaultResourceUnit(category: string, id: string): UnitExpression {
  const label = id === 'thermal_rf' ? 'RF' : id === 'create_su' ? 'RPM' : ({ item: '个', fluid: 'mB', energy: 'EU', stress: 'su', heat: 'HU' }[category] ?? category)
  return legacyUnit(label)
}
