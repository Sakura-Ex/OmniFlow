import { afterEach, describe, expect, it } from 'vitest'
import { setLocale } from './index'
import { domainEn, domainZhCN, type DomainMessageKey } from './domainMessages'
import { translateDiagnostic } from './translateDiagnostic'

afterEach(() => setLocale('zh-CN'))

describe('diagnostic presentation translation', () => {
  it('keeps matching catalogs and parameter names for every known diagnostic', () => {
    expect(Object.keys(domainEn)).toEqual(Object.keys(domainZhCN))
    for (const key of Object.keys(domainEn) as DomainMessageKey[]) {
      const parameters = (text: string) => [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map(match => match[1]).sort()
      expect(parameters(domainEn[key]), key).toEqual(parameters(domainZhCN[key]))
      expect(domainEn[key].length, key).toBeGreaterThan(0)
      expect(domainZhCN[key].length, key).toBeGreaterThan(0)
    }
  })

  it('translates compiler diagnostics without changing JSON port identities', () => {
    const address = '["node:中文-1","dynamic:gt:water-$&"]'
    const canonical = `Missing positive flow source: ${address}`
    const chinese = `缺少正流量来源：${address}`
    expect(translateDiagnostic(canonical, 'zh-CN')).toBe(chinese)
    expect(translateDiagnostic(chinese, 'en')).toBe(canonical)
  })

  it('translates nested edge and modifier messages in both directions', () => {
    const canonical = 'Edge edge-水: Missing input port: node-目标/in:0'
    const chinese = '连线 edge-水：缺少输入端口：node-目标/in:0'
    expect(translateDiagnostic(canonical, 'zh-CN')).toBe(chinese)
    expect(translateDiagnostic(chinese, 'en')).toBe(canonical)
    expect(translateDiagnostic('mod:parallel must run after mod:voltage', 'zh-CN')).toBe('mod:parallel 必须在 mod:voltage 之后运行')
  })

  it('relocalizes retained calculation errors when the UI language changes', () => {
    const message = 'solver_error: 请求总预算已用尽，尚未取得已验证方案。\nnode-1: 供电不足，请提高能源仓电压或数量。'
    setLocale('en')
    const english = translateDiagnostic(message)
    expect(english).toContain('The total request budget has expired without a verified solution.')
    expect(english).toContain('node-1: Insufficient power. Increase the energy hatch voltage or quantity.')
    setLocale('zh-CN')
    expect(translateDiagnostic(english)).toContain('供电不足，请提高能源仓电压或数量。')
  })

  it('translates schema issue messages while preserving codes, paths, and values', () => {
    const issues = [{ code: 'custom', message: 'Splitter ratios must sum to one', path: ['outputs', 2], received: 0.3 }]
    expect(JSON.parse(translateDiagnostic(JSON.stringify(issues), 'zh-CN'))).toEqual([{ ...issues[0], message: '分流比例合计必须为 100%' }])
  })

  it('preserves unknown backend details byte for byte', () => {
    for (const message of ['HiGHS unexpected internal status 42: custom detail', '["node","port"]', 'upstream error\nopaque code=42', '[{"message":"Opaque server detail","path":["variables",1],"code":"custom"}]']) {
      expect(translateDiagnostic(message, 'zh-CN')).toBe(message)
      expect(translateDiagnostic(message, 'en')).toBe(message)
    }
  })

  it('covers environment/file migration and solver diagnostics at the display boundary', () => {
    expect(translateDiagnostic('Unknown project: 项目-A', 'zh-CN')).toBe('未知项目：项目-A')
    expect(translateDiagnostic('计算服务返回格式不兼容（HTTP 502），请从当前项目重新启动后端。', 'en')).toContain('HTTP 502')
    expect(translateDiagnostic('Diagnostic variable identities do not match.', 'zh-CN')).toBe('诊断变量身份不匹配。')
    expect(translateDiagnostic('Optimization stopped with infeasible', 'zh-CN')).toBe('求解停止，状态为 不可行')
  })
})
