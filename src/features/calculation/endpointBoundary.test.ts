import { describe, expect, it } from 'vitest'
import { UnitSystem } from '@/common/units/UnitSystem'
import { DEFAULT_UNIT_SNAPSHOT, defaultResourceUnit } from '@/common/units/defaults'
import { emptyNetworkConfiguration, type Boundary } from './networkConfig'
import { changeEndpointBoundaryAmount, changeEndpointBoundaryMode, replaceEndpointBoundary, replaceEndpointBoundaries } from './endpointBoundary'
import { portKey } from './topology'

describe('direct endpoint boundary controls', () => {
  it('batches distinct port quantities without changing unrelated policies', () => {
    const configuration = emptyNetworkConfiguration()
    configuration.ports[portKey('other', 'a')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' }, boundary: { kind: 'source', capacity: 99 } }
    const next = replaceEndpointBoundaries(configuration, 's', {
      a: { kind: 'source', capacity: 2 },
      b: { kind: 'source', capacity: 7 },
    })
    expect(next.ports[portKey('s', 'a')].boundary).toEqual({ kind: 'source', capacity: 2 })
    expect(next.ports[portKey('s', 'b')].boundary).toEqual({ kind: 'source', capacity: 7 })
    expect(next.ports[portKey('other', 'a')]).toEqual(configuration.ports[portKey('other', 'a')])
    expect(Object.keys(configuration.ports)).toEqual([portKey('other', 'a')])
  })
  it('rejects the entire batch when a port has non-flow semantics', () => {
    const configuration = emptyNetworkConfiguration()
    configuration.ports[portKey('s', 'b')] = { scopeId: 'document', busId: 'default', semantics: { kind: 'capacity', available: 4 } }
    const before = structuredClone(configuration)
    expect(() => replaceEndpointBoundaries(configuration, 's', {
      a: { kind: 'source', capacity: 2 },
      b: { kind: 'source', capacity: 7 },
    })).toThrow('容量与状态')
    expect(configuration).toEqual(before)
  })
  it('switches explicit source unlimited/limited without writing legacy node modes or losing supply cost', () => {
    const cost = { priority: 4, weight: 2, scale: 5 }
    const previous: Boundary = { kind: 'source', capacity: 0.25, cost }
    expect(changeEndpointBoundaryMode(previous, 'unlimited', 100)).toEqual({ kind: 'source', capacity: null, cost })
    expect(changeEndpointBoundaryMode({ kind: 'source', capacity: null, cost }, 'limited', 0.25)).toEqual(previous)
    expect(previous.capacity).toBe(0.25)
  })
  it('keeps historical demand as at-least and spill distinct from product export', () => {
    expect(changeEndpointBoundaryMode(undefined, 'demand', 12)).toMatchObject({ kind: 'delivery', mode: 'at_least', amount: 12 })
    expect(changeEndpointBoundaryMode(undefined, 'spill', 12)).toEqual({ kind: 'spill', capacity: null })
    expect(changeEndpointBoundaryMode(undefined, 'export', 12)).toEqual({ kind: 'delivery', mode: 'export', amount: 0, capacity: null })
    expect(changeEndpointBoundaryMode(undefined, 'maximize', 12)).toMatchObject({ kind: 'delivery', mode: 'maximize', amount: 0, objective: { priority: 0, weight: 1, scale: 1 } })
  })
  it('preserves exact/at-least mode, receive cap and objectives when only changing a quantity', () => {
    const exact: Boundary = { kind: 'delivery', mode: 'exact', amount: 10, capacity: 20 }
    expect(changeEndpointBoundaryAmount(exact, 1.2)).toEqual({ ...exact, amount: 1.2 })
    const minimum: Boundary = { ...exact, mode: 'at_least' }
    expect(changeEndpointBoundaryAmount(minimum, 2)).toEqual({ ...minimum, amount: 2 })
    expect(exact.amount).toBe(10)
  })
  it('retains canonical fractional quantities when card input units differ from solver units', () => {
    const units = new UnitSystem(DEFAULT_UNIT_SNAPSHOT)
    const kilograms = [{ baseUnitId: 'g', prefixId: 'k', exponent: 1 }]
    const canonical = units.toRate(0.25, kilograms, 'rate_per_sec', 1)
    const boundary = changeEndpointBoundaryAmount({ kind: 'source', capacity: 1 }, canonical)
    expect(boundary).toEqual({ kind: 'source', capacity: 250 })
    expect(units.fromRate(canonical, kilograms, 'rate_per_sec')).toBe(0.25)
    expect(units.toRate(0.25, defaultResourceUnit('item', 'ore'), 'rate_per_sec', 1)).toBe(0.25)
  })
  it('replaces only the addressed boundary and preserves scope, bus, semantics and unrelated policies', () => {
    const configuration = emptyNetworkConfiguration()
    configuration.ports[portKey('s', 'a')] = { scopeId: 'scope', busId: 'bus', semantics: { kind: 'flow' }, boundary: { kind: 'source', capacity: null } }
    configuration.ports[portKey('s', 'b')] = { scopeId: 'other', busId: 'other', semantics: { kind: 'flow' }, boundary: { kind: 'source', capacity: 7 } }
    configuration.machines.r = { installed: 3, operatingUpper: null }
    const next = replaceEndpointBoundary(configuration, 's', 'a', { kind: 'source', capacity: 0.25 })
    expect(next.ports[portKey('s', 'a')]).toMatchObject({ scopeId: 'scope', busId: 'bus', boundary: { capacity: 0.25 } })
    expect(next.ports[portKey('s', 'b')]).toEqual(configuration.ports[portKey('s', 'b')])
    expect(next.machines).toEqual(configuration.machines)
    expect(configuration.ports[portKey('s', 'a')].boundary).toEqual({ kind: 'source', capacity: null })
  })
  it('rejects invalid quantities and does not silently convert capacity or state to flow', () => {
    for (const value of [-1, NaN, Infinity]) expect(() => changeEndpointBoundaryAmount({ kind: 'source', capacity: 1 }, value)).toThrow()
    expect(() => changeEndpointBoundaryAmount({ kind: 'source', capacity: null }, 1)).toThrow()
    const configuration = emptyNetworkConfiguration()
    configuration.ports[portKey('s', 'p')] = { scopeId: 'scope', busId: 'bus', semantics: { kind: 'capacity', available: 4 } }
    expect(() => replaceEndpointBoundary(configuration, 's', 'p', { kind: 'source', capacity: 2 })).toThrow()
  })
})
