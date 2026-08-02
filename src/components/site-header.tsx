import Link from 'next/link'
import { GitHubIcon } from '@/components/github-icon'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'
import styles from './site-header.module.css'

type ActiveSection = 'blog' | 'tools'

interface SiteHeaderProps {
  activeSection?: ActiveSection
  isHomePage?: boolean
}

export function SiteHeader({
  activeSection,
  isHomePage = false,
}: SiteHeaderProps) {
  const sectionPrefix = isHomePage ? '' : '/'

  return (
    <header className={cn(styles.header, isHomePage && styles.homeHeader)}>
      <div className={styles.headerInner}>
        <Link aria-label="Tuntun 的个人主页" className={styles.brand} href="/">
          @tuntun0609
        </Link>

        <nav aria-label="主导航" className={styles.nav}>
          <div className={styles.navLinks}>
            <Link
              className={cn(styles.navLink, styles.sectionLink)}
              href={`${sectionPrefix}#projects`}
            >
              项目
            </Link>
            <Link
              aria-current={activeSection === 'blog' ? 'page' : undefined}
              className={cn(
                styles.navLink,
                activeSection === 'blog' && styles.navLinkActive
              )}
              href="/blog"
            >
              文章
            </Link>
            <Link
              aria-current={activeSection === 'tools' ? 'page' : undefined}
              className={cn(
                styles.navLink,
                activeSection === 'tools' && styles.navLinkActive
              )}
              href="/tools"
            >
              工具
            </Link>
          </div>

          <div className={styles.navActions}>
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
          </div>
        </nav>
      </div>
    </header>
  )
}
