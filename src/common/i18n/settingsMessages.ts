/** Full settings page navigation and appearance labels. */
export const settingsZhCN = {
  'settings.title': '设置',
  'settings.back': '返回画布',
  'settings.categories': '设置分类',
  'settings.general': '常规与外观',
  'settings.production': '产线与网络',
  'settings.resources': '资源字典',
  'settings.units': '单位与 TPS',
  'settings.theme': '主题',
  'settings.language': '界面语言',
  'settings.reset': '重置更改',
} as const

export const settingsEn: Record<keyof typeof settingsZhCN, string> = {
  'settings.title': 'Settings',
  'settings.back': 'Back to canvas',
  'settings.categories': 'Settings categories',
  'settings.general': 'General & appearance',
  'settings.production': 'Production & network',
  'settings.resources': 'Resource registry',
  'settings.units': 'Units & TPS',
  'settings.theme': 'Theme',
  'settings.language': 'Interface language',
  'settings.reset': 'Reset changes',
}
