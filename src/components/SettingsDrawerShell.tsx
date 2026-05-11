import type { ReactNode } from 'react'
import './ResourceRegistryPanel.css'

type SettingsDrawerShellProps = {
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function SettingsDrawerShell({ title, eyebrow, onClose, children, footer }: SettingsDrawerShellProps) {
  return (
    <div className="resource-registry__overlay" onClick={onClose} role="presentation">
      <div className="resource-registry__modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="resource-registry__header">
          <div>
            {eyebrow && <p className="resource-registry__eyebrow">{eyebrow}</p>}
            <h3 className="resource-registry__title">{title}</h3>
          </div>
          <button className="resource-registry__icon-btn" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </header>

        <div className="resource-registry__body">
          {children}
        </div>

        {footer && <footer className="resource-registry__footer">{footer}</footer>}
      </div>
    </div>
  )
}
