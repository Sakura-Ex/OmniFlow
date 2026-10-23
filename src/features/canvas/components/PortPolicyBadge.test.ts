import { expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortPolicyBadge } from './PortPolicyBadge'
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
