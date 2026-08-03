import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import styles from '@/components/blog/blog.module.css'

export default function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        跳至主要内容
      </a>
      <SiteHeader activeSection="blog" />
      <main className={styles.main} id="main-content">
        {children}
      </main>
      <SiteFooter
        linkHref="/blog"
        linkLabel="文章归档"
        message="持续记录，认真构建"
      />
    </div>
  )
}
