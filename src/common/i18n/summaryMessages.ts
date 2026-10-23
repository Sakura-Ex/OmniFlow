/** Persistent production summary labels. */
export const summaryZhCN = {
  'summary.label': '核心结果摘要',
  'summary.delivery': '交付产率',
  'summary.noTargets': '未设置交付目标',
  'summary.machines': '安装机器',
  'summary.more': '全部 {count} 项',
  'summary.types': '{count} 种机器',
  'summary.retained': '上次结果 · 已过期',
  'summary.close': '收起明细',
} as const

/** English counterparts for production summary labels. */
export const summaryEn: Record<keyof typeof summaryZhCN, string> = {
  'summary.label': 'Core results',
  'summary.delivery': 'Delivery rate',
  'summary.noTargets': 'No delivery targets',
  'summary.machines': 'Installed machines',
  'summary.more': 'All {count} resources',
  'summary.types': '{count} machine types',
  'summary.retained': 'Previous result · Outdated',
  'summary.close': 'Close details',
}
