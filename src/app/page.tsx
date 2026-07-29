import { ArrowUpRightIcon, MailIcon, RssIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { GitHubIcon } from '@/components/github-icon'
import { GithubActivity } from '@/components/home/github-activity'
import { HeroSection } from '@/components/home/hero-section'
import { HomeMotion } from '@/components/home/home-motion'
import { ProjectsShowcase } from '@/components/home/projects-showcase'
import { TechnologiesKeyboard } from '@/components/home/technologies-keyboard'
import { SiteHeader } from '@/components/site-header'
import { formatPostDate, getPublishedPosts } from '@/lib/blog'
import styles from './home.module.css'

export const metadata: Metadata = {
  description: 'Tuntun 的个人主页，记录 Web 前端开发、开源项目与持续学习。',
  title: 'Tuntun — Web 前端开发者',
}

export default function HomePage() {
  const recentPosts = getPublishedPosts().slice(0, 4)

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
          aria-labelledby="about-title"
          className={styles.aboutSection}
          id="about"
        >
          <div className={styles.sectionHeading} data-reveal>
            <p className={styles.sectionKicker}>01 / ABOUT</p>
            <h2 id="about-title">构建、记录，再持续改进。</h2>
          </div>

          <div className={styles.aboutGrid}>
            <p className={styles.aboutStatement} data-reveal>
              我喜欢从真实使用场景出发，把信息结构、交互细节与工程质量放在同一个问题里考虑。
            </p>
            <div className={styles.aboutDetails} data-delay="1" data-reveal>
              <p>
                平时主要使用 TypeScript、React 和
                Next.js，也在浏览器扩展、画布交互、内容系统与 AI
                工具方向持续实践。
              </p>
              <p>
                除了写代码，我会在博客和语雀记录前端基础、工程经验与常见面试问题，让一次解决方案变成可以继续使用的知识。
              </p>
              <a
                className={styles.inlineLink}
                href="https://www.yuque.com/tuntun-nozomi/document"
                rel="noopener"
                target="_blank"
              >
                查看语雀文档
                <ArrowUpRightIcon aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="projects-title"
          className={styles.projectsSection}
          id="projects"
        >
          <div className={styles.sectionHeading} data-reveal>
            <p className={styles.sectionKicker}>02 / SELECTED PROJECTS</p>
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
            <p className={styles.sectionKicker}>03 / WRITING</p>
            <h2 id="notes-title">最近写下的内容</h2>
          </div>

          <div className={styles.noteList}>
            {recentPosts.map((post, index) => (
              <Link
                className={styles.noteRow}
                data-delay={index}
                data-reveal
                href={post.url}
                key={post.url}
              >
                <span className={styles.noteIndex}>0{index + 1}</span>
                <div>
                  <p>{post.data.category}</p>
                  <h3>{post.data.title ?? '未命名文章'}</h3>
                </div>
                <time dateTime={post.data.date}>
                  {formatPostDate(post.data.date)}
                </time>
                <ArrowUpRightIcon aria-hidden="true" />
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
              <p className={styles.sectionKicker}>04 / OPEN SOURCE</p>
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
              <p className={styles.sectionKicker}>05 / CONTACT</p>
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

      <footer className={styles.footer}>
        <p>Tuntun · Web Front-End Developer</p>
        <div>
          <span>Designed &amp; built with Next.js</span>
          <a href="#main-content">回到顶部</a>
        </div>
      </footer>
    </div>
  )
}
