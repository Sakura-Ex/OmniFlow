/** Labels for layered recipe presentation; stored model values remain language independent. */
export const recipeDisplayZhCN = {
  'recipeDisplay.details': '节点详情',
  'recipeDisplay.installed': '安装需求',
  'recipeDisplay.more': '更多 {count} 项',
  'recipeDisplay.modifiers': '修饰器 {count} 项',
  'recipeDisplay.probability': '概率 {value}',
  'recipeDisplay.cycle': '周期 {value} s',
  'recipeDisplay.capacity': '容量 {value}',
  'recipeDisplay.state': '状态 {value}',
  'recipeDisplay.spill': '排放 ≤ {value}',
  'recipeDisplay.closed': '禁止排放',
  'recipeDisplay.delivery': '交付',
  'recipeDisplay.supply': '外供 ≤ {value}',
  'recipeDisplay.upper': '运行上限',
  'recipeDisplay.invalid': '请输入非负数，或留空取消上限',
} as const

/** English counterparts for recipe presentation labels. */
export const recipeDisplayEn: Record<keyof typeof recipeDisplayZhCN, string> = {
  'recipeDisplay.details': 'Node details',
  'recipeDisplay.installed': 'Installation',
  'recipeDisplay.more': '{count} more',
  'recipeDisplay.modifiers': '{count} modifiers',
  'recipeDisplay.probability': 'Chance {value}',
  'recipeDisplay.cycle': 'Cycle {value} s',
  'recipeDisplay.capacity': 'Capacity {value}',
  'recipeDisplay.state': 'State {value}',
  'recipeDisplay.spill': 'Spill ≤ {value}',
  'recipeDisplay.closed': 'Spill forbidden',
  'recipeDisplay.delivery': 'Delivery',
  'recipeDisplay.supply': 'Supply ≤ {value}',
  'recipeDisplay.upper': 'Operating cap',
  'recipeDisplay.invalid': 'Enter a nonnegative number, or leave empty for no limit',
}
