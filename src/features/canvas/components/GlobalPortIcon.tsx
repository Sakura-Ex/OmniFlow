import { t, useTranslation } from '@/common/i18n'
import styles from './shared-port.module.css'

/** Render the original wireless port symbol on the corresponding node edge.
 * @param props - Port side; colour is inherited from the resource row.
 * @param props.side - Edge on which the port is displayed.
 * @returns The v1 circular port and two directional signal arcs.
 */
export function GlobalPortIcon({ side }: { side: 'left' | 'right' }) {
  useTranslation()
  return <svg className={`${styles['recipe-node__global-icon']} ${styles[`recipe-node__global-icon--${side}`]}`} viewBox="0 0 16 16" fill="none" stroke="var(--port-color)" strokeWidth="1.5" strokeLinecap="round" role="img" aria-label={t('canvas.global_bus')}>
    <title>{t('canvas.global_bus')}</title>
    <circle cx="12" cy="8" r="6" fill="var(--port-color)" stroke="none" />
    <path d={side === 'left' ? 'M-1 8 A 13 13 0 0 1 12 -5' : 'M25 8 A 13 13 0 0 0 12 -5'} />
    <path d={side === 'left' ? 'M3 8 A 9 9 0 0 1 12 -1' : 'M21 8 A 9 9 0 0 0 12 -1'} />
  </svg>
}
