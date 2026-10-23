import type { UnitDefinition, UnitExpression, PrefixDefinition, UnitSnapshot } from '@/common/types/units'

/**
 * Reject invalid physical values at the unit boundary.
 * @returns The validated finite value.
 * @param value - Numeric value to validate or convert.
 */
export function finite(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Quantity must be finite')
  return value
}

/**
 * Reject zero and negative durations, scales and TPS.
 * @returns The validated positive value.
 * @param value - Numeric value to validate or convert.
 */
export function positive(value: number): number {
  if (finite(value) <= 0) throw new Error('Value must be positive')
  return value
}

/** Immutable canonical multiplier and atomic dimension map. */
interface NormalizedUnit {
  scale: number
  dimensions: Readonly<Record<string, number>>
}

/** Registry owns expansion and all conversion rules. */
export class UnitRegistry {
  readonly definitions: readonly UnitDefinition[]
  readonly prefixes: readonly PrefixDefinition[]

  /** Build a validated immutable registry.
   * @param definitions - Atomic and explicitly derived unit definitions.
   * @param prefixes - Independently registered scale prefixes.
   */
  constructor(definitions: readonly UnitDefinition[], prefixes: readonly PrefixDefinition[]) {
    this.definitions = Object.freeze(structuredClone(definitions).map((d) => Object.freeze({ ...d, derived: d.derived && Object.freeze(d.derived.map((f) => Object.freeze(f))) })))
    this.prefixes = Object.freeze(structuredClone(prefixes).map((p) => Object.freeze(p)))
    for (const rows of [this.definitions, this.prefixes]) {
      if (new Set(rows.map((r) => r.id)).size !== rows.length) throw new Error('Duplicate unit/prefix identity')
      if (rows.some((r) => !r.id)) throw new Error('Empty unit/prefix identity')
    }
    this.prefixes.forEach((p) => positive(p.scale))
    this.definitions.forEach((d) => {
      positive(d.scale ?? 1)
      finite(d.offset ?? 0)
      this.normalize([{ baseUnitId: d.id, exponent: 1 }], [], true)
    })
    Object.freeze(this)
  }

  /** Expand and sort a unit product without losing its multiplier.
   * @param expression - Structured factors to normalize.
   * @param ancestors - Definition identities visited during expansion.
   * @param allowOffset - Allow a definition-only validation of affine units.
   * @returns Canonical multiplier and atomic exponents.
   */
  normalize(expression: UnitExpression, ancestors: string[] = [], allowOffset = false): NormalizedUnit {
    let scale = 1
    const dimensions: Record<string, number> = Object.create(null)
    for (const factor of expression) {
      if (!Number.isSafeInteger(factor.exponent)) throw new Error('Unit powers must be integers')
      const def = this.definitions.find((d) => d.id === factor.baseUnitId)
      if (!def) throw new Error(`Unknown unit: ${factor.baseUnitId}`)
      if (ancestors.includes(def.id)) throw new Error(`Cyclic unit definition: ${def.id}`)
      if (def.offset && !allowOffset) throw new Error('Affine absolute units cannot participate in linear algebra')
      const prefix = factor.prefixId === undefined ? undefined : this.prefixes.find((p) => p.id === factor.prefixId)
      if (factor.prefixId !== undefined && !prefix) throw new Error(`Unknown prefix: ${factor.prefixId}`)
      const expanded = def.derived
        ? this.normalize(def.derived, [...ancestors, def.id])
        : { scale: 1, dimensions: { [def.id]: 1 } }
      scale = positive(scale * ((def.scale ?? 1) * (prefix?.scale ?? 1) * expanded.scale) ** factor.exponent)
      for (const [id, exponent] of Object.entries(expanded.dimensions)) {
        dimensions[id] = (dimensions[id] ?? 0) + exponent * factor.exponent
        if (!Number.isSafeInteger(dimensions[id])) throw new Error('Unit power overflow')
      }
    }
    return { scale, dimensions: Object.fromEntries(Object.entries(dimensions).filter(([, e]) => e !== 0).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) }
  }
}

/** Immutable structured unit expression tied to a registry snapshot. */
export class Unit {
  readonly expression: UnitExpression

  readonly registry: UnitRegistry

  /** Create an immutable, validated expression.
   * @param registry - Registry snapshot that owns the unit.
   * @param expression - Structured unit factors.
   */
  constructor(registry: UnitRegistry, expression: UnitExpression) {
    this.registry = registry
    registry.normalize(expression)
    this.expression = Object.freeze(expression.map((f) => Object.freeze({ ...f })))
    Object.freeze(this)
  }

  /** Combine two products from the same registry.
   * @param other - Unit to multiply by.
   * @returns New product unit.
   */
  multiply(other: Unit): Unit {
    this.assertRegistry(other)
    return new Unit(this.registry, [...this.expression, ...other.expression])
  }

