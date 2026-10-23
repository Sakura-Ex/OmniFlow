import { describe, expect, it, vi } from 'vitest'

vi.mock('react', () => { throw new Error('Calculation must not load React') })
vi.mock('./modifier.ui.registry', () => { throw new Error('Calculation must not load modifier UI') })
vi.mock('./modifiers/gregtech/gtOverclockerCard', () => { throw new Error('Calculation must not load cards') })
vi.mock('./modifiers/gregtech/gtParallelCard', () => { throw new Error('Calculation must not load cards') })
vi.mock('./modifiers/gregtech/gtProbabilityOutputCard', () => { throw new Error('Calculation must not load cards') })

describe('modifier calculation entry point', () => {
  it('loads the registry and pipeline without UI dependencies', async () => {
    const core = await import('./index')
    expect(core.getModifierById('gt_parallel')?.evaluate).toBeTypeOf('function')
    expect(core.runModifierPipeline).toBeTypeOf('function')
    expect(core.computePowerPool([{ tier: 'HV', amps: 2 }])).toEqual({
      totalEuPerTick: 1024,
      highestTier: 'HV',
    })
  })
})
