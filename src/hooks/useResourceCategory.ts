import { useMemo } from 'react'
import { useGlobalResourceTable } from '../registry/globalResourceTable'
import { FALLBACK_CATEGORY } from '../registry/defaults'
import type { ResourceCategoryDef } from '../registry/types'
import { getCategory } from '../utils/resourceIdentifier'

export function useResourceCategory(typeId?: string | null): ResourceCategoryDef {
  const categories = useGlobalResourceTable((state) => state.categories)

  return useMemo(() => {
    if (!typeId) return FALLBACK_CATEGORY

    const exact = categories[typeId]
    if (exact) return exact

    const categoryId = getCategory(typeId)
    const nsMatch = categories[categoryId]
    if (nsMatch) return nsMatch

    return FALLBACK_CATEGORY
  }, [typeId, categories])
}
