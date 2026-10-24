import type { ReactNode } from 'react'
import type { NodeDisplayMode } from '@/common/types/nodeDisplay'
import styles from './NodeFrame.module.css'

/** Keep node chrome and display-mode identity independent of node-specific content.
 * @param props - Display preference, semantic styling and node content.
 * @param props.mode - Current document display mode; does not mutate calculation state.
 * @param props.className - Node-specific width or semantic emphasis.
 * @param props.children - Header, summaries, resource layout and optional editors.
 * @returns Shared article surface without imposing a node-specific width.
 */
export function NodeFrame({ mode, className, children }: { mode: NodeDisplayMode; className?: string; children: ReactNode }) {
  return <article className={`${styles.frame}${className ? ` ${className}` : ''}`} data-display-mode={mode}>{children}</article>
}

/** Reserve stable space for a title and its independent controls and actions.
 * @param props - Header content owned by the node's domain component.
 * @param props.title - Full accessible title; visual overflow is abbreviated.
 * @param props.controls - Optional fixed-width control such as an endpoint mode picker.
 * @param props.actions - Node actions, including temporary details.
 * @returns Fixed-height header whose controls cannot squeeze or wrap the title.
 */
export function NodeHeader({ title, controls, actions }: { title: string; controls?: ReactNode; actions: ReactNode }) {
  return <header className={styles.header}>
    <h2 className={styles.title} title={title}>{title}</h2>
    {controls && <div className={`${styles.controls} nodrag nopan`}>{controls}</div>}
    <div className={`${styles.actions} nodrag nopan`}>{actions}</div>
  </header>
}

/** Separate resource directions without consuming layout width or covering ports.
 * @param props - Resource sections and their presentation arrangement.
 * @param props.children - One resource section or the input and output sections.
 * @param props.className - Additional spacing for a resource group.
 * @param props.columns - Split input/output columns or a single endpoint column.
 * @returns A shared resource region; its divider never extends into headers or summaries.
 */
export function NodeResourceLayout({ children, className, columns = 'split' }: { children: ReactNode; className?: string; columns?: 'single' | 'split' }) {
  return <div className={`${styles.resources} ${styles[columns]}${className ? ` ${className}` : ''}`}>{children}</div>
}
