import type { UnitSnapshot } from '@/common/types/units'
import { UnitSystem } from '@/common/units/UnitSystem'
import { readCanvasDocument } from './canvasDocument'

/** Validate clipboard documents without changing the receiving environment.
 * @param input - Untrusted clipboard JSON.
 * @param environment - Receiving canvas environment.
 * @returns Validated nodes with authoritative recipe data.
 */
export function readClipboardDocument(input: unknown, environment: UnitSnapshot) {
  const { document } = readCanvasDocument(input)
  const canonical = (snapshot: UnitSnapshot) => {
    const units = new UnitSystem(snapshot).snapshot
    return JSON.stringify({ ...units, definitions: [...units.definitions].sort((a, b) => a.id.localeCompare(b.id)), prefixes: [...units.prefixes].sort((a, b) => a.id.localeCompare(b.id)) })
  }
  if (canonical(document.environment) !== canonical(environment)) throw new Error('剪贴板单位环境与当前画布不同，请使用文件导入以保留原始单位和 TPS。')
  return document
}
