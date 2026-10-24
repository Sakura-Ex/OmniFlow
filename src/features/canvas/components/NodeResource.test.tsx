import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NodeQuantity, NodeResourceIdentity, NodeResourceRow } from './NodeResource'
import type { NodeDisplayMode } from '@/common/types/nodeDisplay'

describe('shared resource presentation', () => {
  it.each<NodeDisplayMode>(['compact', 'standard', 'detailed'])('retains resource identity, ports and editors in %s mode', mode => {
    const markup = renderToStaticMarkup(<NodeResourceRow mode={mode}
      identity={<NodeResourceIdentity name="Water" />}
      port={<button aria-label="Water input" data-handleid="water-in" />}
      condition={<input aria-label="Water limit" defaultValue="12" />}
      actual={<NodeQuantity value="8" unit="L/s" />}
      details="water-in details" />)
    expect(markup).toContain('Water input')
    expect(markup).toContain('data-handleid="water-in"')
    expect(markup).toContain('Water limit')
    expect(markup).toContain('value="12"')
    expect(markup).toContain('title="Water"')
    expect(markup.includes('8 L/s')).toBe(mode !== 'compact')
    expect(markup.includes('water-in details')).toBe(mode === 'detailed')
  })

  it('keeps unknown endpoint evidence visible in compact mode without inventing a value', () => {
    const markup = renderToStaticMarkup(<NodeResourceRow mode="compact" actualInCompact
      identity={<NodeResourceIdentity name="Product" />}
      actual={<NodeQuantity value="—" unit="kg/min" outcome="unverified" emphasis="primary" />} />)
    expect(markup).toContain('— kg/min')
    expect(markup).toContain('data-outcome="unverified"')
    expect(markup).not.toContain('data-outcome="met"')
    expect(markup).not.toContain('<strong>0</strong>')
  })
})
