import type { TimeBase } from '@/common/types/resource'
import type { ResourceColumnId } from './ResourceDefinitionRow.types'

export interface ColumnDef {
  id: ResourceColumnId
  header: string
  width?: string
}

export const RECIPE_INPUT_COLUMNS: ColumnDef[] = [
  { id: 'category', header: '类别', width: '1fr' },
  { id: 'id', header: 'ID', width: '1fr' },
  { id: 'amount', header: '数量', width: '1fr' },
  { id: 'time_base', header: '基准', width: 'minmax(0, 56px)' },
  { id: 'probability', header: '消耗几率', width: 'minmax(0, 56px)' },
  { id: 'routing', header: '', width: 'minmax(0, 34px)' },
  { id: 'delete', header: '', width: 'minmax(0, 34px)' },
  { id: 'preview_rate', header: '实际速率', width: 'minmax(0, 80px)' },
]

export const RECIPE_OUTPUT_COLUMNS: ColumnDef[] = [
  { id: 'category', header: '类别', width: '1fr' },
  { id: 'id', header: 'ID', width: '1fr' },
  { id: 'amount', header: '数量', width: '1fr' },
  { id: 'time_base', header: '基准', width: 'minmax(0, 56px)' },
  { id: 'probability', header: '产出几率', width: 'minmax(0, 56px)' },
  { id: 'routing', header: '', width: 'minmax(0, 34px)' },
  { id: 'delete', header: '', width: 'minmax(0, 34px)' },
  { id: 'preview_rate', header: '实际速率', width: 'minmax(0, 80px)' },
]

export const UTILITY_COLUMNS: ColumnDef[] = [
  { id: 'io_toggle', header: 'I/O', width: 'minmax(0, 34px)' },
  { id: 'category', header: '类别', width: '1fr' },
  { id: 'id', header: 'ID', width: '1fr' },
  { id: 'amount', header: '数量', width: '1fr' },
  { id: 'time_base', header: '基准', width: 'minmax(0, 56px)' },
  { id: 'probability', header: '消耗几率', width: 'minmax(0, 56px)' },
  { id: 'routing', header: '', width: 'minmax(0, 34px)' },
  { id: 'delete', header: '', width: 'minmax(0, 34px)' },
  { id: 'preview_rate', header: '实际速率', width: 'minmax(0, 80px)' },
]

export const MACHINE_UTILITY_COLUMNS: ColumnDef[] = [
  { id: 'label', header: '设施', width: 'auto' },
  { id: 'amount', header: '用量', width: '1fr' },
  { id: 'spacer', header: '', width: 'auto' },
  { id: 'routing', header: '', width: '34px' },
  { id: 'delete', header: '', width: '34px' },
  { id: 'preview_rate', header: '实际速率', width: 'auto' },
]

export const ENDPOINT_COLUMNS: ColumnDef[] = [
  { id: 'category', header: '类别', width: '1fr' },
  { id: 'id', header: '资源 ID', width: '3fr' },
  { id: 'routing', header: '', width: 'minmax(0, 34px)' },
  { id: 'delete', header: '', width: 'minmax(0, 34px)' },
]

export const TIME_BASE_OPTIONS: { value: TimeBase; label: string }[] = [
  { value: 'per_cycle', label: '/配方' },
  { value: 'rate_per_tick', label: '/tick' },
  { value: 'rate_per_sec', label: '/秒' },
]
