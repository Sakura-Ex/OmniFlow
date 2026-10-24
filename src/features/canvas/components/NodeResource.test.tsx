import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NodeQuantity, NodeResourceIdentity, NodeResourceRow } from './NodeResource'
import type { NodeDisplayMode } from '@/common/types/nodeDisplay'

describe('shared resource presentation', () => {
  it.each<NodeDisplayMode>(['compact', 'standard', 'detailed'])('retains resource identity and ports while disclosing quantities and details in %s mode', mode => {
    const markup = renderToStaticMarkup(<NodeResourceRow mode={mode}
      identity={<NodeResourceIdentity name="Water" />}
      port={<button aria-label="Water input" data-handleid="water-in" />}
      actual={<NodeQuantity value="8" unit="L/s" />}
      details="water-in details" />)
    expect(markup).toContain('Water input')
    expect(markup).toContain('data-handleid="water-in"')
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

  it.each<NodeDisplayMode>(['compact', 'standard', 'detailed'])('keeps validation feedback visible instead of identity details in %s', mode => {
    const markup = renderToStaticMarkup(<NodeResourceRow mode={mode}
      identity={<NodeResourceIdentity name="Product" />}
      feedback={<span role="alert">Invalid amount</span>} details="internal port identity"
      policy={<span>Capacity 100</span>} auxiliaryAction={<button>Inspect details</button>} />)
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Invalid amount')
    expect(markup).not.toContain('internal port identity')
    expect(markup).not.toContain('Capacity 100')
    expect(markup).not.toContain('Inspect details')
  })

  it.each<NodeDisplayMode>(['compact', 'standard', 'detailed'])('retains endpoint inline editors and actual evidence in %s', mode => {
    const markup = renderToStaticMarkup(<NodeResourceRow mode={mode} actualInCompact
      identity={<NodeResourceIdentity name="Water" />}
      actual={<><NodeQuantity value="8" unit="L/s" /><input aria-label="Water limit" defaultValue="12" /></>} />)
    expect(markup).toContain('8 L/s')
    expect(markup).toContain('Water limit')
    expect(markup).toContain('value="12"')
  })

  it('retains both detailed recipe evidence and policy with full-text inspection', () => {
    const markup = renderToStaticMarkup(<NodeResourceRow mode="detailed"
      identity={<NodeResourceIdentity name="Product" />}
      details="Per machine 1000 · 100%" detailsTitle="Complete recipe evidence"
      policy={<span title="Full capacity policy">Capacity 100</span>}
      auxiliaryAction={<button aria-label="Inspect Product">…</button>} />)
    expect(markup).toContain('Per machine 1000 · 100%')
    expect(markup).toContain('title="Complete recipe evidence"')
    expect(markup).toContain('tabindex="0"')
    expect(markup).toContain('Full capacity policy')
    expect(markup).toContain('Capacity 100')
    expect(markup).toContain('Inspect Product')
  })

})