  /** Divide by a compatible registry product.
   * @param other - Denominator unit.
   * @returns New quotient unit.
   */
  divide(other: Unit): Unit { return this.multiply(other.pow(-1)) }

  /** Apply an integer power to every factor.
   * @param exponent - Integer power.
   * @returns New powered unit.
   */
  pow(exponent: number): Unit {
    if (!Number.isSafeInteger(exponent)) throw new Error('Unit powers must be integers')
    return new Unit(this.registry, this.expression.map((f) => ({ ...f, exponent: f.exponent * exponent })))
  }

  /** Replace the prefix of a single unit factor.
   * @param prefixId - Registered prefix identity.
   * @returns New prefixed unit.
   */
  withPrefix(prefixId: string): Unit {
    if (this.expression.length !== 1 || this.expression[0].exponent !== 1) throw new Error('Prefix requires a single unit')
    return new Unit(this.registry, [{ ...this.expression[0], prefixId }])
  }

  /** Reject arithmetic across different environment snapshots.
   * @param other - Unit whose registry must match.
   */
  assertRegistry(other: Unit): void {
    if (this.registry !== other.registry) throw new Error('Units belong to different environment snapshots')
  }

  /** Compute the multiplier for an explicitly compatible target.
   * @param other - Target unit.
   * @returns Linear conversion multiplier.
   */
  conversionScale(other: Unit): number {
    this.assertRegistry(other)
    const a = this.registry.normalize(this.expression)
    const b = this.registry.normalize(other.expression)
    if (JSON.stringify(a.dimensions) !== JSON.stringify(b.dimensions)) throw new Error('Incompatible units')
    return positive(a.scale / b.scale)
  }

  /** Format structured factors without interpreting symbols.
   * @returns Display label for the expression.
   */
  toString(): string {
    const symbols = this.expression.map((f) => {
      const symbol = (this.registry.prefixes.find((p) => p.id === f.prefixId)?.symbol ?? '') + this.registry.definitions.find((d) => d.id === f.baseUnitId)!.symbol
      return { symbol, exponent: f.exponent }
    })
    const part = (sign: number) => symbols.filter((f) => f.exponent * sign > 0).map((f) => `${f.symbol}${Math.abs(f.exponent) === 1 ? '' : `^${Math.abs(f.exponent)}`}`).join('·')
    return `${part(1) || '1'}${part(-1) ? `/${part(-1)}` : ''}`
  }
}

/** Finite quantity; conversion and arithmetic preserve full numerical precision. */
export class Quantity {
  readonly value: number
  readonly unit: Unit
  /** Create a finite immutable quantity.
   * @param value - Finite numeric amount.
   * @param unit - Unit of that amount.
   */
  private constructor(value: number, unit: Unit) {
    this.value = finite(value)
    this.unit = unit
    Object.freeze(this)
  }
  /** Construct a quantity from a finite value and unit.
   * @param value - Finite numeric amount.
   * @param unit - Unit of that amount.
   * @returns New immutable quantity.
   */
  static of(value: number, unit: Unit): Quantity { return new Quantity(value, unit) }
  /** Convert the value without rounding.
   * @param unit - Compatible target unit.
   * @returns Converted quantity.
   */
  to(unit: Unit): Quantity { return Quantity.of(finite(this.value * this.unit.conversionScale(unit)), unit) }
  /** Add quantities after compatible conversion.
   * @param other - Quantity to add.
   * @returns Sum in this quantity’s unit.
   */
  add(other: Quantity): Quantity { return Quantity.of(this.value + other.to(this.unit).value, this.unit) }
  /** Subtract quantities after compatible conversion.
   * @param other - Quantity to subtract.
   * @returns Difference in this quantity’s unit.
   */
  subtract(other: Quantity): Quantity { return Quantity.of(this.value - other.to(this.unit).value, this.unit) }
  /** Multiply numeric values and unit factors.
   * @param other - Quantity to multiply by.
   * @returns Product quantity.
   */
  multiply(other: Quantity): Quantity { return Quantity.of(this.value * other.value, this.unit.multiply(other.unit)) }
  /** Divide numeric values and unit factors, rejecting zero.
   * @param other - Nonzero denominator quantity.
   * @returns Quotient quantity.
   */
  divide(other: Quantity): Quantity {
    if (other.value === 0) throw new Error('Division by zero')
    return Quantity.of(this.value / other.value, this.unit.divide(other.unit))
  }
  /** Raise value and unit to an integer power.
   * @param exponent - Integer power.
   * @returns Powered quantity.
   */
  pow(exponent: number): Quantity { return Quantity.of(this.value ** exponent, this.unit.pow(exponent)) }
}

/** One explicit environment owns tick conversion and unit algebra. */
export class UnitSystem {
  readonly registry: UnitRegistry
  readonly snapshot: UnitSnapshot

