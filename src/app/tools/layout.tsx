import type { ReactNode } from 'react'
import styles from './layout.module.css'

interface ToolsLayoutProps {
  children: ReactNode
}

export default function ToolsLayout({ children }: ToolsLayoutProps) {
  return (
    <div className={styles.route} data-tools-layout="">
      {children}
    </div>
  )
}
