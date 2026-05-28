import { useMemo } from 'react'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { FALLBACK_CATEGORY } from '@/features/resource-registry/registry.defaults'
import type { ResourceCategoryDef } from '@/common/types/registry'
import { getCategory } from '@/common/utils/resourceId'

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
