import type { IMachineModifier, Resource } from '../types/types'

const gtOverclockModifier: IMachineModifier = {
  id: 'gt_overclock',
  name: 'GT Overclock',
  ui_schema: [
    {
      key: 'enabled',
      label: 'Enable Overclock',
      type: 'toggle',
      defaultValue: false,
    },
    {
      key: 'level',
      label: 'Overclock Level',
      type: 'slider',
      defaultValue: 0,
    },
  ],
  apply: (inputs, outputs, timeContext, uiState) => {
    if (!uiState.enabled) return

    const rawLevel = Number(uiState.level ?? 0)
    const level = Number.isFinite(rawLevel) ? Math.max(0, Math.floor(rawLevel)) : 0
    if (level <= 0) return

    const speedScale = Math.pow(2, level)
    const ioScale = Math.pow(2, level)

    for (const res of inputs) {
      res.amount *= ioScale
    }
    for (const res of outputs) {
      res.amount *= ioScale
    }
    timeContext.duration = Math.max(1, timeContext.duration / speedScale)
  },
}

const probabilisticOutputModifier: IMachineModifier = {
  id: 'chance_output',
  name: 'Chance Output',
  ui_schema: [
    {
      key: 'enabled',
      label: 'Enable Chance Roll',
      type: 'toggle',
      defaultValue: false,
    },
    {
      key: 'targetResourceId',
      label: 'Target Output ID',
      type: 'select',
      options: [],
      defaultValue: '',
    },
    {
      key: 'probability',
      label: 'Probability (0-1)',
      type: 'number',
      defaultValue: 1,
    },
  ],
  apply: (_inputs, outputs, _timeContext, uiState) => {
    if (!uiState.enabled) return

    const prob = Number(uiState.probability)
    const normalizedProb = Number.isFinite(prob) ? Math.max(0, Math.min(1, prob)) : 1
    const targetId = String(uiState.targetResourceId || '')

    for (const out of outputs) {
      if (!targetId || out.id === targetId) {
        out.amount *= normalizedProb
      }
    }
  },
}

export const modifierRegistry: Record<string, IMachineModifier> = {
  [gtOverclockModifier.id]: gtOverclockModifier,
  [probabilisticOutputModifier.id]: probabilisticOutputModifier,
}

export function listModifiers(): IMachineModifier[] {
  return Object.values(modifierRegistry)
}

export function getModifierById(modifierId: string): IMachineModifier | null {
  return modifierRegistry[modifierId] ?? null
}

export function createDefaultModifierState(modifierId: string): Record<string, any> {
  const modifier = getModifierById(modifierId)
  if (!modifier) return {}

  return modifier.ui_schema.reduce<Record<string, any>>((acc, control) => {
    acc[control.key] = control.defaultValue
    return acc
  }, {})
}

export function patchModifierSchemaWithNodeResources(
  modifier: IMachineModifier,
  outputs: Resource[]
): IMachineModifier {
  if (modifier.id !== 'chance_output') return modifier

  const dynamicOptions = outputs.map((o) => o.id)
  const ui_schema = modifier.ui_schema.map((item) => {
    if (item.key !== 'targetResourceId') return item
    return {
      ...item,
      options: dynamicOptions,
      defaultValue: dynamicOptions[0] ?? '',
    }
  })

  return {
    ...modifier,
    ui_schema,
  }
}
