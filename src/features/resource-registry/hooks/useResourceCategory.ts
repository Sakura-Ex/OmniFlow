import { useMemo } from 'react'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { FALLBACK_CATEGORY } from '@/features/resource-registry/registry.defaults'
import type { ResourceCategoryDef } from '@/common/types/registry'
import { getCategory } from '@/common/utils/resourceId'

/**
 * Resolves the resource category definition for a given type identifier.
 * Falls back to the default fallback category when no match is found.
 *
 * @param typeId - The resource type or category identifier to look up.
 * @returns The matching `ResourceCategoryDef` or `FALLBACK_CATEGORY`.
 */
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
