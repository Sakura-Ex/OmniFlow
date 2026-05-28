import type { ReactNode } from 'react'
import modalStyles from '@/common/components/Modal.module.css'
import styles from './SettingsDrawerShell.module.css'

type SettingsDrawerShellProps = {
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function SettingsDrawerShell({ title, eyebrow, onClose, children, footer }: SettingsDrawerShellProps) {
  return (
    <div className={modalStyles.overlay} onClick={onClose} role="presentation">
      <div className={`${modalStyles.panel} ${styles.modal}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className={modalStyles.header}>
          <div>
            {eyebrow && <p className={modalStyles.eyebrow}>{eyebrow}</p>}
            <h3 className={styles.title}>{title}</h3>
          </div>
          <button className={modalStyles.closeBtn} onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </header>

        <div className={styles.body}>
          {children}
        </div>

        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>
  )
}
