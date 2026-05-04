import { useMemo } from 'react'
import { useResourceRegistry } from '../registry/resourceRegistry'
import { FALLBACK_CATEGORY } from '../registry/defaults'
import type { ResourceCategoryDef } from '../registry/types'

export function useResourceCategory(typeId?: string | null): ResourceCategoryDef {
  const getCategory = useResourceRegistry((state) => state.getCategory)

  return useMemo(() => {
    if (!typeId) return FALLBACK_CATEGORY

    const exact = getCategory(typeId)
    if (exact) return exact

    const colonIdx = typeId.indexOf(':')
    if (colonIdx > 0) {
      const namespace = typeId.slice(0, colonIdx)
      const nsMatch = getCategory(namespace)
      if (nsMatch) return nsMatch
    }

    return FALLBACK_CATEGORY
  }, [typeId, getCategory])
}
