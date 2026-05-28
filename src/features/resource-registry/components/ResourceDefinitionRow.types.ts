import type { ValueOf } from '@/common/types/common'

export const ResourceColumnId = {
  Id: 'id',
  Amount: 'amount',
  TimeBase: 'time_base',
  Category: 'category',
  Probability: 'probability',
  Routing: 'routing',
  Delete: 'delete',
  PreviewRate: 'preview_rate',
  Label: 'label',
  Spacer: 'spacer',
  IoToggle: 'io_toggle',
} as const satisfies Record<string, string>

/** Union type of all valid resource column identifiers. */
export type ResourceColumnId = ValueOf<typeof ResourceColumnId>
