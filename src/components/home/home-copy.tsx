import {
  BookOpenIcon,
  Code2Icon,
  MailIcon,
  MapPinIcon,
  RssIcon,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { BilibiliIcon } from '@/components/bilibili-icon'
import { GitHubIcon } from '@/components/github-icon'
import { GithubActivity } from '@/components/home/github-activity'
import { HeroSection } from '@/components/home/hero-section'
import { HeroTitleReveal } from '@/components/home/hero-title-reveal'
import { ProjectsShowcase } from '@/components/home/projects-showcase'
import { TechnologiesKeyboard } from '@/components/home/technologies-keyboard'
import { ArrowUpRightIcon } from '@/components/ui/arrow-up-right'
import { XIcon } from '@/components/x-icon'
import { formatPostDate, type getRecentPosts } from '@/lib/blog'
import styles from '@/app/home.module.css'

const socialLinks = [
  {
    href: 'https://github.com/tuntun0609',
    icon: GitHubIcon,
    name: 'GitHub',
  },
  {
    href: 'https://x.com/TunTun669664',
    icon: XIcon,
    name: 'X',
  },
  {
    href: 'https://space.bilibili.com/47706697',
    icon: BilibiliIcon,
    name: 'Bilibili',
  },
  {
    href: 'https://www.yuque.com/tuntun-nozomi/document',
    icon: BookOpenIcon,
    name: '语雀',
  },
  {
    href: 'mailto:tun.nozomi@gmail.com',
    icon: MailIcon,
    name: '邮箱',
  },
] as const

type RecentPosts = ReturnType<typeof getRecentPosts>

interface HomeCopyProps {
  readonly recentPosts: RecentPosts
}

export function HomeCopy({ recentPosts }: HomeCopyProps) {
  return (
    <>
      <main id="main-content">
        <div className={styles.homeIntroLayout}>
          <HeroSection>
            <div className={styles.heroIdentity}>
              <div>
                <p className={styles.profileName}>Tuntun</p>
                <p className={styles.handle}>@tuntun0609</p>
              </div>
              <div className={styles.socials}>
                {socialLinks.map(({ href, icon: Icon, name }) => (
                  <a
                    aria-label={name}
                    href={href}
                    key={href}
                    rel={href.startsWith('mailto:') ? undefined : 'noopener'}
                    target={href.startsWith('mailto:') ? undefined : '_blank'}
                    title={name}
                  >
                    {Icon ? <Icon aria-hidden="true" /> : null}
                  </a>
                ))}
              </div>
            </div>

            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>WEB FRONT-END DEVELOPER</p>
              <h1 className={styles.heroTitle} id="hero-title">
                <HeroTitleReveal text="FullStack Developer" />
              </h1>
              <p className={styles.heroLead}>
                Hello, 我是 Tuntun，一名前端开发者。专注于
                React、Next.js、浏览器扩展。
              </p>

              <div className={styles.heroActions}>
                <a className={styles.primaryAction} href="#projects">
                  查看项目
                  <ArrowUpRightIcon aria-hidden="true" data-icon="inline-end" />
                </a>
                <Link className={styles.secondaryAction} href="/blog">
                  阅读文章
                  <ArrowUpRightIcon aria-hidden="true" data-icon="inline-end" />
                </Link>
              </div>

              <dl className={styles.heroFacts}>
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
          </HeroSection>

          <TechnologiesKeyboard />
        </div>

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

      <footer className={styles.footer}>
        <p>Tuntun · Web Front-End Developer</p>
        <div>
          <span>Designed &amp; built with Next.js</span>
          <a href="#main-content">回到顶部</a>
        </div>
      </footer>
    </>
  )
}
