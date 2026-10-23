import { afterEach, describe, expect, it } from 'vitest'
import { getLocale, setLocale, t } from './index'
import type { UiTranslationKey } from './index'
import { en, zhCN } from './messages'
import { archetypeDisplayName, categoryDisplayName } from './resourceLabels'

afterEach(() => setLocale('zh-CN'))

describe('UI translation', () => {
  it('provides matching, nonempty dictionary coverage', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zhCN).sort())
    for (const key of Object.keys(zhCN) as UiTranslationKey[]) {
      expect(t(key, 'en').trim()).not.toBe('')
      expect(t(key, 'zh-CN').trim()).not.toBe('')
    }
  })

  it('uses the selected locale and allows explicit lookup without changing it', () => {
    setLocale('en')
    expect(getLocale()).toBe('en')
    expect(t('menu.file')).toBe('File')
    expect(t('menu.file', 'zh-CN')).toBe('文件')
    expect(getLocale()).toBe('en')
  })

  it('falls back to the default dictionary and finally the raw key', () => {
    const original = en['menu.file']
    en['menu.file'] = ''
    try {
      expect(t('menu.file', 'en')).toBe('文件')
      expect(t('missing.ui.key' as UiTranslationKey, 'en')).toBe('missing.ui.key')
    } finally {
      en['menu.file'] = original
    }
  })

  it('interpolates values literally and preserves placeholders without a value', () => {
    expect(t('canvas.actual', { p0: '$&', p1: 'L/s' }, 'en')).toBe('Actual $& L/s')
    expect(t('canvas.actual', { p0: 2 }, 'en')).toBe('Actual 2 {p1}')
    expect(t('canvas.actual', { p0: 2, p1: 'L/s' }, 'zh-CN')).toBe('实际 2 L/s')
  })

  it('localizes built-in metadata without changing custom resource or category names', () => {
    setLocale('en')
    expect(categoryDisplayName('item', '物品')).toBe('Items')
    expect(categoryDisplayName('item', '我的物品')).toBe('我的物品')
    expect(categoryDisplayName('custom', '物品')).toBe('物品')
    expect(archetypeDisplayName('custom_generic', '通用自定义范式')).toBe('Generic custom archetype')
    expect(archetypeDisplayName('custom_generic', '我的机器')).toBe('我的机器')
  })
})
