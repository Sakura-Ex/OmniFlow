export const nodeDisplayZhCN = {
  'canvas.nodeDetails': '查看详情',
  'canvas.targetMet': '达标',
  'canvas.targetUnmet': '未达标',
  'canvas.targetUnverified': '待计算核验',
  'canvas.settingAmount': '设定',
  'canvas.minimumAmount': '至少',
  'canvas.exactAmount': '固定',
  'canvas.invalidQuantity': '请输入非负数',
  'canvas.routingIdentity': '路由身份',
  'canvas.portIdentity': '端口身份',
  'canvas.boundaryPolicy': '边界条件',
  'canvas.portSemantics': '端口语义',
} as const

export const nodeDisplayEn: Record<keyof typeof nodeDisplayZhCN, string> = {
  'canvas.nodeDetails': 'View details',
  'canvas.targetMet': 'Met',
  'canvas.targetUnmet': 'Unmet',
  'canvas.targetUnverified': 'Awaiting calculation',
  'canvas.settingAmount': 'Set',
  'canvas.minimumAmount': 'Min.',
  'canvas.exactAmount': 'Exact',
  'canvas.invalidQuantity': 'Enter a nonnegative number',
  'canvas.routingIdentity': 'Routing identity',
  'canvas.portIdentity': 'Port identity',
  'canvas.boundaryPolicy': 'Boundary condition',
  'canvas.portSemantics': 'Port semantics',
}