  /** Capture one reproducible environment and resolve its tick relation.
   * @param snapshot - Serializable definitions, prefixes and positive TPS.
   */
  constructor(snapshot: UnitSnapshot) {
    positive(snapshot.ticksPerSecond)
    // Validate supplied definitions before replacing the environment-dependent tick scale.
    new UnitRegistry(snapshot.definitions, snapshot.prefixes)
    const second = snapshot.definitions.find((d) => d.id === 's')
    if (second?.derived || second?.offset || (second?.scale ?? 1) !== 1) throw new Error('Second must be the canonical time atom')
    const tick = snapshot.definitions.find((d) => d.id === 'tick')
    if (tick?.offset) throw new Error('Tick must be a linear environment time unit')
    this.registry = new UnitRegistry(snapshot.definitions.map((d) => d.id === 'tick' ? { ...d, scale: 1 / snapshot.ticksPerSecond, derived: [{ baseUnitId: 's', exponent: 1 }] } : d), snapshot.prefixes)
    this.snapshot = Object.freeze({ ticksPerSecond: snapshot.ticksPerSecond, definitions: this.registry.definitions, prefixes: this.registry.prefixes })
    Object.freeze(this)
  }

  /** Resolve a registered unit identity.
   * @param id - Unit identity.
   * @returns Immutable unit.
   */
  unit(id: string): Unit { return this.expression([{ baseUnitId: id, exponent: 1 }]) }
  /** Construct a structured unit product.
   * @param expression - Unit factors.
   * @returns Immutable unit product.
   */
  expression(expression: UnitExpression): Unit { return new Unit(this.registry, expression) }
  /** Convert ticks using this environment.
   * @param value - Finite tick count.
   * @returns Duration in seconds.
   */
  ticksToSeconds(value: number): number { return Quantity.of(value, this.unit('tick')).to(this.unit('s')).value }
  /** Convert seconds using this environment.
   * @param value - Finite duration in seconds.
   * @returns Duration in ticks.
   */
  secondsToTicks(value: number): number { return Quantity.of(value, this.unit('s')).to(this.unit('tick')).value }

  /**
   * Recognize declared native rates or explicit time denominators without guessing from physical dimensions.
   * @param expression - Structured unit factors.
   * @returns Whether legacy time scaling has already been expressed in the unit.
   */
  isNativeRate(expression: UnitExpression): boolean {
    const timePower = expression.reduce((power, factor) => {
      const def = this.registry.definitions.find((d) => d.id === factor.baseUnitId)
      const dimensions = this.registry.normalize([{ ...factor, exponent: 1 }]).dimensions
      const isTime = Object.keys(dimensions).length === 1 && dimensions.s === 1
      return power + factor.exponent * (isTime ? 1 : def?.nativeRate ? -1 : 0)
    }, 0)
    return timePower < 0
  }

  /**
   * Adapt legacy editing intent once; native rates already include time.
   * @returns Rate quantity retaining its unit expression.
   * @param value - Numeric value to validate or convert.
   * @param expression - Structured unit factors.
   * @param timeBase - Legacy amount/time editing intent.
   * @param durationSeconds - Finite positive cycle duration in seconds.
   */
  rateQuantity(value: number, expression: UnitExpression, timeBase: string, durationSeconds: number): Quantity {
    positive(durationSeconds)
    if (!['per_cycle', 'rate_per_tick', 'rate_per_sec'].includes(timeBase)) throw new Error(`Unknown time base: ${timeBase}`)
    let amount = Quantity.of(value, this.expression(expression))
    if (!this.isNativeRate(expression)) {
      if (timeBase === 'per_cycle') amount = amount.divide(Quantity.of(durationSeconds, this.unit('s')))
      else if (timeBase === 'rate_per_tick') amount = amount.divide(Quantity.of(1, this.unit('tick')))
      else if (timeBase === 'rate_per_sec') amount = amount.divide(Quantity.of(1, this.unit('s')))
      else throw new Error(`Unknown time base: ${timeBase}`)
    }
    return amount
  }

  /**
   * Canonical scalar rate for the solver; dimensional validation stays in the domain.
   * @returns Canonical scalar rate without rounding.
   * @param value - Numeric value to validate or convert.
   * @param expression - Structured unit factors.
   * @param timeBase - Legacy amount/time editing intent.
   * @param durationSeconds - Finite positive cycle duration in seconds.
   */
  toRate(value: number, expression: UnitExpression, timeBase: string, durationSeconds: number): number {
    const amount = this.rateQuantity(value, expression, timeBase, durationSeconds)
    return finite(amount.value * this.registry.normalize(amount.unit.expression).scale)
  }

  /**
   * Inverse display conversion delegates to exactly the same rate adapter.
   * @returns Value in the selected display expression.
   * @param value - Numeric value to validate or convert.
   * @param expression - Structured unit factors.
   * @param timeBase - Legacy amount/time editing intent.
   * @param durationSeconds - Finite positive cycle duration in seconds.
   */
  fromRate(value: number, expression: UnitExpression, timeBase: string, durationSeconds = 1): number {
    return finite(value / this.toRate(1, expression, timeBase, durationSeconds))
  }
}
