import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const eslint = new ESLint({ cwd: root })

describe('ESLint architecture boundaries', () => {
  it.each([
    '@/features/canvas/canvas.store',
    '../../features/canvas/canvas.store',
    '@/features/canvas/canvas.store.ts',
  ])('rejects common utilities importing %s', async specifier => {
    const [result] = await eslint.lintText(`import '${specifier}'\n`, {
      filePath: 'src/common/utils/id.ts',
    })
    expect(result.messages.some(message => message.ruleId === 'boundaries/element-types')).toBe(true)
    expect(result.messages.some(message => message.fatal)).toBe(false)
  })

  it('allows shared utilities importing common types with an alias', async () => {
    const [result] = await eslint.lintText("import type { Recipe } from '@/common/types/recipe'\nexport type Allowed = Recipe\n", {
      filePath: 'src/common/utils/id.ts',
    })
    expect(result.messages.filter(message => message.severity === 2)).toEqual([])
  })

  it('parses TSX and enforces boundaries for aliased TSX imports', async () => {
    const [result] = await eslint.lintText("import '@/features/canvas/components/RecipeNode'\nexport const Shared = () => <span />\n", {
      filePath: 'src/common/components/BoundarySentinel.tsx',
    })
    expect(result.messages.some(message => message.fatal)).toBe(false)
    expect(result.messages.some(message => message.ruleId === 'boundaries/element-types')).toBe(true)
  })

  it.each([
    ['src/features/calculation/networkCompiler.ts', true],
    ['src/features/calculation/hooks/useCalculation.ts', false],
    ['src/features/calculation/components/NetworkConfigurationEditor.tsx', false],
    ['src/features/calculation/calculationResult.test.ts', false],
    ['src/features/recipe/recipe.store.ts', true],
    ['src/features/recipe/hooks/useNodeOperations.ts', false],
  ])('preserves the canvas dependency policy for %s', async (filePath, forbidden) => {
    const [result] = await eslint.lintText("import '@/features/canvas/canvas.store'\n", { filePath })
    expect(result.messages.some(message => message.ruleId === 'boundaries/element-types')).toBe(forbidden)
    expect(result.messages.some(message => message.fatal)).toBe(false)
  })
})
