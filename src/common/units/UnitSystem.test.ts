import { describe, expect, it } from 'vitest'
import { UnitSystem, Quantity } from './UnitSystem'
import { DEFAULT_UNIT_SNAPSHOT, legacyUnit } from './defaults'

const units = new UnitSystem(DEFAULT_UNIT_SNAPSHOT)
const g = units.unit('g'), s = units.unit('s'), m = units.unit('m')

describe('composable unit algebra', () => {
  it('converts prefixes exactly once and adds compatible quantities', () => {
    const kg = g.withPrefix('k')
    expect(Quantity.of(1, kg).to(g).value).toBe(1000)
    expect(Quantity.of(1, kg).add(Quantity.of(500, g)).value).toBe(1.5)
    expect(Quantity.of(1, kg).subtract(Quantity.of(500, g)).value).toBe(0.5)
  })
  it('composes quotients, powers and cancellations', () => {
    expect(Quantity.of(10, m.divide(s)).multiply(Quantity.of(3, s)).to(m).value).toBe(30)
    expect(m.divide(s.pow(2)).multiply(s).conversionScale(m.divide(s))).toBe(1)
    expect(Quantity.of(3, m).pow(2).value).toBe(9)
    expect(units.registry.normalize(m.divide(m).expression)).toEqual({ scale: 1, dimensions: {} })
  })
  it('expands explicit derived relations without guessing cross-resource relationships', () => {
    expect(units.unit('W').conversionScale(units.unit('J').divide(s))).toBe(1)
    expect(() => Quantity.of(1, g).add(Quantity.of(1, s))).toThrow('Incompatible')
    expect(() => units.unit('EU').conversionScale(units.unit('RF'))).toThrow('Incompatible')
    expect(() => units.unit('mB').conversionScale(units.unit('L'))).toThrow('Incompatible')
    expect(legacyUnit('mysterykg')).toEqual([{ baseUnitId: 'legacy:mysterykg', exponent: 1 }])
  })
  it('rejects affine absolute units instead of multiplying their offsets', () => {
    const affine = new UnitSystem({ ...DEFAULT_UNIT_SNAPSHOT, definitions: [...DEFAULT_UNIT_SNAPSHOT.definitions, { id: 'C', symbol: '°C', offset: 273.15 }] })
    expect(() => affine.unit('C')).toThrow('Affine')
  })
  it.each([NaN, Infinity, -1, 0])('rejects invalid TPS %s', (ticksPerSecond) => {
    expect(() => new UnitSystem({ ...DEFAULT_UNIT_SNAPSHOT, ticksPerSecond })).toThrow()
  })
  it('rejects unknown units/prefixes, invalid powers, division by zero and overflow', () => {
    expect(() => units.unit('unknown')).toThrow('Unknown unit')
    expect(() => g.withPrefix('unknown')).toThrow('Unknown prefix')
    expect(() => g.pow(0.5)).toThrow('integers')
    expect(() => Quantity.of(1, g).divide(Quantity.of(0, s))).toThrow('zero')
    expect(() => Quantity.of(Infinity, g)).toThrow('finite')
    expect(() => g.withPrefix('mega').pow(1000)).toThrow()
  })
  it('rejects duplicate identities and cyclic derived definitions', () => {
    expect(() => new UnitSystem({ ...DEFAULT_UNIT_SNAPSHOT, definitions: [...DEFAULT_UNIT_SNAPSHOT.definitions, { id: 'g', symbol: 'gram' }] })).toThrow('Duplicate')
    expect(() => new UnitSystem({ ...DEFAULT_UNIT_SNAPSHOT, definitions: [
      { id: 'a', symbol: 'a', derived: [{ baseUnitId: 'b', exponent: 1 }] },
      { id: 'b', symbol: 'b', derived: [{ baseUnitId: 'a', exponent: 1 }] },
    ] })).toThrow('Cyclic')
  })
  it('isolates and freezes registry and expression snapshots', () => {
    const input = structuredClone(DEFAULT_UNIT_SNAPSHOT)
    const isolated = new UnitSystem(input)
    expect(Object.isFrozen(isolated.registry.definitions[0])).toBe(true)
    expect(Object.isFrozen(isolated.unit('g').expression[0])).toBe(true)
    expect(() => g.conversionScale(isolated.unit('g'))).toThrow('different environment')
  })
})

