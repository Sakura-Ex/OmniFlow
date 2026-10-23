/** Persisted resource colours are data, separate from the UI theme palette. */
export const RESOURCE_COLORS = {
  item: '#e5e7eb',
  fluid: '#4ddcff',
  energy: '#f59e0b',
  stress: '#c084fc',
  heat: '#fb7185',
  fallback: 'rgba(148, 163, 184, 0.4)',
} as const

/** A bounded palette for new categories; existing user colours are preserved. */
export const RESOURCE_COLOR_PALETTE = [
  RESOURCE_COLORS.item,
  RESOURCE_COLORS.fluid,
  RESOURCE_COLORS.energy,
  RESOURCE_COLORS.stress,
  RESOURCE_COLORS.heat,
  '#3e9471',
  '#5576bd',
  '#987550',
] as const
