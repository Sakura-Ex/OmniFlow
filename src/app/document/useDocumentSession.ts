import { useCallback, useEffect, useState } from 'react'
import { t } from '@/common/i18n'
import { createSaveBaseline } from '@/common/utils/saveBaseline'
import { captureDocument } from '@/features/file-io/captureDocument'
import type { CanvasDocument } from '@/features/file-io/canvasDocument'
import { useCanvasStore } from '@/features/canvas/canvas.store'
import { useRecipeStore } from '@/features/recipe/recipe.store'
import { useSettingsStore } from '@/features/settings/settings.store'
import { useGlobalResourceTable } from '@/features/resource-registry/registry.store'
import { useNodeDisplayStore } from '@/features/settings/nodeDisplay.store'

/** Coordinate saved identity and leave protection across all document owners.
 * @returns Save acknowledgement and explicit document-replacement guard.
 */
export function useDocumentSession() {
  const [baseline] = useState(() => createSaveBaseline(captureDocument()))
  const update = useCallback(() => {
    const dirty = baseline.isDirty(captureDocument())
    if (useCanvasStore.getState().isDirty !== dirty) useCanvasStore.setState({ isDirty: dirty })
  }, [baseline])
  useEffect(() => {
    // Initial graph seeding precedes this effect; it is not a user's unsaved edit.
    baseline.markSaved(captureDocument())
    update()
    const dispose = [useCanvasStore.subscribe(update), useRecipeStore.subscribe(update),
      useSettingsStore.subscribe(update), useGlobalResourceTable.subscribe(update), useNodeDisplayStore.subscribe(update)]
    const leave = (event: BeforeUnloadEvent) => {
      if (!baseline.isDirty(captureDocument())) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', leave)
    return () => { dispose.forEach(stop => stop()); window.removeEventListener('beforeunload', leave) }
  }, [baseline, update])
  const markSaved = useCallback((snapshot: CanvasDocument) => { baseline.markSaved(snapshot); update() }, [baseline, update])
  const confirmReplace = useCallback(() => !baseline.isDirty(captureDocument()) || window.confirm(t('shell.discardDocument')), [baseline])
  return { markSaved, confirmReplace }
}
