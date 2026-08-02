import type { Metadata } from 'next'
import { HomeCopy } from '@/components/home/home-copy'
import { HomeMotion } from '@/components/home/home-motion'
import { SiteHeader } from '@/components/site-header'
import { getRecentPosts } from '@/lib/blog'
import styles from './home.module.css'

export const metadata: Metadata = {
  description: 'Tuntun 的个人主页，记录 Web 前端开发、开源项目与持续学习。',
  title: 'Tuntun — Web 前端开发者',
}

const RECENT_POSTS_LIMIT = 6

export default function HomePage() {
  const recentPosts = getRecentPosts(RECENT_POSTS_LIMIT)

  return (
    <div className={styles.page} id="tuntun-home">
      <HomeMotion rootId="tuntun-home" />

      <a className={styles.skipLink} href="#main-content">
        跳至主要内容
      </a>

      <SiteHeader isHomePage />
      <HomeCopy recentPosts={recentPosts} />
    </div>
  )
}
