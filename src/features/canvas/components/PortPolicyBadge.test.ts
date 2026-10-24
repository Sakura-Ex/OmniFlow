import { expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortPolicyBadge } from './PortPolicyBadge'
import { PortSupplyStatus } from './PortSupplyStatus'
import type { NetworkPortConfiguration } from '@/common/schemas/network.schema'

it('uses quantity formatting for capacity and state, and rate formatting for flow caps', () => {
  const policy: NetworkPortConfiguration = { scopeId: 'document', busId: 'default', semantics: { kind: 'capacity', available: 2 } }
  const formatAmount = (amount: number) => `${amount * 1000} mL/s`
  const formatQuantity = (amount: number) => `${amount * 1000} mL`
  const render = () => renderToStaticMarkup(createElement(PortPolicyBadge, { policy, formatAmount, formatQuantity }))
  expect(render()).toContain('容量 2000 mL')
  expect(render()).not.toContain('mL/s')
  policy.semantics = { kind: 'state', actual: 3 }
  expect(render()).toContain('状态 3000 mL')
  expect(render()).not.toContain('mL/s')
  policy.semantics = { kind: 'flow' }
  policy.boundary = { kind: 'source', capacity: 4 }
  expect(render()).toContain('4000 mL/s')
})

it('hides routine flow policy text together while preserving non-flow semantics in summary views', () => {
  const policy: NetworkPortConfiguration = { scopeId: 'document', busId: 'default', semantics: { kind: 'flow' } }
  const formatAmount = (amount: number) => `${amount} L/s`
  const render = (presentation: 'summary' | 'detailed') => renderToStaticMarkup(createElement(PortPolicyBadge, { policy, formatAmount, formatQuantity: amount => `${amount} L`, presentation }))
  const boundaries: NonNullable<NetworkPortConfiguration['boundary']>[] = [
    { kind: 'source', capacity: null },
    { kind: 'source', capacity: 4 },
    { kind: 'spill', capacity: null },
    { kind: 'forbid_spill' },
  ]
  for (const boundary of boundaries) {
    policy.boundary = boundary
    expect(render('summary')).toBe('')
    expect(render('detailed')).not.toBe('')
  }
  policy.semantics = { kind: 'capacity', available: 2 }
  expect(render('summary')).toContain('容量 2 L')
  expect(render('summary')).not.toContain('L/s')
  policy.semantics = { kind: 'state', actual: 3 }
  expect(render('summary')).toContain('状态 3 L')
})

it('marks only explicit flow supply, independently of routing identity', () => {
  const policy: NetworkPortConfiguration = { scopeId: 'document', busId: 'power', semantics: { kind: 'flow' } }
  const render = () => renderToStaticMarkup(createElement(PortSupplyStatus, { name: 'Water', policy, formatAmount: amount => `${amount * 1000} mL/s` }))
  expect(render()).toBe('')
  policy.boundary = { kind: 'source', capacity: null }
  expect(render()).toContain('role="img"')
  expect(render()).toContain('供应充足')
  policy.boundary = { kind: 'source', capacity: 4 }
  expect(render()).toContain('4000 mL/s')
  policy.semantics = { kind: 'capacity', available: 4 }
  expect(render()).toBe('')
  policy.semantics = { kind: 'state', actual: 4 }
  expect(render()).toBe('')
})
