import type { UiTranslationKey } from '@/common/i18n'
import type { TimeBase } from '@/common/types/resource'
import type { ResourceColumnId } from './ResourceDefinitionRow.types'

/** Describes a single column in a resource definition table. */
export interface ColumnDef {
  id: ResourceColumnId
  headerKey?: UiTranslationKey
  width?: string
}

/** Column definitions for the recipe inputs table. */
export const RECIPE_INPUT_COLUMNS: ColumnDef[] = [
  { id: 'category', headerKey: 'editor.category', width: '88px' },
  { id: 'id', headerKey: 'editor.id', width: 'minmax(96px, 1fr)' },
  { id: 'unit', headerKey: 'editor.unit', width: 'minmax(44px, 70px)' },
  { id: 'amount', headerKey: 'editor.amount', width: '80px' },
  { id: 'time_base', headerKey: 'editor.timeBase', width: 'minmax(0, 56px)' },
  { id: 'probability', headerKey: 'editor.consumptionChance', width: 'minmax(0, 56px)' },
  { id: 'routing', headerKey: 'editor.global', width: '40px' },
  { id: 'delete', width: 'minmax(0, 34px)' },
  { id: 'preview_rate', headerKey: 'editor.previewRate', width: 'minmax(0, 80px)' },
]

export const RECIPE_OUTPUT_COLUMNS: ColumnDef[] = [
  { id: 'category', headerKey: 'editor.category', width: '88px' },
  { id: 'id', headerKey: 'editor.id', width: 'minmax(96px, 1fr)' },
  { id: 'unit', headerKey: 'editor.unit', width: 'minmax(44px, 70px)' },
  { id: 'amount', headerKey: 'editor.amount', width: '80px' },
  { id: 'time_base', headerKey: 'editor.timeBase', width: 'minmax(0, 56px)' },
  { id: 'probability', headerKey: 'editor.outputChance', width: 'minmax(0, 56px)' },
  { id: 'routing', headerKey: 'editor.global', width: '40px' },
  { id: 'delete', width: 'minmax(0, 34px)' },
  { id: 'preview_rate', headerKey: 'editor.previewRate', width: 'minmax(0, 80px)' },
]

export const UTILITY_COLUMNS: ColumnDef[] = [
  { id: 'io_toggle', headerKey: 'editor.io', width: 'minmax(0, 34px)' },
  { id: 'category', headerKey: 'editor.category', width: '88px' },
  { id: 'id', headerKey: 'editor.id', width: 'minmax(96px, 1fr)' },
  { id: 'unit', headerKey: 'editor.unit', width: 'minmax(44px, 70px)' },
  { id: 'amount', headerKey: 'editor.amount', width: '80px' },
  { id: 'time_base', headerKey: 'editor.timeBase', width: 'minmax(0, 56px)' },
  { id: 'probability', headerKey: 'editor.consumptionChance', width: 'minmax(0, 56px)' },
  { id: 'routing', headerKey: 'editor.global', width: '40px' },
  { id: 'delete', width: 'minmax(0, 34px)' },
  { id: 'preview_rate', headerKey: 'editor.previewRate', width: 'minmax(0, 80px)' },
]

export const MACHINE_UTILITY_COLUMNS: ColumnDef[] = [
  { id: 'label', headerKey: 'editor.utility', width: 'auto' },
  { id: 'unit', headerKey: 'editor.unit', width: 'minmax(44px, 70px)' },
  { id: 'amount', headerKey: 'editor.usage', width: '80px' },
  { id: 'spacer', width: 'auto' },
  { id: 'routing', headerKey: 'editor.global', width: '40px' },
  { id: 'delete', width: '34px' },
  { id: 'preview_rate', headerKey: 'editor.previewRate', width: 'auto' },
]

export const ENDPOINT_COLUMNS: ColumnDef[] = [
  { id: 'category', headerKey: 'editor.category', width: '88px' },
  { id: 'id', headerKey: 'editor.resourceId', width: 'minmax(96px, 2fr)' },
  { id: 'unit', headerKey: 'editor.unit', width: '70px' },
  { id: 'routing', headerKey: 'editor.global', width: '40px' },
  { id: 'delete', width: 'minmax(0, 34px)' },
]

/** Available time-base options for resource amounts. */
export const TIME_BASE_OPTIONS: { value: TimeBase; labelKey: UiTranslationKey }[] = [
  { value: 'per_cycle', labelKey: 'editor.perCycle' },
  { value: 'rate_per_tick', labelKey: 'editor.perTick' },
  { value: 'rate_per_sec', labelKey: 'editor.perSecond' },
]