describe('single rate adapter', () => {
  it('recomputes tick rates from captured TPS', () => {
    const forty = new UnitSystem({ ...DEFAULT_UNIT_SNAPSHOT, ticksPerSecond: 40 })
    const expression = [{ baseUnitId: 'EU', exponent: 1 }]
    expect(units.toRate(32, expression, 'rate_per_tick', 4)).toBe(640)
    expect(forty.toRate(32, expression, 'rate_per_tick', 4)).toBe(1280)
    expect(forty.ticksToSeconds(forty.secondsToTicks(0.0125))).toBe(0.0125)
  })
  it('converts per-cycle fluid quantities and display prefixes without changing the rate', () => {
    const expression = units.unit('L').expression
    const rate = units.toRate(2, expression, 'per_cycle', 4)
    expect(rate).toBe(0.5)
    expect(units.fromRate(rate, units.unit('L').withPrefix('milli').expression, 'rate_per_sec')).toBe(500)
    expect(units.fromRate(rate, expression, 'per_cycle', 4)).toBe(2)
  })
  it('does not apply time scaling twice to W or EU/tick expressions', () => {
    expect(units.toRate(1, units.unit('W').withPrefix('k').expression, 'per_cycle', 4)).toBe(1000)
    expect(units.toRate(32, units.unit('EU').divide(units.unit('tick')).expression, 'rate_per_tick', 4)).toBe(640)
  })
  it('cancels explicit time factors before deciding whether an expression already represents a rate', () => {
    const distance = m.divide(s).multiply(s)
    expect(units.isNativeRate(distance.expression)).toBe(false)
    expect(units.rateQuantity(10, distance.expression, 'per_cycle', 2).to(m.divide(s)).value).toBe(5)
    const energy = units.unit('W').multiply(s)
    expect(units.isNativeRate(energy.expression)).toBe(false)
    expect(units.rateQuantity(4, energy.expression, 'per_cycle', 2).to(units.unit('W')).value).toBe(2)
  })
  it.each([0, -1, NaN, Infinity])('rejects invalid cycles %s', (duration) => {
    expect(() => units.toRate(2, g.expression, 'per_cycle', duration)).toThrow()
  })
  it('reconstructs JSON expressions, prefixes, derived relations and environment', () => {
    const restored = new UnitSystem(JSON.parse(JSON.stringify(units.snapshot)))
    for (const expression of [g.withPrefix('k').expression, m.divide(s).expression, units.unit('EU').divide(units.unit('tick')).expression]) {
      const quantity = JSON.parse(JSON.stringify({ value: 1.25, unit: expression }))
      expect(restored.registry.normalize(quantity.unit)).toEqual(units.registry.normalize(expression))
    }
  })
})

it('distinguishes an amount with physical time dimensions from a declared native rate', () => {
  const physical = new UnitSystem({ ...DEFAULT_UNIT_SNAPSHOT, definitions: DEFAULT_UNIT_SNAPSHOT.definitions.map((d) => d.id === 'J' ? { ...d, derived: [{ baseUnitId: 'g', exponent: 1 }, { baseUnitId: 'm', exponent: 2 }, { baseUnitId: 's', exponent: -2 }] } : d) })
  const perCycleEnergy = physical.rateQuantity(2, physical.unit('J').expression, 'per_cycle', 4)
  expect(perCycleEnergy.to(physical.unit('J').divide(physical.unit('s'))).value).toBe(0.5)
  expect(physical.rateQuantity(1, physical.unit('W').withPrefix('k').expression, 'per_cycle', 4).to(physical.unit('W')).value).toBe(1000)
})
