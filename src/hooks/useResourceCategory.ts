import { useMemo } from 'react'
import { useResourceRegistry } from '../registry/resourceRegistry'
import { FALLBACK_CATEGORY } from '../registry/defaults'
import type { ResourceCategoryDef } from '../registry/types'
import { getCategory } from '../utils/resourceIdentifier'

export function useResourceCategory(typeId?: string | null): ResourceCategoryDef {
  const getCat = useResourceRegistry((state) => state.getCategory)

  return useMemo(() => {
    if (!typeId) return FALLBACK_CATEGORY

    const exact = getCat(typeId)
    if (exact) return exact

    const categoryId = getCategory(typeId)
    const nsMatch = getCat(categoryId)
    if (nsMatch) return nsMatch

    return FALLBACK_CATEGORY
  }, [typeId, getCat])
}
