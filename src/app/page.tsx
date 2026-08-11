import { MailIcon, RssIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { GitHubIcon } from '@/components/github-icon'
import { GithubActivity } from '@/components/home/github-activity'
import { HeroSection } from '@/components/home/hero-section'
import { HomeMotion } from '@/components/home/home-motion'
import { ProjectsShowcase } from '@/components/home/projects-showcase'
import { TechnologiesKeyboard } from '@/components/home/technologies-keyboard'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { ArrowUpRightIcon } from '@/components/ui/arrow-up-right'
import { formatPostDate, getRecentPosts } from '@/lib/blog'
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

      <main id="main-content">
        <HeroSection />

        <TechnologiesKeyboard />

        <section
          aria-labelledby="projects-title"
          className={styles.projectsSection}
          id="projects"
        >
          <div className={styles.sectionHeading} data-reveal>
            <p className={styles.sectionKicker}>SELECTED PROJECTS</p>
            <h2 id="projects-title">正在构建的东西</h2>
          </div>

          <ProjectsShowcase />

          <a
            className={styles.allProjectsLink}
            href="https://github.com/tuntun0609?tab=repositories"
            rel="noopener"
            target="_blank"
          >
            查看全部 74 个公开仓库
            <ArrowUpRightIcon aria-hidden="true" />
          </a>
        </section>

        <section aria-labelledby="notes-title" className={styles.notesSection}>
          <div className={styles.sectionHeading} data-reveal>
            <p className={styles.sectionKicker}>WRITING</p>
            <h2 id="notes-title">最近写下的内容</h2>
          </div>

          <div className={styles.noteList} data-reveal>
            {recentPosts.map((post) => (
              <Link className={styles.noteCard} href={post.url} key={post.url}>
                <div className={styles.noteCover}>
                  <Image
                    alt=""
                    fill
                    sizes="(max-width: 680px) calc(100vw - 3rem), (max-width: 1023px) 50vw, 33vw"
                    src={post.data.cover}
                  />
                </div>

                <div className={styles.noteCardBody}>
                  <div className={styles.noteCardMeta}>
                    <span className={styles.noteCategory}>
                      {post.data.category}
                    </span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={post.data.date}>
                      {formatPostDate(post.data.date)}
                    </time>
                  </div>
                  <h3>{post.data.title ?? '未命名文章'}</h3>
                  <p className={styles.noteDescription}>
                    {post.data.description}
                  </p>
                </div>

                <div className={styles.noteCardFooter}>
                  <span className={styles.noteReadMore}>
                    阅读文章
                    <ArrowUpRightIcon aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <Link className={styles.allNotesLink} href="/blog">
            <RssIcon aria-hidden="true" />
            浏览全部文章
          </Link>
        </section>

        <section
          aria-labelledby="github-title"
          className={styles.githubSection}
        >
          <div className={styles.githubIntro} data-reveal>
            <div>
              <p className={styles.sectionKicker}>OPEN SOURCE</p>
              <h2 id="github-title">在 GitHub 上保持公开构建。</h2>
            </div>
            <div className={styles.githubCopy}>
              <p>
                项目、实验和这个博客本身都公开在
                GitHub。持续提交，也持续把过程留下来。
              </p>
              <a
                className={styles.githubCta}
                href="https://github.com/tuntun0609"
                rel="noopener"
                target="_blank"
              >
                <GitHubIcon />
                关注 @tuntun0609
              </a>
            </div>
          </div>

          <GithubActivity />
        </section>

        <section
          aria-labelledby="contact-title"
          className={styles.contactSection}
        >
          <div className={styles.contactCopy} data-reveal>
            <div>
              <p className={styles.sectionKicker}>CONTACT</p>
              <h2 id="contact-title">一起做点有用的东西。</h2>
            </div>
            <p>有项目想法、开源协作或只是想聊聊前端工程，都可以直接发邮件。</p>
          </div>

          <a className={styles.contactLink} href="mailto:tun.nozomi@gmail.com">
            <span className={styles.contactAddress}>
              <MailIcon aria-hidden="true" />
              tun.nozomi@gmail.com
            </span>
            <ArrowUpRightIcon aria-hidden="true" />
          </a>
        </section>
      </main>

      <SiteFooter
        linkHref="#main-content"
        linkLabel="回到顶部"
        message="Designed & built with Next.js"
      />
    </div>
  )
}
