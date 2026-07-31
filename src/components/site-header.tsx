import Link from 'next/link'
import { GitHubIcon } from '@/components/github-icon'
import { ThemeToggle } from '@/components/theme-toggle'
import styles from './site-header.module.css'

interface SiteHeaderProps {
  isHomePage?: boolean
}

export function SiteHeader({ isHomePage = false }: SiteHeaderProps) {
  const sectionPrefix = isHomePage ? '' : '/'

  return (
    <header
      className={`${styles.header} ${isHomePage ? styles.homeHeader : ''}`}
    >
      <div className={styles.headerInner}>
        <Link aria-label="Tuntun 的个人主页" className={styles.brand} href="/">
          @tuntun0609
        </Link>

        <nav aria-label="主导航" className={styles.nav}>
          <Link
            className={`${styles.navLink} ${styles.sectionLink}`}
            href={`${sectionPrefix}#projects`}
          >
            项目
          </Link>
          <Link className={styles.navLink} href="/blog">
            文章
          </Link>
          <Link className={styles.navLink} href="/tools">
            工具
          </Link>
          <a
            aria-label="在 GitHub 查看 tuntun0609"
            className={styles.iconLink}
            href="https://github.com/tuntun0609"
            rel="noopener"
            target="_blank"
          >
            <GitHubIcon aria-hidden="true" />
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
