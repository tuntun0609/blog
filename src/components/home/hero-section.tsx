import {
  ArrowDownIcon,
  BookOpenIcon,
  Code2Icon,
  MailIcon,
  MapPinIcon,
} from 'lucide-react'
import Link from 'next/link'
import { BilibiliIcon } from '@/components/bilibili-icon'
import { GitHubIcon } from '@/components/github-icon'
import { AvatarStickerClient } from '@/components/home/avatar-sticker-client'
import { HeroTitleReveal } from '@/components/home/hero-title-reveal'
import { ArrowUpRightIcon } from '@/components/ui/arrow-up-right'
import { XIcon } from '@/components/x-icon'
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

export function HeroSection() {
  return (
    <section aria-labelledby="hero-title" className={styles.hero}>
      <div className={styles.profile}>
        <AvatarStickerClient />

        <div className={styles.profileIdentity}>
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
                <Icon aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>WEB FRONT-END DEVELOPER</p>
        <h1 className={styles.heroTitle} id="hero-title">
          <HeroTitleReveal />
        </h1>
        <p className={styles.heroLead}>
          Hello, 我是 Tuntun，一名前端开发者。专注于
          React、Next.js、浏览器扩展。
        </p>

        <div className={styles.heroActions}>
          <a className={styles.primaryAction} href="#projects">
            查看项目
            <ArrowDownIcon aria-hidden="true" data-icon="inline-end" />
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
    </section>
  )
}
