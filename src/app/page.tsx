import {
  ArrowDownIcon,
  ArrowUpRightIcon,
  BookOpenIcon,
  Code2Icon,
  MailIcon,
  MapPinIcon,
  PlayCircleIcon,
  RssIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { AvatarSticker } from '@/components/home/avatar-sticker'
import { GithubActivity } from '@/components/home/github-activity'
import { HomeMotion } from '@/components/home/home-motion'
import { ThemeToggle } from '@/components/theme-toggle'
import { formatPostDate, getPublishedPosts } from '@/lib/blog'
import styles from './home.module.css'

export const metadata: Metadata = {
  description: 'Tuntun 的个人主页，记录 Web 前端开发、开源项目与持续学习。',
  title: 'Tuntun — Web 前端开发者',
}

const GitHubIcon = () => (
  <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2A11.5 11.5 0 0 1 12 6.5c1 0 2 .1 3 .4 2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v2.9c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
  </svg>
)

const socialLinks = [
  {
    href: 'https://github.com/tuntun0609',
    icon: GitHubIcon,
    label: 'GitHub',
  },
  {
    href: 'https://space.bilibili.com/47706697',
    icon: PlayCircleIcon,
    label: 'Bilibili',
  },
  {
    href: 'https://www.yuque.com/tuntun-nozomi/document',
    icon: BookOpenIcon,
    label: '语雀',
  },
  {
    href: 'mailto:tun.nozomi@gmail.com',
    icon: MailIcon,
    label: '邮箱',
  },
] as const

const technologies = [
  'TypeScript',
  'React',
  'Next.js',
  'Tailwind CSS',
  'Node.js',
  'Browser Extensions',
] as const

const projects = [
  {
    description:
      '探索内容与视觉表达结合方式的 TypeScript 项目，持续打磨信息图生成体验。',
    href: 'https://github.com/tuntun0609/infographic-ai',
    index: '01',
    meta: 'TypeScript · 7 stars',
    title: 'infographic-ai',
  },
  {
    description:
      '一个便于快速构建 SaaS 产品的 Next.js 模板，关注清晰的项目结构与开发体验。',
    href: 'https://github.com/tuntun0609/easy-saas-next',
    index: '02',
    meta: 'Next.js · TypeScript',
    title: 'easy-saas-next',
  },
  {
    description:
      'Bilibili 网页优化浏览器扩展，用更顺手的交互改善日常观看体验。',
    href: 'https://github.com/tuntun0609/tun-bili-tool',
    index: '03',
    meta: 'Browser Extension · 40 stars',
    title: 'tun-bili-tool',
  },
  {
    description: '为 Leafer 元素提供吸附能力，让画布编辑中的对齐操作更自然。',
    href: 'https://github.com/tuntun0609/leafer-x-snap',
    index: '04',
    meta: 'TypeScript · 24 stars',
    title: 'leafer-x-snap',
  },
] as const

export default function HomePage() {
  const recentPosts = getPublishedPosts().slice(0, 4)

  return (
    <div className={styles.page} id="tuntun-home">
      <HomeMotion rootId="tuntun-home" />

      <a className={styles.skipLink} href="#main-content">
        跳至主要内容
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link
            aria-label="Tuntun 的个人主页"
            className={styles.brand}
            href="/"
          >
            @tuntun0609
          </Link>

          <nav aria-label="主导航" className={styles.nav}>
            <a href="#about">关于</a>
            <a href="#projects">项目</a>
            <Link href="/blog">文章</Link>
            <a
              aria-label="在 GitHub 查看 tuntun0609"
              className={styles.iconLink}
              href="https://github.com/tuntun0609"
              rel="noopener"
              target="_blank"
            >
              <GitHubIcon />
            </a>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section aria-labelledby="hero-title" className={styles.hero}>
          <div className={styles.profile} data-reveal>
            <AvatarSticker />

            <div className={styles.profileIdentity}>
              <div>
                <p className={styles.profileName}>Tuntun</p>
                <p className={styles.handle}>@tuntun0609</p>
              </div>
              <div className={styles.socials}>
                {socialLinks.map(({ href, icon: Icon, label }) => (
                  <a
                    aria-label={label}
                    href={href}
                    key={href}
                    rel={href.startsWith('mailto:') ? undefined : 'noopener'}
                    target={href.startsWith('mailto:') ? undefined : '_blank'}
                    title={label}
                  >
                    <Icon aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.heroCopy}>
            <p className={styles.eyebrow} data-delay="1" data-reveal>
              WEB FRONT-END DEVELOPER
            </p>
            <h1
              className={styles.heroTitle}
              data-delay="1"
              data-reveal
              id="hero-title"
            >
              把复杂的产品问题，做成清晰、可靠的界面。
            </h1>
            <p className={styles.heroLead} data-delay="2" data-reveal>
              我是 Tuntun，一名前端开发者。专注于
              React、Next.js、浏览器扩展与交互工具，也持续把实践写成能被复用的文章。
            </p>

            <div className={styles.heroActions} data-delay="2" data-reveal>
              <a className={styles.primaryAction} href="#projects">
                查看项目
                <ArrowDownIcon aria-hidden="true" data-icon="inline-end" />
              </a>
              <Link className={styles.secondaryAction} href="/blog">
                阅读文章
                <ArrowUpRightIcon aria-hidden="true" data-icon="inline-end" />
              </Link>
            </div>

            <dl className={styles.heroFacts} data-delay="3" data-reveal>
              <div>
                <dt>
                  <MapPinIcon aria-hidden="true" />
                  所在地
                </dt>
                <dd>Mars</dd>
              </div>
              <div>
                <dt>
                  <Code2Icon aria-hidden="true" />
                  当前关注
                </dt>
                <dd>AI 工具 · 内容体验 · 开源</dd>
              </div>
            </dl>
          </div>
        </section>

        <section aria-label="技术栈" className={styles.technologyBand}>
          <div className={styles.technologyInner} data-reveal>
            <p>Technologies</p>
            <ul>
              {technologies.map((technology, index) => (
                <li data-tone={index % 3} key={technology}>
                  <span aria-hidden="true" />
                  {technology}
                </li>
              ))}
            </ul>
          </div>
        </section>

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

          <div className={styles.projectList}>
            {projects.map((project) => (
              <article
                className={styles.projectRow}
                data-reveal
                key={project.href}
              >
                <span className={styles.projectIndex}>{project.index}</span>
                <div className={styles.projectCopy}>
                  <h3>{project.title}</h3>
                  <p>{project.description}</p>
                </div>
                <p className={styles.projectMeta}>{project.meta}</p>
                <a
                  aria-label={`在 GitHub 查看 ${project.title}`}
                  className={styles.projectLink}
                  href={project.href}
                  rel="noopener"
                  target="_blank"
                >
                  <ArrowUpRightIcon aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>

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
