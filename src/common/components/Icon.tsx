import type { CSSProperties } from 'react'
import styles from './Icon.module.css'

const paths = {
  close: 'M6 6l12 12M18 6 6 18',
  check: 'm5 12 4 4L19 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  chevronDown: 'm6 9 6 6 6-6',
  chevronRight: 'm9 6 6 6-6 6',
  chevronUp: 'm6 15 6-6 6 6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3',
  bolt: 'm13 2-9 12h7l-1 8 10-12h-7z',
  wand: 'm4 17 11-11 3 3L7 20zM13 8l3 3M4 3v4M2 5h4M18 2v4M16 4h4M3 11v2M2 12h2',
  settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1',
  moon: 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z',
  clock: 'M21 13a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 8v5l3 2M9 1h6',
  save: 'M4 3h13l4 4v14H3V3zM7 3v6h9V3M7 21v-8h10v8',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload: 'M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5',
  folder: 'M3 7V4h6l2 3h10v13H3z',
  undo: 'M8 4 3 9l5 5M3 9h11a6 6 0 0 1 0 12',
  redo: 'm16 4 5 5-5 5M21 9H10a6 6 0 0 0 0 12',
  copy: 'M9 9h12v12H9zM5 15H3V3h12v2',
  cut: 'M8 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M8 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0M8 8l13 12M8 16 21 3',
  paste: 'M9 3h6v4H9zM9 5H5v16h14V5h-4',
  duplicate: 'M9 9h12v12H9zM5 15H3V3h12v2M15 12v6M12 15h6',
  selectAll: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M8 8h8v8H8z',
  clearSelection: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M9 9l6 6M15 9l-6 6',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  unlink: 'm3 3 18 18M10 7l3-3a5 5 0 0 1 7 7l-3 3M14 17l-3 3a5 5 0 0 1-7-7l3-3',
  clear: 'm15 3 6 6-11 11H5l-4-4zM8 9l6 6M10 20h12',
  fitView: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M8 8h8v8H8z',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
  warning: 'M12 3 2 21h20zM12 9v5M12 17h.01',
} as const

/** Shared decorative interface icon; the enclosing control owns its accessible name.
 * @param props - Icon shape and optional presentation overrides.
 * @param props.name - Semantic icon name.
 * @param props.size - Width and height in CSS pixels.
 * @param props.className - Additional layout class.
 * @param props.style - Optional inline positioning.
 * @returns Theme-coloured, fixed-stroke SVG.
 */
export function Icon({ name, size = 16, className = '', style }: { name: keyof typeof paths; size?: number; className?: string; style?: CSSProperties }) {
  return <svg className={`${styles.icon} ${className}`} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>
}
