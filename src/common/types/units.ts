/** JSON unit product; identity never depends on parsing a display symbol. */
export interface UnitFactor {
  baseUnitId: string
  prefixId?: string
  exponent: number
}

/** Serializable product, quotient and integer powers of registered units. */
export type UnitExpression = readonly UnitFactor[]

/** Atomic or explicitly derived unit definition. */
export interface UnitDefinition {
  id: string
  symbol: string
  scale?: number
  offset?: number
  /** Native rates (e.g. W) already include their time denominator. */
  nativeRate?: boolean
  derived?: UnitExpression
}

/** Scale prefixes are registered separately from units. */
export interface PrefixDefinition {
  id: string
  symbol: string
  scale: number
}

/** Complete reproducible environment; runtime class instances are never persisted. */
export interface UnitSnapshot {
  ticksPerSecond: number
  definitions: readonly UnitDefinition[]
  prefixes: readonly PrefixDefinition[]
}
