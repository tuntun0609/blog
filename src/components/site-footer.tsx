import Link from 'next/link'
import styles from './site-footer.module.css'

interface SiteFooterProps {
  linkHref: string
  linkLabel: string
  message: string
}

export function SiteFooter({ linkHref, linkLabel, message }: SiteFooterProps) {
  return (
    <footer className={styles.footer}>
      <p>Tuntun · Web Front-End Developer</p>
      <div>
        <span>{message}</span>
        <Link href={linkHref}>{linkLabel}</Link>
      </div>
    </footer>
  )
}
