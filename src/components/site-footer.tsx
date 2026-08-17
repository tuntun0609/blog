import Link from 'next/link'
import styles from './site-footer.module.css'

const currentYear = new Date().getFullYear()

interface SiteFooterProps {
  linkHref: string
  linkLabel: string
  message: string
}

export function SiteFooter({ linkHref, linkLabel, message }: SiteFooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.identity}>
        <span className={styles.copyright}>
          © {currentYear} Tuntun. All rights reserved.
        </span>
      </div>
      <div className={styles.meta}>
        <span>{message}</span>
        <Link href={linkHref}>{linkLabel}</Link>
      </div>
    </footer>
  )
}
